from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.quotas import enforce_customer_quota
from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import (
    Account,
    Contact,
    Deal,
    Lead,
    Organization,
    StageHistory,
    Touchpoint,
    generate_unified_customer_uid,
)
from app.db.session import get_db
from app.schemas.crm import (
    LeadAtomicConvertRequest,
    LeadAtomicConvertResponse,
    LeadCreate,
    LeadResponse,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["Leads & Atomic Conversion (RWQ-xxxxx)"])


@router.get("", response_model=List[LeadResponse])
async def list_leads(
    include_converted: bool = False,
    db: AsyncSession = Depends(get_db),
) -> List[LeadResponse]:
    stmt = select(Lead).where(Lead.deleted_at.is_(None)).order_by(Lead.created_at.desc())
    if not include_converted:
        stmt = stmt.where(Lead.is_converted.is_(False))
    rows = (await db.scalars(stmt)).all()
    return [LeadResponse.model_validate(row) for row in rows]


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> LeadResponse:
    lead = await db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="العميل المحتمل غير موجود ضمن هذه المؤسسة.",
        )
    return LeadResponse.model_validate(lead)


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    _org: Organization = Depends(enforce_customer_quota),
) -> LeadResponse:
    """
    Creates a new Lead with a Permanent Unified Customer Identifier (`RWQ-xxxxx`)
    and automatically records its initial Touchpoint in the same transaction.
    Enforces server-side Plan Customer Quota (e.g. Free plan max 500 customers).
    """
    unified_uid = (
        payload.lead_uid
        or payload.unique_id
        or generate_unified_customer_uid()
    )

    lead = Lead(
        org_id=token_payload.org_id,
        lead_uid=unified_uid,
        full_name=payload.full_name,
        company=payload.company,
        email=payload.email,
        phone=payload.phone,
        source=payload.source,
        status=payload.status,
        score=payload.score,
        estimated_value=payload.estimated_value,
        owner_id=payload.owner_id,
        campaign_name=payload.campaign_name,
        ad_id=payload.ad_id,
        utm_source=payload.utm_source,
        utm_medium=payload.utm_medium,
        utm_campaign=payload.utm_campaign,
        custom_data=payload.custom_data,
    )
    db.add(lead)
    await db.flush()

    tp_input = payload.initial_touchpoint
    touchpoint = Touchpoint(
        org_id=token_payload.org_id,
        lead_uid=unified_uid,
        lead_id=lead.id,
        channel=tp_input.channel if tp_input else payload.source,
        campaign_name=(tp_input.campaign_name if tp_input else None) or payload.campaign_name,
        ad_id=(tp_input.ad_id if tp_input else None) or payload.ad_id,
        source=tp_input.source if tp_input else payload.source,
        metadata_=tp_input.metadata if tp_input else {"event": "lead_created"},
    )
    db.add(touchpoint)
    await db.flush()

    return LeadResponse.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
) -> LeadResponse:
    lead = await db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="العميل المحتمل غير موجود.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)

    await db.flush()
    return LeadResponse.model_validate(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> None:
    lead = await db.scalar(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="العميل المحتمل غير موجود.",
        )
    lead.deleted_at = datetime.now(timezone.utc)
    lead.deleted_by = token_payload.sub
    await db.flush()


@router.post("/soft-delete")
async def bulk_soft_delete_leads(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> Dict[str, Any]:
    raw_ids = body.get("leadIds") or body.get("lead_ids") or []
    uuid_ids: List[uuid.UUID] = []
    for raw in raw_ids:
        try:
            uuid_ids.append(uuid.UUID(str(raw)))
        except ValueError:
            continue

    now = datetime.now(timezone.utc)
    if uuid_ids:
        await db.execute(
            update(Lead)
            .where(Lead.id.in_(uuid_ids))
            .values(deleted_at=now, deleted_by=token_payload.sub)
        )
    return {"deleted_count": len(uuid_ids), "deleted_at": now.isoformat()}


@router.post("/{lead_id}/convert", response_model=LeadAtomicConvertResponse)
async def convert_lead_atomic(
    lead_id: uuid.UUID,
    payload: LeadAtomicConvertRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> LeadAtomicConvertResponse:
    """
    Atomic Lead Conversion (`POST /leads/{id}/convert`):
    Executes inside a single database transaction:
      1. Locks the Lead row and verifies it has not been converted yet.
      2. Preserves the Permanent Unified Customer ID (`RWQ-xxxxx` / `lead_uid`).
      3. Creates `Account` + `Contact` + `Deal` inheriting `lead_uid`.
      4. Creates the initial `StageHistory` record (`from_stage=None -> to_stage=deal.stage`)
         for Blueprint bottleneck tracking.
      5. Migrates all existing `Touchpoint` records for this `lead_uid` to link
         directly to the newly created `contact_id` and `deal_id`.
      6. Enqueues an asynchronous Meta CAPI `LeadQualified` event via ARQ Redis worker.
    """
    lead = await db.scalar(
        select(Lead)
        .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        .with_for_update()
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="العميل المحتمل غير موجود أو تم حذفه.",
        )
    if lead.is_converted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"تم تحويل هذا العميل مسبقاً بالمعرّف الموحد {lead.lead_uid}.",
        )

    unified_uid = payload.unique_id or lead.lead_uid or generate_unified_customer_uid()
    now = datetime.now(timezone.utc)

    # 1. Create Account (if requested)
    created_account: Account | None = None
    if payload.create_account or payload.newAccount:
        acc_dict = payload.newAccount or {}
        account_name = (
            payload.account_name
            or acc_dict.get("name")
            or lead.company
            or f"مؤسسة {lead.full_name}"
        )
        created_account = Account(
            org_id=token_payload.org_id,
            lead_uid=unified_uid,
            name=account_name,
            industry=payload.account_industry or acc_dict.get("industry") or "تقنية المعلومات",
            city=payload.account_city or acc_dict.get("city") or "الرياض",
            annual_revenue=lead.estimated_value,
            owner_id=payload.owner_id or lead.owner_id,
        )
        db.add(created_account)
        await db.flush()

    # 2. Create Contact inheriting RWQ-xxxxx
    con_dict = payload.newContact or {}
    created_contact = Contact(
        org_id=token_payload.org_id,
        lead_uid=unified_uid,
        account_id=created_account.id if created_account else None,
        full_name=con_dict.get("fullName") or con_dict.get("full_name") or lead.full_name,
        job_title=payload.contact_job_title or con_dict.get("jobTitle") or "مدير تنفيذي",
        email=con_dict.get("email") or lead.email,
        phone=con_dict.get("phone") or lead.phone,
        company_name=created_account.name if created_account else lead.company,
        owner_id=payload.owner_id or lead.owner_id,
    )
    db.add(created_contact)
    await db.flush()

    # 3. Create Deal + Initial StageHistory inheriting RWQ-xxxxx
    created_deal: Deal | None = None
    created_stage_history: StageHistory | None = None

    if payload.create_deal or payload.newDeal:
        deal_dict = payload.newDeal or {}
        deal_title = (
            payload.deal_title
            or deal_dict.get("title")
            or f"صفقة — {lead.company or lead.full_name}"
        )
        deal_stage = deal_dict.get("stage") or payload.deal_stage or "تأهيل"
        raw_amount = (
            payload.deal_amount
            if payload.deal_amount is not None
            else deal_dict.get("amount", lead.estimated_value)
        )
        deal_amount = Decimal(str(raw_amount or "0.00"))

        created_deal = Deal(
            org_id=token_payload.org_id,
            lead_uid=unified_uid,
            title=deal_title,
            account_id=created_account.id if created_account else None,
            contact_id=created_contact.id,
            lead_id=lead.id,
            stage=deal_stage,
            amount=deal_amount,
            probability=int(deal_dict.get("probability") or payload.deal_probability or 30),
            expected_close_date=payload.expected_close_date or deal_dict.get("expectedCloseDate"),
            owner_id=payload.owner_id or lead.owner_id,
        )
        db.add(created_deal)
        await db.flush()

        created_stage_history = StageHistory(
            org_id=token_payload.org_id,
            deal_id=created_deal.id,
            lead_uid=unified_uid,
            from_stage=None,
            to_stage=deal_stage,
            entered_at=now,
            exited_at=None,
            dwell_seconds=0,
            changed_by_user_id=token_payload.sub,
        )
        db.add(created_stage_history)
        await db.flush()

    # 4. Migrate all existing Touchpoints for this Lead / RWQ-xxxxx
    touchpoints = (
        await db.scalars(
            select(Touchpoint).where(
                (Touchpoint.lead_id == lead.id) | (Touchpoint.lead_uid == unified_uid)
            )
        )
    ).all()

    for tp in touchpoints:
        tp.lead_uid = unified_uid
        tp.lead_id = lead.id
        tp.contact_id = created_contact.id
        if created_deal:
            tp.deal_id = created_deal.id

    # 5. Mark Lead as converted
    lead.lead_uid = unified_uid
    lead.is_converted = True
    lead.status = "محوّل إلى صفقة"
    lead.converted_at = now
    lead.converted_account_id = created_account.id if created_account else None
    lead.converted_contact_id = created_contact.id
    lead.converted_deal_id = created_deal.id if created_deal else None
    await db.flush()

    # 6. Enqueue asynchronous Meta CAPI LeadQualified event via ARQ Redis Pool if available
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool is not None:
        try:
            await arq_pool.enqueue_job(
                "send_meta_capi_event_task",
                org_id=str(token_payload.org_id),
                event_name="LeadQualified",
                lead_uid=unified_uid,
                email=lead.email,
                phone=lead.phone,
                value=float(created_deal.amount if created_deal else lead.estimated_value),
                currency="SAR",
                campaign_name=lead.campaign_name,
                ad_id=lead.ad_id,
            )
        except Exception:
            pass

    return LeadAtomicConvertResponse(
        lead_id=lead.id,
        lead_uid=unified_uid,
        account_id=created_account.id if created_account else None,
        contact_id=created_contact.id,
        deal_id=created_deal.id if created_deal else None,
        stage_history_id=created_stage_history.id if created_stage_history else None,
        migrated_touchpoints_count=len(touchpoints),
        contactId=str(created_contact.id),
        accountId=str(created_account.id) if created_account else None,
        dealId=str(created_deal.id) if created_deal else None,
    )
