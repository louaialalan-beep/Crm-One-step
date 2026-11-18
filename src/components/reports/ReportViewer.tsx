import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  MessageCircle,
  Pin,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ModuleName,
  ReportDefinition,
  ReportExecutionResult,
  ReportType,
  SummaryGroupNode,
  UserSecurityContext,
} from '../../types/reports';
import { executeReport, resolveFieldValue } from '../../lib/reports/query-engine';
import { MODULE_METADATA_CATALOG } from './ReportWizard';

export interface PinnedDashboardWidgetConfig {
  id: string;
  reportId: string;
  title: string;
  targetDashboard: 'executive' | 'sales' | 'marketing';
  size: '1x1' | '2x1' | '2x2';
  pinnedAt: string;
}

export interface ReportViewerProps {
  report: ReportDefinition;
  dataset: Record<ModuleName, any[]>;
  security: UserSecurityContext;
  onBack: () => void;
  onEditReport: (report: ReportDefinition) => void;
  onCloneReport: (report: ReportDefinition) => void;
  onScheduleReport: (report: ReportDefinition) => void;
  onOpenExportModal: (
    report: ReportDefinition,
    result: ReportExecutionResult
  ) => void;
  onNavigateToRecord?: (module: ModuleName, recordId: string, rwqId?: string) => void;
  onOpenWhatsAppChat?: (rwqId: string, name?: string) => void;
  onPinToDashboard?: (widget: PinnedDashboardWidgetConfig) => void;
}

const CHART_PALETTE = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#DC2626',
  '#4F46E5',
];

const REPORT_TYPE_BADGES: Record<ReportType, string> = {
  tabular: 'جدولي (Tabular)',
  summary: 'ملخص وتجميعي (Summary)',
  matrix: 'مصفوفي تقاطعي (Matrix)',
  joined: 'مدمج متعدد الكتل (Joined)',
};

