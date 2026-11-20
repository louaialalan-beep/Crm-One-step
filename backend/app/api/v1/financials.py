from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, get_current_token_payload
from app.core.zatca import calculate_zatca_financials
from app.db.models import (
    CapiEventLog,
    Contact,
    Invoice,
    Lead,
    OrderAttribution,
    Quote,
    SalesOrder,
    Touchpoint,
)
from app.db.session import get_db
from app.schemas.crm import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    OrderAttributionResponse,
    QuoteCreate,
    QuoteResponse,
    QuoteUpdate,
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderUpdate,
    ZatcaCsidOnboardRequest,
    ZatcaCsidOnboardResponse,
    ZatcaPhase2SubmitRequest,
    ZatcaPhase2SubmitResponse,
)
from app.services.zatca_phase2 import (
    ZATCA_GENESIS_PIH,
    build_csid_onboarding_structure,
    process_zatca_phase2_submission,
)
from app.worker import sha256_normalize

router = APIRouter(tags=["Financial Cycle (Quotes, Sales Orders, ZATCA Phase 1 Invoices & Attributions)"])


# ============================================================================
# 1. Quotes CRUD (/quotes) with 15% Saudi VAT Server-Side Calculation
# ============================================================================


@router.get("/quotes", response_model=List[QuoteResponse])
async def list_quotes(db: AsyncSession = Depends(get_db)) -> List[QuoteResponse]:
    rows = (
        await db.scalars(
            select(Quote)
            .where(Quote.deleted_at.is_(None))
            .order_by(Quote.created_at.desc())
        )
    ).all()
    return [QuoteResponse.model_validate(r) for r in rows]


@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    payload: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> QuoteResponse:
    computed = calculate_zatca_financials(payload.line_items)
    quote_number = payload.quote_number or f"QT-{datetime.now(timezone.utc).year}-{random.randint(1000, 9999)}"

    quote = Quote(
        org_id=token_payload.org_id,
        quote_number=quote_number,
        lead_uid=payload.lead_uid,
        title=payload.title,
        deal_id=payload.deal_id,
        account_id=payload.account_id,
        contact_id=payload.contact_id,
        customer_name=payload.customer_name,
        customer_company=payload.customer_company,
        status=payload.status,
        currency=payload.currency,
        line_items=[item.model_dump(mode="json") for item in payload.line_items],
        subtotal_amount=computed.subtotal_amount,
        discount_total=computed.discount_total,
        taxable_amount=computed.taxable_amount,
        vat_rate=computed.vat_rate,
        vat_amount=computed.vat_amount,
        total_amount=computed.total_amount,
        valid_until=payload.valid_until,
        notes=payload.notes,
    )
    db.add(quote)
    await db.flush()
    return QuoteResponse.model_validate(quote)


@router.patch("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: uuid.UUID,
    payload: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
) -> QuoteResponse:
    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None))
    )
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="عرض السعر غير موجود.")

    if payload.title is not None:
        quote.title = payload.title
    if payload.status is not None:
        quote.status = payload.status
    if payload.valid_until is not None:
        quote.valid_until = payload.valid_until
    if payload.notes is not None:
        quote.notes = payload.notes
    if payload.line_items is not None:
        computed = calculate_zatca_financials(payload.line_items)
        quote.line_items = [item.model_dump(mode="json") for item in payload.line_items]
        quote.subtotal_amount = computed.subtotal_amount
        quote.discount_total = computed.discount_total
        quote.taxable_amount = computed.taxable_amount
        quote.vat_rate = computed.vat_rate
        quote.vat_amount = computed.vat_amount
        quote.total_amount = computed.total_amount

    await db.flush()
    return QuoteResponse.model_validate(quote)


@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> None:
    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None))
    )
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="عرض السعر غير موجود.")
    quote.deleted_at = datetime.now(timezone.utc)
    quote.deleted_by = token_payload.sub
    await db.flush()


# ============================================================================
# 2. Sales Orders CRUD (/sales-orders)
# ============================================================================


@router.get("/sales-orders", response_model=List[SalesOrderResponse])
async def list_sales_orders(db: AsyncSession = Depends(get_db)) -> List[SalesOrderResponse]:
    rows = (
        await db.scalars(
            select(SalesOrder)
            .where(SalesOrder.deleted_at.is_(None))
            .order_by(SalesOrder.created_at.desc())
        )
    ).all()
    return [SalesOrderResponse.model_validate(r) for r in rows]


