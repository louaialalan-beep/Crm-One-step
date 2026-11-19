from __future__ import annotations

from typing import Any, Callable, Coroutine, Dict, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, get_current_token_payload
from app.db.models import Contact, Lead, Organization, User
from app.db.session import get_db

# ==============================================================================
# Plan Quota Matrix (Free / Growth / Enterprise)
# ==============================================================================
# - Free: up to 3 users and 500 customers, no Blueprints or Meta CAPI.
# - Growth (and Pro alias): up to 15 users, WhatsApp + Meta CAPI + ZATCA Phase 1.
# - Enterprise: unlimited users & customers + Blueprints + Workflows + API.

PLAN_QUOTAS: Dict[str, Dict[str, Any]] = {
    "Free": {
        "tier": "Free",
        "label_ar": "الباقة المجانية (Free)",
        "max_users": 3,
        "max_customers": 500,
        "price_monthly_sar": 0,
        "price_yearly_sar": 0,
        "features": {
            "whatsapp": False,
            "meta_capi": False,
            "zatca_phase1": True,
            "blueprints": False,
            "workflows": False,
            "api_access": False,
        },
    },
    "Starter": {
        "tier": "Free",
        "label_ar": "الباقة المجانية / التأسيسية (Free)",
        "max_users": 3,
        "max_customers": 500,
        "price_monthly_sar": 0,
        "price_yearly_sar": 0,
        "features": {
            "whatsapp": False,
            "meta_capi": False,
            "zatca_phase1": True,
            "blueprints": False,
            "workflows": False,
            "api_access": False,
        },
    },
    "Growth": {
        "tier": "Growth",
        "label_ar": "باقة النمو (Growth)",
        "max_users": 15,
        "max_customers": 10000,
        "price_monthly_sar": 490,
        "price_yearly_sar": 4700,
        "features": {
            "whatsapp": True,
            "meta_capi": True,
            "zatca_phase1": True,
            "blueprints": False,
            "workflows": True,
            "api_access": True,
        },
    },
    "Pro": {
        "tier": "Growth",
        "label_ar": "باقة النمو الاحترافية (Growth / Pro)",
        "max_users": 15,
        "max_customers": 10000,
        "price_monthly_sar": 490,
        "price_yearly_sar": 4700,
        "features": {
            "whatsapp": True,
            "meta_capi": True,
            "zatca_phase1": True,
            "blueprints": False,
            "workflows": True,
            "api_access": True,
        },
    },
    "Enterprise": {
        "tier": "Enterprise",
        "label_ar": "باقة المؤسسات (Enterprise)",
        "max_users": None,  # Unlimited users
        "max_customers": None,  # Unlimited customers
        "price_monthly_sar": 1500,
        "price_yearly_sar": 14400,
        "features": {
            "whatsapp": True,
            "meta_capi": True,
            "zatca_phase1": True,
            "blueprints": True,
            "workflows": True,
            "api_access": True,
        },
    },
}


def resolve_plan_quota_config(plan_tier: Optional[str]) -> Dict[str, Any]:
    if not plan_tier:
        return PLAN_QUOTAS["Enterprise"]
    normalized = plan_tier.strip()
    for key, cfg in PLAN_QUOTAS.items():
        if key.lower() == normalized.lower():
            return cfg
    return PLAN_QUOTAS["Enterprise"]


async def get_active_organization_or_default(
    db: AsyncSession,
    token_payload: TokenPayload,
) -> Optional[Organization]:
    org = await db.scalar(
        select(Organization).where(Organization.id == token_payload.org_id)
    )
    if org and (not org.is_active or org.payment_status == "suspended"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="اشتراك المؤسسة معلّق حالياً. يرجى تجديد الباقة من صفحة إدارة الاشتراكات.",
        )
    return org


async def enforce_user_seat_quota(
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> Dict[str, Any]:
    """
    FastAPI Dependency:
    Enforces the organization's plan user seat limit:
      - Free: max 3 users
      - Growth: max 15 users
      - Enterprise: unlimited users
    """
    org = await get_active_organization_or_default(db, token_payload)
    plan_cfg = resolve_plan_quota_config(org.plan_tier if org else "Enterprise")
    max_users: Optional[int] = plan_cfg["max_users"]

    current_users = int(
        (await db.scalar(select(func.count(User.id)).where(User.org_id == token_payload.org_id)))
        or 0
    )

    if max_users is not None and current_users >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"تم الوصول للحد الأقصى للمستخدمين في {plan_cfg['label_ar']} "
                f"({current_users}/{max_users} مستخدمين). يرجى ترقية الباقة لإضافة موظفين جدد."
            ),
        )
    return {"plan": plan_cfg, "users_used": current_users}


async def enforce_customer_quota(
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> Dict[str, Any]:
    """
    FastAPI Dependency:
    Enforces the organization's customer record limit (Leads + Contacts):
      - Free: max 500 customers
      - Growth: max 10,000 customers
      - Enterprise: unlimited customers
    """
    org = await get_active_organization_or_default(db, token_payload)
    plan_cfg = resolve_plan_quota_config(org.plan_tier if org else "Enterprise")
    max_customers: Optional[int] = plan_cfg["max_customers"]

    leads_count = int(
        (
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.org_id == token_payload.org_id,
                    Lead.deleted_at.is_(None),
                )
            )
        )
        or 0
    )
    contacts_count = int(
        (
            await db.scalar(
                select(func.count(Contact.id)).where(
                    Contact.org_id == token_payload.org_id,
                    Contact.deleted_at.is_(None),
                )
            )
        )
        or 0
    )
    total_customers = leads_count + contacts_count

    if max_customers is not None and total_customers >= max_customers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"تم الوصول للحد الأقصى للعملاء في {plan_cfg['label_ar']} "
                f"({total_customers}/{max_customers} عميل). يرجى ترقية الباقة إلى Growth أو Enterprise."
            ),
        )
    return {"plan": plan_cfg, "customers_used": total_customers}


def require_plan_feature(
    feature_key: str,
) -> Callable[..., Coroutine[Any, Any, Dict[str, Any]]]:
    """
    FastAPI Dependency factory:
    Verifies that the tenant's active subscription plan permits `feature_key`
    (`blueprints`, `workflows`, `meta_capi`, `whatsapp`, `zatca_phase1`, `api_access`).
    """

    async def _dependency(
        db: AsyncSession = Depends(get_db),
        token_payload: TokenPayload = Depends(get_current_token_payload),
    ) -> Dict[str, Any]:
        org = await get_active_organization_or_default(db, token_payload)
        plan_cfg = resolve_plan_quota_config(org.plan_tier if org else "Enterprise")
        allowed = bool(plan_cfg["features"].get(feature_key, False))
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"ميزة «{feature_key}» غير متاحة في {plan_cfg['label_ar']}. "
                    "يرجى ترقية اشتراك المؤسسة لتفعيل هذه الميزة."
                ),
            )
        return plan_cfg

    return _dependency
