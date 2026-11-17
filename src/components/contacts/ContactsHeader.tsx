import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Columns3,
  Contact as ContactIcon,
  Copy,
  Download,
  GitMerge,
  Kanban,
  PlusCircle,
  Repeat,
  Table2,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type {
  ContactQuickFilterKey,
  ContactsSummaryMetrics,
} from '../../utils/contactsLogic';
import { formatCurrencySAR } from '../../utils/formatters';

export type ContactsViewMode = 'table' | 'kanban' | 'split' | 'chart';

interface ContactsHeaderProps {
  totalCount: number;
  filteredCount: number;
  metrics: ContactsSummaryMetrics;
  quickFilter: ContactQuickFilterKey;
  onChangeQuickFilter: (key: ContactQuickFilterKey) => void;
  quickCounts: Record<ContactQuickFilterKey, number>;
  viewMode: ContactsViewMode;
  onChangeViewMode: (mode: ContactsViewMode) => void;
  activeDockedCount: number;
  onToggleFilterPanel: () => void;
  onOpenCreateContact: () => void;
  onOpenImportCsv: () => void;
  onExportCsv: () => void;
  onFindDuplicates: () => void;
  canCreateContact: boolean;
}

export const ContactsHeader: React.FC<ContactsHeaderProps> = ({
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
  onOpenCreateContact,
  onOpenImportCsv,
  onExportCsv,
  onFindDuplicates,
  canCreateContact,
}) => {
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const viewModes: Array<{ id: ContactsViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'table', label: 'عرض الجدول', icon: <Table2 className="h-4 w-4" /> },
    { id: 'kanban', label: 'عرض كانبان', icon: <Kanban className="h-4 w-4" /> },
    { id: 'split', label: 'العرض المقسم الثلاثي', icon: <Columns3 className="h-4 w-4" /> },
    { id: 'chart', label: 'التحليلات والمخططات البيانية', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#ffffff] border-t border-b border-[#E2E8F0] px-4 lg:px-6 pt-4 pb-3.5 shadow-2xs space-y-3">
      {/* Row 1: Title + Live Count + Subtitle (Right) | 4-Icon View Switcher + Split CTA (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shrink-0">
            <ContactIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-bold text-[#131b2e] tracking-tight leading-tight whitespace-nowrap">
                جهات الاتصال (Contacts)
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#dbe1ff] text-[#00174b] text-[11px] font-semibold tabular-nums whitespace-nowrap">
                {filteredCount === totalCount
                  ? `${totalCount} سجل متاح`
                  : `${filteredCount} من ${totalCount} سجل`}
              </span>
            </div>
            <p className="text-[12px] text-[#737686] truncate">
              العملاء المحولون والمشترون وسجل الصفقات والمحادثات المستمرة عبر القنوات المتعددة
            </p>
          </div>
        </div>

        {/* Left: ONLY 4-Icon View Switcher + Split Primary CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <nav
            aria-label="أنماط عرض جهات الاتصال"
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

          {/* Split Primary Button [+ جهة اتصال جديدة | ⌄] */}
          <div className="relative inline-flex items-center" ref={splitRef}>
            <div className="inline-flex rounded-xl shadow-sm bg-[#2563EB] text-[#ffffff] overflow-hidden">
              <button
                type="button"
                onClick={onOpenCreateContact}
                disabled={!canCreateContact}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" />
                <span>جهة اتصال جديدة</span>
              </button>
              <div className="w-px bg-[#ffffff]/20" />
              <button
                type="button"
                onClick={() => setSplitMenuOpen((prev) => !prev)}
                aria-label="خيارات إضافية لجهات الاتصال"
                aria-expanded={splitMenuOpen}
                title="خيارات إضافية"
                className="px-2 py-2 hover:bg-[#1D4ED8] transition-colors flex items-center justify-center"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {splitMenuOpen && (
              <div className="flyout-surface absolute left-0 top-11 z-40 w-56 rounded-xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSplitMenuOpen(false);
                    onOpenImportCsv();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#131b2e] hover:bg-[#f2f3ff]"
                >
                  <Upload className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>استيراد جهات اتصال (CSV)</span>
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
                  <span>فحص ودمج التكرارات</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Quick Filter Pills (Right) | Key Business Metrics (Left) */}
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

          {/* جهاتي */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('my_contacts')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'my_contacts'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>جهاتي</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'my_contacts'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#eaedff] text-[#737686]'
              }`}
            >
              {quickCounts.my_contacts}
            </span>
          </button>

          {/* عملاء اشتروا فعلاً */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('purchased')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'purchased'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>عملاء اشتروا فعلاً</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'purchased'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#6ffbbe] text-[#002113]'
              }`}
            >
              {quickCounts.purchased}
            </span>
          </button>

          {/* لديهم صفقات مفتوحة */}
          <button
            type="button"
            onClick={() => onChangeQuickFilter('open_deals')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
              quickFilter === 'open_deals'
                ? 'bg-[#2563EB] text-[#ffffff] shadow-sm font-semibold'
                : 'bg-[#f2f3ff] text-[#434655] hover:bg-[#eaedff] shadow-2xs'
            }`}
          >
            <span>لديهم صفقات مفتوحة</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                quickFilter === 'open_deals'
                  ? 'bg-[#ffffff]/20 text-[#ffffff]'
                  : 'bg-[#e1e0ff] text-[#07006c]'
              }`}
            >
              {quickCounts.open_deals}
            </span>
          </button>

          {/* تكرار محتمل */}
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
            <span>تكرار محتمل</span>
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

        {/* Left: Deals Value & Repeat Purchase Rate */}
        <div className="hidden xl:flex items-center gap-3 text-[#737686] text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            <Wallet className="h-4 w-4 text-[#006242]" />
            <span>
              إجمالي قيمة الصفقات:{' '}
              <strong className="text-[#131b2e] tabular-nums">
                {formatCurrencySAR(metrics.totalDealsValue)}
              </strong>
            </span>
          </div>
          <div className="h-3 w-px bg-[#e2e7ff]" />
          <div className="flex items-center gap-1">
            <Repeat className="h-4 w-4 text-[#2563EB]" />
            <span>
              نسبة تكرار الشراء:{' '}
              <strong className="text-[#131b2e] tabular-nums">
                {metrics.repeatPurchasePercent}%
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
