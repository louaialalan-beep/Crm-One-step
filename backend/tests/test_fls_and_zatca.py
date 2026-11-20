from __future__ import annotations

import base64
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.permissions import (
    PermissionContext,
    apply_fls_to_response,
    can_access_record,
    enforce_fls_on_write,
    enforce_module_permission,
    enforce_record_access,
    filter_records_by_data_sharing,
)
from app.core.zatca import FinancialLineItemInput, calculate_zatca_financials
from app.schemas.crm import LeadResponse
from app.services.zatca_phase2 import (
    ZATCA_GENESIS_PIH,
    build_csid_onboarding_structure,
    compute_zatca_invoice_hash,
    process_zatca_phase2_submission,
    sign_zatca_invoice_ecdsa,
)


# ============================================================================
# 1. Server-Side Profile FLS & Data Sharing Enforcement Tests
# ============================================================================


def test_module_crud_permissions_enforcement(sales_rep_perm_context: PermissionContext) -> None:
    """
    Verifies that `enforce_module_permission` permits allowed CRUD actions and raises
    HTTP 403 Forbidden when an action (such as `delete`) is disabled in the user's Profile.
    """
    # Read, Create, Update are allowed for sales_rep on leads
    enforce_module_permission(sales_rep_perm_context, "leads", "read")
    enforce_module_permission(sales_rep_perm_context, "leads", "create")
    enforce_module_permission(sales_rep_perm_context, "leads", "update")

    # Delete is explicitly disabled (`False`) -> must raise 403
    with pytest.raises(HTTPException) as exc_info:
        enforce_module_permission(sales_rep_perm_context, "leads", "delete")
    assert exc_info.value.status_code == 403


def test_fls_blocks_writes_to_readonly_and_hidden_fields(
    sales_rep_perm_context: PermissionContext,
) -> None:
    """
    Verifies that `enforce_fls_on_write` rejects payload updates containing fields
    marked `read_only` (e.g. `estimated_value` / `amount`) or `hidden` (e.g. `phone`, `internalCost`).
    """
    # Updating allowed fields succeeds
    safe_patch = enforce_fls_on_write(
        sales_rep_perm_context,
        "leads",
        {"full_name": "عميل محدث", "status": "مؤهل"},
    )
    assert safe_patch["status"] == "مؤهل"

    # Attempting to modify `estimated_value` (aliased to `estimatedValue: read_only`) must raise 403
    with pytest.raises(HTTPException) as exc_ro:
        enforce_fls_on_write(
            sales_rep_perm_context,
            "leads",
            {"estimated_value": Decimal("999999.00")},
        )
    assert exc_ro.value.status_code == 403

    # Attempting to modify `internalCost` inside `custom_data` (`hidden`) must raise 403
    with pytest.raises(HTTPException) as exc_hidden:
        enforce_fls_on_write(
            sales_rep_perm_context,
            "leads",
            {"custom_data": {"internalCost": 45000}},
        )
    assert exc_hidden.value.status_code == 403


def test_fls_masks_hidden_fields_on_api_response(
    sales_rep_perm_context: PermissionContext,
    tenant_a_org_id: uuid.UUID,
) -> None:
    """
    Verifies that `apply_fls_to_response` strips or masks `hidden` fields (`phone`, `internalCost`)
    from Pydantic responses while keeping `read_only` fields (`estimated_value`) readable.
    """
    now = datetime.now(timezone.utc)
    lead_resp = LeadResponse(
        id=uuid.uuid4(),
        org_id=tenant_a_org_id,
        lead_uid="RWQ-77123",
        full_name="سعد القحطاني",
        company="شركة النخبة",
        email="saad@elite.sa",
        phone="+966551234567",
        status="جديد",
        source="WhatsApp",
        lead_score=85,
        estimated_value=Decimal("150000.00"),
        owner_id="rep_01",
        is_converted=False,
        custom_data={"internalCost": "90000", "publicTag": "VIP"},
        created_at=now,
        updated_at=now,
    )

    masked = apply_fls_to_response(sales_rep_perm_context, "leads", lead_resp)
    # `phone` is marked `hidden` in sales_rep_perm_context -> masked to None
    assert masked.phone is None
    # `internalCost` in custom_data is `hidden` -> stripped from custom_data
    assert "internalCost" not in masked.custom_data
    assert masked.custom_data.get("publicTag") == "VIP"
    # `estimated_value` is `read_only` -> remains visible on read
    assert masked.estimated_value == Decimal("150000.00")


