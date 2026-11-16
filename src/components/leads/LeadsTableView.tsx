import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  Globe,
  MessageCircle,
  MessageSquare,
  Minus,
  MoreVertical,
  Phone,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import type { Lead, LeadChannel, LeadStatus } from '../../types/crm';
import { LEAD_STAGES } from '../../utils/leadsLogic';
import type { LeadTableColumnKey } from './LeadsHeader';

interface LeadsTableViewProps {
  leads: Lead[];
  selectedIds: string[];
  visibleColumns?: LeadTableColumnKey[];
  duplicateReasons: Map<string, string>;
  canUpdateLead: boolean;
  canDeleteLead: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenSplitView: (leadId: string) => void;
  onChangeStage: (leadId: string, stage: LeadStatus) => void;
  onQuickChat: (leadId: string) => void;
  onConvertLead: (lead: Lead) => void;
  onSoftDeleteLead: (leadId: string) => void;
  onInspectDuplicate: (leadId: string) => void;
}

type TableColumnId =
  | 'lead'
  | 'source'
  | 'phone'
  | 'channel'
  | 'email'
  | 'score'
  | 'stage'
  | 'owner'
  | 'duplicate';

const TABLE_COLUMNS_META: Array<{ id: TableColumnId; label: string }> = [
  { id: 'lead', label: 'العميل والمسمى الوظيفي' },
  { id: 'source', label: 'المصدر والحملة' },
  { id: 'phone', label: 'رقم الهاتف' },
  { id: 'channel', label: 'القناة' },
  { id: 'email', label: 'البريد الإلكتروني' },
  { id: 'score', label: 'درجة التأهيل' },
  { id: 'stage', label: 'مرحلة التأهيل' },
  { id: 'owner', label: 'مالك السجل' },
  { id: 'duplicate', label: 'تنبيه التكرار' },
];

const AVATAR_TONES = [
  'bg-[#004ac6]/10 text-[#004ac6]',
  'bg-[#e1e0ff] text-[#07006c]',
  'bg-[#dae2fd] text-[#004ac6]',
  'bg-[#eaedff] text-[#434655]',
  'bg-[#6ffbbe] text-[#002113]',
  'bg-[#e2e7ff] text-[#434655]',
  'bg-[#dbe1ff] text-[#00174b]',
];

const OWNER_TONES = [
  'bg-[#e2e7ff] text-[#004ac6]',
  'bg-[#e1e0ff] text-[#07006c]',
  'bg-[#6ffbbe] text-[#002113]',
  'bg-[#eaedff] text-[#434655]',
];

function getDotInitials(fullName: string): string {
  const cleaned = fullName
    .replace(/^(م\.|د\.|أ\.)\s*/u, '')
    .split(/\s+/)
    .filter((part) => part.length > 0 && part !== 'بن' && part !== 'بنت' && part !== '—');
  if (cleaned.length === 0) return 'ر.ع';
  if (cleaned.length === 1) return cleaned[0].slice(0, 2);
  return `${cleaned[0][0]}.${cleaned[cleaned.length - 1][0]}`;
}

function getToneIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % length;
  }
  return Math.abs(hash) % length;
}

function renderChannelBadge(channel?: LeadChannel) {
  switch (channel) {
    case 'whatsapp':
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#6ffbbe] text-[#002113] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <MessageCircle className="h-3 w-3 text-[#006242]" />
          <span>واتساب أعمال</span>
        </span>
      );
    case 'instagram':
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#e1e0ff] text-[#07006c] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <Camera className="h-3 w-3 text-[#4648d4]" />
          <span>إنستغرام</span>
        </span>
      );
    case 'messenger':
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#eaedff] text-[#004ac6] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <MessageSquare className="h-3 w-3 text-[#004ac6]" />
          <span>ماسنجر</span>
        </span>
      );
    case 'website':
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#dbe1ff] text-[#00174b] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <Globe className="h-3 w-3 text-[#004ac6]" />
          <span>الموقع</span>
        </span>
      );
    case 'phone':
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#e2e7ff] text-[#131b2e] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <Phone className="h-3 w-3 text-[#434655]" />
          <span>هاتفي</span>
        </span>
      );
    case 'referral':
    default:
      return (
        <span className="px-1.5 py-0.5 rounded-full bg-[#f2f3ff] text-[#434655] text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
          <Users className="h-3 w-3 text-[#4648d4]" />
          <span>إحالة</span>
        </span>
      );
  }
}

