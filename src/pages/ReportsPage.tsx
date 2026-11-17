import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Layers,
  LayoutGrid,
  Pin,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  Table2,
  TrendingUp,
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
  | 'meta_attribution'
  | 'deals_reports'
  | 'leads_reports'
  | 'scheduled';

type ReportTypeKey = 'Summary' | 'Tabular' | 'Matrix';

interface SavedReportItem {
  id: string;
  code: string;
  title: string;
  description: string;
  folder: Exclude<ReportFolderKey, 'all' | 'favorites'>;
  folderLabel: string;
  reportType: ReportTypeKey;
  reportTypeArabic: string;
  primaryModule: string;
  relatedModule: string;
  groupByField: 'channel' | 'stage' | 'rep';
  lastRunLabel: string;
  isFavorite: boolean;
  scheduleLabel?: string;
  selectedColumns: string[];
}

interface AttributionChannelRow {
  key: string;
  groupCategory: 'meta_ecosystem' | 'inbound_direct';
  groupCategoryLabel: string;
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

interface DrilldownRecordRow {
  id: string;
  uniqueCode: string;
  recordTitle: string;
  companyName: string;
  channelKey: string;
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

const FOLDERS: Array<{
  key: ReportFolderKey;
  label: string;
  badgeColor?: string;
}> = [
  { key: 'all', label: 'كل التقارير' },
  { key: 'favorites', label: 'المفضلة ★', badgeColor: 'text-[#F59E0B]' },
  { key: 'meta_attribution', label: 'تقارير ميتا وAttribution' },
  { key: 'deals_reports', label: 'تقارير الصفقات' },
  { key: 'leads_reports', label: 'تقارير العملاء' },
  { key: 'scheduled', label: 'التقارير المجدولة' },
];

const INITIAL_SAVED_REPORTS: SavedReportItem[] = [
  {
    id: 'rep_multi_touch_attribution',
    code: 'RPT-META-01',
    title: 'تقرير إسناد المصادر Multi-Touch Attribution',
    description:
      'مقارنة إيرادات اللمسة الأولى (First-Touch) مقابل اللمسة الحاسمة (Last-Touch) وعائد الإنفاق الإعلاني ROAS عبر واتساب وإنستغرام وماسنجر',
    folder: 'meta_attribution',
    folderLabel: 'تقارير ميتا وAttribution',
    reportType: 'Summary',
    reportTypeArabic: 'Summary • تلخيصي',
    primaryModule: 'العملاء المحتملين (Leads)',
    relatedModule: 'نقاط التماس (touchpoints) + الصفقات (deals)',
    groupByField: 'channel',
    lastRunLabel: 'قبل 5 دقائق',
    isFavorite: true,
    scheduleLabel: 'كل أحد 08:00 ص',
    selectedColumns: [
      'القناة / المصدر الإعلاني',
      'العملاء المحتملين',
      'نقاط التماس (Touchpoints)',
      'الصفقات المغلقة (Won)',
      'إيراد First-Touch',
      'إيراد Last-Touch',
      'الإنفاق الإعلاني',
      'عائد ROAS',
    ],
  },
  {
    id: 'rep_whatsapp_ctwa_roas',
    code: 'RPT-META-02',
    title: 'تقرير عائد حملات النقر إلى واتساب (Click-to-WhatsApp CAPI)',
    description:
      'تتبع المحادثات الواردة من إعلانات ميتا، سرعة الرد، والتحويل الفعلي إلى صفقات رابحة عبر Offline Conversions',
    folder: 'meta_attribution',
    folderLabel: 'تقارير ميتا وAttribution',
    reportType: 'Matrix',
    reportTypeArabic: 'Matrix • مصفوفة',
    primaryModule: 'نقاط التماس (touchpoints)',
    relatedModule: 'الصفقات (deals)',
    groupByField: 'channel',
    lastRunLabel: 'اليوم 10:15 ص',
    isFavorite: true,
    selectedColumns: [
      'الحملة الإعلانية',
      'المحادثات المستلمة',
      'الصفقات المنشأة',
      'إيراد Last-Touch',
      'عائد ROAS',
    ],
  },
  {
    id: 'rep_deals_pipeline_summary',
    code: 'RPT-DEAL-03',
    title: 'التقرير التلخيصي لمسار الصفقات والإيرادات حسب المرحلة',
    description:
      'تحليل الصفقات المفتوحة والمغلقة مع المجاميع الفرعية لكل مرحلة بيعية ونسب الحسم',
    folder: 'deals_reports',
    folderLabel: 'تقارير الصفقات',
    reportType: 'Summary',
    reportTypeArabic: 'Summary • تلخيصي',
    primaryModule: 'الصفقات والمبيعات (Deals)',
    relatedModule: 'الشركات (accounts)',
    groupByField: 'stage',
    lastRunLabel: 'اليوم 09:00 ص',
    isFavorite: true,
    selectedColumns: [
      'مرحلة الصفقة',
      'عدد الصفقات',
      'القيمة المتوقعة',
      'القيمة المغلقة',
      'نسبة الفوز',
    ],
  },
  {
    id: 'rep_leads_touchpoints_tabular',
    code: 'RPT-LEAD-04',
    title: 'سجل تأهيل العملاء المحتملين ونقاط الدخول (Leads & Touchpoints)',
    description:
      'تقرير جدولي تفصيلي يعرض المعرف الدائم RWQ-xxxxx والمصدر الأول والأخير لكل عميل محتمل',
    folder: 'leads_reports',
    folderLabel: 'تقارير العملاء',
    reportType: 'Tabular',
    reportTypeArabic: 'Tabular • جدولي',
    primaryModule: 'العملاء المحتملين (Leads)',
    relatedModule: 'نقاط التماس (touchpoints)',
    groupByField: 'channel',
    lastRunLabel: 'أمس 04:30 م',
    isFavorite: false,
    selectedColumns: [
      'المعرف RWQ',
      'اسم العميل',
      'الشركة',
      'المصدر الأول',
      'القناة الحاسمة',
      'القيمة المقدرة',
    ],
  },
  {
    id: 'rep_sales_reps_quota_matrix',
    code: 'RPT-DEAL-05',
    title: 'مصفوفة أداء مندوبي المبيعات ومعدلات الحسم',
    description:
      'مقارنة الإيرادات المحققة وعدد الصفقات المنجزة وزمن الاستجابة لكل مسؤول مبيعات',
    folder: 'deals_reports',
    folderLabel: 'تقارير الصفقات',
    reportType: 'Summary',
    reportTypeArabic: 'Summary • تلخيصي',
    primaryModule: 'الصفقات والمبيعات (Deals)',
    relatedModule: 'المستخدمين (users)',
    groupByField: 'rep',
    lastRunLabel: 'أمس 02:10 م',
    isFavorite: false,
    selectedColumns: ['المندوب', 'الصفقات المغلقة', 'إيرادات الربع', 'نسبة الحسم'],
  },
  {
    id: 'rep_weekly_exec_digest',
    code: 'RPT-SCH-06',
    title: 'التقرير التنفيذي الأسبوعي المجدول (Weekly Attribution & Revenue Digest)',
    description:
      'ملخص تنفيذي مؤتمت يُرسل أسبوعياً للإدارة العليا بصيغة CSV/PDF شامل المجاميع الفرعية والكلي',
    folder: 'scheduled',
    folderLabel: 'التقارير المجدولة',
    reportType: 'Summary',
    reportTypeArabic: 'Summary • تلخيصي',
    primaryModule: 'الصفقات والمبيعات (Deals)',
    relatedModule: 'نقاط التماس (touchpoints)',
    groupByField: 'channel',
    lastRunLabel: 'الإثنين 08:00 ص',
    isFavorite: true,
    scheduleLabel: 'أسبوعياً • الإثنين 08:00 ص',
    selectedColumns: [
      'القناة / المصدر الإعلاني',
      'العملاء المحتملين',
      'إيراد First-Touch',
      'إيراد Last-Touch',
      'عائد ROAS',
    ],
  },
];

const AVAILABLE_BUILDER_COLUMNS = [
  { id: 'unique_id', label: 'المعرف الفريد الدائم (RWQ-xxxxx)' },
  { id: 'channel_source', label: 'القناة / المصدر الإعلاني (Channel & Source)' },
  { id: 'leads_count', label: 'عدد العملاء المحتملين (Leads Count)' },
  { id: 'touchpoints_count', label: 'نقاط التماس (Touchpoints Count)' },
  { id: 'won_deals_count', label: 'الصفقات المغلقة بنجاح (Closed Won)' },
  { id: 'first_touch_rev', label: 'إيراد اللمسة الأولى (First-Touch Revenue)' },
  { id: 'last_touch_rev', label: 'إيراد اللمسة الحاسمة (Last-Touch Revenue)' },
  { id: 'ad_spend', label: 'الإنفاق الإعلاني المعتمد (Ad Spend)' },
  { id: 'roas_metric', label: 'عائد الإنفاق الإعلاني (ROAS x)' },
  { id: 'conversion_rate', label: 'نسبة التحويل الفعلي (Conversion %)' },
  { id: 'owner_name', label: 'مسؤول السجل / الصفقة (Record Owner)' },
];

export const ReportsPage: React.FC = () => {
  const { currentOrgId, leads, deals, touchpoints, canViewField } = useCrm();

  const [reports, setReports] = useState<SavedReportItem[]>(INITIAL_SAVED_REPORTS);
  const [selectedFolder, setSelectedFolder] = useState<ReportFolderKey>('all');
  const [selectedReportId, setSelectedReportId] = useState<string>(
    INITIAL_SAVED_REPORTS[0].id
  );

  // View Mode: 'directory' (View Mode A), 'viewer' (View Mode B), or 'both' (shows Directory + Active Viewer seamlessly)
  const [viewMode, setViewMode] = useState<'directory' | 'viewer' | 'both'>('both');

  // Search & Filters
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryTypeFilter, setDirectoryTypeFilter] = useState<'ALL' | ReportTypeKey>('ALL');
  const [viewerChannelFilter, setViewerChannelFilter] = useState<string>('all');
  const [viewerRecordSearch, setViewerRecordSearch] = useState('');
  const [expandedDrilldown, setExpandedDrilldown] = useState<boolean>(true);