def test_data_sharing_scope_enforcement(sales_rep_perm_context: PermissionContext) -> None:
    """
    Verifies that under `private` Data Sharing scope, a user can only access their own records
    and receives HTTP 403 Forbidden when accessing records owned by another user.
    """
    assert can_access_record(sales_rep_perm_context, "rep_01") is True
    assert can_access_record(sales_rep_perm_context, "فهد الدوسري") is True
    assert can_access_record(sales_rep_perm_context, "other_rep_99") is False

    with pytest.raises(HTTPException) as exc_info:
        enforce_record_access(sales_rep_perm_context, "other_rep_99", action="read")
    assert exc_info.value.status_code == 403

    class DummyRecord:
        def __init__(self, rec_id: str, owner_id: str) -> None:
            self.id = rec_id
            self.owner_id = owner_id

    records = [
        DummyRecord("1", "rep_01"),
        DummyRecord("2", "other_rep_99"),
        DummyRecord("3", "فهد الدوسري"),
    ]
    visible = filter_records_by_data_sharing(sales_rep_perm_context, records)
    assert [r.id for r in visible] == ["1", "3"]


# ============================================================================
# 2. ZATCA Phase 1 (15% VAT + 5-Tag TLV QR) & Phase 2 (UBL 2.1 XML + Hash + ECDSA)
# ============================================================================


def test_zatca_phase1_15_percent_vat_and_tlv_qr() -> None:
    """
    Verifies exact 15% VAT calculation with discounts and ZATCA Phase 1 5-Tag TLV Base64 QR encoding.
    """
    items = [
        FinancialLineItemInput(
            id="li_1",
            name="ترخيص منصة Crm-One-step Enterprise",
            quantity=Decimal("2"),
            unit_price=Decimal("50000.00"),
            discount_type="percentage",
            discount_value=Decimal("10.00"),  # 10% of 100,000 = 10,000 discount -> 90,000 net
            vat_rate=Decimal("15.00"),
        ),
        FinancialLineItemInput(
            id="li_2",
            name="ربط WhatsApp Cloud API و Meta CAPI",
            quantity=Decimal("1"),
            unit_price=Decimal("15000.00"),
            discount_type="amount",
            discount_value=Decimal("5000.00"),  # 5,000 discount -> 10,000 net
            vat_rate=Decimal("15.00"),
        ),
    ]

    totals = calculate_zatca_financials(
        line_items=items,
        seller_name="شركة رواق لتقنية المعلومات",
        seller_vat_number="310122393500003",
        issued_at=datetime(2026, 11, 20, 10, 30, 0, tzinfo=timezone.utc),
    )

    assert totals.subtotal_amount == Decimal("115000.00")
    assert totals.discount_total == Decimal("15000.00")
    assert totals.taxable_amount == Decimal("100000.00")
    assert totals.vat_rate == Decimal("15.00")
    assert totals.vat_amount == Decimal("15000.00")
    assert totals.total_amount == Decimal("115000.00")

    # Decode TLV Base64 and verify Tags 1..5
    raw_tlv = base64.b64decode(totals.zatca_tlv_base64)
    idx = 0
    tags_found = {}
    while idx < len(raw_tlv):
        tag = raw_tlv[idx]
        length = raw_tlv[idx + 1]
        val = raw_tlv[idx + 2 : idx + 2 + length].decode("utf-8")
        tags_found[tag] = val
        idx += 2 + length

    assert tags_found[1] == "شركة رواق لتقنية المعلومات"
    assert tags_found[2] == "310122393500003"
    assert tags_found[4] == "115000.00"
    assert tags_found[5] == "15000.00"


