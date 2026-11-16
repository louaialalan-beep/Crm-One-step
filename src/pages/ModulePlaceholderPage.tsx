import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Check, Layers, Plus, RotateCcw, Shield, Trash2 } from 'lucide-react';
import { ROUTE_METADATA, SIDEBAR_MODULES } from '../config/navigation';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { calculatePipelineSummary, formatCurrencySAR } from '../utils/formatters';

export const ModulePlaceholderPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const meta = ROUTE_METADATA[path] ?? {
    title: 'وحدة النظام',
    section: 'رواق CRM',
    description: 'صفحة مهيأة ضمن البنية التحتية للنظام وجاهزة للتشغيل الفعلي.',
  };

  const {
    leads,
    contacts,
    accounts,
    deals,
    quotes,
    salesOrders,
    invoices,
    tasks,
    profiles,
    roles,
    customFields,
    blueprints,
    workflows,
    recycleBin,
    activeProfile,
    setActiveProfileId,
    canViewField,
    createProfile,
    deleteProfile,
    restoreRecycleItem,
    toggleTaskStatus,
  } = useCrm();

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [profileError, setProfileError] = useState('');

  const billingGroup = SIDEBAR_MODULES.find((m) => m.id === 'billing');
  const settingsGroup = SIDEBAR_MODULES.find((m) => m.id === 'settings');
  const isBillingRoute = ['/quotes', '/sales-orders', '/invoices'].includes(path);
  const isSettingsRoute = path.startsWith('/settings');

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      setProfileError('يرجى إدخال اسم ملف الصلاحيات');
      return;
    }
    setProfileError('');
    await createProfile({ name: newProfileName, description: newProfileDesc });
    setNewProfileName('');
    setNewProfileDesc('');
  };

  const renderSubTabs = () => {
    const items = isBillingRoute
      ? billingGroup?.subItems
      : isSettingsRoute
        ? settingsGroup?.subItems
        : undefined;
    if (!items) return null;

    return (
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-1.5">
        {items.map((sub) => (
          <NavLink
            key={sub.id}
            to={sub.path}
            end
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`
            }
          >
            {sub.label}
          </NavLink>
        ))}
      </div>
    );
  };

  const renderModuleBody = () => {
    switch (path) {
      case '/leads':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
              <span className="text-[14px] font-semibold text-[#0F172A]">
                سجل العملاء المحتملين ({leads.length})
              </span>
              <span className="text-[12px] text-[#64748B]">معرفات RWQ متسلسلة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">المعرف</th>
                    <th className="px-3 py-2.5">الاسم</th>
                    <th className="px-3 py-2.5">الشركة</th>
                    <th className="px-3 py-2.5">البريد الإلكتروني</th>
                    <th className="px-3 py-2.5">القيمة المقدرة</th>
                    <th className="px-3 py-2.5">مؤشر الذكاء</th>
                    <th className="px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {leads.map((l) => (
                    <tr key={l.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums">{l.unique_id}</td>
                      <td className="px-3 py-2 font-semibold text-[#0F172A]">{l.fullName}</td>
                      <td className="px-3 py-2 text-[#475569]">{l.company || l.city || '—'}</td>
                      <td className="px-3 py-2 text-[#64748B] tabular-nums">{l.email || '—'}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatCurrencySAR(l.estimatedValue)}</td>
                      <td className="px-3 py-2 tabular-nums text-[#6366F1] font-semibold">{l.aiScore}/100</td>
                      <td className="px-4 py-2"><StatusBadge label={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/contacts':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              جهات الاتصال المسجلة ({contacts.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">الاسم الكامل</th>
                    <th className="px-3 py-2.5">المنصب</th>
                    <th className="px-3 py-2.5">الشركة</th>
                    <th className="px-3 py-2.5">الجوال</th>
                    <th className="px-4 py-2.5">المدينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {contacts.map((c) => (
                    <tr key={c.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#0F172A]">{c.fullName}</td>
                      <td className="px-3 py-2 text-[#475569]">{c.jobTitle || '—'}</td>
                      <td className="px-3 py-2 text-[#2563EB] font-medium">{c.accountName}</td>
                      <td className="px-3 py-2 text-[#64748B] tabular-nums" dir="ltr">{c.phone || '—'}</td>
                      <td className="px-4 py-2 text-[#64748B]">{c.city || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/accounts':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              الشركات والحسابات المؤسسية ({accounts.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">اسم الشركة</th>
                    <th className="px-3 py-2.5">القطاع</th>
                    <th className="px-3 py-2.5">التصنيف</th>
                    <th className="px-3 py-2.5">الإيراد السنوي</th>
                    <th className="px-4 py-2.5">مدير الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#0F172A]">{acc.name}</td>
                      <td className="px-3 py-2 text-[#475569]">{acc.industry}</td>
                      <td className="px-3 py-2"><StatusBadge label={acc.tier} /></td>
                      <td className="px-3 py-2 font-semibold tabular-nums">
                        {canViewField('accounts', 'annualRevenue')
                          ? formatCurrencySAR(acc.annualRevenue)
                          : 'محجوب (FLS)'}
                      </td>
                      <td className="px-4 py-2 text-[#475569]">{acc.accountManager}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/deals':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              جميع الصفقات ({deals.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">مسمى الصفقة</th>
                    <th className="px-3 py-2.5">الحساب</th>
                    <th className="px-3 py-2.5">القيمة</th>
                    <th className="px-3 py-2.5">الاحتمالية</th>
                    <th className="px-3 py-2.5">المرحلة</th>
                    <th className="px-4 py-2.5">تاريخ الإغلاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {deals.map((d) => (
                    <tr key={d.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#0F172A]">{d.title}</td>
                      <td className="px-3 py-2 text-[#475569]">{d.accountName}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">
                        {canViewField('deals', 'amount')
                          ? formatCurrencySAR(d.amount, d.currency)
                          : 'محجوب (FLS)'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[#64748B]">{d.probability}%</td>
                      <td className="px-3 py-2"><StatusBadge label={d.stage} /></td>
                      <td className="px-4 py-2 tabular-nums text-[#64748B]">{d.closeDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/quotes':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              عروض الأسعار ({quotes.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">رقم العرض</th>
                    <th className="px-3 py-2.5">الموضوع</th>
                    <th className="px-3 py-2.5">الشركة</th>
                    <th className="px-3 py-2.5">الإجمالي</th>
                    <th className="px-3 py-2.5">صالح حتى</th>
                    <th className="px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {quotes.map((q) => (
                    <tr key={q.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums">{q.quoteNumber}</td>
                      <td className="px-3 py-2 font-semibold text-[#0F172A]">{q.subject}</td>
                      <td className="px-3 py-2 text-[#475569]">{q.accountName}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatCurrencySAR(q.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums text-[#64748B]">{q.validUntil}</td>
                      <td className="px-4 py-2"><StatusBadge label={q.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/sales-orders':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              أوامر المبيعات ({salesOrders.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">رقم الأمر</th>
                    <th className="px-3 py-2.5">الشركة</th>
                    <th className="px-3 py-2.5">القيمة</th>
                    <th className="px-3 py-2.5">موعد التسليم</th>
                    <th className="px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {salesOrders.map((so) => (
                    <tr key={so.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums">{so.orderNumber}</td>
                      <td className="px-3 py-2 font-semibold text-[#0F172A]">{so.accountName}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatCurrencySAR(so.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums text-[#64748B]">{so.deliveryDate}</td>
                      <td className="px-4 py-2"><StatusBadge label={so.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/invoices':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="border-b border-[#E2E8F0] px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              الفواتير المصدرة ({invoices.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">رقم الفاتورة</th>
                    <th className="px-3 py-2.5">الشركة</th>
                    <th className="px-3 py-2.5">الإجمالي</th>
                    <th className="px-3 py-2.5">المبلغ المحصل</th>
                    <th className="px-3 py-2.5">تاريخ الاستحقاق</th>
                    <th className="px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 font-semibold text-[#0F172A]">{inv.accountName}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{formatCurrencySAR(inv.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums text-[#10B981] font-semibold">
                        {canViewField('invoices', 'paidAmount')
                          ? formatCurrencySAR(inv.paidAmount)
                          : 'محجوب (FLS)'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[#64748B]">{inv.dueDate}</td>
                      <td className="px-4 py-2"><StatusBadge label={inv.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/tasks':
        return (
          <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
            <div className="px-4 py-3 text-[14px] font-semibold text-[#0F172A]">
              قائمة المهام والأنشطة ({tasks.length})
            </div>
            {tasks.map((task) => {
              const done = task.status === 'مكتملة';
              return (
                <div key={task.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#F8FAFC]">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`تبديل حالة المهمة ${task.title}`}
                      onClick={() => void toggleTaskStatus(task.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                        done ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {done && <Check className="h-3 w-3 stroke-[2.5]" />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-semibold ${done ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'}`}>
                        {task.title}
                      </p>
                      <p className="text-[12px] text-[#64748B]">
                        {task.relatedTo} · المسؤول: {task.assignedToName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-[#64748B] tabular-nums">{task.dueDate}</span>
                    <StatusBadge label={task.status} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case '/reports':
      case '/analytics': {
        const summary = calculatePipelineSummary(deals);
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card-surface rounded-lg p-4">
              <p className="text-[12px] text-[#64748B]">إجمالي خط الأنابيب المفتوح</p>
              <p className="mt-2 text-[24px] font-bold text-[#0F172A] tabular-nums">
                {formatCurrencySAR(summary.openPipelineValue)}
              </p>
            </div>
            <div className="card-surface rounded-lg p-4">
              <p className="text-[12px] text-[#64748B]">التنبؤ المرجح للإيرادات</p>
              <p className="mt-2 text-[24px] font-bold text-[#6366F1] tabular-nums">
                {formatCurrencySAR(summary.weightedPipelineValue)}
              </p>
            </div>
            <div className="card-surface rounded-lg p-4">
              <p className="text-[12px] text-[#64748B]">نسبة نجاح الإغلاق</p>
              <p className="mt-2 text-[24px] font-bold text-[#10B981] tabular-nums">
                {summary.winRatePercent}%
              </p>
            </div>
          </div>
        );
      }

      case '/settings/profiles':
        return (
          <div className="space-y-4">
            <form onSubmit={handleAddProfile} className="card-surface rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
                <Shield className="h-4 w-4 text-[#2563EB]" />
                <span>إضافة ملف صلاحيات جديد (CRUD + Field-Level Security)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="اسم الملف (مثال: مشرف المبيعات الإقليمي)"
                  className="input-control px-3 py-2 text-[13px]"
                />
                <input
                  type="text"
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  placeholder="وصف نطاق الصلاحيات على الحقول"
                  className="input-control px-3 py-2 text-[13px] sm:col-span-2"
                />
              </div>
              {profileError && <p className="text-[12px] text-[#F43F5E]">{profileError}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-4 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]"
                >
                  <Plus className="h-4 w-4" />
                  <span>حفظ الملف</span>
                </button>
              </div>
            </form>

            <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
              {profiles.map((prof) => {
                const isActive = activeProfile?.id === prof.id;
                return (
                  <div key={prof.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#0F172A]">{prof.name}</span>
                        {prof.isSystem && <StatusBadge label="أساسي" tone="qualified" />}
                        {isActive && <StatusBadge label="نشط الآن" tone="won" />}
                      </div>
                      <p className="mt-1 text-[12px] text-[#64748B]">{prof.description}</p>
                      <p className="mt-1 text-[11px] text-[#64748B]">
                        حقل المبالغ المحصلة في الفواتير:{' '}
                        <strong className="text-[#0F172A]">
                          {prof.fieldSecurity?.invoices?.paidAmount ?? 'read_write'}
                        </strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveProfileId(prof.id)}
                        className="h-8 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                      >
                        تفعيل للمعاينة
                      </button>
                      {!prof.isSystem && (
                        <button
                          type="button"
                          onClick={() => void deleteProfile(prof.id)}
                          aria-label={`حذف ملف ${prof.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#FECDD3] bg-[#FFF1F2] text-[#F43F5E] hover:bg-[#FFE4E6]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case '/settings/roles':
        return (
          <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[14px] font-semibold text-[#0F172A]">{r.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{r.description}</p>
                </div>
                <StatusBadge
                  label={
                    r.dataVisibility === 'organization'
                      ? 'كامل المنظمة'
                      : r.dataVisibility === 'team'
                        ? 'نطاق الفريق'
                        : 'خاص بالموظف'
                  }
                  tone="qualified"
                />
              </div>
            ))}
          </div>
        );

      case '/settings/custom-fields':
        return (
          <div className="card-surface rounded-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
              <span className="text-[14px] font-semibold text-[#0F172A]">
                الحقول المخصصة وتخطيط النماذج ({customFields.length})
              </span>
              <Layers className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">التسمية العربية</th>
                    <th className="px-3 py-2.5">المفتاح البرمجي</th>
                    <th className="px-3 py-2.5">الوحدة</th>
                    <th className="px-3 py-2.5">نوع الحقل</th>
                    <th className="px-4 py-2.5">القسم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                  {customFields.map((cf) => (
                    <tr key={cf.id} className="h-[44px] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2 font-semibold text-[#0F172A]">{cf.label}</td>
                      <td className="px-3 py-2 text-[#2563EB] tabular-nums" dir="ltr">{cf.fieldKey}</td>
                      <td className="px-3 py-2 text-[#475569]">{cf.module}</td>
                      <td className="px-3 py-2 text-[#64748B]">{cf.fieldType}</td>
                      <td className="px-4 py-2 text-[#64748B]">{cf.section}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/settings/blueprints':
        return (
          <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
            {blueprints.map((bp) => (
              <div key={bp.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[14px] font-semibold text-[#0F172A]">{bp.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{bp.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] text-[#64748B] tabular-nums">{bp.stagesCount} مراحل</span>
                  <StatusBadge label={bp.active ? 'مفعل' : 'مؤجلة'} />
                </div>
              </div>
            ))}
          </div>
        );

      case '/settings/workflows':
        return (
          <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
            {workflows.map((wf) => (
              <div key={wf.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-[14px] font-semibold text-[#0F172A]">{wf.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">
                    {wf.trigger} — {wf.actionSummary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] text-[#64748B] tabular-nums">
                    {wf.executionsCount} تنفيذ
                  </span>
                  <StatusBadge label={wf.active ? 'مفعل' : 'مؤجلة'} />
                </div>
              </div>
            ))}
          </div>
        );

      case '/settings/recycle-bin':
        return (
          <div className="card-surface rounded-lg divide-y divide-[#E2E8F0]">
            {recycleBin.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#64748B]">
                سلة المحذوفات فارغة حالياً.
              </div>
            ) : (
              recycleBin.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F172A]">{item.displayName}</p>
                    <p className="mt-0.5 text-[12px] text-[#64748B] tabular-nums">
                      {item.entityType} · حذف بواسطة {item.deletedBy} ({item.deletedAtLabel}) · متبقي {item.expiresInDays} يوماً
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restoreRecycleItem(item.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>استعادة</span>
                  </button>
                </div>
              ))
            )}
          </div>
        );

      default:
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {settingsGroup?.subItems?.slice(1).map((sub) => (
              <NavLink
                key={sub.id}
                to={sub.path}
                className="card-surface rounded-lg p-4 hover:border-[#2563EB] transition-colors"
              >
                <p className="text-[14px] font-semibold text-[#0F172A]">{sub.label}</p>
                <p className="mt-1 text-[12px] text-[#64748B]">
                  {ROUTE_METADATA[sub.path]?.description}
                </p>
              </NavLink>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-[32px] text-[#0F172A]">{meta.title}</h1>
          <p className="mt-0.5 text-[13px] text-[#64748B]">{meta.description}</p>
        </div>
        <span className="text-[12px] font-medium text-[#64748B] self-start sm:self-auto whitespace-nowrap">
          {meta.section} · متصل بقاعدة البيانات
        </span>
      </div>

      {renderSubTabs()}
      {renderModuleBody()}
    </div>
  );
};
