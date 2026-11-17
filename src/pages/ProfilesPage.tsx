import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Copy,
  CreditCard,
  EyeOff,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Headphones,
  History,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { CrmModuleKey, CrmProfile, FieldAccessLevel } from '../types/crm';

interface CrudRowConfig {
  key: 'leads' | 'contacts' | 'accounts' | 'deals' | 'tasks' | 'reports' | 'settings';
  crmModule?: CrmModuleKey;
  title: string;
  subtitle: string;
  iconType: 'leads' | 'contacts' | 'accounts' | 'deals' | 'tasks' | 'reports' | 'settings';
  highlightRow?: boolean;
  viewScope:
    | 'كل سجلات الفرع'
    | 'وصول كامل'
    | 'الفريق والفرع'
    | 'تقارير الفريق'
    | 'قراءة فقط'
    | 'ممنوع';
  createMode: 'allowed' | 'denied' | 'custom_only';
  editAllowed: boolean;
  deleteMode: 'allowed' | 'denied' | 'disabled_badge' | 'locked_badge';
  exportAllowed: boolean;
  bulkAllowed: boolean;
}

interface FlsCardItem {
  id: string;
  title: string;
  techKeyDisplay: string;
  categoryBadge: string;
  categoryTone: 'emerald' | 'indigo' | 'danger' | 'blue';
  moduleFilterGroup: 'all' | 'leads' | 'deals' | 'accounts';
  mappedModule: CrmModuleKey;
  mappedFieldKeys: string[];
  writeLabel: string;
  hiddenLabel: string;
  access: FieldAccessLevel;
}

interface AdminAutomationPolicy {
  massWhatsappEnabled: boolean;
  blueprintOverrideEnabled: boolean;
  changeOwnerEnabled: boolean;
}

interface RichProfileConfig {
  id: string;
  crmProfileId: string;
  code: string;
  listTitle: string;
  headerFullTitle: string;
  subtitle: string;
  footerTag: string;
  description: string;
  employeesCount: number;
  employeesBadgeText: string;
  iconStyle: 'red' | 'blue' | 'emerald' | 'indigo' | 'slate';
  deleteSummaryText: string;
  exportSummaryText: string;
  discountCeilingText: string;
  crudRows: CrudRowConfig[];
  flsCards: FlsCardItem[];
  adminPolicies: AdminAutomationPolicy;
}

const VIEW_SCOPE_CYCLE: CrudRowConfig['viewScope'][] = [
  'كل سجلات الفرع',
  'وصول كامل',
  'الفريق والفرع',
  'تقارير الفريق',
  'قراءة فقط',
  'ممنوع',
];

function createStandardSalesCrudRows(): CrudRowConfig[] {
  return [
    {
      key: 'leads',
      crmModule: 'leads',
      title: 'العملاء المحتملين (Leads)',
      subtitle: 'إدارة وتأهيل الوارد',
      iconType: 'leads',
      viewScope: 'كل سجلات الفرع',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'disabled_badge',
      exportAllowed: true,
      bulkAllowed: true,
    },
    {
      key: 'contacts',
      crmModule: 'contacts',
      title: 'جهات الاتصال (Contacts)',
      subtitle: 'أفراد وممثلو الشركات',
      iconType: 'contacts',
      viewScope: 'وصول كامل',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'denied',
      exportAllowed: true,
      bulkAllowed: true,
    },
    {
      key: 'accounts',
      crmModule: 'accounts',
      title: 'الشركات والحسابات (Accounts)',
      subtitle: 'الملفات الرسمية للكيانات',
      iconType: 'accounts',
      viewScope: 'وصول كامل',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'denied',
      exportAllowed: true,
      bulkAllowed: false,
    },
    {
      key: 'deals',
      crmModule: 'deals',
      title: 'الصفقات والمبيعات (Deals)',
      subtitle: 'مسارات بايبلاين B2B',
      iconType: 'deals',
      highlightRow: true,
      viewScope: 'الفريق والفرع',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'locked_badge',
      exportAllowed: true,
      bulkAllowed: false,
    },
    {
      key: 'tasks',
      crmModule: 'tasks',
      title: 'المهام والأنشطة (Activities)',
      subtitle: 'الاتصالات والاجتماعات',
      iconType: 'tasks',
      viewScope: 'وصول كامل',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'allowed',
      exportAllowed: false,
      bulkAllowed: true,
    },
    {
      key: 'reports',
      title: 'التقارير ولوحات الأداء',
      subtitle: 'مؤشرات KPI والمبيعات',
      iconType: 'reports',
      viewScope: 'تقارير الفريق',
      createMode: 'custom_only',
      editAllowed: true,
      deleteMode: 'denied',
      exportAllowed: true,
      bulkAllowed: false,
    },
    {
      key: 'settings',
      title: 'إعدادات النظام والبلوبرينت',
      subtitle: 'تخصيص الحقول ومراحل العمل',
      iconType: 'settings',
      viewScope: 'قراءة فقط',
      createMode: 'denied',
      editAllowed: false,
      deleteMode: 'denied',
      exportAllowed: false,
      bulkAllowed: false,
    },
  ];
}

function createStandardSalesFlsCards(): FlsCardItem[] {
  return [
    {
      id: 'fls_phone_email',
      title: 'رقم الجوال والبريد الأساسي',
      techKeyDisplay: "الحقل: 'lead_phone_primary' & 'email'",
      categoryBadge: 'تواصل حيوي',
      categoryTone: 'emerald',
      moduleFilterGroup: 'leads',
      mappedModule: 'leads',
      mappedFieldKeys: ['phone', 'email', 'branch_region'],
      writeLabel: 'قراءة وتعديل',
      hiddenLabel: 'مخفي',
      access: 'read_write',
    },
    {
      id: 'fls_utm_capi',
      title: 'مصدر الإعلان وبيانات UTM & CAPI',
      techKeyDisplay: "الحقل: 'utm_campaign_id' & 'ad_meta'",
      categoryBadge: 'تسويق وتحليل',
      categoryTone: 'indigo',
      moduleFilterGroup: 'leads',
      mappedModule: 'leads',
      mappedFieldKeys: ['source', 'campaign', 'utmSource'],
      writeLabel: 'قراءة وتعديل',
      hiddenLabel: 'مخفي',
      access: 'read_only',
    },
    {
      id: 'fls_internal_margin',
      title: 'الميزانية المعتمدة داخلياً وهامش الربح',
      techKeyDisplay: "الحقل: 'internal_cost_margin'",
      categoryBadge: 'سري للغاية',
      categoryTone: 'danger',
      moduleFilterGroup: 'deals',
      mappedModule: 'leads',
      mappedFieldKeys: ['approvedBudget', 'requested_service'],
      writeLabel: 'قراءة وتعديل',
      hiddenLabel: 'مخفي تماماً',
      access: 'hidden',
    },
    {
      id: 'fls_max_discount',
      title: 'نسبة الخصم المسموح تقديمها',
      techKeyDisplay: "الحقل: 'max_discount_percentage'",
      categoryBadge: 'سقف 15%',
      categoryTone: 'emerald',
      moduleFilterGroup: 'deals',
      mappedModule: 'deals',
      mappedFieldKeys: ['amount', 'probability', 'contract_duration_months'],
      writeLabel: 'تعديل مقيد',
      hiddenLabel: 'مخفي',
      access: 'read_write',
    },
    {
      id: 'fls_cr_vat',
      title: 'الرقم الضريبي والسجل التجاري (CR & VAT)',
      techKeyDisplay: "الحقل: 'tax_identification_number'",
      categoryBadge: 'بيانات الفوترة',
      categoryTone: 'blue',
      moduleFilterGroup: 'accounts',
      mappedModule: 'accounts',
      mappedFieldKeys: ['commercial_reg_no', 'customer_tier'],
      writeLabel: 'قراءة وتعديل',
      hiddenLabel: 'مخفي',
      access: 'read_write',
    },
    {
      id: 'fls_credit_score',
      title: 'التقييم الائتماني والحد المالي (Credit Score)',
      techKeyDisplay: "الحقل: 'credit_risk_evaluation'",
      categoryBadge: 'إدارة المخاطر',
      categoryTone: 'indigo',
      moduleFilterGroup: 'accounts',
      mappedModule: 'accounts',
      mappedFieldKeys: ['annualRevenue', 'estimatedValue'],
      writeLabel: 'قراءة وتعديل',
      hiddenLabel: 'مخفي',
      access: 'read_only',
    },
  ];
}

