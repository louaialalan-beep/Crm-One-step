from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.zatca import FinancialLineItemInput


class ORMBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# 1. Auth & Organization Schemas
# ============================================================================


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)
    org_slug: Optional[str] = None


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: Optional[str] = None
    organization_name: str = Field(..., min_length=2)
    organization_slug: Optional[str] = None
    vat_number: str = Field(default="310122393500003")
    base_currency: str = Field(default="SAR")


class OrganizationCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    slug: Optional[str] = None
    domain: Optional[str] = None
    vat_number: str = Field(default="310122393500003")
    cr_number: Optional[str] = None
    base_currency: str = Field(default="SAR")
    plan_tier: str = Field(default="Enterprise")
    seat_limit: int = Field(default=25, ge=1)
    admin_email: Optional[EmailStr] = None
    admin_full_name: Optional[str] = None
    admin_password: Optional[str] = None


class OrganizationResponse(ORMBaseModel):
    id: uuid.UUID
    name: str
    slug: str
    domain: Optional[str] = None
    vat_number: str
    cr_number: Optional[str] = None
    base_currency: str
    plan_tier: str
    seat_limit: int
    payment_status: str = "paid"
    billing_provider: Optional[str] = "moyasar"
    subscription_id: Optional[str] = None
    is_active: bool
    created_at: datetime


class UserResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role_id: Optional[uuid.UUID] = None
    profile_id: Optional[uuid.UUID] = None
    status: str
    is_superadmin: bool
    is_super_admin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    org_id: uuid.UUID
    user: UserResponse
    organization: Optional[OrganizationResponse] = None


# ============================================================================
# 2. Leads & Atomic Conversion Schemas (RWQ-xxxxx)
# ============================================================================


class TouchpointCreate(BaseModel):
    lead_uid: Optional[str] = None
    channel: str = Field(default="Direct")
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    source: str = Field(default="موقع إلكتروني")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None


class TouchpointResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    channel: str
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    source: str
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    created_at: datetime


class LeadCreate(BaseModel):
    lead_uid: Optional[str] = Field(
        default=None, description="المعرّف الدائم الموحد للعميل RWQ-xxxxx"
    )
    unique_id: Optional[str] = Field(default=None)
    full_name: str = Field(..., min_length=1)
    company: str = Field(default="شركة جديدة")
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = Field(default="موقع إلكتروني")
    status: str = Field(default="جديد")
    score: int = Field(default=65, ge=0, le=100)
    estimated_value: Decimal = Field(default=Decimal("0.00"))
    owner_id: Optional[str] = None
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    initial_touchpoint: Optional[TouchpointCreate] = None


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    score: Optional[int] = None
    estimated_value: Optional[Decimal] = None
    owner_id: Optional[str] = None
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class LeadResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    full_name: str
    company: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str
    status: str
    score: int
    estimated_value: Decimal
    owner_id: Optional[str] = None
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    is_converted: bool
    converted_at: Optional[datetime] = None
    converted_account_id: Optional[uuid.UUID] = None
    converted_contact_id: Optional[uuid.UUID] = None
    converted_deal_id: Optional[uuid.UUID] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class LeadAtomicConvertRequest(BaseModel):
    unique_id: Optional[str] = None
    create_account: bool = True
    account_name: Optional[str] = None
    account_industry: Optional[str] = None
    account_city: Optional[str] = None
    contact_job_title: Optional[str] = "مدير تنفيذي"
    create_deal: bool = True
    deal_title: Optional[str] = None
    deal_stage: str = "تأهيل"
    deal_amount: Optional[Decimal] = None
    deal_probability: int = 30
    expected_close_date: Optional[str] = None
    owner_id: Optional[str] = None
    newAccount: Optional[Dict[str, Any]] = None
    newContact: Optional[Dict[str, Any]] = None
    newDeal: Optional[Dict[str, Any]] = None


class LeadAtomicConvertResponse(BaseModel):
    lead_id: uuid.UUID
    lead_uid: str
    account_id: Optional[uuid.UUID] = None
    contact_id: uuid.UUID
    deal_id: Optional[uuid.UUID] = None
    stage_history_id: Optional[uuid.UUID] = None
    migrated_touchpoints_count: int = 0
    contactId: str
    accountId: Optional[str] = None
    dealId: Optional[str] = None


