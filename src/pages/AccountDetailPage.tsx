import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { Account, DealStage } from '../types/crm';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrencySAR } from '../utils/formatters';
import { getAccountCode } from './AccountsPage';

export const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentOrgId,
    currentUser,
    accounts,
    contacts,
    deals,
    quotes,
    salesOrders,
    invoices,
    tasks,
    canViewField,
    updateAccountFields,
    createContact,
    createDeal,
  } = useCrm();

  const accountWithIndex = useMemo(() => {
    const idx = accounts.findIndex(
      (a) =>
        a.id === id ||
        a.id.endsWith(`_${id}`) ||
        getAccountCode(a).toLowerCase() === (id ?? '').toLowerCase()
    );
    if (idx === -1) return null;
    return { account: accounts[idx], index: idx, code: getAccountCode(accounts[idx], idx) };
  }, [accounts, id]);

  const account = accountWithIndex?.account ?? null;
  const accountCode = accountWithIndex?.code ?? 'ACC-2040';

  const [editingInfo, setEditingInfo] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIndustry, setDraftIndustry] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftTier, setDraftTier] = useState<Account['tier']>('استراتيجي');
  const [draftAnnualRevenue, setDraftAnnualRevenue] = useState('0');
  const [draftEmployeesCount, setDraftEmployeesCount] = useState('100');
  const [draftWebsite, setDraftWebsite] = useState('');
  const [draftManager, setDraftManager] = useState('');

  // Quick Add Contact Modal
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactFullName, setContactFullName] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('مدير المشتريات وتقنية المعلومات');
  const [contactPhone, setContactPhone] = useState('+966 50 ');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPrimary, setContactPrimary] = useState(false);

  // Quick Add Deal Modal
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealAmount, setDealAmount] = useState('185000');
  const [dealStage, setDealStage] = useState<DealStage>('عرض سعر');
  const [dealProbability, setDealProbability] = useState('65');
  const [dealCloseDate, setDealCloseDate] = useState('2026-12-15');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setDraftName(account.name);
    setDraftIndustry(account.industry);
    setDraftCity(account.city ?? 'الرياض');
    setDraftTier(account.tier);
    setDraftAnnualRevenue(String(account.annualRevenue ?? 0));
    setDraftEmployeesCount(String(account.employeesCount ?? 120));
    setDraftWebsite(account.website ?? '');
    setDraftManager(account.accountManager);
  }, [account]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const linkedContacts = useMemo(() => {
    if (!account) return [];
    return contacts.filter(
      (c) =>
        c.accountId === account.id ||
        c.accountId.endsWith(`_${account.id}`) ||
        account.id.endsWith(`_${c.accountId}`) ||
        c.accountName.trim() === account.name.trim()
    );
  }, [account, contacts]);

  const linkedDeals = useMemo(() => {
    if (!account) return [];
    return deals.filter(
      (d) =>
        d.accountId === account.id ||
        d.accountId.endsWith(`_${account.id}`) ||
        account.id.endsWith(`_${d.accountId}`) ||
        d.accountName.trim() === account.name.trim()
    );
  }, [account, deals]);

  const linkedQuotes = useMemo(() => {
    if (!account) return [];
    const dealIds = new Set(linkedDeals.map((d) => d.id));
    return quotes.filter(
      (q) => q.accountName.trim() === account.name.trim() || dealIds.has(q.dealId)
    );
  }, [account, linkedDeals, quotes]);

  const linkedSalesOrders = useMemo(() => {
    if (!account) return [];
    return salesOrders.filter((so) => so.accountName.trim() === account.name.trim());
  }, [account, salesOrders]);

  const linkedInvoices = useMemo(() => {
    if (!account) return [];
    return invoices.filter((inv) => inv.accountName.trim() === account.name.trim());
  }, [account, invoices]);

  const linkedTasks = useMemo(() => {
    if (!account) return [];
    return tasks.filter((t) => t.relatedTo.includes(account.name));
  }, [account, tasks]);

  const dealsMetrics = useMemo(() => {
    const activeAndWon = linkedDeals.filter((d) => d.stage !== 'خسارة');
    const won = linkedDeals.filter((d) => d.stage === 'مكتملة');
    const activeWonSum = activeAndWon.reduce((s, d) => s + (d.amount || 0), 0);
    const wonSum = won.reduce((s, d) => s + (d.amount || 0), 0);
    return {
      activeAndWonCount: activeAndWon.length,
      wonCount: won.length,
      activeWonSum,
      wonSum,
    };
  }, [linkedDeals]);

  if (!account) {
    return (
      <div dir="rtl" className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 text-center space-y-3">
        <p className="text-base font-extrabold text-[#0F172A]">
          لم يتم العثور على المنشأة المطلوبة ({id})
        </p>
        <p className="text-xs text-[#64748B]">
          قد تكون المنشأة تابعة لمؤسسة أخرى أو تم نقلها إلى سلة المحذوفات.
        </p>
        <button
          type="button"
          onClick={() => navigate('/accounts')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-[#FFFFFF]"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى سجل الشركات والحسابات</span>
        </button>
      </div>
    );
  }

  const handleSaveAccountDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAccountFields(account.id, {
      name: draftName.trim() || account.name,
      industry: draftIndustry.trim() || account.industry,
      city: draftCity.trim() || 'الرياض',
      tier: draftTier,
      annualRevenue: Number(draftAnnualRevenue) || 0,
      employeesCount: Number(draftEmployeesCount) || 100,
      website: draftWebsite.trim() || undefined,
      accountManager: draftManager.trim() || account.accountManager,
    });
    setEditingInfo(false);
    setToastMessage('تم حفظ وتحديث بيانات المنشأة في قاعدة البيانات بنجاح.');
  };

  const handleCreateLinkedContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactFullName.trim()) return;
    await createContact({
      fullName: contactFullName.trim(),
      accountMode: 'existing',
      existingAccountId: account.id,
      accountName: account.name,
      accountIndustry: account.industry,
      jobTitle: contactJobTitle.trim(),
      phone: contactPhone.trim(),
      email: contactEmail.trim(),
      city: account.city || 'الرياض',
      channel: 'whatsapp',
      contactStatus: 'عميل نشط',
      assignedToName: account.accountManager || currentUser.fullName,
      isPrimary: contactPrimary,
    });
    setContactFullName('');
    setContactEmail('');
    setAddContactOpen(false);
    setToastMessage(`تم ربط وإضافة جهة الاتصال الجديدة إلى منشأة "${account.name}".`);
  };

  const handleCreateLinkedDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim()) return;
    await createDeal({
      title: dealTitle.trim(),
      accountId: account.id,
      accountName: account.name,
      amount: Number(dealAmount) || 0,
      stage: dealStage,
      probability: Number(dealProbability) || 50,
      closeDate: dealCloseDate,
      ownerName: account.accountManager || currentUser.fullName,
    });
    setDealTitle('');
    setAddDealOpen(false);
    setToastMessage(`تم إنشاء الصفقة الجديدة وربطها بمنشأة "${account.name}".`);
  };

  return (
    <div dir="rtl" className="space-y-4 pb-8">
      {/* 1. FLUSH WHITE HEADER */}
      <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 shadow-2xs space-y-3">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <Link
              to="/accounts"
              className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>الشركات والحسابات</span>
            </Link>
            <span>/</span>
            <span className="font-mono font-bold text-[#0F172A]">{accountCode}</span>
            <span>·</span>
            <span className="font-bold text-[#0F172A]">{account.name}</span>
          </div>
          <span className="font-mono text-[11px] text-[#64748B]">
            المؤسسة: {currentOrgId}
          </span>
        </div>

        {/* Title & Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] font-mono text-xs font-extrabold text-[#1D4ED8] tabular-nums">
                  {accountCode}
                </span>
                <h1 className="text-[20px] font-extrabold text-[#0F172A] leading-tight">
                  {account.name}
                </h1>
                <StatusBadge label={account.tier} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                <span>القطاع: {account.industry}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                  {account.city || 'الرياض، المملكة العربية السعودية'}
                </span>
                <span>·</span>
                <span>مدير الحساب: {account.accountManager}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingInfo((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-xs font-bold text-[#0F172A] cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-[#475569]" />
              <span>{editingInfo ? 'إلغاء التعديل' : 'تعديل بيانات المنشأة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAddContactOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3.5 text-xs font-bold text-[#1D4ED8] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ إضافة جهة اتصال</span>
            </button>

            <button
              type="button"
              onClick={() => setAddDealOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-xs font-bold text-[#FFFFFF] shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ إنشاء صفقة جديدة</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs font-bold text-[#065F46] shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#047857] hover:text-[#065F46]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. TOP 4 ACCOUNT KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>الإيراد السنوي للمنشأة</span>
            <Wallet className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="text-xl font-mono font-extrabold text-[#0F172A] tabular-nums">
            {canViewField('accounts', 'annualRevenue')
              ? formatCurrencySAR(account.annualRevenue)
              : 'محجوب (FLS)'}
          </p>
          <p className="text-[11px] text-[#64748B]">
            عدد الموظفين: {account.employeesCount ?? 120} موظف
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>الصفقات النشطة والمغلقة</span>
            <Briefcase className="h-4 w-4 text-[#059669]" />
          </div>
          <p className="text-xl font-mono font-extrabold text-[#059669] tabular-nums">
            {canViewField('deals', 'amount')
              ? formatCurrencySAR(dealsMetrics.activeWonSum)
              : 'محجوب (FLS)'}
          </p>
          <p className="text-[11px] text-[#64748B] tabular-nums">
            إجمالي {dealsMetrics.activeAndWonCount} صفقات مرتبطة بالمنشأة
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>العقود المكتملة (Closed Won)</span>
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          </div>
          <p className="text-xl font-mono font-extrabold text-[#0F172A] tabular-nums">
            {canViewField('deals', 'amount')
              ? formatCurrencySAR(dealsMetrics.wonSum)
              : 'محجوب (FLS)'}
          </p>
          <p className="text-[11px] text-[#059669] font-bold tabular-nums">
            {dealsMetrics.wonCount} صفقات مغلقة بنجاح
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>جهات الاتصال المرتبطة</span>
            <Users className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="text-xl font-mono font-extrabold text-[#2563EB] tabular-nums">
            {linkedContacts.length} جهات اتصال
          </p>
          <p className="text-[11px] text-[#64748B] truncate">
            {linkedContacts[0]
              ? `صانع القرار: ${linkedContacts[0].fullName}`
              : 'لا توجد جهات اتصال بعد'}
          </p>
        </div>
      </div>

      {/* 3. MAIN 2-COLUMN WORKSPACE: ACCOUNT INFO (4 cols) + RELATED LISTS (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* RIGHT COLUMN (4 cols): Account Profile & Financial Summary */}
        <div className="lg:col-span-4 space-y-4">
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 className="text-sm font-extrabold text-[#0F172A]">
                البيانات الأساسية للمنشأة
              </h2>
              <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                {accountCode}
              </span>
            </div>

            {editingInfo ? (
              <form onSubmit={handleSaveAccountDetails} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">اسم المنشأة</label>
                  <input
                    type="text"
                    required
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">القطاع</label>
                  <input
                    type="text"
                    required
                    value={draftIndustry}
                    onChange={(e) => setDraftIndustry(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-[#334155] block">التصنيف</label>
                    <select
                      value={draftTier}
                      onChange={(e) => setDraftTier(e.target.value as Account['tier'])}
                      className="w-full rounded-xl border border-[#E2E8F0] px-2.5 py-2 text-[#0F172A]"
                    >
                      <option value="استراتيجي">استراتيجي</option>
                      <option value="مؤسسات">مؤسسات</option>
                      <option value="نمو">نمو</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#334155] block">المدينة</label>
                    <input
                      type="text"
                      value={draftCity}
                      onChange={(e) => setDraftCity(e.target.value)}
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-[#334155] block">الإيراد السنوي (ر.س)</label>
                    <input
                      type="number"
                      value={draftAnnualRevenue}
                      onChange={(e) => setDraftAnnualRevenue(e.target.value)}
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#334155] block">عدد الموظفين</label>
                    <input
                      type="number"
                      value={draftEmployeesCount}
                      onChange={(e) => setDraftEmployeesCount(e.target.value)}
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">الموقع الإلكتروني</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftWebsite}
                    onChange={(e) => setDraftWebsite(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">مدير الحساب</label>
                  <input
                    type="text"
                    value={draftManager}
                    onChange={(e) => setDraftManager(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingInfo(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] font-bold text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#2563EB] text-white font-bold"
                  >
                    حفظ التغييرات
                  </button>
                </div>
              </form>
            ) : (
              <dl className="divide-y divide-[#F1F5F9] text-xs">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">معرف المنشأة</dt>
                  <dd className="font-mono font-bold text-[#0F172A]">{accountCode}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">القطاع التجاري</dt>
                  <dd className="font-bold text-[#0F172A]">{account.industry}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">تصنيف الحساب</dt>
                  <dd>
                    <StatusBadge label={account.tier} />
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">المدينة والمقر</dt>
                  <dd className="font-semibold text-[#0F172A]">{account.city || 'الرياض'}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">الإيراد السنوي</dt>
                  <dd className="font-mono font-extrabold text-[#2563EB] tabular-nums">
                    {canViewField('accounts', 'annualRevenue')
                      ? formatCurrencySAR(account.annualRevenue)
                      : 'محجوب (FLS)'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">الموقع الإلكتروني</dt>
                  <dd className="font-mono text-[#2563EB] flex items-center gap-1" dir="ltr">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{account.website || 'www.enterprise-client.sa'}</span>
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B]">مدير الحساب المسؤول</dt>
                  <dd className="font-bold text-[#0F172A]">{account.accountManager}</dd>
                </div>
              </dl>
            )}
          </section>

          {/* Financial Documents Summary Card */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-sm font-extrabold text-[#0F172A]">
                  المستندات المالية المرتبطة
                </h2>
              </div>
              <Link
                to="/quotes"
                className="text-[11px] font-bold text-[#2563EB] hover:underline"
              >
                وحدة المالية ←
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Link
                to="/quotes"
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#2563EB] p-2.5"
              >
                <span className="font-mono text-base font-extrabold text-[#2563EB] block tabular-nums">
                  {linkedQuotes.length}
                </span>
                <span className="text-[10px] text-[#64748B]">عروض أسعار</span>
              </Link>
              <Link
                to="/sales-orders"
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#2563EB] p-2.5"
              >
                <span className="font-mono text-base font-extrabold text-[#0F172A] block tabular-nums">
                  {linkedSalesOrders.length}
                </span>
                <span className="text-[10px] text-[#64748B]">أوامر بيع</span>
              </Link>
              <Link
                to="/invoices"
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#2563EB] p-2.5"
              >
                <span className="font-mono text-base font-extrabold text-[#059669] block tabular-nums">
                  {linkedInvoices.length}
                </span>
                <span className="text-[10px] text-[#64748B]">فواتير ضريبية</span>
              </Link>
            </div>
          </section>
        </div>

        {/* LEFT COLUMN (8 cols): RELATED LISTS (Contacts & Deals) */}
        <div className="lg:col-span-8 space-y-5">
          {/* RELATED LIST 1: LINKED CONTACTS */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-sm font-extrabold text-[#0F172A]">
                  جهات الاتصال المرتبطة بالمنشأة (Related Contacts)
                </h2>
                <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2563EB] tabular-nums">
                  {linkedContacts.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAddContactOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3 py-1.5 text-xs font-bold text-[#2563EB] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ إضافة جهة اتصال</span>
              </button>
            </div>

            {linkedContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
                <p>لا توجد جهات اتصال مرتبطة بهذه المنشأة حالياً.</p>
                <button
                  type="button"
                  onClick={() => setAddContactOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة أول جهة اتصال</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                      <th className="px-4 py-2.5">الاسم الكامل</th>
                      <th className="px-3 py-2.5">المنصب الوظيفي</th>
                      <th className="px-3 py-2.5">الجوال</th>
                      <th className="px-3 py-2.5">البريد الإلكتروني</th>
                      <th className="px-3 py-2.5">الحالة</th>
                      <th className="px-4 py-2.5 text-left">الملف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    {linkedContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="font-extrabold text-[#0F172A] hover:text-[#2563EB] inline-flex items-center gap-1.5"
                          >
                            <span>{contact.fullName}</span>
                            {contact.isPrimary && (
                              <span className="text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded">
                                رئيسي
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-[#475569]">
                          {contact.jobTitle || 'صانع قرار'}
                        </td>
                        <td
                          className="px-3 py-2.5 font-mono text-[#334155] tabular-nums whitespace-nowrap"
                          dir="ltr"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-[#64748B]" />
                            {contact.phone || '—'}
                          </span>
                        </td>
                        <td
                          className="px-3 py-2.5 font-mono text-[#64748B] tabular-nums"
                          dir="ltr"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3 text-[#94A3B8]" />
                            {contact.email || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] font-bold text-[#334155]">
                            {contact.contactStatus || 'عميل نشط'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-left">
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="inline-flex items-center gap-1 text-[#2563EB] font-bold hover:underline"
                          >
                            <span>عرض</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* RELATED LIST 2: LINKED DEALS */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#059669]" />
                <h2 className="text-sm font-extrabold text-[#0F172A]">
                  الصفقات والفرص البيعية المرتبطة (Related Deals)
                </h2>
                <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-bold text-[#059669] tabular-nums">
                  {linkedDeals.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAddDealOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-1.5 text-xs font-bold text-[#FFFFFF] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ إنشاء صفقة للمنشأة</span>
              </button>
            </div>

            {linkedDeals.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
                <p>لا توجد صفقات مرتبطة بهذه المنشأة حالياً.</p>
                <button
                  type="button"
                  onClick={() => setAddDealOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إنشاء أول صفقة</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                      <th className="px-4 py-2.5">مسمى الصفقة</th>
                      <th className="px-3 py-2.5">المرحلة</th>
                      <th className="px-3 py-2.5">القيمة المالية</th>
                      <th className="px-3 py-2.5">الاحتمالية</th>
                      <th className="px-3 py-2.5">تاريخ الإغلاق</th>
                      <th className="px-3 py-2.5">المسؤول</th>
                      <th className="px-4 py-2.5 text-left">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    {linkedDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/deals/${deal.id}`}
                            className="font-extrabold text-[#0F172A] hover:text-[#2563EB] block"
                          >
                            {deal.title}
                          </Link>
                          {deal.nextStep && (
                            <span className="text-[10px] text-[#64748B]">
                              الخطوة التالية: {deal.nextStep}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StatusBadge label={deal.stage} />
                        </td>
                        <td className="px-3 py-2.5 font-mono font-extrabold text-[#059669] tabular-nums whitespace-nowrap">
                          {canViewField('deals', 'amount')
                            ? formatCurrencySAR(deal.amount, deal.currency)
                            : 'محجوب (FLS)'}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#334155] tabular-nums">
                          {deal.probability}%
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                          {deal.closeDate}
                        </td>
                        <td className="px-3 py-2.5 text-[#475569] whitespace-nowrap">
                          {deal.ownerName}
                        </td>
                        <td className="px-4 py-2.5 text-left whitespace-nowrap">
                          <Link
                            to={`/deals/${deal.id}`}
                            className="inline-flex items-center gap-1 text-[#2563EB] font-bold hover:underline"
                          >
                            <span>فتح</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* RELATED LIST 3: LINKED TASKS */}
          {linkedTasks.length > 0 && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-extrabold text-[#0F172A]">
                المهام والأنشطة المرتبطة بالمنشأة ({linkedTasks.length})
              </h2>
              <div className="divide-y divide-[#F1F5F9] text-xs">
                {linkedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-[#0F172A]">{t.title}</p>
                      <p className="text-[11px] text-[#64748B]">
                        المسؤول: {t.assignedToName} · الاستحقاق: {t.dueDate}
                      </p>
                    </div>
                    <StatusBadge label={t.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ADD CONTACT MODAL */}
      {addContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                إضافة جهة اتصال مرتبطة بـ {account.name}
              </h3>
              <button
                type="button"
                onClick={() => setAddContactOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLinkedContact} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={contactFullName}
                  onChange={(e) => setContactFullName(e.target.value)}
                  placeholder="مثال: م. خالد بن فهد العبداللطيف"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">المنصب الوظيفي</label>
                <input
                  type="text"
                  value={contactJobTitle}
                  onChange={(e) => setContactJobTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">رقم الجوال</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={contactPrimary}
                  onChange={(e) => setContactPrimary(e.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                />
                <span className="font-bold text-[#0F172A]">
                  تعيين كجهة اتصال رئيسية وصانع قرار للمنشأة
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAddContactOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold"
                >
                  حفظ وربط جهة الاتصال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEAL MODAL */}
      {addDealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                إنشاء صفقة جديدة لمنشأة {account.name}
              </h3>
              <button
                type="button"
                onClick={() => setAddDealOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLinkedDeal} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">مسمى الصفقة *</label>
                <input
                  type="text"
                  required
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder={`مثال: اتفاقية تراخيص سنوية — ${account.name}`}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">القيمة المالية (ر.س)</label>
                  <input
                    type="number"
                    min="0"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">المرحلة</label>
                  <select
                    value={dealStage}
                    onChange={(e) => setDealStage(e.target.value as DealStage)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  >
                    <option value="تأهيل مبدئي">تأهيل مبدئي</option>
                    <option value="تحديد الاحتياج">تحديد الاحتياج</option>
                    <option value="عرض سعر">عرض سعر</option>
                    <option value="تفاوض">تفاوض</option>
                    <option value="مكتملة">مكتملة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">الاحتمالية (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={dealProbability}
                    onChange={(e) => setDealProbability(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">تاريخ الإغلاق المتوقع</label>
                  <input
                    type="date"
                    value={dealCloseDate}
                    onChange={(e) => setDealCloseDate(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAddDealOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold"
                >
                  حفظ وإنشاء الصفقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
