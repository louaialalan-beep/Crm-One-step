import React, { useEffect, useState } from 'react';
import {
  Check,
  FolderPlus,
  Globe,
  Lock,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ReportFolder, ReportSharingConfig } from '../../types/reports';

export interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFolder?: ReportFolder | null;
  onSave: (folder: ReportFolder) => void;
  onDelete?: (folderId: string) => void;
  existingFoldersCount?: number;
}

const AVAILABLE_USERS = [
  { id: 'usr_tareq', name: 'طارق العتيبي', title: 'مدير مبيعات أول' },
  { id: 'usr_sara', name: 'سارة المنصور', title: 'مدير حسابات إقليمي' },
  { id: 'usr_naif', name: 'نايف الحربي', title: 'مدير مبيعات الشركات' },
  { id: 'usr_fahad', name: 'فهد الشمري', title: 'مسؤول كبار الحسابات KAM' },
  { id: 'usr_reem', name: 'ريم القحطاني', title: 'رئيس خدمة ونجاح العملاء' },
];

const AVAILABLE_ROLES = [
  { id: 'role_ceo', name: 'الرئيس التنفيذي / الإدارة العليا (CEO)' },
  { id: 'role_vp_sales', name: 'نائب الرئيس للمبيعات (VP Sales)' },
  { id: 'role_regional_mgr', name: 'مدير مبيعات إقليمي (Regional Manager)' },
  { id: 'role_kam', name: 'مسؤول كبار الحسابات (KAM)' },
  { id: 'role_sdr', name: 'مندوب تأهيل وتوليد العملاء (SDR)' },
];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  initialFolder = null,
  onSave,
  onDelete,
  existingFoldersCount = 7,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [scope, setScope] = useState<ReportSharingConfig['scope']>('everyone');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(['usr_tareq']);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(['role_vp_sales']);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValidationError(null);
    if (initialFolder) {
      setName(initialFolder.name);
      setDescription(initialFolder.description || '');
      setScope(initialFolder.sharing?.scope ?? 'everyone');
      setSelectedUserIds(initialFolder.sharing?.userIds ?? ['usr_tareq']);
      setSelectedRoleIds(initialFolder.sharing?.roleIds ?? ['role_vp_sales']);
    } else {
      setName('');
      setDescription('');
      setScope('everyone');
      setSelectedUserIds(['usr_tareq']);
      setSelectedRoleIds(['role_vp_sales']);
    }
  }, [initialFolder, isOpen]);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('يرجى إدخال اسم المجلد قبل الحفظ.');
      return;
    }
    if (
      scope === 'selected' &&
      selectedUserIds.length === 0 &&
      selectedRoleIds.length === 0
    ) {
      setValidationError('يرجى اختيار مستخدم واحد أو دور وظيفي واحد على الأقل عند تحديد الوصول المخصص.');
      return;
    }

    const folderPayload: ReportFolder = {
      id: initialFolder?.id ?? `folder_custom_${Date.now()}`,
      name: trimmedName.slice(0, 100),
      description: description.trim().slice(0, 260),
      iconName: initialFolder?.iconName ?? 'Folder',
      isSystem: initialFolder?.isSystem ?? false,
      sortOrder: initialFolder?.sortOrder ?? existingFoldersCount + 1,
      sharing: {
        scope,
        userIds: scope === 'selected' ? selectedUserIds : undefined,
        roleIds: scope === 'selected' ? selectedRoleIds : undefined,
      },
    };

    onSave(folderPayload);
    onClose();
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-[1px]"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="folder-modal-title"
                className="text-[16px] font-extrabold text-[#0F172A]"
              >
                {initialFolder ? 'تعديل ومشاركة مجلد التقارير' : 'إنشاء مجلد تقارير جديد'}
              </h2>
              <p className="text-[12px] text-[#64748B]">
                تنظيم التقارير المخصصة وضبط صلاحيات الوصول حسب المستخدمين والأدوار التنظيمية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {validationError && (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[12px] font-bold text-[#DC2626]">
                {validationError}
              </div>
            )}

            {/* Folder Name */}
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                اسم المجلد <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="مثال: تقارير مبيعات القطاع الحكومي الربع الرابع"
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[13px] font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none"
              />
            </div>

            {/* Folder Description */}
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                الوصف
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف مختصر لطبيعة التقارير المحفوظة داخل هذا المجلد والغرض التنفيذي منها..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none"
              />
            </div>

            {/* Accessibility / Sharing Scope */}
            <div className="space-y-3">
              <label className="block text-[12px] font-extrabold text-[#0F172A]">
                صلاحيات الوصول (Accessibility)
              </label>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  {
                    value: 'only_me' as const,
                    label: 'أنا فقط (Only Me)',
                    desc: 'مرئي لك وحدك وللمدير العام',
                    icon: Lock,
                  },
                  {
                    value: 'everyone' as const,
                    label: 'الجميع (Everyone)',
                    desc: 'متاح لكافة أعضاء المؤسسة',
                    icon: Globe,
                  },
                  {
                    value: 'selected' as const,
                    label: 'مستخدمون وأدوار محددة',
                    desc: 'تخصيص دقيق للأدوار والموظفين',
                    icon: Users,
                  },
                ].map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = scope === opt.value;
                  return (
                    <label
                      key={opt.value}
                      onClick={() => setScope(opt.value)}
                      className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-[#2563EB] bg-[#EFF6FF]/60 ring-1 ring-[#2563EB]'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            isSelected
                              ? 'border-[#BFDBFE] bg-[#DBEAFE] text-[#2563EB]'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'
                          }`}
                        >
                          <IconComp className="h-4 w-4" />
                        </div>
                        <input
                          type="radio"
                          name="folder_accessibility"
                          checked={isSelected}
                          onChange={() => setScope(opt.value)}
                          className="h-4 w-4 accent-[#2563EB]"
                        />
                      </div>
                      <div className="mt-2.5">
                        <p className="text-[12px] font-extrabold text-[#0F172A]">
                          {opt.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Dual-List Checklist when scope === 'selected' */}
              {scope === 'selected' && (
                <div className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 sm:grid-cols-2">
                  {/* Column 1: Users */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                        <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                        <span>المستخدمون ({selectedUserIds.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUserIds(
                            selectedUserIds.length === AVAILABLE_USERS.length
                              ? []
                              : AVAILABLE_USERS.map((u) => u.id)
                          )
                        }
                        className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        {selectedUserIds.length === AVAILABLE_USERS.length
                          ? 'إلغاء الكل'
                          : 'تحديد الكل'}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pl-1">
                      {AVAILABLE_USERS.map((user) => {
                        const checked = selectedUserIds.includes(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleUserSelection(user.id)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right transition-colors cursor-pointer ${
                              checked
                                ? 'border-[#BFDBFE] bg-[#EFF6FF]/70 text-[#1E3A8A]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div>
                              <p className="text-[12px] font-bold">{user.name}</p>
                              <p className="text-[10px] text-[#64748B]">{user.title}</p>
                            </div>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                checked
                                  ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                  : 'border-[#CBD5E1] bg-[#FFFFFF]'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 2: Organizational Roles */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                        <span>الأدوار التنظيمية ({selectedRoleIds.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedRoleIds(
                            selectedRoleIds.length === AVAILABLE_ROLES.length
                              ? []
                              : AVAILABLE_ROLES.map((r) => r.id)
                          )
                        }
                        className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        {selectedRoleIds.length === AVAILABLE_ROLES.length
                          ? 'إلغاء الكل'
                          : 'تحديد الكل'}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pl-1">
                      {AVAILABLE_ROLES.map((role) => {
                        const checked = selectedRoleIds.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => toggleRoleSelection(role.id)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right transition-colors cursor-pointer ${
                              checked
                                ? 'border-[#BFDBFE] bg-[#EFF6FF]/70 text-[#1E3A8A]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <span className="text-[11px] font-bold">{role.name}</span>
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                  : 'border-[#CBD5E1] bg-[#FFFFFF]'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Single Sticky Bottom Action Bar */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
            <div>
              {initialFolder && !initialFolder.isSystem && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialFolder.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-[12px] font-extrabold text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف المجلد</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs hover:bg-[#1D4ED8] cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>حفظ المجلد</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
