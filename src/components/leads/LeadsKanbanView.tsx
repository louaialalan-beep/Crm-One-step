import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Camera,
  Check,
  Clock,
  Globe,
  GripVertical,
  Inbox,
  Link2,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Network,
  Phone,
  PieChart,
  Plus,
  RotateCcw,
  Send,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import type { Lead, LeadChannel, LeadStatus, Touchpoint } from '../../types/crm';
import { LEAD_STAGES } from '../../utils/leadsLogic';
import { getArabicInitials } from './LeadChannelIcon';

interface LeadsKanbanViewProps {
  leads: Lead[];
  touchpoints: Touchpoint[];
  selectedIds: string[];
  duplicateReasons: Map<string, string>;
  canUpdateLead: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectStage?: (leadIds: string[], select: boolean) => void;
  onChangeStage: (leadId: string, stage: LeadStatus) => void;
  onOpenSplitView: (leadId: string) => void;
  onQuickChat: (leadId: string) => void;
  onQuickCall?: (lead: Lead) => void;
  onOpenCreateLead?: () => void;
  onConvertLead: (lead: Lead) => void;
}

interface StageMeta {
  title: string;
  accentBar: string;
  countBadge: string;
  flowBadge: string;
  headerIconBg: string;
}

const STAGE_META: Record<LeadStatus, StageMeta> = {
  جديد: {
    title: 'جديد (New)',
    accentBar: 'bg-[#6063EE]',
    countBadge: 'bg-[#E2E7FF] text-[#004AC6]',
    flowBadge: 'bg-[#E2E7FF] text-[#004AC6]',
    headerIconBg: 'text-[#6063EE]',
  },
  'تم التواصل': {
    title: 'تم التواصل (Contacted)',
    accentBar: 'bg-[#4648D4]',
    countBadge: 'bg-[#E1E0FF] text-[#07006C]',
    flowBadge: 'bg-[#E1E0FF] text-[#07006C]',
    headerIconBg: 'text-[#4648D4]',
  },
  'مؤهل للتحويل': {
    title: 'مؤهل للتحويل (Qualified)',
    accentBar: 'bg-[#006242]',
    countBadge: 'bg-[#6FFBE0] text-[#002113]',
    flowBadge: 'bg-[#6FFBE0] text-[#002113]',
    headerIconBg: 'text-[#006242]',
  },
  'غير مهتم': {
    title: 'غير مهتم / مستبعد',
    accentBar: 'bg-[#737686]',
    countBadge: 'bg-[#FFDAD6] text-[#93000A]',
    flowBadge: 'bg-[#FFDAD6] text-[#93000A]',
    headerIconBg: 'text-[#737686]',
  },
};

function computeStageAvgResponseLabel(stageLeads: Lead[], stage: LeadStatus): string {
  if (stageLeads.length === 0) {
    return stage === 'جديد' ? '8 دقائق' : stage === 'تم التواصل' ? '15 دقيقة' : '12 دقيقة';
  }
  const avgHours =
    stageLeads.reduce((sum, l) => sum + (l.awaitingReplyHours ?? 0.2), 0) / stageLeads.length;
  if (avgHours < 1) {
    const mins = Math.max(8, Math.round(avgHours * 60));
    return `${mins} ${mins >= 3 && mins <= 10 ? 'دقائق' : 'دقيقة'}`;
  }
  const rounded = Math.round(avgHours * 10) / 10;
  return `${rounded} ساعة`;
}

function getShortCity(city?: string): string {
  if (!city) return 'الرياض';
  return city.split('،')[0].split(',')[0].trim() || 'الرياض';
}

function renderStageHeaderIcon(stage: LeadStatus) {
  if (stage === 'جديد') return <Inbox className="h-[18px] w-[18px] text-[#6063EE] shrink-0" />;
  if (stage === 'تم التواصل')
    return <MessageSquare className="h-[18px] w-[18px] text-[#4648D4] shrink-0" />;
  if (stage === 'مؤهل للتحويل')
    return <BadgeCheck className="h-[18px] w-[18px] text-[#006242] shrink-0" />;
  return <XCircle className="h-[18px] w-[18px] text-[#737686] shrink-0" />;
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
          <span>نموذج ويب</span>
        </span>
      );
  }
}

