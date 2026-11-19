import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  CreditCard,
  Lock,
  Mail,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { settingsService } from '../services/settingsService';
import { BillingProvider, CrmAddonFlags, OrganizationPlan } from '../types/crm';

interface PlanQuotaTierSpec {
  id: 'Free' | 'Growth' | 'Enterprise';
  nameAr: string;
  badge: string;
  monthlyPriceSar: number;
  yearlyPriceSar: number;
  maxUsersLabel: string;
  maxUsersCount: number;
  maxCustomersLabel: string;
  features: Array<{ label: string; enabled: boolean }>;
}

const SAAS_PLAN_QUOTA_SPECS: PlanQuotaTierSpec[] = [
  {
    id: 'Free',
    nameAr: 'الباقة المجانية (Free)',
    badge: 'للفرق الناشئة',
    monthlyPriceSar: 0,
    yearlyPriceSar: 0,
    maxUsersLabel: 'حتى 3 مستخدمين فقط',
    maxUsersCount: 3,
    maxCustomersLabel: 'حتى 500 عميل (Leads + Contacts)',
    features: [
      { label: 'المعرّف الموحد الدائم للعميل (RWQ-xxxxx)', enabled: true },
      { label: 'الفوترة الضريبية ZATCA المرحلة الأولى (15% + TLV QR)', enabled: true },
      { label: 'بدون مخططات البلوبرينت (Blueprints)', enabled: false },
      { label: 'بدون مزامنة Meta CAPI المباشرة', enabled: false },
    ],
  },
  {
    id: 'Growth',
    nameAr: 'باقة النمو (Growth)',
    badge: 'الأكثر طلباً',
    monthlyPriceSar: 749,
    yearlyPriceSar: 7190,
    maxUsersLabel: 'حتى 15 مستخدماً',
    maxUsersCount: 15,
    maxCustomersLabel: 'عملاء غير محدودين',
    features: [
      { label: 'تكامل WhatsApp Cloud API + WebSocket اللحظي', enabled: true },
      { label: 'مزامنة أحداث Meta CAPI (Purchase & LeadQualified)', enabled: true },
      { label: 'الفوترة الضريبية ZATCA المرحلة الأولى (15% + TLV QR)', enabled: true },
      { label: 'قواعد الورك فلو القياسية (Workflow Rules)', enabled: true },
    ],
  },
  {
    id: 'Enterprise',
    nameAr: 'باقة المؤسسات (Enterprise)',
    badge: 'غير محدودة + SLA 99.9%',
    monthlyPriceSar: 1990,
    yearlyPriceSar: 19100,
    maxUsersLabel: 'مستخدمون غير محدودين',
    maxUsersCount: 50,
    maxCustomersLabel: 'عملاء ومؤسسات غير محدودة',
    features: [
      { label: 'مخططات البلوبرينت المتعددة (Before / During / After)', enabled: true },
      { label: 'محرك الأتمتة ARQ + الدوال المخصصة + Webhooks API', enabled: true },
      { label: 'WhatsApp Cloud API + Meta CAPI + ZATCA Phase 1', enabled: true },
      { label: 'عزل PostgreSQL RLS كامل + مدير حساب مخصص', enabled: true },
    ],
  },
];