const INITIAL_PROFILES_LIST: RichProfileConfig[] = [
  {
    id: 'ui_prof_super_admin',
    crmProfileId: 'prof_admin',
    code: 'PRF-ADM-01',
    listTitle: 'مدير النظام العام (Super Admin)',
    headerFullTitle: 'ملف الصلاحيات: مدير النظام العام (Super Admin)',
    subtitle: 'كافة الصلاحيات غير مقيدة إطلاقاً',
    footerTag: 'وصول شامل للسيرفر والبلوبرينت',
    description:
      'صلاحيات مطلقة لكافة الوحدات الإدارية والمالية، مع القدرة الكاملة على تعديل البلوبرينت، قواعد الأتمتة، وتصدير أو حذف السجلات.',
    employeesCount: 2,
    employeesBadgeText: '2 موظفين',
    iconStyle: 'red',
    deleteSummaryText: 'مسموح بالكامل ✓',
    exportSummaryText: 'مفتوح بدون قيود',
    discountCeilingText: 'صلاحية مطلقة 100%',
    crudRows: createStandardSalesCrudRows().map((r) => ({
      ...r,
      viewScope: 'وصول كامل',
      createMode: 'allowed',
      editAllowed: true,
      deleteMode: 'allowed',
      exportAllowed: true,
      bulkAllowed: true,
    })),
    flsCards: createStandardSalesFlsCards().map((f) => ({
      ...f,
      access: 'read_write',
    })),
    adminPolicies: {
      massWhatsappEnabled: true,
      blueprintOverrideEnabled: true,
      changeOwnerEnabled: true,
    },
  },
  {
    id: 'ui_prof_standard_sales',
    crmProfileId: 'prof_sales_director',
    code: 'PRF-B2B-04',
    listTitle: 'مبيعات متقدمة (Standard Sales)',
    headerFullTitle: 'ملف الصلاحيات: مبيعات متقدمة (Enterprise Sales Profile)',
    subtitle: 'الملف الافتراضي لفرق مبيعات B2B',
    footerTag: 'مفعل ومطبق حالياً',
    description:
      'مخصص لمسؤولي ومدراء الحسابات في قطاع الشركات B2B. يتيح التحكم الكامل في دورة الصفقات والتواصل مع منع الحذف التام وحجب هوامش الأرباح التقديرية لحماية السرية المالية.',
    employeesCount: 12,
    employeesBadgeText: '12 موظف',
    iconStyle: 'blue',
    deleteSummaryText: 'معطل تماماً',
    exportSummaryText: 'بموافقة المدير فقط',
    discountCeilingText: 'حد أقصى 15%',
    crudRows: createStandardSalesCrudRows(),
    flsCards: createStandardSalesFlsCards(),
    adminPolicies: {
      massWhatsappEnabled: true,
      blueprintOverrideEnabled: false,
      changeOwnerEnabled: true,
    },
  },
  {
    id: 'ui_prof_sdr',
    crmProfileId: 'prof_account_exec',
    code: 'PRF-SDR-02',
    listTitle: 'مندوب تأهيل وحملات (SDR)',
    headerFullTitle: 'ملف الصلاحيات: مندوب تأهيل وحملات (SDR Profile)',
    subtitle: 'صلاحيات مقيدة للعملاء المحتملين فقط',
    footerTag: 'قنوات الحملات وإدخال البيانات',
    description:
      'مصمم لفرق التأهيل الهاتفي ومتابعة الحملات الإعلانية؛ يتيح إدخال وتأهيل العملاء المحتملين وتحويلهم دون الاطلاع على العقود المالية المغلقة.',
    employeesCount: 8,
    employeesBadgeText: '8 موظفين',
    iconStyle: 'emerald',
    deleteSummaryText: 'معطل تماماً',
    exportSummaryText: 'غير مصرح',
    discountCeilingText: 'غير مصرح (0%)',
    crudRows: createStandardSalesCrudRows().map((r) =>
      r.key === 'leads' || r.key === 'tasks'
        ? r
        : {
            ...r,
            viewScope: 'قراءة فقط',
            createMode: 'denied',
            editAllowed: false,
            deleteMode: 'denied',
            exportAllowed: false,
            bulkAllowed: false,
          }
    ),
    flsCards: createStandardSalesFlsCards().map((f) =>
      f.id === 'fls_phone_email'
        ? { ...f, access: 'read_write' }
        : f.id === 'fls_utm_capi'
        ? { ...f, access: 'read_only' }
        : { ...f, access: 'hidden' }
    ),
    adminPolicies: {
      massWhatsappEnabled: true,
      blueprintOverrideEnabled: false,
      changeOwnerEnabled: false,
    },
  },
  {
    id: 'ui_prof_cs',
    crmProfileId: 'prof_account_exec',
    code: 'PRF-CSM-05',
    listTitle: 'دعم فني ونجاح العملاء',
    headerFullTitle: 'ملف الصلاحيات: دعم فني ونجاح العملاء (Customer Success)',
    subtitle: 'التذاكر، الحسابات وجهات الاتصال',
    footerTag: 'حظر تعديل القيم المالية والعقود',
    description:
      'يتيح متابعة الشركات، جهات الاتصال، والمهام بعد البيع مع حظر تعديل مبالغ الصفقات أو شروط العقود التجارية.',
    employeesCount: 4,
    employeesBadgeText: '4 موظفين',
    iconStyle: 'indigo',
    deleteSummaryText: 'معطل تماماً',
    exportSummaryText: 'تقارير الدعم فقط',
    discountCeilingText: 'تجديد العقود 5%',
    crudRows: createStandardSalesCrudRows().map((r) =>
      r.key === 'contacts' || r.key === 'accounts' || r.key === 'tasks'
        ? r
        : {
            ...r,
            viewScope: 'قراءة فقط',
            createMode: 'denied',
            editAllowed: false,
            deleteMode: 'denied',
            exportAllowed: false,
            bulkAllowed: false,
          }
    ),
    flsCards: createStandardSalesFlsCards().map((f) =>
      f.id === 'fls_phone_email'
        ? { ...f, access: 'read_write' }
        : f.id === 'fls_internal_margin'
        ? { ...f, access: 'hidden' }
        : { ...f, access: 'read_only' }
    ),
    adminPolicies: {
      massWhatsappEnabled: false,
      blueprintOverrideEnabled: false,
      changeOwnerEnabled: false,
    },
  },
  {
    id: 'ui_prof_finance',
    crmProfileId: 'prof_account_exec',
    code: 'PRF-FIN-06',
    listTitle: 'محاسب ومسؤول فوترة',
    headerFullTitle: 'ملف الصلاحيات: محاسب ومسؤول فوترة (Finance & Billing)',
    subtitle: 'قراءة الصفقات، الفواتير والمدفوعات',
    footerTag: 'قراءة التقارير والمبيعات المقفلة',
    description:
      'مخصص للإدارة المالية للمراجعة الضريبية وإصدار الفواتير ومتابعة التحصيل دون تعديل مسار المبيعات.',
    employeesCount: 1,
    employeesBadgeText: 'موظف واحد',
    iconStyle: 'slate',
    deleteSummaryText: 'معطل تماماً',
    exportSummaryText: 'مسموح للتقارير المالية',
    discountCeilingText: 'اعتماد مالي 20%',
    crudRows: createStandardSalesCrudRows().map((r) =>
      r.key === 'accounts' || r.key === 'reports'
        ? { ...r, viewScope: 'وصول كامل', exportAllowed: true }
        : {
            ...r,
            viewScope: 'قراءة فقط',
            createMode: 'denied',
            editAllowed: false,
            deleteMode: 'denied',
          }
    ),
    flsCards: createStandardSalesFlsCards().map((f) =>
      f.id === 'fls_cr_vat' || f.id === 'fls_credit_score'
        ? { ...f, access: 'read_write' }
        : { ...f, access: 'read_only' }
    ),
    adminPolicies: {
      massWhatsappEnabled: false,
      blueprintOverrideEnabled: false,
      changeOwnerEnabled: false,
    },
  },
];