@router.post(
    "/sales-orders",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sales_order(
    payload: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> SalesOrderResponse:
    computed = calculate_zatca_financials(payload.line_items)
    so_number = payload.so_number or f"SO-{datetime.now(timezone.utc).year}-{random.randint(1000, 9999)}"

    so = SalesOrder(
        org_id=token_payload.org_id,
        so_number=so_number,
        lead_uid=payload.lead_uid,
        title=payload.title,
        quote_id=payload.quote_id,
        deal_id=payload.deal_id,
        account_id=payload.account_id,
        contact_id=payload.contact_id,
        customer_name=payload.customer_name,
        customer_company=payload.customer_company,
        status=payload.status,
        currency=payload.currency,
        line_items=[item.model_dump(mode="json") for item in payload.line_items],
        subtotal_amount=computed.subtotal_amount,
        discount_total=computed.discount_total,
        taxable_amount=computed.taxable_amount,
        vat_rate=computed.vat_rate,
        vat_amount=computed.vat_amount,
        total_amount=computed.total_amount,
    )
    db.add(so)
    await db.flush()
    return SalesOrderResponse.model_validate(so)


@router.patch("/sales-orders/{so_id}", response_model=SalesOrderResponse)
async def update_sales_order(
    so_id: uuid.UUID,
    payload: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    so = await db.scalar(
        select(SalesOrder).where(SalesOrder.id == so_id, SalesOrder.deleted_at.is_(None))
    )
    if not so:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="أمر البيع غير موجود.")

    if payload.title is not None:
        so.title = payload.title
    if payload.status is not None:
        so.status = payload.status
    if payload.line_items is not None:
        computed = calculate_zatca_financials(payload.line_items)
        so.line_items = [item.model_dump(mode="json") for item in payload.line_items]
        so.subtotal_amount = computed.subtotal_amount
        so.discount_total = computed.discount_total
        so.taxable_amount = computed.taxable_amount
        so.vat_rate = computed.vat_rate
        so.vat_amount = computed.vat_amount
        so.total_amount = computed.total_amount

    await db.flush()
    return SalesOrderResponse.model_validate(so)


@router.delete("/sales-orders/{so_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_sales_order(
    so_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> None:
    so = await db.scalar(
        select(SalesOrder).where(SalesOrder.id == so_id, SalesOrder.deleted_at.is_(None))
    )
    if not so:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="أمر البيع غير موجود.")
    so.deleted_at = datetime.now(timezone.utc)
    so.deleted_by = token_payload.sub
    await db.flush()


# ============================================================================
# 3. ZATCA Phase 1 Tax Invoices (/invoices) + Multi-Purchase Attribution + CAPI
# ============================================================================


async def _enqueue_invoice_capi_purchase(
    request: Request,
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice: Invoice,
    resolved_tp: Optional[Touchpoint] = None,
) -> None:
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

    if invoice.contact_id:
        contact = await db.scalar(select(Contact).where(Contact.id == invoice.contact_id))
        if contact:
            customer_email = contact.email
            customer_phone = contact.phone

    if not customer_email and not customer_phone:
        lead = await db.scalar(select(Lead).where(Lead.lead_uid == invoice.lead_uid))
        if lead:
            customer_email = lead.email
            customer_phone = lead.phone

    arq_pool = getattr(request.app.state, "arq_pool", None)
    capi_log = CapiEventLog(
        org_id=org_id,
        lead_uid=invoice.lead_uid,
        event_name="Purchase",
        event_id=f"{invoice.lead_uid}_Purchase_{invoice.id}",
        entity_type="invoice",
        entity_id=str(invoice.id),
        value=invoice.total_amount,
        currency=invoice.currency,
        hashed_email=sha256_normalize(customer_email),
        hashed_phone=sha256_normalize(customer_phone),
        status="queued" if arq_pool is not None else "simulated",
        attempts=1,
        response_payload={
            "invoice_number": invoice.invoice_number,
            "zatca_qr": invoice.zatca_tlv_base64,
        },
    )
    db.add(capi_log)
    await db.flush()

    if arq_pool is not None:
        try:
            await arq_pool.enqueue_job(
                "send_meta_capi_event_task",
                org_id=str(org_id),
                event_name="Purchase",
                lead_uid=invoice.lead_uid,
                email=customer_email,
                phone=customer_phone,
                value=float(invoice.total_amount),
                currency=invoice.currency,
                campaign_name=resolved_tp.campaign_name if resolved_tp else None,
                ad_id=resolved_tp.ad_id if resolved_tp else None,
                entity_type="invoice",
                entity_id=str(invoice.id),
                capi_log_id=str(capi_log.id),
            )
        except Exception:
            pass


@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(db: AsyncSession = Depends(get_db)) -> List[InvoiceResponse]:
    rows = (
        await db.scalars(
            select(Invoice)
            .where(Invoice.deleted_at.is_(None))
            .order_by(Invoice.created_at.desc())
        )
    ).all()
    return [InvoiceResponse.model_validate(r) for r in rows]


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_zatca_tax_invoice(
    payload: InvoiceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> InvoiceResponse:
    """
    Creates a ZATCA Phase 1 Tax Invoice:
      1. Calculates 15% VAT and generates the Base64-encoded TLV QR payload in Python.
      2. Inherits the customer's Permanent Unified ID (`RWQ-xxxxx` / `lead_uid`).
      3. Automatically records a multi-purchase `OrderAttribution` row (supporting 10+
         repeat orders per customer) linked to `lead_uid` and the latest `touchpoint_id`.
      4. Enqueues an asynchronous Meta CAPI `Purchase` event via ARQ Redis worker and
         logs the event in `capi_events_log`.
    """
    issued_at = datetime.now(timezone.utc)
    seller_name = payload.seller_name or settings.ZATCA_DEFAULT_SELLER_NAME
    seller_vat = payload.seller_vat_number or settings.ZATCA_DEFAULT_VAT_NUMBER

    computed = calculate_zatca_financials(
        payload.line_items,
        seller_name=seller_name,
        seller_vat_number=seller_vat,
        issued_at=issued_at,
    )

    invoice_number = (
        payload.invoice_number
        or f"INV-ZATCA-{issued_at.year}-{random.randint(10000, 99999)}"
    )

    invoice = Invoice(
        org_id=token_payload.org_id,
        invoice_number=invoice_number,
        lead_uid=payload.lead_uid,
        title=payload.title,
        sales_order_id=payload.sales_order_id,
        quote_id=payload.quote_id,
        deal_id=payload.deal_id,
        account_id=payload.account_id,
        contact_id=payload.contact_id,
        customer_name=payload.customer_name,
        customer_company=payload.customer_company,
        customer_vat_number=payload.customer_vat_number,
        seller_name=seller_name,
        seller_vat_number=seller_vat,
        status=payload.status,
        currency=payload.currency,
        line_items=[item.model_dump(mode="json") for item in payload.line_items],
        subtotal_amount=computed.subtotal_amount,
        discount_total=computed.discount_total,
        taxable_amount=computed.taxable_amount,
        vat_rate=computed.vat_rate,
        vat_amount=computed.vat_amount,
        total_amount=computed.total_amount,
        zatca_tlv_base64=computed.zatca_tlv_base64,
        issued_at=issued_at,
        due_date=payload.due_date,
    )
    db.add(invoice)
    await db.flush()

    resolved_tp: Touchpoint | None = None
    if payload.touchpoint_id:
        resolved_tp = await db.scalar(
            select(Touchpoint).where(Touchpoint.id == payload.touchpoint_id)
        )
    if not resolved_tp:
        resolved_tp = await db.scalar(
            select(Touchpoint)
            .where(Touchpoint.lead_uid == payload.lead_uid)
            .order_by(Touchpoint.created_at.desc())
        )

    existing_purchases_count = await db.scalar(
        select(func.count(OrderAttribution.id)).where(
            OrderAttribution.lead_uid == payload.lead_uid
        )
    )
    next_sequence = int(existing_purchases_count or 0) + 1

    attribution = OrderAttribution(
        org_id=token_payload.org_id,
        lead_uid=payload.lead_uid,
        touchpoint_id=resolved_tp.id if resolved_tp else None,
        deal_id=payload.deal_id,
        sales_order_id=payload.sales_order_id,
        invoice_id=invoice.id,
        purchase_sequence=next_sequence,
        attribution_model="multi_touch_w_shaped",
        attribution_weight=Decimal("100.00"),
        attributed_revenue=computed.total_amount,
        channel=resolved_tp.channel if resolved_tp else "Direct",
        campaign_name=resolved_tp.campaign_name if resolved_tp else None,
        ad_id=resolved_tp.ad_id if resolved_tp else None,
        metadata_={
            "invoice_number": invoice.invoice_number,
            "zatca_phase": "Phase_1_TLV_Base64",
            "purchase_sequence": next_sequence,
        },
    )
    db.add(attribution)
    await db.flush()

    await _enqueue_invoice_capi_purchase(
        request=request,
        db=db,
        org_id=token_payload.org_id,
        invoice=invoice,
        resolved_tp=resolved_tp,
    )

    return InvoiceResponse.model_validate(invoice)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> InvoiceResponse:
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None))
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الفاتورة غير موجودة.")

    previous_status = invoice.status
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, k, v)
    await db.flush()

    if payload.status in ("مدفوعة", "مكتملة") and previous_status != payload.status:
        await _enqueue_invoice_capi_purchase(
            request=request,
            db=db,
            org_id=token_payload.org_id,
            invoice=invoice,
        )

    return InvoiceResponse.model_validate(invoice)


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> None:
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None))
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الفاتورة غير موجودة.")
    invoice.deleted_at = datetime.now(timezone.utc)
    invoice.deleted_by = token_payload.sub
    await db.flush()


