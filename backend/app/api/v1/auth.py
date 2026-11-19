from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    TokenPayload,
    create_access_token,
    get_current_token_payload,
    get_password_hash,
    verify_password,
)
from app.db.models import Organization, Profile, Role, User
from app.db.session import get_unscoped_db
from app.schemas.crm import (
    LoginRequest,
    OrganizationCreateRequest,
    OrganizationResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(tags=["Authentication & Multi-Tenant Organizations"])


DEFAULT_PROFILES_SEED: List[Dict[str, Any]] = [
    {
        "code": "prof_super_admin",
        "name": "المدير العام للنظام (Super Admin)",
        "is_system": True,
        "permissions": {
            "leads": {"view": True, "create": True, "edit": True, "delete": True, "export": True},
            "deals": {"view": True, "create": True, "edit": True, "delete": True, "export": True},
            "invoices": {"view": True, "create": True, "edit": True, "delete": True, "zatca_qr": True},
            "settings": {"manage_all": True},
        },
    },
    {
        "code": "prof_sales_manager",
        "name": "مدير مبيعات إقليمي",
        "is_system": True,
        "permissions": {
            "leads": {"view": True, "create": True, "edit": True, "delete": True, "export": True},
            "deals": {"view": True, "create": True, "edit": True, "delete": False, "export": True},
            "invoices": {"view": True, "create": True, "edit": True, "delete": False, "zatca_qr": True},
        },
    },
    {
        "code": "prof_account_exec",
        "name": "تنفيذي مبيعات أول (Account Executive)",
        "is_system": True,
        "permissions": {
            "leads": {"view": True, "create": True, "edit": True, "delete": False},
            "deals": {"view": True, "create": True, "edit": True, "delete": False},
            "invoices": {"view": True, "create": True, "edit": False, "delete": False, "zatca_qr": True},
        },
    },
    {
        "code": "prof_sdr",
        "name": "مندوب تأهيل وحملات (SDR)",
        "is_system": True,
        "permissions": {
            "leads": {"view": True, "create": True, "edit": True, "delete": False},
            "deals": {"view": True, "create": False, "edit": False, "delete": False},
        },
    },
    {
        "code": "prof_cs_finance",
        "name": "محاسب ومسؤول فوترة ونجاح عملاء",
        "is_system": True,
        "permissions": {
            "deals": {"view": True, "create": False, "edit": False, "delete": False},
            "invoices": {"view": True, "create": True, "edit": True, "delete": False, "zatca_qr": True},
        },
    },
]


def _slugify_org(name: str, explicit_slug: str | None = None) -> str:
    base = (explicit_slug or name).strip().lower()
    clean = re.sub(r"[^a-z0-9_-]+", "-", base).strip("-")
    if not clean:
        clean = f"org-{uuid.uuid4().hex[:8]}"
    return clean


async def _auto_provision_organization(
    db: AsyncSession,
    *,
    name: str,
    slug: str,
    vat_number: str,
    base_currency: str,
    admin_email: str,
    admin_full_name: str,
    admin_password: str,
    plan_tier: str = "Enterprise",
    seat_limit: int = 25,
) -> tuple[Organization, User, Role, Profile]:
    """
    Auto-provisions a new multi-tenant Organization along with its RLS context,
    default Role hierarchy, 5 standard JSONB Permission Profiles, and SuperAdmin User.
    """
    org_id = uuid.uuid4()
    org = Organization(
        id=org_id,
        name=name,
        slug=slug,
        vat_number=vat_number,
        base_currency=base_currency,
        plan_tier=plan_tier,
        seat_limit=seat_limit,
        is_active=True,
    )
    db.add(org)
    await db.flush()

    # Activate PostgreSQL Row-Level Security context for this new org_id
    await db.execute(
        text("SET LOCAL app.current_org_id = :org_id"),
        {"org_id": str(org_id)},
    )

    ceo_role = Role(
        org_id=org_id,
        code="role_ceo",
        name="الرئيس التنفيذي والمدير العام",
        level=1,
        data_sharing_scope="all_organization",
    )
    db.add(ceo_role)
    await db.flush()

    sales_vp_role = Role(
        org_id=org_id,
        code="role_vp_sales",
        name="نائب الرئيس للمبيعات وتطوير الأعمال",
        parent_role_id=ceo_role.id,
        level=2,
        data_sharing_scope="team_and_subordinates",
    )
    db.add(sales_vp_role)

    super_admin_profile: Profile | None = None
    for idx, p_seed in enumerate(DEFAULT_PROFILES_SEED):
        profile = Profile(
            org_id=org_id,
            code=p_seed["code"],
            name=p_seed["name"],
            is_system=p_seed["is_system"],
            permissions=p_seed["permissions"],
        )
        db.add(profile)
        if idx == 0:
            super_admin_profile = profile

    await db.flush()
    assert super_admin_profile is not None

    admin_user = User(
        org_id=org_id,
        email=admin_email.lower().strip(),
        full_name=admin_full_name,
        hashed_password=get_password_hash(admin_password),
        role_id=ceo_role.id,
        profile_id=super_admin_profile.id,
        status="active",
        is_superadmin=True,
        is_super_admin=True,
    )
    db.add(admin_user)
    await db.flush()

    return org, admin_user, ceo_role, super_admin_profile


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_tenant_and_user(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_unscoped_db),
) -> TokenResponse:
    slug = _slugify_org(payload.organization_name, payload.organization_slug)

    existing_org = await db.scalar(select(Organization).where(Organization.slug == slug))
    if existing_org:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    org, user, role, profile = await _auto_provision_organization(
        db,
        name=payload.organization_name,
        slug=slug,
        vat_number=payload.vat_number,
        base_currency=payload.base_currency,
        admin_email=str(payload.email),
        admin_full_name=payload.full_name,
        admin_password=payload.password,
    )

    access_token = create_access_token(
        subject=user.id,
        org_id=org.id,
        extra_claims={
            "email": user.email,
            "role_id": str(role.id),
            "profile_id": str(profile.id),
        },
    )

    return TokenResponse(
        access_token=access_token,
        org_id=org.id,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(org),
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login_access_token(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_unscoped_db),
) -> TokenResponse:
    """
    Authenticates a user by email & password, resolves their Organization,
    sets the RLS session context, and returns a signed JWT containing `org_id`.
    """
    org_query = select(Organization).where(Organization.is_active.is_(True))
    if payload.org_slug:
        org_query = org_query.where(Organization.slug == payload.org_slug)

    orgs = (await db.scalars(org_query)).all()
    matched_user: User | None = None
    matched_org: Organization | None = None

    for org in orgs:
        await db.execute(
            text("SET LOCAL app.current_org_id = :org_id"),
            {"org_id": str(org.id)},
        )
        candidate = await db.scalar(
            select(User).where(
                User.org_id == org.id,
                User.email == str(payload.email).lower().strip(),
            )
        )
        if candidate and verify_password(payload.password, candidate.hashed_password):
            matched_user = candidate
            matched_org = org
            break

    if not matched_user or not matched_org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        )

    access_token = create_access_token(
        subject=matched_user.id,
        org_id=matched_org.id,
        extra_claims={
            "email": matched_user.email,
            "role_id": str(matched_user.role_id) if matched_user.role_id else None,
            "profile_id": str(matched_user.profile_id) if matched_user.profile_id else None,
        },
    )

    return TokenResponse(
        access_token=access_token,
        org_id=matched_org.id,
        user=UserResponse.model_validate(matched_user),
        organization=OrganizationResponse.model_validate(matched_org),
    )