# ============================================================================
# 3. Accounts, Contacts, Deals, StageHistory, OrderAttributions, Activities
# ============================================================================


class AccountCreate(BaseModel):
    lead_uid: Optional[str] = None
    name: str
    industry: Optional[str] = None
    tier: str = "Enterprise"
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Decimal = Decimal("0.00")
    owner_id: Optional[str] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    tier: Optional[str] = None
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[Decimal] = None
    owner_id: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class AccountResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    name: str
    industry: Optional[str] = None
    tier: str
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Decimal
    owner_id: Optional[str] = None
    custom_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ContactCreate(BaseModel):
    lead_uid: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    full_name: str
    job_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    owner_id: Optional[str] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)


class ContactUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    owner_id: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class ContactResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    account_id: Optional[uuid.UUID] = None
    full_name: str
    job_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    owner_id: Optional[str] = None
    custom_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class DealCreate(BaseModel):
    lead_uid: Optional[str] = None
    title: str
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None
    stage: str = "تأهيل"
    amount: Decimal = Decimal("0.00")
    currency: str = "SAR"
    probability: int = 25
    expected_close_date: Optional[str] = None
    owner_id: Optional[str] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)


class DealUpdate(BaseModel):
    title: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    stage: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None
    owner_id: Optional[str] = None
    lost_reason: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class StageHistoryResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    deal_id: uuid.UUID
    lead_uid: Optional[str] = None
    from_stage: Optional[str] = None
    to_stage: str
    entered_at: datetime
    exited_at: Optional[datetime] = None
    dwell_seconds: int
    changed_by_user_id: Optional[str] = None


class DealResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    title: str
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None
    stage: str
    amount: Decimal
    currency: str
    probability: int
    expected_close_date: Optional[str] = None
    owner_id: Optional[str] = None
    lost_reason: Optional[str] = None
    custom_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ActivityCreate(BaseModel):
    lead_uid: Optional[str] = None
    activity_type: str = "task"
    title: str
    description: Optional[str] = None
    status: str = "قيد التنفيذ"
    priority: str = "متوسطة"
    due_date: Optional[str] = None
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    owner_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    owner_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class ActivityResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: Optional[str] = None
    activity_type: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[str] = None
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    owner_id: Optional[str] = None
    payload: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ============================================================================
# 4. Financial Cycle Schemas (ZATCA Phase 1: 15% VAT + TLV Base64 QR)
# ============================================================================


class QuoteCreate(BaseModel):
    quote_number: Optional[str] = None
    lead_uid: str = Field(..., description="المعرّف الموحد للعميل RWQ-xxxxx")
    title: str
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    status: str = "مسودة"
    currency: str = "SAR"
    line_items: List[FinancialLineItemInput] = Field(default_factory=list)
    valid_until: Optional[str] = None
    notes: Optional[str] = None


class QuoteUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    line_items: Optional[List[FinancialLineItemInput]] = None
    valid_until: Optional[str] = None
    notes: Optional[str] = None


class QuoteResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    quote_number: str
    lead_uid: str
    title: str
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    status: str
    currency: str
    line_items: List[Dict[str, Any]]
    subtotal_amount: Decimal
    discount_total: Decimal
    taxable_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    valid_until: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SalesOrderCreate(BaseModel):
    so_number: Optional[str] = None
    lead_uid: str
    title: str
    quote_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    status: str = "معتمد"
    currency: str = "SAR"
    line_items: List[FinancialLineItemInput] = Field(default_factory=list)


class SalesOrderUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    line_items: Optional[List[FinancialLineItemInput]] = None


class SalesOrderResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    so_number: str
    lead_uid: str
    title: str
    quote_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    status: str
    currency: str
    line_items: List[Dict[str, Any]]
    subtotal_amount: Decimal
    discount_total: Decimal
    taxable_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(BaseModel):
    invoice_number: Optional[str] = None
    lead_uid: str = Field(..., description="المعرّف الموحد للعميل RWQ-xxxxx")
    title: str
    sales_order_id: Optional[uuid.UUID] = None
    quote_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    touchpoint_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    customer_vat_number: Optional[str] = None
    seller_name: Optional[str] = None
    seller_vat_number: Optional[str] = None
    status: str = "صادرة"
    currency: str = "SAR"
    line_items: List[FinancialLineItemInput] = Field(default_factory=list)
    due_date: Optional[str] = None


class InvoiceUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None


class InvoiceResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    invoice_number: str
    lead_uid: str
    title: str
    sales_order_id: Optional[uuid.UUID] = None
    quote_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    customer_name: str
    customer_company: Optional[str] = None
    customer_vat_number: Optional[str] = None
    seller_name: str
    seller_vat_number: str
    status: str
    currency: str
    line_items: List[Dict[str, Any]]
    subtotal_amount: Decimal
    discount_total: Decimal
    taxable_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    zatca_tlv_base64: str
    issued_at: datetime
    due_date: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OrderAttributionResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    touchpoint_id: Optional[uuid.UUID] = None
    deal_id: Optional[uuid.UUID] = None
    sales_order_id: Optional[uuid.UUID] = None
    invoice_id: Optional[uuid.UUID] = None
    purchase_sequence: int
    attribution_model: str
    attribution_weight: Decimal
    attributed_revenue: Decimal
    channel: str
    campaign_name: Optional[str] = None
    ad_id: Optional[str] = None
    created_at: datetime


# ============================================================================
# 5. Recycle Bin Schemas
# ============================================================================


class RecycleBinEntryResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    title: str
    lead_uid: Optional[str] = None
    deleted_at: datetime
    deleted_by: Optional[str] = None


class RecycleBinRestoreRequest(BaseModel):
    entity_type: str = Field(
        ...,
        pattern="^(lead|account|contact|deal|quote|sales_order|invoice|activity)$",
    )
    entity_id: uuid.UUID


# ============================================================================
# 6. Phase 3 Schemas:
#    - WhatsApp Cloud API & WebSocket Messages
#    - Meta CAPI Events Log
#    - Blueprint Stage Transition + Bottleneck Analytics + Workflows
#    - Background CSV Import
# ============================================================================


class WhatsAppSendRequest(BaseModel):
    phone_number: str = Field(..., min_length=6)
    contact_name: Optional[str] = None
    lead_uid: Optional[str] = Field(default=None, description="RWQ-xxxxx")
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    message_type: str = Field(default="text", pattern="^(text|image|document|audio|template)$")
    body: str = Field(..., min_length=1)
    media_url: Optional[str] = None
    template_name: Optional[str] = None
    template_language: str = "ar"


class WhatsAppMessageResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    lead_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    phone_number: str
    contact_name: Optional[str] = None
    direction: str
    message_type: str
    body: str
    media_url: Optional[str] = None
    wamid: Optional[str] = None
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    created_at: datetime
    updated_at: datetime


class CapiEventLogResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    lead_uid: str
    event_name: str
    event_id: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    value: Decimal
    currency: str
    hashed_email: Optional[str] = None
    hashed_phone: Optional[str] = None
    status: str
    attempts: int
    response_payload: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DealStageTransitionRequest(BaseModel):
    to_stage: str = Field(..., min_length=1)
    amount: Optional[Decimal] = None
    probability: Optional[int] = None
    lost_reason: Optional[str] = None
    review_notes: Optional[str] = None
    next_step: Optional[str] = None
    discount_percent: Optional[Decimal] = None
    contract_pdf_url: Optional[str] = None
    checklist_completed: List[str] = Field(default_factory=list)
    during_fields: Dict[str, Any] = Field(default_factory=dict)
    auto_generate_sales_order: bool = False


class DealStageTransitionResponse(BaseModel):
    deal: DealResponse
    from_stage: str
    to_stage: str
    previous_stage_dwell_seconds: int
    stage_history_id: uuid.UUID
    triggered_after_actions: List[Dict[str, Any]] = Field(default_factory=list)
    triggered_workflow_rules: List[str] = Field(default_factory=list)
    capi_purchase_queued: bool = False


class StageBottleneckMetric(BaseModel):
    stage: str
    transitions_count: int
    avg_dwell_seconds: float
    avg_dwell_hours: float
    max_dwell_seconds: int
    bottleneck_severity: str  # normal | warning | critical


