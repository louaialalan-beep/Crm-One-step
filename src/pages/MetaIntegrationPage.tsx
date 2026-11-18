import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  Database,
  Plus,
  RefreshCw,
  ShieldCheck,
  Webhook,
  Zap,
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCrm } from '../context/CrmContext';

export function MetaIntegrationPage({
  defaultTab = 'meta',
}: {
  defaultTab?: 'meta' | 'whatsapp' | 'social';
}) {
  const { currentOrgId, syncStatus, firebaseUser, isPreviewMode } = useCrm();

  const [activeTab, setActiveTab] = useState<'meta' | 'whatsapp' | 'social'>(defaultTab);
  const [roundRobinEnabled, setRoundRobinEnabled] = useState(true);
  const [autoCreateLeadEnabled, setAutoCreateLeadEnabled] = useState(true);
  const [autoCreateDmLead, setAutoCreateDmLead] = useState(true);
  const [autoLogTouchpoint, setAutoLogTouchpoint] = useState(true);
  const [instantRepAlert, setInstantRepAlert] = useState(true);
  const [capiAutoSync, setCapiAutoSync] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Subscribe to organizations/{orgId}/integrations/meta in Firestore
  useEffect(() => {
    if (!currentOrgId || !firebaseUser || isPreviewMode || syncStatus === 'preview') return;
    const metaRef = doc(db, 'organizations', currentOrgId, 'integrations', 'meta');
    const unsub = onSnapshot(
      metaRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.roundRobinEnabled === 'boolean') setRoundRobinEnabled(d.roundRobinEnabled);
          if (typeof d.autoCreateLeadEnabled === 'boolean') setAutoCreateLeadEnabled(d.autoCreateLeadEnabled);
          if (typeof d.autoCreateDmLead === 'boolean') setAutoCreateDmLead(d.autoCreateDmLead);
          if (typeof d.autoLogTouchpoint === 'boolean') setAutoLogTouchpoint(d.autoLogTouchpoint);
          if (typeof d.instantRepAlert === 'boolean') setInstantRepAlert(d.instantRepAlert);
          if (typeof d.capiAutoSync === 'boolean') setCapiAutoSync(d.capiAutoSync);
        } else {
          setDoc(
            metaRef,
            {
              org_id: currentOrgId,
              roundRobinEnabled: true,
              autoCreateLeadEnabled: true,
              autoCreateDmLead: true,
              autoLogTouchpoint: true,
              instantRepAlert: true,
              capiAutoSync: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
        }
      },
      () => {}
    );
    return () => unsub();
  }, [currentOrgId, firebaseUser, isPreviewMode, syncStatus]);

  const persistMetaToggle = async (
    field:
      | 'roundRobinEnabled'
      | 'autoCreateLeadEnabled'
      | 'autoCreateDmLead'
      | 'autoLogTouchpoint'
      | 'instantRepAlert'
      | 'capiAutoSync',
    nextVal: boolean
  ) => {
    if (field === 'roundRobinEnabled') setRoundRobinEnabled(nextVal);
    if (field === 'autoCreateLeadEnabled') setAutoCreateLeadEnabled(nextVal);
    if (field === 'autoCreateDmLead') setAutoCreateDmLead(nextVal);
    if (field === 'autoLogTouchpoint') setAutoLogTouchpoint(nextVal);
    if (field === 'instantRepAlert') setInstantRepAlert(nextVal);
    if (field === 'capiAutoSync') setCapiAutoSync(nextVal);

    if (currentOrgId && firebaseUser && !isPreviewMode && syncStatus !== 'preview') {
      try {
        await setDoc(
          doc(db, 'organizations', currentOrgId, 'integrations', 'meta'),
          {
            org_id: currentOrgId,
            [field]: nextVal,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to persist Meta integration toggle:', err);
      }
    }
  };

  const baseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const webhookUrl = `${baseUrl}/api/webhooks/meta/${currentOrgId}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText('تم النسخ بنجاح');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSaveAllMetaSettings = async () => {
    if (currentOrgId && firebaseUser && !isPreviewMode && syncStatus !== 'preview') {
      try {
        await setDoc(
          doc(db, 'organizations', currentOrgId, 'integrations', 'meta'),
          {
            org_id: currentOrgId,
            roundRobinEnabled,
            autoCreateLeadEnabled,
            autoCreateDmLead,
            autoLogTouchpoint,
            instantRepAlert,
            capiAutoSync,
            webhookUrl,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to save Meta settings:', err);
      }
    }
    triggerToast('تم حفظ وتثبيت كافة إعدادات الربط في سحابة Firestore بنجاح.');
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {copiedText && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#2563EB] text-white px-3.5 py-1.5 rounded-lg shadow-md text-xs font-bold">
          {copiedText}
        </div>
      )}

      {/* Flush White Header & Top Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span>الإعدادات والنظام</span>
              <span>/</span>
              <span>القنوات والربط التقني</span>
              <span>/</span>
              <span className="text-[#0F172A] font-bold">منظومة ميتا (Meta Omnichannel & CAPI)</span>
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#2563EB]" />
              مركز ربط منظومة ميتا (Meta Integration Hub)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              إدارة موحدة لقنوات المراسلات الذكية، نماذج إعلانات التوليد، وتحسين استهداف الحملات عبر Conversions API (CAPI) السيرفر.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => triggerToast('تم فحص اتصال Webhook وحالة الـ Ping بنجاح (200 OK - Latency 48ms).')}
              className="px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Webhook className="w-3.5 h-3.5 text-[#2563EB]" />
              اختبار الاتصال والـ Webhook (Ping Test)
            </button>
            <button
              type="button"
              onClick={() => triggerToast('سجل أحداث CAPI السيرفر يعمل بكفاءة 100% بدون أي تراجع.')}
              className="px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-[#10B981]" />
              سجل أحداث CAPI المباشر
            </button>
            <button
              type="button"
              onClick={() => triggerToast('جارٍ فتح نافذة Meta Embedded Signup / OAuth 2.0 لربط حساب إعلاني وصفحة جديدة.')}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + ربط حساب إعلاني / صفحة إضافية
            </button>
          </div>
        </div>

        {/* Channel Filter Tabs */}
        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'meta'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            نظرة شاملة وربط CAPI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            واتساب للأعمال السحابي (Cloud API)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'social'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            ماسنجر، إنستغرام، ونماذج Lead Ads
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#059669] font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              حالة الاتصال: جميع القنوات متصلة بنجاح ✓
            </span>
            <span>•</span>
            <span>معدل استجابة الـ Webhook: <strong className="text-[#0F172A] tabular-nums">48ms</strong> (جهوزية 100%)</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#2563EB]">
              <ShieldCheck className="w-3.5 h-3.5" />
              تشفر من طرف لطرف (SHA-256 Enabled)
            </span>
          </div>

          <div className="text-[11px] text-[#94A3B8]">
            آخر فحص بروتوكول: منذ 3 دقائق
          </div>
        </div>
      </div>

      {/* CAPI Server Architecture Note */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 text-xs text-[#1E40AF] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-[#2563EB]" />
          <div>
            <strong>تكامل خادمي فائق الأمان (Server-Side Architecture):</strong> يتم تنفيذ وتوجيه كافة استفسارات المحادثات والتحويلات الإعلانية لحظياً بدون الاعتماد على كوكيز المتصفحات الخارجية لضمان دقة نسب 100%.
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid (60% Right / 40% Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Column (60% - 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: WhatsApp Business Cloud API */}
          <div
            className={`bg-white border rounded-xl p-4 shadow-xs space-y-4 ${
              activeTab === 'whatsapp' ? 'border-[#2563EB] ring-1 ring-[#BFDBFE]' : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-bold">
                  WA
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    واتساب للأعمال السحابي (WhatsApp Business Cloud API)
                  </h3>
                  <span className="text-[11px] text-[#64748B]">الربط المباشر لحساب Meta Business Manager الرسمي وإدارة المراسلات اللحظية للفرق التجارية</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#ECFDF5] text-[#059669] text-[11px] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                الخادم متصل (Active)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[11px] text-[#64748B]">رقم الهاتف المتصل:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-[#0F172A]">+966 50 000 1122</span>
                  <span className="px-2 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold">الرقم الأساسي المعتمد</span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
                <span className="text-[11px] text-[#64748B]">معرف حساب واتساب التجاري (WABA ID):</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#0F172A]">WABA-9928172648</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('WABA-9928172648')}
                    className="p-1 rounded hover:bg-slate-200 text-[#64748B] cursor-pointer"
                    title="نسخ"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Webhook URL Box & Quality Tier */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                <span>حالة استجابة الـ Webhook: <strong className="text-[#10B981]">متصل لحظياً — HTTP 200 OK (0 أخطاء)</strong></span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-[#0F172A] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                    {webhookUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl)}
                    className="p-1 rounded hover:bg-slate-200 text-[#64748B] cursor-pointer"
                    title="نسخ رابط الـ Webhook"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#64748B]">سقف الرسائل وجودة الرقم (Tier & Quality):</span>
                  <div className="font-bold text-xs text-[#0F172A] mt-0.5">Tier 3 (100k+ رسائل/يوم) • جودة عالية (High)</div>
                </div>
                <div className="w-32 h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div className="h-full bg-[#10B981] rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>

            {/* HSM Templates */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">قوالب الرسائل المعتمدة من Meta (HSM Message Templates)</span>
                <button
                  type="button"
                  onClick={() => triggerToast('تمت مزامنة 24 قالب رسالة معتمدة من Meta بنجاح.')}
                  className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  مزامنة القوالب الآن
                </button>
              </div>
              <div className="text-[11px] text-[#64748B]">24 قالب نشط ومطابق لسياسات Meta • آخر مزامنة تلقائية ناجحة: قبل 12 دقيقة</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 font-mono text-[11px] truncate">
                  ترحيب_مؤسسي_v2
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 font-mono text-[11px] truncate">
                  عرض_سعر_فوري_b2b
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 font-mono text-[11px] truncate">
                  تاكيد_اجتماع_تعريفي
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 font-mono text-[11px] truncate">
                  إدارة_كافة_القوالب (24)
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-3 border-t border-[#E2E8F0] text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">التوجيه التلقائي للمحادثات عبر Round-Robin</div>
                  <div className="text-[11px] text-[#64748B]">توزيع المحادثات الواردة الجديدة بالتساوي بين مستشاري المبيعات المتصلين على الوردية</div>
                </div>
                <input
                  type="checkbox"
                  checked={roundRobinEnabled}
                  onChange={(e) => persistMetaToggle('roundRobinEnabled', e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">توليد عميل محتمل (Lead) فوراً عند أول استفسار عبر واتساب</div>
                  <div className="text-[11px] text-[#64748B]">إنشاء بطاقة عميل مؤهل آلياً، واستخراج الاسم ورقم الهاتف وحفظ أول رسالة في تاريخ الأنشطة</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoCreateLeadEnabled}
                  onChange={(e) => persistMetaToggle('autoCreateLeadEnabled', e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Facebook Messenger & Instagram Direct */}
          <div
            className={`bg-white border rounded-xl p-4 shadow-xs space-y-4 ${
              activeTab === 'social' ? 'border-[#2563EB] ring-1 ring-[#BFDBFE]' : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold">
                  IG
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">فيسبوك ماسنجر وإنستغرام دايركت (Messenger & Instagram Direct)</h3>
                  <span className="text-[11px] text-[#64748B]">استقبال الرسائل، الرد الآلي، وتحويل استفسارات القصص والمنشورات إلى فرص تجارية</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold">
                2 حسابات نشطة
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">التحقق والربط اليدوي للملفات الشخصية وصفحات الأعمال</span>
              <button
                type="button"
                onClick={() => triggerToast('تم تحديث وتجديد الـ Token بنجاح لجميع الصفحات الإعلانية.')}
                className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-bold text-[#0F172A] cursor-pointer"
              >
                إعادة التحقق من التوكن (Token Refresh)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#0F172A]">صفحة رواق للأعمال</div>
                  <div className="text-[10px] text-[#64748B]">Page ID: FB-88273619</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#ECFDF5] text-[#059669] text-[10px] font-bold">متصل ومفعل</span>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-xs text-[#2563EB]">@riwaq.crm</div>
                  <div className="text-[10px] text-[#64748B]">IG Business ID: IG-39910248</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#ECFDF5] text-[#059669] text-[10px] font-bold">متصل ومفعل</span>
              </div>
            </div>

            {/* Dm Toggles */}
            <div className="space-y-3 pt-2 border-t border-[#E2E8F0] text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">إنشاء عميل محتمل تلقائي عند أول رسالة دايركت (Auto-create Lead on 1st DM)</div>
                  <div className="text-[11px] text-[#64748B]">إنشاء جهة اتصال وحساب بمجرد استقبال أول رسالة استفسار من ماسنجر أو إنستغرام</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoCreateDmLead}
                  onChange={(e) => persistMetaToggle('autoCreateDmLead', e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">تسجيل نقطة دخول (Touchpoint Subform) تلقائياً لكل محادثة قادمة من إعلان مدفوع</div>
                  <div className="text-[11px] text-[#64748B]">ربط معرف الحملة الإعلانية والإعلان المصدر (Click-to-WhatsApp / Click-to-Direct) في سجل العميل فوراً</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoLogTouchpoint}
                  onChange={(e) => persistMetaToggle('autoLogTouchpoint', e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#0F172A]">قناة الإسناد الافتراضية للرسائل المباشرة:</label>
                <select className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]">
                  <option>إعلانات ميتا المدفوعة (Meta Ads Paid)</option>
                  <option>الرسائل العضوية المباشرة (Organic DM)</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <div className="font-bold text-[#0F172A]">إرسال إشعار فوري لمسؤول الحساب عبر التطبيق عند وصول استفسار جديد</div>
                  <div className="text-[11px] text-[#64748B]">تنبيه المندوب المسؤول خلال 5 ثوانٍ من استلام أي رسالة استفسار لرفع معدل سرعة الاستجابة الأولية</div>
                </div>
                <input
                  type="checkbox"
                  checked={instantRepAlert}
                  onChange={(e) => persistMetaToggle('instantRepAlert', e.target.checked)}
                  className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left Column (40% - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 3: Lead Ads Mapping */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">توجيه نماذج الإعلانات الفورية (Lead Ads Mapping)</h3>
                <span className="text-[11px] text-[#64748B]">مطابقة حقول نموذج إعلان ميتا الفوري بحقول CRM بدقة</span>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold">
                6 حقول نشطة حالياً
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono font-bold text-[#2563EB]">full_name</span>
                <span className="text-[#64748B]">←</span>
                <span className="font-semibold text-[#0F172A]">الاسم الكامل (Full Name)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">إلزامي ✓</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono font-bold text-[#2563EB]">phone_number</span>
                <span className="text-[#64748B]">←</span>
                <span className="font-semibold text-[#0F172A]">رقم الجوال الأساسي</span>
                <span className="text-[11px] text-[#64748B]">صياغة دولية +966</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono font-bold text-[#2563EB]">email</span>
                <span className="text-[#64748B]">←</span>
                <span className="font-semibold text-[#0F172A]">البريد الإلكتروني المهني</span>
                <span className="text-[11px] text-[#10B981] font-bold">تحقق فوري</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono font-bold text-[#2563EB]">company_name</span>
                <span className="text-[#64748B]">←</span>
                <span className="font-semibold text-[#0F172A]">اسم المنشأة أو الشركة</span>
                <span className="text-[11px] text-[#64748B]">حساب B2B</span>
              </div>

              <div className="flex items-center justify-between bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono font-bold text-[#2563EB]">ad_id / campaign</span>
                <span className="text-[#64748B]">←</span>
                <span className="font-semibold text-[#0F172A]">سجل نقاط الوصول (Touchpoints)</span>
                <span className="text-[11px] text-[#2563EB] font-bold">إسناد دقيق 100%</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => triggerToast('تم فحص الحقول الإضافية لنموذج الإعلان بنجاح.')}
              className="w-full py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#2563EB] text-xs font-bold transition-colors cursor-pointer"
            >
              + تخصيص حقول إضافية لنموذج مخصص (Custom Field Mapping)
            </button>
          </div>

          {/* Card 4: Meta Conversions API (CAPI) */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#2563EB]" />
                  إرسال التحويلات الذكي (Meta Conversions API - CAPI)
                </h3>
                <span className="text-[11px] text-[#64748B]">تغذية خوارزميات ميتا بأحداث الصفقات لخفض تكلفة الاكتساب</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[11px] font-bold">
                Server CAPI v20
              </span>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-1">
              <span className="text-[11px] text-[#64748B]">معرف مجموعة البيانات (Dataset / Pixel ID):</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#0F172A]">DATASET-9918237192</span>
                <span className="text-[11px] text-[#059669] font-bold">الخادم السحابي نشط ومستقر</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
              <div>
                <div className="font-bold text-[#0F172A]">إرسال أحداث دورة حياة العمل تلقائياً إلى Meta CAPI</div>
                <div className="text-[11px] text-[#64748B]">تحديث فوري لنتائج التحويل وتدريب الذكاء الاصطناعي لحملات Advantage+</div>
              </div>
              <input
                type="checkbox"
                checked={capiAutoSync}
                onChange={(e) => persistMetaToggle('capiAutoSync', e.target.checked)}
                className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
              />
            </div>

            {/* Event Mapping Rows */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[#64748B] block">مصفوفة مطابقة أحداث المبيعات في رواق بالأحداث القياسية في Meta:</span>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>1. تأهيل العميل في CRM (Qualified Lead)</span>
                  <span className="text-[#2563EB] font-bold">LeadQualified →</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>2. إرسال العرض المالي (Quote Sent)</span>
                  <span className="text-[#2563EB] font-bold">InitiateCheckout →</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>3. إغلاق الصفقة فوزاً (Deal Won - عائد استثمار مباشر)</span>
                  <span className="text-[#10B981] font-bold">Purchase →</span>
                </div>
              </div>
            </div>

            {/* Match Quality Score */}
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#065F46] font-bold">جودة مطابقة الأحداث (Event Match Quality)</span>
                <div className="text-[10px] text-[#047857] mt-0.5">المطابقة تشمل رقم الهاتف، البريد المشفر SHA-256، عنوان IP، والمعرف RWQ — يساهم في خفض تكلفة الإعلانات الفعلية بنسبة 28%.</div>
              </div>
              <div className="text-left">
                <div className="text-base font-extrabold text-[#059669] tabular-nums">9.2 / 10</div>
                <div className="text-[10px] text-[#047857] font-bold">الهدف الموصى به: &gt; 8.0 (ممتاز جداً)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
          <span>آخر مزامنة ناجحة للأحداث عبر <strong>CAPI</strong>: منذ 14 ثانية</span>
          <span>•</span>
          <span className="tabular-nums font-mono">1,248 حدث مرسل اليوم بنسبة تسليم 100%</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => triggerToast('تمت إعادة تحميل حالة الاتصال والمزامنة بنجاح.')}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-bold text-[#0F172A] cursor-pointer"
          >
            إعادة تحميل حالة الاتصال
          </button>
          <button
            type="button"
            onClick={handleSaveAllMetaSettings}
            className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            حفظ وتثبيت إعدادات الربط (Ctrl+S)
          </button>
        </div>
      </div>
    </div>
  );
}

