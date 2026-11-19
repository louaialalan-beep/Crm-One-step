from __future__ import annotations

import base64
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple

from pydantic import BaseModel, Field

from app.core.config import settings


class FinancialLineItemInput(BaseModel):
    id: str = Field(default="li_1")
    name: str = Field(..., min_length=1, description="اسم البند أو الخدمة")
    description: str = Field(default="")
    quantity: Decimal = Field(default=Decimal("1"), gt=Decimal("0"))
    unit_price: Decimal = Field(..., ge=Decimal("0"))
    discount_type: str = Field(default="percentage", pattern="^(percentage|amount)$")
    discount_value: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    vat_rate: Decimal = Field(default=Decimal("15.00"))


class ComputedFinancialTotals(BaseModel):
    subtotal_amount: Decimal
    discount_total: Decimal
    taxable_amount: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    zatca_tlv_base64: str


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def encode_zatca_phase1_tlv_base64(
    seller_name: str,
    vat_number: str,
    timestamp_iso: str,
    total_with_vat: Decimal,
    vat_amount: Decimal,
) -> str:
    """
    ZATCA Phase 1 (فاتورة - المرحلة الأولى) TLV QR Code Encoder in Python.
    Tag 1: Seller Name (UTF-8)
    Tag 2: Seller VAT Registration Number (15 digits)
    Tag 3: Invoice ISO-8601 Timestamp
    Tag 4: Invoice Total (with VAT) formatted to 2 decimal places
    Tag 5: VAT Total (15%) formatted to 2 decimal places
    """
    tlv_fields: List[Tuple[int, str]] = [
        (1, (seller_name or settings.ZATCA_DEFAULT_SELLER_NAME).strip()),
        (2, (vat_number or settings.ZATCA_DEFAULT_VAT_NUMBER).strip()),
        (3, timestamp_iso),
        (4, f"{_quantize_money(total_with_vat):.2f}"),
        (5, f"{_quantize_money(vat_amount):.2f}"),
    ]

    tlv_bytes = bytearray()
    for tag, value in tlv_fields:
        value_bytes = value.encode("utf-8")
        tlv_bytes.append(tag & 0xFF)
        tlv_bytes.append(len(value_bytes) & 0xFF)
        tlv_bytes.extend(value_bytes)

    return base64.b64encode(bytes(tlv_bytes)).decode("ascii")


def calculate_zatca_financials(
    line_items: List[FinancialLineItemInput],
    seller_name: str = settings.ZATCA_DEFAULT_SELLER_NAME,
    seller_vat_number: str = settings.ZATCA_DEFAULT_VAT_NUMBER,
    issued_at: datetime | None = None,
) -> ComputedFinancialTotals:
    """
    Calculates subtotal, line discounts, taxable amount, 15% Saudi VAT,
    grand total, and ZATCA Phase 1 TLV Base64 QR payload.
    """
    subtotal = Decimal("0.00")
    discount_total = Decimal("0.00")

    for item in line_items:
        line_gross = item.quantity * item.unit_price
        if item.discount_type == "amount":
            line_discount = min(line_gross, item.discount_value)
        else:
            pct = min(Decimal("100"), max(Decimal("0"), item.discount_value))
            line_discount = line_gross * (pct / Decimal("100"))

        subtotal += line_gross
        discount_total += line_discount

    subtotal = _quantize_money(subtotal)
    discount_total = _quantize_money(discount_total)
    taxable_amount = _quantize_money(max(Decimal("0.00"), subtotal - discount_total))
    vat_rate = Decimal("15.00")
    vat_amount = _quantize_money(taxable_amount * Decimal("0.15"))
    total_amount = _quantize_money(taxable_amount + vat_amount)

    ts = (issued_at or datetime.now(timezone.utc)).isoformat()
    qr_tlv_base64 = encode_zatca_phase1_tlv_base64(
        seller_name=seller_name,
        vat_number=seller_vat_number,
        timestamp_iso=ts,
        total_with_vat=total_amount,
        vat_amount=vat_amount,
    )

    return ComputedFinancialTotals(
        subtotal_amount=subtotal,
        discount_total=discount_total,
        taxable_amount=taxable_amount,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        zatca_tlv_base64=qr_tlv_base64,
    )
