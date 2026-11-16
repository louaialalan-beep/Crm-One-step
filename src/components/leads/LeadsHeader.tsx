import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Columns3,
  Copy,
  Download,
  Filter,
  GitMerge,
  Kanban,
  Percent,
  PlusCircle,
  Table2,
  Upload,
  UserPlus,
} from 'lucide-react';
import type { QuickFilterKey, VelocityMetrics } from '../../utils/leadsLogic';

export type LeadsViewMode = 'table' | 'kanban' | 'split' | 'chart';

export type LeadTableColumnKey =
  | 'unique_id'
  | 'channel'
  | 'phone'
  | 'email'
  | 'city'
  | 'source'
  | 'status'
  | 'aiScore'
  | 'lastActivity'
  | 'assignedToName'
  | 'tags';

export const OPTIONAL_COLUMN_LABELS: Array<{ key: LeadTableColumnKey; label: string }> = [
  { key: 'unique_id', label: 'المعرف الفريد (RWQ)' },
  { key: 'channel', label: 'القناة المفضلة' },
  { key: 'phone', label: 'رقم الجوال' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'city', label: 'المدينة / الدولة' },
  { key: 'source', label: 'مصدر الاستقطاب الأساسي' },
  { key: 'status', label: 'المرحلة' },
  { key: 'aiScore', label: 'تقييم AI' },
  { key: 'lastActivity', label: 'آخر نشاط و SLA' },
  { key: 'assignedToName', label: 'مالك السجل' },
  { key: 'tags', label: 'الوسوم' },
];

interface LeadsHeaderProps {
  totalCount: number;
  filteredCount: number;
  metrics: VelocityMetrics;
  quickFilter: QuickFilterKey;
  onChangeQuickFilter: (key: QuickFilterKey) => void;
  quickCounts: Record<QuickFilterKey, number>;
  searchQuery?: string;
  onChangeSearchQuery?: (q: string) => void;
  viewMode: LeadsViewMode;
  onChangeViewMode: (mode: LeadsViewMode) => void;
  filterPanelOpen?: boolean;
  activeDockedCount: number;
  onToggleFilterPanel: () => void;
  visibleColumns?: LeadTableColumnKey[];
  onToggleColumn?: (col: LeadTableColumnKey) => void;
  onOpenCreateLead: () => void;
  onOpenImportCsv: () => void;
  onExportCsv: () => void;
  onFindDuplicates: () => void;
  canCreateLead: boolean;
}

