import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  CircleDot,
  Download,
  ExternalLink,
  Filter,
  Hash,
  Layers,
  MessageSquare,
  MoreVertical,
  MousePointerClick,
  PieChart,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Lead } from '../../types/crm';
import {
  aggregateLeadsForChart,
  exportLeadsToCsv,
  filterLeadsByChartTimeRange,
  type ChartBucket,
  type ChartDateField,
  type ChartGroupBy,
  type ChartMeasure,
  type ChartTimeRange,
  type ChartType,
} from '../../utils/leadsLogic';
import { getArabicInitials, LeadChannelBadge } from './LeadChannelIcon';

export interface LeadsChartViewProps {
  leads: Lead[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectMany?: (leadIds: string[], select: boolean) => void;
  onOpenSplitView: (leadId: string) => void;
  onQuickChat: (leadId: string) => void;
  onConvertLead: (lead: Lead) => void;
  onOpenInTableView?: (params: {
    groupBy: ChartGroupBy;
    key: string;
    label: string;
  }) => void;
  onNotify?: (message: string) => void;
}

const BUCKET_PALETTE = [
  {
    hex: '#3B82F6',
    bar: 'bg-blue-500 hover:bg-blue-600',
    badge: 'bg-[#EAEDFF] text-[#004AC6]',
    dot: 'bg-blue-500',
  },
  {
    hex: '#6366F1',
    bar: 'bg-indigo-500 hover:bg-indigo-600',
    badge: 'bg-[#E1E0FF] text-[#4648D4]',
    dot: 'bg-indigo-500',
  },
  {
    hex: '#10B981',
    bar: 'bg-emerald-500 hover:bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  {
    hex: '#0EA5E9',
    bar: 'bg-sky-500 hover:bg-sky-600',
    badge: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-500',
  },
  {
    hex: '#F59E0B',
    bar: 'bg-amber-500 hover:bg-amber-600',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  {
    hex: '#F43F5E',
    bar: 'bg-rose-500 hover:bg-rose-600',
    badge: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
  },
];

const GROUP_BY_OPTIONS: Array<{ value: ChartGroupBy; label: string; shortLabel: string }> = [
  { value: 'status', label: 'مرحلة التأهيل', shortLabel: 'مرحلة' },
  { value: 'channel', label: 'القناة', shortLabel: 'قناة' },
  { value: 'source', label: 'مصدر الاستقطاب', shortLabel: 'مصدر' },
  { value: 'assignedToName', label: 'مالك السجل', shortLabel: 'مالك السجل' },
  { value: 'city', label: 'المدينة', shortLabel: 'المدينة' },
];

const MEASURE_OPTIONS: Array<{ value: ChartMeasure; label: string }> = [
  { value: 'count', label: 'عدد السجلات (Count)' },
  { value: 'avgAiScore', label: 'متوسط درجة التأهيل' },
];

const DATE_FIELD_OPTIONS: Array<{ value: ChartDateField; label: string }> = [
  { value: 'createdAt', label: 'تاريخ الإنشاء' },
  { value: 'lastActivity', label: 'آخر نشاط' },
  { value: 'followUpAt', label: 'تاريخ المتابعة' },
];

const TIME_RANGE_OPTIONS: Array<{ value: ChartTimeRange; label: string }> = [
  { value: 'all', label: 'أي وقت' },
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يوماً' },
  { value: 'quarter', label: 'هذا الربع' },
];

const CHART_TYPE_OPTIONS: Array<{
  value: ChartType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'bar',
    label: 'مخطط أعمدة (Column)',
    shortLabel: 'أعمدة (Column)',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    value: 'horizontal',
    label: 'مخطط أفقي (Bar)',
    shortLabel: 'أفقي (Bar)',
    icon: <BarChart2 className="h-4 w-4 rotate-90" />,
  },
  {
    value: 'pie',
    label: 'مخطط دائري (Pie)',
    shortLabel: 'دائري (Pie)',
    icon: <PieChart className="h-4 w-4" />,
  },
  {
    value: 'donut',
    label: 'مخطط مجوف (Donut)',
    shortLabel: 'مجوف (Donut)',
    icon: <CircleDot className="h-4 w-4" />,
  },
];

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
];

