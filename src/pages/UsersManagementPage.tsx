import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Globe,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';

type DepartmentFilter = 'all' | 'sales' | 'support' | 'managers' | 'inactive';
type StatusSubFilter = 'all' | 'active' | 'break' | 'suspended';
type DetailSubTab = 'governance' | 'preferences' | 'audit';

interface TerritoryItem {
  id: string;
  label: string;
  accessType: 'full' | 'readonly';
}

interface EmployeeRecord {
  id: string;
  empCode: string;
  fullName: string;
  initials: string;
  email: string;
  phone: string;
  jobTitle: string;
  departmentLine: string;
  departmentCategory: DepartmentFilter;
  shiftStatus: 'active' | 'break' | 'off' | 'suspended';
  shiftBadgeShort: string;
  shiftBadgeFull: string;
  avatarBg: string;
  avatarText: string;
  dotColor: string;
  profileTag: string;
  roleTag: string;
  metricSummary: string;
  profileValue: string;
  roleValue: string;
  roleHierarchyPath: string;
  reportingToValue: string;
  territories: TerritoryItem[];
  collaborationGroups: Array<{ id: string; label: string; dotColor: string }>;
  shiftHoursLabel: string;
  meetingSlug: string;
  stopRoundRobinOutsideHours: boolean;
  desktopSignals: boolean;
  whatsappSignals: boolean;
  lastLoginLabel: string;
  auditLogs: Array<{
    id: string;
    action: string;
    actor: string;
    timestamp: string;
    ip: string;
    severity: 'info' | 'warning' | 'security';
  }>;
}

