import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  Camera,
  Check,
  Clock,
  Globe,
  GripVertical,
  Link2,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  Phone,
  Plus,
  Send,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import type {
  Contact,
  ContactStatus,
  Deal,
  LeadChannel,
  Touchpoint,
} from '../../types/crm';
import {
  CONTACT_STATUSES,
  formatCompactDealValue,
  getContactOwnerName,
  getDealsForContact,
  resolveContactStatus,
} from '../../utils/contactsLogic';
import { formatCurrencySAR } from '../../utils/formatters';
import { getArabicInitials } from '../leads/LeadChannelIcon';

interface ContactsKanbanViewProps {
  contacts: Contact[];
  deals: Deal[];
  touchpoints: Touchpoint[];
  selectedIds: string[];
  duplicateReasons: Map<string, string>;
  canUpdateContact: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectStage?: (contactIds: string[], select: boolean) => void;
  onChangeStatus: (contactId: string, status: ContactStatus) => void;
  onOpenSplitView: (contactId: string) => void;
  onQuickChat: (contactId: string) => void;
  onQuickCall?: (contact: Contact) => void;
  onOpenCreateDeal: (contact: Contact) => void;
  onOpenCreateContact?: () => void;
}

interface StatusMeta {
  title: string;
  accentBar: string;
  countBadge: string;
  flowBadge: string;
}

const STATUS_META: Record<ContactStatus, StatusMeta> = {
  'عميل نشط': {
    title: 'عميل نشط',
    accentBar: 'bg-[#2563EB]',
    countBadge: 'bg-[#dbe1ff] text-[#004ac6]',
    flowBadge: 'bg-[#dbe1ff] text-[#004ac6]',
  },
  'بانتظار عرض سعر': {
    title: 'بانتظار عرض سعر',
    accentBar: 'bg-[#4648D4]',
    countBadge: 'bg-[#e1e0ff] text-[#07006c]',
    flowBadge: 'bg-[#e1e0ff] text-[#07006c]',
  },
  'عميل متكرر (VIP)': {
    title: 'عميل متكرر (VIP)',
    accentBar: 'bg-[#006242]',
    countBadge: 'bg-[#6ffbbe] text-[#002113]',
    flowBadge: 'bg-[#6ffbbe] text-[#002113]',
  },
  'متوقف / غير نشط': {
    title: 'متوقف / غير نشط',
    accentBar: 'bg-[#737686]',
    countBadge: 'bg-[#ffdad6] text-[#93000a]',
    flowBadge: 'bg-[#ffdad6] text-[#93000a]',
  },
};

function renderStatusHeaderIcon(status: ContactStatus) {
  if (status === 'عميل نشط') return <UserCheck className="h-[18px] w-[18px] text-[#2563EB] shrink-0" />;
  if (status === 'بانتظار عرض سعر')
    return <Clock className="h-[18px] w-[18px] text-[#4648D4] shrink-0" />;
  if (status === 'عميل متكرر (VIP)')
    return <Award className="h-[18px] w-[18px] text-[#006242] shrink-0" />;
  return <PauseCircle className="h-[18px] w-[18px] text-[#737686] shrink-0" />;
}

