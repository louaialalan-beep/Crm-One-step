from __future__ import annotations

import hashlib
import hmac
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.quotas import PLAN_QUOTAS, get_plan_quota, normalize_plan_tier
from app.core.security import (
    TokenPayload,
    get_current_token_payload,
    parse_org_uuid_fallback,
)
from app.db.models import Contact, Lead, Organization, User
from app.db.session import get_db, get_unscoped_db
from app.schemas.crm import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    SmtpEmailRequest,
    SmtpEmailResponse,
)
from app.worker import send_smtp_email_task

router = APIRouter(prefix="/billing", tags=["Billing, Payment Gateways (Moyasar/Tap/Stripe), Quotas & SMTP"])

PLAN_MONTHLY_PRICING_SAR: Dict[str, Decimal] = {
    "Free": Decimal("0.00"),
    "Growth": Decimal("749.00"),
    "Enterprise": Decimal("1990.00"),
}


@router.get("/quotas")
async def get_organization_plan_quotas(
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> Dict[str, Any]:
    """
    Returns the active organization's current subscription plan, feature flags,
    and real-time usage counts (users vs max_users, customers vs max_customers).
    """
    org = await db.scalar(select(Organization).where(Organization.id == token_payload.org_id))
    plan_tier = normalize_plan_tier(org.plan_tier if org else "Enterprise")
    quota = get_plan_quota(plan_tier)

    users_count = int(
        await db.scalar(
            select(func.count(User.id)).where(
                User.org_id == token_payload.org_id,
                User.status != "suspended",
            )
        )
        or 0
    )
    leads_count = int(
        await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.org_id == token_payload.org_id,
                Lead.deleted_at.is_(None),
                Lead.is_converted.is_(False),
            )
        )
        or 0
    )
    contacts_count = int(
        await db.scalar(
            select(func.count(Contact.id)).where(
                Contact.org_id == token_payload.org_id,
                Contact.deleted_at.is_(None),
            )
        )
        or 0
    )
    customers_count = leads_count + contacts_count

    return {
        "org_id": str(token_payload.org_id),
        "plan_tier": plan_tier,
        "payment_status": org.payment_status if org else "paid",
        "billing_provider": org.billing_provider if org else settings.PAYMENT_PROVIDER,
        "subscription_id": org.subscription_id if org else None,
        "is_active": org.is_active if org else True,
        "limits": {
            "max_users": quota.max_users,
            "seat_limit": org.seat_limit if org else (quota.max_users or 999),
            "max_customers": quota.max_customers,
        },
        "usage": {
            "users_count": users_count,
            "customers_count": customers_count,
            "leads_count": leads_count,
            "contacts_count": contacts_count,
        },
        "features": {
            "whatsapp": quota.allow_whatsapp,
            "meta_capi": quota.allow_meta_capi,
            "zatca_phase1": quota.allow_zatca_phase1,
            "blueprints": quota.allow_blueprints,
            "workflows": quota.allow_workflows,
            "api_access": quota.allow_api_access,
        },
        "available_plans": {
            tier: {
                "name_ar": q.name_ar,
                "max_users": q.max_users,
                "max_customers": q.max_customers,
                "monthly_price_sar": float(PLAN_MONTHLY_PRICING_SAR.get(tier, Decimal("0.00"))),
                "features": {
                    "whatsapp": q.allow_whatsapp,
                    "meta_capi": q.allow_meta_capi,
                    "zatca_phase1": q.allow_zatca_phase1,
                    "blueprints": q.allow_blueprints,
                    "workflows": q.allow_workflows,
                    "api_access": q.allow_api_access,
                },
            }
            for tier, q in PLAN_QUOTAS.items()
        },
    }


