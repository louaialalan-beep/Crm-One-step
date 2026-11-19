import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  CreditCard,
  Inbox,
  LogIn,
  LogOut,
  Menu,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ROUTE_METADATA } from '../../config/navigation';
import { useCrm } from '../../context/CrmContext';
import { OrganizationPlan } from '../../types/crm';

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
    roles,
    activeRole,
    setActiveRoleId,
    organizations,
    currentOrgId,
    currentOrganization,
    switchOrganization,
    provisionNewOrganization,
    isPreviewMode,
    exitPreviewMode,
    signInWithGoogle,
    signOutUser,
  } = useCrm();

  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<OrganizationPlan>('Enterprise');
  const [isProvisioning, setIsProvisioning] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

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
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setOrgMenuOpen(false);
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

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsProvisioning(true);
    try {
      await provisionNewOrganization(newOrgName.trim(), newOrgPlan);
      setNewOrgName('');
      setShowProvisionModal(false);
      setOrgMenuOpen(false);
    } finally {
      setIsProvisioning(false);
    }
  };

  const planBadgeColor =
    currentOrganization.plan === 'Enterprise'
      ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
      : currentOrganization.plan === 'Pro'
        ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
        : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 sm:gap-5 lg:gap-7 border-b border-[#E2E8F0] bg-[#FFFFFF] px-3 sm:px-4 lg:px-6 overflow-visible">
        {/* Right Side (RTL start): Mobile menu + Crm-One-step Identity + Organization Switcher + Breadcrumb / Search trigger */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-visible pl-2 sm:pl-4">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="فتح قائمة التنقل"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* System Name Identity Pill */}
          <span
            dir="ltr"
            className="hidden xl:inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[11px] font-extrabold text-[#1D4ED8] shrink-0"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            <span>Crm-One-step</span>
          </span>

          {/* Multi-Tenant Organization Switcher Dropdown */}
          <div className="relative shrink-0" ref={orgMenuRef}>
            <button
              type="button"
              onClick={() => setOrgMenuOpen((prev) => !prev)}
              aria-expanded={orgMenuOpen}
              title="تبديل المؤسسة (عزل كامل للبيانات والصلاحيات)"
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 text-[12px] font-bold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#FFFFFF] transition-colors max-w-[160px] sm:max-w-[200px] xl:max-w-[235px]"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#004AC6]" />
              <span className="truncate">
                {currentOrganization.name}
              </span>
              <span
                className={`hidden xl:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-extrabold shrink-0 ${planBadgeColor}`}
              >
                {currentOrganization.plan}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
            </button>

            {orgMenuOpen && (
              <div
                className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-[#E2E8F0] bg-white p-2.5 text-right shadow-xl"
                dir="rtl"
              >
                <div className="border-b border-[#F1F5F9] px-2.5 pb-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#64748B]">
                      المؤسسة النشطة (Multi-Tenant Scope)
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${planBadgeColor}`}
                    >
                      باقة {currentOrganization.plan}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-extrabold text-[#0F172A] truncate">
                    {currentOrganization.name}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#475569]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users className="h-3.5 w-3.5 text-[#004AC6]" />
                      <span>
                        المقاعد النشطة: {currentOrganization.active_users_count} /{' '}
                        {currentOrganization.seats_limit}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-[#94A3B8]" dir="ltr">
                      {currentOrganization.org_id}
                    </span>
                  </div>
                </div>

                <div className="py-2">
                  <p className="px-2 pb-1 text-[10px] font-bold text-[#94A3B8]">
                    التبديل الفوري بين المؤسسات المعزولة:
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {organizations.map((org) => {
                      const isCurrent = org.org_id === currentOrgId;
                      return (
                        <button
                          key={org.org_id}
                          type="button"
                          onClick={() => {
                            switchOrganization(org.org_id);
                            setOrgMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right text-xs transition ${
                            isCurrent
                              ? 'bg-[#EFF6FF] font-extrabold text-[#004AC6]'
                              : 'font-semibold text-[#334155] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{org.name}</span>
                              <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                                {org.plan}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-[#64748B]">
                              {org.active_users_count} / {org.seats_limit} مستخدم نشط
                            </p>
                          </div>
                          {isCurrent && <Check className="h-4 w-4 shrink-0 text-[#004AC6]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-[#F1F5F9] pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOrgMenuOpen(false);
                      setShowProvisionModal(true);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#004AC6] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-[#003999]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ إنشاء مؤسسة جديدة (تهيئة تلقائية)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOrgMenuOpen(false);
                      navigate('/settings/subscription');
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-[#004AC6]" />
                    <span>إدارة الباقة والمقاعد والإضافات المدفوعة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden 2xl:flex items-center gap-1.5 text-[12px] whitespace-nowrap shrink-0">
            <span className="text-[#64748B]">{routeMeta.section}</span>
            <span className="text-[#CBD5E1]" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-[#0F172A] max-w-[130px] truncate">{routeMeta.title}</span>
          </div>

          {/* Ctrl+K Command Palette Trigger — Bounded width with generous RTL end margin so it never overlaps + صفقة سريعة */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="فتح البحث الشامل ولوحة الأوامر في Crm-One-step"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#94A3B8] hover:bg-[#FFFFFF] transition-colors md:w-44 lg:w-48 xl:w-56 md:justify-between md:gap-2 md:px-2.5 text-[12px] ml-4 lg:ml-6"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
              <span className="hidden md:inline truncate">
                بحث في Crm-One-step...
              </span>
            </span>
            <kbd className="hidden lg:inline-flex items-center rounded border border-[#E2E8F0] bg-[#FFFFFF] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B] tabular-nums shrink-0" dir="ltr">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Left Side (RTL end): Actions, Sync, Inbox, Signals, Employee Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 pr-2">
          {/* + صفقة سريعة */}
          <button
            type="button"
            onClick={onOpenQuickDeal}
            aria-label="إضافة صفقة سريعة"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-3.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] active:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">+ صفقة سريعة</span>
            <span className="sm:hidden">+ صفقة</span>
          </button>

          {/* Real-time Sync Status & Preview Mode Controls */}
          {!firebaseUser && isPreviewMode ? (
            <div className="hidden lg:inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                title="الترقية لتسجيل الدخول بحساب Google ومزامنة السحابة"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[11px] font-bold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 shrink-0" />
                <span>الترقية لحساب Google</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  exitPreviewMode();
                  navigate('/login', { replace: true });
                }}
                title="الخروج من الوضع التجريبي والعودة لشاشة الدخول"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 text-[11px] font-semibold text-[#475569] hover:border-[#FECDD3] hover:bg-[#FFF1F2] hover:text-[#F43F5E] transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xl:inline">خروج من التجريبي</span>
              </button>
            </div>
          ) : (
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
          )}

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
              <span className="hidden sm:block max-w-[170px] lg:max-w-[230px] xl:max-w-[280px] truncate text-[12px] font-semibold text-[#0F172A]">
                {currentUser.fullName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
            </button>

            {employeeMenuOpen && (
              <div className="absolute left-0 top-11 z-50 w-76 rounded-lg flyout-surface p-2 text-right">
                <div className="border-b border-[#E2E8F0] px-2.5 py-2">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                    {currentUser.fullName}
                  </p>
                  <p className="text-[12px] text-[#64748B] truncate">{currentUser.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#2563EB]">
                    {currentUser.jobTitle || 'مدير المبيعات التنفيذي'}
                  </p>
                </div>

                <div className="border-b border-[#E2E8F0] px-2.5 py-2 space-y-2.5">
                  <div>
                    <label
                      htmlFor="active-profile-select"
                      className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span>ملف الصلاحيات النشط (Profile FLS)</span>
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

                  <div>
                    <label
                      htmlFor="active-role-select"
                      className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]"
                    >
                      <Network className="h-3.5 w-3.5 text-[#059669]" />
                      <span>الدور في الشجرة (نطاق رؤية السجلات)</span>
                    </label>
                    <select
                      id="active-role-select"
                      value={activeRole?.id ?? ''}
                      onChange={(e) => setActiveRoleId(e.target.value)}
                      className="input-control w-full px-2.5 py-1.5 text-[12px]"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} (
                          {r.dataVisibility === 'organization'
                            ? 'المؤسسة كاملة'
                            : r.dataVisibility === 'team'
                              ? r.hide_subordinates_data
                                ? 'سجلاته فقط - حجب المرؤوسين'
                                : 'الفريق والمرؤوسين'
                              : 'سجلاته فقط'}
                          )
                        </option>
                      ))}
                    </select>
                  </div>
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

                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeMenuOpen(false);
                      navigate('/settings/subscription');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <CreditCard className="h-4 w-4 text-[#64748B]" />
                    <span>باقة المؤسسة والمقاعد والإضافات</span>
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
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeMenuOpen(false);
                          void signInWithGoogle();
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                      >
                        <LogIn className="h-4 w-4" />
                        <span>الترقية وتسجيل الدخول بحساب Google</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeMenuOpen(false);
                          exitPreviewMode();
                          navigate('/login', { replace: true });
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#F43F5E] hover:bg-[#FFF1F2]"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>الخروج من الوضع التجريبي</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Automated Organization Provisioning Modal (+ إنشاء مؤسسة جديدة) */}
      {showProvisionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs"
          dir="rtl"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    إنشاء وتهيئة مؤسسة جديدة (Automated Tenant Provisioning)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    عزل تام للبيانات (org_id) مع تهيئة تلقائية للحقول القياسية والملفات والأدوار والبلوبرينت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleProvisionSubmit(e)} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                  اسم المؤسسة أو الكيان التجاري الجديد *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="مثال: شركة رواق للحلول الطبية — فرع جدة"
                  className="w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                  الباقة التشغيلية وسعة المقاعد (Subscription Plan)
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      {
                        id: 'Starter',
                        title: 'Starter',
                        seats: '5 مقاعد نشطة',
                        desc: 'الحقول والأدوار الأساسية',
                      },
                      {
                        id: 'Pro',
                        title: 'Pro',
                        seats: '15 مقعد نشط',
                        desc: 'يشمل واتساب وميتا المباشر',
                      },
                      {
                        id: 'Enterprise',
                        title: 'Enterprise',
                        seats: '25 مقعد نشط',
                        desc: 'شامل كافة الإضافات والدوال',
                      },
                    ] as const
                  ).map((p) => {
                    const active = newOrgPlan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewOrgPlan(p.id)}
                        className={`rounded-xl border p-3 text-right transition ${
                          active
                            ? 'border-2 border-[#004AC6] bg-[#EFF6FF]/60'
                            : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#0F172A]">{p.title}</span>
                          {active && <Check className="h-3.5 w-3.5 text-[#004AC6]" />}
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-[#004AC6]">{p.seats}</p>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/60 p-3.5 text-[11px] text-[#1E3A8A]">
                <p className="font-extrabold">ما الذي سيتم تهيئته برمجياً فور الإنشاء؟</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 font-medium text-[#334155]">
                  <li>
                    توليد معرف مؤسسة معزول (<code className="font-mono">org_id</code>) وتعيينك{' '}
                    <strong>مدير النظام العام (Super Admin)</strong>.
                  </li>
                  <li>
                    بذر الحقول القياسية (<code className="font-mono">custom_fields</code> مع{' '}
                    <code className="font-mono">api_name</code>) لكيانات العملاء والصفقات والشركات.
                  </li>
                  <li>
                    تجهيز شجرة الأدوار التنظيمية (CEO ← مدير مبيعات ← ممثل مبيعات) ومسار البلوبرينت الافتراضي.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569] hover:bg-[#F8FAFC]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isProvisioning ? 'جاري التهيئة...' : 'إنشاء وتفعيل المؤسسة الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
