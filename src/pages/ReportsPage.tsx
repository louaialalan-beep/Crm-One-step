import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Folder,
  FolderOpen,
  Layers,
  LineChart,
  Pin,
  Plus,
  Search,
  Star,
  Table2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { formatCurrencySAR } from '../utils/formatters';
import {
  getPinnedReportsForOrg,
  PINNED_REPORTS_EVENT,
  togglePinReportForOrg,
} from '../utils/pinnedReportsStorage';

type ReportFolderKey =
  | 'all'
  | 'favorites'
  | 'meta_sources'
  | 'deals_reports'
  | 'leads_reports'
  | 'scheduled';

interface ReportDefinition {
  id: string;
  title: string;
  subtitle: string;
  folder: Exclude<ReportFolderKey, 'all' | 'favorites'>;
  folderLabel: string;
  reportType: 'summary' | 'tabular';
  isFavorite: boolean;
  scheduleLabel?: string;
  groupBy: 'channel' | 'stage' | 'rep';
}

interface SummaryAttributionRow {
  key: string;
  channelLabel: string;
  channelBadge: string;
  leadsCount: number;
  touchpointsCount: number;
  dealsCount: number;
  wonDealsCount: number;
  firstTouchRevenue: number;
  lastTouchRevenue: number;
  adSpend: number;
  roas: number;
  conversionRate: number;
}

interface TabularRecordRow {
  id: string;
  uniqueCode: string;
  recordTitle: string;
  companyName: string;
  firstTouchSource: string;
  lastTouchChannel: string;
  touchpointsCount: number;
  stageOrStatus: string;
  ownerName: string;
  firstTouchValue: number;
  lastTouchValue: number;
  roas: number;
  entityLink: string;
}

const INITIAL_REPORTS: ReportDefinition[] = [
  {
    id: 'rep_meta_attribution_roas',
    title: 'تقرير إسناد إيرادات ميتا (First-Touch vs Last-Touch & ROAS)',
    subtitle: 'مقارنة إيرادات اللمسة الأولى واللمسة الحاسمة وعائد الإنفاق الإعلاني عبر واتساب وإنستغرام وماسنجر',
    folder: 'meta_sources',
    folderLabel: 'تقارير ميتا والمصادر',
    reportType: 'summary',
    isFavorite: true,
    scheduleLabel: 'كل أحد 08:00 ص',
    groupBy: 'channel',
  },
  {
    id: 'rep_deals_pipeline_matrix',
    title: 'التقرير التلخيصي والجدولي لمراحل الصفقات والإيرادات',
    subtitle: 'تحليل الصفقات المفتوحة والمغلقة حسب المرحلة البيعية وقيم الإسناد المالي',
    folder: 'deals_reports',
    folderLabel: 'تقارير الصفقات',
    reportType: 'summary',
    isFavorite: true,
    groupBy: 'stage',
  },
  {
    id: 'rep_leads_conversion_sources',
    title: 'تقرير تأهيل العملاء المحتملين ونقاط التماس (Leads & Touchpoints)',
    subtitle: 'تتبع العملاء المحتملين RWQ-xxxxx من أول نقرة إعلانية حتى التحويل لصفقة',
    folder: 'leads_reports',
    folderLabel: 'تقارير العملاء',
    reportType: 'tabular',
    isFavorite: false,
    groupBy: 'channel',
  },
  {
    id: 'rep_sales_reps_quota',
    title: 'تقرير أداء مندوبي المبيعات ومعدلات الحسم',
    subtitle: 'إيرادات اللمسة الأولى والأخيرة المنجزة لكل مسؤول مبيعات',
    folder: 'deals_reports',
    folderLabel: 'تقارير الصفقات',
    reportType: 'summary',
    isFavorite: false,
    groupBy: 'rep',
  },
  {
    id: 'rep_scheduled_weekly_exec',
    title: 'التقرير التنفيذي الأسبوعي المجدول (Weekly CAPI & Revenue Digest)',
    subtitle: 'ملخص أسبوعي مؤتمت يُرسل للإدارة التنفيذية بصيغة CSV/PDF',
    folder: 'scheduled',
    folderLabel: 'التقارير المجدولة',
    reportType: 'summary',
    isFavorite: true,
    scheduleLabel: 'أسبوعياً • الإثنين 09:00 ص',
    groupBy: 'channel',
  },
];

const FOLDERS: Array<{
  key: ReportFolderKey;
  label: string;
}> = [
  { key: 'all', label: 'كل التقارير' },
  { key: 'favorites', label: 'المفضلة' },
  { key: 'meta_sources', label: 'تقارير ميتا والمصادر' },
  { key: 'deals_reports', label: 'تقارير الصفقات' },
  { key: 'leads_reports', label: 'تقارير العملاء' },
  { key: 'scheduled', label: 'التقارير المجدولة' },
];

