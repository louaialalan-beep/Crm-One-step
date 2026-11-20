import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  Send,
  Tag,
  Trash2,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type {
  CrmTask,
  InboxMessage,
  Lead,
  LeadChannel,
  LeadStatus,
  TouchpointChannel,
} from '../types/crm';
import { ConvertLeadModal } from '../components/leads/ConvertLeadModal';
import { getArabicInitials } from '../components/leads/LeadChannelIcon';
import { CHANNEL_LABELS, LEAD_OWNERS } from '../utils/leadsLogic';

const BLUEPRINT_STEPS: LeadStatus[] = ['جديد', 'تم التواصل', 'مؤهل للتحويل'];

const QUICK_REPLIES: Array<{ command: string; label: string; template: string }> = [
  {
    command: '/عرض_سعر',
    label: 'عرض سعر مخصص',
    template:
      'أهلاً بكم، مرفق تفاصيل باقة رواق CRM المؤسسية شاملة ربط قنوات واتساب الأعمال وتكامل API. هل يناسبكم اعتماد العرض غداً؟',
  },
  {
    command: '/حجز_موعد',
    label: 'حجز موعد عرض حي (Demo)',
    template:
      'يسعدنا ترتيب جلسة عرض حي لمنصة رواق مع فريقكم المختص. يرجى تزويدنا بالوقت المناسب لكم غداً بين 10:00 صباحاً و 04:00 عصراً.',
  },
  {
    command: '/ترحيب',
    label: 'ترحيب مخصص وجمع المتطلبات',
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

const TOUCHPOINT_BADGE_STYLE: Record<TouchpointChannel, string> = {
  واتساب: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  إنستغرام: 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]',
  'موقع ويب': 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
  مكالمة: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  اجتماع: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]',
  'بريد إلكتروني': 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]',
  حدث: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]',
};

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    leads,
    users,
    blueprints,
    quickReplies,
    customFields,
    touchpoints,
    messages,
    tasks,
    activeProfile,
    getFieldAccess,
    updateLeadFields,
    addLeadTouchpoint,
    addLeadTask,
    toggleTaskStatus,
    sendInboxReply,
    openInboxForLead,
    softDeleteLeads,
    currentOrgId,
  } = useCrm();

  const [activeTimelineTab, setActiveTimelineTab] = useState<'touchpoints' | 'email'>('touchpoints');

  const lead = useMemo(
    () => leads.find((l) => l.id === id || l.unique_id === id) ?? null,
    [id, leads]
  );

  const activeLeadOwners = useMemo(() => {
    const activeNames = users.filter((u) => u.status === 'active').map((u) => u.fullName);
    const list = activeNames.length > 0 ? activeNames : LEAD_OWNERS;
    return lead?.assignedToName ? Array.from(new Set([lead.assignedToName, ...list])) : list;
  }, [lead?.assignedToName, users]);

  const activeBlueprintSteps = useMemo<LeadStatus[]>(() => {
    const leadBp = blueprints.find(
      (bp) => bp.active && (bp.module.includes('العملاء') || bp.module.toLowerCase().includes('lead'))
    );
    if (leadBp?.stageSteps && leadBp.stageSteps.length > 0) {
      return leadBp.stageSteps as LeadStatus[];
    }
    return BLUEPRINT_STEPS;
  }, [blueprints]);

  const activeQuickReplies = useMemo(() => {
    const filtered = (quickReplies ?? []).filter(
      (qr) => !qr.module || qr.module === 'all' || qr.module === 'leads'
    );
    return filtered.length > 0 ? filtered : QUICK_REPLIES;
  }, [quickReplies]);

  const canUpdateLead = activeProfile?.modulePermissions?.leads?.update ?? true;
  const canDeleteLead = activeProfile?.modulePermissions?.leads?.delete ?? true;

  const [copiedId, setCopiedId] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const [tpFormOpen, setTpFormOpen] = useState(false);
  const [tpChannel, setTpChannel] = useState<TouchpointChannel>('واتساب');
  const [tpCampaign, setTpCampaign] = useState('');
  const [tpAdId, setTpAdId] = useState('');
  const [tpUtmSource, setTpUtmSource] = useState('');
  const [tpSummary, setTpSummary] = useState('');

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<CrmTask['priority']>('عالية');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-18');

  const [chatText, setChatText] = useState('');
  const [chatChannel, setChatChannel] = useState<InboxMessage['channel']>('whatsapp');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
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
    if (!lead) return;
    if (
      lead.channel === 'whatsapp' ||
      lead.channel === 'instagram' ||
      lead.channel === 'messenger'
    ) {
      setChatChannel(lead.channel);
    }
  }, [lead]);

  const leadCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'leads')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const leadTouchpoints = useMemo(() => {
    if (!lead) return [];
    return touchpoints.filter(
      (tp) =>
        tp.leadId === lead.id ||
        (Boolean(tp.leadUniqueId) && tp.leadUniqueId === lead.unique_id) ||
        (tp.relatedEntityType === 'lead' && tp.relatedEntityId === lead.id)
    );
  }, [lead, touchpoints]);

  const leadTasks = useMemo(() => {
    if (!lead) return [];
    return tasks.filter(
      (t) =>
        t.leadId === lead.id ||
        (Boolean(t.leadUniqueId) && t.leadUniqueId === lead.unique_id)
    );
  }, [lead, tasks]);

  const leadMessages = useMemo(() => {
    if (!lead) return [];
    return messages.filter(
      (m) =>
        m.leadId === lead.id ||
        (Boolean(m.leadUniqueId) && m.leadUniqueId === lead.unique_id) ||
        m.senderName === lead.fullName
    );
  }, [lead, messages]);

  if (!lead) {
    return (
      <div className="card-surface rounded-lg bg-[#FFFFFF] p-10 text-center space-y-3">
        <p className="text-[16px] font-bold text-[#0F172A]">لم يتم العثور على ملف العميل المحتمل</p>
        <p className="text-[13px] text-[#64748B]">
          قد يكون تم نقله إلى سلة المحذوفات أو حذفه نهائياً.
        </p>
        <Link
          to="/leads"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8]"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى قائمة العملاء المحتملين</span>
        </Link>
      </div>
    );
  }

  const openTasksCount = leadTasks.filter((t) => t.status !== 'مكتملة').length;

  const triggerAutoSaveIndicator = () => {
    setAutoSavedAt(true);
    window.setTimeout(() => setAutoSavedAt(false), 2000);
  };

  const handleFieldSave = (patch: Partial<Lead>) => {
    if (!canUpdateLead) return;
    void updateLeadFields(lead.id, patch);
    triggerAutoSaveIndicator();
  };

  const handleCustomFieldChange = (fieldKey: string, value: string | number | boolean) => {
    if (!canUpdateLead) return;
    void updateLeadFields(lead.id, {
      customValues: {
        ...(lead.customValues ?? {}),
        [fieldKey]: value,
      },
    });
    triggerAutoSaveIndicator();
  };

  const handleCopyUniqueId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(lead.unique_id);
    }
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1800);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagText.trim().replace(/^#/, '');
    if (!clean || !canUpdateLead) return;
    const nextTags = Array.from(new Set([...(lead.tags ?? []), clean])).slice(0, 20);
    handleFieldSave({ tags: nextTags });
    setNewTagText('');
    setAddingTag(false);
  };

  const handleAddTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpCampaign.trim() && !tpSummary.trim()) return;
    await addLeadTouchpoint(lead.id, {
      channel: tpChannel,
      eventType: 'دخول إعلان / تفاعل',
      campaign: tpCampaign.trim() || lead.source || 'حملة مباشرة',
      adId: tpAdId.trim() || undefined,
      utmSource: tpUtmSource.trim() || undefined,
      summary: tpSummary.trim() || `تسجيل نقطة دخول عبر ${tpChannel}`,
    });
    setTpCampaign('');
    setTpAdId('');
    setTpUtmSource('');
    setTpSummary('');
    setTpFormOpen(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await addLeadTask(lead.id, {
      title: taskTitle.trim(),
      priority: taskPriority,
      dueDate: taskDueDate,
      assignedToName: lead.assignedToName,
    });
    setTaskTitle('');
    setTaskFormOpen(false);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    await sendInboxReply(chatChannel, lead.fullName, chatText, {
      leadId: lead.id,
      leadUniqueId: lead.unique_id,
      companyName: lead.city || lead.source,
    });
    setChatText('');
  };

  const showSlashPalette = chatText.trim().startsWith('/');

  return (
    <div className="space-y-4 pb-10">
      {toastBanner && (
        <div className="flex items-center justify-between rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[13px] font-medium text-[#065F46]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#059669]" />
            <span>{toastBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-[12px] font-semibold hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* TOP FLUSH HEADER CARD */}
      <header className="card-surface rounded-lg bg-[#FFFFFF] px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Right Side (RTL start): Back breadcrumb, Initials, Name, Copyable ID, AI Score, Tags */}
          <div className="space-y-2 min-w-0">
            <Link
              to="/leads"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#2563EB]"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>العملاء المحتملين</span>
            </Link>

            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-[15px] font-bold text-[#FFFFFF]">
                {getArabicInitials(lead.fullName)}
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight">
                    {lead.fullName}
                  </h1>

                  <button
                    type="button"
                    onClick={handleCopyUniqueId}
                    title="اضغط لنسخ المعرف الفريد"
                    aria-label={`نسخ معرف العميل ${lead.unique_id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-bold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB] tabular-nums"
                  >
                    <span>ID: {lead.unique_id}</span>
                    {copiedId ? (
                      <Check className="h-3 w-3 text-[#059669]" />
                    ) : (
                      <Copy className="h-3 w-3 text-[#64748B]" />
                    )}
                  </button>

                  <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669] tabular-nums">
                    <Flame className="h-3 w-3 text-[#F59E0B]" />
                    <span>{lead.aiScore}% ساخن</span>
                  </span>

                  {lead.converted && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>تم التحويل بنجاح</span>
                    </span>
                  )}
                </div>

                {/* Tags Row Directly Below Name */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(lead.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5]"
                    >
                      #{t}
                      {canUpdateLead && (
                        <button
                          type="button"
                          onClick={() =>
                            handleFieldSave({
                              tags: (lead.tags ?? []).filter((item) => item !== t),
                            })
                          }
                          aria-label={`إزالة وسم ${t}`}
                          className="text-[#6366F1] hover:text-[#E11D48]"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}

                  {canUpdateLead && !addingTag && (
                    <button
                      type="button"
                      onClick={() => setAddingTag(true)}
                      className="inline-flex items-center gap-1 rounded border border-dashed border-[#CBD5E1] bg-[#FFFFFF] px-2 py-0.5 text-[11px] font-medium text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]"
                    >
                      <Plus className="h-3 w-3" />
                      <span>إضافة وسم</span>
                    </button>
                  )}

                  {canUpdateLead && addingTag && (
                    <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onBlur={() => {
                          if (!newTagText.trim()) setAddingTag(false);
                        }}
                        placeholder="اسم الوسم..."
                        className="input-control h-6 w-28 px-2 text-[11px]"
                      />
                      <button
                        type="submit"
                        className="h-6 rounded bg-[#2563EB] px-2 text-[11px] font-semibold text-[#FFFFFF]"
                      >
                        حفظ
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Left Side (RTL end): Primary Convert CTA, Full Chat, Quick Task, Overflow Menu */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {!lead.converted && (
                <button
                  type="button"
                  onClick={() => setConvertOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  <Zap className="h-4 w-4" />
                  <span>تحويل العميل (Convert Lead)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openInboxForLead(lead.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#059669] px-3.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#047857] whitespace-nowrap"
              >
                <MessageSquare className="h-4 w-4" />
                <span>محادثة كاملة</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTaskFormOpen(true);
                  window.setTimeout(() => taskInputRef.current?.focus(), 60);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5 text-[#64748B]" />
                <span>مهمة / اتصال</span>
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((prev) => !prev)}
                  aria-label="خيارات إضافية لملف العميل"
                  aria-expanded={actionsMenuOpen}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#CBD5E1] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC]"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {actionsMenuOpen && (
                  <div className="flyout-surface absolute left-0 top-9 z-30 w-48 rounded-lg py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        handleCopyUniqueId();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      <Copy className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span>نسخ المعرف {lead.unique_id}</span>
                    </button>
                    {canDeleteLead && (
                      <button
                        type="button"
                        onClick={async () => {
                          setActionsMenuOpen(false);
                          await softDeleteLeads([lead.id]);
                          navigate('/leads');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-right text-[12px] text-[#E11D48] hover:bg-[#FFF1F2]"
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

        {/* Blueprint Stage Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeBlueprintSteps.map((step, idx) => {
              const currentIdx = activeBlueprintSteps.indexOf(lead.status);
              const isCurrent = lead.status === step;
              const isDone = currentIdx > idx;

              return (
                <React.Fragment key={step}>
                  <button
                    type="button"
                    disabled={!canUpdateLead}
                    onClick={() => handleFieldSave({ status: step })}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-colors ${
                      isCurrent
                        ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                        : isDone
                        ? 'border-[#A7F3D0] bg-[#FFFFFF] text-[#059669]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:border-[#CBD5E1]'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-[#FFFFFF]" />
                    ) : null}
                    <span className="tabular-nums">{idx + 1}.</span>
                    <span>{step}</span>
                  </button>
                  {idx < activeBlueprintSteps.length - 1 && (
                    <span className="text-[#94A3B8] text-[12px]" aria-hidden="true">
                      ‹
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canUpdateLead}
            onClick={() => handleFieldSave({ status: 'غير مهتم' })}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${
              lead.status === 'غير مهتم'
                ? 'border border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                : 'text-[#E11D48] hover:bg-[#FFF1F2]'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>غير مهتم / استبعاد العميل</span>
          </button>
        </div>
      </header>

      {/* MAIN 2-COLUMN BODY (65% Right Main / 35% Left Action) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* RIGHT MAIN COLUMN (65% -> 8 cols in 12-col RTL grid) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Card 1: Basic Info & Contact Fields */}
          <section className="card-surface rounded-lg bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]">
                  <User className="h-4 w-4" />
                </span>
                <h2 className="text-[15px] font-bold text-[#0F172A]">
                  البيانات الأساسية ومعلومات التواصل
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669]">
                <Check className="h-3.5 w-3.5" />
                <span>{autoSavedAt ? 'تم الحفظ تلقائياً الآن' : 'حفظ تلقائي'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  الاسم الكامل
                </label>
                <input
                  key={`${lead.id}-fullName`}
                  type="text"
                  defaultValue={lead.fullName}
                  disabled={!canUpdateLead}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== lead.fullName) {
                      handleFieldSave({ fullName: e.target.value.trim() });
                    }
                  }}
                  className="input-control h-10 w-full bg-[#F8FAFC] px-3 text-[13px] font-semibold text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                />
              </div>

              {/* Direct Mobile Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  رقم الجوال المباشر
                </label>
                <div className="relative flex items-center">
                  <Phone className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-[#64748B]" />
                  <input
                    key={`${lead.id}-phone`}
                    type="text"
                    dir="ltr"
                    defaultValue={lead.phone ?? ''}
                    disabled={!canUpdateLead}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.phone ?? '')) {
                        handleFieldSave({ phone: e.target.value.trim() });
                      }
                    }}
                    className="input-control h-10 w-full bg-[#F8FAFC] pr-9 pl-3 text-[13px] font-medium text-[#0F172A] tabular-nums focus:bg-[#FFFFFF] disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  البريد الإلكتروني المهني
                </label>
                <div className="relative flex items-center">
                  <Mail className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-[#64748B]" />
                  <input
                    key={`${lead.id}-email`}
                    type="email"
                    dir="ltr"
                    defaultValue={lead.email ?? ''}
                    disabled={!canUpdateLead}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.email ?? '')) {
                        handleFieldSave({ email: e.target.value.trim() });
                      }
                    }}
                    className="input-control h-10 w-full bg-[#F8FAFC] pr-9 pl-3 text-[13px] text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Preferred Channel */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  القناة المفضلة للتواصل
                </label>
                <div className="flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 h-10">
                  <select
                    value={lead.channel ?? 'whatsapp'}
                    disabled={!canUpdateLead}
                    onChange={(e) => handleFieldSave({ channel: e.target.value as LeadChannel })}
                    className="flex-1 bg-transparent text-[13px] font-medium text-[#0F172A] focus:outline-none"
                  >
                    {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                      <option key={ch} value={ch}>
                        {CHANNEL_LABELS[ch]}
                      </option>
                    ))}
                  </select>
                  <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#059669]">
                    مباشر
                  </span>
                </div>
              </div>

              {/* City / Country */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  المدينة / الدولة
                </label>
                <div className="relative flex items-center">
                  <MapPin className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-[#64748B]" />
                  <input
                    key={`${lead.id}-city`}
                    type="text"
                    defaultValue={lead.city ?? ''}
                    disabled={!canUpdateLead}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.city ?? '')) {
                        handleFieldSave({ city: e.target.value.trim() });
                      }
                    }}
                    className="input-control h-10 w-full bg-[#F8FAFC] pr-9 pl-3 text-[13px] text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Record Owner */}
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  مالك السجل
                </label>
                <div className="flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 h-10">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-[#FFFFFF]">
                    {lead.assignedToName.trim()[0] ?? 'س'}
                  </span>
                  <select
                    value={lead.assignedToName}
                    disabled={!canUpdateLead}
                    onChange={(e) => handleFieldSave({ assignedToName: e.target.value })}
                    className="flex-1 bg-transparent text-[13px] font-semibold text-[#0F172A] focus:outline-none"
                  >
                    {activeLeadOwners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </div>
              </div>

              {/* Primary Acquisition Source */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  مصدر الاستقطاب الأساسي
                </label>
                <div className="relative flex items-center">
                  <Megaphone className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-[#2563EB]" />
                  <input
                    key={`${lead.id}-source`}
                    type="text"
                    defaultValue={lead.source ?? ''}
                    disabled={!canUpdateLead}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.source ?? '')) {
                        handleFieldSave({ source: e.target.value.trim() });
                      }
                    }}
                    className="input-control h-10 w-full bg-[#F8FAFC] pr-9 pl-3 text-[13px] text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Tenant Custom Fields (FLS-aware) */}
              {leadCustomFields.map((cf) => {
                const access = getFieldAccess('leads', cf.fieldKey);
                if (access === 'hidden') return null;
                const currentVal = lead.customValues?.[cf.fieldKey] ?? '';
                const disabled = !canUpdateLead || access !== 'read_write';

                return (
                  <div key={cf.id}>
                    <label className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1">
                      <span>
                        {cf.label}
                        {cf.required && <span className="text-[#F43F5E]"> *</span>}
                      </span>
                      {access === 'read_only' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#D97706]">
                          <Lock className="h-2.5 w-2.5" /> للقراءة فقط
                        </span>
                      )}
                    </label>
                    {cf.fieldType === 'select' && cf.options ? (
                      <select
                        value={String(currentVal)}
                        disabled={disabled}
                        onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                        className="input-control h-10 w-full bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
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
                        key={`${lead.id}-${cf.fieldKey}`}
                        type={cf.fieldType === 'number' ? 'number' : 'text'}
                        defaultValue={String(currentVal)}
                        disabled={disabled}
                        onBlur={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                        className="input-control h-10 w-full bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                      />
                    )}
                  </div>
                );
              })}

              {/* Internal Notes */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  الملاحظات والتوجيهات الداخلية
                </label>
                <textarea
                  key={`${lead.id}-notes`}
                  rows={3}
                  defaultValue={lead.notes ?? ''}
                  disabled={!canUpdateLead}
                  onBlur={(e) => {
                    if (e.target.value !== (lead.notes ?? '')) {
                      handleFieldSave({ notes: e.target.value.trim() });
                    }
                  }}
                  placeholder="أضف ملاحظات المتابعة والتوجيهات الداخلية للفريق..."
                  className="input-control w-full bg-[#F8FAFC] p-3 text-[13px] leading-relaxed text-[#0F172A] focus:bg-[#FFFFFF] disabled:opacity-70"
                />
              </div>
            </div>
          </section>

          {/* Card 2: Touchpoints Subform Table */}
          <section className="card-surface rounded-lg bg-[#FFFFFF] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]">
                  <Tag className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[#0F172A]">
                    نقاط الدخول وسجل الحملات الإعلانية
                  </h2>
                  <p className="text-[11px] text-[#64748B]">
                    Multi-Touch Attribution Matrix · {leadTouchpoints.length} نقاط دخول
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTpFormOpen((prev) => !prev)}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>تسجيل دخول جديد</span>
              </button>
            </div>

            {tpFormOpen && (
              <form
                onSubmit={handleAddTouchpoint}
                className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5"
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                  <select
                    value={tpChannel}
                    onChange={(e) => setTpChannel(e.target.value as TouchpointChannel)}
                    className="input-control h-8 px-2 text-[12px]"
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
                    className="input-control h-8 px-2.5 text-[12px]"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={tpAdId}
                    onChange={(e) => setTpAdId(e.target.value)}
                    placeholder="Ad ID (ad_89214)"
                    className="input-control h-8 px-2.5 text-[12px] tabular-nums"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={tpUtmSource}
                    onChange={(e) => setTpUtmSource(e.target.value)}
                    placeholder="مصدر UTM (meta_lead_ad)"
                    className="input-control h-8 px-2.5 text-[12px]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={tpSummary}
                    onChange={(e) => setTpSummary(e.target.value)}
                    placeholder="ملخص التفاعل أو رابط الصفحة..."
                    className="input-control h-8 flex-1 min-w-[200px] px-2.5 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => setTpFormOpen(false)}
                    className="h-8 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!tpCampaign.trim() && !tpSummary.trim()}
                    className="h-8 rounded bg-[#2563EB] px-3 text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    حفظ نقطة الدخول
                  </button>
                </div>
              </form>
            )}

            {leadTouchpoints.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#64748B]">
                لا توجد نقاط دخول مسجلة بعد لهذا العميل.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[12px] font-semibold text-[#64748B]">
                      <th className="px-4 py-2.5 whitespace-nowrap">التاريخ والوقت</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">القناة</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">اسم الحملة الإعلانية</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">معرف الإعلان (Ad ID)</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">مصدر UTM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {leadTouchpoints.map((tp) => {
                      const badgeCls =
                        TOUCHPOINT_BADGE_STYLE[tp.channel] ??
                        'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]';
                      return (
                        <tr key={tp.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 whitespace-nowrap text-[#475569] tabular-nums">
                            {tp.occurredAt}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              <span>{tp.channel}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-[#0F172A]">
                            {tp.campaign || tp.summary}
                          </td>
                          <td
                            className="px-3 py-3 font-mono text-[12px] text-[#64748B] tabular-nums"
                            dir="ltr"
                          >
                            {tp.adId || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-[12px] text-[#64748B]" dir="ltr">
                            {tp.utmSource || 'direct'}
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

        {/* LEFT ACTION COLUMN (35% -> 4 cols): Tasks TOP + WhatsApp/Meta Live Chat BELOW */}
        <div className="lg:col-span-4 space-y-4">
          {/* TOP CARD: Upcoming Tasks & Activities */}
          <section className="card-surface rounded-lg bg-[#FFFFFF] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-[#0F172A]">المهام والأنشطة القادمة</h2>
                <span className="rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] tabular-nums">
                  {openTasksCount} نشطة
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTaskFormOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة مهمة</span>
              </button>
            </div>

            {taskFormOpen && (
              <form
                onSubmit={handleAddTask}
                className="rounded-md border border-[#BFDBFE] bg-[#F8FAFC] p-3 space-y-2"
              >
                <input
                  ref={taskInputRef}
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="عنوان مهمة المتابعة..."
                  className="input-control h-8 w-full px-2.5 text-[12px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as CrmTask['priority'])}
                    className="input-control h-8 px-2 text-[12px]"
                  >
                    <option value="عالية">أولوية عالية</option>
                    <option value="متوسطة">أولوية متوسطة</option>
                    <option value="منخفضة">أولوية منخفضة</option>
                  </select>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="input-control h-8 px-2 text-[12px] tabular-nums"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskFormOpen(false)}
                    className="h-7 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[11px] font-medium text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!taskTitle.trim()}
                    className="h-7 rounded bg-[#2563EB] px-3 text-[11px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    حفظ المهمة
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {leadTasks.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#E2E8F0] p-4 text-center text-[12px] text-[#64748B]">
                  لا توجد مهام مجدولة لهذا العميل حالياً.
                </p>
              ) : (
                leadTasks.map((task) => {
                  const done = task.status === 'مكتملة';
                  const priorityBadge =
                    task.priority === 'عالية'
                      ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                      : task.priority === 'متوسطة'
                      ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]'
                      : 'border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]';

                  return (
                    <div
                      key={task.id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]/70 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => void toggleTaskStatus(task.id)}
                          aria-label={`تحديد المهمة ${task.title}`}
                          className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p
                            className={`text-[13px] font-semibold leading-snug ${
                              done ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 text-[#64748B] tabular-nums">
                              <Clock className="h-3 w-3" />
                              {task.dueDate}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${priorityBadge}`}
                            >
                              أولوية {task.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void toggleTaskStatus(task.id)}
                          className={`inline-flex h-7 items-center gap-1 rounded border px-2.5 text-[11px] font-semibold transition-colors ${
                            done
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                              : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]'
                          }`}
                        >
                          <span>{done ? 'مكتملة ✓' : 'إكمال بنقرة ✓'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* BOTTOM CARD: Direct WhatsApp / Meta Chat */}
          <section className="card-surface rounded-lg bg-[#FFFFFF] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] shrink-0" />
                <h2 className="text-[13px] font-bold text-[#0F172A] truncate">
                  محادثة واتساب/ميتا المباشرة
                </h2>
              </div>
              <button
                type="button"
                onClick={() => openInboxForLead(lead.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] shrink-0"
              >
                <span>المحادثة الكاملة</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {/* Conversation Stream */}
            <div className="max-h-[340px] min-h-[210px] overflow-y-auto p-3.5 space-y-3 bg-[#F8FAFC]/60">
              {leadMessages.length === 0 ? (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 text-[12px] text-[#475569]">
                  {lead.lastMessageSnippet ||
                    'لا توجد رسائل مسجلة بعد — أرسل ردك الأول من الأسفل أو اختر أحد قوالب "/".'}
                </div>
              ) : (
                [...leadMessages].reverse().map((msg) => {
                  const outbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${outbound ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                          outbound
                            ? 'bg-[#2563EB] text-[#FFFFFF]'
                            : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]'
                        }`}
                      >
                        <p>{msg.body}</p>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#64748B] tabular-nums">
                        {outbound && <CheckCheck className="h-3 w-3 text-[#2563EB]" />}
                        <span>{msg.timestampLabel}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Reply Chips + Composer */}
            <div className="border-t border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-2">
              {showSlashPalette && (
                <div className="flyout-surface rounded-md p-1.5 space-y-1">
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

              <div className="flex flex-wrap items-center gap-1.5">
                {activeQuickReplies.map((qr) => (
                  <button
                    key={qr.command}
                    type="button"
                    onClick={() => setChatText(qr.template)}
                    className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    {qr.command}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex items-center gap-2">
                <select
                  value={chatChannel}
                  onChange={(e) => setChatChannel(e.target.value as InboxMessage['channel'])}
                  aria-label="قناة الرد المباشر"
                  className="input-control h-9 px-2 text-[11px] shrink-0"
                >
                  <option value="whatsapp">واتساب</option>
                  <option value="instagram">إنستغرام</option>
                  <option value="messenger">ماسنجر</option>
                </select>
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="اكتب رداً سريعاً ومباشراً عبر واتساب..."
                  aria-label="اكتب رداً سريعاً"
                  className="input-control h-9 flex-1 min-w-0 px-3 text-[12px]"
                />
                <button
                  type="submit"
                  disabled={!chatText.trim()}
                  aria-label="إرسال الرد"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#059669] text-[#FFFFFF] hover:bg-[#047857] disabled:opacity-50 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* Convert Lead Modal */}
      <ConvertLeadModal
        lead={convertOpen ? lead : null}
        onClose={() => setConvertOpen(false)}
        onConverted={({ lead: convertedLead, dealId }) => {
          setToastBanner(
            dealId
              ? `تم تحويل العميل (${convertedLead.unique_id}) إلى جهة اتصال وحساب وصفقة جديدة مع ترحيل كافة نقاط التماس.`
              : `تم تحويل العميل (${convertedLead.unique_id}) إلى جهة اتصال مع ترحيل كافة نقاط التماس.`
          );
        }}
      />
    </div>
  );
};
