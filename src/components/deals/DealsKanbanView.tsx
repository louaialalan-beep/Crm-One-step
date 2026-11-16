import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Plus,
  User,
} from 'lucide-react';
import type { Contact, Deal, DealStage, Touchpoint } from '../../types/crm';
import {
  DEAL_KANBAN_COLUMNS,
  getNextAdvanceStage,
  isDealOverdue,
  resolveDealContact,
  resolveDealLastTouchAttribution,
} from '../../utils/dealsLogic';
import { formatCurrencySAR } from '../../utils/formatters';
import { getArabicInitials } from '../leads/LeadChannelIcon';

interface DealsKanbanViewProps {
  deals: Deal[];
  contacts: Contact[];
  touchpoints: Touchpoint[];
  selectedIds: string[];
  onToggleSelect: (dealId: string) => void;
  onRequestStageChange: (deal: Deal, targetStage: DealStage) => void;
  onQuickAddInStage: (stage: DealStage) => void;
  canUpdateDeal: boolean;
  canCreateDeal: boolean;
  canViewAmount: boolean;
}

function getAttributionBadgeStyle(source: string): string {
  if (source.includes('توصية') || source.includes('إحالة') || source.includes('VIP')) {
    return 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]';
  }
  if (source.includes('لينكد') || source.includes('ميتا') || source.includes('Meta')) {
    return 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]';
  }
  if (source.includes('إنستغرام')) {
    return 'bg-[#FDF2F8] border-[#FBCFE8] text-[#DB2777]';
  }
  return 'bg-[#F1F5F9] border-[#E2E8F0] text-[#475569]';
}

