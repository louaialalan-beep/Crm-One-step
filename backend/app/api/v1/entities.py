from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    PermissionContext,
    apply_fls_to_response,
    enforce_fls_on_write,
    enforce_module_permission,
    enforce_record_access,
    filter_records_by_data_sharing,
    get_permission_context,
)
from app.core.quotas import enforce_customer_quota
from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import (
    Account,
    Activity,
    Contact,
    Deal,
    Invoice,
    Lead,
    Organization,
    Quote,
    SalesOrder,
    StageHistory,
    Touchpoint,
    generate_unified_customer_uid,
)
from app.db.session import get_db
from app.schemas.crm import (
    AccountCreate,
    AccountResponse,
    AccountUpdate,
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    DealCreate,
    DealResponse,
    DealUpdate,
    RecycleBinEntryResponse,
    RecycleBinRestoreRequest,
    StageHistoryResponse,
    TouchpointCreate,
    TouchpointResponse,
)

router = APIRouter(tags=["Accounts, Contacts, Deals, Activities & Recycle Bin"])


# ============================================================================
# 1. Accounts CRUD (/accounts)
# ============================================================================


@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> List[AccountResponse]:
    enforce_module_permission(perm_ctx, "accounts", "read")
    rows = (
        await db.scalars(
            select(Account)
            .where(Account.deleted_at.is_(None))
            .order_by(Account.created_at.desc())
        )
    ).all()
    visible_rows = filter_records_by_data_sharing(perm_ctx, rows, owner_attr="owner_id")
    validated = [AccountResponse.model_validate(r) for r in visible_rows]
    return apply_fls_to_response(perm_ctx, "accounts", validated)


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> AccountResponse:
    enforce_module_permission(perm_ctx, "accounts", "create")
    account = Account(
        org_id=token_payload.org_id,
        lead_uid=payload.lead_uid or generate_unified_customer_uid(),
        name=payload.name,
        industry=payload.industry,
        tier=payload.tier,
        vat_number=payload.vat_number,
        cr_number=payload.cr_number,
        city=payload.city,
        website=payload.website,
        annual_revenue=payload.annual_revenue,
        owner_id=payload.owner_id or perm_ctx.user_id,
        custom_data=payload.custom_data,
    )
    db.add(account)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "accounts", AccountResponse.model_validate(account))


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> AccountResponse:
    enforce_module_permission(perm_ctx, "accounts", "update")
    account = await db.scalar(
        select(Account).where(Account.id == account_id, Account.deleted_at.is_(None))
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الحساب غير موجود.")
    enforce_record_access(perm_ctx, account.owner_id, action="update")

    update_data = enforce_fls_on_write(
        perm_ctx, "accounts", payload.model_dump(exclude_unset=True)
    )
    for k, v in update_data.items():
        setattr(account, k, v)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "accounts", AccountResponse.model_validate(account))


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> None:
    enforce_module_permission(perm_ctx, "accounts", "delete")
    account = await db.scalar(
        select(Account).where(Account.id == account_id, Account.deleted_at.is_(None))
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الحساب غير موجود.")
    enforce_record_access(perm_ctx, account.owner_id, action="delete")
    account.deleted_at = datetime.now(timezone.utc)
    account.deleted_by = token_payload.sub
    await db.flush()


# ============================================================================
# 2. Contacts CRUD (/contacts)
# ============================================================================


@router.get("/contacts", response_model=List[ContactResponse])
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> List[ContactResponse]:
    enforce_module_permission(perm_ctx, "contacts", "read")
    rows = (
        await db.scalars(
            select(Contact)
            .where(Contact.deleted_at.is_(None))
            .order_by(Contact.created_at.desc())
        )
    ).all()
    visible_rows = filter_records_by_data_sharing(perm_ctx, rows, owner_attr="owner_id")
    validated = [ContactResponse.model_validate(r) for r in visible_rows]
    return apply_fls_to_response(perm_ctx, "contacts", validated)


@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
    _org: Organization = Depends(enforce_customer_quota),
) -> ContactResponse:
    enforce_module_permission(perm_ctx, "contacts", "create")
    contact = Contact(
        org_id=token_payload.org_id,
        lead_uid=payload.lead_uid or generate_unified_customer_uid(),
        account_id=payload.account_id,
        full_name=payload.full_name,
        job_title=payload.job_title,
        email=payload.email,
        phone=payload.phone,
        company_name=payload.company_name,
        owner_id=payload.owner_id or perm_ctx.user_id,
        custom_data=payload.custom_data,
    )
    db.add(contact)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "contacts", ContactResponse.model_validate(contact))


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> ContactResponse:
    enforce_module_permission(perm_ctx, "contacts", "update")
    contact = await db.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.deleted_at.is_(None))
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جهة الاتصال غير موجودة.")
    enforce_record_access(perm_ctx, contact.owner_id, action="update")

    update_data = enforce_fls_on_write(
        perm_ctx, "contacts", payload.model_dump(exclude_unset=True)
    )
    for k, v in update_data.items():
        setattr(contact, k, v)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "contacts", ContactResponse.model_validate(contact))


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> None:
    enforce_module_permission(perm_ctx, "contacts", "delete")
    contact = await db.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.deleted_at.is_(None))
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جهة الاتصال غير موجودة.")
    enforce_record_access(perm_ctx, contact.owner_id, action="delete")
    contact.deleted_at = datetime.now(timezone.utc)
    contact.deleted_by = token_payload.sub
    await db.flush()


