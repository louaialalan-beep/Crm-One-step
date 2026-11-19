from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.quotas import get_plan_quota, normalize_plan_tier
from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import Contact, Lead, Organization, User
from app.db.session import get_unscoped_db
from app.schemas.crm import (
    SuperAdminOrganizationSummary,
    SuperAdminOrganizationUpdateRequest,
)

router = APIRouter(prefix="/super-admin", tags=["Platform Owner Super Admin Dashboard"])


async def require_platform_super_admin(
    db: AsyncSession = Depends(get_unscoped_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> TokenPayload:
    """
    Verifies that the caller is a Platform Owner (`is_super_admin = True` or `is_superadmin = True`).
    """
    try:
        user_uuid = uuid.UUID(str(token_payload.sub))
        user = await db.scalar(select(User).where(User.id == user_uuid))
        if user and not (user.is_super_admin or user.is_superadmin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="الوصول مرفوض: هذه اللوحة مخصصة لمالك المنصة (Super Admin) فقط.",
            )
    except ValueError:
        pass
    return token_payload


@router.get("/organizations", response_model=List[SuperAdminOrganizationSummary])
async def list_all_subscribed_organizations(
    db: AsyncSession = Depends(get_unscoped_db),
    _: TokenPayload = Depends(require_platform_super_admin),
) -> List[SuperAdminOrganizationSummary]:
    """
    Platform Owner Super Admin endpoint (`GET /api/v1/super-admin/organizations`):
    Returns all subscribed tenant companies across the SaaS platform with their
    current plan tier, user count, customer count, payment status, and active state.
    """
    orgs = (
        await db.scalars(select(Organization).order_by(Organization.created_at.desc()))
    ).all()

    summaries: List[SuperAdminOrganizationSummary] = []
    for org in orgs:
        users_count = int(
            await db.scalar(
                select(func.count(User.id)).where(User.org_id == org.id)
            )
            or 0
        )
        leads_count = int(
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.org_id == org.id,
                    Lead.deleted_at.is_(None),
                    Lead.is_converted.is_(False),
                )
            )
            or 0
        )
        contacts_count = int(
            await db.scalar(
                select(func.count(Contact.id)).where(
                    Contact.org_id == org.id,
                    Contact.deleted_at.is_(None),
                )
            )
            or 0
        )
        summaries.append(
            SuperAdminOrganizationSummary(
                id=org.id,
                name=org.name,
                slug=org.slug,
                vat_number=org.vat_number,
                base_currency=org.base_currency,
                plan_tier=org.plan_tier,
                seat_limit=org.seat_limit,
                users_count=users_count,
                customers_count=leads_count + contacts_count,
                payment_status=org.payment_status or "paid",
                billing_provider=org.billing_provider,
                subscription_id=org.subscription_id,
                is_active=org.is_active,
                created_at=org.created_at,
            )
        )

    return summaries


@router.patch(
    "/organizations/{org_id}",
    response_model=SuperAdminOrganizationSummary,
)
async def update_tenant_organization_by_super_admin(
    org_id: uuid.UUID,
    payload: SuperAdminOrganizationUpdateRequest,
    db: AsyncSession = Depends(get_unscoped_db),
    _: TokenPayload = Depends(require_platform_super_admin),
) -> SuperAdminOrganizationSummary:
    """
    Platform Owner Super Admin endpoint (`PATCH /api/v1/super-admin/organizations/{org_id}`):
    Allows the platform owner to manually activate/suspend a company, change its plan tier
    (`Free` / `Growth` / `Enterprise`), adjust its seat limit, or update its payment status.
    """
    org = await db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الشركة غير موجودة.",
        )

    if payload.plan_tier is not None:
        normalized_plan = normalize_plan_tier(payload.plan_tier)
        org.plan_tier = normalized_plan
        quota = get_plan_quota(normalized_plan)
        if payload.seat_limit is None:
            org.seat_limit = quota.max_users if quota.max_users is not None else 100

    if payload.seat_limit is not None:
        org.seat_limit = payload.seat_limit

    if payload.payment_status is not None:
        org.payment_status = payload.payment_status

    if payload.is_active is not None:
        org.is_active = payload.is_active
        if not payload.is_active and payload.payment_status is None:
            org.payment_status = "suspended"
        elif payload.is_active and org.payment_status == "suspended":
            org.payment_status = "paid"

    await db.flush()

    users_count = int(
        await db.scalar(select(func.count(User.id)).where(User.org_id == org.id)) or 0
    )
    leads_count = int(
        await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.org_id == org.id,
                Lead.deleted_at.is_(None),
                Lead.is_converted.is_(False),
            )
        )
        or 0
    )
    contacts_count = int(
        await db.scalar(
            select(func.count(Contact.id)).where(
                Contact.org_id == org.id,
                Contact.deleted_at.is_(None),
            )
        )
        or 0
    )

    return SuperAdminOrganizationSummary(
        id=org.id,
        name=org.name,
        slug=org.slug,
        vat_number=org.vat_number,
        base_currency=org.base_currency,
        plan_tier=org.plan_tier,
        seat_limit=org.seat_limit,
        users_count=users_count,
        customers_count=leads_count + contacts_count,
        payment_status=org.payment_status or "paid",
        billing_provider=org.billing_provider,
        subscription_id=org.subscription_id,
        is_active=org.is_active,
        created_at=org.created_at,
    )
