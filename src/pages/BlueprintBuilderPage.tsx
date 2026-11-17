import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Hash,
  History,
  Info,
  LayoutGrid,
  Link2,
  Lock,
  MessageSquare,
  Minus,
  Monitor,
  MoreVertical,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Table2,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';

interface BlueprintStageNode {
  id: string;
  numberLabel: string;
  stepIndex: number;
  title: string;
  englishSubtitle: string;
  canvasSubtitle: string;
  dealsCountLabel: string;
  slaBadge: string;
  category: 'normal' | 'active' | 'won' | 'lost';
  ownersLabel?: string;
  prereqDocsLabel?: string;
}

interface BlueprintFieldRequirement {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeTone: 'danger' | 'info' | 'neutral';
  enabled: boolean;
}

interface BlueprintAfterAction {
  id: string;
  label: string;
  enabled: boolean;
  systemTag?: string;
}

interface BlueprintBeforeCondition {
  id: string;
  fieldLabel: string;
  operatorLabel: string;
  valueLabel: string;
  enabled: boolean;
}

interface BlueprintTransitionConfig {
  id: string;
  code: string;
  shortTitle: string;
  englishName: string;
  pillLabel: string;
  fromStageId: string;
  fromStageNumber: number;
  fromStageName: string;
  toStageId: string;
  toStageBadge: string;
  toStageName: string;
  badgeTag?: string;
  tone: 'normal' | 'won' | 'lost' | 'loop';
  iconType: 'arrow' | 'monitor' | 'doc' | 'scale' | 'won' | 'lost' | 'loop';
  roles: string[];
  tableRoleChips: string[];
  beforeSummaryChip: string;
  beforeSummaryTone: 'emerald' | 'slate';
  beforeCriteriaList: string[];
  rolesSummaryText: string;
  tableDuringChips: string[];
  duringGridCards: { label: string; icon: 'pdf' | 'po' | 'payment' | 'date' }[];
  duringCountBadge: string;
  tableAfterChips: string[];
  afterDetailRows: { label: string; tag: string }[];
  afterCountBadge: string;
  slaDurationLabel: string;
  slaStatusLabel: string;
  enabled: boolean;
  requireDigitalSignature: boolean;
  discountLimitPercent: number;
  beforeConditions: BlueprintBeforeCondition[];
  duringFields: BlueprintFieldRequirement[];
  afterActions: BlueprintAfterAction[];
}

const INITIAL_STAGES: BlueprintStageNode[] = [
  {
    id: 'stg_1',
    numberLabel: '01',
    stepIndex: 1,
    title: 'عميل محتمل مؤهل (Qualified Lead)',
    englishSubtitle: 'Lead Qualified · 12 صفقة حالية',
    canvasSubtitle: 'الحد الأقصى للإقامة: 3 أيام عمل',
    dealsCountLabel: '12 صفقة حالية',
    slaBadge: 'بداية المسار',
    category: 'normal',
  },
  {
    id: 'stg_2',
    numberLabel: '02',
    stepIndex: 2,
    title: 'تحليل الاحتياج والعرض الفني',
    englishSubtitle: 'Needs Analysis · 8 صفقات',
    canvasSubtitle: 'يتطلب حضور مهندس المبيعات واعتماد النطاق',
    dealsCountLabel: '8 صفقات',
    slaBadge: 'SLA: 5 أيام',
    category: 'normal',
  },
  {
    id: 'stg_3',
    numberLabel: '03',
    stepIndex: 3,
    title: 'تقديم العرض المالي (Quote Sent)',
    englishSubtitle: 'Quote Sent · 5 صفقات',
    canvasSubtitle: 'تم التسليم رسمياً - بانتظار استجابة المشتريات',
    dealsCountLabel: '5 صفقات',
    slaBadge: 'تحت النظر',
    category: 'normal',
  },
  {
    id: 'stg_4',
    numberLabel: '04',
    stepIndex: 4,
    title: '4. التفاوض ومراجعة العقود (Negotiation)',
    englishSubtitle: 'Negotiation · 18 صفقة كبرى',
    canvasSubtitle: 'تنبيه اختناق: بعد 5 أيام بدون حركة',
    dealsCountLabel: '18 صفقة كبرى',
    slaBadge: 'مرحلة حساسة وحرجة',
    category: 'active',
    ownersLabel: 'مدير المبيعات + الشؤون القانونية',
    prereqDocsLabel: 'مسودة الاتفاقية + جدول الأسعار المعتمد',
  },
  {
    id: 'stg_5',
    numberLabel: '05',
    stepIndex: 5,
    title: '5. إغلاق فوز (Closed Won)',
    englishSubtitle: 'محطة نهائية ناجحة',
    canvasSubtitle: 'توليد الفاتورة والبدء في تجهيز المشروع',
    dealsCountLabel: 'محطة نهائية ناجحة',
    slaBadge: 'فوز',
    category: 'won',
  },
  {
    id: 'stg_6',
    numberLabel: '06',
    stepIndex: 6,
    title: '6. إغلاق خسارة (Closed Lost)',
    englishSubtitle: 'محطة إنهاء وتعثر',
    canvasSubtitle: 'تحديد أسباب الفقد وتحليل المنافسين',
    dealsCountLabel: 'محطة إنهاء وتعثر',
    slaBadge: 'خسارة',
    category: 'lost',
  },
];

function createDefaultDuringFields(): BlueprintFieldRequirement[] {
  return [
    {
      id: 'fld_contract_pdf',
      title: 'العقد الموقع النهائي (PDF)',
      subtitle: 'التحقق من وجود الختم والتوقيع الإلكتروني الحي',
      badgeText: 'مرفق إلزامي',
      badgeTone: 'danger',
      enabled: true,
    },
    {
      id: 'fld_po_number',
      title: 'رقم أمر الشراء (PO Number)',
      subtitle: 'صادر من نظام المشتريات للعميل',
      badgeText: 'نص إلزامي',
      badgeTone: 'info',
      enabled: true,
    },
    {
      id: 'fld_payment_terms',
      title: 'طريقة الدفع وجدول الدفعات',
      subtitle: 'خيارات: دفعة مقدمة 50% / نقدي / خطاب اعتماد',
      badgeText: 'قائمة منسدلة',
      badgeTone: 'info',
      enabled: true,
    },
    {
      id: 'fld_service_start_date',
      title: 'تاريخ بدء سريان الخدمة',
      subtitle: 'يحدد موعد تسليم المشروع وجدول الإطلاق',
      badgeText: 'تاريخ ميلادي',
      badgeTone: 'info',
      enabled: true,
    },
    {
      id: 'fld_discount_summary',
      title: 'ملخص تفاوض الخصم النهائي',
      subtitle: 'توثيق سبب أي خصم تجاوز نسبة 15%',
      badgeText: 'ملاحظات نصية',
      badgeTone: 'neutral',
      enabled: true,
    },
  ];
}

function createDefaultAfterActions(): BlueprintAfterAction[] {
  return [
    {
      id: 'act_slack_whatsapp',
      label: 'إشعار مباركة في واتساب وقناة مبيعات سلاك',
      enabled: true,
      systemTag: 'قالب معتمد',
    },
    {
      id: 'act_account_tier',
      label: 'تحويل الحساب تلقائياً إلى «عميل استراتيجي نشط»',
      enabled: true,
      systemTag: 'CRM Sync',
    },
    {
      id: 'act_onboarding_task',
      label: 'توليد مهمة عمل لفريق تجهيز وتسليم المشاريع',
      enabled: true,
      systemTag: 'قسم المشاريع',
    },
    {
      id: 'act_erp_capi',
      label: 'إرسال تفاصيل العقد لنظام الفوترة والمحاسبة ERP',
      enabled: true,
      systemTag: 'REST API',
    },
  ];
}

function createDefaultBeforeConditions(): BlueprintBeforeCondition[] {
  return [
    {
      id: 'cond_amount',
      fieldLabel: 'قيمة الصفقة الإجمالية',
      operatorLabel: 'أكبر من أو يساوي',
      valueLabel: '50,000 ر.س',
      enabled: true,
    },
    {
      id: 'cond_quote_status',
      fieldLabel: 'حالة عرض السعر المرتبط',
      operatorLabel: 'يساوي',
      valueLabel: 'معتمد من العميل',
      enabled: true,
    },
    {
      id: 'cond_tax_id',
      fieldLabel: 'الرقم الضريبي للحساب (VAT)',
      operatorLabel: 'غير فارغ',
      valueLabel: 'موثق في السجل',
      enabled: true,
    },
  ];
}

