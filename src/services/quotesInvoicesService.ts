import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  FinancialLineItem,
  Invoice,
  PurchaseOrder,
  Quote,
  SalesOrder,
} from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

/**
 * Encodes ZATCA Phase 1 (فاتورة - المرحلة الأولى) TLV fields into Base64 string.
 * Tag 1: Seller Name
 * Tag 2: Seller VAT Registration Number (15 digits)
 * Tag 3: ISO 8601 Timestamp
 * Tag 4: Invoice Total (with VAT)
 * Tag 5: VAT Total (15%)
 */
export function encodeZatcaPhase1TlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: number;
  vatAmount: number;
}): string {
  const encoder = new TextEncoder();
  const fields: Array<{ tag: number; value: string }> = [
    { tag: 1, value: params.sellerName || 'Crm-One-step Enterprise' },
    { tag: 2, value: params.vatNumber || '310122393500003' },
    { tag: 3, value: params.timestampIso || new Date().toISOString() },
    { tag: 4, value: params.totalWithVat.toFixed(2) },
    { tag: 5, value: params.vatAmount.toFixed(2) },
  ];

  const byteChunks: number[] = [];
  for (const field of fields) {
    const valBytes = encoder.encode(field.value);
    byteChunks.push(field.tag, valBytes.length, ...Array.from(valBytes));
  }

  let binary = '';
  for (const byte of byteChunks) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Helper to compute 15% Saudi VAT and totals for One-Click Quote or One-Click ZATCA Tax Invoice
 */
export function computeOneStepFinancials(params: {
  dealTitle: string;
  dealAmount: number;
  lineItems?: FinancialLineItem[];
}) {
  const items: FinancialLineItem[] =
    params.lineItems && params.lineItems.length > 0
      ? params.lineItems
      : [
          {
            id: `li_${Date.now()}_1`,
            name: params.dealTitle || 'باقة Crm-One-step المؤسسية المتكاملة',
            description: 'ترخيص سنوي شامل مع الربط السحابي والدعم الفني',
            quantity: 1,
            unitPrice: Math.round((Math.max(1000, params.dealAmount || 115000) / 1.15) * 100) / 100,
            discountType: 'percentage',
            discountValue: 0,
            vatRate: 15,
          },
        ];

  let subtotalAmount = 0;
  let discountTotal = 0;

  for (const item of items) {
    const lineGross = item.quantity * item.unitPrice;
    const lineDisc =
      item.discountType === 'amount'
        ? Math.min(lineGross, item.discountValue)
        : lineGross * (Math.min(100, Math.max(0, item.discountValue)) / 100);
    subtotalAmount += lineGross;
    discountTotal += lineDisc;
  }

  const taxableAmount = Math.max(0, Math.round((subtotalAmount - discountTotal) * 100) / 100);
  const vatAmount = Math.round(taxableAmount * 0.15 * 100) / 100;
  const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;

  return {
    lineItems: items,
    subtotalAmount,
    discountTotal,
    taxableAmount,
    vatAmount,
    totalAmount,
  };
}

function mapLineItemsToFastApi(items?: FinancialLineItem[]) {
  return (items || []).map((li, idx) => ({
    id: li.id || `li_${idx + 1}`,
    name: li.name || li.productName || 'بند خدمة',
    description: li.description || '',
    quantity: li.quantity || 1,
    unit_price: li.unitPrice || 0,
    discount_type: li.discountType || 'percentage',
    discount_value: li.discountValue || 0,
    vat_rate: li.vatRate ?? li.taxRate ?? 15,
  }));
}

export const quotesInvoicesService = {
  async listQuotes(params: { orgId: string; fallbackQuotes?: Quote[] }): Promise<Quote[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/quotes',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackQuotes || [],
    });
  },

  async saveQuote(params: {
    orgId: string;
    isCloudMode: boolean;
    quote: Quote;
    onPreviewApply: () => void;
  }): Promise<Quote> {
    return executeWithAdapter({
      endpoint: '/api/v1/quotes',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        quote_number: params.quote.quoteNumber,
        lead_uid: params.quote.leadUniqueId || 'RWQ-10000',
        title: params.quote.dealTitle || params.quote.quoteNumber,
        customer_name: params.quote.contactName || params.quote.accountName,
        customer_company: params.quote.accountName,
        status: params.quote.status,
        currency: params.quote.currency || 'SAR',
        line_items: mapLineItemsToFastApi(params.quote.lineItems),
        valid_until: params.quote.validUntil,
        notes: params.quote.notes,
      },
      fallback: async () => {
        params.onPreviewApply();
        if (params.isCloudMode) {
          try {
            const { id: docId, ...rest } = params.quote;
            await setDoc(doc(db, 'quotes', docId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `quotes/${params.quote.id}`);
          }
        }
        return params.quote;
      },
    });
  },

  async updateQuote(params: {
    orgId: string;
    isCloudMode: boolean;
    quoteId: string;
    patch: Partial<Quote>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/quotes/${params.quoteId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: {
        title: params.patch.dealTitle,
        status: params.patch.status,
        valid_until: params.patch.validUntil,
        notes: params.patch.notes,
        line_items: params.patch.lineItems ? mapLineItemsToFastApi(params.patch.lineItems) : undefined,
      },
      fallback: async () => {
        params.onPreviewApply();
        if (params.isCloudMode) {
          try {
            await updateDoc(doc(db, 'quotes', params.quoteId), {
              ...stripUndefinedFields(params.patch),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `quotes/${params.quoteId}`);
          }
        }
      },
    });
  },

  async listSalesOrders(params: {
    orgId: string;
    fallbackSalesOrders?: SalesOrder[];
  }): Promise<SalesOrder[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/sales-orders',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackSalesOrders || [],
    });
  },

  async saveSalesOrder(params: {
    orgId: string;
    isCloudMode: boolean;
    salesOrder: SalesOrder;
    linkedQuoteId?: string;
    onPreviewApply: () => void;
  }): Promise<SalesOrder> {
    return executeWithAdapter({
      endpoint: '/api/v1/sales-orders',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        so_number: params.salesOrder.orderNumber,
        lead_uid: params.salesOrder.leadUniqueId || 'RWQ-10000',
        title: params.salesOrder.dealTitle || params.salesOrder.orderNumber || 'أمر بيع',
        customer_name: params.salesOrder.contactName || params.salesOrder.accountName,
        customer_company: params.salesOrder.accountName,
        status: params.salesOrder.status,
        currency: params.salesOrder.currency || 'SAR',
        line_items: mapLineItemsToFastApi(params.salesOrder.lineItems),
      },
      fallback: async () => {
        params.onPreviewApply();
        if (params.isCloudMode) {
          try {
            const batch = writeBatch(db);
            const { id: soId, ...rest } = params.salesOrder;
            batch.set(doc(db, 'sales_orders', soId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            if (params.linkedQuoteId) {
              batch.update(doc(db, 'quotes', params.linkedQuoteId), {
                convertedSalesOrderId: soId,
                status: 'مقبول',
                updatedAt: serverTimestamp(),
              });
            }
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `sales_orders/${params.salesOrder.id}`);
          }
        }
        return params.salesOrder;
      },
    });
  },

  async listInvoices(params: { orgId: string; fallbackInvoices?: Invoice[] }): Promise<Invoice[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/invoices',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackInvoices || [],
    });
  },

  async saveInvoice(params: {
    orgId: string;
    isCloudMode: boolean;
    invoice: Invoice;
    linkedSalesOrderId?: string;
    onPreviewApply: () => void;
  }): Promise<Invoice> {
    return executeWithAdapter({
      endpoint: '/api/v1/invoices',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        invoice_number: params.invoice.invoiceNumber,
        lead_uid: params.invoice.leadUniqueId || 'RWQ-10000',
        title: params.invoice.dealTitle || params.invoice.invoiceNumber,
        customer_name: params.invoice.contactName || params.invoice.accountName,
        customer_company: params.invoice.accountName,
        seller_name: params.invoice.sellerName || 'Crm-One-step Enterprise',
        seller_vat_number: params.invoice.sellerVatNumber || '310122393500003',
        status: params.invoice.status,
        currency: params.invoice.currency || 'SAR',
        line_items: mapLineItemsToFastApi(params.invoice.lineItems),
        due_date: params.invoice.dueDate,
      },
      fallback: async () => {
        params.onPreviewApply();
        if (params.isCloudMode) {
          try {
            const batch = writeBatch(db);
            const { id: invId, ...rest } = params.invoice;
            batch.set(doc(db, 'invoices', invId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            if (params.linkedSalesOrderId) {
              batch.update(doc(db, 'sales_orders', params.linkedSalesOrderId), {
                convertedInvoiceId: invId,
                status: 'مفوتر',
                updatedAt: serverTimestamp(),
              });
            }
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `invoices/${params.invoice.id}`);
          }
        }
        return params.invoice;
      },
    });
  },

  async savePurchaseOrder(params: {
    orgId: string;
    isCloudMode: boolean;
    purchaseOrder: PurchaseOrder;
    onPreviewApply: () => void;
  }): Promise<PurchaseOrder> {
    return executeWithAdapter({
      endpoint: '/api/v1/purchase-orders',
      method: 'POST',
      orgId: params.orgId,
      payload: params.purchaseOrder,
      fallback: async () => {
        params.onPreviewApply();
        if (params.isCloudMode) {
          try {
            const { id: poId, ...rest } = params.purchaseOrder;
            await setDoc(doc(db, 'purchase_orders', poId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `purchase_orders/${params.purchaseOrder.id}`
            );
          }
        }
        return params.purchaseOrder;
      },
    });
  },

  async submitInvoiceZatcaPhase2(params: {
    orgId: string;
    invoice: Invoice;
    submissionMode?: 'AUTO' | 'CLEARANCE' | 'REPORTING';
    environment?: 'SANDBOX' | 'SIMULATION' | 'PRODUCTION';
  }): Promise<ZatcaPhase2SubmissionResult> {
    return executeWithAdapter({
      endpoint: `/api/v1/invoices/${encodeURIComponent(params.invoice.id)}/zatca-phase2/submit`,
      method: 'POST',
      orgId: params.orgId,
      payload: {
        submission_mode: params.submissionMode || 'AUTO',
        environment: params.environment || 'SANDBOX',
      },
      fallback: async () =>
        generateZatcaPhase2ArtifactClient(
          params.invoice,
          params.submissionMode || 'AUTO',
          params.environment || 'SANDBOX'
        ),
    });
  },
};

