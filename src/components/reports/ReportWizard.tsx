import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns,
  Filter,
  GitMerge,
  Grid,
  Layers,
  List,
  Plus,
  Sparkles,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AggregateFunction,
  BucketColumn,
  BucketRange,
  DateGroupingGranularity,
  FilterOperator,
  FormulaColumn,
  JoinType,
  ModuleName,
  RelatedModuleJoin,
  ReportAggregationSpec,
  ReportChartType,
  ReportCriterion,
  ReportDefinition,
  ReportFolder,
  ReportGroupingField,
  ReportSharingConfig,
  ReportType,
  UserSecurityContext,
} from '../../types/reports';

export interface ReportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialReport?: ReportDefinition | null;
  isCloneMode?: boolean;
  folders: ReportFolder[];
  defaultFolderId?: string;
  security?: UserSecurityContext;
  onSaveReport: (report: ReportDefinition, runImmediately: boolean) => void;
}

interface ModuleFieldMeta {
  name: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean';
}

interface ModuleMetadataConfig {
  module: ModuleName;
  label: string;
  description: string;
  relatedOptions: Array<{
    module: ModuleName;
    label: string;
    foreignKey: string;
    relationshipHint: string;
  }>;
  fields: ModuleFieldMeta[];
}

export const MODULE_METADATA_CATALOG: Record<ModuleName, ModuleMetadataConfig> = {
  leads: {
    module: 'leads',
    label: 'العملاء المحتملين (Leads)',
    description: 'سجلات الاستقطاب الأولي من إعلانات ميتا، واتساب، والموقع الإلكتروني',
    relatedOptions: [
      {
        module: 'touchpoints',
        label: 'نقاط التفاعل الإعلانية (Touchpoints)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N عبر المعرف الموحد RWQ',
      },
      {
        module: 'deals',
        label: 'الصفقات الناتجة (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N الصفقات المحولة من العميل',
      },
      {
        module: 'tasks',
        label: 'المهام والمتابعات (Tasks)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N أنشطة المتابعة',
      },
    ],
    fields: [
      { name: 'unique_id', label: 'معرف العميل (RWQ-ID)', type: 'text' },
      { name: 'name', label: 'اسم العميل المحتمل', type: 'text' },
      { name: 'company', label: 'الشركة / الجهة', type: 'text' },
      { name: 'phone', label: 'رقم الجوال', type: 'text' },
      { name: 'email', label: 'البريد الإلكتروني', type: 'text' },
      { name: 'source', label: 'المصدر الإعلاني', type: 'text' },
      { name: 'status', label: 'حالة التأهيل', type: 'text' },
      { name: 'valueSAR', label: 'القيمة المتوقعة (ر.س)', type: 'currency' },
      { name: 'daysWithoutFollowUp', label: 'أيام بدون متابعة', type: 'number' },
      { name: 'ownerName', label: 'مسؤول المبيعات', type: 'text' },
      { name: 'createdAt', label: 'تاريخ الإنشاء', type: 'date' },
    ],
  },
  contacts: {
    module: 'contacts',
    label: 'جهات الاتصال (Contacts)',
    description: 'أصحاب القرار والمشترون المعتمدون المرتبطون بالشركات والحسابات',
    relatedOptions: [
      {
        module: 'accounts',
        label: 'الشركات والحسابات (Accounts)',
        foreignKey: 'accountId',
        relationshipHint: 'N:1 الشركة الأم لجهة الاتصال',
      },
      {
        module: 'touchpoints',
        label: 'نقاط التفاعل الإعلانية (Touchpoints)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N رحلة التفاعل الإعلاني',
      },
      {
        module: 'deals',
        label: 'الصفقات المرتبطة (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N صفقات جهة الاتصال',
      },
      {
        module: 'order_attributions',
        label: 'إسناد الطلبات المتكررة (Order Attributions)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N عمليات الشراء المتكررة',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف RWQ الموحد', type: 'text' },
      { name: 'name', label: 'اسم جهة الاتصال', type: 'text' },
      { name: 'roleTitle', label: 'المسمى الوظيفي', type: 'text' },
      { name: 'company', label: 'اسم الشركة', type: 'text' },
      { name: 'phone', label: 'رقم الجوال', type: 'text' },
      { name: 'email', label: 'البريد الإلكتروني', type: 'text' },
      { name: 'city', label: 'المدينة', type: 'text' },
      { name: 'ownerName', label: 'المسؤول', type: 'text' },
      { name: 'createdAt', label: 'تاريخ الإضافة', type: 'date' },
    ],
  },
  accounts: {
    module: 'accounts',
    label: 'الشركات والحسابات (Accounts)',
    description: 'المنشآت والشركات المتعاقدة والمستهدفة في قطاع الأعمال B2B',
    relatedOptions: [
      {
        module: 'contacts',
        label: 'جهات الاتصال (Contacts)',
        foreignKey: 'accountId',
        relationshipHint: '1:N ممثلو الشركة',
      },
      {
        module: 'deals',
        label: 'الصفقات والعقود (Deals)',
        foreignKey: 'accountId',
        relationshipHint: '1:N صفقات الشركة',
      },
      {
        module: 'invoices',
        label: 'الفواتير الضريبية (Invoices)',
        foreignKey: 'accountName',
        relationshipHint: '1:N فواتير المنشأة',
      },
    ],
    fields: [
      { name: 'name', label: 'اسم الشركة / الحساب', type: 'text' },
      { name: 'industry', label: 'القطاع الاقتصادي', type: 'text' },
      { name: 'city', label: 'المدينة / المقر', type: 'text' },
      { name: 'annualRevenue', label: 'الإيرادات السنوية (ر.س)', type: 'currency' },
      { name: 'employeesCount', label: 'عدد الموظفين', type: 'number' },
      { name: 'ownerName', label: 'مدير الحساب', type: 'text' },
      { name: 'createdAt', label: 'تاريخ التسجيل', type: 'date' },
    ],
  },
  deals: {
    module: 'deals',
    label: 'الصفقات والمبيعات (Deals)',
    description: 'فرص البيع الجارية والمغلقة عبر مراحل القمع البيعي',
    relatedOptions: [
      {
        module: 'order_attributions',
        label: 'إسناد الطلبات المتكررة (Order Attribution)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N تتبع الطلبات المتعددة 1..10+',
      },
      {
        module: 'stage_history',
        label: 'سجل انتقال المراحل (Stage History)',
        foreignKey: 'dealId',
        relationshipHint: '1:N زمن البقاء وسرعة الدوران',
      },
      {
        module: 'touchpoints',
        label: 'نقاط التفاعل الإعلانية (Touchpoints)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N مصادر الإسناد الإعلاني',
      },
      {
        module: 'quotes',
        label: 'عروض الأسعار (Quotes)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N العروض المالية للصفقة',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ-ID)', type: 'text' },
      { name: 'title', label: 'عنوان الصفقة', type: 'text' },
      { name: 'accountName', label: 'الشركة / الحساب', type: 'text' },
      { name: 'stage', label: 'مرحلة الصفقة', type: 'text' },
      { name: 'amount', label: 'قيمة الصفقة (ر.س)', type: 'currency' },
      { name: 'probability', label: 'احتمالية الإغلاق (%)', type: 'number' },
      { name: 'closeDate', label: 'تاريخ الإغلاق المتوقع', type: 'date' },
      { name: 'lossReason', label: 'سبب الخسارة (إن وجد)', type: 'text' },
      { name: 'ownerName', label: 'مسؤول الصفقة', type: 'text' },
    ],
  },
  touchpoints: {
    module: 'touchpoints',
    label: 'نقاط التفاعل الإعلاني (Touchpoints)',
    description: 'سجل نقرات وتفاعلات إعلانات Meta وGoogle ورسائل واتساب لكل عميل',
    relatedOptions: [
      {
        module: 'leads',
        label: 'العملاء المحتملين (Leads)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 العميل المرتبط بالتفاعل',
      },
      {
        module: 'deals',
        label: 'الصفقات (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N الصفقات الناتجة عن التفاعل',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ-ID)', type: 'text' },
      { name: 'campaignName', label: 'اسم الحملة الإعلانية', type: 'text' },
      { name: 'source', label: 'المصدر (Meta / Google / WA)', type: 'text' },
      { name: 'medium', label: 'الوسيط الإعلاني', type: 'text' },
      { name: 'adId', label: 'معرف الإعلان (Ad ID)', type: 'text' },
      { name: 'fbclid', label: 'معرف نقرة ميتا (fbclid)', type: 'text' },
      { name: 'isReengaged', label: 'إعادة استهداف', type: 'boolean' },
      { name: 'timestamp', label: 'تاريخ التفاعل', type: 'date' },
    ],
  },
  campaigns: {
    module: 'campaigns',
    label: 'الحملات التسويقية (Campaigns)',
    description: 'حملات واتساب الجماعية وحملات إعلانات ميتا الممولة وميزانياتها',
    relatedOptions: [
      {
        module: 'touchpoints',
        label: 'نقاط التفاعل (Touchpoints)',
        foreignKey: 'campaignName',
        relationshipHint: '1:N التفاعلات المسجلة للحملة',
      },
    ],
    fields: [
      { name: 'name', label: 'اسم الحملة التسويقية', type: 'text' },
      { name: 'channel', label: 'القناة (WhatsApp / Meta / IG)', type: 'text' },
      { name: 'status', label: 'حالة الحملة', type: 'text' },
      { name: 'spendSAR', label: 'الإنفاق الإعلاني (ر.س)', type: 'currency' },
      { name: 'revenueSAR', label: 'الإيرادات المحققة (ر.س)', type: 'currency' },
      { name: 'leadsGenerated', label: 'عدد العملاء المستقطبين', type: 'number' },
      { name: 'wonDealsCount', label: 'عدد الصفقات الرابحة', type: 'number' },
      { name: 'sentCount', label: 'عدد الرسائل المرسلة', type: 'number' },
    ],
  },
  quotes: {
    module: 'quotes',
    label: 'عروض الأسعار (Quotes)',
    description: 'العروض المالية والفنية المرسلة للعملاء وحالات اعتمادها',
    relatedOptions: [
      {
        module: 'sales_orders',
        label: 'أوامر البيع (Sales Orders)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N أوامر البيع المعتمدة من العرض',
      },
      {
        module: 'deals',
        label: 'الصفقات (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 الصفقة المرتبطة',
      },
    ],
    fields: [
      { name: 'quoteNumber', label: 'رقم عرض السعر', type: 'text' },
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'accountName', label: 'الشركة / العميل', type: 'text' },
      { name: 'status', label: 'حالة العرض', type: 'text' },
      { name: 'subtotalSAR', label: 'المبلغ قبل الخصم (ر.س)', type: 'currency' },
      { name: 'discountSAR', label: 'قيمة الخصم (ر.س)', type: 'currency' },
      { name: 'totalSAR', label: 'الصافي النهائي (ر.س)', type: 'currency' },
      { name: 'validUntil', label: 'تاريخ انتهاء الصلاحية', type: 'date' },
      { name: 'ownerName', label: 'المسؤول', type: 'text' },
    ],
  },
  sales_orders: {
    module: 'sales_orders',
    label: 'أوامر البيع (Sales Orders)',
    description: 'أوامر التوريد والتنفيذ المعتمدة بعد قبول عروض الأسعار',
    relatedOptions: [
      {
        module: 'invoices',
        label: 'الفواتير الضريبية (Invoices)',
        foreignKey: 'leadUniqueId',
        relationshipHint: '1:N الفواتير الصادرة لأمر البيع',
      },
    ],
    fields: [
      { name: 'orderNumber', label: 'رقم أمر البيع', type: 'text' },
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'accountName', label: 'الشركة', type: 'text' },
      { name: 'status', label: 'حالة التنفيذ', type: 'text' },
      { name: 'totalSAR', label: 'قيمة أمر البيع (ر.س)', type: 'currency' },
      { name: 'orderDate', label: 'تاريخ الأمر', type: 'date' },
      { name: 'ownerName', label: 'المسؤول', type: 'text' },
    ],
  },
  invoices: {
    module: 'invoices',
    label: 'الفواتير الضريبية (Invoices)',
    description: 'الفواتير الإلكترونية المعتمدة من ZATCA وحالات التحصيل وأعمار الديون',
    relatedOptions: [
      {
        module: 'accounts',
        label: 'الشركات (Accounts)',
        foreignKey: 'accountName',
        relationshipHint: 'N:1 الشركة المصدرة لها الفاتورة',
      },
    ],
    fields: [
      { name: 'invoiceNumber', label: 'رقم الفاتورة الضريبية', type: 'text' },
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'accountName', label: 'اسم المنشأة', type: 'text' },
      { name: 'status', label: 'حالة السداد', type: 'text' },
      { name: 'amountSAR', label: 'المبلغ الأساسي (ر.س)', type: 'currency' },
      { name: 'vatSAR', label: 'ضريبة القيمة المضافة 15% (ر.س)', type: 'currency' },
      { name: 'totalWithVatSAR', label: 'الإجمالي شامل الضريبة (ر.س)', type: 'currency' },
      { name: 'daysOverdue', label: 'أيام التأخر عن السداد', type: 'number' },
      { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { name: 'ownerName', label: 'مسؤول التحصيل', type: 'text' },
    ],
  },
  tasks: {
    module: 'tasks',
    label: 'المهام والأنشطة (Tasks)',
    description: 'المهام التنفيذية، المتابعات اليومية، واجتماعات العملاء المجدولة',
    relatedOptions: [
      {
        module: 'deals',
        label: 'الصفقات المرتبطة (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 الصفقة المرتبطة بالمهمة',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'title', label: 'عنوان المهمة / النشاط', type: 'text' },
      { name: 'relatedTo', label: 'الجهة المرتبطة', type: 'text' },
      { name: 'priority', label: 'الأولوية', type: 'text' },
      { name: 'status', label: 'حالة الإنجاز', type: 'text' },
      { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { name: 'assignedToName', label: 'الموظف المكلف', type: 'text' },
    ],
  },
  calls: {
    module: 'calls',
    label: 'سجل المكالمات (Calls)',
    description: 'المكالمات الصادرة والواردة عبر السنترال السحابي ومدد التحدث',
    relatedOptions: [
      {
        module: 'leads',
        label: 'العملاء المحتملين (Leads)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 العميل المتصل به',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'contactName', label: 'اسم المتصل', type: 'text' },
      { name: 'direction', label: 'اتجاه المكالمة (صادر/وارد)', type: 'text' },
      { name: 'durationSeconds', label: 'مدة المكالمة (ثانية)', type: 'number' },
      { name: 'outcome', label: 'نتيجة المكالمة', type: 'text' },
      { name: 'agentName', label: 'الموظف', type: 'text' },
      { name: 'calledAt', label: 'توقيت المكالمة', type: 'date' },
    ],
  },
  whatsapp_messages: {
    module: 'whatsapp_messages',
    label: 'رسائل واتساب والقنوات (WhatsApp Messages)',
    description: 'محادثات واتساب وإنستغرام وماسنجر وزمن الاستجابة ونافذة الـ 24 ساعة',
    relatedOptions: [
      {
        module: 'leads',
        label: 'العملاء المحتملين (Leads)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 ملف العميل صاحب المحادثة',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ)', type: 'text' },
      { name: 'senderName', label: 'اسم المرسل', type: 'text' },
      { name: 'channel', label: 'القناة (WhatsApp / IG / FB)', type: 'text' },
      { name: 'status', label: 'حالة المحادثة', type: 'text' },
      { name: 'responseTimeMinutes', label: 'زمن الاستجابة (دقيقة)', type: 'number' },
      { name: 'within24hWindow', label: 'ضمن نافذة 24 ساعة', type: 'boolean' },
      { name: 'assignedAgent', label: 'الموظف المسؤول', type: 'text' },
      { name: 'sentAt', label: 'تاريخ الرسالة', type: 'date' },
    ],
  },
  stage_history: {
    module: 'stage_history',
    label: 'سجل انتقال المراحل (Stage History)',
    description: 'تتبع زمن بقاء الصفقات في كل مرحلة وسرعة دوران القمع البيعي',
    relatedOptions: [
      {
        module: 'deals',
        label: 'الصفقات (Deals)',
        foreignKey: 'dealId',
        relationshipHint: 'N:1 الصفقة الأساسية',
      },
    ],
    fields: [
      { name: 'dealTitle', label: 'عنوان الصفقة', type: 'text' },
      { name: 'fromStage', label: 'من المرحلة', type: 'text' },
      { name: 'toStage', label: 'إلى المرحلة', type: 'text' },
      { name: 'dwellDays', label: 'زمن البقاء (أيام)', type: 'number' },
      { name: 'changedBy', label: 'تم التحديث بواسطة', type: 'text' },
      { name: 'changedAt', label: 'تاريخ الانتقال', type: 'date' },
    ],
  },
  order_attributions: {
    module: 'order_attributions',
    label: 'إسناد الطلبات المتكررة (Order Attributions)',
    description: 'تتبع عمليات الشراء المتكررة (1..10+) وربط كل طلب بالحملة الإعلانية المسببة له',
    relatedOptions: [
      {
        module: 'deals',
        label: 'الصفقات (Deals)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 الصفقات المرتبطة بالعميل',
      },
      {
        module: 'touchpoints',
        label: 'نقاط التفاعل (Touchpoints)',
        foreignKey: 'leadUniqueId',
        relationshipHint: 'N:1 اللمسات الإعلانية',
      },
    ],
    fields: [
      { name: 'leadUniqueId', label: 'معرف العميل (RWQ-ID)', type: 'text' },
      { name: 'customerName', label: 'اسم العميل / المنشأة', type: 'text' },
      { name: 'orderIndex', label: 'رقم تسلسل الطلب (1..12)', type: 'number' },
      { name: 'orderSequenceLabel', label: 'تسمية تسلسل الطلب', type: 'text' },
      { name: 'campaignName', label: 'الحملة الإعلانية المسببة', type: 'text' },
      { name: 'channel', label: 'القناة الإعلانية', type: 'text' },
      { name: 'orderAmountSAR', label: 'قيمة الطلب (ر.س)', type: 'currency' },
      { name: 'roasMultiplier', label: 'مضاعف العائد ROAS', type: 'number' },
      { name: 'orderedAt', label: 'تاريخ الطلب', type: 'date' },
    ],
  },
};

const FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'equals', label: 'يساوي (=)' },
  { value: 'not_equals', label: 'لا يساوي (≠)' },
  { value: 'contains', label: 'يحتوي على' },
  { value: 'not_contains', label: 'لا يحتوي على' },
  { value: 'starts_with', label: 'يبدأ بـ' },
  { value: 'gt', label: 'أكبر من (>)' },
  { value: 'gte', label: 'أكبر من أو يساوي (≥)' },
  { value: 'lt', label: 'أقل من (<)' },
  { value: 'lte', label: 'أقل من أو يساوي (≤)' },
  { value: 'between', label: 'بين قيمتين (Between)' },
  { value: 'in_list', label: 'ضمن القائمة (مفصول بفاصلة)' },
  { value: 'is_empty', label: 'فارغ (Is Empty)' },
  { value: 'is_not_empty', label: 'غير فارغ (Is Not Empty)' },
];

const DATE_PRESETS = [
  { value: 'all_time', label: 'كل الأوقات (All Time)' },
  { value: 'today', label: 'اليوم (Today)' },
  { value: 'yesterday', label: 'أمس (Yesterday)' },
  { value: 'this_week', label: 'هذا الأسبوع (This Week)' },
  { value: 'this_month', label: 'هذا الشهر (This Month)' },
  { value: 'this_quarter', label: 'الربع الحالي (This Quarter)' },
  { value: 'this_year', label: 'السنة الحالية (This Year)' },
  { value: 'custom', label: 'نطاق تاريخ مخصص (Custom Range)' },
];

