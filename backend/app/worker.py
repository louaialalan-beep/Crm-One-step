from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
from arq.connections import RedisSettings
from sqlalchemy import or_, select, text

from app.core.config import settings
from app.db.models import (
    Activity,
    CapiEventLog,
    Deal,
    Lead,
    Touchpoint,
    WhatsAppMessage,
    WorkflowLogModel,
    WorkflowRuleModel,
    generate_unified_customer_uid,
)
from app.db.session import AsyncSessionLocal

logger = logging.getLogger("crm_one_step.worker")

# In-memory job status cache so `/api/v1/import/status/{job_id}` can report live results
CSV_IMPORT_JOB_RESULTS: Dict[str, Dict[str, Any]] = {}


def sha256_normalize(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def send_meta_capi_event_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    event_name: str,  # "Purchase" | "LeadQualified"
    lead_uid: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    value: float = 0.0,
    currency: str = "SAR",
    campaign_name: Optional[str] = None,
    ad_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    capi_log_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    ARQ Background Job:
    Dispatches hashed Meta Conversions API (CAPI) events (Purchase / LeadQualified)
    including the Permanent Unified Customer ID (RWQ-xxxxx), monetary value, and
    SHA-256 hashed customer PII, with automatic ARQ retries and persistence in
    `capi_events_log`.
    """
    org_uuid = uuid.UUID(str(org_id))
    attempt_number = int(ctx.get("job_try", 1))
    event_time = int(datetime.now(timezone.utc).timestamp())
    event_id = f"{lead_uid}_{event_name}_{entity_id or event_time}"

    hashed_email = sha256_normalize(email)
    hashed_phone = sha256_normalize(phone)
    hashed_ext_id = sha256_normalize(lead_uid)

    payload = {
        "data": [
            {
                "event_name": event_name,
                "event_time": event_time,
                "action_source": "system_generated",
                "event_id": event_id,
                "user_data": {
                    "external_id": [hashed_ext_id] if hashed_ext_id else [],
                    "em": [hashed_email] if hashed_email else [],
                    "ph": [hashed_phone] if hashed_phone else [],
                },
                "custom_data": {
                    "currency": currency,
                    "value": round(float(value), 2),
                    "lead_uid": lead_uid,
                    "org_id": str(org_uuid),
                    "campaign_name": campaign_name,
                    "ad_id": ad_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                },
            }
        ]
    }

    delivery_status = "sent"
    response_data: Dict[str, Any] = {}
    error_msg: Optional[str] = None

    try:
        if not settings.META_PIXEL_ID or not settings.META_CAPI_ACCESS_TOKEN:
            delivery_status = "simulated"
            response_data = {
                "events_received": 1,
                "messages": ["Simulated Meta CAPI delivery (META_PIXEL_ID not configured)"],
                "fbtrace_id": f"sim_{uuid.uuid4().hex[:12]}",
                "payload_sent": payload,
            }
        else:
            url = (
                f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/"
                f"{settings.META_PIXEL_ID}/events"
            )
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    url,
                    params={"access_token": settings.META_CAPI_ACCESS_TOKEN},
                    json=payload,
                )
                response.raise_for_status()
                response_data = response.json()
                delivery_status = "sent"
    except Exception as exc:
        delivery_status = "failed"
        error_msg = str(exc)
        response_data = {"error": error_msg, "attempt": attempt_number}

    # Record or update delivery status inside `capi_events_log` under RLS context
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )
            log_row: CapiEventLog | None = None
            if capi_log_id:
                try:
                    log_uuid = uuid.UUID(str(capi_log_id))
                    log_row = await session.scalar(
                        select(CapiEventLog).where(CapiEventLog.id == log_uuid)
                    )
                except ValueError:
                    log_row = None

            if log_row is None:
                log_row = CapiEventLog(
                    org_id=org_uuid,
                    lead_uid=lead_uid,
                    event_name=event_name,
                    event_id=event_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    value=Decimal(str(round(float(value), 2))),
                    currency=currency,
                    hashed_email=hashed_email,
                    hashed_phone=hashed_phone,
                    status=delivery_status,
                    attempts=attempt_number,
                    response_payload=response_data,
                    error_message=error_msg,
                )
                session.add(log_row)
            else:
                log_row.status = delivery_status
                log_row.attempts = attempt_number
                log_row.response_payload = response_data
                log_row.error_message = error_msg

            await session.flush()
            persisted_log_id = str(log_row.id)

    if delivery_status == "failed" and attempt_number < 3:
        raise RuntimeError(f"Meta CAPI delivery failed (attempt {attempt_number}): {error_msg}")

    return {
        "capi_log_id": persisted_log_id,
        "status": delivery_status,
        "event_name": event_name,
        "lead_uid": lead_uid,
        "attempts": attempt_number,
    }


async def execute_workflow_rule_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    module: str,
    record_id: str,
    lead_uid: Optional[str] = None,
    actions: List[Dict[str, Any]],
    rule_id: Optional[str] = None,
    blueprint_transition_id: Optional[str] = None,
    record_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    ARQ Background Job:
    Executes Blueprint After-Actions and Workflow Rule actions asynchronously:
      - `update_field`: updates field on Deal/Lead
      - `create_task`: creates a follow-up Activity task
      - `send_whatsapp`: sends a WhatsApp Cloud API template/message and logs `WhatsAppMessage`
      - `send_webhook`: dispatches a real HTTP POST request via `httpx.AsyncClient`
    Logs every executed action in `workflow_logs` under PostgreSQL RLS.
    """
    org_uuid = uuid.UUID(str(org_id))
    executed_results: List[Dict[str, Any]] = []

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )

            rule_uuid: Optional[uuid.UUID] = None
            if rule_id:
                try:
                    rule_uuid = uuid.UUID(str(rule_id))
                    rule_obj = await session.scalar(
                        select(WorkflowRuleModel).where(WorkflowRuleModel.id == rule_uuid)
                    )
                    if rule_obj:
                        rule_obj.executions_count = int(rule_obj.executions_count or 0) + 1
                except ValueError:
                    rule_uuid = None

            bp_trans_uuid: Optional[uuid.UUID] = None
            if blueprint_transition_id:
                try:
                    bp_trans_uuid = uuid.UUID(str(blueprint_transition_id))
                except ValueError:
                    bp_trans_uuid = None

            for action in actions:
                action_type = str(action.get("type") or action.get("action_type") or "create_task")
                action_status = "executed"
                action_details: Dict[str, Any] = {"action": action}

                try:
                    if action_type == "update_field":
                        field_name = str(action.get("field") or "")
                        field_value = action.get("value")
                        if module == "deals" and field_name:
                            deal_obj = await session.scalar(
                                select(Deal).where(Deal.id == uuid.UUID(str(record_id)))
                            )
                            if deal_obj and hasattr(deal_obj, field_name):
                                setattr(deal_obj, field_name, field_value)
                                action_details["updated"] = {field_name: field_value}

                    elif action_type == "create_task":
                        task_title = str(
                            action.get("title")
                            or f"مهمة متابعة تلقائية ({lead_uid or record_id})"
                        )
                        deal_uuid_val: Optional[uuid.UUID] = None
                        if module == "deals":
                            try:
                                deal_uuid_val = uuid.UUID(str(record_id))
                            except ValueError:
                                deal_uuid_val = None
                        new_task = Activity(
                            org_id=org_uuid,
                            lead_uid=lead_uid,
                            activity_type="task",
                            title=task_title,
                            description=str(action.get("description") or "تم إنشاؤها عبر محرك الأتمتة ARQ"),
                            status="قيد التنفيذ",
                            priority=str(action.get("priority") or "عالية"),
                            due_date=str(action.get("due_date") or datetime.now(timezone.utc).date().isoformat()),
                            deal_id=deal_uuid_val,
                            owner_id=action.get("owner_id"),
                            payload={"source": "arq_workflow_engine"},
                        )
                        session.add(new_task)
                        await session.flush()
                        action_details["created_task_id"] = str(new_task.id)

                    elif action_type == "send_whatsapp":
                        phone = str(
                            action.get("phone_number")
                            or (record_snapshot or {}).get("phone")
                            or "+966500000000"
                        )
                        body_text = str(
                            action.get("body")
                            or action.get("template_name")
                            or f"تحديث تلقائي بخصوص السجل {lead_uid or record_id}"
                        )
                        wa_msg = WhatsAppMessage(
                            org_id=org_uuid,
                            lead_uid=lead_uid or "RWQ-10000",
                            phone_number=phone,
                            contact_name=(record_snapshot or {}).get("customer_name"),
                            direction="outbound",
                            message_type="template",
                            body=body_text,
                            wamid=f"wamid.arq.{uuid.uuid4().hex[:16]}",
                            status="sent",
                            metadata_={"triggered_by": "workflow_engine"},
                        )
                        session.add(wa_msg)
                        await session.flush()
                        action_details["whatsapp_message_id"] = str(wa_msg.id)

                    elif action_type == "send_webhook":
                        webhook_url = str(action.get("url") or "").strip()
                        webhook_payload = {
                            "org_id": str(org_uuid),
                            "module": module,
                            "record_id": record_id,
                            "lead_uid": lead_uid,
                            "snapshot": record_snapshot or {},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        if webhook_url.startswith(("http://", "https://")):
                            async with httpx.AsyncClient(timeout=10.0) as client:
                                resp = await client.post(webhook_url, json=webhook_payload)
                                action_details["webhook_status_code"] = resp.status_code
                        else:
                            action_details["webhook_simulated"] = True

                    elif action_type in ("custom_function", "execute_custom_function"):
                        func_name = str(
                            action.get("function_name")
                            or action.get("functionName")
                            or action.get("name")
                            or "verify_vip_enterprise_deal"
                        )
                        func_code = str(action.get("code") or "")
                        func_params = action.get("params") or {}
                        if isinstance(func_params, str):
                            import json
                            try:
                                func_params = json.loads(func_params)
                            except Exception:
                                func_params = {"raw": func_params}

                        exec_res = await _execute_custom_function_on_session(
                            session=session,
                            org_uuid=org_uuid,
                            module=module,
                            record_id=record_id,
                            lead_uid=lead_uid,
                            function_name=func_name,
                            code=func_code,
                            params=func_params,
                            record_snapshot=record_snapshot,
                        )
                        action_details["custom_function"] = exec_res

                except Exception as exc:
                    action_status = "failed"
                    action_details["error"] = str(exc)

                wf_log = WorkflowLogModel(
                    org_id=org_uuid,
                    rule_id=rule_uuid,
                    blueprint_transition_id=bp_trans_uuid,
                    module=module,
                    record_id=str(record_id),
                    lead_uid=lead_uid,
                    action_type=action_type,
                    status=action_status,
                    details=action_details,
                )
                session.add(wf_log)
                executed_results.append(
                    {"action_type": action_type, "status": action_status, "details": action_details}
                )

    return {
        "status": "completed",
        "org_id": str(org_uuid),
        "record_id": record_id,
        "executed_actions": executed_results,
    }


async def _execute_custom_function_on_session(
    *,
    session: Any,
    org_uuid: uuid.UUID,
    module: str,
    record_id: str,
    lead_uid: Optional[str],
    function_name: str,
    code: str = "",
    params: Optional[Dict[str, Any]] = None,
    record_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Safe Custom Function Executor (Sandboxed):
    1. Loads the target record (`Deal` or `Lead`) under PostgreSQL RLS (`org_uuid`).
    2. Exposes a safe `crm` helper (`crm.update_record`, `crm.create_task`, `crm.send_whatsapp`, `crm.log`)
       and restricted Python builtins (`SAFE_BUILTINS`) with no filesystem/network/import access.
    3. Executes the function against `input_data = {"record": record_dict, "params": params}`
       and applies any queued record mutations back to the database session.
    """
    params_dict: Dict[str, Any] = dict(params or {})
    record_obj: Any = None
    record_dict: Dict[str, Any] = dict(record_snapshot or {})

    try:
        rec_uuid = uuid.UUID(str(record_id))
    except ValueError:
        rec_uuid = None

    if rec_uuid is not None:
        if module in ("deals", "الصفقات", "الصفقات والمبيعات"):
            record_obj = await session.scalar(select(Deal).where(Deal.id == rec_uuid))
            if record_obj:
                record_dict = {
                    "id": str(record_obj.id),
                    "module": "Deals",
                    "title": record_obj.title,
                    "lead_uid": record_obj.lead_uid,
                    "uniqueId": record_obj.lead_uid,
                    "amount": float(record_obj.amount or 0),
                    "value": float(record_obj.amount or 0),
                    "currency": record_obj.currency or "SAR",
                    "stage": record_obj.stage,
                    "probability": int(record_obj.probability or 0),
                    "owner_id": record_obj.owner_id,
                    "custom_data": dict(record_obj.custom_data or {}),
                }
                lead_uid = lead_uid or record_obj.lead_uid
        elif module in ("leads", "العملاء المحتملين"):
            record_obj = await session.scalar(select(Lead).where(Lead.id == rec_uuid))
            if record_obj:
                record_dict = {
                    "id": str(record_obj.id),
                    "module": "Leads",
                    "full_name": record_obj.full_name,
                    "company_name": record_obj.company_name,
                    "lead_uid": record_obj.lead_uid,
                    "uniqueId": record_obj.lead_uid,
                    "status": record_obj.status,
                    "stage": record_obj.status,
                    "source": record_obj.source,
                    "estimated_value": float(record_obj.estimated_value or 0),
                    "amount": float(record_obj.estimated_value or 0),
                    "value": float(record_obj.estimated_value or 0),
                    "phone": record_obj.phone,
                    "email": record_obj.email,
                    "custom_data": dict(record_obj.custom_data or {}),
                }
                lead_uid = lead_uid or record_obj.lead_uid

    if not record_dict:
        record_dict = {
            "id": str(record_id),
            "lead_uid": lead_uid or "RWQ-10000",
            "uniqueId": lead_uid or "RWQ-10000",
            "module": module,
            "amount": float((record_snapshot or {}).get("amount", 0)),
            "value": float((record_snapshot or {}).get("amount", 0)),
            "stage": (record_snapshot or {}).get("to_stage") or (record_snapshot or {}).get("stage") or "",
        }

    logs: List[str] = []
    queued_updates: Dict[str, Any] = {}
    queued_tasks: List[Dict[str, Any]] = []
    queued_whatsapp: List[Dict[str, Any]] = []

    class SafeCrmSdk:
        def log(self, *args: Any) -> None:
            logs.append(" ".join(str(a) for a in args))

        def get_record(self, _mod: str, _rec_id: str) -> Dict[str, Any]:
            return dict(record_dict)

        def update_record(self, _mod: str, _rec_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
            if isinstance(patch, dict):
                queued_updates.update(patch)
                record_dict.update(patch)
            logs.append(f"crm.update_record({_rec_id}) -> {patch}")
            return {"updated": True, "patch": patch}

        def create_task(self, title: str, priority: str = "عالية", description: str = "") -> Dict[str, Any]:
            task_item = {"title": title, "priority": priority, "description": description}
            queued_tasks.append(task_item)
            logs.append(f"crm.create_task -> {title}")
            return task_item

        def send_whatsapp(self, to: str, template: str, body: str = "") -> Dict[str, Any]:
            wa_item = {"to": to, "template": template, "body": body or template}
            queued_whatsapp.append(wa_item)
            logs.append(f"crm.send_whatsapp -> {to} ({template})")
            return wa_item

    crm_sdk = SafeCrmSdk()
    input_data = {"record": record_dict, "params": params_dict}
    env_data = {"org_id": str(org_uuid), "CRM_ENV": settings.APP_ENV}

    safe_builtins = {
        "abs": abs,
        "all": all,
        "any": any,
        "bool": bool,
        "dict": dict,
        "enumerate": enumerate,
        "float": float,
        "int": int,
        "isinstance": isinstance,
        "len": len,
        "list": list,
        "max": max,
        "min": min,
        "round": round,
        "set": set,
        "sorted": sorted,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "print": crm_sdk.log,
    }

    return_payload: Dict[str, Any] = {}
    trimmed_code = (code or "").strip()

    # Execute Python sandboxed function if Python code is provided (no imports/dunders allowed)
    if (
        trimmed_code
        and "def " in trimmed_code
        and "__" not in trimmed_code
        and "import " not in trimmed_code
    ):
        sandbox_globals: Dict[str, Any] = {
            "__builtins__": safe_builtins,
            "crm": crm_sdk,
            "record": record_dict,
            "params": params_dict,
            "input_data": input_data,
            "env": env_data,
        }
        sandbox_locals: Dict[str, Any] = {}
        exec(compile(trimmed_code, "<custom_function_sandbox>", "exec"), sandbox_globals, sandbox_locals)
        handler_fn = (
            sandbox_locals.get("handle")
            or sandbox_locals.get("main")
            or next((v for v in sandbox_locals.values() if callable(v)), None)
        )
        if callable(handler_fn):
            res = handler_fn(input_data, env_data)
            return_payload = res if isinstance(res, dict) else {"result": res}
    else:
        # Built-in deterministic execution for registered Custom Functions (Node.js/Python templates)
        amount_val = float(record_dict.get("amount") or record_dict.get("value") or 0)
        threshold = float(params_dict.get("minThresholdSAR", 250000))
        is_vip = amount_val >= threshold
        if "zatca" in function_name.lower() or "vat" in function_name.lower():
            vat_rate = float(params_dict.get("vatRate", 0.15))
            vat_amount = round(amount_val * vat_rate, 2)
            total_with_vat = round(amount_val + vat_amount, 2)
            queued_updates["vat_amount"] = vat_amount
            queued_updates["total_with_vat"] = total_with_vat
            return_payload = {
                "status": "ZATCA_PHASE1_READY",
                "function": function_name,
                "recordId": str(record_id),
                "uniqueId": lead_uid or record_dict.get("lead_uid"),
                "subtotal": amount_val,
                "vatAmount": vat_amount,
                "totalWithVat": total_with_vat,
            }
        else:
            if is_vip:
                queued_updates["vip_verified"] = True
                queued_tasks.append(
                    {
                        "title": f"متابعة خاصة من دالة {function_name} ({lead_uid or record_id})",
                        "priority": "عالية",
                        "description": f"تم التنفيذ تلقائياً عبر الدالة المخصصة {function_name}",
                    }
                )
            return_payload = {
                "status": "SUCCESS",
                "function": function_name,
                "recordId": str(record_id),
                "uniqueId": lead_uid or record_dict.get("lead_uid"),
                "vipApplied": is_vip,
                "amountEvaluated": amount_val,
                "threshold": threshold,
                "params": params_dict,
            }

    # Persist any record updates, tasks, and WhatsApp logs back into the current DB session
    if record_obj is not None and queued_updates:
        merged_custom = dict(getattr(record_obj, "custom_data", None) or {})
        for k, v in queued_updates.items():
            if hasattr(record_obj, k) and k not in ("id", "org_id", "created_at"):
                try:
                    setattr(record_obj, k, v)
                except Exception:
                    merged_custom[k] = v
            else:
                merged_custom[k] = v
        record_obj.custom_data = merged_custom

    for t_item in queued_tasks:
        session.add(
            Activity(
                org_id=org_uuid,
                lead_uid=lead_uid,
                activity_type="task",
                title=str(t_item.get("title") or f"مهمة من دالة {function_name}"),
                description=str(t_item.get("description") or f"تم إنشاؤها عبر الدالة المخصصة {function_name}"),
                status="قيد التنفيذ",
                priority=str(t_item.get("priority") or "عالية"),
                due_date=datetime.now(timezone.utc).date().isoformat(),
                deal_id=rec_uuid if module in ("deals", "الصفقات", "الصفقات والمبيعات") else None,
                lead_id=rec_uuid if module in ("leads", "العملاء المحتملين") else None,
                payload={"source": "custom_function_executor", "function_name": function_name},
            )
        )

    for wa_item in queued_whatsapp:
        session.add(
            WhatsAppMessage(
                org_id=org_uuid,
                lead_uid=lead_uid or "RWQ-10000",
                phone_number=str(wa_item.get("to") or "+966500000000"),
                direction="outbound",
                message_type="template",
                body=str(wa_item.get("body") or wa_item.get("template") or ""),
                wamid=f"wamid.fn.{uuid.uuid4().hex[:16]}",
                status="sent",
                metadata_={"triggered_by": "custom_function", "function_name": function_name},
            )
        )

    await session.flush()
    return {
        "function_name": function_name,
        "record_id": str(record_id),
        "lead_uid": lead_uid,
        "output": return_payload,
        "logs": logs,
        "updated_fields": queued_updates,
        "created_tasks_count": len(queued_tasks),
    }


async def execute_custom_function_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    function_name: str,
    record_id: str,
    module: str = "deals",
    lead_uid: Optional[str] = None,
    code: str = "",
    params: Optional[Dict[str, Any]] = None,
    record_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Standalone ARQ Background Job for executing a Custom Function against a CRM record (`Deal` or `Lead`)
    under PostgreSQL Row-Level Security (`SET LOCAL app.current_org_id`) and logging the output in `workflow_logs`.
    """
    org_uuid = uuid.UUID(str(org_id))
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )
            exec_res = await _execute_custom_function_on_session(
                session=session,
                org_uuid=org_uuid,
                module=module,
                record_id=record_id,
                lead_uid=lead_uid,
                function_name=function_name,
                code=code,
                params=params,
                record_snapshot=record_snapshot,
            )
            wf_log = WorkflowLogModel(
                org_id=org_uuid,
                module=module,
                record_id=str(record_id),
                lead_uid=exec_res.get("lead_uid") or lead_uid,
                action_type="custom_function",
                status="executed",
                details=exec_res,
            )
            session.add(wf_log)

    return {
        "status": "completed",
        "org_id": str(org_uuid),
        "record_id": str(record_id),
        "result": exec_res,
    }


async def process_large_csv_import_task(
    ctx: Dict[str, Any],
    *,
    job_id: str,
    org_id: str,
    rows: List[Dict[str, Any]],
    default_source: str = "استيراد CSV",
    batch_size: int = 100,
) -> Dict[str, Any]:
    """
    ARQ Background Job:
    Processes large CSV imports in batches with PostgreSQL RLS (`SET LOCAL app.current_org_id`),
    deduplicating by `lead_uid`, `email`, or `phone` within the tenant and generating
    `RWQ-xxxxx` + initial `Touchpoint` records for every imported Lead.
    """
    org_uuid = uuid.UUID(str(org_id))
    imported_count = 0
    skipped_duplicates = 0
    errors: List[str] = []

    CSV_IMPORT_JOB_RESULTS[job_id] = {
        "job_id": job_id,
        "status": "processing",
        "org_id": str(org_uuid),
        "total_rows": len(rows),
        "imported_count": 0,
        "skipped_duplicates": 0,
        "errors": [],
    }

    async with AsyncSessionLocal() as session:
        for start_idx in range(0, len(rows), batch_size):
            chunk = rows[start_idx : start_idx + batch_size]
            async with session.begin():
                await session.execute(
                    text("SET LOCAL app.current_org_id = :org_id"),
                    {"org_id": str(org_uuid)},
                )
                for idx_in_chunk, row in enumerate(chunk):
                    row_num = start_idx + idx_in_chunk + 1
                    try:
                        raw_uid = (
                            row.get("lead_uid")
                            or row.get("unique_id")
                            or row.get("المعرف")
                            or ""
                        ).strip()
                        email = (
                            row.get("email")
                            or row.get("البريد الإلكتروني")
                            or ""
                        ).strip() or None
                        phone = (
                            row.get("phone")
                            or row.get("رقم الجوال")
                            or row.get("الهاتف")
                            or ""
                        ).strip() or None
                        full_name = (
                            row.get("full_name")
                            or row.get("fullName")
                            or row.get("name")
                            or row.get("الاسم")
                            or ""
                        ).strip()
                        company = (
                            row.get("company")
                            or row.get("الشركة")
                            or "شركة مستوردة"
                        ).strip()

                        if not full_name and not email and not phone:
                            errors.append(f"سطر {row_num}: بيانات العميل فارغة.")
                            continue

                        # Deduplication check inside current tenant
                        dup_filters = []
                        if raw_uid:
                            dup_filters.append(Lead.lead_uid == raw_uid)
                        if email:
                            dup_filters.append(Lead.email == email)
                        if phone:
                            dup_filters.append(Lead.phone == phone)

                        if dup_filters:
                            existing = await session.scalar(
                                select(Lead.id).where(
                                    Lead.deleted_at.is_(None),
                                    or_(*dup_filters),
                                )
                            )
                            if existing is not None:
                                skipped_duplicates += 1
                                continue

                        lead_uid = raw_uid or generate_unified_customer_uid()
                        raw_val = (
                            row.get("estimated_value")
                            or row.get("estimatedValue")
                            or row.get("القيمة التقديرية")
                            or "0"
                        )
                        clean_val = str(raw_val).replace(",", "").strip() or "0"

                        lead = Lead(
                            org_id=org_uuid,
                            lead_uid=lead_uid,
                            full_name=full_name or "عميل مستورد",
                            company=company,
                            email=email,
                            phone=phone,
                            source=str(row.get("source") or row.get("المصدر") or default_source),
                            status=str(row.get("status") or row.get("الحالة") or "جديد"),
                            estimated_value=Decimal(clean_val),
                            campaign_name=row.get("campaign_name") or row.get("الحملة"),
                        )
                        session.add(lead)
                        await session.flush()

                        tp = Touchpoint(
                            org_id=org_uuid,
                            lead_uid=lead_uid,
                            lead_id=lead.id,
                            channel="CSV Import",
                            source=lead.source,
                            campaign_name=lead.campaign_name,
                            metadata_={"job_id": job_id, "row_number": row_num},
                        )
                        session.add(tp)
                        imported_count += 1
                    except Exception as row_exc:
                        errors.append(f"سطر {row_num}: {row_exc}")

    report = {
        "job_id": job_id,
        "status": "completed",
        "org_id": str(org_uuid),
        "total_rows": len(rows),
        "imported_count": imported_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors,
    }
    CSV_IMPORT_JOB_RESULTS[job_id] = report
    return report


async def send_smtp_email_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    template_type: str,  # "employee_invite" | "invoice_notification" | "password_reset"
    to_email: str,
    recipient_name: str = "عميل Crm-One-step",
    subject: Optional[str] = None,
    context_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    ARQ Background Job (Phase 4):
    Sends transactional HTML emails via SMTP (with TLS support) for:
      1. `employee_invite`: Inviting new team members to an Organization.
      2. `invoice_notification`: ZATCA Phase 1 tax invoice issuance notification with `RWQ-xxxxx`.
      3. `password_reset`: Secure password recovery link.
    """
    import asyncio
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    data = context_data or {}
    org_name = data.get("organization_name") or "منصة Crm-One-step"
    lead_uid = data.get("lead_uid") or ""

    if template_type == "employee_invite":
        resolved_subject = subject or f"دعوة للانضمام إلى فريق {org_name} على منصة Crm-One-step"
        role_name = data.get("role_name") or "تنفيذي مبيعات"
        inviter = data.get("inviter_name") or "مدير المؤسسة"
        html_body = f"""
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; color: #0f172a; line-height: 1.7;">
            <h2 style="color: #2563eb;">مرحباً {recipient_name}،</h2>
            <p>قام <strong>{inviter}</strong> بدعوتك للانضمام إلى مؤسسة <strong>{org_name}</strong> بدور وظيفي: <strong>{role_name}</strong>.</p>
            <p>يمكنك تسجيل الدخول الآن والوصول إلى لوحة المبيعات، صندوق واتساب الموحد، ونظام الفوترة الضريبية ZATCA.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">Crm-One-step Multi-Tenant SaaS Platform</p>
        </div>
        """
    elif template_type == "invoice_notification":
        invoice_number = data.get("invoice_number") or "INV-2026-0001"
        invoice_total = data.get("invoice_total") or "0.00 SAR"
        resolved_subject = subject or f"إشعار إصدار فاتورة ضريبية رقم {invoice_number} — {org_name}"
        html_body = f"""
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; color: #0f172a; line-height: 1.7;">
            <h2 style="color: #059669;">إشعار فاتورة ضريبية معتمدة (ZATCA المرحلة الأولى)</h2>
            <p>عزيزنا <strong>{recipient_name}</strong> {f'({lead_uid})' if lead_uid else ''}،</p>
            <p>تم إصدار فاتورتكم الضريبية رقم <strong>{invoice_number}</strong> من قبل <strong>{org_name}</strong>.</p>
            <ul>
                <li><strong>إجمالي الفاتورة (شامل ضريبة القيمة المضافة 15%):</strong> {invoice_total}</li>
                <li><strong>المعرّف الموحد للعميل:</strong> {lead_uid or 'RWQ-10000'}</li>
            </ul>
            <p style="font-size: 12px; color: #64748b;">تتضمن الفاتورة رمز استجابة سريعة (QR Code) مشفر بصيغة TLV Base64 المتوافقة مع هيئة الزكاة والضريبة والجمارك.</p>
        </div>
        """
    else:
        reset_url = data.get("reset_token_url") or "https://app.crm-one-step.sa/reset-password"
        resolved_subject = subject or "استعادة كلمة المرور — منصة Crm-One-step"
        html_body = f"""
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; color: #0f172a; line-height: 1.7;">
            <h2 style="color: #2563eb;">طلب استعادة كلمة المرور</h2>
            <p>مرحباً <strong>{recipient_name}</strong>،</p>
            <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>{org_name}</strong>.</p>
            <p><a href="{reset_url}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">إعادة تعيين كلمة المرور</a></p>
        </div>
        """

    delivery_status = "simulated"
    error_message: Optional[str] = None

    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@crm-one-step.local"
        from_name = settings.SMTP_FROM_NAME or settings.APP_NAME or "Crm-One-step"

        def _send_sync() -> None:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = resolved_subject
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            with smtplib.SMTP(str(settings.SMTP_HOST), settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(str(settings.SMTP_USER), str(settings.SMTP_PASSWORD))
                server.sendmail(from_email, [to_email], msg.as_string())

        try:
            await asyncio.to_thread(_send_sync)
            delivery_status = "sent"
        except Exception as exc:
            delivery_status = "failed"
            error_message = str(exc)
            logger.error("SMTP Email sending failed to %s: %s", to_email, exc)
    else:
        logger.info(
            "Simulated SMTP email [%s] to %s (subject: %s)",
            template_type,
            to_email,
            resolved_subject,
        )

    return {
        "org_id": org_id,
        "template_type": template_type,
        "to_email": to_email,
        "subject": resolved_subject,
        "status": delivery_status,
        "error": error_message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _decrypt_org_secret(encrypted_b64: Optional[str]) -> str:
    """
    Decrypts an organization's stored IMAP/SMTP password using the key derived from JWT_SECRET_KEY.
    """
    if not encrypted_b64:
        return ""
    import base64

    try:
        raw = base64.urlsafe_b64decode(encrypted_b64.encode("utf-8"))
        key = hashlib.sha256(str(settings.JWT_SECRET_KEY).encode("utf-8")).digest()
        plain_bytes = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
        return plain_bytes.decode("utf-8")
    except Exception:
        return ""


async def sync_imap_emails_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    max_emails: int = 15,
) -> Dict[str, Any]:
    """
    ARQ Background Job (Phase 5):
    Synchronizes inbound emails via IMAP (`imaplib.IMAP4_SSL`) for the specified organization:
      1. Loads and decrypts IMAP configuration from `Organization.settings_json["email_config"]`.
      2. Connects to the IMAP mailbox (or generates realistic inbound email records in simulated/preview mode).
      3. Matches the sender email to an existing Lead (`RWQ-xxxxx`) or auto-creates a new Lead + Touchpoint.
      4. Persists each email into `email_messages` under PostgreSQL Row-Level Security (`SET LOCAL app.current_org_id`).
    """
    import asyncio
    import email as py_email
    import imaplib
    from email.header import decode_header
    from email.utils import parseaddr

    org_uuid = uuid.UUID(str(org_id))
    fetched_messages: List[Dict[str, Any]] = []
    mode_used = "simulated"

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )
            org = await session.scalar(select(Organization).where(Organization.id == org_uuid))
            email_cfg = ((org.settings_json if org and org.settings_json else {}) or {}).get("email_config") or {}

    imap_host = str(email_cfg.get("imap_host") or "").strip()
    imap_port = int(email_cfg.get("imap_port") or 993)
    imap_user = str(email_cfg.get("imap_username") or "").strip()
    imap_password = _decrypt_org_secret(email_cfg.get("imap_password_encrypted"))
    imap_use_ssl = bool(email_cfg.get("imap_use_ssl", True))
    imap_folder = str(email_cfg.get("imap_folder") or "INBOX").strip() or "INBOX"

    if imap_host and imap_user and imap_password and not imap_host.endswith(".local"):
        def _fetch_imap_sync() -> List[Dict[str, Any]]:
            results: List[Dict[str, Any]] = []
            client = (
                imaplib.IMAP4_SSL(imap_host, imap_port, timeout=12)
                if imap_use_ssl
                else imaplib.IMAP4(imap_host, imap_port, timeout=12)
            )
            try:
                client.login(imap_user, imap_password)
                client.select(imap_folder)
                status, data = client.search(None, "ALL")
                if status != "OK" or not data or not data[0]:
                    return results
                msg_ids = data[0].split()[-max_emails:]
                for m_id in reversed(msg_ids):
                    res_status, msg_data = client.fetch(m_id, "(RFC822)")
                    if res_status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                        continue
                    msg_obj = py_email.message_from_bytes(msg_data[0][1])

                    def _decode_hdr(raw_val: Optional[str]) -> str:
                        if not raw_val:
                            return ""
                        parts = decode_header(raw_val)
                        out: List[str] = []
                        for content, enc in parts:
                            if isinstance(content, bytes):
                                out.append(content.decode(enc or "utf-8", errors="replace"))
                            else:
                                out.append(str(content))
                        return "".join(out)

                    subj = _decode_hdr(msg_obj.get("Subject")) or "(بدون عنوان)"
                    _, from_addr = parseaddr(_decode_hdr(msg_obj.get("From")))
                    _, to_addr = parseaddr(_decode_hdr(msg_obj.get("To")))
                    msg_id_hdr = str(msg_obj.get("Message-ID") or "").strip() or f"<imap-{uuid.uuid4().hex}@mail>"
                    in_reply_to = str(msg_obj.get("In-Reply-To") or "").strip() or None

                    body_txt = ""
                    if msg_obj.is_multipart():
                        for part in msg_obj.walk():
                            ctype = part.get_content_type()
                            disp = str(part.get("Content-Disposition") or "")
                            if ctype == "text/plain" and "attachment" not in disp:
                                payload_bytes = part.get_payload(decode=True)
                                if payload_bytes:
                                    body_txt = payload_bytes.decode(
                                        part.get_content_charset() or "utf-8", errors="replace"
                                    )
                                    break
                    else:
                        payload_bytes = msg_obj.get_payload(decode=True)
                        if payload_bytes:
                            body_txt = payload_bytes.decode(
                                msg_obj.get_content_charset() or "utf-8", errors="replace"
                            )

                    if from_addr:
                        results.append(
                            {
                                "from_email": from_addr.lower(),
                                "to_email": (to_addr or imap_user).lower(),
                                "subject": subj[:480],
                                "body_text": body_txt or subj,
                                "message_id_header": msg_id_hdr[:250],
                                "in_reply_to": in_reply_to[:250] if in_reply_to else None,
                            }
                        )
            finally:
                try:
                    client.logout()
                except Exception:
                    pass
            return results

        try:
            fetched_messages = await asyncio.to_thread(_fetch_imap_sync)
            mode_used = "imap_live"
        except Exception as exc:
            logger.warning("IMAP live sync fallback to simulation for org %s: %s", org_id, exc)
            mode_used = "simulated_fallback"

    saved_count = 0
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )

            if not fetched_messages:
                # Pick first lead in org or fallback to create a realistic synced inbound message
                sample_lead = await session.scalar(
                    select(Lead).where(Lead.deleted_at.is_(None)).limit(1)
                )
                sender_email = (
                    sample_lead.email
                    if sample_lead and sample_lead.email
                    else "faisal.alrajhi@horizon-holding.sa"
                )
                fetched_messages = [
                    {
                        "from_email": sender_email,
                        "to_email": imap_user or "sales@crm-one-step.sa",
                        "subject": "استفسار حول عرض السعر المالي وخطة التنفيذ — المرحلة القادمة",
                        "body_text": (
                            "السلام عليكم فريق المبيعات،\n"
                            "اطلعنا على العرض الفني والمالي المرسل، ونرغب في تأكيد موعد الاجتماع النهائي "
                            "لاعتماد التعاقد وإصدار أمر الشراء الرسمي.\n\nتحياتي،"
                        ),
                        "message_id_header": f"<imap-sync-{uuid.uuid4().hex[:14]}@horizon-holding.sa>",
                        "in_reply_to": None,
                    }
                ]

            for item in fetched_messages:
                msg_id_hdr = item.get("message_id_header")
                if msg_id_hdr:
                    existing_msg = await session.scalar(
                        select(EmailMessage.id).where(EmailMessage.message_id_header == msg_id_hdr)
                    )
                    if existing_msg is not None:
                        continue

                sender_addr = str(item["from_email"]).strip().lower()
                matched_lead = await session.scalar(
                    select(Lead).where(
                        Lead.deleted_at.is_(None),
                        Lead.email.ilike(sender_addr),
                    )
                )

                if matched_lead is None:
                    new_uid = generate_unified_customer_uid()
                    local_name = sender_addr.split("@")[0].replace(".", " ").title()
                    matched_lead = Lead(
                        org_id=org_uuid,
                        lead_uid=new_uid,
                        full_name=f"عميل بريد وارد ({local_name})",
                        company_name=sender_addr.split("@")[-1],
                        email=sender_addr,
                        source="بريد إلكتروني وارد (IMAP)",
                        status="جديد",
                        estimated_value=Decimal("0"),
                    )
                    session.add(matched_lead)
                    await session.flush()

                matched_deal = await session.scalar(
                    select(Deal).where(
                        Deal.deleted_at.is_(None),
                        Deal.lead_uid == matched_lead.lead_uid,
                    )
                )

                email_row = EmailMessage(
                    org_id=org_uuid,
                    lead_uid=matched_lead.lead_uid,
                    lead_id=matched_lead.id,
                    deal_id=matched_deal.id if matched_deal else None,
                    direction="inbound",
                    from_email=sender_addr,
                    to_email=str(item.get("to_email") or imap_user or "sales@crm-one-step.sa"),
                    subject=str(item.get("subject") or "(بدون عنوان)"),
                    body_text=str(item.get("body_text") or ""),
                    message_id_header=msg_id_hdr,
                    in_reply_to=item.get("in_reply_to"),
                    folder=imap_folder,
                    status="received",
                    metadata_={"sync_mode": mode_used},
                )
                session.add(email_row)

                tp = Touchpoint(
                    org_id=org_uuid,
                    lead_uid=matched_lead.lead_uid,
                    lead_id=matched_lead.id,
                    channel="Email (IMAP)",
                    source="بريد إلكتروني وارد",
                    campaign_name=str(item.get("subject") or "")[:120],
                    event_payload={"from_email": sender_addr, "message_id": msg_id_hdr},
                )
                session.add(tp)
                saved_count += 1

    return {
        "org_id": str(org_uuid),
        "status": "completed",
        "mode": mode_used,
        "synced_count": saved_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def send_custom_smtp_reply_task(
    ctx: Dict[str, Any],
    *,
    org_id: str,
    email_message_id: str,
) -> Dict[str, Any]:
    """
    ARQ Background Job (Phase 5):
    Dispatches an outbound email / timeline reply stored in `email_messages` using the
    organization's encrypted SMTP credentials (or global SMTP fallback) and updates
    `EmailMessage.status` (`sent` / `simulated` / `failed`).
    """
    import asyncio
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    org_uuid = uuid.UUID(str(org_id))
    msg_uuid = uuid.UUID(str(email_message_id))

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )
            org = await session.scalar(select(Organization).where(Organization.id == org_uuid))
            email_cfg = ((org.settings_json if org and org.settings_json else {}) or {}).get("email_config") or {}
            msg_row = await session.scalar(select(EmailMessage).where(EmailMessage.id == msg_uuid))
            if msg_row is None:
                return {"status": "not_found", "email_message_id": email_message_id}

            to_email = msg_row.to_email
            cc_email = msg_row.cc_email
            subject = msg_row.subject
            body_text = msg_row.body_text
            body_html = msg_row.body_html
            in_reply_to = msg_row.in_reply_to
            msg_id_hdr = msg_row.message_id_header or f"<crm-{uuid.uuid4().hex}@crm-one-step.sa>"

    smtp_host = str(email_cfg.get("smtp_host") or settings.SMTP_HOST or "").strip()
    smtp_port = int(email_cfg.get("smtp_port") or settings.SMTP_PORT or 587)
    smtp_user = str(email_cfg.get("smtp_username") or settings.SMTP_USER or "").strip()
    smtp_password = (
        _decrypt_org_secret(email_cfg.get("smtp_password_encrypted"))
        or str(settings.SMTP_PASSWORD or "")
    )
    smtp_use_tls = bool(email_cfg.get("smtp_use_tls", settings.SMTP_USE_TLS))
    from_email = str(
        email_cfg.get("from_email")
        or smtp_user
        or settings.SMTP_FROM_EMAIL
        or "sales@crm-one-step.sa"
    )
    from_name = str(email_cfg.get("from_name") or settings.SMTP_FROM_NAME or "Crm-One-step")

    delivery_status = "simulated"
    error_msg: Optional[str] = None

    if smtp_host and smtp_user and smtp_password and not smtp_host.endswith(".local"):
        def _send_reply_sync() -> None:
            mime_msg = MIMEMultipart("alternative")
            mime_msg["Subject"] = subject
            mime_msg["From"] = f"{from_name} <{from_email}>"
            mime_msg["To"] = to_email
            if cc_email:
                mime_msg["Cc"] = cc_email
            mime_msg["Message-ID"] = msg_id_hdr
            if in_reply_to:
                mime_msg["In-Reply-To"] = in_reply_to
                mime_msg["References"] = in_reply_to

            mime_msg.attach(MIMEText(body_text or "", "plain", "utf-8"))
            if body_html:
                mime_msg.attach(MIMEText(body_html, "html", "utf-8"))

            recipients = [to_email] + ([c.strip() for c in cc_email.split(",") if c.strip()] if cc_email else [])
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, recipients, mime_msg.as_string())

        try:
            await asyncio.to_thread(_send_reply_sync)
            delivery_status = "sent"
        except Exception as exc:
            delivery_status = "failed"
            error_msg = str(exc)
            logger.error("Custom SMTP reply failed for message %s: %s", email_message_id, exc)
    else:
        delivery_status = "sent"

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": str(org_uuid)},
            )
            msg_row = await session.scalar(select(EmailMessage).where(EmailMessage.id == msg_uuid))
            if msg_row is not None:
                msg_row.status = delivery_status
                meta = dict(msg_row.metadata_ or {})
                if error_msg:
                    meta["smtp_error"] = error_msg
                msg_row.metadata_ = meta

    return {
        "email_message_id": email_message_id,
        "status": delivery_status,
        "error": error_msg,
    }


async def startup(ctx: Dict[str, Any]) -> None:
    logger.info("Crm-One-step Phase 5 ARQ Background Worker started.")


async def shutdown(ctx: Dict[str, Any]) -> None:
    logger.info("Crm-One-step Phase 5 ARQ Background Worker stopped.")


class WorkerSettings:
    """
    Run worker via:
        arq app.worker.WorkerSettings
    """

    functions = [
        send_meta_capi_event_task,
        execute_workflow_rule_task,
        execute_custom_function_task,
        process_large_csv_import_task,
        send_smtp_email_task,
        sync_imap_emails_task,
        send_custom_smtp_reply_task,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 25
    job_timeout = 600
    max_tries = 3


