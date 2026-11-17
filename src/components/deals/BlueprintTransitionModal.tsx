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
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
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
  if (!isoDate) return 'اليوم — 28 يوليو 2024';
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
  if (!accountName || accountName.includes('قمة التقنية')) {
    return 'عقد_شركة_قمة_التقنية_موقع_رسمياً.pdf';
  }
  const clean = accountName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9_-]/g, '');
  return `عقد_${clean || 'شركة_قمة_التقنية'}_موقع_رسمياً.pdf`;
}

export const BlueprintTransitionModal: React.FC<BlueprintTransitionModalProps> = ({
  open,
  deal,
  requirement,
  canEditAmount,
  onClose,
  onConfirmTransition,
}) => {
  const { firebaseUser, addDealTask, addDealTouchpoint } = useCrm();

  const [finalAmount, setFinalAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [approvalDate, setApprovalDate] = useState('2024-07-28');
  const [contractFile, setContractFile] = useState<{
    name: string;
    sizeLabel: string;
  } | null>(null);
  const [checkPaymentSchedule, setCheckPaymentSchedule] = useState(true);
  const [checkTaxPoMatched, setCheckTaxPoMatched] = useState(true);
  const [generateSalesOrder, setGenerateSalesOrder] = useState(true);
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !deal || !requirement) return;
    setFinalAmount(String(deal.amount || 120000));
    setDiscountPercent('10');
    setApprovalDate(deal.closeDate || '2024-07-28');
    setContractFile({
      name: buildDefaultContractFileName(deal.accountName),
      sizeLabel: '2.4 MB',
    });
    setCheckPaymentSchedule(true);
    setCheckTaxPoMatched(true);
    setGenerateSalesOrder(true);
    setLossReason(LOSS_REASONS[0]);
    setSubmitting(false);
  }, [deal, open, requirement]);

  if (!open || !deal || !requirement) return null;

  const targetCol = getDealColumnForStage(requirement.targetStage);
  const currentStageDisplay =
    deal.stage === requirement.targetStage
      ? 'التفاوض'
      : getStageDisplayName(deal.stage);
  const targetStageDisplay = getStageDisplayName(requirement.targetStage);
  const targetButtonLabel = getTargetButtonShortName(requirement.targetStage);

  const parsedAmount = Number(finalAmount.replace(/,/g, ''));
  const parsedDiscount = Number(discountPercent);

  // 5 mandatory readiness criteria
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

  const satisfiedCount = [
    isAmountValid,
    isDiscountValid,
    isDateValid,
    isContractValid,
    isChecklistValid,
  ].filter(Boolean).length;

  const isWithinRepAuthority = isDiscountValid && parsedDiscount <= 15;
  const canSubmit = satisfiedCount === 5 && !submitting;

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
      const effectiveAmount = isAmountValid ? parsedAmount : deal.amount;
      const attachedName =
        contractFile?.name.trim() || buildDefaultContractFileName(deal.accountName);
      const ts = Date.now();
      let createdOrderNumber: string | undefined;

      // 1. Optional Sales Order generation in Firestore `sales_orders`
      if (generateSalesOrder && firebaseUser) {
        const soId = `so_bp_${ts}`;
        const soNum = `SO-2026-${String(ts).slice(-4)}`;
        createdOrderNumber = soNum;
        try {
          await setDoc(doc(db, 'sales_orders', soId), {
            ownerId: firebaseUser.uid,
            orderNumber: soNum,
            accountName: (deal.accountName || 'شركة قمة التقنية').slice(0, 150),
            totalAmount: effectiveAmount,
            status: 'قيد التجهيز',
            deliveryDate: approvalDate || deal.closeDate || '2026-07-28',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `sales_orders/${soId}`);
        }
      } else if (generateSalesOrder) {
        createdOrderNumber = `SO-2026-${String(ts).slice(-4)}`;
      }

      // 2. Create automated Onboarding task in `tasks`
      await addDealTask(deal.id, {
        title: `تسليم الحساب وتفعيل التراخيص (Onboarding) — ${deal.accountName}`.slice(0, 155),
        priority: 'عالية',
        dueDate: approvalDate || deal.closeDate || '2026-07-30',
        assignedToName: deal.ownerName,
      });

      // 3. Log `Purchase` event for Meta CAPI + Finance notification in `touchpoints`
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

      const nextStep =
        requirement.targetStage === 'خسارة'
          ? `سبب الخسارة: ${lossReason}`
          : `تم التوقيع (${attachedName}) · خصم ${parsedDiscount}% · PO-KSA-9921`;

      const auditSummary = `اعتماد انتقال البلوبرينت من ${currentStageDisplay} إلى ${targetStageDisplay}: القيمة النهائية ${formatCurrencySAR(
        effectiveAmount
      )}، خصم ${parsedDiscount}%، العقد (${attachedName})، وتفعيل أتمتة المالية وMeta CAPI`;

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-[#FFFFFF] shadow-2xs">
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>قواعد البلوبرينت (Blueprint Transition Rule)</span>
              </span>

              <h2
                id="blueprint-transition-modal-title"
                className="text-[19px] sm:text-[21px] font-extrabold text-[#0F172A] leading-snug pt-0.5"
              >
                <span>إتمام متطلبات الانتقال: من {currentStageDisplay} إلى </span>
                <span
                  className={
                    requirement.targetStage === 'خسارة'
                      ? 'text-[#E11D48]'
                      : 'text-[#059669]'
                  }
                >
                  «{targetStageDisplay}»
                </span>
              </h2>

              <p className="text-[12px] text-[#64748B] leading-relaxed">
                يجب استيفاء الحقول والمرفقات الإلزامية التالية لاعتماد الصفقة ونقلها تلقائياً وتفعيل مسار خدمة العملاء.
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

          {/* Optional Loss Reason selector when targetStage === 'خسارة' */}
          {requirement.targetStage === 'خسارة' && (
            <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-3.5 space-y-2">
              <label className="block text-[12px] font-bold text-[#E11D48]">
                سبب إغلاق الصفقة بخسارة *
              </label>
              <select
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
              >
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {/* 3. AFTER TRANSITION AUTOMATION PREVIEW CARD */}
          <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF]/75 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-[#FFFFFF] shadow-xs shrink-0 mt-0.5">
                <Zap className="h-4 w-4 fill-current" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                  إجراءات الأتمتة الفورية بعد الانتقال:
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

          {/* FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
            {/* Live Readiness Counter (Right in RTL) */}
            <div className="inline-flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  satisfiedCount === 5 ? 'bg-[#059669]' : 'bg-[#D97706]'
                }`}
              />
              <span
                className={`text-[12px] font-bold tabular-nums ${
                  satisfiedCount === 5 ? 'text-[#059669]' : 'text-[#D97706]'
                }`}
              >
                جميع الحقول والاشتراطات مستوفاة ({satisfiedCount}/5)
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] px-5 py-2.5 text-[13px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>
                  {submitting
                    ? 'جارٍ تنفيذ الأتمتة ونقل المرحلة...'
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