# ============================================================================
# 3. Deals CRUD (/deals) + StageHistory Dwell-Time Bottleneck Analytics
# ============================================================================


@router.get("/deals", response_model=List[DealResponse])
async def list_deals(
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> List[DealResponse]:
    enforce_module_permission(perm_ctx, "deals", "read")
    rows = (
        await db.scalars(
            select(Deal)
            .where(Deal.deleted_at.is_(None))
            .order_by(Deal.created_at.desc())
        )
    ).all()
    visible_rows = filter_records_by_data_sharing(perm_ctx, rows, owner_attr="owner_id")
    validated = [DealResponse.model_validate(r) for r in visible_rows]
    return apply_fls_to_response(perm_ctx, "deals", validated)


@router.post("/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: DealCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> DealResponse:
    enforce_module_permission(perm_ctx, "deals", "create")
    unified_uid = payload.lead_uid or generate_unified_customer_uid()
    now = datetime.now(timezone.utc)

    deal = Deal(
        org_id=token_payload.org_id,
        lead_uid=unified_uid,
        title=payload.title,
        account_id=payload.account_id,
        contact_id=payload.contact_id,
        lead_id=payload.lead_id,
        stage=payload.stage,
        amount=payload.amount,
        currency=payload.currency,
        probability=payload.probability,
        expected_close_date=payload.expected_close_date,
        owner_id=payload.owner_id or perm_ctx.user_id,
        custom_data=payload.custom_data,
    )
    db.add(deal)
    await db.flush()

    initial_history = StageHistory(
        org_id=token_payload.org_id,
        deal_id=deal.id,
        lead_uid=unified_uid,
        from_stage=None,
        to_stage=deal.stage,
        entered_at=now,
        exited_at=None,
        dwell_seconds=0,
        changed_by_user_id=token_payload.sub,
    )
    db.add(initial_history)
    await db.flush()

    return apply_fls_to_response(perm_ctx, "deals", DealResponse.model_validate(deal))


@router.patch("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: uuid.UUID,
    payload: DealUpdate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> DealResponse:
    """
    Updates a Deal and automatically records Blueprint Stage Dwell Time (`dwell_seconds`)
    in `stage_history` whenever `stage` changes. Enforces Profile FLS and Data Sharing.
    """
    enforce_module_permission(perm_ctx, "deals", "update")
    deal = await db.scalar(
        select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None))
    )
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الصفقة غير موجودة.")
    enforce_record_access(perm_ctx, deal.owner_id, action="update")

    previous_stage = deal.stage
    update_data = enforce_fls_on_write(
        perm_ctx, "deals", payload.model_dump(exclude_unset=True)
    )
    for k, v in update_data.items():
        setattr(deal, k, v)

    now = datetime.now(timezone.utc)
    if payload.stage and payload.stage != previous_stage:
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
            delta = (now - open_history.entered_at).total_seconds()
            open_history.dwell_seconds = max(0, int(delta))

        next_history = StageHistory(
            org_id=token_payload.org_id,
            deal_id=deal.id,
            lead_uid=deal.lead_uid,
            from_stage=previous_stage,
            to_stage=payload.stage,
            entered_at=now,
            exited_at=None,
            dwell_seconds=0,
            changed_by_user_id=token_payload.sub,
        )
        db.add(next_history)

    await db.flush()
    return apply_fls_to_response(perm_ctx, "deals", DealResponse.model_validate(deal))


@router.get("/deals/{deal_id}/stage-history", response_model=List[StageHistoryResponse])
async def list_deal_stage_history(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> List[StageHistoryResponse]:
    enforce_module_permission(perm_ctx, "deals", "read")
    deal = await db.scalar(
        select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None))
    )
    if deal:
        enforce_record_access(perm_ctx, deal.owner_id, action="read")
    rows = (
        await db.scalars(
            select(StageHistory)
            .where(StageHistory.deal_id == deal_id)
            .order_by(StageHistory.entered_at.asc())
        )
    ).all()
    return [StageHistoryResponse.model_validate(r) for r in rows]


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_deal(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> None:
    enforce_module_permission(perm_ctx, "deals", "delete")
    deal = await db.scalar(
        select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None))
    )
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الصفقة غير موجودة.")
    enforce_record_access(perm_ctx, deal.owner_id, action="delete")
    deal.deleted_at = datetime.now(timezone.utc)
    deal.deleted_by = token_payload.sub
    await db.flush()