export const LeadsHeader: React.FC<LeadsHeaderProps> = ({
  totalCount,
  filteredCount,
  metrics,
  quickFilter,
  onChangeQuickFilter,
  quickCounts,
  viewMode,
  onChangeViewMode,
  activeDockedCount,
  onToggleFilterPanel,
  onOpenCreateLead,
  onOpenImportCsv,
  onExportCsv,
  onFindDuplicates,
  canCreateLead,
}) => {
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const viewModes: Array<{ id: LeadsViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'table', label: 'عرض الجدول', icon: <Table2 className="h-4 w-4" /> },
    { id: 'kanban', label: 'عرض كانبان', icon: <Kanban className="h-4 w-4" /> },
    { id: 'split', label: 'العرض المقسم الثلاثي', icon: <Columns3 className="h-4 w-4" /> },
    { id: 'chart', label: 'عرض الرسوم البيانية', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#ffffff] border-t border-b border-[#E2E8F0] px-4 lg:px-6 pt-4 pb-3.5 shadow-2xs space-y-3">
      {/* Row 1: Filter Icon Box + Title/Badge/Subtitle (Right) & 4-Icon View Switcher + Split CTA (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shrink-0">
            <Filter className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-bold text-[#131b2e] tracking-tight leading-tight whitespace-nowrap">
                العملاء المحتملين (Leads)
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#dbe1ff] text-[#00174b] text-[11px] font-semibold tabular-nums whitespace-nowrap">
                {filteredCount === totalCount
                  ? `${totalCount} سجل متاح`
                  : `${filteredCount} من ${totalCount} سجل`}
              </span>
            </div>
            <p className="text-[12px] text-[#737686] truncate">
              إدارة وتأهيل جهات الاتصال التجارية وتتبع فرص التحويل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* 4-Icon View Switcher */}
          <nav
            aria-label="أنماط العرض"
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

          {/* Split Primary Button [+ عميل جديد | ⌄] */}
          <div className="relative inline-flex items-center" ref={splitRef}>
            <div className="inline-flex rounded-xl shadow-sm bg-[#2563EB] text-[#ffffff] overflow-hidden">
              <button
                type="button"
                onClick={onOpenCreateLead}
                disabled={!canCreateLead}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" />
                <span>عميل جديد</span>
              </button>
              <div className="w-px bg-[#ffffff]/20" />
              <button
                type="button"
                onClick={() => setSplitMenuOpen((prev) => !prev)}
                aria-label="خيارات إضافية للعملاء"
                aria-expanded={splitMenuOpen}
                title="خيارات إضافية"
                className="px-2 py-2 hover:bg-[#1D4ED8] transition-colors flex items-center justify-center"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {splitMenuOpen && (
              <div className="flyout-surface absolute left-0 top-11 z-40 w-52 rounded-xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSplitMenuOpen(false);
                    onOpenImportCsv();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                >
                  <Upload className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>استيراد عملاء (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMenuOpen(false);
                    onExportCsv();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                >
                  <Download className="h-3.5 w-3.5 text-[#006242]" />
                  <span>تصدير القائمة الحالية (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMenuOpen(false);
                    onFindDuplicates();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                >
                  <GitMerge className="h-3.5 w-3.5 text-[#D97706]" />
                  <span>فحص ودمج السجلات المكررة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Quick Filter Pills (Right) + Velocity KPIs (Left) */}
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

          {/* عملائي */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('my_leads')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'my_leads'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>عملائي</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'my_leads'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#eaedff] text-[#737686]'
              }`}
            >
              {quickCounts.my_leads}
            </span>
          </button>

          {/* لم يُرد عليهم */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('unanswered')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'unanswered'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                quickFilter === 'unanswered' ? 'bg-[#ffffff]' : 'bg-[#ba1a1a]'
              }`}
            />
            <span>لم يُرد عليهم</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'unanswered'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#ffdad6] text-[#93000a]'
              }`}
            >
              {quickCounts.unanswered}
            </span>
          </button>

          {/* ساخن */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('hot')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'hot'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>ساخن 🔥</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'hot'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#e1e0ff] text-[#07006c]'
              }`}
            >
              {quickCounts.hot}
            </span>
          </button>

          {/* مكرر محتمل */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('duplicates')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'duplicates'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#ffdad6]/40 text-[#93000a] hover:bg-[#ffdad6] shadow-2xs'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>مكرر محتمل</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                quickFilter === 'duplicates'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#ba1a1a] text-[#ffffff]'
              }`}
            >
              {quickCounts.duplicates}
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
            {activeDockedCount > 0 && (
              <span className="rounded-full bg-[#2563EB] px-1.5 py-0.2 text-[10px] font-bold text-[#ffffff] tabular-nums">
                {activeDockedCount}
              </span>
            )}
          </button>
        </div>

        {/* Left: Response Velocity & Conversion Rate */}
        <div className="hidden xl:flex items-center gap-3 text-[#737686] text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-[#006242]" />
            <span>
              متوسط سرعة الاستجابة:{' '}
              <strong className="text-[#131b2e] tabular-nums">{metrics.avgResponseLabel}</strong>
            </span>
          </div>
          <div className="h-3 w-px bg-[#e2e7ff]" />
          <div className="flex items-center gap-1">
            <Percent className="h-4 w-4 text-[#2563EB]" />
            <span>
              معدل التحويل:{' '}
              <strong className="text-[#131b2e] tabular-nums">
                {metrics.conversionRatePercent}%
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
