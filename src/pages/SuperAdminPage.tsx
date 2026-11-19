import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { settingsService } from '../services/settingsService';
import { OrganizationPlan, PaymentStatus } from '../types/crm';

interface SuperAdminTenantRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  vat_number: string;
  base_currency: string;
  plan_tier: 'Free' | 'Growth' | 'Enterprise';
  seat_limit: number;
  users_count: number;
  customers_count: number;
  payment_status: PaymentStatus;
  billing_provider?: string;
  is_active: boolean;
  created_at: string;
}

function normalizePlan(plan: string): 'Free' | 'Growth' | 'Enterprise' {
  const cleaned = (plan || '').trim().toLowerCase();
  if (cleaned === 'free' || cleaned === 'starter') return 'Free';
  if (cleaned === 'growth' || cleaned === 'pro') return 'Growth';
  return 'Enterprise';
}

export const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    organizations,
    currentOrgId,
    currentUser,
    leads,
    contacts,
    users,
    updateOrganizationSubscription,
    switchOrganization,
  } = useCrm();

  const [isPlatformOwnerAuthorized, setIsPlatformOwnerAuthorized] = useState<boolean>(
    currentUser?.is_super_admin !== false
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'Free' | 'Growth' | 'Enterprise'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tenants, setTenants] = useState<SuperAdminTenantRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const fallbackRows: SuperAdminTenantRow[] = useMemo(() => {
    return organizations.map((org) => {
      const orgLeads = leads.filter(
        (l) => (l.org_id || 'org_rawaq_main') === org.org_id && !l.converted
      ).length;
      const orgContacts = contacts.filter(
        (c) => (c.org_id || 'org_rawaq_main') === org.org_id
      ).length;
      const orgUsers = users.filter((u) => (u.org_id || 'org_rawaq_main') === org.org_id).length;
      const normalized = normalizePlan(org.plan);

      return {
        id: org.id || org.org_id,
        org_id: org.org_id,
        name: org.name,
        slug: org.org_id,
        vat_number: org.vat_number || '310122393500003',
        base_currency: 'SAR',
        plan_tier: normalized,
        seat_limit:
          org.seats_limit ||
          (normalized === 'Free' ? 3 : normalized === 'Growth' ? 15 : 50),
        users_count: Math.max(org.active_users_count || 1, orgUsers),
        customers_count: org.customers_count ?? orgLeads + orgContacts,
        payment_status: org.payment_status || 'paid',
        billing_provider: org.billing_provider || 'moyasar',
        is_active: org.is_active !== false,
        created_at: org.created_at || '2026-01-15',
      };
    });
  }, [organizations, leads, contacts, users]);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const data = await settingsService.listSuperAdminOrganizations({
        fallbackOrganizations: fallbackRows,
      });
      setTenants(
        data.map((item) => ({
          ...item,
          org_id: item.org_id || item.slug || item.id,
          plan_tier: normalizePlan(item.plan_tier),
          payment_status: (item.payment_status as PaymentStatus) || 'paid',
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, [fallbackRows]);

  const handleChangePlanTier = async (
    tenant: SuperAdminTenantRow,
    newTier: 'Free' | 'Growth' | 'Enterprise'
  ) => {
    const newSeatLimit = newTier === 'Free' ? 3 : newTier === 'Growth' ? 15 : 50;
    await settingsService.updateSuperAdminOrganization({
      orgId: tenant.id,
      planTier: newTier,
      seatLimit: newSeatLimit,
      onPreviewApply: () => {
        setTenants((prev) =>
          prev.map((row) =>
            row.org_id === tenant.org_id
              ? { ...row, plan_tier: newTier, seat_limit: newSeatLimit }
              : row
          )
        );
      },
    });

    if (tenant.org_id === currentOrgId) {
      await updateOrganizationSubscription({
        plan: newTier as OrganizationPlan,
        seats_limit: newSeatLimit,
      });
    }

    triggerToast(
      `تم تغيير باقة «${tenant.name}» يدوياً إلى ${newTier} (حد المقاعد: ${newSeatLimit})`
    );
  };

  const handleToggleActiveStatus = async (tenant: SuperAdminTenantRow) => {
    const nextActive = !tenant.is_active;
    const nextPaymentStatus: PaymentStatus = nextActive ? 'paid' : 'suspended';

    await settingsService.updateSuperAdminOrganization({
      orgId: tenant.id,
      isActive: nextActive,
      paymentStatus: nextPaymentStatus,
      onPreviewApply: () => {
        setTenants((prev) =>
          prev.map((row) =>
            row.org_id === tenant.org_id
              ? { ...row, is_active: nextActive, payment_status: nextPaymentStatus }
              : row
          )
        );
      },
    });

    triggerToast(
      nextActive
        ? `تم تفعيل حساب شركة «${tenant.name}» واستئناف صلاحيات الدخول`
        : `تم إيقاف شركة «${tenant.name}» مؤقتاً وتعليق الجلسات النشطة`
    );
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesPlan = planFilter === 'ALL' || t.plan_tier === planFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.org_id.toLowerCase().includes(q) ||
      t.vat_number.toLowerCase().includes(q);
    return matchesPlan && matchesSearch;
  });

  const totalUsersAcrossPlatform = tenants.reduce((acc, t) => acc + t.users_count, 0);
  const totalCustomersAcrossPlatform = tenants.reduce((acc, t) => acc + t.customers_count, 0);
  const activeCompaniesCount = tenants.filter((t) => t.is_active).length;

  if (!isPlatformOwnerAuthorized) {
    return (
      <div
        dir="rtl"
        className="w-full min-h-[80vh] flex items-center justify-center p-6 bg-[#F8FAFC]"
      >
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            منطقة محمية — مخصصة لمالك المنصة (Super Admin) فقط
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            يتطلب الوصول إلى المسار <span className="font-mono font-bold">/super-admin</span> صلاحية{' '}
            <span className="font-mono font-bold">is_super_admin = true</span> في جدول المستخدمين.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPlatformOwnerAuthorized(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              تفعيل صلاحية مالك المنصة (is_super_admin)
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4 bg-[#F8FAFC] min-h-screen text-[13px]">
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>بوابة مالك المنصة السحابية (SaaS Platform Owner Console)</span>
            <span>•</span>
            <span className="font-mono text-amber-300">/api/v1/super-admin/organizations</span>
          </div>
          <h1 className="text-lg font-extrabold">
            لوحة تحكم مالك المنصة (Super Admin) — إدارة الشركات المشتركة والباقات
          </h1>
          <p className="text-xs text-slate-300">
            مراقبة جميع الشركات المستأجرة (Multi-Tenant Organizations)، فرض حدود الباقات (Free / Growth / Enterprise)، وتفعيل أو إيقاف الشركات فورياً.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadTenants()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث القائمة</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPlatformOwnerAuthorized(false)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold cursor-pointer"
          >
            محاكاة حجب الصلاحية (Non-SuperAdmin)
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings/subscription')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
          >
            إعدادات الاشتراكات والدفع ←
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>إجمالي الشركات المشتركة</span>
            <Building2 className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 tabular-nums">
            {tenants.length} شركات
          </div>
          <div className="text-[11px] text-[#10B981] font-semibold mt-1">
            {activeCompaniesCount} نشطة • {tenants.length - activeCompaniesCount} موقوفة
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>إجمالي المستخدمين (Seats)</span>
            <Users className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 tabular-nums">
            {totalUsersAcrossPlatform} مستخدم
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            عبر جميع المستأجرين المعزولين بـ PostgreSQL RLS
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>إجمالي سجلات العملاء (RWQ-xxxxx)</span>
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 tabular-nums">
            {totalCustomersAcrossPlatform.toLocaleString()} عميل
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            عملاء محتملون وجهات اتصال بمعرّف موحد دائم
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>حالة التحصيل وبوابات الدفع</span>
            <CreditCard className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-extrabold text-[#10B981] mt-2 tabular-nums">
            Moyasar / Tap / Stripe
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            تفعيل وإيقاف آلي عبر Webhooks الدفع
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الشركة، المعرّف، أو الرقم الضريبي..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
              {(['ALL', 'Free', 'Growth', 'Enterprise'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPlanFilter(tier)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    planFilter === tier
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {tier === 'ALL' ? 'جميع الباقات' : tier}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-[#64748B] font-semibold">
            عرض {filteredTenants.length} من أصل {tenants.length} شركة مشتركة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                <th className="px-4 py-3">الشركة المستأجرة (Tenant)</th>
                <th className="px-3 py-3">الرقم الضريبي (ZATCA)</th>
                <th className="px-3 py-3">الباقة الحالية (Plan Tier)</th>
                <th className="px-3 py-3">المستخدمون (Seats Quota)</th>
                <th className="px-3 py-3">عدد العملاء (Customers Quota)</th>
                <th className="px-3 py-3">حالة الدفع والبوابة</th>
                <th className="px-3 py-3">تغيير الباقة يدوياً</th>
                <th className="px-4 py-3 text-center">تفعيل / إيقاف الشركة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredTenants.map((tenant) => {
                const maxCustomers = tenant.plan_tier === 'Free' ? '500' : 'غير محدود';
                return (
                  <tr key={tenant.org_id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#0F172A]">{tenant.name}</div>
                      <div className="text-[11px] font-mono text-[#2563EB]">{tenant.org_id}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[#475569]">{tenant.vat_number}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          tenant.plan_tier === 'Enterprise'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : tenant.plan_tier === 'Growth'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {tenant.plan_tier}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums font-bold text-[#0F172A]">
                      {tenant.users_count} / {tenant.seat_limit} مستخدم
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className="font-bold text-[#0F172A]">{tenant.customers_count}</span>{' '}
                      <span className="text-[#64748B]">/ {maxCustomers}</span>
                    </td>
                    <td className="px-3 py-3">
                      {tenant.is_active && tenant.payment_status !== 'suspended' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          مدفوع ({(tenant.billing_provider || 'moyasar').toUpperCase()})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 font-bold text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          موقوف (Suspended)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={tenant.plan_tier}
                        onChange={(e) =>
                          void handleChangePlanTier(
                            tenant,
                            e.target.value as 'Free' | 'Growth' | 'Enterprise'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
                      >
                        <option value="Free">Free (3 مستخدمين / 500 عميل)</option>
                        <option value="Growth">Growth (15 مستخدماً / WhatsApp+CAPI)</option>
                        <option value="Enterprise">Enterprise (غير محدود + Blueprints)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleActiveStatus(tenant)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                            tenant.is_active
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {tenant.is_active ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>إيقاف الشركة</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>تفعيل الشركة</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            switchOrganization(tenant.org_id);
                            navigate('/');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-bold text-xs cursor-pointer"
                        >
                          معاينة
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
