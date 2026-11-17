import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Database,
  FileText,
  Filter,
  Flame,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function AssignmentRulesPage() {
  const { currentOrgId, leads } = useCrm();

  const [activeTab, setActiveTab] = useState<'rules' | 'scoring' | 'escalation' | 'audit'>('rules');
  const [autoPriority, setAutoPriority] = useState(true);
  const [skipOffHours, setSkipOffHours] = useState(true);
  const [dailyCap, setDailyCap] = useState(true);
  const [whatsappAlert, setWhatsappAlert] = useState(true);

  // Simulator state
  const [simLeadName, setSimLeadName] = useState('م. عبد الله السبيعي');
  const [simScore, setSimScore] = useState(94);
  const [simTier, setSimTier] = useState('ساخن جداً 🔥');

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testLeadChannel, setTestLeadChannel] = useState('WhatsApp');
  const [testLeadCity, setTestLeadCity] = useState('الرياض');
  const [testResultRep, setTestResultRep] = useState<string | null>(null);

  const handleTestRouting = (e: React.FormEvent) => {
    e.preventDefault();
    if (testLeadCity === 'الرياض' && testLeadChannel === 'WhatsApp') {
      setTestResultRep('طارق العتيبي (متصل الآن • 6/15 عميل)');
    } else {
      setTestResultRep('سارة المنصور (متصل الآن • 9/15 عميل)');
    }
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {/* Flush White Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>الإعدادات والنظام</span>
              <span>/</span>
              <span>الأتمتة وقواعد العمل</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">التوزيع والتقييم الآلي</span>
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#2563EB]" />
              قواعد التوزيع الآلي والتقييم الذكي (Lead Assignment & Scoring)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              إدارة تدفق العملاء المحتملين وتوزيعهم تناوبياً وتصنيف جاهزيتهم للشراء بناءً على الأنشطة السلوكية وبيانات المنشأة.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-[#2563EB]" />
              محاكاة واختبار التوزيع (Test Routing)
            </button>
            <button
              type="button"
              onClick={() => alert('تم إضافة قاعدة توزيع جديدة بنجاح في سحابة Firestore.')}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + إضافة قاعدة توزيع جديدة
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>قواعد التوزيع الآلي (Assignment Rules)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">3 نشطة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'scoring'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>قواعد احتساب النقاط (Scoring Rules)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[11px] tabular-nums">12 قاعدة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('escalation')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'escalation'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>تصعيد التذاكر والمهام (Escalation)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            <span>سجل تنفيذ التوزيع اللحظي (Audit Log)</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column (62% - 7 cols) - First-Match Priority Rules */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between text-xs text-[#64748B]">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#2563EB]" />
              <span>يتم تطبيق القواعد بالتسلسل التنازلي حتى أول تطابق (First-Matching Rule). يمكنك سحب البطاقات لإعادة ترتيبها.</span>
            </div>
            <span className="font-mono text-[#0F172A] font-bold">3 قواعد مفعلة</span>
          </div>

          {/* Rule Card #1 */}
          <div className="bg-white border-2 border-[#2563EB]/40 rounded-xl p-4 shadow-xs space-y-4 relative">
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#ECFDF5] text-[#059669] text-[11px] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                نشطة (Active)
              </span>
              <button type="button" className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-xs">
                #1
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">توزيع عملاء إعلانات ميتا - الرياض (Round-Robin)</h3>
                <span className="text-[11px] text-[#64748B]">المشغل: عند ورود عميل محتمل جديد من قنوات المراسلة أو الحملات الإعلانية المدفوعة</span>
              </div>
            </div>

            {/* Matching Logic Expression */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#64748B]">معيار الاستحقاق (Matching Logic Strict):</label>
              <div dir="ltr" className="bg-[#0F172A] text-slate-200 font-mono text-[11px] p-2.5 rounded-lg border border-slate-700">
                {'واتساب للأعمال", "إعلانات" IN القناة AND "المدينة == "الرياض'}
              </div>
            </div>

            {/* Round-Robin Rep Pool */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                آلية الإسناد: توزيع تناوبي عادل (Round-Robin) على فريق مبيعات الرياض:
              </span>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-2.5 text-center space-y-1">
                  <div className="font-bold text-[#0F172A] text-xs">طارق العتيبي</div>
                  <div className="text-[10px] text-[#2563EB]">متصل الآن</div>
                  <div className="font-mono text-xs font-bold text-[#1D4ED8]">6 / 15</div>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-center space-y-1">
                  <div className="font-bold text-[#0F172A] text-xs">سارة المنصور</div>
                  <div className="text-[10px] text-[#10B981]">متصل الآن</div>
                  <div className="font-mono text-xs font-bold text-[#475569]">9 / 15</div>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-center space-y-1">
                  <div className="font-bold text-[#0F172A] text-xs">نايف الحربي</div>
                  <div className="text-[10px] text-[#F59E0B]">مشغول بمكالمة</div>
                  <div className="font-mono text-xs font-bold text-[#475569]">11 / 15</div>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-center space-y-1">
                  <div className="font-bold text-[#0F172A] text-xs">عمر الشمري</div>
                  <div className="text-[10px] text-[#64748B]">متصل الآن</div>
                  <div className="font-mono text-xs font-bold text-[#475569]">4 / 15</div>
                </div>
              </div>
            </div>

            {/* Smart Guardrails */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0] bg-[#F8FAFC] -mx-4 -mb-4 p-4 rounded-b-xl border-x">
              <span className="text-[11px] font-bold text-[#0F172A]">الضوابط الذكية وحماية الأداء (Smart Guardrails):</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#475569]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipOffHours}
                    onChange={(e) => setSkipOffHours(e.target.checked)}
                    className="rounded text-[#2563EB]"
                  />
                  <span>تخطي الموظف خارج ساعات الدوام أو في إجازة رسمية</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dailyCap}
                    onChange={(e) => setDailyCap(e.target.checked)}
                    className="rounded text-[#2563EB]"
                  />
                  <span>سقف الإسناد اليومي: 15 عميل / موظف كحد أقصى</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappAlert}
                    onChange={(e) => setWhatsappAlert(e.target.checked)}
                    className="rounded text-[#2563EB]"
                  />
                  <span>إشعار واتساب فوري لمسؤول الحساب فور الإسناد</span>
                </label>
              </div>
            </div>
          </div>

          {/* Rule Card #2 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 relative">
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#ECFDF5] text-[#059669] text-[11px] font-bold">
                نشطة (Active)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#475569] font-bold flex items-center justify-center text-xs">
                #2
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">توزيع عملاء الشركات الكبرى والمؤسسات (Enterprise)</h3>
                <span className="text-[11px] text-[#64748B]">حسابات استراتيجية — الحد: إنشاء أو استيراد عميل جديد يطابق معيز الإيرادات</span>
              </div>
            </div>
            <div className="text-xs bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg space-y-1">
              <div><strong>الشرط:</strong> عدد الموظفين &gt; 100 OR الميزانية المتوقعة &gt;= 100,000 ر.س</div>
              <div className="text-[#2563EB]"><strong>إسناد مباشر إلى:</strong> مديري كبار الحسابات (KAM) - ريم القحطاني ونايف الحربي بالتساوي</div>
            </div>
          </div>

          {/* Rule Card #3 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3 relative">
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#ECFDF5] text-[#059669] text-[11px] font-bold">
                نشطة (Active)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#475569] font-bold flex items-center justify-center text-xs">
                #3
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">إسناد تلقائي لمحادثات إنستغرام وماسنجر الفورية</h3>
                <span className="text-[11px] text-[#64748B]">المشغل: رسالة جديدة واردة عبر القنوات الاجتماعية</span>
              </div>
            </div>
            <div className="text-xs bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg space-y-1">
              <div><strong>الشرط:</strong> القناة IN (&quot;Instagram Direct&quot;, &quot;Facebook Messenger&quot;)</div>
              <div className="text-[#10B981]">إسناد لحظي لأول موظف متواجد (Online Now) في قسم الاستقبال والتأهيل، وإعادة توجيه إن لم يرد مهلة التصعيد: 180 ثانية</div>
            </div>
          </div>

          {/* Default Fallback Rule */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">دائمة (Default Fallback Rule)</span>
              <span>في حال عدم انطباق أي من القواعد المحددة أعلاه، يُسند السجل تلقائياً إلى:</span>
            </div>
            <div className="text-xs text-[#2563EB] font-bold">
              مدير المبيعات المناوب (سارة المنصور) لمنع بقاء أي عميل معلق.
            </div>
          </div>
        </div>

        {/* Left Column (38% - 5 cols) - Lead Scoring Model & Live Simulator */}
        <div className="lg:col-span-5 space-y-4">
          {/* Scoring Model Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#F59E0B]" />
                  نموذج تقييم جودة العميل (Lead Scoring Model)
                </h3>
                <span className="text-[11px] text-[#64748B]">حساب درجات التفاعل لفرز العملاء الجادين وتوجيه جهود مندوبي المبيعات بكفاءة</span>
              </div>
              <div className="text-right font-mono text-xs font-bold text-[#0F172A]">
                100 نقطة كحد أقصى
              </div>
            </div>

            {/* Score Ranges Legend */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-lg p-2">
                <div className="font-bold">ساخن &gt;= 80</div>
              </div>
              <div className="bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] rounded-lg p-2">
                <div className="font-bold">دافيء 40 - 79</div>
              </div>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] rounded-lg p-2">
                <div className="font-bold">بارد &lt; 40</div>
              </div>
            </div>

            {/* Criteria Points */}
            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#2563EB]" />
                خصائص وبيانات السجل (Demographic & Firmographic):
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>مصدر العميل: إعلان ميتا / واتساب موثق</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+15 نقطة</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>بريد إلكتروني رسمي للشركة (B2B Domain)</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+10 نقاط</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>المسمى الوظيفي: مدير تنفيذي أو صاحب قرار</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+15 نقطة</span>
                </div>
              </div>

              <div className="font-bold text-[#0F172A] flex items-center gap-1.5 pt-2">
                <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
                تفاعلات وسلوكيات العميل (Behavioral Triggers):
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>الرد السريع على أول رسالة واتساب</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+20 نقطة</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>فتح وتحميل عرض السعر المرسل</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+25 نقطة</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>حجز موعد عرض تجريبي حي (Live Demo)</span>
                  <span className="font-bold text-[#10B981] tabular-nums">+30 نقطة</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>عدم فتح الرسائل أو الرد لمدة 7 أيام متتالية</span>
                  <span className="font-bold text-[#EF4444] tabular-nums">-15 نقطة</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded-lg">
                  <span>رقم الهاتف ملغي أو فشل التسليم التقني</span>
                  <span className="font-bold text-[#EF4444] tabular-nums">-30 نقطة</span>
                </div>
              </div>
            </div>

            {/* Auto Priority Checkbox */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-[#0F172A] font-bold">
                <input
                  type="checkbox"
                  checked={autoPriority}
                  onChange={(e) => setAutoPriority(e.target.checked)}
                  className="rounded text-[#2563EB] mt-0.5"
                />
                <span>
                  الترتيب التلقائي للأولويات: تفعيل الفرز التلقائي للعملاء الساخنين (&gt;= 80 نقطة) في أعلى قوائم المتابعة وتنبيه الإدارة فوراً.
                </span>
              </label>
            </div>
          </div>

          {/* Live Simulator Dark Card */}
          <div className="bg-[#0F172A] text-white rounded-xl p-4 shadow-lg space-y-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                محاكي فوري لتقييم العميل (Live Simulator)
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">محدث لحظياً</span>
            </div>

            <div className="flex items-center justify-between bg-[#1E293B] p-3 rounded-xl border border-slate-700">
              <div>
                <h4 className="font-bold text-sm text-white">{simLeadName}</h4>
                <span className="text-[11px] text-slate-400">مدير تقنية - شركة آفاق التقنية</span>
              </div>
              <div className="text-left">
                <div className="text-2xl font-extrabold text-amber-400 tabular-nums">{simScore}</div>
                <div className="text-[10px] font-bold text-emerald-400">{simTier}</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 leading-relaxed">
              <strong>المطابقات:</strong> بريد B2B رسمي (+10)، صاحب قرار(+15)، رد خلال دقيقة (+20)، فتح عرض السعر (+25)، طلب Demo حي (+30) - خصم (0).
            </div>
          </div>

          {/* Conversion Stats Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-[#64748B]">دقة نموذج التقييم الآلي والتوزيع</span>
              <div className="text-lg font-bold text-[#10B981] tabular-nums">92.4% نسبة التحويل</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Test Routing Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600" />
                محاكاة واختبار التوزيع (Test Routing Engine)
              </h2>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTestRouting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">قناة الوارد (Channel)</label>
                <select
                  value={testLeadChannel}
                  onChange={(e) => setTestLeadChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="WhatsApp">WhatsApp Business API</option>
                  <option value="Instagram Direct">Instagram Direct</option>
                  <option value="Facebook Messenger">Facebook Messenger</option>
                  <option value="Website Form">نموذج موقع الويب</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المدينة / النطاق الجغرافي</label>
                <select
                  value={testLeadCity}
                  onChange={(e) => setTestLeadCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="الرياض">الرياض (منطقة الرياض الكبرى)</option>
                  <option value="المنطقة الشرقية">المنطقة الشرقية</option>
                  <option value="جدة">جدة والمنطقة الغربية</option>
                </select>
              </div>

              {testResultRep && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    تمت مطابقة القاعدة رقم #1 بنجاح:
                  </div>
                  <div className="font-mono text-emerald-700 font-bold">{testResultRep}</div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  تشغيل المحاكاة الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