class StageBottlenecksReportResponse(BaseModel):
    org_id: uuid.UUID
    total_tracked_transitions: int
    most_congested_stage: Optional[str] = None
    stages: List[StageBottleneckMetric]


class BlueprintTransitionCreate(BaseModel):
    name: str
    from_stage: str
    to_stage: str
    before_rules: Dict[str, Any] = Field(default_factory=dict)
    during_required_fields: List[str] = Field(default_factory=list)
    after_actions: List[Dict[str, Any]] = Field(default_factory=list)
    sla_hours: int = 48


class BlueprintCreate(BaseModel):
    name: str
    module: str = "deals"
    field_name: str = "stage"
    description: Optional[str] = None
    is_active: bool = True
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    transitions: List[BlueprintTransitionCreate] = Field(default_factory=list)


class BlueprintResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    module: str
    field_name: str
    description: Optional[str] = None
    is_active: bool
    stages: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class WorkflowRuleCreate(BaseModel):
    code: str
    name: str
    module: str = "deals"
    trigger_type: str = "on_stage_change"
    conditions: List[Dict[str, Any]] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class WorkflowRuleResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    code: str
    name: str
    module: str
    trigger_type: str
    conditions: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    is_active: bool
    executions_count: int
    created_at: datetime
    updated_at: datetime


class WorkflowLogResponse(ORMBaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    rule_id: Optional[uuid.UUID] = None
    blueprint_transition_id: Optional[uuid.UUID] = None
    module: str
    record_id: str
    lead_uid: Optional[str] = None
    action_type: str
    status: str
    details: Dict[str, Any]
    executed_at: datetime


class CsvImportJobResponse(BaseModel):
    job_id: str
    status: str  # queued | processing | completed | failed
    org_id: uuid.UUID
    total_rows: int
    imported_count: int = 0
    skipped_duplicates: int = 0
    errors: List[str] = Field(default_factory=list)
    queued_via_arq: bool = False


# ============================================================================
# 7. Phase 4 Schemas:
#    - Unified Payment Gateway (Moyasar / Tap / Stripe) & Quotas
#    - Transactional SMTP Emails via ARQ
#    - Platform Owner Dashboard (Super Admin)
# ============================================================================


class BillingCheckoutRequest(BaseModel):
    provider: str = Field(
        default="moyasar",
        pattern="^(moyasar|tap|stripe)$",
        description="بوابة الدفع: moyasar | tap | stripe",
    )
    plan_tier: str = Field(
        default="Growth",
        pattern="^(Free|Growth|Enterprise|Starter|Pro)$",
    )
    billing_cycle: str = Field(default="monthly", pattern="^(monthly|yearly)$")
    Seats: Optional[int] = Field(default=None, alias="seats")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class BillingCheckoutResponse(BaseModel):
    session_id: str
    provider: str
    plan_tier: str
    billing_cycle: str
    amount_sar: Decimal
    currency: str = "SAR"
    checkout_url: str
    status: str
    org_id: uuid.UUID
    payment_status: str


class SmtpEmailRequest(BaseModel):
    template_type: str = Field(
        default="employee_invite",
        pattern="^(employee_invite|invoice_notification|password_reset)$",
    )
    to_email: EmailStr
    recipient_name: str = Field(default="عميل Crm-One-step")
    subject: Optional[str] = None
    organization_name: Optional[str] = None
    inviter_name: Optional[str] = None
    role_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_total: Optional[str] = None
    lead_uid: Optional[str] = None
    reset_token_url: Optional[str] = None


class SmtpEmailResponse(BaseModel):
    job_id: str
    status: str
    template_type: str
    to_email: str
    queued_via_arq: bool
    message: str


class SuperAdminOrganizationSummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    vat_number: str
    base_currency: str
    plan_tier: str
    seat_limit: int
    users_count: int
    customers_count: int
    payment_status: str
    billing_provider: Optional[str] = None
    subscription_id: Optional[str] = None
    is_active: bool
    created_at: datetime


class SuperAdminOrganizationUpdateRequest(BaseModel):
    plan_tier: Optional[str] = None
    seat_limit: Optional[int] = Field(default=None, ge=1)
    payment_status: Optional[str] = None
    is_active: Optional[bool] = None