function formatCellDisplay(value: any, fieldName: string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number') {
    const lower = fieldName.toLowerCase();
    if (
      lower.includes('sar') ||
      lower.includes('amount') ||
      lower.includes('revenue') ||
      lower.includes('total') ||
      lower.includes('spend') ||
      lower.includes('vat') ||
      lower.includes('margin') ||
      lower.includes('profit')
    ) {
      return `${value.toLocaleString('en-US')} ر.س`;
    }
    if (lower.includes('probability') || lower.includes('rate')) {
      return `${value}%`;
    }
    return value.toLocaleString('en-US');
  }
  return String(value);
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  report,
  dataset,
  security,
  onBack,
  onEditReport,
  onCloneReport,
  onScheduleReport,
  onOpenExportModal,
  onNavigateToRecord,
  onOpenWhatsAppChat,
  onPinToDashboard,
}) => {
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [showChart, setShowChart] = useState<boolean>(
    report.chartConfig?.enabled ?? true
  );
  const [showDetailRows, setShowDetailRows] = useState<boolean>(true);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100;

  // Collapsed Summary Group Keys
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Interactive Drill-Down Drawer State
  const [drillDownKey, setDrillDownKey] = useState<string | null>(null);
  const [drillDownRecordIds, setDrillDownRecordIds] = useState<string[]>([]);

  // Pin to Dashboard Modal State
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [pinTitle, setPinTitle] = useState<string>(report.name);
  const [pinDashboard, setPinDashboard] = useState<
    'executive' | 'sales' | 'marketing'
  >('executive');
  const [pinSize, setPinSize] = useState<'1x1' | '2x1' | '2x2'>('2x1');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    window.setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Execute Report Deterministically
  const executionResult = useMemo<ReportExecutionResult>(() => {
    void refreshCounter;
    return executeReport(report, dataset, security);
  }, [dataset, refreshCounter, report, security]);

  // Field label helper
  const getColumnArabicLabel = (colKey: string): string => {
    const bucket = report.buckets?.find((b) => b.id === colKey || b.label === colKey);
    if (bucket) return bucket.label;
    const formula = report.formulas?.find((f) => f.id === colKey || f.label === colKey);
    if (formula) return formula.label;

    if (colKey.includes('.')) {
      const [modPart, fieldPart] = colKey.split('.');
      const modMeta = MODULE_METADATA_CATALOG[modPart as ModuleName];
      const fieldMeta = modMeta?.fields.find((f) => f.name === fieldPart);
      if (fieldMeta) return `${fieldMeta.label} (${modMeta.label.split(' ')[0]})`;
    }

    const primaryMeta = MODULE_METADATA_CATALOG[report.primaryModule];
    const foundPrimary = primaryMeta?.fields.find((f) => f.name === colKey);
    if (foundPrimary) return foundPrimary.label;

    for (const modConfig of Object.values(MODULE_METADATA_CATALOG)) {
      const f = modConfig.fields.find((item) => item.name === colKey);
      if (f) return f.label;
    }
    return colKey;
  };

  // Filter rows by local quick search inside the report viewer
  const searchedRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return executionResult.rows;
    return executionResult.rows.filter((row) =>
      Object.values(row).some((val) =>
        val != null && String(val).toLowerCase().includes(q)
      )
    );
  }, [executionResult.rows, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchedRows.slice(start, start + pageSize);
  }, [currentPage, searchedRows]);

  // Drill-Down Records Resolver
  const drillDownRecords = useMemo(() => {
    if (!drillDownKey) return [];
    const idSet = new Set(drillDownRecordIds);
    return executionResult.rows.filter((row, idx) => {
      const rowId = String(
        row.id ??
          row.unique_id ??
          row.leadUniqueId ??
          row['deals.id'] ??
          row['leads.id'] ??
          `row_${idx}`
      );
      return idSet.has(rowId);
    });
  }, [drillDownKey, drillDownRecordIds, executionResult.rows]);

  const handleOpenDrillDownForChartKey = (keyLabel: string) => {
    const ids = executionResult.drillDownMap[keyLabel] ?? [];
    setDrillDownKey(keyLabel);
    setDrillDownRecordIds(ids);
  };

  const handlePinConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const widget: PinnedDashboardWidgetConfig = {
      id: `pin_${report.id}_${Date.now()}`,
      reportId: report.id,
      title: pinTitle.trim() || report.name,
      targetDashboard: pinDashboard,
      size: pinSize,
      pinnedAt: new Date().toISOString(),
    };

    try {
      const rawExisting = localStorage.getItem('riwaq_pinned_reports_v1');
      const parsed = rawExisting ? JSON.parse(rawExisting) : [];
      const nextList = [
        widget,
        ...(Array.isArray(parsed)
          ? parsed.filter((x: any) => x.reportId !== report.id)
          : []),
      ];
      localStorage.setItem('riwaq_pinned_reports_v1', JSON.stringify(nextList));
    } catch {
      // ignore storage quota errors
    }

    onPinToDashboard?.(widget);
    setPinModalOpen(false);
    const dashLabels = {
      executive: 'لوحة المدير التنفيذي',
      sales: 'لوحة المبيعات',
      marketing: 'لوحة التسويق',
    };
    showToast(
      `تم تثبيت التقرير "${widget.title}" في ${dashLabels[pinDashboard]} بحجم (${pinSize}).`
    );
  };

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Recursive Summary Group Renderer
  const renderSummaryGroupNode = (node: SummaryGroupNode): React.ReactNode => {
    const isCollapsed = Boolean(collapsedGroups[node.groupKey]);
    const subtotalEntries = Object.entries(node.subtotals).filter(
      ([k]) => !k.startsWith('sum_') && !k.startsWith('avg_') && !k.startsWith('min_') && !k.startsWith('max_') && k !== 'count'
    );

    return (
      <React.Fragment key={node.groupKey}>
        {/* Group Header Row */}
        <tr
          onClick={() => toggleGroupCollapse(node.groupKey)}
          className="border-b border-[#E2E8F0] bg-[#EFF6FF]/65 hover:bg-[#DBEAFE]/60 cursor-pointer transition-colors"
        >
          <td
            colSpan={Math.max(1, executionResult.visibleColumns.length)}
            className="py-2.5 px-4"
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2"
              style={{ paddingRight: `${node.level * 20}px` }}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronLeft className="h-4 w-4 text-[#2563EB]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#2563EB]" />
                )}
                <span className="text-[12px] font-extrabold text-[#1E3A8A]">
                  {getColumnArabicLabel(node.groupField)}:{' '}
                  <span className="text-[#0F172A]">{node.groupValue}</span>
                </span>
                <span className="rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-extrabold text-[#1D4ED8] tabular-nums">
                  {node.rowCount} سجل
                </span>
              </div>

              {/* Inline Subtotals */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#1E3A8A] tabular-nums">
                {subtotalEntries.map(([label, val]) => (
                  <span key={label}>
                    {label}:{' '}
                    <strong className="font-extrabold text-[#0F172A]">
                      {typeof val === 'number' ? val.toLocaleString('en-US') : val}
                    </strong>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrillDownKey(`${node.groupValue}`);
                    setDrillDownRecordIds(node.recordIds);
                  }}
                  className="rounded border border-[#BFDBFE] bg-[#FFFFFF] px-2 py-0.5 text-[10px] font-extrabold text-[#2563EB] hover:bg-[#2563EB] hover:text-[#FFFFFF]"
                >
                  عرض السجلات ({node.rowCount})
                </button>
              </div>
            </div>
          </td>
        </tr>

        {/* Nested Children or Leaf Detail Rows */}
        {!isCollapsed &&
          (node.children && node.children.length > 0
            ? node.children.map((child) => renderSummaryGroupNode(child))
            : showDetailRows &&
              node.rows.map((row, rIdx) => (
                <tr
                  key={`${node.groupKey}_row_${rIdx}`}
                  className="border-b border-[#F1F5F9] bg-[#FFFFFF] hover:bg-[#F8FAFC]"
                >
                  {executionResult.visibleColumns.map((col) => {
                    const cellVal = resolveFieldValue(row, col);
                    const isRwq =
                      col === 'unique_id' ||
                      col === 'leadUniqueId' ||
                      (typeof cellVal === 'string' && cellVal.startsWith('RWQ-'));
                    const isClickableName =
                      col === 'name' ||
                      col === 'title' ||
                      col === 'accountName' ||
                      col === 'customerName';

                    return (
                      <td
                        key={col}
                        className="py-2.5 px-4 text-[12px] text-[#334155] tabular-nums"
                      >
                        {isRwq || isClickableName ? (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToRecord?.(
                                report.primaryModule,
                                String(row.id ?? row.unique_id ?? row.leadUniqueId ?? ''),
                                String(row.unique_id ?? row.leadUniqueId ?? '')
                              )
                            }
                            className={`font-bold hover:underline cursor-pointer ${
                              isRwq
                                ? 'font-mono text-[#2563EB]'
                                : 'text-[#0F172A] hover:text-[#2563EB]'
                            }`}
                          >
                            {formatCellDisplay(cellVal, col)}
                          </button>
                        ) : (
                          formatCellDisplay(cellVal, col)
                        )}
                      </td>
                    );
                  })}
                </tr>
              )))}
      </React.Fragment>
    );
  };

  const chartData = executionResult.chartData ?? [];
  const activeChartType = report.chartConfig?.type ?? 'column';

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#F8FAFC] pb-14">
      {/* =================================================================== */}
      {/* 1. FLUSH TOP ACTION HEADER (`bg-white border-b border-[#E2E8F0]`)   */}
      {/* =================================================================== */}
      <header className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4 print:border-b-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Right: Back Button + Report Name + Type Badge + Metadata */}
          <div className="flex items-start gap-3.5">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-extrabold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer print:hidden"
            >
              <ArrowRight className="h-4 w-4 text-[#2563EB]" />
              <span>العودة للتقارير</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] sm:text-[20px] font-extrabold text-[#0F172A]">
                  {report.name}
                </h1>
                <span className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#2563EB]">
                  {REPORT_TYPE_BADGES[report.reportType]}
                </span>
                <span className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0F172A] tabular-nums">
                  {executionResult.totalRecordsMatched} سجل مطابق
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                <span>{report.description}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  آخر تشغيل: {executionResult.executedAt.slice(0, 19).replace('T', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Left: Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => {
                setRefreshCounter((c) => c + 1);
                showToast('تم إعادة تشغيل محرك الاستعلام وتحديث البيانات اللحظية.');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              onClick={() => onEditReport(report)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#475569]" />
              <span>تخصيص وتعديل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPinTitle(report.name);
                setPinModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] font-extrabold text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer"
            >
              <Pin className="h-3.5 w-3.5" />
              <span>تثبيت في لوحة التحكم</span>
            </button>

            <button
              type="button"
              onClick={() => onScheduleReport(report)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <CalendarClock className="h-3.5 w-3.5 text-[#475569]" />
              <span>جدولة</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenExportModal(report, executionResult)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-3.5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير</span>
            </button>

            <button
              type="button"
              onClick={() => onCloneReport(report)}
              title="استنساخ التقرير"
              className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>استنساخ</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              title="طباعة مباشرة"
              className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="p-6 space-y-5">
        {toastBanner && (
          <div className="flex items-center justify-between rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#059669]" />
              <span>{toastBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="text-[#047857]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* FLS Stripped Columns Alert if any */}
        {executionResult.strippedHiddenColumns.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-[12px] font-bold text-[#92400E]">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span>
              حماية أمان الحقول (FLS): تم حجب الحقول المقيدة التالية عن العرض والتصدير بناءً على صلاحيات دورك:{' '}
              {executionResult.strippedHiddenColumns.join(' ، ')}
            </span>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. COLLAPSIBLE INTERACTIVE CHART CARD WITH CLICK-TO-DRILL-DOWN    */}
        {/* ================================================================= */}
        {report.chartConfig?.enabled && chartData.length > 0 && (
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                    التحليل البصري التفاعلي — انقر على أي عنصر للحفر التفصيلي (Drill-Down)
                  </h2>
                  <p className="text-[11px] text-[#64748B]">
                    المحور الأفقي: {getColumnArabicLabel(report.chartConfig.xAxisField)} • المقياس:{' '}
                    {report.chartConfig.yAxisMetric}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChart((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer print:hidden"
              >
                {showChart ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 text-[#64748B]" />
                    <span>إخفاء الرسم البياني</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 text-[#2563EB]" />
                    <span>إظهار الرسم البياني</span>
                  </>
                )}
              </button>
            </div>

            {showChart && (
              <div className="space-y-4">
                <div className="h-72 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChartType === 'line' ? (
                      <LineChart
                        data={chartData}
                        onClick={(state: any) => {
                          const label = state?.activeLabel;
                          if (label) handleOpenDrillDownForChartKey(String(label));
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#334155' }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name={report.name}
                          stroke="#2563EB"
                          strokeWidth={3}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    ) : activeChartType === 'pie' || activeChartType === 'donut' ? (
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={activeChartType === 'donut' ? 58 : 0}
                          outerRadius={96}
                          label={report.chartConfig.showLabels}
                          onClick={(entry: any) => {
                            if (entry?.label) {
                              handleOpenDrillDownForChartKey(String(entry.label));
                            }
                          }}
                        >
                          {chartData.map((pt, index) => (
                            <Cell
                              key={pt.key}
                              fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                              className="cursor-pointer"
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    ) : activeChartType === 'funnel' ? (
                      <FunnelChart>
                        <Tooltip />
                        <Funnel
                          dataKey="value"
                          data={chartData}
                          isAnimationActive={false}
                          onClick={(entry: any) => {
                            if (entry?.label) {
                              handleOpenDrillDownForChartKey(String(entry.label));
                            }
                          }}
                        >
                          <LabelList
                            position="right"
                            fill="#0F172A"
                            stroke="none"
                            dataKey="label"
                          />
                          {chartData.map((pt, index) => (
                            <Cell
                              key={pt.key}
                              fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                              className="cursor-pointer"
                            />
                          ))}
                        </Funnel>
                      </FunnelChart>
                    ) : (
                      <BarChart
                        data={chartData}
                        layout={activeChartType === 'bar' ? 'vertical' : 'horizontal'}
                        onClick={(state: any) => {
                          const label = state?.activeLabel;
                          if (label) handleOpenDrillDownForChartKey(String(label));
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        {activeChartType === 'bar' ? (
                          <>
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#334155' }} />
                            <YAxis
                              dataKey="label"
                              type="category"
                              width={140}
                              tick={{ fontSize: 11, fill: '#334155' }}
                            />
                          </>
                        ) : (
                          <>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#334155' }} />
                          </>
                        )}
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          name="القيمة"
                          radius={[6, 6, 0, 0]}
                          onClick={(barData: any) => {
                            if (barData?.label) {
                              handleOpenDrillDownForChartKey(String(barData.label));
                            }
                          }}
                        >
                          {chartData.map((pt, index) => (
                            <Cell
                              key={pt.key}
                              fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                              className="cursor-pointer"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Quick Interactive Drill-Down Chips below chart */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F1F5F9] pt-3">
                  <span className="text-[11px] font-bold text-[#64748B]">
                    حفر تفصيلي سريع (Drill-Down):
                  </span>
                  {chartData.map((pt, idx) => (
                    <button
                      key={pt.key}
                      type="button"
                      onClick={() => handleOpenDrillDownForChartKey(pt.key)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-bold text-[#0F172A] hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer tabular-nums"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length],
                        }}
                      />
                      <span>{pt.label}</span>
                      <span className="text-[#2563EB]">({pt.recordCount})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* 3. REPORT DATA GRID (TABULAR / SUMMARY / MATRIX / JOINED)         */}
        {/* ================================================================= */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
          {/* Grid Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FFFFFF] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              {report.reportType === 'summary' && (
                <label className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-bold text-[#0F172A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDetailRows}
                    onChange={(e) => setShowDetailRows(e.target.checked)}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>إظهار صفوف التفاصيل</span>
                </label>
              )}

              <div className="relative w-64">
                <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="بحث سريع داخل نتائج التقرير..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-3 py-1.5 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3 text-[12px] font-bold text-[#475569] tabular-nums">
              <span>
                عرض {searchedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, searchedRows.length)} من أصل{' '}
                {searchedRows.length} سجل
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[#E2E8F0] p-1 hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-[#E2E8F0] p-1 hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 3A. MATRIX REPORT VIEW */}
          {report.reportType === 'matrix' && executionResult.matrixGrid ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[12px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
                    <th className="py-3 px-4 font-extrabold border-l border-[#E2E8F0]">
                      {getColumnArabicLabel(report.groupByRows[0]?.field ?? '')} \{' '}
                      {getColumnArabicLabel(report.groupByColumns?.[0]?.field ?? '')}
                    </th>
                    {executionResult.matrixGrid.columnHeaders.map((colHdr) => (
                      <th
                        key={colHdr}
                        className="py-3 px-4 text-center font-extrabold border-l border-[#E2E8F0]"
                      >
                        {colHdr}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-center font-extrabold bg-[#EFF6FF] text-[#1E3A8A]">
                      إجمالي الصف
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {executionResult.matrixGrid.rowHeaders.map((rowHdr) => {
                    const rowTot = executionResult.matrixGrid!.rowTotals[rowHdr] ?? {};
                    const primaryMetricKey =
                      report.aggregations[1]
                        ? `${report.aggregations[1].fn}_${report.aggregations[1].field}`
                        : 'count';

                    return (
                      <tr key={rowHdr} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 font-extrabold text-[#0F172A] border-l border-[#E2E8F0] bg-[#F8FAFC]/50">
                          {rowHdr}
                        </td>
                        {executionResult.matrixGrid!.columnHeaders.map((colHdr) => {
                          const cell =
                            executionResult.matrixGrid!.cells[rowHdr]?.[colHdr];
                          const val = cell?.aggregates?.[primaryMetricKey] ?? 0;
                          const cnt = cell?.rowCount ?? 0;

                          return (
                            <td
                              key={colHdr}
                              onClick={() => {
                                if (cnt > 0 && cell) {
                                  setDrillDownKey(`${rowHdr} × ${colHdr}`);
                                  setDrillDownRecordIds(cell.recordIds);
                                }
                              }}
                              className={`py-3 px-4 text-center border-l border-[#E2E8F0] tabular-nums ${
                                cnt > 0
                                  ? 'cursor-pointer hover:bg-[#EFF6FF]'
                                  : 'text-[#CBD5E1]'
                              }`}
                            >
                              {cnt > 0 ? (
                                <div>
                                  <p className="font-extrabold text-[#0F172A]">
                                    {typeof val === 'number'
                                      ? val.toLocaleString('en-US')
                                      : val}
                                  </p>
                                  <p className="text-[10px] font-bold text-[#2563EB]">
                                    ({cnt} سجل)
                                  </p>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-center font-extrabold bg-[#EFF6FF]/40 text-[#1E3A8A] tabular-nums">
                          {typeof rowTot[primaryMetricKey] === 'number'
                            ? rowTot[primaryMetricKey].toLocaleString('en-US')
                            : rowTot.count ?? 0}
                          <span className="block text-[10px] text-[#64748B]">
                            ({rowTot.count ?? 0} سجل)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#BFDBFE] bg-[#EFF6FF] font-extrabold text-[#1E3A8A]">
                    <td className="py-3 px-4 border-l border-[#BFDBFE]">
                      الإجمالي الكلي (Grand Total)
                    </td>
                    {executionResult.matrixGrid.columnHeaders.map((colHdr) => {
                      const colTot =
                        executionResult.matrixGrid!.columnTotals[colHdr] ?? {};
                      const primaryMetricKey =
                        report.aggregations[1]
                          ? `${report.aggregations[1].fn}_${report.aggregations[1].field}`
                          : 'count';
                      return (
                        <td
                          key={colHdr}
                          className="py-3 px-4 text-center border-l border-[#BFDBFE] tabular-nums"
                        >
                          {typeof colTot[primaryMetricKey] === 'number'
                            ? colTot[primaryMetricKey].toLocaleString('en-US')
                            : colTot.count ?? 0}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center bg-[#DBEAFE] text-[#1E3A8A] tabular-nums">
                      {executionResult.totalRecordsMatched} سجل
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : report.reportType === 'joined' && executionResult.joinedBlocks ? (
            /* 3B. JOINED MULTI-BLOCK REPORT VIEW */
            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
              {executionResult.joinedBlocks.map((block) => (
                <div
                  key={block.blockId}
                  className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                        {block.title}
                      </h3>
                      <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-extrabold text-[#2563EB] tabular-nums">
                        {block.rows.length} سجل
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-right text-[11px]">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B]">
                            {block.visibleColumns.map((col) => (
                              <th key={col} className="py-2 px-3 font-extrabold">
                                {getColumnArabicLabel(col)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {block.rows.slice(0, 25).map((r, idx) => (
                            <tr key={idx} className="hover:bg-[#F8FAFC]">
                              {block.visibleColumns.map((col) => (
                                <td
                                  key={col}
                                  className="py-2 px-3 text-[#334155] tabular-nums"
                                >
                                  {formatCellDisplay(resolveFieldValue(r, col), col)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-[#DBEAFE] bg-[#EFF6FF] px-4 py-2.5 text-[11px] font-extrabold text-[#1E3A8A] flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <span>إجمالي الكتلة:</span>
                    <span>{block.rows.length} سجل</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 3C. SUMMARY OR TABULAR REPORT VIEW */
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                    {executionResult.visibleColumns.map((col) => (
                      <th key={col} className="py-3 px-4 whitespace-nowrap">
                        {getColumnArabicLabel(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {report.reportType === 'summary' &&
                  executionResult.summaryGroups &&
                  executionResult.summaryGroups.length > 0 ? (
                    executionResult.summaryGroups.map((grpNode) =>
                      renderSummaryGroupNode(grpNode)
                    )
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, executionResult.visibleColumns.length)}
                        className="py-12 text-center text-[#64748B] font-bold"
                      >
                        لا توجد سجلات مطابقة لمعايير التصفية الحالية
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC]">
                        {executionResult.visibleColumns.map((col) => {
                          const cellVal = resolveFieldValue(row, col);
                          const isRwq =
                            col === 'unique_id' ||
                            col === 'leadUniqueId' ||
                            (typeof cellVal === 'string' &&
                              cellVal.startsWith('RWQ-'));
                          const isClickableName =
                            col === 'name' ||
                            col === 'title' ||
                            col === 'accountName' ||
                            col === 'customerName';

                          return (
                            <td
                              key={col}
                              className="py-2.5 px-4 text-[#334155] tabular-nums"
                            >
                              {isRwq || isClickableName ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateToRecord?.(
                                      report.primaryModule,
                                      String(
                                        row.id ??
                                          row.unique_id ??
                                          row.leadUniqueId ??
                                          ''
                                      ),
                                      String(row.unique_id ?? row.leadUniqueId ?? '')
                                    )
                                  }
                                  className={`font-bold hover:underline cursor-pointer ${
                                    isRwq
                                      ? 'font-mono text-[#2563EB]'
                                      : 'text-[#0F172A] hover:text-[#2563EB]'
                                  }`}
                                >
                                  {formatCellDisplay(cellVal, col)}
                                </button>
                              ) : (
                                formatCellDisplay(cellVal, col)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Sticky Grand Total Footer Row */}
                <tfoot>
                  <tr className="border-t-2 border-[#BFDBFE] bg-[#EFF6FF] font-extrabold text-[#1E3A8A]">
                    <td
                      colSpan={Math.max(1, executionResult.visibleColumns.length)}
                      className="py-3.5 px-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 tabular-nums">
                        <span className="text-[13px]">
                          الإجمالي الكلي للتقرير (Grand Total):
                        </span>
                        <div className="flex flex-wrap items-center gap-6 text-[12px]">
                          {Object.entries(executionResult.grandTotals)
                            .filter(
                              ([k]) =>
                                !k.startsWith('sum_') &&
                                !k.startsWith('avg_') &&
                                !k.startsWith('min_') &&
                                !k.startsWith('max_') &&
                                k !== 'count'
                            )
                            .map(([label, val]) => (
                              <span key={label}>
                                {label}:{' '}
                                <strong className="text-[#0F172A]">
                                  {typeof val === 'number'
                                    ? val.toLocaleString('en-US')
                                    : val}
                                </strong>
                              </span>
                            ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* =================================================================== */}
      {/* SLIDE-OVER DRILL-DOWN DRAWER                                        */}
      {/* =================================================================== */}
      {drillDownKey && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/45 backdrop-blur-[1px]"
          onClick={() => setDrillDownKey(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-xl flex-col border-r border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  تفاصيل السجلات المرتبطة: {drillDownKey}
                </h3>
                <p className="text-[12px] text-[#64748B] tabular-nums">
                  إجمالي {drillDownRecords.length} سجل مطابق في هذا القسم
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrillDownKey(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {drillDownRecords.map((rec, idx) => {
                const rwq = String(
                  rec.unique_id ?? rec.leadUniqueId ?? rec.id ?? '—'
                );
                const title = String(
                  rec.title ??
                    rec.name ??
                    rec.accountName ??
                    rec.customerName ??
                    rec.campaignName ??
                    `سجل #${idx + 1}`
                );
                const sub = String(
                  rec.company ??
                    rec.accountName ??
                    rec.source ??
                    rec.channel ??
                    rec.ownerName ??
                    ''
                );
                const amount =
                  rec.amount ??
                  rec.valueSAR ??
                  rec.orderAmountSAR ??
                  rec.totalWithVatSAR ??
                  rec.revenueSAR;

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-2.5 hover:border-[#CBD5E1]"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownKey(null);
                          onNavigateToRecord?.(
                            report.primaryModule,
                            String(rec.id ?? rwq),
                            rwq
                          );
                        }}
                        className="font-mono text-[11px] font-extrabold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        {rwq}
                      </button>
                      {amount !== undefined && (
                        <span className="font-mono text-[12px] font-extrabold text-[#059669] tabular-nums">
                          {Number(amount).toLocaleString('en-US')} ر.س
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-[13px] font-extrabold text-[#0F172A]">
                        {title}
                      </p>
                      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownKey(null);
                          onNavigateToRecord?.(
                            report.primaryModule,
                            String(rec.id ?? rwq),
                            rwq
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3 text-[#2563EB]" />
                        <span>فتح ملف العميل / الصفقة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownKey(null);
                          onOpenWhatsAppChat?.(rwq, title);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-extrabold text-[#065F46] hover:bg-[#D1FAE5] cursor-pointer"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>محادثة واتساب</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PIN TO DASHBOARD MODAL                                              */}
      {/* =================================================================== */}
      {pinModalOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-[1px]"
        >
          <form
            onSubmit={handlePinConfirm}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  <Pin className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  تثبيت التقرير في لوحة التحكم
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                  عنوان الودجت في لوحة القيادة
                </label>
                <input
                  type="text"
                  required
                  value={pinTitle}
                  onChange={(e) => setPinTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 text-[12px] font-bold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                  لوحة القيادة المستهدفة
                </label>
                <select
                  value={pinDashboard}
                  onChange={(e) =>
                    setPinDashboard(
                      e.target.value as 'executive' | 'sales' | 'marketing'
                    )
                  }
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 text-[12px] font-bold text-[#0F172A]"
                >
                  <option value="executive">لوحة المدير التنفيذي (Executive)</option>
                  <option value="sales">لوحة المبيعات (Sales)</option>
                  <option value="marketing">لوحة التسويق وإعلانات ميتا (Marketing)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                  حجم بطاقة العرض (Widget Size)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: '1x1' as const, label: '1×1 قياسي' },
                    { key: '2x1' as const, label: '2×1 عريض' },
                    { key: '2x2' as const, label: '2×2 موسّع' },
                  ].map((sz) => (
                    <button
                      key={sz.key}
                      type="button"
                      onClick={() => setPinSize(sz.key)}
                      className={`rounded-xl border py-2 text-[12px] font-extrabold cursor-pointer ${
                        pinSize === sz.key
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Single Sticky Bottom Bar */}
            <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#475569] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>تثبيت الآن</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