export const LeadsKanbanView: React.FC<LeadsKanbanViewProps> = ({
  leads,
  touchpoints,
  selectedIds,
  duplicateReasons,
  canUpdateLead,
  onToggleSelect,
  onToggleSelectStage,
  onChangeStage,
  onOpenSplitView,
  onQuickChat,
  onQuickCall,
  onOpenCreateLead,
  onConvertLead,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [optimisticStages, setOptimisticStages] = useState<Record<string, LeadStatus>>({});
  const [openMenuStage, setOpenMenuStage] = useState<LeadStatus | null>(null);
  const [sortByScoreStage, setSortByScoreStage] = useState<Record<string, boolean>>({});

  // Clear optimistic overrides once Firestore / parent state catches up
  useEffect(() => {
    setOptimisticStages((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;
      let changed = false;
      const next: Record<string, LeadStatus> = {};
      for (const [id, targetStage] of entries) {
        const liveLead = leads.find((l) => l.id === id);
        if (liveLead && liveLead.status !== targetStage) {
          next[id] = targetStage;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leads]);

  const effectiveLeads = useMemo(
    () =>
      leads.map((l) => {
        const opt = optimisticStages[l.id];
        return opt ? { ...l, status: opt } : l;
      }),
    [leads, optimisticStages]
  );

  const touchpointCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const count = touchpoints.filter(
        (tp) => tp.leadId === lead.id || (tp.leadUniqueId && tp.leadUniqueId === lead.unique_id)
      ).length;
      counts.set(lead.id, count);
    }
    return counts;
  }, [leads, touchpoints]);

  const handleStageMove = (leadId: string, targetStage: LeadStatus) => {
    const currentLead = effectiveLeads.find((l) => l.id === leadId);
    if (!currentLead || currentLead.status === targetStage) return;
    setOptimisticStages((prev) => ({ ...prev, [leadId]: targetStage }));
    onChangeStage(leadId, targetStage);
  };

  return (
    <div
      className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start"
      role="region"
      aria-label="لوحة مراحل العملاء المحتملين (Kanban)"
    >
      {LEAD_STAGES.map((stage) => {
        const meta = STAGE_META[stage];
        const rawStageLeads = effectiveLeads.filter((l) => l.status === stage);
        const stageLeads = sortByScoreStage[stage]
          ? [...rawStageLeads].sort((a, b) => b.aiScore - a.aiScore)
          : rawStageLeads;
        const isDropTarget = dragOverStage === stage;
        const isDisqualifiedCol = stage === 'غير مهتم';
        const isQualifiedCol = stage === 'مؤهل للتحويل';
        const flowPercent =
          effectiveLeads.length > 0
            ? Math.round((stageLeads.length / effectiveLeads.length) * 100)
            : 0;
        const avgResponse = computeStageAvgResponseLabel(stageLeads, stage);
        const allStageSelected =
          stageLeads.length > 0 && stageLeads.every((l) => selectedIds.includes(l.id));

        return (
          <section
            key={stage}
            data-kanban-stage={stage}
            aria-label={`عمود ${meta.title}`}
            onDragOver={(e) => {
              if (!canUpdateLead) return;
              e.preventDefault();
              if (dragOverStage !== stage) {
                setDragOverStage(stage);
              }
            }}
            onDragLeave={() => setDragOverStage((prev) => (prev === stage ? null : prev))}
            onDrop={(e) => {
              if (!canUpdateLead) return;
              e.preventDefault();
              const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
              setDragOverStage(null);
              setDraggingId(null);
              if (droppedId) {
                handleStageMove(droppedId, stage);
              }
            }}
            className={`flex flex-col rounded-xl p-2 shadow-sm transition-all min-h-[420px] ${
              isDropTarget
                ? 'bg-[#E2E7FF]/75 ring-2 ring-[#2563EB]'
                : 'bg-[#F2F3FF]'
            } ${isDisqualifiedCol ? 'opacity-90 hover:opacity-100' : ''}`}
          >
            {/* Column Header */}
            <div className="relative bg-[#FFFFFF] p-2.5 rounded-lg shadow-xs overflow-visible mb-2 border border-[#E2E7FF]/80">
              <div className={`absolute top-0 right-0 left-0 h-1 rounded-t-lg ${meta.accentBar}`} />

              <div className="flex items-center justify-between gap-1 pt-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  {renderStageHeaderIcon(stage)}
                  <h2 className="text-[12px] font-bold text-[#131B2E] whitespace-nowrap">
                    {meta.title}
                  </h2>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums shrink-0 ${meta.countBadge}`}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                <div className="relative flex items-center shrink-0">
                  {!isDisqualifiedCol && onOpenCreateLead && (
                    <button
                      type="button"
                      onClick={onOpenCreateLead}
                      title="إضافة عميل محتمل جديد"
                      aria-label={`إضافة عميل في مرحلة ${meta.title}`}
                      className="p-0.5 rounded hover:bg-[#EAEDFF] text-[#737686] hover:text-[#131B2E] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenuStage((prev) => (prev === stage ? null : stage))
                    }
                    title="خيارات المرحلة"
                    aria-label={`خيارات مرحلة ${meta.title}`}
                    className="p-0.5 rounded hover:bg-[#EAEDFF] text-[#737686] hover:text-[#131B2E] transition-colors"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>

                  {openMenuStage === stage && (
                    <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-lg">
                      {onToggleSelectStage && stageLeads.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleSelectStage(
                              stageLeads.map((l) => l.id),
                              !allStageSelected
                            );
                            setOpenMenuStage(null);
                          }}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-right text-[12px] font-medium text-[#131B2E] hover:bg-[#F2F3FF]"
                        >
                          <span>
                            {allStageSelected ? 'إلغاء تحديد المرحلة' : 'تحديد كل السجلات'}
                          </span>
                          <span className="text-[11px] text-[#737686] tabular-nums">
                            {stageLeads.length}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSortByScoreStage((prev) => ({
                            ...prev,
                            [stage]: !prev[stage],
                          }));
                          setOpenMenuStage(null);
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-right text-[12px] font-medium text-[#131B2E] hover:bg-[#F2F3FF]"
                      >
                        <span>ترتيب حسب درجة التأهيل</span>
                        {sortByScoreStage[stage] && (
                          <Check className="h-3.5 w-3.5 text-[#2563EB]" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Header Sub-Row: Average Response Time + % Flow */}
              <div className="mt-2 pt-2 border-t border-[#EAEDFF] flex items-center justify-between gap-1.5">
                {isQualifiedCol ? (
                  <span className="text-[10.5px] font-medium text-[#006242] flex items-center gap-1 tabular-nums whitespace-nowrap">
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    <span>متوسط الاستجابة: {avgResponse}</span>
                  </span>
                ) : isDisqualifiedCol ? (
                  <span className="text-[10.5px] font-medium text-[#737686] flex items-center gap-1 tabular-nums whitespace-nowrap">
                    <PieChart className="h-3 w-3 shrink-0" />
                    <span>متوسط الاستجابة: {avgResponse}</span>
                  </span>
                ) : (
                  <span className="text-[10.5px] font-medium text-[#434655] flex items-center gap-1 tabular-nums whitespace-nowrap">
                    <Clock className="h-3 w-3 text-[#4648D4] shrink-0" />
                    <span>متوسط الاستجابة: {avgResponse}</span>
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums whitespace-nowrap shrink-0 ${meta.flowBadge}`}
                >
                  {flowPercent}% من التدفق
                </span>
              </div>
            </div>

            {/* Cards Stack */}
            <div className="flex flex-1 flex-col gap-2">
              {stageLeads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#C3C6D7] bg-[#FFFFFF]/70 p-5 text-center text-[12px] text-[#737686]">
                  اسحب وأفلت عميلاً هنا للنقل إلى {meta.title}
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const isSelected = selectedIds.includes(lead.id);
                  const tpCount = touchpointCountMap.get(lead.id) ?? 0;
                  const shortCity = getShortCity(lead.city);
                  const dupReason = duplicateReasons.get(lead.id);
                  const isDragging = draggingId === lead.id;

                  return (
                    <article
                      key={lead.id}
                      data-kanban-card={lead.id}
                      draggable={canUpdateLead}
                      onDragStart={(e) => {
                        setDraggingId(lead.id);
                        e.dataTransfer.setData('text/plain', lead.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      className={`rounded-xl p-3 transition-all group ${
                        canUpdateLead ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${isDragging ? 'opacity-50 scale-[0.98]' : ''} ${
                        isSelected
                          ? 'bg-[#EFF6FF]/40 border border-[#2563EB] ring-1 ring-[#2563EB]/25 shadow-sm'
                          : isQualifiedCol
                          ? 'bg-[#FFFFFF] border border-[#E2E7FF] ring-1 ring-[#006242]/20 shadow-xs hover:shadow-md'
                          : isDisqualifiedCol
                          ? 'bg-[#FFFFFF]/85 border border-transparent hover:border-[#EAEDFF] shadow-xs hover:shadow-md'
                          : 'bg-[#FFFFFF] border border-[#E2E7FF]/70 shadow-xs hover:shadow-md'
                      }`}
                    >
                      {/* Top Row: Checkbox + Drag Grip + Name | City Pill + Score % Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(lead.id)}
                            aria-label={`تحديد ${lead.fullName}`}
                            className="h-4 w-4 rounded border-[#CBD5E1] bg-[#FFFFFF] text-[#2563EB] accent-[#2563EB] cursor-pointer shrink-0"
                          />
                          <GripVertical
                            className="h-4 w-4 text-[#737686] group-hover:text-[#004AC6] transition-colors shrink-0"
                            aria-hidden="true"
                          />
                          <Link
                            to={`/leads/${lead.id}`}
                            className={`text-[13px] font-bold truncate transition-colors ${
                              isDisqualifiedCol
                                ? 'text-[#434655] line-through hover:text-[#004AC6]'
                                : 'text-[#131B2E] hover:text-[#004AC6]'
                            }`}
                            title={dupReason ? `${lead.fullName} — ${dupReason}` : lead.fullName}
                          >
                            {lead.fullName}
                          </Link>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="inline-flex items-center gap-0.5 rounded bg-[#E2E7FF] px-1.5 py-0.5 text-[11px] font-medium text-[#434655]">
                            <MapPin className="h-3 w-3 text-[#737686] shrink-0" />
                            <span>{shortCity}</span>
                          </span>

                          {isDisqualifiedCol ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#FFDAD6] text-[#93000A] text-[11px] font-semibold tabular-nums">
                              {lead.aiScore}% (مستبعد)
                            </span>
                          ) : lead.aiScore >= 90 ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#6FFBE0] text-[#002113] text-[11px] font-bold shadow-xs tabular-nums">
                              {lead.aiScore}% 🔥
                            </span>
                          ) : lead.aiScore >= 80 ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#DBE1FF] text-[#00174B] text-[11px] font-bold tabular-nums">
                              {lead.aiScore}%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#E2E7FF] text-[#434655] text-[11px] font-semibold tabular-nums">
                              {lead.aiScore}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Phone + Touchpoints Count + Campaign/Source + Last Message Box */}
                      <div className="mt-2 space-y-1.5 pr-5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-medium tabular-nums ${
                              isDisqualifiedCol ? 'text-[#737686]' : 'text-[#131B2E]'
                            }`}
                            dir="ltr"
                          >
                            {lead.phone || '—'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                              isQualifiedCol
                                ? 'bg-[#6FFBE0]/40 text-[#002113]'
                                : isDisqualifiedCol
                                ? 'bg-[#EAEDFF] text-[#737686]'
                                : 'bg-[#EAEDFF] text-[#004AC6]'
                            }`}
                          >
                            <Network className="h-3 w-3 shrink-0" />
                            <span>
                              {tpCount === 1 ? '1 نقطة' : `${tpCount} نقاط اتصال`}
                            </span>
                          </span>
                        </div>

                        <p
                          className={`text-[12px] flex items-center gap-1 truncate ${
                            isDisqualifiedCol ? 'text-[#737686]' : 'text-[#434655]'
                          }`}
                          title={lead.campaign || lead.source}
                        >
                          <Megaphone className="h-3.5 w-3.5 text-[#737686] shrink-0" />
                          <span className="truncate">
                            {lead.campaign || lead.source || 'حملة استقطاب مباشر'}
                          </span>
                        </p>

                        <div className="p-2 rounded-lg bg-[#F2F3FF] border border-[#EAEDFF]">
                          <p className="text-[11.5px] leading-[1.45] text-[#434655] line-clamp-2">
                            <span className="text-[#737686] font-semibold">آخر رسالة:</span>{' '}
                            <span>
                              &quot;{lead.lastMessageSnippet || lead.notes || 'لا توجد رسائل مسجلة بعد'}&quot;
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Bottom Row: Channel Badge + Time + Owner Avatar + 1-Click Chat & Call */}
                      <div className="mt-3 pt-2.5 border-t border-[#EAEDFF] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {renderChannelPill(lead.channel)}
                          <span className="text-[11px] text-[#737686] truncate tabular-nums">
                            {lead.lastActivityLabel || 'الآن'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            title={`المسؤول: ${lead.assignedToName}`}
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-xs ${
                              isDisqualifiedCol
                                ? 'bg-[#E2E8F0] text-[#64748B]'
                                : 'bg-[#DBE1FF] text-[#004AC6]'
                            }`}
                          >
                            {getArabicInitials(lead.assignedToName)}
                          </div>

                          {isDisqualifiedCol ? (
                            <button
                              type="button"
                              disabled={!canUpdateLead}
                              onClick={() => handleStageMove(lead.id, 'جديد')}
                              title="استعادة العميل إلى مرحلة جديد"
                              className="inline-flex items-center gap-1 rounded bg-[#EAEDFF] px-2 py-1 text-[11px] font-medium text-[#434655] hover:bg-[#E2E7FF] transition-colors shadow-xs disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>استعادة</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onQuickChat(lead.id)}
                                title="فتح محادثة فورية"
                                aria-label={`محادثة فورية مع ${lead.fullName}`}
                                className={`p-1.5 rounded-md transition-all flex items-center justify-center shadow-xs ${
                                  isQualifiedCol
                                    ? 'bg-[#EAEDFF] text-[#131B2E] hover:bg-[#E2E7FF]'
                                    : lead.channel === 'whatsapp'
                                    ? 'bg-[#006242] text-[#FFFFFF] hover:opacity-90'
                                    : 'bg-[#4648D4] text-[#FFFFFF] hover:opacity-90'
                                }`}
                              >
                                {lead.channel === 'whatsapp' && !isQualifiedCol ? (
                                  <Send className="h-3.5 w-3.5" />
                                ) : (
                                  <MessageSquare className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onQuickCall ? onQuickCall(lead) : onOpenSplitView(lead.id)
                                }
                                title={lead.phone ? `اتصال هاتفي: ${lead.phone}` : 'فتح ملف العميل'}
                                aria-label={`اتصال هاتفي مع ${lead.fullName}`}
                                className="p-1.5 rounded-md bg-[#EAEDFF] hover:bg-[#E2E7FF] text-[#131B2E] transition-colors flex items-center justify-center shadow-xs"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Full-width Convert Button ONLY on "مؤهل للتحويل" Cards */}
                      {isQualifiedCol && (
                        <div className="mt-2">
                          {lead.converted ? (
                            <div className="w-full py-1.5 px-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-[12px] font-bold flex items-center justify-center gap-1.5">
                              <Check className="h-3.5 w-3.5" />
                              <span>تم التحويل بنجاح</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onConvertLead(lead)}
                              className="w-full py-1.5 px-3 bg-[#006242] hover:bg-[#005236] text-[#FFFFFF] rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                            >
                              <Zap className="h-4 w-4" />
                              <span>⚡ تحويل العميل</span>
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
