import React from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import type { DealStage } from '../../types/crm';
import {
  DEFAULT_DEAL_DOCKED_FILTER,
  type DealDockedFilterCriteria,
} from '../../utils/dealsLogic';
import { DEAL_STAGES_ORDER } from '../../utils/formatters';

interface DealsDockedFilterPanelProps {
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  criteria: DealDockedFilterCriteria;
  onChangeCriteria: (next: DealDockedFilterCriteria) => void;
  availableOwners: string[];
  availableAttributions: string[];
  onClose: () => void;
}

export const DealsDockedFilterPanel: React.FC<DealsDockedFilterPanelProps> = ({
  searchQuery,
  onChangeSearchQuery,
  criteria,
  onChangeCriteria,
  availableOwners,
  availableAttributions,
  onClose,
}) => {
  const toggleStage = (stage: DealStage) => {
    const exists = criteria.stages.includes(stage);
    onChangeCriteria({
      ...criteria,
      stages: exists
        ? criteria.stages.filter((s) => s !== stage)
        : [...criteria.stages, stage],
    });
  };

  const handleReset = () => {
    onChangeSearchQuery('');
    onChangeCriteria(DEFAULT_DEAL_DOCKED_FILTER);
  };

  return (
    <section
      aria-label="فلاتر الصفقات المتقدمة"
      className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-4 shadow-2xs space-y-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-[#131b2e]">
            تخصيص فلاتر الصفقات والفرص
          </h2>
          <span className="text-[11px] text-[#64748B]">
            تصفية لحظية عبر السحابة والمراحل والمصادر
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#475569] transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>إعادة ضبط</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الفلاتر"
            className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#131b2e]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div>
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            بحث في الصفقات
          </label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="اسم الصفقة، الشركة، RWQ..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] pr-8 pl-2.5 py-1.5 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
            />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            مسؤول الصفقة
          </label>
          <select
            value={criteria.ownerName}
            onChange={(e) =>
              onChangeCriteria({ ...criteria, ownerName: e.target.value })
            }
            className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="all">جميع مسؤولي المبيعات</option>
            {availableOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        {/* Last-Touch Attribution */}
        <div>
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            مصدر الإسناد (Last-Touch)
          </label>
          <select
            value={criteria.attributionSource}
            onChange={(e) =>
              onChangeCriteria({ ...criteria, attributionSource: e.target.value })
            }
            className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px] text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="all">جميع المصادر والحملات</option>
            {availableAttributions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        {/* Min Amount */}
        <div>
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            الحد الأدنى للقيمة (ر.س)
          </label>
          <input
            type="number"
            min={0}
            value={criteria.minAmount}
            onChange={(e) =>
              onChangeCriteria({ ...criteria, minAmount: e.target.value })
            }
            placeholder="مثال: 100000"
            className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px] text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
          />
        </div>

        {/* Max Amount */}
        <div>
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            الحد الأقصى للقيمة (ر.س)
          </label>
          <input
            type="number"
            min={0}
            value={criteria.maxAmount}
            onChange={(e) =>
              onChangeCriteria({ ...criteria, maxAmount: e.target.value })
            }
            placeholder="مثال: 900000"
            className="w-full rounded-lg border border-[#CBD5E1] bg-[#ffffff] px-2.5 py-1.5 text-[12px] text-[#131b2e] tabular-nums focus:border-[#2563EB] focus:outline-none"
          />
        </div>
      </div>

      {/* Stage Multi-select Chips */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="text-[11px] font-semibold text-[#64748B]">المراحل:</span>
        {DEAL_STAGES_ORDER.map((stage) => {
          const active = criteria.stages.includes(stage);
          return (
            <button
              key={stage}
              type="button"
              onClick={() => toggleStage(stage)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                active
                  ? 'bg-[#2563EB] border-[#2563EB] text-[#ffffff]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'
              }`}
            >
              {stage}
            </button>
          );
        })}
      </div>
    </section>
  );
};
