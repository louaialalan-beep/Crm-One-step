import React, { useMemo } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import {
  CHANNEL_LABELS,
  DEFAULT_DOCKED_FILTER,
  LEAD_OWNERS,
  LEAD_STAGES,
  type DockedFilterCriteria,
  type DockedFilterRule,
  type DynamicRuleField,
  type DynamicRuleOperator,
} from '../../utils/leadsLogic';
import type { LeadChannel, LeadStatus } from '../../types/crm';

interface AdvancedFilterBuilderProps {
  open: boolean;
  moduleKey: 'leads' | 'contacts' | 'accounts' | 'deals';
  filter: DockedFilterCriteria;
  availableTags: string[];
  matchCount: number;
  onChange: (next: DockedFilterCriteria) => void;
  onClose: () => void;
}

const STANDARD_OPERATORS: Array<{ value: DynamicRuleOperator; label: string }> = [
  { value: 'contains', label: 'يحتوي على' },
  { value: 'equals', label: 'يساوي' },
  { value: 'not_equals', label: 'لا يساوي' },
  { value: 'greater_than', label: 'أكبر من' },
  { value: 'less_than', label: 'أصغر من' },
  { value: 'empty', label: 'فارغ' },
];

export const AdvancedFilterBuilder: React.FC<AdvancedFilterBuilderProps> = ({
  open,
  moduleKey,
  filter,
  availableTags,
  matchCount,
  onChange,
  onClose,
}) => {
  const { customFields } = useCrm();

  if (!open) return null;

  // Dynamically link filterable fields with custom fields for this module
  const dynamicFieldOptions = useMemo(() => {
    const base: Array<{ value: string; label: string }> = [
      { value: 'city', label: 'المدينة / الدولة' },
      { value: 'source', label: 'مصدر الاستقطاب الأساسي' },
      { value: 'phone', label: 'رقم الجوال' },
      { value: 'email', label: 'البريد الإلكتروني' },
      { value: 'notes', label: 'الملاحظات' },
      { value: 'channel', label: 'قناة الدخول (Touchpoint Channel)' },
      { value: 'touchpoints_count', label: 'عدد نقاط التماس (Touchpoints Count)' },
      { value: 'campaign_name', label: 'اسم الحملة الإعلانية (Campaign)' },
      { value: 'ad_id', label: 'معرّف الإعلان (AD-ID)' },
      { value: 'utm_source', label: 'مصدر UTM (utm_source)' },
    ];

    if (moduleKey === 'deals') {
      base.push({ value: 'deal_stage', label: 'مرحلة الصفقة' });
      base.push({ value: 'amount', label: 'قيمة الصفقة' });
    } else if (moduleKey === 'contacts') {
      base.push({ value: 'company_name', label: 'الشركة المرتبطة' });
    } else if (moduleKey === 'accounts') {
      base.push({ value: 'annual_revenue', label: 'الإيراد السنوي' });
    }

    const moduleCustoms = customFields.filter((cf) => cf.module === moduleKey);
    for (const cf of moduleCustoms) {
      base.push({ value: cf.fieldKey, label: `${cf.label} (حقل مخصص)` });
    }

    return base;
  }, [customFields, moduleKey]);

  const toggleChannel = (ch: LeadChannel) => {
    const exists = filter.channels.includes(ch);
    onChange({
      ...filter,
      channels: exists ? filter.channels.filter((c) => c !== ch) : [...filter.channels, ch],
    });
  };

  const toggleStage = (st: string) => {
    const exists = filter.stages.includes(st as LeadStatus);
    onChange({
      ...filter,
      stages: exists
        ? filter.stages.filter((s) => s !== st)
        : [...filter.stages, st as LeadStatus],
    });
  };

  const toggleTag = (tag: string) => {
    const exists = filter.tags.includes(tag);
    onChange({
      ...filter,
      tags: exists ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag],
    });
  };

  const addRule = () => {
    const newRule: DockedFilterRule = {
      id: `rule_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      field: dynamicFieldOptions[0]?.value || 'city',
      operator: 'contains',
      value: '',
    };
    onChange({ ...filter, rules: [...filter.rules, newRule] });
  };

  const updateRule = (id: string, patch: Partial<DockedFilterRule>) => {
    onChange({
      ...filter,
      rules: filter.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRule = (id: string) => {
    onChange({
      ...filter,
      rules: filter.rules.filter((r) => r.id !== id),
    });
  };

  const channels = Object.keys(CHANNEL_LABELS) as LeadChannel[];

  return (
    <section
      aria-label="لوحة التصفية المتقدمة الموحدة ومنشئ الشروط الديناميكي"
      className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4 text-[13px]"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-[#0F172A]">
            لوحة التصفية المتقدمة ومنشئ الشروط الديناميكي
          </h2>
          <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-xs">
            <button
              type="button"
              onClick={() => onChange({ ...filter, logicOperator: 'AND' })}
              className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter.logicOperator === 'AND'
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              تطابق جميع الشروط (AND)
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...filter, logicOperator: 'OR' })}
              className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter.logicOperator === 'OR'
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              أي شرط يتحقق (OR)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[#64748B]">
            النتائج المطابقة:{' '}
            <strong className="text-[#2563EB] tabular-nums font-extrabold">{matchCount}</strong>
          </span>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_DOCKED_FILTER)}
            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#64748B] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>إعادة تعيين</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الفلاتر"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Unified Standard Dropdowns Matrix (No Pills) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Owner Dropdown */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#475569]">مالك السجل</label>
          <select
            value={filter.ownerName}
            onChange={(e) => onChange({ ...filter, ownerName: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">جميع مسؤولي المبيعات</option>
            {LEAD_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Status / Stage Dropdown */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#475569]">الحالة أو المرحلة</label>
          <select
            value={filter.stages[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filter,
                stages: val === 'all' ? [] : [val as LeadStatus],
              });
            }}
            className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">جميع الحالات والمراحل</option>
            {LEAD_STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Tags Dropdown */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#475569]">الوسوم (Tags)</label>
          <select
            value={filter.tags[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filter,
                tags: val === 'all' ? [] : [val],
              });
            }}
            className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">جميع الوسوم</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Touchpoints / Channel Dropdown */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#475569]">قناة الدخول (Touchpoints)</label>
          <select
            value={filter.channels[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filter,
                channels: val === 'all' ? [] : [val as LeadChannel],
              });
            }}
            className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">جميع قنوات الاتصال والاستقطاب</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Condition Builder (AND / OR) */}
      <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A]">
              منشئ الشروط الديناميكي المتقدم (حقول مخصصة + حملات + نقاط تماس)
            </h3>
            <p className="text-[11px] text-[#64748B]">
              أضف شروطاً دقيقة تربط بين الحقول الأساسية والمخصصة وقنوات واتساب وحملات إعلانات ميتا (AD-ID / UTM).
            </p>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="px-3.5 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ إضافة شرط تصفية</span>
          </button>
        </div>

        {filter.rules.length > 0 && (
          <div className="space-y-2.5 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
            {filter.rules.map((rule, idx) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-bold text-[#64748B] w-6 text-center">
                  {idx + 1}.
                </span>
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                  aria-label="اختر الحقل"
                  className="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] min-w-[180px] focus:outline-none focus:border-[#2563EB]"
                >
                  {dynamicFieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value as DynamicRuleOperator })}
                  aria-label="المعامل"
                  className="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] min-w-[140px] focus:outline-none focus:border-[#2563EB]"
                >
                  {STANDARD_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {rule.operator !== 'empty' ? (
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="أدخل قيمة الشرط..."
                    aria-label="قيمة الشرط"
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                ) : (
                  <div className="flex-1 text-xs text-[#64748B] italic px-2">
                    (يتم التحقق من كون الحقل فارغاً تلقائياً)
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  aria-label="حذف الشرط"
                  className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
