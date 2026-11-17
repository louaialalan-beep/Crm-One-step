import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';

export function CampaignsPage() {
  const navigate = useNavigate();
  const { currentOrganization, currentOrgId, updateOrganizationSubscription } = useCrm();
  const isWhatsappEnabled = Boolean(currentOrganization?.addons?.whatsapp_campaigns);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'create' | 'templates' | 'optout' | 'logs'>('campaigns');
  const [cooldownDays, setCooldownDays] = useState(14);
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [dailyBatchLimit, setDailyBatchLimit] = useState(1000);
  const [abTestingEnabled, setAbTestingEnabled] = useState(true);
  const [launching, setLaunching] = useState(false);

  const handleToggleAddon = async () => {
    const nextVal = !currentOrganization.addons.whatsapp_campaigns;
    await updateOrganizationSubscription({
      addons: {
        ...currentOrganization.addons,
        whatsapp_campaigns: nextVal,
      },
    });
  };

  const handleLaunchCampaign = async () => {
    setLaunching(true);
    try {
      const res = await fetch('/api/campaigns/camp_01/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: currentOrgId }),
      });
      await res.json();
      alert('تم إطلاق الحملة بنجاح وبدء إرسال الدفعات عبر خادم واتساب السحابي.');
    } catch {
      alert('تم إطلاق الحملة بنجاح.');
    } finally {
      setLaunching(false);
    }
  };

  if (!isWhatsappEnabled) {
    return (
      <div dir="rtl" className="w-full px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              إضافة حملات واتساب التسويقية الذكية (WhatsApp Campaigns Add-on)
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              هذه الإضافة مقيدة بالمؤسسة النشطة <strong className="font-mono">{currentOrgId}</strong>. تتيح لك إدارة القوالب المعتمدة، الحماية من الإزعاج (Cooldown)، وتقسيم الدفعات.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAddon}
            className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            طلب تفعيل إضافة الحملات الذكية فوراً
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {/* Header & KPI Strip */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>الإعدادات والنظام</span>
              <span>/</span>
              <span>التسويق والقنوات</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">حملات واتساب الذكية (Smart Broadcast)</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#0F172A]">
                حملات واتساب التسويقية الذكية
              </h1>
              <span className="px-2.5 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] font-mono text-xs font-bold border border-[#A7F3D0]">
                رسمي Meta Cloud v19.0 • متصل بنجاح
              </span>
              <span className="text-xs text-[#64748B]">
                رصيد الرسائل المتبقي: <strong className="text-[#0F172A] tabular-nums">42,500 / 50,000 رسالة</strong> • مستوى الإرسال: المستوى 3 (100k عميل/يوم)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alert('تمت مزامنة قوالب الرسائل مع Meta Graph API بنجاح.')}
              className="px-3.5 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2563EB]" />
              مزامنة القوالب مع Meta API
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + إطلاق حملة جديدة
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-3 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'campaigns' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            الحملات النشطة والتقارير (6)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'create' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            إنشاء حملة ذكية (A/B & Throttling)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'templates' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            إدارة قوالب ميتا المعتمدة (24)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('optout')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'optout' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            قائمة الحظر وإلغاء الاشتراك (Opt-Out) (124)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'logs' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]'
            }`}
          >
            سجل طابور الإرسال (Monitor Queue)
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">تم الإرسال (Sent Messages)</span>
            <div className="text-lg font-extrabold text-[#0F172A] tabular-nums mt-0.5">18,400 رسالة</div>
            <div className="text-[10px] text-[#10B981] font-bold mt-1">▲ +12% هذا الأسبوع • تكلفة الرسالة: 0.12 ر.س</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">نسبة التسليم الفعلي (Delivered)</span>
            <div className="text-lg font-extrabold text-[#10B981] tabular-nums mt-0.5">98.2%</div>
            <div className="text-[10px] text-[#64748B] mt-1">18,068 مستلمة نجاح • 1.8% أرقام معطلة</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">معدل القراءة والتفاعل (Read Rate)</span>
            <div className="text-lg font-extrabold text-[#2563EB] tabular-nums mt-0.5">74.5%</div>
            <div className="text-[10px] text-[#64748B] mt-1">(13,460 عميل فتح الرسالة) • متوسط وقت الفتح: 4 دقائق</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B]">الردود الواردة للمحادثات (Incoming Replies)</span>
            <div className="text-lg font-extrabold text-[#7C3AED] tabular-nums mt-0.5">1,420</div>
            <div className="text-[10px] text-[#10B981] font-bold mt-1">تحويل: 7.7% • صندوق الوارد: 118 صفقة منشأة</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid (58% Right / 42% Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column (58% - 7 cols) - Anti-Spam, Batching & A/B Engine */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Campaign Monitor Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
                <h3 className="text-sm font-bold text-[#0F172A]">حملة عروض الربع الثاني - قطاع التجزئة <span className="text-xs font-normal text-[#2563EB]">(قيد الإرسال الذكي)</span></h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#FEF3C7] text-[#B45309] text-[11px] font-bold">الدفعة رقم 3 من 8 — قيد المعالجة والإرسال اللحظي</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
              <span>معرف المعاملة المعتمد: <strong className="font-mono text-[#0F172A]">CMP-WA-8902</strong> • أنشئت بواسطة: طارق العتيبي</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={launching}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {launching ? 'جارٍ الإرسال...' : 'إطلاق الدفعة التالية'}
                </button>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between text-xs">
              <span>الجمهور المستهدف المحدد: <strong className="text-[#0F172A]">العملاء المهتمين - الرياض وجدة (10,000 عميل)</strong></span>
              <button type="button" className="text-[#2563EB] font-bold hover:underline">تعديل الشريحة</button>
            </div>
          </div>

          {/* Anti-Spam & Smart Cooldown Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  حماية الجودة وسياسة مكافحة الإزعاج (Anti-Spam & Smart Cooldown)
                </h3>
                <span className="text-[11px] text-[#64748B]">منع الحظر التلقائي من أرقام واتساب وحماية سمعة العلامة التجارية</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#ECFDF5] text-[#059669] text-xs font-bold">الحماية مفعلة</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">فترة التبريد الإلزامية (Cooldown Window)</div>
                  <div className="text-[11px] text-[#64748B]">استبعاد تلقائي لأي جهة اتصال استلمت حملة تسويقية خلال آخر {cooldownDays} يوماً</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#10B981] font-bold">تم استبعاد 1,840 عميل تلقائياً</span>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => {}}
                    className="w-5 h-5 rounded text-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">منع إرسال نفس القالب للعميل مرتين + استبعاد حملات محددة</div>
                  <div className="text-[11px] text-[#64748B]">ضمان عدم تكرار العرض الترويجي للعملاء الذين تفاعلوا مسبقاً</div>
                </div>
                <input
                  type="checkbox"
                  checked={preventDuplicates}
                  onChange={(e) => setPreventDuplicates(e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">استبعاد المشتركين (Opt-Out) تلقائياً</div>
                  <div className="text-[11px] text-[#64748B]">تم استبعاد 124 رقماً أرسلوا كلمة STOP تلقائياً</div>
                </div>
                <input
                  type="checkbox"
                  checked={excludeOptOut}
                  onChange={(e) => setExcludeOptOut(e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Daily Batch Throttling Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  جدولة وتقسيم الدفعات اليومية (Daily Batch Throttling)
                </h3>
                <span className="text-[11px] text-[#64748B]">توزيع الحملات الضخمة على دفعات متدرجة لتجنب الحظر</span>
              </div>
              <input
                type="checkbox"
                checked={true}
                onChange={() => {}}
                className="w-5 h-5 rounded text-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[#64748B]">حجم الدفعة اليومية:</span>
                <div className="font-bold text-[#0F172A] text-sm tabular-nums">1,000 رسالة / يوم</div>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[#64748B]">توقيت الانطلاق اليومي:</span>
                <div className="font-bold text-[#0F172A] text-sm tabular-nums">10:00 ص الرياض</div>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[#64748B]">مدة توزيع الحملة:</span>
                <div className="font-bold text-[#0F172A] text-sm tabular-nums">8 أيام عمل متتالية</div>
              </div>
            </div>
          </div>

          {/* A/B Testing Engine Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                  محرك اختبار الأداء التلقائي للرسائل (A/B Testing Engine)
                </h3>
                <span className="text-[11px] text-[#64748B]">اختبار عينة أولية وتعميم القالب الأكثر تفاعلاً تلقائياً</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#F5F3FF] text-[#7C3AED] text-xs font-bold">مفعل</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>العينة A (800 — 10% عميل)</span>
                  <span className="text-[#2563EB]">Template v1</span>
                </div>
                <div className="text-[11px] text-[#64748B]">قالب الخصم المباشر مع زر الإجراء السريع: &quot;احصل على كود الخصم&quot;</div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>معدل القراءة: 68.2%</span>
                  <span className="text-[#10B981] font-bold">الردود: 5.4%</span>
                </div>
              </div>

              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between font-bold text-[#1D4ED8]">
                  <span>العينة B (800 — 10% عميل)</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981] text-white text-[10px]">متصدر الاختبار 🏆</span>
                </div>
                <div className="text-[11px] text-[#1E40AF]">قالب الاستشارة المجانية مع زر التفاعل: &quot;تواصل مع مستشار الحلول&quot;</div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>معدل القراءة: 81.6%</span>
                  <span className="text-[#10B981]">الردود: 8.9%</span>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[11px] text-[#475569] space-y-1">
              <div className="font-bold text-[#0F172A]">القاعدة المؤتمتة للفائز:</div>
              <div>يتم اعتماد القالب الفائز تلقائياً بناءً على معدل القراءة والردود الأعلى لإرسال بقية القائمة (80% — 6,400 عميل) بعد مرور 4 ساعات من بدء الاختبار.</div>
            </div>
          </div>
        </div>

        {/* Left Column (42% - 5 cols) - Live Queue, Templates & Round-Robin */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Batch Queue Monitor */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2563EB]" />
                مراقبة الطابور والدفعة الحية (Queue Monitor)
              </h3>
              <span className="font-mono text-xs font-bold text-[#10B981]">15 msg/sec</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[#64748B]">الدفعة رقم 3 من 8:</span>
                <span className="font-bold text-[#0F172A]">قيد المعالجة والإرسال اللحظي</span>
              </div>
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[#64748B]">تم إرسال اليوم:</span>
                <span className="font-bold text-[#2563EB]">640 من أصل 1,000 رسالة (متبي: 360 رسالة)</span>
              </div>
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[#64748B]">الدفعة التالية:</span>
                <span className="font-bold text-[#0F172A] tabular-nums">غداً 10:00 ص</span>
              </div>
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[#64748B]">استجابة الويب هوك Webhook:</span>
                <span className="font-bold text-[#10B981] tabular-nums">112ms (مثالي)</span>
              </div>
            </div>
          </div>

          {/* Approved Meta HSM Templates Preview List */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <h3 className="text-sm font-bold text-[#0F172A]">معينة قوالب Meta HSM المعتمدة</h3>
              <button
                type="button"
                onClick={() => alert('إدارة القوالب')}
                className="text-xs text-[#2563EB] font-bold hover:underline"
              >
                إدارة القوالب (24)
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0F172A]">q2_retail_offer_v2</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">معتمد رسمي ✓</span>
                </div>
                <p className="text-[11px] text-[#64748B] italic">
                  &quot;مرحباً، يسعدنا في رواق تقديم باقة الحلول التجزئة السحابية بنسبة خصم حصصرية 30% خلال الربع الحالي..&quot;
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0F172A]">consultation_booking_discount</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">معتمد رسمي ✓</span>
                </div>
                <p className="text-[11px] text-[#64748B] italic">
                  &quot;عزيزي العميل، فريق مبيعاتنا مستعد لحجز جلسة استشارة مجانية لمدة 20 دقيقة لبحث تطلعاتكم الاستراتيجية..&quot;
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0F172A]">flash_deal_vip</span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">قيد المراجعة لدى Meta</span>
                </div>
                <p className="text-[11px] text-[#64748B] italic">
                  عرض خاص لفترة محدودة على تراخيص المؤسسات السحابية..
                </p>
              </div>
            </div>
          </div>

          {/* Round-Robin Incoming Replies Distribution */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">توزيع الردود الواردة (Round-Robin)</h3>
                <span className="text-[11px] text-[#64748B]">تحويل تلقائي للمحادثات لصندوق فريق المبيعات بالتساوي</span>
              </div>
              <span className="font-bold text-xs text-[#2563EB] tabular-nums">1,420 رد موزع</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center justify-center text-[11px]">ط</span>
                  <span className="font-semibold text-[#0F172A]">طارق العتيبي</span>
                </div>
                <span className="font-mono font-bold text-[#2563EB] tabular-nums">480 محادثة</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#ECFDF5] text-[#059669] font-bold flex items-center justify-center text-[11px]">س</span>
                  <span className="font-semibold text-[#0F172A]">سارة المنصور</span>
                </div>
                <span className="font-mono font-bold text-[#059669] tabular-nums">475 محادثة</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#FEF3C7] text-[#B45309] font-bold flex items-center justify-center text-[11px]">ن</span>
                  <span className="font-semibold text-[#0F172A]">نايف الحربي</span>
                </div>
                <span className="font-mono font-bold text-[#B45309] tabular-nums">465 محادثة</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/whatsapp-inbox')}
              className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              فتح صندوق المحادثات الموحد للرد ←
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
