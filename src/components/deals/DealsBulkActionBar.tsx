import React, { useState } from 'react';
import { Trash2, UserCheck, X } from 'lucide-react';
import type { DealStage } from '../../types/crm';
import { DEAL_OWNERS, getDealColumnForStage } from '../../utils/dealsLogic';

interface DealsBulkActionBarProps {
  selectedCount: number;
  canUpdate: boolean;
  canDelete: boolean;
  onClearSelection: () => void;
  onBulkUpdateStage: (stage: DealStage, probability: number) => Promise<void>;
  onBulkAssignOwner: (ownerName: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

const BULK_SAFE_STAGES: DealStage[] = [
  'تأهيل مبدئي',
  'تحديد الاحتياج',
  'عرض سعر',
];

export const DealsBulkActionBar: React.FC<DealsBulkActionBarProps> = ({
  selectedCount,
  canUpdate,
  canDelete,
  onClearSelection,
  onBulkUpdateStage,
  onBulkAssignOwner,
  onBulkDelete,
}) => {
  const [ownerValue, setOwnerValue] = useState(DEAL_OWNERS[0]);
  const [stageValue, setStageValue] = useState<DealStage>('عرض سعر');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94vw] rounded-2xl bg-[#131b2e] text-[#ffffff] px-4 py-3 shadow-2xl border border-[#334155] flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="px-2.5 py-1 rounded-lg bg-[#2563EB] text-[12px] font-bold tabular-nums">
          {selectedCount} محددة
        </span>
        <span className="text-[12px] text-[#CBD5E1]">إجراءات جماعية للصفقات</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {canUpdate && (
          <>
            <div className="flex items-center gap-1.5 bg-[#1E293B] rounded-xl px-2 py-1 border border-[#334155]">
              <select
                value={stageValue}
                onChange={(e) => setStageValue(e.target.value as DealStage)}
                aria-label="تغيير المرحلة جماعياً"
                className="bg-transparent text-[11px] font-semibold text-[#ffffff] focus:outline-none"
              >
                {BULK_SAFE_STAGES.map((st) => (
                  <option key={st} value={st} className="text-[#131b2e]">
                    {st}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onBulkUpdateStage(
                    stageValue,
                    getDealColumnForStage(stageValue).defaultProbability
                  )
                }
                className="rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                نقل المرحلة
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-[#1E293B] rounded-xl px-2 py-1 border border-[#334155]">
              <UserCheck className="h-3.5 w-3.5 text-[#93C5FD]" />
              <select
                value={ownerValue}
                onChange={(e) => setOwnerValue(e.target.value)}
                aria-label="إسناد المسؤول جماعياً"
                className="bg-transparent text-[11px] font-semibold text-[#ffffff] focus:outline-none"
              >
                {DEAL_OWNERS.map((owner) => (
                  <option key={owner} value={owner} className="text-[#131b2e]">
                    {owner}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onBulkAssignOwner(ownerValue)}
                className="rounded-lg bg-[#334155] hover:bg-[#475569] px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                تعيين
              </button>
            </div>
          </>
        )}

        {canDelete && (
          <>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 bg-[#881337] rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-semibold">نقل إلى سلة المحذوفات؟</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkDelete();
                    setConfirmDelete(false);
                  }}
                  className="rounded-lg bg-[#E11D48] px-2 py-0.5 text-[11px] font-bold hover:bg-[#BE123C]"
                >
                  تأكيد
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] text-[#FECDD3] px-1.5"
                >
                  تراجع
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#E11D48]/15 hover:bg-[#E11D48]/25 border border-[#FB7185]/40 text-[#FDA4AF] px-3 py-1.5 text-[11px] font-semibold transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف</span>
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          aria-label="إلغاء التحديد"
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#ffffff] hover:bg-[#1E293B]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
