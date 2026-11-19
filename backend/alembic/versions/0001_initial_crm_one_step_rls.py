"""Initial Crm-One-step Schema with PostgreSQL Row-Level Security (RLS), Unified RWQ-xxxxx ID, Attribution & ZATCA Phase 1

Revision ID: 0001_initial_crm_one_step_rls
Revises: 
Create Date: 2026-11-19 02:18:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_crm_one_step_rls"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RLS_TABLES = [
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
]


def upgrade() -> None:
    # 1. Organizations (Root Tenant Table)
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("vat_number", sa.String(length=32), nullable=False, server_default="310122393500003"),
        sa.Column("cr_number", sa.String(length=32), nullable=True),
        sa.Column("base_currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("plan_tier", sa.String(length=50), nullable=False, server_default="Enterprise"),
        sa.Column("seat_limit", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("settings_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    # 2. Roles
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("parent_role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("data_sharing_scope", sa.String(length=64), nullable=False, server_default="team_and_subordinates"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_roles_org_id", "roles", ["org_id"])
    op.create_index("ix_roles_code", "roles", ["code"])

    # 3. Profiles (permissions as JSONB)
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_profiles_org_id", "profiles", ["org_id"])
    op.create_index("ix_profiles_code", "profiles", ["code"])

    # 4. Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_org_id", "users", ["org_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # 5. Leads (with permanent unified customer ID RWQ-xxxxx & Soft Delete)
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=False, server_default="موقع إلكتروني"),
        sa.Column("status", sa.String(length=80), nullable=False, server_default="جديد"),
        sa.Column("score", sa.Integer(), nullable=False, server_default="65"),
        sa.Column("estimated_value", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("owner_id", sa.String(length=100), nullable=True),
        sa.Column("campaign_name", sa.String(length=255), nullable=True),
        sa.Column("ad_id", sa.String(length=120), nullable=True),
        sa.Column("utm_source", sa.String(length=120), nullable=True),
        sa.Column("utm_medium", sa.String(length=120), nullable=True),
        sa.Column("utm_campaign", sa.String(length=255), nullable=True),
        sa.Column("is_converted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("converted_contact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("converted_deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("custom_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_leads_org_id", "leads", ["org_id"])
    op.create_index("ix_leads_lead_uid", "leads", ["lead_uid"])
    op.create_index("ix_leads_org_lead_uid", "leads", ["org_id", "lead_uid"])
    op.create_index("ix_leads_deleted_at", "leads", ["deleted_at"])

    # 6. Accounts
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("tier", sa.String(length=50), nullable=False, server_default="Enterprise"),
        sa.Column("vat_number", sa.String(length=32), nullable=True),
        sa.Column("cr_number", sa.String(length=32), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("annual_revenue", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("owner_id", sa.String(length=100), nullable=True),
        sa.Column("custom_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_accounts_org_id", "accounts", ["org_id"])
    op.create_index("ix_accounts_lead_uid", "accounts", ["lead_uid"])
    op.create_index("ix_accounts_deleted_at", "accounts", ["deleted_at"])

    # 7. Contacts
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("owner_id", sa.String(length=100), nullable=True),
        sa.Column("custom_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_contacts_org_id", "contacts", ["org_id"])
    op.create_index("ix_contacts_lead_uid", "contacts", ["lead_uid"])
    op.create_index("ix_contacts_deleted_at", "contacts", ["deleted_at"])

    # 8. Deals
    op.create_table(
        "deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stage", sa.String(length=100), nullable=False, server_default="تأهيل"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("probability", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("expected_close_date", sa.String(length=32), nullable=True),
        sa.Column("owner_id", sa.String(length=100), nullable=True),
        sa.Column("lost_reason", sa.Text(), nullable=True),
        sa.Column("custom_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_deals_org_id", "deals", ["org_id"])
    op.create_index("ix_deals_lead_uid", "deals", ["lead_uid"])
    op.create_index("ix_deals_stage", "deals", ["stage"])
    op.create_index("ix_deals_deleted_at", "deals", ["deleted_at"])

    # 9. Activities
    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=True),
        sa.Column("activity_type", sa.String(length=50), nullable=False, server_default="task"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="قيد التنفيذ"),
        sa.Column("priority", sa.String(length=32), nullable=False, server_default="متوسطة"),
        sa.Column("due_date", sa.String(length=40), nullable=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_id", sa.String(length=100), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_activities_org_id", "activities", ["org_id"])
    op.create_index("ix_activities_lead_uid", "activities", ["lead_uid"])
    op.create_index("ix_activities_deleted_at", "activities", ["deleted_at"])

    # 10. Touchpoints (سجل تكرار الزيارات ونقاط الدخول)
    op.create_table(
        "touchpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=80), nullable=False),
        sa.Column("campaign_name", sa.String(length=255), nullable=True),
        sa.Column("ad_id", sa.String(length=120), nullable=True),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_touchpoints_org_id", "touchpoints", ["org_id"])
    op.create_index("ix_touchpoints_lead_uid", "touchpoints", ["lead_uid"])

    # 11. Stage History (سجل مدة بقاء المراحل لقياس اختناقات البلوبرينت)
    op.create_table(
        "stage_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=True),
        sa.Column("from_stage", sa.String(length=100), nullable=True),
        sa.Column("to_stage", sa.String(length=100), nullable=False),
        sa.Column("entered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dwell_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("changed_by_user_id", sa.String(length=100), nullable=True),
    )
    op.create_index("ix_stage_history_org_id", "stage_history", ["org_id"])
    op.create_index("ix_stage_history_deal_id", "stage_history", ["deal_id"])

    # 12. Quotes
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quote_number", sa.String(length=64), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("customer_company", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="مسودة"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("line_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("subtotal_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_total", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="15.00"),
        sa.Column("vat_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("valid_until", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_quotes_org_id", "quotes", ["org_id"])
    op.create_index("ix_quotes_lead_uid", "quotes", ["lead_uid"])

    # 13. Sales Orders
    op.create_table(
        "sales_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("so_number", sa.String(length=64), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("customer_company", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="معتمد"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("line_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("subtotal_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_total", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="15.00"),
        sa.Column("vat_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sales_orders_org_id", "sales_orders", ["org_id"])
    op.create_index("ix_sales_orders_lead_uid", "sales_orders", ["lead_uid"])

    # 14. Invoices (ZATCA Phase 1: 15% VAT + TLV Base64 QR)
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_number", sa.String(length=64), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("sales_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("customer_company", sa.String(length=255), nullable=True),
        sa.Column("customer_vat_number", sa.String(length=32), nullable=True),
        sa.Column("seller_name", sa.String(length=255), nullable=False, server_default="Crm-One-step Enterprise"),
        sa.Column("seller_vat_number", sa.String(length=32), nullable=False, server_default="310122393500003"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="صادرة"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="SAR"),
        sa.Column("line_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("subtotal_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_total", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="15.00"),
        sa.Column("vat_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("zatca_tlv_base64", sa.Text(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("due_date", sa.String(length=40), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_invoices_org_id", "invoices", ["org_id"])
    op.create_index("ix_invoices_lead_uid", "invoices", ["lead_uid"])

    # 15. Order Attributions (إسناد المشتريات المتعددة 10+ مرات مرتبط بـ lead_uid و touchpoint_id)
    op.create_table(
        "order_attributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_uid", sa.String(length=32), nullable=False),
        sa.Column("touchpoint_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("touchpoints.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sales_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True),
        sa.Column("purchase_sequence", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("attribution_model", sa.String(length=64), nullable=False, server_default="multi_touch_w_shaped"),
        sa.Column("attribution_weight", sa.Numeric(5, 2), nullable=False, server_default="100.00"),
        sa.Column("attributed_revenue", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("channel", sa.String(length=80), nullable=False, server_default="Direct"),
        sa.Column("campaign_name", sa.String(length=255), nullable=True),
        sa.Column("ad_id", sa.String(length=120), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_order_attributions_org_id", "order_attributions", ["org_id"])
    op.create_index("ix_order_attributions_lead_uid", "order_attributions", ["lead_uid"])
    op.create_index("ix_order_attributions_touchpoint_id", "order_attributions", ["touchpoint_id"])

    # =========================================================================
    # Enable PostgreSQL Row-Level Security (RLS) on all operational tables
    # =========================================================================
    for table_name in RLS_TABLES:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table_name}
            USING (org_id = current_setting('app.current_org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
            """
        )


def downgrade() -> None:
    for table_name in reversed(RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table_name};")
        op.execute(f"ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;")
        op.drop_table(table_name)

    op.drop_table("organizations")
