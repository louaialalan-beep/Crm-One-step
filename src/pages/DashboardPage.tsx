import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpLeft,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  Filter,
  Layers,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrencySAR } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    deals,
    leads,
    tasks,
    messages,
    activeProfile,
    canViewField,
    toggleTaskStatus,
  } = useCrm();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [dashboardRole, setDashboardRole] = useState<'ceo' | 'sales' | 'marketing'>('ceo');
  const [funnelTab, setFunnelTab] = useState<'funnel' | 'revenue'>('funnel');
  const [taskTab, setTaskTab] = useState<'all' | 'urgent' | 'deals' | 'calls'>('all');

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'مكتملة'), [tasks]);

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
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#0F172A]">
                لوحة القيادة التنفيذية والمبيعات
              </h1>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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

          <div className="flex items-center gap-2">
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
                هذا الشهر (فحدد)
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
              onClick={() => alert('تم فتح لوحة تخصيص وترتيب الودجتس (Widget Customizer).')}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
              تخصيص اللوحة
            </button>
            <button
              type="button"
              onClick={() => alert('تم تصدير تقرير لوحة القيادة بصيغة PDF & Excel بنجاح.')}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير التقرير
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">إجمالي المبيعات المغلقة</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">1,485,200 ر.س</div>
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
            <span className="text-[#0F172A] font-mono font-bold">3,890,500 ر.س</span>
          </div>
          <div className="text-[10px] text-[#64748B] truncate">
            12 عرض توالي • 18 تفاوض مالي • 12 فتح...
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
          <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">134 عميل مهتم</div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E8F0]">
            <span className="text-[#10B981] font-bold">24% يومي ▲</span>
            <span className="text-[#64748B]">توزيع القنوات:</span>
          </div>
          <div className="text-[10px] text-[#475569] font-mono flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">واتساب (64)</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">إنستغرام (42)</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">ماسنجر (28)</span>
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

      {/* Middle Row: Right (60%) Funnel & Left (40%) Meta Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column (60% - 7 cols) - Sales Funnel */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">قمع مبيعات الصفقات والإيرادات (Sales Funnel & Revenue)</h3>
              <span className="text-[11px] text-[#64748B]">تحويل مراحل Pipeline ومتابعة نسبة التسرب</span>
            </div>
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFunnelTab('funnel')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  funnelTab === 'funnel' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                مراحل القمع البيعي
              </button>
              <button
                type="button"
                onClick={() => setFunnelTab('revenue')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  funnelTab === 'revenue' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                تحصيل الإيرادات
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Stage 1 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span className="font-bold">1. استهطاب ومؤهل أولي (Qualified)</span>
                <span className="font-mono font-bold">186 صفقة · 5,420,000 ر.س</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span className="font-bold">2. تقديم العرض الفني والمالي (Proposal)</span>
                <span className="font-mono font-bold">112 صفقة · 3,980,000 ر.س</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '60.2%' }}></div>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span className="font-bold">3. مرحلة التفاوض والاعتماد (Negotiation)</span>
                <span className="font-mono font-bold">64 صفقة · 2,450,000 ر.س</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '57.1%' }}></div>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span className="font-bold">4. العقود قيد التوقيع (Closing Contract)</span>
                <span className="font-mono font-bold">28 صفقة · 1,820,000 ر.س</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '43.8%' }}></div>
              </div>
            </div>

            {/* Stage 5 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#0F172A]">
                <span className="font-bold text-[#10B981]">5. صفقات مغلقة بنجاح (Closed Won)</span>
                <span className="font-mono font-bold text-[#10B981]">22 صفقة · 1,485,200 ر.س</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: '78.5%' }}></div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>مسار الإيراد التراكمي الربع سنوي:</span>
            <span className="font-mono text-[#0F172A]">أكتوبر: 1.1M • نوفمبر: 1.25M • ديسمبر: 1.38M • يناير: 1.48M (الحالي)</span>
          </div>
        </div>

        {/* Left Column (40% - 5 cols) - Meta Channels & ROAS */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">أداء قنوات ميتا المباشرة (WhatsApp, Instagram & Messenger)</h3>
              <span className="text-[11px] text-[#64748B]">مزامنة فورية للمحادثات والعملاء</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">مباشر API</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-[#0F172A]">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#059669]" />
                  واتساب للأعمال (WhatsApp Business)
                </span>
                <span className="font-mono text-emerald-700">820,000 ر.س</span>
              </div>
              <div className="text-[11px] text-[#64748B]">زمن الرد: 1.1 دقيقة • نشط وفوري • 420 عميل محتمل • 78 صفقة منجزة</div>
              <div className="text-[10px] text-[#10B981] font-bold">نسبة التحويل: 18.5%</div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-[#0F172A]">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2563EB]" />
                  إنستغرام دايركت (Instagram Direct)
                </span>
                <span className="font-mono text-[#2563EB]">415,200 ر.س</span>
              </div>
              <div className="text-[11px] text-[#64748B]">زمن الرد: 1.8 دقيقة • حملات التفاعل • 280 عميل محتمل • 38 صفقة منجزة</div>
              <div className="text-[10px] text-[#2563EB] font-bold">نسبة التحويل: 13.6%</div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-[#0F172A]">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
                  ماسنجر فيسبوك (Facebook Messenger)
                </span>
                <span className="font-mono text-[#7C3AED]">250,000 ر.س</span>
              </div>
              <div className="text-[11px] text-[#64748B]">زمن الرد: 2.3 دقيقة • إعلانات Lead Gen • 165 عميل محتمل • 19 صفقة منجزة</div>
              <div className="text-[10px] text-[#7C3AED] font-bold">نسبة التحويل: 11.5%</div>
            </div>
          </div>

          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#1E40AF]">عائد الإنفاق الإعلاني (ROAS): 5.4x</span>
              <div className="text-[11px] text-[#1D4ED8] mt-0.5">بفضل الإسناد المباشر والمحادثات المؤتمتة لرواق CRM</div>
            </div>
            <Sparkles className="w-6 h-6 text-[#2563EB]" />
          </div>
        </div>
      </div>

      {/* Bottom Row: Right (Tasks) & Left (Unread Messages) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column (58% - 7 cols) - Urgent Tasks */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">مهامي العاجلة اليوم (Urgent Tasks & Follow-ups)</h3>
              <span className="text-[11px] text-[#64748B]">أولوية الإغلاق والتواصل المباشر مع الحسابات</span>
            </div>
            <button
              type="button"
              onClick={() => alert('تم فتح نافذة إضافة مهمة جديدة.')}
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
                taskTab === 'all' ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              الكل (7)
            </button>
            <button
              type="button"
              onClick={() => setTaskTab('urgent')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                taskTab === 'urgent' ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              عاجل جداً (3)
            </button>
            <button
              type="button"
              onClick={() => setTaskTab('deals')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                taskTab === 'deals' ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              متابعة صفقات (2)
            </button>
            <button
              type="button"
              onClick={() => setTaskTab('calls')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                taskTab === 'calls' ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              مكالمات مجدولة (2)
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">عاجل جداً</span>
                  <span className="font-bold text-[#0F172A]">متابعة توقيع العقد النهائي مع شركة أفق للتقنية</span>
                </div>
                <div className="text-[11px] text-[#64748B]">صفقة: 340,000 ر.س • الموعد: اليوم 1:30 م</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('تمت إفادة المهمة بنجاح.')}
                  className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold cursor-pointer"
                >
                  إتمام ✓
                </button>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">متوسطة</span>
                  <span className="font-bold text-[#0F172A]">مكالمة ديمو تجريبية مع مدير المشتريات لمجموعة السعادة القابضة</span>
                </div>
                <div className="text-[11px] text-[#64748B]">اجتماع Zoom مجدول • اليوم 3:00 م</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('جارٍ بدء المكالمة VoIP...')}
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
              <h3 className="text-sm font-bold text-[#0F172A]">أحدث رسائل العملاء غير المقروءة (Unread WhatsApp Inbox)</h3>
              <span className="text-[11px] text-[#64748B]">صندوق وارد موحد لكافة منصات التراسل المباشر</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono text-[10px] font-bold animate-pulse">4 وارد جديد</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center shrink-0">
                  د
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-[#0F172A]">د. فيصل السالم • مجمع النخبة الطبي</div>
                  <p className="text-[11px] text-[#64748B] italic truncate max-w-[200px]">
                    &quot;مرحباً طارق، اعتمدنا مسودة العقد، هل يمكن جدولـة...&quot;
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
                  <div className="font-bold text-[#0F172A]">أ. سارة المهيدب • شركة ريادة للتطوير</div>
                  <p className="text-[11px] text-[#64748B] italic truncate max-w-[200px]">
                    &quot;تحتاج إضافة 15 مستخدم إضافي على باقة إنتربرايز كم...&quot;
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
    </div>
  );
};
