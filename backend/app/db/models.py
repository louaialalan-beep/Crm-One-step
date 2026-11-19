from __future__ import annotations

import random
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TenantScopedMixin, TimestampMixin, utc_now


def generate_unified_customer_uid() -> str:
    """Generates Permanent Unified Customer Identifier (RWQ-xxxxx)."""
    return f"RWQ-{random.randint(10000, 99999)}"


# ============================================================================
# 1. Core & RBAC Tables: organizations, roles, profiles, users
# ============================================================================


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vat_number: Mapped[str] = mapped_column(String(32), default="310122393500003", nullable=False)
    cr_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    base_currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(50), default="Enterprise", nullable=False)
    seat_limit: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(32), default="paid", nullable=False
    )  # paid | trialing | past_due | suspended
    billing_provider: Mapped[str] = mapped_column(
        String(32), default="moyasar", nullable=False
    )  # moyasar | tap | stripe
    subscription_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Role(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    parent_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
    )
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    data_sharing_scope: Mapped[str] = mapped_column(
        String(64), default="team_and_subordinates", nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Profile(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    permissions: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class User(Base, TenantScopedMixin, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
    )
    profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ============================================================================
# 2. Sales & Customer Entities: leads, accounts, contacts, deals, activities
# ============================================================================


class Lead(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(
        String(32), nullable=False, default=generate_unified_customer_uid, index=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(100), default="موقع إلكتروني", nullable=False)
    status: Mapped[str] = mapped_column(String(80), default="جديد", nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, default=65, nullable=False)
    estimated_value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ad_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_converted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    converted_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    converted_deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    custom_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_leads_org_lead_uid", "org_id", "lead_uid"),
    )


class Account(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(
        String(32), nullable=False, default=generate_unified_customer_uid, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    tier: Mapped[str] = mapped_column(String(50), default="Enterprise", nullable=False)
    vat_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    cr_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    annual_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    custom_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Contact(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(
        String(32), nullable=False, default=generate_unified_customer_uid, index=True
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    custom_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Deal(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(
        String(32), nullable=False, default=generate_unified_customer_uid, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )
    stage: Mapped[str] = mapped_column(String(100), default="تأهيل", nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    probability: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    expected_close_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lost_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Activity(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    activity_type: Mapped[str] = mapped_column(
        String(50), default="task", nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="قيد التنفيذ", nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="متوسطة", nullable=False)
    due_date: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


# ============================================================================
# 3. Competitive Attribution & Blueprint Bottleneck Analytics
# ============================================================================


class Touchpoint(Base, TenantScopedMixin):
    __tablename__ = "touchpoints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    ad_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    metadata_: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class OrderAttribution(Base, TenantScopedMixin):
    __tablename__ = "order_attributions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    touchpoint_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("touchpoints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True
    )
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True, index=True
    )
    purchase_sequence: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    attribution_model: Mapped[str] = mapped_column(
        String(64), default="multi_touch_w_shaped", nullable=False
    )
    attribution_weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("100.00"), nullable=False
    )
    attributed_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(80), default="Direct", nullable=False)
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ad_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    metadata_: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class StageHistory(Base, TenantScopedMixin):
    __tablename__ = "stage_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_uid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    from_stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    exited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dwell_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    changed_by_user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


# ============================================================================
# 4. Financial Cycle (ZATCA Phase 1 - 15% VAT + TLV Base64 QR)
# ============================================================================


class Quote(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quote_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="مسودة", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    line_items: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    subtotal_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    discount_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    taxable_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("15.00"), nullable=False
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    valid_until: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SalesOrder(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    so_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    quote_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="معتمد", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    line_items: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    subtotal_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    discount_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    taxable_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("15.00"), nullable=False
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )


class Invoice(Base, TenantScopedMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True
    )
    quote_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_vat_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    seller_name: Mapped[str] = mapped_column(
        String(255), default="Crm-One-step Enterprise", nullable=False
    )
    seller_vat_number: Mapped[str] = mapped_column(
        String(32), default="310122393500003", nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="صادرة", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    line_items: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    subtotal_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    discount_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    taxable_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("15.00"), nullable=False
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    zatca_tlv_base64: Mapped[str] = mapped_column(Text, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    due_date: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)


# ============================================================================
# 5. Phase 3 Tables:
#    - whatsapp_messages (WhatsApp Cloud API + WebSocket live sync)
#    - capi_events_log (Meta Conversions API delivery & retry log)
#    - blueprints, blueprint_transitions, workflow_rules, workflow_logs
# ============================================================================


class WhatsAppMessage(Base, TenantScopedMixin, TimestampMixin):
    """
    جدول رسائل واتساب السحابي (whatsapp_messages) المرتبط بـ org_id وسياسة RLS ومعرّف العميل الموحد RWQ-xxxxx.
    """

    __tablename__ = "whatsapp_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    phone_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    direction: Mapped[str] = mapped_column(
        String(20), default="inbound", nullable=False, index=True
    )  # inbound | outbound
    message_type: Mapped[str] = mapped_column(
        String(32), default="text", nullable=False
    )  # text | image | document | audio | template
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    media_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    wamid: Mapped[Optional[str]] = mapped_column(
        String(160), nullable=True, index=True
    )  # WhatsApp Cloud API Message ID
    status: Mapped[str] = mapped_column(
        String(32), default="received", nullable=False
    )  # received | queued | sent | delivered | read | failed
    metadata_: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )


class CapiEventLog(Base, TenantScopedMixin, TimestampMixin):
    """
    جدول سجل أحداث التحويل المرسلة إلى Meta Conversions API (capi_events_log) مع تتبع المحاولات وحالة الإرسال.
    """

    __tablename__ = "capi_events_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_uid: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    event_name: Mapped[str] = mapped_column(
        String(64), default="Purchase", nullable=False, index=True
    )  # Purchase | LeadQualified
    event_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # deal | invoice | lead
    entity_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(10), default="SAR", nullable=False)
    hashed_email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    hashed_phone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default="queued", nullable=False, index=True
    )  # queued | sent | simulated | failed
    attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    response_payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class BlueprintModel(Base, TenantScopedMixin, TimestampMixin):
    """
    جدول مخططات مسارات العمل (blueprints) المرتبط بـ org_id وسياسة RLS.
    """

    __tablename__ = "blueprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(64), default="deals", nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(64), default="stage", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    stages: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)


class BlueprintTransitionModel(Base, TenantScopedMixin, TimestampMixin):
    """
    جدول انتقالات البلوبرينت (blueprint_transitions) مع شروط Before وDuring وإجراءات After.
    """

    __tablename__ = "blueprint_transitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    from_stage: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    to_stage: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    before_rules: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    during_required_fields: Mapped[List[str]] = mapped_column(JSONB, default=list, nullable=False)
    after_actions: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    sla_hours: Mapped[int] = mapped_column(Integer, default=48, nullable=False)


class WorkflowRuleModel(Base, TenantScopedMixin, TimestampMixin):
    """
    جدول قواعد الأتمتة وسير العمل (workflow_rules) مع org_id وسياسة RLS.
    """

    __tablename__ = "workflow_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(64), default="deals", nullable=False, index=True)
    trigger_type: Mapped[str] = mapped_column(
        String(64), default="on_stage_change", nullable=False
    )  # on_create | on_update | on_stage_change | on_score_threshold
    conditions: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    actions: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    executions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class WorkflowLogModel(Base, TenantScopedMixin):
    """
    جدول سجل تنفيذ قواعد الورك فلو وإجراءات البلوبرينت (workflow_logs).
    """

    __tablename__ = "workflow_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_rules.id", ondelete="SET NULL"), nullable=True, index=True
    )
    blueprint_transition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprint_transitions.id", ondelete="SET NULL"), nullable=True
    )
    module: Mapped[str] = mapped_column(String(64), nullable=False)
    record_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    lead_uid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    action_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # update_field | create_task | send_whatsapp | send_webhook
    status: Mapped[str] = mapped_column(String(32), default="executed", nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


RLS_PROTECTED_TABLES: List[str] = [
    "roles",
    "profiles",
    "users",
    "leads",
    "accounts",
    "contacts",
    "deals",
    "activities",
    "touchpoints",
    "order_attributions",
    "stage_history",
    "quotes",
    "sales_orders",
    "invoices",
    "whatsapp_messages",
    "capi_events_log",
    "blueprints",
    "blueprint_transitions",
    "workflow_rules",
    "workflow_logs",
]
