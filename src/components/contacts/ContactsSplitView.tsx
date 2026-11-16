import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  Route,
  Search,
  Send,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type {
  Contact,
  ContactStatus,
  Deal,
  InboxMessage,
  LeadChannel,
  TouchpointChannel,
} from '../../types/crm';
import {
  CONTACT_OWNERS,
  CONTACT_STATUSES,
  formatCompactDealValue,
  getContactOwnerName,
  getDealsForContact,
  hasOpenDeals,
  hasPurchased,
  resolveContactStatus,
} from '../../utils/contactsLogic';
import { formatCurrencySAR } from '../../utils/formatters';
import { CHANNEL_LABELS, isMyLead } from '../../utils/leadsLogic';
import { getArabicInitials } from '../leads/LeadChannelIcon';

interface ContactsSplitViewProps {
  contacts: Contact[];
  deals: Deal[];
  selectedContactId: string;
  onSelectContact: (contactId: string) => void;
  onOpenCreateDeal: (contact: Contact) => void;
  onNotify?: (message: string) => void;
}

type QueueMiniFilter = 'all' | 'my' | 'purchased' | 'open_deals' | 'tags';
type SplitChatTab = 'all' | 'whatsapp' | 'instagram' | 'messenger';

const QUICK_REPLIES: Array<{
  command: string;
  emoji: string;
  label: string;
  template: string;
}> = [
  {
    command: '/توسعة_باقة',
    emoji: '⚡',
    label: 'إرسال عرض توسعة المقاعد والترخيص',
    template:
      'أهلاً بكم، مرفق عرض التوسعة المحدث لحسابكم شاملة المقاعد الإضافية وخصم العملاء الحاليين. هل نعتمد إصدار الفاتورة التنفيذية؟',
  },
  {
    command: '/مراجعة_دورية',
    emoji: '📅',
    label: 'جدولة جلسة مراجعة نجاح العملاء',
    template:
      'يسعدنا ترتيب جلسة مراجعة ربع سنوية (QBR) لاستعراض مؤشرات الأداء والتكاملات الجديدة في منصة رواق. ما الموعد المناسب لكم؟',
  },
  {
    command: '/متابعة_تجديد',
    emoji: '👋',
    label: 'رسالة متابعة تجديد الاشتراك',
    template:
      'مرحباً بكم، نود الاطمئنان على تجربة فريقكم مع النظام والتنسيق معكم بشأن تجديد الباقة السنوية ومميزاتها الإضافية.',
  },
];

const TOUCHPOINT_CHANNELS: TouchpointChannel[] = [
  'واتساب',
  'إنستغرام',
  'موقع ويب',
  'مكالمة',
  'اجتماع',
  'بريد إلكتروني',
  'حدث',
];

const CHAT_TABS: Array<{ id: SplitChatTab; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'whatsapp', label: 'واتساب' },
  { id: 'instagram', label: 'إنستغرام' },
  { id: 'messenger', label: 'ماسنجر' },
];

const MINI_FILTERS: Array<{ id: QueueMiniFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'my', label: 'جهاتي' },
  { id: 'purchased', label: 'اشتروا فعلاً' },
  { id: 'open_deals', label: 'صفقات مفتوحة' },
  { id: 'tags', label: 'التاغات' },
];

const INBOX_CHANNEL_LABELS: Record<InboxMessage['channel'], string> = {
  whatsapp: 'واتساب',
  instagram: 'إنستغرام',
  messenger: 'ماسنجر',
  email: 'بريد إلكتروني',
  chat: 'محادثة',
};

function getStatusPillClasses(status: ContactStatus, isActiveCard: boolean): string {
  if (isActiveCard && status === 'عميل متكرر (VIP)') {
    return 'bg-[#006242] text-[#FFFFFF] font-bold';
  }
  switch (status) {
    case 'عميل متكرر (VIP)':
      return 'bg-[#6FFBE0]/70 text-[#002113] font-bold';
    case 'عميل نشط':
      return 'bg-[#ECFDF5] text-[#059669] font-semibold';
    case 'بانتظار عرض سعر':
      return 'bg-[#DBE1FF] text-[#00174B] font-semibold';
    default:
      return 'bg-[#E2E7FF] text-[#434655] font-semibold';
  }
}

