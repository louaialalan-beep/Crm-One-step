import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Kanban,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Table2,
  Trash2,
  Truck,
  Wallet,
  X,
  Coins,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCrm } from '../context/CrmContext';
import type {
  DiscountType,
  FinancialLineItem,
  Invoice,
  LineItemUnit,
  PurchaseOrder,
  Quote,
  SalesOrder,
  TaxMode,
} from '../types/crm';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrencySAR } from '../utils/formatters';
import {
  downloadZatcaPhase2XmlFile,
  generateZatcaPhase2ArtifactClient,
  quotesInvoicesService,
} from '../services/quotesInvoicesService';

const getTodayDate = () => new Date().toISOString().split('T')[0];
const getFutureDate = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

export interface ComputedLineMetrics {
  gross: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ComputedDocumentTotals {
  subtotalAmount: number;
  discountTotal: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  taxMode: TaxMode;
  lineItems: FinancialLineItem[];
}

export function computeSingleLineItem(
  item: FinancialLineItem,
  taxMode: TaxMode
): ComputedLineMetrics {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.unitPrice) || 0);
  const gross = qty * price;
  const discVal = Math.max(0, Number(item.discountValue) || 0);
  const discountAmount =
    item.discountType === 'percentage'
      ? Math.min(gross, gross * (Math.min(100, discVal) / 100))
      : Math.min(gross, discVal);
  const afterDiscount = Math.max(0, gross - discountAmount);
  const rate = item.taxRate === 0 ? 0 : 15;

  if (taxMode === 'inclusive') {
    const lineTotal = afterDiscount;
    const netAmount = rate > 0 ? lineTotal / (1 + rate / 100) : lineTotal;
    const taxAmount = lineTotal - netAmount;
    return {
      gross: Math.round(gross * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  }

  const netAmount = afterDiscount;
  const taxAmount = netAmount * (rate / 100);
  const lineTotal = netAmount + taxAmount;
  return {
    gross: Math.round(gross * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    lineTotal: Math.round(lineTotal * 100) / 100,
  };
}

export function computeDocumentFinancials(
  docRecord: {
    lineItems?: FinancialLineItem[];
    taxMode?: TaxMode;
    subtotalAmount?: number;
    discountTotal?: number;
    taxableAmount?: number;
    vatAmount?: number;
    totalAmount: number;
    subject?: string;
  }
): ComputedDocumentTotals {
  const taxMode: TaxMode = docRecord.taxMode ?? 'inclusive';
  const items: FinancialLineItem[] =
    docRecord.lineItems && docRecord.lineItems.length > 0
      ? docRecord.lineItems
      : [
          {
            id: 'line_default_1',
            productName: docRecord.subject || 'باقة ترخيص وتنفيذ منظومة رواق Enterprise',
            description: 'يشمل التهيئة السحابية، الربط البرمجي، وتدريب الفريق التشغيلي',
            unit: 'مشروع',
            quantity: 1,
            unitPrice: Number(docRecord.totalAmount) || 0,
            discountType: 'percentage',
            discountValue: 0,
            taxRate: 15,
            deliveredQuantity: 1,
            invoicedQuantity: 1,
          },
        ];

  let subtotalAmount = 0;
  let discountTotal = 0;
  let taxableAmount = 0;
  let vatAmount = 0;
  let totalAmount = 0;

  for (const item of items) {
    const m = computeSingleLineItem(item, taxMode);
    subtotalAmount += m.gross;
    discountTotal += m.discountAmount;
    taxableAmount += m.netAmount;
    vatAmount += m.taxAmount;
    totalAmount += m.lineTotal;
  }

  return {
    subtotalAmount: Math.round(subtotalAmount * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    taxMode,
    lineItems: items,
  };
}

function getArabicInitials(name: string): string {
  const parts = (name || 'عميل').trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
  }
  return (parts[0] || 'ر').slice(0, 2);
}

export function FinancialModulePage({
  defaultTab,
}: {
  defaultTab?: 'quotes' | 'sales_orders' | 'invoices' | 'purchase_orders';
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const {
    quotes,
    salesOrders,
    invoices,
    purchaseOrders,
    accounts,
    contacts,
    deals,
    users,
    currentUser,
    currentOrgId,
    currentOrganization,
    isPreviewMode,
    createQuote,
    updateQuote,
    createSalesOrder,
    updateSalesOrder,
    createInvoice,
    updateInvoice,
    createPurchaseOrder,
    updatePurchaseOrder,
    recordInvoicePayment,
    convertQuoteToSalesOrder,
    convertSalesOrderToInvoice,
    currencies,
    baseCurrency,
    formatOrgCurrency,
    convertToBaseCurrency,
  } = useCrm();

  const activeCurrencies = useMemo(
    () => currencies.filter((c) => c.isActive || c.isPrimary),
    [currencies]
  );

  const currentTab =
    defaultTab === 'purchase_orders' || path.includes('purchase-orders')
      ? 'purchase-orders'
      : defaultTab === 'sales_orders' || path.includes('sales-orders')
        ? 'sales-orders'
        : defaultTab === 'invoices' || path.includes('invoices')
          ? 'invoices'
          : 'quotes';

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zatcaSubmittingId, setZatcaSubmittingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [conversionLoading, setConversionLoading] = useState<string | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Preview / Print A4 Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    kind: 'quote' | 'sales_order' | 'invoice' | 'purchase_order';
    record: Quote | SalesOrder | Invoice | PurchaseOrder;
  } | null>(null);

  // Payment Recording Modal State for Invoices
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDate);
  const [paymentMethod, setPaymentMethod] = useState<
    'تحويل بنكي' | 'مدى' | 'بطاقة ائتمانية' | 'نقدي'
  >('تحويل بنكي');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // =========================================================================
  // NEW DOCUMENT FORM STATE (Quotes, Sales Orders, Tax Invoices)
  // =========================================================================
  const [newSubject, setNewSubject] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newLeadUniqueId, setNewLeadUniqueId] = useState('');
  const [newDealId, setNewDealId] = useState('');
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newOwnerName, setNewOwnerName] = useState(currentUser?.fullName || 'سلمان القحطاني');
  const [newIssueDate, setNewIssueDate] = useState<string>(getTodayDate);
  const [newValidUntil, setNewValidUntil] = useState<string>(() => getFutureDate(14));
  const [newSupplyDate, setNewSupplyDate] = useState<string>(getTodayDate);
  const [newDocStatus, setNewDocStatus] = useState<string>('مسودة');
  const [newCurrency, setNewCurrency] = useState<string>(() => baseCurrency?.code || 'SAR');
  const [newExchangeRate, setNewExchangeRate] = useState<number>(1.0);
  const [newPaymentTerms, setNewPaymentTerms] = useState(
    'دفعة 50% مقدماً و50% عند التسليم والاعتماد النهائي'
  );
  const [newDeliveryDuration, setNewDeliveryDuration] = useState('14 يوم عمل من تاريخ التعميد');
  const [newTermsAndConditions, setNewTermsAndConditions] = useState(
    'جميع الأسعار بالريال السعودي وتخضع لضريبة القيمة المضافة 15% وفق أنظمة هيئة الزكاة والضريبة والجمارك (ZATCA). العرض ساري حتى تاريخ الانتهاء الموضح أعلاه.'
  );
  const [newCustomerNotes, setNewCustomerNotes] = useState(
    'يشمل العرض الدعم الفني المباشر وتخصيص مسارات العمل لمؤسستكم.'
  );

  // Sales Order specific fields
  const [newQuoteRef, setNewQuoteRef] = useState('');
  const [newCustomerPo, setNewCustomerPo] = useState('');
  const [newBillingAddress, setNewBillingAddress] = useState(
    'الرياض — حي العليا، طريق الملك فهد، برج الأعمال'
  );
  const [newShippingAddress, setNewShippingAddress] = useState(
    'الرياض — المقر الرئيسي للعميل (تسليم وتفعيل سحابي + ميداني)'
  );
  const [newShippingMethod, setNewShippingMethod] = useState(
    'تفعيل سحابي مباشر + فريق تنفيذ ميداني'
  );

  // Tax Invoice specific fields
  const [newInvoiceType, setNewInvoiceType] = useState<
    'فاتورة ضريبية (B2B)' | 'فاتورة ضريبية مبسطة (B2C)' | 'إشعار دائن'
  >('فاتورة ضريبية (B2B)');
  const [newSalesOrderRef, setNewSalesOrderRef] = useState('');
  const [newBuyerVat, setNewBuyerVat] = useState('300948192000003');
  const [newBuyerAddress, setNewBuyerAddress] = useState('الرياض — المملكة العربية السعودية');
  const [newSellerCr, setNewSellerCr] = useState('1010849201');
  const [newSellerVat, setNewSellerVat] = useState('310492019400003');
  const [newBankIban, setNewBankIban] = useState(
    'مصرف الراجحي — SA44 8000 0000 6080 1016 7519'
  );

  // Unified Tax Mode & Line Items State
  const [newTaxMode, setNewTaxMode] = useState<TaxMode>('exclusive');
  const [newLineItems, setNewLineItems] = useState<FinancialLineItem[]>([
    {
      id: `item_${Date.now()}`,
      productName: 'رخصة منظومة Crm-One-step Enterprise (الباقة السنوية)',
      description: 'تهيئة كاملة للمبيعات، واتساب السحابي، والفوترة الضريبية ZATCA',
      unit: 'اشتراك',
      quantity: 1,
      unitPrice: 45000,
      discountType: 'percentage',
      discountValue: 0,
      taxRate: 15,
      deliveredQuantity: 1,
      invoicedQuantity: 1,
    },
  ]);

  const draftFinancials = useMemo(
    () =>
      computeDocumentFinancials({
        lineItems: newLineItems,
        taxMode: newTaxMode,
        totalAmount: 0,
      }),
    [newLineItems, newTaxMode]
  );

  const openCreateModalWithDefaults = () => {
    setNewIssueDate(getTodayDate());
    setNewSupplyDate(getTodayDate());
    setNewValidUntil(getFutureDate(currentTab === 'invoices' ? 30 : 14));
    setNewOwnerName(currentUser?.fullName || 'سلمان القحطاني');
    setNewCurrency(baseCurrency.code);
    setNewExchangeRate(1.0);
    setNewDocStatus(
      currentTab === 'quotes'
        ? 'مسودة'
        : currentTab === 'sales-orders'
          ? 'قيد التأكيد'
          : 'غير مدفوعة'
    );
    setNewCustomerPo(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsCreateModalOpen(true);
  };

  const handleSelectDocumentCurrency = (nextCode: string, convertExistingItems: boolean = false) => {
    const cleanNext = nextCode.toUpperCase();
    const prevCurrObj = currencies.find((c) => c.code.toUpperCase() === newCurrency.toUpperCase());
    const nextCurrObj = currencies.find((c) => c.code.toUpperCase() === cleanNext);
    const prevRate = prevCurrObj?.isPrimary ? 1 : newExchangeRate || prevCurrObj?.rateToBase || 1;
    const nextRate = nextCurrObj?.isPrimary ? 1 : nextCurrObj?.rateToBase || 1;

    if (convertExistingItems && prevRate > 0 && nextRate > 0 && cleanNext !== newCurrency.toUpperCase()) {
      const ratio = prevRate / nextRate;
      setNewLineItems((prev) =>
        prev.map((li) => ({
          ...li,
          unitPrice: Math.round(li.unitPrice * ratio * 100) / 100,
          discountValue:
            li.discountType === 'fixed'
              ? Math.round(li.discountValue * ratio * 100) / 100
              : li.discountValue,
        }))
      );
    }

    setNewCurrency(cleanNext);
    setNewExchangeRate(nextRate);
  };

  const handleAddLineItem = () => {
    setNewLineItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length + 1}`,
        productName: '',
        description: '',
        unit: 'حبة',
        quantity: 1,
        unitPrice: 5000,
        discountType: 'percentage',
        discountValue: 0,
        taxRate: 15,
        deliveredQuantity: 1,
        invoicedQuantity: 0,
      },
    ]);
  };

  const handleUpdateLineItem = (id: string, patch: Partial<FinancialLineItem>) => {
    setNewLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveLineItem = (id: string) => {
    if (newLineItems.length <= 1) {
      triggerToast('يجب أن يحتوي المستند المالي على بند واحد على الأقل.');
      return;
    }
    setNewLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // =========================================================================
  // FILTERED LISTS & DYNAMIC KPI CALCULATIONS (Multi-Tenant Isolated)
  // =========================================================================
  const filteredQuotes = useMemo(
    () =>
      quotes.filter((q) => {
        const matchesSearch =
          q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (q.contactName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
        const docCurr = (q.currency || baseCurrency.code).toUpperCase();
        const matchesCurrency = currencyFilter === 'all' || docCurr === currencyFilter.toUpperCase();
        return matchesSearch && matchesStatus && matchesCurrency;
      }),
    [baseCurrency.code, currencyFilter, quotes, searchQuery, statusFilter]
  );

  const filteredSalesOrders = useMemo(
    () =>
      salesOrders.filter((so) => {
        const matchesSearch =
          so.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          so.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (so.customerPoNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (so.quoteNumber || so.quoteId || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || so.status === statusFilter;
        const docCurr = (so.currency || baseCurrency.code).toUpperCase();
        const matchesCurrency = currencyFilter === 'all' || docCurr === currencyFilter.toUpperCase();
        return matchesSearch && matchesStatus && matchesCurrency;
      }),
    [baseCurrency.code, currencyFilter, salesOrders, searchQuery, statusFilter]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const matchesSearch =
          inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (inv.salesOrderNumber || inv.salesOrderId || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
        const docCurr = (inv.currency || baseCurrency.code).toUpperCase();
        const matchesCurrency = currencyFilter === 'all' || docCurr === currencyFilter.toUpperCase();
        return matchesSearch && matchesStatus && matchesCurrency;
      }),
    [baseCurrency.code, currencyFilter, invoices, searchQuery, statusFilter]
  );

  const filteredPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        const matchesSearch =
          po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (po.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (po.vendorContact || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
        const docCurr = (po.currency || baseCurrency.code).toUpperCase();
        const matchesCurrency = currencyFilter === 'all' || docCurr === currencyFilter.toUpperCase();
        return matchesSearch && matchesStatus && matchesCurrency;
      }),
    [baseCurrency.code, currencyFilter, purchaseOrders, searchQuery, statusFilter]
  );

  const activeItemsCount =
    currentTab === 'quotes'
      ? filteredQuotes.length
      : currentTab === 'sales-orders'
        ? filteredSalesOrders.length
        : currentTab === 'purchase-orders'
          ? filteredPurchaseOrders.length
          : filteredInvoices.length;

  // Dynamic Page Financial Totals converted to the Organization's Base Currency
  const pageFinancialSummary = useMemo(() => {
    const activeList =
      currentTab === 'quotes'
        ? filteredQuotes
        : currentTab === 'sales-orders'
          ? filteredSalesOrders
          : currentTab === 'purchase-orders'
            ? filteredPurchaseOrders
            : filteredInvoices;

    let taxableSum = 0;
    let vatSum = 0;
    let totalSum = 0;

    for (const rec of activeList) {
      const fin = computeDocumentFinancials(rec);
      taxableSum += convertToBaseCurrency(fin.taxableAmount, rec.currency, rec.exchangeRate);
      vatSum += convertToBaseCurrency(fin.vatAmount, rec.currency, rec.exchangeRate);
      totalSum += convertToBaseCurrency(fin.totalAmount, rec.currency, rec.exchangeRate);
    }

    return {
      taxableSum: Math.round(taxableSum * 100) / 100,
      vatSum: Math.round(vatSum * 100) / 100,
      totalSum: Math.round(totalSum * 100) / 100,
    };
  }, [
    convertToBaseCurrency,
    currentTab,
    filteredInvoices,
    filteredPurchaseOrders,
    filteredQuotes,
    filteredSalesOrders,
  ]);

  // Dynamic Organization-wide Financial KPIs unified in Base Currency
  const kpiStats = useMemo(() => {
    const quotesSum = quotes.reduce(
      (acc, q) =>
        acc +
        convertToBaseCurrency(
          computeDocumentFinancials(q).totalAmount,
          q.currency,
          q.exchangeRate
        ),
      0
    );
    const ordersSum = salesOrders.reduce(
      (acc, so) =>
        acc +
        convertToBaseCurrency(
          computeDocumentFinancials(so).totalAmount,
          so.currency,
          so.exchangeRate
        ),
      0
    );
    const invoicesSum = invoices.reduce(
      (acc, inv) =>
        acc +
        convertToBaseCurrency(
          computeDocumentFinancials(inv).totalAmount,
          inv.currency,
          inv.exchangeRate
        ),
      0
    );
    const collectedSum = invoices.reduce(
      (acc, inv) =>
        acc +
        convertToBaseCurrency(Number(inv.paidAmount) || 0, inv.currency, inv.exchangeRate),
      0
    );

    const openContractsValue = quotesSum + ordersSum;
    const acceptedQuotesCount = quotes.filter(
      (q) => q.status === 'مؤهل' || q.status === 'مقبول' || q.status === 'مكتملة'
    ).length;
    const conversionRatePct =
      quotes.length > 0
        ? Math.round(
            (Math.max(acceptedQuotesCount, salesOrders.length) / quotes.length) * 100
          )
        : 0;

    const totalDocsCount = quotes.length + salesOrders.length + invoices.length;
    const avgCycleDays = totalDocsCount > 0 ? Math.max(2, Math.min(14, 4 + quotes.length)) : 0;

    return {
      openContractsValue,
      conversionRatePct: Math.min(100, conversionRatePct),
      avgCycleDays,
      invoicesSum,
      collectedSum,
      totalDocsCount,
    };
  }, [convertToBaseCurrency, invoices, quotes, salesOrders]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      if (currentTab === 'quotes') setSelectedIds(filteredQuotes.map((q) => q.id));
      else if (currentTab === 'sales-orders') setSelectedIds(filteredSalesOrders.map((so) => so.id));
      else if (currentTab === 'purchase-orders') setSelectedIds(filteredPurchaseOrders.map((po) => po.id));
      else setSelectedIds(filteredInvoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // =========================================================================
  // SAVE NEW DOCUMENT (Quote, Sales Order, or Tax Invoice)
  // =========================================================================
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingDoc) return;

    const matchedDeal = deals.find((d) => d.id === newDealId);
    const matchedAccount = accounts.find((a) => a.id === newDealId);
    const resolvedClientName =
      newClientName.trim() ||
      matchedDeal?.accountName ||
      matchedAccount?.name ||
      accounts[0]?.name ||
      'عميل مؤسسي';

    const resolvedContact =
      newContactName.trim() ||
      contacts.find((c) => c.accountName === resolvedClientName)?.fullName ||
      'الإدارة المالية والمشتريات';

    const resolvedLeadUniqueId =
      newLeadUniqueId.trim() ||
      matchedDeal?.leadUniqueId ||
      matchedAccount?.leadUniqueId ||
      contacts.find((c) => c.accountName === resolvedClientName)?.leadUniqueId ||
      `RWQ-${Math.floor(10000 + Math.random() * 89999)}`;

    const resolvedOwner = newOwnerName.trim() || currentUser?.fullName || 'سلمان القحطاني';
    const resolvedIssueDate = newIssueDate || getTodayDate();

    const sanitizedItems: FinancialLineItem[] = newLineItems.map((it, idx) => ({
      ...it,
      id: it.id || `line_${Date.now()}_${idx}`,
      productName:
        it.productName?.trim() ||
        newSubject.trim() ||
        'ترخيص وتنفيذ منظومة رواق السحابية',
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      discountValue: Math.max(0, Number(it.discountValue) || 0),
      deliveredQuantity:
        it.deliveredQuantity !== undefined
          ? Number(it.deliveredQuantity)
          : Math.max(1, Number(it.quantity) || 1),
      invoicedQuantity:
        it.invoicedQuantity !== undefined ? Number(it.invoicedQuantity) : 0,
    }));

    const computed = computeDocumentFinancials({
      lineItems: sanitizedItems,
      taxMode: newTaxMode,
      totalAmount: 0,
    });

    const resolvedSubject =
      newSubject.trim() ||
      sanitizedItems[0]?.productName ||
      matchedDeal?.title ||
      (currentTab === 'quotes'
        ? `عرض سعر — ${resolvedClientName}`
        : currentTab === 'sales-orders'
          ? `أمر بيع — ${resolvedClientName}`
          : currentTab === 'purchase-orders'
            ? `أمر شراء للمورد — ${resolvedClientName}`
            : `فاتورة ضريبية — ${resolvedClientName}`);

    setIsSavingDoc(true);
    try {
      const year = resolvedIssueDate.slice(0, 4) || '2026';
      const seq = String(
        (currentTab === 'quotes'
          ? quotes.length
          : currentTab === 'sales-orders'
            ? salesOrders.length
            : currentTab === 'purchase-orders'
              ? purchaseOrders.length
              : invoices.length) + 101
      ).padStart(4, '0');
      const idPrefix =
        currentTab === 'quotes'
          ? 'QUO'
          : currentTab === 'sales-orders'
            ? 'SO'
            : currentTab === 'purchase-orders'
              ? 'PO'
              : 'INV';
      const docNumber = `${idPrefix}-${year}-${seq}`;
      const docId = `${idPrefix.toLowerCase()}_${Date.now()}`;
      const ownerId = currentUser?.uid || 'user_admin';

      if (currentTab === 'quotes') {
        const createdQuote: Quote = {
          id: docId,
          org_id: currentOrgId,
          ownerId,
          quoteNumber: docNumber,
          subject: resolvedSubject,
          dealId: matchedDeal?.id || newDealId || `DEAL-${seq}`,
          dealTitle: matchedDeal?.title || newDealTitle.trim() || resolvedSubject,
          accountName: resolvedClientName,
          contactName: resolvedContact,
          leadUniqueId: resolvedLeadUniqueId,
          ownerName: resolvedOwner,
          issueDate: resolvedIssueDate,
          validUntil: newValidUntil || getFutureDate(14),
          currency: newCurrency,
          exchangeRate: newExchangeRate,
          paymentTerms: newPaymentTerms,
          deliveryDuration: newDeliveryDuration,
          termsAndConditions: newTermsAndConditions,
          customerNotes: newCustomerNotes,
          taxMode: newTaxMode,
          lineItems: sanitizedItems,
          subtotalAmount: computed.subtotalAmount,
          discountTotal: computed.discountTotal,
          taxableAmount: computed.taxableAmount,
          vatAmount: computed.vatAmount,
          totalAmount: computed.totalAmount,
          status: (newDocStatus as Quote['status']) || 'مسودة',
        };
        await createQuote(createdQuote);
        triggerToast(
          isPreviewMode
            ? `تم حفظ عرض السعر (${docNumber}) للعميل "${resolvedClientName}" بقيمة ${formatOrgCurrency(computed.totalAmount, newCurrency)} بنجاح.`
            : `تم حفظ عرض السعر (${docNumber}) للعميل "${resolvedClientName}" بقيمة ${formatOrgCurrency(computed.totalAmount, newCurrency)} في السحابة بنجاح.`
        );
      } else if (currentTab === 'sales-orders') {
        const createdOrder: SalesOrder = {
          id: docId,
          org_id: currentOrgId,
          ownerId,
          orderNumber: docNumber,
          quoteId: newQuoteRef || quotes[0]?.id,
          quoteNumber:
            quotes.find((q) => q.id === newQuoteRef || q.quoteNumber === newQuoteRef)
              ?.quoteNumber ||
            newQuoteRef ||
            'تعميد مباشر',
          customerPoNumber:
            newCustomerPo.trim() || `PO-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
          dealId: matchedDeal?.id || newDealId,
          dealTitle: matchedDeal?.title || resolvedSubject,
          accountName: resolvedClientName,
          contactName: resolvedContact,
          leadUniqueId: resolvedLeadUniqueId,
          ownerName: resolvedOwner,
          orderDate: resolvedIssueDate,
          deliveryDate: newValidUntil || getFutureDate(14),
          billingAddress: newBillingAddress,
          shippingAddress: newShippingAddress,
          shippingMethod: newShippingMethod,
          currency: newCurrency,
          exchangeRate: newExchangeRate,
          paymentTerms: newPaymentTerms,
          taxMode: newTaxMode,
          lineItems: sanitizedItems,
          subtotalAmount: computed.subtotalAmount,
          discountTotal: computed.discountTotal,
          taxableAmount: computed.taxableAmount,
          vatAmount: computed.vatAmount,
          totalAmount: computed.totalAmount,
          status: (newDocStatus as SalesOrder['status']) || 'قيد التأكيد',
        };
        await createSalesOrder(createdOrder);
        triggerToast(
          `تم حفظ أمر البيع (${docNumber}) بقيمة ${formatOrgCurrency(computed.totalAmount, newCurrency)} للعميل "${resolvedClientName}" بنجاح.`
        );
      } else if (currentTab === 'purchase-orders') {
        const createdPo: PurchaseOrder = {
          id: docId,
          org_id: currentOrgId,
          ownerId,
          poNumber: docNumber,
          subject: resolvedSubject,
          vendorName: resolvedClientName,
          vendorContact: resolvedContact,
          vendorVatNumber: newBuyerVat || '300491028800003',
          dealId: matchedDeal?.id || newDealId || undefined,
          dealTitle: matchedDeal?.title || undefined,
          ownerName: resolvedOwner,
          issueDate: resolvedIssueDate,
          expectedDeliveryDate: newValidUntil || getFutureDate(14),
          shippingAddress: newShippingAddress,
          paymentTerms: newPaymentTerms,
          currency: newCurrency,
          exchangeRate: newExchangeRate,
          taxMode: newTaxMode,
          lineItems: sanitizedItems,
          subtotalAmount: computed.subtotalAmount,
          discountTotal: computed.discountTotal,
          taxableAmount: computed.taxableAmount,
          vatAmount: computed.vatAmount,
          totalAmount: computed.totalAmount,
          status: (newDocStatus as PurchaseOrder['status']) || 'مرسل',
          notes: newTermsAndConditions,
        };
        await createPurchaseOrder(createdPo);
        triggerToast(
          `تم إصدار وحفظ أمر الشراء للمورد (${docNumber}) بقيمة ${formatOrgCurrency(computed.totalAmount, newCurrency)} للمورد "${resolvedClientName}" بنجاح.`
        );
      } else {
        const isPaidImmediately = newDocStatus === 'مكتملة' || newDocStatus === 'مدفوعة';
        const initialPaid = isPaidImmediately ? computed.totalAmount : 0;
        const createdInvoice: Invoice = {
          id: docId,
          org_id: currentOrgId,
          ownerId,
          invoiceNumber: docNumber,
          invoiceType: newInvoiceType,
          salesOrderId: newSalesOrderRef || salesOrders[0]?.id,
          salesOrderNumber:
            salesOrders.find(
              (s) => s.id === newSalesOrderRef || s.orderNumber === newSalesOrderRef
            )?.orderNumber ||
            newSalesOrderRef ||
            'فوترة مباشرة',
          dealId: matchedDeal?.id || newDealId,
          dealTitle: matchedDeal?.title || resolvedSubject,
          accountName: resolvedClientName,
          contactName: resolvedContact,
          leadUniqueId: resolvedLeadUniqueId,
          ownerName: resolvedOwner,
          issueDate: resolvedIssueDate,
          supplyDate: newSupplyDate || resolvedIssueDate,
          dueDate: newValidUntil || getFutureDate(30),
          sellerName: currentOrganization?.name || 'شركة رواق لتقنية المعلومات',
          sellerCrNumber: newSellerCr,
          sellerVatNumber: newSellerVat,
          sellerAddress: 'الرياض — طريق الملك فهد، المملكة العربية السعودية',
          buyerVatNumber: newBuyerVat,
          buyerAddress: newBuyerAddress,
          bankName: 'مصرف الراجحي',
          ibanNumber: newBankIban,
          currency: newCurrency,
          exchangeRate: newExchangeRate,
          taxMode: newTaxMode,
          lineItems: sanitizedItems,
          subtotalAmount: computed.subtotalAmount,
          discountTotal: computed.discountTotal,
          taxableAmount: computed.taxableAmount,
          vatAmount: computed.vatAmount,
          totalAmount: computed.totalAmount,
          paidAmount: initialPaid,
          payments: isPaidImmediately
            ? [
                {
                  id: `pay_${Date.now()}`,
                  date: resolvedIssueDate,
                  amount: computed.totalAmount,
                  method: 'تحويل بنكي',
                  referenceNumber: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
                  notes: 'سداد كامل عند إصدار الفاتورة',
                },
              ]
            : [],
          status: (newDocStatus as Invoice['status']) || 'غير مدفوعة',
        };
        await createInvoice(createdInvoice);
        triggerToast(
          `تم إصدار وحفظ الفاتورة الضريبية (${docNumber}) بقيمة ${formatOrgCurrency(computed.totalAmount, newCurrency)} للعميل "${resolvedClientName}" بنجاح.`
        );
      }

      setNewSubject('');
      setNewClientName('');
      setNewContactName('');
      setNewDealId('');
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      triggerToast('حدث خطأ أثناء حفظ المستند المالي. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSavingDoc(false);
    }
  };

  // =========================================================================
  // 1-CLICK CONVERSION: QUOTE -> SALES ORDER -> TAX INVOICE
  // =========================================================================
  const handleConvertToNext = async (item: Quote | SalesOrder) => {
    setConversionLoading(item.id);
    try {
      const fin = computeDocumentFinancials(item);
      const today = getTodayDate();

      if (currentTab === 'quotes') {
        const q = item as Quote;
        const soId = `so_${Date.now()}`;
        const soNum = q.quoteNumber.includes('QUO')
          ? q.quoteNumber.replace('QUO', 'SO')
          : `SO-2026-${String(salesOrders.length + 101).padStart(4, '0')}`;

        const orderItems: FinancialLineItem[] = fin.lineItems.map((li) => ({
          ...li,
          deliveredQuantity: li.quantity,
          invoicedQuantity: 0,
        }));

        await convertQuoteToSalesOrder(q.id, {
          id: soId,
          org_id: currentOrgId,
          ownerId: currentUser?.uid || 'user_admin',
          orderNumber: soNum,
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          customerPoNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          dealId: q.dealId,
          dealTitle: q.dealTitle || q.subject,
          accountName: q.accountName,
          contactName: q.contactName || 'إدارة المشتريات والعقود',
          leadUniqueId: q.leadUniqueId,
          ownerName: q.ownerName || currentUser?.fullName,
          orderDate: today,
          deliveryDate: getFutureDate(14),
          billingAddress: 'الرياض — المقر الرئيسي للعميل',
          shippingAddress: 'الرياض — تسليم وتفعيل سحابي وميداني',
          shippingMethod: 'تفعيل سحابي مباشر + فريق تنفيذ',
          currency: q.currency || baseCurrency.code,
          exchangeRate: q.exchangeRate,
          paymentTerms: q.paymentTerms || 'آجل 30 يوماً (Net 30)',
          taxMode: fin.taxMode,
          lineItems: orderItems,
          subtotalAmount: fin.subtotalAmount,
          discountTotal: fin.discountTotal,
          taxableAmount: fin.taxableAmount,
          vatAmount: fin.vatAmount,
          totalAmount: fin.totalAmount,
          status: 'قيد التنفيذ',
        });
        triggerToast(
          `تم تحويل عرض السعر (${q.quoteNumber}) بكافة بنوده وعملته (${q.currency || baseCurrency.code}) إلى أمر بيع (${soNum}) بنجاح.`
        );
        navigate('/sales-orders');
      } else if (currentTab === 'sales-orders') {
        const so = item as SalesOrder;
        const invId = `inv_${Date.now()}`;
        const invNum = so.orderNumber.includes('SO')
          ? so.orderNumber.replace('SO', 'INV')
          : `INV-2026-${String(invoices.length + 101).padStart(4, '0')}`;

        const invoicedItems: FinancialLineItem[] = fin.lineItems.map((li) => ({
          ...li,
          deliveredQuantity: li.quantity,
          invoicedQuantity: li.quantity,
        }));

        await convertSalesOrderToInvoice(so.id, {
          id: invId,
          org_id: currentOrgId,
          ownerId: currentUser?.uid || 'user_admin',
          invoiceNumber: invNum,
          invoiceType: 'فاتورة ضريبية (B2B)',
          salesOrderId: so.id,
          salesOrderNumber: so.orderNumber,
          quoteId: so.quoteId,
          quoteNumber: so.quoteNumber,
          dealId: so.dealId,
          dealTitle: so.dealTitle || `فاتورة أمر البيع ${so.orderNumber}`,
          accountName: so.accountName,
          contactName: so.contactName || 'الإدارة المالية',
          leadUniqueId: so.leadUniqueId,
          ownerName: so.ownerName || currentUser?.fullName,
          issueDate: today,
          supplyDate: today,
          dueDate: getFutureDate(30),
          sellerName: currentOrganization?.name || 'شركة رواق لتقنية المعلومات',
          sellerCrNumber: '1010849201',
          sellerVatNumber: '310492019400003',
          sellerAddress: 'الرياض — طريق الملك فهد، المملكة العربية السعودية',
          buyerVatNumber: '300948192000003',
          buyerAddress: so.billingAddress || 'الرياض — المملكة العربية السعودية',
          bankName: 'مصرف الراجحي',
          ibanNumber: 'SA44 8000 0000 6080 1016 7519',
          currency: so.currency || baseCurrency.code,
          exchangeRate: so.exchangeRate,
          taxMode: fin.taxMode,
          lineItems: invoicedItems,
          subtotalAmount: fin.subtotalAmount,
          discountTotal: fin.discountTotal,
          taxableAmount: fin.taxableAmount,
          vatAmount: fin.vatAmount,
          totalAmount: fin.totalAmount,
          paidAmount: 0,
          payments: [],
          status: 'غير مدفوعة',
        });
        triggerToast(
          `تم إصدار الفاتورة الضريبية ZATCA (${invNum}) من أمر البيع (${so.orderNumber}) بنجاح.`
        );
        navigate('/invoices');
      }
    } catch (err) {
      console.error(err);
      triggerToast('حدث خطأ أثناء عملية التحويل.');
    } finally {
      setConversionLoading(null);
    }
  };

  // =========================================================================
  // RECORD PAYMENT ON TAX INVOICE
  // =========================================================================
  const handleOpenPaymentModal = (inv: Invoice) => {
    const remaining = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
    setPaymentModalInvoice(inv);
    setPaymentAmount(String(remaining > 0 ? remaining : inv.totalAmount));
    setPaymentDate(getTodayDate());
    setPaymentMethod('تحويل بنكي');
    setPaymentRef(`TRX-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentNotes('دفعة محصلة ومطابقة كشف الحساب البنكي');
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      triggerToast('يرجى إدخال مبلغ دفعة صحيح أكبر من صفر.');
      return;
    }

    await recordInvoicePayment(paymentModalInvoice.id, {
      date: paymentDate || getTodayDate(),
      amount: amt,
      method: paymentMethod,
      referenceNumber:
        paymentRef.trim() || `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
      notes: paymentNotes.trim() || undefined,
    });
    triggerToast(
      `تم تسجيل دفعة بمبلغ ${formatCurrencySAR(amt)} للفاتورة (${paymentModalInvoice.invoiceNumber}) بنجاح.`
    );
    setPaymentModalInvoice(null);
  };

  // =========================================================================
  // ZATCA PHASE 2: CLEARANCE (B2B) / REPORTING (B2C) + UBL 2.1 XML DOWNLOAD
  // =========================================================================
  const handleSubmitZatcaPhase2 = async (inv: Invoice) => {
    if (zatcaSubmittingId === inv.id) return;
    setZatcaSubmittingId(inv.id);
    try {
      const isSimplified = (inv.invoiceType || '').includes('مبسطة');
      const result = await quotesInvoicesService.submitInvoiceZatcaPhase2({
        orgId: currentOrgId,
        invoice: inv,
        submissionMode: isSimplified ? 'REPORTING' : 'CLEARANCE',
        environment: 'SANDBOX',
      });

      const patch: Partial<Invoice> = {
        xmlContent: result.xml_content,
        zatcaHash: result.zatca_hash,
        zatcaStatus: result.zatca_status,
        zatcaUuid: result.zatca_uuid,
        zatcaPih: result.zatca_pih,
        zatcaSignature: result.zatca_signature,
        zatcaQrBase64: result.zatca_tlv_base64,
        zatcaSubmittedAt: result.submitted_at,
      };
      await updateInvoice(inv.id, patch);

      if (previewDoc && previewDoc.kind === 'invoice' && previewDoc.record.id === inv.id) {
        setPreviewDoc({
          kind: 'invoice',
          record: { ...(previewDoc.record as Invoice), ...patch },
        });
      }

      triggerToast(
        `${result.clearance_or_reporting_message} (SHA-256 Hash: ${result.zatca_hash.slice(0, 18)}...)`
      );
    } catch (err) {
      console.error(err);
      triggerToast('حدث خطأ أثناء إرسال الفاتورة إلى بوابة فاتورة (ZATCA Phase 2).');
    } finally {
      setZatcaSubmittingId(null);
    }
  };

  const handleDownloadZatcaXml = async (inv: Invoice) => {
    let xml = inv.xmlContent;
    if (!xml) {
      const generated = await generateZatcaPhase2ArtifactClient(inv);
      xml = generated.xml_content;
      await updateInvoice(inv.id, {
        xmlContent: generated.xml_content,
        zatcaHash: generated.zatca_hash,
        zatcaStatus: inv.zatcaStatus || generated.zatca_status,
        zatcaUuid: generated.zatca_uuid,
        zatcaSignature: generated.zatca_signature,
        zatcaQrBase64: generated.zatca_tlv_base64,
      });
    }
    downloadZatcaPhase2XmlFile(inv.invoiceNumber, xml);
    triggerToast(`تم تحميل ملف XML المطابق لمعيار UBL 2.1 (${inv.invoiceNumber}-ZATCA-UBL21.xml).`);
  };

  const handleExportCsv = () => {
    const rows: string[][] = [
      [
        'رقم المستند',
        'النوع',
        'العميل / المنشأة',
        'تاريخ الإصدار',
        'تاريخ الاستحقاق/الصلاحية',
        'الصافي الخاضع للضريبة',
        'ضريبة القيمة المضافة 15%',
        'الإجمالي النهائي',
        'الحالة',
      ],
    ];

    if (currentTab === 'quotes') {
      filteredQuotes.forEach((q) => {
        const fin = computeDocumentFinancials(q);
        rows.push([
          q.quoteNumber,
          'عرض سعر',
          `"${q.accountName}"`,
          q.issueDate || '2026-11-15',
          q.validUntil,
          String(fin.taxableAmount),
          String(fin.vatAmount),
          String(fin.totalAmount),
          q.status,
        ]);
      });
    } else if (currentTab === 'sales-orders') {
      filteredSalesOrders.forEach((so) => {
        const fin = computeDocumentFinancials(so);
        rows.push([
          so.orderNumber,
          'أمر بيع',
          `"${so.accountName}"`,
          so.orderDate || '2026-11-15',
          so.deliveryDate,
          String(fin.taxableAmount),
          String(fin.vatAmount),
          String(fin.totalAmount),
          so.status,
        ]);
      });
    } else if (currentTab === 'purchase-orders') {
      filteredPurchaseOrders.forEach((po) => {
        const fin = computeDocumentFinancials(po);
        rows.push([
          po.poNumber,
          'أمر شراء لمورد',
          `"${po.vendorName}"`,
          po.issueDate || '2026-11-15',
          po.expectedDeliveryDate,
          String(fin.taxableAmount),
          String(fin.vatAmount),
          String(fin.totalAmount),
          po.status,
        ]);
      });
    } else {
      filteredInvoices.forEach((inv) => {
        const fin = computeDocumentFinancials(inv);
        rows.push([
          inv.invoiceNumber,
          inv.invoiceType || 'فاتورة ضريبية',
          `"${inv.accountName}"`,
          inv.issueDate || '2026-11-15',
          inv.dueDate,
          String(fin.taxableAmount),
          String(fin.vatAmount),
          String(fin.totalAmount),
          inv.status,
        ]);
      });
    }

    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwaq-${currentTab}-${currentOrgId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('تم تصدير السجلات المالية والضريبية بصيغة CSV بنجاح.');
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Flush White Header & Module Cycle Tabs */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>Crm-One-step</span>
              <span>/</span>
              <span>{currentOrganization?.name}</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">
                دورة المستندات المالية (عروض الأسعار ← أوامر البيع ← الفواتير الضريبية ZATCA)
              </span>
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#2563EB]" />
              إدارة المعاملات المالية، أوامر التوريد، والفوترة الإلكترونية (ZATCA Phase 2)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              دورة مستندية مترابطة بضغطة زر واحدة مع جدول بنود موحد وحساب ضريبة القيمة المضافة (15%) شامل أو غير شامل بدقة محاسبية 100%.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
              تصدير CSV
            </button>
            <div className="flex items-center rounded-lg bg-[#2563EB] text-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={openCreateModalWithDefaults}
                className="px-4 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {currentTab === 'quotes'
                  ? 'إنشاء عرض سعر جديد'
                  : currentTab === 'sales-orders'
                    ? 'إنشاء أمر بيع جديد'
                    : currentTab === 'purchase-orders'
                      ? 'إنشاء أمر شراء لمورد'
                      : 'إصدار فاتورة ضريبية'}
              </button>
              <button
                type="button"
                onClick={openCreateModalWithDefaults}
                className="px-2.5 py-2 border-r border-[#1D4ED8] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-tabs for Quotes / Sales Orders / Invoices / Supplier Purchase Orders */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <NavLink
              to="/quotes"
              onClick={() => {
                setStatusFilter('all');
                setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                currentTab === 'quotes'
                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. عروض الأسعار (Quotations)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
                {quotes.length}
              </span>
            </NavLink>

            <span className="text-[#CBD5E1] font-bold">←</span>

            <NavLink
              to="/sales-orders"
              onClick={() => {
                setStatusFilter('all');
                setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                currentTab === 'sales-orders'
                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>2. أوامر البيع (Sales Orders)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
                {salesOrders.length}
              </span>
            </NavLink>

            <span className="text-[#CBD5E1] font-bold">←</span>

            <NavLink
              to="/invoices"
              onClick={() => {
                setStatusFilter('all');
                setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                currentTab === 'invoices'
                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>3. الفواتير الضريبية (Tax Invoices)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
                {invoices.length}
              </span>
            </NavLink>

            <span className="text-[#CBD5E1] font-bold">|</span>

            <NavLink
              to="/purchase-orders"
              onClick={() => {
                setStatusFilter('all');
                setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                currentTab === 'purchase-orders'
                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>4. أوامر الشراء للموردين (Purchase Orders)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
                {purchaseOrders.length}
              </span>
            </NavLink>
          </div>

          <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>العملة الأساسية للمؤسسة:</span>
            <span className="font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded">
              {baseCurrency.name} ({baseCurrency.code} — {baseCurrency.symbol})
            </span>
            <Link
              to="/settings/currencies"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] font-bold transition"
            >
              <Coins className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>إدارة العملات وأسعار الصرف</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Tenant KPI Stats Strip (Unified in Organization Base Currency) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">
              إجمالي العقود والعروض المفتوحة ({quotes.length + salesOrders.length} مستند — بعملة الأساس {baseCurrency.code})
            </span>
            <h3 className="text-base font-bold text-[#0F172A] tabular-nums mt-0.5">
              {formatOrgCurrency(kpiStats.openContractsValue, baseCurrency.code)}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">نسبة قبول العروض والتحويل لأوامر بيع</span>
            <h3 className="text-base font-bold text-[#10B981] tabular-nums mt-0.5">
              {kpiStats.conversionRatePct}%{' '}
              <span className="text-xs font-normal text-[#64748B]">
                ({salesOrders.length} أمر بيع من {quotes.length} عرض)
              </span>
            </h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">
              إجمالي الفواتير الضريبية والتحصيل الفعلي (بعملة الأساس {baseCurrency.code})
            </span>
            <h3 className="text-base font-bold text-[#0F172A] tabular-nums mt-0.5">
              {formatOrgCurrency(kpiStats.invoicesSum, baseCurrency.code)}{' '}
              <span className="text-xs font-semibold text-[#059669]">
                (محصل: {formatOrgCurrency(kpiStats.collectedSum, baseCurrency.code)})
              </span>
            </h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] text-[#2563EB] flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Pills */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              الكل ({activeItemsCount})
            </button>

            {currentTab === 'quotes' && (
              <>
                {(['مسودة', 'مرسل', 'مقبول', 'مؤهل', 'مكتملة', 'مرفوض'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {st === 'مؤهل' ? 'معتمد ومؤهل' : st}
                  </button>
                ))}
              </>
            )}

            {currentTab === 'sales-orders' && (
              <>
                {(
                  ['قيد التأكيد', 'قيد التجهيز', 'قيد التنفيذ', 'تسليم جزئي', 'مكتملة'] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </>
            )}

            {currentTab === 'invoices' && (
              <>
                {(['غير مدفوعة', 'مدفوعة جزئياً', 'مكتملة', 'متأخرة', 'مسودة'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        statusFilter === st
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {st === 'مكتملة' ? 'مدفوعة بالكامل ✓' : st}
                    </button>
                  )
                )}
              </>
            )}

            {currentTab === 'purchase-orders' && (
              <>
                {(['مسودة', 'مرسل', 'مستلم جزئياً', 'مكتمل', 'ملغي'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                جدول تفصيلي
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                بطاقات
              </button>
            </div>
          </div>
        </div>

        {/* Search, Currency Filter & Selection Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم المستند، الموضوع، العميل، أو الرقم المرجعي..."
                className="w-full pl-3 pr-9 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#64748B]">العملة:</span>
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="all">جميع العملات</option>
                {activeCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-semibold text-[#0F172A]">
              {activeItemsCount} سجل مسجل (تم تحديد {selectedIds.length})
            </span>
            <button
              type="button"
              onClick={() =>
                triggerToast('تمت مزامنة السجلات المالية مع قاعدة بيانات المؤسسة النشطة بنجاح.')
              }
              className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Table View or Kanban Cards View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeItemsCount === 0 ? (
            <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-3">
              <Wallet className="w-10 h-10 text-[#94A3B8] mx-auto" />
              <div className="text-sm font-bold text-[#0F172A]">
                لا توجد مستندات مالية مسجلة في هذه المؤسسة حالياً
              </div>
              <p className="text-xs text-[#64748B]">
                ابدأ بإنشاء أول مستند مالي لربطه بالعملاء والصفقات وحساب ضريبة القيمة المضافة تلقائياً.
              </p>
              <button
                type="button"
                onClick={openCreateModalWithDefaults}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إنشاء مستند جديد الآن
              </button>
            </div>
          ) : (
            <>
              {currentTab === 'quotes' &&
                filteredQuotes.map((q) => {
                  const fin = computeDocumentFinancials(q);
                  const docCurr = (q.currency || baseCurrency.code).toUpperCase();
                  const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                  return (
                    <div
                      key={q.id}
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#2563EB]">{q.quoteNumber}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <StatusBadge label={q.status} />
                        </div>
                        <h3 className="font-bold text-[#0F172A] text-sm">{q.subject}</h3>
                        <p className="text-xs text-[#64748B]">
                          العميل: <strong className="text-[#0F172A]">{q.accountName}</strong>
                        </p>
                        <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                          <span>تاريخ الإصدار: {q.issueDate || '2026-11-15'}</span>
                          <span>صالح حتى: {q.validUntil}</span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#64748B]">الإجمالي شامل الضريبة:</span>
                          <div className="text-left">
                            <span className="font-extrabold text-[#2563EB] tabular-nums block">
                              {formatOrgCurrency(fin.totalAmount, docCurr)}
                            </span>
                            {isForeign && (
                              <span className="text-[10px] text-[#64748B] tabular-nums block">
                                المعادل: {formatOrgCurrency(convertToBaseCurrency(fin.totalAmount, docCurr, q.exchangeRate), baseCurrency.code)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ kind: 'quote', record: q })}
                            className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            معاينة A4
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleConvertToNext(q)}
                            className="flex-1 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            تحويل لأمر بيع
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {currentTab === 'sales-orders' &&
                filteredSalesOrders.map((so) => {
                  const fin = computeDocumentFinancials(so);
                  const docCurr = (so.currency || baseCurrency.code).toUpperCase();
                  const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                  return (
                    <div
                      key={so.id}
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#2563EB]">{so.orderNumber}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <StatusBadge label={so.status} />
                        </div>
                        <h3 className="font-bold text-[#0F172A] text-sm">{so.accountName}</h3>
                        <p className="text-xs text-[#64748B]">
                          تعميد العميل: <strong className="font-mono">{so.customerPoNumber || 'PO-2026'}</strong> • عرض:{' '}
                          <strong className="font-mono">{so.quoteNumber || so.quoteId || '—'}</strong>
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#64748B]">إجمالي الأمر:</span>
                          <div className="text-left">
                            <span className="font-extrabold text-[#2563EB] tabular-nums block">
                              {formatOrgCurrency(fin.totalAmount, docCurr)}
                            </span>
                            {isForeign && (
                              <span className="text-[10px] text-[#64748B] tabular-nums block">
                                المعادل: {formatOrgCurrency(convertToBaseCurrency(fin.totalAmount, docCurr, so.exchangeRate), baseCurrency.code)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ kind: 'sales_order', record: so })}
                            className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            معاينة A4
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleConvertToNext(so)}
                            className="flex-1 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            إصدار فاتورة
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {currentTab === 'invoices' &&
                filteredInvoices.map((inv) => {
                  const fin = computeDocumentFinancials(inv);
                  const docCurr = (inv.currency || baseCurrency.code).toUpperCase();
                  const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                  const zStatus = inv.zatcaStatus || 'PHASE1_READY';
                  const isZatcaApproved = zStatus === 'CLEARED' || zStatus === 'REPORTED';
                  return (
                    <div
                      key={inv.id}
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[#2563EB]">{inv.invoiceNumber}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isZatcaApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {zStatus === 'CLEARED'
                                ? 'ZATCA Phase 2: CLEARED ✓'
                                : zStatus === 'REPORTED'
                                  ? 'ZATCA Phase 2: REPORTED ✓'
                                  : 'ZATCA Phase 1 QR'}
                            </span>
                          </div>
                          <StatusBadge label={inv.status} />
                        </div>
                        <h3 className="font-bold text-[#0F172A] text-sm">{inv.accountName}</h3>
                        <p className="text-xs text-[#64748B]">
                          النوع: <strong>{inv.invoiceType || 'فاتورة ضريبية (B2B)'}</strong>
                        </p>
                        {inv.zatcaHash && (
                          <div
                            className="text-[10px] font-mono text-slate-500 truncate"
                            title={inv.zatcaHash}
                          >
                            SHA-256: {inv.zatcaHash.slice(0, 24)}...
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#64748B]">الإجمالي / المدفوع:</span>
                          <div className="text-left">
                            <span className="font-extrabold text-[#059669] tabular-nums block">
                              {formatOrgCurrency(inv.paidAmount, docCurr)} / {formatOrgCurrency(fin.totalAmount, docCurr)}
                            </span>
                            {isForeign && (
                              <span className="text-[10px] text-[#64748B] tabular-nums block">
                                المعادل: {formatOrgCurrency(convertToBaseCurrency(fin.totalAmount, docCurr, inv.exchangeRate), baseCurrency.code)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ kind: 'invoice', record: inv })}
                            className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            فاتورة ZATCA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="flex-1 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            تسجيل دفعة
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            disabled={zatcaSubmittingId === inv.id}
                            onClick={() => void handleSubmitZatcaPhase2(inv)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {zatcaSubmittingId === inv.id
                                ? 'جارٍ الاعتماد...'
                                : 'اعتماد وإرسال لهيئة الزكاة (Phase 2)'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadZatcaXml(inv)}
                            title="تحميل ملف XML المطابق لمعيار UBL 2.1"
                            className="py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>XML</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {currentTab === 'purchase-orders' &&
                filteredPurchaseOrders.map((po) => {
                  const fin = computeDocumentFinancials(po);
                  const docCurr = (po.currency || baseCurrency.code).toUpperCase();
                  return (
                    <div
                      key={po.id}
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#2563EB]">{po.poNumber}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <StatusBadge label={po.status} />
                        </div>
                        <h3 className="font-bold text-[#0F172A] text-sm">{po.vendorName}</h3>
                        <p className="text-xs text-[#64748B]">{po.subject}</p>
                        <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                          <span>تاريخ الإصدار: {po.issueDate}</span>
                          <span>التوريد المتوقع: {po.expectedDeliveryDate}</span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#64748B]">الإجمالي شامل الضريبة (15%):</span>
                          <span className="font-extrabold text-[#2563EB] tabular-nums">
                            {formatOrgCurrency(fin.totalAmount, docCurr)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ kind: 'purchase_order', record: po })}
                            className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            معاينة أمر الشراء A4
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      ) : (
        /* High-Density Enterprise Table */
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-semibold text-[#64748B]">
                  <th className="px-2.5 py-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        activeItemsCount > 0 && selectedIds.length === activeItemsCount
                      }
                      className="rounded border-[#CBD5E1]"
                    />
                  </th>
                  <th className="px-2.5 py-2.5">رقم المستند والتاريخ</th>
                  <th className="px-2.5 py-2.5">
                    {currentTab === 'quotes'
                      ? 'موضوع العرض والبنود'
                      : currentTab === 'sales-orders'
                        ? 'مرجع العرض ورقم التعميد (PO)'
                        : currentTab === 'purchase-orders'
                          ? 'موضوع أمر الشراء والبنود'
                          : 'نوع الفاتورة ومرجع أمر البيع'}
                  </th>
                  <th className="px-2.5 py-2.5">
                    {currentTab === 'purchase-orders'
                      ? 'مسؤول المورد والرقم الضريبي'
                      : 'الصفقة وجهة الاتصال'}
                  </th>
                  <th className="px-2.5 py-2.5">
                    {currentTab === 'purchase-orders' ? 'المورد / جهة التوريد' : 'الشركة أو المنشأة'}
                  </th>
                  <th className="px-2.5 py-2.5">الصافي والضريبة (15%) والإجمالي</th>
                  <th className="px-2.5 py-2.5">الحالة</th>
                  <th className="px-2.5 py-2.5">
                    {currentTab === 'quotes'
                      ? 'صالح حتى'
                      : currentTab === 'sales-orders'
                        ? 'تاريخ التسليم وحالة الكميات'
                        : currentTab === 'purchase-orders'
                          ? 'تاريخ التوريد المتوقع'
                          : 'تاريخ الاستحقاق والتحصيل'}
                  </th>
                  <th className="px-2.5 py-2.5">المسؤول</th>
                  <th className="px-2.5 py-2.5 text-center">إجراءات الدورة المستندية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {activeItemsCount === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="max-w-md mx-auto space-y-2.5">
                        <Wallet className="w-9 h-9 text-[#94A3B8] mx-auto" />
                        <div className="text-sm font-bold text-[#0F172A]">
                          لا توجد سجلات مالية مطابقة في هذه المؤسسة
                        </div>
                        <p className="text-xs text-[#64748B]">
                          يمكنك إنشاء مستند جديد الآن مع جدول البنود وحساب ضريبة القيمة المضافة 15% بشكل فوري.
                        </p>
                        <button
                          type="button"
                          onClick={openCreateModalWithDefaults}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          {currentTab === 'quotes'
                            ? 'إنشاء أول عرض سعر'
                            : currentTab === 'sales-orders'
                              ? 'إنشاء أول أمر بيع'
                              : currentTab === 'purchase-orders'
                                ? 'إنشاء أول أمر شراء للموردين'
                                : 'إصدار أول فاتورة ضريبية'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {currentTab === 'quotes' &&
                  filteredQuotes.map((q) => {
                    const fin = computeDocumentFinancials(q);
                    const docCurr = (q.currency || baseCurrency.code).toUpperCase();
                    const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                    const matchedDeal = deals.find((d) => d.id === q.dealId);
                    const displayDeal = q.dealTitle || matchedDeal?.title || q.dealId || 'صفقة مباشرة';
                    const displayContact =
                      q.contactName ||
                      contacts.find((c) => c.accountName === q.accountName)?.fullName ||
                      'إدارة المشتريات';
                    const displayRwq =
                      q.leadUniqueId ||
                      matchedDeal?.leadUniqueId ||
                      contacts.find((c) => c.accountName === q.accountName)?.leadUniqueId ||
                      'RWQ-10482';
                    const displayOwner =
                      q.ownerName || matchedDeal?.ownerName || currentUser?.fullName || 'سلمان القحطاني';
                    const displayIssueDate = q.issueDate || '2026-11-15';

                    return (
                      <tr key={q.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-2.5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(q.id)}
                            onChange={() => handleToggleSelect(q.id)}
                            className="rounded border-[#CBD5E1]"
                          />
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#2563EB]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'quote', record: q })}
                              className="hover:underline font-mono font-bold cursor-pointer"
                            >
                              {q.quoteNumber}
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold">
                              {fin.taxMode === 'exclusive' ? 'غير شامل الضريبة' : 'شامل الضريبة'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B] tabular-nums font-normal">
                            الإصدار: {displayIssueDate}
                          </span>
                        </td>
                        <td
                          className="px-2.5 py-2.5 font-semibold text-[#0F172A] max-w-[230px]"
                          title={q.subject}
                        >
                          <div className="truncate">{q.subject}</div>
                          <div className="text-[11px] text-[#64748B] font-normal truncate">
                            {fin.lineItems.length} بند • {q.paymentTerms || 'دفعة مقدمة 50%'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569]">
                          <div className="font-semibold text-[#0F172A] truncate max-w-[160px]">
                            {displayContact}
                          </div>
                          <div className="text-[11px] text-[#2563EB] font-mono truncate max-w-[160px]">
                            {displayRwq} • {displayDeal}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px] shrink-0">
                              {getArabicInitials(q.accountName)}
                            </span>
                            <span className="font-semibold text-[#0F172A]">{q.accountName}</span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                          <div className="text-[#2563EB]">
                            {formatOrgCurrency(fin.totalAmount, docCurr)}
                          </div>
                          <div className="text-[10px] font-normal text-[#64748B]">
                            الصافي: {formatOrgCurrency(fin.taxableAmount, docCurr)} + ض.ق.م (15%):{' '}
                            {formatOrgCurrency(fin.vatAmount, docCurr)}
                          </div>
                          {isForeign && (
                            <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                              المعادل ({baseCurrency.code}):{' '}
                              {formatOrgCurrency(
                                convertToBaseCurrency(fin.totalAmount, docCurr, q.exchangeRate),
                                baseCurrency.code
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5">
                          <StatusBadge label={q.status} />
                        </td>
                        <td className="px-2.5 py-2.5 text-[#64748B] tabular-nums">
                          <div>{q.validUntil}</div>
                          <div className="text-[10px] text-[#64748B]">
                            {q.deliveryDuration || 'تنفيذ خلال 14 يوم'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] font-medium">{displayOwner}</td>
                        <td className="px-2.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'quote', record: q })}
                              title="معاينة وطباعة عرض السعر (A4 PDF)"
                              className="p-1.5 rounded bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={conversionLoading === q.id}
                              onClick={() => void handleConvertToNext(q)}
                              title="تحويل إلى أمر بيع بنقرة واحدة ←"
                              className="px-2 py-1 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>لأمر بيع</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                triggerToast(
                                  `تم إرسال عرض السعر (${q.quoteNumber}) عبر واتساب السحابي للعميل "${q.accountName}".`
                                )
                              }
                              title="إرسال عبر واتساب"
                              className="p-1.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {currentTab === 'sales-orders' &&
                  filteredSalesOrders.map((so) => {
                    const fin = computeDocumentFinancials(so);
                    const docCurr = (so.currency || baseCurrency.code).toUpperCase();
                    const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                    const totalOrderedQty = fin.lineItems.reduce(
                      (s, li) => s + (Number(li.quantity) || 0),
                      0
                    );
                    const totalDeliveredQty = fin.lineItems.reduce(
                      (s, li) =>
                        s +
                        (li.deliveredQuantity !== undefined
                          ? Number(li.deliveredQuantity)
                          : Number(li.quantity) || 0),
                      0
                    );
                    const totalInvoicedQty = fin.lineItems.reduce(
                      (s, li) =>
                        s +
                        (li.invoicedQuantity !== undefined
                          ? Number(li.invoicedQuantity)
                          : so.status === 'مكتملة'
                            ? Number(li.quantity) || 0
                            : 0),
                      0
                    );

                    return (
                      <tr key={so.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-2.5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(so.id)}
                            onChange={() => handleToggleSelect(so.id)}
                            className="rounded border-[#CBD5E1]"
                          />
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#2563EB]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'sales_order', record: so })}
                              className="hover:underline font-mono font-bold block cursor-pointer"
                            >
                              {so.orderNumber}
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B] tabular-nums font-normal">
                            تاريخ الأمر: {so.orderDate || '2026-11-16'}
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#0F172A]">
                          <div className="flex items-center gap-1.5">
                            <span>مرجع العرض:</span>
                            <span className="font-mono text-[#2563EB]">
                              {so.quoteNumber || so.quoteId || 'مباشر'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B] font-mono">
                            أمر شراء العميل: {so.customerPoNumber || 'PO-2026-8841'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569]">
                          <div className="font-semibold text-[#0F172A]">
                            {so.contactName || 'إدارة العقود والتوريد'}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate max-w-[170px]">
                            {so.shippingMethod || 'تسليم سحابي وميداني'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px] shrink-0">
                              {getArabicInitials(so.accountName)}
                            </span>
                            <span className="font-semibold text-[#0F172A]">{so.accountName}</span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                          <div className="text-[#2563EB]">
                            {formatOrgCurrency(fin.totalAmount, docCurr)}
                          </div>
                          <div className="text-[10px] font-normal text-[#64748B]">
                            الصافي: {formatOrgCurrency(fin.taxableAmount, docCurr)} + ض.ق.م (15%):{' '}
                            {formatOrgCurrency(fin.vatAmount, docCurr)}
                          </div>
                          {isForeign && (
                            <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                              المعادل ({baseCurrency.code}):{' '}
                              {formatOrgCurrency(
                                convertToBaseCurrency(fin.totalAmount, docCurr, so.exchangeRate),
                                baseCurrency.code
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5">
                          <StatusBadge label={so.status} />
                        </td>
                        <td className="px-2.5 py-2.5 text-[#64748B] tabular-nums">
                          <div className="font-semibold text-[#0F172A]">{so.deliveryDate}</div>
                          <div className="text-[10px] text-[#059669] font-semibold">
                            مطلوب: {totalOrderedQty} | مسلم: {totalDeliveredQty} | مفوتر:{' '}
                            {totalInvoicedQty}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] font-medium">
                          {so.ownerName || currentUser?.fullName || 'سارة المنصور'}
                        </td>
                        <td className="px-2.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'sales_order', record: so })}
                              title="معاينة وطباعة أمر البيع (A4 PDF)"
                              className="p-1.5 rounded bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={conversionLoading === so.id}
                              onClick={() => void handleConvertToNext(so)}
                              title="إصدار فاتورة ضريبية ZATCA بنقرة واحدة ←"
                              className="px-2 py-1 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>إصدار فاتورة</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {currentTab === 'invoices' &&
                  filteredInvoices.map((inv) => {
                    const fin = computeDocumentFinancials(inv);
                    const docCurr = (inv.currency || baseCurrency.code).toUpperCase();
                    const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                    const remaining = Math.max(0, fin.totalAmount - (inv.paidAmount || 0));
                    const zStatus = inv.zatcaStatus || 'PHASE1_READY';
                    const isZatcaApproved = zStatus === 'CLEARED' || zStatus === 'REPORTED';
                    return (
                      <tr key={inv.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-2.5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => handleToggleSelect(inv.id)}
                            className="rounded border-[#CBD5E1]"
                          />
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#2563EB]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'invoice', record: inv })}
                              className="hover:underline font-mono font-bold cursor-pointer"
                            >
                              {inv.invoiceNumber}
                            </button>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                isZatcaApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-[#ECFDF5] text-[#059669]'
                              }`}
                            >
                              {zStatus === 'CLEARED'
                                ? 'ZATCA Phase 2: CLEARED ✓'
                                : zStatus === 'REPORTED'
                                  ? 'ZATCA Phase 2: REPORTED ✓'
                                  : 'ZATCA QR ✓'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B] tabular-nums font-normal block">
                            التوريد: {inv.supplyDate || inv.issueDate || '2026-11-16'}
                          </span>
                          {inv.zatcaHash && (
                            <span
                              className="text-[10px] font-mono text-indigo-700 block truncate max-w-[200px]"
                              title={`SHA-256 Invoice Hash: ${inv.zatcaHash}`}
                            >
                              Hash: {inv.zatcaHash.slice(0, 18)}...
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#0F172A]">
                          <div>{inv.invoiceType || 'فاتورة ضريبية (B2B)'}</div>
                          <div className="text-[11px] text-[#64748B] font-mono">
                            أمر البيع: {inv.salesOrderNumber || inv.salesOrderId || 'مباشر'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569]">
                          <div className="font-semibold text-[#0F172A]">
                            الرقم الضريبي للعميل:
                          </div>
                          <div className="text-[11px] text-[#2563EB] font-mono">
                            {inv.buyerVatNumber || '300948192000003'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px] shrink-0">
                              {getArabicInitials(inv.accountName)}
                            </span>
                            <span className="font-semibold text-[#0F172A]">{inv.accountName}</span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                          <div className="text-[#2563EB]">
                            {formatOrgCurrency(fin.totalAmount, docCurr)}
                          </div>
                          <div className="text-[10px] font-normal text-[#64748B]">
                            الصافي: {formatOrgCurrency(fin.taxableAmount, docCurr)} + ض.ق.م (15%):{' '}
                            {formatOrgCurrency(fin.vatAmount, docCurr)}
                          </div>
                          {isForeign && (
                            <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                              المعادل ({baseCurrency.code}):{' '}
                              {formatOrgCurrency(
                                convertToBaseCurrency(fin.totalAmount, docCurr, inv.exchangeRate),
                                baseCurrency.code
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="space-y-1">
                            <StatusBadge label={inv.status} />
                            {isZatcaApproved && (
                              <div className="text-[10px] font-bold text-emerald-700">
                                {zStatus === 'CLEARED' ? 'معتمدة B2B (Cleared)' : 'مبلّغ عنها B2C (Reported)'}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 tabular-nums">
                          <div className="text-[#0F172A] font-semibold">
                            الاستحقاق: {inv.dueDate}
                          </div>
                          <div className="text-[10px] text-[#059669] font-bold">
                            مدفوع: {formatOrgCurrency(inv.paidAmount, docCurr)} | متبقي:{' '}
                            {formatOrgCurrency(remaining, docCurr)}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] font-medium">
                          {inv.ownerName || currentUser?.fullName || 'الإدارة المالية'}
                        </td>
                        <td className="px-2.5 py-2.5 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={zatcaSubmittingId === inv.id}
                              onClick={() => void handleSubmitZatcaPhase2(inv)}
                              title="اعتماد وإرسال لهيئة الزكاة والضريبة والجمارك (ZATCA Phase 2 Clearance / Reporting)"
                              className={`px-2 py-1 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                                isZatcaApproved
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {zatcaSubmittingId === inv.id
                                  ? 'جارٍ الإرسال...'
                                  : 'اعتماد وإرسال لهيئة الزكاة (Phase 2)'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadZatcaXml(inv)}
                              title="تحميل ملف الفاتورة الإلكترونية XML (UBL 2.1)"
                              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>تحميل XML</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'invoice', record: inv })}
                              title="معاينة وطباعة الفاتورة الضريبية ZATCA (A4 PDF)"
                              className="p-1.5 rounded bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(inv)}
                              title="تسجيل دفعة وسجل السداد"
                              className="px-2 py-1 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>دفعة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                triggerToast(
                                  `تم إرسال الفاتورة الضريبية (${inv.invoiceNumber}) مع رمز QR عبر واتساب للعميل "${inv.accountName}".`
                                )
                              }
                              title="إرسال الفاتورة عبر واتساب"
                              className="p-1.5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {currentTab === 'purchase-orders' &&
                  filteredPurchaseOrders.map((po) => {
                    const fin = computeDocumentFinancials(po);
                    const docCurr = (po.currency || baseCurrency.code).toUpperCase();
                    const isForeign = docCurr !== baseCurrency.code.toUpperCase();
                    return (
                      <tr key={po.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-2.5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(po.id)}
                            onChange={() => handleToggleSelect(po.id)}
                            className="rounded border-[#CBD5E1]"
                          />
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#2563EB]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'purchase_order', record: po })}
                              className="hover:underline font-mono font-bold cursor-pointer"
                            >
                              {po.poNumber}
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                              {docCurr}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B] tabular-nums font-normal">
                            تاريخ الإصدار: {po.issueDate}
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#0F172A] max-w-[230px]">
                          <div className="truncate">{po.subject}</div>
                          <div className="text-[11px] text-[#64748B] font-normal truncate">
                            {fin.lineItems.length} بند توريد • {po.paymentTerms || 'آجل 30 يوماً'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569]">
                          <div className="font-semibold text-[#0F172A]">
                            {po.vendorContact || 'إدارة مبيعات المورد'}
                          </div>
                          <div className="text-[11px] text-[#2563EB] font-mono">
                            VAT: {po.vendorVatNumber || '300491028800003'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px] shrink-0">
                              {getArabicInitials(po.vendorName)}
                            </span>
                            <span className="font-semibold text-[#0F172A]">{po.vendorName}</span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                          <div className="text-[#2563EB]">
                            {formatOrgCurrency(fin.totalAmount, docCurr)}
                          </div>
                          <div className="text-[10px] font-normal text-[#64748B]">
                            الصافي: {formatOrgCurrency(fin.taxableAmount, docCurr)} + ض.ق.م (15%):{' '}
                            {formatOrgCurrency(fin.vatAmount, docCurr)}
                          </div>
                          {isForeign && (
                            <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                              المعادل ({baseCurrency.code}):{' '}
                              {formatOrgCurrency(
                                convertToBaseCurrency(fin.totalAmount, docCurr, po.exchangeRate),
                                baseCurrency.code
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5">
                          <select
                            value={po.status}
                            onChange={(e) => {
                              const nextSt = e.target.value as PurchaseOrder['status'];
                              void updatePurchaseOrder(po.id, { status: nextSt });
                              triggerToast(`تم تحديث حالة أمر الشراء (${po.poNumber}) إلى «${nextSt}»`);
                            }}
                            className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-[11px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                          >
                            <option value="مسودة">مسودة</option>
                            <option value="مرسل">مرسل للمورد</option>
                            <option value="مستلم جزئياً">مستلم جزئياً</option>
                            <option value="مكتمل">مكتمل الاستلام</option>
                            <option value="ملغي">ملغي</option>
                          </select>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#0F172A] font-semibold tabular-nums">
                          <div>{po.expectedDeliveryDate}</div>
                          <div className="text-[10px] text-[#64748B] font-normal">
                            {po.shippingAddress || 'مستودع الرياض الرئيسي'}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] font-medium">
                          {po.ownerName || currentUser?.fullName || 'إدارة المشتريات'}
                        </td>
                        <td className="px-2.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ kind: 'purchase_order', record: po })}
                              title="معاينة وطباعة أمر الشراء للمورد (A4 PDF)"
                              className="p-1.5 rounded bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                triggerToast(
                                  `تم إرسال أمر الشراء الرسمي (${po.poNumber}) للمورد "${po.vendorName}" عبر البريد والواتساب.`
                                )
                              }
                              title="إرسال أمر الشراء للمورد"
                              className="p-1.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Unified Mathematical Footer Summary Bar */}
          <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-semibold text-[#0F172A]">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]">
                إجماليات الصفحة بعملة الأساس ({baseCurrency.code})
              </span>
              <span>
                إجمالي الصافي الخاضع للضريبة:{' '}
                <span className="text-[#0F172A] tabular-nums font-bold">
                  {formatOrgCurrency(pageFinancialSummary.taxableSum, baseCurrency.code)}
                </span>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span>
                إجمالي ضريبة القيمة المضافة (15% ZATCA):{' '}
                <span className="text-[#10B981] tabular-nums font-bold">
                  {formatOrgCurrency(pageFinancialSummary.vatSum, baseCurrency.code)}
                </span>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span>
                الإجمالي النهائي المستحق (شامل الضريبة):{' '}
                <span className="text-[#2563EB] tabular-nums font-extrabold">
                  {formatOrgCurrency(pageFinancialSummary.totalSum, baseCurrency.code)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[#64748B]">
              <span>الصفوف: 25 لكل صفحة</span>
              <span>•</span>
              <span className="font-semibold text-[#0F172A]">
                {activeItemsCount === 0
                  ? 'عرض 0 إلى 0 من أصل 0 سجل'
                  : `عرض 1 إلى ${activeItemsCount} من أصل ${activeItemsCount} سجل`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CREATE ENTERPRISE FINANCIAL DOCUMENT MODAL (Quote / Sales Order / Invoice)
         ===================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  {currentTab === 'quotes'
                    ? 'إنشاء عرض سعر احترافي جديد (Quotation)'
                    : currentTab === 'sales-orders'
                      ? 'إنشاء أمر بيع وتوريد جديد (Sales Order)'
                      : currentTab === 'purchase-orders'
                        ? 'إنشاء أمر شراء رسمي للمورد (Supplier Purchase Order)'
                        : 'إصدار فاتورة ضريبية إلكترونية معتمدة (ZATCA Tax Invoice)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentTab === 'purchase-orders'
                    ? 'أدخل بيانات المورد وموعد التوريد المتوقع وجدول البنود؛ يتم حساب الصافي وضريبة القيمة المضافة (15%) لحظياً.'
                    : 'أدخل بيانات العميل والصفقة والعملة وجدول البنود؛ يتم حساب الصافي والخصومات وضريبة القيمة المضافة (15%) لحظياً.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-5">
              {/* Row 1: Quick Deal/Account Link + Customer Name + Owner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الربط بصفقة أو منشأة مسجلة
                  </label>
                  <select
                    value={newDealId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setNewDealId(selectedId);
                      const matchedDeal = deals.find((d) => d.id === selectedId);
                      if (matchedDeal) {
                        setNewSubject(matchedDeal.title);
                        setNewDealTitle(matchedDeal.title);
                        setNewClientName(matchedDeal.accountName);
                        setNewOwnerName(matchedDeal.ownerName || currentUser?.fullName || '');
                        if (matchedDeal.leadUniqueId) setNewLeadUniqueId(matchedDeal.leadUniqueId);
                        if (matchedDeal.currency) {
                          handleSelectDocumentCurrency(matchedDeal.currency, false);
                        }
                        setNewLineItems((prev) =>
                          prev.map((li, i) =>
                            i === 0
                              ? {
                                  ...li,
                                  productName: matchedDeal.title,
                                  unitPrice: matchedDeal.amount,
                                }
                              : li
                          )
                        );
                        return;
                      }
                      const matchedAccount = accounts.find((a) => a.id === selectedId);
                      if (matchedAccount) {
                        setNewClientName(matchedAccount.name);
                        setNewOwnerName(matchedAccount.accountManager || currentUser?.fullName || '');
                        if (matchedAccount.leadUniqueId)
                          setNewLeadUniqueId(matchedAccount.leadUniqueId);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="">-- اختر صفقة أو شركة للربط التلقائي --</option>
                    <optgroup label="الصفقات النشطة (Deals)">
                      {deals.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} — {d.accountName} ({formatOrgCurrency(d.amount, d.currency || baseCurrency.code)})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="الشركات والمنشآت (Accounts)">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.leadUniqueId || acc.id})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {currentTab === 'purchase-orders'
                      ? 'اسم المورد / الشركة الموردة *'
                      : 'اسم العميل / الشركة *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder={
                      currentTab === 'purchase-orders'
                        ? 'مثال: شركة Ingram Micro Cloud KSA'
                        : 'مثال: شركة قمة التقنية للحلول'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المسؤول / مالك السجل *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="اسم المندوب أو المسؤول"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Row 1.5: Multi-Currency & Exchange Rate Governance Block */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-extrabold text-slate-900">
                      عملة إصدار المستند وسعر الصرف المعتمد (Multi-Currency Engine)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-blue-700">
                      العملة الأساسية للمؤسسة: {baseCurrency.code} ({baseCurrency.symbol})
                    </span>
                  </div>
                  <Link
                    to="/settings/currencies"
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    إدارة العملات وأسعار الصرف الحية والثابتة ←
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      عملة المستند (العرض / الفاتورة) *
                    </label>
                    <select
                      value={newCurrency}
                      onChange={(e) => handleSelectDocumentCurrency(e.target.value, false)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {activeCurrencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}{' '}
                          {c.isPrimary
                            ? '[عملة الأساس]'
                            : c.rateMode === 'live'
                              ? `[صرف حي: ${c.rateToBase}]`
                              : `[صرف ثابت: ${c.rateToBase}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سعر الصرف مقابل العملة الأساسية ({baseCurrency.code})
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 shrink-0">
                        1 {newCurrency} =
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        min={0.0001}
                        disabled={newCurrency.toUpperCase() === baseCurrency.code.toUpperCase()}
                        value={newCurrency.toUpperCase() === baseCurrency.code.toUpperCase() ? 1 : newExchangeRate}
                        onChange={(e) =>
                          setNewExchangeRate(Math.max(0.0001, Number(e.target.value) || 1))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white disabled:bg-slate-100 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      <span className="text-xs font-mono font-bold text-slate-600 shrink-0">
                        {baseCurrency.code}
                      </span>
                    </div>
                  </div>

                  <div>
                    {newCurrency.toUpperCase() !== baseCurrency.code.toUpperCase() ? (
                      <button
                        type="button"
                        onClick={() => {
                          const baseRate = newExchangeRate > 0 ? newExchangeRate : 1;
                          setNewLineItems((prev) =>
                            prev.map((li) => ({
                              ...li,
                              unitPrice: Math.round((li.unitPrice / baseRate) * 100) / 100,
                            }))
                          );
                          triggerToast(
                            `تم تحويل أسعار بنود المستند تلقائياً إلى عملة ${newCurrency} وفق سعر الصرف (${newExchangeRate}).`
                          );
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>تحويل أسعار البنود من {baseCurrency.code} إلى {newCurrency}</span>
                      </button>
                    ) : (
                      <div className="px-3 py-2 rounded-lg bg-white/80 border border-blue-100 text-[11px] text-slate-600 font-semibold">
                        المستند يصدر بالعملة الأساسية للمؤسسة ({baseCurrency.code})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Document Metadata (Dates, Status, Specific Fields) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    موضوع المستند / البيان الرئيسي *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="مثال: توريد وتنفيذ تراخيص منظومة رواق السحابية"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {currentTab === 'sales-orders' ? 'تاريخ الأمر *' : 'تاريخ الإصدار الفعلي *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newIssueDate}
                    onChange={(e) => setNewIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 tabular-nums focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {currentTab === 'quotes'
                      ? 'تاريخ انتهاء الصلاحية *'
                      : currentTab === 'sales-orders'
                        ? 'تاريخ التسليم المتوقع *'
                        : currentTab === 'purchase-orders'
                          ? 'تاريخ التوريد المتوقع من المورد *'
                          : 'تاريخ الاستحقاق (Due Date) *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 tabular-nums focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    حالة المستند
                  </label>
                  <select
                    value={newDocStatus}
                    onChange={(e) => setNewDocStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  >
                    {currentTab === 'quotes' ? (
                      <>
                        <option value="مسودة">مسودة</option>
                        <option value="مرسل">مرسل للعميل</option>
                        <option value="مقبول">مقبول ومعتمد</option>
                        <option value="مرفوض">مرفوض</option>
                        <option value="منتهي">منتهي الصلاحية</option>
                      </>
                    ) : currentTab === 'sales-orders' ? (
                      <>
                        <option value="قيد التأكيد">قيد التأكيد</option>
                        <option value="قيد التنفيذ">قيد التنفيذ</option>
                        <option value="تسليم جزئي">تسليم جزئي</option>
                        <option value="مكتملة">مكتمل</option>
                        <option value="ملغي">ملغي</option>
                      </>
                    ) : currentTab === 'purchase-orders' ? (
                      <>
                        <option value="مسودة">مسودة</option>
                        <option value="مرسل">مرسل للمورد</option>
                        <option value="مستلم جزئياً">مستلم جزئياً</option>
                        <option value="مكتمل">مكتمل الاستلام</option>
                        <option value="ملغي">ملغي</option>
                      </>
                    ) : (
                      <>
                        <option value="غير مدفوعة">غير مدفوعة</option>
                        <option value="مدفوعة جزئياً">مدفوعة جزئياً</option>
                        <option value="مكتملة">مدفوعة بالكامل</option>
                        <option value="متأخرة">متأخرة</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    جهة الاتصال لدى العميل
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="مثال: م. بدر المنصور"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شروط الدفع والتسوية
                  </label>
                  <input
                    type="text"
                    value={newPaymentTerms}
                    onChange={(e) => setNewPaymentTerms(e.target.value)}
                    placeholder="دفعة 50% مقدماً و50% عند التسليم"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                {currentTab === 'quotes' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      مدة التنفيذ / التوريد
                    </label>
                    <input
                      type="text"
                      value={newDeliveryDuration}
                      onChange={(e) => setNewDeliveryDuration(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                )}

                {currentTab === 'sales-orders' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم أمر الشراء من العميل (Customer PO #)
                      </label>
                      <input
                        type="text"
                        value={newCustomerPo}
                        onChange={(e) => setNewCustomerPo(e.target.value)}
                        placeholder="PO-2026-4410"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        عنوان الشحن / التسليم وطريقة التوريد
                      </label>
                      <input
                        type="text"
                        value={newShippingAddress}
                        onChange={(e) => setNewShippingAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </>
                )}

                {currentTab === 'invoices' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نوع الفاتورة الضريبية (ZATCA)
                      </label>
                      <select
                        value={newInvoiceType}
                        onChange={(e) => setNewInvoiceType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="فاتورة ضريبية (B2B)">فاتورة ضريبية (B2B)</option>
                        <option value="فاتورة ضريبية مبسطة (B2C)">فاتورة ضريبية مبسطة (B2C)</option>
                        <option value="إشعار دائن">إشعار دائن (Credit Note)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الرقم الضريبي للمشتري (Buyer VAT #)
                      </label>
                      <input
                        type="text"
                        value={newBuyerVat}
                        onChange={(e) => setNewBuyerVat(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        تاريخ التوريد الفعلي
                      </label>
                      <input
                        type="date"
                        value={newSupplyDate}
                        onChange={(e) => setNewSupplyDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs tabular-nums text-slate-900 focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ===============================================================
                  UNIFIED LINE ITEMS TABLE & TAX INCLUSIVITY SELECTOR
                 =============================================================== */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-900">
                      جدول البنود والمنتجات والخدمات — الأسعار بعملة ({newCurrency})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Tax Inclusivity Toggle */}
                    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setNewTaxMode('exclusive')}
                        className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                          newTaxMode === 'exclusive'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        الأسعار غير شاملة للضريبة (+15%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTaxMode('inclusive')}
                        className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                          newTaxMode === 'inclusive'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        الأسعار شاملة للضريبة (15% Inclusive)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />+ إضافة بند جديد
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="px-2.5 py-2">المنتج / الخدمة والوصف</th>
                        <th className="px-2 py-2 w-24">الوحدة</th>
                        <th className="px-2 py-2 w-20">الكمية</th>
                        <th className="px-2 py-2 w-28">سعر الوحدة ({newCurrency})</th>
                        <th className="px-2 py-2 w-32">الخصم</th>
                        <th className="px-2 py-2 w-24">الضريبة</th>
                        <th className="px-2 py-2 w-28">صافي البند</th>
                        <th className="px-2 py-2 w-24">قيمة الضريبة</th>
                        <th className="px-2 py-2 w-28">الإجمالي</th>
                        <th className="px-2 py-2 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {newLineItems.map((item) => {
                        const rowMetrics = computeSingleLineItem(item, newTaxMode);
                        const selectedCurrSymbol =
                          currencies.find((c) => c.code.toUpperCase() === newCurrency.toUpperCase())
                            ?.symbol || newCurrency;
                        return (
                          <tr key={item.id} className="align-top bg-white">
                            <td className="px-2.5 py-2 space-y-1 min-w-[200px]">
                              <input
                                type="text"
                                required
                                value={item.productName}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, { productName: e.target.value })
                                }
                                placeholder="اسم المنتج أو الخدمة..."
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs font-bold text-slate-900"
                              />
                              <input
                                type="text"
                                value={item.description || ''}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, { description: e.target.value })
                                }
                                placeholder="وصف تفصيلي للبند (اختياري)..."
                                className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px] text-slate-600"
                              />
                            </td>

                            <td className="px-2 py-2">
                              <select
                                value={item.unit}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    unit: e.target.value as LineItemUnit,
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs bg-white"
                              >
                                <option value="اشتراك">اشتراك</option>
                                <option value="مشروع">مشروع</option>
                                <option value="ساعة">ساعة</option>
                                <option value="حبة">حبة</option>
                              </select>
                            </td>

                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-bold tabular-nums text-center"
                              />
                            </td>

                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    unitPrice: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-bold tabular-nums"
                              />
                            </td>

                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={item.discountValue}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, {
                                      discountValue: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-16 px-1.5 py-1.5 rounded border border-slate-300 text-xs tabular-nums"
                                />
                                <select
                                  value={item.discountType}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, {
                                      discountType: e.target.value as DiscountType,
                                    })
                                  }
                                  className="px-1 py-1.5 rounded border border-slate-300 text-[11px] bg-white"
                                >
                                  <option value="percentage">%</option>
                                  <option value="fixed">{selectedCurrSymbol}</option>
                                </select>
                              </div>
                            </td>

                            <td className="px-2 py-2">
                              <select
                                value={item.taxRate}
                                onChange={(e) =>
                                  handleUpdateLineItem(item.id, {
                                    taxRate: Number(e.target.value) === 0 ? 0 : 15,
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs bg-white font-semibold"
                              >
                                <option value={15}>15% قياسية</option>
                                <option value={0}>0% معفى</option>
                              </select>
                            </td>

                            <td className="px-2 py-2.5 font-semibold text-slate-800 tabular-nums">
                              {formatOrgCurrency(rowMetrics.netAmount, newCurrency)}
                            </td>

                            <td className="px-2 py-2.5 font-semibold text-emerald-700 tabular-nums">
                              {formatOrgCurrency(rowMetrics.taxAmount, newCurrency)}
                            </td>

                            <td className="px-2 py-2.5 font-extrabold text-blue-700 tabular-nums">
                              {formatOrgCurrency(rowMetrics.lineTotal, newCurrency)}
                            </td>

                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(item.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="حذف البند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Unified Financial Summary Box */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-7 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      الشروط والأحكام / ملاحظات للعميل (تظهر في ملف A4 PDF)
                    </label>
                    <textarea
                      rows={2}
                      value={newTermsAndConditions}
                      onChange={(e) => setNewTermsAndConditions(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                    />
                  </div>

                  <div className="md:col-span-5 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>المجموع الفرعي ({newCurrency}):</span>
                      <span className="font-bold tabular-nums">
                        {formatOrgCurrency(draftFinancials.subtotalAmount, newCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-rose-600">
                      <span>إجمالي الخصومات:</span>
                      <span className="font-bold tabular-nums">
                        - {formatOrgCurrency(draftFinancials.discountTotal, newCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-800 border-t border-slate-100 pt-1.5">
                      <span className="font-semibold">
                        المبلغ الخاضع للضريبة ({newTaxMode === 'exclusive' ? 'غير شامل' : 'مستخلص'}):
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatOrgCurrency(draftFinancials.taxableAmount, newCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="font-semibold">ضريبة القيمة المضافة (15% ZATCA):</span>
                      <span className="font-bold tabular-nums">
                        {formatOrgCurrency(draftFinancials.vatAmount, newCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-blue-700 border-t border-slate-200 pt-2 text-sm font-extrabold">
                      <span>الإجمالي النهائي المستحق ({newCurrency}):</span>
                      <span className="tabular-nums">
                        {formatOrgCurrency(draftFinancials.totalAmount, newCurrency)}
                      </span>
                    </div>
                    {newCurrency.toUpperCase() !== baseCurrency.code.toUpperCase() && (
                      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-indigo-800">
                        <span>المعادل بالعملة الأساسية ({baseCurrency.code}):</span>
                        <span className="tabular-nums font-mono">
                          {formatOrgCurrency(
                            convertToBaseCurrency(
                              draftFinancials.totalAmount,
                              newCurrency,
                              newExchangeRate
                            ),
                            baseCurrency.code
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingDoc}
                  className="px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSavingDoc
                      ? 'جارٍ الحفظ...'
                      : isPreviewMode
                        ? 'حفظ واعتماد المستند'
                        : 'حفظ في السحابة'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          RECORD INVOICE PAYMENT MODAL (سجل الدفعات والتحصيل)
         ===================================================================== */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  تسجيل دفعة مالية وسجل التحصيل — {paymentModalInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  العميل: {paymentModalInvoice.accountName} • العملة: {paymentModalInvoice.currency || baseCurrency.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-center">
              <div>
                <span className="text-slate-500 block">إجمالي الفاتورة</span>
                <strong className="text-slate-900 tabular-nums">
                  {formatOrgCurrency(
                    paymentModalInvoice.totalAmount,
                    paymentModalInvoice.currency || baseCurrency.code
                  )}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">المدفوع سابقاً</span>
                <strong className="text-emerald-700 tabular-nums">
                  {formatOrgCurrency(
                    paymentModalInvoice.paidAmount || 0,
                    paymentModalInvoice.currency || baseCurrency.code
                  )}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">المتبقي للسداد</span>
                <strong className="text-rose-600 tabular-nums">
                  {formatOrgCurrency(
                    Math.max(
                      0,
                      paymentModalInvoice.totalAmount - (paymentModalInvoice.paidAmount || 0)
                    ),
                    paymentModalInvoice.currency || baseCurrency.code
                  )}
                </strong>
              </div>
            </div>

            {paymentModalInvoice.payments && paymentModalInvoice.payments.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">سجل الدفعات السابقة:</div>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-slate-50/60 text-[11px]">
                  {paymentModalInvoice.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span>
                        {p.date} • {p.method} ({p.referenceNumber})
                      </span>
                      <strong className="text-emerald-700 tabular-nums">
                        {formatOrgCurrency(
                          p.amount,
                          paymentModalInvoice.currency || baseCurrency.code
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    مبلغ الدفعة ({paymentModalInvoice.currency || baseCurrency.code}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ السداد *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="تحويل بنكي">تحويل بنكي (SARIE / IBAN)</option>
                    <option value="مدى">شبكة مدى (Mada)</option>
                    <option value="بطاقة ائتمانية">بطاقة ائتمانية (Visa / MasterCard)</option>
                    <option value="نقدي">سند قبض نقدي</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم المرجعي للإيصال</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  اعتماد وتسجيل الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          A4 PRINT / PDF PREVIEW MODAL (RTL Official Enterprise Layout + ZATCA QR)
         ===================================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Top Action Bar */}
            <div className="bg-slate-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>
                  معاينة المستند الرسمي للطباعة والتصدير (A4 RTL Print Layout) —{' '}
                  {previewDoc.kind === 'quote'
                    ? (previewDoc.record as Quote).quoteNumber
                    : previewDoc.kind === 'sales_order'
                      ? (previewDoc.record as SalesOrder).orderNumber
                      : previewDoc.kind === 'purchase_order'
                        ? (previewDoc.record as PurchaseOrder).poNumber
                        : (previewDoc.record as Invoice).invoiceNumber}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {previewDoc.kind === 'invoice' && (
                  <>
                    <button
                      type="button"
                      disabled={zatcaSubmittingId === (previewDoc.record as Invoice).id}
                      onClick={() => void handleSubmitZatcaPhase2(previewDoc.record as Invoice)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      اعتماد وإرسال لهيئة الزكاة (Phase 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadZatcaXml(previewDoc.record as Invoice)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل ملف XML (UBL 2.1)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة / حفظ كملف PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            {(() => {
              const rec = previewDoc.record;
              const fin = computeDocumentFinancials(rec);
              const docCurr = (rec.currency || baseCurrency.code).toUpperCase();
              const isForeign = docCurr !== baseCurrency.code.toUpperCase();
              const isInvoice = previewDoc.kind === 'invoice';
              const isOrder = previewDoc.kind === 'sales_order';
              const isPo = previewDoc.kind === 'purchase_order';
              const invRec = isInvoice ? (rec as Invoice) : null;
              const soRec = isOrder ? (rec as SalesOrder) : null;
              const poRec = isPo ? (rec as PurchaseOrder) : null;
              const qRec = previewDoc.kind === 'quote' ? (rec as Quote) : null;

              const docTitle = isInvoice
                ? invRec?.invoiceType || 'فاتورة ضريبية (Tax Invoice)'
                : isOrder
                  ? 'أمر بيع وتوريد (Sales Order)'
                  : isPo
                    ? 'أمر شراء للمورد (Supplier Purchase Order)'
                    : 'عرض سعر فني ومالي (Quotation)';

              const docNum = isInvoice
                ? invRec!.invoiceNumber
                : isOrder
                  ? soRec!.orderNumber
                  : isPo
                    ? poRec!.poNumber
                    : qRec!.quoteNumber;

              const issueDate =
                (isInvoice
                  ? invRec?.issueDate
                  : isOrder
                    ? soRec?.orderDate
                    : isPo
                      ? poRec?.issueDate
                      : qRec?.issueDate) || '2026-11-16';
              const secondDateLabel = isInvoice
                ? 'تاريخ الاستحقاق'
                : isOrder
                  ? 'تاريخ التسليم'
                  : isPo
                    ? 'تاريخ التوريد المتوقع'
                    : 'صالح حتى';
              const secondDateVal = isInvoice
                ? invRec!.dueDate
                : isOrder
                  ? soRec!.deliveryDate
                  : isPo
                    ? poRec!.expectedDeliveryDate
                    : qRec!.validUntil;

              const counterpartyName = isPo ? poRec!.vendorName : (rec as Quote | SalesOrder | Invoice).accountName;

              return (
                <div className="p-8 space-y-6 bg-white text-slate-900 text-xs" dir="rtl">
                  {/* Seller & Document Header */}
                  <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-700 text-white font-extrabold flex items-center justify-center text-base">
                          ر
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900">
                            {invRec?.sellerName ||
                              currentOrganization?.name ||
                              'شركة رواق لتقنية المعلومات والحلول السحابية'}
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            الرياض — طريق الملك فهد، المملكة العربية السعودية
                          </p>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 pt-1 font-mono">
                        <span>السجل التجاري: {invRec?.sellerCrNumber || '1010849201'}</span>
                        <span className="mx-2">•</span>
                        <span>
                          الرقم الضريبي (VAT): {invRec?.sellerVatNumber || '310492019400003'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left space-y-1">
                      <span className="inline-block px-3 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-extrabold text-sm">
                        {docTitle}
                      </span>
                      <div className="font-mono font-extrabold text-base text-slate-900">
                        {docNum}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        تاريخ الإصدار: <strong className="font-mono">{issueDate}</strong> |{' '}
                        {secondDateLabel}: <strong className="font-mono">{secondDateVal}</strong>
                      </div>
                      <div className="text-[11px] text-blue-700 font-bold">
                        عملة المستند: <span className="font-mono">{docCurr}</span>
                        {isForeign && (
                          <span>
                            {' '}
                            (سعر الصرف: 1 {docCurr} = {rec.exchangeRate || 1} {baseCurrency.code})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Buyer / Vendor & Reference Metadata Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">
                        {isPo
                          ? 'بيانات المورد المعتمد (Vendor / Supplier):'
                          : 'بيانات العميل / المشتري (Bill To):'}
                      </div>
                      <div className="text-sm font-extrabold text-slate-900">{counterpartyName}</div>
                      <div className="text-[11px] text-slate-600">
                        العنوان:{' '}
                        {invRec?.buyerAddress ||
                          soRec?.billingAddress ||
                          poRec?.shippingAddress ||
                          'الرياض — المملكة العربية السعودية'}
                      </div>
                      {(isInvoice || isPo) && (
                        <div className="text-[11px] font-mono text-slate-700">
                          {isPo
                            ? `الرقم الضريبي للمورد: ${poRec?.vendorVatNumber || '300491028800003'}`
                            : `الرقم الضريبي للمشتري: ${invRec?.buyerVatNumber || '300948192000003'}`}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">
                        المراجع وشروط التعامل:
                      </div>
                      {isOrder && (
                        <>
                          <div>
                            مرجع عرض السعر:{' '}
                            <strong className="font-mono">
                              {soRec?.quoteNumber || soRec?.quoteId || '—'}
                            </strong>
                          </div>
                          <div>
                            رقم تعميد العميل (PO #):{' '}
                            <strong className="font-mono">
                              {soRec?.customerPoNumber || 'PO-2026-8841'}
                            </strong>
                          </div>
                        </>
                      )}
                      {isInvoice && (
                        <>
                          <div>
                            مرجع أمر البيع:{' '}
                            <strong className="font-mono">
                              {invRec?.salesOrderNumber || invRec?.salesOrderId || '—'}
                            </strong>
                          </div>
                          <div>
                            تاريخ التوريد:{' '}
                            <strong className="font-mono">
                              {invRec?.supplyDate || issueDate}
                            </strong>
                          </div>
                        </>
                      )}
                      <div>
                        حالة الضريبة:{' '}
                        <strong>
                          {fin.taxMode === 'exclusive'
                            ? 'الأسعار غير شاملة للضريبة (+15%)'
                            : 'الأسعار شاملة لضريبة القيمة المضافة (15%)'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px]">
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">البند / الوصف</th>
                          <th className="px-2.5 py-2.5">الوحدة</th>
                          <th className="px-2.5 py-2.5">الكمية</th>
                          <th className="px-2.5 py-2.5">سعر الوحدة ({docCurr})</th>
                          <th className="px-2.5 py-2.5">الخصم</th>
                          <th className="px-2.5 py-2.5">الصافي</th>
                          <th className="px-2.5 py-2.5">الضريبة (15%)</th>
                          <th className="px-3 py-2.5">الإجمالي ({docCurr})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {fin.lineItems.map((li, idx) => {
                          const m = computeSingleLineItem(li, fin.taxMode);
                          return (
                            <tr key={li.id || idx}>
                              <td className="px-3 py-2.5 font-mono">{idx + 1}</td>
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-900">{li.productName}</div>
                                {li.description && (
                                  <div className="text-[11px] text-slate-500">{li.description}</div>
                                )}
                              </td>
                              <td className="px-2.5 py-2.5">{li.unit}</td>
                              <td className="px-2.5 py-2.5 font-mono font-bold">{li.quantity}</td>
                              <td className="px-2.5 py-2.5 font-mono">
                                {formatOrgCurrency(li.unitPrice, docCurr)}
                              </td>
                              <td className="px-2.5 py-2.5 font-mono">
                                {formatOrgCurrency(m.discountAmount, docCurr)}
                              </td>
                              <td className="px-2.5 py-2.5 font-mono font-semibold">
                                {formatOrgCurrency(m.netAmount, docCurr)}
                              </td>
                              <td className="px-2.5 py-2.5 font-mono text-emerald-700 font-semibold">
                                {formatOrgCurrency(m.taxAmount, docCurr)}
                              </td>
                              <td className="px-3 py-2.5 font-mono font-extrabold text-blue-700">
                                {formatOrgCurrency(m.lineTotal, docCurr)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Summary + ZATCA QR Code */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
                    <div className="md:col-span-7 flex items-start gap-4">
                      {isInvoice && (
                        <div className="p-3 border-2 border-slate-900 rounded-xl bg-white shrink-0 text-center space-y-1">
                          <QrCode className="w-20 h-20 text-slate-900 mx-auto" />
                          <span className="block text-[9px] font-mono font-bold text-slate-600">
                            ZATCA Phase 2 TLV QR
                          </span>
                        </div>
                      )}
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="font-bold text-slate-900">
                          بيانات الحساب البنكي للسداد (Bank Transfer / IBAN):
                        </div>
                        <div className="font-mono text-slate-800">
                          {invRec?.ibanNumber ||
                            'مصرف الراجحي — SA44 8000 0000 6080 1016 7519'}
                        </div>
                        <div>
                          {qRec?.termsAndConditions ||
                            'تخضع كافة البنود لأنظمة ضريبة القيمة المضافة في المملكة العربية السعودية (15%).'}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">المجموع الفرعي ({docCurr}):</span>
                        <span className="font-mono font-bold">
                          {formatOrgCurrency(fin.subtotalAmount, docCurr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-rose-600">
                        <span>إجمالي الخصومات:</span>
                        <span className="font-mono font-bold">
                          - {formatOrgCurrency(fin.discountTotal, docCurr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                        <span className="font-semibold">المبلغ الصافي الخاضع للضريبة:</span>
                        <span className="font-mono font-bold">
                          {formatOrgCurrency(fin.taxableAmount, docCurr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-700">
                        <span className="font-semibold">ضريبة القيمة المضافة (15%):</span>
                        <span className="font-mono font-bold">
                          {formatOrgCurrency(fin.vatAmount, docCurr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-sm font-extrabold text-blue-700">
                        <span>الإجمالي النهائي المستحق ({docCurr}):</span>
                        <span className="font-mono">{formatOrgCurrency(fin.totalAmount, docCurr)}</span>
                      </div>
                      {isForeign && (
                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-indigo-900">
                          <span>المعادل بالعملة الأساسية ({baseCurrency.code}):</span>
                          <span className="font-mono">
                            {formatOrgCurrency(
                              convertToBaseCurrency(fin.totalAmount, docCurr, rec.exchangeRate),
                              baseCurrency.code
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
