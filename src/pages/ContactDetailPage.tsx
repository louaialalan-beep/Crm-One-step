import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Send,
  Smile,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type {
  ContactStatus,
  CrmTask,
  DealStage,
  InboxMessage,
  LeadChannel,
  TouchpointChannel,
} from '../types/crm';
import {
  CONTACT_OWNERS,
  CONTACT_STATUSES,
  getContactOwnerName,
  getDealsForContact,
  resolveContactStatus,
} from '../utils/contactsLogic';
import { CHANNEL_LABELS } from '../utils/leadsLogic';
import { CreateContactDealModal } from '../components/contacts/CreateContactDealModal';
import { getArabicInitials } from '../components/leads/LeadChannelIcon';

const TOUCHPOINT_CHANNELS: TouchpointChannel[] = [
  'واتساب',
  'إنستغرام',
  'موقع ويب',
  'مكالمة',
  'اجتماع',
  'بريد إلكتروني',
  'حدث',
];

const PREFERRED_CHANNEL_LABELS: Record<LeadChannel, string> = {
  whatsapp: 'واتساب للأعمال (WhatsApp Business)',
  instagram: 'إنستغرام (Instagram Direct)',
  messenger: 'فيسبوك ماسنجر (Messenger)',
  website: 'الموقع الإلكتروني (Website)',
  phone: 'اتصال هاتفي مباشر',
  referral: 'إحالة شريك / عميل',
};

const TOUCHPOINT_BADGE_STYLE: Record<TouchpointChannel, string> = {
  واتساب: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  إنستغرام: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
  'موقع ويب': 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]',
  مكالمة: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  اجتماع: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]',
  'بريد إلكتروني': 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]',
  حدث: 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0284C7]',
};

const DEAL_STAGE_BADGE: Record<DealStage, string> = {
  'تأهيل مبدئي': 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]',
  'تحديد الاحتياج': 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]',
  'عرض سعر': 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
  تفاوض: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
  مكتملة: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  خسارة: 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]',
};

const STATUS_PILL_STYLE: Record<ContactStatus, string> = {
  'عميل نشط': 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  'بانتظار عرض سعر': 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
  'عميل متكرر (VIP)': 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]',
  'متوقف / غير نشط': 'border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]',
};

