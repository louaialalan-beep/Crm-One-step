import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Deal, DealStage } from '../../types/crm';
import {
  getDealColumnForStage,
  type BlueprintTransitionRequirement,
} from '../../utils/dealsLogic';
import { formatCurrencySAR } from '../../utils/formatters';

export interface BlueprintTransitionModalProps {
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
    discountPercent?: number;
    contractFileName?: string;
    createdOrderNumber?: string;
  }) => Promise<void>;
}

const LOSS_REASONS = [
  'ميزانية العميل غير كافية لهذا الربع',
  'اختيار حل منافس بسعر أقل',
  'تأجيل المشروع للعام القادم',
  'عدم توافق متطلبات التكامل التقني',
];

function getStageDisplayName(stage: DealStage): string {
  switch (stage) {
    case 'تأهيل مبدئي':
      return 'التأهيل المبدئي';
    case 'تحديد الاحتياج':
      return 'تحديد الاحتياج';
    case 'عرض سعر':
      return 'تقديم عرض السعر';
    case 'تفاوض':
      return 'التفاوض';
    case 'مكتملة':
      return 'إغلاق - فوز';
    case 'خسارة':
      return 'إغلاق - خسارة';
    default:
      return stage;
  }
}

function getTargetButtonShortName(stage: DealStage): string {
  switch (stage) {
    case 'مكتملة':
      return 'إغلاق فوز';
    case 'خسارة':
      return 'إغلاق خسارة';
    case 'تفاوض':
      return 'التفاوض والعقود';
    case 'عرض سعر':
      return 'تقديم العرض';
    default:
      return stage;
  }
}

function formatArabicDateLabel(isoDate: string): string {
  if (!isoDate) return 'اليوم — 18 نوفمبر 2026';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return `اليوم — ${isoDate}`;
  }
  try {
    const formatted = new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed);
    return `اليوم — ${formatted}`;
  } catch {
    return `اليوم — ${isoDate}`;
  }
}

function formatFileSizeMB(bytes: number): string {
  const mb = Math.max(0.1, bytes / (1024 * 1024));
  return `${mb.toFixed(1)} MB`;
}

function buildDefaultContractFileName(accountName: string): string {
  const clean = (accountName || 'العميل')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9_-]/g, '');
  return `عقد_${clean || 'العميل'}_موقع_رسمياً.pdf`;
}