function renderChannelPill(channel?: LeadChannel) {
  switch (channel) {
    case 'whatsapp':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#4EDEA3]/40 px-2 py-0.5 text-[11px] font-semibold text-[#002113] whitespace-nowrap">
          <MessageCircle className="h-3 w-3 shrink-0" />
          <span>واتساب</span>
        </span>
      );
    case 'instagram':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#E2E7FF] px-2 py-0.5 text-[11px] font-semibold text-[#131B2E] whitespace-nowrap">
          <Camera className="h-3 w-3 shrink-0" />
          <span>إنستغرام</span>
        </span>
      );
    case 'messenger':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#DBE1FF] px-2 py-0.5 text-[11px] font-semibold text-[#00174B] whitespace-nowrap">
          <MessageSquare className="h-3 w-3 shrink-0" />
          <span>ماسنجر</span>
        </span>
      );
    case 'phone':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#E2E7FF] px-2 py-0.5 text-[11px] font-semibold text-[#131B2E] whitespace-nowrap">
          <Phone className="h-3 w-3 shrink-0" />
          <span>هاتفي</span>
        </span>
      );
    case 'referral':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#E2E7FF] px-2 py-0.5 text-[11px] font-semibold text-[#131B2E] whitespace-nowrap">
          <Link2 className="h-3 w-3 shrink-0" />
          <span>مباشر</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#E2E7FF] px-2 py-0.5 text-[11px] font-semibold text-[#131B2E] whitespace-nowrap">
          <Globe className="h-3 w-3 shrink-0" />
          <span>بريد / ويب</span>
        </span>
      );
  }
}

function getShortCity(city?: string): string {
  if (!city) return 'الرياض';
  return city.split('،')[0].split(',')[0].trim() || 'الرياض';
}