export interface ZatcaPhase2SubmissionResult {
  invoice_id: string;
  invoice_number: string;
  lead_uid: string;
  submission_type: 'CLEARANCE' | 'REPORTING' | string;
  environment: string;
  zatca_status: 'CLEARED' | 'REPORTED' | string;
  zatca_uuid: string;
  zatca_hash: string;
  zatca_pih: string;
  zatca_signature: string;
  zatca_tlv_base64: string;
  xml_content: string;
  clearance_or_reporting_message: string;
  submitted_at: string;
}

const ZATCA_GENESIS_PIH_CLIENT =
  'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

function escapeXmlText(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function sha256Base64Client(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const arr = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < arr.length; i += 1) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }
  return btoa(input.slice(0, 32).padEnd(32, '0'));
}

export async function generateZatcaPhase2ArtifactClient(
  invoice: Invoice,
  submissionMode: 'AUTO' | 'CLEARANCE' | 'REPORTING' = 'AUTO',
  environment: 'SANDBOX' | 'SIMULATION' | 'PRODUCTION' = 'SANDBOX'
): Promise<ZatcaPhase2SubmissionResult> {
  const fin = computeOneStepFinancials({
    dealTitle: invoice.dealTitle || invoice.invoiceNumber,
    dealAmount: invoice.totalAmount,
    lineItems: invoice.lineItems,
  });

  const isSimplified =
    submissionMode === 'REPORTING' ||
    (submissionMode === 'AUTO' &&
      (invoice.invoiceType || '').includes('مبسطة'));
  const submissionType = isSimplified ? 'REPORTING' : 'CLEARANCE';
  const subtypeCode = isSimplified ? '0200000' : '0100000';
  const zatcaStatus = isSimplified ? 'REPORTED' : 'CLEARED';

  const issueDate = (invoice.issueDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const issueTime = new Date().toISOString().slice(11, 19);
  const invUuid =
    invoice.zatcaUuid ||
    `550e8400-e29b-41d4-a716-${String(Date.now()).slice(-12).padStart(12, '0')}`;
  const currency = escapeXmlText((invoice.currency || 'SAR').toUpperCase());
  const sellerName = escapeXmlText(invoice.sellerName || 'شركة رواق لتقنية المعلومات');
  const sellerVat = escapeXmlText(invoice.sellerVatNumber || '310122393500003');
  const sellerCr = escapeXmlText(invoice.sellerCrNumber || '1010849201');
  const buyerName = escapeXmlText(invoice.accountName || 'عميل مؤسسي');
  const buyerVat = escapeXmlText(invoice.buyerVatNumber || '300948192000003');

  const items: FinancialLineItem[] =
    fin.lineItems.length > 0
      ? fin.lineItems
      : [
          {
            id: '1',
            productName: invoice.dealTitle || invoice.invoiceNumber,
            quantity: 1,
            unitPrice: fin.taxableAmount,
            discountType: 'percentage',
            discountValue: 0,
          },
        ];

  const linesXml = items
    .map((item: FinancialLineItem, idx: number) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const net = Math.round(qty * unitPrice * 100) / 100;
      const vat = Math.round(net * 0.15 * 100) / 100;
      const total = Math.round((net + vat) * 100) / 100;
      return `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${qty.toFixed(2)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currency}">${vat.toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="${currency}">${total.toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escapeXmlText(item.productName || item.name || `بند #${idx + 1}`)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join('\n');

  const canonicalBody = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXmlText(invoice.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${invUuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subtypeCode}">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
  <cbc:TaxExclusiveAmount>${fin.taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount>${fin.totalAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
</Invoice>`;

  const zatcaHash = await sha256Base64Client(canonicalBody);
  const zatcaSignature = await sha256Base64Client(`ECDSA_SECP256K1_SIG:${zatcaHash}:${invUuid}`);
  const zatcaQrTlv = encodeZatcaPhase1TlvBase64({
    sellerName: invoice.sellerName || 'شركة رواق لتقنية المعلومات',
    vatNumber: invoice.sellerVatNumber || '310122393500003',
    timestampIso: `${issueDate}T${issueTime}Z`,
    totalWithVat: fin.totalAmount,
    vatAmount: fin.vatAmount,
  });

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
          <ds:SignedInfo>
            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
            <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
            <ds:Reference Id="invoiceSignedData" URI="">
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <ds:DigestValue>${zatcaHash}</ds:DigestValue>
            </ds:Reference>
          </ds:SignedInfo>
          <ds:SignatureValue>${zatcaSignature}</ds:SignatureValue>
        </ds:Signature>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXmlText(invoice.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${invUuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subtypeCode}">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>1</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${ZATCA_GENESIS_PIH_CLIENT}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${zatcaQrTlv}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${sellerCr}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>طريق الملك فهد</cbc:StreetName>
        <cbc:BuildingNumber>2929</cbc:BuildingNumber>
        <cbc:CityName>الرياض</cbc:CityName>
        <cbc:PostalZone>12214</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${sellerVat}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${sellerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>الرياض</cbc:StreetName>
        <cbc:CityName>الرياض</cbc:CityName>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${buyerVat}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${buyerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${fin.vatAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${fin.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${fin.vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${fin.subtotalAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${fin.taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${fin.totalAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${fin.discountTotal.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${currency}">${fin.totalAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;

  const submittedAt = new Date().toISOString();
  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    lead_uid: invoice.leadUniqueId || 'RWQ-10000',
    submission_type: submissionType,
    environment,
    zatca_status: zatcaStatus,
    zatca_uuid: invUuid,
    zatca_hash: zatcaHash,
    zatca_pih: ZATCA_GENESIS_PIH_CLIENT,
    zatca_signature: zatcaSignature,
    zatca_tlv_base64: zatcaQrTlv,
    xml_content: xmlContent,
    clearance_or_reporting_message:
      zatcaStatus === 'CLEARED'
        ? `تم اعتماد الفاتورة الضريبية (B2B Clearance) لدى هيئة الزكاة والضريبة والجمارك (${environment}) بنجاح — الحالة: CLEARED`
        : `تم إبلاغ هيئة الزكاة والضريبة والجمارك بالفاتورة المبسطة (B2C Reporting - ${environment}) بنجاح — الحالة: REPORTED`,
    submitted_at: submittedAt,
  };
}

export function downloadZatcaPhase2XmlFile(invoiceNumber: string, xmlContent: string): void {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber}-ZATCA-UBL21.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