export const ContactsSplitView: React.FC<ContactsSplitViewProps> = ({
  contacts,
  deals,
  selectedContactId,
  onSelectContact,
  onOpenCreateDeal,
  onNotify,
}) => {
  const {
    currentUser,
    customFields,
    touchpoints,
    messages,
    activeProfile,
    getFieldAccess,
    updateContactFields,
    addContactTouchpoint,
    sendInboxReply,
  } = useCrm();

  const canUpdateContact = activeProfile?.modulePermissions?.contacts?.update ?? true;

  const [queueSearch, setQueueSearch] = useState('');
  const [miniFilter, setMiniFilter] = useState<QueueMiniFilter>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [channelQuickFilter, setChannelQuickFilter] = useState<LeadChannel | 'all'>('all');
  const [showQueueFiltersPopover, setShowQueueFiltersPopover] = useState(false);

  const [copiedId, setCopiedId] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [saveBadgeState, setSaveBadgeState] = useState<'idle' | 'saved'>('idle');

  const [tpOpen, setTpOpen] = useState(false);
  const [tpChannel, setTpChannel] = useState<TouchpointChannel>('واتساب');
  const [tpCampaign, setTpCampaign] = useState('');
  const [tpEventType, setTpEventType] = useState('متابعة جهة اتصال');
  const [tpSummary, setTpSummary] = useState('');

  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const [chatTab, setChatTab] = useState<SplitChatTab>('all');
  const [chatText, setChatText] = useState('');

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags ?? []) tagSet.add(t);
    }
    return Array.from(tagSet);
  }, [contacts]);

  const queueContacts = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      const cDeals = getDealsForContact(c, deals);
      if (miniFilter === 'my' && !isMyLead(getContactOwnerName(c), currentUser.fullName)) {
        return false;
      }
      if (miniFilter === 'purchased' && !hasPurchased(c, cDeals)) return false;
      if (miniFilter === 'open_deals' && !hasOpenDeals(cDeals)) return false;
      if (miniFilter === 'tags' && selectedTagFilter !== 'all') {
        if (!(c.tags ?? []).includes(selectedTagFilter)) return false;
      }
      if (channelQuickFilter !== 'all' && c.channel !== channelQuickFilter) return false;
      if (q) {
        const text = [
          c.fullName,
          c.accountName,
          c.leadUniqueId ?? '',
          c.phone ?? '',
          c.primarySource ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [
    channelQuickFilter,
    contacts,
    currentUser.fullName,
    deals,
    miniFilter,
    queueSearch,
    selectedTagFilter,
  ]);

  const activeContact =
    contacts.find((c) => c.id === selectedContactId) ??
    queueContacts[0] ??
    contacts[0] ??
    null;

  const [draftFullName, setDraftFullName] = useState('');
  const [draftJobTitle, setDraftJobTitle] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftChannel, setDraftChannel] = useState<LeadChannel>('whatsapp');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftCustomValues, setDraftCustomValues] = useState<
    Record<string, string | number | boolean>
  >({});

  useEffect(() => {
    if (!activeContact) return;
    setDraftFullName(activeContact.fullName ?? '');
    setDraftJobTitle(activeContact.jobTitle ?? '');
    setDraftPhone(activeContact.phone ?? '');
    setDraftEmail(activeContact.email ?? '');
    setDraftCity(activeContact.city ?? '');
    setDraftSource(activeContact.primarySource ?? '');
    setDraftOwner(getContactOwnerName(activeContact));
    setDraftChannel(activeContact.channel ?? 'whatsapp');
    setDraftNotes(activeContact.notes ?? '');
    setDraftCustomValues(activeContact.customValues ?? {});
  }, [activeContact]);

  const contactCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'contacts')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const contactDeals = useMemo(
    () => (activeContact ? getDealsForContact(activeContact, deals) : []),
    [activeContact, deals]
  );

  const contactTouchpoints = useMemo(() => {
    if (!activeContact) return [];
    return touchpoints.filter(
      (tp) =>
        (tp.relatedEntityType === 'contact' && tp.relatedEntityId === activeContact.id) ||
        (Boolean(activeContact.leadUniqueId) && tp.leadUniqueId === activeContact.leadUniqueId)
    );
  }, [activeContact, touchpoints]);

  const contactMessages = useMemo(() => {
    if (!activeContact) return [];
    return messages.filter((m) => {
      const matchesContact =
        (Boolean(activeContact.leadUniqueId) && m.leadUniqueId === activeContact.leadUniqueId) ||
        m.senderName === activeContact.fullName ||
        (m.direction === 'outbound' && m.subject?.includes(activeContact.fullName));
      if (!matchesContact) return false;
      if (chatTab !== 'all' && m.channel !== chatTab) return false;
      return true;
    });
  }, [activeContact, chatTab, messages]);

  const triggerSaveBadge = () => {
    setSaveBadgeState('saved');
    window.setTimeout(() => setSaveBadgeState('idle'), 1800);
  };

  const commitPatch = async (patch: Partial<Contact>) => {
    if (!activeContact || !canUpdateContact) return;
    await updateContactFields(activeContact.id, patch);
    triggerSaveBadge();
  };

  const handleCopyId = () => {
    if (!activeContact) return;
    const val = activeContact.leadUniqueId ?? activeContact.id;
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(val);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1500);
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !newTagInput.trim()) return;
    const nextTags = Array.from(
      new Set([...(activeContact.tags ?? []), newTagInput.trim()])
    ).slice(0, 20);
    await commitPatch({ tags: nextTags });
    setNewTagInput('');
    setAddingTag(false);
  };

  const handleRemoveTag = async (tag: string) => {
    if (!activeContact || !canUpdateContact) return;
    const nextTags = (activeContact.tags ?? []).filter((t) => t !== tag);
    await commitPatch({ tags: nextTags });
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !tpSummary.trim()) return;
    await addContactTouchpoint(activeContact.id, {
      channel: tpChannel,
      summary: tpSummary.trim(),
      eventType: tpEventType.trim() || 'نقطة اتصال جديدة',
      campaign: tpCampaign.trim() || undefined,
    });
    setTpSummary('');
    setTpCampaign('');
    setTpOpen(false);
    onNotify?.('تم تسجيل نقطة التواصل في سجل جهة الاتصال.');
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !chatText.trim()) return;
    const preferredChat: InboxMessage['channel'] =
      chatTab !== 'all'
        ? chatTab
        : activeContact.channel === 'instagram' || activeContact.channel === 'messenger'
        ? activeContact.channel
        : 'whatsapp';

    await sendInboxReply(preferredChat, activeContact.fullName, chatText.trim(), {
      contactId: activeContact.id,
      leadUniqueId: activeContact.leadUniqueId,
      companyName: activeContact.accountName,
    });
    setChatText('');
  };

  if (!activeContact) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-12 text-center">
        <p className="text-sm font-bold text-[#131B2E]">
          لا توجد جهات اتصال مطابقة للعرض المقسم.
        </p>
      </div>
    );
  }

  const activeStatus = resolveContactStatus(activeContact.contactStatus);
  const isB2C =
    activeContact.accountId === 'unassigned' ||
    activeContact.accountName === 'عميل فردي B2C';
  const showSlashSuggestions = chatText.trim().startsWith('/');

  return (
    <section
      aria-label="العرض المقسم الثلاثي لجهات الاتصال"
      className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:h-[calc(100vh-225px)] lg:min-h-[600px]"
    >
      {/* RIGHT COLUMN (24% -> 3 cols): Queue */}
      <aside className="lg:col-span-3 flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden h-full">
        <div className="p-2.5 border-b border-[#E2E8F0] space-y-2">
          <div className="flex items-center gap-1.5 relative">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#737686]" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="بحث في القائمة..."
                className="w-full h-8 pr-8 pl-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] text-[12px] text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowQueueFiltersPopover((p) => !p)}
              aria-label="تصفية سريعة للقناة"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                channelQuickFilter !== 'all'
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#737686] hover:text-[#131B2E]'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
            </button>

            {showQueueFiltersPopover && (
              <div className="flyout-surface absolute left-0 top-9 z-30 w-44 rounded-xl p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setChannelQuickFilter('all');
                    setShowQueueFiltersPopover(false);
                  }}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-right text-xs ${
                    channelQuickFilter === 'all'
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                      : 'text-[#131B2E] hover:bg-[#F2F3FF]'
                  }`}
                >
                  كافة القنوات
                </button>
                {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      setChannelQuickFilter(ch);
                      setShowQueueFiltersPopover(false);
                    }}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-right text-xs ${
                      channelQuickFilter === ch
                        ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                        : 'text-[#131B2E] hover:bg-[#F2F3FF]'
                    }`}
                  >
                    {CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {MINI_FILTERS.map((mf) => {
              const active = miniFilter === mf.id;
              return (
                <button
                  key={mf.id}
                  type="button"
                  onClick={() => setMiniFilter(mf.id)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#2563EB] text-[#FFFFFF]'
                      : 'bg-[#F2F3FF] text-[#434655] hover:bg-[#EAEDFF]'
                  }`}
                >
                  {mf.label}
                </button>
              );
            })}
          </div>

          {miniFilter === 'tags' && availableTags.length > 0 && (
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="w-full h-7 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px]"
            >
              <option value="all">جميع الوسوم</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9] p-1.5 space-y-1">
          {queueContacts.map((c) => {
            const selected = c.id === activeContact.id;
            const cStatus = resolveContactStatus(c.contactStatus);
            const cDeals = getDealsForContact(c, deals);
            const isContactB2C = c.accountId === 'unassigned' || c.accountName === 'عميل فردي B2C';

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectContact(c.id)}
                className={`w-full rounded-xl p-2.5 text-right transition-all border ${
                  selected
                    ? 'border-[#2563EB] bg-[#EFF6FF]/80 shadow-xs'
                    : 'border-transparent bg-[#FFFFFF] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#131B2E] truncate">
                    {c.fullName}
                  </span>
                  {cDeals.length > 0 && (
                    <span className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#059669] tabular-nums shrink-0">
                      {cDeals.length} صفقة
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-1.5 text-[10px]">
                  <span className="text-[#434655] truncate">
                    {isContactB2C ? 'عميل فردي B2C' : c.accountName}
                  </span>
                  <span className="text-[#737686] shrink-0">
                    {CHANNEL_LABELS[c.channel ?? 'whatsapp']}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${getStatusPillClasses(cStatus, selected)}`}>
                    {cStatus}
                  </span>
                  <span className="text-[10px] text-[#737686] truncate">
                    {c.lastActivityLabel ?? 'اليوم'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER COLUMN (44% -> 5 cols): Record Details, Blueprint, Deals & Touchpoints */}
      <main className="lg:col-span-5 flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden h-full">
        {/* Record Header */}
        <div className="border-b border-[#E2E8F0] px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[16px] font-bold text-[#131B2E] truncate">
                {activeContact.fullName}
              </h2>
              <button
                type="button"
                onClick={handleCopyId}
                title="نسخ المعرف الفريد"
                className="inline-flex items-center gap-1 rounded bg-[#EAEDFF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#004AC6] hover:bg-[#DBE1FF]"
              >
                <span>{activeContact.leadUniqueId ?? activeContact.id}</span>
                {copiedId ? <Check className="h-3 w-3 text-[#006242]" /> : <Copy className="h-3 w-3" />}
              </button>
              {saveBadgeState === 'saved' && (
                <span className="inline-flex items-center gap-1 rounded bg-[#6FFBE0] px-2 py-0.5 text-[10px] font-bold text-[#005236]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>تم الحفظ</span>
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#737686]">
              <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />
              {isB2C ? (
                <span>عميل فردي B2C</span>
              ) : (
                <Link to="/accounts" className="font-semibold text-[#004AC6] hover:underline">
                  {activeContact.accountName}
                </Link>
              )}
              {activeContact.jobTitle && <span>· {activeContact.jobTitle}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 relative">
            <button
              type="button"
              onClick={() => onOpenCreateDeal(activeContact)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] shadow-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>+ صفقة جديدة</span>
            </button>

            <button
              type="button"
              onClick={() =>
                void addContactTouchpoint(activeContact.id, {
                  channel: 'مكالمة',
                  summary: `مكالمة هاتفية مع ${activeContact.fullName}`,
                  eventType: 'مكالمة صادرة',
                }).then(() => onNotify?.('تم تسجيل المكالمة في سجل التفاعلات.'))
              }
              title="تسجيل مكالمة"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-[#434655] hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              <Phone className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setMoreMenuOpen((p) => !p)}
              aria-label="المزيد من الخيارات"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-[#434655] hover:bg-[#F2F3FF]"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {moreMenuOpen && (
              <div className="flyout-surface absolute left-0 top-9 z-30 w-44 rounded-xl py-1">
                <Link
                  to={`/contacts/${activeContact.id}`}
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#131B2E] hover:bg-[#F2F3FF]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>فتح صفحة العميل الكاملة</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Details + Deals + Touchpoints Subform */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Interactive Contact Status Bar */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
            <p className="mb-2 text-[11px] font-bold text-[#434655]">حالة جهة الاتصال</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CONTACT_STATUSES.map((st) => {
                const isCurrent = activeStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={!canUpdateContact}
                    onClick={() => void commitPatch({ contactStatus: st })}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all text-center ${
                      isCurrent
                        ? st === 'عميل متكرر (VIP)'
                          ? 'bg-[#006242] text-[#FFFFFF] shadow-xs'
                          : st === 'متوقف / غير نشط'
                          ? 'bg-[#434655] text-[#FFFFFF]'
                          : 'bg-[#2563EB] text-[#FFFFFF] shadow-xs'
                        : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#434655] hover:border-[#2563EB]'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2-Column Inline Editable Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {getFieldAccess('contacts', 'fullName') !== 'hidden' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={draftFullName}
                  disabled={!canUpdateContact || getFieldAccess('contacts', 'fullName') === 'read_only'}
                  onChange={(e) => setDraftFullName(e.target.value)}
                  onBlur={() => {
                    if (draftFullName.trim() && draftFullName !== activeContact.fullName) {
                      void commitPatch({ fullName: draftFullName.trim() });
                    }
                  }}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none disabled:bg-[#F8FAFC]"
                />
              </div>
            )}

            {getFieldAccess('contacts', 'jobTitle') !== 'hidden' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                  المسمى الوظيفي
                </label>
                <input
                  type="text"
                  value={draftJobTitle}
                  disabled={!canUpdateContact || getFieldAccess('contacts', 'jobTitle') === 'read_only'}
                  onChange={(e) => setDraftJobTitle(e.target.value)}
                  onBlur={() => {
                    if (draftJobTitle !== (activeContact.jobTitle ?? '')) {
                      void commitPatch({ jobTitle: draftJobTitle.trim() || undefined });
                    }
                  }}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none disabled:bg-[#F8FAFC]"
                />
              </div>
            )}

            {getFieldAccess('contacts', 'phone') !== 'hidden' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                  رقم الجوال
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={draftPhone}
                  disabled={!canUpdateContact || getFieldAccess('contacts', 'phone') === 'read_only'}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  onBlur={() => {
                    if (draftPhone !== (activeContact.phone ?? '')) {
                      void commitPatch({ phone: draftPhone.trim() || undefined });
                    }
                  }}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-xs text-[#131B2E] tabular-nums focus:border-[#2563EB] focus:outline-none disabled:bg-[#F8FAFC]"
                />
              </div>
            )}

            {getFieldAccess('contacts', 'email') !== 'hidden' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={draftEmail}
                  disabled={!canUpdateContact || getFieldAccess('contacts', 'email') === 'read_only'}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  onBlur={() => {
                    if (draftEmail !== (activeContact.email ?? '')) {
                      void commitPatch({ email: draftEmail.trim() || undefined });
                    }
                  }}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none disabled:bg-[#F8FAFC]"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                القناة المفضلة
              </label>
              <select
                value={draftChannel}
                disabled={!canUpdateContact}
                onChange={(e) => {
                  const next = e.target.value as LeadChannel;
                  setDraftChannel(next);
                  void commitPatch({ channel: next });
                }}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              >
                {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABELS[ch]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                مالك السجل
              </label>
              <select
                value={draftOwner}
                disabled={!canUpdateContact}
                onChange={(e) => {
                  setDraftOwner(e.target.value);
                  void commitPatch({ assignedToName: e.target.value });
                }}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              >
                {CONTACT_OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                المدينة / الدولة
              </label>
              <input
                type="text"
                value={draftCity}
                disabled={!canUpdateContact}
                onChange={(e) => setDraftCity(e.target.value)}
                onBlur={() => {
                  if (draftCity !== (activeContact.city ?? '')) {
                    void commitPatch({ city: draftCity.trim() || undefined });
                  }
                }}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                المصدر الأساسي (First-Touch)
              </label>
              <input
                type="text"
                value={draftSource}
                disabled={!canUpdateContact}
                onChange={(e) => setDraftSource(e.target.value)}
                onBlur={() => {
                  if (draftSource !== (activeContact.primarySource ?? '')) {
                    void commitPatch({ primarySource: draftSource.trim() || undefined });
                  }
                }}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            {/* Dynamic Tenant Custom Fields (Contacts Module + FLS) */}
            {contactCustomFields.map((cf) => {
              const access = getFieldAccess('contacts', cf.fieldKey);
              if (access === 'hidden') return null;
              const locked = !canUpdateContact || access === 'read_only';
              const val = draftCustomValues[cf.fieldKey] ?? '';

              return (
                <div key={cf.id}>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[#737686]">
                    <span>{cf.label}</span>
                    {access === 'read_only' && <Lock className="h-2.5 w-2.5 text-[#D97706]" />}
                  </label>
                  {cf.fieldType === 'select' && cf.options ? (
                    <select
                      value={String(val)}
                      disabled={locked}
                      onChange={(e) => {
                        const updated = { ...draftCustomValues, [cf.fieldKey]: e.target.value };
                        setDraftCustomValues(updated);
                        void commitPatch({ customValues: updated });
                      }}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] disabled:bg-[#F8FAFC]"
                    >
                      <option value="">اختر...</option>
                      {cf.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      disabled={locked}
                      onChange={(e) =>
                        setDraftCustomValues((prev) => ({
                          ...prev,
                          [cf.fieldKey]: e.target.value,
                        }))
                      }
                      onBlur={() => void commitPatch({ customValues: draftCustomValues })}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] disabled:bg-[#F8FAFC]"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tags & Notes */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#737686]">
                <Tag className="h-3 w-3" />
                <span>الوسوم:</span>
              </span>
              {(activeContact.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4338CA]"
                >
                  <span>#{t}</span>
                  {canUpdateContact && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(t)}
                      className="hover:text-[#B91C1C]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}
              {canUpdateContact &&
                (addingTag ? (
                  <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="وسم جديد"
                      className="h-6 w-24 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-1.5 text-[11px]"
                    />
                    <button
                      type="submit"
                      className="rounded bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-[#FFFFFF]"
                    >
                      حفظ
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTag(true)}
                    className="inline-flex items-center gap-0.5 rounded border border-dashed border-[#CBD5E1] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span>إضافة وسم</span>
                  </button>
                ))}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                الملاحظات والملخص التنفيذي
              </label>
              <textarea
                rows={2}
                value={draftNotes}
                disabled={!canUpdateContact}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={() => {
                  if (draftNotes !== (activeContact.notes ?? '')) {
                    void commitPatch({ notes: draftNotes.trim() || undefined });
                  }
                }}
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          {/* Embedded Linked Deals Sub-Section */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-[#004AC6]" />
                <h3 className="text-xs font-bold text-[#131B2E]">
                  الصفقات المرتبطة ({contactDeals.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenCreateDeal(activeContact)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 py-1 text-[11px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]"
              >
                <Plus className="h-3 w-3" />
                <span>صفقة</span>
              </button>
            </div>

            {contactDeals.length === 0 ? (
              <p className="text-[11px] text-[#737686]">
                لا توجد صفقات مرتبطة حالياً — اضغط «+ صفقة» لفتح فرصة مبيعات جديدة.
              </p>
            ) : (
              <div className="space-y-1.5">
                {contactDeals.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#131B2E] truncate">{d.title}</p>
                      <p className="text-[10px] text-[#737686] tabular-nums">
                        المرحلة: {d.stage} · الإغلاق: {d.closeDate}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-bold text-[#004AC6] tabular-nums">
                        {formatCurrencySAR(d.amount)}
                      </p>
                      <p className="text-[10px] font-semibold text-[#059669] tabular-nums">
                        {formatCompactDealValue(d.amount)} · {d.probability}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Embedded Touchpoints Subform */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Route className="h-4 w-4 text-[#4648D4]" />
                <h3 className="text-xs font-bold text-[#131B2E]">
                  نقاط التماس وسجل التفاعلات ({contactTouchpoints.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTpOpen((p) => !p)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DBE1FF] bg-[#F2F3FF] px-2.5 py-1 text-[11px] font-bold text-[#004AC6] hover:bg-[#DBE1FF]"
              >
                <Plus className="h-3 w-3" />
                <span>تسجيل تواصل</span>
              </button>
            </div>

            {tpOpen && (
              <form
                onSubmit={handleAddTouchpoint}
                className="rounded-xl border border-[#DBE1FF] bg-[#F8FAFC] p-2.5 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={tpChannel}
                    onChange={(e) => setTpChannel(e.target.value as TouchpointChannel)}
                    className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-1 text-[11px]"
                  >
                    {TOUCHPOINT_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={tpEventType}
                    onChange={(e) => setTpEventType(e.target.value)}
                    placeholder="نوع الحدث (مكالمة، عرض، اجتماع)"
                    className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-1 text-[11px]"
                  />
                </div>
                <input
                  type="text"
                  value={tpCampaign}
                  onChange={(e) => setTpCampaign(e.target.value)}
                  placeholder="الحملة أو المبادرة (اختياري)"
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-1 text-[11px]"
                />
                <textarea
                  rows={2}
                  value={tpSummary}
                  onChange={(e) => setTpSummary(e.target.value)}
                  placeholder="ملخص التواصل..."
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 py-1 text-[11px]"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTpOpen(false)}
                    className="rounded-lg px-2.5 py-1 text-[11px] text-[#737686]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-[#FFFFFF]"
                  >
                    حفظ التفاعل
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px]">
                <thead>
                  <tr className="bg-[#F2F3FF] text-[#434655]">
                    <th className="py-1.5 px-2">القناة</th>
                    <th className="py-1.5 px-2">التفاصيل</th>
                    <th className="py-1.5 px-2">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {contactTouchpoints.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-[#737686]">
                        لا توجد نقاط تماس مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    contactTouchpoints.map((tp) => (
                      <tr key={tp.id}>
                        <td className="py-1.5 px-2 font-semibold text-[#004AC6] whitespace-nowrap">
                          {tp.channel}
                        </td>
                        <td className="py-1.5 px-2 text-[#131B2E]">
                          <p>{tp.summary}</p>
                          {tp.campaign && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#737686]">
                              <Megaphone className="h-2.5 w-2.5" />
                              {tp.campaign}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[#737686] whitespace-nowrap">
                          {tp.occurredAt}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* LEFT COLUMN (32% -> 4 cols): Fixed-height Omnichannel Chat */}
      <aside className="lg:col-span-4 flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden h-full">
        <div className="border-b border-[#E2E8F0] px-3.5 py-3 flex items-center justify-between gap-2 bg-[#FFFFFF]">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#006242]" />
            <div>
              <h3 className="text-[13px] font-bold text-[#131B2E]">
                صندوق المحادثات الموحد
              </h3>
              <p className="text-[10px] text-[#737686]">
                {activeContact.fullName} · {getArabicInitials(activeContact.fullName)}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#6FFBE0] px-2 py-0.5 text-[10px] font-bold text-[#005236]">
            قناة مفتوحة
          </span>
        </div>

        <div className="flex items-center gap-1 border-b border-[#E2E8F0] px-3 py-1.5 bg-[#F8FAFC]">
          {CHAT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setChatTab(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                chatTab === t.id
                  ? 'bg-[#2563EB] text-[#FFFFFF]'
                  : 'text-[#434655] hover:bg-[#EAEDFF]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#F8FAFC]">
          {contactMessages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#FFFFFF] p-6 text-center space-y-1.5">
              <MessageSquare className="mx-auto h-6 w-6 text-[#94A3B8]" />
              <p className="text-xs font-semibold text-[#131B2E]">
                لا توجد رسائل مسجلة في هذه القناة
              </p>
              <p className="text-[11px] text-[#737686]">
                استخدم قوالب "/" السريعة بالأسفل لإرسال رسالة فورية للعميل.
              </p>
            </div>
          ) : (
            contactMessages.map((m) => {
              const outbound = m.direction === 'outbound';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${outbound ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs shadow-2xs ${
                      outbound
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#131B2E]'
                    }`}
                  >
                    <p className="leading-relaxed">{m.body}</p>
                    <div
                      className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${
                        outbound ? 'text-[#DBEAFE]' : 'text-[#737686]'
                      }`}
                    >
                      <span>
                        {INBOX_CHANNEL_LABELS[m.channel]} · {m.timestampLabel}
                      </span>
                      {outbound && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Composer w/ "/" Quick Replies */}
        <form
          onSubmit={handleSendChat}
          className="border-t border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-2"
        >
          {showSlashSuggestions && (
            <div className="rounded-xl border border-[#DBE1FF] bg-[#F8FAFC] p-1.5 space-y-1">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.command}
                  type="button"
                  onClick={() => setChatText(qr.template)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-right text-[11px] hover:bg-[#EFF6FF]"
                >
                  <span className="font-bold text-[#2563EB]">
                    {qr.emoji} {qr.command}
                  </span>
                  <span className="text-[#434655] truncate">{qr.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr.command}
                type="button"
                onClick={() => setChatText(qr.template)}
                className="rounded-full bg-[#F2F3FF] px-2 py-0.5 text-[10px] font-semibold text-[#004AC6] hover:bg-[#DBE1FF] whitespace-nowrap shrink-0"
              >
                {qr.emoji} {qr.command}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder='اكتب رداً أو اضغط "/" لاختيار قالب جاهز...'
              className="flex-1 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={!chatText.trim()}
              aria-label="إرسال الرسالة"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-40 shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </section>
  );
};