function computeNiceAxisMax(rawMax: number, measure: ChartMeasure): number {
  if (measure === 'avgAiScore') return 100;
  if (rawMax <= 5) return 5;
  if (rawMax <= 10) return 10;
  if (rawMax <= 25) return Math.ceil(rawMax / 5) * 5;
  if (rawMax <= 50) return Math.ceil(rawMax / 10) * 10;
  return Math.ceil(rawMax / 25) * 25;
}

function buildPieArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180;
  const endRad = ((endAngleDeg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export const LeadsChartView: React.FC<LeadsChartViewProps> = ({
  leads,
  selectedIds,
  onToggleSelect,
  onToggleSelectMany,
  onOpenSplitView,
  onQuickChat,
  onConvertLead,
  onOpenInTableView,
  onNotify,
}) => {
  const [groupBy, setGroupBy] = useState<ChartGroupBy>('status');
  const [measure, setMeasure] = useState<ChartMeasure>('count');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [dateField, setDateField] = useState<ChartDateField>('createdAt');
  const [timeRange, setTimeRange] = useState<ChartTimeRange>('all');
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [drillBucket, setDrillBucket] = useState<ChartBucket | null>(null);
  const [drillSearch, setDrillSearch] = useState('');

  const chartMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (chartMenuRef.current && !chartMenuRef.current.contains(e.target as Node)) {
        setChartMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!drillBucket) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrillBucket(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [drillBucket]);

  const timeFilteredLeads = useMemo(
    () => filterLeadsByChartTimeRange(leads, dateField, timeRange),
    [dateField, leads, timeRange]
  );

  const buckets = useMemo(
    () => aggregateLeadsForChart(timeFilteredLeads, groupBy, measure),
    [groupBy, measure, timeFilteredLeads]
  );

  // Sync open drill-down bucket when live Firestore leads update
  const activeDrillBucket = useMemo(() => {
    if (!drillBucket) return null;
    return buckets.find((b) => b.key === drillBucket.key) ?? drillBucket;
  }, [buckets, drillBucket]);

  const rawMax = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.value)),
    [buckets]
  );
  const axisMax = useMemo(() => computeNiceAxisMax(rawMax, measure), [measure, rawMax]);
  const yTicks = useMemo(() => {
    const step = axisMax / 5;
    return [5, 4, 3, 2, 1, 0].map((i) => Math.round(i * step));
  }, [axisMax]);

  const totalMeasureValue = useMemo(
    () => buckets.reduce((sum, b) => sum + b.value, 0),
    [buckets]
  );

  const activeGroupMeta =
    GROUP_BY_OPTIONS.find((o) => o.value === groupBy) ?? GROUP_BY_OPTIONS[0];
  const activeChartMeta =
    CHART_TYPE_OPTIONS.find((o) => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];

  const formatMetricValue = (val: number) => {
    if (measure === 'avgAiScore') return `${val}%`;
    return String(val);
  };

  const drillAllLeads = useMemo(() => {
    if (!activeDrillBucket) return [];
    const idSet = new Set(activeDrillBucket.leadIds);
    return timeFilteredLeads.filter((l) => idSet.has(l.id));
  }, [activeDrillBucket, timeFilteredLeads]);

  const drillLeads = useMemo(() => {
    const q = drillSearch.trim().toLowerCase();
    if (!q) return drillAllLeads;
    return drillAllLeads.filter(
      (l) =>
        l.fullName.toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.source ?? '').toLowerCase().includes(q) ||
        (l.campaign ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        l.assignedToName.toLowerCase().includes(q) ||
        l.unique_id.toLowerCase().includes(q)
    );
  }, [drillAllLeads, drillSearch]);

  const selectedInDrillCount = useMemo(
    () => drillAllLeads.filter((l) => selectedIds.includes(l.id)).length,
    [drillAllLeads, selectedIds]
  );

  const allVisibleDrillSelected =
    drillLeads.length > 0 && drillLeads.every((l) => selectedIds.includes(l.id));

  const openDrillForBucket = (bucket: ChartBucket) => {
    setDrillSearch('');
    setDrillBucket(bucket);
  };

  const handleRefreshChart = () => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      setIsRefreshing(false);
      onNotify?.('تم تحديث بيانات المخطط من قاعدة البيانات الفورية.');
    }, 350);
  };

  const handleExportChartSummary = () => {
    const header = ['التصنيف', 'عدد السجلات', 'متوسط درجة التأهيل %', 'القيمة في المقياس الحالي'];
    const rows = buckets.map((b) =>
      [b.label, b.count, `${b.avgAiScore}%`, formatMetricValue(b.value)].join(',')
    );
    const csv = `\uFEFF${[header.join(','), ...rows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwaq-leads-chart-${groupBy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.('تم تصدير ملخص المخطط البياني بنجاح.');
  };

  const handleExportDrillExcel = () => {
    if (!activeDrillBucket || drillLeads.length === 0) return;
    const csv = exportLeadsToCsv(drillLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwaq-leads-${activeDrillBucket.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.(`تم تصدير ${drillLeads.length} سجل إلى ملف Excel (CSV).`);
  };

  const handleToggleAllVisibleDrill = () => {
    const visibleIds = drillLeads.map((l) => l.id);
    if (visibleIds.length === 0) return;
    if (onToggleSelectMany) {
      onToggleSelectMany(visibleIds, !allVisibleDrillSelected);
      return;
    }
    for (const id of visibleIds) {
      const currentlySelected = selectedIds.includes(id);
      if (allVisibleDrillSelected && currentlySelected) {
        onToggleSelect(id);
      } else if (!allVisibleDrillSelected && !currentlySelected) {
        onToggleSelect(id);
      }
    }
  };

  // Donut / Pie SVG geometry
  const donutRadius = 72;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeDonutOffset = 0;
  let cumulativePieAngle = 0;

  return (
    <div className="space-y-4">
      {/* 1. Interactive Chart Config Bar */}
      <div className="rounded-xl border border-[#C3C6D7]/40 bg-[#FFFFFF] p-3.5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        {/* Right Side: Group By + Measure */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label
              htmlFor="leads-chart-groupby"
              className="text-[12px] font-medium text-[#737686] whitespace-nowrap"
            >
              تجميع حسب (Group By):
            </label>
            <div className="relative flex items-center">
              <Layers className="pointer-events-none absolute right-2.5 h-4 w-4 text-[#004AC6]" />
              <select
                id="leads-chart-groupby"
                aria-label="تجميع حسب"
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value as ChartGroupBy);
                  setDrillBucket(null);
                }}
                className="h-8 appearance-none rounded-lg bg-[#F2F3FF] hover:bg-[#EAEDFF] pr-8 pl-7 text-[12px] font-semibold text-[#131B2E] shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 cursor-pointer"
              >
                {GROUP_BY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#737686]" />
            </div>
          </div>

          <span className="hidden sm:inline-block h-5 w-px bg-[#C3C6D7]/50" />

          <div className="flex items-center gap-2">
            <label
              htmlFor="leads-chart-measure"
              className="text-[12px] font-medium text-[#737686] whitespace-nowrap"
            >
              المقياس (Measure):
            </label>
            <div className="relative flex items-center">
              <Hash className="pointer-events-none absolute right-2.5 h-4 w-4 text-[#006242]" />
              <select
                id="leads-chart-measure"
                aria-label="المقياس"
                value={measure}
                onChange={(e) => setMeasure(e.target.value as ChartMeasure)}
                className="h-8 appearance-none rounded-lg bg-[#F2F3FF] hover:bg-[#EAEDFF] pr-8 pl-7 text-[12px] font-semibold text-[#131B2E] shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 cursor-pointer"
              >
                {MEASURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#737686]" />
            </div>
          </div>
        </div>

        {/* Left Side: Date Field + Time Range + Chart Type Selector Dropdown */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#737686]" />
            <select
              aria-label="حقل التاريخ"
              value={dateField}
              onChange={(e) => setDateField(e.target.value as ChartDateField)}
              className="h-8 appearance-none rounded-lg bg-[#F2F3FF] hover:bg-[#EAEDFF] pr-8 pl-7 text-[12px] font-medium text-[#131B2E] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 cursor-pointer"
            >
              {DATE_FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#737686]" />
          </div>

          <div className="relative flex items-center">
            <select
              aria-label="النطاق الزمني"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as ChartTimeRange)}
              className="h-8 appearance-none rounded-lg bg-[#F2F3FF] hover:bg-[#EAEDFF] pr-3 pl-7 text-[12px] font-medium text-[#131B2E] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 cursor-pointer"
            >
              {TIME_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#737686]" />
          </div>

          <span className="hidden sm:inline-block h-5 w-px bg-[#C3C6D7]/50" />

          {/* Chart Type Dropdown Selector */}
          <div className="relative" ref={chartMenuRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={chartMenuOpen}
              aria-label="اختيار نوع الرسم البياني"
              onClick={() => setChartMenuOpen((prev) => !prev)}
              className="flex h-8 items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#004AC6] px-3 text-[12px] font-bold text-[#FFFFFF] shadow-xs transition-all"
            >
              {activeChartMeta.icon}
              <span>{activeChartMeta.label}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {chartMenuOpen && (
              <div
                role="listbox"
                aria-label="أنواع المخططات"
                className="absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-xl"
              >
                {CHART_TYPE_OPTIONS.map((opt) => {
                  const selected = chartType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setChartType(opt.value);
                        setChartMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-right text-[12px] transition-colors ${
                        selected
                          ? 'bg-[#EFF6FF] font-bold text-[#2563EB]'
                          : 'font-medium text-[#131B2E] hover:bg-[#F2F3FF]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {opt.icon}
                        <span>{opt.label}</span>
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 text-[#2563EB]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Dynamic Interactive Chart Card */}
      <div className="rounded-xl border border-[#C3C6D7]/40 bg-[#FFFFFF] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#C3C6D7]/25 mb-6">
          <div>
            <h2 className="text-[15px] font-bold text-[#131B2E]">
              توزيع العملاء المحتملين حسب {activeGroupMeta.label}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#737686]">
              <MousePointerClick className="h-4 w-4 text-[#004AC6] shrink-0" />
              <span>
                انقر على أي عمود أو شريحة لاستعراض وتصفية السجلات التفصيلية فورياً (Drill-down)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshChart}
              title="تحديث المخطط"
              aria-label="تحديث المخطط"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C3C6D7]/50 text-[#737686] hover:bg-[#F2F3FF] hover:text-[#131B2E] transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportChartSummary}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[#C3C6D7]/50 px-3 text-[12px] font-medium text-[#434655] hover:bg-[#F2F3FF] hover:text-[#131B2E] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير المخطط</span>
            </button>
          </div>
        </div>

        {buckets.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[#737686]">
            لا توجد سجلات مطابقة ضمن الفلاتر والنطاق الزمني المحدد.
          </div>
        ) : chartType === 'bar' ? (
          /* Vertical Column Chart matching code.html */
          <div className="relative h-72 w-full flex flex-col justify-end pb-8 pr-10 pl-4">
            {/* Horizontal Y-Axis Gridlines */}
            <div className="pointer-events-none absolute inset-x-0 bottom-8 h-60 flex flex-col justify-between pr-10 pl-4">
              {yTicks.map((tick, idx) => (
                <div
                  key={`${tick}-${idx}`}
                  className={`w-full flex items-center justify-start ${
                    idx === yTicks.length - 1
                      ? 'border-b border-[#C3C6D7]/60'
                      : 'border-b border-[#C3C6D7]/25'
                  }`}
                >
                  <span className="-mr-9 w-7 text-left text-[11px] font-mono text-[#737686] tabular-nums">
                    {tick}
                  </span>
                </div>
              ))}
            </div>

            {/* Bars Grid */}
            <div
              className="relative z-10 grid h-60 items-end gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.max(buckets.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {buckets.map((bucket, idx) => {
                const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                const pctHeight = Math.max(8, Math.round((bucket.value / axisMax) * 100));
                const isSelectedBar = activeDrillBucket?.key === bucket.key;

                return (
                  <button
                    key={bucket.key}
                    type="button"
                    data-chart-bucket={bucket.key}
                    onClick={() => openDrillForBucket(bucket)}
                    className="group relative flex h-full flex-col items-center justify-end focus:outline-none"
                  >
                    <div
                      className={`mb-1.5 rounded px-2 py-0.5 text-[11px] font-bold shadow-xs tabular-nums ${palette.badge}`}
                    >
                      {formatMetricValue(bucket.value)}
                    </div>
                    <div
                      style={{ height: `${pctHeight}%` }}
                      className={`w-14 max-w-full rounded-t-lg shadow-sm transition-all ${
                        palette.bar
                      } ${
                        isSelectedBar
                          ? 'ring-4 ring-emerald-300/60 scale-[1.03]'
                          : 'group-hover:scale-[1.04]'
                      }`}
                    />
                    <div className="absolute -bottom-11 inset-x-0 text-center">
                      <span
                        className={`block truncate text-[12.5px] font-semibold ${
                          isSelectedBar ? 'text-[#006242] font-bold' : 'text-[#131B2E]'
                        }`}
                        title={bucket.label}
                      >
                        {bucket.label}
                      </span>
                      <span className="text-[11px] text-[#737686] tabular-nums">
                        {bucket.count} {bucket.count === 1 ? 'سجل' : 'سجلات'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : chartType === 'horizontal' ? (
          /* Horizontal Bar Chart */
          <div className="space-y-3 py-2">
            {buckets.map((bucket, idx) => {
              const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
              const widthPct = Math.max(6, Math.round((bucket.value / axisMax) * 100));
              const isSelectedBar = activeDrillBucket?.key === bucket.key;

              return (
                <button
                  key={bucket.key}
                  type="button"
                  data-chart-bucket={bucket.key}
                  onClick={() => openDrillForBucket(bucket)}
                  className={`w-full rounded-xl border p-3 text-right transition-all ${
                    isSelectedBar
                      ? 'border-[#2563EB] bg-[#EFF6FF]/40'
                      : 'border-transparent hover:border-[#C3C6D7]/50 hover:bg-[#F2F3FF]/70'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-[12.5px]">
                    <span className="font-bold text-[#131B2E]">{bucket.label}</span>
                    <span className="flex items-center gap-2 font-bold text-[#131B2E] tabular-nums">
                      <span className={`rounded px-2 py-0.5 text-[11px] ${palette.badge}`}>
                        {formatMetricValue(bucket.value)}
                      </span>
                      <span className="text-[11px] font-medium text-[#737686]">
                        ({bucket.count} {bucket.count === 1 ? 'سجل' : 'سجلات'})
                      </span>
                    </span>
                  </div>
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#EAEDFF]">
                    <div
                      style={{ width: `${widthPct}%`, backgroundColor: palette.hex }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : chartType === 'pie' ? (
          /* Filled SVG Pie Chart + Interactive Legend */
          <div className="grid grid-cols-1 items-center gap-6 py-4 md:grid-cols-2">
            <div className="flex justify-center">
              <svg width="220" height="220" viewBox="0 0 200 200" aria-label="مخطط دائري للعملاء">
                {buckets.length === 1 ? (
                  <circle
                    cx="100"
                    cy="100"
                    r="86"
                    fill={BUCKET_PALETTE[0].hex}
                    className="cursor-pointer transition-opacity hover:opacity-85"
                    onClick={() => openDrillForBucket(buckets[0])}
                  />
                ) : (
                  buckets.map((bucket, idx) => {
                    const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                    const ratio = totalMeasureValue > 0 ? bucket.value / totalMeasureValue : 0;
                    const angle = ratio * 360;
                    const start = cumulativePieAngle;
                    const end = start + Math.max(angle, 0.5);
                    cumulativePieAngle += angle;
                    const path = buildPieArcPath(100, 100, 86, start, end);

                    return (
                      <path
                        key={bucket.key}
                        d={path}
                        fill={palette.hex}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        data-chart-bucket={bucket.key}
                        className="cursor-pointer transition-opacity hover:opacity-85"
                        onClick={() => openDrillForBucket(bucket)}
                      />
                    );
                  })
                )}
              </svg>
            </div>

            <div className="space-y-2">
              {buckets.map((bucket, idx) => {
                const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                const pct =
                  totalMeasureValue > 0
                    ? Math.round((bucket.value / totalMeasureValue) * 100)
                    : 0;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    data-chart-bucket={bucket.key}
                    onClick={() => openDrillForBucket(bucket)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-right hover:bg-[#F2F3FF] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full shrink-0 ${palette.dot}`} />
                      <span className="text-[12.5px] font-semibold text-[#131B2E]">
                        {bucket.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] tabular-nums">
                      <span className="text-[#737686]">{pct}%</span>
                      <span className={`rounded px-2 py-0.5 font-bold ${palette.badge}`}>
                        {formatMetricValue(bucket.value)} ({bucket.count} سجل)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Hollow SVG Donut Chart + Interactive Legend */
          <div className="grid grid-cols-1 items-center gap-6 py-4 md:grid-cols-2">
            <div className="flex justify-center">
              <svg width="220" height="220" viewBox="0 0 200 200" aria-label="مخطط مجوف للعملاء">
                <circle
                  cx="100"
                  cy="100"
                  r={donutRadius}
                  fill="none"
                  stroke="#EAEDFF"
                  strokeWidth="28"
                />
                {buckets.map((bucket, idx) => {
                  const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                  const sliceRatio =
                    totalMeasureValue > 0 ? bucket.value / totalMeasureValue : 0;
                  const strokeDasharray = `${sliceRatio * donutCircumference} ${donutCircumference}`;
                  const strokeDashoffset = -cumulativeDonutOffset;
                  cumulativeDonutOffset += sliceRatio * donutCircumference;

                  return (
                    <circle
                      key={bucket.key}
                      cx="100"
                      cy="100"
                      r={donutRadius}
                      fill="none"
                      stroke={palette.hex}
                      strokeWidth="28"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 100 100)"
                      data-chart-bucket={bucket.key}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onClick={() => openDrillForBucket(bucket)}
                    />
                  );
                })}
                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  className="fill-[#131B2E] text-[20px] font-bold tabular-nums"
                >
                  {timeFilteredLeads.length}
                </text>
                <text
                  x="100"
                  y="116"
                  textAnchor="middle"
                  className="fill-[#737686] text-[11px] font-medium"
                >
                  إجمالي السجلات
                </text>
              </svg>
            </div>

            <div className="space-y-2">
              {buckets.map((bucket, idx) => {
                const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
                const pct =
                  totalMeasureValue > 0
                    ? Math.round((bucket.value / totalMeasureValue) * 100)
                    : 0;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    data-chart-bucket={bucket.key}
                    onClick={() => openDrillForBucket(bucket)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-right hover:bg-[#F2F3FF] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full shrink-0 ${palette.dot}`} />
                      <span className="text-[12.5px] font-semibold text-[#131B2E]">
                        {bucket.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] tabular-nums">
                      <span className="text-[#737686]">{pct}%</span>
                      <span className={`rounded px-2 py-0.5 font-bold ${palette.badge}`}>
                        {formatMetricValue(bucket.value)} ({bucket.count} سجل)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Chart Footer Summary */}
        <div
          className={`${
            chartType === 'bar' ? 'mt-12' : 'mt-6'
          } pt-4 border-t border-[#C3C6D7]/25 flex items-center justify-between text-[12px] text-[#434655] flex-wrap gap-3`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-[18px] w-[18px] text-[#004AC6]" />
            <span>
              إجمالي السجلات الممثلة:{' '}
              <strong className="font-bold text-[#131B2E] tabular-nums">
                {timeFilteredLeads.length} سجل
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-[12px]">
            {buckets.map((bucket, idx) => {
              const palette = BUCKET_PALETTE[idx % BUCKET_PALETTE.length];
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => openDrillForBucket(bucket)}
                  className="flex items-center gap-1.5 hover:text-[#131B2E] transition-colors"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${palette.dot}`} />
                  <span className="tabular-nums">
                    {bucket.label} ({bucket.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Centered Drill-Down Modal matching screen.png */}
      {activeDrillBucket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`السجلات المطابقة: ${activeDrillBucket.label}`}
        >
          <div
            className="fixed inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]"
            onClick={() => setDrillBucket(null)}
            aria-hidden="true"
          />

          <div className="relative z-10 flex w-full max-w-5xl max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
                  <Filter className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15.5px] font-bold text-[#0F172A]">
                      السجلات المطابقة: {activeGroupMeta.shortLabel} «{activeDrillBucket.label}»
                    </h3>
                    <span className="rounded-full bg-[#D1FAE5] px-2.5 py-0.5 text-[11px] font-bold text-[#065F46] tabular-nums">
                      {activeDrillBucket.count} سجل
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[#64748B] truncate">
                    العملاء المحتملين ‹ {activeGroupMeta.label} ‹{' '}
                    <span className="font-semibold text-[#334155]">
                      {activeDrillBucket.label}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={drillSearch}
                    onChange={(e) => setDrillSearch(e.target.value)}
                    placeholder="بحث في السجلات المطابقة..."
                    className="h-9 w-56 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-3 text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportDrillExcel}
                  disabled={drillLeads.length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 text-[12px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5 text-[#059669]" />
                  <span>تصدير Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDrillBucket(null)}
                  aria-label="إغلاق نافذة السجلات المطابقة"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Table */}
            <div className="flex-1 overflow-auto">
              {drillLeads.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[#64748B]">
                  لا توجد سجلات مطابقة لعبارة البحث الحالية.
                </div>
              ) : (
                <table className="w-full border-collapse text-right text-[12px]">
                  <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allVisibleDrillSelected}
                          onChange={handleToggleAllVisibleDrill}
                          aria-label="تحديد كل السجلات في نافذة التفاصيل"
                          className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] accent-[#2563EB] cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-3">العميل المحتمل</th>
                      <th className="px-3 py-3">مصدر الاستقطاب</th>
                      <th className="px-3 py-3">رقم الجوال</th>
                      <th className="px-3 py-3">القناة</th>
                      <th className="px-3 py-3">نقاط التأهيل</th>
                      <th className="px-3 py-3">المسؤول</th>
                      <th className="px-4 py-3 text-left">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {drillLeads.map((lead, idx) => {
                      const checked = selectedIds.includes(lead.id);
                      const avatarTone = AVATAR_TONES[idx % AVATAR_TONES.length];
                      const scoreTone =
                        lead.aiScore >= 90
                          ? 'bg-[#D1FAE5] text-[#047857]'
                          : lead.aiScore >= 80
                          ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                          : 'bg-[#FEF3C7] text-[#B45309]';

                      return (
                        <tr
                          key={lead.id}
                          className={`transition-colors hover:bg-[#F8FAFC] ${
                            checked ? 'bg-[#EFF6FF]/40' : 'bg-[#FFFFFF]'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleSelect(lead.id)}
                              aria-label={`تحديد ${lead.fullName}`}
                              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] accent-[#2563EB] cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone}`}
                              >
                                {getArabicInitials(lead.fullName)}
                              </span>
                              <div className="min-w-0">
                                <Link
                                  to={`/leads/${lead.id}`}
                                  onClick={() => setDrillBucket(null)}
                                  className="block font-bold text-[#0F172A] hover:text-[#2563EB] truncate"
                                >
                                  {lead.fullName}
                                </Link>
                                <span className="block text-[11px] text-[#64748B] truncate tabular-nums">
                                  {lead.city || lead.unique_id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="min-w-0 max-w-[180px]">
                              <span className="block font-semibold text-[#0F172A] truncate">
                                {lead.source || '—'}
                              </span>
                              <span className="block text-[11px] text-[#64748B] truncate">
                                {lead.campaign || lead.unique_id}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className="font-medium text-[#0F172A] tabular-nums"
                              dir="ltr"
                            >
                              {lead.phone || '—'}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <LeadChannelBadge channel={lead.channel} compact />
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${scoreTone}`}
                            >
                              {lead.aiScore}%
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DBE1FF] text-[10px] font-bold text-[#004AC6]">
                                {getArabicInitials(lead.assignedToName)}
                              </span>
                              <span className="text-[12px] font-medium text-[#0F172A]">
                                {lead.assignedToName}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onQuickChat(lead.id)}
                                title="محادثة فورية"
                                aria-label={`محادثة فورية مع ${lead.fullName}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10B981] text-[#FFFFFF] hover:bg-[#059669] transition-colors shadow-xs"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>

                              {lead.converted ? (
                                <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 text-[11px] font-bold text-[#047857]">
                                  <Check className="h-3.5 w-3.5" />
                                  <span>تم التحويل</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrillBucket(null);
                                    onConvertLead(lead);
                                  }}
                                  className="inline-flex h-8 items-center rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3 text-[11.5px] font-bold text-[#FFFFFF] shadow-xs transition-colors"
                                >
                                  تحويل العميل
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setDrillBucket(null);
                                  onOpenSplitView(lead.id);
                                }}
                                title="فتح العرض المقسم"
                                aria-label={`فتح العرض المقسم لـ ${lead.fullName}`}
                                className="flex h-8 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5 text-[12px] text-[#64748B]">
              <span className="font-medium tabular-nums">
                تم تحديد{' '}
                <strong className="font-bold text-[#0F172A]">{selectedInDrillCount}</strong> من{' '}
                <strong className="font-bold text-[#0F172A]">{activeDrillBucket.count}</strong> سجل
              </span>

              <div className="flex items-center gap-4 flex-wrap">
                <span className="tabular-nums">
                  عرض 1 إلى {drillLeads.length} من {activeDrillBucket.count}
                </span>

                {onOpenInTableView && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrillBucket(null);
                      onOpenInTableView({
                        groupBy,
                        key: activeDrillBucket.key,
                        label: activeDrillBucket.label,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>فتح في جدول مخصص</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDrillBucket(null)}
                  className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-1.5 text-[12px] font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
