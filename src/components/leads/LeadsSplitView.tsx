import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
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
  Sparkles,
  Tag,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type {
  InboxMessage,
  Lead,
  LeadChannel,
  LeadStatus,
  TouchpointChannel,
} from '../../types/crm';
import { CHANNEL_LABELS, isMyLead, LEAD_OWNERS } from '../../utils/leadsLogic';
import { getArabicInitials, LeadChannelBadge } from './LeadChannelIcon';

interface LeadsSplitViewProps {
  leads: Lead[];
  selectedLeadId: string;
  onSelectLead: (leadId: string) => void;
  onOpenConvertLead: (lead: Lead) => void;
  onNotify?: (message: string) => void;
}

type QueueMiniFilter = 'all' | 'my' | 'unanswered' | 'hot' | 'tags';
type SplitChatTab = 'all' | 'whatsapp' | 'instagram' | 'messenger';

const BLUEPRINT_STEPS: LeadStatus[] = ['جديد', 'تم التواصل', 'مؤهل للتحويل'];

const QUICK_REPLIES: Array<{
  command: string;
  emoji: string;
  label: string;
  template: string;
}> = [
  {
    command: '/عرض_سعر',
    emoji: '⚡',
    label: 'إرسال تفاصيل الباقة وعرض السعر',
    template:
      'أهلاً بكم، مرفق تفاصيل باقة رواق CRM المؤسسية شاملة ربط قنوات واتساب الأعمال وميتا وتكامل API. هل يناسبكم اعتماد العرض المالي غداً؟',
  },
  {
    command: '/حجز_موعد',
    emoji: '📅',
    label: 'جدولة جلسة عرض حي (Demo)',
    template:
      'يسعدنا ترتيب جلسة عرض حي لمنصة رواق مع فريقكم المختص. يرجى تزويدنا بالوقت المناسب لكم غداً بين 10:00 صباحاً و 04:00 عصراً بتوقيت الرياض.',
  },
  {
    command: '/ترحيب',
    emoji: '👋',
    label: 'رسالة ترحيب وجمع المتطلبات',
    template:
      'مرحباً بكم في رواق CRM، شكراً لتواصلكم معنا. لتقديم أفضل توصية فنية، كم عدد المستخدمين المتوقعين وما القنوات الأساسية التي ترغبون بربطها؟',
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
  { id: 'my', label: 'عملائي' },
  { id: 'unanswered', label: 'لم يُرد' },
  { id: 'hot', label: 'ساخن' },
  { id: 'tags', label: 'التاغات' },
];

const INBOX_CHANNEL_LABELS: Record<InboxMessage['channel'], string> = {
  whatsapp: 'واتساب',
  instagram: 'إنستغرام',
  messenger: 'ماسنجر',
  email: 'بريد إلكتروني',
  chat: 'محادثة',
};

function getStagePillClasses(status: LeadStatus, isActiveCard: boolean): string {
  if (isActiveCard && status === 'مؤهل للتحويل') {
    return 'bg-[#2563EB] text-[#FFFFFF] font-bold';
  }
  switch (status) {
    case 'مؤهل للتحويل':
      return 'bg-[#6FFBE0]/60 text-[#002113] font-bold';
    case 'تم التواصل':
      return 'bg-[#DBE1FF] text-[#00174B] font-semibold';
    case 'غير مهتم':
      return 'bg-[#FFDAD6] text-[#93000A] font-semibold';
    default:
      return 'bg-[#E2E7FF] text-[#434655] font-semibold';
  }
}

export const LeadsSplitView: React.FC<LeadsSplitViewProps> = ({
  leads,
  selectedLeadId,
  onSelectLead,
  onOpenConvertLead,
  onNotify,
}) => {
  const {
    currentUser,
    customFields,
    touchpoints,
    messages,
    activeProfile,
    getFieldAccess,
    updateLeadFields,
    addLeadTouchpoint,
    sendInboxReply,
  } = useCrm();

  const canUpdateLead = activeProfile?.modulePermissions?.leads?.update ?? true;

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
  const [tpAdId, setTpAdId] = useState('');
  const [tpUtmSource, setTpUtmSource] = useState('');
  const [tpSummary, setTpSummary] = useState('');

  const [chatTab, setChatTab] = useState<SplitChatTab>('all');
  const [chatChannel, setChatChannel] = useState<InboxMessage['channel']>('whatsapp');
  const [chatText, setChatText] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      for (const t of l.tags ?? []) set.add(t);
    }
    return Array.from(set);
  }, [leads]);

  const queueLeads = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (miniFilter === 'my' && !isMyLead(l.assignedToName, currentUser.fullName)) {
        return false;
      }
      if (miniFilter === 'unanswered' && (l.awaitingReplyHours ?? 0) <= 0) {
        return false;
      }
      if (miniFilter === 'hot' && l.aiScore < 85 && !(l.tags ?? []).includes('ساخن')) {
        return false;
      }
      if (miniFilter === 'tags') {
        const lt = l.tags ?? [];
        if (lt.length === 0) return false;
        if (selectedTagFilter !== 'all' && !lt.includes(selectedTagFilter)) return false;
      }
      if (channelQuickFilter !== 'all' && l.channel !== channelQuickFilter) {
        return false;
      }
      if (!q) return true;
      return (
        l.fullName.toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.source ?? '').toLowerCase().includes(q) ||
        (l.campaign ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        l.unique_id.toLowerCase().includes(q)
      );
    });
  }, [
    channelQuickFilter,
    currentUser.fullName,
    leads,
    miniFilter,
    queueSearch,
    selectedTagFilter,
  ]);

  const activeLead =
    leads.find((l) => l.id === selectedLeadId) ?? queueLeads[0] ?? leads[0] ?? null;

  useEffect(() => {
    if (!activeLead) return;
    if (
      activeLead.channel === 'whatsapp' ||
      activeLead.channel === 'instagram' ||
      activeLead.channel === 'messenger'
    ) {
      setChatChannel(activeLead.channel);
    }
    setMoreMenuOpen(false);
    setAddingTag(false);
  }, [activeLead]);

  const leadCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'leads')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const leadTouchpoints = useMemo(() => {
    if (!activeLead) return [];
    return touchpoints.filter(
      (tp) =>
        tp.leadId === activeLead.id ||
        (Boolean(tp.leadUniqueId) && tp.leadUniqueId === activeLead.unique_id) ||
        (tp.relatedEntityType === 'lead' && tp.relatedEntityId === activeLead.id)
    );
  }, [activeLead, touchpoints]);

  const leadMessages = useMemo(() => {
    if (!activeLead) return [];
    const allForLead = messages.filter(
      (m) =>
        m.leadId === activeLead.id ||
        (Boolean(m.leadUniqueId) && m.leadUniqueId === activeLead.unique_id) ||
        m.senderName === activeLead.fullName
    );
    if (chatTab === 'all') return allForLead;
    return allForLead.filter((m) => m.channel === chatTab);
  }, [activeLead, chatTab, messages]);

  if (!activeLead) {
    return (
      <div className="rounded-xl border border-[#C3C6D7]/40 bg-[#FFFFFF] p-10 text-center text-[13px] text-[#737686]">
        لا توجد سجلات عملاء لعرضها في الوضع المقسم.
      </div>
    );
  }

  const handleCopyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(activeLead.unique_id);
    }
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1600);
  };

  const triggerSavedIndicator = () => {
    setSaveBadgeState('saved');
    window.setTimeout(() => setSaveBadgeState('idle'), 1600);
  };

  const handleFieldSave = (patch: Partial<Lead>) => {
    if (!canUpdateLead) return;
    void updateLeadFields(activeLead.id, patch);
    triggerSavedIndicator();
  };

  const handleCustomFieldChange = (fieldKey: string, value: string | number | boolean) => {
    if (!canUpdateLead) return;
    void updateLeadFields(activeLead.id, {
      customValues: {
        ...(activeLead.customValues ?? {}),
        [fieldKey]: value,
      },
    });
    triggerSavedIndicator();
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpCampaign.trim() && !tpSummary.trim()) return;
    await addLeadTouchpoint(activeLead.id, {
      channel: tpChannel,
      eventType: 'تسجيل نقطة دخول',
      campaign: tpCampaign.trim() || activeLead.source || 'حملة مباشرة',
      adId: tpAdId.trim() || undefined,
      utmSource: tpUtmSource.trim() || undefined,
      summary: tpSummary.trim() || `دخول عبر ${tpChannel} (${tpCampaign.trim() || 'مباشر'})`,
    });
    setTpCampaign('');
    setTpAdId('');
    setTpUtmSource('');
    setTpSummary('');
    setTpOpen(false);
    onNotify?.('تم تسجيل نقطة الدخول وحفظها في سجل الحملات.');
  };

  const handleQuickCall = () => {
    void addLeadTouchpoint(activeLead.id, {
      channel: 'مكالمة',
      eventType: 'اتصال هاتفي صادر',
      summary: `اتصال هاتفي مع ${activeLead.fullName} (${activeLead.phone || activeLead.unique_id})`,
    });
    onNotify?.(
      `تم توثيق اتصال هاتفي مع ${activeLead.fullName} (${activeLead.phone || activeLead.unique_id}).`
    );
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatText.trim()) return;
    await sendInboxReply(chatChannel, activeLead.fullName, chatText, {
      leadId: activeLead.id,
      leadUniqueId: activeLead.unique_id,
      companyName: activeLead.city || activeLead.source,
    });
    setChatText('');
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean || !canUpdateLead) return;
    const nextTags = Array.from(new Set([...(activeLead.tags ?? []), clean])).slice(0, 20);
    handleFieldSave({ tags: nextTags });
    setNewTagInput('');
    setAddingTag(false);
  };

  const showSlashPalette = chatText.trim().startsWith('/');
  const activeStepNumber =
    activeLead.status === 'جديد'
      ? 1
      : activeLead.status === 'تم التواصل'
      ? 2
      : activeLead.status === 'مؤهل للتحويل'
      ? 3
      : 4;
  const estimatedCloseProb = Math.min(96, Math.max(20, activeLead.aiScore - 10));

  return (
    <div
      data-split-workspace="true"
      className="flex flex-col lg:flex-row overflow-hidden rounded-xl border border-[#C3C6D7]/40 bg-[#F2F3FF] shadow-sm lg:h-[calc(100vh-195px)] lg:min-h-[600px]"
    >
      {/* 1. RIGHT COLUMN (24% width — Compact Lead Queue) */}
      <aside
        data-split-pane="queue"
        className="w-full lg:w-[24%] border-b lg:border-b-0 lg:border-l border-[#C3C6D7]/35 bg-[#FFFFFF] flex flex-col shrink-0 h-[360px] lg:h-full overflow-hidden"
      >
        {/* Search & Mini Pills */}
        <div className="shrink-0 p-3 border-b border-[#C3C6D7]/30 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="بحث في القائمة..."
                aria-label="بحث في قائمة انتظار العملاء"
                className="w-full pr-8 pl-2.5 py-1.5 bg-[#F2F3FF] text-[#131B2E] placeholder:text-[#737686] text-[12px] rounded-lg border border-[#C3C6D7]/45 focus:outline-none focus:border-[#004AC6] focus:ring-1 focus:ring-[#004AC6]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowQueueFiltersPopover((prev) => !prev)}
              title="تصفية حسب القناة"
              aria-label="تصفية القائمة حسب القناة"
              className={`flex items-center justify-center p-1.5 rounded-lg border transition-colors shrink-0 ${
                channelQuickFilter !== 'all' || showQueueFiltersPopover
                  ? 'bg-[#DBE1FF] border-[#004AC6]/40 text-[#004AC6]'
                  : 'bg-[#F2F3FF] hover:bg-[#EAEDFF] text-[#434655] hover:text-[#004AC6] border-[#C3C6D7]/45'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {showQueueFiltersPopover && (
            <div className="flex items-center gap-1.5 flex-wrap rounded-lg bg-[#F2F3FF] p-2 border border-[#C3C6D7]/40">
              <span className="text-[10.5px] font-semibold text-[#737686]">القناة:</span>
              {(['all', 'whatsapp', 'instagram', 'messenger', 'website'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelQuickFilter(ch)}
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                    channelQuickFilter === ch
                      ? 'bg-[#004AC6] text-[#FFFFFF]'
                      : 'bg-[#FFFFFF] text-[#434655] hover:bg-[#EAEDFF]'
                  }`}
                >
                  {ch === 'all' ? 'الكل' : CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          )}

          {/* Mini Pills + Record Ratio */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {MINI_FILTERS.map((mf) => {
                const active = miniFilter === mf.id;
                return (
                  <button
                    key={mf.id}
                    type="button"
                    onClick={() => setMiniFilter(mf.id)}
                    className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#004AC6] text-[#FFFFFF] font-semibold'
                        : 'bg-[#EAEDFF] text-[#434655] hover:bg-[#E2E7FF]'
                    }`}
                  >
                    {mf.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[10.5px] font-medium text-[#737686] shrink-0 tabular-nums">
              {queueLeads.length} من {leads.length}
            </span>
          </div>

          {miniFilter === 'tags' && availableTags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedTagFilter('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                  selectedTagFilter === 'all'
                    ? 'bg-[#2563EB] text-[#FFFFFF]'
                    : 'bg-[#F2F3FF] text-[#434655]'
                }`}
              >
                كل التاغات
              </button>
              {availableTags.map((tg) => (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setSelectedTagFilter(tg)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    selectedTagFilter === tg
                      ? 'bg-[#2563EB] text-[#FFFFFF]'
                      : 'bg-[#F2F3FF] text-[#434655]'
                  }`}
                >
                  #{tg}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Queue Card Feed (Strictly NO company name or job title) */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#C3C6D7]/20">
          {queueLeads.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[#737686]">
              لا توجد سجلات مطابقة لتصفية القائمة.
            </div>
          ) : (
            queueLeads.map((lead) => {
              const active = lead.id === activeLead.id;
              const isDisqualified = lead.status === 'غير مهتم';
              const scoreBadgeClass = isDisqualified
                ? 'bg-[#FFDAD6] text-[#93000A]'
                : lead.aiScore >= 85
                ? 'bg-[#6FFBE0] text-[#002113]'
                : 'bg-[#DAE2FD] text-[#434655]';

              return (
                <button
                  key={lead.id}
                  type="button"
                  data-queue-lead={lead.id}
                  onClick={() => onSelectLead(lead.id)}
                  className={`w-full text-right p-3 transition-colors cursor-pointer block ${
                    active
                      ? 'bg-[#DBE1FF]/40 border-r-4 border-r-[#004AC6]'
                      : 'hover:bg-[#F2F3FF] border-r-4 border-r-transparent'
                  } ${isDisqualified ? 'opacity-80' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-[#004AC6] shrink-0" />
                      )}
                      <span className="text-[13.5px] font-bold text-[#131B2E] truncate">
                        {lead.fullName}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums shrink-0 ${scoreBadgeClass}`}
                    >
                      {lead.aiScore}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <LeadChannelBadge channel={lead.channel} />
                    <span className="text-[11px] text-[#737686] truncate">
                      {lead.campaign || lead.source || lead.unique_id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] border-t border-[#C3C6D7]/15 pt-1.5">
                    <span
                      className={`inline-flex items-center gap-1 truncate ${
                        active ? 'text-[#004AC6] font-semibold' : 'text-[#737686]'
                      }`}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        آخر رسالة: {lead.lastActivityLabel || 'الآن'}
                      </span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 ${getStagePillClasses(
                        lead.status,
                        active
                      )}`}
                    >
                      {lead.status}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. CENTER COLUMN (44% width — Record Details, Blueprint & Touchpoints Subform) */}
      <section
        data-split-pane="center"
        className="w-full lg:w-[44%] border-b lg:border-b-0 lg:border-l border-[#C3C6D7]/35 bg-[#F2F3FF] flex flex-col lg:h-full overflow-y-auto p-3.5 space-y-3.5"
      >
        {/* Top Record Profile & Interactive Blueprint Card */}
        <div className="bg-[#FFFFFF] rounded-xl border border-[#C3C6D7]/35 p-4 shadow-xs space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#004AC6] text-[#FFFFFF] font-bold flex items-center justify-center text-[15px] relative shadow-xs shrink-0">
                <span>{getArabicInitials(activeLead.fullName)}</span>
                {activeLead.channel === 'whatsapp' && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#006242] text-[#FFFFFF] flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/leads/${activeLead.id}`}
                    className="text-[16px] font-bold text-[#131B2E] hover:text-[#004AC6] truncate"
                  >
                    {activeLead.fullName}
                  </Link>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    title="نسخ المعرف الدائم"
                    className="inline-flex items-center gap-1 rounded-full bg-[#EAEDFF] px-2.5 py-0.5 text-[11px] font-bold text-[#004AC6] hover:bg-[#DBE1FF] tabular-nums"
                  >
                    <span>ID: {activeLead.unique_id}</span>
                    {copiedId ? (
                      <Check className="h-3 w-3 text-[#006242]" />
                    ) : (
                      <Copy className="h-3 w-3 text-[#737686]" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[12px] text-[#737686] truncate">
                  {activeLead.city || 'الرياض، السعودية'} · {activeLead.source || 'مصدر مباشر'}
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-1.5 shrink-0">
              {activeLead.converted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-[12px] font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تم التحويل</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenConvertLead(activeLead)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004AC6] hover:bg-[#2563EB] text-[#FFFFFF] rounded-lg text-[12.5px] font-bold shadow-xs transition-all"
                >
                  <Zap className="h-4 w-4" />
                  <span>تحويل العميل</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleQuickCall}
                title="اتصال مباشر وتوثيق مكالمة"
                aria-label="اتصال مباشر"
                className="p-2 border border-[#C3C6D7]/50 rounded-lg text-[#006242] hover:bg-[#F2F3FF] transition-colors"
              >
                <Phone className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                aria-label="خيارات السجل"
                className="p-2 border border-[#C3C6D7]/50 rounded-lg text-[#737686] hover:text-[#131B2E] hover:bg-[#F2F3FF] transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {moreMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-lg">
                  <Link
                    to={`/leads/${activeLead.id}`}
                    className="block px-3 py-1.5 text-[12px] font-medium text-[#131B2E] hover:bg-[#F2F3FF]"
                  >
                    فتح صفحة السجل الكاملة
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyId();
                      setMoreMenuOpen(false);
                    }}
                    className="w-full text-right px-3 py-1.5 text-[12px] font-medium text-[#131B2E] hover:bg-[#F2F3FF]"
                  >
                    نسخ المعرف ({activeLead.unique_id})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Score Gauge Row */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F2F3FF] border border-[#C3C6D7]/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#6FFBE0] text-[#002113] font-bold text-[12px] tabular-nums shrink-0">
                {activeLead.aiScore}
              </div>
              <div className="text-[12.5px]">
                <span className="font-semibold text-[#131B2E]">
                  نقاط الجدية والتأهيل (Lead Score):
                </span>
                <span className="font-bold text-[#006242] mr-1.5 tabular-nums">
                  {activeLead.aiScore}/100 ({activeLead.aiScore >= 85 ? 'مؤهل مرتفع 🔥' : 'قيد التأهيل'})
                </span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-[#737686] tabular-nums hidden sm:inline">
              احتمالية الإغلاق المتوقعة: {estimatedCloseProb}%
            </span>
          </div>

          {/* Interactive Blueprint Progression Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#737686]">
                مسار تأهيل العميل (Lead Pipeline Blueprint)
              </span>
              <span className="text-[11px] font-bold text-[#004AC6] tabular-nums">
                المرحلة الحالية: {activeStepNumber} من 4
              </span>
            </div>

            <div className="grid grid-cols-[0.8fr_1.05fr_1.35fr_0.8fr] gap-1 p-1 bg-[#F2F3FF] rounded-xl border border-[#C3C6D7]/30">
              {BLUEPRINT_STEPS.map((step, idx) => {
                const currentIdx = BLUEPRINT_STEPS.indexOf(activeLead.status);
                const isCurrent = activeLead.status === step;
                const isDone = currentIdx > idx;

                return (
                  <button
                    key={step}
                    type="button"
                    disabled={!canUpdateLead}
                    onClick={() => handleFieldSave({ status: step })}
                    className={`min-w-0 flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] transition-colors ${
                      isCurrent
                        ? 'bg-[#004AC6] text-[#FFFFFF] font-bold shadow-xs'
                        : isDone
                        ? 'bg-[#6FFBE0]/35 text-[#006242] font-semibold hover:bg-[#6FFBE0]/50'
                        : 'text-[#434655] font-medium hover:bg-[#FFFFFF]'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-[#FFFFFF] animate-pulse shrink-0" />
                    ) : null}
                    <span className="whitespace-nowrap tabular-nums">
                      {idx + 1}. {step}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                disabled={!canUpdateLead}
                onClick={() => handleFieldSave({ status: 'غير مهتم' })}
                className={`min-w-0 flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] transition-colors ${
                  activeLead.status === 'غير مهتم'
                    ? 'bg-[#FFDAD6] text-[#93000A] font-bold shadow-xs'
                    : 'text-[#737686] font-medium hover:bg-[#FFDAD6]/45 hover:text-[#93000A]'
                }`}
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">غير مهتم</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inline-Editable 2-Column Fields Card (No Company/Job Title, FLS-aware) */}
        <div className="bg-[#FFFFFF] rounded-xl border border-[#C3C6D7]/35 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#C3C6D7]/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#004AC6]" />
              <h3 className="text-[14px] font-bold text-[#131B2E]">
                البيانات التعريفية والتخصيص
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-[#006242]/10 px-2 py-0.5 text-[11px] font-semibold text-[#006242]">
              {saveBadgeState === 'saved' ? '✓ تم الحفظ لحظياً' : 'حفظ تلقائي ✓ Auto-saved'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                الاسم الكامل
              </label>
              <input
                key={`${activeLead.id}-fullName`}
                type="text"
                defaultValue={activeLead.fullName}
                disabled={!canUpdateLead}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== activeLead.fullName) {
                    handleFieldSave({ fullName: val });
                  }
                }}
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                رقم الجوال الأساسي
              </label>
              <div className="relative">
                <input
                  key={`${activeLead.id}-phone`}
                  type="text"
                  dir="ltr"
                  defaultValue={activeLead.phone ?? ''}
                  disabled={!canUpdateLead}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (activeLead.phone ?? '')) {
                      handleFieldSave({ phone: val });
                    }
                  }}
                  className="w-full text-right pr-3 pl-8 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] tabular-nums focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
                />
                <MessageCircle className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#006242]" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                البريد الإلكتروني
              </label>
              <input
                key={`${activeLead.id}-email`}
                type="email"
                dir="ltr"
                defaultValue={activeLead.email ?? ''}
                disabled={!canUpdateLead}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (activeLead.email ?? '')) {
                    handleFieldSave({ email: val });
                  }
                }}
                className="w-full text-right px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                القناة المفضلة للمحادثة
              </label>
              <select
                value={activeLead.channel ?? 'whatsapp'}
                disabled={!canUpdateLead}
                onChange={(e) => handleFieldSave({ channel: e.target.value as LeadChannel })}
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              >
                {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABELS[ch]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                المدينة / الدولة
              </label>
              <input
                key={`${activeLead.id}-city`}
                type="text"
                defaultValue={activeLead.city ?? ''}
                disabled={!canUpdateLead}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (activeLead.city ?? '')) {
                    handleFieldSave({ city: val });
                  }
                }}
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                مصدر الاستقطاب الأساسي
              </label>
              <input
                key={`${activeLead.id}-source`}
                type="text"
                defaultValue={activeLead.source ?? ''}
                disabled={!canUpdateLead}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (activeLead.source ?? '')) {
                    handleFieldSave({ source: val });
                  }
                }}
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[#737686] mb-1">
                مالك السجل المسؤول
              </label>
              <select
                value={activeLead.assignedToName}
                disabled={!canUpdateLead}
                onChange={(e) => handleFieldSave({ assignedToName: e.target.value })}
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
              >
                {LEAD_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Tenant Custom Fields (FLS-aware) */}
            {leadCustomFields.map((cf) => {
              const cfAccess = getFieldAccess('leads', cf.fieldKey);
              if (cfAccess === 'hidden') return null;
              const currentVal = activeLead.customValues?.[cf.fieldKey] ?? '';
              const disabled = !canUpdateLead || cfAccess !== 'read_write';

              return (
                <div key={cf.id}>
                  <label className="flex items-center justify-between text-[11px] font-semibold text-[#737686] mb-1">
                    <span>
                      {cf.label}
                      {cf.required && <span className="text-[#BA1A1A]"> *</span>}
                    </span>
                    {cfAccess === 'read_only' && <Lock className="h-3 w-3 text-[#D97706]" />}
                  </label>

                  {cf.fieldType === 'select' && cf.options ? (
                    <select
                      value={String(currentVal)}
                      disabled={disabled}
                      onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F2F3FF] disabled:text-[#737686] disabled:cursor-not-allowed"
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
                      key={`${activeLead.id}-${cf.fieldKey}`}
                      type={
                        cf.fieldType === 'number' || cf.fieldType === 'currency'
                          ? 'number'
                          : 'text'
                      }
                      defaultValue={String(currentVal)}
                      disabled={disabled}
                      onBlur={(e) => {
                        if (e.target.value !== String(currentVal)) {
                          handleCustomFieldChange(cf.fieldKey, e.target.value);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F2F3FF] disabled:text-[#737686] disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tags Strip */}
          <div className="pt-2.5 border-t border-[#C3C6D7]/25">
            <label className="block text-[11px] font-semibold text-[#737686] mb-1.5">
              الوسوم وتصنيف العميل (Tags)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-[#737686]" />
              {(activeLead.tags ?? []).map((t, idx) => {
                const pillTone =
                  idx % 3 === 0
                    ? 'bg-[#DBE1FF] text-[#00174B]'
                    : idx % 3 === 1
                    ? 'bg-[#DAE2FD] text-[#434655]'
                    : 'bg-[#6FFBE0] text-[#002113]';
                return (
                  <span
                    key={t}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold ${pillTone}`}
                  >
                    <span>#{t}</span>
                    {canUpdateLead && (
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldSave({
                            tags: (activeLead.tags ?? []).filter((item) => item !== t),
                          })
                        }
                        aria-label={`إزالة وسم ${t}`}
                        className="hover:text-[#BA1A1A]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}

              {canUpdateLead &&
                (addingTag ? (
                  <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onBlur={() => {
                        if (!newTagInput.trim()) setAddingTag(false);
                      }}
                      placeholder="اسم الوسم..."
                      aria-label="إضافة وسم للعميل"
                      className="h-6 w-28 rounded border border-[#004AC6] bg-[#FFFFFF] px-2 text-[11px] focus:outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTag(true)}
                    className="px-2 py-0.5 rounded border border-dashed border-[#C3C6D7] text-[#737686] hover:text-[#004AC6] hover:border-[#004AC6] text-[11px] font-medium transition-colors"
                  >
                    + إضافة وسم
                  </button>
                ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-[#737686] mb-1">
              ملاحظات فريق المبيعات والتأهيل
            </label>
            <textarea
              key={`${activeLead.id}-notes`}
              rows={2}
              defaultValue={activeLead.notes ?? ''}
              disabled={!canUpdateLead}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val !== (activeLead.notes ?? '')) {
                  handleFieldSave({ notes: val });
                }
              }}
              placeholder="أضف ملاحظات المتابعة والتأهيل..."
              className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[12px] text-[#131B2E] focus:border-[#004AC6] focus:outline-none disabled:bg-[#F8FAFC]"
            />
          </div>
        </div>

        {/* Embedded Touchpoints Subform Directly Below Fields */}
        <div
          data-touchpoints-subform="true"
          className="bg-[#FFFFFF] rounded-xl border border-[#C3C6D7]/35 p-4 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#C3C6D7]/30">
            <div className="flex items-center gap-2 flex-wrap">
              <Route className="h-4 w-4 text-[#004AC6]" />
              <h3 className="text-[14px] font-bold text-[#131B2E]">
                سجل الدخول والمصادر (Touchpoints Subform)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#DBE1FF] text-[#00174B] text-[11px] font-bold tabular-nums">
                {leadTouchpoints.length} تفاعلات
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTpOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#004AC6] hover:bg-[#2563EB] text-[#FFFFFF] rounded-lg text-[11.5px] font-semibold transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>تسجيل دخول جديد</span>
            </button>
          </div>

          {tpOpen && (
            <form
              onSubmit={handleAddTouchpoint}
              className="mb-3 rounded-lg border border-[#C3C6D7]/40 bg-[#F2F3FF] p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tpChannel}
                  onChange={(e) => setTpChannel(e.target.value as TouchpointChannel)}
                  aria-label="قناة نقطة الدخول"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[12px] text-[#131B2E]"
                >
                  {TOUCHPOINT_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={tpCampaign}
                  onChange={(e) => setTpCampaign(e.target.value)}
                  placeholder="اسم الحملة الإعلانية"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[12px] text-[#131B2E]"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={tpAdId}
                  onChange={(e) => setTpAdId(e.target.value)}
                  placeholder="Ad ID (مثال: META_98421)"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[12px] tabular-nums"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={tpUtmSource}
                  onChange={(e) => setTpUtmSource(e.target.value)}
                  placeholder="UTM Source (مثال: facebook/cpc)"
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[12px]"
                />
              </div>
              <input
                type="text"
                value={tpSummary}
                onChange={(e) => setTpSummary(e.target.value)}
                placeholder="ملخص نوع التفاعل..."
                className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[12px]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTpOpen(false)}
                  className="h-7 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[11px] font-medium text-[#434655]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!tpCampaign.trim() && !tpSummary.trim()}
                  className="h-7 rounded-lg bg-[#004AC6] px-3 text-[11px] font-semibold text-[#FFFFFF] hover:bg-[#2563EB] disabled:opacity-50"
                >
                  حفظ نقطة الدخول
                </button>
              </div>
            </form>
          )}

          {leadTouchpoints.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#737686]">
              لا توجد نقاط دخول مسجلة بعد لهذا العميل.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#C3C6D7]/35">
              <table className="w-full text-right text-[11.5px] border-collapse">
                <thead className="bg-[#F2F3FF] text-[#737686] text-[11px] font-semibold border-b border-[#C3C6D7]/35">
                  <tr>
                    <th className="py-2 px-2.5 whitespace-nowrap">الوقت / التاريخ</th>
                    <th className="py-2 px-2 whitespace-nowrap">القناة</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">الحملة / الإعلان</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">نوع التفاعل</th>
                    <th className="py-2 px-2 whitespace-nowrap">UTM Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C3C6D7]/20 bg-[#FFFFFF]">
                  {leadTouchpoints.map((tp) => (
                    <tr key={tp.id} className="hover:bg-[#F2F3FF]/60 transition-colors">
                      <td className="py-2 px-2.5 text-[#131B2E] whitespace-nowrap tabular-nums">
                        {tp.occurredAt}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EAEDFF] text-[#004AC6] text-[10.5px] font-bold">
                          {tp.channel}
                        </span>
                      </td>
                      <td
                        className="py-2 px-2.5 text-[#131B2E] font-medium truncate max-w-[135px]"
                        title={tp.campaign || tp.summary}
                      >
                        {tp.campaign || tp.summary}
                      </td>
                      <td className="py-2 px-2.5 text-[#004AC6] font-medium truncate max-w-[125px]">
                        {tp.eventType || 'نقطة اتصال'}
                      </td>
                      <td
                        className="py-2 px-2 font-mono text-[10.5px] text-[#737686] truncate max-w-[85px]"
                        dir="ltr"
                      >
                        {tp.utmSource || tp.adId || 'direct'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 3. LEFT COLUMN (32% width — Unified Meta Omnichannel Chat, Pinned Composer) */}
      <aside
        data-split-pane="chat"
        className="w-full lg:w-[32%] bg-[#FFFFFF] flex flex-col h-[520px] lg:h-full shrink-0 overflow-hidden"
      >
        {/* Chat Header & Channel Tabs */}
        <div className="shrink-0 p-3 pb-0 border-b border-[#C3C6D7]/35 bg-[#FFFFFF]">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-5 w-5 text-[#004AC6] shrink-0" />
              <h3 className="text-[13.5px] font-bold text-[#131B2E] truncate">
                صندوق المحادثات الموحد
              </h3>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#6FFBE0] text-[#002113] text-[11px] font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006242] animate-pulse" />
              <span>نافذة الرد نشطة</span>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="تصفية المحادثة حسب القناة"
            className="flex items-center gap-1 pt-0.5"
          >
            {CHAT_TABS.map((tab) => {
              const active = chatTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setChatTab(tab.id);
                    if (tab.id !== 'all') {
                      setChatChannel(tab.id);
                    }
                  }}
                  className={`pb-2.5 px-2.5 text-[11.5px] transition-colors border-b-2 whitespace-nowrap ${
                    active
                      ? 'text-[#004AC6] font-bold border-[#004AC6]'
                      : 'text-[#737686] font-medium border-transparent hover:text-[#131B2E]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Chat History */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 bg-[#F2F3FF]/45">
          {/* Meta Ad Origin Divider & Referral Banner */}
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#C3C6D7]/40 text-[#737686] text-[11px] font-medium shadow-2xs">
              قادم من {activeLead.source || 'إعلان ميتا الممول'}
            </span>
          </div>

          <div className="rounded-xl border border-[#C3C6D7]/40 bg-[#E2E7FF]/75 px-3 py-2 text-[11px] text-[#434655] flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#004AC6] shrink-0" />
            <span className="truncate font-semibold">
              إعلان ميتا: {activeLead.campaign || activeLead.source || 'حملة استقطاب مباشر'}
            </span>
          </div>

          {leadMessages.length === 0 ? (
            <div className="rounded-xl border border-[#C3C6D7]/40 bg-[#FFFFFF] p-3 text-[12px] text-[#131B2E] shadow-2xs space-y-1">
              <p>{activeLead.lastMessageSnippet || 'بدأت المحادثة عبر القنوات الموحدة.'}</p>
              <div className="flex items-center justify-end text-[10px] text-[#737686]">
                <span>{activeLead.lastActivityLabel || 'الآن'} · {CHANNEL_LABELS[activeLead.channel ?? 'whatsapp']}</span>
              </div>
            </div>
          ) : (
            [...leadMessages].reverse().map((msg) => {
              const outbound = msg.direction === 'outbound';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[88%] ${
                    outbound ? 'ml-0 mr-auto items-end' : 'mr-0 items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-[12px] space-y-1.5 shadow-2xs ${
                      outbound
                        ? 'bg-[#004AC6] text-[#FFFFFF] rounded-tr-xs'
                        : 'bg-[#FFFFFF] border border-[#C3C6D7]/40 text-[#131B2E] rounded-tl-xs'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.body}</p>
                    <div
                      className={`flex items-center gap-1 text-[10px] ${
                        outbound ? 'text-[#FFFFFF]/80 justify-start' : 'text-[#737686] justify-end'
                      }`}
                    >
                      {outbound && <CheckCheck className="h-3.5 w-3.5" />}
                      <span className="tabular-nums">{msg.timestampLabel}</span>
                      <span>· {outbound ? msg.senderName : INBOX_CHANNEL_LABELS[msg.channel]}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Bottom Reply Composer + "/" Quick Reply Snippet Pills */}
        <div
          data-split-composer="true"
          className="shrink-0 p-3 bg-[#FFFFFF] border-t border-[#C3C6D7]/35 space-y-2"
        >
          {showSlashPalette && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-lg space-y-1">
              <p className="px-2 py-0.5 text-[10.5px] font-semibold text-[#737686]">
                قوالب الرد السريع (/)
              </p>
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.command}
                  type="button"
                  onClick={() => setChatText(qr.template)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-[11.5px] hover:bg-[#EAEDFF]"
                >
                  <span className="font-bold text-[#004AC6]">{qr.command}</span>
                  <span className="text-[#434655]">{qr.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* "/" Quick Reply Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-semibold">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr.command}
                type="button"
                onClick={() => setChatText(qr.template)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2F3FF] text-[#004AC6] hover:bg-[#DBE1FF] border border-[#C3C6D7]/40 whitespace-nowrap transition-colors shrink-0"
              >
                <span>{qr.emoji}</span>
                <span>{qr.command}</span>
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSendChat}
            className="border border-[#C3C6D7]/65 rounded-xl bg-[#FFFFFF] focus-within:border-[#004AC6] focus-within:ring-1 focus-within:ring-[#004AC6] transition-all p-2"
          >
            <textarea
              rows={2}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendChat();
                }
              }}
              placeholder="اكتب رداً سريعاً أو اضغط '/' لاختيار قالب معتمد..."
              aria-label="نص الرسالة في العرض المقسم"
              className="w-full bg-transparent resize-none text-[12px] text-[#131B2E] placeholder:text-[#737686] focus:outline-none"
            />
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#C3C6D7]/25">
              <select
                value={chatChannel}
                onChange={(e) => setChatChannel(e.target.value as InboxMessage['channel'])}
                aria-label="قناة الإرسال"
                className="h-7 rounded-lg border border-[#C3C6D7]/50 bg-[#F2F3FF] px-2 text-[11px] font-medium text-[#131B2E] focus:outline-none"
              >
                <option value="whatsapp">واتساب</option>
                <option value="instagram">إنستغرام</option>
                <option value="messenger">ماسنجر</option>
              </select>

              <button
                type="submit"
                disabled={!chatText.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#004AC6] hover:bg-[#2563EB] text-[#FFFFFF] rounded-lg text-[12px] font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <span>إرسال</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
};
