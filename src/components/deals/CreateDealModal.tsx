import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, PlusCircle, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Deal, DealStage } from '../../types/crm';
import { DEAL_OWNERS, getDealColumnForStage } from '../../utils/dealsLogic';

interface CreateDealModalProps {
  open: boolean;
  initialStage?: DealStage;
  onClose: () => void;
  onCreated?: (deal: Deal) => void;
}

const STAGE_OPTIONS: Array<{ stage: DealStage; probability: number; label: string }> = [
  { stage: 'تأهيل مبدئي', probability: 20, label: 'التأهيل المبدئي (20%)' },
  { stage: 'تحديد الاحتياج', probability: 40, label: 'تحديد الاحتياج (40%)' },
  { stage: 'عرض سعر', probability: 50, label: 'تم تقديم العرض (50%)' },
  { stage: 'تفاوض', probability: 80, label: 'التفاوض والعقود (80%)' },
];

const ATTRIBUTION_OPTIONS = [
  'إعلانات لينكد إن (LinkedIn Ads)',
  'إعلان ميتا - رواد الأعمال Q2',
  'توصية من عميل حالي',
  'بحث مجاني (SEO)',
  'حملة Meta Ads',
  'تواصل مباشر',
];

export const CreateDealModal: React.FC<CreateDealModalProps> = ({
  open,
  initialStage = 'تأهيل مبدئي',
  onClose,
  onCreated,
}) => {
  const { accounts, contacts, currentUser, createDeal } = useCrm();

  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState('acc_madar');
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('250000');
  const [stage, setStage] = useState<DealStage>(initialStage);
  const [probability, setProbability] = useState(
    getDealColumnForStage(initialStage).defaultProbability
  );
  const [closeDate, setCloseDate] = useState('2026-11-30');
  const [ownerName, setOwnerName] = useState(DEAL_OWNERS[0] || currentUser.fullName);
  const [attributionSource, setAttributionSource] = useState(ATTRIBUTION_OPTIONS[0]);
  const [nextStep, setNextStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const accountContacts = useMemo(() => {
    const matched = contacts.filter((c) => c.accountId === accountId);
    return matched.length > 0 ? matched : contacts;
  }, [accountId, contacts]);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    const firstAcc = accounts[0]?.id ?? 'unassigned';
    setAccountId(firstAcc);
    const firstCon =
      contacts.find((c) => c.accountId === firstAcc)?.id ?? contacts[0]?.id ?? '';
    setContactId(firstCon);
    setAmount('250000');
    setStage(initialStage);
    setProbability(getDealColumnForStage(initialStage).defaultProbability);
    setCloseDate('2026-11-30');
    setOwnerName(DEAL_OWNERS[0] || currentUser.fullName);
    setAttributionSource(ATTRIBUTION_OPTIONS[0]);
    setNextStep('');
    setErrorMsg('');
    setSaving(false);
  }, [accounts, contacts, currentUser.fullName, initialStage, open]);

  if (!open) return null;

  const handleStageChange = (nextStage: DealStage) => {
    setStage(nextStage);
    const preset = STAGE_OPTIONS.find((s) => s.stage === nextStage);
    if (preset) {
      setProbability(preset.probability);
    }
  };

  const handleAccountChange = (nextAccountId: string) => {
    setAccountId(nextAccountId);
    const primaryContact = contacts.find((c) => c.accountId === nextAccountId);
    if (primaryContact) {
      setContactId(primaryContact.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim()) {
      setErrorMsg('يرجى إدخال عنوان الصفقة أو الفرصة البيعية');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('يرجى إدخال قيمة مالية موجبة للصفقة');
      return;
    }
    if (!closeDate.trim()) {
      setErrorMsg('يرجى تحديد تاريخ الإغلاق المتوقع');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const created = await createDeal({
        title: title.trim(),
        accountId,
        contactId: contactId || undefined,
        amount: numericAmount,
        stage,
        probability,
        closeDate,
        ownerName,
        nextStep: nextStep.trim() || undefined,
        attributionSource,
      });
      onCreated?.(created);
      onClose();
    } catch {
      setErrorMsg('تعذر حفظ الصفقة الجديدة، يرجى المحاولة مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-deal-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] border border-[#E2E8F0] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="create-deal-modal-title"
                className="text-[15px] font-bold text-[#131b2e]"
              >
                إضافة صفقة وفرصة بيع جديدة
              </h2>
              <p className="text-[11px] text-[#64748B]">
                ربط فوري بالحساب وجهات الاتصال وسجل الإسناد في Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#E2E8F0]/60 hover:text-[#131b2e]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-3.5 py-2 text-[12px] font-semibold text-[#E11D48]">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                اسم الصفقة / الفرصة *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: منظومة الربط المالي السحابي — شركة أرامكس"
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                الحساب / المنشأة *
              </label>
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
                <option value="unassigned">عميل فردي B2C (بدون منشأة)</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                جهة الاتصال المرتبطة (RWQ)
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              >
                <option value="">بدون تحديد جهة اتصال</option>
                {accountContacts.map((con) => (
                  <option key={con.id} value={con.id}>
                    {con.fullName} {con.leadUniqueId ? `(${con.leadUniqueId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                قيمة الصفقة (ر.س) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] font-bold text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                تاريخ الإغلاق المتوقع *
              </label>
              <input
                type="date"
                required
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                مرحلة المسار
              </label>
              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value as DealStage)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.stage} value={opt.stage}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                مسؤول الصفقة
              </label>
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              >
                {Array.from(new Set([currentUser.fullName, ...DEAL_OWNERS])).map(
                  (owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                مصدر الإسناد (Last-Touch)
              </label>
              <select
                value={attributionSource}
                onChange={(e) => setAttributionSource(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              >
                {ATTRIBUTION_OPTIONS.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                احتمالية النجاح (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] font-semibold text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-[#131b2e] mb-1">
                الخطوة التنفيذية القادمة
              </label>
              <input
                type="text"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="مثال: إرسال العرض المالي وجدولة جلسة المراجعة مع المشتريات"
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#CBD5E1] bg-[#ffffff] hover:bg-[#F8FAFC] px-4 py-2 text-[12px] font-semibold text-[#475569] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#ffffff] px-5 py-2 text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{saving ? 'جارٍ الحفظ...' : 'إنشاء الصفقة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
