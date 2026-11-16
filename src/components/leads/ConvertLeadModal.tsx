import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Layers,
  MessageSquare,
  UserCheck,
  X,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Account, DealStage, Lead } from '../../types/crm';
import { DEAL_STAGES_ORDER } from '../../utils/formatters';
import { LEAD_OWNERS } from '../../utils/leadsLogic';

interface ConvertLeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onConverted: (result: { lead: Lead; contactId: string; accountId?: string; dealId?: string }) => void;
}

export const ConvertLeadModal: React.FC<ConvertLeadModalProps> = ({
  lead,
  onClose,
  onConverted,
}) => {
  const { accounts, contacts, touchpoints, messages, convertLead } = useCrm();

  const [contactMode, setContactMode] = useState<'new' | 'existing'>('new');
  const [existingContactId, setExistingContactId] = useState('');
  const [contactFullName, setContactFullName] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCity, setContactCity] = useState('');

  const [accountMode, setAccountMode] = useState<'none' | 'new' | 'existing'>('new');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountIndustry, setAccountIndustry] = useState('التقنية والأعمال');
  const [accountTier, setAccountTier] = useState<Account['tier']>('مؤسسات');

  const [createDeal, setCreateDeal] = useState(true);
  const [dealTitle, setDealTitle] = useState('');
  const [dealAmount, setDealAmount] = useState(0);
  const [dealStage, setDealStage] = useState<DealStage>('تحديد الاحتياج');
  const [dealCloseDate, setDealCloseDate] = useState('2026-12-20');
  const [dealOwnerName, setDealOwnerName] = useState<string>(LEAD_OWNERS[0]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setContactMode('new');
    setExistingContactId(contacts[0]?.id ?? '');
    setContactFullName(lead.fullName);
    setContactJobTitle(lead.jobTitle ?? '');
    setContactPhone(lead.phone ?? '');
    setContactEmail(lead.email ?? '');
    setContactCity(lead.city ?? 'الرياض');

    const leadCompany = (lead.company ?? '').trim();
    const matchedAccount = leadCompany
      ? accounts.find((a) => a.name.trim() === leadCompany)
      : undefined;
    if (matchedAccount) {
      setAccountMode('existing');
      setExistingAccountId(matchedAccount.id);
    } else if (leadCompany) {
      setAccountMode('new');
      setExistingAccountId(accounts[0]?.id ?? '');
    } else {
      setAccountMode('none');
      setExistingAccountId(accounts[0]?.id ?? '');
    }
    setAccountName(leadCompany || lead.fullName);
    setAccountIndustry('التقنية والخدمات المؤسسية');
    setAccountTier('مؤسسات');

    setCreateDeal(true);
    setDealTitle(`صفقة ${lead.fullName}`);
    setDealAmount(lead.estimatedValue || 100000);
    setDealStage('تحديد الاحتياج');
    setDealCloseDate('2026-12-20');
    setDealOwnerName(lead.assignedToName || LEAD_OWNERS[0]);
  }, [accounts, contacts, lead]);

  const linkedTouchpointsCount = useMemo(() => {
    if (!lead) return 0;
    return touchpoints.filter(
      (tp) =>
        tp.leadId === lead.id ||
        (Boolean(tp.leadUniqueId) && tp.leadUniqueId === lead.unique_id) ||
        (tp.relatedEntityType === 'lead' && tp.relatedEntityId === lead.id)
    ).length;
  }, [lead, touchpoints]);

  const linkedMessagesCount = useMemo(() => {
    if (!lead) return 0;
    return messages.filter(
      (m) =>
        m.leadId === lead.id ||
        (Boolean(m.leadUniqueId) && m.leadUniqueId === lead.unique_id) ||
        m.senderName === lead.fullName
    ).length;
  }, [lead, messages]);

  if (!lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await convertLead({
        leadId: lead.id,
        contactMode,
        existingContactId: contactMode === 'existing' ? existingContactId : undefined,
        contactFullName,
        contactJobTitle,
        contactEmail,
        contactPhone,
        contactCity,
        accountMode,
        existingAccountId: accountMode === 'existing' ? existingAccountId : undefined,
        accountName,
        accountIndustry,
        accountTier,
        createDeal,
        dealTitle,
        dealAmount,
        dealStage,
        dealCloseDate,
        dealOwnerName,
      });
      onConverted({ lead, ...result });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تحويل العميل المحتمل"
    >
      <div className="fixed inset-0 bg-[#0F172A]/45" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex w-full max-w-3xl flex-col rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] drawer-surface max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#0F172A]">
                  تحويل العميل المحتمل (Convert Lead)
                </h2>
                <span className="rounded bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] tabular-nums">
                  {lead.unique_id}
                </span>
              </div>
              <p className="text-[12px] text-[#64748B]">
                {lead.fullName}
                {lead.city ? ` · ${lead.city}` : ''} — تحويل إلى جهة اتصال وحساب وصفقة مبيعات.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التحويل"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Section 1: Contact (Mandatory) */}
            <section className="rounded-lg border border-[#E2E8F0] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#2563EB]" />
                  <h3 className="text-[13px] font-bold text-[#0F172A]">
                    1. جهة الاتصال <span className="text-[#F43F5E]">(إلزامي)</span>
                  </h3>
                </div>
                <div className="inline-flex rounded border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setContactMode('new')}
                    className={`rounded px-2.5 py-1 font-semibold ${
                      contactMode === 'new'
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    إنشاء جهة اتصال جديدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMode('existing')}
                    className={`rounded px-2.5 py-1 font-semibold ${
                      contactMode === 'existing'
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    ربط بجهة حالية
                  </button>
                </div>
              </div>

              {contactMode === 'new' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      required
                      value={contactFullName}
                      onChange={(e) => setContactFullName(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      المسمى الوظيفي
                    </label>
                    <input
                      type="text"
                      value={contactJobTitle}
                      onChange={(e) => setContactJobTitle(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      المعرف الموروث (للقراءة فقط)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={lead.unique_id}
                      className="input-control h-8 w-full bg-[#F8FAFC] px-2.5 text-[12px] font-bold text-[#2563EB] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      المصدر الأساسي الموروث
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={lead.source || lead.campaign || 'عميل محتمل'}
                      className="input-control h-8 w-full bg-[#F8FAFC] px-2.5 text-[12px] text-[#475569]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    اختر جهة الاتصال الحالية
                  </label>
                  <select
                    value={existingContactId}
                    onChange={(e) => setExistingContactId(e.target.value)}
                    className="input-control h-9 w-full px-2.5 text-[12px]"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} — {c.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Section 2: Account (Optional) */}
            <section className="rounded-lg border border-[#E2E8F0] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#6366F1]" />
                  <h3 className="text-[13px] font-bold text-[#0F172A]">
                    2. الشركة / الحساب <span className="text-[#64748B]">(اختياري)</span>
                  </h3>
                </div>
                <div className="inline-flex rounded border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11px]">
                  {(
                    [
                      { id: 'new', label: 'شركة جديدة' },
                      { id: 'existing', label: 'ربط بحساب حالي' },
                      { id: 'none', label: 'تخطي الحساب' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAccountMode(opt.id)}
                      className={`rounded px-2.5 py-1 font-semibold ${
                        accountMode === opt.id
                          ? 'bg-[#2563EB] text-[#FFFFFF]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {accountMode === 'new' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      اسم الشركة
                    </label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      القطاع
                    </label>
                    <input
                      type="text"
                      value={accountIndustry}
                      onChange={(e) => setAccountIndustry(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      التصنيف
                    </label>
                    <select
                      value={accountTier}
                      onChange={(e) => setAccountTier(e.target.value as Account['tier'])}
                      className="input-control h-8 w-full px-2 text-[12px]"
                    >
                      <option value="استراتيجي">استراتيجي</option>
                      <option value="مؤسسات">مؤسسات</option>
                      <option value="نمو">نمو</option>
                    </select>
                  </div>
                </div>
              )}

              {accountMode === 'existing' && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    اختر الحساب المؤسسي
                  </label>
                  <select
                    value={existingAccountId}
                    onChange={(e) => setExistingAccountId(e.target.value)}
                    className="input-control h-9 w-full px-2.5 text-[12px]"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.city || 'الرياض'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Section 3: Deal (Optional) */}
            <section className="rounded-lg border border-[#E2E8F0] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createDeal}
                    onChange={(e) => setCreateDeal(e.target.checked)}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                  />
                  <Briefcase className="h-4 w-4 text-[#10B981]" />
                  <span className="text-[13px] font-bold text-[#0F172A]">
                    3. إنشاء صفقة مبيعات جديدة لهذه الفرصة
                  </span>
                </label>
              </div>

              {createDeal && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      مسمى الصفقة
                    </label>
                    <input
                      type="text"
                      required
                      value={dealTitle}
                      onChange={(e) => setDealTitle(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      قيمة الصفقة (ر.س)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={dealAmount}
                      onChange={(e) => setDealAmount(Number(e.target.value) || 0)}
                      className="input-control h-8 w-full px-2.5 text-[12px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      مرحلة مسار المبيعات
                    </label>
                    <select
                      value={dealStage}
                      onChange={(e) => setDealStage(e.target.value as DealStage)}
                      className="input-control h-8 w-full px-2 text-[12px]"
                    >
                      {DEAL_STAGES_ORDER.filter((s) => s !== 'خسارة').map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      تاريخ الإغلاق المتوقع
                    </label>
                    <input
                      type="date"
                      value={dealCloseDate}
                      onChange={(e) => setDealCloseDate(e.target.value)}
                      className="input-control h-8 w-full px-2.5 text-[12px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                      مالك الصفقة
                    </label>
                    <select
                      value={dealOwnerName}
                      onChange={(e) => setDealOwnerName(e.target.value)}
                      className="input-control h-8 w-full px-2 text-[12px]"
                    >
                      {LEAD_OWNERS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </section>

            {/* Migration Preservation Banner */}
            <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-[12px] font-bold text-[#065F46]">
                <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                <span>
                  سيتم الحفاظ على المعرف ({lead.unique_id}) وترحيل السجل التاريخي بالكامل:
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-[12px] text-[#047857] tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {linkedTouchpointsCount} نقطة تماس وإسناد تسويقي
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {linkedMessagesCount} محادثة وقناة تواصل
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-4 text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#10B981] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#059669] disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>{submitting ? 'جاري التحويل...' : 'تأكيد تحويل العميل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