function getSourceBadgeClasses(channel?: LeadChannel): string {
  if (channel === 'whatsapp') return 'bg-[#6ffbbe] text-[#002113]';
  if (channel === 'instagram') return 'bg-[#e1e0ff] text-[#07006c]';
  if (channel === 'messenger') return 'bg-[#eaedff] text-[#004ac6]';
  return 'bg-[#eaedff] text-[#434655]';
}

function getStageButtonStyle(status: LeadStatus): {
  pill: string;
  dot: string;
} {
  switch (status) {
    case 'جديد':
      return {
        pill: 'bg-[#dbe1ff] text-[#00174b]',
        dot: 'bg-[#004ac6]',
      };
    case 'تم التواصل':
      return {
        pill: 'bg-[#e2e7ff] text-[#004ac6] ring-1 ring-[#004ac6]/30',
        dot: 'bg-[#004ac6]',
      };
    case 'مؤهل للتحويل':
      return {
        pill: 'bg-[#6ffbbe] text-[#002113]',
        dot: 'bg-[#006242]',
      };
    case 'غير مهتم':
    default:
      return {
        pill: 'bg-[#e2e7ff] text-[#434655]',
        dot: 'bg-[#737686]',
      };
  }
}

function getStageDropdownOptionStyle(stage: LeadStatus): {
  dot: string;
  labelClass: string;
} {
  switch (stage) {
    case 'جديد':
      return { dot: 'bg-[#2563eb]', labelClass: 'text-[#131b2e]' };
    case 'تم التواصل':
      return { dot: 'bg-[#004ac6]', labelClass: 'text-[#004ac6]' };
    case 'مؤهل للتحويل':
      return { dot: 'bg-[#006242]', labelClass: 'text-[#006242] font-medium' };
    case 'غير مهتم':
    default:
      return { dot: 'bg-[#737686]', labelClass: 'text-[#434655]' };
  }
}

function getScoreBarStyle(score: number): { bar: string; text: string } {
  if (score >= 85) return { bar: 'bg-[#006242]', text: 'text-[#006242]' };
  if (score >= 70) return { bar: 'bg-[#004ac6]', text: 'text-[#004ac6]' };
  if (score >= 50) return { bar: 'bg-[#4648d4]', text: 'text-[#4648d4]' };
  return { bar: 'bg-[#737686]', text: 'text-[#737686]' };
}

function renderQuickChatButton(
  lead: Lead,
  onQuickChat: (leadId: string) => void
) {
  if (lead.channel === 'instagram') {
    return (
      <button
        type="button"
        onClick={() => onQuickChat(lead.id)}
        title="محادثة إنستغرام مباشرة"
        aria-label={`رسالة Direct مع ${lead.fullName}`}
        className="px-1.5 py-1 rounded-lg bg-[#e1e0ff] text-[#07006c] hover:bg-[#c0c1ff] border border-[#4648d4]/20 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
      >
        <Camera className="h-3 w-3 text-[#4648d4]" />
        <span>رسالة Direct</span>
      </button>
    );
  }
  if (lead.channel === 'messenger') {
    return (
      <button
        type="button"
        onClick={() => onQuickChat(lead.id)}
        title="محادثة ماسنجر مباشرة"
        aria-label={`محادثة ماسنجر مع ${lead.fullName}`}
        className="px-1.5 py-1 rounded-lg bg-[#eaedff] text-[#004ac6] hover:bg-[#e2e7ff] border border-[#c3c6d7]/40 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
      >
        <MessageSquare className="h-3 w-3 text-[#004ac6]" />
        <span>ماسنجر</span>
      </button>
    );
  }
  if (lead.channel === 'whatsapp') {
    return (
      <button
        type="button"
        onClick={() => onQuickChat(lead.id)}
        title="محادثة واتساب مباشرة"
        aria-label={`محادثة فورية مع ${lead.fullName}`}
        className="px-1.5 py-1 rounded-lg bg-[#6ffbbe] text-[#002113] hover:bg-[#4edea3] border border-[#006242]/20 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
      >
        <MessageCircle className="h-3 w-3 text-[#006242]" />
        <span>محادثة فورية</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onQuickChat(lead.id)}
      title="محادثة مباشرة"
      aria-label={`محادثة فورية مع ${lead.fullName}`}
      className="px-1.5 py-1 rounded-lg bg-[#6ffbbe] text-[#002113] hover:bg-[#4edea3] border border-[#006242]/20 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
    >
      <MessageCircle className="h-3 w-3 text-[#006242]" />
      <span>محادثة فورية</span>
    </button>
  );
}