@router.get("/invoices/order-attributions", response_model=List[OrderAttributionResponse])
async def list_order_attributions(
    lead_uid: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> List[OrderAttributionResponse]:
    stmt = select(OrderAttribution).order_by(OrderAttribution.created_at.desc())
    if lead_uid:
        stmt = stmt.where(OrderAttribution.lead_uid == lead_uid)
    rows = (await db.scalars(stmt)).all()
    return [OrderAttributionResponse.model_validate(r) for r in rows]


# ============================================================================
# 5. ZATCA Phase 2 (الفوترة الإلكترونية - المرحلة الثانية: الربط والتكامل)
#    - UBL 2.1 XML Generation + SHA-256 Invoice Hash + ECDSA Digital Signature
#    - B2B Clearance (CLEARED) & B2C Simplified Reporting (REPORTED)
#    - CSID Onboarding Structure (Sandbox / Simulation / Production)
# ============================================================================


@router.post(
    "/invoices/{invoice_id}/zatca-phase2/submit",
    response_model=ZatcaPhase2SubmitResponse,
)
@router.post(
    "/invoices/{invoice_id}/zatca/submit",
    response_model=ZatcaPhase2SubmitResponse,
)
async def submit_invoice_zatca_phase2(
    invoice_id: uuid.UUID,
    payload: ZatcaPhase2SubmitRequest = ZatcaPhase2SubmitRequest(),
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> ZatcaPhase2SubmitResponse:
    """
    Submits an invoice to ZATCA Phase 2 (Clearance for B2B Tax Invoices or Reporting
    for Simplified B2C Tax Invoices), computes the UBL 2.1 XML, SHA-256 Invoice Hash,
    ECDSA Digital Signature, and 9-tag Phase 2 TLV QR code, and saves xml_content,
    zatca_hash, and zatca_status in the `invoices` table.
    """
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None))
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الفاتورة الضريبية غير موجودة.",
        )

    # Find previous invoice hash (PIH) in the tenant's chain if not explicitly provided
    resolved_pih = payload.previous_invoice_hash
    if not resolved_pih:
        prev_invoice = await db.scalar(
            select(Invoice)
            .where(
                Invoice.org_id == token_payload.org_id,
                Invoice.id != invoice.id,
                Invoice.zatca_hash.is_not(None),
                Invoice.deleted_at.is_(None),
            )
            .order_by(Invoice.issued_at.desc())
        )
        resolved_pih = prev_invoice.zatca_hash if (prev_invoice and prev_invoice.zatca_hash) else ZATCA_GENESIS_PIH

    icv_count = int(
        (
            await db.scalar(
                select(func.count(Invoice.id)).where(Invoice.org_id == token_payload.org_id)
            )
        )
        or 1
    )

    artifact = process_zatca_phase2_submission(
        invoice_number=invoice.invoice_number,
        invoice_uuid=invoice.zatca_uuid or str(invoice.id),
        issued_at=invoice.issued_at,
        seller_name=invoice.seller_name,
        seller_vat_number=invoice.seller_vat_number,
        customer_name=invoice.customer_company or invoice.customer_name,
        customer_vat_number=invoice.customer_vat_number,
        currency=invoice.currency,
        line_items=invoice.line_items,
        subtotal_amount=invoice.subtotal_amount,
        discount_total=invoice.discount_total,
        taxable_amount=invoice.taxable_amount,
        vat_rate=invoice.vat_rate,
        vat_amount=invoice.vat_amount,
        total_amount=invoice.total_amount,
        submission_mode=payload.submission_mode,
        environment=payload.environment,
        previous_invoice_hash=resolved_pih,
        icv_counter=max(1, icv_count),
    )

    invoice.xml_content = artifact.xml_content
    invoice.zatca_hash = artifact.zatca_hash
    invoice.zatca_status = artifact.zatca_status
    invoice.zatca_uuid = artifact.invoice_uuid
    invoice.zatca_pih = artifact.zatca_pih
    invoice.zatca_signature = artifact.zatca_signature
    invoice.zatca_tlv_base64 = artifact.zatca_tlv_base64
    invoice.zatca_invoice_type = (
        "B2B_STANDARD" if artifact.submission_type == "CLEARANCE" else "B2C_SIMPLIFIED"
    )
    invoice.zatca_submitted_at = artifact.submitted_at
    await db.flush()

    return ZatcaPhase2SubmitResponse(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        lead_uid=invoice.lead_uid,
        submission_type=artifact.submission_type,
        environment=artifact.environment,
        zatca_status=artifact.zatca_status,
        zatca_uuid=artifact.invoice_uuid,
        zatca_hash=artifact.zatca_hash,
        zatca_pih=artifact.zatca_pih,
        zatca_signature=artifact.zatca_signature,
        zatca_tlv_base64=artifact.zatca_tlv_base64,
        xml_content=artifact.xml_content,
        clearance_or_reporting_message=artifact.message,
        submitted_at=artifact.submitted_at,
    )