const INITIAL_EMPLOYEES: EmployeeRecord[] = [
  {
    id: 'emp_sara',
    empCode: 'EMP-8842',
    fullName: 'سارة المنصور',
    initials: 'س.م',
    email: 'sara@riwaq.sa',
    phone: '+966 50 123 4567',
    jobTitle: 'مدير حسابات كبار العملاء (Senior Key Account Manager)',
    departmentLine: 'إدارة مبيعات قطاع الشركات Enterprise',
    departmentCategory: 'sales',
    shiftStatus: 'active',
    shiftBadgeShort: 'دوام',
    shiftBadgeFull: 'في الدوام الآن (وردية الرياض)',
    avatarBg: 'bg-[#004AC6]',
    avatarText: 'text-white',
    dotColor: 'bg-[#10B981]',
    profileTag: 'مبيعات متقدمة',
    roleTag: 'مدير حسابات إقليمي',
    metricSummary: '18 صفقة نشطة • 4.2M ر.س',
    profileValue: 'مبيعات متقدمة (Standard Sales)',
    roleValue: 'مدير حسابات إقليمي',
    roleHierarchyPath: 'القطاع التجاري > فرع المنطقة الوسطى > كبار العملاء',
    reportingToValue: 'طارق العتيبي (مدير مبيعات أول)',
    territories: [
      {
        id: 'ter_riyadh',
        label: 'منطقة الرياض الكبرى (قراءة وتعديل كامل)',
        accessType: 'full',
      },
      {
        id: 'ter_eastern',
        label: 'المنطقة الشرقية (قراءة فقط للشركات التابعة)',
        accessType: 'readonly',
      },
    ],
    collaborationGroups: [
      { id: 'grp_1', label: 'فريق مبيعات B2B المؤسسي (أساسي)', dotColor: 'bg-[#2563EB]' },
      { id: 'grp_2', label: 'فريق حملات وتكامل ميتا وواتساب', dotColor: 'bg-[#10B981]' },
      { id: 'grp_3', label: 'لجنة اعتماد الصفقات السريعة', dotColor: 'bg-[#10B981]' },
    ],
    shiftHoursLabel: 'الوردية الصباحية المعتمدة: 9:00 ص - 5:00 م (توقيت الرياض GMT+3) | الأحد - الخميس',
    meetingSlug: 'riwaq.sa/meet/sara-almansoor',
    stopRoundRobinOutsideHours: true,
    desktopSignals: true,
    whatsappSignals: true,
    lastLoginLabel: 'اليوم 08:42 ص من الرياض (IP: 198.51.100.24)',
    auditLogs: [
      {
        id: 'aud_1',
        action: 'تحديث صلاحيات ملف المبيعات المتقدمة وتفعيل سقف خصم 15%',
        actor: 'طارق العتيبي (مدير مبيعات أول)',
        timestamp: 'اليوم — 10:15 ص',
        ip: '198.51.100.24',
        severity: 'security',
      },
      {
        id: 'aud_2',
        action: 'تسجيل دخول ناجح عبر المصادقة الثنائية (2FA - نفاذ / Authenticator)',
        actor: 'سارة المنصور',
        timestamp: 'اليوم — 08:42 ص',
        ip: '198.51.100.24',
        severity: 'info',
      },
      {
        id: 'aud_3',
        action: 'إضافة منطقة الشرقية (قراءة فقط للشركات التابعة) ضمن النطاق الجغرافي',
        actor: 'سلمان القحطاني (مدير النظام)',
        timestamp: 'أمس — 04:30 م',
        ip: '198.51.100.11',
        severity: 'warning',
      },
    ],
  },
  {
    id: 'emp_abdullah',
    empCode: 'EMP-8819',
    fullName: 'م. عبد الله السبيعي',
    initials: 'ع.س',
    email: 'abdullah@riwaq.sa',
    phone: '+966 55 987 6543',
    jobTitle: 'كبير ممثلي المبيعات الميدانية (Senior Field Sales Executive)',
    departmentLine: 'إدارة المبيعات الميدانية والقطاع الحكومي',
    departmentCategory: 'sales',
    shiftStatus: 'active',
    shiftBadgeShort: 'في الدوام الآن',
    shiftBadgeFull: 'في الدوام الآن (وردية الرياض)',
    avatarBg: 'bg-[#E2E8F0]',
    avatarText: 'text-[#1E293B]',
    dotColor: 'bg-[#10B981]',
    profileTag: 'مبيعات ميدانية',
    roleTag: 'كبير ممثلي المبيعات',
    metricSummary: '14 صفقة جارية • 2.8M ر.س',
    profileValue: 'مبيعات متقدمة (Standard Sales)',
    roleValue: 'كبير ممثلي المبيعات',
    roleHierarchyPath: 'القطاع التجاري > المبيعات الميدانية > المنطقة الوسطى',
    reportingToValue: 'طارق العتيبي (مدير مبيعات أول)',
    territories: [
      {
        id: 'ter_riyadh_field',
        label: 'منطقة الرياض الكبرى (قراءة وتعديل كامل)',
        accessType: 'full',
      },
      {
        id: 'ter_qassim',
        label: 'منطقة القصيم وحائل (قراءة فقط للشركات التابعة)',
        accessType: 'readonly',
      },
    ],
    collaborationGroups: [
      { id: 'grp_1', label: 'فريق المبيعات الميدانية والزيارات', dotColor: 'bg-[#2563EB]' },
      { id: 'grp_2', label: 'فريق المناقصات والعقود الكبرى', dotColor: 'bg-[#10B981]' },
    ],
    shiftHoursLabel: 'الوردية الصباحية المعتمدة: 8:30 ص - 4:30 م (توقيت الرياض GMT+3) | الأحد - الخميس',
    meetingSlug: 'riwaq.sa/meet/abdullah-alsubaie',
    stopRoundRobinOutsideHours: true,
    desktopSignals: true,
    whatsappSignals: true,
    lastLoginLabel: 'اليوم 08:19 ص من الرياض (IP: 198.51.100.52)',
    auditLogs: [
      {
        id: 'aud_ab_1',
        action: 'اعتماد عرض سعر صفقة أرامكس اللوجستية (350,000 ر.س)',
        actor: 'م. عبد الله السبيعي',
        timestamp: 'اليوم — 11:05 ص',
        ip: '198.51.100.52',
        severity: 'info',
      },
    ],
  },
  {
    id: 'emp_reem',
    empCode: 'EMP-8904',
    fullName: 'ريم القحطاني',
    initials: 'ر.ق',
    email: 'reem@riwaq.sa',
    phone: '+966 54 321 7890',
    jobTitle: 'قائد فريق نجاح وخدمة العملاء (Customer Success Team Lead)',
    departmentLine: 'إدارة نجاح العملاء وما بعد البيع',
    departmentCategory: 'support',
    shiftStatus: 'break',
    shiftBadgeShort: 'في استراحة',
    shiftBadgeFull: 'في استراحة قصيرة (تعود 01:30 م)',
    avatarBg: 'bg-[#DBEAFE]',
    avatarText: 'text-[#1D4ED8]',
    dotColor: 'bg-[#F59E0B]',
    profileTag: 'دعم ونجاح العملاء',
    roleTag: 'قائد فريق',
    metricSummary: '28 تذكرة استجابة نشطة',
    profileValue: 'دعم فني ونجاح العملاء (Customer Success)',
    roleValue: 'قائد فريق خدمة العملاء',
    roleHierarchyPath: 'قطاع العمليات > نجاح العملاء > فريق كبار المشتركين',
    reportingToValue: 'هدى الغامدي (مديرة نجاح العملاء)',
    territories: [
      {
        id: 'ter_all_ksa',
        label: 'كافة مناطق المملكة (دعم فني ومتابعة عقود)',
        accessType: 'full',
      },
    ],
    collaborationGroups: [
      { id: 'grp_cs_1', label: 'فريق استجابة SLA الفورية (أساسي)', dotColor: 'bg-[#2563EB]' },
      { id: 'grp_cs_2', label: 'فريق حملات وتكامل ميتا وواتساب', dotColor: 'bg-[#10B981]' },
    ],
    shiftHoursLabel: 'الوردية المرنة المعتمدة: 9:00 ص - 5:00 م (توقيت الرياض GMT+3) | الأحد - الخميس',
    meetingSlug: 'riwaq.sa/meet/reem-alqahtani',
    stopRoundRobinOutsideHours: true,
    desktopSignals: true,
    whatsappSignals: false,
    lastLoginLabel: 'اليوم 09:01 ص من جدة (IP: 198.51.100.88)',
    auditLogs: [
      {
        id: 'aud_re_1',
        action: 'تفعيل التحويل التلقائي للتذاكر الحرجة أثناء فترة الاستراحة',
        actor: 'ريم القحطاني',
        timestamp: 'اليوم — 12:45 م',
        ip: '198.51.100.88',
        severity: 'info',
      },
    ],
  },
  {
    id: 'emp_omar',
    empCode: 'EMP-8951',
    fullName: 'عمر الشمري',
    initials: 'ع.ش',
    email: 'omar@riwaq.sa',
    phone: '+966 56 445 1122',
    jobTitle: 'أخصائي تأهيل العملاء المحتملين وتطوير الأعمال (SDR Specialist)',
    departmentLine: 'وحدة النمو والتسويق الرقمي Inbound SDR',
    departmentCategory: 'sales',
    shiftStatus: 'off',
    shiftBadgeShort: 'خارج الدوام',
    shiftBadgeFull: 'خارج أوقات الدوام الرسمي',
    avatarBg: 'bg-[#F1F5F9]',
    avatarText: 'text-[#334155]',
    dotColor: 'bg-[#94A3B8]',
    profileTag: 'تأهيل عملاء SDR',
    roleTag: 'تطوير أعمال',
    metricSummary: '45 عميل محتمل في مرحلة التأهيل',
    profileValue: 'مندوب تأهيل وحملات (SDR)',
    roleValue: 'أخصائي تطوير أعمال SDR',
    roleHierarchyPath: 'القطاع التجاري > تطوير الأعمال > تأهيل العملاء SDR',
    reportingToValue: 'سارة المنصور (مدير حسابات إقليمي)',
    territories: [
      {
        id: 'ter_western',
        label: 'المنطقة الغربية وجدة (قراءة وتعديل للعملاء المحتملين)',
        accessType: 'full',
      },
    ],
    collaborationGroups: [
      { id: 'grp_sdr_1', label: 'فريق حملات وتكامل ميتا وواتساب (أساسي)', dotColor: 'bg-[#2563EB]' },
    ],
    shiftHoursLabel: 'الوردية المسائية المعتمدة: 1:00 م - 9:00 م (توقيت الرياض GMT+3) | الأحد - الخميس',
    meetingSlug: 'riwaq.sa/meet/omar-alshammari',
    stopRoundRobinOutsideHours: true,
    desktopSignals: true,
    whatsappSignals: true,
    lastLoginLabel: 'أمس 08:55 م من الرياض (IP: 198.51.100.94)',
    auditLogs: [
      {
        id: 'aud_om_1',
        action: 'تحويل 6 عملاء مؤهلين من حملة ميتا إلى فريق مبيعات المؤسسات',
        actor: 'عمر الشمري',
        timestamp: 'أمس — 07:20 م',
        ip: '198.51.100.94',
        severity: 'info',
      },
    ],
  },
  {
    id: 'emp_khaled',
    empCode: 'EMP-8790',
    fullName: 'خالد الدوسري',
    initials: 'خ.د',
    email: 'khaled@riwaq.sa',
    phone: '+966 53 778 9900',
    jobTitle: 'مهندس حلول فنية واستشارات ما قبل البيع (Pre-Sales Solutions Architect)',
    departmentLine: 'إدارة الحلول الهندسية والتكامل السحابي',
    departmentCategory: 'managers',
    shiftStatus: 'active',
    shiftBadgeShort: 'في الدوام الآن',
    shiftBadgeFull: 'في الدوام الآن (وردية الخبر)',
    avatarBg: 'bg-[#D1FAE5]',
    avatarText: 'text-[#065F46]',
    dotColor: 'bg-[#10B981]',
    profileTag: 'استشارات تقنية',
    roleTag: 'مهندس حلول فنية',
    metricSummary: '8 عروض فنية معتمدة قيد التنفيذ',
    profileValue: 'مبيعات متقدمة (Standard Sales)',
    roleValue: 'مهندس حلول فنية Pre-Sales',
    roleHierarchyPath: 'القطاع التجاري > الاستشارات التقنية > الحلول المؤسسية',
    reportingToValue: 'طارق العتيبي (مدير مبيعات أول)',
    territories: [
      {
        id: 'ter_east_full',
        label: 'المنطقة الشرقية والجبيل (قراءة وتعديل كامل)',
        accessType: 'full',
      },
      {
        id: 'ter_riyadh_ro',
        label: 'منطقة الرياض الكبرى (مراجعة العروض الفنية)',
        accessType: 'readonly',
      },
    ],
    collaborationGroups: [
      { id: 'grp_kh_1', label: 'فريق مبيعات B2B المؤسسي (أساسي)', dotColor: 'bg-[#2563EB]' },
      { id: 'grp_kh_2', label: 'لجنة اعتماد الصفقات السريعة', dotColor: 'bg-[#10B981]' },
    ],
    shiftHoursLabel: 'الوردية الصباحية المعتمدة: 9:00 ص - 5:00 م (توقيت الرياض GMT+3) | الأحد - الخميس',
    meetingSlug: 'riwaq.sa/meet/khaled-aldossary',
    stopRoundRobinOutsideHours: false,
    desktopSignals: true,
    whatsappSignals: true,
    lastLoginLabel: 'اليوم 08:30 ص من الخبر (IP: 198.51.100.67)',
    auditLogs: [
      {
        id: 'aud_kh_1',
        action: 'إرفاق وثيقة معمارية الربط البرمجي API لصفقة شركة المراعي',
        actor: 'خالد الدوسري',
        timestamp: 'اليوم — 09:50 ص',
        ip: '198.51.100.67',
        severity: 'info',
      },
    ],
  },
];