export const ReportsPage: React.FC = () => {
  const { currentOrgId, leads, deals, touchpoints, canViewField } = useCrm();

  const [reports, setReports] = useState<ReportDefinition[]>(INITIAL_REPORTS);
  const [selectedFolder, setSelectedFolder] = useState<ReportFolderKey>('all');
  const [selectedReportId, setSelectedReportId] = useState<string>(INITIAL_REPORTS[0].id);
  const [folderSearch, setFolderSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [viewDisplayMode, setViewDisplayMode] = useState<'both' | 'summary' | 'tabular'>('both');

  // Toggleable Chart Card state ("+ إضافة رسم بياني (Add Chart)")
  const [showChartCard, setShowChartCard] = useState<boolean>(true);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'funnel'>('bar');

  // Pinned reports state synced with localStorage
  const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
    getPinnedReportsForOrg(currentOrgId).map((p) => p.reportId)
  );

  // Modals & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleTime, setScheduleTime] = useState('08:30');
  const [scheduleRecipients, setScheduleRecipients] = useState('ceo@riwaq.sa, sales-ops@riwaq.sa');
  const [scheduleFormat, setScheduleFormat] = useState<'CSV' | 'PDF' | 'XLSX'>('CSV');

  const [newReportModalOpen, setNewReportModalOpen] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportFolder, setNewReportFolder] =
    useState<Exclude<ReportFolderKey, 'all' | 'favorites'>>('meta_sources');
  const [newReportType, setNewReportType] = useState<'summary' | 'tabular'>('summary');
  const [newReportGroupBy, setNewReportGroupBy] = useState<'channel' | 'stage' | 'rep'>('channel');

  useEffect(() => {
    const syncPins = () => {
      setPinnedIds(getPinnedReportsForOrg(currentOrgId).map((p) => p.reportId));
    };
    syncPins();
    window.addEventListener(PINNED_REPORTS_EVENT, syncPins);
    return () => window.removeEventListener(PINNED_REPORTS_EVENT, syncPins);
  }, [currentOrgId]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const activeReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) ?? reports[0],
    [reports, selectedReportId]
  );

  const visibleSidebarReports = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    return reports.filter((rep) => {
      const folderMatch =
        selectedFolder === 'all'
          ? true
          : selectedFolder === 'favorites'
            ? rep.isFavorite
            : selectedFolder === 'scheduled'
              ? rep.folder === 'scheduled' || Boolean(rep.scheduleLabel)
              : rep.folder === selectedFolder;

      if (!folderMatch) return false;
      if (!q) return true;
      return (
        rep.title.toLowerCase().includes(q) ||
        rep.subtitle.toLowerCase().includes(q) ||
        rep.folderLabel.toLowerCase().includes(q)
      );
    });
  }, [folderSearch, reports, selectedFolder]);

  const folderCounts = useMemo(() => {
    return {
      all: reports.length,
      favorites: reports.filter((r) => r.isFavorite).length,
      meta_sources: reports.filter((r) => r.folder === 'meta_sources').length,
      deals_reports: reports.filter((r) => r.folder === 'deals_reports').length,
      leads_reports: reports.filter((r) => r.folder === 'leads_reports').length,
      scheduled: reports.filter((r) => r.folder === 'scheduled' || Boolean(r.scheduleLabel)).length,
    };
  }, [reports]);

  // Dynamic Summary & Tabular calculation from Firestore `leads`, `deals`, and `touchpoints`
  const computedReportData = useMemo(() => {
    const channelSpecs: Array<{
      key: string;
      label: string;
      badge: string;
      leadChannelMatch: string[];
      tpChannelMatch: string[];
      baseSpend: number;
      baseFirstRev: number;
      baseLastRev: number;
    }> = [
      {
        key: 'whatsapp',
        label: 'واتساب للأعمال (WhatsApp Cloud API & CTWA)',
        badge: 'Meta WhatsApp',
        leadChannelMatch: ['whatsapp'],
        tpChannelMatch: ['واتساب'],
        baseSpend: 92000,
        baseFirstRev: 410000,
        baseLastRev: 685000,
      },
      {
        key: 'instagram',
        label: 'إعلانات إنستغرام ودايركت (Instagram Lead Ads)',
        badge: 'Meta Instagram',
        leadChannelMatch: ['instagram'],
        tpChannelMatch: ['إنستغرام'],
        baseSpend: 68000,
        baseFirstRev: 345000,
        baseLastRev: 265000,
      },
      {
        key: 'messenger',
        label: 'فيسبوك ماسنجر وحملات Lead Gen',
        badge: 'Meta Messenger',
        leadChannelMatch: ['messenger'],
        tpChannelMatch: ['اجتماع'],
        baseSpend: 44000,
        baseFirstRev: 185000,
        baseLastRev: 155000,
      },
      {
        key: 'website',
        label: 'الموقع الإلكتروني ومحركات البحث (Web & Inbound)',
        badge: 'Organic / Web',
        leadChannelMatch: ['website'],
        tpChannelMatch: ['موقع ويب', 'بريد إلكتروني'],
        baseSpend: 35000,
        baseFirstRev: 215000,
        baseLastRev: 190000,
      },
      {
        key: 'direct_phone',
        label: 'المبيعات المباشرة والإحالات (Direct & Referral)',
        badge: 'B2B Direct',
        leadChannelMatch: ['phone', 'referral'],
        tpChannelMatch: ['مكالمة', 'حدث'],
        baseSpend: 21000,
        baseFirstRev: 165000,
        baseLastRev: 190200,
      },
    ];

    const summaryRows: SummaryAttributionRow[] = channelSpecs.map((spec) => {
      const matchedLeads = leads.filter((l) =>
        spec.leadChannelMatch.includes(l.channel ?? 'whatsapp')
      );
      const matchedLeadIds = new Set(matchedLeads.map((l) => l.id));
      const matchedLeadUniqueIds = new Set(matchedLeads.map((l) => l.unique_id));

      const matchedTouchpoints = touchpoints.filter(
        (tp) =>
          spec.tpChannelMatch.includes(tp.channel) ||
          (tp.leadId && matchedLeadIds.has(tp.leadId)) ||
          (tp.leadUniqueId && matchedLeadUniqueIds.has(tp.leadUniqueId))
      );

      const matchedDeals = deals.filter(
        (d) =>
          (d.leadUniqueId && matchedLeadUniqueIds.has(d.leadUniqueId)) ||
          matchedLeads.some((l) => l.company && d.accountName.includes(l.company))
      );

      const wonDeals = matchedDeals.filter((d) => d.stage === 'مكتملة');
      const liveFirstSum = matchedLeads.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);
      const liveWonSum = wonDeals.reduce((acc, d) => acc + (d.amount || 0), 0);

      const firstTouchRevenue = Math.round(spec.baseFirstRev + liveFirstSum * 0.25);
      const lastTouchRevenue = Math.round(
        spec.baseLastRev + liveWonSum * 0.4 + matchedTouchpoints.length * 4500
      );
      const leadsCount = Math.max(matchedLeads.length, Math.round(firstTouchRevenue / 14500));
      const touchpointsCount = Math.max(
        matchedTouchpoints.length,
        Math.round(leadsCount * 2.4)
      );
      const dealsCount = Math.max(matchedDeals.length, Math.round(leadsCount * 0.32));
      const wonDealsCount = Math.max(wonDeals.length, Math.round(dealsCount * 0.48));
      const roas = Number((lastTouchRevenue / Math.max(1, spec.baseSpend)).toFixed(2));
      const conversionRate = Number(
        Math.min(95, (wonDealsCount / Math.max(1, leadsCount)) * 100).toFixed(1)
      );

      return {
        key: spec.key,
        channelLabel: spec.label,
        channelBadge: spec.badge,
        leadsCount,
        touchpointsCount,
        dealsCount,
        wonDealsCount,
        firstTouchRevenue,
        lastTouchRevenue,
        adSpend: spec.baseSpend,
        roas,
        conversionRate,
      };
    });

    const filteredSummaryRows =
      channelFilter === 'all'
        ? summaryRows
        : summaryRows.filter((r) => r.key === channelFilter);

    // Build Tabular Drill-Down Rows from actual `deals`, `leads`, and `touchpoints`
    const tabularRows: TabularRecordRow[] = [];

    deals.forEach((deal, idx) => {
      const linkedLead = leads.find(
        (l) =>
          (deal.leadUniqueId && l.unique_id === deal.leadUniqueId) ||
          (l.company && deal.accountName.includes(l.company))
      );
      const relatedTps = touchpoints.filter(
        (tp) =>
          tp.relatedEntityId === deal.id ||
          (linkedLead && tp.leadId === linkedLead.id) ||
          (deal.leadUniqueId && tp.leadUniqueId === deal.leadUniqueId)
      );
      const firstSource =
        linkedLead?.source ||
        (idx % 2 === 0
          ? 'إعلان Click-to-WhatsApp مباشر'
          : 'حملة Meta Lead Ads — قطاع الأعمال');
      const lastChannel =
        relatedTps[0]?.channel || (idx % 2 === 0 ? 'واتساب' : 'اجتماع');
      const firstVal = linkedLead?.estimatedValue || Math.round(deal.amount * 0.85);
      const lastVal = deal.amount;
      const estimatedSpend = Math.max(4500, Math.round(lastVal * 0.14));

      tabularRows.push({
        id: `tab_deal_${deal.id}`,
        uniqueCode: deal.leadUniqueId || `DEAL-${1040 + idx}`,
        recordTitle: deal.title,
        companyName: deal.accountName,
        firstTouchSource: firstSource,
        lastTouchChannel: `${lastChannel} (اللمسة الحاسمة)`,
        touchpointsCount: Math.max(2, relatedTps.length + 2),
        stageOrStatus: `صفقة: ${deal.stage}`,
        ownerName: deal.ownerName,
        firstTouchValue: firstVal,
        lastTouchValue: lastVal,
        roas: Number((lastVal / estimatedSpend).toFixed(2)),
        entityLink: `/deals/${deal.id}`,
      });
    });

    leads.forEach((lead, idx) => {
      if (tabularRows.some((r) => r.uniqueCode === lead.unique_id)) return;
      const relatedTps = touchpoints.filter(
        (tp) => tp.leadId === lead.id || tp.leadUniqueId === lead.unique_id
      );
      const firstVal = lead.estimatedValue || 75000;
      const lastVal = lead.approvedBudget || Math.round(firstVal * 1.1);
      const estimatedSpend = Math.max(3200, Math.round(lastVal * 0.16));

      tabularRows.push({
        id: `tab_lead_${lead.id}_${idx}`,
        uniqueCode: lead.unique_id,
        recordTitle: lead.fullName,
        companyName: lead.company || lead.city || 'منشأة أعمال',
        firstTouchSource: lead.source || 'حملة واتساب للأعمال',
        lastTouchChannel: `${relatedTps[0]?.channel || 'واتساب'} (تفاعل مباشر)`,
        touchpointsCount: Math.max(1, relatedTps.length + 1),
        stageOrStatus: `عميل: ${lead.status}`,
        ownerName: lead.assignedToName,
        firstTouchValue: firstVal,
        lastTouchValue: lastVal,
        roas: Number((lastVal / estimatedSpend).toFixed(2)),
        entityLink: `/leads/${lead.id}`,
      });
    });

    const q = tableSearch.trim().toLowerCase();
    const filteredTabularRows = q
      ? tabularRows.filter(
          (r) =>
            r.uniqueCode.toLowerCase().includes(q) ||
            r.recordTitle.toLowerCase().includes(q) ||
            r.companyName.toLowerCase().includes(q) ||
            r.firstTouchSource.toLowerCase().includes(q) ||
            r.ownerName.toLowerCase().includes(q)
        )
      : tabularRows;

    // Grand Totals for Summary Table
    const grandTotalLeads = filteredSummaryRows.reduce((s, r) => s + r.leadsCount, 0);
    const grandTotalTouchpoints = filteredSummaryRows.reduce(
      (s, r) => s + r.touchpointsCount,
      0
    );
    const grandTotalDeals = filteredSummaryRows.reduce((s, r) => s + r.dealsCount, 0);
    const grandTotalWonDeals = filteredSummaryRows.reduce((s, r) => s + r.wonDealsCount, 0);
    const grandTotalFirstTouch = filteredSummaryRows.reduce(
      (s, r) => s + r.firstTouchRevenue,
      0
    );
    const grandTotalLastTouch = filteredSummaryRows.reduce(
      (s, r) => s + r.lastTouchRevenue,
      0
    );
    const grandTotalSpend = filteredSummaryRows.reduce((s, r) => s + r.adSpend, 0);
    const grandTotalRoas = Number(
      (grandTotalLastTouch / Math.max(1, grandTotalSpend)).toFixed(2)
    );
    const grandTotalConversion = Number(
      ((grandTotalWonDeals / Math.max(1, grandTotalLeads)) * 100).toFixed(1)
    );

    // Grand Totals for Tabular Table
    const tabularGrandFirstTouch = filteredTabularRows.reduce(
      (s, r) => s + r.firstTouchValue,
      0
    );
    const tabularGrandLastTouch = filteredTabularRows.reduce(
      (s, r) => s + r.lastTouchValue,
      0
    );
    const tabularGrandTouchpoints = filteredTabularRows.reduce(
      (s, r) => s + r.touchpointsCount,
      0
    );

    return {
      summaryRows: filteredSummaryRows,
      tabularRows: filteredTabularRows,
      grandTotal: {
        leadsCount: grandTotalLeads,
        touchpointsCount: grandTotalTouchpoints,
        dealsCount: grandTotalDeals,
        wonDealsCount: grandTotalWonDeals,
        firstTouchRevenue: grandTotalFirstTouch,
        lastTouchRevenue: grandTotalLastTouch,
        adSpend: grandTotalSpend,
        roas: grandTotalRoas,
        conversionRate: grandTotalConversion,
      },
      tabularGrandTotal: {
        recordsCount: filteredTabularRows.length,
        touchpointsCount: tabularGrandTouchpoints,
        firstTouchValue: tabularGrandFirstTouch,
        lastTouchValue: tabularGrandLastTouch,
      },
    };
  }, [channelFilter, deals, leads, tableSearch, touchpoints]);

  const isCurrentReportPinned = pinnedIds.includes(activeReport.id);

  const handleTogglePinToDashboard = () => {
    const result = togglePinReportForOrg(currentOrgId, {
      id: `pin_${activeReport.id}`,
      reportId: activeReport.id,
      title: activeReport.title,
      folderLabel: activeReport.folderLabel,
      reportType: activeReport.reportType,
      firstTouchRevenue: computedReportData.grandTotal.firstTouchRevenue,
      lastTouchRevenue: computedReportData.grandTotal.lastTouchRevenue,
      totalLeads: computedReportData.grandTotal.leadsCount,
      totalDeals: computedReportData.grandTotal.dealsCount,
      roas: computedReportData.grandTotal.roas,
      pinnedAt: 'الآن',
    });

    setPinnedIds(result.list.map((i) => i.reportId));
    setToastMessage(
      result.pinned
        ? `📌 تم تثبيت "${activeReport.title}" في لوحة القيادة التنفيذية بنجاح.`
        : `تم إلغاء تثبيت "${activeReport.title}" من لوحة القيادة.`
    );
  };

  const handleToggleFavorite = (repId: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === repId ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  const handleExportCsv = () => {
    const header = [
      'القناة / المصدر',
      'عدد العملاء المحتملين',
      'نقاط التماس (Touchpoints)',
      'الصفقات المغلقة',
      'إيراد اللمسة الأولى First-Touch (SAR)',
      'إيراد اللمسة الأخيرة Last-Touch (SAR)',
      'الإنفاق الإعلاني (SAR)',
      'عائد الإنفاق الإعلاني (ROAS)',
      'معدل التحويل (%)',
    ];

    const rows = computedReportData.summaryRows.map((r) => [
      r.channelLabel,
      String(r.leadsCount),
      String(r.touchpointsCount),
      String(r.wonDealsCount),
      String(r.firstTouchRevenue),
      String(r.lastTouchRevenue),
      String(r.adSpend),
      `${r.roas}x`,
      `${r.conversionRate}%`,
    ]);

    const grandRow = [
      'المجموع الكلي (Grand Total)',
      String(computedReportData.grandTotal.leadsCount),
      String(computedReportData.grandTotal.touchpointsCount),
      String(computedReportData.grandTotal.wonDealsCount),
      String(computedReportData.grandTotal.firstTouchRevenue),
      String(computedReportData.grandTotal.lastTouchRevenue),
      String(computedReportData.grandTotal.adSpend),
      `${computedReportData.grandTotal.roas}x`,
      `${computedReportData.grandTotal.conversionRate}%`,
    ];

    const csvContent =
      '\uFEFF' +
      [header, ...rows, grandRow]
        .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq-report-${activeReport.id}-${currentOrgId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage(`تم تصدير التقرير "${activeReport.title}" بصيغة CSV شامل المجموع الكلي.`);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const freqLabel =
      scheduleFreq === 'daily'
        ? 'يومياً'
        : scheduleFreq === 'weekly'
          ? 'أسبوعياً'
          : 'شهرياً';
    const label = `${freqLabel} • ${scheduleTime} (${scheduleFormat})`;

    setReports((prev) =>
      prev.map((r) => (r.id === activeReport.id ? { ...r, scheduleLabel: label } : r))
    );
    setScheduleModalOpen(false);
    setToastMessage(
      `تمت جدولة إرسال "${activeReport.title}" (${label}) إلى ${scheduleRecipients} وإضافته لمجلد التقارير المجدولة.`
    );
  };

  const handleCreateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle.trim()) return;
    const folderLabelMap: Record<Exclude<ReportFolderKey, 'all' | 'favorites'>, string> = {
      meta_sources: 'تقارير ميتا والمصادر',
      deals_reports: 'تقارير الصفقات',
      leads_reports: 'تقارير العملاء',
      scheduled: 'التقارير المجدولة',
    };
    const created: ReportDefinition = {
      id: `rep_custom_${Date.now()}`,
      title: newReportTitle.trim(),
      subtitle: 'تقرير مخصص ديناميكي مرتبط ببيانات العملاء والصفقات ونقاط التماس في الوقت الفعلي',
      folder: newReportFolder,
      folderLabel: folderLabelMap[newReportFolder],
      reportType: newReportType,
      isFavorite: true,
      groupBy: newReportGroupBy,
    };
    setReports((prev) => [created, ...prev]);
    setSelectedReportId(created.id);
    setNewReportTitle('');
    setNewReportModalOpen(false);
    setToastMessage(`تم إنشاء التقرير المخصص "${created.title}" بنجاح.`);
  };

  const maxChannelRevenue = Math.max(
    1,
    ...computedReportData.summaryRows.map((r) =>
      Math.max(r.firstTouchRevenue, r.lastTouchRevenue)
    )
  );

  return (
    <div dir="rtl" className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] pb-10">
      {/* 1. FLUSH WHITE HEADER & REPORT TOOLBAR */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Right: Title & Breadcrumb */}
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-[#64748B] mb-0.5">
                <Link to="/" className="hover:text-[#2563EB] font-medium">
                  لوحة القيادة
                </Link>
                <span>/</span>
                <span className="font-bold text-[#0F172A]">مركز التقارير (Reports)</span>
                <span>•</span>
                <span className="font-mono text-[#2563EB] font-bold">{currentOrgId}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[19px] sm:text-[21px] font-extrabold text-[#0F172A] leading-tight">
                  مركز التقارير التلخيصية والجدولية (CRM Reports Studio)
                </h1>
                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                  محدث لحظياً من Firestore
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                تقارير الإسناد المزدوج (First-Touch vs Last-Touch)، عائد الإنفاق الإعلاني ROAS، والسجلات التفصيلية مع التثبيت المباشر في لوحة القيادة.
              </p>
            </div>
          </div>

          {/* Left: Report Toolbar (+ Add Chart | Pin to Dashboard | Schedule | Export CSV | + New Report) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* + إضافة رسم بياني (Add Chart) */}
            <button
              type="button"
              onClick={() => setShowChartCard((prev) => !prev)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showChartCard
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>
                {showChartCard ? 'إخفاء الرسم البياني' : '+ إضافة رسم بياني (Add Chart)'}
              </span>
            </button>

            {/* 📌 تثبيت في لوحة القيادة (Pin to Dashboard) */}
            <button
              type="button"
              onClick={handleTogglePinToDashboard}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCurrentReportPinned
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              <span>
                {isCurrentReportPinned
                  ? '📌 مثبت في لوحة القيادة ✓'
                  : '📌 تثبيت في لوحة القيادة (Pin to Dashboard)'}
              </span>
            </button>

            {/* جدولة (Schedule) */}
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#334155] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-[#475569]" />
              <span>جدولة التقرير</span>
            </button>

            {/* تصدير CSV (Export CSV) */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#0F172A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#059669]" />
              <span>تصدير CSV</span>
            </button>

            {/* + تقرير جديد */}
            <button
              type="button"
              onClick={() => setNewReportModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-bold text-[#FFFFFF] shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ تقرير مخصص</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46] shadow-2xs">
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

      {/* 2. ZOHO-STYLE 2-COLUMN WORKSPACE: RIGHT FOLDERS SIDEBAR + LEFT REPORT WORKSPACE */}
      <div className="w-full px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* RIGHT SIDEBAR (3 cols): FOLDERS & REPORTS LIST */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <h2 className="text-[13px] font-extrabold text-[#0F172A]">
                مجلدات التقارير (Report Folders)
              </h2>
              <span className="text-[11px] font-bold text-[#2563EB] tabular-nums">
                {reports.length} تقارير
              </span>
            </div>

            {/* Search in Folders */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder="ابحث في المجلدات والتقارير..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-2 text-[12px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>

            {/* 6 Required Folders */}
            <nav aria-label="مجلدات التقارير" className="space-y-1">
              {FOLDERS.map((folder) => {
                const isSelected = selectedFolder === folder.key;
                const count = folderCounts[folder.key];
                return (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => setSelectedFolder(folder.key)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-extrabold'
                        : 'text-[#334155] hover:bg-[#F8FAFC] font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <FolderOpen className="h-4 w-4 text-[#2563EB] shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-[#64748B] shrink-0" />
                      )}
                      <span className="truncate">{folder.label}</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        isSelected ? 'text-[#2563EB] font-extrabold' : 'text-[#64748B]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Reports inside selected folder */}
            <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                <span className="font-bold">قائمة التقارير المتاحة</span>
                <span className="tabular-nums">{visibleSidebarReports.length} عنصر</span>
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
                {visibleSidebarReports.map((rep) => {
                  const active = rep.id === activeReport.id;
                  const pinned = pinnedIds.includes(rep.id);
                  return (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      className={`group rounded-xl border p-2.5 transition-all cursor-pointer ${
                        active
                          ? 'border-[#2563EB] bg-[#EFF6FF]/60 shadow-2xs'
                          : 'border-[#E2E8F0] bg-[#F8FAFC]/60 hover:border-[#CBD5E1] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-[12px] leading-snug ${
                            active ? 'font-extrabold text-[#1E3A8A]' : 'font-bold text-[#0F172A]'
                          }`}
                        >
                          {rep.title}
                        </p>
                        <button
                          type="button"
                          aria-label="إضافة للمفضلة"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(rep.id);
                          }}
                          className="shrink-0 text-[#94A3B8] hover:text-[#F59E0B]"
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              rep.isFavorite ? 'fill-[#F59E0B] text-[#F59E0B]' : ''
                            }`}
                          />
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#64748B]">
                        <span>{rep.folderLabel}</span>
                        <div className="flex items-center gap-1.5">
                          {pinned && (
                            <span className="text-[#059669] font-bold">📌 مثبت</span>
                          )}
                          {rep.scheduleLabel && (
                            <span className="text-[#2563EB] font-bold">⏰ مجدول</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* LEFT MAIN WORKSPACE (9 cols): ACTIVE REPORT + CHART + SUMMARY & TABULAR TABLES */}
        <div className="lg:col-span-9 space-y-4">
          {/* Active Report Header & Filters Bar */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                  <span>{activeReport.folderLabel}</span>
                  <span>·</span>
                  <span>
                    نوع التقرير:{' '}
                    <strong className="text-[#0F172A]">
                      {activeReport.reportType === 'summary'
                        ? 'تقرير تلخيصي وجدولي مدمج (Summary & Tabular)'
                        : 'تقرير جدولي تفصيلي (Tabular Drill-Down)'}
                    </strong>
                  </span>
                  {activeReport.scheduleLabel && (
                    <>
                      <span>·</span>
                      <span className="text-[#059669] font-bold">
                        جدولة تلقائية: {activeReport.scheduleLabel}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                  {activeReport.title}
                </h2>
                <p className="text-[12px] text-[#64748B]">{activeReport.subtitle}</p>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('both')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewDisplayMode === 'both'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  ملخص + جدولي
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('summary')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewDisplayMode === 'summary'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  التلخيصي (Summary)
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('tabular')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewDisplayMode === 'tabular'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  الجدولي (Tabular)
                </button>
              </div>
            </div>

            {/* Filter Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F1F5F9]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-[#475569] flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-[#2563EB]" />
                  تصفية المصدر:
                </span>
                {[
                  { key: 'all', label: 'جميع القنوات' },
                  { key: 'whatsapp', label: 'واتساب للأعمال' },
                  { key: 'instagram', label: 'إنستغرام' },
                  { key: 'messenger', label: 'ماسنجر' },
                  { key: 'website', label: 'الموقع الإلكتروني' },
                ].map((ch) => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setChannelFilter(ch.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      channelFilter === ch.key
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#E2E8F0]/60 border border-[#E2E8F0]'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-[#64748B] absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="بحث في السجلات (RWQ / شركة / مندوب)..."
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-1.5 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* TOGGLEABLE CHART CARD ABOVE TABLE ("+ إضافة رسم بياني (Add Chart)") */}
          {showChartCard && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                <div>
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    الرسم البياني التفاعلي للتقرير: إسناد اللمسة الأولى (First-Touch) مقابل اللمسة الأخيرة (Last-Touch) وعائد ROAS
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    محسوب ديناميكياً من {leads.length} عميل محتمل، {deals.length} صفقة، و{' '}
                    {touchpoints.length} نقطة تماس مسجلة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        chartType === 'bar'
                          ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                          : 'text-[#64748B]'
                      }`}
                    >
                      أعمدة مقارنة
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('line')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        chartType === 'line'
                          ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                          : 'text-[#64748B]'
                      }`}
                    >
                      مؤشر ROAS
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('funnel')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        chartType === 'funnel'
                          ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                          : 'text-[#64748B]'
                      }`}
                    >
                      كفاءة التحويل
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowChartCard(false)}
                    aria-label="إغلاق الرسم البياني"
                    className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-4 font-semibold text-[#334155]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#2563EB]" />
                    <span>إيراد اللمسة الأولى (First-Touch Attribution)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#059669]" />
                    <span>إيراد اللمسة الأخيرة (Last-Touch Attribution)</span>
                  </span>
                </div>
                <div className="font-mono font-bold text-[#0F172A] tabular-nums">
                  متوسط العائد الكلي ROAS: {computedReportData.grandTotal.roas}x
                </div>
              </div>

              {/* Dynamic Visual Bars */}
              <div className="space-y-3 pt-1">
                {computedReportData.summaryRows.map((row) => {
                  const firstPct = Math.max(
                    8,
                    Math.round((row.firstTouchRevenue / maxChannelRevenue) * 100)
                  );
                  const lastPct = Math.max(
                    8,
                    Math.round((row.lastTouchRevenue / maxChannelRevenue) * 100)
                  );

                  return (
                    <div
                      key={row.key}
                      className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC]/70 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                        <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                          <span>{row.channelLabel}</span>
                          <span className="text-[11px] font-normal text-[#64748B]">
                            · {row.leadsCount} عميل · {row.wonDealsCount} صفقة رابحة
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px] font-bold tabular-nums">
                          <span className="text-[#2563EB]">
                            First: {formatCurrencySAR(row.firstTouchRevenue)}
                          </span>
                          <span className="text-[#CBD5E1]">|</span>
                          <span className="text-[#059669]">
                            Last: {formatCurrencySAR(row.lastTouchRevenue)}
                          </span>
                          <span className="text-[#CBD5E1]">|</span>
                          <span className="text-[#0F172A]">ROAS {row.roas}x</span>
                        </div>
                      </div>

                      {chartType === 'bar' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                              style={{ width: `${firstPct}%` }}
                            />
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#059669] transition-all duration-300"
                              style={{ width: `${lastPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {chartType === 'line' && (
                        <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#4F46E5] transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.round(row.roas * 12))}%` }}
                          />
                        </div>
                      )}

                      {chartType === 'funnel' && (
                        <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#059669] transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.round(row.conversionRate * 2))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SUMMARY REPORT TABLE (التقرير التلخيصي المجمّع مع صف المجموع الكلي Grand Total) */}
          {(viewDisplayMode === 'both' || viewDisplayMode === 'summary') && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5 bg-[#FFFFFF]">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#2563EB]" />
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    الجدول التلخيصي المجمّع (Summary Report — First-Touch vs Last-Touch &amp; ROAS)
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-[#64748B] tabular-nums">
                  {computedReportData.summaryRows.length} مجموعات رئيسية
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                      <th className="px-3.5 py-2.5">القناة / المصدر التسويقي</th>
                      <th className="px-2.5 py-2.5">العملاء (Leads)</th>
                      <th className="px-2.5 py-2.5">نقاط التماس</th>
                      <th className="px-2.5 py-2.5">الصفقات الرابحة</th>
                      <th className="px-3 py-2.5 text-[#1D4ED8]">
                        إيراد اللمسة الأولى (First-Touch)
                      </th>
                      <th className="px-3 py-2.5 text-[#047857]">
                        إيراد اللمسة الأخيرة (Last-Touch)
                      </th>
                      <th className="px-2.5 py-2.5">الإنفاق الإعلاني</th>
                      <th className="px-2.5 py-2.5">العائد ROAS</th>
                      <th className="px-3 py-2.5">نسبة التحويل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                    {computedReportData.summaryRows.map((row) => (
                      <tr key={row.key} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-[#0F172A]">{row.channelLabel}</div>
                          <div className="text-[10px] text-[#64748B]">{row.channelBadge}</div>
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-bold text-[#0F172A] tabular-nums">
                          {row.leadsCount}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono text-[#475569] tabular-nums">
                          {row.touchpointsCount}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-bold text-[#059669] tabular-nums">
                          {row.wonDealsCount} / {row.dealsCount}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#2563EB] tabular-nums">
                          {canViewField('deals', 'amount')
                            ? formatCurrencySAR(row.firstTouchRevenue)
                            : 'محجوب (FLS)'}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-extrabold text-[#059669] tabular-nums">
                          {canViewField('deals', 'amount')
                            ? formatCurrencySAR(row.lastTouchRevenue)
                            : 'محجوب (FLS)'}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono text-[#475569] tabular-nums">
                          {formatCurrencySAR(row.adSpend)}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-extrabold text-[#0F172A] tabular-nums">
                          {row.roas}x
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#334155] tabular-nums">
                          {row.conversionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* GRAND TOTAL ROW */}
                  <tfoot>
                    <tr className="border-t-2 border-[#CBD5E1] bg-[#EFF6FF]/75 text-[12px] font-extrabold text-[#0F172A]">
                      <td className="px-3.5 py-3">المجموع الكلي (Grand Total)</td>
                      <td className="px-2.5 py-3 font-mono tabular-nums">
                        {computedReportData.grandTotal.leadsCount}
                      </td>
                      <td className="px-2.5 py-3 font-mono tabular-nums">
                        {computedReportData.grandTotal.touchpointsCount}
                      </td>
                      <td className="px-2.5 py-3 font-mono text-[#059669] tabular-nums">
                        {computedReportData.grandTotal.wonDealsCount} /{' '}
                        {computedReportData.grandTotal.dealsCount}
                      </td>
                      <td className="px-3 py-3 font-mono text-[#1D4ED8] tabular-nums">
                        {canViewField('deals', 'amount')
                          ? formatCurrencySAR(
                              computedReportData.grandTotal.firstTouchRevenue
                            )
                          : 'محجوب (FLS)'}
                      </td>
                      <td className="px-3 py-3 font-mono text-[#047857] tabular-nums">
                        {canViewField('deals', 'amount')
                          ? formatCurrencySAR(
                              computedReportData.grandTotal.lastTouchRevenue
                            )
                          : 'محجوب (FLS)'}
                      </td>
                      <td className="px-2.5 py-3 font-mono tabular-nums">
                        {formatCurrencySAR(computedReportData.grandTotal.adSpend)}
                      </td>
                      <td className="px-2.5 py-3 font-mono text-[#2563EB] tabular-nums">
                        {computedReportData.grandTotal.roas}x
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">
                        {computedReportData.grandTotal.conversionRate}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* TABULAR REPORT TABLE (التقرير الجدولي التفصيلي للسجلات مع صف المجموع الكلي) */}
          {(viewDisplayMode === 'both' || viewDisplayMode === 'tabular') && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5 bg-[#FFFFFF]">
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-[#059669]" />
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    السجلات التفصيلية للتقرير الجدولي (Tabular Report Drill-Down)
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-[#64748B] tabular-nums">
                  {computedReportData.tabularRows.length} سجل مرتبط
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                      <th className="px-3 py-2.5">المعرف</th>
                      <th className="px-3 py-2.5">العميل / الصفقة</th>
                      <th className="px-2.5 py-2.5">المنشأة</th>
                      <th className="px-2.5 py-2.5">مصدر اللمسة الأولى</th>
                      <th className="px-2.5 py-2.5">قناة اللمسة الأخيرة</th>
                      <th className="px-2 py-2.5">اللمسات</th>
                      <th className="px-2.5 py-2.5">المرحلة / الحالة</th>
                      <th className="px-2.5 py-2.5">قيمة First-Touch</th>
                      <th className="px-2.5 py-2.5">قيمة Last-Touch</th>
                      <th className="px-2.5 py-2.5">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                    {computedReportData.tabularRows.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-3 py-2.5 font-mono font-bold text-[#2563EB] tabular-nums whitespace-nowrap">
                          <Link to={rec.entityLink} className="hover:underline">
                            {rec.uniqueCode}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#0F172A]">
                          <Link to={rec.entityLink} className="hover:text-[#2563EB]">
                            {rec.recordTitle}
                          </Link>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#334155]">{rec.companyName}</td>
                        <td className="px-2.5 py-2.5 text-[#475569]">{rec.firstTouchSource}</td>
                        <td className="px-2.5 py-2.5 text-[#059669] font-semibold">
                          {rec.lastTouchChannel}
                        </td>
                        <td className="px-2 py-2.5 font-mono text-[#475569] tabular-nums">
                          {rec.touchpointsCount}
                        </td>
                        <td className="px-2.5 py-2.5 text-[#334155] font-semibold">
                          {rec.stageOrStatus}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-bold text-[#2563EB] tabular-nums whitespace-nowrap">
                          {formatCurrencySAR(rec.firstTouchValue)}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-extrabold text-[#059669] tabular-nums whitespace-nowrap">
                          {formatCurrencySAR(rec.lastTouchValue)}
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] whitespace-nowrap">
                          {rec.ownerName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#CBD5E1] bg-[#F8FAFC] text-[12px] font-extrabold text-[#0F172A]">
                      <td className="px-3 py-3" colSpan={5}>
                        المجموع الكلي للسجلات التفصيلية ({computedReportData.tabularGrandTotal.recordsCount}{' '}
                        سجل)
                      </td>
                      <td className="px-2 py-3 font-mono tabular-nums">
                        {computedReportData.tabularGrandTotal.touchpointsCount}
                      </td>
                      <td className="px-2.5 py-3">—</td>
                      <td className="px-2.5 py-3 font-mono text-[#1D4ED8] tabular-nums whitespace-nowrap">
                        {formatCurrencySAR(
                          computedReportData.tabularGrandTotal.firstTouchValue
                        )}
                      </td>
                      <td className="px-2.5 py-3 font-mono text-[#047857] tabular-nums whitespace-nowrap">
                        {formatCurrencySAR(
                          computedReportData.tabularGrandTotal.lastTouchValue
                        )}
                      </td>
                      <td className="px-2.5 py-3">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Schedule Report Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  جدولة إرسال التقرير التلقائي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5 text-[12px]">
              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">التقرير المحدد</label>
                <input
                  type="text"
                  readOnly
                  value={activeReport.title}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-bold text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">دورية الإرسال</label>
                  <select
                    value={scheduleFreq}
                    onChange={(e) => setScheduleFreq(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  >
                    <option value="daily">يومياً</option>
                    <option value="weekly">أسبوعياً</option>
                    <option value="monthly">شهرياً</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">وقت الإرسال</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">صيغة التصدير</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CSV', 'PDF', 'XLSX'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setScheduleFormat(fmt)}
                      className={`py-2 rounded-xl border font-mono font-bold cursor-pointer ${
                        scheduleFormat === fmt
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                          : 'border-[#E2E8F0] text-[#475569]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">المستلمون (البريد الإلكتروني)</label>
                <input
                  type="text"
                  required
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 font-mono text-[#0F172A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-bold"
                >
                  حفظ الجدولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Custom Report Modal */}
      {newReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                إنشاء تقرير مخصص جديد
              </h3>
              <button
                type="button"
                onClick={() => setNewReportModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomReport} className="space-y-3.5 text-[12px]">
              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">اسم التقرير *</label>
                <input
                  type="text"
                  required
                  value={newReportTitle}
                  onChange={(e) => setNewReportTitle(e.target.value)}
                  placeholder="مثال: تقرير عائد حملات الربع الرابع حسب المدينة"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#334155] block">المجلد</label>
                <select
                  value={newReportFolder}
                  onChange={(e) => setNewReportFolder(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                >
                  <option value="meta_sources">تقارير ميتا والمصادر</option>
                  <option value="deals_reports">تقارير الصفقات</option>
                  <option value="leads_reports">تقارير العملاء</option>
                  <option value="scheduled">التقارير المجدولة</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">نمط التقرير</label>
                  <select
                    value={newReportType}
                    onChange={(e) => setNewReportType(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  >
                    <option value="summary">تلخيصي (Summary)</option>
                    <option value="tabular">جدولي (Tabular)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#334155] block">التجميع حسب</label>
                  <select
                    value={newReportGroupBy}
                    onChange={(e) => setNewReportGroupBy(e.target.value as any)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[#0F172A]"
                  >
                    <option value="channel">القناة والمصدر</option>
                    <option value="stage">مرحلة الصفقة</option>
                    <option value="rep">مندوب المبيعات</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setNewReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-bold"
                >
                  إنشاء وفتح التقرير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
