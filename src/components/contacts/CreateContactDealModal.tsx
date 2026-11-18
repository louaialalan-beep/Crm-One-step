import React, { useEffect, useState } from 'react';
import { Briefcase, Building2, Calendar, CheckCircle2, DollarSign, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Contact, DealStage } from '../../types/crm';
import { CONTACT_OWNERS, getContactOwnerName } from '../../utils/contactsLogic';
import { DEAL_STAGES_ORDER } from '../../utils/formatters';

interface CreateContactDealModalProps {
  open: boolean;
  contact: Contact | null;
  onClose: () => void;
  onCreated: (dealTitle: string) => void;
}

const DEFAULT_STAGE_PROB: Record<DealStage, number> = {
  'تأهيل مبدئي': 20,
  'تحديد الاحتياج': 20,
  'عرض سعر': 50,
  'تفاوض': 80,
  'مكتملة': 100,
  'خسارة': 0,
};

export const CreateContactDealModal: React.FC<CreateContactDealModalProps> = ({
  open,
  contact,
  onClose,
  onCreated,
}) => {
  const { createDealForContact } = useCrm();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('85000');
  const [stage, setStage] = useState<DealStage>('عرض سعر');
  const [probability, setProbability] = useState('50');
  const [closeDate, setCloseDate] = useState('2026-12-15');
  const [ownerName, setOwnerName] = useState(CONTACT_OWNERS[0]);
  const [nextStep, setNextStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !contact) return;
    const isB2C = contact.accountId === 'unassigned' || contact.accountName === 'عميل فردي B2C';
    setTitle(
      isB2C
        ? `ترقية باقة رواق - ${contact.fullName}`
        : `توسعة ترخيص - ${contact.accountName}`
    );
    setAmount('85000');
    setStage('عرض سعر');
    setProbability('50');
    setCloseDate('2026-12-15');
    setOwnerName(getContactOwnerName(contact));
    setNextStep('إرسال العرض المالي وجدولة اجتماع الاعتماد');
    setErrorMsg('');
  }, [contact, open]);

  if (!open || !contact) return null;

  const isB2C = contact.accountId === 'unassigned' || contact.accountName === 'عميل فردي B2C';

  const handleStageChange = (nextStage: DealStage) => {
    setStage(nextStage);
    setProbability(String(DEFAULT_STAGE_PROB[nextStage] ?? 50));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim()) {
      setErrorMsg('يرجى إدخال عنوان الصفقة.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('يرجى إدخال قيمة مالية موجبة بالريال السعودي.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await createDealForContact({
        contactId: contact.id,
        title: title.trim(),
        amount: numericAmount,
        stage,
        probability: Math.min(100, Math.max(0, Number(probability) || 50)),
        closeDate,
        ownerName,
        nextStep: nextStep.trim() || undefined,
      });
      onCreated(title.trim());
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إنشاء الصفقة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إنشاء صفقة جديدة لجهة الاتصال"
    >
      <div className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#131B2E]">
                إنشاء صفقة جديدة لجهة الاتصال
              </h2>
              <p className="text-[11px] text-[#737686]">
                ربط مباشر بسجل العميل ومسار المبيعات (Pipeline)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-[#737686] hover:bg-[#F2F3FF] hover:text-[#131B2E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contact & Account Context Banner */}
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#131B2E]">{contact.fullName}</span>
            {contact.leadUniqueId && (
              <span className="rounded bg-[#E2E7FF] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#004AC6]">
                {contact.leadUniqueId}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-[#FFFFFF] border border-[#E2E8F0] px-2 py-0.5 text-[11px] font-semibold text-[#434655]">
            <Building2 className="h-3 w-3 text-[#2563EB]" />
            <span>{isB2C ? 'عميل فردي B2C' : contact.accountName}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-[#131B2E]">
              مسمى الصفقة *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ترقية باقة المؤسسات Q4"
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                القيمة المتوقعة (ر.س) *
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-[#737686]" />
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-3 py-2 text-xs font-bold text-[#131B2E] tabular-nums focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                مرحلة الصفقة
              </label>
              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value as DealStage)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              >
                {DEAL_STAGES_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                احتمالية الإغلاق %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs font-bold text-[#131B2E] tabular-nums focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                تاريخ الإغلاق المتوقع
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#737686]" />
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] pr-8 pl-2 py-2 text-xs text-[#131B2E] tabular-nums focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                المسؤول عن الصفقة
              </label>
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              >
                {CONTACT_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-[#131B2E]">
              الخطوة التالية (Next Step)
            </label>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="مثال: إرسال المسودة النهائية للعقد..."
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#434655] hover:bg-[#F8FAFC]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{submitting ? 'جارٍ الحفظ...' : 'حفظ وربط الصفقة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