function validateCriteriaPatternSyntax(
  pattern: string,
  maxCriterionIndex: number
): { valid: boolean; message: string } {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return { valid: true, message: 'سيتم تطبيق جميع الشروط بربط AND تلقائياً' };
  }

  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) {
      return { valid: false, message: 'قوس إغلاق غير متطابق في الصيغة المنطقية' };
    }
  }
  if (depth !== 0) {
    return { valid: false, message: 'عدد الأقواس المفتوحة لا يطابق الأقواس المغلقة' };
  }

  const invalidChars = trimmed.replace(/[0-9()\s]|AND|OR|NOT/gi, '');
  if (invalidChars.length > 0) {
    return {
      valid: false,
      message: `رموز غير مدعومة (${invalidChars}) — استخدم أرقام الشروط مع AND و OR و NOT والأقواس`,
    };
  }

  const referencedNumbers = (trimmed.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
  for (const num of referencedNumbers) {
    if (num < 1 || num > Math.max(1, maxCriterionIndex)) {
      return {
        valid: false,
        message: `الشرط رقم (${num}) غير موجود ضمن قائمة الشروط الحالية (1..${maxCriterionIndex})`,
      };
    }
  }

  return { valid: true, message: 'صيغة منطقية صحيحة ومعتمدة للتشغيل' };
}