def test_zatca_phase2_ubl21_xml_hash_ecdsa_and_clearance_reporting() -> None:
    """
    Verifies ZATCA Phase 2:
    1. Well-formed UBL 2.1 XML generation with required ZATCA elements.
    2. Deterministic SHA-256 Invoice Hash (`zatca_hash`) & ECDSA Digital Signature (`zatca_signature`).
    3. B2B Tax Invoice Clearance (`CLEARANCE` -> `CLEARED`, subtype `0100000`) vs
       Simplified B2C Tax Invoice Reporting (`REPORTING` -> `REPORTED`, subtype `0200000`).
    4. CSID Onboarding structure for Sandbox & Production.
    """
    issued_ts = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)

    # 1. B2B Standard Tax Invoice (Clearance)
    b2b_artifact = process_zatca_phase2_submission(
        invoice_number="INV-2026-0901",
        invoice_uuid="550e8400-e29b-41d4-a716-446655440901",
        issued_at=issued_ts,
        seller_name="شركة رواق لتقنية المعلومات",
        seller_vat_number="310122393500003",
        customer_name="شركة المدار للاتصالات",
        customer_vat_number="300948192000003",
        currency="SAR",
        line_items=[
            {
                "id": "1",
                "name": "اشتراك سنوي CRM Enterprise",
                "quantity": 1,
                "unit_price": 100000.00,
                "discount_type": "amount",
                "discount_value": 0,
                "vat_rate": 15.00,
            }
        ],
        subtotal_amount=Decimal("100000.00"),
        discount_total=Decimal("0.00"),
        taxable_amount=Decimal("100000.00"),
        vat_rate=Decimal("15.00"),
        vat_amount=Decimal("15000.00"),
        total_amount=Decimal("115000.00"),
        submission_mode="AUTO",
        environment="SANDBOX",
    )

    assert b2b_artifact.submission_type == "CLEARANCE"
    assert b2b_artifact.invoice_subtype_code == "0100000"
    assert b2b_artifact.zatca_status == "CLEARED"
    assert b2b_artifact.zatca_pih == ZATCA_GENESIS_PIH
    assert len(base64.b64decode(b2b_artifact.zatca_hash)) == 32  # SHA-256 is 32 bytes
    assert len(b2b_artifact.zatca_signature) > 40

    # Parse generated UBL 2.1 XML to ensure strict XML well-formedness & ZATCA nodes
    root = ET.fromstring(b2b_artifact.xml_content)
    assert root.tag.endswith("Invoice")
    assert "reporting:1.0" in b2b_artifact.xml_content
    assert 'name="0100000">388<' in b2b_artifact.xml_content
    assert b2b_artifact.zatca_hash in b2b_artifact.xml_content
    assert b2b_artifact.zatca_signature in b2b_artifact.xml_content

    # 2. Simplified B2C Tax Invoice (Reporting) chained via PIH to the first invoice's hash
    b2c_artifact = process_zatca_phase2_submission(
        invoice_number="INV-2026-0902",
        issued_at=issued_ts,
        seller_name="شركة رواق لتقنية المعلومات",
        seller_vat_number="310122393500003",
        customer_name="عميل فردي B2C",
        customer_vat_number=None,
        subtotal_amount=Decimal("1000.00"),
        taxable_amount=Decimal("1000.00"),
        vat_amount=Decimal("150.00"),
        total_amount=Decimal("1150.00"),
        submission_mode="AUTO",
        environment="PRODUCTION",
        previous_invoice_hash=b2b_artifact.zatca_hash,
        icv_counter=2,
    )
    assert b2c_artifact.submission_type == "REPORTING"
    assert b2c_artifact.invoice_subtype_code == "0200000"
    assert b2c_artifact.zatca_status == "REPORTED"
    assert b2c_artifact.zatca_pih == b2b_artifact.zatca_hash
    assert 'name="0200000">388<' in b2c_artifact.xml_content

    # 3. CSID Onboarding Structure (Sandbox & Production)
    csid_sandbox = build_csid_onboarding_structure(environment="SANDBOX", otp="123345")
    assert csid_sandbox["environment"] == "SANDBOX"
    assert csid_sandbox["disposition_message"] == "ISSUED"
    assert "developer-portal" in csid_sandbox["endpoints"]["clearance"]
    assert len(csid_sandbox["binary_security_token"]) > 20
    assert len(csid_sandbox["public_key_base64"]) > 20
