import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Info,
  Lock,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';

interface RoleEmployeeMember {
  id: string;
  name: string;
  initial: string;
  titleBranch: string;
  isPrimary?: boolean;
  active: boolean;
}

interface OrgRoleNode {
  id: string;
  code: string;
  levelBadge: string;
  levelTone: 'root' | 'indigo' | 'emerald' | 'blue' | 'slate';
  title: string;
  InspectorFullTitle: string;
  subtitle: string;
  reportsToId?: string;
  reportsToLabel: string;
  subordinatesSummary: string;
  subordinatesCountNumber: number;
  employeesCountLabel: string;
  dealsCountLabel?: string;
  dealsValueLabel?: string;
  statusActive: boolean;
  rollUpEnabled: boolean;
  peerSharingEnabled: boolean;
  defaultSubordinateAccess:
    | 'قراءة + كتابة + اعتماد'
    | 'قراءة + كتابة فقط'
    | 'قراءة فقط (للاطلاع)';
  discountLimitLabel: string;
  blueprintStageApprovalLabel: string;
  maxDealValueLabel: string;
  appliedProfileName: string;
  dataVisibility: 'organization' | 'team' | 'private';
  employees: RoleEmployeeMember[];
}

const INITIAL_ORG_ROLES: OrgRoleNode[] = [
  {
    id: 'role_ceo',
    code: 'ROLE - EXEC - CEO - 01',
    levelBadge: 'جذر الهيكل (Root)',
    levelTone: 'root',
    title: 'الرئيس التنفيذي / الإدارة العليا',
    InspectorFullTitle: 'الرئيس التنفيذي / الإدارة العليا (CEO)',
    subtitle: 'سلطة مطلقة • رؤية كافة السجلات',
    reportsToLabel: 'مجلس الإدارة (أعلى سلطة تنفيذية)',
    subordinatesSummary: '7 أدوار فرعية (35 موظفاً)',
    subordinatesCountNumber: 35,
    employeesCountLabel: '1 موظف',
    dealsCountLabel: '64 صفقة',
    dealsValueLabel: '(14.8M ر.س)',
    statusActive: true,
    rollUpEnabled: true,
    peerSharingEnabled: true,
    defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
    discountLimitLabel: 'صلاحية مطلقة (حتى 100%)',
    blueprintStageApprovalLabel: 'اعتماد كافة المراحل والاستثناءات',
    maxDealValueLabel: 'بدون سقف مالي',
    appliedProfileName: 'مدير النظام التنفيذي (System Admin)',
    dataVisibility: 'organization',
    employees: [
      {
        id: 'emp_ceo_1',
        name: 'سعود بن فهد',
        initial: 'س',
        titleBranch: 'الرئيس التنفيذي • المقر الرئيسي - الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
  {
    id: 'role_vp_sales',
    code: 'ROLE - SALES - VP - 01',
    levelBadge: 'إدارة عليا (L2)',
    levelTone: 'indigo',
    title: 'نائب الرئيس للمبيعات وتطوير الأعمال',
    InspectorFullTitle: 'نائب الرئيس للمبيعات وتطوير الأعمال (VP Sales)',
    subtitle: 'يرى كافة قطاعات ومناطق المبيعات',
    reportsToId: 'role_ceo',
    reportsToLabel: 'سعود بن فهد (CEO)',
    subordinatesSummary: '5 أدوار فرعية (28 موظفاً)',
    subordinatesCountNumber: 28,
    employeesCountLabel: '1 موظف',
    dealsCountLabel: '32 صفقة',
    dealsValueLabel: '(7.3M ر.س)',
    statusActive: true,
    rollUpEnabled: true,
    peerSharingEnabled: true,
    defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
    discountLimitLabel: 'حتى 25% دون مراجعة عليا',
    blueprintStageApprovalLabel: 'معتمد لكافة المراحل (Stage 1 → 6)',
    maxDealValueLabel: 'حتى 2,500,000 ر.س',
    appliedProfileName: 'إدارة المبيعات العليا (VP Sales Profile)',
    dataVisibility: 'organization',
    employees: [
      {
        id: 'emp_vp_1',
        name: 'طارق العتيبي',
        initial: 'ط',
        titleBranch: 'نائب الرئيس للمبيعات • المقر الرئيسي - الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
  {
    id: 'role_head_cs',
    code: 'ROLE - CS - HEAD - 01',
    levelBadge: 'خدمة العملاء (L2)',
    levelTone: 'emerald',
    title: 'رئيس خدمة ونجاح العملاء',
    InspectorFullTitle: 'رئيس خدمة ونجاح العملاء (Head of CS)',
    subtitle: 'يرى كافة عقود الدعم وتذاكر الخدمة',
    reportsToId: 'role_ceo',
    reportsToLabel: 'سعود بن فهد (CEO)',
    subordinatesSummary: '1 دور فرعي (4 موظفين)',
    subordinatesCountNumber: 4,
    employeesCountLabel: '1 موظف',
    dealsCountLabel: '19 عقد تجديد',
    dealsValueLabel: '(2.1M ر.س)',
    statusActive: true,
    rollUpEnabled: true,
    peerSharingEnabled: false,
    defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
    discountLimitLabel: 'حتى 10% لتجديد العقود',
    blueprintStageApprovalLabel: 'معتمد لمرحلة التدشين والتجديد',
    maxDealValueLabel: 'حتى 350,000 ر.س',
    appliedProfileName: 'إدارة نجاح العملاء (Customer Success)',
    dataVisibility: 'team',
    employees: [
      {
        id: 'emp_cs_1',
        name: 'ريم القحطاني',
        initial: 'ر',
        titleBranch: 'رئيس نجاح العملاء • فرع الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
  {
    id: 'role_cs_sup',
    code: 'ROLE - CS - SUP - 02',
    levelBadge: 'دعم فني (L3)',
    levelTone: 'slate',
    title: 'مشرف دعم فني وخدمة العملاء',
    InspectorFullTitle: 'مشرف دعم فني وخدمة العملاء',
    subtitle: 'متابعة تجديد الاشتراكات وبلاغات الدعم',
    reportsToId: 'role_head_cs',
    reportsToLabel: 'ريم القحطاني (Head of CS)',
    subordinatesSummary: 'لا توجد أدوار فرعية (مستوى تشغيلي)',
    subordinatesCountNumber: 0,
    employeesCountLabel: '4 موظفين',
    statusActive: true,
    rollUpEnabled: false,
    peerSharingEnabled: true,
    defaultSubordinateAccess: 'قراءة + كتابة فقط',
    discountLimitLabel: 'حتى 5% فقط',
    blueprintStageApprovalLabel: 'تحديث تذاكر الدعم والتدشين',
    maxDealValueLabel: 'حتى 100,000 ر.س',
    appliedProfileName: 'أخصائي دعم وخدمة عملاء',
    dataVisibility: 'team',
    employees: [
      {
        id: 'emp_css_1',
        name: 'ماجد الزهراني',
        initial: 'م',
        titleBranch: 'مشرف دعم فني • فرع الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
  {
    id: 'role_rgn_central',
    code: 'ROLE - SALES - RGN - 02',
    levelBadge: 'إقليمي (L3)',
    levelTone: 'blue',
    title: 'مدير مبيعات إقليمي - الوسطى',
    InspectorFullTitle: 'مدير مبيعات إقليمي - المنطقة الوسطى',
    subtitle: 'فروع الرياض والقصيم',
    reportsToId: 'role_vp_sales',
    reportsToLabel: 'طارق العتيبي (VP Sales)',
    subordinatesSummary: '3 أدوار فرعية (15 موظفاً)',
    subordinatesCountNumber: 15,
    employeesCountLabel: '2 موظفين',
    dealsCountLabel: '18 صفقة',
    dealsValueLabel: '(4.2M ر.س)',
    statusActive: true,
    rollUpEnabled: true,
    peerSharingEnabled: false,
    defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
    discountLimitLabel: 'حتى 15% دون مراجعة عليا',
    blueprintStageApprovalLabel: 'معتمد للمراحل (Stage 4 → 5)',
    maxDealValueLabel: 'حتى 500,000 ر.س',
    appliedProfileName: 'مبيعات متقدمة (Standard Sales)',
    dataVisibility: 'team',
    employees: [
      {
        id: 'emp_rgn_c1',
        name: 'سارة المنصور',
        initial: 'س',
        titleBranch: 'مدير حسابات إقليمي • فرع الرياض',
        isPrimary: true,
        active: true,
      },
      {
        id: 'emp_rgn_c2',
        name: 'نايف الحربي',
        initial: 'ن',
        titleBranch: 'مدير مبيعات الشركات • فرع القصيم',
        isPrimary: false,
        active: true,
      },
    ],
  },
  {
    id: 'role_rgn_east_west',
    code: 'ROLE - SALES - RGN - 03',
    levelBadge: 'إقليمي (L3)',
    levelTone: 'slate',
    title: 'مدير مبيعات - الشرقية والغربية',
    InspectorFullTitle: 'مدير مبيعات إقليمي - الشرقية والغربية',
    subtitle: 'فروع جدة والدمام',
    reportsToId: 'role_vp_sales',
    reportsToLabel: 'طارق العتيبي (VP Sales)',
    subordinatesSummary: '3 أدوار فرعية (11 موظفاً)',
    subordinatesCountNumber: 11,
    employeesCountLabel: '2 موظفين',
    dealsCountLabel: '14 صفقة',
    dealsValueLabel: '(3.1M ر.س)',
    statusActive: true,
    rollUpEnabled: true,
    peerSharingEnabled: false,
    defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
    discountLimitLabel: 'حتى 15% دون مراجعة عليا',
    blueprintStageApprovalLabel: 'معتمد للمراحل (Stage 4 → 5)',
    maxDealValueLabel: 'حتى 500,000 ر.س',
    appliedProfileName: 'مبيعات متقدمة (Standard Sales)',
    dataVisibility: 'team',
    employees: [
      {
        id: 'emp_rgn_ew1',
        name: 'فهد الشمري',
        initial: 'ف',
        titleBranch: 'مدير مبيعات إقليمي • فرع جدة',
        isPrimary: true,
        active: true,
      },
      {
        id: 'emp_rgn_ew2',
        name: 'خالد الدوسري',
        initial: 'خ',
        titleBranch: 'مدير مبيعات المنطقة الشرقية • الدمام',
        isPrimary: false,
        active: true,
      },
    ],
  },
  {
    id: 'role_kam',
    code: 'ROLE - SALES - KAM - 04',
    levelBadge: 'تنفيذي (L4)',
    levelTone: 'slate',
    title: 'مسؤول كبار الحسابات (KAM)',
    InspectorFullTitle: 'مسؤول كبار الحسابات (Key Account Manager)',
    subtitle: 'يرى صفقات الحسابات المعينة له فقط',
    reportsToId: 'role_rgn_central',
    reportsToLabel: 'مدير مبيعات إقليمي - الوسطى',
    subordinatesSummary: 'لا توجد أدوار فرعية',
    subordinatesCountNumber: 0,
    employeesCountLabel: '4 موظفين',
    dealsCountLabel: '9 صفقات',
    dealsValueLabel: '(2.6M ر.س)',
    statusActive: true,
    rollUpEnabled: false,
    peerSharingEnabled: false,
    defaultSubordinateAccess: 'قراءة فقط (للاطلاع)',
    discountLimitLabel: 'حتى 10% دون مراجعة',
    blueprintStageApprovalLabel: 'معتمد حتى المرحلة 4 (التفاوض)',
    maxDealValueLabel: 'حتى 300,000 ر.س',
    appliedProfileName: 'مبيعات متقدمة (Standard Sales)',
    dataVisibility: 'private',
    employees: [
      {
        id: 'emp_kam_1',
        name: 'م. فيصل الشمري',
        initial: 'ف',
        titleBranch: 'مسؤول حسابات كبار العملاء • فرع الرياض',
        isPrimary: true,
        active: true,
      },
      {
        id: 'emp_kam_2',
        name: 'عبدالله السالمي',
        initial: 'ع',
        titleBranch: 'مسؤول حسابات استراتيجية • فرع الرياض',
        active: true,
      },
    ],
  },
  {
    id: 'role_field_sales',
    code: 'ROLE - SALES - FLD - 05',
    levelBadge: 'ميداني (L4)',
    levelTone: 'slate',
    title: 'مندوب مبيعات ميداني',
    InspectorFullTitle: 'مندوب مبيعات ميداني (Field Sales)',
    subtitle: 'يرى السجلات المنشأة بواسطته فقط',
    reportsToId: 'role_rgn_central',
    reportsToLabel: 'مدير مبيعات إقليمي - الوسطى',
    subordinatesSummary: 'لا توجد أدوار فرعية',
    subordinatesCountNumber: 0,
    employeesCountLabel: '6 موظفين',
    dealsCountLabel: '6 صفقات',
    dealsValueLabel: '(1.1M ر.س)',
    statusActive: true,
    rollUpEnabled: false,
    peerSharingEnabled: false,
    defaultSubordinateAccess: 'قراءة فقط (للاطلاع)',
    discountLimitLabel: 'حتى 8% دون مراجعة',
    blueprintStageApprovalLabel: 'معتمد حتى المرحلة 3 (تقديم العرض)',
    maxDealValueLabel: 'حتى 150,000 ر.س',
    appliedProfileName: 'مندوب مبيعات (Field Rep)',
    dataVisibility: 'private',
    employees: [
      {
        id: 'emp_fld_1',
        name: 'ريم الدوسري',
        initial: 'ر',
        titleBranch: 'مندوب مبيعات ميداني • فرع الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
  {
    id: 'role_sdr',
    code: 'ROLE - SALES - SDR - 06',
    levelBadge: 'تأهيل (L4)',
    levelTone: 'slate',
    title: 'مندوب تأهيل وتوليد العملاء',
    InspectorFullTitle: 'مندوب تأهيل وتوليد العملاء (SDR)',
    subtitle: 'إدخال العملاء المحتملين وتغذية المسار',
    reportsToId: 'role_rgn_central',
    reportsToLabel: 'مدير مبيعات إقليمي - الوسطى',
    subordinatesSummary: 'لا توجد أدوار فرعية',
    subordinatesCountNumber: 0,
    employeesCountLabel: '5 موظفين',
    dealsCountLabel: '3 صفقات',
    dealsValueLabel: '(0.5M ر.س)',
    statusActive: true,
    rollUpEnabled: false,
    peerSharingEnabled: true,
    defaultSubordinateAccess: 'قراءة فقط (للاطلاع)',
    discountLimitLabel: 'غير مصرح بمنح خصومات',
    blueprintStageApprovalLabel: 'تأهيل العملاء المحتملين (Stage 1 → 2)',
    maxDealValueLabel: 'حتى 75,000 ر.س',
    appliedProfileName: 'تأهيل المبيعات (SDR Profile)',
    dataVisibility: 'private',
    employees: [
      {
        id: 'emp_sdr_1',
        name: 'سلطان المطيري',
        initial: 'س',
        titleBranch: 'أخصائي تأهيل عملاء • فرع الرياض',
        isPrimary: true,
        active: true,
      },
    ],
  },
];

const ACCESS_LEVEL_OPTIONS: OrgRoleNode['defaultSubordinateAccess'][] = [
  'قراءة + كتابة + اعتماد',
  'قراءة + كتابة فقط',
  'قراءة فقط (للاطلاع)',
];

export const RoleHierarchyPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    roles: firestoreRoles,
    profiles,
    currentOrgId,
    toggleRoleHideSubordinates,
  } = useCrm();

  const [activeSecurityTab, setActiveSecurityTab] = useState<
    'profiles' | 'roles' | 'sharing' | 'audit'
  >('roles');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [showEmployeesInTree, setShowEmployeesInTree] = useState<boolean>(true);
  const [expandAllTree, setExpandAllTree] = useState<boolean>(true);
  const [eastWestExpanded, setEastWestExpanded] = useState<boolean>(false);

  const [orgRoles, setOrgRoles] = useState<OrgRoleNode[]>(INITIAL_ORG_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role_rgn_central');

  // Modals
  const [addingRoleModalOpen, setAddingRoleModalOpen] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleSubtitle, setNewRoleSubtitle] = useState('');
  const [newRoleReportsTo, setNewRoleReportsTo] = useState('role_vp_sales');
  const [newRoleVisibility, setNewRoleVisibility] = useState<
    'private' | 'team' | 'organization'
  >('team');

  const [assignEmployeeModalOpen, setAssignEmployeeModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpTitleBranch, setNewEmpTitleBranch] = useState('مدير مبيعات • فرع الرياض');

  const [editingRoleTitleModalOpen, setEditingRoleTitleModalOpen] = useState(false);
  const [editedTitleInput, setEditedTitleInput] = useState('');

  const [savingHierarchy, setSavingHierarchy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const selectedRole = useMemo(
    () =>
      orgRoles.find((r) => r.id === selectedRoleId) ??
      orgRoles.find((r) => r.id === 'role_rgn_central') ??
      orgRoles[0],
    [orgRoles, selectedRoleId]
  );

  const getRoleById = (id: string) =>
    orgRoles.find((r) => r.id === id) ?? INITIAL_ORG_ROLES[0];

  const updateSelectedRole = (updater: (prev: OrgRoleNode) => OrgRoleNode) => {
    setOrgRoles((prev) =>
      prev.map((r) => (r.id === selectedRole.id ? updater(r) : r))
    );
  };

  // Persist Role Hierarchy changes to Firestore `roles` collection
  const handleSaveHierarchyToFirestore = async (customMessage?: string) => {
    setSavingHierarchy(true);
    try {
      if (firebaseUser) {
        const targetFirestoreRole =
          firestoreRoles.find((fr) =>
            fr.name.includes(selectedRole.title.slice(0, 10))
          ) ?? firestoreRoles[0];

        const nextVisibility: 'private' | 'team' | 'organization' =
          selectedRole.rollUpEnabled && selectedRole.peerSharingEnabled
            ? 'organization'
            : selectedRole.rollUpEnabled
            ? 'team'
            : 'private';

        const descSummary = `${selectedRole.code} | Roll-Up: ${
          selectedRole.rollUpEnabled ? 'مفعل' : 'معطل'
        } | Peer: ${
          selectedRole.peerSharingEnabled ? 'مفعل' : 'معطل'
        } | الوصول: ${selectedRole.defaultSubordinateAccess}`.slice(0, 290);

        if (targetFirestoreRole) {
          try {
            await updateDoc(doc(db, 'roles', targetFirestoreRole.id), {
              org_id: currentOrgId,
              name: selectedRole.InspectorFullTitle.slice(0, 95),
              dataVisibility: nextVisibility,
              hide_subordinates_data: !selectedRole.rollUpEnabled,
              description: descSummary,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `roles/${targetFirestoreRole.id}`
            );
          }
        } else {
          const newDocId = `role_${Date.now()}`;
          try {
            await setDoc(doc(db, 'roles', newDocId), {
              org_id: currentOrgId,
              ownerId: firebaseUser.uid,
              name: selectedRole.InspectorFullTitle.slice(0, 95),
              reportsToRoleId: selectedRole.reportsToId || 'role_vp_sales',
              dataVisibility: nextVisibility,
              hide_subordinates_data: !selectedRole.rollUpEnabled,
              description: descSummary,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `roles/${newDocId}`);
          }
        }
      }

      setToastMsg(
        customMessage ||
          `تم حفظ وتحديث الهيكل التنظيمي وصلاحيات الدور (${selectedRole.code}) في Firestore بنجاح`
      );
    } finally {
      setSavingHierarchy(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveHierarchyToFirestore();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRole, firebaseUser, firestoreRoles]);

  const handleCreateNewRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;
    const roleId = `role_custom_${Date.now()}`;
    const code = `ROLE - SALES - CST - 0${orgRoles.length + 1}`;
    const parentRole = getRoleById(newRoleReportsTo);

    const newNode: OrgRoleNode = {
      id: roleId,
      code,
      levelBadge: 'مخصص (L4)',
      levelTone: 'blue',
      title: newRoleTitle.trim(),
      InspectorFullTitle: newRoleTitle.trim(),
      subtitle: newRoleSubtitle.trim() || 'دور وظيفي مضاف ضمن شجرة المبيعات',
      reportsToId: parentRole.id,
      reportsToLabel: parentRole.title,
      subordinatesSummary: 'لا توجد أدوار فرعية',
      subordinatesCountNumber: 0,
      employeesCountLabel: '1 موظف',
      dealsCountLabel: '0 صفقات',
      dealsValueLabel: '(0 ر.س)',
      statusActive: true,
      rollUpEnabled: newRoleVisibility !== 'private',
      peerSharingEnabled: newRoleVisibility === 'organization',
      defaultSubordinateAccess: 'قراءة + كتابة + اعتماد',
      discountLimitLabel: 'حتى 12% دون مراجعة عليا',
      blueprintStageApprovalLabel: 'معتمد للمراحل (Stage 3 → 4)',
      maxDealValueLabel: 'حتى 350,000 ر.س',
      appliedProfileName: 'مبيعات متقدمة (Standard Sales)',
      dataVisibility: newRoleVisibility,
      employees: [
        {
          id: `emp_${Date.now()}`,
          name: 'طارق العتيبي',
          initial: 'ط',
          titleBranch: `${newRoleTitle.trim()} • فرع الرياض`,
          isPrimary: true,
          active: true,
        },
      ],
    };

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'roles', roleId), {
          ownerId: firebaseUser.uid,
          name: newNode.title.slice(0, 95),
          reportsToRoleId: newRoleReportsTo,
          dataVisibility: newRoleVisibility,
          description: newNode.subtitle.slice(0, 280),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `roles/${roleId}`);
      }
    }

    setOrgRoles((prev) => [...prev, newNode]);
    setSelectedRoleId(newNode.id);
    setNewRoleTitle('');
    setNewRoleSubtitle('');
    setAddingRoleModalOpen(false);
    setToastMsg(`تم إنشاء الدور الوظيفي "${newNode.title}" وإضافته للشجرة في Firestore`);
  };

  const handleAssignEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const trimmed = newEmpName.trim();
    const newMember: RoleEmployeeMember = {
      id: `emp_${Date.now()}`,
      name: trimmed,
      initial: trimmed.charAt(0),
      titleBranch: newEmpTitleBranch.trim() || 'فرع الرياض',
      isPrimary: selectedRole.employees.length === 0,
      active: true,
    };

    updateSelectedRole((prev) => {
      const nextEmps = [...prev.employees, newMember];
      return {
        ...prev,
        employees: nextEmps,
        employeesCountLabel: `${nextEmps.length} موظفين`,
      };
    });

    setNewEmpName('');
    setAssignEmployeeModalOpen(false);
    await handleSaveHierarchyToFirestore(
      `تم تعيين الموظف "${trimmed}" في دور «${selectedRole.title}» وتحديث الصلاحيات`
    );
  };

  const handleSaveRoleTitleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedTitleInput.trim()) return;
    updateSelectedRole((prev) => ({
      ...prev,
      title: editedTitleInput.trim(),
      InspectorFullTitle: editedTitleInput.trim(),
    }));
    setEditingRoleTitleModalOpen(false);
    await handleSaveHierarchyToFirestore(
      `تم تعديل مسمى الدور إلى «${editedTitleInput.trim()}»`
    );
  };

  const cycleSubordinateAccess = () => {
    const currentIndex = ACCESS_LEVEL_OPTIONS.indexOf(
      selectedRole.defaultSubordinateAccess
    );
    const nextLevel =
      ACCESS_LEVEL_OPTIONS[(currentIndex + 1) % ACCESS_LEVEL_OPTIONS.length];
    updateSelectedRole((prev) => ({
      ...prev,
      defaultSubordinateAccess: nextLevel,
    }));
    setToastMsg(`تم تغيير مستوى الوصول الافتراضي إلى: ${nextLevel}`);
  };

  const ceoRole = getRoleById('role_ceo');
  const vpSalesRole = getRoleById('role_vp_sales');
  const headCsRole = getRoleById('role_head_cs');
  const csSupRole = getRoleById('role_cs_sup');
  const rgnCentralRole = getRoleById('role_rgn_central');
  const rgnEastWestRole = getRoleById('role_rgn_east_west');
  const kamRole = getRoleById('role_kam');
  const fieldSalesRole = getRoleById('role_field_sales');
  const sdrRole = getRoleById('role_sdr');

  const isRoleMatchedBySearch = (role: OrgRoleNode) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return (
      role.title.toLowerCase().includes(q) ||
      role.code.toLowerCase().includes(q) ||
      role.employees.some((e) => e.name.toLowerCase().includes(q))
    );
  };

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* 1. FLUSH WHITE HEADER & SECURITY TABS */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-4 pb-0">
        <div className="w-full space-y-3.5">
          {/* Top Row: Breadcrumb (Right in RTL) | Enterprise Security Pill (Left in RTL) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
              <Link to="/settings" className="hover:text-[#2563EB] font-medium">
                الإعدادات والنظام
              </Link>
              <span className="text-[#CBD5E1]">/</span>
              <span>الأمان والتحكم</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#0F172A]">
                الأدوار والهيكل التنظيمي
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF]/80 px-3 py-1 text-[11px] font-bold text-[#1D4ED8]">
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
              <span>مستوى الأمان المؤسسي: Enterprise A+</span>
              <span className="text-[#93C5FD]">|</span>
              <span className="font-mono text-[10px] text-[#475569]">
                SOC2 & ISO-27001
              </span>
            </div>
          </div>

          {/* Middle Row: Title & Subtitle (Right) | Search, Export & "+ إضافة دور وظيفي جديد" (Left) */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <h1 className="text-[22px] sm:text-[24px] font-extrabold text-[#0F172A] leading-tight">
                التحكم الأمني والصلاحيات والأدوار
              </h1>
              <p className="text-[12px] text-[#64748B] leading-relaxed">
                إدارة شجرة العلاقات الإدارية، توارث صلاحيات رؤية البيانات التلقائي، وتوزيع نفوذ الاعتماد المالي عبر المنظومة.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search in Roles & Employees */}
                <div className="relative w-60">
                  <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="البحث في الأدوار والموظفين..."
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-1.5 text-[11px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>

                {/* Export Structure (PDF/PNG) */}
                <button
                  type="button"
                  onClick={() =>
                    setToastMsg('تم تصدير مخطط الهيكل التنظيمي (PDF / PNG) بنجاح')
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-3 text-[11px] font-bold text-[#334155] transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>تصدير الهيكل (PDF/PNG)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAddingRoleModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة دور وظيفي جديد</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Security Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-t-xl bg-[#F8FAFC] p-1.5 border border-b-0 border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => navigate('/settings/profiles')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-all whitespace-nowrap ${
                activeSecurityTab === 'profiles'
                  ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <span>ملفات الصلاحيات (Profiles)</span>
              <span className="rounded-full bg-[#E2E8F0]/80 px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#475569] tabular-nums">
                {profiles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSecurityTab('roles')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-extrabold transition-all whitespace-nowrap ${
                activeSecurityTab === 'roles'
                  ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <span>الأدوار والهيكل التنظيمي (Role Hierarchy)</span>
              <span className="rounded-md bg-[#2563EB] px-2 py-0.5 text-[10px] font-extrabold text-[#FFFFFF] tabular-nums">
                {orgRoles.length - 1} أدوار
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSecurityTab('roles');
                setToastMsg('قواعد مشاركة البيانات مدمجة مباشرة في مفتش الدور الأيسر');
              }}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold text-[#475569] hover:text-[#0F172A] transition-colors whitespace-nowrap"
            >
              <span>قواعد مشاركة البيانات (Data Sharing Rules)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSecurityTab('roles');
                setToastMsg('سجل التدقيق الأمني نشط وموثق بمعيار SOC2 & ISO-27001');
              }}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold text-[#475569] hover:text-[#0F172A] transition-colors whitespace-nowrap"
            >
              <span>سجل التدقيق الأمني (Audit Log)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. 2-COLUMN WORKSPACE (Right 65%: Interactive Org Tree | Left 35%: Selected Role Inspector) */}
      <div className="w-full flex-1 px-6 py-5">
        <div className="w-full grid grid-cols-1 xl:grid-cols-[65%_35%] gap-5 items-start">
          {/* RIGHT COLUMN (65%): INTERACTIVE ORG TREE CANVAS */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs min-h-[820px] flex flex-col justify-between relative overflow-x-auto bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:18px_18px]">
            {/* Top Canvas Controls Bar (Right-aligned as in screenshot) */}
            <div className="flex flex-col items-start gap-2.5 z-10">
              {/* Zoom & Fit Control Pill */}
              <div className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-1 text-[11px] font-bold text-[#334155] shadow-2xs tabular-nums">
                <button
                  type="button"
                  onClick={() => setZoomPercent((z) => Math.min(120, z + 10))}
                  className="px-2 py-0.5 hover:text-[#2563EB]"
                  aria-label="تكبير الشجرة"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="px-2.5 border-x border-[#F1F5F9] font-mono font-extrabold text-[#0F172A]">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPercent((z) => Math.max(80, z - 10))}
                  className="px-2 py-0.5 hover:text-[#2563EB]"
                  aria-label="تصغير الشجرة"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPercent(100)}
                  className="pr-2.5 pl-1 border-r border-[#E2E8F0] text-[11px] font-bold text-[#475569] hover:text-[#0F172A]"
                >
                  ملاءمة العرض
                </button>
              </div>

              {/* Second Control Row: Expand/Collapse All + Show Actual Employees Checkbox + Data Inheritance Active Badge */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/95 px-3 py-1.5 text-[11px] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setExpandAllTree((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-bold text-[#475569] hover:text-[#2563EB] transition-colors"
                >
                  {expandAllTree ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  <span>طي الكل / توسيع الكل</span>
                </button>

                <span className="text-[#E2E8F0]">|</span>

                <label className="inline-flex items-center gap-1.5 font-bold text-[#0F172A] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showEmployeesInTree}
                    onChange={(e) => setShowEmployeesInTree(e.target.checked)}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span>إظهار الموظفين الفعليين</span>
                </label>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] border border-[#6EE7B7] px-2.5 py-0.5 text-[10px] font-extrabold text-[#047857]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  <span>توارث البيانات: نشط</span>
                </span>
              </div>
            </div>

            {/* HIERARCHICAL TREE DIAGRAM */}
            <div
              className="my-auto py-4 flex flex-col items-center min-w-[660px] transition-transform duration-150"
              style={{
                transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              {/* LEVEL 1: CEO ROOT CARD */}
              <div
                onClick={() => setSelectedRoleId(ceoRole.id)}
                className={`w-[300px] rounded-2xl border bg-[#F8FAFC] p-3.5 cursor-pointer transition-all shadow-xs ${
                  selectedRole.id === ceoRole.id
                    ? 'border-2 border-[#2563EB] bg-[#FFFFFF] ring-4 ring-[#2563EB]/10'
                    : isRoleMatchedBySearch(ceoRole)
                    ? 'border-2 border-[#10B981] bg-[#FFFFFF]'
                    : 'border-[#CBD5E1] hover:border-[#2563EB]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="rounded-md bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF]">
                    {ceoRole.levelBadge}
                  </span>
                  <span className="text-[10px] font-bold text-[#64748B] tabular-nums">
                    {ceoRole.employeesCountLabel}
                  </span>
                </div>

                <h3 className="text-[14px] font-extrabold text-[#0F172A] text-center">
                  {ceoRole.title}
                </h3>
                <p className="text-[11px] font-extrabold text-[#059669] text-center mt-0.5">
                  {ceoRole.subtitle}
                </p>

                {showEmployeesInTree && ceoRole.employees[0] && (
                  <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-extrabold text-[#FFFFFF]">
                        {ceoRole.employees[0].initial}
                      </span>
                      <span className="font-extrabold text-[#0F172A]">
                        {ceoRole.employees[0].name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[#64748B]">
                      CEO
                    </span>
                  </div>
                )}
              </div>

              {/* Connector Stem from CEO to Level 2 Horizontal Bar */}
              {expandAllTree && (
                <>
                  <div className="h-5 w-0.5 bg-[#CBD5E1]" />

                  {/* Horizontal Branch Bar across VP Sales (Right) and Head of CS (Left) */}
                  <div className="w-[460px] border-t-2 border-[#CBD5E1] flex justify-between">
                    <div className="h-5 w-0.5 bg-[#CBD5E1]" />
                    <div className="h-5 w-0.5 bg-[#CBD5E1]" />
                  </div>

                  {/* LEVEL 2 ROW: Right = VP Sales | Left = Head of CS */}
                  <div className="w-full max-w-[660px] grid grid-cols-2 gap-6 items-start">
                    {/* RIGHT BRANCH (in RTL): VP SALES & SUBTREE */}
                    <div className="flex flex-col items-center">
                      {/* VP Sales Card */}
                      <div
                        onClick={() => setSelectedRoleId(vpSalesRole.id)}
                        className={`w-[285px] rounded-2xl border bg-[#F8FAFC] p-3.5 cursor-pointer transition-all shadow-xs ${
                          selectedRole.id === vpSalesRole.id
                            ? 'border-2 border-[#2563EB] bg-[#FFFFFF] ring-4 ring-[#2563EB]/10'
                            : isRoleMatchedBySearch(vpSalesRole)
                            ? 'border-2 border-[#10B981] bg-[#FFFFFF]'
                            : 'border-[#CBD5E1] hover:border-[#2563EB]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="rounded-md bg-[#E0E7FF] px-2 py-0.5 text-[10px] font-extrabold text-[#3730A3]">
                            {vpSalesRole.levelBadge}
                          </span>
                          <span className="text-[10px] font-bold text-[#64748B] tabular-nums">
                            {vpSalesRole.employeesCountLabel}
                          </span>
                        </div>

                        <h4 className="text-[13px] font-extrabold text-[#0F172A] text-center">
                          {vpSalesRole.title}
                        </h4>
                        <p className="text-[11px] text-[#64748B] text-center mt-0.5">
                          {vpSalesRole.subtitle}
                        </p>

                        {showEmployeesInTree && vpSalesRole.employees[0] && (
                          <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 flex items-center gap-2 text-[11px]">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3730A3] text-[10px] font-extrabold text-[#FFFFFF]">
                              {vpSalesRole.employees[0].initial}
                            </span>
                            <span className="font-bold text-[#0F172A]">
                              {vpSalesRole.employees[0].name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Connector from VP Sales to Level 3 Regional Managers */}
                      <div className="h-5 w-0.5 bg-[#CBD5E1]" />
                      <div className="w-[210px] border-t-2 border-[#CBD5E1] flex justify-between">
                        <div className="h-5 w-0.5 bg-[#2563EB]" />
                        <div className="h-5 w-0.5 bg-[#CBD5E1]" />
                      </div>

                      {/* LEVEL 3 UNDER VP SALES: Right = Central Region (Selected) | Left = East/West Region */}
                      <div className="grid grid-cols-2 gap-3.5 items-start w-[360px]">
                        {/* L3 Right Sub-branch: مدير مبيعات إقليمي - الوسطى */}
                        <div className="flex flex-col items-center">
                          {/* "الدور المحدد حالياً" Pill */}
                          {selectedRole.id === rgnCentralRole.id && (
                            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[#1D4ED8] px-2.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF] shadow-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#FFFFFF]" />
                              <span>الدور المحدد حالياً</span>
                            </span>
                          )}

                          <div
                            onClick={() => setSelectedRoleId(rgnCentralRole.id)}
                            className={`w-[172px] rounded-2xl p-3 cursor-pointer transition-all shadow-sm ${
                              selectedRole.id === rgnCentralRole.id
                                ? 'border-2 border-[#2563EB] bg-[#FFFFFF] ring-4 ring-[#2563EB]/10'
                                : 'border border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
                              <span className="font-extrabold text-[#2563EB]">
                                {rgnCentralRole.levelBadge}
                              </span>
                              <span className="text-[#64748B] font-bold tabular-nums">
                                {rgnCentralRole.employeesCountLabel}
                              </span>
                            </div>

                            <h5 className="text-[13px] font-extrabold text-[#1D4ED8] leading-snug text-center">
                              {rgnCentralRole.title}
                            </h5>
                            <p className="text-[10px] text-[#64748B] text-center mt-0.5">
                              {rgnCentralRole.subtitle}
                            </p>

                            {/* Active Deals Metric Box */}
                            <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2 flex items-center justify-between text-[10px]">
                              <span className="text-[#64748B]">الصفقات الجارية:</span>
                              <div className="text-left font-mono">
                                <span className="block font-extrabold text-[#0F172A]">
                                  {rgnCentralRole.dealsCountLabel}
                                </span>
                                <span className="block font-extrabold text-[#059669]">
                                  {rgnCentralRole.dealsValueLabel}
                                </span>
                              </div>
                            </div>

                            {/* Employees inside Central Region Card */}
                            {showEmployeesInTree && (
                              <div className="mt-2.5 space-y-1.5">
                                {rgnCentralRole.employees.map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 flex items-center justify-between text-[10px]"
                                  >
                                    <span className="font-extrabold text-[#0F172A] truncate">
                                      {emp.name}
                                    </span>
                                    <span className="rounded bg-[#D1FAE5] px-1.5 py-0.5 text-[9px] font-extrabold text-[#047857] shrink-0">
                                      نشط
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Blue Vertical Line to L4 Subordinates (KAM, Field Sales, SDR) */}
                          <div className="h-5 w-0.5 bg-[#2563EB]" />

                          <div className="space-y-2.5 w-[172px]">
                            {[kamRole, fieldSalesRole, sdrRole].map((subRole) => {
                              const isSubSelected = selectedRole.id === subRole.id;
                              return (
                                <div
                                  key={subRole.id}
                                  onClick={() => setSelectedRoleId(subRole.id)}
                                  className={`rounded-2xl border p-2.5 cursor-pointer transition-all ${
                                    isSubSelected
                                      ? 'border-2 border-[#2563EB] bg-[#FFFFFF] shadow-sm'
                                      : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] hover:border-[#93C5FD]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-right">
                                      <p className="text-[12px] font-extrabold text-[#0F172A] leading-snug">
                                        {subRole.title}
                                      </p>
                                      <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">
                                        {subRole.subtitle}
                                      </p>
                                    </div>
                                    <span className="rounded-lg bg-[#E2E8F0]/75 px-2 py-1 text-[10px] font-extrabold text-[#475569] text-center leading-tight shrink-0 tabular-nums">
                                      {subRole.employeesCountLabel}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* L3 Left Sub-branch: مدير مبيعات - الشرقية والغربية */}
                        <div className="flex flex-col items-center">
                          <div
                            onClick={() => setSelectedRoleId(rgnEastWestRole.id)}
                            className={`w-[172px] rounded-2xl border p-3 cursor-pointer transition-all shadow-xs ${
                              selectedRole.id === rgnEastWestRole.id
                                ? 'border-2 border-[#2563EB] bg-[#FFFFFF] ring-4 ring-[#2563EB]/10'
                                : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
                              <span className="font-bold text-[#64748B]">
                                {rgnEastWestRole.levelBadge}
                              </span>
                              <span className="text-[#64748B] font-bold tabular-nums">
                                {rgnEastWestRole.employeesCountLabel}
                              </span>
                            </div>

                            <h5 className="text-[13px] font-extrabold text-[#0F172A] leading-snug text-center">
                              {rgnEastWestRole.title}
                            </h5>
                            <p className="text-[10px] text-[#64748B] text-center mt-0.5">
                              {rgnEastWestRole.subtitle}
                            </p>

                            {/* Deals Box */}
                            <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 flex items-center justify-between text-[10px]">
                              <span className="text-[#64748B]">الصفقات:</span>
                              <div className="text-left font-mono">
                                <span className="block font-extrabold text-[#0F172A]">
                                  {rgnEastWestRole.dealsCountLabel}
                                </span>
                                <span className="block font-extrabold text-[#059669]">
                                  {rgnEastWestRole.dealsValueLabel}
                                </span>
                              </div>
                            </div>

                            {showEmployeesInTree && (
                              <div className="mt-2.5 text-center text-[10px] text-[#475569]">
                                <span>فهد الشمري + 1 آخر </span>
                                <span className="font-extrabold text-[#059669] underline">
                                  نشط
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="h-4 w-0.5 bg-[#CBD5E1]" />

                          <button
                            type="button"
                            onClick={() => setEastWestExpanded((p) => !p)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#FFFFFF] px-3 py-1 text-[10px] font-bold text-[#475569] shadow-2xs transition-colors"
                          >
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${
                                eastWestExpanded ? 'rotate-180' : ''
                              }`}
                            />
                            <span>3 أدوار فرعية (11 موظفاً)</span>
                          </button>

                          {eastWestExpanded && (
                            <div className="mt-2 w-[172px] space-y-1.5">
                              <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 text-[10px] font-bold text-[#334155]">
                                مسؤولو حسابات الشرقية (4 موظفين)
                              </div>
                              <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 text-[10px] font-bold text-[#334155]">
                                مبيعات جدة الميدانية (5 موظفين)
                              </div>
                              <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 text-[10px] font-bold text-[#334155]">
                                تأهيل العملاء - الغربية (2 موظفين)
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* LEFT BRANCH (in RTL): HEAD OF CUSTOMER SUCCESS & SUBTREE */}
                    <div className="flex flex-col items-center">
                      <div
                        onClick={() => setSelectedRoleId(headCsRole.id)}
                        className={`w-[260px] rounded-2xl border bg-[#F8FAFC] p-3.5 cursor-pointer transition-all shadow-xs ${
                          selectedRole.id === headCsRole.id
                            ? 'border-2 border-[#2563EB] bg-[#FFFFFF] ring-4 ring-[#2563EB]/10'
                            : isRoleMatchedBySearch(headCsRole)
                            ? 'border-2 border-[#10B981] bg-[#FFFFFF]'
                            : 'border-[#CBD5E1] hover:border-[#2563EB]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-extrabold text-[#047857]">
                            {headCsRole.levelBadge}
                          </span>
                          <span className="text-[10px] font-bold text-[#64748B] tabular-nums">
                            {headCsRole.employeesCountLabel}
                          </span>
                        </div>

                        <h4 className="text-[13px] font-extrabold text-[#0F172A] text-center">
                          {headCsRole.title}
                        </h4>
                        <p className="text-[11px] text-[#64748B] text-center mt-0.5">
                          {headCsRole.subtitle}
                        </p>

                        {showEmployeesInTree && headCsRole.employees[0] && (
                          <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 flex items-center gap-2 text-[11px]">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#065F46] text-[10px] font-extrabold text-[#FFFFFF]">
                              {headCsRole.employees[0].initial}
                            </span>
                            <span className="font-bold text-[#0F172A]">
                              {headCsRole.employees[0].name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="h-5 w-0.5 bg-[#CBD5E1]" />

                      {/* Subordinate under Head of CS */}
                      <div
                        onClick={() => setSelectedRoleId(csSupRole.id)}
                        className={`w-[240px] rounded-2xl border p-3 cursor-pointer transition-all ${
                          selectedRole.id === csSupRole.id
                            ? 'border-2 border-[#2563EB] bg-[#FFFFFF] shadow-sm'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] hover:border-[#93C5FD]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-right">
                            <p className="text-[12px] font-extrabold text-[#0F172A]">
                              {csSupRole.title}
                            </p>
                            <p className="text-[10px] text-[#64748B] mt-0.5">
                              {csSupRole.subtitle}
                            </p>
                          </div>
                          <span className="rounded-lg bg-[#E2E8F0]/75 px-2 py-1 text-[10px] font-extrabold text-[#475569] shrink-0 tabular-nums">
                            {csSupRole.employeesCountLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="text-left text-[10px] text-[#94A3B8] pt-2">
              انقر على أي دور في الشجرة لمعاينة وتخصيص قواعد توارث البيانات والاعتماد
            </div>
          </section>

          {/* LEFT COLUMN (35%): SELECTED ROLE INSPECTOR */}
          <aside className="space-y-4">
            {/* CARD 1: ROLE TITLE, CODE, REPORTING TO, SUBORDINATES & ACTIONS */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-[#64748B]">
                    معاينة تفاصيل الدور التنظيمي
                  </p>
                  <h2 className="text-[17px] font-extrabold text-[#0F172A] leading-snug">
                    {selectedRole.InspectorFullTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditedTitleInput(selectedRole.InspectorFullTitle);
                    setEditingRoleTitleModalOpen(true);
                  }}
                  aria-label="خيارات الدور"
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Role Code & Active Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 font-mono text-[11px] font-extrabold text-[#2563EB]">
                  {selectedRole.code}
                </span>
                <span className="rounded-full bg-[#D1FAE5] px-3 py-1 text-[11px] font-extrabold text-[#047857]">
                  مفعل في النظام
                </span>
              </div>

              {/* 2-Column Reporting To & Direct Subordinates Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                  <p className="text-[10px] text-[#64748B]">المدير المباشر في الشجرة:</p>
                  <p className="text-[12px] font-extrabold text-[#0F172A] mt-0.5 leading-snug">
                    {selectedRole.reportsToLabel}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                  <p className="text-[10px] text-[#64748B]">المرؤوسون المباشرون:</p>
                  <p className="text-[12px] font-extrabold text-[#2563EB] mt-0.5 leading-snug">
                    {selectedRole.subordinatesSummary}
                  </p>
                </div>
              </div>

              {/* 3 Action Buttons: تعديل مسمى الدور | نقل الدور في الشجرة | + تعيين موظف */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditedTitleInput(selectedRole.InspectorFullTitle);
                    setEditingRoleTitleModalOpen(true);
                  }}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] py-2 px-2 text-[11px] font-bold text-[#0F172A] transition-colors text-center"
                >
                  تعديل مسمى الدور
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setToastMsg('اختر الدور الأعلى الجديد في الشجرة لنقل التبعية الإدارية')
                  }
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] py-2 px-2 text-[11px] font-bold text-[#0F172A] transition-colors text-center"
                >
                  نقل الدور في الشجرة
                </button>

                <button
                  type="button"
                  onClick={() => setAssignEmployeeModalOpen(true)}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2 px-2 text-[11px] font-extrabold text-[#FFFFFF] shadow-2xs transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>تعيين موظف</span>
                </button>
              </div>
            </div>

            {/* CARD 2: الموظفون الشاغلون لهذا الدور */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#2563EB] shrink-0" />
                  <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                    الموظفون الشاغلون لهذا الدور ({selectedRole.employees.length})
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-[#64748B]">
                  كلاهما بنشاط كامل
                </span>
              </div>

              <div className="space-y-2">
                {selectedRole.employees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() =>
                      setToastMsg(`عرض سجل الموظف: ${emp.name} (${emp.titleBranch})`)
                    }
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF]/40 hover:border-[#93C5FD] p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DBEAFE] text-[12px] font-extrabold text-[#1E40AF] shrink-0">
                        {emp.initial}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-extrabold text-[#0F172A] truncate">
                            {emp.name}
                          </span>
                          {emp.isPrimary && (
                            <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[9px] font-extrabold text-[#FFFFFF] shrink-0">
                              الرئيسي
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                          {emp.titleBranch}
                        </p>
                      </div>
                    </div>

                    <ArrowUpLeft className="h-4 w-4 text-[#94A3B8] shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: قواعد رؤية وتوارث البيانات التلقائية */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#059669] shrink-0" />
                <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                  قواعد رؤية وتوارث البيانات التلقائية
                </h3>
              </div>

              {/* Toggle 1: Roll-Up Data / hide_subordinates_data */}
              <div
                onClick={() => {
                  const nextRollUp = !selectedRole.rollUpEnabled;
                  updateSelectedRole((prev) => ({
                    ...prev,
                    rollUpEnabled: nextRollUp,
                  }));
                  const matchedCrmRole =
                    firestoreRoles.find((fr) =>
                      fr.name.includes(selectedRole.title.slice(0, 8))
                    ) ?? firestoreRoles.find((fr) => fr.dataVisibility === 'team');
                  if (matchedCrmRole) {
                    void toggleRoleHideSubordinates(matchedCrmRole.id, !nextRollUp);
                  }
                  setToastMsg(
                    nextRollUp
                      ? 'تم تفعيل رؤية بيانات المرؤوسين (hide_subordinates_data: false)'
                      : 'تم تفعيل إخفاء بيانات المرؤوسين عن هذا الدور (hide_subordinates_data: true)'
                  );
                }}
                className={`rounded-xl border p-3 cursor-pointer transition-all space-y-1.5 ${
                  selectedRole.rollUpEnabled
                    ? 'border-[#A7F3D0] bg-[#ECFDF5]/45'
                    : 'border-[#FECDD3] bg-[#FFF1F2]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                        selectedRole.rollUpEnabled
                          ? 'bg-[#059669] text-[#FFFFFF]'
                          : 'bg-[#E11D48] text-[#FFFFFF]'
                      }`}
                    >
                      {selectedRole.rollUpEnabled ? (
                        <Check className="h-3 w-3 stroke-[3]" />
                      ) : (
                        <X className="h-3 w-3 stroke-[3]" />
                      )}
                    </span>
                    <span className="text-[12px] font-extrabold text-[#0F172A]">
                      رؤية السجلات التنازلية (Roll-Up / hide_subordinates_data)
                    </span>
                  </div>

                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                      selectedRole.rollUpEnabled
                        ? 'bg-[#D1FAE5] text-[#047857]'
                        : 'bg-[#FFE4E6] text-[#BE123C]'
                    }`}
                  >
                    {selectedRole.rollUpEnabled ? 'مفعل تلقائياً' : 'محجوب (hide_subordinates)'}
                  </span>
                </div>

                <p className="text-[11px] text-[#475569] leading-relaxed pr-7">
                  {selectedRole.rollUpEnabled
                    ? `يستطيع تلقائياً رؤية وتعديل كافة الصفقات، جهات الاتصال، والمحادثات الخاصة بمرؤوسيه الـ ${selectedRole.subordinatesCountNumber} دون الحاجة لمشاركة يدوية.`
                    : 'تم تفعيل خيار «إخفاء بيانات المرؤوسين (hide_subordinates_data: true)»؛ يرى صاحب الدور سجلاته ومحادثاته فقط دون الاطلاع على سجلات المرؤوسين.'}
                </p>
              </div>

              {/* Toggle 2: Peer Sharing */}
              <div
                onClick={() =>
                  updateSelectedRole((prev) => ({
                    ...prev,
                    peerSharingEnabled: !prev.peerSharingEnabled,
                  }))
                }
                className={`rounded-xl border p-3 cursor-pointer transition-all space-y-1.5 ${
                  selectedRole.peerSharingEnabled
                    ? 'border-[#BFDBFE] bg-[#EFF6FF]/50'
                    : 'border-[#E2E8F0] bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                        selectedRole.peerSharingEnabled
                          ? 'bg-[#2563EB] text-[#FFFFFF]'
                          : 'bg-[#E2E8F0] text-[#64748B]'
                      }`}
                    >
                      {selectedRole.peerSharingEnabled ? (
                        <Check className="h-3 w-3 stroke-[3]" />
                      ) : (
                        <X className="h-3 w-3 stroke-[2.5]" />
                      )}
                    </span>
                    <span className="text-[12px] font-extrabold text-[#0F172A]">
                      مشاركة السجلات بين النظراء (Peer Sharing)
                    </span>
                  </div>

                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                      selectedRole.peerSharingEnabled
                        ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                        : 'bg-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    {selectedRole.peerSharingEnabled ? 'مفعل' : 'معطل'}
                  </span>
                </div>

                <p className="text-[11px] text-[#64748B] leading-relaxed pr-7">
                  {selectedRole.peerSharingEnabled
                    ? 'يُسمح بتبادل الاطلاع على الصفقات مع النظراء في نفس المستوى التنظيمي لتسهيل التغطية المشتركة.'
                    : 'لا يمكنه الاطلاع على صفقات قطاع المنطقة الشرقية والغربية إلا من خلال تحويل مباشر للملكية أو تفويض أمني صريح.'}
                </p>
              </div>

              {/* Default Subordinate Access Level */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] font-extrabold text-[#0F172A]">
                  مستوى الوصول الافتراضي لسجلات المرؤوسين:
                </span>
                <button
                  type="button"
                  onClick={cycleSubordinateAccess}
                  className="rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-3 py-1.5 text-[11px] font-extrabold text-[#FFFFFF] shadow-2xs transition-colors shrink-0"
                >
                  {selectedRole.defaultSubordinateAccess}
                </button>
              </div>
            </div>

            {/* CARD 4: صلاحيات الاعتماد والقرارات التنفيذية */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-[#4338CA] shrink-0" />
                <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                  صلاحيات الاعتماد والقرارات التنفيذية
                </h3>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">سقف اعتماد الخصومات التلقائية:</span>
                  <strong className="font-extrabold text-[#0F172A]">
                    {selectedRole.discountLimitLabel}
                  </strong>
                </div>

                <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">تحويل مسار صفقات البلوبرينت:</span>
                  <strong className="font-extrabold text-[#059669]">
                    {selectedRole.blueprintStageApprovalLabel}
                  </strong>
                </div>

                <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">سقف قيمة الصفقات المصرح بها:</span>
                  <strong className="font-extrabold text-[#2563EB] tabular-nums">
                    {selectedRole.maxDealValueLabel}
                  </strong>
                </div>
              </div>
            </div>

            {/* CARD 5: ملف الصلاحيات المطبق (Profile) */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] shrink-0">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">
                    ملف الصلاحيات المطبق (Profile)
                  </p>
                  <p className="text-[12px] font-extrabold text-[#0F172A]">
                    {selectedRole.appliedProfileName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/settings/profiles')}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#2563EB] hover:underline shrink-0"
              >
                <span>مصفوفة الأذونات</span>
                <ArrowUpLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* 3. STICKY BOTTOM SAVE BAR */}
      <footer className="sticky bottom-0 z-30 bg-[#FFFFFF] border-t border-[#E2E8F0] px-6 py-3 shadow-sm">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          {/* Right Note */}
          <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
            <Info className="h-4 w-4 text-[#475569] shrink-0" />
            <span>
              أي تعديل على الشجرة يعيد احتساب صلاحيات الوصول التراكمية تلقائياً للموظفين المرتبطين فور الحفظ.
            </span>
          </div>

          {/* Left Buttons: Cancel + Save Hierarchy (Ctrl+S) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setOrgRoles(INITIAL_ORG_ROLES);
                setSelectedRoleId('role_rgn_central');
                setToastMsg('تم إلغاء التعديلات واستعادة الهيكل التنظيمي الافتراضي');
              }}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-4 py-2.5 text-[12px] font-bold text-[#0F172A] transition-colors"
            >
              إلغاء التعديلات
            </button>

            <button
              type="button"
              disabled={savingHierarchy}
              onClick={() => void handleSaveHierarchyToFirestore()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {savingHierarchy
                  ? 'جارٍ الحفظ في Firestore...'
                  : 'حفظ وتحديث الهيكل التنظيمي (Ctrl+S)'}
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL 1: "+ إضافة دور وظيفي جديد" */}
      {addingRoleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                إضافة دور وظيفي جديد في الشجرة
              </h3>
              <button
                type="button"
                onClick={() => setAddingRoleModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRole} className="space-y-3.5 text-[12px]">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  مسمى الدور الوظيفي *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مدير مبيعات القطاع الحكومي"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  يتبع إدارياً لـ (المدير المباشر في الشجرة)
                </label>
                <select
                  value={newRoleReportsTo}
                  onChange={(e) => setNewRoleReportsTo(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  {orgRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  نطاق رؤية البيانات (Data Visibility)
                </label>
                <select
                  value={newRoleVisibility}
                  onChange={(e) =>
                    setNewRoleVisibility(
                      e.target.value as 'private' | 'team' | 'organization'
                    )
                  }
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="team">فريق العمل والمرؤوسين (Roll-Up Team)</option>
                  <option value="organization">كافة المنظمة (Organization-Wide)</option>
                  <option value="private">السجلات الخاصة فقط (Private)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  الوصف التشغيلي / الفروع
                </label>
                <input
                  type="text"
                  placeholder="مثال: إدارة عقود المناقصات والمشاريع الحكومية"
                  value={newRoleSubtitle}
                  onChange={(e) => setNewRoleSubtitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAddingRoleModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  إضافة وحفظ في Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: "+ تعيين موظف" */}
      {assignEmployeeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                تعيين موظف في دور: {selectedRole.title}
              </h3>
              <button
                type="button"
                onClick={() => setAssignEmployeeModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignEmployeeSubmit} className="space-y-3.5 text-[12px]">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  اسم الموظف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: م. عمر الغامدي"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  المسمى الوظيفي والفرع
                </label>
                <input
                  type="text"
                  value={newEmpTitleBranch}
                  onChange={(e) => setNewEmpTitleBranch(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAssignEmployeeModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  تأكيد التعيين
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: "تعديل مسمى الدور" */}
      {editingRoleTitleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                تعديل مسمى الدور التنظيمي
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoleTitleModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoleTitleEdit} className="space-y-3.5 text-[12px]">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">
                  المسمى الجديد للدور *
                </label>
                <input
                  type="text"
                  required
                  value={editedTitleInput}
                  onChange={(e) => setEditedTitleInput(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setEditingRoleTitleModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 font-extrabold text-[#FFFFFF]"
                >
                  حفظ التعديل
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