  // Collapsible Chart Card directly above the Summary Table
  const [showChartCard, setShowChartCard] = useState<boolean>(true);
  const [chartMetricMode, setChartMetricMode] = useState<'bars_attribution' | 'roas_curve'>(
    'bars_attribution'
  );

  // Pinned reports state synced with localStorage for DashboardPage
  const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
    getPinnedReportsForOrg(currentOrgId).map((p) => p.reportId)
  );

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3-Step Report Builder Modal State ("+ إنشاء تقرير جديد" & "تخصيص Customize")
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderEditMode, setBuilderEditMode] = useState(false);
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3>(1);
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderFolder, setBuilderFolder] =
    useState<Exclude<ReportFolderKey, 'all' | 'favorites'>>('meta_attribution');
  const [builderPrimaryModule, setBuilderPrimaryModule] = useState('العملاء المحتملين (Leads)');
  const [builderRelatedModules, setBuilderRelatedModules] = useState<string[]>([
    'نقاط التماس (touchpoints)',
    'الصفقات (deals)',
  ]);
  const [builderJoinType, setBuilderJoinType] = useState<'inclusive' | 'inner'>('inclusive');
  const [builderReportType, setBuilderReportType] = useState<ReportTypeKey>('Summary');
  const [builderSelectedCols, setBuilderSelectedCols] = useState<string[]>([
    'channel_source',
    'leads_count',
    'touchpoints_count',
    'won_deals_count',
    'first_touch_rev',
    'last_touch_rev',
    'ad_spend',
    'roas_metric',
  ]);
  const [builderGroupBy, setBuilderGroupBy] = useState<'channel' | 'stage' | 'rep'>('channel');
  const [builderDateRange, setBuilderDateRange] = useState('الربع الحالي (Q2 2025)');
  const [builderMinAmount, setBuilderMinAmount] = useState('0');

  // Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleRecipients, setScheduleRecipients] = useState(
    'ceo@riwaq.sa, sales-ops@riwaq.sa'
  );
  const [scheduleFormat, setScheduleFormat] = useState<'CSV' | 'PDF'>('CSV');

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
    const timer = window.setTimeout(() => setToastMessage(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const activeReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) ?? reports[0],
    [reports, selectedReportId]
  );

  const folderCounts = useMemo(() => {
    return {
      all: reports.length,
      favorites: reports.filter((r) => r.isFavorite).length,
      meta_attribution: reports.filter((r) => r.folder === 'meta_attribution').length,
      deals_reports: reports.filter((r) => r.folder === 'deals_reports').length,
      leads_reports: reports.filter((r) => r.folder === 'leads_reports').length,
      scheduled: reports.filter((r) => r.folder === 'scheduled' || Boolean(r.scheduleLabel))
        .length,
    };
  }, [reports]);

  const filteredDirectoryReports = useMemo(() => {
    const q = (directorySearch || sidebarSearch).trim().toLowerCase();
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
      if (directoryTypeFilter !== 'ALL' && rep.reportType !== directoryTypeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        rep.title.toLowerCase().includes(q) ||
        rep.description.toLowerCase().includes(q) ||
        rep.code.toLowerCase().includes(q) ||
        rep.folderLabel.toLowerCase().includes(q)
      );
    });
  }, [directorySearch, directoryTypeFilter, reports, selectedFolder, sidebarSearch]);

  // Dynamic Summary (with Subtotals & Grand Total) + Tabular computation from `leads`, `deals`, and `touchpoints`
  const reportComputation = useMemo(() => {
    const channelSpecs: Array<{
      key: string;
      groupCategory: 'meta_ecosystem' | 'inbound_direct';
      groupCategoryLabel: string;
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
        groupCategory: 'meta_ecosystem',
        groupCategoryLabel: 'مجموعة 1: منظومة قنوات ميتا الإعلانية والمباشرة (Meta Ecosystem)',
        label: 'واتساب للأعمال السحابي (WhatsApp Cloud API & CTWA)',
        badge: 'Meta WhatsApp',
        leadChannelMatch: ['whatsapp'],
        tpChannelMatch: ['واتساب'],
        baseSpend: 92000,
        baseFirstRev: 410000,
        baseLastRev: 685000,
      },
      {
        key: 'instagram',
        groupCategory: 'meta_ecosystem',
        groupCategoryLabel: 'مجموعة 1: منظومة قنوات ميتا الإعلانية والمباشرة (Meta Ecosystem)',
        label: 'إعلانات إنستغرام ودايركت (Instagram Reels & Lead Ads)',
        badge: 'Meta Instagram',
        leadChannelMatch: ['instagram'],
        tpChannelMatch: ['إنستغرام'],
        baseSpend: 68000,
        baseFirstRev: 345000,
        baseLastRev: 265000,
      },
      {
        key: 'messenger',
        groupCategory: 'meta_ecosystem',
        groupCategoryLabel: 'مجموعة 1: منظومة قنوات ميتا الإعلانية والمباشرة (Meta Ecosystem)',
        label: 'فيسبوك ماسنجر وحملات التمويل (Facebook Messenger)',
        badge: 'Meta Messenger',
        leadChannelMatch: ['messenger'],
        tpChannelMatch: ['اجتماع'],
        baseSpend: 44000,
        baseFirstRev: 185000,
        baseLastRev: 155000,
      },
      {
        key: 'website',
        groupCategory: 'inbound_direct',
        groupCategoryLabel: 'مجموعة 2: القنوات الرقمية والبحث والمبيعات المباشرة (Search & Direct B2B)',
        label: 'بحث جوجل والموقع الإلكتروني (Google Search & Organic)',
        badge: 'Google / Web',
        leadChannelMatch: ['website'],
        tpChannelMatch: ['موقع ويب', 'بريد إلكتروني'],
        baseSpend: 35000,
        baseFirstRev: 215000,
        baseLastRev: 190000,
      },
      {
        key: 'direct_phone',
        groupCategory: 'inbound_direct',
        groupCategoryLabel: 'مجموعة 2: القنوات الرقمية والبحث والمبيعات المباشرة (Search & Direct B2B)',
        label: 'المبيعات المؤسسية المباشرة والإحالات (Enterprise Direct)',
        badge: 'B2B Direct',
        leadChannelMatch: ['phone', 'referral'],
        tpChannelMatch: ['مكالمة', 'حدث'],
        baseSpend: 21000,
        baseFirstRev: 165000,
        baseLastRev: 190200,
      },
    ];

    const allChannelRows: AttributionChannelRow[] = channelSpecs.map((spec) => {
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
        groupCategory: spec.groupCategory,
        groupCategoryLabel: spec.groupCategoryLabel,
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

    const summaryRows =
      viewerChannelFilter === 'all'
        ? allChannelRows
        : allChannelRows.filter((r) => r.key === viewerChannelFilter);

    const buildSubtotal = (rows: AttributionChannelRow[]) => {
      const leadsCount = rows.reduce((s, r) => s + r.leadsCount, 0);
      const touchpointsCount = rows.reduce((s, r) => s + r.touchpointsCount, 0);
      const dealsCount = rows.reduce((s, r) => s + r.dealsCount, 0);
      const wonDealsCount = rows.reduce((s, r) => s + r.wonDealsCount, 0);
      const firstTouchRevenue = rows.reduce((s, r) => s + r.firstTouchRevenue, 0);
      const lastTouchRevenue = rows.reduce((s, r) => s + r.lastTouchRevenue, 0);
      const adSpend = rows.reduce((s, r) => s + r.adSpend, 0);
      const roas = Number((lastTouchRevenue / Math.max(1, adSpend)).toFixed(2));
      const conversionRate = Number(
        ((wonDealsCount / Math.max(1, leadsCount)) * 100).toFixed(1)
      );
      return {
        leadsCount,
        touchpointsCount,
        dealsCount,
        wonDealsCount,
        firstTouchRevenue,
        lastTouchRevenue,
        adSpend,
        roas,
        conversionRate,
      };
    };

    const metaGroupRows = summaryRows.filter((r) => r.groupCategory === 'meta_ecosystem');
    const inboundGroupRows = summaryRows.filter((r) => r.groupCategory === 'inbound_direct');

    const metaSubtotal = buildSubtotal(metaGroupRows);
    const inboundSubtotal = buildSubtotal(inboundGroupRows);
    const grandTotal = buildSubtotal(summaryRows);

    // Drill-down tabular rows from actual deals & leads
    const drilldownRows: DrilldownRecordRow[] = [];

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
      const chKey = linkedLead?.channel || (idx % 2 === 0 ? 'whatsapp' : 'instagram');
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

      drilldownRows.push({
        id: `dr_deal_${deal.id}`,
        uniqueCode: deal.leadUniqueId || `DEAL-${1040 + idx}`,
        recordTitle: deal.title,
        companyName: deal.accountName,
        channelKey: chKey,
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
      if (drilldownRows.some((r) => r.uniqueCode === lead.unique_id)) return;
      const relatedTps = touchpoints.filter(
        (tp) => tp.leadId === lead.id || tp.leadUniqueId === lead.unique_id
      );
      const firstVal = lead.estimatedValue || 75000;
      const lastVal = lead.approvedBudget || Math.round(firstVal * 1.1);
      const estimatedSpend = Math.max(3200, Math.round(lastVal * 0.16));

      drilldownRows.push({
        id: `dr_lead_${lead.id}_${idx}`,
        uniqueCode: lead.unique_id,
        recordTitle: lead.fullName,
        companyName: lead.company || lead.city || 'منشأة أعمال',
        channelKey: lead.channel || 'whatsapp',
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

    const q = viewerRecordSearch.trim().toLowerCase();
    const filteredDrilldownRows = drilldownRows.filter((row) => {
      if (viewerChannelFilter !== 'all' && row.channelKey !== viewerChannelFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.uniqueCode.toLowerCase().includes(q) ||
        row.recordTitle.toLowerCase().includes(q) ||
        row.companyName.toLowerCase().includes(q) ||
        row.firstTouchSource.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q)
      );
    });

    return {
      summaryRows,
      metaGroupRows,
      inboundGroupRows,
      metaSubtotal,
      inboundSubtotal,
      grandTotal,
      drilldownRows: filteredDrilldownRows,
    };
  }, [deals, leads, touchpoints, viewerChannelFilter, viewerRecordSearch]);

  const isCurrentReportPinned = pinnedIds.includes(activeReport.id);

  const handleOpenNewBuilder = () => {
    setBuilderEditMode(false);
    setBuilderStep(1);
    setBuilderTitle('');
    setBuilderDesc('');
    setBuilderFolder('meta_attribution');
    setBuilderPrimaryModule('العملاء المحتملين (Leads)');
    setBuilderRelatedModules(['نقاط التماس (touchpoints)', 'الصفقات (deals)']);
    setBuilderReportType('Summary');
    setBuilderGroupBy('channel');
    setBuilderModalOpen(true);
  };

  const handleOpenCustomizeBuilder = () => {
    setBuilderEditMode(true);
    setBuilderStep(1);
    setBuilderTitle(activeReport.title);
    setBuilderDesc(activeReport.description);
    setBuilderFolder(activeReport.folder);
    setBuilderPrimaryModule(activeReport.primaryModule);
    setBuilderReportType(activeReport.reportType);
    setBuilderGroupBy(activeReport.groupByField);
    setBuilderModalOpen(true);
  };

  const handleSaveBuilderReport = (e: React.FormEvent) => {
    e.preventDefault();
    const folderLabelMap: Record<Exclude<ReportFolderKey, 'all' | 'favorites'>, string> = {
      meta_attribution: 'تقارير ميتا وAttribution',
      deals_reports: 'تقارير الصفقات',
      leads_reports: 'تقارير العملاء',
      scheduled: 'التقارير المجدولة',
    };
    const typeArabicMap: Record<ReportTypeKey, string> = {
      Summary: 'Summary • تلخيصي',
      Tabular: 'Tabular • جدولي',
      Matrix: 'Matrix • مصفوفة',
    };

    if (builderEditMode) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === activeReport.id
            ? {
                ...r,
                title: builderTitle.trim() || r.title,
                description: builderDesc.trim() || r.description,
                folder: builderFolder,
                folderLabel: folderLabelMap[builderFolder],
                reportType: builderReportType,
                reportTypeArabic: typeArabicMap[builderReportType],
                primaryModule: builderPrimaryModule,
                relatedModule: builderRelatedModules.join(' + ') || 'نقاط التماس (touchpoints)',
                groupByField: builderGroupBy,
                lastRunLabel: 'الآن (محدث)',
              }
            : r
        )
      );
      setBuilderModalOpen(false);
      setToastMessage(`تم تحديث تخصيص التقرير "${builderTitle || activeReport.title}" بنجاح.`);
      return;
    }

    const newItem: SavedReportItem = {
      id: `rep_custom_${Date.now()}`,
      code: `RPT-CST-${reports.length + 1}`,
      title:
        builderTitle.trim() ||
        `تقرير ${builderPrimaryModule} (${typeArabicMap[builderReportType]})`,
      description:
        builderDesc.trim() ||
        `تقرير مخصص يدمج ${builderPrimaryModule} مع ${builderRelatedModules.join(' و ')} مع تجميع تلقائي.`,
      folder: builderFolder,
      folderLabel: folderLabelMap[builderFolder],
      reportType: builderReportType,
      reportTypeArabic: typeArabicMap[builderReportType],
      primaryModule: builderPrimaryModule,
      relatedModule: builderRelatedModules.join(' + ') || 'نقاط التماس (touchpoints)',
      groupByField: builderGroupBy,
      lastRunLabel: 'الآن',
      isFavorite: true,
      selectedColumns: builderSelectedCols,
    };

    setReports((prev) => [newItem, ...prev]);
    setSelectedReportId(newItem.id);
    setViewMode('viewer');
    setBuilderModalOpen(false);
    setToastMessage(`تم إنشاء وتشغيل التقرير "${newItem.title}" بنجاح.`);
  };

  const handleToggleFavorite = (repId: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === repId ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  const handleTogglePinToDashboard = () => {
    const result = togglePinReportForOrg(currentOrgId, {
      id: `pin_${activeReport.id}`,
      reportId: activeReport.id,
      title: activeReport.title,
      folderLabel: activeReport.folderLabel,
      reportType: activeReport.reportType === 'Tabular' ? 'tabular' : 'summary',
      firstTouchRevenue: reportComputation.grandTotal.firstTouchRevenue,
      lastTouchRevenue: reportComputation.grandTotal.lastTouchRevenue,
      totalLeads: reportComputation.grandTotal.leadsCount,
      totalDeals: reportComputation.grandTotal.dealsCount,
      roas: reportComputation.grandTotal.roas,
      pinnedAt: 'الآن',
    });

    setPinnedIds(result.list.map((i) => i.reportId));
    setToastMessage(
      result.pinned
        ? `📌 تم تثبيت "${activeReport.title}" في لوحة القيادة التنفيذية (${currentOrgId}).`
        : `تم إلغاء تثبيت "${activeReport.title}" من لوحة القيادة.`
    );
  };

  const handleExportReport = (format: 'CSV' | 'PDF') => {
    const header = [
      'المجموعة / القناة',
      'عدد العملاء المحتملين',
      'نقاط التماس (Touchpoints)',
      'الصفقات المغلقة (Won)',
      'إيراد اللمسة الأولى First-Touch (SAR)',
      'إيراد اللمسة الحاسمة Last-Touch (SAR)',
      'الإنفاق الإعلاني (SAR)',
      'عائد الإنفاق الإعلاني (ROAS)',
      'معدل التحويل (%)',
    ];

    const rows = reportComputation.summaryRows.map((r) => [
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

    const metaSubRow = [
      'المجموع الفرعي — منظومة قنوات ميتا (Subtotal Meta)',
      String(reportComputation.metaSubtotal.leadsCount),
      String(reportComputation.metaSubtotal.touchpointsCount),
      String(reportComputation.metaSubtotal.wonDealsCount),
      String(reportComputation.metaSubtotal.firstTouchRevenue),
      String(reportComputation.metaSubtotal.lastTouchRevenue),
      String(reportComputation.metaSubtotal.adSpend),
      `${reportComputation.metaSubtotal.roas}x`,
      `${reportComputation.metaSubtotal.conversionRate}%`,
    ];

    const grandRow = [
      'المجموع الكلي الشامل (Grand Total)',
      String(reportComputation.grandTotal.leadsCount),
      String(reportComputation.grandTotal.touchpointsCount),
      String(reportComputation.grandTotal.wonDealsCount),
      String(reportComputation.grandTotal.firstTouchRevenue),
      String(reportComputation.grandTotal.lastTouchRevenue),
      String(reportComputation.grandTotal.adSpend),
      `${reportComputation.grandTotal.roas}x`,
      `${reportComputation.grandTotal.conversionRate}%`,
    ];

    const csvContent =
      '\uFEFF' +
      [header, ...rows, metaSubRow, grandRow]
        .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq-report-${activeReport.code}-${currentOrgId}.${format.toLowerCase() === 'pdf' ? 'csv' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage(
      `تم تصدير التقرير "${activeReport.title}" بصيغة ${format} شامل المجاميع الفرعية والمجموع الكلي.`
    );
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
      `تمت جدولة التقرير "${activeReport.title}" (${label}) إلى ${scheduleRecipients}.`
    );
  };

  const maxChannelRev = Math.max(
    1,
    ...reportComputation.summaryRows.map((r) =>
      Math.max(r.firstTouchRevenue, r.lastTouchRevenue)
    )
  );

  return (
    <div dir="rtl" className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] pb-12">
      {/* 1. FLUSH WHITE TOP HEADER */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Right: Title & Breadcrumbs */}
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] mb-0.5">
                <Link to="/" className="hover:text-[#2563EB] font-semibold">
                  لوحة القيادة
                </Link>
                <span>/</span>
                <span className="font-bold text-[#0F172A]">التقارير (Zoho Reports Module)</span>
                <span>•</span>
                <span className="rounded bg-[#EFF6FF] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                  {currentOrgId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[19px] sm:text-[21px] font-extrabold text-[#0F172A] leading-tight">
                  مركز التقارير المؤسسية وإسناد المصادر (Reports & Attribution Studio)
                </h1>
                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                  مباشر من Firestore
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                استعراض مجلدات التقارير، منشئ التقارير المخصصة من 3 خطوات، وتقارير الإسناد المزدوج (First-Touch vs Last-Touch) مع التثبيت في لوحة القيادة.
              </p>
            </div>
          </div>

          {/* Left: View Mode Switcher + "+ إنشاء تقرير جديد" */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('directory')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'directory'
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs font-extrabold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                دليل التقارير (Directory)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('viewer')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'viewer'
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs font-extrabold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                عارض التقرير (Report Viewer)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'both'
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs font-extrabold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                عرض متكامل
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenNewBuilder}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-bold text-[#FFFFFF] shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ إنشاء تقرير جديد</span>
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

      {/* 2. MAIN 2-COLUMN ZOHO WORKSPACE (`w-full px-6 py-5`): RIGHT FOLDERS SIDEBAR (22%) + LEFT WORKSPACE (78%) */}
      <div className="w-full px-6 py-5 flex flex-col lg:flex-row gap-5 items-start">
        {/* RIGHT FOLDERS SIDEBAR (22%) */}
        <aside className="w-full lg:w-[22%] shrink-0 space-y-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-[13px] font-extrabold text-[#0F172A]">
                  مجلدات التقارير
                </h2>
              </div>
              <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] tabular-nums">
                {reports.length}
              </span>
            </div>

            {/* Search box inside Right Folders Sidebar */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="بحث في المجلدات والتقارير..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] pr-8 pl-3 py-2 text-[12px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
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
                    onClick={() => {
                      setSelectedFolder(folder.key);
                      if (viewMode === 'viewer') {
                        setViewMode('directory');
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[12px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-extrabold border border-[#BFDBFE]'
                        : 'text-[#334155] hover:bg-[#F8FAFC] font-semibold border border-transparent'
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
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-mono tabular-nums ${
                        isSelected
                          ? 'bg-[#2563EB] text-[#FFFFFF] font-extrabold'
                          : 'bg-[#F1F5F9] text-[#64748B]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Pinned & Scheduled Status Box */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#475569]">مثبت في لوحة القيادة:</span>
                <span className="font-extrabold text-[#059669] tabular-nums">
                  {pinnedIds.length} تقارير
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#475569]">التقارير المجدولة آلياً:</span>
                <span className="font-extrabold text-[#2563EB] tabular-nums">
                  {folderCounts.scheduled} نشطة
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenNewBuilder}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] py-1.5 text-[11px] font-extrabold text-[#1D4ED8] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ إنشاء تقرير جديد (3 خطوات)</span>
              </button>
            </div>
          </div>
        </aside>

        {/* LEFT MAIN WORKSPACE (78%) */}
        <div className="w-full lg:w-[78%] min-w-0 space-y-5">
          {/* ===================================================================== */}
          {/* VIEW MODE A — REPORTS DIRECTORY (when browsing a folder)             */}
          {/* ===================================================================== */}
          {(viewMode === 'directory' || viewMode === 'both') && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FFFFFF] px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                      دليل التقارير المحفوظة —{' '}
                      {FOLDERS.find((f) => f.key === selectedFolder)?.label}
                    </h2>
                    <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#475569] tabular-nums">
                      {filteredDirectoryReports.length} تقرير
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    انقر على أي تقرير لفتحه في عارض التقارير التلخيصية والجدولية أو قم بإنشاء تقرير مخصص جديد.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Type Filter Pills */}
                  <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11px] font-bold">
                    {(['ALL', 'Summary', 'Tabular', 'Matrix'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDirectoryTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          directoryTypeFilter === t
                            ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {t === 'ALL' ? 'الكل' : t}
                      </button>
                    ))}
                  </div>

                  {/* Directory Search */}
                  <div className="relative w-52">
                    <Search className="h-3.5 w-3.5 text-[#64748B] absolute right-2.5 top-2.5" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="ابحث باسم التقرير أو الوصف..."
                      className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-2.5 py-1.5 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>

                  {/* + إنشاء تقرير جديد */}
                  <button
                    type="button"
                    onClick={handleOpenNewBuilder}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3.5 text-[11px] font-bold text-[#FFFFFF] transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ إنشاء تقرير جديد</span>
                  </button>
                </div>
              </div>

              {/* Clean Table of Saved Reports (اسم التقرير، الوصف، النوع، آخر تشغيل، المفضلة ★) */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-extrabold text-[#64748B]">
                      <th className="py-3 px-4">اسم التقرير</th>
                      <th className="py-3 px-3">الوصف والموديولات المرتبطة</th>
                      <th className="py-3 px-3">النوع</th>
                      <th className="py-3 px-3">آخر تشغيل</th>
                      <th className="py-3 px-4 text-center">المفضلة ★</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                    {filteredDirectoryReports.map((rep) => {
                      const isSelected = rep.id === activeReport.id;
                      const isPinned = pinnedIds.includes(rep.id);
                      return (
                        <tr
                          key={rep.id}
                          onClick={() => {
                            setSelectedReportId(rep.id);
                            setViewMode('viewer');
                          }}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#EFF6FF]/65 hover:bg-[#EFF6FF]'
                              : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <td className="py-3 px-4 align-middle">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                  isSelected ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
                                }`}
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-[#0F172A] hover:text-[#2563EB]">
                                    {rep.title}
                                  </span>
                                  <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#475569]">
                                    {rep.code}
                                  </span>
                                  {isPinned && (
                                    <span className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#059669]">
                                      📌 مثبت باللوحة
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-semibold text-[#2563EB] mt-0.5 inline-block">
                                  {rep.folderLabel}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 align-middle max-w-md">
                            <p className="text-[11px] text-[#334155] line-clamp-1">
                              {rep.description}
                            </p>
                            <span className="text-[10px] text-[#64748B] font-medium">
                              الكيانات: {rep.primaryModule} ← {rep.relatedModule}
                            </span>
                          </td>

                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                                rep.reportType === 'Summary'
                                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                  : rep.reportType === 'Matrix'
                                    ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]'
                                    : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                              }`}
                            >
                              {rep.reportTypeArabic}
                            </span>
                          </td>

                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-[#0F172A] tabular-nums">
                                {rep.lastRunLabel}
                              </span>
                              {rep.scheduleLabel && (
                                <span className="text-[10px] font-semibold text-[#059669]">
                                  ⏰ {rep.scheduleLabel}
                                </span>
                              )}
                            </div>
                          </td>

                          <td
                            className="py-3 px-4 align-middle text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(rep.id)}
                                aria-label="تفضيل التقرير"
                                className="rounded-lg p-1.5 hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    rep.isFavorite
                                      ? 'fill-[#F59E0B] text-[#F59E0B]'
                                      : 'text-[#94A3B8]'
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReportId(rep.id);
                                  setViewMode('viewer');
                                }}
                                className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#2563EB] hover:text-[#FFFFFF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB] transition-colors cursor-pointer"
                              >
                                فتح التقرير
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================== */}
          {/* VIEW MODE B — REPORT VIEWER (when opening a report)                   */}
          {/* ===================================================================== */}
          {(viewMode === 'viewer' || viewMode === 'both') && (
            <div className="space-y-4">
              {/* 1. Report Viewer Header & Action Toolbar */}
              <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Right: Back to Folder + Report Title & Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('directory')}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold text-[#0F172A] transition-colors cursor-pointer"
                      >
                        <ArrowRight className="h-3.5 w-3.5 text-[#2563EB]" />
                        <span>العودة إلى المجلد</span>
                      </button>
                      <span className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
                        {activeReport.folderLabel}
                      </span>
                      <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[11px] font-bold text-[#475569]">
                        {activeReport.reportTypeArabic}
                      </span>
                      {activeReport.scheduleLabel && (
                        <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#059669]">
                          مجدول: {activeReport.scheduleLabel}
                        </span>
                      )}
                    </div>

                    <h2 className="text-[17px] sm:text-[18px] font-extrabold text-[#0F172A]">
                      {activeReport.title}
                    </h2>
                    <p className="text-[12px] text-[#64748B]">{activeReport.description}</p>
                  </div>

                  {/* Left: Required Report Viewer Toolbar */}
                  {/* "تخصيص (Customize)", "+ إضافة رسم بياني", "📌 تثبيت في لوحة القيادة", "جدولة", "تصدير CSV/PDF" */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCustomizeBuilder}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span>تخصيص (Customize)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowChartCard((prev) => !prev)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold transition-colors cursor-pointer ${
                        showChartCard
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                          : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>
                        {showChartCard ? 'إخفاء الرسم البياني' : '+ إضافة رسم بياني'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePinToDashboard}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold transition-colors cursor-pointer ${
                        isCurrentReportPinned
                          ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46]'
                          : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span>
                        {isCurrentReportPinned
                          ? '📌 مثبت في لوحة القيادة ✓'
                          : '📌 تثبيت في لوحة القيادة'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#334155] transition-colors cursor-pointer"
                    >
                      <Calendar className="h-3.5 w-3.5 text-[#475569]" />
                      <span>جدولة</span>
                    </button>

                    <div className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleExportReport('CSV')}
                        className="inline-flex h-9 items-center gap-1.5 px-3 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-[#059669]" />
                        <span>تصدير CSV/PDF</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Bar inside Report Viewer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#475569] flex items-center gap-1 ml-1">
                      <Filter className="h-3.5 w-3.5 text-[#2563EB]" />
                      تصفية القنوات:
                    </span>
                    {[
                      { key: 'all', label: 'كافة المصادر (5)' },
                      { key: 'whatsapp', label: 'واتساب للأعمال' },
                      { key: 'instagram', label: 'إنستغرام' },
                      { key: 'messenger', label: 'ماسنجر' },
                      { key: 'website', label: 'بحث جوجل والويب' },
                    ].map((ch) => (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => setViewerChannelFilter(ch.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          viewerChannelFilter === ch.key
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
                      value={viewerRecordSearch}
                      onChange={(e) => setViewerRecordSearch(e.target.value)}
                      placeholder="تصفية السجلات (RWQ / شركة / مندوب)..."
                      className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] pr-8 pl-3 py-1.5 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* 2. COLLAPSIBLE CHART CARD DIRECTLY ABOVE THE SUMMARY TABLE */}
              {showChartCard && (
                <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#2563EB]" />
                        <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                          مخطط الإسناد المالي وعائد ROAS: اللمسة الأولى (First-Touch) مقابل اللمسة الأخيرة (Last-Touch)
                        </h3>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        يوضح الفارق بين القنوات الجاذبة للعميل (First-Touch) والقنوات الحاسمة لإغلاق العقد (Last-Touch) مع مضاعف ROAS
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setChartMetricMode('bars_attribution')}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            chartMetricMode === 'bars_attribution'
                              ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                              : 'text-[#64748B]'
                          }`}
                        >
                          أعمدة First vs Last
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMetricMode('roas_curve')}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            chartMetricMode === 'roas_curve'
                              ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs'
                              : 'text-[#64748B]'
                          }`}
                        >
                          مؤشر عائد ROAS
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowChartCard(false)}
                        className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
                        title="طي الرسم البياني"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chart Bars */}
                  <div className="space-y-3.5">
                    {reportComputation.summaryRows.map((row) => {
                      const firstPct = Math.max(
                        10,
                        Math.round((row.firstTouchRevenue / maxChannelRev) * 100)
                      );
                      const lastPct = Math.max(
                        10,
                        Math.round((row.lastTouchRevenue / maxChannelRev) * 100)
                      );
                      return (
                        <div
                          key={row.key}
                          className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC]/70 p-3 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[#0F172A]">
                                {row.channelLabel}
                              </span>
                              <span className="rounded border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                                {row.channelBadge}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums">
                              <span className="text-[#2563EB] font-bold">
                                First: {formatCurrencySAR(row.firstTouchRevenue)}
                              </span>
                              <span className="text-[#059669] font-extrabold">
                                Last: {formatCurrencySAR(row.lastTouchRevenue)}
                              </span>
                              <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 font-extrabold text-[#065F46]">
                                ROAS {row.roas}x
                              </span>
                            </div>
                          </div>

                          {chartMetricMode === 'bars_attribution' ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-24 text-[10px] font-bold text-[#2563EB] shrink-0">
                                  اللمسة الأولى
                                </span>
                                <div className="h-2.5 flex-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#2563EB]"
                                    style={{ width: `${firstPct}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-24 text-[10px] font-bold text-[#059669] shrink-0">
                                  اللمسة الحاسمة
                                </span>
                                <div className="h-2.5 flex-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#059669]"
                                    style={{ width: `${lastPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="w-24 text-[10px] font-bold text-[#4F46E5] shrink-0">
                                كفاءة العائد ROAS
                              </span>
                              <div className="h-3 flex-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-l from-[#2563EB] to-[#059669]"
                                  style={{
                                    width: `${Math.min(100, Math.round(row.roas * 11))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold text-[#0F172A] tabular-nums">
                                تحويل {row.conversionRate}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 3. HIGH-DENSITY SUMMARY TABLE WITH SUBTOTALS AND BOTTOM GRAND TOTAL ROW */}
              <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#2563EB]" />
                    <div>
                      <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                        الجدول التلخيصي المجمّع مع المجاميع الفرعية والمجموع الكلي (Summary Report with Subtotals & Grand Total)
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        مجمّع حسب مجموعة القنوات مع احتساب إيراد اللمسة الأولى واللمسة الحاسمة وعائد الإنفاق الإعلاني ROAS
                      </p>
                    </div>
                  </div>

                  <span className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-extrabold text-[#1D4ED8] tabular-nums">
                    إجمالي ROAS التقرير: {reportComputation.grandTotal.roas}x
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-extrabold text-[#475569]">
                        <th className="py-3 px-4">القناة / المصدر الإعلاني</th>
                        <th className="py-3 px-3 text-center">العملاء المحتملين</th>
                        <th className="py-3 px-3 text-center">نقاط التماس</th>
                        <th className="py-3 px-3 text-center">الصفقات المغلقة</th>
                        <th className="py-3 px-3">إيراد First-Touch</th>
                        <th className="py-3 px-3">إيراد Last-Touch</th>
                        <th className="py-3 px-3">الإنفاق الإعلاني</th>
                        <th className="py-3 px-3 text-center">عائد ROAS</th>
                        <th className="py-3 px-4 text-center">معدل التحويل</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                      {/* GROUP 1: META ECOSYSTEM */}
                      {reportComputation.metaGroupRows.length > 0 && (
                        <>
                          <tr className="bg-[#EFF6FF]/60">
                            <td
                              colSpan={9}
                              className="py-2 px-4 text-[11px] font-extrabold text-[#1E3A8A]"
                            >
                              ▾ المجموعة الأولى: منظومة قنوات ميتا الإعلانية والمباشرة (Meta Ecosystem — WhatsApp, Instagram, Messenger)
                            </td>
                          </tr>
                          {reportComputation.metaGroupRows.map((row) => (
                            <tr
                              key={row.key}
                              className="hover:bg-[#F8FAFC] transition-colors"
                            >
                              <td className="py-3 px-4 font-bold text-[#0F172A]">
                                <div className="flex items-center gap-2">
                                  <span>{row.channelLabel}</span>
                                  <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
                                    {row.channelBadge}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-[#0F172A] tabular-nums">
                                {row.leadsCount}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-[#475569] tabular-nums">
                                {row.touchpointsCount}
                              </td>
                              <td className="py-3 px-3 text-center font-extrabold text-[#059669] tabular-nums">
                                {row.wonDealsCount}
                              </td>
                              <td className="py-3 px-3 font-bold text-[#2563EB] tabular-nums">
                                { canViewField('deals', 'amount')
                                  ? formatCurrencySAR(row.firstTouchRevenue)
                                  : '🔒 مقيد' }
                              </td>
                              <td className="py-3 px-3 font-extrabold text-[#059669] tabular-nums">
                                { canViewField('deals', 'amount')
                                  ? formatCurrencySAR(row.lastTouchRevenue)
                                  : '🔒 مقيد' }
                              </td>
                              <td className="py-3 px-3 font-semibold text-[#475569] tabular-nums">
                                {formatCurrencySAR(row.adSpend)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-extrabold text-[#065F46] tabular-nums">
                                  {row.roas}x
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-[#0F172A] tabular-nums">
                                {row.conversionRate}%
                              </td>
                            </tr>
                          ))}
                          {/* SUBTOTAL ROW FOR GROUP 1 */}
                          <tr className="bg-[#F1F5F9]/90 border-t border-b border-[#CBD5E1] font-extrabold text-[#0F172A]">
                            <td className="py-2.5 px-4 text-[11px] text-[#1E3A8A]">
                              المجموع الفرعي لمنظومة ميتا (Subtotal — Meta Channels)
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums">
                              {reportComputation.metaSubtotal.leadsCount}
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums">
                              {reportComputation.metaSubtotal.touchpointsCount}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#059669] tabular-nums">
                              {reportComputation.metaSubtotal.wonDealsCount}
                            </td>
                            <td className="py-2.5 px-3 text-[#2563EB] tabular-nums">
                              {formatCurrencySAR(
                                reportComputation.metaSubtotal.firstTouchRevenue
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#059669] tabular-nums">
                              {formatCurrencySAR(
                                reportComputation.metaSubtotal.lastTouchRevenue
                              )}
                            </td>
                            <td className="py-2.5 px-3 tabular-nums">
                              {formatCurrencySAR(reportComputation.metaSubtotal.adSpend)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#065F46] tabular-nums">
                              {reportComputation.metaSubtotal.roas}x
                            </td>
                            <td className="py-2.5 px-4 text-center tabular-nums">
                              {reportComputation.metaSubtotal.conversionRate}%
                            </td>
                          </tr>
                        </>
                      )}

                      {/* GROUP 2: INBOUND & DIRECT */}
                      {reportComputation.inboundGroupRows.length > 0 && (
                        <>
                          <tr className="bg-[#F8FAFC]">
                            <td
                              colSpan={9}
                              className="py-2 px-4 text-[11px] font-extrabold text-[#334155]"
                            >
                              ▾ المجموعة الثانية: القنوات الرقمية والبحث والمبيعات المباشرة (Search, Web & Enterprise Direct)
                            </td>
                          </tr>
                          {reportComputation.inboundGroupRows.map((row) => (
                            <tr
                              key={row.key}
                              className="hover:bg-[#F8FAFC] transition-colors"
                            >
                              <td className="py-3 px-4 font-bold text-[#0F172A]">
                                <div className="flex items-center gap-2">
                                  <span>{row.channelLabel}</span>
                                  <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
                                    {row.channelBadge}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-[#0F172A] tabular-nums">
                                {row.leadsCount}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-[#475569] tabular-nums">
                                {row.touchpointsCount}
                              </td>
                              <td className="py-3 px-3 text-center font-extrabold text-[#059669] tabular-nums">
                                {row.wonDealsCount}
                              </td>
                              <td className="py-3 px-3 font-bold text-[#2563EB] tabular-nums">
                                {formatCurrencySAR(row.firstTouchRevenue)}
                              </td>
                              <td className="py-3 px-3 font-extrabold text-[#059669] tabular-nums">
                                {formatCurrencySAR(row.lastTouchRevenue)}
                              </td>
                              <td className="py-3 px-3 font-semibold text-[#475569] tabular-nums">
                                {formatCurrencySAR(row.adSpend)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-extrabold text-[#065F46] tabular-nums">
                                  {row.roas}x
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-[#0F172A] tabular-nums">
                                {row.conversionRate}%
                              </td>
                            </tr>
                          ))}
                          {/* SUBTOTAL ROW FOR GROUP 2 */}
                          <tr className="bg-[#F1F5F9]/90 border-t border-b border-[#CBD5E1] font-extrabold text-[#0F172A]">
                            <td className="py-2.5 px-4 text-[11px] text-[#334155]">
                              المجموع الفرعي للقنوات الرقمية والمباشرة (Subtotal — Web & Direct)
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums">
                              {reportComputation.inboundSubtotal.leadsCount}
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums">
                              {reportComputation.inboundSubtotal.touchpointsCount}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#059669] tabular-nums">
                              {reportComputation.inboundSubtotal.wonDealsCount}
                            </td>
                            <td className="py-2.5 px-3 text-[#2563EB] tabular-nums">
                              {formatCurrencySAR(
                                reportComputation.inboundSubtotal.firstTouchRevenue
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#059669] tabular-nums">
                              {formatCurrencySAR(
                                reportComputation.inboundSubtotal.lastTouchRevenue
                              )}
                            </td>
                            <td className="py-2.5 px-3 tabular-nums">
                              {formatCurrencySAR(reportComputation.inboundSubtotal.adSpend)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#065F46] tabular-nums">
                              {reportComputation.inboundSubtotal.roas}x
                            </td>
                            <td className="py-2.5 px-4 text-center tabular-nums">
                              {reportComputation.inboundSubtotal.conversionRate}%
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>

                    {/* BOTTOM GRAND TOTAL ROW */}
                    <tfoot>
                      <tr className="bg-[#0F172A] text-[#FFFFFF] text-[12px] font-extrabold">
                        <td className="py-3.5 px-4">
                          المجموع الكلي الشامل (Grand Total — جميع القنوات)
                        </td>
                        <td className="py-3.5 px-3 text-center tabular-nums">
                          {reportComputation.grandTotal.leadsCount} عميل
                        </td>
                        <td className="py-3.5 px-3 text-center tabular-nums">
                          {reportComputation.grandTotal.touchpointsCount} تفاعل
                        </td>
                        <td className="py-3.5 px-3 text-center text-[#6EE7B7] tabular-nums">
                          {reportComputation.grandTotal.wonDealsCount} صفقة
                        </td>
                        <td className="py-3.5 px-3 text-[#93C5FD] tabular-nums">
                          {formatCurrencySAR(reportComputation.grandTotal.firstTouchRevenue)}
                        </td>
                        <td className="py-3.5 px-3 text-[#6EE7B7] tabular-nums">
                          {formatCurrencySAR(reportComputation.grandTotal.lastTouchRevenue)}
                        </td>
                        <td className="py-3.5 px-3 text-[#E2E8F0] tabular-nums">
                          {formatCurrencySAR(reportComputation.grandTotal.adSpend)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="rounded-md bg-[#059669] px-2.5 py-1 text-[11px] font-extrabold text-[#FFFFFF] tabular-nums">
                            {reportComputation.grandTotal.roas}x ROAS
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#F8FAFC] tabular-nums">
                          {reportComputation.grandTotal.conversionRate}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* 4. COLLAPSIBLE TABULAR DRILL-DOWN RECORDS */}
              <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-[#059669]" />
                    <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                      السجلات التفصيلية المرتبطة بالتقرير (Tabular Drill-Down Records —{' '}
                      {reportComputation.drilldownRows.length} سجل)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedDrilldown((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    <span>{expandedDrilldown ? 'طي جدول السجلات' : 'عرض السجلات التفصيلية'}</span>
                    {expandedDrilldown ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {expandedDrilldown && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-extrabold text-[#64748B]">
                          <th className="py-2.5 px-4">المعرف الدائم</th>
                          <th className="py-2.5 px-3">الصفقة / العميل</th>
                          <th className="py-2.5 px-3">المنشأة</th>
                          <th className="py-2.5 px-3">المصدر الأول (First-Touch)</th>
                          <th className="py-2.5 px-3">القناة الحاسمة (Last-Touch)</th>
                          <th className="py-2.5 px-3 text-center">نقاط التماس</th>
                          <th className="py-2.5 px-3">قيمة First-Touch</th>
                          <th className="py-2.5 px-4">قيمة Last-Touch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                        {reportComputation.drilldownRows.slice(0, 10).map((rec) => (
                          <tr key={rec.id} className="hover:bg-[#F8FAFC]">
                            <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-[#2563EB]">
                              <Link to={rec.entityLink} className="hover:underline">
                                {rec.uniqueCode}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                              <Link
                                to={rec.entityLink}
                                className="hover:text-[#2563EB] transition-colors"
                              >
                                {rec.recordTitle}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-[#475569]">{rec.companyName}</td>
                            <td className="py-2.5 px-3 text-[11px] font-semibold text-[#2563EB]">
                              {rec.firstTouchSource}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-semibold text-[#059669]">
                              {rec.lastTouchChannel}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums">
                              {rec.touchpointsCount}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#2563EB] tabular-nums">
                              {formatCurrencySAR(rec.firstTouchValue)}
                            </td>
                            <td className="py-2.5 px-4 font-extrabold text-[#059669] tabular-nums">
                              {formatCurrencySAR(rec.lastTouchValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3-STEP REPORT BUILDER MODAL ("+ إنشاء تقرير جديد" & "تخصيص Customize")   */}
      {/* ========================================================================= */}
      {builderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="zoho-report-builder-title"
        >
          <div
            dir="rtl"
            className="w-full max-w-3xl rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    id="zoho-report-builder-title"
                    className="text-[16px] font-extrabold text-[#0F172A]"
                  >
                    {builderEditMode
                      ? `تخصيص التقرير: ${activeReport.title}`
                      : 'منشئ التقارير المخصصة (3-Step Zoho Report Builder)'}
                  </h3>
                  <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
                    الخطوة {builderStep} من 3
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  1. اختيار الموديول الأساسي والموديول المرتبط ← 2. نوع التقرير والأعمدة ← 3. التجميع والفلاتر
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuilderModalOpen(false)}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0]/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-3 border-b border-[#E2E8F0] bg-[#FFFFFF] text-[12px] font-bold">
              {[
                { step: 1 as const, label: '1. الموديول الأساسي والمرتبط' },
                { step: 2 as const, label: '2. نوع التقرير والأعمدة (Tabular | Summary | Matrix)' },
                { step: 3 as const, label: '3. التجميع والفلاتر والحفظ' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setBuilderStep(s.step)}
                  className={`py-3 px-4 border-b-2 text-right transition-colors cursor-pointer ${
                    builderStep === s.step
                      ? 'border-[#2563EB] bg-[#EFF6FF]/50 text-[#2563EB] font-extrabold'
                      : 'border-transparent text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveBuilderReport} className="flex-1 overflow-y-auto p-6 space-y-5">
              {builderStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-extrabold text-[#0F172A] mb-2">
                      اختر الموديول الأساسي (Primary Module):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        'العملاء المحتملين (Leads)',
                        'الصفقات والمبيعات (Deals)',
                        'جهات الاتصال (Contacts)',
                        'الشركات والحسابات (Accounts)',
                      ].map((mod) => (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => setBuilderPrimaryModule(mod)}
                          className={`rounded-xl border p-3 text-right text-[12px] font-bold transition-all cursor-pointer ${
                            builderPrimaryModule === mod
                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] shadow-2xs'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:bg-[#FFFFFF]'
                          }`}
                        >
                          {mod}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-extrabold text-[#0F172A] mb-2">
                      اختر الموديولات المرتبطة للدمج (Related Modules — مثل touchpoints / deals):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        'نقاط التماس (touchpoints)',
                        'الصفقات (deals)',
                        'سجل رسائل واتساب (messages)',
                        'حملات ميتا التسويقية (campaigns)',
                      ].map((rel) => {
                        const checked = builderRelatedModules.includes(rel);
                        return (
                          <label
                            key={rel}
                            className={`flex items-center gap-2.5 rounded-xl border p-3 text-[12px] font-bold cursor-pointer ${
                              checked
                                ? 'border-[#059669] bg-[#ECFDF5]/60 text-[#065F46]'
                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBuilderRelatedModules((prev) =>
                                  checked
                                    ? prev.filter((i) => i !== rel)
                                    : [...prev, rel]
                                )
                              }
                              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                            />
                            <span>{rel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
                    <p className="text-[12px] font-extrabold text-[#0F172A]">
                      نوع ربط السجلات (Relationship Join Type):
                    </p>
                    <div className="flex flex-wrap gap-4 text-[12px]">
                      <label className="inline-flex items-center gap-2 font-semibold text-[#334155] cursor-pointer">
                        <input
                          type="radio"
                          name="joinType"
                          checked={builderJoinType === 'inclusive'}
                          onChange={() => setBuilderJoinType('inclusive')}
                        />
                        <span>شامل كافة السجلات الأساسية (Inclusive / Left Join)</span>
                      </label>
                      <label className="inline-flex items-center gap-2 font-semibold text-[#334155] cursor-pointer">
                        <input
                          type="radio"
                          name="joinType"
                          checked={builderJoinType === 'inner'}
                          onChange={() => setBuilderJoinType('inner')}
                        />
                        <span>السجلات المرتبطة بنقاط التماس والصفقات فقط (Inner Join)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {builderStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-extrabold text-[#0F172A] mb-2">
                      اختر هيكل ونوع التقرير (Report Type):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          type: 'Summary' as const,
                          title: 'Summary (تلخيصي)',
                          desc: 'تجميع السجلات مع المجاميع الفرعية Subtotals والمجموع الكلي والرسوم البيانية',
                        },
                        {
                          type: 'Tabular' as const,
                          title: 'Tabular (جدولي)',
                          desc: 'عرض جدولي مباشر لكافة السجلات مع الإجمالي السفلي وتصدير CSV',
                        },
                        {
                          type: 'Matrix' as const,
                          title: 'Matrix (مصفوفة 2D)',
                          desc: 'تقاطع الصفوف والأعمدة لمقارنة القنوات عبر الأشهر والمراحل',
                        },
                      ].map((rt) => (
                        <button
                          key={rt.type}
                          type="button"
                          onClick={() => setBuilderReportType(rt.type)}
                          className={`rounded-xl border p-3.5 text-right transition-all cursor-pointer ${
                            builderReportType === rt.type
                              ? 'border-[#2563EB] bg-[#EFF6FF] shadow-2xs'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF]'
                          }`}
                        >
                          <p className="text-[13px] font-extrabold text-[#0F172A]">
                            {rt.title}
                          </p>
                          <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                            {rt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-extrabold text-[#0F172A] mb-2">
                      الأعمدة المختارة في التقرير ({builderSelectedCols.length} أعمدة):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                      {AVAILABLE_BUILDER_COLUMNS.map((col) => {
                        const checked = builderSelectedCols.includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] px-3 py-2 text-[11px] font-bold text-[#0F172A] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBuilderSelectedCols((prev) =>
                                  checked
                                    ? prev.filter((c) => c !== col.id)
                                    : [...prev, col.id]
                                )
                              }
                              className="h-3.5 w-3.5 rounded text-[#2563EB]"
                            />
                            <span>{col.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {builderStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                        اسم التقرير *
                      </label>
                      <input
                        type="text"
                        required
                        value={builderTitle}
                        onChange={(e) => setBuilderTitle(e.target.value)}
                        placeholder="مثال: تقرير إسناد المصادر Multi-Touch Attribution"
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                        حفظ في المجلد
                      </label>
                      <select
                        value={builderFolder}
                        onChange={(e) =>
                          setBuilderFolder(
                            e.target.value as Exclude<ReportFolderKey, 'all' | 'favorites'>
                          )
                        }
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                      >
                        <option value="meta_attribution">تقارير ميتا وAttribution</option>
                        <option value="deals_reports">تقارير الصفقات</option>
                        <option value="leads_reports">تقارير العملاء</option>
                        <option value="scheduled">التقارير المجدولة</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                        التجميع حسب (Group By)
                      </label>
                      <select
                        value={builderGroupBy}
                        onChange={(e) =>
                          setBuilderGroupBy(e.target.value as 'channel' | 'stage' | 'rep')
                        }
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                      >
                        <option value="channel">القناة والمصدر الإعلاني</option>
                        <option value="stage">مرحلة الصفقة البيعية</option>
                        <option value="rep">مسؤول المبيعات</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                        نطاق التاريخ (Date Filter)
                      </label>
                      <input
                        type="text"
                        value={builderDateRange}
                        onChange={(e) => setBuilderDateRange(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                        الحد الأدنى لقيمة الصفقة (ر.س)
                      </label>
                      <input
                        type="number"
                        value={builderMinAmount}
                        onChange={(e) => setBuilderMinAmount(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                      وصف التقرير
                    </label>
                    <input
                      type="text"
                      value={builderDesc}
                      onChange={(e) => setBuilderDesc(e.target.value)}
                      placeholder="وصف مختصر لهدف التقرير والمؤشرات التي يقيسها..."
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[12px] text-[#0F172A]"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Navigation */}
              <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
                <div>
                  {builderStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setBuilderStep((prev) => (prev - 1) as 1 | 2 | 3)}
                      className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      السابق
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBuilderModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-[12px] font-bold text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
                  >
                    إلغاء
                  </button>

                  {builderStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setBuilderStep((prev) => (prev + 1) as 1 | 2 | 3)}
                      className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-bold text-[#FFFFFF] cursor-pointer"
                    >
                      الخطوة التالية ←
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] px-5 py-2 text-[12px] font-bold text-[#FFFFFF] cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>حفظ وتشغيل التقرير الآن</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCHEDULE REPORT MODAL                                                     */}
      {/* ========================================================================= */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                جدولة إرسال التقرير تلقائياً
              </h3>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    التكرار
                  </label>
                  <select
                    value={scheduleFreq}
                    onChange={(e) =>
                      setScheduleFreq(e.target.value as 'daily' | 'weekly' | 'monthly')
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                  >
                    <option value="daily">يومياً</option>
                    <option value="weekly">أسبوعياً</option>
                    <option value="monthly">شهرياً</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    وقت الإرسال
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  المستلمون (البريد الإلكتروني)
                </label>
                <input
                  type="text"
                  required
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  صيغة التصدير
                </label>
                <div className="flex gap-2">
                  {(['CSV', 'PDF'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setScheduleFormat(fmt)}
                      className={`flex-1 rounded-xl border py-2 text-[12px] font-bold cursor-pointer ${
                        scheduleFormat === fmt
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-[#64748B]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-bold text-[#FFFFFF] cursor-pointer"
                >
                  حفظ الجدولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
