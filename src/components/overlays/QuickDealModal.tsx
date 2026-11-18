import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { DealStage } from '../../types/crm';
import { DEAL_STAGES_ORDER, validateQuickDealInput } from '../../utils/formatters';

interface QuickDealModalProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_STAGE_PROB: Record<DealStage, number> = {
  'تأهيل مبدئي': 20,
  'تحديد الاحتياج': 20,
  'عرض سعر': 50,
  'تفاوض': 80,
  'مكتملة': 100,
  'خسارة': 0,
};

export const QuickDealModal: React.FC<QuickDealModalProps> = ({ open, onClose }) => {
  const { accounts, createQuickDeal } = useCrm();
  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('150000');
  const [stage, setStage] = useState<DealStage>('عرض سعر');
  const [probability, setProbability] = useState('50');
  const [closeDate, setCloseDate] = useState('2026-12-20');
  const [nextStep, setNextStep] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    const selectedAccountId = accountId || accounts[0]?.id || '';

    const check = validateQuickDealInput({
      title,
      accountId: selectedAccountId,
      amount: numericAmount,
      closeDate,
    });

    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const canonicalProb = QUICK_STAGE_PROB[stage] ?? (Number(probability) || 50);
      await createQuickDeal({
        title,
        accountId: selectedAccountId,
        amount: numericAmount,
        stage,
        probability: Math.min(100, Math.max(0, canonicalProb)),
        closeDate,
        nextStep,
      });
      setTitle('');
      setNextStep('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إنشاء صفقة سريعة"
    >
      <div className="w-full max-w-lg rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">إنشاء صفقة سريعة</h2>
            <p className="text-[12px] text-[#64748B]">
              أضف فرصة بيعية جديدة إلى خط الأنابيب مع تحديث فوري للمؤشرات.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الصفقة السريعة"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="quick-deal-title" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
              مسمى الصفقة *
            </label>
            <input
              id="quick-deal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: توريد تراخيص رواق لـ 200 مستخدم"
              className="input-control w-full px-3 py-2 text-[13px]"
            />
            {errors.title && <p className="mt-1 text-[11px] font-medium text-[#F43F5E]">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-deal-account" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
                الشركة / الحساب *
              </label>
              <select
                id="quick-deal-account"
                value={accountId || accounts[0]?.id || ''}
                onChange={(e) => setAccountId(e.target.value)}
                className="input-control w-full px-3 py-2 text-[13px]"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1 text-[11px] font-medium text-[#F43F5E]">{errors.accountId}</p>
              )}
            </div>

            <div>
              <label htmlFor="quick-deal-amount" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
                القيمة المتوقعة (ر.س) *
              </label>
              <input
                id="quick-deal-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-control w-full px-3 py-2 text-[13px] tabular-nums"
              />
              {errors.amount && (
                <p className="mt-1 text-[11px] font-medium text-[#F43F5E]">{errors.amount}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="quick-deal-stage" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
                مرحلة الصفقة
              </label>
              <select
                id="quick-deal-stage"
                value={stage}
                onChange={(e) => {
                  const nextStage = e.target.value as DealStage;
                  setStage(nextStage);
                  setProbability(String(QUICK_STAGE_PROB[nextStage] ?? 50));
                }}
                className="input-control w-full px-3 py-2 text-[13px]"
              >
                {DEAL_STAGES_ORDER.filter((s) => s !== 'خسارة').map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quick-deal-prob" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
                الاحتمالية (%)
              </label>
              <input
                id="quick-deal-prob"
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="input-control w-full px-3 py-2 text-[13px] tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="quick-deal-date" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
                تاريخ الإغلاق *
              </label>
              <input
                id="quick-deal-date"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="input-control w-full px-3 py-2 text-[13px] tabular-nums"
              />
              {errors.closeDate && (
                <p className="mt-1 text-[11px] font-medium text-[#F43F5E]">{errors.closeDate}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="quick-deal-next" className="mb-1 block text-[12px] font-semibold text-[#0F172A]">
              الخطوة التالية
            </label>
            <input
              id="quick-deal-next"
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="مثال: جدولة عرض تقديمي مع فريق تقنية المعلومات"
              className="input-control w-full px-3 py-2 text-[13px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-md bg-[#2563EB] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ الصفقة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
