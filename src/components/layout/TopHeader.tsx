import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Cloud,
  CloudOff,
  Inbox,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ROUTE_METADATA } from '../../config/navigation';
import { useCrm } from '../../context/CrmContext';

interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
  onOpenQuickDeal: () => void;
  onOpenInbox: () => void;
  onOpenSignals: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenMobileSidebar,
  onOpenCommandPalette,
  onOpenQuickDeal,
  onOpenInbox,
  onOpenSignals,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentUser,
    firebaseUser,
    syncStatus,
    messages,
    signals,
    profiles,
    activeProfile,
    setActiveProfileId,
    signInWithGoogle,
    signOutUser,
  } = useCrm();

  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadMessagesCount = messages.filter((m) => m.unread).length;
  const unreadSignalsCount = signals.filter((s) => s.unread).length;
  const routeMeta = location.pathname.startsWith('/leads/')
    ? { section: 'إدارة الإيرادات', title: 'العملاء المحتملين · ملف العميل' }
    : ROUTE_METADATA[location.pathname] ?? ROUTE_METADATA['/'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setEmployeeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = currentUser.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FFFFFF] px-4 lg:px-6">
      {/* Right Side (RTL start): Mobile menu + Breadcrumb / Search trigger */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="فتح قائمة التنقل"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden xl:flex items-center gap-2 text-[13px] whitespace-nowrap shrink-0">
          <span className="text-[#64748B]">{routeMeta.section}</span>
          <span className="text-[#CBD5E1]" aria-hidden="true">/</span>
          <span className="font-semibold text-[#0F172A]">{routeMeta.title}</span>
        </div>

        {/* Ctrl+K Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="فتح البحث الشامل ولوحة الأوامر"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#94A3B8] hover:bg-[#FFFFFF] transition-colors sm:w-full sm:max-w-sm sm:shrink sm:justify-between sm:gap-2 sm:px-3 text-[13px]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
            <span className="hidden sm:inline truncate">ابحث في العملاء، الصفقات، الفواتير...</span>
          </span>
          <kbd className="hidden md:inline-flex items-center rounded border border-[#E2E8F0] bg-[#FFFFFF] px-1.5 py-0.5 text-[11px] font-semibold text-[#64748B] tabular-nums shrink-0">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Left Side (RTL end): Actions, Sync, Inbox, Signals, Employee Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* + صفقة سريعة */}
        <button
          type="button"
          onClick={onOpenQuickDeal}
          aria-label="إضافة صفقة سريعة"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-2.5 sm:px-3.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] active:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">صفقة سريعة</span>
          <span className="sm:hidden">صفقة</span>
        </button>

        {/* Real-time Sync Status */}
        <button
          type="button"
          onClick={() => {
            if (!firebaseUser) {
              void signInWithGoogle();
            }
          }}
          title={
            firebaseUser
              ? 'متصل بقاعدة بيانات Firestore في الوقت الفعلي'
              : 'وضع المعاينة المحلية — اضغط لتسجيل الدخول ومزامنة السحابة'
          }
          className={`hidden md:inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors ${
            syncStatus === 'cloud'
              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#10B981]'
              : syncStatus === 'offline'
                ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#F43F5E]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]'
          }`}
        >
          {syncStatus === 'offline' ? (
            <CloudOff className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Cloud className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {syncStatus === 'cloud'
              ? 'مزامنة فورية'
              : syncStatus === 'syncing'
                ? 'جاري المزامنة'
                : syncStatus === 'offline'
                  ? 'غير متصل'
                  : 'معاينة محلية'}
          </span>
        </button>

        {/* Unified Omnichannel Inbox Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenInbox}
          aria-label={`صندوق الوارد الموحد (${unreadMessagesCount} غير مقروءة)`}
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors shrink-0"
        >
          <Inbox className="h-4 w-4" />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white tabular-nums">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        {/* Notifications (Signals) Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenSignals}
          aria-label={`الإشعارات والتنبيهات (${unreadSignalsCount} غير مقروءة)`}
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors shrink-0"
        >
          <Bell className="h-4 w-4" />
          {unreadSignalsCount > 0 && (
            <span className="absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold text-white tabular-nums">
              {unreadSignalsCount}
            </span>
          )}
        </button>

        {/* Current Employee Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setEmployeeMenuOpen((prev) => !prev)}
            aria-expanded={employeeMenuOpen}
            aria-label="قائمة الموظف الحالي"
            className="flex h-9 items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2 hover:bg-[#F8FAFC] transition-colors shrink-0"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EFF6FF] text-[11px] font-bold text-[#2563EB]">
                {initials || 'ر'}
              </span>
            )}
            <span className="hidden sm:block max-w-[120px] truncate text-[12px] font-semibold text-[#0F172A]">
              {currentUser.fullName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
          </button>

          {employeeMenuOpen && (
            <div className="absolute left-0 top-11 z-50 w-72 rounded-lg flyout-surface p-2 text-right">
              <div className="border-b border-[#E2E8F0] px-2.5 py-2">
                <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                  {currentUser.fullName}
                </p>
                <p className="text-[12px] text-[#64748B] truncate">{currentUser.email}</p>
                <p className="mt-1 text-[11px] font-medium text-[#2563EB]">
                  {currentUser.jobTitle || 'مدير المبيعات التنفيذي'}
                </p>
              </div>

              <div className="border-b border-[#E2E8F0] px-2.5 py-2">
                <label
                  htmlFor="active-profile-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>ملف الصلاحيات النشط (FLS)</span>
                </label>
                <select
                  id="active-profile-select"
                  value={activeProfile?.id ?? ''}
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  className="input-control w-full px-2.5 py-1.5 text-[12px]"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeMenuOpen(false);
                    navigate('/settings/profiles');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <UserCheck className="h-4 w-4 text-[#64748B]" />
                  <span>إدارة الملفات والصلاحيات</span>
                </button>

                {firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeMenuOpen(false);
                      void signOutUser();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#F43F5E] hover:bg-[#FFF1F2]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeMenuOpen(false);
                      void signInWithGoogle();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>تسجيل الدخول بحساب Google</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