export const DealsKanbanView: React.FC<DealsKanbanViewProps> = ({
  deals,
  contacts,
  touchpoints,
  selectedIds,
  onToggleSelect,
  onRequestStageChange,
  onQuickAddInStage,
  canUpdateDeal,
  canCreateDeal,
  canViewAmount,
}) => {
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const selectedSet = new Set(selectedIds);

  return (
    <div
      className="flex gap-2.5 overflow-x-auto pb-4 items-start"
      aria-label="لوحة كانبان لإدارة الصفقات"
    >
      {DEAL_KANBAN_COLUMNS.map((col) => {
        const colDeals = deals.filter((d) => col.matchStages.includes(d.stage));
        const colSum = colDeals.reduce((sum, d) => sum + d.amount, 0);
        const isDropTarget = dragOverColId === col.id;
        const barWidthPercent =
          col.id === 'lost' ? 100 : Math.max(18, col.defaultProbability);

        return (
          <section
            key={col.id}
            aria-label={col.title}
            onDragOver={(e) => {
              if (!canUpdateDeal) return;
              e.preventDefault();
              setDragOverColId(col.id);
            }}
            onDragLeave={() => {
              if (dragOverColId === col.id) setDragOverColId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverColId(null);
              if (!canUpdateDeal) return;
              const droppedId =
                e.dataTransfer.getData('text/plain') || draggingDealId;
              setDraggingDealId(null);
              if (!droppedId) return;
              const draggedDeal = deals.find((d) => d.id === droppedId);
              if (!draggedDeal) return;
              if (col.matchStages.includes(draggedDeal.stage)) return;
              onRequestStageChange(draggedDeal, col.targetStage);
            }}
            className={`w-[248px] shrink-0 xl:w-auto xl:flex-1 xl:min-w-[208px] rounded-2xl border p-2 transition-colors ${
              isDropTarget
                ? 'bg-[#EFF6FF] border-[#2563EB] ring-2 ring-[#2563EB]/20'
                : 'bg-[#F1F5F9]/85 border-[#E2E8F0]'
            }`}
          >
            {/* Column Header */}
            <div className="px-1.5 pt-1 pb-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotColor}`} />
                  <h2 className="text-[13px] font-bold text-[#131b2e] truncate">
                    {col.title}
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#ffffff] border border-[#E2E8F0] text-[10px] font-bold text-[#475569] tabular-nums shrink-0">
                  {col.probabilityLabel}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] tabular-nums">
                <span className="text-[#64748B] font-medium">
                  {colDeals.length} صفقة
                </span>
                <span className="font-bold text-[#334155]">
                  {canViewAmount ? formatCurrencySAR(colSum) : '—'}
                </span>
              </div>

              <div className="h-1 w-full rounded-full bg-[#E2E8F0] overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${col.barColor}`}
                  style={{ width: `${barWidthPercent}%` }}
                />
              </div>
            </div>

            {/* Cards Stack */}
            <div className="space-y-2.5 min-h-[140px]">
              {colDeals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#ffffff]/60 p-5 text-center space-y-2">
                  <p className="text-[11px] font-medium text-[#64748B]">
                    لا توجد صفقات في هذه المرحلة
                  </p>
                  {canCreateDeal && col.id !== 'won' && col.id !== 'lost' && (
                    <button
                      type="button"
                      onClick={() => onQuickAddInStage(col.targetStage)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#ffffff] border border-[#E2E8F0] hover:border-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>إضافة هنا</span>
                    </button>
                  )}
                </div>
              ) : (
                colDeals.map((deal) => {
                  const isSelected = selectedSet.has(deal.id);
                  const contact = resolveDealContact(deal, contacts);
                  const attribution = resolveDealLastTouchAttribution(
                    deal,
                    contacts,
                    touchpoints
                  );
                  const overdue = isDealOverdue(deal);
                  const nextStage = getNextAdvanceStage(deal.stage);

                  return (
                    <article
                      key={deal.id}
                      draggable={canUpdateDeal}
                      onDragStart={(e) => {
                        setDraggingDealId(deal.id);
                        e.dataTransfer.setData('text/plain', deal.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingDealId(null);
                        setDragOverColId(null);
                      }}
                      className={`rounded-xl bg-[#ffffff] border p-3.5 shadow-2xs transition-all space-y-2.5 ${
                        canUpdateDeal ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${
                        isSelected
                          ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                          : 'border-[#E2E8F0] hover:border-[#93C5FD] hover:shadow-sm'
                      } ${draggingDealId === deal.id ? 'opacity-50' : ''}`}
                    >
                      {/* Row 1: Checkbox + Title/Account (Right) | SAR Amount (Left) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(deal.id)}
                            aria-label={`تحديد الصفقة ${deal.title}`}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/deals/${deal.id}`}
                              className="text-[13px] font-bold text-[#131b2e] hover:text-[#2563EB] transition-colors leading-snug line-clamp-2 block"
                            >
                              {deal.title}
                            </Link>
                            <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                              {deal.accountName}
                            </p>
                          </div>
                        </div>

                        <span className="text-[13px] font-extrabold text-[#2563EB] tabular-nums whitespace-nowrap shrink-0">
                          {canViewAmount ? formatCurrencySAR(deal.amount, deal.currency) : 'محجوب'}
                        </span>
                      </div>

                      {/* Row 2: Linked Contact + RWQ-xxxxx Permanent ID Pill */}
                      <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3 w-3 text-[#64748B] shrink-0" />
                          {contact ? (
                            <Link
                              to={`/contacts/${contact.id}`}
                              className="font-medium text-[#334155] hover:text-[#2563EB] truncate flex items-center gap-1"
                            >
                              <span className="truncate">{contact.fullName}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-[#64748B] truncate">عميل مؤسسي مباشر</span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-bold text-[#475569] tabular-nums shrink-0">
                          {deal.leadUniqueId || contact?.leadUniqueId || '—'}
                        </span>
                      </div>

                      {/* Row 3: Last-Touch Attribution + Close Date / Overdue Alert */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold truncate max-w-[140px] ${getAttributionBadgeStyle(
                            attribution
                          )}`}
                          title={`مصدر الإسناد: ${attribution}`}
                        >
                          {attribution}
                        </span>

                        {overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-bold text-[#E11D48] tabular-nums">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>متأخرة · {deal.closeDate}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#475569] tabular-nums">
                            <Calendar className="h-3 w-3 text-[#64748B] shrink-0" />
                            <span>{deal.closeDate}</span>
                          </span>
                        )}
                      </div>

                      {/* Row 4: Footer -> Owner Avatar + Blueprint Next Step | 1-Click Advance Arrow */}
                      <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            title={deal.ownerName}
                            className="w-6 h-6 rounded-full bg-[#2563EB] text-[#ffffff] text-[10px] font-bold flex items-center justify-center shrink-0"
                          >
                            {getArabicInitials(deal.ownerName)}
                          </span>
                          <span
                            title={deal.nextStep || 'متابعة المرحلة الحالية'}
                            className="text-[11px] text-[#475569] truncate"
                          >
                            {deal.nextStep || 'متابعة المرحلة الحالية'}
                          </span>
                        </div>

                        {nextStage && canUpdateDeal ? (
                          <button
                            type="button"
                            onClick={() => onRequestStageChange(deal, nextStage)}
                            aria-label={`نقل ${deal.title} إلى ${nextStage}`}
                            title={`ترقية الصفقة إلى: ${nextStage}`}
                            className="w-7 h-7 rounded-lg border border-transparent hover:border-[#BFDBFE] hover:bg-[#EFF6FF] text-[#475569] hover:text-[#2563EB] flex items-center justify-center transition-colors shrink-0"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                        ) : (
                          <Link
                            to={`/deals/${deal.id}`}
                            title="عرض تفاصيل الصفقة"
                            className="text-[10px] font-semibold text-[#2563EB] hover:underline shrink-0"
                          >
                            التفاصيل
                          </Link>
                        )}
                      </div>
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