const INITIAL_TRANSITIONS: BlueprintTransitionConfig[] = [
  {
    id: 'tr_901',
    code: 'TR-901',
    shortTitle: 'بدء استكشاف الاحتياج',
    englishName: 'Discovery Start',
    pillLabel: 'انتقال: «إرسال العرض التوضيحي الفني»',
    fromStageId: 'stg_1',
    fromStageNumber: 1,
    fromStageName: 'عميل محتمل مؤهل',
    toStageId: 'stg_2',
    toStageBadge: '2. تحليل الاحتياج',
    toStageName: 'تحليل الاحتياج الفني',
    tone: 'normal',
    iconType: 'arrow',
    roles: ['مسؤول تأهيل SDR', 'مسؤول حساب كبار العملاء (Senior KAM)'],
    tableRoleChips: ['مسؤول تأهيل SDR'],
    beforeSummaryChip: 'اكتمال فحص BANT',
    beforeSummaryTone: 'emerald',
    beforeCriteriaList: [
      'اكتمال معايير التأهيل المبدئي (BANT) وتحديد الميزانية التقديرية',
      'التحقق من بيانات التواصل الرسمية لصانع القرار في الشركة',
    ],
    rolesSummaryText: 'مسؤولي تأهيل المبيعات (SDR) ومدراء الحسابات',
    tableDuringChips: ['ميزانية تقريبية', 'صانع القرار'],
    duringGridCards: [
      { label: 'الميزانية التقريبية المعتمدة', icon: 'payment' },
      { label: 'اسم ومنصب صانع القرار', icon: 'po' },
      { label: 'تاريخ الاجتماع الاستكشافي', icon: 'date' },
      { label: 'ملخص الاحتياج الأولي PDF', icon: 'pdf' },
    ],
    duringCountBadge: '4 حقول إلزامية',
    tableAfterChips: ['إشعار بريد', 'مهمة اتصال'],
    afterDetailRows: [
      { label: 'إرسال بريد ترحيبي وجدول أعمال الاجتماع الفني', tag: 'قالب معتمد' },
      { label: 'إنشاء مهمة اتصال لمهندس الحلول (Pre-Sales)', tag: 'قسم المبيعات' },
      { label: 'تحديث حالة العميل المحتمل في سجل النشاط', tag: 'CRM Sync' },
    ],
    afterCountBadge: '2 مهام تلقائية',
    slaDurationLabel: '24 ساعة',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: false,
    discountLimitPercent: 10,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_902',
    code: 'TR-902',
    shortTitle: 'تقديم العرض الفني التجريبي',
    englishName: 'Technical Demo',
    pillLabel: 'انتقال: «إصدار العرض المالي المعتمد»',
    fromStageId: 'stg_2',
    fromStageNumber: 2,
    fromStageName: 'تحليل الاحتياج',
    toStageId: 'stg_3',
    toStageBadge: '3. تقديم العرض المالي',
    toStageName: 'تقديم العرض المالي',
    badgeTag: 'موافقة مالية',
    tone: 'normal',
    iconType: 'monitor',
    roles: ['مهندس حلول SE', 'مدير الحساب KAM'],
    tableRoleChips: ['مهندس حلول SE', 'مدير الحساب KAM'],
    beforeSummaryChip: 'اعتماد نطاق العمل SOW',
    beforeSummaryTone: 'emerald',
    beforeCriteriaList: [
      'اعتماد وثيقة نطاق العمل الفني (SOW) من مهندس الحلول',
      'إتمام جلسة العرض التوضيحي (Demo) بحضور ممثل العميل التقني',
    ],
    rolesSummaryText: 'مهندسي الحلول (SE) ومدراء حسابات كبار العملاء (KAM)',
    tableDuringChips: ['مستند المتطلبات PDF', 'درجة جاهزية الربط'],
    duringGridCards: [
      { label: 'مستند المتطلبات الفنية PDF', icon: 'pdf' },
      { label: 'درجة جاهزية الربط التقني API', icon: 'po' },
      { label: 'جدول التوريد والترخيص المقترح', icon: 'payment' },
      { label: 'تاريخ تسليم العرض المالي', icon: 'date' },
    ],
    duringCountBadge: '4 حقول إلزامية',
    tableAfterChips: ['تنبيه مدير المبيعات', 'فتح مسودة عرض'],
    afterDetailRows: [
      { label: 'إشعار مدير المبيعات لاعتماد تسعير البنود', tag: 'قالب معتمد' },
      { label: 'إنشاء مسودة عرض سعر آلياً في وحدة Quotes', tag: 'REST API' },
      { label: 'تعيين مهمة متابعة العرض المالي خلال 48 ساعة', tag: 'قسم المبيعات' },
    ],
    afterCountBadge: '2 مهام ويب هوك',
    slaDurationLabel: '3 أيام عمل',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: false,
    discountLimitPercent: 15,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_903',
    code: 'TR-903',
    shortTitle: 'إصدار العرض المالي المعتمد',
    englishName: 'Approved Quote Issued',
    pillLabel: 'انتقال: «بدء التفاوض والمراجعة القانونية»',
    fromStageId: 'stg_3',
    fromStageNumber: 3,
    fromStageName: 'تقديم العرض المالي',
    toStageId: 'stg_4',
    toStageBadge: '4. التفاوض ومراجعة العقود',
    toStageName: 'التفاوض والعقود',
    tone: 'normal',
    iconType: 'doc',
    roles: ['مسؤول كبار العملاء KAM', 'مدير المبيعات الإقليمي'],
    tableRoleChips: ['مسؤول كبار العملاء KAM'],
    beforeSummaryChip: 'موافقة المدير المالي > 100k',
    beforeSummaryTone: 'emerald',
    beforeCriteriaList: [
      'موافقة المدير المالي على الصفقات التي تتجاوز قيمتها 100,000 ر.س',
      'مطابقة نسبة الخصم الممنوحة مع سقف صلاحيات المندوب (<= 15%)',
    ],
    rolesSummaryText: 'مسؤولي حسابات كبار العملاء (KAM) والمدير المالي',
    tableDuringChips: ['إجمالي القيمة التعاقدية', 'نسبة الخصم', 'شروط السداد'],
    duringGridCards: [
      { label: 'نسخة العرض المالي المعتمدة PDF', icon: 'pdf' },
      { label: 'إجمالي القيمة التعاقدية ونسبة الخصم', icon: 'po' },
      { label: 'شروط السداد والدفعات المرحلية', icon: 'payment' },
      { label: 'تاريخ انتهاء صلاحية العرض', icon: 'date' },
    ],
    duringCountBadge: '5 حقول إلزامية',
    tableAfterChips: ['توليد رابط العرض', 'تتبع فتح العميل'],
    afterDetailRows: [
      { label: 'توليد رابط عرض سعر تفاعلي وإرساله للعميل', tag: 'REST API' },
      { label: 'تفعيل تتبع فتح العميل للعرض وإشعار واتساب لحظي', tag: 'قالب معتمد' },
      { label: 'جدولة تذكير متابعة التفاوض بعد 3 أيام عمل', tag: 'قسم المبيعات' },
    ],
    afterCountBadge: '3 مهام ويب هوك',
    slaDurationLabel: '5 أيام',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: true,
    discountLimitPercent: 15,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_903_legal',
    code: 'TR-903B',
    shortTitle: 'بدء المراجعة القانونية',
    englishName: 'Legal Contract Review',
    pillLabel: 'انتقال: «بدء المراجعة القانونية»',
    fromStageId: 'stg_4',
    fromStageNumber: 4,
    fromStageName: 'التفاوض ومراجعة العقود',
    toStageId: 'stg_4',
    toStageBadge: '4. التفاوض ومراجعة العقود',
    toStageName: 'التفاوض ومراجعة العقود',
    tone: 'normal',
    iconType: 'scale',
    roles: ['المستشار القانوني', 'مدير المبيعات الإقليمي'],
    tableRoleChips: ['المستشار القانوني'],
    beforeSummaryChip: 'طلب تعديل البنود',
    beforeSummaryTone: 'emerald',
    beforeCriteriaList: [
      'وجود طلب رسمي من العميل لتعديل بنود الاتفاقية القانونية',
      'إرفاق مسودة العقد الأولية وملاحظات إدارة المشتريات لدى العميل',
    ],
    rolesSummaryText: 'المستشار القانوني وفريق الشؤون القانونية والعقود',
    tableDuringChips: ['مسودة العقد المحررة', 'ملاحظات الشؤون القانونية'],
    duringGridCards: [
      { label: 'مسودة العقد المحررة (Redline PDF)', icon: 'pdf' },
      { label: 'ملاحظات الشؤون القانونية والبنود المعدلة', icon: 'po' },
      { label: 'اعتماد شروط الضمان والالتزامات', icon: 'payment' },
      { label: 'تاريخ اكتمال المراجعة القانونية', icon: 'date' },
    ],
    duringCountBadge: '4 حقول إلزامية',
    tableAfterChips: ['قفل تعديل الأسعار'],
    afterDetailRows: [
      { label: 'قفل تعديل أسعار البنود والخصومات أثناء المراجعة القانونية', tag: 'حماية النظام' },
      { label: 'إشعار فريق المبيعات فور اعتماد الصيغة القانونية النهائية', tag: 'قالب معتمد' },
    ],
    afterCountBadge: '2 مهام نظامية',
    slaDurationLabel: '4 أيام',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: true,
    discountLimitPercent: 15,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_904',
    code: 'TR-904',
    shortTitle: 'إتمام التعاقد والفوز',
    englishName: 'Close Won',
    pillLabel: 'إتمام التعاقد والفوز (Close Won)',
    fromStageId: 'stg_4',
    fromStageNumber: 5,
    fromStageName: 'إتمام التعاقد والفوز',
    toStageId: 'stg_5',
    toStageBadge: '5. إتمام التعاقد والفوز',
    toStageName: 'إغلاق فوز ✓',
    tone: 'won',
    iconType: 'won',
    roles: [
      'مدير المبيعات الإقليمي',
      'مسؤول حساب كبار العملاء (Senior KAM)',
    ],
    tableRoleChips: ['مدير المبيعات الإقليمي', 'مسؤول كبار العملاء KAM'],
    beforeSummaryChip: 'موافقة العميل الرسمية + تفويض',
    beforeSummaryTone: 'emerald',
    beforeCriteriaList: [
      'اكتمال توقيع مذكرة التفاهم الأولية أو خطاب النوايا LOI',
      'تخطي فحص السجل الائتماني والموافقة القانونية الرسمية',
    ],
    rolesSummaryText: 'مدراء المبيعات الإقليميين وكبار مسؤولي KAM',
    tableDuringChips: ['العقد الموقع PDF', 'طريقة الدفع', 'رقم PO', 'نفاذ/DocuSign'],
    duringGridCards: [
      { label: 'العقد النهائي PDF', icon: 'pdf' },
      { label: 'رقم أمر الشراء PO', icon: 'po' },
      { label: 'طريقة الدفع والجدول', icon: 'payment' },
      { label: 'تاريخ بدء التشغيل', icon: 'date' },
    ],
    duringCountBadge: '6 حقول إلزامية',
    tableAfterChips: ['واتساب تنفيذي', 'فاتورة ERP', 'مشروع تسليم'],
    afterDetailRows: [
      { label: 'مزامنة الفاتورة مع نظام ERP (SAP)', tag: 'REST API' },
      { label: 'إشعار WhatsApp تنفيذي للعميل وفريق العمليات', tag: 'قالب معتمد' },
      { label: 'إنشاء مشروع تدشين Onboarding تلقائي', tag: 'قسم المشاريع' },
    ],
    afterCountBadge: '4 مهام ويب هوك',
    slaDurationLabel: 'بدون قيود زمنية',
    slaStatusLabel: 'سليم ومحصّن',
    enabled: true,
    requireDigitalSignature: true,
    discountLimitPercent: 15,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_905',
    code: 'TR-905',
    shortTitle: 'تعثر الصفقة وخسارة',
    englishName: 'Mark as Lost',
    pillLabel: 'تعثر الصفقة وخسارة (Mark as Lost)',
    fromStageId: 'stg_4',
    fromStageNumber: 4,
    fromStageName: 'التفاوض ومراجعة العقود',
    toStageId: 'stg_6',
    toStageBadge: '6. إغلاق خسارة',
    toStageName: 'إغلاق خسارة ✕',
    badgeTag: 'سبب إلزامي',
    tone: 'lost',
    iconType: 'lost',
    roles: ['مدير المبيعات الإقليمي', 'مسؤول حساب كبار العملاء (Senior KAM)'],
    tableRoleChips: ['مدير المبيعات الإقليمي'],
    beforeSummaryChip: 'رفض العرض المالي مرتين',
    beforeSummaryTone: 'slate',
    beforeCriteriaList: [
      'تسجيل محاولتي تفاوض رسميتين على الأقل قبل إغلاق الصفقة كخسارة',
      'مراجعة مدير المبيعات الإقليمي لأسباب الاعتراض السعري أو الفني',
    ],
    rolesSummaryText: 'مدراء المبيعات الإقليميين فقط',
    tableDuringChips: ['سبب الخسارة الرئيسي', 'المنافس الفائز'],
    duringGridCards: [
      { label: 'سبب الخسارة الرئيسي الموثق', icon: 'po' },
      { label: 'اسم المنافس الفائز بالصفقة', icon: 'payment' },
      { label: 'تاريخ قرار الإلغاء / الخسارة', icon: 'date' },
      { label: 'تقرير الدروس المستفادة PDF', icon: 'pdf' },
    ],
    duringCountBadge: '3 حقول إلزامية',
    tableAfterChips: ['أرشفة السجل', 'إشعار الإدارة'],
    afterDetailRows: [
      { label: 'أرشفة السجل وإلغاء مسودات عروض الأسعار المفتوحة', tag: 'CRM Sync' },
      { label: 'إشعار إدارة المبيعات وتحديث تقرير تحليل المنافسين', tag: 'قالب معتمد' },
      { label: 'جدولة مهمة إعادة تواصل بعد 6 أشهر (Win-Back)', tag: 'قسم المبيعات' },
    ],
    afterCountBadge: '2 مهام نظامية',
    slaDurationLabel: 'بدون مهلة',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: false,
    discountLimitPercent: 0,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
  {
    id: 'tr_906',
    code: 'TR-906',
    shortTitle: 'إعادة تقييم وتعديل التسعير',
    englishName: 'Re-evaluate Pricing',
    pillLabel: 'انتقال: «إعادة تقييم وتعديل التسعير»',
    fromStageId: 'stg_4',
    fromStageNumber: 4,
    fromStageName: 'التفاوض ومراجعة العقود',
    toStageId: 'stg_3',
    toStageBadge: '3. تقديم العرض المالي',
    toStageName: 'تقديم العرض المالي',
    tone: 'loop',
    iconType: 'loop',
    roles: ['مدير المبيعات'],
    tableRoleChips: ['مدير المبيعات'],
    beforeSummaryChip: 'طلب تخفيض مالي إضافي',
    beforeSummaryTone: 'slate',
    beforeCriteriaList: [
      'تقديم العميل طلب تخفيض مالي إضافي يتطلب تعديل بنود العرض',
      'موافقة مدير المبيعات على إعادة فتح التسعير ومراجعة الهامش الربحي',
    ],
    rolesSummaryText: 'مدراء المبيعات ومسؤولي التسعير',
    tableDuringChips: ['مبرر تعديل الهامش الربحي'],
    duringGridCards: [
      { label: 'مبرر تعديل الهامش الربحي', icon: 'po' },
      { label: 'نسبة الخصم الإضافية المطلوبة', icon: 'payment' },
      { label: 'مسودة العرض المالي المعدل PDF', icon: 'pdf' },
      { label: 'تاريخ إعادة التقديم للعميل', icon: 'date' },
    ],
    duringCountBadge: '2 حقول إلزامية',
    tableAfterChips: ['إلغاء مسودة العقد 1'],
    afterDetailRows: [
      { label: 'إلغاء مسودة العقد السابقة (الإصدار 1) وفتح مراجعة تسعير جديدة', tag: 'حماية النظام' },
      { label: 'إشعار الفريق المالي بطلب مراجعة الهامش الربحي', tag: 'قالب معتمد' },
    ],
    afterCountBadge: '1 مهمة نظامية',
    slaDurationLabel: '48 ساعة',
    slaStatusLabel: 'سليم',
    enabled: true,
    requireDigitalSignature: false,
    discountLimitPercent: 20,
    beforeConditions: createDefaultBeforeConditions(),
    duringFields: createDefaultDuringFields(),
    afterActions: createDefaultAfterActions(),
  },
];

const AVAILABLE_ROLES = [
  'مدير المبيعات الإقليمي',
  'مسؤول حساب كبار العملاء (Senior KAM)',
  'مدير المبيعات التنفيذي',
  'مشرف العقود والمالية',
  'مهندس حلول ما قبل البيع',
  'المستشار القانوني',
];

export const BlueprintBuilderPage: React.FC = () => {
  const { firebaseUser, blueprints, roles } = useCrm();

  const activeBlueprintDoc = useMemo(
    () =>
      blueprints.find(
        (b) => b.module === 'الصفقات والمبيعات' || b.name.includes('صفقات')
      ) ?? blueprints[0],
    [blueprints]
  );

  const [targetModule, setTargetModule] = useState<'الصفقات والمبيعات' | 'العملاء المحتملين'>(
    'الصفقات والمبيعات'
  );
  const [blueprintActive, setBlueprintActive] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [stageSearch, setStageSearch] = useState('');

  // Table View Filters & Banner State
  const [tableSearch, setTableSearch] = useState('');
  const [tableStageFilter, setTableStageFilter] = useState<string>('all');
  const [tablePathTypeFilter, setTablePathTypeFilter] = useState<string>('all');
  const [showSaveBanner, setShowSaveBanner] = useState<boolean>(true);
  const [sellerPreviewOpen, setSellerPreviewOpen] = useState<boolean>(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  const [stages, setStages] = useState<BlueprintStageNode[]>(INITIAL_STAGES);
  const [selectedStageId, setSelectedStageId] = useState<string>('stg_4');
  const [transitions, setTransitions] =
    useState<BlueprintTransitionConfig[]>(INITIAL_TRANSITIONS);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string>('tr_904');
  const [inspectorTab, setInspectorTab] = useState<'before' | 'during' | 'after'>('during');

  // Modals / Inline creators
  const [addingStageModal, setAddingStageModal] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageSla, setNewStageSla] = useState('SLA: 3 أيام');

  const [addingTransitionModal, setAddingTransitionModal] = useState(false);
  const [newTrTitle, setNewTrTitle] = useState('');
  const [newTrToStage, setNewTrToStage] = useState('5. إتمام التعاقد والفوز');

  const [addingFieldInline, setAddingFieldInline] = useState(false);
  const [newFieldTitle, setNewFieldTitle] = useState('');
  const [newFieldSubtitle, setNewFieldSubtitle] = useState('');

  const [addingRoleMenu, setAddingRoleMenu] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [simRoleMode, setSimRoleMode] = useState<'authorized' | 'unauthorized'>('authorized');
  const [simDealIndex, setSimDealIndex] = useState(0);
  const [simPdfVerified, setSimPdfVerified] = useState(true);
  const [simPoNumber, setSimPoNumber] = useState('PO-99482-KSA');
  const [simPaymentTerms, setSimPaymentTerms] = useState(
    'دفعة مقدمة 50% / نقدي بشيك مصدق'
  );
  const [simServiceDate, setSimServiceDate] = useState('01/07/2025');
  const [simDigitalSignVerified, setSimDigitalSignVerified] = useState(true);
  const [simNotes, setSimNotes] = useState(
    'تم اعتماد خصم 12% بموافقة الإدارة الإقليمية لتسريع التوقيع قبل نهاية الربع الثاني، وحجز رخص الاستضافة السنوية.'
  );
  const [simDryRunResult, setSimDryRunResult] = useState<'idle' | 'passed' | 'blocked'>('idle');
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // Transition Rules Editor Modal ("تعديل قواعد الانتقال")
  const [transitionEditorOpen, setTransitionEditorOpen] = useState(false);
  const [editorActiveTab, setEditorActiveTab] = useState<'a' | 'b' | 'c' | 'd'>('b');
  const [editorButtonLabel, setEditorButtonLabel] = useState(
    'إتمام التعاقد والفوز (Close Won)'
  );
  const [editorButtonStyle, setEditorButtonStyle] = useState<
    'emerald' | 'blue' | 'rose'
  >('emerald');
  const [editorRoleDropdownOpen, setEditorRoleDropdownOpen] = useState(false);
  const [editorCriteriaRows, setEditorCriteriaRows] = useState<
    {
      id: string;
      logic: 'AND' | 'OR';
      field: string;
      operator: string;
      value: string;
    }[]
  >([
    {
      id: 'crit_1',
      logic: 'AND',
      field: 'Deal.LOI_Status (مذكرة التفاهم / خطاب النوايا)',
      operator: '== (يساوي)',
      value: 'موقع ومعتمد رسمياً',
    },
    {
      id: 'crit_2',
      logic: 'AND',
      field: 'Account.Credit_Score (فحص السجل الائتماني)',
      operator: '== (يساوي)',
      value: 'مجتاز وموافق عليه قانونياً',
    },
  ]);
  const [editorPoRegex, setEditorPoRegex] = useState('PO-#####');
  const [editorNewFieldOpen, setEditorNewFieldOpen] = useState(false);
  const [editorNewFieldName, setEditorNewFieldName] = useState('');
  const [editorNewFieldType, setEditorNewFieldType] = useState('نص إلزامي');
  const [editorAfterToggles, setEditorAfterToggles] = useState({
    notifications: true,
    onboardingTask: true,
    metaCapiPurchase: true,
    salesOrderGeneration: true,
  });

  const sectionARef = useRef<HTMLDivElement>(null);
  const sectionBRef = useRef<HTMLDivElement>(null);
  const sectionCRef = useRef<HTMLDivElement>(null);
  const sectionDRef = useRef<HTMLDivElement>(null);

  const [savingToFirestore, setSavingToFirestore] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState('منذ يومين بواسطة طارق العتيبي');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeBlueprintDoc) {
      setBlueprintActive(activeBlueprintDoc.active);
    }
  }, [activeBlueprintDoc?.id]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const selectedTransition = useMemo(
    () =>
      transitions.find((t) => t.id === selectedTransitionId) ??
      transitions.find((t) => t.id === 'tr_904') ??
      transitions[0],
    [selectedTransitionId, transitions]
  );

  const filteredStages = useMemo(() => {
    const q = stageSearch.trim().toLowerCase();
    if (!q) return stages;
    return stages.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.englishSubtitle.toLowerCase().includes(q)
    );
  }, [stageSearch, stages]);

  const filteredTableTransitions = useMemo(() => {
    return transitions.filter((tr) => {
      if (tableStageFilter !== 'all' && tr.fromStageId !== tableStageFilter) {
        return false;
      }
      if (tablePathTypeFilter !== 'all') {
        if (tablePathTypeFilter === 'won' && tr.tone !== 'won') return false;
        if (tablePathTypeFilter === 'lost' && tr.tone !== 'lost') return false;
        if (tablePathTypeFilter === 'progress' && tr.tone !== 'normal' && tr.tone !== 'loop')
          return false;
      }
      const q = tableSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        tr.shortTitle.toLowerCase().includes(q) ||
        tr.englishName.toLowerCase().includes(q) ||
        tr.fromStageName.toLowerCase().includes(q) ||
        tr.toStageBadge.toLowerCase().includes(q) ||
        tr.beforeSummaryChip.toLowerCase().includes(q) ||
        tr.tableRoleChips.some((r) => r.toLowerCase().includes(q)) ||
        tr.tableDuringChips.some((d) => d.toLowerCase().includes(q)) ||
        tr.tableAfterChips.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [transitions, tableStageFilter, tablePathTypeFilter, tableSearch]);

  const totalMandatoryFieldsCount = useMemo(() => {
    const enabledInSelected = selectedTransition.duringFields.filter((f) => f.enabled).length;
    return Math.max(1, 9 + enabledInSelected);
  }, [selectedTransition]);

  const rolePool = useMemo(() => {
    const fromCrm = roles.map((r) => r.name);
    return Array.from(new Set([...AVAILABLE_ROLES, ...fromCrm]));
  }, [roles]);

  // Persist Blueprint configuration to Firestore `blueprints` collection
  const persistBlueprintToFirestore = async (
    overrideActive?: boolean,
    overrideStagesCount?: number,
    customToast?: string
  ) => {
    setSavingToFirestore(true);
    const nextActive = overrideActive ?? blueprintActive;
    const nextStagesCount = Math.min(30, Math.max(1, overrideStagesCount ?? stages.length));
    const bpName =
      targetModule === 'الصفقات والمبيعات'
        ? 'مسار مبيعات كبار العملاء (Enterprise Deals Blueprint)'
        : 'مسار تأهيل العملاء المحتملين (Enterprise Leads Blueprint)';

    const enabledDuringNames = selectedTransition.duringFields
      .filter((f) => f.enabled)
      .map((f) => f.title)
      .join('، ');

    const descriptionSummary = `انتقال [${selectedTransition.code}]: ${selectedTransition.shortTitle} | الحقول الإلزامية: ${enabledDuringNames}`.slice(
      0,
      290
    );

    try {
      if (firebaseUser) {
        if (activeBlueprintDoc) {
          try {
            await updateDoc(doc(db, 'blueprints', activeBlueprintDoc.id), {
              name: bpName.slice(0, 120),
              active: nextActive,
              stagesCount: nextStagesCount,
              description: descriptionSummary,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `blueprints/${activeBlueprintDoc.id}`
            );
          }
        } else {
          const newDocId = `bp_${Date.now()}`;
          try {
            await setDoc(doc(db, 'blueprints', newDocId), {
              ownerId: firebaseUser.uid,
              name: bpName.slice(0, 120),
              module: targetModule.slice(0, 60),
              active: nextActive,
              stagesCount: nextStagesCount,
              description: descriptionSummary,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `blueprints/${newDocId}`);
          }
        }
      }
      setLastSavedLabel('الآن بواسطة طارق العتيبي');
      setShowSaveBanner(true);
      setToastMsg(
        customToast ||
          `تم حفظ وتطبيق قواعد الانتقال [${selectedTransition.shortTitle} (${selectedTransition.englishName})] في Firestore بنجاح`
      );
    } finally {
      setSavingToFirestore(false);
    }
  };

  const handleToggleBlueprintActive = async () => {
    const next = !blueprintActive;
    setBlueprintActive(next);
    await persistBlueprintToFirestore(
      next,
      stages.length,
      next
        ? 'تم تفعيل البلوبرينت ليعمل تلقائياً على الصفقات'
        : 'تم تحويل البلوبرينت إلى وضع المسودة (Draft)'
    );
  };

  const handleToggleTransitionRowEnabled = async (trId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = transitions.find((t) => t.id === trId);
    if (!target) return;
    const nextEnabled = !target.enabled;
    setTransitions((prev) =>
      prev.map((t) => (t.id === trId ? { ...t, enabled: nextEnabled } : t))
    );
    await persistBlueprintToFirestore(
      blueprintActive,
      stages.length,
      nextEnabled
        ? `تم تفعيل انتقال «${target.shortTitle}» في مسار البلوبرينت`
        : `تم إيقاف انتقال «${target.shortTitle}» مؤقتاً`
    );
  };

  const updateSelectedTransition = (
    updater: (prev: BlueprintTransitionConfig) => BlueprintTransitionConfig
  ) => {
    setTransitions((prev) =>
      prev.map((tr) => (tr.id === selectedTransition.id ? updater(tr) : tr))
    );
  };

  const handleToggleDuringField = (fieldId: string) => {
    updateSelectedTransition((tr) => ({
      ...tr,
      duringFields: tr.duringFields.map((f) =>
        f.id === fieldId ? { ...f, enabled: !f.enabled } : f
      ),
    }));
  };

  const handleToggleAfterAction = (actionId: string) => {
    updateSelectedTransition((tr) => ({
      ...tr,
      afterActions: tr.afterActions.map((a) =>
        a.id === actionId ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  };

  const handleToggleBeforeCondition = (condId: string) => {
    updateSelectedTransition((tr) => ({
      ...tr,
      beforeConditions: tr.beforeConditions.map((c) =>
        c.id === condId ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const handleRemoveRole = (roleToRemove: string) => {
    updateSelectedTransition((tr) => ({
      ...tr,
      roles: tr.roles.filter((r) => r !== roleToRemove),
    }));
  };

  const handleAddRole = (roleToAdd: string) => {
    updateSelectedTransition((tr) => ({
      ...tr,
      roles: Array.from(new Set([...tr.roles, roleToAdd])),
    }));
    setAddingRoleMenu(false);
  };

  const handleAddCustomFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldTitle.trim()) return;
    const newField: BlueprintFieldRequirement = {
      id: `fld_custom_${Date.now()}`,
      title: newFieldTitle.trim(),
      subtitle: newFieldSubtitle.trim() || 'حقل تحقق إضافي ضمن نافذة الانتقال',
      badgeText: 'حقل إلزامي',
      badgeTone: 'info',
      enabled: true,
    };
    updateSelectedTransition((tr) => ({
      ...tr,
      duringFields: [...tr.duringFields, newField],
      tableDuringChips: [...tr.tableDuringChips, newField.title],
    }));
    setNewFieldTitle('');
    setNewFieldSubtitle('');
    setAddingFieldInline(false);
    setToastMsg('تمت إضافة الحقل الإلزامي إلى نافذة الإتمام');
  };

  const handleCreateCustomStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageTitle.trim()) return;
    const nextIdx = stages.length + 1;
    const newStage: BlueprintStageNode = {
      id: `stg_${Date.now()}`,
      numberLabel: String(nextIdx).padStart(2, '0'),
      stepIndex: nextIdx,
      title: `${nextIdx}. ${newStageTitle.trim()}`,
      englishSubtitle: `Custom Stage · 0 صفقات`,
      canvasSubtitle: 'مرحلة مخصصة مضافة ضمن مسار المؤسسات',
      dealsCountLabel: '0 صفقات',
      slaBadge: newStageSla.trim() || 'SLA: 3 أيام',
      category: 'normal',
    };
    const nextStages = [...stages, newStage];
    setStages(nextStages);
    setNewStageTitle('');
    setAddingStageModal(false);
    await persistBlueprintToFirestore(
      blueprintActive,
      nextStages.length,
      `تم إنشاء المرحلة الجديدة "${newStage.title}" وتحديث البلوبرينت`
    );
  };

  const handleCreateCustomTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrTitle.trim()) return;
    const code = `TR-90${transitions.length + 1}`;
    const newTr: BlueprintTransitionConfig = {
      id: `tr_${Date.now()}`,
      code,
      shortTitle: newTrTitle.trim(),
      englishName: 'Custom Transition',
      pillLabel: `انتقال: «${newTrTitle.trim()}»`,
      fromStageId: 'stg_4',
      fromStageNumber: 4,
      fromStageName: 'التفاوض ومراجعة العقود',
      toStageId: 'stg_5',
      toStageBadge: newTrToStage,
      toStageName: newTrToStage,
      tone: 'normal',
      iconType: 'arrow',
      roles: ['مدير المبيعات الإقليمي'],
      tableRoleChips: ['مدير المبيعات الإقليمي'],
      beforeSummaryChip: 'موافقة مدير المبيعات',
      beforeSummaryTone: 'emerald',
      beforeCriteriaList: [
        'استيفاء متطلبات المرحلة الحالية والتأكد من اكتمال بيانات العميل',
        'موافقة مدير المبيعات المباشر على الانتقال',
      ],
      rolesSummaryText: 'مدراء المبيعات الإقليميين',
      tableDuringChips: ['ملاحظات الانتقال', 'مستند داعم PDF'],
      duringGridCards: [
        { label: 'المستند الداعم PDF', icon: 'pdf' },
        { label: 'ملاحظات الاعتماد', icon: 'po' },
        { label: 'شروط الدفع المحدثة', icon: 'payment' },
        { label: 'تاريخ التنفيذ الفعلي', icon: 'date' },
      ],
      duringCountBadge: '4 حقول إلزامية',
      tableAfterChips: ['إشعار فريق المبيعات', 'تحديث السجل'],
      afterDetailRows: [
        { label: 'إرسال إشعار فوري لفريق المبيعات عبر واتساب', tag: 'قالب معتمد' },
        { label: 'تحديث سجل النشاط والتاريخ الزمني للصفقة', tag: 'CRM Sync' },
      ],
      afterCountBadge: '2 مهام ويب هوك',
      slaDurationLabel: '48 ساعة',
      slaStatusLabel: 'سليم',
      enabled: true,
      requireDigitalSignature: true,
      discountLimitPercent: 15,
      beforeConditions: createDefaultBeforeConditions(),
      duringFields: createDefaultDuringFields(),
      afterActions: createDefaultAfterActions(),
    };
    setTransitions((prev) => [...prev, newTr]);
    setSelectedTransitionId(newTr.id);
    setNewTrTitle('');
    setAddingTransitionModal(false);
    await persistBlueprintToFirestore(
      blueprintActive,
      stages.length,
      `تمت إضافة الانتقال الجديد (${code}: ${newTr.shortTitle}) وحفظه في Firestore`
    );
  };

  const handleResetInspectorDefaults = () => {
    setTransitions(INITIAL_TRANSITIONS);
    setSelectedTransitionId('tr_904');
    setToastMsg('تمت استعادة الإعدادات الافتراضية للانتقال');
  };

  const handleExportMatrix = () => {
    setToastMsg('تم تصدير مصفوفة انتقالات البلوبرينت (BP-CORP-9402) بنجاح');
  };

  const SIM_SAMPLE_DEALS = [
    {
      title: 'باقة الحلول المؤسسية ERP — شركة أرامكس اللوجستية',
      amountLabel: '350,000 ر.س',
      pdfName: 'Contract_Final_Signed_Aramex.pdf (2.4 MB)',
      po: 'PO-99482-KSA',
    },
    {
      title: 'منظومة الربط السحابي والأمان — بنك الاستثمار العربي',
      amountLabel: '480,000 ر.س',
      pdfName: 'Contract_Final_Signed_AIB.pdf (3.1 MB)',
      po: 'PO-77310-FIN',
    },
    {
      title: 'تراخيص التحول الرقمي — مجموعة الخزامى القابضة',
      amountLabel: '220,000 ر.س',
      pdfName: 'Contract_Final_Signed_Khuzama.pdf (1.9 MB)',
      po: 'PO-55104-RYD',
    },
  ];

  const currentSimDeal = SIM_SAMPLE_DEALS[simDealIndex % SIM_SAMPLE_DEALS.length];

  const completedSimFieldsCount = useMemo(() => {
    let count = 0;
    if (simPdfVerified) count += 1;
    if (simPoNumber.trim().length > 0) count += 1;
    if (simPaymentTerms.trim().length > 0) count += 1;
    if (simServiceDate.trim().length > 0) count += 1;
    if (simDigitalSignVerified) count += 1;
    if (simNotes.trim().length > 0) count += 1;
    return count;
  }, [
    simPdfVerified,
    simPoNumber,
    simPaymentTerms,
    simServiceDate,
    simDigitalSignVerified,
    simNotes,
  ]);

  const isSimReadyToPass =
    simRoleMode === 'authorized' && completedSimFieldsCount === 6;

  const handleResetSimulation = () => {
    setSimRoleMode('authorized');
    setSimDealIndex(0);
    setSimPdfVerified(true);
    setSimPoNumber('PO-99482-KSA');
    setSimPaymentTerms('دفعة مقدمة 50% / نقدي بشيك مصدق');
    setSimServiceDate('01/07/2025');
    setSimDigitalSignVerified(true);
    setSimNotes(
      'تم اعتماد خصم 12% بموافقة الإدارة الإقليمية لتسريع التوقيع قبل نهاية الربع الثاني، وحجز رخص الاستضافة السنوية.'
    );
    setSimDryRunResult('idle');
    setToastMsg('تمت إعادة ضبط بيئة المحاكاة إلى القيم الافتراضية');
  };

  const handleCycleSimDeal = () => {
    const nextIdx = (simDealIndex + 1) % SIM_SAMPLE_DEALS.length;
    const nextDeal = SIM_SAMPLE_DEALS[nextIdx];
    setSimDealIndex(nextIdx);
    setSimPoNumber(nextDeal.po);
    setSimPdfVerified(true);
    setSimDryRunResult('idle');
    setToastMsg(`تم تحميل صفقة الاختبار: ${nextDeal.title}`);
  };

  const handleExecuteDryRun = () => {
    if (simRoleMode === 'unauthorized') {
      setSimDryRunResult('blocked');
      setToastMsg(
        'فشل الانتقال التجريبي (Dry Run): الدور الوظيفي «مندوب مبيعات مبتدئ» غير مصرح له بتنفيذ هذا الانتقال'
      );
      return;
    }
    if (completedSimFieldsCount < 6) {
      setSimDryRunResult('blocked');
      setToastMsg(
        `فشل الانتقال التجريبي: يرجى استكمال كافة الحقول الإلزامية (${completedSimFieldsCount} من 6 مكتملة)`
      );
      return;
    }
    setSimDryRunResult('passed');
    setToastMsg(
      `✓ نجح تنفيذ الانتقال التجريبي (Dry Run) لصفقة «${currentSimDeal.title}» دون تعديل بيانات الإنتاج في Firestore`
    );
  };

  const handleOpenTransitionEditor = (tr?: BlueprintTransitionConfig) => {
    const target = tr ?? selectedTransition;
    setSelectedTransitionId(target.id);
    setEditorButtonLabel(`${target.shortTitle} (${target.englishName})`);
    setEditorButtonStyle(
      target.tone === 'won'
        ? 'emerald'
        : target.tone === 'lost'
        ? 'rose'
        : 'blue'
    );
    setEditorActiveTab('b');
    setTransitionEditorOpen(true);
  };

  const handleAddEditorCriterionRow = () => {
    setEditorCriteriaRows((prev) => [
      ...prev,
      {
        id: `crit_${Date.now()}`,
        logic: 'AND',
        field: 'Deal.Discount_Percentage (نسبة الخصم)',
        operator: '<= (أقل أو يساوي)',
        value: '15%',
      },
    ]);
  };

  const handleRemoveEditorCriterionRow = (id: string) => {
    setEditorCriteriaRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleMoveDuringField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    updateSelectedTransition((tr) => {
      if (targetIndex < 0 || targetIndex >= tr.duringFields.length) return tr;
      const next = [...tr.duringFields];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return { ...tr, duringFields: next };
    });
  };

  const handleAddEditorRequiredField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorNewFieldName.trim()) return;
    const added: BlueprintFieldRequirement = {
      id: `fld_ed_${Date.now()}`,
      title: editorNewFieldName.trim(),
      subtitle: 'حقل إلزامي مضاف ضمن محرر قواعد الانتقال',
      badgeText: editorNewFieldType,
      badgeTone: editorNewFieldType.includes('مرفق') ? 'danger' : 'info',
      enabled: true,
    };
    updateSelectedTransition((tr) => ({
      ...tr,
      duringFields: [...tr.duringFields, added],
      tableDuringChips: [...tr.tableDuringChips, added.title],
    }));
    setEditorNewFieldName('');
    setEditorNewFieldOpen(false);
    setToastMsg(`تمت إضافة الحقل الإلزامي «${added.title}» إلى قواعد الانتقال`);
  };

  const handleSaveTransitionEditorRules = async () => {
    const cleanLabel = editorButtonLabel.split('(')[0].trim() || selectedTransition.shortTitle;
    updateSelectedTransition((tr) => ({
      ...tr,
      shortTitle: cleanLabel,
      beforeCriteriaList: editorCriteriaRows.map(
        (r) => `${r.field} ${r.operator} ${r.value}`
      ),
    }));
    await persistBlueprintToFirestore(
      blueprintActive,
      stages.length,
      `تم حفظ وتطبيق قواعد الانتقال «${cleanLabel}» مباشرةً في Firestore`
    );
    setTransitionEditorOpen(false);
  };

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* 1. TOP FLUSH HEADER */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-3.5 pb-3">
        <div className="w-full space-y-3">
          {/* Row 1: Breadcrumb (Right in RTL) | Cloud Sync & Blueprint ID (Left in RTL) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
              <Settings className="h-3.5 w-3.5 text-[#475569]" />
              <Link to="/settings" className="hover:text-[#2563EB] font-medium">
                الإعدادات والنظام
              </Link>
              <span className="text-[#CBD5E1]">‹</span>
              <span>إدارة العمليات وأتمتة المسارات</span>
              <span className="text-[#CBD5E1]">‹</span>
              <span className="font-bold text-[#0F172A]">
                منشئ البلوبرينت (مسار مبيعات كبار العملاء B2B)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                <span>نشط ويعمل تلقائياً</span>
              </span>
              <span className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2563EB]">
                BP-CORP-9402
              </span>
              <span className="text-[11px] font-mono text-[#64748B]">
                (الإصدار v3.2)
              </span>
            </div>
          </div>

          {/* Row 2: Title + Badges (Right) | View Switcher + Actions (Left) */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Right Side */}
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#0F172A] leading-tight">
                منشئ البلوبرينت: مسار مبيعات كبار العملاء{' '}
                <span className="text-[13px] font-semibold text-[#64748B] font-mono">
                  (Enterprise Deals Blueprint)
                </span>
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                {/* 3 Metric Pills matching screen_12378196.png */}
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-bold text-[#1D4ED8] tabular-nums">
                  <GitBranch className="h-3 w-3 text-[#2563EB]" />
                  <span>{stages.length} مراحل معتمدة</span>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-bold text-[#1D4ED8] tabular-nums">
                  <ArrowLeft className="h-3 w-3 text-[#2563EB]" />
                  <span>9 مسارات تحويل نشطة</span>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669] tabular-nums">
                  <ShieldCheck className="h-3 w-3 text-[#059669]" />
                  <span>{totalMandatoryFieldsCount} حقلاً إلزامياً</span>
                </span>

                {/* Active / Draft Toggle */}
                <button
                  type="button"
                  onClick={() => void handleToggleBlueprintActive()}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                    blueprintActive
                      ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                      : 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[2.5]" />
                  <span>
                    {blueprintActive ? 'تفعيل المسار: نشط' : 'وضع المسودة (غير مفعل)'}
                  </span>
                </button>

                {/* Target Module Switcher Badge */}
                <button
                  type="button"
                  onClick={() =>
                    setTargetModule((prev) =>
                      prev === 'الصفقات والمبيعات'
                        ? 'العملاء المحتملين'
                        : 'الصفقات والمبيعات'
                    )
                  }
                  title="تبديل الموديول المستهدف"
                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                >
                  <span>الموديول: {targetModule}</span>
                </button>
              </div>
            </div>

            {/* Left Side Controls */}
            <div className="flex flex-col items-end gap-2">
              {/* Top Row of Left Actions: View Toggle + Simulation */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('visual')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                      viewMode === 'visual'
                        ? 'bg-[#2563EB] text-[#FFFFFF] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>المخطط المرئي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                      viewMode === 'table'
                        ? 'bg-[#2563EB] text-[#FFFFFF] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    <span>عرض الجدول والقائمة</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSimStepIndex(0);
                    setSimulationOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#0F172A] transition-colors whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 text-[#475569]" />
                  <span>تجربة ومحاكاة</span>
                </button>
              </div>

              {/* Bottom Row of Left Actions: Version History + Save & Publish */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVersionHistoryOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#0F172A] transition-colors whitespace-nowrap"
                >
                  <History className="h-4 w-4 text-[#475569]" />
                  <span>سجل الإصدارات</span>
                </button>

                <button
                  type="button"
                  disabled={savingToFirestore}
                  onClick={() => void persistBlueprintToFirestore()}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {savingToFirestore ? 'جارٍ الحفظ والنشر...' : 'حفظ ونشر التعديلات'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3 (Shown in Visual Mode): Summary Strip + Quick Add Stage / Transition Buttons */}
          {viewMode === 'visual' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-2.5 text-[11px]">
              <div className="flex flex-wrap items-center gap-4 text-[#475569]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  <span>المراحل:</span>
                  <strong className="font-extrabold text-[#2563EB]">
                    {stages.length} حالات معتمدة
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  <span>الانتقالات النشطة:</span>
                  <strong className="font-extrabold text-[#2563EB]">
                    9 مسارات تحويل
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  <span>قواعد التحقق:</span>
                  <strong className="font-extrabold text-[#059669]">
                    {totalMandatoryFieldsCount} حقلاً إجبارياً
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1 text-[#64748B]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>آخر نشر موثق: {lastSavedLabel}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddingStageModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1E40AF] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة حالة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddingTransitionModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF] transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  <span>إضافة انتقال</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =====================================================================
          MODE A: TABLE VIEW ("عرض الجدول والقائمة") — MATCHES screen_12378196.png
         ===================================================================== */}
      {viewMode === 'table' ? (
        <div className="w-full px-6 py-4 space-y-4 flex-1">
          {/* Green Real-time Confirmation Banner */}
          {showSaveBanner && (
            <div className="rounded-xl border border-[#6EE7B7] bg-[#D1FAE5]/85 px-4 py-2.5 flex items-center justify-between gap-3 text-[#065F46] shadow-2xs">
              <div className="flex items-center gap-2.5 text-[12px] font-extrabold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#059669] text-[#FFFFFF] shrink-0">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
                <span>
                  تم حفظ وتطبيق قواعد الانتقال [{selectedTransition.shortTitle} (
                  {selectedTransition.englishName})] بنجاح ✓ —{' '}
                  <span className="font-semibold text-[#047857]">
                    تم تحديث شروط ومسارات البلوبرينت في الوقت الفعلي.
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSaveBanner(false)}
                aria-label="إغلاق شريط التأكيد"
                className="rounded-lg p-1 text-[#047857] hover:bg-[#A7F3D0]/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Filter & Action Bar Above Table */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Right Side Filters */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Filter className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="بحث في المراحل، الانتقالات، الحقول الإلزامية أو الصلاحيات..."
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-9 pl-3 py-2 text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              {/* Stage Filter Dropdown */}
              <div className="relative">
                <select
                  aria-label="تصفية حسب المرحلة"
                  value={tableStageFilter}
                  onChange={(e) => setTableStageFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1] pr-3.5 pl-8 py-2 text-[12px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none cursor-pointer"
                >
                  <option value="all">المرحلة: جميع المراحل ({stages.length})</option>
                  <option value="stg_1">1. عميل محتمل مؤهل</option>
                  <option value="stg_2">2. تحليل الاحتياج</option>
                  <option value="stg_3">3. تقديم العرض المالي</option>
                  <option value="stg_4">4. التفاوض ومراجعة العقود</option>
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Path Type Filter Dropdown */}
              <div className="relative">
                <select
                  aria-label="تصفية حسب نوع المسار"
                  value={tablePathTypeFilter}
                  onChange={(e) => setTablePathTypeFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1] pr-3.5 pl-8 py-2 text-[12px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none cursor-pointer"
                >
                  <option value="all">نوع المسار: الكل (فوز، تقدم، تعثر)</option>
                  <option value="progress">مسار تقدم واعتماد مرحلي</option>
                  <option value="won">مسار الفوز والإغلاق (Close Won)</option>
                  <option value="lost">مسار التعثر والخسارة (Close Lost)</option>
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Left Side Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAddingTransitionModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#93C5FD] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3.5 py-2 text-[12px] font-extrabold text-[#2563EB] transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة انتقال جديد</span>
              </button>

              <button
                type="button"
                onClick={() => setAddingStageModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 py-2 text-[12px] font-extrabold text-[#0F172A] transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4 text-[#059669]" />
                <span>إضافة مرحلة جديدة</span>
              </button>

              <button
                type="button"
                onClick={handleExportMatrix}
                title="تصدير مصفوفة الانتقالات"
                aria-label="تصدير مصفوفة الانتقالات"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 1. TRANSITIONS MATRIX TABLE (9 Columns) */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[1160px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                    <th className="py-3.5 px-3.5 whitespace-nowrap">المرحلة الحالية</th>
                    <th className="py-3.5 px-3.5 whitespace-nowrap">
                      اسم الانتقال والزر (Transition)
                    </th>
                    <th className="py-3.5 px-3 whitespace-nowrap">المرحلة المستهدفة</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">الصلاحيات المنفذة</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">شروط ما قبل الانتقال</th>
                    <th className="py-3.5 px-3.5 whitespace-nowrap">
                      الحقول الإلزامية أثناء الانتقال
                    </th>
                    <th className="py-3.5 px-3.5 whitespace-nowrap">
                      أتمتة ما بعد الانتقال
                    </th>
                    <th className="py-3.5 px-3 whitespace-nowrap">
                      اتفاقية الخدمة وسلامة التدفق
                    </th>
                    <th className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      الحالة والإجراءات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E2E8F0] text-[12px]">
                  {filteredTableTransitions.map((tr) => {
                    const isSelected = tr.id === selectedTransition.id;
                    const isWonRow = tr.tone === 'won';
                    const isLostRow = tr.tone === 'lost';

                    return (
                      <tr
                        key={tr.id}
                        onClick={() => setSelectedTransitionId(tr.id)}
                        className={`cursor-pointer transition-colors relative ${
                          isSelected
                            ? 'bg-[#EFF6FF]/65'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Col 1: المرحلة الحالية */}
                        <td
                          className={`py-3.5 px-3.5 align-middle ${
                            isSelected ? 'border-r-4 border-r-[#2563EB]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                isWonRow
                                  ? 'bg-[#10B981]'
                                  : tr.fromStageNumber === 4
                                  ? 'bg-[#6366F1]'
                                  : 'bg-[#2563EB]'
                              }`}
                            />
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-extrabold tabular-nums shrink-0 ${
                                isWonRow
                                  ? 'bg-[#D1FAE5] text-[#047857]'
                                  : tr.fromStageNumber === 4
                                  ? 'bg-[#EEF2FF] text-[#4338CA]'
                                  : 'bg-[#EFF6FF] text-[#2563EB]'
                              }`}
                            >
                              {tr.fromStageNumber}
                            </span>
                            <span className="font-extrabold text-[#0F172A] leading-snug max-w-[110px]">
                              {tr.fromStageName}
                            </span>
                          </div>
                        </td>

                        {/* Col 2: اسم الانتقال والزر (Transition) */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex items-center gap-2">
                            {isWonRow ? (
                              <>
                                <span className="inline-flex items-center gap-2 rounded-xl bg-[#047857] px-3.5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs">
                                  <ShieldCheck className="h-4 w-4 shrink-0" />
                                  <span className="leading-tight">
                                    إتمام التعاقد والفوز (Close Won)
                                  </span>
                                </span>
                                {isSelected && (
                                  <span className="rounded-md bg-[#D1FAE5] border border-[#6EE7B7] px-2 py-1 text-[10px] font-extrabold text-[#047857] shrink-0">
                                    محدد الآن
                                  </span>
                                )}
                              </>
                            ) : isLostRow ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-[11px] font-extrabold text-[#BE123C]">
                                <X className="h-3.5 w-3.5 shrink-0" />
                                <span>تعثر الصفقة وخسارة (Mark as Lost)</span>
                              </span>
                            ) : tr.iconType === 'loop' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[11px] font-extrabold text-[#334155]">
                                <RotateCcw className="h-3.5 w-3.5 text-[#475569] shrink-0" />
                                <span>{tr.shortTitle}</span>
                              </span>
                            ) : tr.iconType === 'scale' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-[11px] font-extrabold text-[#3730A3]">
                                <Scale className="h-3.5 w-3.5 text-[#4338CA] shrink-0" />
                                <span>{tr.shortTitle}</span>
                              </span>
                            ) : tr.iconType === 'monitor' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[11px] font-extrabold text-[#1E40AF]">
                                <Monitor className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                                <span>{tr.shortTitle}</span>
                              </span>
                            ) : tr.iconType === 'doc' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[11px] font-extrabold text-[#1E40AF]">
                                <FileText className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                                <span>{tr.shortTitle}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[11px] font-extrabold text-[#1E40AF]">
                                <ArrowLeft className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                                <span>{tr.shortTitle}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 3: المرحلة المستهدفة */}
                        <td className="py-3.5 px-3 align-middle">
                          <span
                            className={`inline-block rounded-lg border px-2.5 py-1.5 text-[11px] font-bold leading-snug max-w-[115px] ${
                              isWonRow
                                ? 'border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46] font-extrabold'
                                : isLostRow
                                ? 'border-[#FECDD3] bg-[#FFE4E6] text-[#BE123C] font-extrabold'
                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]'
                            }`}
                          >
                            {tr.toStageBadge}
                          </span>
                        </td>

                        {/* Col 4: الصلاحيات المنفذة */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="flex flex-col gap-1 max-w-[125px]">
                            {tr.tableRoleChips.map((roleChip) => (
                              <span
                                key={roleChip}
                                className="inline-block rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-bold text-[#334155] text-center"
                              >
                                {roleChip}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Col 5: شروط ما قبل الانتقال */}
                        <td className="py-3.5 px-3 align-middle">
                          <span
                            className={`inline-block rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold leading-snug max-w-[110px] text-center ${
                              tr.beforeSummaryTone === 'emerald'
                                ? 'bg-[#A7F3D0]/75 text-[#065F46] border border-[#6EE7B7]'
                                : 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
                            }`}
                          >
                            {tr.beforeSummaryChip}
                          </span>
                        </td>

                        {/* Col 6: الحقول الإلزامية أثناء الانتقال */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
                            {tr.tableDuringChips.map((chip) => (
                              <span
                                key={chip}
                                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                                  isLostRow
                                    ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
                                    : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]'
                                }`}
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Col 7: أتمتة ما بعد الانتقال */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-[165px]">
                            {tr.tableAfterChips.map((chip) => (
                              <span
                                key={chip}
                                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                                  isWonRow
                                    ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]'
                                }`}
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Col 8: اتفاقية الخدمة وسلامة التدفق */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#334155] tabular-nums max-w-[65px] leading-tight">
                              {tr.slaDurationLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#6EE7B7]/60 border border-[#34D399] px-2 py-1 text-[10px] font-extrabold text-[#065F46] shrink-0">
                              <Check className="h-3 w-3 stroke-[2.5]" />
                              <span>{tr.slaStatusLabel}</span>
                            </span>
                          </div>
                        </td>

                        {/* Col 9: الحالة والإجراءات */}
                        <td
                          className="py-3.5 px-3.5 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-2 relative">
                            {/* Toggle Switch */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={tr.enabled}
                              aria-label={`تفعيل أو إيقاف ${tr.shortTitle}`}
                              onClick={(e) => void handleToggleTransitionRowEnabled(tr.id, e)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                                tr.enabled
                                  ? isWonRow
                                    ? 'bg-[#059669]'
                                    : 'bg-[#2563EB]'
                                  : 'bg-[#CBD5E1]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-[#FFFFFF] shadow-xs transition-transform duration-150 ${
                                  tr.enabled ? '-translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              title="تعديل قواعد الانتقال"
                              aria-label={`تعديل ${tr.shortTitle}`}
                              onClick={() => handleOpenTransitionEditor(tr)}
                              className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Play / Test Transition Button */}
                            <button
                              type="button"
                              title="معاينة وتجربة الانتقال"
                              aria-label={`معاينة ${tr.shortTitle}`}
                              onClick={() => {
                                setSelectedTransitionId(tr.id);
                                setSellerPreviewOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#ECFDF5] hover:text-[#059669] transition-colors"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>

                            {/* More Menu Button */}
                            <button
                              type="button"
                              title="خيارات إضافية"
                              aria-label="خيارات إضافية"
                              onClick={() =>
                                setOpenRowMenuId((prev) => (prev === tr.id ? null : tr.id))
                              }
                              className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {openRowMenuId === tr.id && (
                              <div className="flyout-surface absolute left-0 top-8 z-30 w-44 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-xl text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTransitionId(tr.id);
                                    setSellerPreviewOpen(true);
                                    setOpenRowMenuId(null);
                                  }}
                                  className="block w-full px-3 py-1.5 text-[11px] font-bold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                                >
                                  معاينة شاشة البائع
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenTransitionEditor(tr);
                                    setOpenRowMenuId(null);
                                  }}
                                  className="block w-full px-3 py-1.5 text-[11px] font-bold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                                >
                                  تعديل قواعد الانتقال الكاملة
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Status Strip */}
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-2 text-[#475569]">
                <span>
                  إجمالي الانتقالات المعرفة:{' '}
                  <strong className="font-extrabold text-[#0F172A] tabular-nums">
                    9 من 9
                  </strong>
                </span>
                <span className="text-[#CBD5E1]">•</span>
                <span className="inline-flex items-center gap-1.5 font-extrabold text-[#059669]">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    فحص المسار التلقائي: خالي تماماً من الحلقات المغلقة (Deadlock Free)
                  </span>
                </span>
              </div>

              <span className="text-[11px] font-semibold text-[#64748B]">
                عرض كل المراحل في صفحة واحدة
              </span>
            </div>
          </div>

          {/* 2. BOTTOM SELECTED TRANSITION SUMMARY PANEL */}
          <div className="rounded-2xl border border-[#CBD5E1] bg-[#FFFFFF] p-5 shadow-xs space-y-4">
            {/* Panel Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
              {/* Right Side: Icon + Title + Badge + Description */}
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#059669] text-[#FFFFFF] shadow-xs shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                      تفاصيل وقواعد الانتقال: {selectedTransition.shortTitle} (
                      {selectedTransition.englishName})
                    </h2>
                    <span className="rounded-md bg-[#A7F3D0]/80 border border-[#34D399] px-2.5 py-0.5 text-[11px] font-extrabold text-[#065F46]">
                      انتقال حاسم للنظام
                    </span>
                  </div>
                  <p className="text-[12px] text-[#475569]">
                    ينقل الصفقة من مرحلة{' '}
                    <strong className="font-extrabold text-[#0F172A]">
                      {selectedTransition.fromStageId === 'stg_4'
                        ? '4. التفاوض ومراجعة العقود'
                        : `${selectedTransition.fromStageNumber}. ${selectedTransition.fromStageName}`}
                    </strong>{' '}
                    إلى{' '}
                    <strong className="font-extrabold text-[#059669]">
                      {selectedTransition.toStageBadge}
                    </strong>{' '}
                    ويطلق دورة تشغيلية كاملة
                  </p>
                </div>
              </div>

              {/* Left Side: "معاينة شاشة البائع" & "تعديل قواعد الانتقال الكاملة" */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSellerPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-4 py-2.5 text-[12px] font-extrabold text-[#0F172A] transition-colors"
                >
                  <Eye className="h-4 w-4 text-[#475569]" />
                  <span>معاينة شاشة البائع</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenTransitionEditor(selectedTransition)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors"
                >
                  <Sliders className="h-4 w-4" />
                  <span>تعديل قواعد الانتقال الكاملة</span>
                </button>
              </div>
            </div>

            {/* 3-Card Breakdown Grid (Before Criteria | During Fields | After Actions) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* Card 1 (Right in RTL): شروط ما قبل الظهور (Before Criteria) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#2563EB] shrink-0" />
                      <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                        شروط ما قبل الظهور (Before Criteria)
                      </h3>
                    </div>
                    <span className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-0.5 text-[10px] font-extrabold text-[#334155] shrink-0">
                      {selectedTransition.beforeCriteriaList.length} شروط نشطة
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    الشروط الرياضية والمنطقية التي يجب استيفاؤها قبل إتاحة هذا الزر لمسؤول المبيعات:
                  </p>

                  <div className="space-y-2 pt-1">
                    {selectedTransition.beforeCriteriaList.map((criterion, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-[12px] font-bold text-[#0F172A] leading-relaxed"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0 mt-0.5" />
                        <span>{criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-2.5 text-[11px] text-[#64748B]">
                  <span>الصلاحية محصورة لـ : </span>
                  <strong className="font-extrabold text-[#0F172A]">
                    {selectedTransition.rolesSummaryText}
                  </strong>
                </div>
              </div>

              {/* Card 2 (Center): الإدخال الإلزامي أثناء النقر (During Fields) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#2563EB] shrink-0" />
                      <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                        الإدخال الإلزامي أثناء النقر (During Fields)
                      </h3>
                    </div>
                    <span className="rounded-lg border border-[#93C5FD] bg-[#DBEAFE]/70 px-2.5 py-0.5 text-[10px] font-extrabold text-[#1E40AF] shrink-0">
                      {selectedTransition.duringCountBadge}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    حقول تظهر في نافذة منبثقة إجبارية لا يمكن تخطيها لحماية نزاهة بيانات CRM:
                  </p>

                  {/* 2x2 Grid of Mandatory Fields */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {selectedTransition.duringGridCards.map((card, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 flex items-center gap-2 text-[11px] font-extrabold text-[#0F172A] shadow-2xs"
                      >
                        {card.icon === 'pdf' && (
                          <Paperclip className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                        )}
                        {card.icon === 'po' && (
                          <Hash className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                        )}
                        {card.icon === 'payment' && (
                          <CreditCard className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                        )}
                        {card.icon === 'date' && (
                          <Calendar className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                        )}
                        <span className="truncate">{card.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#6EE7B7]/65 border border-[#34D399] px-3 py-1 text-[11px] font-extrabold text-[#065F46]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>مربوط بمصادقة DocuSign / منصة نفاذ الوطنية</span>
                  </span>
                </div>
              </div>

              {/* Card 3 (Left in RTL): الأتمتة الفورية بعد الفوز (After Actions) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-[#059669] shrink-0" />
                      <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                        الأتمتة الفورية بعد الفوز (After Actions)
                      </h3>
                    </div>
                    <span className="rounded-lg bg-[#6EE7B7]/75 border border-[#34D399] px-2.5 py-0.5 text-[10px] font-extrabold text-[#065F46] shrink-0">
                      {selectedTransition.afterCountBadge}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    إجراءات نظامية تنطلق تلقائياً فور اعتماد المسار بنجاح:
                  </p>

                  <div className="space-y-2 pt-0.5">
                    {selectedTransition.afterDetailRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {idx === 0 ? (
                            <RefreshCw className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                          ) : idx === 1 ? (
                            <MessageSquare className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                          )}
                          <span className="text-[11px] font-bold text-[#0F172A] truncate">
                            {row.label}
                          </span>
                        </div>
                        <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[9px] font-extrabold text-[#2563EB] shrink-0">
                          {row.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-2.5 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>فترة إعادة المحاولة التلقائية: 3 مرات عند الفشل</span>
                  <ShieldCheck className="h-4 w-4 text-[#059669]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           MODE B: 3-COLUMN VISUAL BUILDER WORKSPACE (Right 22% | Center 48% | Left 30%)
           ===================================================================== */
        <div className="w-full flex-1 grid grid-cols-1 xl:grid-cols-[22%_48%_30%] items-stretch">
          {/* RIGHT COLUMN (22%): مستودع المراحل (Stages) + Rules/Actions Palette */}
          <aside className="bg-[#FFFFFF] border-l border-[#E2E8F0] p-4 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Stages Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-extrabold text-[#0F172A]">
                      مستودع المراحل
                    </h2>
                    <p className="text-[10px] text-[#64748B]">
                      اسحب وأفلت في لوحة الرسم
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-extrabold text-[#2563EB] tabular-nums">
                  {stages.length} حالات
                </span>
              </div>

              {/* Search Stages */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stageSearch}
                  onChange={(e) => setStageSearch(e.target.value)}
                  placeholder="بحث في الحالات والقواعد..."
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-8 pl-3 py-2 text-[11px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              {/* Stages List */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold tracking-wide text-[#94A3B8] uppercase">
                  مراحل دورة البيع (DEAL STAGES)
                </p>

                <div className="space-y-2">
                  {filteredStages.map((stg) => {
                    const isSelected = stg.id === selectedStageId;
                    return (
                      <button
                        key={stg.id}
                        type="button"
                        onClick={() => setSelectedStageId(stg.id)}
                        className={`w-full rounded-xl border p-2.5 text-right transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-[#2563EB] bg-[#EFF6FF]/90 ring-1 ring-[#2563EB]/20'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#94A3B8] text-xs font-bold shrink-0">
                            =
                          </span>
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              stg.category === 'won'
                                ? 'bg-[#10B981]'
                                : stg.category === 'lost'
                                ? 'bg-[#E11D48]'
                                : stg.category === 'active'
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#2563EB]'
                            }`}
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-[12px] font-extrabold truncate ${
                                isSelected
                                  ? 'text-[#1E40AF]'
                                  : stg.category === 'lost'
                                  ? 'text-[#BE123C]'
                                  : 'text-[#0F172A]'
                              }`}
                            >
                              {stg.stepIndex}. {stg.title.replace(/^\d+\.\s*/, '')}
                            </p>
                            <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                              {stg.englishSubtitle}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[9px] font-bold text-[#FFFFFF] shrink-0">
                            محدد
                          </span>
                        ) : stg.category === 'won' ? (
                          <span className="rounded bg-[#ECFDF5] border border-[#A7F3D0] px-1.5 py-0.5 text-[9px] font-bold text-[#059669] shrink-0">
                            فوز
                          </span>
                        ) : stg.category === 'lost' ? (
                          <span className="rounded bg-[#FFF1F2] border border-[#FECDD3] px-1.5 py-0.5 text-[9px] font-bold text-[#E11D48] shrink-0">
                            خسارة
                          </span>
                        ) : (
                          <span className="rounded bg-[#E2E8F0]/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#64748B] tabular-nums shrink-0">
                            {stg.numberLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setAddingStageModal(true)}
                  className="w-full rounded-xl border border-dashed border-[#93C5FD] bg-[#EFF6FF]/40 hover:bg-[#EFF6FF] py-2.5 text-[11px] font-extrabold text-[#2563EB] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إنشاء حالة مخصصة جديدة</span>
                </button>
              </div>

              {/* Rules & Actions Palette */}
              <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                <p className="text-[10px] font-bold tracking-wide text-[#94A3B8] uppercase">
                  قواعد وضوابط التحقق (RULES & ACTIONS)
                </p>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('during');
                      setAddingFieldInline(true);
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#93C5FD] px-3 py-2 text-right text-[11px] font-bold text-[#0F172A] transition-colors"
                  >
                    <span>حقول تحقق إلزامية (Mandatory)</span>
                    <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('before');
                      setToastMsg('تم فتح شروط موافقة المدير الإلزامية');
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#93C5FD] px-3 py-2 text-right text-[11px] font-bold text-[#0F172A] transition-colors"
                  >
                    <span>موافقة المدير الإلزامية (Approval)</span>
                    <UserCheck className="h-4 w-4 text-[#7C3AED] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('during');
                      setToastMsg('تم تحديد شرط إرفاق المستند الرسمي (PDF)');
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#93C5FD] px-3 py-2 text-right text-[11px] font-bold text-[#0F172A] transition-colors"
                  >
                    <span>إلزام إرفاق مستند رسمي (File Upload)</span>
                    <FileText className="h-4 w-4 text-[#D97706] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('after');
                      setToastMsg('تم عرض إعدادات إشعارات واتساب / Webhook');
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#93C5FD] px-3 py-2 text-right text-[11px] font-bold text-[#0F172A] transition-colors"
                  >
                    <span>إرسال واتساب / بريد آلي (Webhook)</span>
                    <MessageSquare className="h-4 w-4 text-[#059669] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('after');
                      setToastMsg('تم تفعيل مزامنة الحقول مع الفوترة وأوامر البيع');
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#93C5FD] px-3 py-2 text-right text-[11px] font-bold text-[#0F172A] transition-colors"
                  >
                    <span>تحديث حقل في موديول آخر (Sync)</span>
                    <RefreshCw className="h-4 w-4 text-[#2563EB] shrink-0" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Info Box */}
            <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/60 p-3 flex items-start gap-2 text-[11px] text-[#334155] leading-relaxed">
              <Info className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
              <span>
                في وضع البلوبرينت، لن يتمكن البائع من اختيار المرحلة القادمة يدوياً إلا بالنقر على زر الانتقال المعتمد بعد تحقيق الشروط.
              </span>
            </div>
          </aside>

          {/* CENTER COLUMN (48%): Interactive Flow Diagram */}
          <section className="bg-[#F8FAFC] border-l border-[#E2E8F0] flex flex-col justify-between relative">
            {/* Canvas Top Bar */}
            <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                <h2 className="text-[13px] font-extrabold text-[#0F172A]">
                  مخطط التدفق التفاعلي (Interactive Flow Diagram)
                </h2>
                <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#64748B]">
                  RTL Flow Engine
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <div className="hidden sm:flex items-center gap-2.5 text-[#64748B]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-xs border border-[#CBD5E1] bg-[#FFFFFF]" />
                    <span>مرحلة عادية</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#2563EB]" />
                    <span>زر انتقال</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#059669]" />
                    <span>محطة فوز</span>
                  </span>
                </div>

                <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] font-bold text-[#475569] tabular-nums">
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.min(125, z + 10))}
                    className="px-1 hover:text-[#0F172A]"
                    aria-label="تكبير المخطط"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="px-1.5">{zoomPercent}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.max(80, z - 10))}
                    className="px-1 hover:text-[#0F172A]"
                    aria-label="تصغير المخطط"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:18px_18px]">
              <div className="mx-auto max-w-[540px] flex flex-col items-center">
                {/* Stage 1 Node */}
                <div
                  onClick={() => setSelectedStageId('stg_1')}
                  className={`w-full rounded-2xl border bg-[#FFFFFF] p-3.5 shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    selectedStageId === 'stg_1'
                      ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
                      : 'border-[#E2E8F0] hover:border-[#93C5FD]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] font-mono text-[13px] font-extrabold text-[#2563EB]">
                      1
                    </span>
                    <div className="text-right">
                      <p className="text-[13px] font-extrabold text-[#0F172A]">
                        عميل محتمل مؤهل (Qualified Lead)
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        الحد الأقصى للإقامة: 3 أيام عمل
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#2563EB]">
                    بداية المسار
                  </span>
                </div>

                {/* Connector + Transition 1 (`tr_901`) */}
                <div className="h-3.5 w-0.5 bg-[#2563EB]/60" />
                <button
                  type="button"
                  onClick={() => setSelectedTransitionId('tr_901')}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold transition-all shadow-2xs ${
                    selectedTransitionId === 'tr_901'
                      ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF] ring-2 ring-[#2563EB]/25'
                      : 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>انتقال: «إرسال العرض التوضيحي الفني»</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                </button>
                <div className="h-3.5 w-0.5 bg-[#2563EB]/60" />

                {/* Stage 2 Node */}
                <div
                  onClick={() => setSelectedStageId('stg_2')}
                  className={`w-full rounded-2xl border bg-[#FFFFFF] p-3.5 shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    selectedStageId === 'stg_2'
                      ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
                      : 'border-[#E2E8F0] hover:border-[#93C5FD]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] font-mono text-[13px] font-extrabold text-[#2563EB]">
                      2
                    </span>
                    <div className="text-right">
                      <p className="text-[13px] font-extrabold text-[#0F172A]">
                        تحليل الاحتياج والعرض الفني
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        يتطلب حضور مهندس المبيعات واعتماد النطاق
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-bold text-[#475569]">
                    SLA: 5 أيام
                  </span>
                </div>

                {/* Connector + Transition 2 (`tr_902`) */}
                <div className="h-3.5 w-0.5 bg-[#2563EB]/60" />
                <button
                  type="button"
                  onClick={() => setSelectedTransitionId('tr_902')}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold transition-all shadow-2xs ${
                    selectedTransitionId === 'tr_902'
                      ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF] ring-2 ring-[#2563EB]/25'
                      : 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>انتقال: «إصدار العرض المالي المعتمد»</span>
                  <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[9px] font-extrabold text-[#1E40AF]">
                    موافقة مالية
                  </span>
                </button>
                <div className="h-3.5 w-0.5 bg-[#2563EB]/60" />

                {/* Stage 3 Node */}
                <div
                  onClick={() => setSelectedStageId('stg_3')}
                  className={`w-full rounded-2xl border bg-[#FFFFFF] p-3.5 shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    selectedStageId === 'stg_3'
                      ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
                      : 'border-[#E2E8F0] hover:border-[#93C5FD]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] font-mono text-[13px] font-extrabold text-[#2563EB]">
                      3
                    </span>
                    <div className="text-right">
                      <p className="text-[13px] font-extrabold text-[#0F172A]">
                        تقديم العرض المالي (Quote Sent)
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        تم التسليم رسمياً - بانتظار استجابة المشتريات
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 text-[10px] font-bold text-[#D97706]">
                    تحت النظر
                  </span>
                </div>

                {/* Connector + Transition 3 (`tr_903`) */}
                <div className="h-3.5 w-0.5 bg-[#2563EB]/60" />
                <button
                  type="button"
                  onClick={() => setSelectedTransitionId('tr_903')}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold transition-all shadow-2xs ${
                    selectedTransitionId === 'tr_903'
                      ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF] ring-2 ring-[#2563EB]/25'
                      : 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]'
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>انتقال: «بدء التفاوض والمراجعة القانونية»</span>
                </button>
                <div className="h-4 w-0.5 bg-[#2563EB]/60" />

                {/* Stage 4 Node (Active Highlighted Stage Card) */}
                <div className="w-full relative pt-2">
                  <div className="-top-1 left-1/2 -translate-x-1/2 absolute z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1E3A8A] px-3 py-0.5 text-[10px] font-bold text-[#FFFFFF] shadow-xs">
                      <Pencil className="h-2.5 w-2.5" />
                      <span>المرحلة المحددة للتحرير حالياً</span>
                    </span>
                  </div>

                  <div
                    onClick={() => setSelectedStageId('stg_4')}
                    className="w-full rounded-2xl border-2 border-[#F59E0B] bg-[#FFFFFF] p-4 shadow-md space-y-3 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F59E0B] font-mono text-[14px] font-extrabold text-[#FFFFFF] shrink-0">
                          4
                        </span>
                        <div className="text-right">
                          <p className="text-[14px] font-extrabold text-[#0F172A]">
                            4. التفاوض ومراجعة العقود (Negotiation)
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="rounded bg-[#FEF3C7] px-2 py-0.5 font-bold text-[#B45309]">
                              مرحلة حساسة وحرجة
                            </span>
                            <span className="text-[#64748B]">
                              • تنبيه اختناق: بعد 5 أيام بدون حركة
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
                        <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                        <span>نشط</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[11px]">
                      <div>
                        <p className="text-[10px] text-[#64748B]">المسؤولين عن المرحلة:</p>
                        <p className="font-bold text-[#0F172A] mt-0.5">
                          مدير المبيعات + الشؤون القانونية
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B]">المستندات المطلوبة مسبقاً:</p>
                        <p className="font-bold text-[#0F172A] mt-0.5">
                          مسودة الاتفاقية + جدول الأسعار المعتمد
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branching Section Below Stage 4 */}
                <div className="my-3 text-[11px] font-bold text-[#64748B]">
                  الانتقالات المتاحة من هذه المرحلة:
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                  {/* Right Branch: Success Path (Close Won) */}
                  <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3.5 flex flex-col items-center space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#059669]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>مسار الفوز والاعتماد (Success Path)</span>
                    </div>

                    {/* Transition Pill 4 (`tr_904` - Selected by default) */}
                    <button
                      type="button"
                      onClick={() => setSelectedTransitionId('tr_904')}
                      className={`w-full rounded-xl p-3 text-right transition-all flex items-center justify-between gap-2 shadow-sm ${
                        selectedTransitionId === 'tr_904'
                          ? 'bg-[#2563EB] text-[#FFFFFF] ring-2 ring-[#2563EB]/35'
                          : 'bg-[#1D4ED8] text-[#FFFFFF] opacity-90 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Lock className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-extrabold leading-snug">
                            إتمام التعاقد والفوز (Close Won)
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-[#FFFFFF]/20 px-2 py-0.5 text-[9px] font-bold text-[#FFFFFF] shrink-0">
                        {selectedTransitionId === 'tr_904' ? 'محدد للضبط' : 'انتقال'}
                      </span>
                    </button>

                    <div className="h-2.5 w-0.5 bg-[#059669]/50" />

                    {/* Stage 5 Terminal Won Node */}
                    <div
                      onClick={() => setSelectedStageId('stg_5')}
                      className="w-full rounded-xl bg-[#059669] p-3 text-[#FFFFFF] text-center shadow-xs cursor-pointer"
                    >
                      <p className="text-[12px] font-extrabold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>5. إغلاق فوز (Closed Won)</span>
                      </p>
                      <p className="text-[10px] text-[#D1FAE5] mt-0.5">
                        توليد الفاتورة والبدء في تجهيز المشروع
                      </p>
                    </div>
                  </div>

                  {/* Left Branch: Drop Path (Closed Lost) */}
                  <div className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-3.5 flex flex-col items-center space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#E11D48]">
                      <X className="h-3.5 w-3.5" />
                      <span>مسار التعثر والإلغاء (Drop Path)</span>
                    </div>

                    {/* Transition Pill 5 (`tr_905`) */}
                    <button
                      type="button"
                      onClick={() => setSelectedTransitionId('tr_905')}
                      className={`w-full rounded-xl border p-3 text-right transition-all flex items-center justify-between gap-2 ${
                        selectedTransitionId === 'tr_905'
                          ? 'border-[#E11D48] bg-[#FFE4E6] text-[#9F1239] ring-2 ring-[#E11D48]/25'
                          : 'border-[#FECDD3] bg-[#FFFFFF] text-[#BE123C] hover:bg-[#FFF1F2]'
                      }`}
                    >
                      <span className="text-[12px] font-extrabold leading-snug">
                        تعثر الصفقة وخسارة (Mark as Lost)
                      </span>
                      <span className="rounded bg-[#FFF1F2] border border-[#FECDD3] px-1.5 py-0.5 text-[9px] font-bold text-[#E11D48] shrink-0">
                        سبب إلزامي
                      </span>
                    </button>

                    <div className="h-2.5 w-0.5 bg-[#E11D48]/40" />

                    {/* Stage 6 Terminal Lost Node */}
                    <div
                      onClick={() => setSelectedStageId('stg_6')}
                      className="w-full rounded-xl border-2 border-[#F43F5E] bg-[#FFFFFF] p-3 text-center cursor-pointer"
                    >
                      <p className="text-[12px] font-extrabold text-[#BE123C]">
                        6. إغلاق خسارة (Closed Lost)
                      </p>
                      <p className="text-[10px] text-[#64748B] mt-0.5">
                        تحديد أسباب الفقد وتحليل المنافسين
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Canvas Bottom Status Strip */}
            <div className="bg-[#FFFFFF] border-t border-[#E2E8F0] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[#059669]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  تم التحقق من صحة المسار المنطقي: لا توجد حلقات مفرغة (No Deadlocks)
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-[#64748B] tabular-nums">
                <span>دقة الشاشة: 1440x900</span>
                <span>الإحداثيات: X: 420, Y: 680</span>
              </div>
            </div>
          </section>

          {/* LEFT COLUMN (30%): إعدادات الانتقال (Transition Inspector) */}
          <aside className="bg-[#FFFFFF] p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Inspector Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-[#FFFFFF] shadow-2xs shrink-0">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#0F172A] leading-tight">
                      إعدادات الانتقال
                    </h2>
                    <p className="font-mono text-[10px] font-bold text-[#2563EB]">
                      Transition Inspector
                    </p>
                  </div>
                </div>

                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 font-mono text-[11px] font-extrabold text-[#059669]">
                  معرف: {selectedTransition.code}
                </span>
              </div>

              {/* Selected Transition From -> To Banner */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 flex items-center justify-between gap-2 text-[12px] font-bold">
                <span className="text-[#0F172A]">
                  من: [{selectedTransition.fromStageName}]
                </span>
                <span className="text-[#2563EB] font-extrabold">«</span>
                <span
                  className={
                    selectedTransition.tone === 'lost'
                      ? 'text-[#E11D48] font-extrabold'
                      : 'text-[#059669] font-extrabold'
                  }
                >
                  إلى: [{selectedTransition.toStageName}]
                </span>
              </div>

              {/* Execution Roles Section */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-[12px] font-extrabold text-[#0F172A]">
                    من يُسمح له بتنفيذ هذا الانتقال؟ (Execution Roles)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    حدد الأدوار الوظيفية المصرح لها بتحويل الصفقة للفوز:
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedTransition.roles.map((roleName) => (
                    <span
                      key={roleName}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#1D4ED8]"
                    >
                      <span>{roleName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(roleName)}
                        aria-label={`إزالة دور ${roleName}`}
                        className="text-[#2563EB] hover:text-[#E11D48]"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAddingRoleMenu((p) => !p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:text-[#2563EB]"
                    >
                      <Plus className="h-3 w-3" />
                      <span>إضافة دور وظيفي</span>
                    </button>

                    {addingRoleMenu && (
                      <div className="flyout-surface absolute right-0 top-8 z-30 w-56 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-xl">
                        {rolePool.map((rName) => (
                          <button
                            key={rName}
                            type="button"
                            onClick={() => handleAddRole(rName)}
                            className="block w-full px-3 py-1.5 text-right text-[11px] font-semibold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                          >
                            {rName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 Tabs: قبل الانتقال | أثناء الانتقال (نافذة الإدخال) | بعد الانتقال (الأتمتة) */}
              <div className="grid grid-cols-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-center text-[11px]">
                <button
                  type="button"
                  onClick={() => setInspectorTab('before')}
                  className={`rounded-lg py-2 font-bold transition-colors ${
                    inspectorTab === 'before'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  قبل الانتقال
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorTab('during')}
                  className={`rounded-lg py-1.5 font-extrabold transition-colors leading-tight ${
                    inspectorTab === 'during'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  أثناء الانتقال
                  <span className="block text-[9px] font-semibold">(نافذة الإدخال)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorTab('after')}
                  className={`rounded-lg py-1.5 font-bold transition-colors leading-tight ${
                    inspectorTab === 'after'
                      ? 'bg-[#FFFFFF] text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  بعد الانتقال
                  <span className="block text-[9px] font-semibold">(الأتمتة)</span>
                </button>
              </div>

              {/* Tab 1 Content: Before Transition Conditions */}
              {inspectorTab === 'before' && (
                <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold text-[#0F172A]">
                      شروط التحقق المسبقة (Before Conditions):
                    </span>
                    <span className="text-[10px] font-bold text-[#2563EB]">
                      جميع الشروط مفعلة
                    </span>
                  </div>

                  {selectedTransition.beforeConditions.map((cond) => (
                    <label
                      key={cond.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={cond.enabled}
                          onChange={() => handleToggleBeforeCondition(cond.id)}
                          className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                        />
                        <div>
                          <p className="text-[12px] font-bold text-[#0F172A]">
                            {cond.fieldLabel}
                          </p>
                          <p className="text-[10px] text-[#64748B]">
                            {cond.operatorLabel}:{' '}
                            <strong className="text-[#0F172A]">{cond.valueLabel}</strong>
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                        شرط أساسي
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Tab 2 Content (Default): Mandatory Fields in Completion Window */}
              {inspectorTab !== 'before' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[12px] font-extrabold text-[#0F172A]">
                      الحقول الإلزامية في نافذة الإتمام:
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAddingFieldInline((prev) => !prev)}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline"
                    >
                      + إضافة حقل إلزامي
                    </button>
                  </div>

                  {addingFieldInline && (
                    <form
                      onSubmit={handleAddCustomFieldSubmit}
                      className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-2.5 space-y-2"
                    >
                      <input
                        type="text"
                        required
                        placeholder="عنوان الحقل الإلزامي..."
                        value={newFieldTitle}
                        onChange={(e) => setNewFieldTitle(e.target.value)}
                        className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="وصف التحقق (اختياري)..."
                        value={newFieldSubtitle}
                        onChange={(e) => setNewFieldSubtitle(e.target.value)}
                        className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddingFieldInline(false)}
                          className="rounded px-2 py-1 text-[10px] font-bold text-[#64748B]"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="rounded bg-[#2563EB] px-2.5 py-1 text-[10px] font-bold text-[#FFFFFF]"
                        >
                          إضافة الحقل
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {selectedTransition.duringFields.map((fld) => (
                      <label
                        key={fld.id}
                        className="flex items-start justify-between gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] p-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={fld.enabled}
                            onChange={() => handleToggleDuringField(fld.id)}
                            className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[12px] font-extrabold text-[#0F172A] leading-snug">
                              {fld.title}
                            </p>
                            <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">
                              {fld.subtitle}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                            fld.badgeTone === 'danger'
                              ? 'bg-[#FEE2E2] text-[#DC2626]'
                              : fld.badgeTone === 'info'
                              ? 'bg-[#DBEAFE] text-[#2563EB]'
                              : 'bg-[#E2E8F0] text-[#475569]'
                          }`}
                        >
                          {fld.badgeText}
                        </span>
                      </label>
                    ))}

                    {/* Digital Signature Toggle (نفاذ / DocuSign) */}
                    <label className="flex items-center justify-between gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/70 px-3 py-2.5 cursor-pointer">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-[#0F172A]">
                        <Link2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                        <span>طلب توقيع رقمي عبر (نفاذ / DocuSign)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedTransition.requireDigitalSignature}
                        onChange={(e) =>
                          updateSelectedTransition((tr) => ({
                            ...tr,
                            requireDigitalSignature: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-[#93C5FD] text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>
                  </div>

                  {/* Strict Pipeline Lock Warning */}
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 flex items-start gap-2 text-[11px] text-[#B45309] leading-relaxed">
                    <AlertTriangle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-extrabold">قفل مسار المبيعات الصارم:</strong> لن يتمكن موظف المبيعات من النقر على زر الفوز في صفحة الصفقة ما لم يتم رفع العقد وتعبئة كافة البيانات أعلاه.
                    </span>
                  </div>
                </div>
              )}

              {/* Post-Transition Automated Actions (`إجراءات الأتمتة اللاحقة After Transition Actions`) */}
              <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                <h3 className="text-[12px] font-extrabold text-[#0F172A]">
                  إجراءات الأتمتة اللاحقة (After Transition Actions):
                </h3>

                <div className="space-y-1.5">
                  {selectedTransition.afterActions.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => handleToggleAfterAction(act.id)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] px-3 py-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            act.enabled ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                          }`}
                        />
                        <span className="text-[11px] font-bold text-[#0F172A] truncate">
                          {act.label}
                        </span>
                      </div>

                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                          act.enabled
                            ? 'bg-[#ECFDF5] text-[#059669]'
                            : 'bg-[#E2E8F0] text-[#64748B]'
                        }`}
                      >
                        {act.enabled ? 'مفعل' : 'معطل'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Inspector Footer Buttons */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => handleOpenTransitionEditor(selectedTransition)}
                className="w-full rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] py-2.5 px-4 text-[12px] font-extrabold text-[#1D4ED8] transition-colors flex items-center justify-center gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>تعديل قواعد الانتقال الكاملة</span>
              </button>

              <button
                type="button"
                disabled={savingToFirestore}
                onClick={() =>
                  void persistBlueprintToFirestore(
                    blueprintActive,
                    stages.length,
                    `تم حفظ إعدادات انتقال «${selectedTransition.shortTitle}» في قاعدة البيانات`
                  )
                }
                className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-3 px-4 text-[13px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>حفظ إعدادات انتقال «{selectedTransition.shortTitle}»</span>
              </button>

              <button
                type="button"
                onClick={handleResetInspectorDefaults}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] py-2.5 px-4 text-[12px] font-bold text-[#475569] transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>إلغاء التغييرات واستعادة الإعداد الافتراضي</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Seller Screen Preview Modal ("معاينة شاشة البائع") */}
      {sellerPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="space-y-0.5">
                <span className="inline-block rounded-md bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-extrabold text-[#2563EB]">
                  معاينة نافذة البائع (Seller Transition Modal Preview)
                </span>
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  إتمام متطلبات الانتقال: {selectedTransition.shortTitle} (
                  {selectedTransition.englishName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSellerPreviewOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 flex items-center justify-between font-bold">
                <span className="text-[#475569]">
                  من: <strong className="text-[#0F172A]">{selectedTransition.fromStageName}</strong>
                </span>
                <span className="text-[#2563EB]">←</span>
                <span className="text-[#059669]">
                  إلى: <strong>{selectedTransition.toStageBadge}</strong>
                </span>
              </div>

              <p className="text-[11px] font-bold text-[#64748B]">
                الحقول الإلزامية التي يطالب بها البائع عند النقر على زر الانتقال:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedTransition.duringGridCards.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] p-3 space-y-1"
                  >
                    <label className="block text-[11px] font-extrabold text-[#0F172A]">
                      {item.label} <span className="text-[#E11D48]">*</span>
                    </label>
                    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[11px] text-[#64748B]">
                      {item.icon === 'pdf'
                        ? 'إرفاق ملف موثق (PDF)...'
                        : item.icon === 'date'
                        ? '2025-05-15'
                        : 'حقل إلزامي محمي بالبلوبرينت'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/70 p-3 space-y-1.5">
                <p className="text-[11px] font-extrabold text-[#065F46]">
                  الأتمتة التلقائية فور تأكيد البائع ({selectedTransition.afterCountBadge}):
                </p>
                {selectedTransition.afterDetailRows.map((a, idx) => (
                  <p key={idx} className="text-[11px] text-[#047857] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{a.label}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setSellerPreviewOpen(false)}
                className="rounded-xl border border-[#CBD5E1] px-4 py-2 text-[12px] font-bold text-[#475569]"
              >
                إغلاق المعاينة
              </button>
              <button
                type="button"
                onClick={() => {
                  setSellerPreviewOpen(false);
                  setViewMode('visual');
                }}
                className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF]"
              >
                تعديل حقول هذه النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Stage Modal */}
      {addingStageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                إضافة مرحلة جديدة في مستودع المراحل
              </h3>
              <button
                type="button"
                onClick={() => setAddingStageModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomStage} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  اسم المرحلة / الحالة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المراجعة الأمنية والامتثال"
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  اتفاقية مستوى الخدمة (SLA)
                </label>
                <input
                  type="text"
                  value={newStageSla}
                  onChange={(e) => setNewStageSla(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAddingStageModal(false)}
                  className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-bold text-[#FFFFFF]"
                >
                  إضافة وحفظ في Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Transition Modal */}
      {addingTransitionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                إضافة انتقال جديد في المسار
              </h3>
              <button
                type="button"
                onClick={() => setAddingTransitionModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomTransition} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  عنوان زر الانتقال *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: اعتماد التسعير الاستثنائي"
                  value={newTrTitle}
                  onChange={(e) => setNewTrTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  المرحلة المستهدفة
                </label>
                <input
                  type="text"
                  value={newTrToStage}
                  onChange={(e) => setNewTrToStage(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setAddingTransitionModal(false)}
                  className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-bold text-[#FFFFFF]"
                >
                  إضافة الانتقال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulation Modal ("محاكاة واختبار مسار البلوبرينت (Blueprint Test Run)") */}
      {simulationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 backdrop-blur-[2px] p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blueprint-test-run-title"
        >
          <div className="w-full max-w-[920px] rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl overflow-hidden my-auto">
            {/* 1. MODAL HEADER & ROLE SIMULATION SWITCHER */}
            <div className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4 flex flex-wrap items-start justify-between gap-4">
              {/* Right Side: Flask Icon + Title + Sandbox Pill + Transition Subtitle */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 2v7.31" />
                    <path d="M14 9.3V1.99" />
                    <path d="M8.5 2h7" />
                    <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
                    <path d="M5.52 16h12.96" />
                  </svg>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3
                      id="blueprint-test-run-title"
                      className="text-[16px] sm:text-[17px] font-extrabold text-[#0F172A]"
                    >
                      محاكاة واختبار مسار البلوبرينت (Blueprint Test Run)
                    </h3>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6EE7B7]/85 px-2.5 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                      <span>بيئة اختبار فورية (Sandbox Mode)</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B]">
                    اختبار انتقال:{' '}
                    <span className="font-extrabold text-[#2563EB]">
                      [{selectedTransition.shortTitle} ({selectedTransition.englishName})]
                    </span>{' '}
                    من مرحلة{' '}
                    <span className="font-bold text-[#334155]">
                      [4. التفاوض ومراجعة العقود]
                    </span>
                  </p>
                </div>
              </div>

              {/* Left Side: Reset Simulation + Close X */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetSimulation}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-bold text-[#334155] transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>إعادة ضبط المحاكاة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulationOpen(false)}
                  aria-label="إغلاق نافذة المحاكاة"
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sub-header Strip: Role Simulation Switcher + Sample Deal Pill */}
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3 space-y-2">
              {/* Row A: Role Switcher Pills */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-[#64748B]">محاكاة الصلاحية:</span>

                <button
                  type="button"
                  onClick={() => {
                    setSimRoleMode('authorized');
                    setSimDryRunResult('idle');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-extrabold transition-all ${
                    simRoleMode === 'authorized'
                      ? 'bg-[#2563EB] text-[#FFFFFF] shadow-xs'
                      : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {simRoleMode === 'authorized' && (
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  )}
                  <span>مدير المبيعات الإقليمي (مصرح له ✓)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSimRoleMode('unauthorized');
                    setSimDryRunResult('idle');
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-[11px] font-extrabold transition-all ${
                    simRoleMode === 'unauthorized'
                      ? 'border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C] shadow-xs'
                      : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {simRoleMode === 'unauthorized' && (
                    <X className="h-3 w-3 stroke-[2.5] text-[#DC2626]" />
                  )}
                  <span>مندوب مبيعات مبتدئ (غير مصرح ✕)</span>
                  {simRoleMode === 'unauthorized' && (
                    <span className="rounded bg-[#B91C1C] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#FFFFFF]">
                      نشط في المحاكاة
                    </span>
                  )}
                </button>
              </div>

              {/* Row B: Sample Deal Selector Pill */}
              <div>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1 text-[11px] shadow-2xs">
                  <span className="text-[#64748B] font-semibold">صفقة الاختبار:</span>
                  <span className="font-extrabold text-[#0F172A]">
                    {currentSimDeal.title}
                  </span>
                  <span className="rounded bg-[#DBEAFE] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#1E40AF] tabular-nums">
                    {currentSimDeal.amountLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* 1B. ROSE SECURITY ALERT BANNER (Shown immediately when Junior Rep is selected) */}
            {simRoleMode === 'unauthorized' && (
              <div className="mx-6 mt-4 rounded-xl border border-[#FCA5A5] bg-[#FFF1F2] p-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#B91C1C] text-[#FFFFFF] shadow-2xs">
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[13px] font-extrabold text-[#991B1B]">
                        إجراء مقيد أمنياً (Access Denied / Restricted Transition)
                      </h4>
                      <span className="rounded bg-[#991B1B] px-2 py-0.5 text-[10px] font-extrabold text-[#FFFFFF]">
                        مخالفة صلاحيات
                      </span>
                    </div>

                    <p className="text-[11px] text-[#7F1D1D] leading-relaxed">
                      لا يملك الدور الوظيفي الحالي{' '}
                      <strong className="font-extrabold text-[#DC2626]">
                        «مندوب مبيعات مبتدئ»
                      </strong>{' '}
                      الصلاحيات المعتمدة في البلوبرينت لإتمام الانتقال إلى مرحلة{' '}
                      <strong className="font-extrabold text-[#0F172A]">
                        [إغلاق فوز (Close Won)]
                      </strong>
                      . الأدوار المصرح لها فقط:{' '}
                      <strong className="font-extrabold text-[#1D4ED8] underline decoration-[#93C5FD] underline-offset-2">
                        [مدير المبيعات الإقليمي، مسؤول حساب كبار العملاء Senior KAM]
                      </strong>
                    </p>
                  </div>
                </div>

                <div
                  className="text-[10.5px] font-mono font-extrabold text-[#DC2626] shrink-0 self-end sm:self-start"
                  dir="ltr"
                >
                  رمز الخطأ: SEC_ERR_ROLE_UNAUTHORIZED
                </div>
              </div>
            )}

            {/* 2. 2-COLUMN SIMULATION BODY */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#FFFFFF]">
              {/* RIGHT COLUMN (7 cols in 12-col grid): Simulated "نموذج الإدخال الإلزامي المعتمد في البلوبرينت" */}
              <div className="lg:col-span-7 space-y-4">
                {/* Stage Transition Visual Strip */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 flex items-center justify-between gap-2">
                  {/* Right: From Stage 4 */}
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-[12px] font-extrabold text-[#FFFFFF]">
                      4
                    </span>
                    <div>
                      <p className="text-[12px] font-extrabold text-[#0F172A] leading-tight">
                        التفاوض ومراجعة العقود
                      </p>
                      <p className="text-[10px] font-bold text-[#D97706]">
                        الحالة الحالية للصفقة
                      </p>
                    </div>
                  </div>

                  {/* Center: Verification Window Indicator */}
                  {simRoleMode === 'unauthorized' ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#DC2626]">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="underline decoration-[#FCA5A5] underline-offset-4">
                        نافذة التحقق (مقيدة)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#2563EB]">
                      <span>«</span>
                      <span className="underline decoration-[#93C5FD] underline-offset-4">
                        نافذة التحقق
                      </span>
                    </div>
                  )}

                  {/* Left: Target Stage 5 */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-[#FFFFFF] ${
                        simRoleMode === 'unauthorized'
                          ? 'bg-[#94A3B8]'
                          : 'bg-[#059669]'
                      }`}
                    >
                      5
                    </span>
                    <div>
                      <p
                        className={`text-[12px] font-extrabold leading-tight ${
                          simRoleMode === 'unauthorized'
                            ? 'text-[#64748B]'
                            : 'text-[#0F172A]'
                        }`}
                      >
                        إغلاق فوز (Close Won)
                      </p>
                      <p className="text-[10px] text-[#64748B]">
                        {simRoleMode === 'unauthorized'
                          ? 'محظور الوصول'
                          : 'الوجهة المستهدفة'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Title + Verified Fields Count / Blocked Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                      نموذج الإدخال الإلزامي المعتمد في البلوبرينت:
                    </h4>
                    {simRoleMode === 'unauthorized' && (
                      <Lock className="h-3.5 w-3.5 text-[#64748B]" />
                    )}
                  </div>

                  {simRoleMode === 'unauthorized' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#FCA5A5] bg-[#FFF1F2] px-2.5 py-0.5 text-[10px] font-extrabold text-[#B91C1C]">
                      <span>⊘ محجوب عن دور مندوب المبيعات</span>
                    </span>
                  ) : (
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-[10px] font-extrabold ${
                        completedSimFieldsCount === 6
                          ? 'bg-[#D1FAE5] text-[#065F46]'
                          : 'bg-[#FEF3C7] text-[#B45309]'
                      }`}
                    >
                      {completedSimFieldsCount} حقول تم التحقق منها
                    </span>
                  )}
                </div>

                {/* Form Fields Wrapper (with Locked Overlay when simRoleMode === 'unauthorized') */}
                <div className="relative">
                  <div
                    className={`space-y-4 transition-all ${
                      simRoleMode === 'unauthorized'
                        ? 'blur-[3px] opacity-35 pointer-events-none select-none'
                        : ''
                    }`}
                  >
                    {/* Field 1: Signed Contract PDF Upload Box */}
                    <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                          <CheckCircle2
                            className={`h-4 w-4 ${
                              simPdfVerified ? 'text-[#059669]' : 'text-[#94A3B8]'
                            }`}
                          />
                          <span>العقد النهائي الموقع (PDF)</span>
                        </div>
                        <span className="rounded bg-[#FFE4E6] px-2 py-0.5 text-[10px] font-extrabold text-[#E11D48]">
                          مرفق إلزامي
                        </span>
                      </div>

                      <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-[#DC2626] shrink-0" />
                          <span
                            className="font-mono text-[11px] font-bold text-[#0F172A] truncate"
                            dir="ltr"
                          >
                            {currentSimDeal.pdfName}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSimPdfVerified((prev) => !prev)}
                          className={`inline-flex items-center gap-1 text-[11px] font-extrabold shrink-0 ${
                            simPdfVerified ? 'text-[#059669]' : 'text-[#DC2626]'
                          }`}
                        >
                          {simPdfVerified ? (
                            <>
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>تم التحقق</span>
                            </>
                          ) : (
                            <span>غير مرفق (اضغط للإرفاق)</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Row of 2 Fields: PO Number (Right) + Payment Terms (Left) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* PO Number */}
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-3 space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#334155]">
                          رقم أمر الشراء (PO Number)
                        </label>
                        <input
                          type="text"
                          value={simPoNumber}
                          onChange={(e) => setSimPoNumber(e.target.value)}
                          dir="ltr"
                          className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 font-mono text-[12px] font-extrabold text-[#0F172A] text-center focus:border-[#2563EB] focus:outline-none"
                        />
                      </div>

                      {/* Payment Terms */}
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-3 space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#334155]">
                          طريقة الدفع وجدول الدفعات
                        </label>
                        <div className="relative">
                          <select
                            value={simPaymentTerms}
                            onChange={(e) => setSimPaymentTerms(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 pl-7 text-[11px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                          >
                            <option value="دفعة مقدمة 50% / نقدي بشيك مصدق">
                              دفعة مقدمة 50% / نقدي بشيك مصدق
                            </option>
                            <option value="دفعات ربع سنوية (خطاب اعتماد بنكي)">
                              دفعات ربع سنوية (خطاب اعتماد بنكي)
                            </option>
                            <option value="سداد كامل عند التسليم (آجل 30 يوم)">
                              سداد كامل عند التسليم (آجل 30 يوم)
                            </option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
                        </div>
                      </div>
                    </div>

                    {/* Row of 2 Fields: Service Start Date (Right) + Digital Signature Verification (Left) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Service Start Date */}
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-3 space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#334155]">
                          تاريخ بدء سريان الخدمة
                        </label>
                        <input
                          type="text"
                          value={simServiceDate}
                          onChange={(e) => setSimServiceDate(e.target.value)}
                          dir="ltr"
                          className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 font-mono text-[12px] font-bold text-[#0F172A] text-center focus:border-[#2563EB] focus:outline-none"
                        />
                      </div>

                      {/* Verified Digital Signature */}
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-3 space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#334155]">
                          التوقيع الرقمي المعتمد
                        </label>
                        <button
                          type="button"
                          onClick={() => setSimDigitalSignVerified((prev) => !prev)}
                          className={`w-full rounded-lg border px-3 py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold transition-colors ${
                            simDigitalSignVerified
                              ? 'border-[#A7F3D0] bg-[#D1FAE5]/70 text-[#065F46]'
                              : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {simDigitalSignVerified
                              ? 'موثق بنجاح (DocuSign / نفاذ)'
                              : 'بانتظار التوقيع الرقمي'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Final Discount Negotiation Summary (Notes) */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 p-3 space-y-1.5">
                      <label className="block text-[11px] font-bold text-[#334155]">
                        ملخص تفاوض الخصم النهائي (ملاحظات)
                      </label>
                      <textarea
                        rows={2}
                        value={simNotes}
                        onChange={(e) => setSimNotes(e.target.value)}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-[11.5px] font-medium text-[#0F172A] leading-relaxed focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 2B. LOCKED FORM OVERLAY (Centered Lock Card when Junior Rep is selected) */}
                  {simRoleMode === 'unauthorized' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-[#FECDD3] bg-[#FFFFFF]/55 backdrop-blur-[2px] p-5">
                      <div className="max-w-md text-center space-y-2.5">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFE4E6] text-[#DC2626] shadow-2xs">
                          <Lock className="h-5 w-5" />
                        </div>

                        <h5 className="text-[15px] font-extrabold text-[#991B1B]">
                          النموذج مغلق وغير قابل للتعديل
                        </h5>

                        <p className="text-[11.5px] text-[#475569] leading-relaxed">
                          يتطلب صلاحيات مدير المبيعات الإقليمي أو مسؤول كبار العملاء لتعديل أو اعتماد حقول هذا الانتقال.
                        </p>

                        <div className="pt-1">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-1 font-mono text-[10.5px] font-extrabold text-[#334155] shadow-2xs"
                            dir="ltr"
                          >
                            <Lock className="h-3 w-3 text-[#D97706]" />
                            <span>READ-ONLY MODE (POLICY ENFORCED)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LEFT COLUMN (5 cols in 12-col grid): "لوحة فحص قواعد الأتمتة (Diagnostics)" */}
              <div className="lg:col-span-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/75 p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Diagnostics Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                    <div className="flex items-center gap-2">
                      {simRoleMode === 'unauthorized' ? (
                        <AlertTriangle className="h-4 w-4 text-[#DC2626] shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                      )}
                      <h4 className="text-[13px] font-extrabold text-[#0F172A]">
                        لوحة فحص قواعد الأتمتة (Diagnostics)
                      </h4>
                    </div>

                    {simRoleMode === 'unauthorized' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-[10px] font-extrabold text-[#B91C1C] leading-tight">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                        <span>فشل التحقق (1 انتهاك)</span>
                      </span>
                    ) : (
                      <span
                        className={`rounded-lg border px-2.5 py-1 text-[10px] font-extrabold text-center leading-tight ${
                          isSimReadyToPass
                            ? 'border-[#A7F3D0] bg-[#FFFFFF] text-[#059669]'
                            : 'border-[#FECDD3] bg-[#FFF1F2] text-[#DC2626]'
                        }`}
                      >
                        <span className="block font-mono">100%</span>
                        <span>نجاح</span>
                      </span>
                    )}
                  </div>

                  {/* 3 Live Diagnostic Check Rows */}
                  <div className="space-y-2 text-[11.5px]">
                    {/* Check 1: Role Permission Check */}
                    <div
                      className={`flex items-center justify-between rounded-xl border bg-[#FFFFFF] px-3 py-2 ${
                        simRoleMode === 'unauthorized'
                          ? 'border-[#FCA5A5] border-r-4 border-r-[#DC2626]'
                          : 'border-[#E2E8F0]'
                      }`}
                    >
                      <span className="font-semibold text-[#334155]">
                        فحص صلاحيات الدور الوظيفي:
                      </span>
                      {simRoleMode === 'authorized' ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-[#059669]">
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>مطابق ومصرح ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-extrabold text-[#DC2626]">
                          <span>⊗ غير مصرح (Junior Rep) ✕</span>
                        </span>
                      )}
                    </div>

                    {/* Check 2: Mandatory Fields Check */}
                    <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2">
                      <span className="font-semibold text-[#334155]">
                        فحص الحقول الإلزامية:
                      </span>
                      {simRoleMode === 'unauthorized' ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-[#B45309]">
                          <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
                          <span>6 من 6 (محجوبة الإرسال)</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-extrabold ${
                            completedSimFieldsCount === 6
                              ? 'text-[#059669]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>{completedSimFieldsCount} من 6 مكتملة ✓</span>
                        </span>
                      )}
                    </div>

                    {/* Check 3: Path Integrity / Deadlocks Check */}
                    <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2">
                      <span className="font-semibold text-[#334155]">
                        سلامة المسار (Deadlocks Check):
                      </span>
                      <span className="inline-flex items-center gap-1 font-extrabold text-[#059669]">
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>لا توجد حلقات مفرغة ✓</span>
                      </span>
                    </div>
                  </div>

                  {/* Post-Actions Trigger Preview */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[11.5px] font-extrabold text-[#0F172A]">
                        معاينة تشغيل الأتمتة اللاحقة (Post-Actions):
                      </h5>
                      {simRoleMode === 'unauthorized' && (
                        <span className="rounded bg-[#FFE4E6] px-2 py-0.5 text-[9.5px] font-extrabold text-[#B91C1C]">
                          معلقة - موقوفة
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {[
                        'إشعار مباركة في واتساب وقناة مبيعات سلاك',
                        'تحديث حالة الحساب في موديول الشركات إلى «استراتيجي نشط»',
                        'إنشاء مشروع جديد ومهمة تشغيل تلقائية لفريق التنفيذ',
                        'تصدير الفاتورة الضريبية إلى نظام ERP (متوافق مع زاتكا)',
                      ].map((actionText, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                simRoleMode === 'unauthorized'
                                  ? 'bg-[#94A3B8]'
                                  : 'bg-[#059669]'
                              }`}
                            />
                            <span
                              className={`font-semibold truncate ${
                                simRoleMode === 'unauthorized'
                                  ? 'text-[#64748B]'
                                  : 'text-[#334155]'
                              }`}
                            >
                              {actionText}
                            </span>
                          </div>

                          {simRoleMode === 'unauthorized' && (
                            <span className="text-[10px] font-extrabold text-[#DC2626] shrink-0">
                              لن ينفذ
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Readiness Status Banner */}
                {isSimReadyToPass ? (
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-extrabold text-[#065F46]">
                        المسار سليم وجاهز للنشر 100%
                      </p>
                      <p className="text-[10.5px] text-[#047857] leading-relaxed">
                        كافة القواعد الشرطية والشروط الصارمة تعمل بدون أي تعارض في البلوبرينت.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#FCA5A5] bg-[#FFF1F2] p-3.5 flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-[#FFFFFF]">
                      ✕
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-extrabold text-[#991B1B]">
                        {simRoleMode === 'unauthorized'
                          ? 'الانتقال محجوب بحكم سياسة الحوكمة والصلاحيات'
                          : 'الانتقال متوقف: توجد حقول إلزامية غير مكتملة'}
                      </p>
                      <p className="text-[10.5px] text-[#7F1D1D] leading-relaxed">
                        {simRoleMode === 'unauthorized'
                          ? 'تم قفل مسار الانتقال تلقائياً لأن قاعدة الدور الوظيفي غير مستوفاة في مصفوفة الصلاحيات (RACI).'
                          : 'يجب استيفاء جميع الحقول الـ 6 الإلزامية قبل السماح بالانتقال.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dry Run Execution Feedback Strip (when clicked) */}
            {simDryRunResult !== 'idle' && (
              <div
                className={`mx-6 mb-3 rounded-xl border px-4 py-2.5 flex items-center justify-between text-[12px] font-bold ${
                  simDryRunResult === 'passed'
                    ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                    : 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {simDryRunResult === 'passed'
                      ? `تم تنفيذ الانتقال التجريبي (Dry Run) بنجاح على «${currentSimDeal.title}» دون المساس بقاعدة بيانات الإنتاج.`
                      : 'تم منع الانتقال التجريبي بنجاح وفق قواعد الحماية الصارمة في البلوبرينت.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSimDryRunResult('idle')}
                  className="text-current opacity-75 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* 3. MODAL FOOTER ACTIONS */}
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
              {/* Right Side Status Indicator */}
              {simRoleMode === 'unauthorized' ? (
                <div className="flex items-center gap-2 text-[11.5px] font-extrabold text-[#B91C1C]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                  <Lock className="h-3.5 w-3.5 text-[#DC2626]" />
                  <span>
                    الحالة: محجوب أمنياً — غير قابل للتنفيذ (Blocked by Policy)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11.5px] font-bold text-[#334155]">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isSimReadyToPass ? 'bg-[#059669]' : 'bg-[#DC2626]'
                    }`}
                  />
                  <span>
                    {isSimReadyToPass
                      ? 'الحالة: جاهز للتنفيذ الوهمي (Ready for Dry Run)'
                      : 'الحالة: محظور بواسطة قواعد التحقق (Blocked by Guardrails)'}
                  </span>
                </div>
              )}

              {/* Left Side Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSimulationOpen(false)}
                  className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F1F5F9] px-4 py-2 text-[12px] font-bold text-[#334155] transition-colors"
                >
                  إلغاء وإغلاق
                </button>

                {simRoleMode === 'unauthorized' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setToastMsg(
                          'تم إرسال طلب إذن استثنائي وتصعيد المعاملة إلى مدير المبيعات الإقليمي (Request Override Sent)'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#93C5FD] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-4 py-2 text-[12px] font-extrabold text-[#1D4ED8] transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>طلب إذن استثنائي / تصعيد للمدير (Request Override)</span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#E2E8F0]/80 px-4 py-2 text-[12px] font-bold text-[#64748B] cursor-not-allowed"
                    >
                      <Lock className="h-3.5 w-3.5 text-[#64748B]" />
                      <span>تنفيذ الانتقال التجريبي</span>
                      <span className="rounded bg-[#FFE4E6] px-2 py-0.5 text-[10px] font-extrabold text-[#DC2626]">
                        محجوب (Disabled)
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCycleSimDeal}
                      className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-4 py-2 text-[12px] font-extrabold text-[#1D4ED8] transition-colors"
                    >
                      اختبار مع صفقة أخرى
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteDryRun}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>تنفيذ الانتقال التجريبي (Execute Dry Run)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal ("سجل الإصدارات") */}
      {versionHistoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                سجل إصدارات البلوبرينت (BP-CORP-9402)
              </h3>
              <button
                type="button"
                onClick={() => setVersionHistoryOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-[12px]">
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-3 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-[#0F172A]">الإصدار v3.2 (الحالي)</p>
                  <p className="text-[11px] text-[#64748B]">
                    إضافة التحقق الإلزامي لوثيقة العقد الموقعة وتوقيع نفاذ/DocuSign
                  </p>
                </div>
                <span className="rounded bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-[#FFFFFF]">
                  نشط
                </span>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0F172A]">الإصدار v3.1</p>
                  <p className="text-[11px] text-[#64748B]">
                    ربط أتمتة Meta CAPI وإشعارات فريق المالية بعد الإغلاق
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">قبل أسبوعين</span>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0F172A]">الإصدار v3.0</p>
                  <p className="text-[11px] text-[#64748B]">
                    تأسيس المراحل الـ 6 الأساسية لمبيعات المؤسسات B2B
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">قبل شهر</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setVersionHistoryOpen(false)}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-bold text-[#FFFFFF]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Rules Editor Modal ("تعديل قواعد الانتقال — إتمام التعاقد والفوز (Close Won)") */}
      {transitionEditorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 backdrop-blur-[2px] p-3 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transition-rules-editor-title"
        >
          <div className="w-full max-w-[1040px] rounded-2xl border border-[#CBD5E1] bg-[#FFFFFF] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* 1. MODAL HEADER & STEP PROGRESS BAR */}
            <div className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 pt-4 pb-3 space-y-3 shrink-0">
              {/* Row 1: Title + Transition ID + Reset & Close */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Right: Shield Icon + Title + Critical Badge + Subtitle */}
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2
                        id="transition-rules-editor-title"
                        className="text-[17px] sm:text-[19px] font-extrabold text-[#0F172A]"
                      >
                        تعديل قواعد الانتقال — {selectedTransition.shortTitle} (
                        {selectedTransition.englishName})
                      </h2>

                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6EE7B7] bg-[#D1FAE5] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#065F46]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                        <span>انتقال حاسم للنظام (Stage 4 → Stage 5)</span>
                      </span>
                    </div>

                    <p className="text-[11.5px] text-[#475569]">
                      معرّف الانتقال:{' '}
                      <strong className="font-mono font-extrabold text-[#0F172A]">
                        {selectedTransition.code}-WON
                      </strong>{' '}
                      • ينقل مسار الصفقة تلقائياً من{' '}
                      <strong className="font-bold text-[#0F172A]">
                        [4. التفاوض ومراجعة العقود]
                      </strong>{' '}
                      إلى{' '}
                      <strong className="font-bold text-[#0F172A]">
                        [{selectedTransition.toStageBadge}]
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Left: Reset Rules + Close X */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetInspectorDefaults();
                      setEditorButtonLabel('إتمام التعاقد والفوز (Close Won)');
                      setEditorButtonStyle('emerald');
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#475569] hover:text-[#0F172A] transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>إعادة تعيين القواعد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransitionEditorOpen(false)}
                    aria-label="إغلاق محرر قواعد الانتقال"
                    className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Direct Path Visual Strip */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#64748B]">سير الانتقال المباشر:</span>

                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 font-extrabold text-[#0F172A] shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                    <span>4. التفاوض ومراجعة العقود</span>
                  </span>

                  <span className="text-[#64748B] font-bold">←</span>

                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6EE7B7] bg-[#D1FAE5]/80 px-2.5 py-1 font-extrabold text-[#065F46]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>زر: {selectedTransition.shortTitle}</span>
                  </span>

                  <span className="text-[#64748B] font-bold">←</span>

                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#047857] px-2.5 py-1 font-extrabold text-[#FFFFFF]">
                    <span className="h-2 w-2 rounded-full bg-[#FFFFFF]" />
                    <span>5. إتمام التعاقد والفوز (فوز نهائي)</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[#475569]">
                  <span>محرك مطابقة الشروط:</span>
                  <span className="font-mono font-extrabold text-[#0F172A]" dir="ltr">
                    Zoho Blueprint Engine v4.2
                  </span>
                </div>
              </div>

              {/* Row 3: Section Jump Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Tab A: الصلاحيات والمظهر */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveTab('a');
                      sectionARef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-extrabold transition-colors ${
                      editorActiveTab === 'a'
                        ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>الصلاحيات والمظهر</span>
                    <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-extrabold text-[#1E40AF]">
                      {selectedTransition.roles.length} أدوار
                    </span>
                  </button>

                  {/* Tab B: الشروط المسبقة (Before Criteria) */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveTab('b');
                      sectionBRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-extrabold transition-colors ${
                      editorActiveTab === 'b'
                        ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>الشروط المسبقة (Before Criteria)</span>
                    <span className="rounded bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF]">
                      {editorCriteriaRows.length} شروط نشطة
                    </span>
                  </button>

                  {/* Tab C: الحقول الإلزامية (During Transition) */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveTab('c');
                      sectionCRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-extrabold transition-colors ${
                      editorActiveTab === 'c'
                        ? 'border-[#059669] bg-[#ECFDF5] text-[#047857]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>الحقول الإلزامية (During Transition)</span>
                    <span className="rounded bg-[#047857] px-1.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF]">
                      {selectedTransition.duringFields.filter((f) => f.enabled).length + 1} حقول مفروضة
                    </span>
                  </button>

                  {/* Tab D: الأتمتة اللاحقة (After Actions) */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveTab('d');
                      sectionDRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-extrabold transition-colors ${
                      editorActiveTab === 'd'
                        ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4338CA]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>الأتمتة اللاحقة (After Actions)</span>
                    <span className="rounded bg-[#4F46E5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF]">
                      4 مهام تلقائية
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px] text-[#64748B]">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>كل الشروط إلزامية لتفعيل زر الانتقال في شاشة المندوب</span>
                </div>
              </div>
            </div>

            {/* 2. SCROLLABLE 4-SECTION EDITOR BODY */}
            <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 space-y-5">
              {/* =================================================================
                  SECTION A: مظهر زر الانتقال والصلاحيات الوظيفية المسموحة
                 ================================================================= */}
              <section
                ref={sectionARef}
                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#DBEAFE] font-mono text-[12px] font-extrabold text-[#1E40AF]">
                      A
                    </span>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      مظهر زر الانتقال والصلاحيات الوظيفية المسموحة
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    يحدد شكل الزر في واجهة البائع والأشخاص المخولين بالضغط عليه
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Col 1 (Right): Button Label Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[11.5px] font-extrabold text-[#334155]">
                      اسم زر الانتقال المعروض
                    </label>
                    <div className="relative flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF]">
                      <input
                        type="text"
                        value={editorButtonLabel}
                        onChange={(e) => setEditorButtonLabel(e.target.value)}
                        className="w-full bg-transparent text-[12.5px] font-extrabold text-[#0F172A] focus:outline-none"
                      />
                      <Pencil className="h-3.5 w-3.5 text-[#64748B] shrink-0 mr-2" />
                    </div>
                    <p className="text-[10.5px] text-[#64748B]">
                      يظهر هذا الاسم كإجراء أساسي متاح باللون المختار
                    </p>
                  </div>

                  {/* Col 2 (Center): Button Color/Style Picker + Live Button Preview */}
                  <div className="space-y-1.5">
                    <label className="block text-[11.5px] font-extrabold text-[#334155]">
                      نمط ولون الزر في مسار العميل
                    </label>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditorButtonStyle((prev) =>
                            prev === 'emerald'
                              ? 'blue'
                              : prev === 'blue'
                              ? 'rose'
                              : 'emerald'
                          )
                        }
                        className="inline-flex items-center gap-2 text-[12px] font-extrabold text-[#0F172A]"
                      >
                        <span
                          className={`h-4 w-4 rounded ${
                            editorButtonStyle === 'emerald'
                              ? 'bg-[#047857]'
                              : editorButtonStyle === 'blue'
                              ? 'bg-[#2563EB]'
                              : 'bg-[#E11D48]'
                          }`}
                        />
                        <span>
                          {editorButtonStyle === 'emerald'
                            ? 'أخضر زمردي داكن'
                            : editorButtonStyle === 'blue'
                            ? 'أزرق ملكي أساسي'
                            : 'أحمر تحذيري للخسارة'}
                        </span>
                      </button>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold text-[#FFFFFF] shadow-2xs ${
                          editorButtonStyle === 'emerald'
                            ? 'bg-[#047857]'
                            : editorButtonStyle === 'blue'
                            ? 'bg-[#2563EB]'
                            : 'bg-[#E11D48]'
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>معاينة الزر</span>
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#64748B]">
                      أيقونة مرافقة:{' '}
                      <strong className="font-mono text-[#0F172A]">verified</strong>
                    </p>
                  </div>

                  {/* Col 3 (Left): Allowed Roles Multi-select Chips */}
                  <div className="space-y-1.5">
                    <label className="block text-[11.5px] font-extrabold text-[#334155]">
                      الأدوار المسموح لها بتنفيذ الانتقال
                    </label>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 flex flex-wrap items-center gap-1.5 relative">
                      {selectedTransition.roles.map((rName) => (
                        <span
                          key={rName}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-bold text-[#0F172A] shadow-2xs"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
                          <span>{rName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRole(rName)}
                            className="text-[#64748B] hover:text-[#DC2626]"
                            aria-label={`إزالة دور ${rName}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}

                      <button
                        type="button"
                        onClick={() => setEditorRoleDropdownOpen((prev) => !prev)}
                        className="px-2 py-1 text-[11px] font-extrabold text-[#2563EB] hover:underline"
                      >
                        + إضافة دور وظيفي
                      </button>

                      {editorRoleDropdownOpen && (
                        <div className="absolute left-2 top-full mt-1 z-30 w-56 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-xl">
                          {rolePool.map((candidate) => (
                            <button
                              key={candidate}
                              type="button"
                              onClick={() => {
                                handleAddRole(candidate);
                                setEditorRoleDropdownOpen(false);
                              }}
                              className="block w-full rounded-lg px-2.5 py-1.5 text-right text-[11px] font-bold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                            >
                              {candidate}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[10.5px] text-[#64748B]">
                      لن يظهر الزر للبائعين الذين لا يحملون هذه الرتب الوظيفية
                    </p>
                  </div>
                </div>
              </section>

              {/* =================================================================
                  SECTION B: الشروط المسبقة للاستحقاق (Before Transition Criteria)
                 ================================================================= */}
              <section
                ref={sectionBRef}
                className="rounded-2xl border-2 border-[#93C5FD] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2563EB] font-mono text-[12px] font-extrabold text-[#FFFFFF]">
                      B
                    </span>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      الشروط المسبقة للاستحقاق (Before Transition Criteria)
                    </h3>
                    <span className="rounded bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-extrabold text-[#1E40AF]">
                      إلزامية ومحققة برمجياً
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEditorCriterionRow}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3 py-1.5 text-[11px] font-extrabold text-[#1D4ED8] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة شرط استحقاق</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editorCriteriaRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 flex flex-wrap items-center justify-between gap-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E2E8F0] font-mono text-[11px] font-extrabold text-[#334155]">
                          {idx + 1}
                        </span>

                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditorCriteriaRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, logic: r.logic === 'AND' ? 'OR' : 'AND' }
                                    : r
                                )
                              )
                            }
                            className="rounded-md bg-[#2563EB] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#FFFFFF]"
                          >
                            {row.logic}
                          </button>
                        )}

                        <input
                          type="text"
                          value={row.field}
                          onChange={(e) =>
                            setEditorCriteriaRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, field: e.target.value } : r
                              )
                            )
                          }
                          className="min-w-[210px] flex-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11.5px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                        />

                        <select
                          value={row.operator}
                          onChange={(e) =>
                            setEditorCriteriaRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, operator: e.target.value } : r
                              )
                            )
                          }
                          className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] font-extrabold text-[#2563EB] focus:border-[#2563EB] focus:outline-none"
                        >
                          <option value="== (يساوي)">== (يساوي)</option>
                          <option value="<= (أقل أو يساوي)">&lt;= (أقل أو يساوي)</option>
                          <option value=">= (أكبر أو يساوي)">&gt;= (أكبر أو يساوي)</option>
                          <option value="!= (غير فارغ)">!= (غير فارغ)</option>
                        </select>

                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) =>
                            setEditorCriteriaRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, value: e.target.value } : r
                              )
                            )
                          }
                          className="min-w-[160px] flex-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11.5px] font-extrabold text-[#047857] focus:border-[#2563EB] focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEditorCriterionRow(row.id)}
                        aria-label="حذف الشرط"
                        className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* =================================================================
                  SECTION C: الحقول الإلزامية أثناء الانتقال (During Transition Fields)
                 ================================================================= */}
              <section
                ref={sectionCRef}
                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#047857] font-mono text-[12px] font-extrabold text-[#FFFFFF]">
                      C
                    </span>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      الحقول الإلزامية أثناء الانتقال (During Transition Fields)
                    </h3>
                    <span className="rounded bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                      قابلة لإعادة الترتيب والتحقق الصارم
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditorNewFieldOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-3 py-1.5 text-[11px] font-extrabold text-[#047857] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة حقل إلزامي</span>
                  </button>
                </div>

                {editorNewFieldOpen && (
                  <form
                    onSubmit={handleAddEditorRequiredField}
                    className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3 flex flex-wrap items-center gap-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={editorNewFieldName}
                      onChange={(e) => setEditorNewFieldName(e.target.value)}
                      placeholder="اسم الحقل الإلزامي (مثال: رقم الضمان البنكي)"
                      className="flex-1 min-w-[200px] rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px] text-[#0F172A] focus:border-[#059669] focus:outline-none"
                    />
                    <select
                      value={editorNewFieldType}
                      onChange={(e) => setEditorNewFieldType(e.target.value)}
                      className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11.5px] font-bold text-[#0F172A]"
                    >
                      <option value="نص إلزامي">نص إلزامي</option>
                      <option value="مرفق إلزامي PDF">مرفق إلزامي PDF</option>
                      <option value="تاريخ ميلادي">تاريخ ميلادي</option>
                      <option value="قائمة منسدلة">قائمة منسدلة</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#059669] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#FFFFFF]"
                    >
                      حفظ الحقل
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {selectedTransition.duringFields.map((fld, idx) => (
                    <div
                      key={fld.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveDuringField(idx, 'up')}
                            disabled={idx === 0}
                            className="text-[10px] font-bold text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                            title="تحريك لأعلى"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDuringField(idx, 'down')}
                            disabled={idx === selectedTransition.duringFields.length - 1}
                            className="text-[10px] font-bold text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                            title="تحريك لأسفل"
                          >
                            ▼
                          </button>
                        </div>

                        <input
                          type="checkbox"
                          checked={fld.enabled}
                          onChange={() => handleToggleDuringField(fld.id)}
                          className="h-4 w-4 rounded border-[#CBD5E1] text-[#059669] focus:ring-[#059669]"
                        />

                        <div>
                          <p className="text-[12.5px] font-extrabold text-[#0F172A]">
                            {fld.title}
                          </p>
                          <p className="text-[10.5px] text-[#64748B]">{fld.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {fld.id === 'fld_po_number' && (
                          <div className="flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[10.5px]">
                            <span className="text-[#64748B] font-semibold">Regex:</span>
                            <input
                              type="text"
                              value={editorPoRegex}
                              onChange={(e) => setEditorPoRegex(e.target.value)}
                              dir="ltr"
                              className="w-20 font-mono font-extrabold text-[#2563EB] focus:outline-none"
                            />
                          </div>
                        )}

                        <span
                          className={`rounded-md px-2.5 py-0.5 text-[10px] font-extrabold ${
                            fld.badgeTone === 'danger'
                              ? 'bg-[#FFE4E6] text-[#E11D48]'
                              : fld.badgeTone === 'info'
                              ? 'bg-[#DBEAFE] text-[#1E40AF]'
                              : 'bg-[#E2E8F0] text-[#334155]'
                          }`}
                        >
                          {fld.badgeText}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Digital Signature Requirement Toggle Bar */}
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-4 w-4 text-[#059669] shrink-0" />
                      <div>
                        <p className="text-[12px] font-extrabold text-[#065F46]">
                          التحقق من التوقيع الرقمي المعتمد (DocuSign / منصة نفاذ الوطنية)
                        </p>
                        <p className="text-[10.5px] text-[#047857]">
                          منع إغلاق الصفقة إلا بعد استلام رمز التصديق الرقمي للوثيقة المرفقة
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={selectedTransition.requireDigitalSignature}
                      onChange={(e) =>
                        updateSelectedTransition((tr) => ({
                          ...tr,
                          requireDigitalSignature: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-[#059669] text-[#059669] focus:ring-[#059669]"
                    />
                  </div>
                </div>
              </section>

              {/* =================================================================
                  SECTION D: الأتمتة اللاحقة (After Actions)
                 ================================================================= */}
              <section
                ref={sectionDRef}
                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#4F46E5] font-mono text-[12px] font-extrabold text-[#FFFFFF]">
                      D
                    </span>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      الأتمتة اللاحقة بعد إتمام الانتقال (After Actions)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    تعمل بالخلفية فور نقر المندوب وحفظ الانتقال
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Toggle 1: WhatsApp & Slack Notifications */}
                  <label className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:border-[#CBD5E1]">
                    <div className="space-y-1">
                      <p className="text-[12.5px] font-extrabold text-[#0F172A]">
                        إشعارات واتساب وسلاك الفورية (#deals-won)
                      </p>
                      <p className="text-[10.5px] text-[#64748B]">
                        إرسال رسالة تهنئة للفريق وإشعار العميل ببدء إجراءات التعاقد
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editorAfterToggles.notifications}
                      onChange={(e) =>
                        setEditorAfterToggles((prev) => ({
                          ...prev,
                          notifications: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                  </label>

                  {/* Toggle 2: Onboarding Task */}
                  <label className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:border-[#CBD5E1]">
                    <div className="space-y-1">
                      <p className="text-[12.5px] font-extrabold text-[#0F172A]">
                        توليد مهمة تسليم وتدشين المشروع (Onboarding Task)
                      </p>
                      <p className="text-[10.5px] text-[#64748B]">
                        إنشاء مهمة عمل تلقائية لفريق تسليم المشاريع وإسنادها لمدير التنفيذ
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editorAfterToggles.onboardingTask}
                      onChange={(e) =>
                        setEditorAfterToggles((prev) => ({
                          ...prev,
                          onboardingTask: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                  </label>

                  {/* Toggle 3: Meta CAPI Purchase Event */}
                  <label className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:border-[#CBD5E1]">
                    <div className="space-y-1">
                      <p className="text-[12.5px] font-extrabold text-[#0F172A]">
                        حدث الشراء في Meta Conversions API (CAPI Purchase)
                      </p>
                      <p className="text-[10.5px] text-[#64748B]">
                        مزامنة قيمة الصفقة الفعلية ومعرف RWQ مع خادم ميتا لتحسين الحملات
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editorAfterToggles.metaCapiPurchase}
                      onChange={(e) =>
                        setEditorAfterToggles((prev) => ({
                          ...prev,
                          metaCapiPurchase: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                  </label>

                  {/* Toggle 4: Sales Order & ERP Generation */}
                  <label className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:border-[#CBD5E1]">
                    <div className="space-y-1">
                      <p className="text-[12.5px] font-extrabold text-[#0F172A]">
                        توليد أمر بيع ومسودة فاتورة ضريبية (Sales Order &amp; ERP)
                      </p>
                      <p className="text-[10.5px] text-[#64748B]">
                        إنشاء أمر البيع تلقائياً ومزامنة الفاتورة مع نظام المحاسبة وزاتكا
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editorAfterToggles.salesOrderGeneration}
                      onChange={(e) =>
                        setEditorAfterToggles((prev) => ({
                          ...prev,
                          salesOrderGeneration: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                  </label>
                </div>
              </section>
            </div>

            {/* 3. STICKY FOOTER */}
            <div className="border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Right: Live Schema Validation Badge */}
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#065F46]">
                <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                <span>Valid Schema ✓ — بنية القواعد متوافقة وجاهزة للتطبيق</span>
              </div>

              {/* Left: Seller Preview + Save & Apply to Firestore */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSellerPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-4 py-2 text-[12px] font-extrabold text-[#0F172A] transition-colors"
                >
                  <Eye className="h-4 w-4 text-[#475569]" />
                  <span>معاينة شاشة البائع</span>
                </button>

                <button
                  type="button"
                  disabled={savingToFirestore}
                  onClick={() => void handleSaveTransitionEditorRules()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {savingToFirestore
                      ? 'جاري الحفظ في Firestore...'
                      : 'حفظ وتطبيق القواعد'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-[12px] font-semibold text-[#FFFFFF] shadow-xl"
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
