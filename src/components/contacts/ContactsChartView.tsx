import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  BarChart3,
  Briefcase,
  Calendar,
  Check,
  CircleDot,
  Download,
  ExternalLink,
  MessageSquare,
  MousePointerClick,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Contact, Deal } from '../../types/crm';
import {
  aggregateContactsForChart,
  exportContactsToCsv,
  filterContactsByChartTimeRange,
  formatCompactDealValue,
  getContactOwnerName,
  getDealsForContact,
  resolveContactStatus,
  type ContactChartBucket,
  type ContactChartGroupBy,
  type ContactChartMeasure,
  type ContactChartTimeRange,
  type ContactChartType,
} from '../../utils/contactsLogic';
import { formatCurrencySAR } from '../../utils/formatters';
import { CHANNEL_LABELS } from '../../utils/leadsLogic';
import { getArabicInitials } from '../leads/LeadChannelIcon';

interface ContactsChartViewProps {
  contacts: Contact[];
  deals: Deal[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onOpenSplitView: (contactId: string) => void;
  onQuickChat: (contactId: string) => void;
  onOpenCreateDeal: (contact: Contact) => void;
  onOpenInTableView?: (params: {
    groupBy: ContactChartGroupBy;
    key: string;
    label: string;
  }) => void;
  onNotify?: (message: string) => void;
}

const BUCKET_PALETTE = [
  { hex: '#2563EB', bar: 'bg-blue-600 hover:bg-blue-700', badge: 'bg-[#EAEDFF] text-[#004AC6]', dot: 'bg-blue-600' },
  { hex: '#4F46E5', bar: 'bg-indigo-600 hover:bg-indigo-700', badge: 'bg-[#E1E0FF] text-[#4648D4]', dot: 'bg-indigo-600' },
  { hex: '#059669', bar: 'bg-emerald-600 hover:bg-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-600' },
  { hex: '#0284C7', bar: 'bg-sky-600 hover:bg-sky-700', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-600' },
  { hex: '#D97706', bar: 'bg-amber-500 hover:bg-amber-600', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  { hex: '#E11D48', bar: 'bg-rose-500 hover:bg-rose-600', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
];

const GROUP_BY_OPTIONS: Array<{ value: ContactChartGroupBy; label: string }> = [
  { value: 'contactStatus', label: 'حالة جهة الاتصال' },
  { value: 'channel', label: 'قناة التواصل' },
  { value: 'primarySource', label: 'المصدر الأساسي' },
  { value: 'assignedToName', label: 'مالك السجل' },
  { value: 'accountType', label: 'نوع العميل (B2B / B2C)' },
  { value: 'city', label: 'المدينة' },
];

const MEASURE_OPTIONS: Array<{ value: ContactChartMeasure; label: string }> = [
  { value: 'count', label: 'عدد جهات الاتصال (Count)' },
  { value: 'dealsValue', label: 'قيمة الصفقات المرتبطة (ر.س)' },
];

const TIME_RANGE_OPTIONS: Array<{ value: ContactChartTimeRange; label: string }> = [
  { value: 'all', label: 'أي وقت' },
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يوماً' },
  { value: 'quarter', label: 'هذا الربع' },
];

const CHART_TYPES: Array<{
  value: ContactChartType;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'bar', label: 'أعمدة (Column)', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'horizontal', label: 'أفقي (Bar)', icon: <BarChart2 className="h-4 w-4 rotate-90" /> },
  { value: 'pie', label: 'دائري (Pie)', icon: <PieChart className="h-4 w-4" /> },
  { value: 'donut', label: 'مجوف (Donut)', icon: <CircleDot className="h-4 w-4" /> },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export const ContactsChartView: React.FC<ContactsChartViewProps> = ({
  contacts,
  deals,
  selectedIds,
  onToggleSelect,
  onOpenSplitView,
  onQuickChat,
  onOpenCreateDeal,
  onOpenInTableView,
  onNotify,
}) => {
  const [groupBy, setGroupBy] = useState<ContactChartGroupBy>('contactStatus');
  const [measure, setMeasure] = useState<ContactChartMeasure>('count');
  const [chartType, setChartType] = useState<ContactChartType>('bar');
  const [timeRange, setTimeRange] = useState<ContactChartTimeRange>('all');

  const [drillBucketKey, setDrillBucketKey] = useState<string | null>(null);
  const [drillSearch, setDrillSearch] = useState('');

  const scopedContacts = useMemo(
    () => filterContactsByChartTimeRange(contacts, timeRange),
    [contacts, timeRange]
  );

  const buckets = useMemo(
    () => aggregateContactsForChart(scopedContacts, deals, groupBy, measure),
    [deals, groupBy, measure, scopedContacts]
  );

  const maxValue = useMemo(() => {
    const raw = Math.max(...buckets.map((b) => b.value), 1);
    return raw;
  }, [buckets]);

  const totalMetricValue = useMemo(
    () => buckets.reduce((sum, b) => sum + b.value, 0),
    [buckets]
  );

  const activeDrillBucket: ContactChartBucket | null = useMemo(
    () => (drillBucketKey ? buckets.find((b) => b.key === drillBucketKey) ?? null : null),
    [buckets, drillBucketKey]
  );

  const drillContacts = useMemo(() => {
    if (!activeDrillBucket) return [];
    const idSet = new Set(activeDrillBucket.contactIds);
    const q = drillSearch.trim().toLowerCase();
    return scopedContacts.filter((c) => {
      if (!idSet.has(c.id)) return false;
      if (!q) return true;
      return [c.fullName, c.accountName, c.phone ?? '', c.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [activeDrillBucket, drillSearch, scopedContacts]);

  const handleExportDrillCsv = () => {
    const target = drillContacts.length > 0 ? drillContacts : scopedContacts;
    const csv = exportContactsToCsv(target, deals);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-chart-${groupBy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.(`تم تصدير ${target.length} جهة اتصال إلى CSV.`);
  };

  const formatMetric = (val: number) =>
    measure === 'dealsValue' ? formatCompactDealValue(val) : String(val);

  return (
    <section aria-label="تحليلات ومخططات جهات الاتصال" className="space-y-4 pb-8">
      {/* Interactive Chart Config Bar */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Right: Group By & Measure */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="c-chart-groupby" className="text-xs font-bold text-[#434655]">
              تجميع حسب:
            </label>
            <select
              id="c-chart-groupby"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ContactChartGroupBy)}
              className="h-9 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
            >
              {GROUP_BY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="c-chart-measure" className="text-xs font-bold text-[#434655]">
              المقياس:
            </label>
            <select
              id="c-chart-measure"
              value={measure}
              onChange={(e) => setMeasure(e.target.value as ContactChartMeasure)}
              className="h-9 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
            >
              {MEASURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Left: Chart Type Selector + Time Range + Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#F2F3FF] p-1">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setChartType(ct.value)}
                title={ct.label}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                  chartType === ct.value
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                    : 'text-[#737686] hover:text-[#131B2E]'
                }`}
              >
                {ct.icon}
                <span className="hidden sm:inline">{ct.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#737686]" />
            <select
              aria-label="النطاق الزمني"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as ContactChartTimeRange)}
              className="h-9 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-semibold text-[#131B2E]"
            >
              {TIME_RANGE_OPTIONS.map((tr) => (
                <option key={tr.value} value={tr.value}>
                  {tr.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setGroupBy('contactStatus');
              setMeasure('count');
              setChartType('bar');
              setTimeRange('all');
            }}
            title="إعادة تعيين الإعدادات"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-[#737686] hover:text-[#131B2E]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#131B2E]">
              توزيع جهات الاتصال حسب{' '}
              {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
            </h2>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#737686]">
              <MousePointerClick className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>اضغط على أي عمود أو شريحة لعرض السجلات المطابقة فوراً</span>
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-lg bg-[#F2F3FF] px-3 py-1.5 font-semibold text-[#434655] tabular-nums">
              إجمالي السجلات: <strong className="text-[#131B2E]">{scopedContacts.length}</strong>
            </span>
            <span className="rounded-lg bg-[#ECFDF5] px-3 py-1.5 font-semibold text-[#059669] tabular-nums">
              إجمالي المقياس:{' '}
              <strong>
                {measure === 'dealsValue'
                  ? formatCurrencySAR(totalMetricValue)
                  : totalMetricValue}
              </strong>
            </span>
          </div>
        </div>

        {buckets.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#737686]">
            لا توجد بيانات متاحة لهذا النطاق الزمني.
          </div>
        ) : chartType === 'bar' ? (
          <div className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end min-h-[280px] border-b border-[#E2E8F0] pb-4 px-2">
              {buckets.map((bucket, idx) => {
                const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                const heightPct = Math.max(12, Math.round((bucket.value / maxValue) * 100));
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setDrillBucketKey(bucket.key)}
                    className="group flex flex-col items-center gap-2 focus:outline-none"
                  >
                    <span className="text-xs font-bold text-[#131B2E] tabular-nums">
                      {formatMetric(bucket.value)}
                    </span>
                    <div className="w-full max-w-[74px] h-[200px] flex items-end justify-center rounded-t-xl bg-[#F8FAFC] p-1">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all duration-300 shadow-xs ${palette.bar}`}
                      />
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold text-[#131B2E] group-hover:text-[#2563EB] line-clamp-2">
                        {bucket.label}
                      </p>
                      <p className="text-[10px] text-[#737686] tabular-nums">
                        {bucket.count} جهة · {formatCompactDealValue(bucket.totalDealsValue)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : chartType === 'horizontal' ? (
          <div className="space-y-3">
            {buckets.map((bucket, idx) => {
              const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
              const widthPct = Math.max(8, Math.round((bucket.value / maxValue) * 100));
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => setDrillBucketKey(bucket.key)}
                  className="w-full rounded-xl border border-[#F1F5F9] p-3 hover:border-[#2563EB]/40 hover:bg-[#F8FAFC] transition-all text-right space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#131B2E]">{bucket.label}</span>
                    <span className="font-bold text-[#2563EB] tabular-nums">
                      {formatMetric(bucket.value)} ({bucket.count} سجل)
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${palette.bar}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-2">
            <div className="flex justify-center">
              <svg viewBox="0 0 220 220" className="w-60 h-60">
                {(() => {
                  const safeTotal = Math.max(totalMetricValue, 1);
                  let currentAngle = 0;
                  return buckets.map((bucket, idx) => {
                    const sliceAngle = (bucket.value / safeTotal) * 359.9;
                    const path = describeArc(
                      110,
                      110,
                      92,
                      currentAngle,
                      currentAngle + sliceAngle
                    );
                    currentAngle += sliceAngle;
                    const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                    return (
                      <path
                        key={bucket.key}
                        d={path}
                        fill={palette.hex}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={() => setDrillBucketKey(bucket.key)}
                      />
                    );
                  });
                })()}
                {chartType === 'donut' && (
                  <>
                    <circle cx="110" cy="110" r="52" fill="#FFFFFF" />
                    <text
                      x="110"
                      y="106"
                      textAnchor="middle"
                      className="fill-[#131B2E] text-[18px] font-bold"
                    >
                      {scopedContacts.length}
                    </text>
                    <text
                      x="110"
                      y="126"
                      textAnchor="middle"
                      className="fill-[#737686] text-[10px]"
                    >
                      جهة اتصال
                    </text>
                  </>
                )}
              </svg>
            </div>

            <div className="space-y-2">
              {buckets.map((bucket, idx) => {
                const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                const pct = Math.round(
                  (bucket.value / Math.max(totalMetricValue, 1)) * 100
                );
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setDrillBucketKey(bucket.key)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs hover:border-[#2563EB] hover:bg-[#F8FAFC]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${palette.dot}`} />
                      <span className="font-bold text-[#131B2E]">{bucket.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${palette.badge}`}>
                        {formatMetric(bucket.value)}
                      </span>
                      <span className="text-[#737686] text-[11px]">{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Click-to-Drill-Down Modal */}
      {activeDrillBucket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`السجلات المطابقة: ${activeDrillBucket.label}`}
        >
          <div
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-[2px]"
            onClick={() => setDrillBucketKey(null)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#006242]/10 text-[#006242]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#131B2E]">
                      السجلات المطابقة: {activeDrillBucket.label}
                    </h3>
                    <span className="rounded-full bg-[#6FFBE0] px-2.5 py-0.5 text-[11px] font-bold text-[#002113] tabular-nums">
                      {drillContacts.length} سجل
                    </span>
                  </div>
                  <p className="text-[11px] text-[#737686] tabular-nums">
                    إجمالي قيمة الصفقات: {formatCurrencySAR(activeDrillBucket.totalDealsValue)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#737686]" />
                  <input
                    type="text"
                    value={drillSearch}
                    onChange={(e) => setDrillSearch(e.target.value)}
                    placeholder="بحث داخل السجلات..."
                    className="h-8 w-44 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-2 text-xs focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportDrillCsv}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-semibold text-[#131B2E] hover:bg-[#F2F3FF]"
                >
                  <Download className="h-3.5 w-3.5 text-[#006242]" />
                  <span>تصدير CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillBucketKey(null)}
                  aria-label="إغلاق"
                  className="rounded-lg p-1 text-[#737686] hover:bg-[#F2F3FF]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Drill-Down Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F2F3FF] text-[#434655]">
                  <tr>
                    <th className="py-2.5 px-3 w-8" />
                    <th className="py-2.5 px-3">جهة الاتصال</th>
                    <th className="py-2.5 px-3">المنشأة / الشركة</th>
                    <th className="py-2.5 px-3">رقم الجوال</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">الصفقات</th>
                    <th className="py-2.5 px-3">المسؤول</th>
                    <th className="py-2.5 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {drillContacts.map((c) => {
                    const selected = selectedIds.includes(c.id);
                    const cDeals = getDealsForContact(c, deals);
                    const dealsSum = cDeals.reduce((s, d) => s + d.amount, 0);
                    return (
                      <tr key={c.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => onToggleSelect(c.id)}
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              selected
                                ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                : 'border-[#CBD5E1] bg-[#FFFFFF]'
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <Link
                            to={`/contacts/${c.id}`}
                            onClick={() => setDrillBucketKey(null)}
                            className="font-bold text-[#131B2E] hover:text-[#2563EB]"
                          >
                            {c.fullName}
                          </Link>
                          <p className="text-[10px] text-[#737686]">
                            {CHANNEL_LABELS[c.channel ?? 'whatsapp']}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-[#434655]">{c.accountName}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums" dir="ltr">
                          {c.phone ?? '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                            {resolveContactStatus(c.contactStatus)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 tabular-nums">
                          {cDeals.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                              <Briefcase className="h-3 w-3" />
                              {cDeals.length} • {formatCompactDealValue(dealsSum)}
                            </span>
                          ) : (
                            <span className="text-[#737686]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#004AC6] text-[9px] font-bold text-[#FFFFFF]">
                              {getArabicInitials(getContactOwnerName(c))}
                            </span>
                            <span>{getContactOwnerName(c)}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onQuickChat(c.id)}
                              title="محادثة فورية"
                              className="rounded-lg bg-[#6FFBE0] p-1.5 text-[#002113] hover:bg-[#4EDEA3]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDrillBucketKey(null);
                                onOpenCreateDeal(c);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2 py-1 text-[10px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
                            >
                              <Plus className="h-3 w-3" />
                              <span>صفقة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDrillBucketKey(null);
                                onOpenSplitView(c.id);
                              }}
                              title="فتح العرض المقسم"
                              className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#434655] hover:bg-[#F2F3FF]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
              {onOpenInTableView ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInTableView({
                      groupBy,
                      key: activeDrillBucket.key,
                      label: activeDrillBucket.label,
                    });
                    setDrillBucketKey(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>فتح في عرض الجدول المفلتر</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setDrillBucketKey(null)}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-1.5 text-xs font-semibold text-[#131B2E] hover:bg-[#F2F3FF]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