export const ProfilesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    profiles: crmProfiles,
    customFields,
    setActiveProfileId,
    createProfile,
    updateProfileSecurity,
    currentOrganization,
    updateProfileAddons,
  } = useCrm();

  const [profileSearch, setProfileSearch] = useState('');
  const [profilesList, setProfilesList] =
    useState<RichProfileConfig[]>(INITIAL_PROFILES_LIST);
  const [selectedUiProfileId, setSelectedUiProfileId] = useState<string>(
    'ui_prof_standard_sales'
  );
  const [activeAnchorTab, setActiveAnchorTab] = useState<'crud' | 'fls' | 'admin'>(
    'crud'
  );
  const [flsEntityFilter, setFlsEntityFilter] = useState<
    'all' | 'leads' | 'deals' | 'accounts'
  >('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');

  const [editHeaderModalOpen, setEditHeaderModalOpen] = useState(false);
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [editDescDraft, setEditDescDraft] = useState('');

  const [savingToFirestore, setSavingToFirestore] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const crudSectionRef = useRef<HTMLDivElement>(null);
  const flsSectionRef = useRef<HTMLDivElement>(null);
  const adminSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const selectedProfile = useMemo(
    () =>
      profilesList.find((p) => p.id === selectedUiProfileId) ??
      profilesList[1] ??
      profilesList[0],
    [profilesList, selectedUiProfileId]
  );

  const filteredProfilesList = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    if (!q) return profilesList;
    return profilesList.filter(
      (p) =>
        p.listTitle.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    );
  }, [profileSearch, profilesList]);

  const filteredFlsCards = useMemo(() => {
    if (flsEntityFilter === 'all') return selectedProfile.flsCards;
    return selectedProfile.flsCards.filter(
      (c) => c.moduleFilterGroup === flsEntityFilter
    );
  }, [selectedProfile.flsCards, flsEntityFilter]);

  const totalActiveUsersCount = useMemo(
    () => profilesList.reduce((acc, p) => acc + p.employeesCount, 0),
    [profilesList]
  );

  // Convert UI profile CRUD + FLS into CrmProfile modulePermissions + fieldSecurity
  const buildCrmPayloadFromUiProfile = (prof: RichProfileConfig) => {
    const baseCrud: CrmProfile['modulePermissions'] = {
      leads: { create: true, read: true, update: true, delete: false },
      contacts: { create: true, read: true, update: true, delete: false },
      accounts: { create: true, read: true, update: true, delete: false },
      deals: { create: true, read: true, update: true, delete: false },
      quotes: { create: true, read: true, update: true, delete: false },
      sales_orders: { create: false, read: true, update: false, delete: false },
      invoices: { create: false, read: true, update: false, delete: false },
      tasks: { create: true, read: true, update: true, delete: true },
    };

    for (const row of prof.crudRows) {
      if (row.crmModule) {
        baseCrud[row.crmModule] = {
          read: row.viewScope !== 'ممنوع',
          create: row.createMode === 'allowed',
          update: row.editAllowed,
          delete: row.deleteMode === 'allowed',
        };
      }
    }

    const fieldSec: CrmProfile['fieldSecurity'] = {
      leads: {},
      contacts: {},
      accounts: {},
      deals: {},
      invoices: {},
    };

    for (const card of prof.flsCards) {
      for (const fKey of card.mappedFieldKeys) {
        if (!fieldSec[card.mappedModule]) {
          fieldSec[card.mappedModule] = {};
        }
        fieldSec[card.mappedModule][fKey] = card.access;
        if (card.id === 'fls_phone_email') {
          fieldSec.contacts[fKey] = card.access;
        }
      }
    }

    return {
      modulePermissions: baseCrud,
      fieldSecurity: fieldSec,
    };
  };

  const syncUiProfileToCrmAndFirestore = async (
    nextProfile: RichProfileConfig,
    customToast?: string
  ) => {
    setSavingToFirestore(true);
    try {
      const { modulePermissions, fieldSecurity } =
        buildCrmPayloadFromUiProfile(nextProfile);

      setActiveProfileId(nextProfile.crmProfileId);
      await updateProfileSecurity(nextProfile.crmProfileId, {
        name: nextProfile.listTitle,
        description: nextProfile.description,
        modulePermissions,
        fieldSecurity,
      });

      if (customToast) {
        setToastMsg(customToast);
      }
    } finally {
      setSavingToFirestore(false);
    }
  };

  const updateCurrentProfile = (
    updater: (prev: RichProfileConfig) => RichProfileConfig,
    autoSyncToCrm = false
  ) => {
    setProfilesList((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProfile.id) return p;
        const updated = updater(p);
        if (autoSyncToCrm) {
          void syncUiProfileToCrmAndFirestore(updated);
        }
        return updated;
      })
    );
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void syncUiProfileToCrmAndFirestore(
          selectedProfile,
          `تم حفظ وتطبيق مصفوفة الصلاحيات فوراً على ${selectedProfile.employeesCount} موظف في Firestore`
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProfile]);

  const handleSelectProfile = (prof: RichProfileConfig) => {
    setSelectedUiProfileId(prof.id);
    setActiveProfileId(prof.crmProfileId);
  };

  const handleCycleViewScope = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) => {
        if (r.key !== rowKey) return r;
        const idx = VIEW_SCOPE_CYCLE.indexOf(r.viewScope);
        const nextScope = VIEW_SCOPE_CYCLE[(idx + 1) % VIEW_SCOPE_CYCLE.length];
        return { ...r, viewScope: nextScope };
      }),
    }), true);
  };

  const handleToggleCrudCreate = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) => {
        if (r.key !== rowKey) return r;
        const nextMode: CrudRowConfig['createMode'] =
          r.createMode === 'allowed' ? 'denied' : 'allowed';
        return { ...r, createMode: nextMode };
      }),
    }), true);
  };

  const handleToggleCrudEdit = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) =>
        r.key === rowKey ? { ...r, editAllowed: !r.editAllowed } : r
      ),
    }), true);
  };

  const handleToggleCrudDelete = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) => {
        if (r.key !== rowKey) return r;
        const nextDel: CrudRowConfig['deleteMode'] =
          r.deleteMode === 'allowed' ? 'disabled_badge' : 'allowed';
        return { ...r, deleteMode: nextDel };
      }),
    }), true);
  };

  const handleToggleCrudExport = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) =>
        r.key === rowKey ? { ...r, exportAllowed: !r.exportAllowed } : r
      ),
    }), true);
  };

  const handleToggleCrudBulk = (rowKey: CrudRowConfig['key']) => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) =>
        r.key === rowKey ? { ...r, bulkAllowed: !r.bulkAllowed } : r
      ),
    }), true);
  };

  const handleGrantAllView = () => {
    updateCurrentProfile((prev) => ({
      ...prev,
      crudRows: prev.crudRows.map((r) => ({ ...r, viewScope: 'وصول كامل' })),
    }), true);
    setToastMsg('تم منح صلاحية العرض الكامل لجميع الموديولات');
  };

  const handleBlockAllDelete = () => {
    updateCurrentProfile((prev) => ({
      ...prev,
      deleteSummaryText: 'معطل تماماً',
      crudRows: prev.crudRows.map((r) => ({
        ...r,
        deleteMode:
          r.key === 'leads'
            ? 'disabled_badge'
            : r.key === 'deals'
            ? 'locked_badge'
            : 'denied',
      })),
    }), true);
    setToastMsg('تم حظر الحذف النهائي عبر كافة الموديولات في هذا الملف');
  };

  const handleSetFlsAccess = (cardId: string, nextAccess: FieldAccessLevel) => {
    updateCurrentProfile(
      (prev) => ({
        ...prev,
        flsCards: prev.flsCards.map((c) =>
          c.id === cardId ? { ...c, access: nextAccess } : c
        ),
      }),
      true
    );
    const labelMap: Record<FieldAccessLevel, string> = {
      read_write: 'قراءة وتعديل',
      read_only: 'قراءة فقط 🔒',
      hidden: 'مخفي تماماً 👁️',
    };
    setToastMsg(`تم تطبيق صلاحية الحقل (${labelMap[nextAccess]}) فوراً في النظام`);
  };

  const handleCloneSelectedProfile = async () => {
    const cloneId = `ui_prof_clone_${Date.now()}`;
    const cloneName = `${selectedProfile.listTitle} (نسخة مستنسخة)`;
    const cloned: RichProfileConfig = {
      ...selectedProfile,
      id: cloneId,
      code: `PRF-CLN-0${profilesList.length + 1}`,
      listTitle: cloneName,
      headerFullTitle: `ملف الصلاحيات: ${cloneName}`,
      employeesCount: 0,
      employeesBadgeText: '0 موظفين',
      footerTag: 'مستنسخ وجاهز للتخصيص',
    };

    setProfilesList((prev) => [...prev, cloned]);
    setSelectedUiProfileId(cloneId);
    await createProfile({
      name: cloneName.slice(0, 95),
      description: selectedProfile.description.slice(0, 380),
    });
    setToastMsg(`تم استنساخ الملف «${selectedProfile.listTitle}» وحفظه في Firestore`);
  };

  const handleCreateNewProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const cleanName = newProfileName.trim();
    const newId = `ui_prof_new_${Date.now()}`;
    const created: RichProfileConfig = {
      ...selectedProfile,
      id: newId,
      code: `PRF-CST-0${profilesList.length + 1}`,
      listTitle: cleanName,
      headerFullTitle: `ملف الصلاحيات: ${cleanName}`,
      subtitle: 'ملف صلاحيات مخصص',
      footerTag: 'مفعل وجاهز للإسناد',
      description:
        newProfileDesc.trim() ||
        'ملف صلاحيات مخصص تم إنشاؤه لضبط مصفوفة الموديولات ومستوى أمان الحقول (FLS).',
      employeesCount: 1,
      employeesBadgeText: 'موظف واحد',
      iconStyle: 'blue',
    };

    setProfilesList((prev) => [...prev, created]);
    setSelectedUiProfileId(newId);
    setNewProfileName('');
    setNewProfileDesc('');
    setCreateModalOpen(false);

    await createProfile({
      name: cleanName.slice(0, 95),
      description: created.description.slice(0, 380),
    });
    setToastMsg(`تم إنشاء ملف الصلاحيات الجديد "${cleanName}" في Firestore بنجاح`);
  };

  const handleImportJsonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportJsonModalOpen(false);
    setJsonInputText('');
    await syncUiProfileToCrmAndFirestore(
      selectedProfile,
      'تم استيراد مصفوفة الأذونات (JSON) وتحديث Firestore بنجاح'
    );
  };

  const handleSaveHeaderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitleDraft.trim()) return;
    updateCurrentProfile(
      (prev) => ({
        ...prev,
        listTitle: editTitleDraft.trim(),
        headerFullTitle: editTitleDraft.trim(),
        description: editDescDraft.trim() || prev.description,
      }),
      true
    );
    setEditHeaderModalOpen(false);
    setToastMsg('تم تحديث بيانات ملف الصلاحيات في Firestore');
  };

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* 1. FLUSH WHITE HEADER & SECURITY TABS */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-4 pb-0">
        <div className="w-full space-y-3.5">
          {/* Top Row: Breadcrumb + Title (Right in RTL) | Import JSON + "+ إنشاء ملف صلاحيات جديد" (Left in RTL) */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Right: Breadcrumb + Title + Enterprise Badge */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
                <Link to="/settings" className="hover:text-[#2563EB] font-medium">
                  الإعدادات والنظام
                </Link>
                <span className="text-[#CBD5E1]">‹</span>
                <span>الأمان والتحكم</span>
                <span className="text-[#CBD5E1]">‹</span>
                <span className="font-bold text-[#0F172A]">
                  مصفوفة الصلاحيات ومستوى الحقول
                </span>
              </div>

              <h1 className="text-[22px] sm:text-[24px] font-extrabold text-[#0F172A] leading-tight">
                التحكم الأمني والصلاحيات والأدوار
              </h1>

              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-0.5 text-[11px] font-extrabold text-[#047857]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#059669]" />
                  <span>مستوى الأمان المؤسسي: Enterprise A+</span>
                </span>
              </div>
            </div>

            {/* Left: Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setImportJsonModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-3.5 py-2 text-[11px] font-bold text-[#334155] transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-[#64748B]" />
                <span className="text-right leading-tight">
                  استيراد مصفوفة أذونات
                  <span className="block font-mono text-[10px] text-[#64748B]">
                    (JSON)
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="text-right leading-tight">
                  إنشاء ملف صلاحيات
                  <span className="block text-[10px] font-bold text-[#DBEAFE]">
                    جديد
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Security Navigation Tabs Row */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[#F1F5F9] pt-2">
            {/* Tab 1: ACTIVE ("ملفات الصلاحيات (Profiles)") */}
            <button
              type="button"
              className="inline-flex items-center gap-2 border-b-2 border-[#2563EB] bg-[#EFF6FF]/60 px-4 py-2.5 text-[12px] font-extrabold text-[#2563EB] whitespace-nowrap rounded-t-lg"
            >
              <Shield className="h-4 w-4 text-[#2563EB]" />
              <span>ملفات الصلاحيات (Profiles)</span>
              <span className="rounded-full bg-[#2563EB] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#FFFFFF] tabular-nums">
                { Math.max(profilesList.length, crmProfiles.length) }
              </span>
            </button>

            {/* Tab 2: Navigate to /settings/roles */}
            <button
              type="button"
              onClick={() => navigate('/settings/roles')}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-[12px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors whitespace-nowrap"
            >
              <GitBranch className="h-4 w-4" />
              <span>الأدوار والهيكل التنظيمي (Role Hierarchy)</span>
            </button>

            {/* Tab 3 */}
            <button
              type="button"
              onClick={() => navigate('/settings/roles')}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-[12px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors whitespace-nowrap"
            >
              <Sliders className="h-4 w-4" />
              <span>قواعد مشاركة البيانات (Data Sharing Rules)</span>
            </button>

            {/* Tab 4 */}
            <button
              type="button"
              onClick={() =>
                setToastMsg('سجل التدقيق الأمني متوافق مع ضوابط الأمن السيبراني (NCA-ECC)')
              }
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-[12px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors whitespace-nowrap"
            >
              <History className="h-4 w-4" />
              <span>سجل التدقيق الأمني (Audit Log)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. 2-COLUMN WORKSPACE (Right Column 26% | Left Column 74%) */}
      <div className="w-full flex-1 px-6 py-5">
        <div className="w-full grid grid-cols-1 xl:grid-cols-[26%_74%] gap-5 items-start">
          {/* RIGHT COLUMN (26%): SEARCHABLE PROFILES LIST */}
          <aside className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
            {/* List Header */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-extrabold text-[#0F172A]">
                الملفات المعتمدة ({profilesList.length})
              </h2>
              <span className="text-[11px] font-semibold text-[#64748B] tabular-nums">
                {totalActiveUsersCount} مستخدم نشط إجمالاً
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                placeholder="بحث في أسماء وملفات الأمان..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-2 text-[11px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>

            {/* Profile Cards */}
            <div className="space-y-2.5">
              {filteredProfilesList.map((prof) => {
                const isSelected = prof.id === selectedProfile.id;

                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => handleSelectProfile(prof)}
                    className={`w-full rounded-2xl p-3.5 text-right transition-all space-y-2.5 ${
                      isSelected
                        ? 'border-2 border-[#2563EB] bg-[#EFF6FF]/40 shadow-xs'
                        : 'border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Profile Icon */}
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                            isSelected
                              ? 'bg-[#2563EB] text-[#FFFFFF]'
                              : prof.iconStyle === 'red'
                              ? 'bg-[#FEE2E2] text-[#DC2626]'
                              : prof.iconStyle === 'emerald'
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : prof.iconStyle === 'indigo'
                              ? 'bg-[#EEF2FF] text-[#4338CA]'
                              : prof.iconStyle === 'slate'
                              ? 'bg-[#F1F5F9] text-[#475569]'
                              : 'bg-[#EFF6FF] text-[#2563EB]'
                          }`}
                        >
                          {prof.iconStyle === 'red' && (
                            <ShieldAlert className="h-4 w-4" />
                          )}
                          {prof.iconStyle === 'blue' && (
                            <Briefcase className="h-4 w-4" />
                          )}
                          {prof.iconStyle === 'emerald' && (
                            <UserPlus className="h-4 w-4" />
                          )}
                          {prof.iconStyle === 'indigo' && (
                            <Headphones className="h-4 w-4" />
                          )}
                          {prof.iconStyle === 'slate' && (
                            <CreditCard className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3
                            className={`text-[13px] font-extrabold leading-snug ${
                              isSelected ? 'text-[#1D4ED8]' : 'text-[#0F172A]'
                            }`}
                          >
                            {prof.listTitle}
                          </h3>
                          <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                            {prof.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Employee Count Pill */}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 tabular-nums ${
                          isSelected
                            ? 'bg-[#2563EB] text-[#FFFFFF]'
                            : prof.iconStyle === 'red'
                            ? 'bg-[#FEF2F2] text-[#DC2626]'
                            : prof.iconStyle === 'emerald'
                            ? 'bg-[#ECFDF5] text-[#047857]'
                            : 'bg-[#F1F5F9] text-[#475569]'
                        }`}
                      >
                        {prof.employeesBadgeText}
                      </span>
                    </div>

                    {/* Card Footer Strip */}
                    <div className="border-t border-[#F1F5F9] pt-2 flex items-center justify-between text-[10px]">
                      {isSelected ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-extrabold text-[#059669]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                            <span>مفعل ومطبق حالياً</span>
                          </span>
                          <span className="rounded bg-[#DBEAFE] px-2 py-0.5 font-bold text-[#1E40AF]">
                            محدد للتحرير
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[#64748B] font-medium">
                            {prof.footerTag}
                          </span>
                          <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Clone Profile Button */}
            <button
              type="button"
              onClick={() => void handleCloneSelectedProfile()}
              className="w-full rounded-xl border border-dashed border-[#93C5FD] bg-[#EFF6FF]/40 hover:bg-[#EFF6FF] py-2.5 px-3 text-[11px] font-extrabold text-[#2563EB] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>+ استنساخ من ملف محدد (Clone Profile)</span>
            </button>
          </aside>

          {/* LEFT COLUMN (74%): SELECTED PROFILE PERMISSIONS MATRIX & FLS */}
          <main className="space-y-5">
            {/* TOP SUMMARY HEADER CARD */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
              {/* Row 1: Title + Code + Description (Right) | Edit & History Icons (Left) */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-[19px] sm:text-[20px] font-extrabold text-[#0F172A]">
                      {selectedProfile.headerFullTitle}
                    </h2>
                    <span className="rounded-md bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#2563EB]">
                      معرف: {selectedProfile.code}
                    </span>
                  </div>

                  <p className="text-[12px] text-[#64748B] leading-relaxed">
                    {selectedProfile.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitleDraft(selectedProfile.headerFullTitle);
                      setEditDescDraft(selectedProfile.description);
                      setEditHeaderModalOpen(true);
                    }}
                    title="تعديل اسم ووصف الملف"
                    aria-label="تعديل اسم ووصف الملف"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setToastMsg('سجل تغييرات الملف: آخر تحديث بواسطة طارق العتيبي')
                    }
                    title="سجل التعديلات"
                    aria-label="سجل التعديلات"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] transition-colors"
                  >
                    <History className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Box 1: Assigned Employees */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                  <p className="text-[11px] text-[#64748B]">الموظفون المرتبطون</p>
                  <p className="text-[15px] font-extrabold text-[#0F172A] mt-1 tabular-nums">
                    {selectedProfile.employeesCount} موظف نشط
                  </p>
                </div>

                {/* Box 2: Hard Delete Status */}
                <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/70 p-3 text-center">
                  <p className="text-[11px] text-[#BE123C]">صلاحية الحذف النهائي</p>
                  <p className="text-[14px] font-extrabold text-[#DC2626] mt-1 flex items-center justify-center gap-1">
                    <span>{selectedProfile.deleteSummaryText}</span>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[10px] text-[#FFFFFF]">
                      −
                    </span>
                  </p>
                </div>

                {/* Box 3: Excel Export Rule */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                  <p className="text-[11px] text-[#64748B]">تصدير ملفات Excel</p>
                  <p className="text-[14px] font-extrabold text-[#0F172A] mt-1">
                    {selectedProfile.exportSummaryText}
                  </p>
                </div>

                {/* Box 4: Automatic Discount Ceiling */}
                <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/80 p-3 text-center">
                  <p className="text-[11px] text-[#047857]">سقف الخصم التلقائي</p>
                  <p className="text-[15px] font-extrabold text-[#047857] mt-1 tabular-nums">
                    {selectedProfile.discountCeilingText}
                  </p>
                </div>
              </div>

              {/* Row 3: Section Anchor Sub-Tabs */}
              <div className="flex items-center gap-6 border-t border-[#F1F5F9] pt-2.5 text-[12px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAnchorTab('crud');
                    crudSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`inline-flex items-center gap-1.5 pb-1.5 font-extrabold transition-colors whitespace-nowrap border-b-2 ${
                    activeAnchorTab === 'crud'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>1. صلاحيات الموديولات (CRUD Matrix)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveAnchorTab('fls');
                    flsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`inline-flex items-center gap-1.5 pb-1.5 font-bold transition-colors whitespace-nowrap border-b-2 ${
                    activeAnchorTab === 'fls'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>2. صلاحيات مستوى الحقل (Field-Level Security)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveAnchorTab('admin');
                    adminSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`inline-flex items-center gap-1.5 pb-1.5 font-bold transition-colors whitespace-nowrap border-b-2 ${
                    activeAnchorTab === 'admin'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>3. الأذونات الإدارية والأتمتة</span>
                </button>
              </div>
            </section>

            {/* SECTION 1: مصفوفة صلاحيات العمليات الأساسية للموديولات (Module CRUD) */}
            <section
              ref={crudSectionRef}
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
            >
              {/* Section Header + Quick Bulk Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#2563EB]" />
                    <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                      مصفوفة صلاحيات العمليات الأساسية للموديولات (Module CRUD)
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    تحديد صلاحية العرض، الإضافة، التحديث، الحذف، التصدير والتعديل الجماعي لكل كيان داخل النظام.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[#64748B] font-semibold">تحديد سريع:</span>
                  <button
                    type="button"
                    onClick={handleGrantAllView}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-3 py-1.5 font-bold text-[#334155] transition-colors"
                  >
                    منح الكل عرض
                  </button>
                  <button
                    type="button"
                    onClick={handleBlockAllDelete}
                    className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] hover:bg-[#FFE4E6] px-3 py-1.5 font-extrabold text-[#DC2626] transition-colors"
                  >
                    حظر كل الحذف
                  </button>
                </div>
              </div>

              {/* CRUD Table */}
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-right border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                      <th className="py-3 px-4">الموديول والوحدة التنظيمية</th>
                      <th className="py-3 px-3 text-center">عرض (VIEW)</th>
                      <th className="py-3 px-3 text-center">إنشاء (CREATE)</th>
                      <th className="py-3 px-3 text-center">تعديل (EDIT)</th>
                      <th className="py-3 px-3 text-center">حذف (DELETE)</th>
                      <th className="py-3 px-3 text-center">تصدير (EXPORT)</th>
                      <th className="py-3 px-3 text-center">تحديث جماعي (BULK)</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F1F5F9] text-[12px]">
                    {selectedProfile.crudRows.map((row) => (
                      <tr
                        key={row.key}
                        className={`transition-colors ${
                          row.highlightRow
                            ? 'bg-[#EFF6FF]/45 hover:bg-[#EFF6FF]/70'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Col 1: Module Name & Icon */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                                row.highlightRow
                                  ? 'bg-[#2563EB] text-[#FFFFFF]'
                                  : 'bg-[#F1F5F9] text-[#475569]'
                              }`}
                            >
                              {row.iconType === 'leads' && (
                                <UserPlus className="h-4 w-4 text-[#2563EB]" />
                              )}
                              {row.iconType === 'contacts' && (
                                <Users className="h-4 w-4" />
                              )}
                              {row.iconType === 'accounts' && (
                                <Building2 className="h-4 w-4" />
                              )}
                              {row.iconType === 'deals' && (
                                <Briefcase className="h-4 w-4" />
                              )}
                              {row.iconType === 'tasks' && (
                                <CheckSquare className="h-4 w-4" />
                              )}
                              {row.iconType === 'reports' && (
                                <BarChart3 className="h-4 w-4" />
                              )}
                              {row.iconType === 'settings' && (
                                <Settings className="h-4 w-4" />
                              )}
                            </div>

                            <div>
                              <p
                                className={`text-[13px] font-extrabold leading-snug ${
                                  row.highlightRow
                                    ? 'text-[#2563EB]'
                                    : 'text-[#0F172A]'
                                }`}
                              >
                                {row.title}
                              </p>
                              <p className="text-[10px] text-[#64748B]">
                                {row.subtitle}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Col 2: VIEW Scope Pill */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleCycleViewScope(row.key)}
                            title="انقر لتغيير نطاق العرض"
                            className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-extrabold leading-tight transition-colors ${
                              row.viewScope === 'الفريق والفرع'
                                ? 'bg-[#DBEAFE] text-[#1D4ED8] border border-[#93C5FD]'
                                : row.viewScope === 'قراءة فقط' ||
                                  row.viewScope === 'ممنوع'
                                ? 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
                                : 'bg-[#D1FAE5] text-[#047857] border border-[#6EE7B7]'
                            }`}
                          >
                            {row.viewScope}
                          </button>
                        </td>

                        {/* Col 3: CREATE */}
                        <td className="py-3.5 px-3 text-center">
                          {row.createMode === 'custom_only' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCrudCreate(row.key)}
                              className="rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-bold text-[#475569]"
                            >
                              مخصص فقط
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCrudCreate(row.key)}
                              aria-label={`تبديل صلاحية الإنشاء لـ ${row.title}`}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                                row.createMode === 'allowed'
                                  ? 'border-2 border-[#059669] text-[#059669] bg-[#ECFDF5]'
                                  : 'border border-[#CBD5E1] text-[#CBD5E1] bg-[#F8FAFC]'
                              }`}
                            >
                              {row.createMode === 'allowed' ? (
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 4: EDIT */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCrudEdit(row.key)}
                            aria-label={`تبديل صلاحية التعديل لـ ${row.title}`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                              row.editAllowed
                                ? 'border-2 border-[#059669] text-[#059669] bg-[#ECFDF5]'
                                : 'border border-[#CBD5E1] text-[#CBD5E1] bg-[#F8FAFC]'
                            }`}
                          >
                            {row.editAllowed ? (
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Col 5: DELETE */}
                        <td className="py-3.5 px-3 text-center">
                          {row.deleteMode === 'disabled_badge' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCrudDelete(row.key)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#FFF1F2] border border-[#FECDD3] px-2.5 py-1 text-[10px] font-extrabold text-[#DC2626]"
                            >
                              <span>معطل</span>
                              <span>⊘</span>
                            </button>
                          ) : row.deleteMode === 'locked_badge' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCrudDelete(row.key)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#FFF1F2] border border-[#FECDD3] px-2.5 py-1 text-[10px] font-extrabold text-[#DC2626]"
                            >
                              <Lock className="h-3 w-3" />
                              <span>مقفل</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCrudDelete(row.key)}
                              aria-label={`تبديل صلاحية الحذف لـ ${row.title}`}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                                row.deleteMode === 'allowed'
                                  ? 'border-2 border-[#059669] text-[#059669] bg-[#ECFDF5]'
                                  : 'border border-[#CBD5E1] text-[#CBD5E1] bg-[#F8FAFC]'
                              }`}
                            >
                              {row.deleteMode === 'allowed' ? (
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 6: EXPORT */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCrudExport(row.key)}
                            aria-label={`تبديل صلاحية التصدير لـ ${row.title}`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                              row.exportAllowed
                                ? 'border-2 border-[#059669] text-[#059669] bg-[#ECFDF5]'
                                : 'border border-[#CBD5E1] text-[#CBD5E1] bg-[#F8FAFC]'
                            }`}
                          >
                            {row.exportAllowed ? (
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Col 7: BULK UPDATE */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCrudBulk(row.key)}
                            aria-label={`تبديل صلاحية التحديث الجماعي لـ ${row.title}`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                              row.bulkAllowed
                                ? 'border-2 border-[#059669] text-[#059669] bg-[#ECFDF5]'
                                : 'border border-[#CBD5E1] text-[#CBD5E1] bg-[#F8FAFC]'
                            }`}
                          >
                            {row.bulkAllowed ? (
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 2: صلاحيات مستوى الحقل (Field-Level Security) */}
            <section
              ref={flsSectionRef}
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
            >
              {/* Header + Module Filter Dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                    <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                      صلاحيات مستوى الحقل (Field-Level Security)
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    حماية سرية البيانات الدقيقة — تخصيص دقيق لظهور وإمكانية تعديل الحقول الحساسة للبائعين.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    الكيان المختار:
                  </span>
                  <div className="relative">
                    <Filter className="h-3.5 w-3.5 text-[#2563EB] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      aria-label="تصفية حقول FLS حسب الكيان"
                      value={flsEntityFilter}
                      onChange={(e) =>
                        setFlsEntityFilter(
                          e.target.value as 'all' | 'leads' | 'deals' | 'accounts'
                        )
                      }
                      className="appearance-none rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/70 pr-8 pl-7 py-2 text-[11px] font-extrabold text-[#1D4ED8] focus:border-[#2563EB] focus:outline-none cursor-pointer"
                    >
                      <option value="all">
                        الصفقات والعملاء المحتملين (Deals & Leads)
                      </option>
                      <option value="leads">العملاء المحتملين (Leads)</option>
                      <option value="deals">الصفقات والمبيعات (Deals)</option>
                      <option value="accounts">
                        الشركات والفوترة (Accounts & Billing)
                      </option>
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 text-[#2563EB] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 2-Column Grid of FLS Field Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredFlsCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/80 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                          {card.title}
                        </h4>
                        <p className="font-mono text-[10px] text-[#64748B] mt-0.5">
                          {card.techKeyDisplay}
                        </p>
                      </div>

                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 ${
                          card.categoryTone === 'emerald'
                            ? 'bg-[#D1FAE5] text-[#047857]'
                            : card.categoryTone === 'danger'
                            ? 'bg-[#FEE2E2] text-[#DC2626]'
                            : card.categoryTone === 'indigo'
                            ? 'bg-[#E0E7FF] text-[#3730A3]'
                            : 'bg-[#DBEAFE] text-[#1D4ED8]'
                        }`}
                      >
                        {card.categoryBadge}
                      </span>
                    </div>

                    {/* Interactive 3-State Selector ("قراءة وتعديل" | "قراءة فقط" | "مخفي تماماً") */}
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1 text-[11px]">
                      {/* State 1: Read & Edit */}
                      <button
                        type="button"
                        onClick={() => handleSetFlsAccess(card.id, 'read_write')}
                        className={`rounded-lg py-1.5 px-2 font-extrabold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                          card.access === 'read_write'
                            ? 'bg-[#2563EB] text-[#FFFFFF] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {card.access === 'read_write' && (
                          <Check className="h-3 w-3 stroke-[3]" />
                        )}
                        <span>{card.writeLabel}</span>
                      </button>

                      {/* State 2: Read Only */}
                      <button
                        type="button"
                        onClick={() => handleSetFlsAccess(card.id, 'read_only')}
                        className={`rounded-lg py-1.5 px-2 font-extrabold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                          card.access === 'read_only'
                            ? 'bg-[#2563EB] text-[#FFFFFF] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        <Lock
                          className={`h-3 w-3 ${
                            card.access === 'read_only'
                              ? 'text-[#FDE047]'
                              : 'text-[#D97706]'
                          }`}
                        />
                        <span>قراءة فقط</span>
                      </button>

                      {/* State 3: Completely Hidden */}
                      <button
                        type="button"
                        onClick={() => handleSetFlsAccess(card.id, 'hidden')}
                        className={`rounded-lg py-1.5 px-2 font-extrabold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                          card.access === 'hidden'
                            ? 'bg-[#1E293B] text-[#FFFFFF] shadow-2xs'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        <EyeOff className="h-3 w-3" />
                        <span>{card.hiddenLabel}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {customFields.length > 0 && (
                <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/50 px-3.5 py-2 flex items-center justify-between text-[11px] text-[#1E40AF]">
                  <span>
                    يتم تطبيق قواعد مستوى الحقل (FLS) لحظياً على كافة الحقول الأساسية والحقول المخصصة ({customFields.length} حقول مخصصة مرتبطة).
                  </span>
                  <span className="font-mono font-bold">FLS Engine Active</span>
                </div>
              )}
            </section>

            {/* SECTION 3: الأذونات الإدارية وسياسات الأتمتة المباشرة */}
            <section
              ref={adminSectionRef}
              className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  الأذونات الإدارية وسياسات الأتمتة المباشرة
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Policy 1: إرسال رسائل واتساب جماعية */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <MessageSquare className="h-5 w-5 text-[#059669]" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={selectedProfile.adminPolicies.massWhatsappEnabled}
                        aria-label="تبديل إرسال رسائل واتساب جماعية"
                        onClick={() =>
                          updateCurrentProfile((prev) => ({
                            ...prev,
                            adminPolicies: {
                              ...prev.adminPolicies,
                              massWhatsappEnabled:
                                !prev.adminPolicies.massWhatsappEnabled,
                            },
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          selectedProfile.adminPolicies.massWhatsappEnabled
                            ? 'bg-[#059669]'
                            : 'bg-[#CBD5E1]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-[#FFFFFF] shadow-xs transition-transform ${
                            selectedProfile.adminPolicies.massWhatsappEnabled
                              ? '-translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                      إرسال رسائل واتساب جماعية
                    </h4>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      مسموح بحد أقصى 100 رسالة تسويقية ومتابعة يومياً للحساب الواحد.
                    </p>
                  </div>

                  <p
                    className={`text-[11px] font-extrabold ${
                      selectedProfile.adminPolicies.massWhatsappEnabled
                        ? 'text-[#059669]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {selectedProfile.adminPolicies.massWhatsappEnabled
                      ? 'مفعل (100 رسالة / يوم)'
                      : 'معطل حالياً'}
                  </p>
                </div>

                {/* Policy 2: تجاوز مراحل البلوبرينت (Override) */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <GitBranch className="h-5 w-5 text-[#475569]" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={
                          selectedProfile.adminPolicies.blueprintOverrideEnabled
                        }
                        aria-label="تبديل تجاوز مراحل البلوبرينت"
                        onClick={() =>
                          updateCurrentProfile((prev) => ({
                            ...prev,
                            adminPolicies: {
                              ...prev.adminPolicies,
                              blueprintOverrideEnabled:
                                !prev.adminPolicies.blueprintOverrideEnabled,
                            },
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          selectedProfile.adminPolicies.blueprintOverrideEnabled
                            ? 'bg-[#2563EB]'
                            : 'bg-[#CBD5E1]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-[#FFFFFF] shadow-xs transition-transform ${
                            selectedProfile.adminPolicies.blueprintOverrideEnabled
                              ? '-translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                      تجاوز مراحل البلوبرينت (Override)
                    </h4>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      معطل تماماً. لا يمكن القفز فوق شروط الإغلاق المالي دون موافقة المدير.
                    </p>
                  </div>

                  <p
                    className={`text-[11px] font-extrabold ${
                      selectedProfile.adminPolicies.blueprintOverrideEnabled
                        ? 'text-[#2563EB]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    {selectedProfile.adminPolicies.blueprintOverrideEnabled
                      ? 'مسموح باستثناء إداري'
                      : 'معطل بحزم أمني'}
                  </p>
                </div>

                {/* Policy 3: تغيير مالك السجل (Change Owner) */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <UserCheck className="h-5 w-5 text-[#2563EB]" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={selectedProfile.adminPolicies.changeOwnerEnabled}
                        aria-label="تبديل تغيير مالك السجل"
                        onClick={() =>
                          updateCurrentProfile((prev) => ({
                            ...prev,
                            adminPolicies: {
                              ...prev.adminPolicies,
                              changeOwnerEnabled:
                                !prev.adminPolicies.changeOwnerEnabled,
                            },
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          selectedProfile.adminPolicies.changeOwnerEnabled
                            ? 'bg-[#2563EB]'
                            : 'bg-[#CBD5E1]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-[#FFFFFF] shadow-xs transition-transform ${
                            selectedProfile.adminPolicies.changeOwnerEnabled
                              ? '-translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                      تغيير مالك السجل (Change Owner)
                    </h4>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      إعادة إسناد العملاء مسموح بها فقط داخل أفراد نفس الفريق البيعي.
                    </p>
                  </div>

                  <p
                    className={`text-[11px] font-extrabold underline ${
                      selectedProfile.adminPolicies.changeOwnerEnabled
                        ? 'text-[#2563EB]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {selectedProfile.adminPolicies.changeOwnerEnabled
                      ? 'مسموح ضمن الفريق فقط'
                      : 'غير مسموح'}
                  </p>
                </div>
              </div>

              {/* Per-Profile Paid Add-ons Access Matrix */}
              <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                      صلاحيات الوصول للإضافات المدفوعة (Paid Add-ons Access per Profile)
                    </h4>
                    <p className="text-[11px] text-[#64748B]">
                      تحديد ما إذا كان الموظفون ضمن ملف «{selectedProfile.listTitle}» مخولين باستخدام
                      الإضافات المفعلة في باقة المؤسسة ({currentOrganization.name}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/settings/subscription')}
                    className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-extrabold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                  >
                    إدارة إضافات المؤسسة والباقة ←
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        key: 'whatsapp_campaigns' as const,
                        label: 'إضافة واتساب والحملات الذكية',
                        desc: 'إرسال قوالب واتساب الأعمال والحملات الجماعية المجدولة',
                      },
                      {
                        key: 'meta_direct' as const,
                        label: 'الربط المباشر مع ميتا',
                        desc: 'استقبال ومزامنة عملاء Meta Lead Ads لحظياً',
                      },
                      {
                        key: 'custom_functions' as const,
                        label: 'محرك الدوال المخصصة',
                        desc: 'تشغيل الدوال البرمجية وربط Webhooks مع أنظمة ERP',
                      },
                    ]
                  ).map((addonItem) => {
                    const orgHasAddon = currentOrganization.addons[addonItem.key];
                    const matchedCrmProfile =
                      crmProfiles.find((cp) => cp.id === selectedProfile.crmProfileId) ??
                      crmProfiles[0];
                    const profileHasAddon =
                      matchedCrmProfile?.addonPermissions?.[addonItem.key] ?? true;
                    const effectiveAllowed = orgHasAddon && profileHasAddon;

                    return (
                      <div
                        key={addonItem.key}
                        className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                          effectiveAllowed
                            ? 'border-[#BFDBFE] bg-[#EFF6FF]/35'
                            : 'border-[#E2E8F0] bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[12px] font-extrabold text-[#0F172A]">
                              {addonItem.label}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#64748B] leading-relaxed">
                              {addonItem.desc}
                            </p>
                          </div>

                          {orgHasAddon ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={profileHasAddon}
                              onClick={() => {
                                if (matchedCrmProfile) {
                                  const currentAddons = matchedCrmProfile.addonPermissions ?? {
                                    whatsapp_campaigns: true,
                                    meta_direct: true,
                                    custom_functions: true,
                                  };
                                  void updateProfileAddons(matchedCrmProfile.id, {
                                    ...currentAddons,
                                    [addonItem.key]: !profileHasAddon,
                                  });
                                  setToastMsg(
                                    !profileHasAddon
                                      ? `تم منح ملف «${selectedProfile.listTitle}» صلاحية استخدام «${addonItem.label}»`
                                      : `تم حجب «${addonItem.label}» عن ملف «${selectedProfile.listTitle}»`
                                  );
                                }
                              }}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                profileHasAddon ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                                  profileHasAddon ? '-translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate('/settings/subscription')}
                              className="inline-flex items-center gap-1 rounded-md bg-[#FFE4E6] px-2 py-1 text-[10px] font-extrabold text-[#BE123C] hover:bg-[#FECDD3] shrink-0"
                            >
                              <Lock className="h-3 w-3" />
                              <span>ترقية الباقة</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-[#E2E8F0]/70 pt-2 text-[10px] font-bold">
                          <span className="text-[#64748B]">الحالة الفعلية للملف:</span>
                          <span
                            className={
                              effectiveAllowed ? 'text-[#059669]' : 'text-[#E11D48]'
                            }
                          >
                            {effectiveAllowed
                              ? 'مصرح ومفعل ✓'
                              : !orgHasAddon
                                ? 'مقفل في باقة المؤسسة 🔒'
                                : 'مقفل لهذا الملف الوظيفي'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* 3. STICKY BOTTOM SAVE BAR */}
      <footer className="sticky bottom-0 z-30 bg-[#FFFFFF] border-t border-[#E2E8F0] px-6 py-3 shadow-sm">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[#475569]">
            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
            <span>
              آخر اعتماد أمني: <strong className="font-extrabold text-[#0F172A]">طارق العتيبي</strong> قبل 3 أيام • متوافق تماماً مع ضوابط الأمن السيبراني السعودية (NCA-ECC)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setProfilesList(INITIAL_PROFILES_LIST);
                setSelectedUiProfileId('ui_prof_standard_sales');
                setToastMsg('تم إلغاء التغييرات واستعادة إعدادات الملف المعتمدة');
              }}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-4 py-2.5 text-[12px] font-bold text-[#0F172A] transition-colors"
            >
              إلغاء التغييرات
            </button>

            <button
              type="button"
              disabled={savingToFirestore}
              onClick={() =>
                void syncUiProfileToCrmAndFirestore(
                  selectedProfile,
                  `تم حفظ وتطبيق التغييرات فوراً على ${selectedProfile.employeesCount} موظف في Firestore بنجاح`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {savingToFirestore
                  ? 'جارٍ الحفظ والتطبيق...'
                  : `حفظ وتطبيق التغييرات فوراً على ${selectedProfile.employeesCount} موظف (Ctrl+S)`}
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL 1: "+ إنشاء ملف صلاحيات جديد" */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                إنشاء ملف صلاحيات جديد (New Security Profile)
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProfileSubmit} className="space-y-3.5 text-[12px]">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  اسم ملف الصلاحيات *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مدير مبيعات الفروع الإقليمية"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  الوصف والغرض الأمني
                </label>
                <textarea
                  rows={3}
                  placeholder="حدد نطاق الصلاحيات والموديولات المسموح بها لهذا الملف..."
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  إنشاء وحفظ في Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: "استيراد مصفوفة أذونات (JSON)" */}
      {importJsonModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                استيراد مصفوفة أذونات (JSON Schema)
              </h3>
              <button
                type="button"
                onClick={() => setImportJsonModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleImportJsonSubmit} className="space-y-3.5 text-[12px]">
              <p className="text-[11px] text-[#64748B]">
                الصق كود JSON الخاص بمصفوفة الصلاحيات ومستوى الحقول (FLS) لتطبيقه على الملف المحدد:
              </p>
              <textarea
                rows={4}
                dir="ltr"
                placeholder='{"profileCode": "PRF-B2B-04", "fls": {"internal_cost_margin": "hidden"}}'
                value={jsonInputText}
                onChange={(e) => setJsonInputText(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 font-mono text-[11px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setImportJsonModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  استيراد وتطبيق المصفوفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Profile Title & Description */}
      {editHeaderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                تعديل بيانات ملف الصلاحيات
              </h3>
              <button
                type="button"
                onClick={() => setEditHeaderModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHeaderEdit} className="space-y-3.5 text-[12px]">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  مسمى ملف الصلاحيات *
                </label>
                <input
                  type="text"
                  required
                  value={editTitleDraft}
                  onChange={(e) => setEditTitleDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  الوصف الأمني
                </label>
                <textarea
                  rows={3}
                  value={editDescDraft}
                  onChange={(e) => setEditDescDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setEditHeaderModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-16 left-5 z-50 flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-[12px] font-semibold text-[#FFFFFF] shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="إغلاق التنبيه"
            className="text-[#94A3B8] hover:text-[#FFFFFF]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
