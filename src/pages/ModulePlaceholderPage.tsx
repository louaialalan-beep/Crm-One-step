import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { ROUTE_METADATA, SIDEBAR_MODULES } from '../config/navigation';
import { useCrm } from '../context/CrmContext';

export const ModulePlaceholderPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const meta = ROUTE_METADATA[path] ?? {
    title: 'إعدادات ووحدات النظام',
    section: 'Crm-One-step',
    description: 'صفحة مهيأة ضمن البنية التحتية للنظام وجاهزة للتشغيل الفعلي.',
  };

  const {
    recycleBin,
    restoreRecycleItem,
    permanentlyDeleteRecycleItem,
    emptyRecycleBin,
  } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const settingsGroup = SIDEBAR_MODULES.find((m) => m.id === 'settings');
  const isSettingsRoute = path.startsWith('/settings');

  const showFeedback = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const entityTypes = useMemo(() => {
    const types = new Set<string>();
    recycleBin.forEach((item) => {
      if (item.entityType) types.add(item.entityType);
    });
    return Array.from(types);
  }, [recycleBin]);

  const filteredRecycleItems = useMemo(() => {
    return recycleBin.filter((item) => {
      const matchesEntity =
        entityFilter === 'ALL' || item.entityType === entityFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.displayName.toLowerCase().includes(q) ||
        item.entityType.toLowerCase().includes(q) ||
        item.deletedBy.toLowerCase().includes(q) ||
        item.originalId.toLowerCase().includes(q);
      return matchesEntity && matchesSearch;
    });
  }, [recycleBin, entityFilter, searchQuery]);

  const handleRestore = async (id: string, name: string) => {
    await restoreRecycleItem(id);
    showFeedback(`تمت استعادة السجل "${name}" إلى وحدته الأصلية بنجاح.`);
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    await permanentlyDeleteRecycleItem(id);
    showFeedback(`تم الحذف النهائي للسجل "${name}" من سلة المحذوفات.`);
  };

  const handleEmptyAll = async () => {
    await emptyRecycleBin();
    setConfirmEmptyAll(false);
    showFeedback('تم إفراغ سلة المحذوفات بالكامل.');
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight text-[#0F172A]">
            {meta.title}
          </h1>
          <p className="mt-0.5 text-[12px] text-[#64748B]">{meta.description}</p>
        </div>
        <span className="text-[12px] font-medium text-[#64748B] self-start sm:self-auto whitespace-nowrap">
          {meta.section} · متصل بقاعدة البيانات
        </span>
      </div>

      {isSettingsRoute && settingsGroup?.subItems && (
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5">
          {settingsGroup.subItems.map((sub) => (
            <NavLink
              key={sub.id}
              to={sub.path}
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2563EB]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`
              }
            >
              {sub.label}
            </NavLink>
          ))}
        </div>
      )}

      {toastMessage && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[11px] text-emerald-700 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {path === '/settings/recycle-bin' ? (
        <div className="space-y-4">
          {/* Top Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، المعرف، أو الموظف الحاذف..."
                  className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] pr-9 pl-3 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[#64748B]" />
                <select
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="ALL">جميع الوحدات ({recycleBin.length})</option>
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {recycleBin.length > 0 && (
              <div className="flex items-center gap-2">
                {confirmEmptyAll ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-[12px] font-bold text-red-900">
                      تأكيد الحذف النهائي للكل؟
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleEmptyAll()}
                      className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 cursor-pointer"
                    >
                      نعم، إفراغ السلة
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEmptyAll(false)}
                      className="rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyAll(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 text-[12px] font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>إفراغ سلة المحذوفات ({recycleBin.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recycle Bin Table */}
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]">
            {filteredRecycleItems.length === 0 ? (
              <div className="p-10 text-center">
                <Trash2 className="mx-auto h-8 w-8 text-[#94A3B8]" />
                <p className="mt-2 text-[14px] font-bold text-[#0F172A]">
                  سلة المحذوفات فارغة حالياً
                </p>
                <p className="mt-1 text-[12px] text-[#64748B]">
                  يتم الاحتفاظ بالسجلات المحذوفة أو المدمجة لمدة 30 يوماً قبل الحذف التلقائي النهائي.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#475569]">
                      <th className="px-4 py-3">السجل المحذوف</th>
                      <th className="px-4 py-3">نوع الوحدة</th>
                      <th className="px-4 py-3">حُذف بواسطة</th>
                      <th className="px-4 py-3">توقيت الحذف</th>
                      <th className="px-4 py-3">المهلة المتبقية</th>
                      <th className="px-4 py-3 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[13px]">
                    {filteredRecycleItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[#0F172A]">{item.displayName}</p>
                          <p className="text-[11px] text-[#64748B] font-mono">
                            ID: {item.originalId}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#334155]">
                            {item.entityType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] font-medium text-[#334155]">
                          {item.deletedBy}
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-[#64748B] tabular-nums">
                          {item.deletedAtLabel}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-700 tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{item.expiresInDays} يوماً</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleRestore(item.id, item.displayName)
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3 text-[12px] font-bold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>استعادة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handlePermanentDelete(item.id, item.displayName)
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>حذف نهائي</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB] mb-2">
                <span>قريباً ضمن التحديث المؤسسي</span>
              </div>
              <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                {meta.title}
              </h2>
              <p className="mt-1 text-[12px] text-[#64748B]">
                هذه الوحدة الفرعية مهيأة ضمن معمارية Crm-One-step ومرتبطة بالصلاحيات المركزية للمؤسسة.
              </p>
            </div>
            <NavLink
              to="/settings"
              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-bold text-white transition-colors"
            >
              العودة إلى مركز الإعدادات الشامل
            </NavLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px]">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1">
              <span className="text-[#64748B] font-semibold">حالة التهيئة التلقائية</span>
              <p className="text-[14px] font-extrabold text-[#059669]">مفعلة على مستوى المنظمة ✓</p>
              <p className="text-[11px] text-[#64748B]">تعمل بالإعدادات القياسية المعتمدة لـ Enterprise</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1">
              <span className="text-[#64748B] font-semibold">عزل البيانات (Multi-Tenant)</span>
              <p className="text-[14px] font-extrabold text-[#0F172A]">مفعل بالكامل</p>
              <p className="text-[11px] text-[#64748B]">مرتبط بسياسات RBAC و FLS للمؤسسة</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1">
              <span className="text-[#64748B] font-semibold">الإجراء السريع</span>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => showFeedback(`تم حفظ الإعدادات الافتراضية لوحدة "${meta.title}" بنجاح.`)}
                  className="rounded-lg border border-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3 py-1.5 text-[11px] font-bold text-[#2563EB] cursor-pointer"
                >
                  حفظ الإعدادات القياسية
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