@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    db: AsyncSession = Depends(get_unscoped_db),
) -> List[OrganizationResponse]:
    rows = (await db.scalars(select(Organization).order_by(Organization.created_at.desc()))).all()
    return [OrganizationResponse.model_validate(r) for r in rows]


@router.post(
    "/organizations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organization_auto_provisioned(
    payload: OrganizationCreateRequest,
    db: AsyncSession = Depends(get_unscoped_db),
    token_payload: TokenPayload | None = Depends(get_current_token_payload),
) -> OrganizationResponse:
    """
    Auto-provisions a new multi-tenant Organization with 5 default permission profiles,
    role hierarchy, and initial admin user.
    """
    slug = _slugify_org(payload.name, payload.slug)
    existing = await db.scalar(select(Organization).where(Organization.slug == slug))
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    admin_email = str(payload.admin_email or f"admin@{slug}.crm-one-step.sa")
    admin_name = payload.admin_full_name or f"مدير {payload.name}"
    admin_password = payload.admin_password or "CrmOneStep@2026"

    org, _, _, _ = await _auto_provision_organization(
        db,
        name=payload.name,
        slug=slug,
        vat_number=payload.vat_number,
        base_currency=payload.base_currency,
        admin_email=admin_email,
        admin_full_name=admin_name,
        admin_password=admin_password,
        plan_tier=payload.plan_tier,
        seat_limit=payload.seat_limit,
    )
    return OrganizationResponse.model_validate(org)


@router.post("/users/invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_organization_user(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_unscoped_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> UserResponse:
    """
    Invites a new employee to the current organization, enforcing server-side
    Plan Seat Quotas (`Free`: max 3 users, `Growth`: max 15 users, `Enterprise`: unlimited)
    and enqueuing an SMTP invitation email task in ARQ.
    """
    from app.core.quotas import enforce_user_seat_quota
    from app.worker import send_smtp_email_task

    org = await enforce_user_seat_quota(db=db, token_payload=token_payload)

    await db.execute(
        text("SET LOCAL app.current_org_id = :org_id"),
        {"org_id": str(token_payload.org_id)},
    )

    email = str(payload.get("email") or "").lower().strip()
    full_name = str(payload.get("full_name") or payload.get("name") or "موظف جديد").strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="البريد الإلكتروني للموظف مطلوب.",
        )

    new_user = User(
        org_id=token_payload.org_id,
        email=email,
        full_name=full_name,
        phone=payload.get("phone"),
        hashed_password=get_password_hash(str(payload.get("password") or "CrmInvite@2026")),
        status="invited",
        is_superadmin=False,
        is_super_admin=False,
    )
    db.add(new_user)
    await db.flush()

    await send_smtp_email_task(
        {},
        org_id=str(token_payload.org_id),
        template_type="employee_invite",
        to_email=email,
        recipient_name=full_name,
        context_data={
            "organization_name": org.name,
            "role_name": payload.get("role_name") or "تنفيذي مبيعات",
            "inviter_name": "إدارة المؤسسة",
        },
    )

    return UserResponse.model_validate(new_user)

