import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Calculator,
  Check,
  ChevronDown,
  Columns3,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Kanban,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Table2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrencySAR } from '../utils/formatters';
import { doc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export function FinancialModulePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const {
    quotes,
    salesOrders,
    invoices,
    currentOrgId,
    activeProfile,
    canViewField,
  } = useCrm();

  // Determine active tab based on path
  const currentTab = path.includes('sales-orders')
    ? 'sales-orders'
    : path.includes('invoices')
      ? 'invoices'
      : 'quotes';

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [conversionLoading, setConversionLoading] = useState<string | null>(null);

  // New Document Form State
  const [newSubject, setNewSubject] = useState('مشروع تطوير البنية التحتية السحابية ونظام ERP');
  const [newClientName, setNewClientName] = useState('شركة الأفق للحلول الرقمية');
  const [newAmount, setNewAmount] = useState(175000);
  const [newValidUntil, setNewValidUntil] = useState('2026-04-30');

  // Filter lists by org_id
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.accountName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredSalesOrders = salesOrders.filter((so) => {
    const matchesSearch =
      so.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      so.accountName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || so.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.accountName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals on current page
  const activeItemsCount =
    currentTab === 'quotes'
      ? filteredQuotes.length
      : currentTab === 'sales-orders'
        ? filteredSalesOrders.length
        : filteredInvoices.length;

  const totalPageValue =
    currentTab === 'quotes'
      ? filteredQuotes.reduce((acc, q) => acc + q.totalAmount, 0)
      : currentTab === 'sales-orders'
        ? filteredSalesOrders.reduce((acc, so) => acc + so.totalAmount, 0)
        : filteredInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);

  // 15% VAT calculation
  const vatAmount = totalPageValue * 0.15;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      if (currentTab === 'quotes') setSelectedIds(filteredQuotes.map((q) => q.id));
      else if (currentTab === 'sales-orders') setSelectedIds(filteredSalesOrders.map((so) => so.id));
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

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const idPrefix = currentTab === 'quotes' ? 'QUO' : currentTab === 'sales-orders' ? 'SO' : 'INV';
      const docNumber = `${idPrefix}-2026-${Math.floor(100 + Math.random() * 900)}`;
      const docId = `${idPrefix.toLowerCase()}_${Date.now()}`;

      if (currentTab === 'quotes') {
        const newQuote = {
          id: docId,
          org_id: currentOrgId,
          ownerId: 'user_admin',
          quoteNumber: docNumber,
          subject: newSubject,
          dealId: 'DEAL-84920',
          accountName: newClientName,
          totalAmount: Number(newAmount),
          status: 'مسودة' as const,
          validUntil: newValidUntil,
        };
        await setDoc(doc(db, 'quotes', docId), newQuote);
      } else if (currentTab === 'sales-orders') {
        const newSo = {
          id: docId,
          org_id: currentOrgId,
          ownerId: 'user_admin',
          orderNumber: docNumber,
          quoteId: 'QUO-2026-084',
          accountName: newClientName,
          totalAmount: Number(newAmount),
          status: 'قيد التجهيز' as const,
          deliveryDate: newValidUntil,
        };
        await setDoc(doc(db, 'sales_orders', docId), newSo);
      } else {
        const newInv = {
          id: docId,
          org_id: currentOrgId,
          ownerId: 'user_admin',
          invoiceNumber: docNumber,
          salesOrderId: 'SO-2026-031',
          accountName: newClientName,
          totalAmount: Number(newAmount),
          paidAmount: 0,
          status: 'مسودة' as const,
          dueDate: newValidUntil,
        };
        await setDoc(doc(db, 'invoices', docId), newInv);
      }

      setIsCreateModalOpen(false);
      alert('تم إنشاء المستند المالي بنجاح وحفظه في سحابة Firestore.');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إنشاء المستند.');
    }
  };

  const handleSendWhatsapp = (docNum: string, client: string) => {
    alert(`تم فتح قناة واتساب السحابية لإرسال المستند (${docNum}) إلى العميل (${client}) بنجاح.`);
  };

  const handleConvertToNext = async (item: any) => {
    setConversionLoading(item.id);
    try {
      if (currentTab === 'quotes') {
        // Convert Quote to Sales Order
        const soId = `so_${Date.now()}`;
        const soNum = item.quoteNumber.replace('QUO', 'SO');
        await setDoc(doc(db, 'sales_orders', soId), {
          id: soId,
          org_id: currentOrgId,
          ownerId: 'user_admin',
          orderNumber: soNum,
          quoteId: item.quoteNumber,
          accountName: item.accountName,
          totalAmount: item.totalAmount,
          status: 'قيد التجهيز',
          deliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        });
        alert(`تم تحويل عرض السعر (${item.quoteNumber}) بنجاح إلى أمر بيع (${soNum}).`);
        navigate('/sales-orders');
      } else if (currentTab === 'sales-orders') {
        // Convert Sales Order to Invoice
        const invId = `inv_${Date.now()}`;
        const invNum = item.orderNumber.replace('SO', 'INV');
        await setDoc(doc(db, 'invoices', invId), {
          id: invId,
          org_id: currentOrgId,
          ownerId: 'user_admin',
          invoiceNumber: invNum,
          salesOrderId: item.orderNumber,
          accountName: item.accountName,
          totalAmount: item.totalAmount,
          paidAmount: 0,
          status: 'مكتملة',
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        });
        alert(`تم إصدار الفاتورة الضريبية ZATCA (${invNum}) بناءً على أمر البيع بنجاح.`);
        navigate('/invoices');
      } else {
        alert('الفاتورة معتمدة ومصدرة بالفعل لبيانات ZATCA.');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء عملية التحويل.');
    } finally {
      setConversionLoading(null);
    }
  };

  const handleDownloadPdf = (docNum: string) => {
    alert(`جارٍ تصدير وتوليد ملف PDF المتوافق مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA e-Invoicing) للمستند: ${docNum}`);
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {/* Flush White Header & Module Tabs */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>رواق CRM</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">عروض الأسعار، أوامر البيع، والفوترة الضريبية ZATCA</span>
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#2563EB]" />
              إدارة المعاملات المالية، العروض المعتمدة والفوترة الضريبية (ZATCA Compliant)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              إدارة متكاملة لدورة الإيرادات، تحويل عروض الأسعار إلى أوامر بيع ثم فواتير ضريبية رقمية مع إشعارات واتساب الفورية.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alert('تم تصدير تقرير الإيرادات والضرائب بصيغة CSV و Excel بنجاح.')}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
              تصدير تقرير
            </button>
            <div className="flex items-center rounded-lg bg-[#2563EB] text-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {currentTab === 'quotes'
                  ? 'إنشاء عرض سعر جديد'
                  : currentTab === 'sales-orders'
                    ? 'إنشاء أمر بيع جديد'
                    : 'إصدار فاتورة ضريبية'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-2.5 py-2 border-r border-[#1D4ED8] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-tabs for Quotes / Sales Orders / Invoices */}
        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-3">
          <NavLink
            to="/quotes"
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              currentTab === 'quotes'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>عروض الأسعار</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
              {quotes.length}
            </span>
          </NavLink>
          <NavLink
            to="/sales-orders"
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              currentTab === 'sales-orders'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>أوامر البيع</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
              {salesOrders.length}
            </span>
          </NavLink>
          <NavLink
            to="/invoices"
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              currentTab === 'invoices'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>الفواتير الضريبية</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">
              {invoices.length}
            </span>
          </NavLink>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">إجمالي العقود والعروض المفتوحة</span>
            <h3 className="text-base font-bold text-[#0F172A] tabular-nums mt-0.5">1,450,000 ر.س</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">نسبة قبول العروض والتحويل</span>
            <h3 className="text-base font-bold text-[#10B981] tabular-nums mt-0.5">64% (+5.2%)</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">متوسط دورة إغلاق المعاملات</span>
            <h3 className="text-base font-bold text-[#0F172A] tabular-nums mt-0.5">6 أيام عمل</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] text-[#64748B] flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Pills */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filter Pills */}
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
            <button
              type="button"
              onClick={() => setStatusFilter('مسودة')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'مسودة'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              مسودة
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('مرسل')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'مرسل'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              مرسل للعميل
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('مؤهل')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'مؤهل'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              معتمد ومقبول ✓
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('مكتملة')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'مكتملة'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              منتهي الصلاحية / مقفل
            </button>
          </div>

          {/* View Switcher & Table Actions */}
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
                جدول
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                كانبان
              </button>
            </div>
          </div>
        </div>

        {/* Search & Selection Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم العرض، الموضوع، اسم العميل أو الشركة..."
              className="w-full pl-3 pr-9 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-semibold text-[#0F172A]">
              {activeItemsCount} سجل مسجل (تم تحديد {selectedIds.length})
            </span>
            <button
              type="button"
              onClick={() => alert('تمت إعادة تحميل القائمة بنجاح من سحابة Firestore.')}
              className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* High-Density Table */}
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
                      selectedIds.length > 0 &&
                      selectedIds.length === activeItemsCount
                    }
                    className="rounded border-[#CBD5E1]"
                  />
                </th>
                <th className="px-2.5 py-2.5">رقم المستند والتاريخ</th>
                <th className="px-2.5 py-2.5">موضوع العرض والوصف</th>
                <th className="px-2.5 py-2.5">الصفقة والعميل</th>
                <th className="px-2.5 py-2.5">الشركة أو المنشأة</th>
                <th className="px-2.5 py-2.5">المبلغ الصافي والضريبة (15%)</th>
                <th className="px-2.5 py-2.5">الحالة</th>
                <th className="px-2.5 py-2.5">صالح حتى</th>
                <th className="px-2.5 py-2.5">مالك السجل</th>
                <th className="px-2.5 py-2.5 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {currentTab === 'quotes' &&
                filteredQuotes.map((q) => {
                  const baseAmount = q.totalAmount / 1.15;
                  const vat = q.totalAmount - baseAmount;
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
                          <span>{q.quoteNumber}</span>
                          <span className="px-1 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-mono">v2</span>
                        </div>
                        <span className="text-[11px] text-[#64748B] tabular-nums font-normal">2025/03/18</span>
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold text-[#0F172A] max-w-[220px] truncate" title={q.subject}>
                        {q.subject}
                        <div className="text-[11px] text-[#64748B] font-normal truncate">يشمل تخصيص مسارات البيع وواجهات الربط</div>
                      </td>
                      <td className="px-2.5 py-2.5 text-[#475569]">
                        <div className="font-semibold text-[#0F172A]">م. عبد الله السبيعي</div>
                        <div className="text-[11px] text-[#2563EB] font-mono">RWQ-10482 • DEAL-84920</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px]">
                            أف
                          </span>
                          <span className="font-semibold text-[#0F172A]">{q.accountName}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                        <div>{formatCurrencySAR(q.totalAmount)}</div>
                        <div className="text-[10px] font-normal text-[#64748B]">
                          الأساس: {formatCurrencySAR(baseAmount)} + ض.ق.م: {formatCurrencySAR(vat)}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <StatusBadge label={q.status} />
                      </td>
                      <td className="px-2.5 py-2.5 text-[#64748B] tabular-nums">{q.validUntil}</td>
                      <td className="px-2.5 py-2.5 text-[#475569]">طارق العتيبي</td>
                      <td className="px-2.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsapp(q.quoteNumber, q.accountName)}
                            title="إرسال عبر واتساب"
                            className="p-1.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={conversionLoading === q.id}
                            onClick={() => handleConvertToNext(q)}
                            title="تحويل لأمر بيع ←"
                            className="p-1.5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(q.quoteNumber)}
                            title="تحميل PDF"
                            className="p-1.5 rounded bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {currentTab === 'sales-orders' &&
                filteredSalesOrders.map((so) => {
                  const baseAmount = so.totalAmount / 1.15;
                  const vat = so.totalAmount - baseAmount;
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
                        <div>{so.orderNumber}</div>
                        <span className="text-[11px] text-[#64748B] tabular-nums font-normal">{so.deliveryDate}</span>
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold text-[#0F172A]">
                        أمر تنفيذ عقود المؤسسات الكبرى (ERP)
                      </td>
                      <td className="px-2.5 py-2.5 text-[#475569]">
                        <div className="font-semibold text-[#0F172A]">سارة المنصور</div>
                        <div className="text-[11px] text-[#2563EB] font-mono">RWQ-10440 • SO-REF</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px]">
                            دخ
                          </span>
                          <span className="font-semibold text-[#0F172A]">{so.accountName}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                        <div>{formatCurrencySAR(so.totalAmount)}</div>
                        <div className="text-[10px] font-normal text-[#64748B]">
                          الأساس: {formatCurrencySAR(baseAmount)} + ض.ق.م: {formatCurrencySAR(vat)}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <StatusBadge label={so.status} />
                      </td>
                      <td className="px-2.5 py-2.5 text-[#64748B] tabular-nums">{so.deliveryDate}</td>
                      <td className="px-2.5 py-2.5 text-[#475569]">سارة المنصور</td>
                      <td className="px-2.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsapp(so.orderNumber, so.accountName)}
                            title="إرسال عبر واتساب"
                            className="p-1.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={conversionLoading === so.id}
                            onClick={() => handleConvertToNext(so)}
                            title="إصدار فاتورة ضريبية ←"
                            className="p-1.5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(so.orderNumber)}
                            title="تحميل PDF"
                            className="p-1.5 rounded bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {currentTab === 'invoices' &&
                filteredInvoices.map((inv) => {
                  const baseAmount = inv.totalAmount / 1.15;
                  const vat = inv.totalAmount - baseAmount;
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
                        <div className="flex items-center gap-1.5">
                          <span>{inv.invoiceNumber}</span>
                          <span className="px-1 py-0.5 rounded bg-[#ECFDF5] text-[#059669] text-[10px] font-mono">ZATCA ✓</span>
                        </div>
                        <span className="text-[11px] text-[#64748B] tabular-nums font-normal">{inv.dueDate}</span>
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold text-[#0F172A]">
                        فاتورة توريد وتكامل نظم الرعاية الصحية
                      </td>
                      <td className="px-2.5 py-2.5 text-[#475569]">
                        <div className="font-semibold text-[#0F172A]">د. فيصل السالم</div>
                        <div className="text-[11px] text-[#2563EB] font-mono">RWQ-10395 • INV-ZATCA</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px]">
                            مد
                          </span>
                          <span className="font-semibold text-[#0F172A]">{inv.accountName}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 font-bold text-[#0F172A] tabular-nums">
                        <div>{formatCurrencySAR(inv.totalAmount)}</div>
                        <div className="text-[10px] font-normal text-[#64748B]">
                          الأساس: {formatCurrencySAR(baseAmount)} + ض.ق.م (15%): {formatCurrencySAR(vat)}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <StatusBadge label={inv.status} />
                      </td>
                      <td className="px-2.5 py-2.5 text-[#64748B] tabular-nums">{inv.dueDate}</td>
                      <td className="px-2.5 py-2.5 text-[#475569]">فريق المحاسبة</td>
                      <td className="px-2.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsapp(inv.invoiceNumber, inv.accountName)}
                            title="إرسال الفاتورة عبر واتساب"
                            className="p-1.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => alert(`المبلغ المدفوع: ${formatCurrencySAR(inv.paidAmount)} | المتبقي: ${formatCurrencySAR(inv.totalAmount - inv.paidAmount)}`)}
                            title="تفاصيل التحصيل"
                            className="p-1.5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(inv.invoiceNumber)}
                            title="تحميل فاتورة ZATCA PDF"
                            className="p-1.5 rounded bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6 font-semibold text-[#0F172A]">
            <span>
              إجمالي قيمة المعاملات في هذه الصفحة:{' '}
              <span className="text-[#2563EB] tabular-nums font-bold">{formatCurrencySAR(totalPageValue)}</span>
            </span>
            <span className="text-[#64748B]">|</span>
            <span>
              إجمالي الضريبة المستحقة (15% ZATCA):{' '}
              <span className="text-[#10B981] tabular-nums font-bold">{formatCurrencySAR(vatAmount)}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[#64748B]">
            <span>الصفوف: 25 لكل صفحة</span>
            <span>•</span>
            <span className="font-semibold text-[#0F172A]">
              عرض 1 إلى {activeItemsCount} من أصل {activeItemsCount} سجل
            </span>
          </div>
        </div>
      </div>

      {/* Create Document Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                {currentTab === 'quotes'
                  ? 'إنشاء عرض سعر جديد'
                  : currentTab === 'sales-orders'
                    ? 'إنشاء أمر بيع جديد'
                    : 'إصدار فاتورة ضريبية ZATCA'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">موضوع المستند أو الوصف</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم العميل أو الشركة</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ الإجمالي (ريال سعودي)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">صالح حتى / تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
                <div className="font-bold">ملاحظة الضريبة والامتثال:</div>
                <div>سيتم احتساب 15% ضريبة القيمة المضافة تلقائياً وربط المستند بمعرف المنظمة النشطة (<span className="font-mono">{currentOrgId}</span>).</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  حفظ وحفظ بالسحابة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
