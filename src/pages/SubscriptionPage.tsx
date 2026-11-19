import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronLeft,
  Code2,
  CreditCard,
  Layers,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { CrmAddonFlags, OrganizationPlan } from '../types/crm';

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
  } = useCrm();

  const [activeSubTab, setActiveSubTab] = useState<'subscription' | 'company'>(defaultTab);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<OrganizationPlan>('Enterprise');
  const [showCreateModal, setShowCreateModal] = useState(false);

  React.useEffect(() => {
    setActiveSubTab(defaultTab);
  }, [defaultTab]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const seatsRatio = Math.min(
    100,
    Math.round((currentOrganization.active_users_count / Math.max(1, currentOrganization.seats_limit)) * 100)
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

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-bounce">
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
            <span className="text-[#0F172A] font-bold">إدارة المؤسسة والباقات</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#0F172A]">
              إدارة المؤسسة، الباقات، والإضافات المأجورة
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-mono text-xs font-bold border border-[#BFDBFE]">
              {currentOrganization.org_id} (Isolated Schema)
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              حالة الاشتراك: نشط وساري • مركز البيانات: سحابة الرياض - معتمد NCA
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            <span className="text-xs text-[#64748B]">الباقة الحالية ومستوى الخدمة</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">سنوي - خصم 20%</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">باقة المؤسسات Enterprise (Tier)</h3>
            <div className="text-2xl font-extrabold text-[#2563EB] tabular-nums mt-1">
              14,400 ر.س <span className="text-xs font-normal text-[#64748B]">/ سنوياً</span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">تاريخ التجديد القادم: 15 مارس 2025 (مبقي 8 أشهر)</p>
          </div>

          <div className="space-y-2 text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>دعم مخصص 24/7 مع مدير حساب خاص</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>اتفاقية مستوى الخدمة SLA مضمونة بنسبة 99.9%</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>نسخ احتياطي آلي مستمر كل ساعة مع استرجاع لحظي</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => triggerToast('تم توجيهك لصفحة ترقية وتغيير الباقة.')}
              className="flex-1 py-2 rounded-lg bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] cursor-pointer"
            >
              ترقية الباقة أو تغيير الدورة
            </button>
            <button
              type="button"
              onClick={() => triggerToast('إيصالات الفوترة الضريبية جاهزة للتحميل.')}
              className="px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] font-bold text-xs cursor-pointer"
            >
              بيانات الفوترة
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
            <p className="text-xs text-[#64748B] mt-1">معدل الإشغال الحالي يمثل {seatsRatio}% من إجمالي التراخيص المشتراة</p>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${seatsRatio}%` }}></div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {Math.max(0, currentOrganization.active_users_count - Math.min(currentOrganization.active_users_count, 1) - (currentOrganization.active_users_count > 3 ? Math.floor(currentOrganization.active_users_count * 0.22) : 0))}
              </div>
              <div className="text-[10px] text-[#64748B]">فريق المبيعات</div>
            </div>
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {currentOrganization.active_users_count > 3 ? Math.floor(currentOrganization.active_users_count * 0.22) : 0}
              </div>
              <div className="text-[10px] text-[#64748B]">دعم ومحادثات</div>
            </div>
            <div>
              <div className="font-bold text-[#0F172A] tabular-nums">
                {Math.min(currentOrganization.active_users_count, currentOrganization.active_users_count > 5 ? 2 : 1)}
              </div>
              <div className="text-[10px] text-[#64748B]">مدراء نظام</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                await updateOrganizationSubscription({ seats_limit: currentOrganization.seats_limit + 5 });
                triggerToast('تمت إضافة 5 مقاعد جديدة بنجاح.');
              }}
              className="flex-1 py-2 rounded-lg bg-[#10B981] text-white font-bold text-xs hover:bg-[#059669] cursor-pointer"
            >
              + شراء مقاعد إضافية
            </button>
            <button
              type="button"
              onClick={() => triggerToast('تم تحديث إعدادات وتخصيص مقاعد المستخدمين.')}
              className="px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] font-bold text-xs cursor-pointer"
            >
              إدارة التخصيص
            </button>
          </div>
        </div>

        {/* Card 3: Monthly Cloud Quotas */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">الاستهلاك الشهري والموارد السحابية</span>
            <span className="text-[11px] text-[#2563EB] font-bold">دورة الفوترة: يوليو 2026</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">رسائل واتساب التسويقية (Broadcast)</span>
                <span className="font-bold text-[#0F172A] tabular-nums">42,500 / 50,000 (85%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">تشغيل الدوال المخصصة (Serverless Functions)</span>
                <span className="font-bold text-[#0F172A] tabular-nums">28,400 / 100,000 (28%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '28%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">مساحة التخزين السحابية للمرفقات</span>
                <span className="font-bold text-[#0F172A] tabular-nums">34.2 GB / 100 GB (34%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: '34%' }}></div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => alert('تم شحن الرصيد الإضافي بنجاح.')}
            className="w-full py-2 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] font-bold text-xs border border-[#BFDBFE] cursor-pointer"
          >
            ⚡ شحن رصيد فوري أو ترقية السعة
          </button>
        </div>
      </div>

      {/* Middle 3 Paid Add-on Feature Flag Cards */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              الإضافات المأجورة وبوابات التكامل (Paid Add-ons & Integration Gates)
            </h3>
            <span className="text-[11px] text-[#64748B]">تفعيل وتخصيص الوحدات المتقدمة حسب احتياجات مؤسستك مع فوترة شهرية مرنة ونظام عالي متكامل.</span>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-xs font-bold">
            3 إضافات نشطة حالياً
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
            <div className="text-xs font-bold text-[#2563EB]">مفعلرة • اشتراك شهري (650 ر.س / شهرياً)</div>
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
            <div className="text-xs font-bold text-[#10B981]">مفعلة • متضمن بالباقة</div>
            <div className="text-xs text-[#475569] space-y-1 pt-2 border-t border-[#E2E8F0]">
              <div>• جودة مطابقة الأحداث (Event Quality): 9.2 / 10 (ممتاز)</div>
              <div>• الحسابات الإعلانية المتاحة: 2 حسابات نشطة</div>
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
            <h3 className="text-sm font-bold text-[#0F172A]">المؤسسات والبيئات المرتبطة بحسابك (Multi-Tenant Organizations)</h3>
            <span className="text-xs text-[#64748B]">يمكن لساب بريدك الإلكتروني الوصول إلى عدة مؤسسات وبيئات عمل مع عزل تام لقواعد البيانات والتحكم بالصلاحيات.</span>
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
                <th className="px-3 py-3">حالة الاتصال</th>
                <th className="px-4 py-3 text-center">الإجراء المباشر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {organizations.map((org) => {
                const isCurrent = org.org_id === currentOrgId;
                return (
                  <tr key={org.org_id} className={`hover:bg-[#F8FAFC] transition-colors ${isCurrent ? 'bg-[#EFF6FF]/60 font-bold' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-[#2563EB]">{org.org_id}</td>
                    <td className="px-3 py-3 text-[#0F172A]">
                      <div className="flex items-center gap-2">
                        <span>{org.name}</span>
                        {isCurrent && <span className="px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] text-[10px]">المؤسسة الحالية</span>}
                      </div>
                      <div className="text-[11px] text-[#64748B]">الرياض، المملكة العربية السعودية</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">إنتاج مباشر (Production)</span>
                    </td>
                    <td className="px-3 py-3 text-[#475569]">مدير نظام عام (Super Admin)</td>
                    <td className="px-3 py-3 font-semibold">{org.plan}</td>
                    <td className="px-3 py-3 tabular-nums font-bold">{org.active_users_count} مستخدم</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 text-[#10B981]">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                        نشط ومتصل حالياً
                      </span>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المؤسسة أو الكيان التجاري</label>
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
                  <option value="Enterprise">Enterprise (باقة المؤسسات الكبرى)</option>
                  <option value="Pro">Pro (باقة المحترفين)</option>
                  <option value="Starter">Starter (باقة البداية)</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
                <div className="font-bold">التجهيز التلقائي (Auto-Provisioning):</div>
                <div>سيتم إنشاء مخطط سحابي مستقل (Isolated Schema) وبذر الحقول، الأدوار، الملفات القياسية، والبلوبرينت فورياً.</div>
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
