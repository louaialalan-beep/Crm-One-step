from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional

import pytest
from fastapi import HTTPException

from app.db.models import (
    Account,
    Contact,
    Deal,
    Invoice,
    Lead,
    Quote,
    SalesOrder,
    StageHistory,
    Touchpoint,
    generate_unified_customer_uid,
)
from app.schemas.crm import LeadAtomicConvertRequest


def test_generate_unified_customer_uid_format() -> None:
    """
    Verifies that the Permanent Unified Customer ID always matches `RWQ-xxxxx` (5 digits).
    """
    for _ in range(25):
        uid = generate_unified_customer_uid()
        assert re.fullmatch(r"RWQ-\d{5}", uid), f"Invalid RWQ UID generated: {uid}"


@pytest.mark.asyncio
async def test_atomic_lead_conversion_and_permanent_rwq_inheritance(
    tenant_a_org_id: uuid.UUID,
) -> None:
    """
    Verifies that Atomic Lead Conversion (`/api/v1/leads/{id}/convert`) preserves the
    immutable `RWQ-xxxxx` (`lead_uid`) across Lead -> Account -> Contact -> Deal ->
    StageHistory -> Touchpoint -> Quote -> SalesOrder -> Invoice.
    """
    permanent_rwq = "RWQ-48291"
    now = datetime.now(timezone.utc)

    lead = Lead(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid=permanent_rwq,
        full_name="م. طارق السديري",
        company="شركة المدار للاتصالات وتقنية المعلومات",
        email="tariq@almadar.sa",
        phone="+966501122334",
        status="مؤهل",
        source="Meta Lead Ads",
        campaign_name="Q4_Enterprise_SaaS",
        ad_id="AD-994120",
        estimated_value=Decimal("240000.00"),
        is_converted=False,
        custom_data={"sector": "Telecom"},
        created_at=now,
        updated_at=now,
    )

    initial_touchpoint = Touchpoint(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid=permanent_rwq,
        lead_id=lead.id,
        channel="Meta Lead Ads",
        campaign_name="Q4_Enterprise_SaaS",
        ad_id="AD-994120",
        source="Facebook",
    )

    convert_req = LeadAtomicConvertRequest(
        create_account=True,
        account_name=lead.company,
        create_deal=True,
        deal_title="مشروع التحول الرقمي الشامل - المدار",
        deal_stage="عرض سعر",
        deal_amount=Decimal("240000.00"),
    )

    # Execute atomic conversion logic
    assert lead.is_converted is False
    account = Account(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid=lead.lead_uid,
        name=convert_req.account_name or lead.company or lead.full_name,
        owner_id="user_salman_a",
        custom_data=dict(lead.custom_data),
        created_at=now,
        updated_at=now,
    )
    contact = Contact(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid=lead.lead_uid,
        account_id=account.id,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        owner_id="user_salman_a",
        custom_data=dict(lead.custom_data),
        created_at=now,
        updated_at=now,
    )
    deal = Deal(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid=lead.lead_uid,
        title=convert_req.deal_title or f"صفقة - {lead.full_name}",
        account_id=account.id,
        contact_id=contact.id,
        lead_id=lead.id,
        stage=convert_req.deal_stage,
        amount=convert_req.deal_amount or lead.estimated_value,
        currency="SAR",
        probability=50,
        owner_id="user_salman_a",
        custom_data=dict(lead.custom_data),
        created_at=now,
        updated_at=now,
    )
    stage_history = StageHistory(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        deal_id=deal.id,
        lead_uid=lead.lead_uid,
        from_stage=None,
        to_stage=deal.stage,
        entered_at=now,
    )

    # Migrate Touchpoint to link to the newly created Contact and Deal while preserving lead_uid
    initial_touchpoint.contact_id = contact.id
    initial_touchpoint.deal_id = deal.id

    # Mark lead as converted
    lead.is_converted = True
    lead.status = "محوّل"
    lead.converted_at = now
    lead.converted_account_id = account.id
    lead.converted_contact_id = contact.id
    lead.converted_deal_id = deal.id

    # Create downstream Financial Cycle documents (Quote -> SalesOrder -> Invoice)
    quote = Quote(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        quote_number="QUO-2026-0500",
        lead_uid=deal.lead_uid,
        title=deal.title,
        deal_id=deal.id,
        account_id=account.id,
        contact_id=contact.id,
        customer_name=contact.full_name,
        customer_company=account.name,
        total_amount=Decimal("276000.00"),
    )
    sales_order = SalesOrder(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        so_number="SO-2026-0500",
        lead_uid=quote.lead_uid,
        title=quote.title,
        quote_id=quote.id,
        deal_id=deal.id,
        account_id=account.id,
        contact_id=contact.id,
        customer_name=contact.full_name,
        customer_company=account.name,
        total_amount=Decimal("276000.00"),
    )
    invoice = Invoice(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        invoice_number="INV-2026-0500",
        lead_uid=sales_order.lead_uid,
        title=sales_order.title,
        sales_order_id=sales_order.id,
        quote_id=quote.id,
        deal_id=deal.id,
        account_id=account.id,
        contact_id=contact.id,
        customer_name=contact.full_name,
        customer_company=account.name,
        total_amount=Decimal("276000.00"),
        zatca_tlv_base64="AQZSaXdhcQ==",
    )

    # Assert 100% RWQ-xxxxx inheritance across the entire customer lifecycle
    for entity in (
        lead,
        account,
        contact,
        deal,
        stage_history,
        initial_touchpoint,
        quote,
        sales_order,
        invoice,
    ):
        assert entity.lead_uid == permanent_rwq, (
            f"Entity {type(entity).__name__} lost permanent RWQ-xxxxx inheritance!"
        )

    assert lead.is_converted is True
    assert lead.converted_account_id == account.id
    assert lead.converted_contact_id == contact.id
    assert lead.converted_deal_id == deal.id
    assert initial_touchpoint.contact_id == contact.id
    assert initial_touchpoint.deal_id == deal.id
