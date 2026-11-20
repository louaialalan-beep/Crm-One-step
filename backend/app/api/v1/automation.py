from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.quotas import require_plan_feature
from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import (
    BlueprintModel,
    BlueprintTransitionModel,
    CapiEventLog,
    Contact,
    Deal,
    Lead,
    Organization,
    StageHistory,
    WorkflowLogModel,
    WorkflowRuleModel,
)
from app.db.session import get_db
from app.schemas.crm import (
    BlueprintCreate,
    BlueprintResponse,
    CapiEventLogResponse,
    CustomFunctionExecuteRequest,
    CustomFunctionExecuteResponse,
    DealResponse,
    DealStageTransitionRequest,
    DealStageTransitionResponse,
    LeadResponse,
    LeadStageTransitionRequest,
    LeadStageTransitionResponse,
    StageBottleneckMetric,
    StageBottlenecksReportResponse,
    WorkflowLogResponse,
    WorkflowRuleCreate,
    WorkflowRuleResponse,
)
from app.worker import (
    _execute_custom_function_on_session,
    execute_custom_function_task,
    execute_workflow_rule_task,
    send_meta_capi_event_task,
    sha256_normalize,
)

router = APIRouter(tags=["Blueprint Transition Engine, Workflow Rules & Stage Bottleneck Analytics"])

WON_STAGES = {"مكتملة", "إغلاق - فوز", "إغلاق - فوز (100%)", "Won", "Closed Won"}
LOST_STAGES = {"خسارة", "إغلاق - خسارة", "Lost", "Closed Lost", "غير مؤهل", "مرفوض"}


def _evaluate_rule_conditions(
    conditions: List[Dict[str, Any]],
    record: Any,
    from_stage: str,
    to_stage: str,
) -> bool:
    if not conditions:
        return True
    for cond in conditions:
        field = str(cond.get("field") or "")
        operator = str(cond.get("operator") or "equals")
        expected = cond.get("value")

        actual: Any = None
        if field in ("to_stage", "stage", "status"):
            actual = to_stage
        elif field == "from_stage":
            actual = from_stage
        elif hasattr(record, field):
            actual = getattr(record, field)
        else:
            actual = (getattr(record, "custom_data", None) or {}).get(field)

        if operator in ("equals", "=="):
            if str(actual) != str(expected):
                return False
        elif operator in ("not_equals", "!="):
            if str(actual) == str(expected):
                return False
        elif operator in ("greater_than", ">", "gte", ">="):
            try:
                if Decimal(str(actual or 0)) < Decimal(str(expected or 0)):
                    return False
            except Exception:
                return False
    return True


def _validate_blueprint_before_rules(
    before_rules: Optional[Dict[str, Any]],
    record: Any,
    token_payload: TokenPayload,
) -> None:
    if not before_rules:
        return

    allowed_roles = before_rules.get("allowed_roles") or before_rules.get("allowedRoles")
    if isinstance(allowed_roles, list) and allowed_roles:
        user_role = str(getattr(token_payload, "role", "") or "")
        if (
            user_role
            and user_role not in ("admin", "super_admin", "مدير النظام")
            and user_role not in allowed_roles
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"شرط البلوبرينت (Before): الدور الوظيفي ({user_role}) غير مخوّل بتنفيذ هذا الانتقال.",
            )

    min_amount = before_rules.get("min_amount") or before_rules.get("minAmount")
    if min_amount is not None:
        rec_amount = getattr(record, "amount", None) or getattr(record, "estimated_value", None) or 0
        try:
            if Decimal(str(rec_amount)) < Decimal(str(min_amount)):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"شرط البلوبرينت (Before): قيمة السجل يجب ألا تقل عن {min_amount} ر.س قبل الانتقال.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    required_before_fields = before_rules.get("required_fields") or before_rules.get("requiredFields") or []
    if isinstance(required_before_fields, list):
        custom_data = getattr(record, "custom_data", None) or {}
        for req_f in required_before_fields:
            val = getattr(record, req_f, None) if hasattr(record, req_f) else custom_data.get(req_f)
            if val is None or str(val).strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"شرط البلوبرينت (Before): الحقل ({req_f}) يجب أن يكون مكتملًا قبل بدء الانتقال.",
                )


