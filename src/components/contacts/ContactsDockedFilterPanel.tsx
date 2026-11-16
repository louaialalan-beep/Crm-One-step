import React from 'react';
import { Briefcase, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { ContactStatus, LeadChannel } from '../../types/crm';
import {
  CONTACT_OWNERS,
  CONTACT_STATUSES,
  DEFAULT_CONTACT_DOCKED_FILTER,
  type ContactDockedFilterCriteria,
  type ContactDockedFilterRule,
  type ContactRuleField,
  type ContactRuleOperator,
} from '../../utils/contactsLogic';
import { CHANNEL_LABELS } from '../../utils/leadsLogic';

interface ContactsDockedFilterPanelProps {
  open: boolean;
  filter: ContactDockedFilterCriteria;
  availableTags: string[];
  matchCount: number;
  onChange: (next: ContactDockedFilterCriteria) => void;
  onClose: () => void;
}

const RULE_FIELD_OPTIONS: Array<{ value: ContactRuleField; label: string }> = [
  { value: 'accountName', label: 'المنشأة / الشركة' },
  { value: 'city', label: 'المدينة / الدولة' },
  { value: 'primarySource', label: 'المصدر الأساسي' },
  { value: 'phone', label: 'رقم الجوال' },
  { value: 'email', label: 'البريد الإلكتروني' },
  { value: 'notes', label: 'الملاحظات' },
];

const RULE_OPERATOR_OPTIONS: Array<{ value: ContactRuleOperator; label: string }> = [
  { value: 'contains', label: 'يحتوي على' },
  { value: 'equals', label: 'يساوي' },
];

export const ContactsDockedFilterPanel: React.FC<ContactsDockedFilterPanelProps> = ({
  open,
  filter,
  availableTags,
  matchCount,
  onChange,
  onClose,
}) => {
  if (!open) return null;

  const toggleChannel = (ch: LeadChannel) => {
    const exists = filter.channels.includes(ch);
    onChange({
      ...filter,
      channels: exists ? filter.channels.filter((c) => c !== ch) : [...filter.channels, ch],
    });
  };

  const toggleStatus = (st: ContactStatus) => {
    const exists = filter.statuses.includes(st);
    onChange({
      ...filter,
      statuses: exists ? filter.statuses.filter((s) => s !== st) : [...filter.statuses, st],
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
    const newRule: ContactDockedFilterRule = {
      id: `c_rule_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      field: 'city',
      operator: 'contains',
      value: '',
    };
    onChange({ ...filter, rules: [...filter.rules, newRule] });
  };

  const updateRule = (id: string, patch: Partial<ContactDockedFilterRule>) => {
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
      aria-label="لوحة التصفية المتقدمة لجهات الاتصال"
      className="card-surface rounded-lg bg-[#FFFFFF] p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-[#0F172A]">التصفية المتقدمة لجهات الاتصال</h2>
          <div className="inline-flex items-center rounded border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChange({ ...filter, logicOperator: 'AND' })}
              className={`rounded px-2 py-0.5 font-semibold ${
                filter.logicOperator === 'AND'
                  ? 'bg-[#2563EB] text-[#FFFFFF]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              تطابق الكل (AND)
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...filter, logicOperator: 'OR' })}
              className={`rounded px-2 py-0.5 font-semibold ${
                filter.logicOperator === 'OR'
                  ? 'bg-[#2563EB] text-[#FFFFFF]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              أي شرط (OR)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#64748B]">
            النتائج المطابقة:{' '}
            <strong className="text-[#2563EB] tabular-nums">{matchCount}</strong>
          </span>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CONTACT_DOCKED_FILTER)}
            className="inline-flex h-7 items-center gap-1 rounded border border-[#E2E8F0] px-2 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>إعادة تعيين</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الفلاتر"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Channels */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#64748B]">قنوات التواصل</p>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((ch) => {
              const active = filter.channels.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-semibold'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {CHANNEL_LABELS[ch]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact Statuses */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#64748B]">حالة جهة الاتصال</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTACT_STATUSES.map((st) => {
              const active = filter.statuses.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleStatus(st)}
                  className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-semibold'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Owner & Linked Deals Filter */}
        <div className="space-y-2">
          <div>
            <label
              htmlFor="contact-docked-owner"
              className="block text-[11px] font-semibold text-[#64748B] mb-1"
            >
              مالك السجل
            </label>
            <select
              id="contact-docked-owner"
              value={filter.ownerName}
              onChange={(e) => onChange({ ...filter, ownerName: e.target.value })}
              className="input-control h-8 w-full px-2.5 text-[12px]"
            >
              <option value="all">جميع المسؤولين</option>
              {CONTACT_OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="contact-docked-deals"
              className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B] mb-1"
            >
              <Briefcase className="h-3 w-3" />
              <span>حالة الصفقات المرتبطة</span>
            </label>
            <select
              id="contact-docked-deals"
              value={filter.dealFilter}
              onChange={(e) =>
                onChange({
                  ...filter,
                  dealFilter: e.target.value as ContactDockedFilterCriteria['dealFilter'],
                })
              }
              className="input-control h-8 w-full px-2.5 text-[12px]"
            >
              <option value="all">جميع جهات الاتصال</option>
              <option value="has_open">لديهم صفقات مفتوحة</option>
              <option value="purchased">عملاء اشتروا فعلاً (صفقة مكتملة)</option>
              <option value="no_deals">بدون صفقات حالية</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#64748B]">الوسوم</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.slice(0, 8).map((tag) => {
              const active = filter.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#6366F1] bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#FFFFFF]'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Field Rules */}
      <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[#64748B]">شروط الحقول المخصصة</p>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1 rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]"
          >
            <Plus className="h-3 w-3" />
            <span>إضافة شرط</span>
          </button>
        </div>

        {filter.rules.length > 0 && (
          <div className="space-y-2">
            {filter.rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={rule.field}
                  onChange={(e) =>
                    updateRule(rule.id, { field: e.target.value as ContactRuleField })
                  }
                  aria-label="حقل الشرط"
                  className="input-control h-8 px-2.5 text-[12px]"
                >
                  {RULE_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) =>
                    updateRule(rule.id, { operator: e.target.value as ContactRuleOperator })
                  }
                  aria-label="معامل المقارنة"
                  className="input-control h-8 px-2.5 text-[12px]"
                >
                  {RULE_OPERATOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder="أدخل القيمة..."
                  aria-label="قيمة الشرط"
                  className="input-control h-8 flex-1 min-w-[160px] px-2.5 text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  aria-label="حذف الشرط"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:bg-[#FFF1F2] hover:text-[#F43F5E]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
