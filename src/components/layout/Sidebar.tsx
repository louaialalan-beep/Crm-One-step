import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Send,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SIDEBAR_MODULES, type NavModuleItem } from '../../config/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const ICON_MAP: Record<NavModuleItem['iconName'], React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  UserPlus,
  Users,
  Building2,
  Briefcase,
  FileSpreadsheet,
  CheckSquare,
  BarChart3,
  PieChart,
  Settings,
  MessageSquare,
  Send,
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    billing: true,
    tasks: true,
    settings: location.pathname.startsWith('/settings'),
  });

  useEffect(() => {
    if (location.pathname.startsWith('/settings')) {
      setExpandedGroups((prev) => ({ ...prev, settings: true }));
    } else if (['/quotes', '/sales-orders', '/invoices', '/purchase-orders'].includes(location.pathname)) {
      setExpandedGroups((prev) => ({ ...prev, billing: true }));
    } else if (['/tasks', '/activities', '/calendar'].includes(location.pathname)) {
      setExpandedGroups((prev) => ({ ...prev, tasks: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isModuleActive = (mod: NavModuleItem) => {
    if (mod.path === '/') return location.pathname === '/';
    if (mod.id === 'tasks') {
      return (
        location.pathname === '/tasks' ||
        location.pathname === '/activities' ||
        location.pathname === '/calendar'
      );
    }
    if (mod.subItems) {
      return mod.subItems.some((sub) => location.pathname === sub.path);
    }
    return location.pathname === mod.path;
  };

  const renderNavContent = (isMobileDrawer: boolean) => {
    const isRail = collapsed && !isMobileDrawer;

    return (
      <div className="flex h-full flex-col bg-[#FFFFFF]">
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-[#E2E8F0] px-4">
          <NavLink
            to="/"
            onClick={isMobileDrawer ? onCloseMobile : undefined}
            className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2563EB] text-white font-bold text-base">
              ر
            </div>
            {!isRail && (
              <span className="text-[16px] font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
                رواق CRM
              </span>
            )}
          </NavLink>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="إغلاق القائمة الجانبية"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isRail ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
              title={isRail ? 'توسيع القائمة' : 'طي القائمة'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
            >
              {isRail ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav aria-label="التنقل الرئيسي" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {SIDEBAR_MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.iconName];
            const active = isModuleActive(mod);
            const hasChildren = Boolean(mod.subItems && mod.subItems.length > 0);
            const isExpanded = Boolean(expandedGroups[mod.id]);

            return (
              <div key={mod.id} className="space-y-0.5">
                <div className="flex items-center">
                  <NavLink
                    to={mod.path}
                    onClick={isMobileDrawer ? onCloseMobile : undefined}
                    title={isRail ? mod.label : undefined}
                    className={`group flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                        : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-medium'
                    } ${isRail ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        active ? 'text-[#2563EB]' : 'text-[#64748B] group-hover:text-[#0F172A]'
                      }`}
                    />
                    {!isRail && <span className="truncate">{mod.label}</span>}
                  </NavLink>

                  {hasChildren && !isRail && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(mod.id)}
                      aria-expanded={isExpanded}
                      aria-label={`تبديل قائمة ${mod.label}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-150 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>

                {hasChildren && !isRail && isExpanded && (
                  <div className="mr-4 border-r border-[#E2E8F0] pr-2.5 space-y-0.5 py-0.5">
                    {mod.subItems!.map((sub) => {
                      const subActive = location.pathname === sub.path;
                      return (
                        <NavLink
                          key={sub.id}
                          to={sub.path}
                          onClick={isMobileDrawer ? onCloseMobile : undefined}
                          className={`block rounded-md px-2.5 py-1.5 text-[12px] transition-colors whitespace-nowrap truncate ${
                            subActive
                              ? 'bg-[#F8FAFC] text-[#2563EB] font-semibold'
                              : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                          }`}
                        >
                          {sub.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Right Sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(false)}</div>
      </aside>

      {/* Mobile RTL Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0F172A]/40 transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-l border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