@router.post("/checkout-session", response_model=BillingCheckoutResponse)
async def create_payment_checkout_session(
    payload: BillingCheckoutRequest,
    db: AsyncSession = Depends(get_unscoped_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> BillingCheckoutResponse:
    """
    Unified Payment Gateway Adapter (`Moyasar / Tap / Stripe`):
    Creates a hosted checkout session for upgrading or renewing an organization's subscription.
    """
    normalized_plan = normalize_plan_tier(payload.plan_tier)
    quota = get_plan_quota(normalized_plan)
    monthly_price = PLAN_MONTHLY_PRICING_SAR.get(normalized_plan, Decimal("749.00"))
    if payload.billing_cycle == "yearly":
        amount_sar = (monthly_price * Decimal("12") * Decimal("0.80")).quantize(Decimal("0.01"))
    else:
        amount_sar = monthly_price

    provider = payload.provider.lower().strip()
    session_id = f"chk_{provider}_{uuid.uuid4().hex[:16]}"
    success_url = payload.success_url or settings.PAYMENT_SUCCESS_URL
    checkout_url = f"{success_url}&session_id={session_id}&provider={provider}&plan={normalized_plan}"

    # Attempt live gateway session creation if provider secret key is configured
    if provider == "moyasar" and settings.PAYMENT_MOYASAR_SECRET_KEY and amount_sar > 0:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.moyasar.com/v1/invoices",
                    auth=(settings.PAYMENT_MOYASAR_SECRET_KEY, ""),
                    json={
                        "amount": int(amount_sar * 100),
                        "currency": "SAR",
                        "description": f"اشتراك Crm-One-step باقة {quota.name_ar} ({payload.billing_cycle})",
                        "callback_url": success_url,
                        "metadata": {
                            "org_id": str(token_payload.org_id),
                            "plan_tier": normalized_plan,
                            "billing_cycle": payload.billing_cycle,
                        },
                    },
                )
                if resp.is_success:
                    data = resp.json()
                    session_id = str(data.get("id") or session_id)
                    checkout_url = str(data.get("url") or checkout_url)
        except Exception:
            pass

    elif provider == "tap" and settings.PAYMENT_TAP_SECRET_KEY and amount_sar > 0:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.tap.company/v2/charges",
                    headers={"Authorization": f"Bearer {settings.PAYMENT_TAP_SECRET_KEY}"},
                    json={
                        "amount": float(amount_sar),
                        "currency": "SAR",
                        "description": f"Crm-One-step {normalized_plan} Subscription",
                        "redirect": {"url": success_url},
                        "metadata": {
                            "org_id": str(token_payload.org_id),
                            "plan_tier": normalized_plan,
                        },
                    },
                )
                if resp.is_success:
                    data = resp.json()
                    session_id = str(data.get("id") or session_id)
                    checkout_url = str((data.get("transaction") or {}).get("url") or checkout_url)
        except Exception:
            pass

    elif provider == "stripe" and settings.PAYMENT_STRIPE_SECRET_KEY and amount_sar > 0:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    headers={"Authorization": f"Bearer {settings.PAYMENT_STRIPE_SECRET_KEY}"},
                    data={
                        "mode": "payment",
                        "success_url": success_url,
                        "cancel_url": payload.cancel_url or settings.PAYMENT_CANCEL_URL,
                        "line_items[0][price_data][currency]": "sar",
                        "line_items[0][price_data][unit_amount]": str(int(amount_sar * 100)),
                        "line_items[0][price_data][product_data][name]": f"Crm-One-step {normalized_plan}",
                        "line_items[0][quantity]": "1",
                        "metadata[org_id]": str(token_payload.org_id),
                        "metadata[plan_tier]": normalized_plan,
                    },
                )
                if resp.is_success:
                    data = resp.json()
                    session_id = str(data.get("id") or session_id)
                    checkout_url = str(data.get("url") or checkout_url)
        except Exception:
            pass

    # Update organization plan & billing provider record
    org = await db.scalar(select(Organization).where(Organization.id == token_payload.org_id))
    payment_status = "paid"
    if org:
        org.plan_tier = normalized_plan
        org.billing_provider = provider
        org.subscription_id = session_id
        org.payment_status = "paid"
        org.is_active = True
        if quota.max_users is not None:
            org.seat_limit = quota.max_users
        elif payload.Seats:
            org.seat_limit = max(org.seat_limit, payload.Seats)
        else:
            org.seat_limit = max(org.seat_limit, 50)
        await db.flush()
        payment_status = org.payment_status

    return BillingCheckoutResponse(
        session_id=session_id,
        provider=provider,
        plan_tier=normalized_plan,
        billing_cycle=payload.billing_cycle,
        amount_sar=amount_sar,
        currency="SAR",
        checkout_url=checkout_url,
        status="paid",
        org_id=token_payload.org_id,
        payment_status=payment_status,
    )


