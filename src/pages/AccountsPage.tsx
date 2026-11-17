import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Columns3,
  Download,
  ExternalLink,
  Kanban,
  MapPin,
  Percent,
  Plus,
  Search,
  Table2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { Account } from '../types/crm';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrencySAR } from '../utils/formatters';

export function getAccountCode(account: Account, index = 0): string {
  const digits = account.id.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `ACC-${digits.slice(-4)}`;
  }
  const hash = account.id
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 2040 + index);
  return `ACC-${String(hash).slice(-4).padStart(4, '2')}`;
}

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentOrgId,
    currentUser,
    accounts,
    contacts,
    deals,
    canViewField,
    createAccount,
  } = useCrm();

  const [quickFilter, setQuickFilter] = useState<'all' | 'استراتيجي' | 'مؤسسات' | 'نمو'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'split'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitFocusedId, setSplitFocusedId] = useState<string | null>(null);
  const [splitDropdownOpen, setSplitDropdownOpen] = useState(false);

  // Create Account Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIndustry, setDraftIndustry] = useState('تقنية المعلومات والحلول السحابية');
  const [draftCity, setDraftCity] = useState('الرياض');
  const [draftTier, setDraftTier] = useState<Account['tier']>('استراتيجي');
  const [draftAnnualRevenue, setDraftAnnualRevenue] = useState('4500000');
  const [draftEmployeesCount, setDraftEmployeesCount] = useState('150');
  const [draftWebsite, setDraftWebsite] = useState('');
  const [draftManager, setDraftManager] = useState(currentUser.fullName || 'طارق العتيبي');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Enrich accounts with ACC-xxxx code, linked Contacts, and linked Deals
  const enrichedAccounts = useMemo(() => {
    return accounts.map((acc, idx) => {
      const code = getAccountCode(acc, idx);
      const linkedContacts = contacts.filter(
        (c) =>
          c.accountId === acc.id ||
          c.accountId.endsWith(`_${acc.id}`) ||
          acc.id.endsWith(`_${c.accountId}`) ||
          c.accountName.trim() === acc.name.trim()
      );
      const linkedDeals = deals.filter(
        (d) =>
          d.accountId === acc.id ||
          d.accountId.endsWith(`_${acc.id}`) ||
          acc.id.endsWith(`_${d.accountId}`) ||
          d.accountName.trim() === acc.name.trim()
      );
      const activeAndWonDeals = linkedDeals.filter((d) => d.stage !== 'خسارة');
      const wonDeals = linkedDeals.filter((d) => d.stage === 'مكتملة');
      const activeWonTotal = activeAndWonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      const wonTotal = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      const primaryContact =
        linkedContacts.find((c) => c.isPrimary) ?? linkedContacts[0] ?? null;

      return {
        account: acc,
        code,
        linkedContacts,
        primaryContact,
        linkedDeals,
        activeAndWonDeals,
        wonDeals,
        activeWonTotal,
        wonTotal,
      };
    });
  }, [accounts, contacts, deals]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedAccounts.filter((item) => {
      if (quickFilter !== 'all' && item.account.tier !== quickFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.account.name.toLowerCase().includes(q) ||
        item.account.industry.toLowerCase().includes(q) ||
        (item.account.city && item.account.city.toLowerCase().includes(q)) ||
        item.account.accountManager.toLowerCase().includes(q)
      );
    });
  }, [enrichedAccounts, quickFilter, searchQuery]);

  const totalAnnualRevenue = useMemo(
    () => accounts.reduce((s, a) => s + (a.annualRevenue || 0), 0),
    [accounts]
  );

  const totalDealsPipeline = useMemo(
    () => enrichedAccounts.reduce((s, a) => s + a.activeWonTotal, 0),
    [enrichedAccounts]
  );

  const strategicRatio = useMemo(() => {
    if (accounts.length === 0) return 0;
    return Math.round(
      (accounts.filter((a) => a.tier === 'استراتيجي').length / accounts.length) * 100
    );
  }, [accounts]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredAccounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map((i) => i.account.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    const created = await createAccount({
      name: draftName.trim(),
      industry: draftIndustry.trim() || 'تقنية المعلومات',
      city: draftCity.trim() || 'الرياض',
      tier: draftTier,
      annualRevenue: Number(draftAnnualRevenue) || 0,
      employeesCount: Number(draftEmployeesCount) || 50,
      website: draftWebsite.trim() || undefined,
      accountManager: draftManager.trim() || currentUser.fullName,
    });
    setDraftName('');
    setDraftWebsite('');
    setCreateModalOpen(false);
    setToastMessage(`تم إنشاء المنشأة "${created.name}" بنجاح وإضافتها لقاعدة البيانات.`);
  };

  const handleExportCsv = () => {
    const header = [
      'رقم المنشأة',
      'اسم المنشأة',
      'القطاع',
      'المدينة',
      'التصنيف',
      'جهات الاتصال المرتبطة',
      'إجمالي الصفقات النشطة والمغلقة (SAR)',
      'الإيراد السنوي (SAR)',
      'مدير الحساب',
    ];
    const rows = filteredAccounts.map((item) => [
      item.code,
      item.account.name,
      item.account.industry,
      item.account.city || 'الرياض',
      item.account.tier,
      String(item.linkedContacts.length),
      String(item.activeWonTotal),
      String(item.account.annualRevenue),
      item.account.accountManager,
    ]);
    const csv =
      '\uFEFF' +
      [header, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq-accounts-${currentOrgId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSplitDropdownOpen(false);
    setToastMessage('تم تصدير سجل المنشآت والحسابات بصيغة CSV بنجاح.');
  };

  const focusedSplitItem = useMemo(() => {
    if (filteredAccounts.length === 0) return null;
    return (
      filteredAccounts.find((i) => i.account.id === splitFocusedId) ??
      filteredAccounts[0]
    );
  }, [filteredAccounts, splitFocusedId]);

  return (
    <div dir="rtl" className="space-y-4">
      {/* 1. FLUSH WHITE HEADER */}
      <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#FFFFFF] border-t border-b border-[#E2E8F0] px-4 lg:px-6 pt-4 pb-3.5 shadow-2xs space-y-3">
        {/* Row 1: Icon + Title + Count (Right) | Search + View Switcher + [+ منشأة جديدة] (Left) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[20px] font-extrabold text-[#0F172A] tracking-tight leading-tight whitespace-nowrap">
                  الشركات والحسابات المؤسسية (Accounts)
                </h1>
                <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] text-[11px] font-bold tabular-nums whitespace-nowrap">
                  {filteredAccounts.length === accounts.length
                    ? `${accounts.length} منشأة مسجلة`
                    : `${filteredAccounts.length} من ${accounts.length} منشأة`}
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] truncate">
                إدارة محفظة المنشآت، جهات الاتصال المرتبطة، والصفقات النشطة والمغلقة ({currentOrgId})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative w-60">
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم ACC-xxxx أو اسم المنشأة..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-1.5 text-[12px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>

            {/* View Switcher */}
            <nav
              aria-label="أنماط العرض"
              role="tablist"
              className="inline-flex p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]"
            >
              {(
                [
                  { id: 'table', label: 'عرض الجدول', icon: <Table2 className="h-4 w-4" /> },
                  { id: 'kanban', label: 'عرض كانبان حسب التصنيف', icon: <Kanban className="h-4 w-4" /> },
                  { id: 'split', label: 'العرض المقسم', icon: <Columns3 className="h-4 w-4" /> },
                ] as const
              ).map((mode) => {
                const active = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={mode.label}
                    title={mode.label}
                    onClick={() => setViewMode(mode.id)}
                    className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                      active
                        ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {mode.icon}
                  </button>
                );
              })}
            </nav>

            {/* Split Button [+ منشأة جديدة | ⌄] */}
            <div className="relative inline-flex items-center" ref={splitRef}>
              <div className="inline-flex rounded-xl shadow-xs bg-[#2563EB] text-[#FFFFFF] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold hover:bg-[#1D4ED8] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ منشأة جديدة</span>
                </button>
                <div className="w-px bg-[#FFFFFF]/20" />
                <button
                  type="button"
                  onClick={() => setSplitDropdownOpen((prev) => !prev)}
                  aria-label="خيارات إضافية للمنشآت"
                  aria-expanded={splitDropdownOpen}
                  className="px-2 py-2 hover:bg-[#1D4ED8] transition-colors flex items-center justify-center cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {splitDropdownOpen && (
                <div className="flyout-surface absolute left-0 top-11 z-40 w-52 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <Download className="h-3.5 w-3.5 text-[#059669]" />
                    <span>تصدير القائمة الحالية (CSV)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Quick Filter Tabs (Right) + Live Portfolio Metrics (Left) */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-0.5">
          <div className="flex items-center gap-1.5 flex-nowrap">
            {(
              [
                { key: 'all', label: 'الكل', count: accounts.length },
                {
                  key: 'استراتيجي',
                  label: 'حسابات استراتيجية',
                  count: accounts.filter((a) => a.tier === 'استراتيجي').length,
                },
                {
                  key: 'مؤسسات',
                  label: 'مؤسسات كبرى',
                  count: accounts.filter((a) => a.tier === 'مؤسسات').length,
                },
                {
                  key: 'نمو',
                  label: 'شركات النمو',
                  count: accounts.filter((a) => a.tier === 'نمو').length,
                },
              ] as const
            ).map((pill) => {
              const active = quickFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setQuickFilter(pill.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#2563EB] text-[#FFFFFF] font-bold shadow-2xs'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]/70 font-semibold'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tabular-nums ${
                      active ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#64748B]'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden xl:flex items-center gap-4 text-[#64748B] text-[11px] shrink-0">
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>
                إجمالي الصفقات النشطة والمغلقة:{' '}
                <strong className="text-[#0F172A] font-mono tabular-nums">
                  {canViewField('deals', 'amount')
                    ? formatCurrencySAR(totalDealsPipeline)
                    : 'محجوب (FLS)'}
                </strong>
              </span>
            </div>
            <div className="h-3 w-px bg-[#E2E8F0]" />
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-[#059669]" />
              <span>
                الإيرادات السنوية للمنشآت:{' '}
                <strong className="text-[#0F172A] font-mono tabular-nums">
                  {canViewField('accounts', 'annualRevenue')
                    ? formatCurrencySAR(totalAnnualRevenue)
                    : 'محجوب (FLS)'}
                </strong>
              </span>
            </div>
            <div className="h-3 w-px bg-[#E2E8F0]" />
            <div className="flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>
                الحسابات الاستراتيجية:{' '}
                <strong className="text-[#0F172A] font-mono tabular-nums">
                  {strategicRatio}%
                </strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46] shadow-2xs">
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

      {/* 2. HIGH-DENSITY ACCOUNTS TABLE / KANBAN / SPLIT */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                  <th className="w-9 px-2.5 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="تحديد جميع المنشآت"
                      checked={
                        filteredAccounts.length > 0 &&
                        selectedIds.length === filteredAccounts.length
                      }
                      onChange={handleToggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                  </th>
                  <th className="px-2.5 py-2.5 whitespace-nowrap">رقم المنشأة</th>
                  <th className="px-2.5 py-2.5">اسم المنشأة والقطاع</th>
                  <th className="px-2.5 py-2.5">التصنيف</th>
                  <th className="px-2.5 py-2.5">جهات الاتصال المرتبطة</th>
                  <th className="px-2.5 py-2.5">الصفقات النشطة والمغلقة</th>
                  <th className="px-2.5 py-2.5">الإيراد السنوي</th>
                  <th className="px-2.5 py-2.5">مدير الحساب</th>
                  <th className="px-2.5 py-2.5 text-left">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[#64748B]">
                      لا توجد منشآت مطابقة للبحث الحالي. اضغط على «+ منشأة جديدة» لإضافة حساب.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((item) => {
                    const { account } = item;
                    const checked = selectedIds.includes(account.id);
                    return (
                      <tr
                        key={account.id}
                        className={`hover:bg-[#F8FAFC] transition-colors ${
                          checked ? 'bg-[#EFF6FF]/50' : ''
                        }`}
                      >
                        <td className="px-2.5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`تحديد ${account.name}`}
                            checked={checked}
                            onChange={() => handleToggleSelectOne(account.id)}
                            className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2563EB]"
                          />
                        </td>

                        {/* ACC-xxxx */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <Link
                            to={`/accounts/${account.id}`}
                            className="font-mono font-extrabold text-[#2563EB] hover:underline tabular-nums"
                          >
                            {item.code}
                          </Link>
                        </td>

                        {/* Account Name + Industry & City */}
                        <td className="px-2.5 py-2.5">
                          <Link
                            to={`/accounts/${account.id}`}
                            className="font-extrabold text-[#0F172A] hover:text-[#2563EB] block"
                          >
                            {account.name}
                          </Link>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                            <span>{account.industry}</span>
                            {account.city && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3 text-[#94A3B8]" />
                                  {account.city}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <StatusBadge label={account.tier} />
                        </td>

                        {/* Linked Contacts count */}
                        <td className="px-2.5 py-2.5">
                          <Link
                            to={`/accounts/${account.id}`}
                            className="inline-flex items-center gap-1.5 font-bold text-[#0F172A] hover:text-[#2563EB] tabular-nums"
                          >
                            <Users className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                            <span>{item.linkedContacts.length} جهات اتصال</span>
                          </Link>
                          {item.primaryContact && (
                            <div className="text-[10px] text-[#64748B] truncate max-w-[160px]">
                              الرئيسي: {item.primaryContact.fullName}
                            </div>
                          )}
                        </td>

                        {/* Active & Won Deals Total */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <div className="font-mono font-extrabold text-[#059669] tabular-nums">
                            {canViewField('deals', 'amount')
                              ? formatCurrencySAR(item.activeWonTotal)
                              : 'محجوب (FLS)'}
                          </div>
                          <div className="text-[10px] text-[#64748B] tabular-nums">
                            {item.activeAndWonDeals.length} صفقة نشطة/رابحة (منها{' '}
                            {item.wonDeals.length} مغلقة)
                          </div>
                        </td>

                        {/* Annual Revenue */}
                        <td className="px-2.5 py-2.5 font-mono font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                          {canViewField('accounts', 'annualRevenue')
                            ? formatCurrencySAR(account.annualRevenue)
                            : 'محجوب (FLS)'}
                        </td>

                        {/* Account Manager */}
                        <td className="px-2.5 py-2.5 text-[#334155] font-semibold whitespace-nowrap">
                          {account.accountManager}
                        </td>

                        {/* Action */}
                        <td className="px-2.5 py-2.5 text-left whitespace-nowrap">
                          <Link
                            to={`/accounts/${account.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] px-2.5 py-1 text-[11px] font-bold text-[#2563EB] transition-colors"
                          >
                            <span>التفاصيل</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KANBAN VIEW BY TIER */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['استراتيجي', 'مؤسسات', 'نمو'] as const).map((tierKey) => {
            const group = filteredAccounts.filter((i) => i.account.tier === tierKey);
            return (
              <div
                key={tierKey}
                className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge label={tierKey} />
                    <span className="text-xs font-extrabold text-[#0F172A]">
                      تصنيف {tierKey}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#64748B] tabular-nums">
                    {group.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.map((item) => (
                    <div
                      key={item.account.id}
                      onClick={() => navigate(`/accounts/${item.account.id}`)}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#2563EB] p-3 space-y-2 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                          {item.code}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          {item.account.city || 'الرياض'}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold text-[#0F172A]">
                        {item.account.name}
                      </p>
                      <p className="text-[11px] text-[#64748B]">{item.account.industry}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-[11px]">
                        <span className="text-[#334155] font-semibold">
                          {item.linkedContacts.length} جهات اتصال
                        </span>
                        <span className="font-mono font-bold text-[#059669] tabular-nums">
                          {formatCurrencySAR(item.activeWonTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SPLIT VIEW */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] divide-y divide-[#F1F5F9] overflow-hidden shadow-2xs">
            {filteredAccounts.map((item) => {
              const isSelected = focusedSplitItem?.account.id === item.account.id;
              return (
                <button
                  key={item.account.id}
                  type="button"
                  onClick={() => setSplitFocusedId(item.account.id)}
                  className={`w-full text-right p-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                        {item.code}
                      </span>
                      <span className="text-xs font-extrabold text-[#0F172A]">
                        {item.account.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {item.account.industry} · {item.linkedContacts.length} جهات اتصال
                    </p>
                  </div>
                  <StatusBadge label={item.account.tier} />
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs">
            {focusedSplitItem ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-3">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-[#2563EB]">
                      {focusedSplitItem.code}
                    </span>
                    <h3 className="text-base font-extrabold text-[#0F172A] mt-0.5">
                      {focusedSplitItem.account.name}
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      {focusedSplitItem.account.industry} ·{' '}
                      {focusedSplitItem.account.city || 'الرياض'}
                    </p>
                  </div>
                  <Link
                    to={`/accounts/${focusedSplitItem.account.id}`}
                    className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold"
                  >
                    فتح ملف المنشأة الكامل ←
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <span className="text-[#64748B] block">جهات الاتصال المرتبطة</span>
                    <strong className="text-sm font-extrabold text-[#0F172A] tabular-nums">
                      {focusedSplitItem.linkedContacts.length}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <span className="text-[#64748B] block">الصفقات النشطة والمغلقة</span>
                    <strong className="text-sm font-mono font-extrabold text-[#059669] tabular-nums">
                      {formatCurrencySAR(focusedSplitItem.activeWonTotal)}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <span className="text-[#64748B] block">الإيراد السنوي</span>
                    <strong className="text-sm font-mono font-extrabold text-[#2563EB] tabular-nums">
                      {formatCurrencySAR(focusedSplitItem.account.annualRevenue)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] text-center py-8">
                اختر منشأة من القائمة لمعاينة تفاصيلها.
              </p>
            )}
          </div>
        </div>
      )}

      {/* CREATE NEW ACCOUNT MODAL ("+ منشأة جديدة") */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  إضافة منشأة / حساب مؤسسي جديد
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">
                  اسم المنشأة / الشركة *
                </label>
                <input
                  type="text"
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="مثال: شركة الرواد للحلول الرقمية القابضة"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">القطاع التجاري *</label>
                  <input
                    type="text"
                    required
                    value={draftIndustry}
                    onChange={(e) => setDraftIndustry(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">تصنيف المنشأة</label>
                  <select
                    value={draftTier}
                    onChange={(e) => setDraftTier(e.target.value as Account['tier'])}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  >
                    <option value="استراتيجي">استراتيجي</option>
                    <option value="مؤسسات">مؤسسات</option>
                    <option value="نمو">نمو</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">
                    الإيراد السنوي المقدر (ر.س)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draftAnnualRevenue}
                    onChange={(e) => setDraftAnnualRevenue(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">عدد الموظفين</label>
                  <input
                    type="number"
                    min="1"
                    value={draftEmployeesCount}
                    onChange={(e) => setDraftEmployeesCount(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">الموقع الإلكتروني</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={draftWebsite}
                    onChange={(e) => setDraftWebsite(e.target.value)}
                    placeholder="https://example.sa"
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">مدير الحساب المسؤول</label>
                  <input
                    type="text"
                    value={draftManager}
                    onChange={(e) => setDraftManager(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-bold"
                >
                  حفظ وإنشاء المنشأة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