export const ContactsKanbanView: React.FC<ContactsKanbanViewProps> = ({
  contacts,
  deals,
  touchpoints,
  selectedIds,
  duplicateReasons,
  canUpdateContact,
  onToggleSelect,
  onToggleSelectStage,
  onChangeStatus,
  onOpenSplitView,
  onQuickChat,
  onQuickCall,
  onOpenCreateDeal,
  onOpenCreateContact,
}) => {
  const [draggingContactId, setDraggingContactId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ContactStatus | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-contact-kanban-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const groupedByStatus = useMemo(() => {
    const map = new Map<ContactStatus, Contact[]>();
    for (const st of CONTACT_STATUSES) map.set(st, []);
    for (const contact of contacts) {
      const resolved = resolveContactStatus(contact.contactStatus);
      const list = map.get(resolved) ?? [];
      list.push(contact);
      map.set(resolved, list);
    }
    return map;
  }, [contacts]);

  const touchpointCountByContact = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tp of touchpoints) {
      if (tp.relatedEntityType === 'contact' && tp.relatedEntityId) {
        counts.set(tp.relatedEntityId, (counts.get(tp.relatedEntityId) ?? 0) + 1);
      }
    }
    for (const c of contacts) {
      if (!counts.has(c.id)) {
        const linked = touchpoints.filter(
          (tp) =>
            tp.relatedEntityId === c.id ||
            (c.leadUniqueId && tp.leadUniqueId === c.leadUniqueId)
        ).length;
        counts.set(c.id, Math.max(linked, 1));
      }
    }
    return counts;
  }, [contacts, touchpoints]);

  const totalContactsCount = Math.max(contacts.length, 1);

  return (
    <section
      aria-label="لوحة كانبان لجهات الاتصال"
      className="flex flex-col gap-3 pb-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
        {CONTACT_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const colContacts = groupedByStatus.get(status) ?? [];
          const colIds = colContacts.map((c) => c.id);
          const allSelectedInCol =
            colIds.length > 0 && colIds.every((id) => selectedIds.includes(id));

          const colDealsValue = colContacts.reduce((sum, contact) => {
            const cDeals = getDealsForContact(contact, deals);
            return sum + cDeals.reduce((s, d) => s + (d.stage !== 'خسارة' ? d.amount : 0), 0);
          }, 0);

          const flowPercent = Math.round((colContacts.length / totalContactsCount) * 100);
          const isDropTarget = dragOverStatus === status;

          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!canUpdateContact) return;
                e.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => {
                if (dragOverStatus === status) setDragOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                if (!canUpdateContact || !draggingContactId) return;
                onChangeStatus(draggingContactId, status);
                setDraggingContactId(null);
              }}
              className={`flex flex-col rounded-2xl border bg-[#F4F6FD] transition-all min-h-[540px] ${
                isDropTarget
                  ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-[#EAEDFF]'
                  : 'border-[#E2E8F0]'
              }`}
            >
              {/* Column Top Accent Bar */}
              <div className={`h-1.5 w-full rounded-t-2xl ${meta.accentBar}`} />

              {/* Column Header */}
              <div className="px-3.5 py-3 border-b border-[#E2E8F0]/80 bg-[#FFFFFF]/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderStatusHeaderIcon(status)}
                    <h2 className="text-[13px] font-bold text-[#131B2E] truncate">
                      {meta.title}
                    </h2>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${meta.countBadge}`}
                    >
                      {colContacts.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onToggleSelectStage && colIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onToggleSelectStage(colIds, !allSelectedInCol)}
                        title={allSelectedInCol ? 'إلغاء تحديد العمود' : 'تحديد كل العمود'}
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          allSelectedInCol
                            ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                            : 'border-[#CBD5E1] bg-[#FFFFFF] text-transparent hover:border-[#2563EB]'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${meta.flowBadge}`}
                    >
                      {flowPercent}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#737686]">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-[#006242]" />
                    <span>قيمة الصفقات:</span>
                    <strong className="text-[#131B2E] tabular-nums">
                      {formatCurrencySAR(colDealsValue)}
                    </strong>
                  </span>
                  <span className="tabular-nums">{colContacts.length} سجل</span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-2.5 p-2.5 overflow-y-auto max-h-[680px]">
                {colContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#FFFFFF]/70 py-10 px-3 text-center">
                    <p className="text-xs font-medium text-[#737686]">
                      لا توجد جهات اتصال في هذه المرحلة
                    </p>
                    {onOpenCreateContact && (
                      <button
                        type="button"
                        onClick={onOpenCreateContact}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        <span>إضافة جهة اتصال</span>
                      </button>
                    )}
                  </div>
                ) : (
                  colContacts.map((contact) => {
                    const selected = selectedIds.includes(contact.id);
                    const isVip = resolveContactStatus(contact.contactStatus) === 'عميل متكرر (VIP)';
                    const isB2C =
                      contact.accountId === 'unassigned' || contact.accountName === 'عميل فردي B2C';
                    const contactDeals = getDealsForContact(contact, deals);
                    const dealsSum = contactDeals.reduce(
                      (s, d) => s + (d.stage !== 'خسارة' ? d.amount : 0),
                      0
                    );
                    const tpCount = touchpointCountByContact.get(contact.id) ?? 1;
                    const dupReason = duplicateReasons.get(contact.id);
                    const ownerName = getContactOwnerName(contact);

                    return (
                      <article
                        key={contact.id}
                        draggable={canUpdateContact}
                        onDragStart={() => setDraggingContactId(contact.id)}
                        onDragEnd={() => {
                          setDraggingContactId(null);
                          setDragOverStatus(null);
                        }}
                        className={`group relative rounded-xl border bg-[#FFFFFF] p-3 transition-all shadow-2xs hover:shadow-md ${
                          selected
                            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                            : dupReason
                            ? 'border-[#F59E0B]/70'
                            : 'border-[#E2E8F0] hover:border-[#2563EB]/50'
                        } ${draggingContactId === contact.id ? 'opacity-60' : ''}`}
                      >
                        {/* Top Row: Name + VIP + City + Checkbox */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {canUpdateContact && (
                              <GripVertical className="mt-0.5 h-3.5 w-3.5 text-[#CBD5E1] group-hover:text-[#737686] shrink-0 cursor-grab" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  to={`/contacts/${contact.id}`}
                                  className="text-[13px] font-bold text-[#131B2E] hover:text-[#2563EB] truncate"
                                >
                                  {contact.fullName}
                                </Link>
                                {isVip && (
                                  <span className="rounded bg-[#6FFBE0] px-1.5 py-0.5 text-[10px] font-bold text-[#002113]">
                                    VIP
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {isB2C ? (
                                  <span className="inline-flex items-center rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-medium text-[#475569]">
                                    عميل فردي B2C
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8] truncate max-w-[165px]">
                                    <Building2 className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{contact.accountName}</span>
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-[#737686]">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span>{getShortCity(contact.city)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleSelect(contact.id)}
                              aria-label={`تحديد ${contact.fullName}`}
                              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                selected
                                  ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-transparent hover:border-[#2563EB]'
                              }`}
                            >
                              <Check className="h-3 w-3" />
                            </button>

                            <div className="relative" data-contact-kanban-menu>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuId((prev) => (prev === contact.id ? null : contact.id))
                                }
                                aria-label="المزيد من الإجراءات"
                                className="rounded p-0.5 text-[#737686] hover:bg-[#F2F3FF] hover:text-[#131B2E]"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                              {openMenuId === contact.id && (
                                <div className="flyout-surface absolute left-0 top-6 z-30 w-44 rounded-xl py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onOpenSplitView(contact.id);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-right text-xs text-[#131B2E] hover:bg-[#F2F3FF]"
                                  >
                                    <span>فتح العرض الثلاثي</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onOpenCreateDeal(contact);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-right text-xs font-semibold text-[#2563EB] hover:bg-[#F2F3FF]"
                                  >
                                    <span>+ إنشاء صفقة</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Middle Details: Phone, Deals Count + Value, Source */}
                        <div className="mt-2.5 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[#434655] tabular-nums" dir="ltr">
                              {contact.phone ?? '—'}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                contactDeals.length > 0
                                  ? 'bg-[#ECFDF5] text-[#059669]'
                                  : 'bg-[#F8FAFC] text-[#64748B]'
                              }`}
                            >
                              <Briefcase className="h-2.5 w-2.5" />
                              {contactDeals.length > 0
                                ? `${contactDeals.length} صفقة • ${formatCompactDealValue(dealsSum)}`
                                : 'بدون صفقات'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[#737686]">
                            <span className="inline-flex items-center gap-1 truncate">
                              <Megaphone className="h-3 w-3 text-[#2563EB] shrink-0" />
                              <span className="truncate">{contact.primarySource ?? 'تحويل مباشر'}</span>
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums">
                              {tpCount} نقاط اتصال
                            </span>
                          </div>

                          {dupReason && (
                            <div className="flex items-center gap-1 rounded bg-[#FEF3C7] px-2 py-1 text-[10px] font-semibold text-[#92400E]">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{dupReason}</span>
                            </div>
                          )}

                          {contact.lastMessageSnippet && (
                            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[11px] text-[#434655] line-clamp-2">
                              <span className="font-semibold text-[#131B2E]">آخر رسالة: </span>
                              {contact.lastMessageSnippet}
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Channel + Activity + Owner + Quick Actions */}
                        <div className="mt-2.5 pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {renderChannelPill(contact.channel)}
                            <span className="text-[10px] text-[#737686] truncate">
                              {contact.lastActivityLabel ?? 'منذ يوم'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              title={ownerName}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#004ac6] text-[10px] font-bold text-[#FFFFFF]"
                            >
                              {getArabicInitials(ownerName)}
                            </span>
                            {onQuickCall && contact.phone && (
                              <button
                                type="button"
                                onClick={() => onQuickCall(contact)}
                                title="تسجيل مكالمة"
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#434655] hover:border-[#2563EB] hover:text-[#2563EB]"
                              >
                                <Phone className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onQuickChat(contact.id)}
                              title="محادثة فورية"
                              className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#6FFBE0] text-[#005236] hover:bg-[#4EDEA3]"
                            >
                              <Send className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* + Deal Quick Action Strip */}
                        <button
                          type="button"
                          onClick={() => onOpenCreateDeal(contact)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#DBE1FF] bg-[#F2F3FF] py-1.5 text-[11px] font-bold text-[#004AC6] hover:bg-[#2563EB] hover:text-[#FFFFFF] transition-colors"
                        >
                          <Zap className="h-3 w-3" />
                          <span>+ إنشاء صفقة جديدة</span>
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