export const LeadsTableView: React.FC<LeadsTableViewProps> = ({
  leads,
  selectedIds,
  duplicateReasons,
  canUpdateLead,
  canDeleteLead,
  onToggleSelect,
  onToggleSelectAll,
  onOpenSplitView,
  onChangeStage,
  onQuickChat,
  onConvertLead,
  onSoftDeleteLead,
  onInspectDuplicate,
}) => {
  const [stageMenuLeadId, setStageMenuLeadId] = useState<string | null>(null);
  const [actionsMenuLeadId, setActionsMenuLeadId] = useState<string | null>(null);
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeCols, setActiveCols] = useState<TableColumnId[]>([
    'lead',
    'source',
    'phone',
    'channel',
    'email',
    'score',
    'stage',
    'owner',
    'duplicate',
  ]);

  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setStageMenuLeadId(null);
        setActionsMenuLeadId(null);
        setColumnsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return leads.slice(start, start + pageSize);
  }, [leads, pageSize, safePage]);

  const allSelected =
    leads.length > 0 && leads.every((l) => selectedIds.includes(l.id));
  const someSelected =
    !allSelected && leads.some((l) => selectedIds.includes(l.id));

  const isColVisible = (col: TableColumnId) => activeCols.includes(col);

  const toggleLocalColumn = (col: TableColumnId) => {
    setActiveCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleCopyEmail = (leadId: string, email?: string) => {
    if (!email) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(email);
    }
    setCopiedLeadId(leadId);
    window.setTimeout(() => {
      setCopiedLeadId((prev) => (prev === leadId ? null : prev));
    }, 1500);
  };

  if (leads.length === 0) {
    return (
      <section className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e2e7ff] p-10 text-center space-y-2">
        <p className="text-[14px] font-semibold text-[#131b2e]">
          لا توجد سجلات عملاء محتملين مطابقة للفلاتر الحالية
        </p>
        <p className="text-[12px] text-[#737686]">
          جرّب مسح شروط البحث أو إعادة تعيين الفلاتر المتقدمة لعرض كافة السجلات.
        </p>
      </section>
    );
  }

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, leads.length);

  return (
    <section
      ref={containerRef}
      className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e2e7ff]/80 overflow-visible mb-8"
    >
      <div className="overflow-x-auto w-full rounded-t-xl">
        <table className="w-full text-right border-collapse select-none text-xs">
          {/* Table Head */}
          <thead>
            <tr className="bg-[#f2f3ff] text-[#434655] text-[11px] font-semibold tracking-tight">
              <th className="py-2.5 px-1 w-7 text-center" scope="col">
                <label className="relative inline-flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    aria-label="تحديد جميع العملاء المعروضين"
                    className="peer sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                      allSelected || someSelected
                        ? 'bg-[#004ac6] text-[#ffffff] shadow-2xs'
                        : 'bg-[#ffffff] border border-[#c3c6d7]'
                    }`}
                  >
                    {allSelected ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : someSelected ? (
                      <Minus className="h-3 w-3 stroke-[3]" />
                    ) : null}
                  </span>
                </label>
              </th>

              {isColVisible('lead') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  العميل والمسمى الوظيفي
                </th>
              )}
              {isColVisible('source') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  المصدر والحملة
                </th>
              )}
              {isColVisible('phone') && (
                <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                  رقم الهاتف
                </th>
              )}
              {isColVisible('channel') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  القناة
                </th>
              )}
              {isColVisible('email') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  البريد الإلكتروني
                </th>
              )}
              {isColVisible('score') && (
                <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                  درجة التأهيل
                </th>
              )}
              {isColVisible('stage') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  مرحلة التأهيل
                </th>
              )}
              {isColVisible('owner') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  مالك السجل
                </th>
              )}
              {isColVisible('duplicate') && (
                <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                  تنبيه التكرار
                </th>
              )}

              <th className="py-2.5 px-1.5 text-left whitespace-nowrap relative" scope="col">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setColumnsPopoverOpen((prev) => !prev)}
                    title="تخصيص الأعمدة"
                    aria-label="تخصيص أعمدة الجدول"
                    aria-expanded={columnsPopoverOpen}
                    className="p-0.5 rounded text-[#737686] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-semibold">إجراءات</span>
                </div>

                {columnsPopoverOpen && (
                  <div className="absolute left-2 top-10 z-40 w-56 rounded-xl bg-[#ffffff] border border-[#c3c6d7]/50 shadow-2xl p-2 text-right">
                    <p className="px-2 py-1 text-[11px] font-bold text-[#737686] border-b border-[#f2f3ff] mb-1">
                      الأعمدة الظاهرة
                    </p>
                    <div className="space-y-0.5">
                      {TABLE_COLUMNS_META.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-normal text-[#131b2e] hover:bg-[#f2f3ff] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isColVisible(col.id)}
                            disabled={col.id === 'lead'}
                            onChange={() => toggleLocalColumn(col.id)}
                            className="h-3.5 w-3.5 rounded border-[#c3c6d7] text-[#004ac6]"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#f2f3ff] text-xs text-[#131b2e] bg-[#ffffff]">
            {paginatedLeads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              const dupReason = duplicateReasons.get(lead.id);
              const slaExceeded = (lead.awaitingReplyHours ?? 0) > 2;
              const avatarTone =
                AVATAR_TONES[getToneIndex(lead.id || lead.fullName, AVATAR_TONES.length)];
              const ownerTone =
                OWNER_TONES[getToneIndex(lead.assignedToName, OWNER_TONES.length)];
              const scoreStyle = getScoreBarStyle(lead.aiScore);
              const stageStyle = getStageButtonStyle(lead.status);
              const campaignChip = lead.campaign || lead.utmSource || lead.unique_id;

              return (
                <tr
                  key={lead.id}
                  className={`transition-colors relative ${
                    isSelected
                      ? 'bg-[#dbe1ff]/25 hover:bg-[#dbe1ff]/35'
                      : 'hover:bg-[#f2f3ff]/60'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="py-2.5 px-1 text-center relative">
                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#004ac6]" />
                    )}
                    <label className="relative inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(lead.id)}
                        aria-label={`تحديد ${lead.fullName}`}
                        className="peer sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#004ac6] text-[#ffffff]'
                            : 'bg-[#ffffff] border border-[#c3c6d7] hover:border-[#004ac6]'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                    </label>
                  </td>

                  {/* العميل والمسمى الوظيفي */}
                  {isColVisible('lead') && (
                    <td className="py-2.5 px-1.5 min-w-[136px] max-w-[152px]">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${avatarTone}`}
                        >
                          {getDotInitials(lead.fullName)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <Link
                              to={`/leads/${lead.id}`}
                              className="text-[12px] font-semibold text-[#131b2e] hover:text-[#004ac6] truncate leading-snug"
                            >
                              {lead.fullName}
                            </Link>
                            {lead.converted && (
                              <span className="rounded bg-[#6ffbbe] px-1 py-0.2 text-[9px] font-bold text-[#002113] shrink-0">
                                محول
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#737686] truncate leading-tight">
                            {lead.jobTitle || lead.city || lead.unique_id}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[#737686] font-medium tabular-nums">
                            <span
                              className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                slaExceeded
                                  ? 'bg-[#ba1a1a]'
                                  : lead.status === 'مؤهل للتحويل' || lead.status === 'تم التواصل'
                                  ? 'bg-[#006242]'
                                  : 'bg-[#737686]'
                              }`}
                            />
                            <span className="truncate">
                              {slaExceeded
                                ? `بانتظار الرد: ${lead.awaitingReplyHours}س`
                                : `آخر رسالة: ${lead.lastActivityLabel || 'اليوم'}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* المصدر والحملة */}
                  {isColVisible('source') && (
                    <td className="py-2.5 px-1.5 max-w-[104px]">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-[#131b2e] truncate">
                          {lead.source || '—'}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 min-w-0">
                          <span
                            className={`px-1 py-0.2 rounded font-mono text-[9px] truncate max-w-[96px] ${getSourceBadgeClasses(
                              lead.channel
                            )}`}
                            title={`${campaignChip} (${lead.unique_id})`}
                          >
                            {campaignChip}
                          </span>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* رقم الهاتف */}
                  {isColVisible('phone') && (
                    <td className="py-2.5 px-1 whitespace-nowrap">
                      <span
                        className="text-[#131b2e] font-mono text-[11px] tabular-nums"
                        dir="ltr"
                      >
                        {lead.phone || '—'}
                      </span>
                    </td>
                  )}

                  {/* القناة */}
                  {isColVisible('channel') && (
                    <td className="py-2.5 px-1.5 whitespace-nowrap">
                      {renderChannelBadge(lead.channel)}
                    </td>
                  )}

                  {/* البريد الإلكتروني */}
                  {isColVisible('email') && (
                    <td className="py-2.5 px-1.5 max-w-[106px]">
                      <div className="flex items-center gap-1 text-[#434655] font-mono text-[11px] min-w-0">
                        <span className="truncate max-w-[78px]" dir="ltr" title={lead.email}>
                          {lead.email || '—'}
                        </span>
                        {lead.email && (
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(lead.id, lead.email)}
                            title={
                              copiedLeadId === lead.id ? 'تم النسخ' : 'نسخ البريد الإلكتروني'
                            }
                            aria-label={`نسخ البريد الإلكتروني لـ ${lead.fullName}`}
                            className="text-[#737686] hover:text-[#004ac6] transition-colors shrink-0"
                          >
                            {copiedLeadId === lead.id ? (
                              <Check className="h-3 w-3 text-[#006242]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  )}

                  {/* درجة التأهيل */}
                  {isColVisible('score') && (
                    <td className="py-2.5 px-1 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <div className="w-7 bg-[#eaedff] rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`${scoreStyle.bar} h-1.5 rounded-full transition-all`}
                            style={{ width: `${Math.min(100, Math.max(0, lead.aiScore))}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums ${scoreStyle.text}`}>
                          {lead.aiScore}%
                        </span>
                      </div>
                    </td>
                  )}

                  {/* مرحلة التأهيل */}
                  {isColVisible('stage') && (
                    <td className="py-2.5 px-1.5 whitespace-nowrap relative">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          disabled={!canUpdateLead}
                          onClick={() => {
                            setActionsMenuLeadId(null);
                            setStageMenuLeadId((prev) => (prev === lead.id ? null : lead.id));
                          }}
                          title="تعديل المرحلة بنقرة واحدة"
                          aria-label={`تغيير مرحلة ${lead.fullName}`}
                          aria-expanded={stageMenuLeadId === lead.id}
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 hover:opacity-90 transition-all cursor-pointer disabled:opacity-60 ${stageStyle.pill}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                          <span>{lead.status}</span>
                          {canUpdateLead && <ChevronDown className="h-2.5 w-2.5 opacity-80" />}
                        </button>

                        {stageMenuLeadId === lead.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#ffffff] rounded-xl shadow-2xl border border-[#c3c6d7]/40 p-1.5 z-40 text-right">
                            <div className="px-2 py-1 text-[11px] font-bold text-[#737686] border-b border-[#f2f3ff] mb-1 flex items-center justify-between">
                              <span>تحديث مرحلة التأهيل</span>
                              <Zap className="h-3.5 w-3.5 text-[#006242]" />
                            </div>
                            {LEAD_STAGES.map((stage) => {
                              const optStyle = getStageDropdownOptionStyle(stage);
                              const active = lead.status === stage;
                              return (
                                <button
                                  key={stage}
                                  type="button"
                                  onClick={() => {
                                    setStageMenuLeadId(null);
                                    onChangeStage(lead.id, stage);
                                  }}
                                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-right text-[11px] transition-colors ${
                                    active
                                      ? 'bg-[#dbe1ff]/35 text-[#004ac6] font-semibold'
                                      : 'hover:bg-[#eaedff] ' + optStyle.labelClass
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${optStyle.dot}`} />
                                    <span>{stage}</span>
                                  </div>
                                  {active && <Check className="h-3.5 w-3.5 text-[#004ac6]" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* مالك السجل */}
                  {isColVisible('owner') && (
                    <td className="py-2.5 px-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${ownerTone}`}
                        >
                          {getDotInitials(lead.assignedToName)}
                        </div>
                        <span className="text-[11px] font-medium text-[#131b2e] max-w-[66px] truncate">
                          {lead.assignedToName}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* تنبيه التكرار */}
                  {isColVisible('duplicate') && (
                    <td className="py-2.5 px-1.5 whitespace-nowrap">
                      {dupReason ? (
                        <button
                          type="button"
                          onClick={() => onInspectDuplicate(lead.id)}
                          title={dupReason}
                          className="px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#93000a] text-[10px] font-semibold inline-flex items-center gap-0.5 hover:opacity-90 transition-opacity"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>
                            {dupReason.includes('البريد') ? 'مكرر (بريد)' : 'مكرر (هاتف)'}
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[#006242] text-[10px] font-medium">
                          <BadgeCheck className="h-3 w-3 shrink-0" />
                          <span>سليم ومطابق</span>
                        </span>
                      )}
                    </td>
                  )}

                  {/* إجراءات */}
                  <td className="py-2.5 px-1.5 text-left whitespace-nowrap relative">
                    <div className="flex items-center justify-end gap-0.5">
                      {renderQuickChatButton(lead, onQuickChat)}

                      <button
                        type="button"
                        onClick={() => onOpenSplitView(lead.id)}
                        title="فتح العرض المقسم والاتصال"
                        aria-label={`فتح العرض المقسم لـ ${lead.fullName}`}
                        className="p-0.5 rounded-lg text-[#737686] hover:bg-[#eaedff] hover:text-[#004ac6] transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setStageMenuLeadId(null);
                            setActionsMenuLeadId((prev) =>
                              prev === lead.id ? null : lead.id
                            );
                          }}
                          title="المزيد من الإجراءات"
                          aria-label={`خيارات إضافية لـ ${lead.fullName}`}
                          aria-expanded={actionsMenuLeadId === lead.id}
                          className="p-0.5 rounded-lg text-[#737686] hover:bg-[#eaedff] hover:text-[#131b2e] transition-colors"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        {actionsMenuLeadId === lead.id && (
                          <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-[#ffffff] border border-[#c3c6d7]/50 shadow-2xl p-1.5 z-40 text-right">
                            <Link
                              to={`/leads/${lead.id}`}
                              onClick={() => setActionsMenuLeadId(null)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#131b2e] hover:bg-[#eaedff]"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-[#004ac6]" />
                              <span>عرض الملف الكامل</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setActionsMenuLeadId(null);
                                onOpenSplitView(lead.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#131b2e] hover:bg-[#eaedff]"
                            >
                              <Columns3 className="h-3.5 w-3.5 text-[#434655]" />
                              <span>فتح العرض المقسم</span>
                            </button>

                            {!lead.converted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionsMenuLeadId(null);
                                  onConvertLead(lead);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#006242] hover:bg-[#6ffbbe]/40"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                <span>تحويل العميل لصفقة</span>
                              </button>
                            )}

                            {canDeleteLead && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionsMenuLeadId(null);
                                  onSoftDeleteLead(lead.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#ba1a1a] hover:bg-[#ffdad6]/50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>نقل لسلة المحذوفات</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      <div className="px-4 py-3 bg-[#ffffff] border-t border-[#f2f3ff] rounded-b-xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#737686] text-[12px] font-medium">
          <span>
            عرض{' '}
            <strong className="text-[#131b2e] tabular-nums">
              {startItem} إلى {endItem}
            </strong>{' '}
            من أصل{' '}
            <strong className="text-[#131b2e] tabular-nums">
              {leads.length} عميل محتمل
            </strong>
          </span>
          <span className="text-[#e2e7ff]">|</span>
          <span>الصفوف في الصفحة:</span>
          <select
            aria-label="عدد الصفوف في الصفحة"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#f2f3ff] text-[#131b2e] rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-[#004ac6]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="الصفحة السابقة"
            className="p-1.5 rounded-lg bg-[#f2f3ff] text-[#737686] hover:text-[#131b2e] transition-colors disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
            const isCurrent = pageNum === safePage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                aria-label={`الصفحة ${pageNum}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`w-8 h-8 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                  isCurrent
                    ? 'bg-[#004ac6] text-[#ffffff] shadow-sm'
                    : 'bg-[#ffffff] hover:bg-[#eaedff] text-[#131b2e]'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="الصفحة التالية"
            className="p-1.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