export const SubscriptionPage: React.FC<{ defaultTab?: 'subscription' | 'company' }> = ({
  defaultTab = 'subscription',
}) => {
  const navigate = useNavigate();
  const {
    organizations,
    currentOrgId,
    currentOrganization,
    switchOrganization,
    provisionNewOrganization,
    updateOrganizationSubscription,
    leads,
    contacts,
  } = useCrm();

  const [, setActiveSubTab] = useState<'subscription' | 'company'>(defaultTab);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<OrganizationPlan>('Enterprise');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Phase 4: Unified Payment Gateway (Moyasar / Tap / Stripe) state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<BillingProvider>('moyasar');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'Free' | 'Growth' | 'Enterprise'>('Growth');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [lastCheckoutSession, setLastCheckoutSession] = useState<{
    session_id: string;
    provider: string;
    plan_tier: string;
    amount_sar: number;
    checkout_url: string;
  } | null>(null);

  // Phase 4: Transactional Email (SMTP via ARQ Worker) state
  const [smtpTemplateType, setSmtpTemplateType] = useState<
    'employee_invite' | 'invoice_notification' | 'password_reset'
  >('employee_invite');
  const [smtpRecipientEmail, setSmtpRecipientEmail] = useState('employee@crm-one-step.sa');
  const [smtpRecipientName, setSmtpRecipientName] = useState('سعود الدوسري');
  const [isSendingSmtp, setIsSendingSmtp] = useState(false);

  React.useEffect(() => {
    setActiveSubTab(defaultTab);
  }, [defaultTab]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const normalizedCurrentPlan: 'Free' | 'Growth' | 'Enterprise' =
    currentOrganization.plan === 'Free' || currentOrganization.plan === 'Starter'
      ? 'Free'
      : currentOrganization.plan === 'Growth' || currentOrganization.plan === 'Pro'
      ? 'Growth'
      : 'Enterprise';

  const currentOrgCustomersCount =
    leads.filter((l) => (l.org_id || 'org_rawaq_main') === currentOrgId && !l.converted).length +
    contacts.filter((c) => (c.org_id || 'org_rawaq_main') === currentOrgId).length;

  const maxCustomersQuota = normalizedCurrentPlan === 'Free' ? 500 : null;

  const seatsRatio = Math.min(
    100,
    Math.round(
      (currentOrganization.active_users_count / Math.max(1, currentOrganization.seats_limit)) * 100
    )
  );

  const handleToggleAddon = async (key: keyof CrmAddonFlags, label: string) => {
    const nextValue = !currentOrganization.addons[key];
    await updateOrganizationSubscription({
      addons: {
        ...currentOrganization.addons,
        [key]: nextValue,
      },
    });
    triggerToast(
      nextValue
        ? `تم تفعيل «${label}» على مستوى المؤسسة (${currentOrganization.name})`
        : `تم إيقاف «${label}» — سيتم قفل الإضافة ومطالبة المستخدمين بالترقية`
    );
  };

  const handleProvisionNewOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    await provisionNewOrganization(newOrgName.trim(), newOrgPlan);
    setNewOrgName('');
    setShowCreateModal(false);
    triggerToast('تم إنشاء المؤسسة الجديدة وبذر الحقول والأدوار والملفات القياسية بنجاح');
  };

  const handleOpenGatewayCheckout = (planId: 'Free' | 'Growth' | 'Enterprise') => {
    setSelectedUpgradePlan(planId);
    setShowCheckoutModal(true);
  };

  const handleConfirmPaymentCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);
    try {
      const targetSpec =
        SAAS_PLAN_QUOTA_SPECS.find((p) => p.id === selectedUpgradePlan) ||
        SAAS_PLAN_QUOTA_SPECS[2];

      const session = await settingsService.createCheckoutSession({
        orgId: currentOrgId,
        provider: selectedGateway,
        planTier: selectedUpgradePlan,
        billingCycle,
      });

      const updatedAddons: CrmAddonFlags =
        selectedUpgradePlan === 'Free'
          ? { whatsapp_campaigns: false, meta_direct: false, custom_functions: false }
          : selectedUpgradePlan === 'Growth'
          ? { whatsapp_campaigns: true, meta_direct: true, custom_functions: false }
          : { whatsapp_campaigns: true, meta_direct: true, custom_functions: true };

      await updateOrganizationSubscription({
        plan: selectedUpgradePlan,
        seats_limit: targetSpec.maxUsersCount,
        addons: updatedAddons,
      });

      setLastCheckoutSession(session);
      setShowCheckoutModal(false);
      triggerToast(
        `تم تفعيل باقة ${targetSpec.nameAr} عبر بوابة ${selectedGateway.toUpperCase()} وتحديث حصص المؤسسة (${targetSpec.maxUsersLabel})`
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendSmtpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpRecipientEmail.trim()) return;
    setIsSendingSmtp(true);
    try {
      const res = await settingsService.sendTransactionalEmail({
        orgId: currentOrgId,
        templateType: smtpTemplateType,
        toEmail: smtpRecipientEmail.trim(),
        recipientName: smtpRecipientName.trim() || 'عميل Crm-One-step',
        organizationName: currentOrganization.name,
        roleName: 'تنفيذي مبيعات أول',
        invoiceNumber: 'INV-2026-0108',
        invoiceTotal: '17,250.00 ر.س (شامل ضريبة ZATCA 15%)',
        leadUid: 'RWQ-10492',
      });
      triggerToast(res.message);
    } finally {
      setIsSendingSmtp(false);
    }
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <span>الإعدادات والنظام</span>
            <span>/</span>
            <span>الإعدادات العامة</span>
            <span>/</span>
            <span className="text-[#0F172A] font-bold">إدارة المؤسسة، الباقات، وبوابات الدفع</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold text-[#0F172A]">
              إدارة المؤسسة، قيود الباقات (Plan Quotas)، والفوترة
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-mono text-xs font-bold border border-[#BFDBFE]">
              {currentOrganization.org_id} (PostgreSQL RLS)
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              حالة الاشتراك: {currentOrganization.payment_status === 'suspended' ? 'موقوف مؤقتاً' : 'مدفوع ونشط'} • الباقة: {normalizedCurrentPlan}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/super-admin')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>لوحة مالك المنصة (Super Admin)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const other = organizations.find((o) => o.org_id !== currentOrgId);
              if (other) switchOrganization(other.org_id);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            التبديل لمؤسسة أخرى
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إنشاء مؤسسة جديدة (Auto-Provisioning)
          </button>
        </div>
      </div>

      {/* Top 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Current Plan */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">الباقة الحالية وبوابة الدفع</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
              {(currentOrganization.billing_provider || selectedGateway).toUpperCase()} • سنوي (خصم 20%)
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              باقة {normalizedCurrentPlan} ({currentOrganization.plan})
            </h3>
            <div className="text-2xl font-extrabold text-[#2563EB] tabular-nums mt-1">
              {normalizedCurrentPlan === 'Free'
                ? '0 ر.س'
                : normalizedCurrentPlan === 'Growth'
                ? '749 ر.س'
                : '1,990 ر.س'}{' '}
              <span className="text-xs font-normal text-[#64748B]">/ شهرياً</span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              سقف العملاء المسموح: {maxCustomersQuota ? `${currentOrgCustomersCount} / ${maxCustomersQuota} عميل` : `${currentOrgCustomersCount} عميل (غير محدود)`}
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>فرض قيود الباقة تلقائياً في الخادم (FastAPI Plan Quotas)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>دفع إلكتروني موحد عبر Moyasar و Tap و Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>فوترة ضريبية ZATCA المرحلة الأولى (15% + رمز TLV QR)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenGatewayCheckout('Enterprise')}
              className="flex-1 py-2 rounded-lg bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>ترقية الباقة عبر بوابة الدفع</span>
            </button>
            <button
              type="button"
              onClick={() => triggerToast('إيصالات الفوترة الضريبية ZATCA جاهزة للتحميل.')}
              className="px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] font-bold text-xs cursor-pointer"
            >
              إيصالات الدفع
            </button>
          </div>
        </div>

        {/* Card 2: Active Seats */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">مقاعد المستخدمين والتراخيص النشطة</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold tabular-nums">
              {Math.max(0, currentOrganization.seats_limit - currentOrganization.active_users_count)} مقاعد شاغرة
            </span>
          </div>

          <div>
            <div className="text-2xl font-extrabold text-[#0F172A] tabular-nums">
              {currentOrganization.active_users_count} / {currentOrganization.seats_limit} مقعد مخصص
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              معدل الإشغال الحالي يمثل {seatsRatio}% من إجمالي التراخيص المشتراة
            </p>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${seatsRatio}%` }}></div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {Math.max(
                  0,
                  currentOrganization.active_users_count -
                    Math.min(currentOrganization.active_users_count, 1) -
                    (currentOrganization.active_users_count > 3
                      ? Math.floor(currentOrganization.active_users_count * 0.22)
                      : 0)
                )}
              </div>
              <div className="text-[10px] text-[#64748B]">فريق المبيعات</div>
            </div>
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {currentOrganization.active_users_count > 3
                  ? Math.floor(currentOrganization.active_users_count * 0.22)
                  : 0}
              </div>
              <div className="text-[10px] text-[#64748B]">دعم ومحادثات</div>
            </div>
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {Math.min(
                  currentOrganization.active_users_count,
                  currentOrganization.active_users_count > 5 ? 2 : 1
                )}
              </div>
              <div className="text-[10px] text-[#64748B]">مدراء نظام</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                await updateOrganizationSubscription({
                  seats_limit: currentOrganization.seats_limit + 5,
                });
                triggerToast('تمت إضافة 5 مقاعد جديدة بنجاح.');
              }}
              className="flex-1 py-2 rounded-lg bg-[#10B981] text-white font-bold text-xs hover:bg-[#059669] cursor-pointer"
            >
              + شراء مقاعد إضافية
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings/users')}
              className="px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] font-bold text-xs cursor-pointer"
            >
              إدارة المستخدمين
            </button>
          </div>
        </div>

        {/* Card 3: Transactional Email Engine (SMTP via ARQ Worker) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#2563EB]" />
              <span>البريد التفاعلي (SMTP / ARQ Worker)</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
              TLS مفعل • خلفية ARQ
            </span>
          </div>

          <form onSubmit={handleSendSmtpEmail} className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                نوع الإشعار البريدي
              </label>
              <select
                value={smtpTemplateType}
                onChange={(e) =>
                  setSmtpTemplateType(
                    e.target.value as 'employee_invite' | 'invoice_notification' | 'password_reset'
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A]"
              >
                <option value="employee_invite">دعوة موظف جديد للانضمام للمؤسسة</option>
                <option value="invoice_notification">إشعار إصدار فاتورة ضريبية ZATCA (RWQ-xxxxx)</option>
                <option value="password_reset">رابط استعادة كلمة المرور</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#64748B] mb-0.5">اسم المستلم</label>
                <input
                  type="text"
                  value={smtpRecipientName}
                  onChange={(e) => setSmtpRecipientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#64748B] mb-0.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  dir="ltr"
                  value={smtpRecipientEmail}
                  onChange={(e) => setSmtpRecipientEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-xs"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSendingSmtp}
              className="w-full py-2 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] font-bold text-xs border border-[#BFDBFE] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingSmtp ? 'جارٍ الجدولة في ARQ...' : 'إرسال البريد عبر طابور ARQ SMTP'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Phase 4: Server-Side Plan Quotas & Unified Payment Gateway Tiers (Free / Growth / Enterprise) */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              مصفوفة الباقات وقيود الخادم (Server-Side Plan Quotas & Unified Payment Gateways)
            </h3>
            <span className="text-[11px] text-[#64748B]">
              يتم التحقق من حصة المستخدمين وسقف العملاء والميزات (Blueprints / Meta CAPI / WhatsApp / ZATCA) تلقائياً عبر FastAPI Dependencies لكل مؤسسة.
            </span>
          </div>
          {lastCheckoutSession && (
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
              آخر جلسة دفع: {lastCheckoutSession.session_id} ({lastCheckoutSession.provider.toUpperCase()})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAAS_PLAN_QUOTA_SPECS.map((tier) => {
            const isCurrentTier = normalizedCurrentPlan === tier.id;
            return (
              <div
                key={tier.id}
                className={`rounded-xl p-4 border transition-all flex flex-col justify-between space-y-4 ${
                  isCurrentTier
                    ? 'border-[#2563EB] bg-[#EFF6FF]/40 ring-1 ring-[#2563EB]'
                    : 'border-[#E2E8F0] bg-[#F8FAFC]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0F172A]">{tier.nameAr}</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E2E8F0] text-[10px] font-bold text-[#2563EB]">
                      {tier.badge}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-[#0F172A] tabular-nums">
                      {tier.monthlyPriceSar.toLocaleString()} ر.س
                    </span>
                    <span className="text-xs text-[#64748B]">/ شهرياً</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-xs space-y-1">
                    <div className="font-bold text-[#0F172A]">• المقاعد: {tier.maxUsersLabel}</div>
                    <div className="font-bold text-[#2563EB]">• العملاء: {tier.maxCustomersLabel}</div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {tier.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {feat.enabled ? (
                          <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={feat.enabled ? 'text-[#0F172A]' : 'text-slate-400 line-through'}>
                          {feat.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenGatewayCheckout(tier.id)}
                  className={`w-full py-2 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                    isCurrentTier
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                  }`}
                >
                  {isCurrentTier
                    ? '✓ الباقة المفعلة حالياً (تجديد / تغيير البوابة)'
                    : `الترقية إلى ${tier.nameAr} عبر الدفع الإلكتروني`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle 3 Paid Add-on Feature Flag Cards */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              الإضافات المأجورة وبوابات التكامل (Paid Add-ons & Integration Gates)
            </h3>
            <span className="text-[11px] text-[#64748B]">
              تفعيل وتخصيص الوحدات المتقدمة حسب احتياجات مؤسستك مع فوترة شهرية مرنة ونظام عالي متكامل.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-xs font-bold">
            {Object.values(currentOrganization.addons).filter(Boolean).length} إضافات نشطة حالياً
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Add-on 1: WhatsApp */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#0F172A]">إضافة واتساب الأعمال والحملات الذكية</span>
              <input
                type="checkbox"
                checked={currentOrganization.addons.whatsapp_campaigns}
                onChange={() => handleToggleAddon('whatsapp_campaigns', 'واتساب والحملات الذكية')}
                className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
              />
            </div>
            <div className="text-[11px] text-[#64748B]">Smart WhatsApp Broadcast & Unified Campaigns Engine</div>
            <div className="text-xs font-bold text-[#2563EB]">مفعلة • اشتراك شهري (650 ر.س / شهرياً)</div>
            <div className="text-xs text-[#475569] space-y-1 pt-2 border-t border-[#E2E8F0]">
              <div>• سعة الحصة الحالية: 50,000 رسالة / شهر</div>
              <div>• سقف الإرسال الفوري: Tier 3 (100k عميل/يوم)</div>
            </div>
          </div>

          {/* Add-on 2: Meta Direct */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#0F172A]">الربط المباشر مع منظومة ميتا (Meta CAPI)</span>
              <input
                type="checkbox"
                checked={currentOrganization.addons.meta_direct}
                onChange={() => handleToggleAddon('meta_direct', 'الربط المباشر مع ميتا')}
                className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
              />
            </div>
            <div className="text-[11px] text-[#64748B]">Meta Omnichannel & Conversions API Gateway</div>
            <div className="text-xs font-bold text-[#10B981]">مفعلة • متضمن بباقتي Growth و Enterprise</div>
            <div className="text-xs text-[#475569] space-y-1 pt-2 border-t border-[#E2E8F0]">
              <div>• جودة مطابقة الأحداث (Event Quality): 9.2 / 10 (ممتاز)</div>
              <div>• توريث المعرّف الموحد RWQ-xxxxx مع SHA-256</div>
            </div>
          </div>

          {/* Add-on 3: Custom Functions */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#0F172A]">محرك الدوال المخصصة وسيرفرلس</span>
              <input
                type="checkbox"
                checked={currentOrganization.addons.custom_functions}
                onChange={() => handleToggleAddon('custom_functions', 'محرك الدوال المخصصة')}
                className="w-5 h-5 rounded text-[#2563EB] cursor-pointer"
              />
            </div>
            <div className="text-[11px] text-[#64748B]">Developer Space & Serverless Functions Sandbox</div>
            <div className="text-xs font-bold text-[#10B981]">مفعلة • سعة 100k استدعاء / شهر</div>
            <div className="text-xs text-[#475569] space-y-1 pt-2 border-t border-[#E2E8F0]">
              <div>• الدوال المنشورة والنشطة: 4 دالات نشطة</div>
              <div>• متوسط زمن الاستجابة (Latency): 140ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Table: Multi-Tenant Organizations */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden space-y-3">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              المؤسسات والبيئات المرتبطة بحسابك (Multi-Tenant Organizations)
            </h3>
            <span className="text-xs text-[#64748B]">
              يمكن لحساب بريدك الإلكتروني الوصول إلى عدة مؤسسات وبيئات عمل مع عزل تام لقواعد البيانات (PostgreSQL RLS) والتحكم بالصلاحيات.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إنشاء بيئة عمل جديدة
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-semibold text-[#64748B]">
                <th className="px-4 py-3">رمز المؤسسة (Org ID)</th>
                <th className="px-3 py-3">اسم المؤسسة والكيان التجاري</th>
                <th className="px-3 py-3">نوع البيئة</th>
                <th className="px-3 py-3">الدور الوظيفي والصلاحية</th>
                <th className="px-3 py-3">الباقة النشطة</th>
                <th className="px-3 py-3">عدد المقاعد</th>
                <th className="px-3 py-3">حالة الدفع والاشتراك</th>
                <th className="px-4 py-3 text-center">الإجراء المباشر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {organizations.map((org) => {
                const isCurrent = org.org_id === currentOrgId;
                const isSuspended = org.is_active === false || org.payment_status === 'suspended';
                return (
                  <tr
                    key={org.org_id}
                    className={`hover:bg-[#F8FAFC] transition-colors ${
                      isCurrent ? 'bg-[#EFF6FF]/60 font-bold' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#2563EB]">{org.org_id}</td>
                    <td className="px-3 py-3 text-[#0F172A]">
                      <div className="flex items-center gap-2">
                        <span>{org.name}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] text-[10px]">
                            المؤسسة الحالية
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B]">الرياض، المملكة العربية السعودية</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                        إنتاج مباشر (Production)
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#475569]">مدير نظام عام (Super Admin)</td>
                    <td className="px-3 py-3 font-semibold">{org.plan}</td>
                    <td className="px-3 py-3 tabular-nums font-bold">
                      {org.active_users_count} / {org.seats_limit} مستخدم
                    </td>
                    <td className="px-3 py-3">
                      {isSuspended ? (
                        <span className="flex items-center gap-1.5 text-red-600 font-bold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          موقوف مؤقتاً
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[#10B981]">
                          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                          مدفوع ونشط ({(org.billing_provider || 'moyasar').toUpperCase()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isCurrent ? (
                        <span className="text-xs text-[#2563EB] font-bold">نشطة الآن ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchOrganization(org.org_id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-bold text-xs cursor-pointer"
                        >
                          دخول لهذه المؤسسة ←
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Payment Gateway Checkout Modal (Moyasar / Tap / Stripe) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                بوابة الدفع والاشتراكات الموحدة (Moyasar / Tap / Stripe)
              </h2>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPaymentCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. اختر بوابة الدفع المعتمدة
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'moyasar', label: 'مُيسّر (Moyasar)', sub: 'مدى / Apple Pay / فيزا' },
                      { id: 'tap', label: 'تاب (Tap Payments)', sub: 'الخليج والشرق الأوسط' },
                      { id: 'stripe', label: 'سترايب (Stripe)', sub: 'بطاقات دولية وعالمية' },
                    ] as const
                  ).map((gw) => (
                    <button
                      type="button"
                      key={gw.id}
                      onClick={() => setSelectedGateway(gw.id)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        selectedGateway === gw.id
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">{gw.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{gw.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. الباقة المستهدفة
                  </label>
                  <select
                    value={selectedUpgradePlan}
                    onChange={(e) =>
                      setSelectedUpgradePlan(e.target.value as 'Free' | 'Growth' | 'Enterprise')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900"
                  >
                    <option value="Free">Free (حتى 3 مستخدمين و500 عميل)</option>
                    <option value="Growth">Growth (حتى 15 مستخدماً + WhatsApp + CAPI)</option>
                    <option value="Enterprise">Enterprise (غير محدود + Blueprints + API)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. دورة الفوترة
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900"
                  >
                    <option value="yearly">سنوي (خصم 20%)</option>
                    <option value="monthly">شهري مرن</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">المؤسسة المستفيدة:</span>
                  <span className="font-bold text-slate-900">
                    {currentOrganization.name} ({currentOrgId})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">بوابة الدفع المختارة:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {selectedGateway.toUpperCase()} Checkout Session
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-bold text-slate-800">الإجمالي المستحق (شامل ضريبة ZATCA 15%):</span>
                  <span className="text-base font-extrabold text-blue-700 tabular-nums">
                    {(
                      (SAAS_PLAN_QUOTA_SPECS.find((p) => p.id === selectedUpgradePlan) ||
                        SAAS_PLAN_QUOTA_SPECS[1])[
                        billingCycle === 'yearly' ? 'yearlyPriceSar' : 'monthlyPriceSar'
                      ]
                    ).toLocaleString()}{' '}
                    ر.س
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  {isProcessingPayment
                    ? 'جارٍ إنشاء جلسة الدفع وتفعيل الاشتراك...'
                    : `إتمام الدفع وتفعيل ${selectedUpgradePlan}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                إنشاء مؤسسة جديدة (Auto-Provisioning)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionNewOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المؤسسة أو الكيان التجاري
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="مثال: شركة آفاق التقنية المتقدمة"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الباقة المختارة</label>
                <select
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value as OrganizationPlan)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="Enterprise">Enterprise (غير محدود + Blueprints + API)</option>
                  <option value="Growth">Growth (حتى 15 مستخدماً + WhatsApp + CAPI)</option>
                  <option value="Free">Free (حتى 3 مستخدمين و500 عميل)</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
                <div className="font-bold">التجهيز التلقائي (Auto-Provisioning):</div>
                <div>
                  سيتم إنشاء مخطط سحابي مستقل (PostgreSQL RLS) وبذر الحقول، الأدوار، الملفات القياسية الـ 5، والبلوبرينت فورياً.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  إنشاء وتفعيل المنشأة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