# ============================================================================
# 4. Activities & Touchpoints CRUD (/activities)
# ============================================================================


@router.get("/activities", response_model=List[ActivityResponse])
async def list_activities(
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> List[ActivityResponse]:
    enforce_module_permission(perm_ctx, "activities", "read")
    rows = (
        await db.scalars(
            select(Activity)
            .where(Activity.deleted_at.is_(None))
            .order_by(Activity.created_at.desc())
        )
    ).all()
    visible_rows = filter_records_by_data_sharing(perm_ctx, rows, owner_attr="owner_id")
    validated = [ActivityResponse.model_validate(r) for r in visible_rows]
    return apply_fls_to_response(perm_ctx, "activities", validated)


@router.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> ActivityResponse:
    enforce_module_permission(perm_ctx, "activities", "create")
    activity = Activity(
        org_id=token_payload.org_id,
        lead_uid=payload.lead_uid,
        activity_type=payload.activity_type,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        deal_id=payload.deal_id,
        owner_id=payload.owner_id or perm_ctx.user_id,
        payload=payload.payload,
    )
    db.add(activity)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "activities", ActivityResponse.model_validate(activity))


@router.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> ActivityResponse:
    enforce_module_permission(perm_ctx, "activities", "update")
    activity = await db.scalar(
        select(Activity).where(Activity.id == activity_id, Activity.deleted_at.is_(None))
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="النشاط غير موجود.")
    enforce_record_access(perm_ctx, activity.owner_id, action="update")

    update_data = enforce_fls_on_write(
        perm_ctx, "activities", payload.model_dump(exclude_unset=True)
    )
    for k, v in update_data.items():
        setattr(activity, k, v)
    await db.flush()
    return apply_fls_to_response(perm_ctx, "activities", ActivityResponse.model_validate(activity))


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_activity(
    activity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
    perm_ctx: PermissionContext = Depends(get_permission_context),
) -> None:
    enforce_module_permission(perm_ctx, "activities", "delete")
    activity = await db.scalar(
        select(Activity).where(Activity.id == activity_id, Activity.deleted_at.is_(None))
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="النشاط غير موجود.")
    enforce_record_access(perm_ctx, activity.owner_id, action="delete")
    activity.deleted_at = datetime.now(timezone.utc)
    activity.deleted_by = token_payload.sub
    await db.flush()


