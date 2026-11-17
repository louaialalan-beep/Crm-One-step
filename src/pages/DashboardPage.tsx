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
  const { currentOrgId, deals, leads, tasks } = useCrm();

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

  const handleExportDashboardCsv = () => {
    const wonSum = deals
      .filter((d) => d.stage === 'مكتملة')
      .reduce((s, d) => s + (d.amount || 0), 0);
    const csv =
      '\uFEFF' +
      [
        ['المؤشر', 'القيمة'],
        ['إجمالي المبيعات المغلقة (ر.س)', String(Math.max(1485200, wonSum))],
        ['صفقات قيد التفاوض النشطة', String(Math.max(42, deals.length))],
        ['عملاء جدد اليوم', String(Math.max(134, leads.length))],
        ['متوسط سرعة استجابة الشات', '1.4 دقيقة'],
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
              متابعة فورية للأداء المالي، خطط الصفقات، وتوزيع مصادر العملاء عبر القنوات.
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
          {/* KPI 1 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">إجمالي المبيعات المغلقة</span>
              <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">
              1,485,200 ر.س
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#10B981] font-bold">▲ +18.4% نمو شهري</span>
              <span className="text-[#64748B]">88% من الهدف</span>
            </div>
            <div className="text-[11px] text-[#64748B] flex items-center justify-between tabular-nums">
              <span>الهدف: 1,680,000 ر.س</span>
              <span>المتبقي: 194,800 ر.س</span>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">صفقات قيد التفاوض النشطة</span>
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">42 صفقة</div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#2563EB] font-bold">+6 هذا الأسبوع</span>
              <span className="text-[#0F172A] font-mono font-bold tabular-nums">
                3,890,500 ر.س
              </span>
            </div>
            <div className="text-[10px] text-[#64748B] truncate">
              12 عرض نهائي • 18 تفاوض مالي • 12 قيد المراجعة...
            </div>
          </div>

          {/* KPI 3 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">عملاء جدد اليوم (Attribution)</span>
              <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">
              134 عميل مهتم
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#10B981] font-bold">+24% يومي ▲</span>
              <span className="text-[#64748B]">توزيع القنوات:</span>
            </div>
            <div className="text-[10px] text-[#475569] font-mono flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                واتساب (64)
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                إنستغرام (42)
              </span>
              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                ماسنجر (28)
              </span>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">متوسط سرعة استجابة الشات</span>
              <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">1.4 دقيقة</div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#10B981] font-bold">أسرع بـ 45 ثانية عن المعدل</span>
              <span className="text-[#64748B]">SLA 92.8%</span>
            </div>
            <div className="text-[10px] text-[#64748B]">حل من أول اتصال: 84%</div>
          </div>
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
                  تحويل مراحل Pipeline ومتابعة نسبة التسرب
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

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#0F172A]">
                  <span className="font-bold">1. استقطاب ومؤهل أولي (Qualified)</span>
                  <span className="font-mono font-bold tabular-nums">
                    186 صفقة · 5,420,000 ر.س
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#0F172A]">
                  <span className="font-bold">2. تقديم العرض الفني والمالي (Proposal)</span>
                  <span className="font-mono font-bold tabular-nums">
                    112 صفقة · 3,980,000 ر.س
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full"
                    style={{ width: '60.2%' }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#0F172A]">
                  <span className="font-bold">3. مرحلة التفاوض والاعتماد (Negotiation)</span>
                  <span className="font-mono font-bold tabular-nums">
                    64 صفقة · 2,450,000 ر.س
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full"
                    style={{ width: '57.1%' }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#0F172A]">
                  <span className="font-bold">4. العقود قيد التوقيع (Closing Contract)</span>
                  <span className="font-mono font-bold tabular-nums">
                    28 صفقة · 1,820,000 ر.س
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full"
                    style={{ width: '43.8%' }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#0F172A]">
                  <span className="font-bold text-[#10B981]">
                    5. صفقات مغلقة بنجاح (Closed Won)
                  </span>
                  <span className="font-mono font-bold text-[#10B981] tabular-nums">
                    22 صفقة · 1,485,200 ر.س
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] rounded-full"
                    style={{ width: '78.5%' }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
              <span>مسار الإيراد التراكمي الربع سنوي:</span>
              <span className="font-mono text-[#0F172A]">
                أكتوبر: 1.1M • نوفمبر: 1.25M • ديسمبر: 1.38M • يناير: 1.48M (الحالي)
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
                  <span className="font-mono text-emerald-700 tabular-nums">820,000 ر.س</span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  زمن الرد: 1.1 دقيقة • نشط وفوري • 420 عميل محتمل • 78 صفقة منجزة
                </div>
                <div className="text-[10px] text-[#10B981] font-bold">نسبة التحويل: 18.5%</div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2563EB]" />
                    إنستغرام دايركت (Instagram Direct)
                  </span>
                  <span className="font-mono text-[#2563EB] tabular-nums">415,200 ر.س</span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  زمن الرد: 1.8 دقيقة • حملات التفاعل • 280 عميل محتمل • 38 صفقة منجزة
                </div>
                <div className="text-[10px] text-[#2563EB] font-bold">نسبة التحويل: 13.6%</div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
                    ماسنجر فيسبوك (Facebook Messenger)
                  </span>
                  <span className="font-mono text-[#7C3AED] tabular-nums">250,000 ر.س</span>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  زمن الرد: 2.3 دقيقة • إعلانات Lead Gen • 165 عميل محتمل • 19 صفقة منجزة
                </div>
                <div className="text-[10px] text-[#7C3AED] font-bold">نسبة التحويل: 11.5%</div>
              </div>
            </div>

            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#1E40AF]">
                  عائد الإنفاق الإعلاني (ROAS): 5.4x
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
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTaskTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  taskTab === 'all'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                الكل (7)
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
                عاجل جداً (3)
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
                متابعة صفقات (2)
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
                مكالمات مجدولة (2)
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                      عاجل جداً
                    </span>
                    <span className="font-bold text-[#0F172A]">
                      متابعة توقيع العقد النهائي مع شركة أفق للتقنية
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    صفقة: 340,000 ر.س • الموعد: اليوم 1:30 م
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setToastMessage('تم إتمام المهمة وتحديث سجل الصفقة بنجاح.')}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold cursor-pointer"
                  >
                    إتمام ✓
                  </button>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">
                      متوسطة
                    </span>
                    <span className="font-bold text-[#0F172A]">
                      مكالمة ديمو تجريبية مع مدير المشتريات لمجموعة السعادة القابضة
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    اجتماع Zoom مجدول • اليوم 3:00 م
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setToastMessage('تم فتح غرفة الاجتماع المجدول.')}
                    className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                  >
                    بدء المكالمة
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Left Column (42% - 5 cols) - Unread Messages Inbox */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  أحدث رسائل العملاء غير المقروءة (Unread WhatsApp Inbox)
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  صندوق وارد موحد لكافة منصات التراسل المباشر
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono text-[10px] font-bold">
                4 وارد جديد
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center shrink-0">
                    د
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#0F172A]">
                      د. فيصل السالم • مجمع النخبة الطبي
                    </div>
                    <p className="text-[11px] text-[#64748B] italic truncate max-w-[200px]">
                      &quot;مرحباً طارق، اعتمدنا مسودة العقد، هل يمكن جدولة...&quot;
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/whatsapp-inbox')}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  رد سريع
                </button>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#ECFDF5] text-[#059669] font-bold flex items-center justify-center shrink-0">
                    أ
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#0F172A]">
                      أ. سارة المهيدب • شركة ريادة للتطوير
                    </div>
                    <p className="text-[11px] text-[#64748B] italic truncate max-w-[200px]">
                      &quot;نحتاج إضافة 15 مستخدم إضافي على باقة إنتربرايز كم...&quot;
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/whatsapp-inbox')}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  رد سريع
                </button>
              </div>
            </div>

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
