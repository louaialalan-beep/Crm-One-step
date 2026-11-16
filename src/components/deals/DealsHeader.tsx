import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Kanban,
  List,
  PlusCircle,
  SlidersHorizontal,
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
  filterPanelOpen,
  activeDockedFilterCount,
  onToggleFilterPanel,
  onOpenCreateDeal,
  canCreateDeal,
  canViewAmount,
}) => {
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false);
  const pipelineMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (pipelineMenuRef.current && !pipelineMenuRef.current.contains(e.target as Node)) {
        setPipelineMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentPipeline =
    DEAL_PIPELINES.find((p) => p.key === pipeline) ?? DEAL_PIPELINES[0];

  const viewTabs: Array<{ id: DealsViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'kanban', label: 'كانبان', icon: <Kanban className="h-4 w-4" /> },
    { id: 'table', label: 'القائمة', icon: <List className="h-4 w-4" /> },
    { id: 'chart', label: 'التحليلات', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#ffffff] border-t border-b border-[#E2E8F0] px-4 lg:px-6 pt-3.5 pb-3 shadow-2xs space-y-3">
      {/* Row 1: Title + Active Badge + Pipeline Switcher (Right) | View Switcher + Create CTA (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <h1 className="text-[20px] font-bold text-[#131b2e] tracking-tight whitespace-nowrap">
            إدارة الصفقات والفرص
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] text-[11px] font-bold tabular-nums whitespace-nowrap">
            {metrics.activeDealsCount} صفقة نشطة
          </span>

          <span className="hidden sm:inline-block h-5 w-px bg-[#E2E8F0] mx-0.5" />

          {/* Pipeline Switcher Dropdown */}
          <div className="relative" ref={pipelineMenuRef}>
            <button
              type="button"
              onClick={() => setPipelineMenuOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={pipelineMenuOpen}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#ffffff] hover:bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#131b2e] transition-colors whitespace-nowrap shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
              <span>{currentPipeline.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#64748B] transition-transform ${
                  pipelineMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {pipelineMenuOpen && (
              <div
                role="listbox"
                aria-label="اختيار مسار المبيعات"
                className="absolute right-0 mt-1.5 w-80 rounded-xl border border-[#E2E8F0] bg-[#ffffff] shadow-lg py-1.5 z-40"
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
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-right text-[12px] transition-colors ${
                        selected
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                          : 'text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selected ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </span>
                      {selected && (
                        <span className="text-[10px] font-semibold text-[#2563EB]">نشط</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Left: 3-way View Switcher + Primary Add Deal CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <nav
            aria-label="أنماط عرض الصفقات"
            role="tablist"
            className="inline-flex items-center p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]"
          >
            {viewTabs.map((tab) => {
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onChangeViewMode(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[#ffffff] text-[#2563EB] shadow-xs'
                      : 'text-[#64748B] hover:text-[#131b2e]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onOpenCreateDeal}
            disabled={!canCreateDeal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#ffffff] px-4 py-2 text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>إضافة صفقة جديدة</span>
          </button>
        </div>
      </div>

      {/* Row 2: Quick Filter Pills + Customize Filters (Right) | Total & Weighted Pipeline Metrics (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onChangeQuickFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all tabular-nums whitespace-nowrap ${
              quickFilter === 'all'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-xs'
                : 'bg-[#ffffff] border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1] hover:text-[#131b2e]'
            }`}
          >
            <span>الكل ({quickCounts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeQuickFilter('my_deals')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all tabular-nums whitespace-nowrap ${
              quickFilter === 'my_deals'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-xs'
                : 'bg-[#ffffff] border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1] hover:text-[#131b2e]'
            }`}
          >
            <span>صفقاتي المخصصة ({quickCounts.my_deals})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeQuickFilter('closing_this_month')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all tabular-nums whitespace-nowrap ${
              quickFilter === 'closing_this_month'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-xs'
                : 'bg-[#ffffff] border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1] hover:text-[#131b2e]'
            }`}
          >
            <span>إغلاق الشهر الحالي ({quickCounts.closing_this_month})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeQuickFilter('overdue')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all tabular-nums whitespace-nowrap ${
              quickFilter === 'overdue'
                ? 'bg-[#E11D48] text-[#ffffff] border border-[#E11D48] shadow-xs'
                : 'bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] hover:bg-[#FFE4E6]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                quickFilter === 'overdue' ? 'bg-[#ffffff]' : 'bg-[#E11D48]'
              }`}
            />
            <span>متأخرة الإجراء ({quickCounts.overdue})</span>
          </button>

          <button
            type="button"
            onClick={onToggleFilterPanel}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors whitespace-nowrap border ${
              filterPanelOpen || activeDockedFilterCount > 0
                ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>تخصيص الفلاتر</span>
            {activeDockedFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#2563EB] text-[#ffffff] text-[10px] font-bold tabular-nums">
                {activeDockedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Left: Total Pipeline | Weighted Revenue Summary Pill */}
        <div className="inline-flex items-center gap-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-1.5 text-[12px] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">إجمالي المسار:</span>
            <span className="font-bold text-[#131b2e] tabular-nums">
              {canViewAmount ? formatCurrencySAR(metrics.totalPipelineValue) : 'محجوب (FLS)'}
            </span>
          </div>

          <span className="h-4 w-px bg-[#CBD5E1]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">العائد المرجح:</span>
            <span className="font-bold text-[#059669] tabular-nums">
              {canViewAmount ? formatCurrencySAR(metrics.weightedPipelineValue) : 'محجوب'}
            </span>
            {canViewAmount && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[11px] font-bold tabular-nums">
                {metrics.weightedRatioPercent}%
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
