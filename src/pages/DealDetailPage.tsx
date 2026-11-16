import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  FileText,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { CrmTask, DealStage, TouchpointChannel } from '../types/crm';
import {
  DEAL_KANBAN_COLUMNS,
  DEAL_OWNERS,
  getBlueprintTransitionRequirements,
  getDealColumnForStage,
  isDealOverdue,
  resolveDealContact,
  resolveDealLastTouchAttribution,
  type BlueprintTransitionRequirement,
} from '../utils/dealsLogic';
import { formatCurrencySAR } from '../utils/formatters';
import { DealBlueprintModal } from '../components/deals/DealBlueprintModal';
import { getArabicInitials } from '../components/leads/LeadChannelIcon';

const TOUCHPOINT_CHANNELS: TouchpointChannel[] = [
  'اجتماع',
  'مكالمة',
  'واتساب',
  'بريد إلكتروني',
  'موقع ويب',
  'حدث',
];

export const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    deals,
    accounts,
    contacts,
    quotes,
    touchpoints,
    tasks,
    blueprints,
    currentUser,
    activeProfile,
    canViewField,
    canEditField,
    updateDealFields,
    softDeleteDeals,
    addDealTouchpoint,
    addDealTask,
    toggleTaskStatus,
  } = useCrm();

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const contact = useMemo(
    () => (deal ? resolveDealContact(deal, contacts) : null),
    [contacts, deal]
  );
  const account = useMemo(
    () => (deal ? accounts.find((a) => a.id === deal.accountId) ?? null : null),
    [accounts, deal]
  );

  const canUpdateDeal = activeProfile?.modulePermissions?.deals?.update ?? true;
  const canDeleteDeal = activeProfile?.modulePermissions?.deals?.delete ?? true;
  const canViewAmount = canViewField('deals', 'amount');
  const canEditAmount = canEditField('deals', 'amount');

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [probDraft, setProbDraft] = useState('');
  const [closeDateDraft, setCloseDateDraft] = useState('');
  const [ownerDraft, setOwnerDraft] = useState('');
  const [nextStepDraft, setNextStepDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [copiedRwq, setCopiedRwq] = useState(false);
  const [pendingBlueprint, setPendingBlueprint] =
    useState<BlueprintTransitionRequirement | null>(null);

  const [tpOpen, setTpOpen] = useState(false);
  const [tpChannel, setTpChannel] = useState<TouchpointChannel>('اجتماع');
  const [tpSummary, setTpSummary] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<CrmTask['priority']>('عالية');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-20');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!deal) return;
    setTitleDraft(deal.title);
    setAmountDraft(String(deal.amount));
    setProbDraft(String(deal.probability));
    setCloseDateDraft(deal.closeDate);
    setOwnerDraft(deal.ownerName);
    setNextStepDraft(deal.nextStep || '');
  }, [deal]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const dealQuotes = useMemo(() => {
    if (!deal) return [];
    return quotes.filter((q) => q.dealId === deal.id);
  }, [deal, quotes]);

  const dealTouchpoints = useMemo(() => {
    if (!deal) return [];
    return touchpoints.filter(
      (tp) =>
        (tp.relatedEntityType === 'deal' && tp.relatedEntityId === deal.id) ||
        (deal.contactId &&
          tp.relatedEntityType === 'contact' &&
          tp.relatedEntityId === deal.contactId) ||
        (deal.leadUniqueId && tp.leadUniqueId === deal.leadUniqueId)
    );
  }, [deal, touchpoints]);

  const dealTasks = useMemo(() => {
    if (!deal) return [];
    return tasks.filter(
      (t) =>
        t.relatedTo === deal.title ||
        (contact && t.relatedTo === contact.fullName) ||
        (deal.leadUniqueId && t.leadUniqueId === deal.leadUniqueId)
    );
  }, [contact, deal, tasks]);

  if (!deal) {
    return (
      <div className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-12 text-center space-y-3">
        <h1 className="text-[18px] font-bold text-[#131b2e]">
          لم يتم العثور على الصفقة المطلوبة
        </h1>
        <p className="text-[13px] text-[#64748B]">
          ربما تم نقل هذه الصفقة إلى سلة المحذوفات أو تعديل معرفها.
        </p>
        <Link
          to="/deals"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] text-[#ffffff] px-4 py-2 text-[12px] font-semibold"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى الصفقات والفرص</span>
        </Link>
      </div>
    );
  }

  const currentCol = getDealColumnForStage(deal.stage);
  const attribution = resolveDealLastTouchAttribution(deal, contacts, touchpoints);
  const overdue = isDealOverdue(deal);
  const activeDealsBp = blueprints.find(
    (bp) => bp.active && (bp.module === 'الصفقات والمبيعات' || bp.name.includes('صفقات'))
  );

  const handleCopyRwq = async () => {
    const val = deal.leadUniqueId || contact?.leadUniqueId;
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedRwq(true);
      setTimeout(() => setCopiedRwq(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleStageSelect = async (targetStage: DealStage) => {
    if (!canUpdateDeal || deal.stage === targetStage) return;
    const req = getBlueprintTransitionRequirements(blueprints, targetStage);
    if (req.requiresModal) {
      setPendingBlueprint(req);
      return;
    }
    const targetCol = getDealColumnForStage(targetStage);
    await updateDealFields(deal.id, {
      stage: targetStage,
      probability: targetCol.defaultProbability,
    });
    setToastMsg(`تم تحديث المرحلة إلى: ${targetCol.title}`);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdateDeal || !titleDraft.trim()) return;
    setSaving(true);
    try {
      const nextAmount = canEditAmount
        ? Math.max(0, Number(amountDraft) || deal.amount)
        : deal.amount;
      const nextProb = Math.min(100, Math.max(0, Number(probDraft) || 0));
      await updateDealFields(deal.id, {
        title: titleDraft.trim(),
        amount: nextAmount,
        probability: nextProb,
        closeDate: closeDateDraft,
        ownerName: ownerDraft,
        nextStep: nextStepDraft.trim() || undefined,
      });
      setEditing(false);
      setToastMsg('تم حفظ تعديلات الصفقة بنجاح');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpSummary.trim()) return;
    await addDealTouchpoint(deal.id, {
      channel: tpChannel,
      summary: tpSummary.trim(),
      campaign: attribution,
    });
    setTpSummary('');
    setTpOpen(false);
    setToastMsg('تم تسجيل نقطة التواصل في سجل الصفقة');
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await addDealTask(deal.id, {
      title: taskTitle.trim(),
      priority: taskPriority,
      dueDate: taskDueDate,
      assignedToName: deal.ownerName,
    });
    setTaskTitle('');
    setTaskOpen(false);
    setToastMsg('تمت إضافة المهمة التنفيذية');
  };

  const handleDeleteDeal = async () => {
    await softDeleteDeals([deal.id]);
    navigate('/deals');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Flush Top Header */}
      <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#ffffff] border-t border-b border-[#E2E8F0] px-4 lg:px-6 py-4 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
              <Link
                to="/deals"
                className="inline-flex items-center gap-1 hover:text-[#2563EB] font-semibold transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى الصفقات والفرص</span>
              </Link>
              <span>/</span>
              <span className="truncate">{deal.accountName}</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] font-bold text-[#131b2e]">{deal.title}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold">
                {currentCol.title} ({deal.probability}%)
              </span>
              {(deal.leadUniqueId || contact?.leadUniqueId) && (
                <button
                  type="button"
                  onClick={handleCopyRwq}
                  className="inline-flex items-center gap-1 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#2563EB] px-2 py-0.5 font-mono text-[11px] font-bold text-[#334155] tabular-nums"
                >
                  <span>{deal.leadUniqueId || contact?.leadUniqueId}</span>
                  {copiedRwq ? (
                    <Check className="h-3 w-3 text-[#10B981]" />
                  ) : (
                    <Copy className="h-3 w-3 text-[#94A3B8]" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] px-4 py-2 text-left">
              <span className="block text-[10px] font-semibold text-[#64748B]">
                قيمة الصفقة
              </span>
              <span className="text-[16px] font-extrabold text-[#2563EB] tabular-nums">
                {canViewAmount ? formatCurrencySAR(deal.amount, deal.currency) : 'محجوب (FLS)'}
              </span>
            </div>

            {canUpdateDeal && (
              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#ffffff] hover:bg-[#F8FAFC] px-3.5 py-2 text-[12px] font-semibold text-[#131b2e]"
              >
                <Pencil className="h-3.5 w-3.5 text-[#2563EB]" />
                <span>{editing ? 'إلغاء التعديل' : 'تعديل الحقول'}</span>
              </button>
            )}

            {canDeleteDeal && (
              <>
                {confirmDelete ? (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-3 py-1.5 text-[12px]">
                    <span className="font-semibold text-[#E11D48]">تأكيد الحذف؟</span>
                    <button
                      type="button"
                      onClick={handleDeleteDeal}
                      className="rounded-lg bg-[#E11D48] text-[#ffffff] px-2.5 py-1 text-[11px] font-bold"
                    >
                      حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-[11px] text-[#64748B] px-1"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label="حذف الصفقة"
                    className="p-2 rounded-xl border border-[#E2E8F0] text-[#94A3B8] hover:text-[#E11D48] hover:bg-[#FFF1F2]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Interactive Blueprint Stage Bar */}
        <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#131b2e]">
              <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
              <span>
                مسار مراحل الصفقة{' '}
                {activeDealsBp ? `(${activeDealsBp.name})` : ''}
              </span>
            </span>
            <span className="text-[#64748B]">
              انقر على أي مرحلة للانتقال وتطبيق متطلبات Blueprint
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DEAL_KANBAN_COLUMNS.map((col, index) => {
              const isCurrent = col.matchStages.includes(deal.stage);
              const isPast =
                !isCurrent &&
                col.id !== 'lost' &&
                currentCol.id !== 'lost' &&
                DEAL_KANBAN_COLUMNS.findIndex((c) => c.id === currentCol.id) > index;

              return (
                <button
                  key={col.id}
                  type="button"
                  disabled={!canUpdateDeal}
                  onClick={() => handleStageSelect(col.targetStage)}
                  className={`rounded-xl border px-3 py-2 text-right transition-all ${
                    isCurrent
                      ? 'bg-[#2563EB] border-[#2563EB] text-[#ffffff] shadow-xs'
                      : isPast
                      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] hover:border-[#10B981]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:bg-[#EFF6FF]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">{col.title}</span>
                    <span className="tabular-nums opacity-85">{col.probabilityLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right Column (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Card 1: Deal Fields */}
          <section className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#131b2e]">
                تفاصيل الصفقة والبيانات المالية
              </h2>
              {overdue && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] text-[11px] font-bold">
                  تاريخ الإغلاق متأخر ({deal.closeDate})
                </span>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSaveDetails} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    عنوان الصفقة
                  </label>
                  <input
                    type="text"
                    required
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] text-[#131b2e]"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                    <span>القيمة المالية (ر.س)</span>
                    {!canEditAmount && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#D97706]">
                        <Lock className="h-3 w-3" />
                        FLS
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    disabled={!canEditAmount}
                    value={amountDraft}
                    onChange={(e) => setAmountDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] font-bold tabular-nums disabled:bg-[#F8FAFC]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    نسبة الاحتمال (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={probDraft}
                    onChange={(e) => setProbDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[13px] font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    تاريخ الإغلاق المتوقع
                  </label>
                  <input
                    type="date"
                    value={closeDateDraft}
                    onChange={(e) => setCloseDateDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    مسؤول الصفقة
                  </label>
                  <select
                    value={ownerDraft}
                    onChange={(e) => setOwnerDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px]"
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

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                    الخطوة التنفيذية التالية
                  </label>
                  <input
                    type="text"
                    value={nextStepDraft}
                    onChange={(e) => setNextStepDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-2 text-[12px]"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl border border-[#CBD5E1] px-4 py-2 text-[12px] font-semibold text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#ffffff] px-5 py-2 text-[12px] font-semibold"
                  >
                    {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[12px]">
                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <span className="text-[11px] text-[#64748B] block">مسؤول الصفقة</span>
                  <div className="flex items-center gap-2 mt-1 font-bold text-[#131b2e]">
                    <span className="w-6 h-6 rounded-full bg-[#2563EB] text-[#ffffff] text-[10px] flex items-center justify-center">
                      {getArabicInitials(deal.ownerName)}
                    </span>
                    <span>{deal.ownerName}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <span className="text-[11px] text-[#64748B] block">
                    تاريخ الإغلاق المتوقع
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 font-bold text-[#131b2e] tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
                    <span>{deal.closeDate}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <span className="text-[11px] text-[#64748B] block">
                    مصدر الإسناد (Last-Touch Attribution)
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 font-bold text-[#131b2e]">
                    <Compass className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>{attribution}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <span className="text-[11px] text-[#64748B] block">
                    العائد المرجح المتوقع
                  </span>
                  <span className="mt-1 font-extrabold text-[#059669] tabular-nums block">
                    {canViewAmount
                      ? formatCurrencySAR(
                          Math.round((deal.amount * deal.probability) / 100),
                          deal.currency
                        )
                      : 'محجوب (FLS)'}
                  </span>
                </div>

                <div className="sm:col-span-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                  <span className="text-[11px] text-[#64748B] block">
                    الخطوة التنفيذية القادمة
                  </span>
                  <span className="mt-1 font-semibold text-[#131b2e] block">
                    {deal.nextStep || 'لم يتم تحديد خطوة تالية بعد'}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Card 2: Related Quotes */}
          <section className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-[15px] font-bold text-[#131b2e]">
                  عروض الأسعار المرتبطة ({dealQuotes.length})
                </h2>
              </div>
            </div>

            {dealQuotes.length === 0 ? (
              <p className="text-[12px] text-[#64748B] py-2">
                لا توجد عروض أسعار صادرة لهذه الصفقة حتى الآن.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[11px] text-[#64748B]">
                      <th className="py-2 px-2">رقم العرض</th>
                      <th className="py-2 px-2">الموضوع</th>
                      <th className="py-2 px-2">الإجمالي</th>
                      <th className="py-2 px-2">الحالة</th>
                      <th className="py-2 px-2">صالح حتى</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {dealQuotes.map((qt) => (
                      <tr key={qt.id}>
                        <td className="py-2.5 px-2 font-mono font-bold text-[#2563EB]">
                          {qt.quoteNumber}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-[#131b2e]">
                          {qt.subject}
                        </td>
                        <td className="py-2.5 px-2 font-bold tabular-nums">
                          {canViewAmount ? formatCurrencySAR(qt.totalAmount) : 'محجوب'}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[11px] font-semibold text-[#334155]">
                            {qt.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[#64748B] tabular-nums">
                          {qt.validUntil}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card 3: Touchpoints & Blueprint Audit Log */}
          <section className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[#131b2e]">
                سجل الدخول والمصادر والاعتمادات ({dealTouchpoints.length})
              </h2>
              <button
                type="button"
                onClick={() => setTpOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-[#ffffff] hover:bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-semibold text-[#2563EB]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>تسجيل متابعة</span>
              </button>
            </div>

            {tpOpen && (
              <form
                onSubmit={handleAddTouchpoint}
                className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={tpChannel}
                    onChange={(e) => setTpChannel(e.target.value as TouchpointChannel)}
                    className="rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px]"
                  >
                    {TOUCHPOINT_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={tpSummary}
                    onChange={(e) => setTpSummary(e.target.value)}
                    placeholder="ملخص الاجتماع أو التحديث..."
                    className="sm:col-span-2 rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-3 py-1.5 text-[12px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTpOpen(false)}
                    className="text-[11px] font-semibold text-[#64748B] px-2"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#2563EB] text-[#ffffff] px-3.5 py-1.5 text-[11px] font-semibold"
                  >
                    حفظ السجل
                  </button>
                </div>
              </form>
            )}

            {dealTouchpoints.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">
                لا توجد نقاط اتصال مسجلة لهذه الصفقة حتى الآن.
              </p>
            ) : (
              <div className="space-y-2.5">
                {dealTouchpoints.map((tp) => (
                  <div
                    key={tp.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[10px] font-bold">
                          {tp.channel}
                        </span>
                        {tp.eventType && (
                          <span className="text-[11px] font-bold text-[#131b2e]">
                            {tp.eventType}
                          </span>
                        )}
                        {tp.campaign && (
                          <span className="text-[10px] text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-md font-semibold">
                            {tp.campaign}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#334155]">{tp.summary}</p>
                    </div>
                    <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0">
                      {tp.occurredAt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Left Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Contact & Account Card */}
          <section className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-5 shadow-2xs space-y-4">
            <h2 className="text-[14px] font-bold text-[#131b2e]">
              جهة الاتصال والحساب المرتبط
            </h2>

            {contact ? (
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/contacts/${contact.id}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2563EB] hover:underline"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <span>{contact.fullName}</span>
                  </Link>
                  {contact.leadUniqueId && (
                    <span className="font-mono text-[10px] font-bold text-[#475569]">
                      {contact.leadUniqueId}
                    </span>
                  )}
                </div>
                {contact.jobTitle && (
                  <p className="text-[11px] text-[#64748B]">{contact.jobTitle}</p>
                )}
                {contact.phone && (
                  <p className="text-[11px] font-semibold text-[#334155] tabular-nums" dir="ltr">
                    {contact.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-[#64748B]">
                لا توجد جهة اتصال فردية مربوطة مباشرة.
              </p>
            )}

            <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#131b2e]">
                <Building2 className="h-4 w-4 text-[#2563EB]" />
                <span>{deal.accountName}</span>
              </div>
              {account && (
                <p className="text-[11px] text-[#64748B]">
                  {account.industry} · الفئة: {account.tier}
                </p>
              )}
            </div>
          </section>

          {/* Tasks Card */}
          <section className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#131b2e]">
                المهام التنفيذية ({dealTasks.length})
              </h2>
              <button
                type="button"
                onClick={() => setTaskOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#EFF6FF] text-[#2563EB] px-2.5 py-1 text-[11px] font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>مهمة</span>
              </button>
            </div>

            {taskOpen && (
              <form
                onSubmit={handleAddTask}
                className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2"
              >
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="عنوان المهمة..."
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskPriority}
                    onChange={(e) =>
                      setTaskPriority(e.target.value as CrmTask['priority'])
                    }
                    className="rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2 py-1.5 text-[11px]"
                  >
                    <option value="عالية">عالية</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="منخفضة">منخفضة</option>
                  </select>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2 py-1.5 text-[11px] tabular-nums"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskOpen(false)}
                    className="text-[11px] text-[#64748B]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#2563EB] text-[#ffffff] px-3 py-1 text-[11px] font-semibold"
                  >
                    حفظ
                  </button>
                </div>
              </form>
            )}

            {dealTasks.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">
                لا توجد مهام مجدولة لهذه الصفقة.
              </p>
            ) : (
              <div className="space-y-2">
                {dealTasks.map((task) => {
                  const done = task.status === 'مكتملة';
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border border-[#E2E8F0] p-2.5 flex items-start gap-2.5 text-[12px]"
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleTaskStatus(task.id)}
                        className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-semibold ${
                            done ? 'line-through text-[#94A3B8]' : 'text-[#131b2e]'
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0.5 tabular-nums">
                          <span>{task.priority}</span>
                          <span>·</span>
                          <span>{task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <DealBlueprintModal
        open={Boolean(pendingBlueprint)}
        deal={deal}
        requirement={pendingBlueprint}
        canEditAmount={canEditAmount}
        onClose={() => setPendingBlueprint(null)}
        onConfirmTransition={async (payload) => {
          await updateDealFields(
            payload.dealId,
            {
              stage: payload.targetStage,
              probability: payload.probability,
              amount: payload.amount,
              nextStep: payload.nextStep,
              closeDate: payload.closeDate,
            },
            { summary: payload.auditSummary }
          );
          setToastMsg(`تم اعتماد انتقال Blueprint (${payload.targetStage})`);
        }}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-[#131b2e] text-[#ffffff] px-4 py-2.5 text-[12px] font-semibold shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-[#94A3B8] hover:text-[#ffffff]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
