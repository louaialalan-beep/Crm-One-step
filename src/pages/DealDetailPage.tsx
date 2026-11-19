import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Lock,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';
import { encodeZatcaPhase1TlvBase64 } from '../services/quotesInvoicesService';
import type {
  CrmTask,
  DealStage,
  FinancialLineItem,
  InboxMessage,
  TouchpointChannel,
} from '../types/crm';
import {
  DEAL_OWNERS,
  getBlueprintTransitionRequirements,
  getDealColumnForStage,
  resolveDealContact,
  resolveDealLastTouchAttribution,
  type BlueprintTransitionRequirement,
} from '../utils/dealsLogic';
import { formatCurrencySAR } from '../utils/formatters';
import { BlueprintTransitionModal } from '../components/deals/BlueprintTransitionModal';
import { getArabicInitials } from '../components/leads/LeadChannelIcon';

const TOUCHPOINT_CHANNELS: TouchpointChannel[] = [
  'اجتماع',
  'مكالمة',
  'واتساب',
  'بريد إلكتروني',
  'موقع ويب',
  'حدث',
];

interface BlueprintStep {
  key: 'qualifying' | 'proposal' | 'negotiation' | 'won';
  stepNumber: number;
  label: string;
  targetStage: DealStage;
  matchStages: DealStage[];
}

const BLUEPRINT_STEPS: readonly BlueprintStep[] = [
  {
    key: 'qualifying',
    stepNumber: 1,
    label: '1. التأهيل المبدئي',
    targetStage: 'تأهيل مبدئي',
    matchStages: ['تأهيل مبدئي', 'تحديد الاحتياج'],
  },
  {
    key: 'proposal',
    stepNumber: 2,
    label: '2. تقديم عرض السعر',
    targetStage: 'عرض سعر',
    matchStages: ['عرض سعر'],
  },
  {
    key: 'negotiation',
    stepNumber: 3,
    label: '3. التفاوض ومراجعة العقد',
    targetStage: 'تفاوض',
    matchStages: ['تفاوض'],
  },
  {
    key: 'won',
    stepNumber: 4,
    label: '4. إغلاق - فوز',
    targetStage: 'مكتملة',
    matchStages: ['مكتملة'],
  },
];

interface QuoteLineItem {
  id: string;
  name: string;
  description: string;
  licenseType: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

const DEAL_QUICK_REPLIES: Array<{ command: string; label: string; template: string }> = [
  {
    command: '/تأكيد_العقد',
    label: 'إرسال مسودة العقد النهائي',
    template:
      'أهلاً بكم، تم تجهيز مسودة العقد النهائية وتثبيت الخصم المعتمد كما اتفقنا، بانتظار اعتمادكم لتفعيل التراخيص فوراً.',
  },
  {
    command: '/إرسال_الفاتورة',
    label: 'إرسال الفاتورة الضريبية',
    template:
      'تم إصدار الفاتورة الضريبية المبدئية متضمنة ضريبة القيمة المضافة (15%) ومرفقة عبر البريد الرسمي.',
  },
  {
    command: '/رابط_الدفع',
    label: 'مشاركة تفاصيل السداد البنكي',
    template:
      'مرفق رقم الآيبان الرسمي للشركة ومرجع أمر الشراء (PO) لإتمام التحويل البنكي وتفعيل الباقة.',
  },
  {
    command: '/مراجعة_SLA',
    label: 'تأكيد اتفاقية مستوى الخدمة',
    template:
      'تمت مراجعة كافة بنود اتفاقية مستوى الخدمة (SLA) واعتماد الدعم الفني على مدار الساعة لحسابكم.',
  },
];

function buildInitialLineItems(dealTitle: string, dealAmount: number): QuoteLineItem[] {
  const safeAmount = Math.max(1000, dealAmount || 120000);
  // Pre-tax target so subtotal - discount + 15% VAT matches or tracks clearly
  const preTaxBase = Math.round(safeAmount / 1.15);
  const corePrice = Math.round(preTaxBase * 0.72);
  const seatsTotal = Math.round(preTaxBase * 0.22);
  const onboardingPrice = Math.max(1000, preTaxBase - corePrice - seatsTotal);

  return [
    {
      id: 'li_1',
      name: dealTitle || 'باقة رواق ERP السحابية المتكاملة - اشتراك سنوي',
      description: 'تتضمن المحاسبة، المبيعات، إدارة العملاء والتقارير التحليلية',
      licenseType: 'ترخيص سنوي رئيسي',
      quantity: 1,
      unitPrice: corePrice,
      discountPercent: 10,
    },
    {
      id: 'li_2',
      name: 'تراخيص مستخدم إضافية (باقة 10 مستخدمين)',
      description: 'صلاحيات وصول موسعة مع لوحات تحكم تنفيذية',
      licenseType: 'ترخيص مستخدم مخصص',
      quantity: 2,
      unitPrice: Math.round(seatsTotal / 2),
      discountPercent: 10,
    },
    {
      id: 'li_3',
      name: 'خدمة الربط والتكامل المالي (Onboarding & API)',
      description: 'ربط منظومة هيئة الزكاة والضريبة والجمارك (فاتورة)',
      licenseType: 'خدمة لمرة واحدة',
      quantity: 1,
      unitPrice: onboardingPrice,
      discountPercent: 0,
    },
  ];
}

function computeDaysRemainingLabel(closeDate: string): { text: string; isUrgent: boolean } {
  if (!closeDate) return { text: 'غير محدد', isUrgent: false };
  const target = new Date(closeDate);
  const ref = new Date('2026-11-16');
  if (Number.isNaN(target.getTime())) return { text: closeDate, isUrgent: false };
  const diffDays = Math.ceil((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { text: `متأخر ${Math.abs(diffDays)} يوم`, isUrgent: true };
  }
  if (diffDays <= 5) {
    return { text: `متبقي ${diffDays} يوم`, isUrgent: true };
  }
  return { text: `متبقي ${diffDays} يوم`, isUrgent: false };
}

export const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    firebaseUser,
    deals,
    accounts,
    contacts,
    quotes,
    salesOrders,
    touchpoints,
    messages,
    tasks,
    blueprints,
    customFields,
    currentUser,
    activeProfile,
    canViewField,
    canEditField,
    getFieldAccess,
    updateDealFields,
    updateContactFields,
    softDeleteDeals,
    addDealTouchpoint,
    addDealTask,
    toggleTaskStatus,
    sendInboxReply,
    openInboxForContact,
    users,
    quickReplies,
    createQuote,
    createSalesOrder,
    createInvoice,
    invoices,
    currentOrgId,
    currentOrganization,
    baseCurrency,
  } = useCrm();

  const activeDealOwners = useMemo(() => {
    const fromUsers = users
      .filter((u) => u.status === 'active')
      .map((u) => u.fullName)
      .filter(Boolean);
    return fromUsers.length > 0 ? Array.from(new Set(fromUsers)) : DEAL_OWNERS;
  }, [users]);

  const activeBlueprintSteps = useMemo(() => {
    const dealsBp = blueprints.find((b) => (b.module === 'deals' || b.module === 'الصفقات') && b.active);
    if (!dealsBp || !dealsBp.stageSteps || dealsBp.stageSteps.length === 0) {
      return BLUEPRINT_STEPS;
    }
    const stageSet = new Set<string>(dealsBp.stageSteps);
    const matched = BLUEPRINT_STEPS.filter(
      (step) =>
        stageSet.has(step.label) ||
        stageSet.has(step.targetStage) ||
        step.matchStages.some((st) => stageSet.has(st))
    );
    return matched.length > 0 ? matched : BLUEPRINT_STEPS;
  }, [blueprints]);

  const activeQuickReplies = useMemo(() => {
    if (quickReplies && quickReplies.length > 0) {
      return quickReplies
        .filter((qr) => !qr.module || qr.module === 'deals' || qr.module === 'all')
        .map((qr) => ({
          command: qr.command.startsWith('/') ? qr.command : `/${qr.command}`,
          label: qr.label,
          template: qr.template,
        }));
    }
    return DEAL_QUICK_REPLIES;
  }, [quickReplies]);

  const deal = useMemo(() => deals.find((d) => d.id === id) ?? null, [deals, id]);
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
  const probAccess = getFieldAccess('deals', 'probability');
  const closeDateAccess = getFieldAccess('deals', 'closeDate');
  const ownerAccess = getFieldAccess('deals', 'ownerName');
  const nextStepAccess = getFieldAccess('deals', 'nextStep');