@router.post(
    "/deals/{deal_id}/transition",
    response_model=DealStageTransitionResponse,
)
async def transition_deal_stage_blueprint(
    deal_id: uuid.UUID,
    payload: DealStageTransitionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(require_plan_feature("blueprints")),
) -> DealStageTransitionResponse:
    """
    Blueprint & Workflow Stage Transition Engine (`POST /api/v1/deals/{id}/transition`):
      1. Validates **Before** & **During** conditions on the server:
         - Enforces `before_rules` configured on `BlueprintTransitionModel`.
         - On transition to Lost (`خسارة` / `إغلاق - خسارة`), enforces `lost_reason` and
           strictly blocks automatic sales order generation and onboarding tasks.
         - On transition to Quote/Won, validates positive deal amount and any blueprint
           `during_required_fields`.
      2. Computes exact `dwell_seconds` in the previous stage inside `stage_history`
         and records the new `stage_history` entry.
      3. Triggers **After** actions and matching active `workflow_rules` via ARQ
         (`update_field`, `create_task`, `send_whatsapp`, `send_webhook`, `custom_function`).
      4. When transitioning to Won (`مكتملة` / `إغلاق - فوز`), enqueues a Meta CAPI
         `Purchase` event with `RWQ-xxxxx` (`lead_uid`) and logs it in `capi_events_log`.
    """
    deal = await db.scalar(
        select(Deal)
        .where(Deal.id == deal_id, Deal.deleted_at.is_(None))
        .with_for_update()
    )
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الصفقة غير موجودة.",
        )

    from_stage = deal.stage
    to_stage = payload.to_stage.strip()
    is_lost_transition = to_stage in LOST_STAGES
    is_won_transition = to_stage in WON_STAGES

    # 1. Server-side Before & During Blueprint Validation
    bp_transition = await db.scalar(
        select(BlueprintTransitionModel).where(
            BlueprintTransitionModel.from_stage == from_stage,
            BlueprintTransitionModel.to_stage == to_stage,
        )
    )

    if bp_transition and bp_transition.before_rules:
        _validate_blueprint_before_rules(bp_transition.before_rules, deal, token_payload)

    if is_lost_transition:
        if not (payload.lost_reason or deal.lost_reason):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="شرط البلوبرينت (During): يجب إدخال سبب الخسارة عند إغلاق الصفقة كخسارة.",
            )
        if payload.auto_generate_sales_order:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="منطق البلوبرينت: لا يُسمح بتوليد أمر بيع تلقائي أو مهام Onboarding عند مرحلة إغلاق - خسارة.",
            )

    effective_amount = payload.amount if payload.amount is not None else deal.amount
    if is_won_transition and effective_amount <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="شرط البلوبرينت (During): يجب أن تكون القيمة النهائية للصفقة أكبر من صفر عند الإغلاق بفوز.",
        )

    if bp_transition and bp_transition.during_required_fields:
        provided_keys = set((payload.during_fields or {}).keys())
        if payload.lost_reason:
            provided_keys.add("lost_reason")
        if payload.amount is not None:
            provided_keys.add("amount")
        if payload.next_step:
            provided_keys.add("next_step")
        if payload.review_notes:
            provided_keys.add("review_notes")
        if payload.contract_pdf_url:
            provided_keys.add("contract_pdf_url")

        missing = [
            req_field
            for req_field in bp_transition.during_required_fields
            if req_field not in provided_keys
            and not getattr(deal, req_field, None)
            and not (deal.custom_data or {}).get(req_field)
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"حقول إلزامية مفقودة في انتقال البلوبرينت (During): {', '.join(missing)}",
            )

    # 2. Update Deal fields & Stage
    deal.stage = to_stage
    if payload.amount is not None:
        deal.amount = payload.amount
    if payload.probability is not None:
        deal.probability = payload.probability
    elif is_won_transition:
        deal.probability = 100
    elif is_lost_transition:
        deal.probability = 0

    if payload.lost_reason is not None:
        deal.lost_reason = payload.lost_reason

    merged_custom = dict(deal.custom_data or {})
    if payload.review_notes:
        merged_custom["review_notes"] = payload.review_notes
    if payload.next_step:
        merged_custom["next_step"] = payload.next_step
    if payload.during_fields:
        merged_custom.update(payload.during_fields)
    deal.custom_data = merged_custom

    # 3. Compute Stage Dwell Time (`dwell_seconds`) in `stage_history`
    now = datetime.now(timezone.utc)
    previous_dwell_seconds = 0

    open_history = await db.scalar(
        select(StageHistory)
        .where(
            StageHistory.deal_id == deal.id,
            StageHistory.exited_at.is_(None),
        )
        .order_by(StageHistory.entered_at.desc())
    )
    if open_history:
        open_history.exited_at = now
        delta_seconds = (now - open_history.entered_at).total_seconds()
        previous_dwell_seconds = max(0, int(delta_seconds))
        open_history.dwell_seconds = previous_dwell_seconds
    else:
        delta_seconds = (now - deal.created_at).total_seconds()
        previous_dwell_seconds = max(0, int(delta_seconds))

    new_history = StageHistory(
        org_id=token_payload.org_id,
        deal_id=deal.id,
        lead_uid=deal.lead_uid,
        from_stage=from_stage,
        to_stage=to_stage,
        entered_at=now,
        exited_at=None,
        dwell_seconds=0,
        changed_by_user_id=token_payload.sub,
    )
    db.add(new_history)
    await db.flush()

    # 4. Collect Blueprint After-Actions (excluding onboarding/sales_order if Lost)
    after_actions: List[Dict[str, Any]] = []
    if bp_transition and bp_transition.after_actions and not is_lost_transition:
        after_actions.extend(bp_transition.after_actions)
    elif is_won_transition:
        after_actions.append(
            {
                "type": "create_task",
                "title": f"تهيئة وتسليم حساب العميل (Onboarding) — {deal.title}",
                "priority": "عالية",
                "owner_id": deal.owner_id,
            }
        )

    # 5. Match active Workflow Rules for `deals` on `on_stage_change`
    active_rules = (
        await db.scalars(
            select(WorkflowRuleModel).where(
                WorkflowRuleModel.module == "deals",
                WorkflowRuleModel.is_active.is_(True),
            )
        )
    ).all()

    matched_rules: List[WorkflowRuleModel] = []
    for rule in active_rules:
        if _evaluate_rule_conditions(rule.conditions or [], deal, from_stage, to_stage):
            matched_rules.append(rule)

    arq_pool = getattr(request.app.state, "arq_pool", None)
    snapshot = {
        "deal_id": str(deal.id),
        "title": deal.title,
        "lead_uid": deal.lead_uid,
        "from_stage": from_stage,
        "to_stage": to_stage,
        "amount": float(deal.amount),
    }

    if after_actions:
        if arq_pool is not None:
            await arq_pool.enqueue_job(
                "execute_workflow_rule_task",
                org_id=str(token_payload.org_id),
                module="deals",
                record_id=str(deal.id),
                lead_uid=deal.lead_uid,
                actions=after_actions,
                blueprint_transition_id=str(bp_transition.id) if bp_transition else None,
                record_snapshot=snapshot,
            )
        else:
            for act in after_actions:
                db.add(
                    WorkflowLogModel(
                        org_id=token_payload.org_id,
                        blueprint_transition_id=bp_transition.id if bp_transition else None,
                        module="deals",
                        record_id=str(deal.id),
                        lead_uid=deal.lead_uid,
                        action_type=str(act.get("type") or "create_task"),
                        status="queued_local",
                        details=act,
                    )
                )

    for rule in matched_rules:
        if is_lost_transition:
            filtered_actions = [
                a
                for a in (rule.actions or [])
                if a.get("type") not in ("generate_sales_order", "onboarding_task")
            ]
        else:
            filtered_actions = list(rule.actions or [])

        if not filtered_actions:
            continue

        if arq_pool is not None:
            await arq_pool.enqueue_job(
                "execute_workflow_rule_task",
                org_id=str(token_payload.org_id),
                module="deals",
                record_id=str(deal.id),
                lead_uid=deal.lead_uid,
                actions=filtered_actions,
                rule_id=str(rule.id),
                record_snapshot=snapshot,
            )
        else:
            rule.executions_count = int(rule.executions_count or 0) + 1
            for act in filtered_actions:
                db.add(
                    WorkflowLogModel(
                        org_id=token_payload.org_id,
                        rule_id=rule.id,
                        module="deals",
                        record_id=str(deal.id),
                        lead_uid=deal.lead_uid,
                        action_type=str(act.get("type") or "create_task"),
                        status="executed",
                        details=act,
                    )
                )

    # 6. Trigger Meta CAPI Purchase Event via ARQ + log in `capi_events_log` on Won Deal
    capi_purchase_queued = False
    if is_won_transition:
        customer_email: Optional[str] = None
        customer_phone: Optional[str] = None
        if deal.contact_id:
            contact = await db.scalar(select(Contact).where(Contact.id == deal.contact_id))
            if contact:
                customer_email = contact.email
                customer_phone = contact.phone
        elif deal.lead_id:
            lead = await db.scalar(select(Lead).where(Lead.id == deal.lead_id))
            if lead:
                customer_email = lead.email
                customer_phone = lead.phone

        capi_log = CapiEventLog(
            org_id=token_payload.org_id,
            lead_uid=deal.lead_uid,
            event_name="Purchase",
            event_id=f"{deal.lead_uid}_Purchase_{deal.id}",
            entity_type="deal",
            entity_id=str(deal.id),
            value=deal.amount,
            currency=deal.currency,
            hashed_email=sha256_normalize(customer_email),
            hashed_phone=sha256_normalize(customer_phone),
            status="queued" if arq_pool is not None else "simulated",
            attempts=1,
            response_payload={"source": "deal_won_transition", "lead_uid": deal.lead_uid},
        )
        db.add(capi_log)
        await db.flush()
        capi_purchase_queued = True

        if arq_pool is not None:
            try:
                await arq_pool.enqueue_job(
                    "send_meta_capi_event_task",
                    org_id=str(token_payload.org_id),
                    event_name="Purchase",
                    lead_uid=deal.lead_uid,
                    email=customer_email,
                    phone=customer_phone,
                    value=float(deal.amount),
                    currency=deal.currency,
                    entity_type="deal",
                    entity_id=str(deal.id),
                    capi_log_id=str(capi_log.id),
                )
            except Exception:
                pass

    await db.flush()

    return DealStageTransitionResponse(
        deal=DealResponse.model_validate(deal),
        from_stage=from_stage,
        to_stage=to_stage,
        previous_stage_dwell_seconds=previous_dwell_seconds,
        stage_history_id=new_history.id,
        triggered_after_actions=after_actions,
        triggered_workflow_rules=[r.code for r in matched_rules],
        capi_purchase_queued=capi_purchase_queued,
    )