const QUICK_REPLIES: Array<{ command: string; label: string; template: string }> = [
  {
    command: '/تأكيد_العرض',
    label: 'تأكيد إرسال العرض المالي',
    template:
      'أهلاً بكم، تم إرسال نسخة العرض المالي المحدثة إلى بريدكم الإلكتروني، ويسعدنا الرد على أي استفسار قبل التوقيع.',
  },
  {
    command: '/حجز_اجتماع_مباشر',
    label: 'جدولة اجتماع مراجعة',
    template:
      'يسعدنا ترتيب اجتماع مباشر مع مدير الحسابات الفنية. ما الموعد المناسب لكم غداً بين 10:00 ص و 04:00 م؟',
  },
  {
    command: '/إرسال_الفاتورة',
    label: 'مشاركة بيانات الفوترة',
    template:
      'مرفق رقم الفاتورة الضريبية المعتمدة وتفاصيل السداد البنكي لتفعيل المقاعد الإضافية فوراً.',
  },
  {
    command: '/توسعة_باقة',
    label: 'عرض توسعة المقاعد',
    template:
      'أهلاً بكم، مرفق تفاصيل عرض التوسعة وإضافة المقاعد الجديدة لحسابكم في رواق CRM.',
  },
];

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    contacts,
    leads,
    deals,
    customFields,
    touchpoints,
    messages,
    tasks,
    activeProfile,
    getFieldAccess,
    updateContactFields,
    addContactTouchpoint,
    addContactTask,
    toggleTaskStatus,
    sendInboxReply,
    openInboxForContact,
    softDeleteContacts,
    users,
    quickReplies,
  } = useCrm();

  const activeContactOwners = useMemo(() => {
    const fromUsers = users
      .filter((u) => u.status === 'active')
      .map((u) => u.fullName)
      .filter(Boolean);
    return fromUsers.length > 0 ? Array.from(new Set(fromUsers)) : CONTACT_OWNERS;
  }, [users]);

  const activeQuickReplies = useMemo(() => {
    if (quickReplies && quickReplies.length > 0) {
      return quickReplies
        .filter((qr) => !qr.module || qr.module === 'contacts' || qr.module === 'all')
        .map((qr) => ({
          command: qr.command.startsWith('/') ? qr.command : `/${qr.command}`,
          label: qr.label,
          template: qr.template,
        }));
    }
    return QUICK_REPLIES;
  }, [quickReplies]);

  const contact = useMemo(
    () => contacts.find((c) => c.id === id || c.leadUniqueId === id) ?? null,
    [contacts, id]
  );

  const canUpdateContact = activeProfile?.modulePermissions?.contacts?.update ?? true;
  const canDeleteContact = activeProfile?.modulePermissions?.contacts?.delete ?? true;

  const [copiedId, setCopiedId] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [editModeHint, setEditModeHint] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const [tpOpen, setTpOpen] = useState(false);
  const [tpChannel, setTpChannel] = useState<TouchpointChannel>('واتساب');
  const [tpCampaign, setTpCampaign] = useState('');
  const [tpSummary, setTpSummary] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<CrmTask['priority']>('عالية');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-20');

  const [chatText, setChatText] = useState('');
  const [chatChannel, setChatChannel] = useState<InboxMessage['channel']>('whatsapp');

  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftCustomValues, setDraftCustomValues] = useState<
    Record<string, string | number | boolean>
  >({});

  const menuRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
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
    if (!contact) return;
    setDraftPhone(contact.phone ?? '');
    setDraftEmail(contact.email ?? '');
    setDraftCity(contact.city ?? '');
    setDraftSource(contact.primarySource ?? '');
    setDraftNotes(contact.notes ?? '');
    setDraftCustomValues(contact.customValues ?? {});
    if (
      contact.channel === 'whatsapp' ||
      contact.channel === 'instagram' ||
      contact.channel === 'messenger'
    ) {
      setChatChannel(contact.channel);
    } else if (contact.channel === 'website') {
      setChatChannel('chat');
    } else {
      setChatChannel('whatsapp');
    }
  }, [contact]);

  const matchedOriginLead = useMemo(() => {
    if (!contact) return null;
    return (
      leads.find(
        (l) =>
          l.convertedContactId === contact.id ||
          (Boolean(contact.leadUniqueId) && l.unique_id === contact.leadUniqueId)
      ) ?? null
    );
  }, [contact, leads]);

  const contactDeals = useMemo(
    () => (contact ? getDealsForContact(contact, deals) : []),
    [contact, deals]
  );

  const contactDealIds = useMemo(
    () => new Set(contactDeals.map((d) => d.id)),
    [contactDeals]
  );

  const contactTouchpoints = useMemo(() => {
    if (!contact) return [];
    return touchpoints.filter(
      (tp) =>
        (tp.relatedEntityType === 'contact' && tp.relatedEntityId === contact.id) ||
        (tp.relatedEntityType === 'deal' && contactDealIds.has(tp.relatedEntityId)) ||
        (Boolean(matchedOriginLead) && tp.leadId === matchedOriginLead?.id) ||
        (Boolean(contact.leadUniqueId) && tp.leadUniqueId === contact.leadUniqueId)
    );
  }, [contact, contactDealIds, matchedOriginLead, touchpoints]);

  const contactTasks = useMemo(() => {
    if (!contact) return [];
    const list = tasks.filter(
      (t) =>
        t.relatedTo === contact.fullName ||
        (Boolean(matchedOriginLead) && t.leadId === matchedOriginLead?.id) ||
        (Boolean(contact.leadUniqueId) && t.leadUniqueId === contact.leadUniqueId) ||
        (contact.isPrimary &&
          contact.accountId !== 'unassigned' &&
          t.relatedTo === contact.accountName)
    );
    return [...list].sort((a, b) => {
      const aDone = a.status === 'مكتملة' ? 1 : 0;
      const bDone = b.status === 'مكتملة' ? 1 : 0;
      return aDone - bDone;
    });
  }, [contact, matchedOriginLead, tasks]);

  const openTasksCount = useMemo(
    () => contactTasks.filter((t) => t.status !== 'مكتملة').length,
    [contactTasks]
  );

  const contactMessages = useMemo(() => {
    if (!contact) return [];
    return messages.filter(
      (m) =>
        (Boolean(matchedOriginLead) && m.leadId === matchedOriginLead?.id) ||
        (Boolean(contact.leadUniqueId) && m.leadUniqueId === contact.leadUniqueId) ||
        m.senderName === contact.fullName ||
        (m.direction === 'outbound' && m.subject?.includes(contact.fullName))
    );
  }, [contact, matchedOriginLead, messages]);

  const contactCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'contacts')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  if (!contact) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-10 text-center space-y-3">
        <p className="text-base font-bold text-[#0F172A]">لم يتم العثور على جهة الاتصال المطلوبة</p>
        <Link
          to="/contacts"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى جهات الاتصال</span>
        </Link>
      </div>
    );
  }

  const activeStatus = resolveContactStatus(contact.contactStatus);
  const isB2C = contact.accountId === 'unassigned' || contact.accountName === 'عميل فردي B2C';
  const permanentUuid = contact.leadUniqueId ?? contact.id;
  const totalDealsAmount = contactDeals.reduce(
    (sum, d) => sum + (d.stage !== 'خسارة' ? d.amount : 0),
    0
  );

  const phoneAccess = getFieldAccess('contacts', 'phone');
  const emailAccess = getFieldAccess('contacts', 'email');
  const channelAccess = getFieldAccess('contacts', 'channel');
  const sourceAccess = getFieldAccess('contacts', 'primarySource');
  const ownerAccess = getFieldAccess('contacts', 'assignedToName');
  const cityAccess = getFieldAccess('contacts', 'city');
  const statusAccess = getFieldAccess('contacts', 'contactStatus');
  const notesAccess = getFieldAccess('contacts', 'notes');

  const showSaved = () => {
    setErrorNotice(null);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const commitPatch = async (patch: Parameters<typeof updateContactFields>[1]) => {
    if (!canUpdateContact) return;
    try {
      await updateContactFields(contact.id, patch);
      showSaved();
    } catch {
      setErrorNotice('تعذر حفظ التغييرات في السحابة، يرجى التحقق من الاتصال.');
    }
  };

  const handleCopyId = () => {
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(permanentUuid);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1600);
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagText.trim().replace(/^#/, '').slice(0, 32);
    if (!cleaned) return;
    const next = Array.from(new Set([...(contact.tags ?? []), cleaned])).slice(0, 20);
    await commitPatch({ tags: next });
    setNewTagText('');
    setAddingTag(false);
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpSummary.trim() && !tpCampaign.trim()) return;
    try {
      await addContactTouchpoint(contact.id, {
        channel: tpChannel,
        campaign: (tpCampaign.trim() || contact.primarySource || 'إدخال يدوي').slice(0, 140),
        summary: (tpSummary.trim() || 'نقطة دخول مسجلة يدوياً').slice(0, 300),
        eventType: 'نقطة دخول يدوية',
      });
      setTpSummary('');
      setTpCampaign('');
      setTpOpen(false);
      showSaved();
    } catch {
      setErrorNotice('تعذر تسجيل نقطة الدخول في قاعدة البيانات.');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await addContactTask(contact.id, {
        title: taskTitle.trim().slice(0, 160),
        priority: taskPriority,
        dueDate: taskDueDate,
      });
      setTaskTitle('');
      setTaskOpen(false);
      showSaved();
    } catch {
      setErrorNotice('تعذر حفظ المهمة الجديدة.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatText.trim().slice(0, 2000);
    if (!clean) return;
    try {
      await sendInboxReply(chatChannel, contact.fullName, clean, {
        contactId: contact.id,
        leadId: matchedOriginLead?.id,
        leadUniqueId: contact.leadUniqueId,
        companyName: contact.accountName,
      });
      setChatText('');
      showSaved();
    } catch {
      setErrorNotice('تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى.');
    }
  };

  const resolveDealLastTouchSource = (dealId: string, dealLeadUniqueId?: string): string => {
    const dealSpecificTp = contactTouchpoints.find(
      (tp) => tp.relatedEntityType === 'deal' && tp.relatedEntityId === dealId
    );
    if (dealSpecificTp?.campaign) return dealSpecificTp.campaign;
    const latestLeadTp = contactTouchpoints.find(
      (tp) => dealLeadUniqueId && tp.leadUniqueId === dealLeadUniqueId && tp.campaign
    );
    if (latestLeadTp?.campaign) return latestLeadTp.campaign;
    return contactTouchpoints[0]?.campaign || contact.primarySource || 'إدخال مباشر';
  };

  const showSlashPalette = chatText.trim().startsWith('/');

  return (
    <div className="space-y-4 pb-8">
      {/* 1. TOP FLUSH HEADER */}
      <header className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
        <div className="mx-auto max-w-[1440px] space-y-2.5">
          {/* Breadcrumb + Live Save Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2 text-[#64748B]">
              <Link
                to="/contacts"
                className="inline-flex items-center gap-1.5 font-semibold text-[#475569] hover:text-[#2563EB] transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى جهات الاتصال</span>
              </Link>
              <span className="text-[#CBD5E1]">/</span>
              <span>سجل العملاء النشطين</span>
            </div>

            <div className="flex items-center gap-2">
              {errorNotice && (
                <span className="inline-flex items-center gap-1 rounded border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#E11D48]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errorNotice}</span>
                </span>
              )}
              {savedNotice && (
                <span className="inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>تم الحفظ التلقائي</span>
                </span>
              )}
            </div>
          </div>

          {/* Identity + Primary Action Buttons Row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Right Side (RTL start): Name, Copyable UUID, Account Link, Status Pill, Tags */}
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-extrabold text-[#0F172A] leading-tight">
                  {contact.fullName}
                </h1>

                <button
                  type="button"
                  onClick={handleCopyId}
                  title="اضغط لنسخ المعرف الدائم"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#2563EB] hover:bg-[#DBEAFE] tabular-nums transition-colors"
                >
                  <span>{permanentUuid}</span>
                  {copiedId ? (
                    <Check className="h-3 w-3 text-[#059669]" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>

                <span className="inline-flex items-center rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
                  معرف فريد دائم
                </span>
              </div>

              {/* Clickable Linked Account + Status Pill */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {isB2C ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#475569]">
                    <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
                    <span>عميل فردي B2C</span>
                  </span>
                ) : (
                  <Link
                    to="/accounts"
                    className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
                  >
                    <span>{contact.accountName}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_PILL_STYLE[activeStatus]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span>{activeStatus}</span>
                </span>
              </div>

              {/* Tags Row directly below name */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {(contact.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#334155]"
                  >
                    <span>#{t.replace(/^#/, '')}</span>
                    {canUpdateContact && (
                      <button
                        type="button"
                        onClick={() =>
                          void commitPatch({
                            tags: (contact.tags ?? []).filter((item) => item !== t),
                          })
                        }
                        aria-label={`إزالة وسم ${t}`}
                        className="text-[#94A3B8] hover:text-[#E11D48]"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}

                {canUpdateContact &&
                  (addingTag ? (
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
                        className="h-6 w-28 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
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
                  ))}
              </div>
            </div>

            {/* Left Side (RTL end): Primary CTA Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setDealModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>صفقة جديدة</span>
              </button>

              <button
                type="button"
                onClick={() => openInboxForContact(contact.id)}
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
                <span>مهمة / اتصال</span>
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((p) => !p)}
                  aria-label="خيارات إضافية لجهة الاتصال"
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
                        handleCopyId();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      <Copy className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span>نسخ المعرف {permanentUuid}</span>
                    </button>
                    {canDeleteContact && (
                      <button
                        type="button"
                        onClick={async () => {
                          setActionsMenuOpen(false);
                          await softDeleteContacts([contact.id]);
                          navigate('/contacts');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-[#E11D48] hover:bg-[#FFF1F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>نقل إلى سلة المحذوفات</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN WORKSPACE: Right Main Column (65%) + Left Action Column (35%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] items-stretch">
        {/* RIGHT MAIN COLUMN (65%) */}
        <div className="min-w-0 space-y-4">
          {/* Card 1: البيانات الأساسية ومعلومات التواصل */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[14px] font-bold text-[#0F172A]">
                    البيانات الأساسية ومعلومات التواصل
                  </h2>
                  <p className="text-[11px] text-[#64748B]">
                    تم ترحيل البيانات تلقائياً وتثبيت المعرف الفريد من استمارة الحملة
                  </p>
                </div>
              </div>

              {canUpdateContact && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModeHint((p) => !p);
                    phoneInputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>{editModeHint ? 'الحفظ التلقائي مفعل' : 'تعديل الحقول'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Permanent RWQ-xxxxx */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <Lock className="h-3 w-3" />
                    <span>معرف العميل الدائم (CRM UUID)</span>
                  </label>
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-[#0F172A] tabular-nums">
                    {permanentUuid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="نسخ المعرف"
                  className="rounded-md p-1.5 text-[#64748B] hover:bg-[#E2E8F0]/70 hover:text-[#2563EB]"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-[#059669]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* 2. Phone (FLS) */}
              {phoneAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 flex items-center justify-between gap-2 focus-within:border-[#2563EB] ${
                    editModeHint && phoneAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <span>رقم الجوال المباشر</span>
                      {phoneAccess === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                    </label>
                    <input
                      ref={phoneInputRef}
                      type="text"
                      dir="ltr"
                      maxLength={40}
                      value={draftPhone}
                      disabled={!canUpdateContact || phoneAccess === 'read_only'}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      onBlur={() => {
                        const clean = draftPhone.trim().slice(0, 40);
                        if (clean !== (contact.phone ?? '')) {
                          void commitPatch({ phone: clean });
                        }
                      }}
                      className="mt-0.5 w-full bg-transparent text-right font-mono text-[13px] font-bold text-[#0F172A] tabular-nums focus:outline-none disabled:opacity-75"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openInboxForContact(contact.id)}
                      title="رسالة واتساب فورية"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                        title="اتصال هاتفي"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F8FAFC] text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Email (FLS) */}
              {emailAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 flex items-center justify-between gap-2 focus-within:border-[#2563EB] ${
                    editModeHint && emailAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <Mail className="h-3 w-3" />
                      <span>البريد الإلكتروني المعتمد</span>
                      {emailAccess === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      maxLength={160}
                      value={draftEmail}
                      disabled={!canUpdateContact || emailAccess === 'read_only'}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      onBlur={() => {
                        const clean = draftEmail.trim().slice(0, 160);
                        if (clean !== (contact.email ?? '')) {
                          void commitPatch({ email: clean });
                        }
                      }}
                      className="mt-0.5 w-full bg-transparent text-right font-mono text-[13px] font-semibold text-[#2563EB] focus:outline-none disabled:opacity-75"
                    />
                  </div>
                  {Boolean(draftEmail.trim()) && (
                    <span className="rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669] shrink-0">
                      موثق
                    </span>
                  )}
                </div>
              )}

              {/* 4. Preferred Channel (FLS) */}
              {channelAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    editModeHint && channelAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <span>القناة المفضلة للتواصل</span>
                    {channelAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
                    <select
                      value={contact.channel ?? 'whatsapp'}
                      disabled={!canUpdateContact || channelAccess === 'read_only'}
                      onChange={(e) => void commitPatch({ channel: e.target.value as LeadChannel })}
                      className="w-full bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                    >
                      {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                        <option key={ch} value={ch}>
                          {PREFERRED_CHANNEL_LABELS[ch] ?? CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 5. Primary Source First-Touch (FLS) */}
              {sourceAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    editModeHint && sourceAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <span>المصدر الأساسي (First-Touch)</span>
                    {sourceAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                    <input
                      type="text"
                      maxLength={120}
                      value={draftSource}
                      disabled={!canUpdateContact || sourceAccess === 'read_only'}
                      onChange={(e) => setDraftSource(e.target.value)}
                      onBlur={() => {
                        const clean = draftSource.trim().slice(0, 120);
                        if (clean !== (contact.primarySource ?? '')) {
                          void commitPatch({ primarySource: clean });
                        }
                      }}
                      className="w-full bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                    />
                  </div>
                </div>
              )}

              {/* 6. Owner (FLS) */}
              {ownerAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    editModeHint && ownerAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <span>مسؤول الحساب (Record Owner)</span>
                    {ownerAccess === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                  </label>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-[#FFFFFF] shrink-0">
                      {getArabicInitials(getContactOwnerName(contact))}
                    </span>
                    <select
                      value={getContactOwnerName(contact)}
                      disabled={!canUpdateContact || ownerAccess === 'read_only'}
                      onChange={(e) => void commitPatch({ assignedToName: e.target.value })}
                      className="w-full bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                    >
                      {Array.from(
                        new Set([getContactOwnerName(contact), ...activeContactOwners].filter(Boolean))
                      ).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 7. City (FLS) */}
              {cityAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    editModeHint && cityAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <MapPin className="h-3 w-3" />
                    <span>المدينة والمقر</span>
                    {cityAccess === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={draftCity}
                    disabled={!canUpdateContact || cityAccess === 'read_only'}
                    onChange={(e) => setDraftCity(e.target.value)}
                    onBlur={() => {
                      const clean = draftCity.trim().slice(0, 80);
                      if (clean !== (contact.city ?? '')) {
                        void commitPatch({ city: clean });
                      }
                    }}
                    className="mt-0.5 w-full bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                  />
                </div>
              )}

              {/* 8. Status & Classification (FLS) */}
              {statusAccess !== 'hidden' && (
                <div
                  className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                    editModeHint && statusAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <span>حالة وتصنيف العميل</span>
                    {statusAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <select
                    value={activeStatus}
                    disabled={!canUpdateContact || statusAccess === 'read_only'}
                    onChange={(e) =>
                      void commitPatch({ contactStatus: e.target.value as ContactStatus })
                    }
                    className="mt-0.5 w-full bg-transparent text-[13px] font-bold text-[#059669] focus:outline-none disabled:opacity-75"
                  >
                    {CONTACT_STATUSES.map((st) => (
                      <option key={st} value={st} className="text-[#0F172A]">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Custom Fields (respecting FLS: read_write / read_only / hidden) */}
              {contactCustomFields.map((cf) => {
                const access = getFieldAccess('contacts', cf.fieldKey);
                if (access === 'hidden') return null;
                const locked = !canUpdateContact || access === 'read_only';
                return (
                  <div
                    key={cf.id}
                    className={`rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 focus-within:border-[#2563EB] ${
                      editModeHint && !locked ? 'border-[#BFDBFE]' : 'border-[#E2E8F0]'
                    }`}
                  >
                    <label className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>
                        {cf.label}
                        {cf.required && <span className="text-[#E11D48]"> *</span>}
                      </span>
                      {access === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                    </label>
                    {cf.fieldType === 'select' && cf.options ? (
                      <select
                        disabled={locked}
                        value={String(draftCustomValues[cf.fieldKey] ?? '')}
                        onChange={(e) => {
                          const next = { ...draftCustomValues, [cf.fieldKey]: e.target.value };
                          setDraftCustomValues(next);
                          void commitPatch({ customValues: next });
                        }}
                        className="mt-0.5 w-full bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none disabled:opacity-75"
                      >
                        <option value="">اختر...</option>
                        {cf.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : cf.fieldType === 'boolean' ? (
                      <label className="mt-1 inline-flex items-center gap-2 text-[12px] font-semibold text-[#0F172A]">
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={Boolean(draftCustomValues[cf.fieldKey])}
                          onChange={(e) => {
                            const next = { ...draftCustomValues, [cf.fieldKey]: e.target.checked };
                            setDraftCustomValues(next);
                            void commitPatch({ customValues: next });
                          }}
                          className="h-4 w-4 rounded border-[#CBD5E1] accent-[#2563EB]"
                        />
                        <span>{draftCustomValues[cf.fieldKey] ? 'نعم' : 'لا'}</span>
                      </label>
                    ) : (
                      <input
                        type={
                          cf.fieldType === 'number' || cf.fieldType === 'currency'
                            ? 'number'
                            : cf.fieldType === 'date'
                            ? 'date'
                            : 'text'
                        }
                        disabled={locked}
                        value={String(draftCustomValues[cf.fieldKey] ?? '')}
                        onChange={(e) =>
                          setDraftCustomValues((p) => ({ ...p, [cf.fieldKey]: e.target.value }))
                        }
                        onBlur={() => void commitPatch({ customValues: draftCustomValues })}
                        className="mt-0.5 w-full bg-transparent text-[13px] font-semibold text-[#0F172A] tabular-nums focus:outline-none disabled:opacity-75"
                      />
                    )}
                  </div>
                );
              })}

              {/* 9. Full-width Notes & Internal Guidelines (FLS) */}
              {notesAccess !== 'hidden' && (
                <div
                  className={`sm:col-span-2 rounded-xl border bg-[#F8FAFC] px-3.5 py-3 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] ${
                    editModeHint && notesAccess === 'read_write'
                      ? 'border-[#BFDBFE]'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                    <FileText className="h-3.5 w-3.5" />
                    <span>الملاحظات والتعليمات الداخلية المعتمدة</span>
                    {notesAccess === 'read_only' && (
                      <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                    )}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={draftNotes}
                    disabled={!canUpdateContact || notesAccess === 'read_only'}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    onBlur={() => {
                      const clean = draftNotes.trim().slice(0, 1000);
                      if (clean !== (contact.notes ?? '')) {
                        void commitPatch({ notes: clean });
                      }
                    }}
                    placeholder="أضف ملاحظات المتابعة والتوصيات الفنية لبقية الفريق..."
                    className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-[#0F172A] focus:outline-none disabled:opacity-75"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Card 2: الصفقات المرتبطة — Deals Related List */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] shrink-0">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-[#0F172A]">الصفقات المرتبطة</h2>
                    <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#4F46E5] tabular-nums">
                      {contactDeals.length} صفقات
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] tabular-nums">
                    إجمالي القيمة التراكمية:{' '}
                    <strong className="text-[#0F172A]">
                      {totalDealsAmount.toLocaleString('en-US')}
                    </strong>{' '}
                    ر.س
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDealModalOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-[12px] font-bold text-[#2563EB] hover:bg-[#DBEAFE] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة صفقة جديدة</span>
              </button>
            </div>

            {contactDeals.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                لا توجد صفقات مرتبطة بهذا السجل حتى الآن — اضغط على &quot;+ إضافة صفقة جديدة&quot; لبدء صفقة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                      <th className="px-4 py-2.5">اسم الصفقة</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">القيمة المالية</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">المرحلة الحالية</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">تاريخ الإغلاق</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">مصدر الصفقة (Touchpoint)</th>
                      <th className="px-4 py-2.5 text-center whitespace-nowrap">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {contactDeals.map((d) => {
                      const stageBadgeCls =
                        DEAL_STAGE_BADGE[d.stage] ??
                        'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]';
                      const lastTouchSrc = resolveDealLastTouchSource(d.id, d.leadUniqueId);
                      return (
                        <tr key={d.id} className="hover:bg-[#F8FAFC]/80">
                          <td className="px-4 py-3">
                            <Link
                              to={`/deals/${d.id}`}
                              className="block font-bold text-[#2563EB] hover:underline leading-snug"
                            >
                              {d.title}
                            </Link>
                            <span className="mt-0.5 block text-[11px] text-[#64748B] truncate max-w-[230px]">
                              {d.nextStep || d.accountName}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                            <span className="block font-bold text-[#0F172A]">
                              {d.amount.toLocaleString('en-US')}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">ر.س</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${stageBadgeCls}`}
                            >
                              <span>{d.stage}</span>
                              {d.stage === 'مكتملة' && <Check className="h-3 w-3" />}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-[#475569] tabular-nums">
                            {d.closeDate}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#334155]">
                              <span
                                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                  d.stage === 'مكتملة' ? 'bg-[#2563EB]' : 'bg-[#6366F1]'
                                }`}
                              />
                              <span className="truncate max-w-[160px]">{lastTouchSrc}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              to={`/deals/${d.id}`}
                              aria-label={`فتح تفاصيل صفقة ${d.title}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card 3: سجل الدخول والمصادر — Touchpoints Subform */}
          <section className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <Globe className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-[#0F172A]">
                      سجل الدخول والمصادر (Touchpoints)
                    </h2>
                    <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] tabular-nums">
                      {contactTouchpoints.length} نقاط اتصال
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    تتبع رحلة العميل الكاملة ونقاط الاتصال الإعلانية ونسب التحويل
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTpOpen((p) => !p)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-semibold text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>تسجيل نقطة دخول يدوية</span>
              </button>
            </div>

            {tpOpen && (
              <form
                onSubmit={handleAddTouchpoint}
                className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs"
              >
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
                  maxLength={140}
                  value={tpCampaign}
                  onChange={(e) => setTpCampaign(e.target.value)}
                  placeholder="اسم الحملة أو المصدر..."
                  className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[#0F172A]"
                />
                <input
                  type="text"
                  maxLength={300}
                  value={tpSummary}
                  onChange={(e) => setTpSummary(e.target.value)}
                  placeholder="ملخص التفاعل (مثال: طلب عرض مالي)..."
                  className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[#0F172A] sm:col-span-2"
                />
                <div className="sm:col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTpOpen(false)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!tpSummary.trim() && !tpCampaign.trim()}
                    className="h-8 rounded-lg bg-[#2563EB] px-3.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    حفظ نقطة الدخول
                  </button>
                </div>
              </form>
            )}

            {contactTouchpoints.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                لا توجد نقاط دخول مسجلة حتى الآن لهذا العميل.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                      <th className="px-4 py-2.5 whitespace-nowrap">التاريخ والوقت</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">القناة</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">الحملة الإعلانية</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">معرف الإعلان (Ad ID / CAPI)</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">وسوم UTM</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">نوع التفاعل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {contactTouchpoints.map((tp, idx) => {
                      const badgeCls =
                        TOUCHPOINT_BADGE_STYLE[tp.channel] ??
                        'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]';
                      const isFirstTouch = idx === contactTouchpoints.length - 1;
                      return (
                        <tr key={tp.id} className="hover:bg-[#F8FAFC]/80">
                          <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                            <span className="block font-semibold text-[#0F172A]">
                              {tp.occurredAt}
                            </span>
                            {isFirstTouch && (
                              <span className="text-[10px] font-bold text-[#2563EB]">
                                First-Touch
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}
                            >
                              {tp.channel}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-[#0F172A]">
                            {tp.campaign || contact.primarySource || 'تفاعل مباشر'}
                          </td>
                          <td
                            className="px-3 py-3 font-mono text-[11px] text-[#2563EB] tabular-nums"
                            dir="ltr"
                          >
                            {tp.adId || '—'}
                          </td>
                          <td className="px-3 py-3" dir="ltr">
                            <span className="inline-block rounded bg-[#F8FAFC] border border-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#64748B]">
                              {tp.utmSource || 'direct'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#334155]">
                            {tp.summary || tp.eventType || 'تواصل مباشر'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* LEFT ACTION COLUMN (35%): Card A TOP (Tasks) + Card B BOTTOM (flex-1 Unified Chat) */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Card A (TOP): المهام والأنشطة القادمة */}
          <section className="shrink-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h2 className="text-[13px] font-bold text-[#0F172A]">المهام والأنشطة القادمة</h2>
                <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[11px] font-bold text-[#E11D48] tabular-nums">
                  {openTasksCount} مهام
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTaskOpen((p) => !p);
                  window.setTimeout(() => taskInputRef.current?.focus(), 60);
                }}
                aria-label="إضافة مهمة"
                title="إضافة مهمة"
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">إضافة مهمة</span>
              </button>
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
                  placeholder="عنوان المهمة أو المكالمة..."
                  className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as CrmTask['priority'])}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A]"
                  >
                    <option value="عالية">أولوية عاجلة</option>
                    <option value="متوسطة">أولوية متوسطة</option>
                    <option value="منخفضة">أولوية منخفضة</option>
                  </select>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] tabular-nums"
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
                    حفظ المهمة
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {contactTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#E2E8F0] p-4 text-center text-xs text-[#64748B]">
                  لا توجد مهام مجدولة حالياً — اضغط &quot;+ إضافة مهمة&quot; لإنشاء متابعة.
                </p>
              ) : (
                contactTasks.map((t) => {
                  const done = t.status === 'مكتملة';
                  const priorityBadge =
                    t.priority === 'عالية'
                      ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                      : t.priority === 'متوسطة'
                      ? 'border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]';

                  return (
                    <div
                      key={t.id}
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
                          onChange={() => void toggleTaskStatus(t.id)}
                          aria-label={`تحديد المهمة ${t.title}`}
                          className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] accent-[#2563EB] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p
                            className={`text-[12px] font-bold leading-snug ${
                              done ? 'line-through text-[#94A3B8] font-semibold' : 'text-[#0F172A]'
                            }`}
                          >
                            {t.title}
                          </p>
                          {done ? (
                            <p className="text-[10px] text-[#94A3B8] tabular-nums">
                              تمت الإفادة بواسطة: {t.assignedToName} ({t.dueDate})
                            </p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <span
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold ${priorityBadge}`}
                              >
                                {t.priority === 'عالية' && <AlertCircle className="h-2.5 w-2.5" />}
                                <span>
                                  {t.priority === 'عالية'
                                    ? 'أولوية عاجلة'
                                    : t.priority === 'متوسطة'
                                    ? 'أولوية متوسطة'
                                    : 'أولوية منخفضة'}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[#64748B] tabular-nums">
                                <Clock className="h-3 w-3" />
                                <span>{t.dueDate}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Card B (Bottom, flex-1 flex flex-col): المحادثة المباشرة الموحدة */}
          <section className="flex-1 flex flex-col min-h-[480px] rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-bold text-[#0F172A] truncate">
                    المحادثة المباشرة الموحدة
                  </h2>
                  <p className="font-mono text-[11px] text-[#64748B] tabular-nums truncate" dir="ltr">
                    {contact.phone || CHANNEL_LABELS[contact.channel ?? 'whatsapp']}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={chatChannel}
                  onChange={(e) => setChatChannel(e.target.value as InboxMessage['channel'])}
                  aria-label="قناة الرد المباشر"
                  className="h-7 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-1.5 text-[11px] font-medium text-[#334155]"
                >
                  <option value="whatsapp">واتساب</option>
                  <option value="instagram">إنستغرام</option>
                  <option value="messenger">ماسنجر</option>
                  <option value="email">بريد</option>
                </select>
                <button
                  type="button"
                  onClick={() => openInboxForContact(contact.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold text-[#059669] hover:bg-[#D1FAE5] whitespace-nowrap"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  <span>النافذة الكاملة</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            {/* Inherited Lead Chat Merge Strip */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#EEF2FF]/75 px-3.5 py-2 text-[11px] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 text-[#334155]">
                <Zap className="h-3.5 w-3.5 text-[#4F46E5] shrink-0" />
                <span className="truncate font-medium">تم دمج سجل المحادثة تلقائياً بالمعرف</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded bg-[#FFFFFF] border border-[#C7D2FE] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#2563EB] tabular-nums">
                  {permanentUuid}
                </span>
                <span className="text-[10px] text-[#64748B] whitespace-nowrap">
                  منذ مرحلة الـ Lead
                </span>
              </div>
            </div>

            {/* Scrollable Chat History */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F8FAFC]/70">
              {/* Inbound messages first, or chronological order */}
              {contactMessages.length === 0 ? (
                <>
                  <div className="flex flex-col items-start">
                    <span className="mb-1 text-[10px] text-[#94A3B8]">
                      مرحلة الاستفسار الأول • {contact.primarySource || contact.fullName}
                    </span>
                    <div className="max-w-[90%] rounded-2xl rounded-tr-sm border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2.5 text-xs leading-relaxed text-[#0F172A]">
                      <p>
                        {contact.lastMessageSnippet ||
                          'سجل المحادثات جاهز — أرسل رسالة عبر واتساب أو استخدم قوالب "/" السريعة بالأسفل.'}
                      </p>
                    </div>
                  </div>
                  {/* Conversion Milestone Banner */}
                  <div className="flex justify-center py-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5]/80 px-3 py-1 text-[10px] font-semibold text-[#059669]">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      <span>
                        تم تحويل السجل بنجاح لجهة اتصال وصفقة تجارية
                        {matchedOriginLead?.convertedAt ? ` (${matchedOriginLead.convertedAt})` : ''}
                      </span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Conversion Milestone Banner */}
                  <div className="flex justify-center py-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5]/80 px-3 py-1 text-[10px] font-semibold text-[#059669]">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      <span>
                        تم تحويل السجل بنجاح لجهة اتصال وصفقة تجارية
                        {matchedOriginLead?.convertedAt ? ` (${matchedOriginLead.convertedAt})` : ''}
                      </span>
                    </span>
                  </div>

                  {[...contactMessages].reverse().map((m) => {
                    const outbound = m.direction === 'outbound';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${outbound ? 'items-end' : 'items-start'}`}
                      >
                        <span className="mb-1 text-[10px] text-[#94A3B8] tabular-nums">
                          {m.timestampLabel} — {outbound ? m.senderName : m.campaign || m.senderName}
                        </span>
                        <div
                          className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            outbound
                              ? 'rounded-tl-sm bg-[#2563EB] text-[#FFFFFF]'
                              : 'rounded-tr-sm border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]'
                          }`}
                        >
                          <p>{m.body}</p>
                        </div>
                        {outbound && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#2563EB]">
                            <CheckCheck className="h-3 w-3" />
                            <span>تمت القراءة</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
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
                <span className="text-[10px] font-semibold text-[#64748B] whitespace-nowrap shrink-0">
                  ردود سريعة:
                </span>
                {activeQuickReplies.map((qr) => (
                  <button
                    key={qr.command}
                    type="button"
                    onClick={() => setChatText(qr.template)}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] hover:border-[#BFDBFE] hover:bg-[#EFF6FF] whitespace-nowrap shrink-0"
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
                <button
                  type="button"
                  onClick={() => setChatText((p) => `${p} 👋`.trimStart())}
                  title="إدراج تعبير"
                  className="hidden sm:flex h-9 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] shrink-0"
                >
                  <Smile className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  maxLength={2000}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="اكتب رداً أو رسالة واتساب مباشرة..."
                  aria-label="اكتب رداً أو رسالة واتساب مباشرة"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs text-[#0F172A] focus:bg-[#FFFFFF] focus:border-[#2563EB] focus:outline-none"
                />

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

      {/* Add Deal Modal */}
      <CreateContactDealModal
        open={dealModalOpen}
        contact={contact}
        onClose={() => setDealModalOpen(false)}
        onCreated={() => showSaved()}
      />
    </div>
  );
};