const AVAILABLE_TERRITORIES = [
  'منطقة مكة المكرمة وجدة (قراءة وتعديل كامل)',
  'منطقة المدينة المنورة وينبع (قراءة فقط للشركات التابعة)',
  'المنطقة الجنوبية وعسير (قراءة وتعديل كامل)',
  'منطقة القصيم وحائل (قراءة فقط للشركات التابعة)',
  'قطاع الخليج العربي والأسواق الإقليمية (قراءة فقط)',
];

export function UsersManagementPage() {
  const navigate = useNavigate();
  const { profiles, roles, currentOrganization, updateOrganizationSubscription } = useCrm();

  const [employees, setEmployees] = useState<EmployeeRecord[]>(INITIAL_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp_sara');
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusSubFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<DetailSubTab>('governance');

  // Interactive modals & feedback states
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showSeatLimitModal, setShowSeatLimitModal] = useState<boolean>(false);
  const [showFreezeModal, setShowFreezeModal] = useState<boolean>(false);
  const [showTerritoryPicker, setShowTerritoryPicker] = useState<boolean>(false);
  const [copiedSlug, setCopiedSlug] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAtSeatLimit =
    currentOrganization.active_users_count >= currentOrganization.seats_limit;
  const availableSeatsCount = Math.max(
    0,
    currentOrganization.seats_limit - currentOrganization.active_users_count
  );

  // Invite form state
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('+966 5');
  const [inviteJobTitle, setInviteJobTitle] = useState('مسؤول مبيعات قطاع الشركات');
  const [inviteProfile, setInviteProfile] = useState('مبيعات متقدمة (Standard Sales)');
  const [inviteRole, setInviteRole] = useState('مدير حسابات إقليمي');
  const [inviteManager, setInviteManager] = useState('طارق العتيبي (مدير مبيعات أول)');

  // Freeze/Transfer form state
  const [transferTargetEmp, setTransferTargetEmp] = useState('م. عبد الله السبيعي');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) ?? employees[0];
  }, [employees, selectedEmpId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (departmentFilter !== 'all' && emp.departmentCategory !== departmentFilter) {
        return false;
      }
      if (statusFilter === 'active' && emp.shiftStatus !== 'active') return false;
      if (statusFilter === 'break' && emp.shiftStatus !== 'break') return false;
      if (statusFilter === 'suspended' && emp.shiftStatus !== 'suspended' && emp.shiftStatus !== 'off') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchEmail = emp.email.toLowerCase().includes(q);
        const matchRole = emp.roleTag.toLowerCase().includes(q) || emp.profileTag.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      return true;
    });
  }, [employees, departmentFilter, statusFilter, searchQuery]);

  const updateSelectedEmployee = (patch: Partial<EmployeeRecord>) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...patch } : emp))
    );
  };

  const handleSavePermissions = () => {
    triggerToast(`تم حفظ وتطبيق صلاحيات الحوكمة والأمان للموظف «${selectedEmployee.fullName}» بنجاح`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePermissions();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleCopyMeetingLink = () => {
    void navigator.clipboard?.writeText(`https://${selectedEmployee.meetingSlug}`);
    setCopiedSlug(true);
    triggerToast('تم نسخ رابط الاجتماعات المباشر إلى الحافظة');
    window.setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleRemoveTerritory = (territoryId: string) => {
    updateSelectedEmployee({
      territories: selectedEmployee.territories.filter((t) => t.id !== territoryId),
    });
    triggerToast('تم تحديث النطاق الجغرافي للموظف');
  };

  const handleAddTerritory = (label: string) => {
    const isReadonly = label.includes('قراءة فقط');
    const newTer: TerritoryItem = {
      id: `ter_${Date.now()}`,
      label,
      accessType: isReadonly ? 'readonly' : 'full',
    };
    updateSelectedEmployee({
      territories: [...selectedEmployee.territories, newTer],
    });
    setShowTerritoryPicker(false);
    triggerToast(`تمت إضافة «${label}» إلى المناطق الجغرافية المعتمدة`);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'الاسم الكامل', 'البريد الإلكتروني', 'الجوال', 'ملف الصلاحيات', 'الدور الوظيفي', 'الحالة'];
    const rows = employees.map((e) => [
      e.empCode,
      e.fullName,
      e.email,
      e.phone,
      e.profileTag,
      e.roleTag,
      e.shiftBadgeShort,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'riwaq_employees_governance.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('تم تصدير سجل الموظفين والصلاحيات بصيغة CSV');
  };

  const handleCreateEmployeeInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName.trim() || !inviteEmail.trim()) return;

    if (currentOrganization.active_users_count >= currentOrganization.seats_limit) {
      setShowInviteModal(false);
      setShowSeatLimitModal(true);
      return;
    }

    const parts = inviteFullName.trim().split(' ');
    const initials =
      parts.length >= 2 ? `${parts[0][0]}.${parts[1][0]}` : `${inviteFullName.trim().slice(0, 2)}`;

    const newEmp: EmployeeRecord = {
      id: `emp_${Date.now()}`,
      empCode: `EMP-${Math.floor(8955 + Math.random() * 900)}`,
      fullName: inviteFullName.trim(),
      initials,
      email: inviteEmail.trim(),
      phone: invitePhone.trim() || '+966 50 000 0000',
      jobTitle: inviteJobTitle.trim(),
      departmentLine: 'إدارة مبيعات قطاع الشركات Enterprise',
      departmentCategory: 'sales',
      shiftStatus: 'active',
      shiftBadgeShort: 'دوام',
      shiftBadgeFull: 'في الدوام الآن (وردية الرياض)',
      avatarBg: 'bg-[#004AC6]',
      avatarText: 'text-white',
      dotColor: 'bg-[#10B981]',
      profileTag: inviteProfile.split(' (')[0],
      roleTag: inviteRole,
      metricSummary: 'مدعو حديثاً • 0 صفقة نشطة',
      profileValue: inviteProfile,
      roleValue: inviteRole,
      roleHierarchyPath: 'القطاع التجاري > فرع المنطقة الوسطى > كبار العملاء',
      reportingToValue: inviteManager,
      territories: [
        {
          id: `ter_${Date.now()}`,
          label: 'منطقة الرياض الكبرى (قراءة وتعديل كامل)',
          accessType: 'full',
        },
      ],
      collaborationGroups: [
        { id: 'grp_new_1', label: 'فريق مبيعات B2B المؤسسي (أساسي)', dotColor: 'bg-[#2563EB]' },
      ],
      shiftHoursLabel: 'الوردية الصباحية المعتمدة: 9:00 ص - 5:00 م (توقيت الرياض GMT+3) | الأحد - الخميس',
      meetingSlug: `riwaq.sa/meet/${inviteEmail.split('@')[0] || 'member'}`,
      stopRoundRobinOutsideHours: true,
      desktopSignals: true,
      whatsappSignals: true,
      lastLoginLabel: 'تم إرسال دعوة التفعيل الآمنة عبر البريد',
      auditLogs: [
        {
          id: `aud_new_${Date.now()}`,
          action: 'إنشاء حساب موظف جديد وإرسال رابط التفعيل المشفر',
          actor: 'طارق العتيبي (مدير مبيعات أول)',
          timestamp: 'الآن',
          ip: '198.51.100.24',
          severity: 'security',
        },
      ],
    };

    setEmployees((prev) => [newEmp, ...prev]);
    setSelectedEmpId(newEmp.id);
    void updateOrganizationSubscription({
      active_users_count: currentOrganization.active_users_count + 1,
    });
    setShowInviteModal(false);
    setInviteFullName('');
    setInviteEmail('');
    triggerToast(`تم إرسال دعوة الانضمام وتخصيص مقعد نشط إلى «${newEmp.fullName}»`);
  };

  const profileOptions = useMemo(() => {
    const base = [
      'مبيعات متقدمة (Standard Sales)',
      'مدير النظام العام (Super Admin)',
      'مندوب تأهيل وحملات (SDR)',
      'دعم فني ونجاح العملاء (Customer Success)',
      'محاسب ومسؤول فوترة (Finance)',
    ];
    profiles.forEach((p) => {
      if (!base.some((b) => b.includes(p.name))) {
        base.push(p.name);
      }
    });
    return base;
  }, [profiles]);

  const roleOptions = useMemo(() => {
    const base = [
      'مدير حسابات إقليمي',
      'كبير ممثلي المبيعات',
      'قائد فريق خدمة العملاء',
      'أخصائي تطوير أعمال SDR',
      'مهندس حلول فنية Pre-Sales',
      'مدير المبيعات التنفيذي',
    ];
    roles.forEach((r) => {
      if (!base.includes(r.name)) {
        base.push(r.name);
      }
    });
    return base;
  }, [roles]);

  return (
    <div className="min-h-full w-full bg-[#F8FAFC] text-[#0F172A]" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#1E40AF] bg-[#0F172A] px-4 py-3 text-xs font-bold text-white shadow-xl">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Flush White Header */}
      <div className="w-full border-b border-[#E2E8F0] bg-white px-6 pt-5 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Right: Breadcrumb + Title + Active Employees Badge */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Link to="/settings" className="transition hover:text-[#004AC6]">
                الإعدادات والنظام
              </Link>
              <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
              <Link to="/settings/profiles" className="transition hover:text-[#004AC6]">
                إدارة المستخدمين والأمان
              </Link>
              <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
              <span className="font-bold text-[#334155]">الموظفون والصلاحيات</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F172A] sm:text-[24px]">
                إدارة المستخدمين وبروفايل الموظف
              </h1>
              <button
                type="button"
                onClick={() => navigate('/settings/subscription')}
                title="إدارة المقاعد وترقية الباقة"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                  isAtSeatLimit
                    ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FFE4E6]'
                    : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]'
                }`}
              >
                <span>
                  {currentOrganization.active_users_count} موظف نشط •{' '}
                  {isAtSeatLimit
                    ? '0 تراخيص متاحة (الحد الأقصى)'
                    : `${availableSeatsCount} تراخيص متاحة`}
                </span>
              </button>
            </div>
          </div>

          {/* Left: Export CSV + Invite New Employee */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-xs font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
            >
              <Download className="h-3.5 w-3.5 text-[#475569]" />
              <span>تصدير السجل (CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAtSeatLimit) {
                  setShowSeatLimitModal(true);
                } else {
                  setShowInviteModal(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#003999]"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ دعوة موظف جديد</span>
            </button>
          </div>
        </div>

        {/* Department Filter Pills Row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { id: 'all' as const, label: 'الكل (24)' },
            { id: 'sales' as const, label: 'المبيعات (12)' },
            { id: 'support' as const, label: 'خدمة العملاء (6)' },
            { id: 'managers' as const, label: 'المدراء (4)' },
            { id: 'inactive' as const, label: 'غير نشط (2)' },
          ].map((tab) => {
            const active = departmentFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDepartmentFilter(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-[#004AC6] text-white shadow-xs'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Split Workspace */}
      <div className="w-full px-6 py-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Right Column (4 cols in 12-col grid): Employee Directory List */}
          <div className="space-y-3 xl:col-span-4">
            {/* Search & Status Sub-Pills Card */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، البريد، أو الدور الوظيفي..."
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-9 pl-3 text-xs font-medium text-[#0F172A] placeholder-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[
                  { id: 'all' as const, label: 'الكل (24)' },
                  { id: 'active' as const, label: 'نشط (18)' },
                  { id: 'break' as const, label: 'استراحة ...' },
                  { id: 'suspended' as const, label: 'معلق (2)' },
                ].map((st) => {
                  const active = statusFilter === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={` truncate rounded-md px-2 py-1 text-[11px] font-bold transition ${
                        active
                          ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Employee Cards List */}
            <div className="space-y-2.5">
              {filteredEmployees.map((emp) => {
                const isSelected = emp.id === selectedEmployee.id;

                const statusBadgeStyle =
                  emp.shiftStatus === 'active'
                    ? 'bg-[#D1FAE5] text-[#065F46]'
                    : emp.shiftStatus === 'break'
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : 'bg-[#F1F5F9] text-[#475569]';

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`w-full rounded-xl p-3.5 text-right transition ${
                      isSelected
                        ? 'border-2 border-[#2563EB] bg-white shadow-sm'
                        : 'border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#FCFDFE]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        {/* Avatar Square */}
                        <div className="relative shrink-0">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-extrabold ${emp.avatarBg} ${emp.avatarText}`}
                          >
                            {emp.initials}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white ${emp.dotColor}`}
                          />
                        </div>

                        {/* Name + Email + Role Chips */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-extrabold text-[#0F172A]">
                              {emp.fullName}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${statusBadgeStyle}`}
                            >
                              {emp.shiftBadgeShort}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-[#64748B]" dir="ltr">
                            {emp.email}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                                  : 'bg-[#F1F5F9] text-[#334155]'
                              }`}
                            >
                              {emp.profileTag}
                            </span>
                            <span className="rounded-md bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#475569] border border-[#E2E8F0]">
                              {emp.roleTag}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Metric */}
                    <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-[#334155]">
                        {isSelected && <Clock className="h-3.5 w-3.5 text-[#004AC6]" />}
                        <span>{emp.metricSummary}</span>
                      </div>

                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-[#004AC6]">
                          <span>محدد الآن</span>
                          <span>←</span>
                        </span>
                      ) : (
                        <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Column (8 cols in 12-col grid): Selected Employee Governance & Profile Panel */}
          <div className="xl:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs">
              {/* Top 3 Sub-Tabs Bar */}
              <div className="grid grid-cols-1 border-b border-[#E2E8F0] bg-[#F8FAFC] sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('governance')}
                  className={`flex items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-xs font-extrabold transition ${
                    activeSubTab === 'governance'
                      ? 'border-[#004AC6] bg-white text-[#004AC6]'
                      : 'border-transparent text-[#475569] hover:bg-white/60 hover:text-[#0F172A]'
                  }`}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="text-center leading-snug">
                    بيانات الموظف والصلاحيات (Admin &amp; Governance)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('preferences')}
                  className={`flex items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-xs font-bold transition ${
                    activeSubTab === 'preferences'
                      ? 'border-[#004AC6] bg-white text-[#004AC6]'
                      : 'border-transparent text-[#475569] hover:bg-white/60 hover:text-[#0F172A]'
                  }`}
                >
                  <Sliders className="h-4 w-4 shrink-0" />
                  <span className="text-center leading-snug">
                    التفضيلات الشخصية (Settings &amp; Integrations)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('audit')}
                  className={`flex items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-xs font-bold transition ${
                    activeSubTab === 'audit'
                      ? 'border-[#004AC6] bg-white text-[#004AC6]'
                      : 'border-transparent text-[#475569] hover:bg-white/60 hover:text-[#0F172A]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                  <span className="text-center leading-snug">
                    سجل النشاط والأمان (Audit Log)
                  </span>
                </button>
              </div>

              {/* Employee Identity Header Card */}
              <div className="border-b border-[#F1F5F9] p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  {/* Right: Avatar + Full Details */}
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#004AC6] text-xl font-extrabold text-white shadow-sm">
                        {selectedEmployee.initials}
                      </div>
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-[#059669] px-2.5 py-0.5 text-[10px] font-extrabold text-white">
                        نشط
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-extrabold text-[#0F172A]">
                          {selectedEmployee.fullName}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] px-2.5 py-0.5 text-[11px] font-bold text-[#065F46]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          <span>{selectedEmployee.shiftBadgeFull}</span>
                        </span>
                        <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[11px] font-bold text-[#475569]">
                          ID: {selectedEmployee.empCode}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#475569]">
                        {selectedEmployee.jobTitle} • {selectedEmployee.departmentLine}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                        <div className="flex items-center gap-1.5 text-[#334155]">
                          <Mail className="h-3.5 w-3.5 text-[#004AC6]" />
                          <span className="font-mono font-semibold" dir="ltr">
                            {selectedEmployee.email}
                          </span>
                          <span className="text-[11px] font-semibold text-[#059669]">
                            (البريد الأساسي المعتمد)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[#334155]">
                          <span className="font-mono font-bold" dir="ltr">
                            {selectedEmployee.phone}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              triggerToast(`تم فتح قناة واتساب المباشرة مع ${selectedEmployee.fullName}`)
                            }
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#ECFDF5] text-[#059669] transition hover:bg-[#D1FAE5]"
                            title="مراسلة عبر واتساب"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerToast(`جاري الاتصال بالرقم ${selectedEmployee.phone}...`)
                            }
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB] transition hover:bg-[#DBEAFE]"
                            title="اتصال هاتفي"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Left: Security Actions (Freeze / Reset 2FA) */}
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => setShowFreezeModal(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2 text-xs font-bold text-[#BE123C] transition hover:bg-[#FFE4E6]"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>تجميد الحساب / نقل السجلات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        triggerToast(
                          `تم إرسال رابط إعادة ضبط كلمة المرور ومفتاح المصادقة الثنائية (2FA) إلى ${selectedEmployee.email}`
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
                    >
                      <Lock className="h-3.5 w-3.5 text-[#64748B]" />
                      <span>إعادة ضبط كلمة المرور / 2FA</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Tab Content Area */}
              <div className="space-y-6 p-6">
                {activeSubTab === 'audit' ? (
                  /* Audit Log Sub-Tab View */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          سجل التدقيق الأمني ونشاط جلسات الموظف (Security Audit Trail)
                        </h3>
                        <p className="mt-0.5 text-xs text-[#64748B]">
                          توثيق غير قابل للتعديل لكافة التغييرات على الصلاحيات، عمليات تسجيل الدخول، وتصدير البيانات.
                        </p>
                      </div>
                      <span className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-bold text-[#1D4ED8]">
                        ممتثل لمعايير NCA-ECC
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedEmployee.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                log.severity === 'security'
                                  ? 'bg-[#EF4444]'
                                  : log.severity === 'warning'
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#10B981]'
                              }`}
                            />
                            <div>
                              <p className="text-xs font-bold text-[#0F172A]">{log.action}</p>
                              <p className="mt-1 text-[11px] text-[#64748B]">
                                المنفذ: <span className="font-semibold text-[#334155]">{log.actor}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-left font-mono text-[11px] text-[#64748B]">
                            <div>{log.timestamp}</div>
                            <div className="text-[10px] text-[#94A3B8]">IP: {log.ip}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Section 1: الثلاثي الحاكم للصلاحيات والأمان (The Access Control Triad) */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004AC6] text-white shadow-xs">
                            <ShieldCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-[#0F172A]">
                              الثلاثي الحاكم للصلاحيات والأمان (The Access Control Triad)
                            </h3>
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              الهيكل الأمني ثلاثي الأبعاد: الملف يحدد الإجراءات، الدور يحدد نطاق رؤية البيانات، والمدير المباشر يحدد سلاسل الاعتمادات.
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-extrabold text-[#1D4ED8]">
                          مستوى الحوكمة: A+ مشدد
                        </span>
                      </div>

                      {/* 3 Triad Cards Grid */}
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {/* Card 1: Profile */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                              <span>1. ملف الصلاحيات والأذونات (Profile)</span>
                              <Shield className="h-3.5 w-3.5 text-[#2563EB]" />
                            </div>

                            <div className="relative mt-2.5">
                              <select
                                value={selectedEmployee.profileValue}
                                onChange={(e) =>
                                  updateSelectedEmployee({
                                    profileValue: e.target.value,
                                    profileTag: e.target.value.split(' (')[0],
                                  })
                                }
                                className="w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white py-2 pr-3 pl-8 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                              >
                                {profileOptions.map((prof) => (
                                  <option key={prof} value={prof}>
                                    {prof}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                            </div>

                            {/* CRUD Chips */}
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669] border border-[#A7F3D0]">
                                إنشاء
                              </span>
                              <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669] border border-[#A7F3D0]">
                                تعديل
                              </span>
                              <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#475569] border border-[#E2E8F0]">
                                تصدير
                              </span>
                              <span className="rounded-md bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-bold text-[#E11D48] border border-[#FECDD3]">
                                حذف مقيد
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 border-t border-[#F1F5F9] pt-2.5">
                            <button
                              type="button"
                              onClick={() => navigate('/settings/profiles')}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004AC6] hover:underline"
                            >
                              <span>عرض وتعديل أذونات الملف (42 صلاحية مسموحة)</span>
                              <ArrowUpLeft className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card 2: Role in Hierarchy */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                              <span>2. الدور في شجرة الصلاحيات (Role)</span>
                              <Users className="h-3.5 w-3.5 text-[#6366F1]" />
                            </div>

                            <div className="relative mt-2.5">
                              <select
                                value={selectedEmployee.roleValue}
                                onChange={(e) =>
                                  updateSelectedEmployee({
                                    roleValue: e.target.value,
                                    roleTag: e.target.value,
                                  })
                                }
                                className="w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white py-2 pr-3 pl-8 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                              >
                                {roleOptions.map((roleName) => (
                                  <option key={roleName} value={roleName}>
                                    {roleName}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                            </div>

                            <p className="mt-2.5 text-[11px] leading-relaxed text-[#64748B]">
                              يملك رؤية كاملة على سجلات فرعه الإقليمي والشركات التابعة والمرؤوسين المباشرين.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => navigate('/settings/roles')}
                            className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-right text-[10px] font-bold text-[#334155] transition hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]" />
                            <span className="line-clamp-2">{selectedEmployee.roleHierarchyPath}</span>
                          </button>
                        </div>

                        {/* Card 3: Reporting To (Direct Manager) */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                              <span>3. المدير المباشر للاعتمادات (Reporting To)</span>
                              <UserCheck className="h-3.5 w-3.5 text-[#059669]" />
                            </div>

                            <div className="relative mt-2.5">
                              <select
                                value={selectedEmployee.reportingToValue}
                                onChange={(e) =>
                                  updateSelectedEmployee({ reportingToValue: e.target.value })
                                }
                                className="w-full appearance-none rounded-lg border border-[#CBD5E1] bg-white py-2 pr-3 pl-8 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                              >
                                <option value="طارق العتيبي (مدير مبيعات أول)">
                                  طارق العتيبي (مدير مبيعات أول)
                                </option>
                                <option value="سلمان القحطاني (مدير المبيعات التنفيذي)">
                                  سلمان القحطاني (مدير المبيعات التنفيذي)
                                </option>
                                <option value="هدى الغامدي (مديرة نجاح العملاء)">
                                  هدى الغامدي (مديرة نجاح العملاء)
                                </option>
                              </select>
                              <ChevronDown className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                            </div>

                            <p className="mt-2.5 text-[11px] leading-relaxed text-[#64748B]">
                              تُرفع له استثناءات الخصومات التي تتجاوز 15% ومسارات البلوبرينت وتمديد الإغلاق تلقائياً.
                            </p>
                          </div>

                          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[10px] font-bold text-[#334155]">
                            <span className="truncate">مسار الاعتماد التلقائي...</span>
                            <span className="rounded bg-[#004AC6] px-1.5 py-0.5 text-[9px] text-white">
                              نشط
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: النطاقات والمجموعات وسياسة مناوبة الدوام */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[#004AC6]" />
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          النطاقات والمجموعات وسياسة مناوبة الدوام
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Right Card: Territories */}
                        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div className="mb-3 text-xs font-bold text-[#475569]">
                            المناطق الجغرافية المعتمدة (Territories)
                          </div>

                          <div className="space-y-2">
                            {selectedEmployee.territories.map((ter) => (
                              <div
                                key={ter.id}
                                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
                                  ter.accessType === 'full'
                                    ? 'bg-[#004AC6] text-white'
                                    : 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                                }`}
                              >
                                <span>{ter.label}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTerritory(ter.id)}
                                  className={`rounded p-0.5 transition ${
                                    ter.accessType === 'full'
                                      ? 'hover:bg-white/20 text-white'
                                      : 'hover:bg-[#DBEAFE] text-[#1E3A8A]'
                                  }`}
                                  title="إزالة المنطقة"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {showTerritoryPicker ? (
                            <div className="mt-3 rounded-lg border border-[#BFDBFE] bg-white p-2.5 shadow-xs">
                              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-[#475569]">
                                <span>اختر منطقة جغرافية لإضافتها:</span>
                                <button
                                  type="button"
                                  onClick={() => setShowTerritoryPicker(false)}
                                  className="text-[#94A3B8] hover:text-[#0F172A]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1">
                                {AVAILABLE_TERRITORIES.map((terLabel) => (
                                  <button
                                    key={terLabel}
                                    type="button"
                                    onClick={() => handleAddTerritory(terLabel)}
                                    className="w-full rounded-md px-2.5 py-1.5 text-right text-xs font-semibold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#004AC6]"
                                  >
                                    + {terLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTerritoryPicker(true)}
                              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-[#93C5FD] bg-white px-3 py-1.5 text-xs font-bold text-[#004AC6] transition hover:bg-[#EFF6FF]"
                            >
                              <span>+ إضافة منطقة جغرافية</span>
                            </button>
                          )}
                        </div>

                        {/* Left Card: Collaboration Groups */}
                        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div className="mb-3 text-xs font-bold text-[#475569]">
                            المجموعات التعاونية (Collaboration Groups)
                          </div>

                          <div className="space-y-2">
                            {selectedEmployee.collaborationGroups.map((grp) => (
                              <div
                                key={grp.id}
                                className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#1E293B]"
                              >
                                <span className={`h-2 w-2 rounded-full ${grp.dotColor}`} />
                                <span>{grp.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Business Hours & Shift Card */}
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#004AC6]">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-[#0F172A]">
                                ساعات العمل وجدولة المناوبة (Business Hours &amp; Shift)
                              </h4>
                              <p className="mt-0.5 text-[11px] text-[#64748B]">
                                {selectedEmployee.shiftHoursLabel}
                              </p>
                            </div>
                          </div>

                          {/* Meeting Link Copy Box */}
                          <button
                            type="button"
                            onClick={handleCopyMeetingLink}
                            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-[#334155] shadow-2xs transition hover:border-[#93C5FD] sm:self-center"
                            dir="ltr"
                          >
                            <Copy className="h-3.5 w-3.5 text-[#004AC6]" />
                            <span>
                              {copiedSlug ? 'تم النسخ!' : selectedEmployee.meetingSlug}
                            </span>
                          </button>
                        </div>

                        {/* Round-Robin Toggle Bar */}
                        <div className="mt-3.5 flex items-center justify-between gap-4 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#334155]">
                            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
                            <span>
                              إيقاف التوزيع التلقائي للصفقات والمحادثات (Round-Robin Auto Assignment) خارج أوقات الدوام الرسمي للموظف
                            </span>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={selectedEmployee.stopRoundRobinOutsideHours}
                            onClick={() =>
                              updateSelectedEmployee({
                                stopRoundRobinOutsideHours:
                                  !selectedEmployee.stopRoundRobinOutsideHours,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              selectedEmployee.stopRoundRobinOutsideHours
                                ? 'bg-[#059669]'
                                : 'bg-[#CBD5E1]'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                                selectedEmployee.stopRoundRobinOutsideHours
                                  ? '-translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: التكاملات والقنوات المربوطة بحساب الموظف */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-[#004AC6]" />
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          التكاملات والقنوات المربوطة بحساب الموظف
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Card 1 (Top-Right): التوقيع الإلكتروني الموحد (Unified Signature) */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#475569]">
                                التوقيع الإلكتروني الموحد (Unified Signature)
                              </span>
                              <span className="rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                                مفعل ومعتمد رسمياً ✓
                              </span>
                            </div>

                            <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs">
                              <div className="font-extrabold text-[#0F172A]">
                                {selectedEmployee.fullName}{' '}
                                <span className="font-normal text-[#94A3B8]">|</span>{' '}
                                <span className="font-semibold text-[#475569]">
                                  رواق لإدارة علاقات العملاء CRM
                                </span>
                              </div>
                              <div className="mt-1 font-mono text-[11px] text-[#64748B]" dir="ltr">
                                {selectedEmployee.email} • {selectedEmployee.phone}
                              </div>
                              <div className="mt-1 font-mono text-[11px] font-bold text-[#004AC6]" dir="ltr">
                                https://riwaq.sa
                              </div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                triggerToast('تم فتح محرر قالب التوقيع الإلكتروني الموحد وتذييل الواتساب')
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004AC6] hover:underline"
                            >
                              <span>تعديل قالب البريد وتذييل الواتساب</span>
                              <ArrowUpLeft className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card 2 (Top-Left): التقويم والمواعيد (Calendar Sync) */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#475569]">
                                التقويم والمواعيد (Calendar Sync)
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                                <span>متصل ومزامن لحظياً</span>
                              </span>
                            </div>

                            <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-extrabold text-[#0F172A]">
                                  Google Workspace Calendar
                                </div>
                                <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                                  مزامنة الاجتماعات مع الصفقات وعروض...
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                triggerToast('تمت مزامنة تقويم Google Workspace مع موديول الأنشطة بنجاح')
                              }
                              className="text-[11px] font-bold text-[#64748B] hover:text-[#004AC6] hover:underline"
                            >
                              إدارة خيارات المزامنة الثنائية
                            </button>
                          </div>
                        </div>

                        {/* Card 3 (Bottom-Right): إشعارات Signals الذكية والتنبيه الفوري */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#475569]">
                                إشعارات Signals الذكية والتنبيه الفوري
                              </span>
                              <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-extrabold text-[#1D4ED8]">
                                مخصص
                              </span>
                            </div>

                            <p className="mt-2.5 text-[11px] leading-relaxed text-[#64748B]">
                              تنبيهات سطح المكتب والواتساب فور فتح العميل لعرض السعر المرسل، أو قراءة البريد، أو تقديم استفسار مباشر.
                            </p>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-4 pt-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#0F172A]">
                              <input
                                type="checkbox"
                                checked={selectedEmployee.desktopSignals}
                                onChange={(e) =>
                                  updateSelectedEmployee({ desktopSignals: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-[#CBD5E1] text-[#004AC6] focus:ring-[#004AC6]"
                              />
                              <span>إشعارات سطح المكتب</span>
                            </label>

                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#0F172A]">
                              <input
                                type="checkbox"
                                checked={selectedEmployee.whatsappSignals}
                                onChange={(e) =>
                                  updateSelectedEmployee({ whatsappSignals: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-[#CBD5E1] text-[#004AC6] focus:ring-[#004AC6]"
                              />
                              <span>تنبيهات الواتساب الفورية</span>
                            </label>
                          </div>
                        </div>

                        {/* Card 4 (Bottom-Left): اللغة والمنطقة الزمنية (Localization) */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-4">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#475569]">
                                اللغة والمنطقة الزمنية (Localization)
                              </span>
                              <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#0F172A]">
                                Asia/Riyadh (UTC+3)
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2.5">
                              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                                <div className="text-[10px] text-[#64748B]">لغة الواجهة</div>
                                <div className="mt-0.5 text-xs font-extrabold text-[#0F172A]">
                                  العربية (السعودية)
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                                <div className="text-[10px] text-[#64748B]">تنسيق التاريخ</div>
                                <div className="mt-0.5 font-mono text-xs font-extrabold text-[#0F172A]">
                                  DD/MM/YYYY
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-[11px] font-bold text-[#059669]">
                            تمت مطابقة العملة الافتراضية مع الريال السعودي (SAR)
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sticky Bottom Action Bar */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4 sm:flex-row">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
                  <span>
                    آخر تسجيل دخول: {selectedEmployee.lastLoginLabel} • معايير الأمن السيبراني ممتثلة بالكامل
                  </span>
                </div>

                <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEmployees(INITIAL_EMPLOYEES);
                      triggerToast('تمت استعادة الإعدادات الافتراضية للموظف');
                    }}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
                  >
                    إلغاء التغييرات
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#004AC6] px-5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#003999]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>حفظ وتطبيق الصلاحيات (Ctrl + S)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Invite New Employee (+ دعوة موظف جديد) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    دعوة موظف جديد وتخصيص الثلاثي الحاكم للصلاحيات
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    سيتم إرسال رابط التفعيل المشفر مع فرض المصادقة الثنائية (2FA) فور الحفظ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployeeInvite} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    الاسم الكامل للموظف *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    placeholder="مثال: فهد العتيبي"
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    البريد الإلكتروني الرسمي *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="fahad@riwaq.sa"
                    dir="ltr"
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-xs font-semibold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={inviteJobTitle}
                    onChange={(e) => setInviteJobTitle(e.target.value)}
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    رقم الجوال (لواتساب الأعمال)
                  </label>
                  <input
                    type="text"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-xs font-semibold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/60 p-3.5 space-y-3">
                <div className="text-xs font-extrabold text-[#1E3A8A]">
                  إعداد الثلاثي الحاكم للصلاحيات (Access Control Triad)
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#475569]">
                      1. ملف الصلاحيات
                    </label>
                    <select
                      value={inviteProfile}
                      onChange={(e) => setInviteProfile(e.target.value)}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F172A]"
                    >
                      {profileOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#475569]">
                      2. الدور في الشجرة
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F172A]"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#475569]">
                      3. المدير المباشر
                    </label>
                    <select
                      value={inviteManager}
                      onChange={(e) => setInviteManager(e.target.value)}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F172A]"
                    >
                      <option value="طارق العتيبي (مدير مبيعات أول)">
                        طارق العتيبي (مدير مبيعات أول)
                      </option>
                      <option value="سلمان القحطاني (مدير المبيعات التنفيذي)">
                        سلمان القحطاني (مدير المبيعات التنفيذي)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569] hover:bg-[#F8FAFC]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>إرسال الدعوة وتفعيل الصلاحيات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Freeze Account / Transfer Records (تجميد الحساب / نقل السجلات) */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#FECDD3] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#FFE4E6] bg-[#FFF1F2] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E11D48] text-white">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#881337]">
                    تجميد الحساب ونقل ملكية السجلات النشطة
                  </h3>
                  <p className="text-[11px] text-[#BE123C]">
                    الموظف المحدد: {selectedEmployee.fullName} ({selectedEmployee.empCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFreezeModal(false)}
                className="rounded-lg p-1 text-[#BE123C] hover:bg-[#FFE4E6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-xs leading-relaxed text-[#475569]">
                سيؤدي تجميد الحساب إلى إيقاف جلسات الدخول الفورية وإخراج الموظف من التوزيع التلقائي (Round-Robin) مع نقل الصفقات والعملاء المحتملين النشطين إلى الموظف البديل:
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                  نقل كافة السجلات والصفقات الجارية إلى:
                </label>
                <select
                  value={transferTargetEmp}
                  onChange={(e) => setTransferTargetEmp(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-extrabold text-[#0F172A]"
                >
                  {employees
                    .filter((e) => e.id !== selectedEmployee.id)
                    .map((e) => (
                      <option key={e.id} value={e.fullName}>
                        {e.fullName} — {e.roleTag}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowFreezeModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569]"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedEmployee({
                      shiftStatus: 'suspended',
                      shiftBadgeShort: 'معلق',
                      shiftBadgeFull: 'حساب مجمد أمنياً',
                      dotColor: 'bg-[#EF4444]',
                    });
                    if (currentOrganization.active_users_count > 1) {
                      void updateOrganizationSubscription({
                        active_users_count: currentOrganization.active_users_count - 1,
                      });
                    }
                    setShowFreezeModal(false);
                    triggerToast(
                      `تم تجميد حساب «${selectedEmployee.fullName}» وتحرير مقعد نشط ونقل السجلات إلى «${transferTargetEmp}»`
                    );
                  }}
                  className="rounded-lg bg-[#E11D48] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#BE123C]"
                >
                  تأكيد التجميد ونقل السجلات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Active Seats Limit Reached / Upgrade Prompt Modal */}
      {showSeatLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#FECDD3] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#FFE4E6] bg-[#FFF1F2] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E11D48] text-white">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#881337]">
                    تم الوصول للحد الأقصى للمقاعد النشطة ({currentOrganization.active_users_count} /{' '}
                    {currentOrganization.seats_limit})
                  </h3>
                  <p className="text-[11px] text-[#BE123C]">
                    حوكمة التراخيص — {currentOrganization.name} (باقة {currentOrganization.plan})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSeatLimitModal(false)}
                className="rounded-lg p-1 text-[#BE123C] hover:bg-[#FFE4E6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-xs leading-relaxed text-[#475569]">
                لا يمكن دعوة أو تفعيل موظف جديد لأن المؤسسة استنفدت كامل التراخيص المتاحة في باقتها
                الحالية ({currentOrganization.seats_limit} مقعد). يرجى ترقية عدد المقاعد من صفحة إدارة
                الباقة أو إضافة 5 مقاعد فورية للمتابعة.
              </p>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span>المقاعد المستهلكة حالياً:</span>
                  <span className="text-[#E11D48]">
                    {currentOrganization.active_users_count} / {currentOrganization.seats_limit}{' '}
                    مقعد (100%)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowSeatLimitModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#475569]"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void updateOrganizationSubscription({
                      seats_limit: currentOrganization.seats_limit + 5,
                    });
                    setShowSeatLimitModal(false);
                    setShowInviteModal(true);
                    triggerToast('تمت إضافة +5 مقاعد جديدة للباقة وفتح نافذة دعوة الموظف');
                  }}
                  className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs font-extrabold text-[#004AC6] hover:bg-[#DBEAFE]"
                >
                  + إضافة 5 مقاعد فورية والمتابعة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSeatLimitModal(false);
                    navigate('/settings/subscription');
                  }}
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999]"
                >
                  إدارة الباقة والمقاعد ←
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