@router.get(
    "/analytics/bottlenecks",
    response_model=StageBottlenecksReportResponse,
)
async def get_stage_bottlenecks_analytics(
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> StageBottlenecksReportResponse:
    """
    Stage Dwell Time Bottleneck Analytics (`GET /api/v1/analytics/bottlenecks`):
    Aggregates `stage_history` for the current tenant (`org_id` via RLS) to return
    average and maximum dwell duration per stage for the Analytics dashboard.
    """
    stmt = (
        select(
            StageHistory.to_stage,
            func.count(StageHistory.id).label("transitions_count"),
            func.avg(StageHistory.dwell_seconds).label("avg_dwell_seconds"),
            func.max(StageHistory.dwell_seconds).label("max_dwell_seconds"),
        )
        .group_by(StageHistory.to_stage)
        .order_by(func.avg(StageHistory.dwell_seconds).desc())
    )
    rows = (await db.execute(stmt)).all()

    metrics: List[StageBottleneckMetric] = []
    total_transitions = 0
    most_congested: Optional[str] = None
    highest_avg = -1.0

    for row in rows:
        stage_name = str(row.to_stage)
        count = int(row.transitions_count or 0)
        avg_sec = float(row.avg_dwell_seconds or 0.0)
        max_sec = int(row.max_dwell_seconds or 0)
        avg_hours = round(avg_sec / 3600.0, 2)

        if avg_hours >= 72:
            severity = "critical"
        elif avg_hours >= 24:
            severity = "warning"
        else:
            severity = "normal"

        if avg_sec > highest_avg and count > 0:
            highest_avg = avg_sec
            most_congested = stage_name

        total_transitions += count
        metrics.append(
            StageBottleneckMetric(
                stage=stage_name,
                transitions_count=count,
                avg_dwell_seconds=round(avg_sec, 2),
                avg_dwell_hours=avg_hours,
                max_dwell_seconds=max_sec,
                bottleneck_severity=severity,
            )
        )

    return StageBottlenecksReportResponse(
        org_id=token_payload.org_id,
        total_tracked_transitions=total_transitions,
        most_congested_stage=most_congested,
        stages=metrics,
    )


@router.get("/analytics/capi-logs", response_model=List[CapiEventLogResponse])
async def list_capi_events_log(
    lead_uid: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[CapiEventLogResponse]:
    stmt = select(CapiEventLog).order_by(CapiEventLog.created_at.desc())
    if lead_uid:
        stmt = stmt.where(CapiEventLog.lead_uid == lead_uid)
    rows = (await db.scalars(stmt)).all()
    return [CapiEventLogResponse.model_validate(r) for r in rows]


# ============================================================================
# Blueprints & Workflow Rules Persistence Endpoints
# ============================================================================


@router.get("/settings/blueprints", response_model=List[BlueprintResponse])
async def list_blueprints(db: AsyncSession = Depends(get_db)) -> List[BlueprintResponse]:
    rows = (await db.scalars(select(BlueprintModel).order_by(BlueprintModel.created_at.desc()))).all()
    return [BlueprintResponse.model_validate(r) for r in rows]


@router.post(
    "/settings/blueprints",
    response_model=BlueprintResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_blueprint(
    payload: BlueprintCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(require_plan_feature("blueprints")),
) -> BlueprintResponse:
    bp = BlueprintModel(
        org_id=token_payload.org_id,
        name=payload.name,
        module=payload.module,
        field_name=payload.field_name,
        description=payload.description,
        is_active=payload.is_active,
        stages=payload.stages,
    )
    db.add(bp)
    await db.flush()

    for t in payload.transitions:
        db.add(
            BlueprintTransitionModel(
                org_id=token_payload.org_id,
                blueprint_id=bp.id,
                name=t.name,
                from_stage=t.from_stage,
                to_stage=t.to_stage,
                before_rules=t.before_rules,
                during_required_fields=t.during_required_fields,
                after_actions=t.after_actions,
                sla_hours=t.sla_hours,
            )
        )
    await db.flush()
    return BlueprintResponse.model_validate(bp)


@router.get("/settings/workflows", response_model=List[WorkflowRuleResponse])
async def list_workflow_rules(db: AsyncSession = Depends(get_db)) -> List[WorkflowRuleResponse]:
    rows = (
        await db.scalars(select(WorkflowRuleModel).order_by(WorkflowRuleModel.created_at.desc()))
    ).all()
    return [WorkflowRuleResponse.model_validate(r) for r in rows]


@router.post(
    "/settings/workflows",
    response_model=WorkflowRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow_rule(
    payload: WorkflowRuleCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(require_plan_feature("workflows")),
) -> WorkflowRuleResponse:
    rule = WorkflowRuleModel(
        org_id=token_payload.org_id,
        code=payload.code,
        name=payload.name,
        module=payload.module,
        trigger_type=payload.trigger_type,
        conditions=payload.conditions,
        actions=payload.actions,
        is_active=payload.is_active,
    )
    db.add(rule)
    await db.flush()
    return WorkflowRuleResponse.model_validate(rule)


@router.get("/settings/workflow-logs", response_model=List[WorkflowLogResponse])
async def list_workflow_logs(db: AsyncSession = Depends(get_db)) -> List[WorkflowLogResponse]:
    rows = (
        await db.scalars(
            select(WorkflowLogModel).order_by(WorkflowLogModel.executed_at.desc()).limit(100)
        )
    ).all()
    return [WorkflowLogResponse.model_validate(r) for r in rows]


@router.post(
    "/leads/{lead_id}/transition",
    response_model=LeadStageTransitionResponse,
)
async def transition_lead_stage_blueprint(
    lead_id: uuid.UUID,
    payload: LeadStageTransitionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(require_plan_feature("blueprints")),
) -> LeadStageTransitionResponse:
    """
    Blueprint & Workflow Stage Transition Engine for Leads (`POST /api/v1/leads/{id}/transition`):
      1. Validates **Before** & **During** conditions on the server from `BlueprintTransitionModel`.
      2. Updates the Lead status/stage and any `during_fields` in `custom_data`.
      3. Triggers **After** actions and matching active `workflow_rules` for `leads` via ARQ
         (including `custom_function`).
    """
    lead = await db.scalar(
        select(Lead)
        .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        .with_for_update()
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="العميل المحتمل غير موجود.",
        )

    from_stage = lead.status
    to_stage = payload.to_stage.strip()
    is_lost_transition = to_stage in LOST_STAGES

    bp_transition = await db.scalar(
        select(BlueprintTransitionModel).where(
            BlueprintTransitionModel.from_stage == from_stage,
            BlueprintTransitionModel.to_stage == to_stage,
        )
    )

    if bp_transition and bp_transition.before_rules:
        _validate_blueprint_before_rules(bp_transition.before_rules, lead, token_payload)

    if is_lost_transition and not (payload.lost_reason or (lead.custom_data or {}).get("lost_reason")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="شرط البلوبرينت (During): يجب تحديد سبب الاستبعاد/عدم التأهيل عند نقل العميل المحتمل إلى غير مؤهل.",
        )

    if bp_transition and bp_transition.during_required_fields:
        provided_keys = set((payload.during_fields or {}).keys())
        if payload.lost_reason:
            provided_keys.add("lost_reason")
        if payload.review_notes:
            provided_keys.add("review_notes")
        if payload.next_step:
            provided_keys.add("next_step")
        if payload.estimated_value is not None:
            provided_keys.add("estimated_value")

        missing = [
            req_field
            for req_field in bp_transition.during_required_fields
            if req_field not in provided_keys
            and not getattr(lead, req_field, None)
            and not (lead.custom_data or {}).get(req_field)
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"حقول إلزامية مفقودة في انتقال بلوبرينت العملاء المحتملين (During): {', '.join(missing)}",
            )

    lead.status = to_stage
    if payload.estimated_value is not None:
        lead.estimated_value = payload.estimated_value

    merged_custom = dict(lead.custom_data or {})
    if payload.lost_reason:
        merged_custom["lost_reason"] = payload.lost_reason
    if payload.review_notes:
        merged_custom["review_notes"] = payload.review_notes
    if payload.next_step:
        merged_custom["next_step"] = payload.next_step
    if payload.during_fields:
        merged_custom.update(payload.during_fields)
    lead.custom_data = merged_custom

    after_actions: List[Dict[str, Any]] = []
    if bp_transition and bp_transition.after_actions:
        after_actions.extend(bp_transition.after_actions)

    active_rules = (
        await db.scalars(
            select(WorkflowRuleModel).where(
                WorkflowRuleModel.module.in_(["leads", "العملاء المحتملين"]),
                WorkflowRuleModel.is_active.is_(True),
            )
        )
    ).all()

    matched_rules: List[WorkflowRuleModel] = []
    for rule in active_rules:
        if _evaluate_rule_conditions(rule.conditions or [], lead, from_stage, to_stage):
            matched_rules.append(rule)

    arq_pool = getattr(request.app.state, "arq_pool", None)
    snapshot = {
        "lead_id": str(lead.id),
        "full_name": lead.full_name,
        "lead_uid": lead.lead_uid,
        "from_stage": from_stage,
        "to_stage": to_stage,
        "amount": float(lead.estimated_value or 0),
        "phone": lead.phone,
    }

    if after_actions:
        if arq_pool is not None:
            await arq_pool.enqueue_job(
                "execute_workflow_rule_task",
                org_id=str(token_payload.org_id),
                module="leads",
                record_id=str(lead.id),
                lead_uid=lead.lead_uid,
                actions=after_actions,
                blueprint_transition_id=str(bp_transition.id) if bp_transition else None,
                record_snapshot=snapshot,
            )
        else:
            for act in after_actions:
                if act.get("type") in ("custom_function", "execute_custom_function"):
                    await _execute_custom_function_on_session(
                        session=db,
                        org_uuid=token_payload.org_id,
                        module="leads",
                        record_id=str(lead.id),
                        lead_uid=lead.lead_uid,
                        function_name=str(act.get("function_name") or act.get("functionName") or "lead_custom_fn"),
                        code=str(act.get("code") or ""),
                        params=act.get("params") if isinstance(act.get("params"), dict) else {},
                        record_snapshot=snapshot,
                    )
                db.add(
                    WorkflowLogModel(
                        org_id=token_payload.org_id,
                        blueprint_transition_id=bp_transition.id if bp_transition else None,
                        module="leads",
                        record_id=str(lead.id),
                        lead_uid=lead.lead_uid,
                        action_type=str(act.get("type") or "create_task"),
                        status="executed",
                        details=act,
                    )
                )

    for rule in matched_rules:
        rule_actions = list(rule.actions or [])
        if not rule_actions:
            continue
        if arq_pool is not None:
            await arq_pool.enqueue_job(
                "execute_workflow_rule_task",
                org_id=str(token_payload.org_id),
                module="leads",
                record_id=str(lead.id),
                lead_uid=lead.lead_uid,
                actions=rule_actions,
                rule_id=str(rule.id),
                record_snapshot=snapshot,
            )
        else:
            rule.executions_count = int(rule.executions_count or 0) + 1
            for act in rule_actions:
                db.add(
                    WorkflowLogModel(
                        org_id=token_payload.org_id,
                        rule_id=rule.id,
                        module="leads",
                        record_id=str(lead.id),
                        lead_uid=lead.lead_uid,
                        action_type=str(act.get("type") or "create_task"),
                        status="executed",
                        details=act,
                    )
                )

    await db.flush()
    return LeadStageTransitionResponse(
        lead=LeadResponse.model_validate(lead),
        from_stage=from_stage,
        to_stage=to_stage,
        triggered_after_actions=after_actions,
        triggered_workflow_rules=[r.code for r in matched_rules],
    )


@router.post(
    "/settings/functions/execute",
    response_model=CustomFunctionExecuteResponse,
)
async def execute_custom_function_endpoint(
    payload: CustomFunctionExecuteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> CustomFunctionExecuteResponse:
    """
    Executes a Custom Function against a specified `record_id` (`deals` or `leads`)
    inside the server-side sandboxed executor (or enqueues via ARQ worker) and logs
    execution to `workflow_logs`.
    """
    exec_res = await _execute_custom_function_on_session(
        session=db,
        org_uuid=token_payload.org_id,
        module=payload.module,
        record_id=payload.record_id,
        lead_uid=payload.lead_uid,
        function_name=payload.function_name,
        code=payload.code,
        params=payload.params,
    )
    db.add(
        WorkflowLogModel(
            org_id=token_payload.org_id,
            module=payload.module,
            record_id=payload.record_id,
            lead_uid=exec_res.get("lead_uid") or payload.lead_uid,
            action_type="custom_function",
            status="executed",
            details=exec_res,
        )
    )
    await db.flush()
    return CustomFunctionExecuteResponse(**exec_res)
