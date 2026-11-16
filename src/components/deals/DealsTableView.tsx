import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import type { Contact, Deal, DealStage, Touchpoint } from '../../types/crm';
import {
  getDealColumnForStage,
  getNextAdvanceStage,
  isDealOverdue,
  resolveDealContact,
  resolveDealLastTouchAttribution,
} from '../../utils/dealsLogic';
import { DEAL_STAGES_ORDER, formatCurrencySAR } from '../../utils/formatters';
import { getArabicInitials } from '../leads/LeadChannelIcon';

interface DealsTableViewProps {
  deals: Deal[];
  contacts: Contact[];
  touchpoints: Touchpoint[];
  selectedIds: string[];
  onToggleSelect: (dealId: string) => void;
  onToggleSelectAll: () => void;
  onRequestStageChange: (deal: Deal, targetStage: DealStage) => void;
  onDeleteDeal: (dealId: string) => void;
  canUpdateDeal: boolean;
  canDeleteDeal: boolean;
  canViewAmount: boolean;
}

const STAGE_BADGE_CLASS: Record<DealStage, string> = {
  'تأهيل مبدئي': 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]',
  'تحديد الاحتياج': 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5]',
  'عرض سعر': 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]',
  تفاوض: 'bg-[#EFF6FF] border-[#93C5FD] text-[#1D4ED8]',
  مكتملة: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]',
  خسارة: 'bg-[#FFF1F2] border-[#FECDD3] text-[#E11D48]',
};

export const DealsTableView: React.FC<DealsTableViewProps> = ({
  deals,
  contacts,
  touchpoints,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRequestStageChange,
  onDeleteDeal,
  canUpdateDeal,
  canDeleteDeal,
  canViewAmount,
}) => {
  const selectedSet = new Set(selectedIds);
  const allSelected = deals.length > 0 && deals.every((d) => selectedSet.has(d.id));

  if (deals.length === 0) {
    return (
      <div className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-12 text-center space-y-2">
        <p className="text-[14px] font-bold text-[#131b2e]">
          لا توجد صفقات مطابقة لمعايير التصفية الحالية
        </p>
        <p className="text-[12px] text-[#64748B]">
          جرب تغيير مسار المبيعات أو إعادة ضبط الفلاتر السريعة.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B]">
              <th className="px-2 py-2.5 w-8 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label="تحديد جميع الصفقات"
                  className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                />
              </th>
              <th className="px-2 py-2.5">الصفقة والمنشأة</th>
              <th className="px-2 py-2.5">جهة الاتصال والمعرف</th>
              <th className="px-2 py-2.5 whitespace-nowrap">القيمة المالية</th>
              <th className="px-2 py-2.5">المرحلة</th>
              <th className="px-1.5 py-2.5 text-center whitespace-nowrap">الاحتمال</th>
              <th className="px-2 py-2.5 whitespace-nowrap">تاريخ الإغلاق</th>
              <th className="px-2 py-2.5">الإسناد</th>
              <th className="px-2 py-2.5">المسؤول</th>
              <th className="px-2 py-2.5 text-center whitespace-nowrap">إجراءات</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F1F5F9] text-xs">
            {deals.map((deal) => {
              const isSelected = selectedSet.has(deal.id);
              const contact = resolveDealContact(deal, contacts);
              const attribution = resolveDealLastTouchAttribution(
                deal,
                contacts,
                touchpoints
              );
              const overdue = isDealOverdue(deal);
              const nextStage = getNextAdvanceStage(deal.stage);
              const colInfo = getDealColumnForStage(deal.stage);

              return (
                <tr
                  key={deal.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-[#EFF6FF]/60' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(deal.id)}
                      aria-label={`تحديد ${deal.title}`}
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                  </td>

                  <td className="px-2 py-2.5 max-w-[185px]">
                    <Link
                      to={`/deals/${deal.id}`}
                      className="font-bold text-[#131b2e] hover:text-[#2563EB] transition-colors block truncate"
                    >
                      {deal.title}
                    </Link>
                    <span className="text-[11px] text-[#64748B] block truncate">
                      {deal.accountName}
                    </span>
                  </td>

                  <td className="px-2 py-2.5 max-w-[140px]">
                    <div className="flex flex-col gap-0.5">
                      {contact ? (
                        <Link
                          to={`/contacts/${contact.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#334155] hover:text-[#2563EB] truncate"
                        >
                          <span className="truncate">{contact.fullName}</span>
                          <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                        </Link>
                      ) : (
                        <span className="text-[#64748B]">حساب مؤسسي</span>
                      )}
                      <span className="font-mono text-[10px] font-bold text-[#475569] tabular-nums">
                        {deal.leadUniqueId || contact?.leadUniqueId || '—'}
                      </span>
                    </div>
                  </td>

                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <span className="font-extrabold text-[#2563EB] tabular-nums">
                      {canViewAmount
                        ? formatCurrencySAR(deal.amount, deal.currency)
                        : 'محجوب (FLS)'}
                    </span>
                  </td>

                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {canUpdateDeal ? (
                      <select
                        value={deal.stage}
                        onChange={(e) => {
                          const target = e.target.value as DealStage;
                          if (target !== deal.stage) {
                            onRequestStageChange(deal, target);
                          }
                        }}
                        aria-label={`تغيير مرحلة ${deal.title}`}
                        className={`rounded-lg border px-1.5 py-1 text-[11px] font-bold focus:outline-none cursor-pointer ${STAGE_BADGE_CLASS[deal.stage]}`}
                      >
                        {DEAL_STAGES_ORDER.map((st) => (
                          <option key={st} value={st} className="bg-[#ffffff] text-[#131b2e]">
                            {st}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-bold ${STAGE_BADGE_CLASS[deal.stage]}`}
                      >
                        {deal.stage}
                      </span>
                    )}
                  </td>

                  <td className="px-1.5 py-2.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-bold text-[#334155] tabular-nums">
                      {deal.probability ?? colInfo.defaultProbability}%
                    </span>
                  </td>

                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {overdue ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-1.5 py-0.5 text-[11px] font-bold text-[#E11D48] tabular-nums">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{deal.closeDate}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#475569] tabular-nums">
                        <Calendar className="h-3 w-3 text-[#94A3B8]" />
                        <span>{deal.closeDate}</span>
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-2.5 max-w-[125px]">
                    <span className="inline-flex rounded-md bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 text-[10.5px] font-medium text-[#334155] truncate max-w-full">
                      {attribution}
                    </span>
                  </td>

                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#2563EB] text-[#ffffff] text-[9.5px] font-bold flex items-center justify-center shrink-0">
                        {getArabicInitials(deal.ownerName)}
                      </span>
                      <span className="text-[11px] font-medium text-[#334155]">
                        {deal.ownerName}
                      </span>
                    </div>
                  </td>

                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5">
                      {nextStage && canUpdateDeal && (
                        <button
                          type="button"
                          onClick={() => onRequestStageChange(deal, nextStage)}
                          title={`ترقية إلى ${nextStage}`}
                          className="p-1 rounded-lg text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDeleteDeal && (
                        <button
                          type="button"
                          onClick={() => onDeleteDeal(deal.id)}
                          title="نقل إلى سلة المحذوفات"
                          className="p-1 rounded-lg text-[#94A3B8] hover:text-[#E11D48] hover:bg-[#FFF1F2] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
};
