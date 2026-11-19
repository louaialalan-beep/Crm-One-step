from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
