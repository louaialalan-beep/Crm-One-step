import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { ROUTE_METADATA, SIDEBAR_MODULES } from '../config/navigation';
import { useCrm } from '../context/CrmContext';

export const ModulePlaceholderPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const meta = ROUTE_METADATA[path] ?? {
    title: 'إعدادات ووحدات النظام',
    section: 'رواق CRM',
    description: 'صفحة مهيأة ضمن البنية التحتية للنظام وجاهزة للتشغيل الفعلي.',
  };

  const { recycleBin, restoreRecycleItem } = useCrm();
  const settingsGroup = SIDEBAR_MODULES.find((m) => m.id === 'settings');
  const isSettingsRoute = path.startsWith('/settings');

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

      {path === '/settings/recycle-bin' ? (
        <div className="card-surface rounded-xl divide-y divide-[#E2E8F0] bg-[#FFFFFF] border border-[#E2E8F0]">
          {recycleBin.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#64748B]">
              سلة المحذوفات فارغة حالياً.
            </div>
          ) : (
            recycleBin.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-[14px] font-bold text-[#0F172A]">
                    {item.displayName}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#64748B] tabular-nums">
                    {item.entityType} · حذف بواسطة {item.deletedBy} ({item.deletedAtLabel}) · متبقي{' '}
                    {item.expiresInDays} يوماً
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void restoreRecycleItem(item.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>استعادة</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsGroup?.subItems?.slice(1).map((sub) => (
            <NavLink
              key={sub.id}
              to={sub.path}
              className="card-surface rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 hover:border-[#2563EB] transition-colors"
            >
              <p className="text-[14px] font-bold text-[#0F172A]">{sub.label}</p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                {ROUTE_METADATA[sub.path]?.description}
              </p>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};