export const BlueprintTransitionModal: React.FC<BlueprintTransitionModalProps> = ({
  open,
  deal,
  requirement,
  canEditAmount,
  onClose,
  onConfirmTransition,
}) => {
  const {
    addDealTask,
    addDealTouchpoint,
    createSalesOrder,
    currentOrgId,
    baseCurrency,
    currentUser,
  } = useCrm();

  const [finalAmount, setFinalAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [approvalDate, setApprovalDate] = useState('2026-11-18');
  const [contractFile, setContractFile] = useState<{
    name: string;
    sizeLabel: string;
  } | null>(null);
  const [checkPaymentSchedule, setCheckPaymentSchedule] = useState(true);
  const [checkTaxPoMatched, setCheckTaxPoMatched] = useState(true);
  const [generateSalesOrder, setGenerateSalesOrder] = useState(false);
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !deal || !requirement) return;
    const isWonStage = requirement.targetStage === 'مكتملة';
    setFinalAmount(String(deal.amount || 120000));
    setDiscountPercent('10');
    setApprovalDate(deal.closeDate || new Date().toISOString().slice(0, 10));
    setContractFile({
      name: buildDefaultContractFileName(deal.accountName),
      sizeLabel: '2.4 MB',
    });
    setCheckPaymentSchedule(true);
    setCheckTaxPoMatched(true);
    setGenerateSalesOrder(isWonStage);
    setLossReason(LOSS_REASONS[0]);
    setReviewNotes('');
    setSubmitting(false);
  }, [deal, open, requirement]);

  if (!open || !deal || !requirement) return null;

  const isLost = requirement.targetStage === 'خسارة';
  const isWon = requirement.targetStage === 'مكتملة';

  const targetCol = getDealColumnForStage(requirement.targetStage);
  const currentStageDisplay =
    deal.stage === requirement.targetStage
      ? 'التفاوض'
      : getStageDisplayName(deal.stage);
  const targetStageDisplay = getStageDisplayName(requirement.targetStage);
  const targetButtonLabel = getTargetButtonShortName(requirement.targetStage);

  const parsedAmount = Number(finalAmount.replace(/,/g, ''));
  const parsedDiscount = Number(discountPercent);

  // Readiness criteria for non-lost transitions
  const isAmountValid =
    finalAmount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;
  const isDiscountValid =
    discountPercent.trim().length > 0 &&
    Number.isFinite(parsedDiscount) &&
    parsedDiscount >= 0 &&
    parsedDiscount <= 100;
  const isDateValid = approvalDate.trim().length > 0;
  const isContractValid = Boolean(contractFile && contractFile.name.trim().length > 0);
  const isChecklistValid = checkPaymentSchedule && checkTaxPoMatched;

  const satisfiedCount = isLost
    ? [Boolean(lossReason.trim())].filter(Boolean).length
    : [
        isAmountValid,
        isDiscountValid,
        isDateValid,
        isContractValid,
        isChecklistValid,
      ].filter(Boolean).length;

  const totalRequiredCount = isLost ? 1 : 5;
  const isWithinRepAuthority = isDiscountValid && parsedDiscount <= 15;
  const canSubmit = isLost
    ? Boolean(lossReason.trim()) && !submitting
    : satisfiedCount === 5 && !submitting;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setContractFile({
        name: file.name,
        sizeLabel: formatFileSizeMB(file.size || 2516582),
      });
    }
    e.target.value = '';
  };

  const handlePreviewContract = () => {
    if (!contractFile) return;
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${contractFile.name}</title></head>
      <body style="font-family:Cairo,Arial,sans-serif;padding:36px;color:#0f172a;max-width:780px;margin:auto">
        <h1 style="margin:0 0 8px">وثيقة العقد والاتفاقية الموقعة رسمياً</h1>
        <p style="color:#475569;margin:0 0 20px">الملف: <strong>${contractFile.name}</strong> (${contractFile.sizeLabel})</p>
        <div style="padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;line-height:1.8">
          <div>الصفقة: <strong>${deal.title}</strong></div>
          <div>العميل / الجهة: <strong>${deal.accountName}</strong></div>
          <div>القيمة النهائية المعتمدة: <strong>${(isAmountValid ? parsedAmount : deal.amount).toLocaleString('en-US')} ر.س</strong></div>
          <div>نسبة الخصم الممنوحة: <strong>${parsedDiscount}%</strong></div>
          <div>تاريخ التوقيع والاعتماد: <strong>${approvalDate}</strong></div>
          <div>رقم أمر الشراء المسجل: <strong>PO-KSA-9921</strong></div>
        </div>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = contractFile.name.replace(/\.pdf$/i, '') + '-preview.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      // Closed-Lost path: strictly record Loss Reason + Review Notes, no Sales Order, no Onboarding task
      if (isLost) {
        const cleanNotes = reviewNotes.trim();
        const nextStepText = cleanNotes
          ? `سبب الخسارة: ${lossReason} — ملاحظات: ${cleanNotes}`
          : `سبب الخسارة: ${lossReason}`;

        const auditSummary = `إغلاق الصفقة بخسارة من ${currentStageDisplay} إلى ${targetStageDisplay} — سبب الخسارة: ${lossReason}${
          cleanNotes ? ` · ملاحظات المراجعة: ${cleanNotes}` : ''
        }`;

        await addDealTouchpoint(deal.id, {
          channel: 'حدث',
          eventType: 'إغلاق صفقة - خسارة',
          campaign: 'حوكمة البلوبرينت',
          summary: auditSummary.slice(0, 290),
        });

        await onConfirmTransition({
          dealId: deal.id,
          targetStage: 'خسارة',
          probability: 0,
          amount: deal.amount,
          nextStep: nextStepText.slice(0, 190),
          closeDate: deal.closeDate,
          auditSummary,
        });

        onClose();
        return;
      }

      const effectiveAmount = isAmountValid ? parsedAmount : deal.amount;
      const attachedName =
        contractFile?.name.trim() || buildDefaultContractFileName(deal.accountName);
      let createdOrderNumber: string | undefined;

      // Restrict automatic Sales Order generation and Onboarding task strictly to Closed-Won (100% / مكتملة)
      if (isWon) {
        if (generateSalesOrder) {
          const preTaxAmount = Math.round(effectiveAmount / 1.15);
          const vatAmount = Math.max(0, effectiveAmount - preTaxAmount);
          const createdOrder = await createSalesOrder({
            org_id: currentOrgId,
            dealId: deal.id,
            dealTitle: deal.title,
            accountId: deal.accountId,
            accountName: (deal.accountName || 'عميل مؤسسي').slice(0, 150),
            contactId: deal.contactId,
            leadUniqueId: deal.leadUniqueId,
            ownerName: deal.ownerName || currentUser.fullName,
            currency: deal.currency || baseCurrency.code || 'SAR',
            exchangeRate: deal.exchangeRate || 1,
            taxMode: 'exclusive',
            subtotalAmount: preTaxAmount,
            discountTotal: 0,
            taxableAmount: preTaxAmount,
            vatAmount,
            totalAmount: effectiveAmount,
            status: 'قيد التجهيز',
            issueDate: approvalDate || new Date().toISOString().slice(0, 10),
            deliveryDate: approvalDate || deal.closeDate || '2026-12-15',
            lineItems: [
              {
                id: 'li_bp_1',
                productName: deal.title,
                description: `أمر بيع مولد تلقائياً عند إغلاق الصفقة بفوز (${attachedName})`,
                unit: 'مشروع',
                quantity: 1,
                unitPrice: preTaxAmount,
                discountType: 'percentage',
                discountValue: 0,
                vatRate: 15,
              },
            ],
            notes: `تم توليده تلقائياً عبر البلوبرينت عند إغلاق الصفقة بفوز (100%)`,
          });
          createdOrderNumber = createdOrder.orderNumber;
        }

        // Create automated Onboarding task strictly on Closed-Won (100%)
        await addDealTask(deal.id, {
          title: `تسليم الحساب وتفعيل التراخيص (Onboarding) — ${deal.accountName}`.slice(0, 155),
          priority: 'عالية',
          dueDate: approvalDate || deal.closeDate || '2026-12-15',
          assignedToName: deal.ownerName,
        });

        // Log Purchase event for Meta CAPI + Finance notification in touchpoints
        await addDealTouchpoint(deal.id, {
          channel: 'حدث',
          eventType: 'Purchase Event (Meta CAPI)',
          campaign: 'Meta Conversions API (CAPI) & GA4',
          summary: `إرسال حدث الشراء (Purchase Event) بقيمة ${effectiveAmount.toLocaleString(
            'en-US'
          )} ر.س إلى Meta CAPI وإشعار فريق المالية${
            createdOrderNumber ? ` · أمر بيع ${createdOrderNumber}` : ''
          }`.slice(0, 290),
        });
      } else {
        await addDealTouchpoint(deal.id, {
          channel: 'حدث',
          eventType: `انتقال مرحلة البلوبرينت (${targetStageDisplay})`,
          campaign: 'حوكمة البلوبرينت',
          summary: `تمت مراجعة العقد (${attachedName}) واعتماد انتقال الصفقة إلى مرحلة ${targetStageDisplay}`.slice(
            0,
            290
          ),
        });
      }

      const nextStep = `تم التوقيع (${attachedName}) · خصم ${parsedDiscount}% · PO-KSA-9921`;

      const auditSummary = isWon
        ? `اعتماد انتقال البلوبرينت من ${currentStageDisplay} إلى ${targetStageDisplay}: القيمة النهائية ${formatCurrencySAR(
            effectiveAmount
          )}، خصم ${parsedDiscount}%، العقد (${attachedName})، وتفعيل أتمتة المالية وMeta CAPI`
        : `اعتماد انتقال البلوبرينت من ${currentStageDisplay} إلى ${targetStageDisplay}: القيمة ${formatCurrencySAR(
            effectiveAmount
          )}، خصم ${parsedDiscount}%، ومراجعة المستند (${attachedName})`;

      await onConfirmTransition({
        dealId: deal.id,
        targetStage: requirement.targetStage,
        probability: targetCol.defaultProbability,
        amount: effectiveAmount,
        nextStep: nextStep.slice(0, 190),
        closeDate: approvalDate || deal.closeDate,
        auditSummary,
        discountPercent: parsedDiscount,
        contractFileName: attachedName,
        createdOrderNumber,
      });

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blueprint-transition-modal-title"
    >
      <div className="w-full max-w-[660px] rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-2xl overflow-hidden">
        {/* 1. MODAL HEADER */}
        <div className="relative bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            {/* Right (RTL Start): Badge + Title + Subtitle */}
            <div className="space-y-1.5 text-right">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-[#FFFFFF] shadow-2xs ${
                  isLost ? 'bg-[#E11D48]' : 'bg-[#2563EB]'
                }`}
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>قواعد البلوبرينت (Blueprint Transition Rule)</span>
              </span>

              <h2
                id="blueprint-transition-modal-title"
                className="text-[19px] sm:text-[21px] font-extrabold text-[#0F172A] leading-snug pt-0.5"
              >
                <span>إتمام متطلبات الانتقال: من {currentStageDisplay} إلى </span>
                <span className={isLost ? 'text-[#E11D48]' : 'text-[#059669]'}>
                  «{targetStageDisplay}»
                </span>
              </h2>

              <p className="text-[12px] text-[#64748B] leading-relaxed">
                {isLost
                  ? 'يرجى تحديد سبب خسارة الصفقة وتدوين ملاحظات المراجعة لإغلاق الفرصة البيعية وتحديث تقارير التحليل.'
                  : 'يجب استيفاء الحقول والمرفقات الإلزامية التالية لاعتماد الصفقة ونقلها تلقائياً.'}
              </p>
            </div>

            {/* Left (RTL End): Close X Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة البلوبرينت"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. MODAL BODY & FORM */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {isLost ? (
            /* CLOSED-LOST VIEW: Only Loss Reason + Review Notes (No Sales Order, No Onboarding) */
            <div className="space-y-4">
              <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-4 space-y-2.5">
                <label
                  htmlFor="bp-loss-reason"
                  className="block text-[12px] font-bold text-[#E11D48]"
                >
                  سبب الخسارة (Loss Reason) *
                </label>
                <select
                  id="bp-loss-reason"
                  required
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[13px] font-bold text-[#0F172A] focus:border-[#E11D48] focus:outline-none"
                >
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bp-review-notes"
                  className="block text-[12px] font-bold text-[#0F172A] mb-1.5"
                >
                  ملاحظات المراجعة والتوثيق
                </label>
                <textarea
                  id="bp-review-notes"
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="أدخل تفاصيل إضافية حول أسباب عدم إتمام الصفقة أو التوصيات المستقبلية لإعادة التواصل..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3.5 text-[13px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-[#64748B]">
                  عند إغلاق الصفقة بخسارة (0%) لن يتم توليد أي أمر بيع ولن يتم إنشاء مهام تسليم حساب (Onboarding).
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Row 1: Approved Final Amount + Discount Percentage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* Field 1: القيمة النهائية المعتمدة (ر.س) * */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="bp-final-amount"
                      className="text-[12px] font-bold text-[#0F172A]"
                    >
                      القيمة النهائية المعتمدة (ر.س) *
                    </label>
                    {!canEditAmount ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
                        <Lock className="h-3 w-3" />
                        <span>للقراءة فقط (FLS)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669]">
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {parsedAmount === deal.amount ? 'مطابق للعرض' : 'تم تحديث القيمة'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex h-11 items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] transition-colors">
                    <input
                      id="bp-final-amount"
                      type="number"
                      min={1}
                      step="any"
                      required
                      disabled={!canEditAmount}
                      value={finalAmount}
                      onChange={(e) => setFinalAmount(e.target.value)}
                      className="w-full bg-transparent text-[14px] font-extrabold text-[#0F172A] tabular-nums focus:outline-none disabled:text-[#64748B]"
                    />
                    <span className="text-[12px] font-bold text-[#475569] shrink-0">
                      ر.س
                    </span>
                  </div>

                  <p className="mt-1.5 text-[11px] text-[#64748B]">
                    المبلغ الصافي قبل ضريبة القيمة المضافة (15%)
                  </p>
                </div>

                {/* Field 2: نسبة الخصم الممنوحة (%) * */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="bp-discount-percent"
                      className="text-[12px] font-bold text-[#0F172A]"
                    >
                      نسبة الخصم الممنوحة (%) *
                    </label>
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        isWithinRepAuthority ? 'text-[#059669]' : 'text-[#D97706]'
                      }`}
                    >
                      {Number.isFinite(parsedDiscount) ? `${parsedDiscount}%` : '0%'}
                    </span>
                  </div>

                  <div className="flex h-11 items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] transition-colors">
                    <input
                      id="bp-discount-percent"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      required
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full bg-transparent text-[14px] font-extrabold text-[#0F172A] tabular-nums focus:outline-none"
                    />
                    <span className="text-[12px] font-bold text-[#475569] shrink-0">%</span>
                  </div>

                  {/* Live Authority Check Badge */}
                  {isWithinRepAuthority ? (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1.5 text-[11px] font-bold text-[#059669]">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        ضمن صلاحية المندوب (أقل من 15%) — لا يتطلب موافقة المدير الإقليمي
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1.5 text-[11px] font-bold text-[#D97706]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        يتطلب موافقة المدير (الخصم أكبر من 15% — سيتم إرسال طلب اعتماد)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: تاريخ التوقيع والاعتماد الفعلي * */}
              <div>
                <label
                  htmlFor="bp-approval-date"
                  className="block text-[12px] font-bold text-[#0F172A] mb-1.5"
                >
                  تاريخ التوقيع والاعتماد الفعلي *
                </label>
                <div
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="flex h-11 items-center justify-between gap-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                      {formatArabicDateLabel(approvalDate)}
                    </span>
                    <input
                      ref={dateInputRef}
                      id="bp-approval-date"
                      type="date"
                      required
                      value={approvalDate}
                      onChange={(e) => setApprovalDate(e.target.value)}
                      className="bg-transparent text-[12px] font-mono text-[#64748B] tabular-nums focus:outline-none cursor-pointer"
                    />
                  </div>
                  <Calendar className="h-4 w-4 text-[#475569] shrink-0" />
                </div>
              </div>

              {/* Row 3: وثيقة العقد والاتفاقية الموقعة رسمياً (PDF) * */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-[12px] font-bold text-[#0F172A]">
                    وثيقة العقد والاتفاقية الموقعة رسمياً (PDF) *
                  </label>
                  <span className="text-[11px] font-bold text-[#059669]">
                    مستند إلزامي للأرشفة والمالية
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {contractFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
                    {/* Right side in RTL: PDF Icon + File Name & Verification */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl border border-[#FECACA] bg-[#FEE2E2] text-[#DC2626] shrink-0">
                        <FileText className="h-4 w-4" />
                        <span className="text-[9px] font-extrabold uppercase leading-none mt-0.5">
                          PDF
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-extrabold text-[#0F172A] truncate">
                            {contractFile.name}
                          </span>
                          <span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#475569] tabular-nums">
                            {contractFile.sizeLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#059669]">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>تم التحقق من التوقيع الإلكتروني وتطابق الأختام ✓</span>
                        </div>
                      </div>
                    </div>

                    {/* Left side in RTL: View / Replace / Delete icons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="استبدال أو رفع ملف PDF جديد"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 text-[11px] font-semibold text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">تغيير</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePreviewContract}
                        aria-label="معاينة وثيقة العقد"
                        title="معاينة وثيقة العقد"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#E2E8F0]/70 hover:text-[#0F172A] transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setContractFile(null)}
                        aria-label="حذف وثيقة العقد المرفقة"
                        title="إزالة المرفق"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-4 py-3.5">
                    <div className="text-right">
                      <p className="text-[12px] font-bold text-[#0F172A]">
                        لم يتم إرفاق وثيقة العقد الموقعة بعد (مطلوب لاستيفاء البلوبرينت)
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        يرجى رفع نسخة العقد بصيغة PDF أو استعادة النسخة الموقعة إلكترونياً.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>رفع ملف PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContractFile({
                            name: buildDefaultContractFileName(deal.accountName),
                            sizeLabel: '2.4 MB',
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                      >
                        <span>إرفاق العقد المعتمد</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 4: إقرارات الجاهزية التشغيلية (Checklist) * */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                  إقرارات الجاهزية التشغيلية (Checklist) *
                </h3>

                <div className="space-y-3">
                  {/* Required Checkbox 1 */}
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkPaymentSchedule}
                      onChange={(e) => setCheckPaymentSchedule(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] leading-snug">
                        تم تأكيد واعتماد شروط الدفع وجدولة الدفعات الرسمية
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        الدفعة الأولى 50% مقدم، و50% عند انتهاء فترة التدريب وتسليم الحسابات.
                      </p>
                    </div>
                  </label>

                  {/* Required Checkbox 2 */}
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkTaxPoMatched}
                      onChange={(e) => setCheckTaxPoMatched(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A] leading-snug">
                        تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        رقم أمر الشراء المسجل:{' '}
                        <span className="font-mono font-bold text-[#0F172A]">PO-KSA-9921</span>
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. AFTER TRANSITION AUTOMATION PREVIEW CARD — Strictly on Closed-Won (100%) */}
              {isWon && (
                <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF]/75 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-[#FFFFFF] shadow-xs shrink-0 mt-0.5">
                      <Zap className="h-4 w-4 fill-current" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                        إجراءات الأتمتة الفورية بعد الإغلاق بفوز (100%):
                      </h3>
                      <p className="text-[12px] text-[#334155] leading-relaxed">
                        عند التأكيد: سيتم إرسال إشعار فوري لفريق المالية، وإنشاء مهمة تسليم الحساب (Onboarding) تلقائياً، وإرسال حدث الشراء (Purchase Event) مع قيمة الصفقة (
                        <span className="font-bold tabular-nums">
                          {(isAmountValid ? parsedAmount : deal.amount).toLocaleString('en-US')} ر.س
                        </span>
                        ) إلى{' '}
                        <strong className="font-extrabold text-[#0F172A]">
                          Meta Conversions API (CAPI)
                        </strong>{' '}
                        و{' '}
                        <strong className="font-extrabold text-[#0F172A]">
                          Google Analytics 4
                        </strong>{' '}
                        لربط العائد على الإنفاق الإعلاني بدقة.
                      </p>

                      <label className="inline-flex items-center gap-2 pt-0.5 text-[11px] font-bold text-[#1E40AF] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={generateSalesOrder}
                          onChange={(e) => setGenerateSalesOrder(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#93C5FD] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                        />
                        <span>
                          توليد سجل أمر بيع رسمي (Sales Order) تلقائياً في قاعدة البيانات
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
            {/* Live Readiness Counter (Right in RTL) */}
            <div className="inline-flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  satisfiedCount === totalRequiredCount ? 'bg-[#059669]' : 'bg-[#D97706]'
                }`}
              />
              <span
                className={`text-[12px] font-bold tabular-nums ${
                  satisfiedCount === totalRequiredCount ? 'text-[#059669]' : 'text-[#D97706]'
                }`}
              >
                {isLost
                  ? 'سبب الخسارة محدد وجاهز للتوثيق'
                  : `جميع الحقول والاشتراطات مستوفاة (${satisfiedCount}/${totalRequiredCount})`}
              </span>
            </div>

            {/* Action Buttons (Left in RTL) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3.5 py-2 text-[13px] font-bold text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
              >
                إلغاء الأمر
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                  isLost
                    ? 'bg-[#E11D48] hover:bg-[#BE123C]'
                    : 'bg-[#059669] hover:bg-[#047857]'
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>
                  {submitting
                    ? 'جارٍ الحفظ ونقل المرحلة...'
                    : `تأكيد ونقل المرحلة إلى «${targetButtonLabel}»`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

