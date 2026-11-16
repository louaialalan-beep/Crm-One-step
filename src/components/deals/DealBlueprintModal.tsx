import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Lock,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type { Deal, DealStage } from '../../types/crm';
import {
  getDealColumnForStage,
  type BlueprintTransitionRequirement,
} from '../../utils/dealsLogic';
import { formatCurrencySAR } from '../../utils/formatters';

interface DealBlueprintModalProps {
  open: boolean;
  deal: Deal | null;
  requirement: BlueprintTransitionRequirement | null;
  canEditAmount: boolean;
  onClose: () => void;
  onConfirmTransition: (payload: {
    dealId: string;
    targetStage: DealStage;
    probability: number;
    amount: number;
    nextStep: string;
    closeDate: string;
    auditSummary: string;
  }) => Promise<void>;
}

const LOSS_REASONS = [
  'ميزانية العميل غير كافية لهذا الربع',
  'اختيار حل منافس بسعر أقل',
  'تأجيل المشروع للعام القادم',
  'عدم توافق متطلبات التكامل التقني',
];

export const DealBlueprintModal: React.FC<DealBlueprintModalProps> = ({
  open,
  deal,
  requirement,
  canEditAmount,
  onClose,
  onConfirmTransition,
}) => {
  const [finalAmount, setFinalAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [contractFileName, setContractFileName] = useState('');
  const [nextStepInput, setNextStepInput] = useState('');
  const [closeDateInput, setCloseDateInput] = useState('');
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0]);
  const [lossNotes, setLossNotes] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !deal || !requirement) return;
    setFinalAmount(String(deal.amount));
    setDiscountPercent('5');
    setContractFileName('');
    setNextStepInput(deal.nextStep || 'مراجعة بنود التوقيع النهائي');
    setCloseDateInput(deal.closeDate || '2026-11-30');
    setLossReason(LOSS_REASONS[0]);
    setLossNotes('');
    setCheckedItems({});
    setSubmitting(false);
  }, [deal, open, requirement]);

  if (!open || !deal || !requirement) return null;

  const targetCol = getDealColumnForStage(requirement.targetStage);
  const parsedAmount = Number(finalAmount);
  const parsedDiscount = Number(discountPercent);

  const amountValid =
    !requirement.requireFinalAmount ||
    (Number.isFinite(parsedAmount) && parsedAmount > 0);
  const discountValid =
    !requirement.requireDiscountPercent ||
    (Number.isFinite(parsedDiscount) && parsedDiscount >= 0 && parsedDiscount <= 50);
  const contractValid =
    !requirement.requireContractPdf || contractFileName.trim().length > 0;
  const nextStepValid =
    !requirement.requireNextStep || nextStepInput.trim().length >= 3;
  const lossValid =
    !requirement.requireLossReason || lossReason.trim().length > 0;

  const allChecked = requirement.checklistItems.every(
    (_item, idx) => Boolean(checkedItems[idx])
  );

  const canSubmit =
    amountValid &&
    discountValid &&
    contractValid &&
    nextStepValid &&
    lossValid &&
    allChecked &&
    !submitting;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setContractFileName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const effectiveAmount = requirement.requireFinalAmount
        ? parsedAmount
        : deal.amount;

      let nextStep = deal.nextStep || '';
      let auditSummary = '';

      if (requirement.targetStage === 'مكتملة') {
        nextStep = `تم التوقيع (${contractFileName.trim()}) · خصم ${parsedDiscount}%`;
        auditSummary = `اعتماد إغلاق الصفقة عبر Blueprint (${requirement.blueprintName}): القيمة النهائية ${formatCurrencySAR(effectiveAmount)}، خصم ${parsedDiscount}%، العقد: ${contractFileName.trim()}`;
      } else if (requirement.targetStage === 'تفاوض') {
        nextStep = nextStepInput.trim();
        auditSummary = `انتقال عبر Blueprint إلى التفاوض والعقود: القيمة ${formatCurrencySAR(effectiveAmount)} · الخطوة التالية: ${nextStep}`;
      } else if (requirement.targetStage === 'خسارة') {
        nextStep = `سبب الخسارة: ${lossReason}${lossNotes.trim() ? ` — ${lossNotes.trim()}` : ''}`;
        auditSummary = `توثيق خسارة الصفقة عبر Blueprint: ${nextStep}`;
      }

      await onConfirmTransition({
        dealId: deal.id,
        targetStage: requirement.targetStage,
        probability: targetCol.defaultProbability,
        amount: effectiveAmount,
        nextStep: nextStep.slice(0, 190),
        closeDate: closeDateInput || deal.closeDate,
        auditSummary,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-blueprint-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#ffffff] border border-[#E2E8F0] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="deal-blueprint-modal-title"
                className="text-[15px] font-bold text-[#131b2e]"
              >
                بوابة الانتقال الإلزامية (Blueprint)
              </h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                {requirement.blueprintName} ·{' '}
                <span className="font-semibold text-[#131b2e]">{deal.title}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التحقق"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#E2E8F0]/60 hover:text-[#131b2e]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Transition Pill */}
        <div className="px-5 py-2.5 bg-[#EFF6FF]/60 border-b border-[#DBEAFE] flex items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2 font-semibold">
            <span className="px-2.5 py-0.5 rounded-full bg-[#ffffff] border border-[#CBD5E1] text-[#475569]">
              {deal.stage}
            </span>
            <ArrowLeft className="h-3.5 w-3.5 text-[#2563EB]" />
            <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-[#ffffff]">
              {requirement.targetTitle} ({targetCol.probabilityLabel})
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#2563EB]">
            متطلبات المرحلة (During)
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Financial Fields */}
          {(requirement.requireFinalAmount || requirement.requireDiscountPercent) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {requirement.requireFinalAmount && (
                <div>
                  <label className="flex items-center justify-between text-[12px] font-semibold text-[#131b2e] mb-1">
                    <span>القيمة النهائية للصفقة (ر.س) *</span>
                    {!canEditAmount && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#D97706]">
                        <Lock className="h-3 w-3" />
                        <span>للقراءة فقط (FLS)</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={!canEditAmount}
                    value={finalAmount}
                    onChange={(e) => setFinalAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] font-bold text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
                  />
                </div>
              )}

              {requirement.requireDiscountPercent && (
                <div>
                  <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                    نسبة الخصم المعتمدة (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    required
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] font-bold text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Signed Contract PDF for Closed Won */}
          {requirement.requireContractPdf && (
            <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[12px] font-bold text-[#131b2e]">
                  إرفاق نسخة العقد الموقع أو التعميد (.pdf) *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setContractFileName(
                      `signed-contract-${deal.leadUniqueId || deal.id}.pdf`
                    )
                  }
                  className="text-[11px] font-semibold text-[#2563EB] hover:underline"
                >
                  ربط نسخة العقد المعتمدة
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#ffffff] hover:bg-[#F1F5F9] px-3 py-1.5 text-[12px] font-semibold text-[#334155] cursor-pointer shrink-0">
                  <Upload className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>رفع ملف PDF</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={contractFileName}
                  onChange={(e) => setContractFileName(e.target.value)}
                  placeholder="اسم ملف العقد الموقع مثال: contract-2026.pdf"
                  className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-3 py-1.5 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {contractFileName.trim() && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 text-[11px] font-semibold text-[#059669]">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>مرفق جاهز للاعتماد: {contractFileName}</span>
                </div>
              )}
            </div>
          )}

          {/* Negotiation Next Step + Close Date */}
          {requirement.requireNextStep && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                  الخطوة التنفيذية القادمة *
                </label>
                <input
                  type="text"
                  required
                  value={nextStepInput}
                  onChange={(e) => setNextStepInput(e.target.value)}
                  placeholder="مثال: مراجعة الملحق القانوني مع الإدارة المالية"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                  تاريخ الإغلاق المتوقع
                </label>
                <input
                  type="date"
                  value={closeDateInput}
                  onChange={(e) => setCloseDateInput(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Loss Reason */}
          {requirement.requireLossReason && (
            <div className="space-y-3 rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-3.5">
              <div className="flex items-center gap-2 text-[#E11D48] text-[12px] font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>يجب توثيق سبب خسارة الفرصة قبل الإغلاق</span>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                  سبب الخسارة الرئيسي *
                </label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
                >
                  {LOSS_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                  ملاحظات إضافية للفريق (اختياري)
                </label>
                <input
                  type="text"
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="تفاصيل العرض المنافس أو موعد إعادة التواصل المقترح"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Mandatory Checklist */}
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-[#131b2e]">
              قائمة التحقق الإلزامية قبل إتمام الانتقال:
            </p>
            <div className="space-y-2">
              {requirement.checklistItems.map((item, idx) => {
                const checked = Boolean(checkedItems[idx]);
                return (
                  <label
                    key={item}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-[12px] cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#ECFDF5]/60 border-[#A7F3D0] text-[#065F46]'
                        : 'bg-[#ffffff] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setCheckedItems((prev) => ({
                          ...prev,
                          [idx]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="font-medium leading-relaxed">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#CBD5E1] bg-[#ffffff] hover:bg-[#F8FAFC] px-4 py-2 text-[12px] font-semibold text-[#475569] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#ffffff] px-5 py-2 text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {submitting ? 'جارٍ الحفظ والتدقيق...' : 'تأكيد الانتقال وحفظ المرحلة'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
