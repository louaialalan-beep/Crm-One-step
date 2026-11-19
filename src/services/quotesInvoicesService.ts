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
};