async def _handle_payment_webhook_payload(
    provider: str,
    payload: Dict[str, Any],
    db: AsyncSession,
    request: Request,
) -> Dict[str, Any]:
    """
    Processes payment webhook notifications from Moyasar, Tap, or Stripe:
      - On `paid` / `CAPTURED` / `checkout.session.completed`: activates the organization,
        updates `plan_tier`, `seat_limit`, and sets `payment_status = 'paid'`.
      - On `failed` / `DECLINED` / `invoice.payment_failed` / `subscription.canceled`:
        marks `payment_status = 'past_due'` or `'suspended'` and suspends if requested.
    """
    metadata = (
        payload.get("metadata")
        or (payload.get("data", {}).get("object", {}) if isinstance(payload.get("data"), dict) else {}).get("metadata")
        or {}
    )
    raw_org_id = payload.get("org_id") or metadata.get("org_id")
    if not raw_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="حقل org_id مفقود في حمولة Webhook الدفع.",
        )

    org_uuid = parse_org_uuid_fallback(str(raw_org_id))
    org = await db.scalar(select(Organization).where(Organization.id == org_uuid))
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="المؤسسة المستهدفة غير موجودة.",
        )

    event_status = str(
        payload.get("status")
        or payload.get("type")
        or (payload.get("data", {}).get("status") if isinstance(payload.get("data"), dict) else "")
        or "paid"
    ).lower()

    target_plan = payload.get("plan_tier") or metadata.get("plan_tier")
    subscription_id = str(payload.get("id") or payload.get("subscription_id") or f"sub_{provider}_{uuid.uuid4().hex[:10]}")

    success_statuses = {"paid", "captured", "succeeded", "checkout.session.completed", "invoice.paid", "active"}
    suspend_statuses = {"failed", "declined", "suspended", "canceled", "cancelled", "invoice.payment_failed", "past_due"}

    org.billing_provider = provider
    org.subscription_id = subscription_id

    if event_status in success_statuses:
        if target_plan:
            normalized_plan = normalize_plan_tier(str(target_plan))
            org.plan_tier = normalized_plan
            quota = get_plan_quota(normalized_plan)
            if quota.max_users is not None:
                org.seat_limit = quota.max_users
            else:
                org.seat_limit = max(org.seat_limit, 50)
        org.payment_status = "paid"
        org.is_active = True
        action_taken = "activated_and_upgraded"
    elif event_status in suspend_statuses:
        if event_status in {"suspended", "canceled", "cancelled"}:
            org.payment_status = "suspended"
            org.is_active = False
            action_taken = "suspended"
        else:
            org.payment_status = "past_due"
            action_taken = "marked_past_due"
    else:
        org.payment_status = "paid"
        org.is_active = True
        action_taken = "updated"

    await db.flush()

    # Queue transactional confirmation email via ARQ if admin email is provided
    admin_email = payload.get("customer_email") or metadata.get("email")
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if admin_email and arq_pool is not None:
        try:
            await arq_pool.enqueue_job(
                "send_smtp_email_task",
                org_id=str(org.id),
                template_type="invoice_notification",
                to_email=str(admin_email),
                recipient_name=org.name,
                context_data={
                    "organization_name": org.name,
                    "invoice_number": f"SUB-{subscription_id[-6:].upper()}",
                    "invoice_total": f"{payload.get('amount', '749.00')} SAR",
                },
            )
        except Exception:
            pass

    return {
        "status": "processed",
        "provider": provider,
        "action": action_taken,
        "org_id": str(org.id),
        "plan_tier": org.plan_tier,
        "payment_status": org.payment_status,
        "is_active": org.is_active,
        "seat_limit": org.seat_limit,
    }


@router.post("/webhook")
async def payment_gateway_unified_webhook(
    request: Request,
    x_webhook_signature: Optional[str] = Header(default=None, alias="X-Webhook-Signature"),
    db: AsyncSession = Depends(get_unscoped_db),
) -> Dict[str, Any]:
    raw_body = await request.body()
    if settings.PAYMENT_WEBHOOK_SECRET and x_webhook_signature:
        expected = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_webhook_signature.replace("sha256=", "")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="توقيع Webhook بوابة الدفع غير صالح.",
            )

    payload = await request.json()
    provider = str(payload.get("provider") or settings.PAYMENT_PROVIDER or "moyasar").lower()
    return await _handle_payment_webhook_payload(provider, payload, db, request)


@router.post("/webhooks/{provider}")
async def payment_gateway_provider_webhook(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_unscoped_db),
) -> Dict[str, Any]:
    payload = await request.json()
    return await _handle_payment_webhook_payload(provider.lower(), payload, db, request)


@router.post("/send-email", response_model=SmtpEmailResponse)
async def trigger_transactional_smtp_email(
    payload: SmtpEmailRequest,
    request: Request,
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> SmtpEmailResponse:
    """
    Enqueues an asynchronous SMTP transactional email task in ARQ (`send_smtp_email_task`)
    for employee invitations, ZATCA invoice notifications, or password recovery.
    Falls back to immediate execution if Redis/ARQ is not active.
    """
    job_id = f"smtp_{uuid.uuid4().hex[:12]}"
    context_data = {
        "organization_name": payload.organization_name or "مؤسسة Crm-One-step",
        "inviter_name": payload.inviter_name,
        "role_name": payload.role_name,
        "invoice_number": payload.invoice_number,
        "invoice_total": payload.invoice_total,
        "lead_uid": payload.lead_uid,
        "reset_token_url": payload.reset_token_url,
    }

    arq_pool = getattr(request.app.state, "arq_pool", None)
    queued_via_arq = False
    if arq_pool is not None:
        try:
            await arq_pool.enqueue_job(
                "send_smtp_email_task",
                org_id=str(token_payload.org_id),
                template_type=payload.template_type,
                to_email=str(payload.to_email),
                recipient_name=payload.recipient_name,
                subject=payload.subject,
                context_data=context_data,
            )
            queued_via_arq = True
        except Exception:
            queued_via_arq = False

    if not queued_via_arq:
        await send_smtp_email_task(
            {},
            org_id=str(token_payload.org_id),
            template_type=payload.template_type,
            to_email=str(payload.to_email),
            recipient_name=payload.recipient_name,
            subject=payload.subject,
            context_data=context_data,
        )

    return SmtpEmailResponse(
        job_id=job_id,
        status="queued" if queued_via_arq else "sent",
        template_type=payload.template_type,
        to_email=str(payload.to_email),
        queued_via_arq=queued_via_arq,
        message=f"تم جدولة وإرسال البريد الإلكتروني ({payload.template_type}) إلى {payload.to_email} بنجاح.",
    )
