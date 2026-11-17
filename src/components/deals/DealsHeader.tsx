import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  Download,
  Kanban,
  Percent,
  Plus,
  PlusCircle,
  SlidersHorizontal,
  Table2,
  Wallet,
} from 'lucide-react';
import {
  DEAL_PIPELINES,
  type DealPipelineKey,
  type DealPipelineMetrics,
  type DealQuickFilterKey,
  type DealsViewMode,
} from '../../utils/dealsLogic';
import { formatCurrencySAR } from '../../utils/formatters';

interface DealsHeaderProps {
  pipeline: DealPipelineKey;
  onChangePipeline: (pipeline: DealPipelineKey) => void;
  viewMode: DealsViewMode;
  onChangeViewMode: (mode: DealsViewMode) => void;
  quickFilter: DealQuickFilterKey;
  onChangeQuickFilter: (filter: DealQuickFilterKey) => void;
  quickCounts: Record<DealQuickFilterKey, number>;
  metrics: DealPipelineMetrics;
  filterPanelOpen: boolean;
  activeDockedFilterCount: number;
  onToggleFilterPanel: () => void;
  onOpenCreateDeal: () => void;
  onExportCsv?: () => void;
  canCreateDeal: boolean;
  canViewAmount: boolean;
}

export const DealsHeader: React.FC<DealsHeaderProps> = ({
  pipeline,
  onChangePipeline,
  viewMode,
  onChangeViewMode,
  quickFilter,
  onChangeQuickFilter,
  quickCounts,
  metrics,
  activeDockedFilterCount,
  onToggleFilterPanel,
  onOpenCreateDeal,
  onExportCsv,
  canCreateDeal,
  canViewAmount,
}) => {
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false);
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const pipelineMenuRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (pipelineMenuRef.current && !pipelineMenuRef.current.contains(e.target as Node)) {
        setPipelineMenuOpen(false);
      }
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentPipeline =
    DEAL_PIPELINES.find((p) => p.key === pipeline) ?? DEAL_PIPELINES[0];

  const viewModes: Array<{ id: DealsViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'kanban', label: 'عرض كانبان', icon: <Kanban className="h-4 w-4" /> },
    { id: 'table', label: 'عرض القائمة', icon: <Table2 className="h-4 w-4" /> },
    { id: 'chart', label: 'عرض التحليلات', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#ffffff] border-t border-b border-[#E2E8F0] px-4 lg:px-6 pt-4 pb-3.5 shadow-2xs space-y-3">
      {/* Row 1: Icon Box + Title/Badge/Pipeline/Subtitle (Right) & Icon-Only View Switcher + Split CTA (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-bold text-[#131b2e] tracking-tight leading-tight whitespace-nowrap">
                إدارة الصفقات والفرص (Deals)
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#dbe1ff] text-[#00174b] text-[11px] font-semibold tabular-nums whitespace-nowrap">
                {metrics.activeDealsCount} صفقة نشطة
              </span>

              {/* Pipeline Switcher Dropdown */}
              <div className="relative" ref={pipelineMenuRef}>
                <button
                  type="button"
                  onClick={() => setPipelineMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={pipelineMenuOpen}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#f2f3ff] hover:bg-[#eaedff] px-2.5 py-0.5 text-[11px] font-semibold text-[#131b2e] transition-colors whitespace-nowrap"
                >
                  <span>{currentPipeline.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 text-[#737686] transition-transform ${
                      pipelineMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {pipelineMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="اختيار مسار المبيعات"
                    className="flyout-surface absolute right-0 mt-1.5 w-72 rounded-xl py-1.5 z-40"
                  >
                    {DEAL_PIPELINES.map((item) => {
                      const selected = item.key === pipeline;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            onChangePipeline(item.key);
                            setPipelineMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-right text-[12px] transition-colors ${
                            selected
                              ? 'bg-[#eff6ff] text-[#2563EB] font-semibold'
                              : 'text-[#131b2e] hover:bg-[#f2f3ff]'
                          }`}
                        >
                          <span>{item.label}</span>
                          {selected && (
                            <span className="text-[10px] font-bold text-[#2563EB]">نشط</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[12px] text-[#737686] truncate">
              متابعة مسارات المبيعات والمراحل الإلزامية والعوائد المرجحة لحظياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Icon-Only View Switcher (hover tooltips only, no visible text) */}
          <nav
            aria-label="أنماط عرض الصفقات"
            role="tablist"
            className="inline-flex p-1 bg-[#eaedff] rounded-xl shadow-inner"
          >
            {viewModes.map((mode) => {
              const active = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={mode.label}
                  title={mode.label}
                  onClick={() => onChangeViewMode(mode.id)}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                    active
                      ? 'bg-[#ffffff] text-[#004ac6] shadow-sm'
                      : 'text-[#737686] hover:text-[#131b2e]'
                  }`}
                >
                  {mode.icon}
                </button>
              );
            })}
          </nav>

          {/* Split Primary Button [+ إضافة صفقة جديدة | ⌄] */}
          <div className="relative inline-flex items-center" ref={splitRef}>
            <div className="inline-flex rounded-xl shadow-sm bg-[#2563EB] text-[#ffffff] overflow-hidden">
              <button
                type="button"
                onClick={onOpenCreateDeal}
                disabled={!canCreateDeal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة صفقة جديدة</span>
              </button>
              <div className="w-px bg-[#ffffff]/20" />
              <button
                type="button"
                onClick={() => setSplitMenuOpen((prev) => !prev)}
                aria-label="خيارات إضافية للصفقات"
                aria-expanded={splitMenuOpen}
                title="خيارات إضافية"
                className="px-2 py-2 hover:bg-[#1D4ED8] transition-colors flex items-center justify-center"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {splitMenuOpen && (
              <div className="flyout-surface absolute left-0 top-11 z-40 w-56 rounded-xl py-1.5">
                {onExportCsv && (
                  <button
                    type="button"
                    onClick={() => {
                      setSplitMenuOpen(false);
                      onExportCsv();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                  >
                    <Download className="h-3.5 w-3.5 text-[#006242]" />
                    <span>تصدير الصفقات الحالية (CSV)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSplitMenuOpen(false);
                    onToggleFilterPanel();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>تخصيص وفلاتر متقدمة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Quick Filter Pills (Right) + Pipeline & Weighted KPIs (Left) */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {/* الكل */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'all'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>الكل</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                quickFilter === 'all'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#eaedff] text-[#737686]'
              }`}
            >
              {quickCounts.all}
            </span>
          </button>

          {/* صفقاتي المخصصة */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('my_deals')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'my_deals'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>صفقاتي المخصصة</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'my_deals'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#eaedff] text-[#737686]'
              }`}
            >
              {quickCounts.my_deals}
            </span>
          </button>

          {/* إغلاق الشهر الحالي */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('closing_this_month')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'closing_this_month'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>إغلاق الشهر الحالي</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'closing_this_month'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#e1e0ff] text-[#07006c]'
              }`}
            >
              {quickCounts.closing_this_month}
            </span>
          </button>

          {/* متأخرة الإجراء */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('overdue')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'overdue'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#ffdad6]/40 text-[#93000a] hover:bg-[#ffdad6] shadow-2xs'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                quickFilter === 'overdue' ? 'bg-[#ffffff]' : 'bg-[#ba1a1a]'
              }`}
            />
            <span>متأخرة الإجراء</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                quickFilter === 'overdue'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#ba1a1a] text-[#ffffff]'
              }`}
            >
              {quickCounts.overdue}
            </span>
          </button>

          {/* + إضافة فلتر مخصص */}
          <button
            type="button"
            onClick={onToggleFilterPanel}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[#2563EB] hover:bg-[#dae2fd]/50 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>إضافة فلتر مخصص</span>
            {activeDockedFilterCount > 0 && (
              <span className="rounded-full bg-[#2563EB] px-1.5 py-0.2 text-[10px] font-bold text-[#ffffff] tabular-nums">
                {activeDockedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Left: Total Pipeline & Weighted Revenue KPIs */}
        <div className="hidden xl:flex items-center gap-3 text-[#737686] text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            <Wallet className="h-4 w-4 text-[#006242]" />
            <span>
              إجمالي المسار:{' '}
              <strong className="text-[#131b2e] tabular-nums">
                {canViewAmount ? formatCurrencySAR(metrics.totalPipelineValue) : 'محجوب (FLS)'}
              </strong>
            </span>
          </div>
          <div className="h-3 w-px bg-[#e2e7ff]" />
          <div className="flex items-center gap-1">
            <Percent className="h-4 w-4 text-[#2563EB]" />
            <span>
              العائد المرجح:{' '}
              <strong className="text-[#131b2e] tabular-nums">
                {canViewAmount
                  ? `${formatCurrencySAR(metrics.weightedPipelineValue)} (${metrics.weightedRatioPercent}%)`
                  : 'محجوب'}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
