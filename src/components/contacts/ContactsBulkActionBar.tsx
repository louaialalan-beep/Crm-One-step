import React, { useState } from 'react';
import {
  CheckSquare,
  Edit3,
  GitMerge,
  Tag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type { Contact, ContactStatus, CrmTask } from '../../types/crm';
import { CONTACT_OWNERS, CONTACT_STATUSES } from '../../utils/contactsLogic';

interface ContactsBulkActionBarProps {
  selectedCount: number;
  canUpdateContact: boolean;
  canDeleteContact: boolean;
  onClearSelection: () => void;
  onMassUpdate: (patch: Partial<Contact>) => Promise<void>;
  onBulkTag: (mode: 'add' | 'remove', tag: string) => Promise<void>;
  onBulkCreateTask: (input: {
    title: string;
    priority: CrmTask['priority'];
    dueDate: string;
  }) => Promise<void>;
  onOpenMergeDuplicates: () => void;
  onSoftDeleteSelected: () => Promise<void>;
}

type ActivePopover = 'mass_update' | 'tags' | 'owner' | 'task' | null;

export const ContactsBulkActionBar: React.FC<ContactsBulkActionBarProps> = ({
  selectedCount,
  canUpdateContact,
  canDeleteContact,
  onClearSelection,
  onMassUpdate,
  onBulkTag,
  onBulkCreateTask,
  onOpenMergeDuplicates,
  onSoftDeleteSelected,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [massField, setMassField] = useState<'contactStatus' | 'city' | 'primarySource' | 'notes'>(
    'contactStatus'
  );
  const [massValue, setMassValue] = useState<string>('عميل نشط');

  const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');
  const [tagText, setTagText] = useState('');

  const [ownerValue, setOwnerValue] = useState<string>(CONTACT_OWNERS[0]);

  const [taskTitle, setTaskTitle] = useState('متابعة تجديد أو عرض سعر');
  const [taskPriority, setTaskPriority] = useState<CrmTask['priority']>('عالية');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-18');

  if (selectedCount === 0) return null;

  const togglePopover = (p: ActivePopover) => {
    setActivePopover((prev) => (prev === p ? null : p));
  };

  const handleApplyMassUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (massField === 'contactStatus') {
      await onMassUpdate({ contactStatus: massValue as ContactStatus });
    } else if (massValue.trim()) {
      await onMassUpdate({ [massField]: massValue.trim() });
    }
    setActivePopover(null);
  };

  const handleApplyTags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagText.trim()) return;
    await onBulkTag(tagMode, tagText.trim());
    setTagText('');
    setActivePopover(null);
  };

  const handleApplyOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    await onMassUpdate({ assignedToName: ownerValue });
    setActivePopover(null);
  };

  const handleApplyTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await onBulkCreateTask({
      title: taskTitle.trim(),
      priority: taskPriority,
      dueDate: taskDueDate,
    });
    setActivePopover(null);
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 max-w-[95vw]">
      {activePopover && (
        <div className="flyout-surface mb-2.5 rounded-lg bg-[#FFFFFF] p-3.5 text-[#0F172A] w-full max-w-md mx-auto">
          {activePopover === 'mass_update' && (
            <form onSubmit={handleApplyMassUpdate} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold">
                  تحديث جماعي للحقول ({selectedCount} جهة اتصال)
                </h4>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-[#64748B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={massField}
                  onChange={(e) => {
                    const f = e.target.value as typeof massField;
                    setMassField(f);
                    setMassValue(f === 'contactStatus' ? 'عميل نشط' : '');
                  }}
                  className="input-control h-8 px-2 text-[12px]"
                >
                  <option value="contactStatus">حالة جهة الاتصال</option>
                  <option value="city">المدينة / الدولة</option>
                  <option value="primarySource">المصدر الأساسي</option>
                  <option value="notes">الملاحظات</option>
                </select>
                {massField === 'contactStatus' ? (
                  <select
                    value={massValue}
                    onChange={(e) => setMassValue(e.target.value)}
                    className="input-control h-8 px-2 text-[12px]"
                  >
                    {CONTACT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={massValue}
                    onChange={(e) => setMassValue(e.target.value)}
                    placeholder="القيمة الجديدة..."
                    className="input-control h-8 px-2.5 text-[12px]"
                  />
                )}
              </div>
              <button
                type="submit"
                className="h-8 w-full rounded bg-[#2563EB] text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8]"
              >
                تطبيق التحديث الجماعي
              </button>
            </form>
          )}

          {activePopover === 'tags' && (
            <form onSubmit={handleApplyTags} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold">إدارة الوسوم ({selectedCount} سجل)</h4>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-[#64748B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={tagMode}
                  onChange={(e) => setTagMode(e.target.value as 'add' | 'remove')}
                  className="input-control h-8 px-2 text-[12px]"
                >
                  <option value="add">إضافة وسم</option>
                  <option value="remove">إزالة وسم</option>
                </select>
                <input
                  type="text"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder="مثال: VIP أو تجديد"
                  className="input-control col-span-2 h-8 px-2.5 text-[12px]"
                />
              </div>
              <button
                type="submit"
                disabled={!tagText.trim()}
                className="h-8 w-full rounded bg-[#2563EB] text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                حفظ الوسم
              </button>
            </form>
          )}

          {activePopover === 'owner' && (
            <form onSubmit={handleApplyOwner} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold">تغيير مالك السجلات ({selectedCount})</h4>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-[#64748B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                value={ownerValue}
                onChange={(e) => setOwnerValue(e.target.value)}
                className="input-control h-8 w-full px-2.5 text-[12px]"
              >
                {CONTACT_OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 w-full rounded bg-[#2563EB] text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8]"
              >
                إسناد للمسؤول الجديد
              </button>
            </form>
          )}

          {activePopover === 'task' && (
            <form onSubmit={handleApplyTask} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold">
                  إنشاء مهمة مرتبطة لكل جهة اتصال ({selectedCount})
                </h4>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-[#64748B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="عنوان المهمة..."
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
              <button
                type="submit"
                disabled={!taskTitle.trim()}
                className="h-8 w-full rounded bg-[#2563EB] text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                إنشاء المهام
              </button>
            </form>
          )}
        </div>
      )}

      {/* Floating Dark Bar */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs tabular-nums">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold whitespace-nowrap text-slate-100 tabular-nums">
            تم تحديد {selectedCount} جهات اتصال
          </span>
        </div>

        <div className="h-5 w-px bg-slate-700 shrink-0" />

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-0.5">
          <button
            type="button"
            disabled={!canUpdateContact}
            onClick={() => togglePopover('mass_update')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <Edit3 className="h-3.5 w-3.5 text-blue-400" />
            <span>تحديث جماعي</span>
          </button>

          <button
            type="button"
            disabled={!canUpdateContact}
            onClick={() => togglePopover('tags')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <Tag className="h-3.5 w-3.5 text-indigo-400" />
            <span>إدارة التاغات</span>
          </button>

          <button
            type="button"
            disabled={!canUpdateContact}
            onClick={() => togglePopover('owner')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>تغيير المالك</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover('task')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap"
          >
            <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
            <span>إضافة مهمة</span>
          </button>

          <button
            type="button"
            disabled={selectedCount < 2}
            title={selectedCount < 2 ? 'حدد سجلين على الأقل لدمج التكرارات' : 'دمج السجلات المحددة'}
            onClick={() => {
              if (selectedCount < 2) return;
              setActivePopover(null);
              onOpenMergeDuplicates();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <GitMerge className="h-3.5 w-3.5 text-amber-300" />
            <span>دمج المحدد</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-700 shrink-0" />

        <div className="flex items-center gap-1 shrink-0">
          {canDeleteContact && (
            <button
              type="button"
              onClick={() => void onSoftDeleteSelected()}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-950/40 hover:text-rose-300 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>حذف للسلة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActivePopover(null);
              onClearSelection();
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 whitespace-nowrap"
          >
            <span>إلغاء Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
};