@router.get("/invoices/{invoice_id}/zatca-phase2/xml")
async def download_invoice_zatca_ubl_xml(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> Response:
    """
    Returns the ZATCA Phase 2 UBL 2.1 XML document for an invoice.
    If the invoice has not yet been submitted, generates the signed UBL 2.1 XML on the fly.
    """
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None))
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الفاتورة الضريبية غير موجودة.",
        )

    if not invoice.xml_content:
        artifact = process_zatca_phase2_submission(
            invoice_number=invoice.invoice_number,
            invoice_uuid=invoice.zatca_uuid or str(invoice.id),
            issued_at=invoice.issued_at,
            seller_name=invoice.seller_name,
            seller_vat_number=invoice.seller_vat_number,
            customer_name=invoice.customer_company or invoice.customer_name,
            customer_vat_number=invoice.customer_vat_number,
            currency=invoice.currency,
            line_items=invoice.line_items,
            subtotal_amount=invoice.subtotal_amount,
            discount_total=invoice.discount_total,
            taxable_amount=invoice.taxable_amount,
            vat_rate=invoice.vat_rate,
            vat_amount=invoice.vat_amount,
            total_amount=invoice.total_amount,
        )
        invoice.xml_content = artifact.xml_content
        invoice.zatca_hash = artifact.zatca_hash
        invoice.zatca_status = artifact.zatca_status
        invoice.zatca_uuid = artifact.invoice_uuid
        invoice.zatca_pih = artifact.zatca_pih
        invoice.zatca_signature = artifact.zatca_signature
        invoice.zatca_tlv_base64 = artifact.zatca_tlv_base64
        invoice.zatca_submitted_at = artifact.submitted_at
        await db.flush()

    filename = f"{invoice.invoice_number}-ZATCA-UBL21.xml"
    return Response(
        content=invoice.xml_content,
        media_type="application/xml; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-ZATCA-Hash": invoice.zatca_hash or "",
            "X-ZATCA-Status": invoice.zatca_status or "CLEARED",
        },
    )


@router.post(
    "/invoices/zatca-phase2/csid-onboard",
    response_model=ZatcaCsidOnboardResponse,
)
async def onboard_zatca_phase2_csid(
    payload: ZatcaCsidOnboardRequest = ZatcaCsidOnboardRequest(),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> ZatcaCsidOnboardResponse:
    """
    Builds and returns the ZATCA Phase 2 CSID Onboarding payload (CSR, BinarySecurityToken,
    Secret, Public Key, and Fatoora Sandbox/Production API endpoints).
    """
    result = build_csid_onboarding_structure(
        environment=payload.environment,
        otp=payload.otp,
        common_name=payload.common_name,
        organization_name=payload.organization_name,
        organization_unit_name=payload.organization_unit_name,
        vat_number=payload.vat_number,
        invoice_type_flag=payload.invoice_type_flag,
        location_address=payload.location_address,
        industry_business_category=payload.industry_business_category,
    )
    return ZatcaCsidOnboardResponse(**result)