export const ReportWizard: React.FC<ReportWizardProps> = ({
  isOpen,
  onClose,
  initialReport = null,
  isCloneMode = false,
  folders,
  defaultFolderId = 'folder_deals_pipeline',
  security,
  onSaveReport,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 State: Primary & Related Modules
  const [primaryModule, setPrimaryModule] = useState<ModuleName>('deals');
  const [relatedModules, setRelatedModules] = useState<RelatedModuleJoin[]>([]);

  // Step 2 State: Report Type
  const [reportType, setReportType] = useState<ReportType>('summary');

  // Step 3 State: Columns, Groupings, Aggregations, Buckets, Formulas
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'leadUniqueId',
    'title',
    'accountName',
    'stage',
    'amount',
    'probability',
    'closeDate',
    'ownerName',
  ]);
  const [groupByRows, setGroupByRows] = useState<ReportGroupingField[]>([
    { field: 'stage', label: 'مرحلة الصفقة' },
  ]);
  const [groupByColumns, setGroupByColumns] = useState<ReportGroupingField[]>([
    { field: 'ownerName', label: 'مسؤول الصفقة' },
  ]);
  const [aggregations, setAggregations] = useState<ReportAggregationSpec[]>([
    { field: 'id', fn: 'count', label: 'عدد السجلات' },
    { field: 'amount', fn: 'sum', label: 'مجموع قيمة الصفقة (ر.س)' },
  ]);
  const [buckets, setBuckets] = useState<BucketColumn[]>([]);
  const [formulas, setFormulas] = useState<FormulaColumn[]>([]);

  // Inline Bucket Builder State
  const [showBucketForm, setShowBucketForm] = useState<boolean>(false);
  const [bucketLabel, setBucketLabel] = useState<string>('');
  const [bucketSourceField, setBucketSourceField] = useState<string>('amount');
  const [bucketDefaultLabel, setBucketDefaultLabel] = useState<string>('أخرى');
  const [bucketRanges, setBucketRanges] = useState<BucketRange[]>([
    { label: 'صفقات كبرى (+100K)', min: 100000 },
    { label: 'صفقات متوسطة (30K - 99K)', min: 30000, max: 99999 },
    { label: 'صفقات صغيرة (<30K)', min: 0, max: 29999 },
  ]);

  // Inline Formula Builder State
  const [showFormulaForm, setShowFormulaForm] = useState<boolean>(false);
  const [formulaLabel, setFormulaLabel] = useState<string>('');
  const [formulaExpression, setFormulaExpression] = useState<string>(
    '(amount * probability) / 100'
  );
  const [formulaReturnType, setFormulaReturnType] = useState<
    'currency' | 'number' | 'percentage'
  >('currency');

  // Step 4 State: Date Filter & Criteria Pattern
  const [dateFilterField, setDateFilterField] = useState<string>('closeDate');
  const [dateFilterPreset, setDateFilterPreset] = useState<string>('all_time');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-11-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-11-30');
  const [criteria, setCriteria] = useState<ReportCriterion[]>([]);
  const [criteriaPattern, setCriteriaPattern] = useState<string>('');

  // Step 5 State: Chart & Report Metadata
  const [chartEnabled, setChartEnabled] = useState<boolean>(true);
  const [chartType, setChartType] = useState<ReportChartType>('column');
  const [chartXAxis, setChartXAxis] = useState<string>('stage');
  const [chartYAxis, setChartYAxis] = useState<string>('sum_amount');
  const [chartShowLabels, setChartShowLabels] = useState<boolean>(true);

  const [reportName, setReportName] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [folderId, setFolderId] = useState<string>(defaultFolderId);
  const [sharingScope, setSharingScope] =
    useState<ReportSharingConfig['scope']>('everyone');

  // Initialize from initialReport when editing or cloning
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);

    if (initialReport) {
      setPrimaryModule(initialReport.primaryModule);
      setRelatedModules(initialReport.relatedModules ?? []);
      setReportType(initialReport.reportType);
      setSelectedColumns(initialReport.selectedColumns ?? []);
      setGroupByRows(
        initialReport.groupByRows?.length
          ? initialReport.groupByRows
          : [{ field: 'stage', label: 'المرحلة' }]
      );
      setGroupByColumns(
        initialReport.groupByColumns?.length
          ? initialReport.groupByColumns
          : [{ field: 'ownerName', label: 'المسؤول' }]
      );
      setAggregations(initialReport.aggregations ?? []);
      setBuckets(initialReport.buckets ?? []);
      setFormulas(initialReport.formulas ?? []);
      setDateFilterField(initialReport.dateFilter?.field ?? 'createdAt');
      setDateFilterPreset(initialReport.dateFilter?.preset ?? 'all_time');
      setCustomStartDate(initialReport.dateFilter?.customStart ?? '2026-11-01');
      setCustomEndDate(initialReport.dateFilter?.customEnd ?? '2026-11-30');
      setCriteria(initialReport.criteria ?? []);
      setCriteriaPattern(initialReport.criteriaPattern ?? '');
      setChartEnabled(initialReport.chartConfig?.enabled ?? true);
      setChartType(initialReport.chartConfig?.type ?? 'column');
      setChartXAxis(
        initialReport.chartConfig?.xAxisField ??
          initialReport.groupByRows?.[0]?.field ??
          'stage'
      );
      setChartYAxis(initialReport.chartConfig?.yAxisMetric ?? 'count');
      setChartShowLabels(initialReport.chartConfig?.showLabels ?? true);
      setReportName(
        isCloneMode ? `نسخة من: ${initialReport.name}` : initialReport.name
      );
      setReportDescription(initialReport.description ?? '');
      setFolderId(initialReport.folderId || defaultFolderId);
      setSharingScope(initialReport.sharing?.scope ?? 'everyone');
    } else {
      const defaultMeta = MODULE_METADATA_CATALOG.deals;
      setPrimaryModule('deals');
      setRelatedModules([]);
      setReportType('summary');
      setSelectedColumns(defaultMeta.fields.map((f) => f.name));
      setGroupByRows([{ field: 'stage', label: 'مرحلة الصفقة' }]);
      setGroupByColumns([{ field: 'ownerName', label: 'مسؤول الصفقة' }]);
      setAggregations([
        { field: 'id', fn: 'count', label: 'عدد السجلات' },
        { field: 'amount', fn: 'sum', label: 'مجموع قيمة الصفقة (ر.س)' },
      ]);
      setBuckets([]);
      setFormulas([]);
      setDateFilterField('closeDate');
      setDateFilterPreset('all_time');
      setCriteria([]);
      setCriteriaPattern('');
      setChartEnabled(true);
      setChartType('column');
      setChartXAxis('stage');
      setChartYAxis('sum_amount');
      setChartShowLabels(true);
      setReportName('');
      setReportDescription('');
      setFolderId(defaultFolderId);
      setSharingScope('everyone');
    }
  }, [defaultFolderId, initialReport, isCloneMode, isOpen]);

  // Compute all available fields across Primary + Related Modules, filtered by FLS security
  const { availableFields, strippedFlsFieldNames } = useMemo(() => {
    const primaryMeta = MODULE_METADATA_CATALOG[primaryModule];
    const hiddenPrimary = new Set(
      security?.hiddenFieldsByModule?.[primaryModule] ?? []
    );
    const flsHiddenList: string[] = [];
    const fields: Array<ModuleFieldMeta & { modulePrefix?: ModuleName }> = [];

    for (const f of primaryMeta.fields) {
      if (hiddenPrimary.has(f.name)) {
        flsHiddenList.push(`${primaryMeta.label}: ${f.label}`);
      } else {
        fields.push(f);
      }
    }

    for (const rel of relatedModules) {
      const relMeta = MODULE_METADATA_CATALOG[rel.module];
      if (!relMeta) continue;
      const hiddenRel = new Set(
        security?.hiddenFieldsByModule?.[rel.module] ?? []
      );
      for (const rf of relMeta.fields) {
        if (hiddenRel.has(rf.name)) {
          flsHiddenList.push(`${relMeta.label}: ${rf.label}`);
        } else {
          fields.push({
            name: `${rel.module}.${rf.name}`,
            label: `[${relMeta.label.split(' ')[0]}] ${rf.label}`,
            type: rf.type,
            modulePrefix: rel.module,
          });
        }
      }
    }

    return { availableFields: fields, strippedFlsFieldNames: flsHiddenList };
  }, [primaryModule, relatedModules, security]);

  const numericFields = useMemo(
    () =>
      availableFields.filter(
        (f) => f.type === 'number' || f.type === 'currency'
      ),
    [availableFields]
  );

  const dateFields = useMemo(
    () => availableFields.filter((f) => f.type === 'date'),
    [availableFields]
  );

  const patternValidation = useMemo(
    () => validateCriteriaPatternSyntax(criteriaPattern, criteria.length),
    [criteria.length, criteriaPattern]
  );

  if (!isOpen) return null;

  const handlePrimaryModuleChange = (nextMod: ModuleName) => {
    setPrimaryModule(nextMod);
    setRelatedModules([]);
    const meta = MODULE_METADATA_CATALOG[nextMod];
    const nextCols = meta.fields.map((f) => f.name);
    setSelectedColumns(nextCols);
    const firstField = meta.fields[0]?.name ?? 'id';
    const secondField = meta.fields[1]?.name ?? firstField;
    setGroupByRows([{ field: firstField, label: meta.fields[0]?.label }]);
    setGroupByColumns([{ field: secondField, label: meta.fields[1]?.label }]);
    const firstNum = meta.fields.find(
      (f) => f.type === 'currency' || f.type === 'number'
    );
    setAggregations(
      firstNum
        ? [
            { field: 'id', fn: 'count', label: 'عدد السجلات' },
            { field: firstNum.name, fn: 'sum', label: `مجموع ${firstNum.label}` },
          ]
        : [{ field: 'id', fn: 'count', label: 'عدد السجلات' }]
    );
    setChartXAxis(firstField);
    setChartYAxis(firstNum ? `sum_${firstNum.name}` : 'count');
  };

  const toggleRelatedModule = (
    mod: ModuleName,
    foreignKey: string
  ) => {
    setRelatedModules((prev) => {
      const exists = prev.some((r) => r.module === mod);
      if (exists) {
        return prev.filter((r) => r.module !== mod);
      }
      return [...prev, { module: mod, joinType: 'inclusive', foreignKey }];
    });
  };

  const updateRelatedJoinType = (mod: ModuleName, joinType: JoinType) => {
    setRelatedModules((prev) =>
      prev.map((r) => (r.module === mod ? { ...r, joinType } : r))
    );
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    setSelectedColumns((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const toggleAggregation = (
    field: string,
    fieldLabel: string,
    fn: AggregateFunction
  ) => {
    const fnArabic: Record<AggregateFunction, string> = {
      sum: 'مجموع',
      avg: 'متوسط',
      min: 'أدنى',
      max: 'أعلى',
      count: 'عدد',
    };
    setAggregations((prev) => {
      const exists = prev.some((a) => a.field === field && a.fn === fn);
      if (exists) {
        return prev.filter((a) => !(a.field === field && a.fn === fn));
      }
      return [
        ...prev,
        { field, fn, label: `${fnArabic[fn]} ${fieldLabel}` },
      ];
    });
  };

  const handleAddBucketColumn = () => {
    if (!bucketLabel.trim()) return;
    const id = `bucket_${Date.now()}`;
    const newBucket: BucketColumn = {
      id,
      label: bucketLabel.trim(),
      sourceField: bucketSourceField,
      defaultLabel: bucketDefaultLabel.trim() || 'أخرى',
      ranges: bucketRanges,
    };
    setBuckets((prev) => [...prev, newBucket]);
    setSelectedColumns((prev) => [...prev, id]);
    setBucketLabel('');
    setShowBucketForm(false);
  };

  const handleAddFormulaColumn = () => {
    if (!formulaLabel.trim() || !formulaExpression.trim()) return;
    const id = `formula_${Date.now()}`;
    const newFormula: FormulaColumn = {
      id,
      label: formulaLabel.trim(),
      expression: formulaExpression.trim(),
      returnType: formulaReturnType,
    };
    setFormulas((prev) => [...prev, newFormula]);
    setSelectedColumns((prev) => [...prev, id]);
    setFormulaLabel('');
    setShowFormulaForm(false);
  };

  const handleAddCriterionRow = () => {
    const firstField = availableFields[0]?.name ?? 'id';
    setCriteria((prev) => {
      const nextIndex = prev.length + 1;
      const updated = [
        ...prev,
        {
          index: nextIndex,
          field: firstField,
          operator: 'equals' as FilterOperator,
          value: '',
        },
      ];
      setCriteriaPattern(updated.map((c) => c.index).join(' AND '));
      return updated;
    });
  };

  const handleRemoveCriterionRow = (idxToRemove: number) => {
    setCriteria((prev) => {
      const filtered = prev
        .filter((_, idx) => idx !== idxToRemove)
        .map((item, idx) => ({ ...item, index: idx + 1 }));
      setCriteriaPattern(filtered.map((c) => c.index).join(' AND '));
      return filtered;
    });
  };

  const handleFinalizeReport = (runImmediately: boolean) => {
    const cleanName =
      reportName.trim() ||
      `تقرير ${MODULE_METADATA_CATALOG[primaryModule].label} (${reportType})`;

    const finalReport: ReportDefinition = {
      id:
        initialReport && !isCloneMode
          ? initialReport.id
          : `rpt_custom_${Date.now()}`,
      name: cleanName.slice(0, 140),
      description:
        reportDescription.trim().slice(0, 280) ||
        `تقرير مخصص على وحدة ${MODULE_METADATA_CATALOG[primaryModule].label}`,
      folderId: folderId || defaultFolderId,
      reportType,
      primaryModule,
      relatedModules,
      selectedColumns:
        selectedColumns.length > 0
          ? selectedColumns
          : availableFields.slice(0, 5).map((f) => f.name),
      groupByRows: reportType === 'tabular' ? [] : groupByRows,
      groupByColumns: reportType === 'matrix' ? groupByColumns : undefined,
      aggregations:
        aggregations.length > 0
          ? aggregations
          : [{ field: 'id', fn: 'count', label: 'عدد السجلات' }],
      buckets: buckets.length > 0 ? buckets : undefined,
      formulas: formulas.length > 0 ? formulas : undefined,
      dateFilter:
        dateFilterPreset !== 'all_time'
          ? {
              field: dateFilterField,
              preset: dateFilterPreset,
              customStart:
                dateFilterPreset === 'custom' ? customStartDate : undefined,
              customEnd:
                dateFilterPreset === 'custom' ? customEndDate : undefined,
            }
          : undefined,
      criteria,
      criteriaPattern: criteriaPattern.trim() || undefined,
      chartConfig: {
        enabled: chartEnabled,
        type: chartType,
        xAxisField: chartXAxis || groupByRows[0]?.field || 'id',
        yAxisMetric: chartYAxis || 'count',
        secondaryGroupingField:
          reportType === 'matrix' ? groupByColumns[0]?.field : undefined,
        showLabels: chartShowLabels,
      },
      sharing: {
        scope: sharingScope,
      },
      isFavorite: initialReport?.isFavorite ?? false,
      isStandard: false,
      createdBy: 'طارق العتيبي',
      lastRunAt: new Date().toISOString(),
    };

    onSaveReport(finalReport, runImmediately);
    onClose();
  };

  const WIZARD_STEPS = [
    { num: 1 as const, title: 'اختيار الموديولات', icon: Layers },
    { num: 2 as const, title: 'نوع التقرير', icon: Grid },
    { num: 3 as const, title: 'الأعمدة والتجميع', icon: Columns },
    { num: 4 as const, title: 'الفلاتر والشروط', icon: Filter },
    { num: 5 as const, title: 'الرسم البياني والحفظ', icon: BarChart3 },
  ];

  const getFieldLabel = (fieldName: string): string => {
    const found = availableFields.find((f) => f.name === fieldName);
    if (found) return found.label;
    const foundBucket = buckets.find((b) => b.id === fieldName);
    if (foundBucket) return `[فئة] ${foundBucket.label}`;
    const foundFormula = formulas.find((fm) => fm.id === fieldName);
    if (foundFormula) return `[معادلة] ${foundFormula.label}`;
    return fieldName;
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="معالج بناء التقارير المتقدم"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-3 sm:p-5 backdrop-blur-[1px]"
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl">
        {/* Top Modal Header + 5-Step Progress Stepper */}
        <div className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0F172A]">
                {initialReport && !isCloneMode
                  ? `تعديل التقرير: ${initialReport.name}`
                  : isCloneMode
                    ? `استنساخ تقرير جديد (Clone Report)`
                    : 'معالج إنشاء تقرير مخصص (5-Step Report Builder)'}
              </h2>
              <p className="text-[12px] text-[#64748B]">
                ربط الوحدات، تخصيص التجميعات والمعادلات الحسابية، وضبط الفلاتر المنطقية
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 5-Step Stepper Bar */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {WIZARD_STEPS.map((s) => {
              const IconComp = s.icon;
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-right transition-all cursor-pointer ${
                    isActive
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A] ring-1 ring-[#2563EB]'
                      : isCompleted
                        ? 'border-[#A7F3D0] bg-[#ECFDF5]/60 text-[#065F46]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold tabular-nums ${
                      isActive
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : isCompleted
                          ? 'bg-[#059669] text-[#FFFFFF]'
                          : 'bg-[#F1F5F9] text-[#475569]'
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-extrabold">{s.title}</p>
                  </div>
                  <IconComp className="mr-auto h-3.5 w-3.5 shrink-0 opacity-60 hidden sm:block" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Step Content Area */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
          {/* ================================================================= */}
          {/* STEP 1: SELECT PRIMARY MODULE & RELATED MODULES                   */}
          {/* ================================================================= */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Right Column (7 cols): Primary Module Selector */}
              <div className="lg:col-span-7 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    1. اختر الموديول الأساسي للتقرير (Primary Module)
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    يمثل الموديول الأساسي نقطة الانطلاق لجميع السجلات والحقول في هذا التقرير
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(Object.keys(MODULE_METADATA_CATALOG) as ModuleName[]).map(
                    (modKey) => {
                      const modMeta = MODULE_METADATA_CATALOG[modKey];
                      const selected = primaryModule === modKey;
                      return (
                        <button
                          key={modKey}
                          type="button"
                          onClick={() => handlePrimaryModuleChange(modKey)}
                          className={`flex flex-col justify-between rounded-xl border p-3.5 text-right transition-all cursor-pointer ${
                            selected
                              ? 'border-[#2563EB] bg-[#EFF6FF]/60 ring-1 ring-[#2563EB]'
                              : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-extrabold text-[#0F172A]">
                              {modMeta.label}
                            </span>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                  : 'border-[#CBD5E1]'
                              }`}
                            >
                              {selected && <Check className="h-2.5 w-2.5" />}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] text-[#64748B] line-clamp-2">
                            {modMeta.description}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Left Column (5 cols): Related Modules & Join Type */}
              <div className="lg:col-span-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-[14px] font-extrabold text-[#0F172A] flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-[#2563EB]" />
                    <span>2. ربط الموديولات ذات العلاقة (Related Modules)</span>
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    حدد الموديولات الفرعية أو الأب المرتبطة بـ{' '}
                    <span className="font-bold text-[#0F172A]">
                      {MODULE_METADATA_CATALOG[primaryModule].label}
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  {MODULE_METADATA_CATALOG[primaryModule].relatedOptions.map(
                    (relOpt) => {
                      const activeRel = relatedModules.find(
                        (r) => r.module === relOpt.module
                      );
                      const isChecked = Boolean(activeRel);

                      return (
                        <div
                          key={relOpt.module}
                          className={`rounded-xl border p-3.5 transition-all space-y-3 ${
                            isChecked
                              ? 'border-[#2563EB] bg-[#EFF6FF]/40'
                              : 'border-[#E2E8F0] bg-[#FFFFFF]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  toggleRelatedModule(
                                    relOpt.module,
                                    relOpt.foreignKey
                                  )
                                }
                                className="mt-1 h-4 w-4 accent-[#2563EB]"
                              />
                              <div>
                                <p className="text-[12px] font-extrabold text-[#0F172A]">
                                  {relOpt.label}
                                </p>
                                <p className="text-[11px] text-[#64748B]">
                                  {relOpt.relationshipHint} • مفتاح الربط:{' '}
                                  <span className="font-mono text-[#2563EB]">
                                    {relOpt.foreignKey}
                                  </span>
                                </p>
                              </div>
                            </label>
                          </div>

                          {isChecked && activeRel && (
                            <div className="grid grid-cols-2 gap-2 border-t border-[#DBEAFE] pt-2.5">
                              {[
                                {
                                  key: 'inclusive' as const,
                                  title: 'شامل (Inclusive)',
                                  sub: 'عرض كافة السجلات حتى بدون سجل فرعي',
                                },
                                {
                                  key: 'exclusive' as const,
                                  title: 'حصري (Exclusive)',
                                  sub: 'فقط السجلات التي تملك سجلاً فرعياً مطابقاً',
                                },
                              ].map((jOpt) => (
                                <button
                                  key={jOpt.key}
                                  type="button"
                                  onClick={() =>
                                    updateRelatedJoinType(
                                      relOpt.module,
                                      jOpt.key
                                    )
                                  }
                                  className={`rounded-lg border p-2 text-right transition-colors cursor-pointer ${
                                    activeRel.joinType === jOpt.key
                                      ? 'border-[#2563EB] bg-[#FFFFFF] text-[#1E3A8A] ring-1 ring-[#2563EB]'
                                      : 'border-[#E2E8F0] bg-[#FFFFFF]/60 text-[#64748B]'
                                  }`}
                                >
                                  <p className="text-[11px] font-extrabold">
                                    {jOpt.title}
                                  </p>
                                  <p className="text-[10px] opacity-85 mt-0.5">
                                    {jOpt.sub}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: REPORT TYPE SELECTION (4 INTERACTIVE CARDS)               */}
          {/* ================================================================= */}
          {step === 2 && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-5">
              <div className="border-b border-[#F1F5F9] pb-3">
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  اختر هيكل ونوع التقرير (Report Type)
                </h3>
                <p className="text-[12px] text-[#64748B]">
                  يدعم محرك رواق 4 أنماط قياسية لعرض وتجميع البيانات وتحليلها
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  {
                    type: 'tabular' as const,
                    title: 'تقرير جدولي (Tabular Report)',
                    subtitle: 'قوائم تفصيلية مسطحة مع إجماليات سفلية',
                    useCase:
                      'مثالي لقوائم العملاء غير المتابعين، قوائم الفواتير، والتصدير المباشر إلى CSV/Excel.',
                    icon: Table,
                    previewRows: [
                      ['معرف السجل', 'اسم الجهة / العميل', 'القيمة المالية'],
                      ['سجل #1', 'عميل المؤسسة النشطة', '—'],
                    ],
                  },
                  {
                    type: 'summary' as const,
                    title: 'تقرير ملخص وتجميعي (Summary Report)',
                    subtitle: 'تجميع هرمي للصفوف + مجاميع فرعية ومخططات بيانية',
                    useCase:
                      'مثالي لتقارير الصفقات حسب المرحلة، المبيعات حسب المندوب، وزمن البقاء في المراحل.',
                    icon: List,
                    previewRows: [
                      ['▼ المرحلة: تفاوض متقدم (4 صفقات)', 'المجموع: 640,000 ر.س', '75%'],
                      ['   • صفقة بنك الاستثمار', '240,000 ر.س', '80%'],
                    ],
                  },
                  {
                    type: 'matrix' as const,
                    title: 'تقرير مصفوفي ثنائي الأبعاد (Matrix Report)',
                    subtitle: 'جدول تقاطعي (صفوف × أعمدة) للمقارنات المتقدمة',
                    useCase:
                      'مثالي لمصفوفة إسناد الطلبات المتكررة (+10 طلبات) وتوزيع العملاء حسب المندوب والمصدر.',
                    icon: Grid,
                    previewRows: [
                      ['الحملة / الطلب', 'الطلب #1', 'الطلب #2..10+'],
                      ['حملة ميتا الربع الرابع', '420,000 ر.س', '890,000 ر.س'],
                    ],
                  },
                  {
                    type: 'joined' as const,
                    title: 'تقرير مدمج متعدد الكتل (Joined Report)',
                    subtitle: 'دمج عدة وحدات مستقلة في شاشة مقارنة واحدة',
                    useCase:
                      'مثالي لمقارنة العملاء المحتملين ونقاط التفاعل الإعلانية والصفقات المغلقة جنباً إلى جنب.',
                    icon: Layers,
                    previewRows: [
                      ['كتلة 1: الاستقطاب الأولي', 'كتلة 2: لمسات الإعلانات', 'كتلة 3: الصفقات'],
                      ['145 عميل محتمل', '410 نقرة إعلانية', '38 صفقة مغلقة'],
                    ],
                  },
                ].map((card) => {
                  const IconComp = card.icon;
                  const active = reportType === card.type;
                  return (
                    <button
                      key={card.type}
                      type="button"
                      onClick={() => setReportType(card.type)}
                      className={`flex flex-col justify-between rounded-2xl border p-5 text-right transition-all cursor-pointer ${
                        active
                          ? 'border-[#2563EB] bg-[#EFF6FF]/50 ring-2 ring-[#2563EB]'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                active
                                  ? 'border-[#BFDBFE] bg-[#2563EB] text-[#FFFFFF]'
                                  : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]'
                              }`}
                            >
                              <IconComp className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-[14px] font-extrabold text-[#0F172A]">
                                {card.title}
                              </h4>
                              <p className="text-[11px] font-bold text-[#2563EB]">
                                {card.subtitle}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              active
                                ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                                : 'border-[#CBD5E1]'
                            }`}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>
                        </div>

                        <p className="text-[12px] text-[#475569] leading-relaxed">
                          {card.useCase}
                        </p>
                      </div>

                      {/* Mini Structural Layout Preview */}
                      <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-1.5 font-mono text-[10px] text-[#334155]">
                        {card.previewRows.map((r, rIdx) => (
                          <div
                            key={rIdx}
                            className={`grid grid-cols-3 gap-2 rounded px-2 py-1 ${
                              rIdx === 0
                                ? 'bg-[#F8FAFC] font-bold text-[#0F172A]'
                                : 'text-[#64748B]'
                            }`}
                          >
                            {r.map((cellText, cIdx) => (
                              <span key={cIdx} className="truncate">
                                {cellText}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: COLUMNS SHUTTLE, GROUPINGS, BUCKETS & FORMULAS            */}
          {/* ================================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              {/* FLS Security Notice if any fields were hidden */}
              {strippedFlsFieldNames.length > 0 && (
                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-[12px] font-bold text-[#92400E]">
                  تم إخفاء ({strippedFlsFieldNames.length}) حقول تلقائياً بناءً على صلاحيات أمان الحقول (FLS) الخاصة بدورك الوظيفي:{' '}
                  {strippedFlsFieldNames.join(' ، ')}
                </div>
              )}

              {/* 1. Column Shuttle (Available vs Selected Columns) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      أعمدة التقرير (Column Shuttle)
                    </h3>
                    <p className="text-[12px] text-[#64748B]">
                      اختر الأعمدة المراد إظهارها ورتب أولويات ظهورها في الجدول
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBucketForm((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-extrabold text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ إضافة عمود فئوي (Bucket Column)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFormulaForm((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-[11px] font-extrabold text-[#065F46] hover:bg-[#D1FAE5] cursor-pointer"
                    >
                      <Calculator className="h-3.5 w-3.5" />
                      <span>+ إضافة عمود معادلة (Formula Column)</span>
                    </button>
                  </div>
                </div>

                {/* Inline Sub-panel: Bucket Column Builder */}
                {showBucketForm && (
                  <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-extrabold text-[#1E3A8A]">
                        إنشاء عمود تصنيف فئوي (Bucket Column)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowBucketForm(false)}
                        className="text-[11px] font-bold text-[#64748B] hover:text-[#0F172A]"
                      >
                        إغلاق
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          اسم العمود الفئوي
                        </label>
                        <input
                          type="text"
                          value={bucketLabel}
                          onChange={(e) => setBucketLabel(e.target.value)}
                          placeholder="مثال: شريحة حجم الصفقة"
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          الحقل الرقمي المصدر
                        </label>
                        <select
                          value={bucketSourceField}
                          onChange={(e) => setBucketSourceField(e.target.value)}
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px]"
                        >
                          {numericFields.map((nf) => (
                            <option key={nf.name} value={nf.name}>
                              {nf.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          التسمية الافتراضية
                        </label>
                        <input
                          type="text"
                          value={bucketDefaultLabel}
                          onChange={(e) => setBucketDefaultLabel(e.target.value)}
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-[#475569]">
                        نطاقات التصنيف (Ranges):
                      </p>
                      {bucketRanges.map((rng, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-3 gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={rng.label}
                            onChange={(e) => {
                              const next = [...bucketRanges];
                              next[idx] = { ...rng, label: e.target.value };
                              setBucketRanges(next);
                            }}
                            placeholder="اسم الفئة"
                            className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px]"
                          />
                          <input
                            type="number"
                            value={rng.min ?? ''}
                            onChange={(e) => {
                              const next = [...bucketRanges];
                              next[idx] = {
                                ...rng,
                                min:
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value),
                              };
                              setBucketRanges(next);
                            }}
                            placeholder="الحد الأدنى (Min)"
                            className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] tabular-nums"
                          />
                          <input
                            type="number"
                            value={rng.max ?? ''}
                            onChange={(e) => {
                              const next = [...bucketRanges];
                              next[idx] = {
                                ...rng,
                                max:
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value),
                              };
                              setBucketRanges(next);
                            }}
                            placeholder="الحد الأعلى (Max)"
                            className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1 text-[11px] tabular-nums"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddBucketColumn}
                        className="rounded-lg bg-[#2563EB] px-4 py-1.5 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer"
                      >
                        حفظ وإدراج العمود الفئوي
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Sub-panel: Formula Column Builder */}
                {showFormulaForm && (
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-extrabold text-[#065F46]">
                        إنشاء عمود معادلة حسابية (Formula Column)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowFormulaForm(false)}
                        className="text-[11px] font-bold text-[#64748B] hover:text-[#0F172A]"
                      >
                        إغلاق
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          اسم عمود المعادلة
                        </label>
                        <input
                          type="text"
                          value={formulaLabel}
                          onChange={(e) => setFormulaLabel(e.target.value)}
                          placeholder="مثال: الإيراد المرجح الصافي"
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          نوع المخرجات
                        </label>
                        <select
                          value={formulaReturnType}
                          onChange={(e) =>
                            setFormulaReturnType(
                              e.target.value as 'currency' | 'number' | 'percentage'
                            )
                          }
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[12px]"
                        >
                          <option value="currency">عملة (ر.س)</option>
                          <option value="number">رقم قياسي</option>
                          <option value="percentage">نسبة مئوية (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          التعبير الحسابي (آمن ضد القسمة على صفر)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={formulaExpression}
                          onChange={(e) => setFormulaExpression(e.target.value)}
                          placeholder="(amount * probability) / 100"
                          className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 font-mono text-[12px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-bold text-[#065F46]">
                          إدراج حقل رقمي سريع:
                        </span>
                        {numericFields.map((nf) => (
                          <button
                            key={nf.name}
                            type="button"
                            onClick={() =>
                              setFormulaExpression(
                                (prev) => `${prev} ${nf.name}`.trim()
                              )
                            }
                            className="rounded border border-[#A7F3D0] bg-[#FFFFFF] px-2 py-0.5 font-mono text-[#065F46] hover:bg-[#D1FAE5] cursor-pointer"
                          >
                            {nf.name}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddFormulaColumn}
                        className="rounded-lg bg-[#059669] px-4 py-1.5 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer"
                      >
                        حفظ وإدراج المعادلة
                      </button>
                    </div>
                  </div>
                )}

                {/* Shuttle Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Available Columns */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                      <span className="text-[12px] font-extrabold text-[#0F172A]">
                        الأعمدة المتاحة ({availableFields.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedColumns(availableFields.map((f) => f.name))
                        }
                        className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        إضافة الكل
                      </button>
                    </div>

                    <div className="max-h-56 space-y-1.5 overflow-y-auto pl-1">
                      {availableFields.map((field) => {
                        const isSelected = selectedColumns.includes(field.name);
                        return (
                          <button
                            key={field.name}
                            type="button"
                            onClick={() => {
                              if (!isSelected) {
                                setSelectedColumns((prev) => [
                                  ...prev,
                                  field.name,
                                ]);
                              }
                            }}
                            disabled={isSelected}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right text-[12px] transition-colors ${
                              isSelected
                                ? 'border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] cursor-default'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] font-semibold text-[#0F172A] hover:border-[#2563EB] hover:bg-[#EFF6FF]/40 cursor-pointer'
                            }`}
                          >
                            <span>{field.label}</span>
                            <span className="font-mono text-[10px] text-[#64748B]">
                              {isSelected ? 'مُضاف ✓' : '+ إضافة'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Columns with Reorder */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                      <span className="text-[12px] font-extrabold text-[#0F172A]">
                        الأعمدة المختارة ({selectedColumns.length})
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        استخدم الأسهم لترتيب الأعمدة
                      </span>
                    </div>

                    <div className="max-h-56 space-y-1.5 overflow-y-auto pl-1">
                      {selectedColumns.map((colName, idx) => (
                        <div
                          key={colName}
                          className="flex items-center justify-between rounded-lg border border-[#BFDBFE] bg-[#EFF6FF]/35 px-3 py-1.5 text-[12px]"
                        >
                          <span className="font-bold text-[#0F172A] truncate">
                            {idx + 1}. {getFieldLabel(colName)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(idx, 'up')}
                              disabled={idx === 0}
                              className="rounded p-1 text-[#475569] hover:bg-[#FFFFFF] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveColumn(idx, 'down')}
                              disabled={idx === selectedColumns.length - 1}
                              className="rounded p-1 text-[#475569] hover:bg-[#FFFFFF] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedColumns((prev) =>
                                  prev.filter((c) => c !== colName)
                                )
                              }
                              className="rounded p-1 text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Row & Column Groupings (For Summary / Matrix / Joined) */}
              {reportType !== 'tabular' && (
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                    <div>
                      <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                        مستويات تجميع الصفوف والأعمدة (Groupings)
                      </h3>
                      <p className="text-[12px] text-[#64748B]">
                        حدد حتى 3 مستويات لتجميع الصفوف مع خيار التجميع الزمني للتواريخ
                      </p>
                    </div>
                    {groupByRows.length < 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          setGroupByRows((prev) => [
                            ...prev,
                            {
                              field: availableFields[0]?.name ?? 'id',
                              label: availableFields[0]?.label,
                            },
                          ])
                        }
                        className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        + إضافة مستوى تجميع فرعي
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {groupByRows.map((grp, idx) => {
                      const isDateField = dateFields.some(
                        (df) => df.name === grp.field
                      );
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-12 items-center"
                        >
                          <span className="sm:col-span-2 text-[12px] font-extrabold text-[#0F172A]">
                            تجميع الصفوف #{idx + 1}:
                          </span>
                          <div className="sm:col-span-5">
                            <select
                              value={grp.field}
                              onChange={(e) => {
                                const nextField = e.target.value;
                                const nextLabel = getFieldLabel(nextField);
                                setGroupByRows((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { field: nextField, label: nextLabel }
                                      : item
                                  )
                                );
                              }}
                              className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                            >
                              {availableFields.map((f) => (
                                <option key={f.name} value={f.name}>
                                  {f.label}
                                </option>
                              ))}
                              {buckets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  [فئة] {b.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-4">
                            {isDateField ? (
                              <select
                                value={grp.dateGranularity ?? 'month'}
                                onChange={(e) =>
                                  setGroupByRows((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            dateGranularity: e.target
                                              .value as DateGroupingGranularity,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0F172A]"
                              >
                                <option value="day">تجميع حسب اليوم (Day)</option>
                                <option value="week">تجميع حسب الأسبوع (Week)</option>
                                <option value="month">تجميع حسب الشهر (Month)</option>
                                <option value="quarter">تجميع حسب الربع (Quarter)</option>
                                <option value="year">تجميع حسب السنة (Year)</option>
                              </select>
                            ) : (
                              <span className="text-[11px] text-[#64748B]">
                                تجميع نصي / فئوي مباشر
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            {groupByRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setGroupByRows((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="rounded p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Matrix Column Grouping */}
                    {reportType === 'matrix' && (
                      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/40 p-3 sm:grid-cols-12 items-center">
                        <span className="sm:col-span-3 text-[12px] font-extrabold text-[#1E3A8A]">
                          تجميع الأعمدة المتقاطعة (Matrix Columns):
                        </span>
                        <div className="sm:col-span-6">
                          <select
                            value={groupByColumns[0]?.field ?? ''}
                            onChange={(e) =>
                              setGroupByColumns([
                                {
                                  field: e.target.value,
                                  label: getFieldLabel(e.target.value),
                                },
                              ])
                            }
                            className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                          >
                            {availableFields.map((f) => (
                              <option key={f.name} value={f.name}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Columns to Total (Sum, Avg, Min, Max Matrix) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3">
                <div className="border-b border-[#F1F5F9] pb-2.5">
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    أعمدة التلخيص والإجماليات الحسابية (Columns to Total)
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    اختر الدوال التجميعية المطلوبة لكل حقل رقمي أو مالي
                  </p>
                </div>

                {numericFields.length === 0 ? (
                  <p className="text-[12px] text-[#64748B]">
                    سيتم احتساب عدد السجلات (Count) تلقائياً لهذا التقرير.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-[12px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
                          <th className="py-2.5 px-3 font-extrabold">الحقل الرقمي / المالي</th>
                          <th className="py-2.5 px-3 text-center font-extrabold">
                            المجموع (Sum)
                          </th>
                          <th className="py-2.5 px-3 text-center font-extrabold">
                            المتوسط (Avg)
                          </th>
                          <th className="py-2.5 px-3 text-center font-extrabold">
                            الأدنى (Min)
                          </th>
                          <th className="py-2.5 px-3 text-center font-extrabold">
                            الأعلى (Max)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {numericFields.map((nf) => (
                          <tr key={nf.name} className="hover:bg-[#F8FAFC]">
                            <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                              {nf.label}
                            </td>
                            {(['sum', 'avg', 'min', 'max'] as AggregateFunction[]).map(
                              (fnKey) => {
                                const checked = aggregations.some(
                                  (a) => a.field === nf.name && a.fn === fnKey
                                );
                                return (
                                  <td key={fnKey} className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleAggregation(nf.name, nf.label, fnKey)
                                      }
                                      className="h-4 w-4 accent-[#2563EB] cursor-pointer"
                                    />
                                  </td>
                                );
                              }
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: STANDARD DATE FILTER, DYNAMIC CRITERIA & BOOLEAN PATTERN  */}
          {/* ================================================================= */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Card 1: Standard Date Filter */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    1. فلتر النطاق الزمني القياسي (Standard Date Filter)
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    تصفية سجلات التقرير حسب حقل التاريخ والفترة الزمنية
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                      حقل التاريخ المعتمد
                    </label>
                    <select
                      value={dateFilterField}
                      onChange={(e) => setDateFilterField(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                    >
                      {dateFields.length > 0 ? (
                        dateFields.map((df) => (
                          <option key={df.name} value={df.name}>
                            {df.label}
                          </option>
                        ))
                      ) : (
                        <option value="createdAt">تاريخ الإنشاء (createdAt)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                      الفترة الزمنية
                    </label>
                    <select
                      value={dateFilterPreset}
                      onChange={(e) => setDateFilterPreset(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                    >
                      {DATE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {dateFilterPreset === 'custom' && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          من تاريخ
                        </label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-[#0F172A]">
                          إلى تاريخ
                        </label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] tabular-nums"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card 2: Advanced Criteria Rows & Criteria Pattern Evaluator */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <div>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      2. الشروط المتقدمة ونمط المنطق البولياني (Criteria & Boolean Pattern)
                    </h3>
                    <p className="text-[12px] text-[#64748B]">
                      أضف شروط التصفية واكتب معادلة الربط المنطقي مثل{' '}
                      <span className="font-mono font-bold text-[#2563EB]" dir="ltr">
                        (1 AND 2) OR 3
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCriterionRow}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ إضافة شرط تصفية</span>
                  </button>
                </div>

                {criteria.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
                    <p className="text-[12px] font-bold text-[#64748B]">
                      لا توجد شروط تصفية مضافة حالياً — سيتم تضمين كافة السجلات المطابقة للنطاق الزمني.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criteria.map((crit, idx) => (
                      <div
                        key={crit.index}
                        className="grid grid-cols-1 gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-12 items-center"
                      >
                        <div className="sm:col-span-1 flex items-center justify-center">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB] font-mono text-[12px] font-extrabold text-[#FFFFFF] tabular-nums">
                            {crit.index}
                          </span>
                        </div>

                        <div className="sm:col-span-4">
                          <select
                            value={crit.field}
                            onChange={(e) => {
                              const nextField = e.target.value;
                              setCriteria((prev) =>
                                prev.map((c, i) =>
                                  i === idx ? { ...c, field: nextField } : c
                                )
                              );
                            }}
                            className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                          >
                            {availableFields.map((af) => (
                              <option key={af.name} value={af.name}>
                                {af.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <select
                            value={crit.operator}
                            onChange={(e) => {
                              const nextOp = e.target.value as FilterOperator;
                              setCriteria((prev) =>
                                prev.map((c, i) =>
                                  i === idx ? { ...c, operator: nextOp } : c
                                )
                              );
                            }}
                            className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0F172A]"
                          >
                            {FILTER_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          {crit.operator !== 'is_empty' &&
                            crit.operator !== 'is_not_empty' && (
                              <input
                                type="text"
                                value={crit.value ?? ''}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setCriteria((prev) =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, value: nextVal } : c
                                    )
                                  );
                                }}
                                placeholder="القيمة المطلوبة..."
                                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0F172A]"
                              />
                            )}
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterionRow(idx)}
                            className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Criteria Pattern Input */}
                    <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[12px] font-extrabold text-[#0F172A]">
                          نمط الشروط المنطقية (Criteria Pattern):
                        </label>
                        <span
                          className={`rounded-md px-2.5 py-0.5 text-[11px] font-extrabold ${
                            patternValidation.valid
                              ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                              : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                          }`}
                        >
                          {patternValidation.message}
                        </span>
                      </div>
                      <input
                        type="text"
                        dir="ltr"
                        value={criteriaPattern}
                        onChange={(e) => setCriteriaPattern(e.target.value)}
                        placeholder="(1 AND 2) OR 3"
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 font-mono text-[13px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 5: CHART CONFIGURATION & SAVE METADATA                       */}
          {/* ================================================================= */}
          {step === 5 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Right Column (6 cols): Chart Config */}
              <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <div>
                    <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                      1. إعدادات الرسم البياني المرافق (Chart Configuration)
                    </h3>
                    <p className="text-[12px] text-[#64748B]">
                      يظهر الرسم البياني أعلى جدول التقرير ويدعم النقر للتفصيل (Drill-Down)
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={chartEnabled}
                    onChange={(e) => setChartEnabled(e.target.checked)}
                    className="h-5 w-5 accent-[#2563EB] cursor-pointer"
                  />
                </div>

                {chartEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-bold text-[#0F172A]">
                        نوع الرسم البياني
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { key: 'column' as const, label: 'أعمدة رأسية (Column)' },
                          { key: 'bar' as const, label: 'أشرطة أفقية (Bar)' },
                          { key: 'line' as const, label: 'خط زمني (Line)' },
                          { key: 'pie' as const, label: 'دائري (Pie)' },
                          { key: 'donut' as const, label: 'حلقي (Donut)' },
                          { key: 'funnel' as const, label: 'قمع مبيعات (Funnel)' },
                          { key: 'stacked_bar' as const, label: 'أعمدة مكدسة (Stacked)' },
                        ].map((ct) => (
                          <button
                            key={ct.key}
                            type="button"
                            onClick={() => setChartType(ct.key)}
                            className={`rounded-xl border px-3 py-2 text-[11px] font-extrabold transition-colors cursor-pointer ${
                              chartType === ct.key
                                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            {ct.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[12px] font-bold text-[#0F172A]">
                          المحور الأفقي (X-Axis / الفئة)
                        </label>
                        <select
                          value={chartXAxis}
                          onChange={(e) => setChartXAxis(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0F172A]"
                        >
                          {availableFields.map((f) => (
                            <option key={f.name} value={f.name}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] font-bold text-[#0F172A]">
                          المحور الرأسي (Y-Axis / المقياس)
                        </label>
                        <select
                          value={chartYAxis}
                          onChange={(e) => setChartYAxis(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0F172A]"
                        >
                          <option value="count">عدد السجلات (Record Count)</option>
                          {aggregations.map((agg) => (
                            <option
                              key={`${agg.fn}_${agg.field}`}
                              value={`${agg.fn}_${agg.field}`}
                            >
                              {agg.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-[12px] font-bold text-[#0F172A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chartShowLabels}
                        onChange={(e) => setChartShowLabels(e.target.checked)}
                        className="h-4 w-4 accent-[#2563EB]"
                      />
                      <span>إظهار القيم الرقمية مباشرة فوق عناصر الرسم البياني</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Left Column (6 cols): Report Name, Folder & Sharing */}
              <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                    2. بيانات حفظ التقرير ومجلد الأرشفة
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    حدد اسم التقرير والمجلد والصلاحيات قبل الحفظ أو التشغيل
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                    اسم التقرير <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder={`مثال: تحليل ${MODULE_METADATA_CATALOG[primaryModule].label} الربع الرابع`}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[13px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                    وصف التقرير
                  </label>
                  <textarea
                    rows={2}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="وصف تنفيذي مختصر لهدف التقرير والجهات المستفيدة منه..."
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                      مجلد التقرير
                    </label>
                    <select
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                    >
                      {folders.map((fld) => (
                        <option key={fld.id} value={fld.id}>
                          {fld.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-extrabold text-[#0F172A]">
                      نطاق المشاركة
                    </label>
                    <select
                      value={sharingScope}
                      onChange={(e) =>
                        setSharingScope(
                          e.target.value as ReportSharingConfig['scope']
                        )
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-semibold text-[#0F172A]"
                    >
                      <option value="everyone">الجميع في المؤسسة (Everyone)</option>
                      <option value="only_me">أنا فقط (Only Me)</option>
                      <option value="selected">أدوار ومستخدمون محددون (Selected)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Single Sticky Bottom Bar */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
            >
              إلغاء
            </button>
            {step > 1 && (
              <button
                type="button"
                onClick={() =>
                  setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5)
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-extrabold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
                <span>السابق</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step < 5 ? (
              <button
                type="button"
                onClick={() =>
                  setStep((prev) => Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5)
                }
                className="inline-flex items-center gap-1 rounded-xl bg-[#2563EB] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs hover:bg-[#1D4ED8] cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleFinalizeReport(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-4 py-2 text-[12px] font-extrabold text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>حفظ فقط</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalizeReport(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>حفظ وتشغيل التقرير</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