@router.get("/activities/touchpoints", response_model=List[TouchpointResponse])
async def list_touchpoints(
    lead_uid: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> List[TouchpointResponse]:
    stmt = select(Touchpoint).order_by(Touchpoint.created_at.desc())
    if lead_uid:
        stmt = stmt.where(Touchpoint.lead_uid == lead_uid)
    rows = (await db.scalars(stmt)).all()
    return [TouchpointResponse.model_validate(r) for r in rows]


@router.post(
    "/activities/touchpoints",
    response_model=TouchpointResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_touchpoint(
    payload: TouchpointCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> TouchpointResponse:
    tp = Touchpoint(
        org_id=token_payload.org_id,
        lead_uid=payload.lead_uid or generate_unified_customer_uid(),
        channel=payload.channel,
        campaign_name=payload.campaign_name,
        ad_id=payload.ad_id,
        source=payload.source,
        metadata_=payload.metadata,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        deal_id=payload.deal_id,
    )
    db.add(tp)
    await db.flush()
    return TouchpointResponse.model_validate(tp)


# ============================================================================
# 5. Recycle Bin & Restore (/recycle-bin & /recycle-bin/restore)
# ============================================================================


ENTITY_MODEL_MAP: Dict[str, Any] = {
    "lead": (Lead, "full_name"),
    "account": (Account, "name"),
    "contact": (Contact, "full_name"),
    "deal": (Deal, "title"),
    "quote": (Quote, "title"),
    "sales_order": (SalesOrder, "title"),
    "invoice": (Invoice, "title"),
    "activity": (Activity, "title"),
}


@router.get("/recycle-bin", response_model=List[RecycleBinEntryResponse])
async def list_recycle_bin_items(
    db: AsyncSession = Depends(get_db),
) -> List[RecycleBinEntryResponse]:
    """
    Lists all soft-deleted records (`deleted_at IS NOT NULL`) across operational tables
    for the current tenant (`org_id` enforced by PostgreSQL RLS).
    """
    items: List[RecycleBinEntryResponse] = []

    for entity_type, (model_cls, title_attr) in ENTITY_MODEL_MAP.items():
        rows = (
            await db.scalars(
                select(model_cls).where(model_cls.deleted_at.is_not(None))
            )
        ).all()
        for row in rows:
            items.append(
                RecycleBinEntryResponse(
                    id=row.id,
                    entity_type=entity_type,
                    title=str(getattr(row, title_attr, row.id)),
                    lead_uid=getattr(row, "lead_uid", None),
                    deleted_at=row.deleted_at,
                    deleted_by=row.deleted_by,
                )
            )

    items.sort(key=lambda x: x.deleted_at, reverse=True)
    return items


@router.post("/recycle-bin/restore", response_model=RecycleBinEntryResponse)
async def restore_recycle_bin_item(
    payload: RecycleBinRestoreRequest,
    db: AsyncSession = Depends(get_db),
) -> RecycleBinEntryResponse:
    """
    Restores a soft-deleted record by clearing `deleted_at` and `deleted_by`.
    """
    mapping = ENTITY_MODEL_MAP.get(payload.entity_type)
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="نوع السجل غير مدعوم في سلة المحذوفات.",
        )

    model_cls, title_attr = mapping
    record = await db.scalar(
        select(model_cls).where(
            model_cls.id == payload.entity_id,
            model_cls.deleted_at.is_not(None),
        )
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="السجل غير موجود في سلة المحذوفات.",
        )

    previous_deleted_at = record.deleted_at
    record.deleted_at = None
    record.deleted_by = None
    await db.flush()

    return RecycleBinEntryResponse(
        id=record.id,
        entity_type=payload.entity_type,
        title=str(getattr(record, title_attr, record.id)),
        lead_uid=getattr(record, "lead_uid", None),
        deleted_at=previous_deleted_at,
        deleted_by=None,
    )