  const dealCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'deals')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const [quickEditMode, setQuickEditMode] = useState(false);
  const [amountDraft, setAmountDraft] = useState('');
  const [closeDateDraft, setCloseDateDraft] = useState('');
  const [ownerDraft, setOwnerDraft] = useState('');
  const [nextStepDraft, setNextStepDraft] = useState('');
  const [dealTypeDraft, setDealTypeDraft] = useState('ترقية اشتراك سنوي للمؤسسات (Upsell & Expansion)');
  const [approvedDiscountDraft, setApprovedDiscountDraft] = useState('10');
  const [paymentTermsDraft, setPaymentTermsDraft] = useState(
    'أمر شراء (PO) مع تحويل بنكي فوري 100%'
  );
  const [customValuesDraft, setCustomValuesDraft] = useState<
    Record<string, string | number | boolean>
  >({ contract_duration_months: 12 });

  const [dealTags, setDealTags] = useState<string[]>([
    'ترقية_سحابية',
    'عميل_استراتيجي',
    'Q4_مبيعات',
  ]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemLicense, setNewItemLicense] = useState('ترخيص سنوي');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('15000');
  const [newItemDiscount, setNewItemDiscount] = useState('0');

  const [copiedRwq, setCopiedRwq] = useState(false);
  const [pendingBlueprint, setPendingBlueprint] =
    useState<BlueprintTransitionRequirement | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [tpOpen, setTpOpen] = useState(false);
  const [tpChannel, setTpChannel] = useState<TouchpointChannel>('اجتماع');
  const [tpSummary, setTpSummary] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<CrmTask['priority']>('عالية');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-20');

  const [chatText, setChatText] = useState('');
  const [chatChannel, setChatChannel] = useState<InboxMessage['channel']>('whatsapp');
  const [submittingQuoteOrder, setSubmittingQuoteOrder] = useState(false);
  const [localCreatedOrderNumber, setLocalCreatedOrderNumber] = useState<string | null>(null);
  const [localCreatedQuoteNumber, setLocalCreatedQuoteNumber] = useState<string | null>(null);
  const [localCreatedInvoiceNumber, setLocalCreatedInvoiceNumber] = useState<string | null>(null);
  const [zatcaQrBase64Preview, setZatcaQrBase64Preview] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!deal) return;
    setAmountDraft(String(deal.amount));
    setCloseDateDraft(deal.closeDate);
    setOwnerDraft(deal.ownerName);
    setNextStepDraft(deal.nextStep || '');
    setLineItems(buildInitialLineItems(deal.title, deal.amount));
    if (contact?.tags && contact.tags.length > 0) {
      setDealTags(contact.tags);
    }
    if (
      contact?.channel === 'whatsapp' ||
      contact?.channel === 'instagram' ||
      contact?.channel === 'messenger'
    ) {
      setChatChannel(contact.channel);
    }
  }, [deal?.id]);

  useEffect(() => {
    if (!deal) return;
    setAmountDraft(String(deal.amount));
    setCloseDateDraft(deal.closeDate);
    setOwnerDraft(deal.ownerName);
    setNextStepDraft(deal.nextStep || '');
  }, [deal]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!errorMsg) return;
    const t = window.setTimeout(() => setErrorMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [errorMsg]);

  const dealQuotes = useMemo(() => {
    if (!deal) return [];
    return quotes.filter((q) => q.dealId === deal.id);
  }, [deal, quotes]);

  const dealInvoices = useMemo(() => {
    if (!deal) return [];
    return invoices.filter((inv) => inv.dealId === deal.id);
  }, [deal, invoices]);

  const dealTouchpoints = useMemo(() => {
    if (!deal) return [];
    return touchpoints.filter(
      (tp) =>
        (tp.relatedEntityType === 'deal' && tp.relatedEntityId === deal.id) ||
        (deal.contactId &&
          tp.relatedEntityType === 'contact' &&
          tp.relatedEntityId === deal.contactId) ||
        (deal.leadUniqueId && tp.leadUniqueId === deal.leadUniqueId) ||
        (deal.accountId &&
          deal.accountId !== 'unassigned' &&
          tp.relatedEntityType === 'account' &&
          tp.relatedEntityId === deal.accountId)
    );
  }, [deal, touchpoints]);

  const dealTasks = useMemo(() => {
    if (!deal) return [];
    const matched = tasks.filter(
      (t) =>
        t.relatedTo === deal.title ||
        (deal.accountName && t.relatedTo === deal.accountName) ||
        (contact && t.relatedTo === contact.fullName) ||
        (deal.leadUniqueId && t.leadUniqueId === deal.leadUniqueId)
    );
    return [...matched].sort((a, b) => {
      const aDone = a.status === 'مكتملة' ? 1 : 0;
      const bDone = b.status === 'مكتملة' ? 1 : 0;
      return aDone - bDone;
    });
  }, [contact, deal, tasks]);

  const dealMessages = useMemo(() => {
    if (!deal) return [];
    return messages.filter(
      (m) =>
        (Boolean(deal.leadUniqueId) && m.leadUniqueId === deal.leadUniqueId) ||
        (Boolean(contact?.leadUniqueId) && m.leadUniqueId === contact?.leadUniqueId) ||
        (contact && m.senderName === contact.fullName) ||
        (contact && m.direction === 'outbound' && m.subject?.includes(contact.fullName)) ||
        (deal.accountName !== 'عميل فردي B2C' && m.companyName === deal.accountName)
    );
  }, [contact, deal, messages]);

  const quoteTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    for (const item of lineItems) {
      const gross = Math.max(0, item.quantity) * Math.max(0, item.unitPrice);
      const disc = Math.round((gross * Math.min(100, Math.max(0, item.discountPercent))) / 100);
      subtotal += gross;
      totalDiscount += disc;
    }
    const taxable = Math.max(0, subtotal - totalDiscount);
    const vatAmount = Math.round(taxable * 0.15);
    const netTotal = taxable + vatAmount;
    return { subtotal, totalDiscount, taxable, vatAmount, netTotal };
  }, [lineItems]);

  if (!deal) {
    return (
      <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-12 text-center space-y-3">
        <h1 className="text-[18px] font-bold text-[#0F172A]">
          لم يتم العثور على الصفقة المطلوبة
        </h1>
        <p className="text-[13px] text-[#64748B]">
          ربما تم نقل هذه الصفقة إلى سلة المحذوفات أو تعديل معرفها.
        </p>
        <Link
          to="/deals"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] text-[#FFFFFF] px-4 py-2 text-[12px] font-semibold"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى الصفقات والمبيعات</span>
        </Link>
      </div>
    );
  }

  const currentCol = getDealColumnForStage(deal.stage);
  const currentStepIndex = activeBlueprintSteps.findIndex((s) => s.matchStages.includes(deal.stage));
  const attribution = resolveDealLastTouchAttribution(deal, contacts, touchpoints);
  const firstTouchSource =
    dealTouchpoints[dealTouchpoints.length - 1]?.campaign ||
    contact?.primarySource ||
    attribution;
  const permanentRwq =
    deal.leadUniqueId ||
    contact?.leadUniqueId ||
    `RWQ-${deal.id.replace(/\D/g, '').padStart(5, '8').slice(-5)}`;
  const dealCodeLabel = `DEAL-${deal.id.replace(/\D/g, '').padStart(5, '8').slice(-5)}`;
  const activeQuoteNumber =
    localCreatedQuoteNumber || dealQuotes[0]?.quoteNumber || `QUO-2026-${dealCodeLabel.slice(-4)}`;
  const activeInvoiceNumber =
    localCreatedInvoiceNumber || dealInvoices[0]?.invoiceNumber || null;
  const openTasksCount = dealTasks.filter((t) => t.status !== 'مكتملة').length;
  const closeCountdown = computeDaysRemainingLabel(deal.closeDate);
  const isB2C = deal.accountId === 'unassigned' || deal.accountName === 'عميل فردي B2C';
  const activeDealsBp = blueprints.find(
    (bp) => bp.active && (bp.module === 'الصفقات والمبيعات' || bp.name.includes('صفقات'))
  );

  const nextTargetStage: DealStage =
    deal.stage === 'تفاوض'
      ? 'مكتملة'
      : deal.stage === 'عرض سعر'
      ? 'تفاوض'
      : deal.stage === 'تأهيل مبدئي' || deal.stage === 'تحديد الاحتياج'
      ? 'عرض سعر'
      : 'مكتملة';

  const nextTargetLabel =
    nextTargetStage === 'مكتملة'
      ? 'إغلاق - فوز'
      : nextTargetStage === 'تفاوض'
      ? 'التفاوض ومراجعة العقد'
      : 'تقديم عرض السعر';

  const commitDealPatch = async (patch: Parameters<typeof updateDealFields>[1], label?: string) => {
    if (!canUpdateDeal) return;
    try {
      await updateDealFields(deal.id, patch);
      setToastMsg(label || 'تم الحفظ التلقائي في Firestore');
    } catch {
      setErrorMsg('تعذر حفظ التعديلات في قاعدة البيانات.');
    }
  };

  const handleCopyRwq = async () => {
    if (!permanentRwq) return;
    try {
      await navigator.clipboard.writeText(permanentRwq);
      setCopiedRwq(true);
      window.setTimeout(() => setCopiedRwq(false), 1600);
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
    await commitDealPatch(
      {
        stage: targetStage,
        probability: targetCol.defaultProbability,
      },
      `تم تحديث المرحلة إلى: ${targetCol.title}`
    );
  };

  const handleOpenBlueprintAdvance = () => {
    if (!canUpdateDeal) return;
    const req = getBlueprintTransitionRequirements(blueprints, 'مكتملة');
    setPendingBlueprint({ ...req, requiresModal: true });
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagText.trim().replace(/^#/, '').slice(0, 32);
    if (!cleaned) return;
    const nextTags = Array.from(new Set([...dealTags, cleaned])).slice(0, 20);
    setDealTags(nextTags);
    if (contact) {
      try {
        await updateContactFields(contact.id, { tags: nextTags });
      } catch {
        // ignore if restricted
      }
    }
    setNewTagText('');
    setAddingTag(false);
    setToastMsg(`تمت إضافة الوسم #${cleaned}`);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = dealTags.filter((t) => t !== tagToRemove);
    setDealTags(nextTags);
    if (contact) {
      try {
        await updateContactFields(contact.id, { tags: nextTags });
      } catch {
        // ignore if restricted
      }
    }
  };

  const handleAddLineItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const qty = Math.max(1, Number(newItemQty) || 1);
    const price = Math.max(0, Number(newItemPrice) || 0);
    const disc = Math.min(100, Math.max(0, Number(newItemDiscount) || 0));
    const item: QuoteLineItem = {
      id: `li_${Date.now()}`,
      name: newItemName.trim(),
      description: newItemDesc.trim() || 'بند مضاف ضمن عرض السعر',
      licenseType: newItemLicense.trim() || 'ترخيص سنوي',
      quantity: qty,
      unitPrice: price,
      discountPercent: disc,
    };
    setLineItems((prev) => [...prev, item]);
    setNewItemName('');
    setNewItemDesc('');
    setNewItemQty('1');
    setNewItemPrice('15000');
    setNewItemDiscount('0');
    setAddingLineItem(false);
    setToastMsg('تمت إضافة البند إلى جدول عرض السعر');
  };

  const handleUpdateLineItem = (
    itemId: string,
    field: 'quantity' | 'unitPrice' | 'discountPercent',
    rawVal: string
  ) => {
    const num = Math.max(0, Number(rawVal) || 0);
    setLineItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              [field]:
                field === 'quantity'
                  ? Math.max(1, num)
                  : field === 'discountPercent'
                  ? Math.min(100, num)
                  : num,
            }
          : it
      )
    );
  };

  const handleSyncQuoteAmountToDeal = async () => {
    if (!canUpdateDeal || !canEditAmount) return;
    await commitDealPatch(
      { amount: quoteTotals.netTotal },
      `تمت مزامنة قيمة الصفقة (${formatCurrencySAR(quoteTotals.netTotal)})`
    );
  };

  const handleDownloadQuoteDraft = () => {
    const rowsHtml = lineItems
      .map((item) => {
        const gross = item.quantity * item.unitPrice;
        const disc = Math.round((gross * item.discountPercent) / 100);
        const net = gross - disc;
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>${item.name}</strong><br/><small style="color:#64748b">${item.description}</small></td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.licenseType}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.unitPrice.toLocaleString('en-US')} ر.س</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.discountPercent}%</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>${net.toLocaleString('en-US')} ر.س</strong></td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${activeQuoteNumber}</title></head>
      <body style="font-family:Cairo,Arial,sans-serif;padding:32px;color:#0f172a;max-width:860px;margin:auto">
        <h1 style="margin:0 0 4px">عرض سعر رسمي — ${activeQuoteNumber}</h1>
        <p style="color:#64748b;margin:0 0 20px">${deal.title} | الحساب: ${deal.accountName} | العميل: ${contact?.fullName ?? '—'} (${permanentRwq ?? deal.id})</p>
        <table style="width:100%;border-collapse:collapse;text-align:right;font-size:13px">
          <thead><tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1">
            <th style="padding:8px">المنتج / الباقة</th><th style="padding:8px">نوع الترخيص</th><th style="padding:8px">الكمية</th><th style="padding:8px">السعر الفردي</th><th style="padding:8px">الخصم</th><th style="padding:8px">الصافي</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px;display:flex;justify-content:space-between;font-size:14px">
          <div>المجموع الفرعي: <strong>${quoteTotals.subtotal.toLocaleString('en-US')} ر.س</strong></div>
          <div>الخصم: <strong>-${quoteTotals.totalDiscount.toLocaleString('en-US')} ر.س</strong></div>
          <div>ضريبة القيمة المضافة (15%): <strong>${quoteTotals.vatAmount.toLocaleString('en-US')} ر.س</strong></div>
          <div style="color:#2563eb">الإجمالي النهائي: <strong>${quoteTotals.netTotal.toLocaleString('en-US')} ر.س</strong></div>
        </div>
      </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeQuoteNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMsg(`تم تجهيز مسودة عرض السعر (${activeQuoteNumber})`);
  };

  const handleCreateQuoteOrSalesOrder = async (
    mode: 'quote' | 'sales_order' | 'tax_invoice'
  ) => {
    if (submittingQuoteOrder) return;
    setSubmittingQuoteOrder(true);
    setErrorMsg(null);
    const effectiveTotal = quoteTotals.netTotal > 0 ? quoteTotals.netTotal : deal.amount;
    const todayIso = new Date().toISOString().slice(0, 10);

    const mappedFinancialLineItems: FinancialLineItem[] =
      lineItems.length > 0
        ? lineItems.map((li, idx) => ({
            id: li.id || `li_${idx + 1}`,
            productName: li.name || deal.title,
            description: li.description || li.licenseType || '',
            unit: 'اشتراك',
            quantity: Math.max(1, Number(li.quantity) || 1),
            unitPrice: Math.max(0, Number(li.unitPrice) || 0),
            discountType: 'percentage',
            discountValue: Math.min(100, Math.max(0, Number(li.discountPercent) || 0)),
            vatRate: 15,
          }))
        : [
            {
              id: 'li_1',
              productName: deal.title,
              description: `بنود صفقة ${deal.accountName}`,
              unit: 'مشروع',
              quantity: 1,
              unitPrice: Math.round(effectiveTotal / 1.15),
              discountType: 'percentage',
              discountValue: 0,
              vatRate: 15,
            },
          ];

    try {
      if (mode === 'quote') {
        const createdQuote = await createQuote({
          org_id: currentOrgId,
          subject: deal.title.slice(0, 160),
          dealId: deal.id,
          dealTitle: deal.title,
          accountId: deal.accountId,
          accountName: deal.accountName.slice(0, 150),
          contactId: contact?.id || deal.contactId,
          contactName: contact?.fullName,
          leadUniqueId: permanentRwq,
          ownerName: deal.ownerName || currentUser.fullName,
          currency: deal.currency || baseCurrency.code || 'SAR',
          exchangeRate: deal.exchangeRate || 1,
          taxMode: 'exclusive',
          subtotalAmount: quoteTotals.subtotal,
          discountTotal: quoteTotals.totalDiscount,
          taxableAmount: quoteTotals.taxable,
          vatAmount: quoteTotals.vatAmount,
          totalAmount: effectiveTotal,
          status: 'مرسل',
          issueDate: todayIso,
          validUntil: deal.closeDate || '2026-12-30',
          lineItems: mappedFinancialLineItems,
          notes: `عرض سعر صادر بضغطة واحدة من بطاقة الصفقة (${deal.title}) — المعرف الموحد ${permanentRwq}`,
        });

        setLocalCreatedQuoteNumber(createdQuote.quoteNumber);
        await addDealTouchpoint(deal.id, {
          channel: 'بريد إلكتروني',
          summary: `إنشاء عرض سعر بضغطة واحدة (${createdQuote.quoteNumber}) بقيمة ${effectiveTotal.toLocaleString('en-US')} ${deal.currency || baseCurrency.symbol || 'ر.س'} — معرف العميل الموحد ${permanentRwq}`,
          eventType: 'إصدار عرض سعر',
          campaign: attribution,
        });
        setToastMsg(
          `تم إنشاء وحفظ عرض السعر (${createdQuote.quoteNumber}) بضغطة واحدة مع توريث المعرف الموحد (${permanentRwq})`
        );
      } else if (mode === 'tax_invoice') {
        const zatcaQrBase64 = encodeZatcaPhase1TlvBase64({
          sellerName: currentOrganization?.name || 'Crm-One-step',
          vatNumber: '310122393500003',
          timestampIso: new Date().toISOString(),
          totalWithVat: effectiveTotal,
          vatAmount: quoteTotals.vatAmount,
        });

        const createdInvoice = await createInvoice({
          org_id: currentOrgId,
          quoteId: dealQuotes[0]?.id || activeQuoteNumber,
          quoteNumber: dealQuotes[0]?.quoteNumber || activeQuoteNumber,
          dealId: deal.id,
          dealTitle: deal.title,
          accountId: deal.accountId,
          accountName: deal.accountName.slice(0, 150),
          contactId: contact?.id || deal.contactId,
          contactName: contact?.fullName,
          leadUniqueId: permanentRwq,
          ownerName: deal.ownerName || currentUser.fullName,
          currency: deal.currency || baseCurrency.code || 'SAR',
          exchangeRate: deal.exchangeRate || 1,
          taxMode: 'exclusive',
          subtotalAmount: quoteTotals.subtotal,
          discountTotal: quoteTotals.totalDiscount,
          taxableAmount: quoteTotals.taxable,
          vatAmount: quoteTotals.vatAmount,
          totalAmount: effectiveTotal,
          paidAmount: 0,
          status: 'غير مدفوعة',
          issueDate: todayIso,
          dueDate: deal.closeDate || '2026-12-30',
          zatcaQrBase64,
          lineItems: mappedFinancialLineItems,
          notes: `فاتورة ضريبية (ZATCA المرحلة الأولى - ضريبة 15% + TLV QR) صادرة بضغطة واحدة — المعرف الموحد ${permanentRwq}`,
        });

        setLocalCreatedInvoiceNumber(createdInvoice.invoiceNumber);
        setZatcaQrBase64Preview(createdInvoice.zatcaQrBase64 || zatcaQrBase64);
        await addDealTouchpoint(deal.id, {
          channel: 'حدث',
          summary: `إصدار فاتورة ضريبية ZATCA المرحلة الأولى (${createdInvoice.invoiceNumber}) شاملة ضريبة 15% (${quoteTotals.vatAmount.toLocaleString('en-US')} ر.س) ورمز QR TLV — معرف العميل ${permanentRwq}`,
          eventType: 'إصدار فاتورة ضريبية',
          campaign: attribution,
        });
        setToastMsg(
          `تم إصدار الفاتورة الضريبية (${createdInvoice.invoiceNumber}) متضمنة ضريبة 15% ورمز ZATCA QR TLV مع توريث (${permanentRwq})`
        );
      } else {
        const createdOrder = await createSalesOrder({
          org_id: currentOrgId,
          quoteId: dealQuotes[0]?.id || activeQuoteNumber,
          quoteNumber: dealQuotes[0]?.quoteNumber || activeQuoteNumber,
          dealId: deal.id,
          dealTitle: deal.title,
          accountId: deal.accountId,
          accountName: deal.accountName.slice(0, 150),
          contactId: contact?.id || deal.contactId,
          contactName: contact?.fullName,
          leadUniqueId: permanentRwq,
          ownerName: deal.ownerName || currentUser.fullName,
          currency: deal.currency || baseCurrency.code || 'SAR',
          exchangeRate: deal.exchangeRate || 1,
          taxMode: 'exclusive',
          subtotalAmount: quoteTotals.subtotal,
          discountTotal: quoteTotals.totalDiscount,
          taxableAmount: quoteTotals.taxable,
          vatAmount: quoteTotals.vatAmount,
          totalAmount: effectiveTotal,
          status: 'قيد التجهيز',
          issueDate: todayIso,
          deliveryDate: deal.closeDate || '2026-12-15',
          lineItems: mappedFinancialLineItems,
          notes: `أمر بيع صادر من بطاقة الصفقة (${deal.title})`,
        });

        setLocalCreatedOrderNumber(createdOrder.orderNumber);
        await addDealTouchpoint(deal.id, {
          channel: 'حدث',
          summary: `تحويل الصفقة إلى أمر بيع رسمي (${createdOrder.orderNumber}) بقيمة ${effectiveTotal.toLocaleString('en-US')} ${deal.currency || baseCurrency.symbol || 'ر.س'}`,
          eventType: 'تحويل لأمر بيع',
          campaign: attribution,
        });
        setToastMsg(`تم إنشاء وحفظ أمر البيع (${createdOrder.orderNumber}) في قائمة أوامر المبيعات`);
      }
    } catch {
      setErrorMsg('تعذر إتمام العملية، يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmittingQuoteOrder(false);
    }
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpSummary.trim()) return;
    try {
      await addDealTouchpoint(deal.id, {
        channel: tpChannel,
        summary: tpSummary.trim().slice(0, 300),
        campaign: attribution,
        eventType: 'متابعة صفقة',
      });
      setTpSummary('');
      setTpOpen(false);
      setToastMsg('تم تسجيل نقطة الاتصال في سجل الصفقة');
    } catch {
      setErrorMsg('تعذر تسجيل نقطة الاتصال.');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await addDealTask(deal.id, {
        title: taskTitle.trim().slice(0, 160),
        priority: taskPriority,
        dueDate: taskDueDate,
        assignedToName: deal.ownerName,
      });
      setTaskTitle('');
      setTaskOpen(false);
      setToastMsg('تمت إضافة المهمة التنفيذية');
    } catch {
      setErrorMsg('تعذر إضافة المهمة.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatText.trim().slice(0, 2000);
    if (!clean) return;
    const recipient = contact?.fullName || deal.accountName;
    try {
      await sendInboxReply(chatChannel, recipient, clean, {
        contactId: contact?.id,
        leadUniqueId: permanentRwq,
        companyName: deal.accountName,
      });
      setChatText('');
      setToastMsg('تم إرسال الرسالة وحفظها في السجل الموحد');
    } catch {
      setErrorMsg('تعذر إرسال الرسالة.');
    }
  };

  const handleDeleteDeal = async () => {
    await softDeleteDeals([deal.id]);
    navigate('/deals');
  };

  const showSlashPalette = chatText.trim().startsWith('/');

  return (
    <div className="space-y-4 pb-10">
      {/* 1. FLUSH WHITE HEADER & INTERACTIVE BLUEPRINT BAR */}
      <header className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-4 pb-3.5">
        <div className="mx-auto max-w-[1440px] space-y-3">
          {/* Breadcrumb Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2 text-[#64748B]">
              <Link
                to="/deals"
                className="inline-flex items-center gap-1.5 font-semibold text-[#2563EB] hover:underline"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى الصفقات والمبيعات</span>
              </Link>
              <span className="text-[#CBD5E1]">•</span>
              <span className="font-mono font-semibold text-[#475569] tabular-nums">
                {dealCodeLabel}
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#059669]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                <span>سجل نشط ومحدث الآن</span>
              </span>
            </div>

            {errorMsg && (
              <span className="inline-flex items-center gap-1 rounded border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#E11D48]">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{errorMsg}</span>
              </span>
            )}
          </div>

          {/* Identity + Primary Action Buttons Row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Right (RTL start): Title, Amount badge, Probability pill, Linked Contact, Linked Account, Tags */}
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <Briefcase className="h-4 w-4" />
                </span>
                <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#0F172A] leading-tight">
                  {deal.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {/* Amount Badge */}
                <span className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-2.5 py-0.5 text-[12px] font-extrabold text-[#FFFFFF] tabular-nums">
                  {canViewAmount ? (
                    <>
                      <span>{deal.amount.toLocaleString('en-US')}</span>
                      <span className="text-[10px] font-semibold opacity-90">ر.س</span>
                    </>
                  ) : (
                    <span>محجوب (FLS)</span>
                  )}
                </span>

                {/* Probability Pill */}
                <span className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-bold text-[#2563EB] tabular-nums">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    {probAccess === 'hidden'
                      ? 'الاحتمال محجوب'
                      : `احتمالية النجاح ${deal.probability}%`}
                  </span>
                </span>

                {/* Clickable Linked Contact + RWQ-xxxxx */}
                {contact ? (
                  <div className="inline-flex items-center gap-1.5">
                    <Link
                      to={`/contacts/${contact.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-[#0F172A] hover:text-[#2563EB]"
                    >
                      <User className="h-3.5 w-3.5 text-[#64748B]" />
                      <span>{contact.fullName}</span>
                    </Link>
                    {permanentRwq && (
                      <button
                        type="button"
                        onClick={handleCopyRwq}
                        title="نسخ المعرف الدائم"
                        className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] tabular-nums"
                      >
                        <span>{permanentRwq}</span>
                        {copiedRwq ? (
                          <Check className="h-2.5 w-2.5 text-[#10B981]" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  permanentRwq && (
                    <button
                      type="button"
                      onClick={handleCopyRwq}
                      className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] font-bold text-[#475569] tabular-nums"
                    >
                      <span>{permanentRwq}</span>
                    </button>
                  )
                )}

                {/* Clickable Linked Account */}
                {isB2C ? (
                  <span className="inline-flex items-center gap-1 text-[#64748B] font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>عميل فردي B2C</span>
                  </span>
                ) : (
                  <Link
                    to="/accounts"
                    className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{deal.accountName}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* Tags Row Directly Below */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {dealTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#475569]"
                  >
                    <span>#{tag.replace(/^#/, '')}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(tag)}
                      aria-label={`إزالة وسم ${tag}`}
                      className="text-[#94A3B8] hover:text-[#E11D48]"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {addingTag ? (
                  <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      maxLength={32}
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      onBlur={() => {
                        if (!newTagText.trim()) setAddingTag(false);
                      }}
                      placeholder="اسم الوسم..."
                      className="h-6 w-28 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px] focus:border-[#2563EB] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="h-6 rounded bg-[#2563EB] px-2 text-[11px] font-semibold text-[#FFFFFF]"
                    >
                      حفظ
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTag(true)}
                    className="inline-flex items-center gap-1 rounded border border-dashed border-[#CBD5E1] bg-[#FFFFFF] px-2 py-0.5 text-[11px] font-medium text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>إضافة وسم</span>
                  </button>
                )}
              </div>
            </div>

            {/* Left (RTL end): Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={submittingQuoteOrder}
                onClick={() => void handleCreateQuoteOrSalesOrder('quote')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>إنشاء عرض سعر / أمر بيع</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contact) openInboxForContact(contact.id);
                  else setToastMsg('تم تفعيل نافذة محادثة واتساب أسفل العمود الأيسر');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981] px-4 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#059669] transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
                <span>محادثة فورية</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTaskOpen(true);
                  window.setTimeout(() => taskInputRef.current?.focus(), 60);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 text-[12px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-[#64748B]" />
                <span>+ مهمة / اتصال</span>
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((p) => !p)}
                  aria-label="خيارات إضافية للصفقة"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC]"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {actionsMenuOpen && (
                  <div className="flyout-surface absolute left-0 top-10 z-30 w-52 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1.5 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        void handleCreateQuoteOrSalesOrder('sales_order');
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span>تحويل لأمر بيع رسمي</span>
                    </button>
                    {canDeleteDeal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          setConfirmDelete(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-[#E11D48] hover:bg-[#FFF1F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>حذف الصفقة</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {confirmDelete && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-4 py-2 text-xs">
              <span className="font-bold text-[#E11D48]">
                هل تريد نقل هذه الصفقة إلى سلة المحذوفات؟
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1 font-medium text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDeal}
                  className="rounded bg-[#E11D48] px-3 py-1 font-bold text-[#FFFFFF]"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          )}

          {/* Bottom Strip: Interactive Blueprint Stage Bar */}
          <div className="border-t border-[#F1F5F9] pt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {activeBlueprintSteps.map((step, idx) => {
                const isActive = step.matchStages.includes(deal.stage);
                const isPast =
                  !isActive &&
                  deal.stage !== 'خسارة' &&
                  currentStepIndex > idx;

                return (
                  <React.Fragment key={step.key}>
                    <button
                      type="button"
                      disabled={!canUpdateDeal}
                      onClick={() => void handleStageSelect(step.targetStage)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF] shadow-xs'
                          : isPast
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669] hover:border-[#10B981]'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:border-[#BFDBFE] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      {isPast && <Check className="h-3.5 w-3.5" />}
                      {isActive && <span className="h-2 w-2 rounded-full bg-[#FFFFFF]" />}
                      <span>{step.label}</span>
                      {isActive && (
                        <span className="rounded bg-[#FFFFFF]/20 px-1.5 py-0.5 text-[10px] font-semibold">
                          نشطة الآن
                        </span>
                      )}
                    </button>
                    {idx < activeBlueprintSteps.length - 1 && (
                      <ChevronLeft className="h-3.5 w-3.5 text-[#CBD5E1] shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}

              <span className="mx-1 text-[#CBD5E1]">|</span>

              <button
                type="button"
                disabled={!canUpdateDeal}
                onClick={() => void handleStageSelect('خسارة')}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  deal.stage === 'خسارة'
                    ? 'border-[#E11D48] bg-[#E11D48] text-[#FFFFFF]'
                    : 'border-[#FECDD3] bg-[#FFF1F2]/70 text-[#E11D48] hover:bg-[#FFF1F2]'
                }`}
              >
                <span>خسارة</span>
              </button>
            </div>

            {/* Right-end / Left in RTL Green Blueprint Action Button */}
            <button
              type="button"
              disabled={!canUpdateDeal}
              onClick={handleOpenBlueprintAdvance}
              className="inline-flex items-center gap-2 rounded-lg bg-[#059669] hover:bg-[#047857] px-4 py-2 text-[#FFFFFF] transition-colors shadow-xs shrink-0"
            >
              <div className="text-right">
                <span className="block text-[12px] font-extrabold leading-tight">
                  انتقال إلى: إغلاق - فوز
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#D1FAE5]">
                  <ShieldCheck className="h-3 w-3" />
                  <span>
                    {activeDealsBp ? 'مستوفي شروط البلوبرينت (2/2)' : `المرحلة التالية: ${nextTargetLabel}`}
                  </span>
                </span>
              </div>
              <ArrowLeft className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* شريط الخطوة التالية المطلوبة (Crm-One-step Action Strip) */}
      <section className="rounded-xl border border-[#BFDBFE] bg-gradient-to-l from-[#EFF6FF] via-[#FFFFFF] to-[#ECFDF5]/60 p-4 shadow-2xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-2xs">
              <Zap className="h-3.5 w-3.5" />
              <span>الخطوة التالية المطلوبة</span>
            </span>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-extrabold text-[#0F172A]">
                {deal.nextStep || `استكمال ${nextTargetLabel} وإصدار المستندات المالية`}
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1E40AF]">
                <span>معرّف العميل الموحد:</span>
                <span>{permanentRwq}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">
                <span>ZATCA المرحلة الأولى: ضريبة 15% ({quoteTotals.vatAmount.toLocaleString('en-US')} ر.س) + QR TLV</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submittingQuoteOrder}
              onClick={() => void handleCreateQuoteOrSalesOrder('quote')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-2xs transition hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>إنشاء عرض سعر بضغطة واحدة</span>
            </button>

            <button
              type="button"
              disabled={submittingQuoteOrder}
              onClick={() => void handleCreateQuoteOrSalesOrder('tax_invoice')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-2xs transition hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>إصدار فاتورة ضريبية بضغطة واحدة</span>
            </button>
          </div>
        </div>

        {(localCreatedQuoteNumber || activeInvoiceNumber || zatcaQrBase64Preview) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#DBEAFE] pt-2.5 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              {localCreatedQuoteNumber && (
                <Link
                  to="/quotes"
                  className="inline-flex items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#FFFFFF] px-2.5 py-1 font-bold text-[#1D4ED8] hover:bg-[#EFF6FF]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>عرض السعر المعتمد: {localCreatedQuoteNumber}</span>
                  <span className="font-mono text-[10px] text-[#64748B]">({permanentRwq})</span>
                </Link>
              )}

              {activeInvoiceNumber && (
                <Link
                  to="/invoices"
                  className="inline-flex items-center gap-1 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 font-bold text-[#065F46] hover:bg-[#D1FAE5]"
                >
                  <QrCode className="h-3.5 w-3.5 text-[#059669]" />
                  <span>الفاتورة الضريبية ZATCA: {activeInvoiceNumber}</span>
                  <span className="font-mono text-[10px] text-[#047857]">({permanentRwq})</span>
                </Link>
              )}
            </div>

            {(zatcaQrBase64Preview || dealInvoices[0]?.zatcaQrBase64) && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[10px] text-[#334155]">
                <QrCode className="h-3.5 w-3.5 text-[#059669]" />
                <span>رمز QR TLV (ZATCA Phase 1):</span>
                <span className="max-w-[220px] truncate font-bold text-[#0F172A]" dir="ltr">
                  {zatcaQrBase64Preview || dealInvoices[0]?.zatcaQrBase64}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. MAIN 2-COLUMN WORKSPACE: Right Main Column (65%) + Left Action Column (35%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] items-stretch">
        {/* RIGHT MAIN COLUMN (65%) */}
        <div className="min-w-0 space-y-4">
          {/* Card 1: البيانات الأساسية للصفقة */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <FileText className="h-4 w-4" />
                </span>
                <h2 className="text-[14px] font-bold text-[#0F172A]">
                  البيانات الأساسية للصفقة
                </h2>
              </div>

              {canUpdateDeal && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickEditMode((p) => !p);
                    amountInputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>{quickEditMode ? 'حفظ تلقائي مفعل' : 'تعديل سريع'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Final Amount (FLS) */}
              {canViewAmount && (
                <div
                  className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    quickEditMode && canEditAmount ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>قيمة الصفقة الإجمالية (صافي بعد الخصم)</span>
                    {!canEditAmount && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                  </label>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <input
                      ref={amountInputRef}
                      type="number"
                      min={0}
                      value={amountDraft}
                      disabled={!canUpdateDeal || !canEditAmount}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      onBlur={() => {
                        const nextAmt = Math.max(0, Number(amountDraft) || 0);
                        if (nextAmt !== deal.amount) {
                          void commitDealPatch({ amount: nextAmt });
                        }
                      }}
                      className="w-32 bg-transparent font-mono text-[15px] font-extrabold text-[#2563EB] tabular-nums focus:outline-none disabled:opacity-75"
                    />
                    <span className="text-[11px] font-semibold text-[#475569]">ريال سعودي</span>
                  </div>
                </div>
              )}

              {/* 2. Expected Close Date (FLS) */}
              {closeDateAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    quickEditMode && closeDateAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>تاريخ الإغلاق المتوقع والمستهدف</span>
                    {closeDateAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                      <input
                        type="date"
                        value={closeDateDraft}
                        disabled={!canUpdateDeal || closeDateAccess === 'read_only'}
                        onChange={(e) => {
                          setCloseDateDraft(e.target.value);
                          if (e.target.value && e.target.value !== deal.closeDate) {
                            void commitDealPatch({ closeDate: e.target.value });
                          }
                        }}
                        className="bg-transparent text-[13px] font-bold text-[#0F172A] tabular-nums focus:outline-none disabled:opacity-75"
                      />
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                        closeCountdown.isUrgent
                          ? 'bg-[#FFF1F2] text-[#E11D48]'
                          : 'bg-[#EFF6FF] text-[#2563EB]'
                      }`}
                    >
                      {closeCountdown.text}
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Last-Touch Attribution */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/80 px-3.5 py-2.5">
                <label className="block text-[11px] text-[#64748B]">
                  مصدر الصفقة الأخير (Last-Touch Attribution)
                </label>
                <div className="mt-1 flex items-center gap-2 text-[12px] font-bold text-[#0F172A]">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB] shrink-0" />
                  <span className="truncate">{attribution}</span>
                </div>
              </div>

              {/* 4. First-Touch Source */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/80 px-3.5 py-2.5">
                <label className="block text-[11px] text-[#64748B]">
                  المصدر الأساسي الأول (First-Touch)
                </label>
                <div className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-[#334155]">
                  <Compass className="h-3.5 w-3.5 text-[#4F46E5] shrink-0" />
                  <span className="truncate">{firstTouchSource}</span>
                </div>
              </div>

              {/* 5. Deal Type */}
              <div
                className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                  quickEditMode ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                }`}
              >
                <label className="block text-[11px] text-[#64748B]">نوع الصفقة والنمو</label>
                <select
                  value={dealTypeDraft}
                  disabled={!canUpdateDeal}
                  onChange={(e) => {
                    setDealTypeDraft(e.target.value);
                    setToastMsg('تم تحديث تصنيف الصفقة');
                  }}
                  className="mt-1 w-full bg-transparent text-[12px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                >
                  <option value="ترقية اشتراك سنوي للمؤسسات (Upsell & Expansion)">
                    ترقية اشتراك سنوي للمؤسسات (Upsell & Expansion)
                  </option>
                  <option value="عميل مؤسسي جديد (New Business)">
                    عميل مؤسسي جديد (New Business)
                  </option>
                  <option value="تجديد عقد سنوي (Renewal)">تجديد عقد سنوي (Renewal)</option>
                </select>
              </div>

              {/* 6. Deal Owner (FLS) */}
              {ownerAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    quickEditMode && ownerAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>مسؤول ومتابع الصفقة (Deal Owner)</span>
                    {ownerAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-[#FFFFFF] shrink-0">
                      {getArabicInitials(ownerDraft || deal.ownerName)}
                    </span>
                    <select
                      value={ownerDraft}
                      disabled={!canUpdateDeal || ownerAccess === 'read_only'}
                      onChange={(e) => {
                        setOwnerDraft(e.target.value);
                        void commitDealPatch({ ownerName: e.target.value });
                      }}
                      className="w-full bg-transparent text-[12px] font-bold text-[#0F172A] focus:outline-none disabled:opacity-75"
                    >
                      {Array.from(
                        new Set([currentUser.fullName, ownerDraft, ...activeDealOwners].filter(Boolean))
                      ).map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 7. Approved Discount % */}
              <div
                className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                  quickEditMode ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                }`}
              >
                <label className="block text-[11px] text-[#64748B]">
                  نسبة الخصم المعتمدة مسبقاً
                </label>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#059669] tabular-nums">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={approvedDiscountDraft}
                      disabled={!canUpdateDeal}
                      onChange={(e) => setApprovedDiscountDraft(e.target.value)}
                      className="w-12 bg-transparent font-bold text-[#059669] focus:outline-none"
                    />
                    <span>%</span>
                    <span className="text-[11px] text-[#475569]">
                      (خصم {quoteTotals.totalDiscount.toLocaleString('en-US')} ر.س)
                    </span>
                  </div>
                  <span className="rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669] whitespace-nowrap">
                    معتمدة آلياً
                  </span>
                </div>
              </div>

              {/* 8. Payment Terms */}
              <div
                className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                  quickEditMode ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                }`}
              >
                <label className="block text-[11px] text-[#64748B]">طريقة الدفع المتفق عليها</label>
                <select
                  value={paymentTermsDraft}
                  disabled={!canUpdateDeal}
                  onChange={(e) => {
                    setPaymentTermsDraft(e.target.value);
                    setToastMsg('تم تحديث شروط الدفع');
                  }}
                  className="mt-1 w-full bg-transparent text-[12px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                >
                  <option value="أمر شراء (PO) مع تحويل بنكي فوري 100%">
                    أمر شراء (PO) مع تحويل بنكي فوري 100%
                  </option>
                  <option value="دفعتان: 50% عند التعميد و50% عند التفعيل">
                    دفعتان: 50% عند التعميد و50% عند التفعيل
                  </option>
                  <option value="فوترة ربع سنوية (Net 30)">فوترة ربع سنوية (Net 30)</option>
                </select>
              </div>

              {/* Dynamic Custom Fields for Deals (respecting FLS) */}
              {dealCustomFields.map((cf) => {
                const access = getFieldAccess('deals', cf.fieldKey);
                if (access === 'hidden') return null;
                const locked = !canUpdateDeal || access === 'read_only';
                return (
                  <div
                    key={cf.id}
                    className={`rounded-xl border bg-[#F8FAFC]/80 px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                      quickEditMode && !locked ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                    }`}
                  >
                    <label className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>
                        {cf.label}
                        {cf.required && <span className="text-[#E11D48]"> *</span>}
                      </span>
                      {access === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                    </label>
                    <input
                      type={cf.fieldType === 'number' || cf.fieldType === 'currency' ? 'number' : 'text'}
                      disabled={locked}
                      value={String(customValuesDraft[cf.fieldKey] ?? '')}
                      onChange={(e) =>
                        setCustomValuesDraft((p) => ({ ...p, [cf.fieldKey]: e.target.value }))
                      }
                      onBlur={() => setToastMsg(`تم حفظ ${cf.label}`)}
                      className="mt-1 w-full bg-transparent text-[12px] font-bold text-[#0F172A] tabular-nums focus:outline-none disabled:opacity-75"
                    />
                  </div>
                );
              })}

              {/* 9. Full-width Notes & Client Requirements (FLS, saved to deal.nextStep in Firestore) */}
              {nextStepAccess !== 'hidden' && (
                <div
                  className={`sm:col-span-2 rounded-xl border bg-[#F8FAFC] px-3.5 py-3 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] ${
                    quickEditMode && nextStepAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                    <Info className="h-3.5 w-3.5 text-[#2563EB]" />
                    <span>الملاحظات والاشتراطات الخاصة بالعميل (الخطوة التنفيذية)</span>
                    {nextStepAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={nextStepDraft}
                    disabled={!canUpdateDeal || nextStepAccess === 'read_only'}
                    onChange={(e) => setNextStepDraft(e.target.value)}
                    onBlur={() => {
                      const clean = nextStepDraft.trim().slice(0, 200);
                      if (clean !== (deal.nextStep ?? '')) {
                        void commitDealPatch({ nextStep: clean });
                      }
                    }}
                    placeholder="أضف ملاحظات المتابعة، شروط التدريب أو الربط البرمجي المطلوبة من العميل..."
                    className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-[#0F172A] focus:outline-none disabled:opacity-75"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Card 2: المنتجات وبنود عرض السعر — Products & Quotes */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
              <div>
                <h2 className="text-[14px] font-bold text-[#0F172A]">
                  المنتجات وبنود عرض السعر (Products &amp; Quotes)
                </h2>
                <p className="mt-0.5 text-[11px] text-[#64748B] tabular-nums">
                  عرض السعر النشط رقم:{' '}
                  <strong className="font-mono text-[#0F172A]">{activeQuoteNumber}</strong>
                  {localCreatedOrderNumber && (
                    <span className="mr-2 rounded bg-[#ECFDF5] px-2 py-0.5 font-mono text-[10px] font-bold text-[#059669]">
                      أمر بيع: {localCreatedOrderNumber}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddingLineItem((p) => !p)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة بند / منتج</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQuoteDraft}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC] whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>مسودة PDF</span>
                </button>
              </div>
            </div>

            {addingLineItem && (
              <form
                onSubmit={handleAddLineItem}
                className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-4 grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs"
              >
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="اسم المنتج أو الباقة..."
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 sm:col-span-2"
                />
                <input
                  type="text"
                  value={newItemLicense}
                  onChange={(e) => setNewItemLicense(e.target.value)}
                  placeholder="نوع الترخيص"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5"
                />
                <input
                  type="number"
                  min={1}
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  placeholder="الكمية"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="السعر الفردي"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newItemDiscount}
                  onChange={(e) => setNewItemDiscount(e.target.value)}
                  placeholder="الخصم %"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 tabular-nums"
                />
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="وصف مختصر للبند..."
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 sm:col-span-4"
                />
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingLineItem(false)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="h-8 rounded-lg bg-[#2563EB] px-3.5 font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
                  >
                    إضافة البند
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="px-4 py-2.5">المنتج / الباقة</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">نوع الترخيص</th>
                    <th className="px-3 py-2.5 text-center whitespace-nowrap">الكمية</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">السعر الفردي</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">الخصم</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">الإجمالي الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {lineItems.map((item) => {
                    const gross = item.quantity * item.unitPrice;
                    const discVal = Math.round((gross * item.discountPercent) / 100);
                    const netVal = gross - discVal;
                    return (
                      <tr key={item.id} className="group hover:bg-[#F8FAFC]/80">
                        <td className="px-4 py-3">
                          <span className="block font-bold text-[#0F172A] leading-snug">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#64748B]">
                            {item.description}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-[#475569] whitespace-nowrap">
                          {item.licenseType}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'quantity', e.target.value)
                            }
                            aria-label={`كمية ${item.name}`}
                            className="w-12 rounded border border-transparent hover:border-[#CBD5E1] focus:border-[#2563EB] bg-transparent text-center font-bold text-[#0F172A] tabular-nums focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'unitPrice', e.target.value)
                            }
                            aria-label={`سعر ${item.name}`}
                            className="w-20 rounded border border-transparent hover:border-[#CBD5E1] focus:border-[#2563EB] bg-transparent font-semibold text-[#0F172A] tabular-nums focus:outline-none"
                          />
                          <span className="block text-[10px] text-[#94A3B8]">ر.س</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                          {item.discountPercent > 0 ? (
                            <div>
                              <span className="font-bold text-[#059669]">
                                {item.discountPercent}%
                              </span>
                              <span className="block text-[10px] text-[#059669]">
                                (-{discVal.toLocaleString('en-US')})
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">0% (لا يوجد)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="block font-extrabold text-[#2563EB]">
                                {netVal.toLocaleString('en-US')}
                              </span>
                              <span className="text-[10px] text-[#2563EB]">ر.س</span>
                            </div>
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setLineItems((p) => p.filter((x) => x.id !== item.id))
                                }
                                aria-label={`حذف ${item.name}`}
                                className="opacity-0 group-hover:opacity-100 rounded p-1 text-[#94A3B8] hover:text-[#E11D48] transition-opacity"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary + Sales Order CTA */}
            <div className="m-4 mt-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block text-[10px] text-[#64748B]">المجموع الفرعي:</span>
                  <strong className="mt-0.5 block text-[13px] text-[#0F172A] tabular-nums">
                    {quoteTotals.subtotal.toLocaleString('en-US')} ر.س
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">إجمالي الخصم الممنوح:</span>
                  <strong className="mt-0.5 block text-[13px] text-[#059669] tabular-nums">
                    -{quoteTotals.totalDiscount.toLocaleString('en-US')} ر.س
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">ضريبة القيمة المضافة (15%):</span>
                  <strong className="mt-0.5 block text-[13px] text-[#0F172A] tabular-nums">
                    {quoteTotals.vatAmount.toLocaleString('en-US')} ر.س
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">القيمة الصافية النهائية:</span>
                  <strong className="mt-0.5 block text-[15px] font-extrabold text-[#2563EB] tabular-nums">
                    {quoteTotals.netTotal.toLocaleString('en-US')} ر.س
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEditAmount && quoteTotals.netTotal !== deal.amount && (
                  <button
                    type="button"
                    onClick={() => void handleSyncQuoteAmountToDeal()}
                    className="h-9 rounded-lg border border-[#BFDBFE] bg-[#FFFFFF] px-3 text-[11px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    تحديث قيمة الصفقة
                  </button>
                )}
                <button
                  type="button"
                  disabled={submittingQuoteOrder}
                  onClick={() => void handleCreateQuoteOrSalesOrder('sales_order')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E40AF] hover:bg-[#1E3A8A] px-4 text-[12px] font-bold text-[#FFFFFF] transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <span>تحويل إلى أمر بيع رسمي (Sales Order)</span>
                </button>
              </div>
            </div>

            {salesOrders.some(
              (so) => so.accountName === deal.accountName || so.quoteId === dealQuotes[0]?.id
            ) && (
              <div className="border-t border-[#F1F5F9] bg-[#ECFDF5]/40 px-5 py-2 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#059669]">
                  يوجد أمر مبيعات مرتبط بحساب {deal.accountName}
                </span>
                <Link to="/sales-orders" className="font-bold text-[#2563EB] hover:underline">
                  عرض أوامر المبيعات ←
                </Link>
              </div>
            )}
          </section>

          {/* Card 3: تاريخ المراحل وسجل نقاط الاتصال */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-[14px] font-bold text-[#0F172A]">
                  تاريخ المراحل وسجل نقاط الاتصال (Touchpoints)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-[#64748B] tabular-nums">
                  المرحلة الحالية: <strong className="text-[#0F172A]">{currentCol.title}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setTpOpen((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                >
                  <Plus className="h-3 w-3" />
                  <span>تسجيل متابعة</span>
                </button>
              </div>
            </div>

            {/* Stage Duration Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: 'التأهيل المبدئي',
                  status: currentStepIndex > 0 || deal.stage === 'مكتملة' ? 'مكتملة' : 'قيد التنفيذ',
                  duration: 'استغرقت: 4 أيام',
                  sub: 'تحديد الميزانية وصاحب القرار',
                },
                {
                  title: 'تقديم عرض السعر',
                  status:
                    currentStepIndex > 1 || deal.stage === 'مكتملة'
                      ? 'مكتملة'
                      : currentStepIndex === 1
                      ? 'قيد التنفيذ'
                      : 'قادمة',
                  duration: 'استغرقت: 8 أيام',
                  sub: `عرض السعر ${activeQuoteNumber}`,
                },
                {
                  title: 'التفاوض والعقد',
                  status:
                    deal.stage === 'مكتملة'
                      ? 'مكتملة'
                      : currentStepIndex === 2
                      ? 'قيد التنفيذ'
                      : 'قادمة',
                  duration:
                    currentStepIndex === 2 ? 'نشطة حالياً' : `الاحتمال: ${deal.probability}%`,
                  sub: `الهدف: الإغلاق قبل ${deal.closeDate}`,
                },
              ].map((st) => {
                const isDone = st.status === 'مكتملة';
                const isActive = st.status === 'قيد التنفيذ';
                return (
                  <div
                    key={st.title}
                    className={`rounded-xl border p-3.5 space-y-1.5 ${
                      isActive
                        ? 'border-[#93C5FD] bg-[#EFF6FF]/60'
                        : isDone
                        ? 'border-[#E2E8F0] bg-[#FFFFFF]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold text-[#0F172A]">{st.title}</span>
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#059669]">
                          <Check className="h-2.5 w-2.5" />
                          <span>مكتملة</span>
                        </span>
                      ) : isActive ? (
                        <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-[#FFFFFF]">
                          قيد التنفيذ
                        </span>
                      ) : (
                        <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          مجدولة
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] font-semibold tabular-nums ${
                        isActive ? 'text-[#2563EB]' : 'text-[#475569]'
                      }`}
                    >
                      {st.duration}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] truncate tabular-nums">{st.sub}</p>
                  </div>
                );
              })}
            </div>

            {tpOpen && (
              <form
                onSubmit={handleAddTouchpoint}
                className="rounded-xl border border-[#BFDBFE] bg-[#F8FAFC] p-3.5 space-y-2.5 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={tpChannel}
                    onChange={(e) => setTpChannel(e.target.value as TouchpointChannel)}
                    className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[#0F172A]"
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
                    maxLength={300}
                    value={tpSummary}
                    onChange={(e) => setTpSummary(e.target.value)}
                    placeholder="ملخص الاجتماع أو التحديث الميداني..."
                    className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTpOpen(false)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="h-8 rounded-lg bg-[#2563EB] px-3.5 font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
                  >
                    حفظ السجل
                  </button>
                </div>
              </form>
            )}

            {/* Inherited Touchpoints Timeline */}
            <div className="space-y-2 pt-1">
              <p className="text-[12px] font-bold text-[#0F172A]">
                سجل تفاعلات العميل المتوارثة ({dealTouchpoints.length} نقاط اتصال مسجلة)
              </p>

              {dealTouchpoints.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E2E8F0] p-4 text-center text-xs text-[#64748B]">
                  لا توجد نقاط اتصال مسجلة حتى الآن لهذه الصفقة.
                </p>
              ) : (
                <div className="space-y-2">
                  {dealTouchpoints.map((tp, idx) => {
                    const isFirst = idx === dealTouchpoints.length - 1;
                    const isLast = idx === 0;
                    const dotColor =
                      tp.channel === 'واتساب' || tp.channel === 'اجتماع'
                        ? 'bg-[#10B981]'
                        : 'bg-[#2563EB]';
                    return (
                      <div
                        key={tp.id}
                        className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                          <p className="text-[#0F172A] font-medium truncate">
                            {tp.summary}
                            {tp.campaign ? ` — (${tp.campaign})` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                            {isFirst
                              ? 'First Touch'
                              : isLast
                              ? 'Last Touch'
                              : tp.eventType || tp.channel}
                          </span>
                          <span className="text-[11px] text-[#64748B] tabular-nums whitespace-nowrap">
                            {tp.occurredAt}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* LEFT ACTION COLUMN (35%): Card A TOP (Tasks) + Card B BOTTOM (flex-1 WhatsApp Sales Chat) */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Card A (TOP): المهام والأنشطة القادمة */}
          <section className="shrink-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#E11D48] shrink-0" />
                <h2 className="text-[13px] font-bold text-[#0F172A]">المهام والأنشطة القادمة</h2>
              </div>
              <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-bold text-[#E11D48] tabular-nums">
                {openTasksCount} متبقية
              </span>
            </div>

            {taskOpen && (
              <form
                onSubmit={handleAddTask}
                className="rounded-lg border border-[#BFDBFE] bg-[#F8FAFC] p-3 space-y-2"
              >
                <input
                  ref={taskInputRef}
                  type="text"
                  maxLength={160}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="عنوان المهمة أو الاتصال..."
                  className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs focus:border-[#2563EB] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as CrmTask['priority'])}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs"
                  >
                    <option value="عالية">عاجلة</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="منخفضة">منخفضة</option>
                  </select>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs tabular-nums"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTaskOpen(false)}
                    className="h-7 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[11px] font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!taskTitle.trim()}
                    className="h-7 rounded bg-[#2563EB] px-3 text-[11px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    حفظ
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {dealTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#E2E8F0] p-3.5 text-center text-xs text-[#64748B]">
                  لا توجد مهام مجدولة حالياً لهذه الصفقة.
                </p>
              ) : (
                dealTasks.map((task) => {
                  const done = task.status === 'مكتملة';
                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        done
                          ? 'border-[#F1F5F9] bg-[#F8FAFC]/80'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => void toggleTaskStatus(task.id)}
                          aria-label={`تحديد المهمة ${task.title}`}
                          className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] accent-[#2563EB] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p
                            className={`text-[12px] font-bold leading-snug ${
                              done ? 'line-through text-[#94A3B8] font-semibold' : 'text-[#0F172A]'
                            }`}
                          >
                            {task.title}
                          </p>
                          {done ? (
                            <p className="text-[10px] font-medium text-[#059669] tabular-nums">
                              مكتملة بنجاح بواسطة {task.assignedToName} ({task.dueDate})
                            </p>
                          ) : (
                            <p className="text-[10px] tabular-nums">
                              {task.priority === 'عالية' ? (
                                <span className="font-bold text-[#E11D48]">
                                  عاجلة ({task.dueDate})
                                </span>
                              ) : (
                                <span className="font-semibold text-[#2563EB]">
                                  أولوية {task.priority} ({task.dueDate})
                                </span>
                              )}{' '}
                              <span className="text-[#64748B]">· المسؤول: {task.assignedToName}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setTaskOpen((p) => !p);
                window.setTimeout(() => taskInputRef.current?.focus(), 60);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF]/60 py-2 text-[12px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة مهمة جديدة</span>
            </button>
          </section>

          {/* Card B (Bottom, flex-1 flex flex-col): محادثة واتساب مبيعات موحدة */}
          <section className="flex-1 flex flex-col min-h-[480px] rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-bold text-[#0F172A] truncate">
                    محادثة واتساب مبيعات موحدة
                  </h2>
                  <p
                    className="font-mono text-[11px] text-[#64748B] tabular-nums truncate"
                    dir="ltr"
                  >
                    {contact?.phone || deal.accountName}
                  </p>
                </div>
              </div>

              {permanentRwq && (
                <button
                  type="button"
                  onClick={handleCopyRwq}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-[10px] font-bold text-[#334155] hover:border-[#2563EB] shrink-0 tabular-nums"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  <span>{permanentRwq}</span>
                </button>
              )}
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F8FAFC]/60">
              {dealMessages.length === 0 ? (
                <div className="flex flex-col items-start">
                  <div className="max-w-[90%] rounded-2xl rounded-tr-sm border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2.5 text-xs leading-relaxed text-[#0F172A]">
                    <p>
                      {contact?.lastMessageSnippet ||
                        `سجل المحادثة الموحد للصفقة (${deal.title}) جاهز — استخدم قوالب "/" أو اكتب رسالتك بالأسفل.`}
                    </p>
                  </div>
                  <span className="mt-1 text-[10px] text-[#94A3B8]">
                    {contact?.fullName || deal.accountName} • {permanentRwq || dealCodeLabel}
                  </span>
                </div>
              ) : (
                [...dealMessages].reverse().map((m) => {
                  const outbound = m.direction === 'outbound';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${outbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          outbound
                            ? 'rounded-tl-sm bg-[#2563EB] text-[#FFFFFF]'
                            : 'rounded-tr-sm border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]'
                        }`}
                      >
                        <p>{m.body}</p>
                      </div>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] tabular-nums ${
                          outbound ? 'text-[#059669]' : 'text-[#94A3B8]'
                        }`}
                      >
                        {outbound ? (
                          <>
                            <span>{m.timestampLabel}</span>
                            <span>•</span>
                            <span>تمت القراءة</span>
                            <CheckCheck className="h-3 w-3" />
                          </>
                        ) : (
                          <span>
                            {m.senderName} • {m.timestampLabel}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Pinned Quick Replies + Send Box */}
            <div className="shrink-0 border-t border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-2">
              {showSlashPalette && (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-md space-y-1">
                  {activeQuickReplies.map((qr) => (
                    <button
                      key={qr.command}
                      type="button"
                      onClick={() => setChatText(qr.template)}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-right text-[11px] hover:bg-[#EFF6FF]"
                    >
                      <span className="font-bold text-[#2563EB]">{qr.command}</span>
                      <span className="text-[#475569]">{qr.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {activeQuickReplies.map((qr) => (
                  <button
                    key={qr.command}
                    type="button"
                    onClick={() => setChatText(qr.template)}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#334155] hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] whitespace-nowrap shrink-0"
                  >
                    {qr.command}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => setChatText((p) => (p ? p : '/'))}
                  title="إدراج قالب سريع"
                  className="flex h-9 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  maxLength={2000}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="اكتب رداً أو استخدم قوالب الردود..."
                  aria-label="اكتب رداً أو استخدم قوالب الردود"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs text-[#0F172A] focus:bg-[#FFFFFF] focus:border-[#2563EB] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setChatChannel((prev) => (prev === 'whatsapp' ? 'email' : 'whatsapp'))
                  }
                  title={`القناة الحالية: ${chatChannel === 'whatsapp' ? 'واتساب' : 'بريد'}`}
                  className="hidden sm:flex h-9 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] shrink-0"
                >
                  <Mic className="h-4 w-4" />
                </button>

                <button
                  type="submit"
                  disabled={!chatText.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  <span>إرسال</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* Blueprint Transition Modal */}
      <BlueprintTransitionModal
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
          if (payload.discountPercent !== undefined) {
            setApprovedDiscountDraft(String(payload.discountPercent));
          }
          if (payload.createdOrderNumber) {
            setLocalCreatedOrderNumber(payload.createdOrderNumber);
          }
          setToastMsg(
            payload.targetStage === 'خسارة'
              ? 'تم إغلاق الصفقة بـ «خسارة» وتوثيق سبب الخسارة والملاحظات'
              : `تم اعتماد انتقال البلوبرينت إلى «${payload.targetStage}» وتنفيذ إجراءات الأتمتة`
          );
        }}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-[#0F172A] text-[#FFFFFF] px-4 py-2.5 text-[12px] font-semibold shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="إغلاق التنبيه"
            className="text-[#94A3B8] hover:text-[#FFFFFF]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
