import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  MessageSquare,
  Pin,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { formatCurrencySAR } from '../utils/formatters';
import {
  getPinnedReportsForOrg,
  PINNED_REPORTS_EVENT,
  type PinnedReportWidget,
  savePinnedReportsForOrg,
} from '../utils/pinnedReportsStorage';
import { InteractionHeatmap } from '../components/dashboard/InteractionHeatmap';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentOrgId,
    deals,
    leads,
    tasks,
    invoices,
    quotes,
    salesOrders,
    messages,
    toggleTaskStatus,
  } = useCrm();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [dashboardRole, setDashboardRole] = useState<'ceo' | 'sales' | 'marketing'>('ceo');
  const [funnelTab, setFunnelTab] = useState<'funnel' | 'revenue'>('funnel');
  const [taskTab, setTaskTab] = useState<'all' | 'urgent' | 'deals' | 'calls'>('all');

  const [pinnedReports, setPinnedReports] = useState<PinnedReportWidget[]>(() =>
    getPinnedReportsForOrg(currentOrgId)
  );
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [widgetVisibility, setWidgetVisibility] = useState({
    kpis: true,
    funnelAndMeta: true,
    pinnedReports: true,
    heatmap: false,
    tasksAndInbox: true,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncPinned = () => {
      setPinnedReports(getPinnedReportsForOrg(currentOrgId));
    };
    syncPinned();
    window.addEventListener(PINNED_REPORTS_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_REPORTS_EVENT, syncPinned);
  }, [currentOrgId]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const handleUnpinReport = (reportId: string) => {
    const next = pinnedReports.filter((r) => r.reportId !== reportId);
    savePinnedReportsForOrg(currentOrgId, next);
    setPinnedReports(next);
    setToastMessage('تم إزالة التقرير المثبت من لوحة القيادة.');
  };

  const wonDeals = useMemo(() => deals.filter((d) => d.stage === 'مكتملة'), [deals]);
  const activePipelineDeals = useMemo(
    () => deals.filter((d) => d.stage !== 'مكتملة' && d.stage !== 'خسارة'),
    [deals]
  );

  const handleExportDashboardCsv = () => {
    const wonSum = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const csv =
      '\uFEFF' +
      [
        ['المؤشر', 'القيمة'],
        ['إجمالي المبيعات المغلقة (ر.س)', String(wonSum)],
        ['صفقات قيد التفاوض النشطة', String(activePipelineDeals.length)],
        ['عملاء جدد (Leads)', String(leads.length)],
        ['الفواتير الضريبية المصدرة', String(invoices.length)],
      ]
        .map((r) => r.join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwaq-executive-dashboard-${currentOrgId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('تم تصدير تقرير لوحة القيادة التنفيذية بصيغة CSV بنجاح.');
  };

  const openTasksCount = useMemo(
    () => tasks.filter((t) => t.status !== 'مكتملة').length,
    [tasks]
  );

  const dateMultiplier =
    dateRange === 'today'
      ? 0.25
      : dateRange === 'week'
        ? 0.6
        : dateRange === 'month'
          ? 1
          : 1;

  const activeKpis = useMemo(() => {
    const rawWonAmount = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const rawPaidInvoices = invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
    const baseWonAmount = Math.max(rawWonAmount, rawPaidInvoices);
    const rawPipelineAmount = activePipelineDeals.reduce((s, d) => s + (d.amount || 0), 0);

    const wonAmount = Math.round(baseWonAmount * dateMultiplier);
    const pipelineAmount = Math.round(rawPipelineAmount * dateMultiplier);
    const dealsCount = activePipelineDeals.length;
    const leadsCount = leads.length;

    const winRatePct =
      deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 1000) / 10 : 0;

    const waLeadsCount = leads.filter((l) => l.channel === 'whatsapp').length;
    const igLeadsCount = leads.filter((l) => l.channel === 'instagram').length;
    const fbLeadsCount = leads.filter((l) => l.channel === 'messenger').length;

    const quoteStageCount = deals.filter((d) => d.stage === 'عرض سعر').length;
    const negotiationStageCount = deals.filter((d) => d.stage === 'تفاوض').length;
    const qualifyingStageCount = deals.filter(
      (d) => d.stage === 'تأهيل مبدئي' || d.stage === 'تحديد الاحتياج'
    ).length;

    const orgTarget = 2000000;
    const targetPct = orgTarget > 0 ? Math.min(100, Math.round((wonAmount / orgTarget) * 100)) : 0;
    const remainingTarget = Math.max(0, orgTarget - wonAmount);

    if (dashboardRole === 'sales') {
      return [
        {
          label: 'إجمالي مبيعات الفريق المغلقة',
          value: formatCurrencySAR(wonAmount),
          trend: wonAmount > 0 ? `▲ ${wonDeals.length} صفقة مغلقة` : 'بانتظار إغلاق أول صفقة',
          subRight: `${quotes.length} عرض سعر`,
          footerLeft: `أوامر البيع: ${salesOrders.length}`,
          footerRight: `الفواتير: ${invoices.length}`,
          icon: 'dollar' as const,
        },
        {
          label: 'الصفقات النشطة في خط الأنابيب',
          value: `${dealsCount} صفقة`,
          trend: dealsCount > 0 ? `${qualifyingStageCount} قيد التأهيل` : 'لا توجد صفقات نشطة',
          subRight: formatCurrencySAR(pipelineAmount),
          footerLeft: `${quoteStageCount} عرض سعر • ${negotiationStageCount} تفاوض مالي • ${wonDeals.length} إغلاق`,
          footerRight: '',
          icon: 'briefcase' as const,
        },
        {
          label: 'معدل إغلاق العروض (Win Rate)',
          value: `${winRatePct}%`,
          trend: deals.length > 0 ? `من إجمالي ${deals.length} صفقة` : '0 صفقة مسجلة',
          subRight: `عروض الأسعار: ${quotes.length}`,
          footerLeft: `الصفقات الرابحة: ${wonDeals.length}`,
          footerRight: '',
          icon: 'users' as const,
        },
        {
          label: 'المهام والمتابعات النشطة',
          value: `${openTasksCount} مهمة`,
          trend: tasks.length > 0 ? `إجمالي ${tasks.length} نشاط` : 'لا توجد مهام مجدولة',
          subRight: `مكتملة: ${tasks.length - openTasksCount}`,
          footerLeft:
            tasks.length > 0
              ? `نسبة الإنجاز: ${Math.round(((tasks.length - openTasksCount) / tasks.length) * 100)}%`
              : 'نسبة الإنجاز: 0%',
          footerRight: '',
          icon: 'clock' as const,
        },
      ];
    }

    if (dashboardRole === 'marketing') {
      return [
        {
          label: 'الإيرادات المنسوبة للحملات (Attributed)',
          value: formatCurrencySAR(wonAmount),
          trend: wonAmount > 0 ? '▲ إسناد مباشر للصفقات' : '0 ر.س إيرادات منسوبة',
          subRight: `${wonDeals.length} صفقة مغلقة`,
          footerLeft: `أوامر البيع: ${salesOrders.length}`,
          footerRight: `الفواتير: ${invoices.length}`,
          icon: 'dollar' as const,
        },
        {
          label: 'عملاء الحملات الإعلانية (Meta Leads)',
          value: `${leadsCount} عميل مهتم`,
          trend: leadsCount > 0 ? 'تدفق القنوات الرقمية' : 'لا يوجد عملاء مسجلون بعد',
          subRight: `الصفقات المرتبطة: ${deals.length}`,
          footerLeft: `واتساب (${waLeadsCount}) • إنستغرام (${igLeadsCount}) • ماسنجر (${fbLeadsCount})`,
          footerRight: '',
          icon: 'users' as const,
        },
        {
          label: 'الرسائل والمحادثات النشطة',
          value: `${messages.length} رسالة`,
          trend: messages.length > 0 ? 'مزامنة صندوق واتساب' : 'صندوق الوارد فارغ',
          subRight: `عملاء واتساب: ${waLeadsCount}`,
          footerLeft: `عروض الأسعار المرسلة: ${quotes.length}`,
          footerRight: '',
          icon: 'briefcase' as const,
        },
        {
          label: 'معدل التحويل إلى صفقات',
          value:
            leadsCount > 0
              ? `${Math.min(100, Math.round((deals.length / leadsCount) * 100))}%`
              : '0%',
          trend: leadsCount > 0 ? `${deals.length} صفقة من ${leadsCount} عميل` : 'بانتظار أول عميل',
          subRight: `معدل الفوز: ${winRatePct}%`,
          footerLeft: `صفقات مكتملة: ${wonDeals.length}`,
          footerRight: '',
          icon: 'clock' as const,
        },
      ];
    }

    return [
      {
        label: 'إجمالي المبيعات المغلقة',
        value: formatCurrencySAR(wonAmount),
        trend: wonAmount > 0 ? `▲ ${wonDeals.length} صفقة مكتملة` : 'بانتظار أول صفقة مغلقة',
        subRight: `${targetPct}% من الهدف`,
        footerLeft: `الهدف: ${formatCurrencySAR(orgTarget)}`,
        footerRight: `المتبقي: ${formatCurrencySAR(remainingTarget)}`,
        icon: 'dollar' as const,
      },
      {
        label: 'صفقات قيد التفاوض النشطة',
        value: `${dealsCount} صفقة`,
        trend: deals.length > 0 ? `إجمالي ${deals.length} صفقة بالنظام` : 'لا توجد صفقات نشطة',
        subRight: formatCurrencySAR(pipelineAmount),
        footerLeft: `${quoteStageCount} عرض سعر • ${negotiationStageCount} تفاوض مالي • ${qualifyingStageCount} تأهيل`,
        footerRight: '',
        icon: 'briefcase' as const,
      },
      {
        label: 'عملاء جدد (Attribution)',
        value: `${leadsCount} عميل مهتم`,
        trend: leadsCount > 0 ? 'حسب قنوات الاستقطاب' : 'لا يوجد عملاء محتملون بعد',
        subRight: 'توزيع القنوات:',
        footerLeft: `واتساب (${waLeadsCount}) • إنستغرام (${igLeadsCount}) • ماسنجر (${fbLeadsCount})`,
        footerRight: '',
        icon: 'users' as const,
      },
      {
        label: 'المهام والرسائل النشطة',
        value: `${openTasksCount} مهمة`,
        trend:
          messages.length > 0
            ? `${messages.length} رسالة في صندوق الوارد`
            : 'لا توجد رسائل جديدة',
        subRight: `الفواتير: ${invoices.length}`,
        footerLeft: `عروض الأسعار: ${quotes.length} • أوامر البيع: ${salesOrders.length}`,
        footerRight: '',
        icon: 'clock' as const,
      },
    ];
  }, [
    activePipelineDeals,
    dashboardRole,
    dateMultiplier,
    deals,
    invoices,
    leads,
    messages.length,
    openTasksCount,
    quotes.length,
    salesOrders.length,
    tasks.length,
    wonDeals,
  ]);

  // Dynamic Sales Funnel stages for the active organization
  const funnelStages = useMemo(() => {
    const qualifying = deals.filter(
      (d) => d.stage === 'تأهيل مبدئي' || d.stage === 'تحديد الاحتياج'
    );
    const proposal = deals.filter((d) => d.stage === 'عرض سعر');
    const negotiation = deals.filter((d) => d.stage === 'تفاوض');
    const won = deals.filter((d) => d.stage === 'مكتملة');

    const sumAmount = (list: typeof deals) => list.reduce((s, d) => s + (d.amount || 0), 0);
    const totalDealsCount = Math.max(1, deals.length);

    return [
      {
        title: '1. استقطاب ومؤهل أولي (Qualified)',
        count: qualifying.length,
        amount: sumAmount(qualifying),
        widthPct: deals.length > 0 ? Math.max(8, Math.round((qualifying.length / totalDealsCount) * 100)) : 0,
        colorClass: 'bg-[#2563EB]',
        textClass: 'text-[#0F172A]',
      },
      {
        title: '2. تقديم العرض الفني والمالي (Proposal)',
        count: proposal.length,
        amount: sumAmount(proposal),
        widthPct: deals.length > 0 ? Math.max(8, Math.round((proposal.length / totalDealsCount) * 100)) : 0,
        colorClass: 'bg-[#2563EB]',
        textClass: 'text-[#0F172A]',
      },
      {
        title: '3. مرحلة التفاوض والاعتماد (Negotiation)',
        count: negotiation.length,
        amount: sumAmount(negotiation),
        widthPct: deals.length > 0 ? Math.max(8, Math.round((negotiation.length / totalDealsCount) * 100)) : 0,
        colorClass: 'bg-[#2563EB]',
        textClass: 'text-[#0F172A]',
      },
      {
        title: '4. أوامر البيع المعتمدة (Sales Orders)',
        count: salesOrders.length,
        amount: salesOrders.reduce((s, o) => s + (o.totalAmount || 0), 0),
        widthPct:
          salesOrders.length > 0
            ? Math.min(100, Math.max(10, Math.round((salesOrders.length / totalDealsCount) * 100)))
            : 0,
        colorClass: 'bg-[#2563EB]',
        textClass: 'text-[#0F172A]',
      },
      {
        title: '5. صفقات مغلقة بنجاح (Closed Won)',
        count: won.length,
        amount: sumAmount(won),
        widthPct: deals.length > 0 ? Math.max(8, Math.round((won.length / totalDealsCount) * 100)) : 0,
        colorClass: 'bg-[#10B981]',
        textClass: 'text-[#10B981]',
      },
    ];
  }, [deals, salesOrders]);

  // Dynamic Revenue Collection metrics from active organization's invoices
  const revenueSummary = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
    const totalCollected = invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
    const totalPending = Math.max(0, totalInvoiced - totalCollected);
    const collectionPct =
      totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 1000) / 10 : 0;
    return {
      totalInvoiced,
      totalCollected,
      totalPending,
      collectionPct,
    };
  }, [invoices]);

  // Dynamic Meta channel stats from active organization's leads & deals
  const metaStats = useMemo(() => {
    const totalWonRev = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const waLeads = leads.filter((l) => l.channel === 'whatsapp').length;
    const igLeads = leads.filter((l) => l.channel === 'instagram').length;
    const fbLeads = leads.filter((l) => l.channel === 'messenger').length;
    const totalChannelLeads = Math.max(1, waLeads + igLeads + fbLeads);

    const waRev = leads.length > 0 ? Math.round(totalWonRev * (waLeads / totalChannelLeads)) : 0;
    const igRev = leads.length > 0 ? Math.round(totalWonRev * (igLeads / totalChannelLeads)) : 0;
    const fbRev = Math.max(0, totalWonRev - waRev - igRev);

    const waLeadIds = new Set(
      leads.filter((l) => l.channel === 'whatsapp').map((l) => l.unique_id)
    );
    const igLeadIds = new Set(
      leads.filter((l) => l.channel === 'instagram').map((l) => l.unique_id)
    );
    const fbLeadIds = new Set(
      leads.filter((l) => l.channel === 'messenger').map((l) => l.unique_id)
    );

    const waDeals = deals.filter((d) => d.leadUniqueId && waLeadIds.has(d.leadUniqueId)).length;
    const igDeals = deals.filter((d) => d.leadUniqueId && igLeadIds.has(d.leadUniqueId)).length;
    const fbDeals = deals.filter((d) => d.leadUniqueId && fbLeadIds.has(d.leadUniqueId)).length;

    return {
      wa: {
        revenue: waRev,
        leads: waLeads,
        deals: waDeals,
        convPct: waLeads > 0 ? Math.min(100, Math.round((waDeals / waLeads) * 1000) / 10) : 0,
      },
      ig: {
        revenue: igRev,
        leads: igLeads,
        deals: igDeals,
        convPct: igLeads > 0 ? Math.min(100, Math.round((igDeals / igLeads) * 1000) / 10) : 0,
      },
      fb: {
        revenue: fbRev,
        leads: fbLeads,
        deals: fbDeals,
        convPct: fbLeads > 0 ? Math.min(100, Math.round((fbDeals / fbLeads) * 1000) / 10) : 0,
      },
      roas: totalWonRev > 0 ? Number((totalWonRev / Math.max(1, totalWonRev * 0.18)).toFixed(1)) : 0,
    };
  }, [deals, leads, wonDeals]);

  // Dynamic Tasks filtering for Urgent Tasks card
  const taskCounts = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'مكتملة');
    const urgent = open.filter((t) => t.priority === 'عالية');
    const dealTasks = open.filter(
      (t) =>
        t.title.includes('صفقة') ||
        t.title.includes('عرض') ||
        t.title.includes('عقد') ||
        Boolean(t.leadUniqueId)
    );
    const callTasks = open.filter(
      (t) => t.title.includes('مكالمة') || t.title.includes('اتصال') || t.title.includes('اجتماع')
    );
    return {
      all: open.length,
      urgent: urgent.length,
      deals: dealTasks.length,
      calls: callTasks.length,
      filtered:
        taskTab === 'urgent'
          ? urgent
          : taskTab === 'deals'
            ? dealTasks
            : taskTab === 'calls'
              ? callTasks
              : open,
    };
  }, [tasks, taskTab]);

  // Dynamic Inbound WhatsApp Messages for active organization
  const inboundMessages = useMemo(
    () => messages.filter((m) => m.direction === 'inbound'),
    [messages]
  );

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-5 bg-[#F8FAFC] min-h-screen text-[13px]">
      {/* Top Header & Toolbar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>رواق CRM</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">لوحة القيادة التنفيذية والمبيعات</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-bold text-[#0F172A]">
                لوحة القيادة التنفيذية والمبيعات
              </h1>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                مباشر الآن
              </span>
              <select
                value={dashboardRole}
                onChange={(e) => setDashboardRole(e.target.value as any)}
                className="px-3 py-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] focus:outline-none"
              >
                <option value="ceo">لوحة المدير التنفيذي (CEO Dashboard)</option>
                <option value="sales">لوحة المبيعات (Sales Dashboard)</option>
                <option value="marketing">لوحة التسويق (Marketing Dashboard)</option>
              </select>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              متابعة فورية للأداء المالي، خطط الصفقات، وتوزيع مصادر العملاء عبر القنوات للمؤسسة النشطة ({currentOrgId}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => setDateRange('today')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateRange === 'today' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setDateRange('week')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateRange === 'week' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setDateRange('month')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateRange === 'month' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                هذا الشهر (محدد)
              </button>
              <button
                type="button"
                onClick={() => setDateRange('custom')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateRange === 'custom' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                تخصيص التاريخ
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCustomizerOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
              تخصيص اللوحة
            </button>
            <button
              type="button"
              onClick={handleExportDashboardCsv}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير التقرير
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs font-bold text-[#065F46] shadow-2xs">
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

      {/* Top 4 KPI Summary Cards */}
      {widgetVisibility.kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {activeKpis.map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">{kpi.label}</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    kpi.icon === 'dollar'
                      ? 'bg-[#ECFDF5] text-[#10B981]'
                      : kpi.icon === 'briefcase'
                        ? 'bg-[#EFF6FF] text-[#2563EB]'
                        : kpi.icon === 'users'
                          ? 'bg-[#F5F3FF] text-[#7C3AED]'
                          : 'bg-[#FEF3C7] text-[#B45309]'
                  }`}
                >
                  {kpi.icon === 'dollar' && <DollarSign className="w-4 h-4" />}
                  {kpi.icon === 'briefcase' && <Briefcase className="w-4 h-4" />}
                  {kpi.icon === 'users' && <Users className="w-4 h-4" />}
                  {kpi.icon === 'clock' && <Clock className="w-4 h-4" />}
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">
                {kpi.value}
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
                <span className="text-[#10B981] font-bold">{kpi.trend}</span>
                <span className="text-[#0F172A] font-bold tabular-nums">{kpi.subRight}</span>
              </div>
              <div className="text-[11px] text-[#64748B] flex items-center justify-between tabular-nums truncate">
                <span className="truncate">{kpi.footerLeft}</span>
                {kpi.footerRight && <span>{kpi.footerRight}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Middle Row: Right (60%) Funnel & Left (40%) Meta Channels */}
      {widgetVisibility.funnelAndMeta && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Right Column (60% - 7 cols) - Sales Funnel */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  قمع مبيعات الصفقات والإيرادات (Sales Funnel &amp; Revenue)
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  تحويل مراحل Pipeline ومتابعة تحصيل الفواتير الضريبية
                </span>
              </div>
              <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFunnelTab('funnel')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    funnelTab === 'funnel'
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#64748B]'
                  }`}
                >
                  مراحل القمع البيعي
                </button>
                <button
                  type="button"
                  onClick={() => setFunnelTab('revenue')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    funnelTab === 'revenue'
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#64748B]'
                  }`}
                >
                  تحصيل الإيرادات
                </button>
              </div>
            </div>

            {funnelTab === 'funnel' ? (
              deals.length === 0 && salesOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center space-y-2">
                  <p className="text-xs font-bold text-[#0F172A]">
                    لا توجد صفقات مسجلة في قمع المبيعات لهذه المؤسسة حالياً
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    ابدأ بإضافة صفقة جديدة من وحدة الصفقات لتظهر مراحل القمع البيعي والإيرادات فوراً.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/deals')}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صفقة جديدة
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {funnelStages.map((st, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[#0F172A]">
                        <span className={`font-bold ${st.textClass}`}>{st.title}</span>
                        <span className={`font-bold tabular-nums ${st.textClass}`}>
                          {st.count} صفقة · {formatCurrencySAR(st.amount)}
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div
                          className={`h-full ${st.colorClass} rounded-full transition-all`}
                          style={{ width: `${st.widthPct}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="text-[11px] font-bold text-[#64748B]">
                      إجمالي الفواتير المصدرة (ZATCA)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-[#0F172A] tabular-nums">
                      {formatCurrencySAR(revenueSummary.totalInvoiced)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold text-[#2563EB]">
                      {invoices.length} فاتورة ضريبية معتمدة
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3">
                    <div className="text-[11px] font-bold text-[#065F46]">الإيرادات المحصلة فعلياً</div>
                    <div className="mt-1 text-base font-extrabold text-[#059669] tabular-nums">
                      {formatCurrencySAR(revenueSummary.totalCollected)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold text-[#047857]">
                      نسبة التحصيل: {revenueSummary.collectionPct}% ✓
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3">
                    <div className="text-[11px] font-bold text-[#92400E]">مستحقات قيد التحصيل</div>
                    <div className="mt-1 text-base font-extrabold text-[#D97706] tabular-nums">
                      {formatCurrencySAR(revenueSummary.totalPending)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold text-[#B45309]">
                      {revenueSummary.totalPending > 0
                        ? 'مجدولة للسداد حسب شروط الدفع'
                        : 'لا توجد متأخرات مستحقة'}
                    </div>
                  </div>
                </div>

                {invoices.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-[#64748B]">
                    لا توجد فواتير ضريبية مصدرة لهذه المؤسسة بعد.
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {invoices.slice(0, 4).map((inv) => {
                      const paidPct =
                        inv.totalAmount > 0
                          ? Math.round(((inv.paidAmount || 0) / inv.totalAmount) * 100)
                          : 0;
                      return (
                        <div
                          key={inv.id}
                          onClick={() => navigate('/invoices')}
                          className="cursor-pointer rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 hover:border-[#2563EB] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#2563EB]">
                                {inv.invoiceNumber}
                              </span>
                              <span className="font-bold text-[#0F172A]">{inv.accountName}</span>
                            </div>
                            <span className="font-bold text-[#0F172A] tabular-nums">
                              {formatCurrencySAR(inv.totalAmount)} ({paidPct}% محصل)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
              <span>ملخص الدورة المستندية للمؤسسة:</span>
              <span className="tabular-nums font-semibold text-[#0F172A]">
                عروض الأسعار: {quotes.length} • أوامر البيع: {salesOrders.length} • الفواتير: {invoices.length}
              </span>
            </div>
          </div>

          {/* Left Column (40% - 5 cols) - Meta Channels & ROAS */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  أداء قنوات ميتا المباشرة (WhatsApp, Instagram &amp; Messenger)
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  مزامنة فورية للمحادثات والعملاء
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                مباشر API
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#059669]" />
                    واتساب للأعمال (WhatsApp Business)
                  </span>
                  <span className="font-mono text-emerald-700 tabular-nums">
                    {formatCurrencySAR(metaStats.wa.revenue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  نشط وفوري • {metaStats.wa.leads} عميل محتمل • {metaStats.wa.deals} صفقة مرتبطة
                </div>
                <div className="text-[10px] text-[#10B981] font-bold">
                  نسبة التحويل: {metaStats.wa.convPct}%
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2563EB]" />
                    إنستغرام دايركت (Instagram Direct)
                  </span>
                  <span className="font-mono text-[#2563EB] tabular-nums">
                    {formatCurrencySAR(metaStats.ig.revenue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  حملات التفاعل • {metaStats.ig.leads} عميل محتمل • {metaStats.ig.deals} صفقة مرتبطة
                </div>
                <div className="text-[10px] text-[#2563EB] font-bold">
                  نسبة التحويل: {metaStats.ig.convPct}%
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
                    ماسنجر فيسبوك (Facebook Messenger)
                  </span>
                  <span className="font-mono text-[#7C3AED] tabular-nums">
                    {formatCurrencySAR(metaStats.fb.revenue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  إعلانات Lead Gen • {metaStats.fb.leads} عميل محتمل • {metaStats.fb.deals} صفقة مرتبطة
                </div>
                <div className="text-[10px] text-[#7C3AED] font-bold">
                  نسبة التحويل: {metaStats.fb.convPct}%
                </div>
              </div>
            </div>

            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#1E40AF]">
                  عائد الإنفاق الإعلاني (ROAS): {metaStats.roas}x
                </span>
                <div className="text-[11px] text-[#1D4ED8] mt-0.5">
                  بفضل الإسناد المباشر والمحادثات المؤتمتة لرواق CRM
                </div>
              </div>
              <Sparkles className="w-6 h-6 text-[#2563EB]" />
            </div>
          </div>
        </div>
      )}

      {/* Pinned Reports from ReportsPage (/reports) */}
      {widgetVisibility.pinnedReports && pinnedReports.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#0F172A]">
                التقارير المثبتة من مركز التقارير (Pinned Reports)
              </h3>
            </div>
            <Link
              to="/reports"
              className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>فتح مركز التقارير الكامل ←</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinnedReports.map((pin) => (
              <div
                key={pin.id}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#2563EB]">
                      {pin.folderLabel} · {pin.reportType === 'summary' ? 'تلخيصي' : 'جدولي'}
                    </span>
                    <Link
                      to="/reports"
                      className="block text-xs font-extrabold text-[#0F172A] hover:text-[#2563EB] mt-0.5"
                    >
                      {pin.title}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnpinReport(pin.reportId)}
                    title="إلغاء تثبيت التقرير"
                    className="p-1 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2E8F0] text-[11px]">
                  <div>
                    <span className="text-[#64748B] block">First-Touch</span>
                    <strong className="font-mono text-[#2563EB] tabular-nums">
                      {formatCurrencySAR(pin.firstTouchRevenue)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Last-Touch</span>
                    <strong className="font-mono text-[#059669] tabular-nums">
                      {formatCurrencySAR(pin.lastTouchRevenue)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">عائد ROAS</span>
                    <strong className="font-mono text-[#0F172A] tabular-nums">
                      {pin.roas}x ({pin.totalDeals} صفقة)
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional InteractionHeatmap widget (toggleable in Customize Drawer) */}
      {widgetVisibility.heatmap && <InteractionHeatmap />}

      {/* Bottom Row: Right (Tasks) & Left (Unread Messages) */}
      {widgetVisibility.tasksAndInbox && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Right Column (58% - 7 cols) - Urgent Tasks */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  مهامي العاجلة اليوم (Urgent Tasks &amp; Follow-ups)
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  أولوية الإغلاق والتواصل المباشر مع الحسابات ({openTasksCount} نشطة)
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/activities')}
                className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + إضافة مهمة
              </button>
            </div>

            {/* Task Tabs */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTaskTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  taskTab === 'all'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                الكل ({taskCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setTaskTab('urgent')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  taskTab === 'urgent'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                عاجل جداً ({taskCounts.urgent})
              </button>
              <button
                type="button"
                onClick={() => setTaskTab('deals')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  taskTab === 'deals'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                متابعة صفقات ({taskCounts.deals})
              </button>
              <button
                type="button"
                onClick={() => setTaskTab('calls')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  taskTab === 'calls'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                مكالمات مجدولة ({taskCounts.calls})
              </button>
            </div>

            {taskCounts.filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center space-y-1.5">
                <p className="text-xs font-bold text-[#0F172A]">
                  لا توجد مهام نشطة في هذا التصنيف حالياً
                </p>
                <p className="text-[11px] text-[#64748B]">
                  جميع المهام المجدولة لهذه المؤسسة مكتملة أو لم تتم إضافة مهام بعد.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {taskCounts.filtered.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            t.priority === 'عالية'
                              ? 'bg-rose-100 text-rose-700'
                              : t.priority === 'متوسطة'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {t.priority === 'عالية' ? 'عاجل جداً' : t.priority}
                        </span>
                        <span className="font-bold text-[#0F172A]">{t.title}</span>
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        الجهة: {t.relatedTo} • الموعد: {t.dueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleTaskStatus(t.id);
                          setToastMessage(`تم إتمام المهمة: "${t.title}" بنجاح.`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold cursor-pointer"
                      >
                        إتمام ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Left Column (42% - 5 cols) - Unread Messages Inbox */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  أحدث رسائل العملاء الواردة (WhatsApp Inbox)
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  صندوق وارد موحد لكافة منصات التراسل المباشر
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono text-[10px] font-bold">
                {inboundMessages.length} وارد
              </span>
            </div>

            {inboundMessages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center space-y-1.5">
                <p className="text-xs font-bold text-[#0F172A]">
                  صندوق رسائل واتساب فارغ حالياً
                </p>
                <p className="text-[11px] text-[#64748B]">
                  لا توجد رسائل واردة غير مقروءة لهذه المؤسسة.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {inboundMessages.slice(0, 3).map((msg, idx) => (
                  <div
                    key={msg.id}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full font-bold flex items-center justify-center shrink-0 ${
                          idx % 2 === 0
                            ? 'bg-[#EFF6FF] text-[#2563EB]'
                            : 'bg-[#ECFDF5] text-[#059669]'
                        }`}
                      >
                        {msg.senderName.trim().charAt(0) || 'ع'}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-[#0F172A] truncate">
                          {msg.senderName}
                          {msg.companyName ? ` • ${msg.companyName}` : ''}
                        </div>
                        <p className="text-[11px] text-[#64748B] italic truncate max-w-[220px]">
                          &quot;{msg.body}&quot;
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/whatsapp-inbox')}
                      className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer shrink-0"
                    >
                      رد سريع
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/whatsapp-inbox')}
              className="w-full py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#2563EB] font-bold text-xs cursor-pointer"
            >
              فتح صندوق المحادثات الموحد ←
            </button>
          </div>
        </div>
      )}

      {/* Customize Widgets Modal/Drawer */}
      {customizerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#2563EB]" />
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  تخصيص وترتيب عناصر لوحة القيادة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomizerOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {(
                [
                  { key: 'kpis', label: 'بطاقات المؤشرات الرئيسية الأربعة (KPIs)' },
                  { key: 'funnelAndMeta', label: 'قمع المبيعات وأداء قنوات ميتا المباشرة' },
                  {
                    key: 'pinnedReports',
                    label: `التقارير المثبتة من مركز التقارير (${pinnedReports.length})`,
                  },
                  { key: 'heatmap', label: 'خريطة ذروة تفاعل العملاء عبر واتساب (Heatmap)' },
                  { key: 'tasksAndInbox', label: 'المهام العاجلة وصندوق رسائل واتساب' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 cursor-pointer"
                >
                  <span className="font-bold text-[#0F172A]">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={widgetVisibility[item.key]}
                    onChange={(e) =>
                      setWidgetVisibility((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setCustomizerOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs"
              >
                حفظ تفضيلات العرض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
