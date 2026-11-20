from __future__ import annotations

import uuid
from decimal import Decimal
from pathlib import Path

import pytest

from app.db.models import (
    TENANT_SCOPED_TABLES,
    Account,
    Base,
    Contact,
    Deal,
    EmailMessage,
    Invoice,
    Lead,
    Quote,
    SalesOrder,
    Touchpoint,
    WhatsappMessage,
)
from tests.conftest import InMemoryRlsSession


def test_all_operational_tables_have_org_id_and_are_in_rls_list() -> None:
    """
    Verifies that every operational CRM table includes a non-nullable `org_id` UUID column
    and is registered in `TENANT_SCOPED_TABLES` for PostgreSQL Row-Level Security (RLS).
    """
    expected_tables = {
        "users",
        "roles",
        "profiles",
        "custom_fields",
        "leads",
        "accounts",
        "contacts",
        "deals",
        "activities",
        "touchpoints",
        "stage_history",
        "quotes",
        "sales_orders",
        "invoices",
        "order_attributions",
        "whatsapp_messages",
        "capi_events_log",
        "blueprints",
        "blueprint_transitions",
        "workflow_rules",
        "workflow_logs",
        "email_messages",
    }
    registered_set = set(TENANT_SCOPED_TABLES)
    assert expected_tables.issubset(registered_set)

    for table_name in expected_tables:
        sa_table = Base.metadata.tables.get(table_name)
        assert sa_table is not None, f"Missing table {table_name} in SQLAlchemy metadata"
        assert "org_id" in sa_table.columns, f"Table {table_name} must have an org_id column"
        assert sa_table.columns["org_id"].nullable is False, (
            f"Table {table_name}.org_id must be NOT NULL for strict RLS enforcement"
        )


def test_alembic_migrations_enforce_postgresql_rls_policies() -> None:
    """
    Verifies that the Alembic migrations explicitly execute `ENABLE ROW LEVEL SECURITY`,
    `FORCE ROW LEVEL SECURITY`, and `CREATE POLICY ... current_setting('app.current_org_id', true)::uuid`.
    """
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    migration_0001 = (versions_dir / "0001_initial_schema_and_rls.py").read_text(encoding="utf-8")
    migration_0004 = (versions_dir / "0004_phase5_email_messages_rls.py").read_text(encoding="utf-8")

    assert "ENABLE ROW LEVEL SECURITY" in migration_0001
    assert "FORCE ROW LEVEL SECURITY" in migration_0001
    assert "current_setting('app.current_org_id', true)::uuid" in migration_0001

    assert "ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY" in migration_0004
    assert "CREATE POLICY tenant_isolation_policy_email_messages" in migration_0004


@pytest.mark.asyncio
async def test_rls_strictly_isolates_tenant_a_from_tenant_b(
    tenant_a_org_id: uuid.UUID,
    tenant_b_org_id: uuid.UUID,
) -> None:
    """
    Verifies that under PostgreSQL RLS context (`SET LOCAL app.current_org_id`),
    Tenant A cannot read, list, or cross-insert records belonging to Tenant B.
    """
    rls_db = InMemoryRlsSession(active_org_id=tenant_a_org_id)
    rls_db.set_tenant_context(tenant_a_org_id)

    lead_a = Lead(
        org_id=tenant_a_org_id,
        lead_uid="RWQ-10101",
        full_name="عبدالله الراجحي - مستأجر أ",
        company="شركة أفق الرياض",
        status="جديد",
        source="Meta Lead Ads",
        estimated_value=Decimal("120000.00"),
    )
    invoice_a = Invoice(
        org_id=tenant_a_org_id,
        invoice_number="INV-2026-0101",
        lead_uid="RWQ-10101",
        title="فاتورة ترخيص أفق الرياض",
        customer_name="عبدالله الراجحي",
        total_amount=Decimal("138000.00"),
        zatca_tlv_base64="AQZSaXdhcQ==",
    )
    rls_db.add(lead_a)
    rls_db.add(invoice_a)
    await rls_db.flush()

    # Switch session RLS GUC to Tenant B
    rls_db.set_tenant_context(tenant_b_org_id)

    # Tenant B must see 0 records from Tenant A
    assert rls_db.query_visible(Lead) == []
    assert rls_db.query_visible(Invoice) == []

    # Tenant B creates its own Lead and EmailMessage
    lead_b = Lead(
        org_id=tenant_b_org_id,
        lead_uid="RWQ-20202",
        full_name="سلطان العتيبي - مستأجر ب",
        company="مجموعة الخليج الرقمية",
        status="مؤهل",
        source="WhatsApp",
        estimated_value=Decimal("85000.00"),
    )
    email_b = EmailMessage(
        org_id=tenant_b_org_id,
        lead_uid="RWQ-20202",
        direction="inbound",
        from_address="sultan@gulf.sa",
        to_address="sales@tenant-b.sa",
        subject="طلب عرض سعر",
        body_text="نرغب في عرض سعر متكامل",
    )
    rls_db.add(lead_b)
    rls_db.add(email_b)
    await rls_db.flush()

    visible_b_leads = rls_db.query_visible(Lead)
    assert len(visible_b_leads) == 1
    assert visible_b_leads[0].lead_uid == "RWQ-20202"

    # Attempting to insert a record with Tenant A's org_id while connected as Tenant B must fail RLS WITH CHECK
    with pytest.raises(PermissionError, match="PostgreSQL RLS WITH CHECK violation"):
        rls_db.add(
            Deal(
                org_id=tenant_a_org_id,
                lead_uid="RWQ-10101",
                title="محاولة اختراق عزل المستأجرين",
                stage="تأهيل",
                amount=Decimal("50000.00"),
            )
        )

    # Switching back to Tenant A only reveals Tenant A's records
    rls_db.set_tenant_context(tenant_a_org_id)
    visible_a_leads = rls_db.query_visible(Lead)
    assert len(visible_a_leads) == 1
    assert visible_a_leads[0].lead_uid == "RWQ-10101"
    assert rls_db.query_visible(EmailMessage) == []
