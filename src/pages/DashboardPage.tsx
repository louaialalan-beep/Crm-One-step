import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpLeft,
  Briefcase,
  Check,
  DollarSign,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  calculatePipelineSummary,
  countQualifiedLeads,
  formatCurrencySAR,
} from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const {
    deals,
    leads,
    tasks,
    touchpoints,
    invoices,
    activeProfile,
    canViewField,
    toggleTaskStatus,
    firebaseUser,
    signInWithGoogle,
  } = useCrm();

  const [selectedDealId, setSelectedDealId] = useState<string>(deals[0]?.id ?? '');

  const pipeline = useMemo(() => calculatePipelineSummary(deals), [deals]);
  const qualifiedLeadsCount = useMemo(() => countQualifiedLeads(leads), [leads]);

  const canViewDealAmount = canViewField('deals', 'amount');
  const canViewInvoicePaid = canViewField('invoices', 'paidAmount');

  const collectedInvoicesTotal = useMemo(
    () => invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
    [invoices]
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'مكتملة'),
    [tasks]
  );

  const maxStageAmount = useMemo(
    () => Math.max(1, ...pipeline.stageTotals.map((s) => s.amount)),
    [pipeline.stageTotals]
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Action Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-[32px] text-[#0F172A]">
            لوحة القيادة التنفيذية
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#64748B]">
            <span>ملف الصلاحيات: {activeProfile?.name ?? 'مدير النظام'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {pipeline.openDealsCount} صفقات نشطة في خط الأنابيب
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!firebaseUser && (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
            >
              <span>ربط حساب Google للمزامنة</span>
            </button>
          )}
          <Link
            to="/deals"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
          >
            <span>عرض خط المبيعات</span>
            <ArrowUpLeft className="h-4 w-4 text-[#64748B]" />
          </Link>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <section aria-label="المؤشرات الرئيسية" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card-surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B]">
              قيمة الصفقات المفتوحة
            </span>
            <Briefcase className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[#0F172A] tabular-nums">
            {canViewDealAmount ? formatCurrencySAR(pipeline.openPipelineValue) : 'محجوب (FLS)'}
          </p>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[11px] font-semibold text-[#10B981] tabular-nums">
              +14.2%
            </span>
            <span className="text-[#64748B] tabular-nums">
              المرجح: {canViewDealAmount ? formatCurrencySAR(pipeline.weightedPipelineValue) : '—'}
            </span>
          </div>
        </div>

        <div className="card-surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B]">
              الصفقات المكتملة (المغلقة)
            </span>
            <DollarSign className="h-4 w-4 text-[#10B981]" />
          </div>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[#0F172A] tabular-nums">
            {canViewDealAmount ? formatCurrencySAR(pipeline.closedWonValue) : 'محجوب (FLS)'}
          </p>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[11px] font-semibold text-[#10B981] tabular-nums">
              +18.6%
            </span>
            <span className="text-[#64748B] tabular-nums">
              المحصّل: {canViewInvoicePaid ? formatCurrencySAR(collectedInvoicesTotal) : 'محجوب (FLS)'}
            </span>
          </div>
        </div>

        <div className="card-surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B]">
              العملاء المحتملون المؤهلون
            </span>
            <UserCheck className="h-4 w-4 text-[#6366F1]" />
          </div>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[#0F172A] tabular-nums">
            {qualifiedLeadsCount}
          </p>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center rounded border border-[#C7D2FE] bg-[#EEF2FF] px-1.5 py-0.5 text-[11px] font-semibold text-[#6366F1] tabular-nums">
              ذكاء المبيعات
            </span>
            <span className="text-[#64748B] tabular-nums">
              من إجمالي {leads.length} سجلات RWQ
            </span>
          </div>
        </div>

        <div className="card-surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B]">
              معدل إغلاق الصفقات
            </span>
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[#0F172A] tabular-nums">
            {pipeline.winRatePercent}%
          </p>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center rounded border border-[#BFDBFE] bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-semibold text-[#2563EB] tabular-nums">
              {openTasks.length} مهام نشطة
            </span>
            <span className="text-[#64748B]">متابعة اليوم</span>
          </div>
        </div>
      </section>

      {/* Main 12-Column Grid: Pipeline Breakdown + Tasks & Touchpoints */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Right 7 Columns: Pipeline Stages + Active Deals Table */}
        <section className="card-surface rounded-lg lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#0F172A]">
                توزيع مراحل المبيعات والصفقات النشطة
              </h2>
              <p className="text-[12px] text-[#64748B]">
                تحديث فوري لقيم الفرص البيعية حسب كل مرحلة في خط الأنابيب
              </p>
            </div>
            <Link
              to="/deals"
              className="text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
            >
              إدارة الصفقات
            </Link>
          </div>

          {/* Pipeline Stage Distribution Bars */}
          <div className="border-b border-[#E2E8F0] px-4 py-3.5 space-y-2.5">
            {pipeline.stageTotals
              .filter((st) => st.stage !== 'خسارة')
              .map((st) => {
                const widthPct = Math.max(4, Math.round((st.amount / maxStageAmount) * 100));
                return (
                  <div key={st.stage} className="grid grid-cols-12 items-center gap-3 text-[12px]">
                    <span className="col-span-4 sm:col-span-3 font-medium text-[#0F172A] truncate">
                      {st.stage}
                    </span>
                    <div className="col-span-5 sm:col-span-6 h-2 rounded bg-[#F1F5F9] overflow-hidden">
                      <div
                        className={`h-full rounded transition-all duration-200 ${
                          st.stage === 'مكتملة'
                            ? 'bg-[#10B981]'
                            : st.stage === 'تفاوض'
                              ? 'bg-[#6366F1]'
                              : 'bg-[#2563EB]'
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="col-span-3 text-left text-[#0F172A] font-semibold tabular-nums whitespace-nowrap">
                      {canViewDealAmount ? formatCurrencySAR(st.amount) : '—'}
                      <span className="mr-1 text-[11px] font-normal text-[#64748B]">
                        ({st.count})
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Compact 44px Deals Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                  <th className="px-3.5 py-2.5">الصفقة</th>
                  <th className="px-2.5 py-2.5">الشركة</th>
                  <th className="px-2.5 py-2.5">القيمة</th>
                  <th className="px-2.5 py-2.5">المرحلة</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">الإغلاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                {deals.slice(0, 6).map((deal) => {
                  const selected = selectedDealId === deal.id;
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => setSelectedDealId(deal.id)}
                      className={`h-[44px] cursor-pointer transition-colors ${
                        selected ? 'bg-[#EFF6FF]/50' : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <td
                        className={`px-3.5 py-2 font-semibold text-[#0F172A] max-w-[175px] truncate ${
                          selected ? 'border-r-2 border-r-[#2563EB]' : ''
                        }`}
                      >
                        {deal.title}
                      </td>
                      <td className="px-2.5 py-2 text-[#475569] max-w-[130px] truncate">
                        {deal.accountName}
                      </td>
                      <td className="px-2.5 py-2 font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                        {canViewDealAmount ? formatCurrencySAR(deal.amount, deal.currency) : 'محجوب'}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <StatusBadge label={deal.stage} />
                      </td>
                      <td className="px-3.5 py-2 text-[12px] text-[#64748B] tabular-nums whitespace-nowrap">
                        {deal.closeDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Left 5 Columns: Tasks & Customer Touchpoints */}
        <section className="card-surface rounded-lg lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <h2 className="text-[15px] font-semibold text-[#0F172A]">
              مهام المتابعة ونقاط التماس
            </h2>
            <Link
              to="/tasks"
              className="text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
            >
              كل المهام
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {tasks.slice(0, 4).map((task) => {
              const done = task.status === 'مكتملة';
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`تبديل حالة المهمة: ${task.title}`}
                    onClick={() => void toggleTaskStatus(task.id)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                      done
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-[#CBD5E1] bg-[#FFFFFF] hover:border-[#2563EB]'
                    }`}
                  >
                    {done && <Check className="h-3 w-3 stroke-[2.5]" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13px] font-medium ${
                        done ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                      <span>{task.relatedTo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">الاستحقاق: {task.dueDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>الأولوية: {task.priority}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Touchpoints Feed */}
          <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
            <span className="text-[11px] font-semibold text-[#64748B]">
              أحدث نقاط التماس المسجلة
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0] flex-1">
            {touchpoints.slice(0, 3).map((tp) => (
              <div key={tp.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#0F172A]">
                    {tp.channel} · {tp.relatedEntityName}
                  </span>
                  <span className="text-[11px] text-[#64748B] tabular-nums whitespace-nowrap">
                    {tp.occurredAt}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#475569]">{tp.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Full-Width Table: Leads (RWQ-xxxxx) */}
      <section className="card-surface rounded-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0F172A]">
              العملاء المحتملون (RWQ)
            </h2>
            <p className="text-[12px] text-[#64748B]">
              أحدث الفرص الواردة مصنفة وفق مؤشر التأهيل الذكي وقيمة العقد المتوقعة
            </p>
          </div>
          <Link
            to="/leads"
            className="text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
          >
            عرض جميع العملاء المحتملين
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">المعرف</th>
                <th className="px-3 py-2.5">الاسم الكامل</th>
                <th className="px-3 py-2.5">الشركة</th>
                <th className="px-3 py-2.5">المصدر</th>
                <th className="px-3 py-2.5">تقييم الذكاء</th>
                <th className="px-3 py-2.5">القيمة المقدرة</th>
                <th className="px-3 py-2.5">الحالة</th>
                <th className="px-4 py-2.5">المسؤول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
              {leads.map((lead) => (
                <tr key={lead.id} className="h-[44px] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums whitespace-nowrap">
                    {lead.unique_id}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#0F172A] whitespace-nowrap">
                    {lead.fullName}
                  </td>
                  <td className="px-3 py-2 text-[#475569] whitespace-nowrap">
                    {lead.company || lead.city || '—'}
                  </td>
                  <td className="px-3 py-2 text-[#64748B] whitespace-nowrap">
                    {lead.source || 'مباشر'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex h-[22px] items-center rounded border border-[#C7D2FE] bg-[#EEF2FF] px-2 text-[11px] font-semibold text-[#6366F1] tabular-nums">
                      {lead.aiScore}/100
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                    {formatCurrencySAR(lead.estimatedValue)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge label={lead.status} />
                  </td>
                  <td className="px-4 py-2 text-[#475569] whitespace-nowrap">
                    {lead.assignedToName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
