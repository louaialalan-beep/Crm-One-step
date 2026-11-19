import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Eye,
  FileText,
  Filter,
  GitBranch,
  GripVertical,
  Info,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Maximize2,
  MessageSquare,
  Minus,
  Move,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';
import { useSetup } from '../context/SetupContext';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type BlueprintStageCategory = 'normal' | 'active' | 'won' | 'lost';
export type BlueprintTransitionTone = 'normal' | 'won' | 'lost' | 'loop';
export type BlueprintAfterActionType = 'field_update' | 'whatsapp_email' | 'create_task' | 'webhook';

export interface BlueprintStageNode {
  id: string;
  title: string;
  englishSubtitle: string;
  slaBadge: string;
  category: BlueprintStageCategory;
  ownersLabel: string;
  onCanvas: boolean;
  x: number;
  y: number;
}

export interface BlueprintBeforeCondition {
  id: string;
  fieldLabel: string;
  operatorLabel: string;
  valueLabel: string;
  enabled: boolean;
}

export interface BlueprintMandatoryField {
  id: string;
  fieldName: string;
  fieldType: string;
  required: boolean;
}

export interface BlueprintChecklistItem {
  id: string;
  title: string;
  required: boolean;
}

export interface BlueprintAfterAction {
  id: string;
  type: BlueprintAfterActionType;
  label: string;
  targetDetail: string;
  systemTag: string;
  enabled: boolean;
}

export interface BlueprintTransitionConfig {
  id: string;
  name: string;
  englishName: string;
  fromStageId: string;
  toStageId: string;
  tone: BlueprintTransitionTone;
  slaDurationLabel: string;
  enabled: boolean;
  // BEFORE
  roles: string[];
  beforeConditions: BlueprintBeforeCondition[];
  // DURING
  mandatoryFields: BlueprintMandatoryField[];
  requireNotes: boolean;
  requireAttachment: boolean;
  requireDigitalSignature: boolean;
  checklist: BlueprintChecklistItem[];
  // AFTER
  afterActions: BlueprintAfterAction[];
}

export interface BlueprintDefinition {
  id: string;
  orgId: string;
  name: string;
  description: string;
  module: string;
  linkedField: string;
  criteria: string;
  active: boolean;
  updatedAt: string;
  createdBy: string;
  stages: BlueprintStageNode[];
  transitions: BlueprintTransitionConfig[];
}

// ============================================================================
// MODULE & FIELD PRESETS
// ============================================================================

const MODULE_OPTIONS: {
  module: string;
  fields: string[];
  defaultStates: Omit<BlueprintStageNode, 'onCanvas' | 'x' | 'y'>[];
}[] = [
  {
    module: 'الصفقات والمبيعات',
    fields: ['المرحلة (Stage)', 'حالة الاعتماد المالي', 'مسار التسليم والتنفيذ'],
    defaultStates: [
      { id: 'st_lead_qual', title: 'تأهيل أولي', englishSubtitle: 'INITIAL QUALIFICATION', slaBadge: '24 ساعة', category: 'normal', ownersLabel: 'مندوب المبيعات' },
      { id: 'st_needs_analysis', title: 'تحليل الاحتياجات', englishSubtitle: 'NEEDS & DISCOVERY', slaBadge: '48 ساعة', category: 'normal', ownersLabel: 'مندوب مبيعات أول' },
      { id: 'st_tech_demo', title: 'عرض تقني وتجريبي', englishSubtitle: 'TECHNICAL DEMO', slaBadge: '3 أيام', category: 'active', ownersLabel: 'مهندس ما قبل البيع' },
      { id: 'st_quote_sent', title: 'إرسال عرض السعر', englishSubtitle: 'COMMERCIAL PROPOSAL', slaBadge: '48 ساعة', category: 'normal', ownersLabel: 'مدير الحسابات' },
      { id: 'st_negotiation', title: 'مفاوضات ومراجعة العقود', englishSubtitle: 'LEGAL & NEGOTIATION', slaBadge: '5 أيام', category: 'normal', ownersLabel: 'مدير المبيعات + القانونية' },
      { id: 'st_closed_won', title: 'إغلاق ناجح (Won)', englishSubtitle: 'CLOSED WON', slaBadge: 'مرحلة نهائية', category: 'won', ownersLabel: 'النظام المالي ERP' },
      { id: 'st_closed_lost', title: 'إغلاق خاسر (Lost)', englishSubtitle: 'CLOSED LOST', slaBadge: 'أرشفة وتحليل', category: 'lost', ownersLabel: 'مدير المبيعات' },
    ],
  },
  {
    module: 'العملاء المحتملين',
    fields: ['حالة العميل (Lead Status)', 'درجة التأهيل (Lead Rating)', 'مسار المتابعة'],
    defaultStates: [
      { id: 'ld_new', title: 'عميل محتمل جديد', englishSubtitle: 'NEW INBOUND LEAD', slaBadge: 'ساعتان', category: 'normal', ownersLabel: 'فريق الاستقبال SDR' },
      { id: 'ld_contacted', title: 'تم التواصل الأولي', englishSubtitle: 'FIRST CONTACT MADE', slaBadge: '24 ساعة', category: 'active', ownersLabel: 'أخصائي تطوير الأعمال' },
      { id: 'ld_qualified', title: 'مؤهل مبيعياً (SQL)', englishSubtitle: 'SALES QUALIFIED', slaBadge: '48 ساعة', category: 'normal', ownersLabel: 'تنفيذي المبيعات' },
      { id: 'ld_nurturing', title: 'رعاية ومتابعة لاحقة', englishSubtitle: 'LEAD NURTURING', slaBadge: '7 أيام', category: 'normal', ownersLabel: 'التسويق الرقمي' },
      { id: 'ld_converted', title: 'تم التحويل لصفقة', englishSubtitle: 'CONVERTED TO DEAL', slaBadge: 'مكتمل', category: 'won', ownersLabel: 'مدير المبيعات' },
      { id: 'ld_disqualified', title: 'غير مؤهل / مستبعد', englishSubtitle: 'DISQUALIFIED', slaBadge: 'مغلق', category: 'lost', ownersLabel: 'فريق SDR' },
    ],
  },
  {
    module: 'عروض الأسعار',
    fields: ['حالة العرض (Quote Status)', 'مرحلة اعتماد الخصم'],
    defaultStates: [
      { id: 'qt_draft', title: 'مسودة عرض سعر', englishSubtitle: 'DRAFT QUOTE', slaBadge: '4 ساعات', category: 'normal', ownersLabel: 'مندوب المبيعات' },
      { id: 'qt_mgr_review', title: 'مراجعة مدير المبيعات', englishSubtitle: 'MANAGER APPROVAL', slaBadge: '12 ساعة', category: 'active', ownersLabel: 'مدير المبيعات' },
      { id: 'qt_fin_review', title: 'اعتماد الإدارة المالية', englishSubtitle: 'FINANCE GOVERNANCE', slaBadge: '24 ساعة', category: 'normal', ownersLabel: 'المدير المالي CFO' },
      { id: 'qt_sent_client', title: 'مرسل للعميل لاعتماده', englishSubtitle: 'SENT TO CUSTOMER', slaBadge: '3 أيام', category: 'normal', ownersLabel: 'مندوب المبيعات' },
      { id: 'qt_accepted', title: 'معتمد ومحول لأمر بيع', englishSubtitle: 'ACCEPTED & CONVERTED', slaBadge: 'معتمد', category: 'won', ownersLabel: 'النظام المالي' },
      { id: 'qt_rejected', title: 'مرفوض / منتهي الصلاحية', englishSubtitle: 'REJECTED OR EXPIRED', slaBadge: 'مغلق', category: 'lost', ownersLabel: 'مندوب المبيعات' },
    ],
  },
  {
    module: 'أوامر البيع',
    fields: ['حالة أمر البيع (Order Status)', 'حالة التوريد والتسليم'],
    defaultStates: [
      { id: 'so_created', title: 'أمر بيع قيد التدقيق', englishSubtitle: 'PENDING VERIFICATION', slaBadge: '6 ساعات', category: 'normal', ownersLabel: 'منسق المبيعات' },
      { id: 'so_approved', title: 'معتمد للتنفيذ والتجهيز', englishSubtitle: 'APPROVED FOR FULFILLMENT', slaBadge: '24 ساعة', category: 'active', ownersLabel: 'مدير العمليات' },
      { id: 'so_delivered', title: 'تم التسليم وإصدار الفاتورة', englishSubtitle: 'DELIVERED & INVOICED', slaBadge: 'مكتمل', category: 'won', ownersLabel: 'الحسابات' },
      { id: 'so_cancelled', title: 'ملغى', englishSubtitle: 'CANCELLED', slaBadge: 'مغلق', category: 'lost', ownersLabel: 'مدير العمليات' },
    ],
  },
  {
    module: 'الفواتير',
    fields: ['حالة الفاتورة (Invoice Status)', 'مسار التحصيل المالي'],
    defaultStates: [
      { id: 'inv_issued', title: 'فاتورة ضريبية صادرة', englishSubtitle: 'ISSUED TAX INVOICE', slaBadge: 'فوري', category: 'normal', ownersLabel: 'المحاسب المالي' },
      { id: 'inv_collection', title: 'قيد المتابعة والتحصيل', englishSubtitle: 'COLLECTION FOLLOW-UP', slaBadge: '14 يوماً', category: 'active', ownersLabel: 'مسؤول التحصيل' },
      { id: 'inv_paid', title: 'مسددة بالكامل', englishSubtitle: 'PAID IN FULL', slaBadge: 'محصلة', category: 'won', ownersLabel: 'أمين الخزينة' },
      { id: 'inv_overdue', title: 'متأخرة السداد / مطالبات', englishSubtitle: 'OVERDUE ESCALATION', slaBadge: 'تصعيد', category: 'lost', ownersLabel: 'الشؤون القانونية' },
    ],
  },
];

const AVAILABLE_ROLES = [
  'مدير النظام (System Admin)',
  'مدير المبيعات (Sales Director)',
  'مندوب مبيعات أول (Senior AE)',
  'مندوب المبيعات (Sales Rep)',
  'المدير المالي (CFO)',
  'المستشار القانوني (Legal Counsel)',
  'مهندس ما قبل البيع (Pre-Sales)',
  'أخصائي تطوير الأعمال (SDR)',
];

// ============================================================================
// INITIAL SEED BLUEPRINTS FOR DEFAULT ORG
// ============================================================================

function createSeedBlueprints(orgId: string): BlueprintDefinition[] {
  return [
    {
      id: 'bp_enterprise_deals',
      orgId,
      name: 'مسار صفقات الشركات الكبرى (B2B Enterprise)',
      description: 'حوكمة مراحل البيع المؤسسي من التأهيل والعرض التقني وحتى التفاوض القانوني والإغلاق.',
      module: 'الصفقات والمبيعات',
      linkedField: 'المرحلة (Stage)',
      criteria: 'قيمة الصفقة >= 50,000 ر.س أو نوع العميل = قطاع أعمال',
      active: true,
      updatedAt: 'منذ 15 دقيقة',
      createdBy: 'سلطان القحطاني',
      stages: [
        {
          id: 'st_lead_qual',
          title: 'تأهيل أولي',
          englishSubtitle: 'INITIAL QUALIFICATION',
          slaBadge: '24 ساعة',
          category: 'normal',
          ownersLabel: 'مندوب المبيعات',
          onCanvas: true,
          x: 70,
          y: 190,
        },
        {
          id: 'st_needs_analysis',
          title: 'تحليل الاحتياجات',
          englishSubtitle: 'NEEDS & DISCOVERY',
          slaBadge: '48 ساعة',
          category: 'normal',
          ownersLabel: 'مندوب مبيعات أول',
          onCanvas: true,
          x: 360,
          y: 190,
        },
        {
          id: 'st_tech_demo',
          title: 'عرض تقني وتجريبي',
          englishSubtitle: 'TECHNICAL DEMO',
          slaBadge: '3 أيام',
          category: 'active',
          ownersLabel: 'مهندس ما قبل البيع',
          onCanvas: true,
          x: 650,
          y: 190,
        },
        {
          id: 'st_quote_sent',
          title: 'إرسال عرض السعر',
          englishSubtitle: 'COMMERCIAL PROPOSAL',
          slaBadge: '48 ساعة',
          category: 'normal',
          ownersLabel: 'مدير الحسابات',
          onCanvas: true,
          x: 940,
          y: 190,
        },
        {
          id: 'st_negotiation',
          title: 'مفاوضات ومراجعة العقود',
          englishSubtitle: 'LEGAL & NEGOTIATION',
          slaBadge: '5 أيام',
          category: 'normal',
          ownersLabel: 'مدير المبيعات + القانونية',
          onCanvas: true,
          x: 1230,
          y: 190,
        },
        {
          id: 'st_closed_won',
          title: 'إغلاق ناجح (Won)',
          englishSubtitle: 'CLOSED WON',
          slaBadge: 'مرحلة نهائية',
          category: 'won',
          ownersLabel: 'النظام المالي ERP',
          onCanvas: true,
          x: 1530,
          y: 100,
        },
        {
          id: 'st_closed_lost',
          title: 'إغلاق خاسر (Lost)',
          englishSubtitle: 'CLOSED LOST',
          slaBadge: 'أرشفة وتحليل',
          category: 'lost',
          ownersLabel: 'مدير المبيعات',
          onCanvas: true,
          x: 1530,
          y: 295,
        },
      ],
      transitions: [
        {
          id: 'tr_qual_to_needs',
          name: 'اعتماد التأهيل',
          englishName: 'QUALIFY DEAL',
          fromStageId: 'st_lead_qual',
          toStageId: 'st_needs_analysis',
          tone: 'normal',
          slaDurationLabel: 'خلال 24 ساعة',
          enabled: true,
          roles: ['مندوب المبيعات (Sales Rep)', 'مندوب مبيعات أول (Senior AE)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [
            { id: 'c1', fieldLabel: 'الميزانية التقديرية', operatorLabel: 'أكبر من', valueLabel: '0 ر.س', enabled: true },
            { id: 'c2', fieldLabel: 'صاحب القرار الرئيسي', operatorLabel: 'غير فارغ', valueLabel: 'محدد', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf1', fieldName: 'الميزانية التقديرية للعميل (Budget)', fieldType: 'عملة (SAR)', required: true },
            { id: 'mf2', fieldName: 'عدد المستخدمين المتوقع', fieldType: 'رقم', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk1', title: 'التحقق من السجل التجاري والنشاط المؤسسي', required: true },
            { id: 'chk2', title: 'تحديد صانع القرار الفعلي في الشركة', required: true },
          ],
          afterActions: [
            { id: 'act1', type: 'create_task', label: 'إنشاء مهمة: جلسة تحليل الاحتياجات التفصيلية', targetDetail: 'تُسند لمندوب المبيعات خلال 24 ساعة', systemTag: 'Auto Task', enabled: true },
          ],
        },
        {
          id: 'tr_needs_to_demo',
          name: 'جدولة العرض التقني',
          englishName: 'SCHEDULE DEMO',
          fromStageId: 'st_needs_analysis',
          toStageId: 'st_tech_demo',
          tone: 'normal',
          slaDurationLabel: 'خلال 48 ساعة',
          enabled: true,
          roles: ['مندوب مبيعات أول (Senior AE)', 'مهندس ما قبل البيع (Pre-Sales)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [
            { id: 'c3', fieldLabel: 'نطاق المشروع الفني', operatorLabel: 'غير فارغ', valueLabel: 'موثق', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf3', fieldName: 'تاريخ وموعد العرض التقني', fieldType: 'تاريخ ووقت', required: true },
            { id: 'mf4', fieldName: 'قائمة الأنظمة المطلوبة للتكامل', fieldType: 'نص متعدد', required: true },
          ],
          requireNotes: false,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk3', title: 'إرسال دعوة التقويم للفريق التقني للعميل', required: true },
            { id: 'chk4', title: 'تجهيز بيئة العرض التجريبية (Sandbox)', required: true },
          ],
          afterActions: [
            { id: 'act2', type: 'whatsapp_email', label: 'إرسال رسالة تأكيد موعد العرض عبر واتساب والبريد', targetDetail: 'قالب: تأكيد جلسة العرض التقني', systemTag: 'Omnichannel', enabled: true },
          ],
        },
        {
          id: 'tr_demo_to_quote',
          name: 'إصدار عرض السعر',
          englishName: 'ISSUE PROPOSAL',
          fromStageId: 'st_tech_demo',
          toStageId: 'st_quote_sent',
          tone: 'normal',
          slaDurationLabel: 'خلال 48 ساعة',
          enabled: true,
          roles: ['مندوب مبيعات أول (Senior AE)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [
            { id: 'c4', fieldLabel: 'نتيجة العرض التقني', operatorLabel: 'يساوي', valueLabel: 'ناجح ومعتمد فنياً', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf5', fieldName: 'ملف عرض السعر المعتمد (PDF)', fieldType: 'مرفق', required: true },
            { id: 'mf6', fieldName: 'قيمة العرض الإجمالية شاملة الضريبة', fieldType: 'عملة (SAR)', required: true },
          ],
          requireNotes: true,
          requireAttachment: true,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk5', title: 'مراجعة بنود التسعير والخصم المسموح به', required: true },
            { id: 'chk6', title: 'التأكد من تضمين الرقم الضريبي (15%)', required: true },
          ],
          afterActions: [
            { id: 'act3', type: 'field_update', label: 'تحديث احتمالية الإغلاق إلى 65%', targetDetail: 'حقل: احتمالية الفوز (Probability)', systemTag: 'Field Update', enabled: true },
            { id: 'act4', type: 'whatsapp_email', label: 'إشعار العميل برابط عرض السعر الرسمي', targetDetail: 'قالب: عرض سعر رسمي - رواق', systemTag: 'WhatsApp API', enabled: true },
          ],
        },
        {
          id: 'tr_quote_to_negotiation',
          name: 'بدء التفاوض التعاقدي',
          englishName: 'START NEGOTIATION',
          fromStageId: 'st_quote_sent',
          toStageId: 'st_negotiation',
          tone: 'normal',
          slaDurationLabel: 'خلال 72 ساعة',
          enabled: true,
          roles: ['مدير المبيعات (Sales Director)', 'المستشار القانوني (Legal Counsel)', 'مندوب مبيعات أول (Senior AE)'],
          beforeConditions: [
            { id: 'c5', fieldLabel: 'رد العميل المبدئي على العرض', operatorLabel: 'يساوي', valueLabel: 'موافق مبدئياً للتفاوض', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf7', fieldName: 'مسودة العقد القانوني', fieldType: 'مرفق PDF/Docx', required: true },
            { id: 'mf8', fieldName: 'شروط الدفع المتفق عليها', fieldType: 'قائمة منسدلة', required: true },
          ],
          requireNotes: true,
          requireAttachment: true,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk7', title: 'مراجعة شروط اتفاقية مستوى الخدمة (SLA)', required: true },
            { id: 'chk8', title: 'اعتماد نسبة الخصم النهائية من مدير المبيعات', required: true },
          ],
          afterActions: [
            { id: 'act5', type: 'create_task', label: 'مهمة مراجعة قانونية لبنود العقد', targetDetail: 'تُسند للمستشار القانوني', systemTag: 'Legal SLA', enabled: true },
          ],
        },
        {
          id: 'tr_neg_loop_quote',
          name: 'إعادة تسعير العرض',
          englishName: 'REVISE QUOTE',
          fromStageId: 'st_negotiation',
          toStageId: 'st_quote_sent',
          tone: 'loop',
          slaDurationLabel: 'مسار رجوع (24 ساعة)',
          enabled: true,
          roles: ['مدير المبيعات (Sales Director)', 'المدير المالي (CFO)'],
          beforeConditions: [
            { id: 'c6', fieldLabel: 'طلب تعديل النطاق أو السعر', operatorLabel: 'يساوي', valueLabel: 'مطلوب مراجعة مالية', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf9', fieldName: 'سبب إعادة التسعير والخصم الإضافي', fieldType: 'نص طويل', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk9', title: 'توثيق ملاحظات العميل المالية بدقة', required: true },
          ],
          afterActions: [
            { id: 'act6', type: 'field_update', label: 'تحديث حالة العرض إلى "قيد التعديل"', targetDetail: 'وحدة عروض الأسعار', systemTag: 'Field Update', enabled: true },
          ],
        },
        {
          id: 'tr_neg_to_won',
          name: 'تعميد وإغلاق ناجح',
          englishName: 'CLOSE WON',
          fromStageId: 'st_negotiation',
          toStageId: 'st_closed_won',
          tone: 'won',
          slaDurationLabel: 'اعتماد فوري',
          enabled: true,
          roles: ['مدير المبيعات (Sales Director)', 'المدير المالي (CFO)', 'مدير النظام (System Admin)'],
          beforeConditions: [
            { id: 'c7', fieldLabel: 'حالة العقد القانوني', operatorLabel: 'يساوي', valueLabel: 'موقع ومختوم', enabled: true },
          ],
          mandatoryFields: [
            { id: 'mf10', fieldName: 'نسخة العقد الموقعة نهائياً (PDF)', fieldType: 'مرفق إلزامي', required: true },
            { id: 'mf11', fieldName: 'رقم أمر الشراء (PO Number)', fieldType: 'نص', required: true },
            { id: 'mf12', fieldName: 'تاريخ بدء التفعيل الفعلي', fieldType: 'تاريخ', required: true },
          ],
          requireNotes: true,
          requireAttachment: true,
          requireDigitalSignature: true,
          checklist: [
            { id: 'chk10', title: 'التحقق من مطابقة مبلغ التعميد مع الفاتورة الضريبية', required: true },
            { id: 'chk11', title: 'تأكيد استلام الدفعة الأولى أو ضمان الدفع', required: true },
          ],
          afterActions: [
            { id: 'act7', type: 'webhook', label: 'إنشاء فاتورة ضريبية تلقائية في نظام الحسابات ERP', targetDetail: 'POST /api/v1/erp/invoices', systemTag: 'ERP Webhook', enabled: true },
            { id: 'act8', type: 'whatsapp_email', label: 'إرسال رسالة ترحيبية وتفعيل حساب العميل', targetDetail: 'قالب: ترحيب بالعملاء الجدد', systemTag: 'Onboarding', enabled: true },
          ],
        },
        {
          id: 'tr_neg_to_lost',
          name: 'تسجيل خسارة الصفقة',
          englishName: 'CLOSE LOST',
          fromStageId: 'st_negotiation',
          toStageId: 'st_closed_lost',
          tone: 'lost',
          slaDurationLabel: 'توثيق إلزامي',
          enabled: true,
          roles: ['مندوب مبيعات أول (Senior AE)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'mf13', fieldName: 'السبب الرئيسي لخسارة الصفقة', fieldType: 'قائمة أسباب الخسارة', required: true },
            { id: 'mf14', fieldName: 'اسم المنافس الفائز (إن وجد)', fieldType: 'نص', required: false },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'chk12', title: 'توثيق الدروس المستفادة وتاريخ إعادة التواصل المستقبلي', required: true },
          ],
          afterActions: [
            { id: 'act9', type: 'create_task', label: 'جدولة تذكير لإعادة التواصل بعد 90 يوماً', targetDetail: 'حملة استعادة العملاء', systemTag: 'Win-back Task', enabled: true },
          ],
        },
      ],
    },
    {
      id: 'bp_lead_qualification',
      orgId,
      name: 'مسار تأهيل العملاء المحتملين (SDR Lead Qualification)',
      description: 'تنظيم عملية استلام العملاء المحتملين، الاتصال السريع خلال ساعتين، وتأهيلهم قبل تحويلهم لفريق المبيعات.',
      module: 'العملاء المحتملين',
      linkedField: 'حالة العميل (Lead Status)',
      criteria: 'جميع العملاء المحتملين الواردين من الحملات والموقع',
      active: true,
      updatedAt: 'أمس',
      createdBy: 'سارة العتيبي',
      stages: [
        { id: 'ld_new', title: 'عميل محتمل جديد', englishSubtitle: 'NEW INBOUND LEAD', slaBadge: 'ساعتان', category: 'normal', ownersLabel: 'فريق الاستقبال SDR', onCanvas: true, x: 90, y: 185 },
        { id: 'ld_contacted', title: 'تم التواصل الأولي', englishSubtitle: 'FIRST CONTACT MADE', slaBadge: '24 ساعة', category: 'active', ownersLabel: 'أخصائي تطوير الأعمال', onCanvas: true, x: 420, y: 185 },
        { id: 'ld_qualified', title: 'مؤهل مبيعياً (SQL)', englishSubtitle: 'SALES QUALIFIED', slaBadge: '48 ساعة', category: 'normal', ownersLabel: 'تنفيذي المبيعات', onCanvas: true, x: 750, y: 185 },
        { id: 'ld_converted', title: 'تم التحويل لصفقة', englishSubtitle: 'CONVERTED TO DEAL', slaBadge: 'مكتمل', category: 'won', ownersLabel: 'مدير المبيعات', onCanvas: true, x: 1090, y: 105 },
        { id: 'ld_disqualified', title: 'غير مؤهل / مستبعد', englishSubtitle: 'DISQUALIFIED', slaBadge: 'مغلق', category: 'lost', ownersLabel: 'فريق SDR', onCanvas: true, x: 1090, y: 280 },
      ],
      transitions: [
        {
          id: 'tr_ld_call',
          name: 'تسجيل مكالمة أولى',
          englishName: 'LOG FIRST CALL',
          fromStageId: 'ld_new',
          toStageId: 'ld_contacted',
          tone: 'normal',
          slaDurationLabel: 'خلال ساعتين',
          enabled: true,
          roles: ['أخصائي تطوير الأعمال (SDR)', 'مندوب المبيعات (Sales Rep)'],
          beforeConditions: [
            { id: 'lc1', fieldLabel: 'رقم الجوال أو البريد', operatorLabel: 'غير فارغ', valueLabel: 'متوفر', enabled: true },
          ],
          mandatoryFields: [
            { id: 'lmf1', fieldName: 'نتيجة الاتصال الأول', fieldType: 'قائمة منسدلة', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'lchk1', title: 'التأكد من صحة اسم الشركة والمنصب الوظيفي', required: true },
          ],
          afterActions: [
            { id: 'lact1', type: 'whatsapp_email', label: 'إرسال الكتيب التعريفي للشركة عبر واتساب', targetDetail: 'قالب: تعريف بخدمات رواق', systemTag: 'WhatsApp', enabled: true },
          ],
        },
        {
          id: 'tr_ld_qualify',
          name: 'اعتماد التأهيل (BANT)',
          englishName: 'QUALIFY BANT',
          fromStageId: 'ld_contacted',
          toStageId: 'ld_qualified',
          tone: 'normal',
          slaDurationLabel: 'خلال 24 ساعة',
          enabled: true,
          roles: ['أخصائي تطوير الأعمال (SDR)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'lmf2', fieldName: 'حجم الشركة (عدد الموظفين)', fieldType: 'رقم', required: true },
            { id: 'lmf3', fieldName: 'الخدمة المطلوبة', fieldType: 'قائمة', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'lchk2', title: 'تأكيد وجود ميزانية واحتياج فعلي خلال الربع الحالي', required: true },
          ],
          afterActions: [
            { id: 'lact2', type: 'field_update', label: 'رفع تقييم العميل إلى "ساخن (Hot)"', targetDetail: 'حقل: درجة الاهتمام', systemTag: 'Field Update', enabled: true },
          ],
        },
        {
          id: 'tr_ld_convert',
          name: 'تحويل إلى صفقة وحساب',
          englishName: 'CONVERT TO DEAL',
          fromStageId: 'ld_qualified',
          toStageId: 'ld_converted',
          tone: 'won',
          slaDurationLabel: 'فوري',
          enabled: true,
          roles: ['مندوب مبيعات أول (Senior AE)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'lmf4', fieldName: 'القيمة المتوقعة للصفقة الجديدة', fieldType: 'عملة (SAR)', required: true },
          ],
          requireNotes: false,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'lchk3', title: 'تعيين مسؤول الحساب (Account Owner)', required: true },
          ],
          afterActions: [
            { id: 'lact3', type: 'create_task', label: 'إنشاء مهمة ترحيب وجلسة استكشاف للمندوب', targetDetail: 'وحدة الصفقات', systemTag: 'Auto Deal Task', enabled: true },
          ],
        },
        {
          id: 'tr_ld_disqualify',
          name: 'استبعاد العميل المحتمل',
          englishName: 'DISQUALIFY LEAD',
          fromStageId: 'ld_contacted',
          toStageId: 'ld_disqualified',
          tone: 'lost',
          slaDurationLabel: 'توثيق السبب',
          enabled: true,
          roles: ['أخصائي تطوير الأعمال (SDR)', 'مدير المبيعات (Sales Director)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'lmf5', fieldName: 'سبب الاستبعاد', fieldType: 'قائمة', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [],
          afterActions: [],
        },
      ],
    },
    {
      id: 'bp_quote_approval',
      orgId,
      name: 'مسار اعتماد عروض الأسعار والخصومات (Quote Approval)',
      description: 'ضبط صلاحيات الخصم ومراجعة الإدارة المالية قبل إرسال عروض الأسعار للعملاء أو تحويلها لأوامر بيع.',
      module: 'عروض الأسعار',
      linkedField: 'حالة العرض (Quote Status)',
      criteria: 'نسبة الخصم > 10% أو إجمالي العرض > 25,000 ر.س',
      active: true,
      updatedAt: 'منذ 3 أيام',
      createdBy: 'سلطان القحطاني',
      stages: [
        { id: 'qt_draft', title: 'مسودة عرض سعر', englishSubtitle: 'DRAFT QUOTE', slaBadge: '4 ساعات', category: 'normal', ownersLabel: 'مندوب المبيعات', onCanvas: true, x: 80, y: 185 },
        { id: 'qt_mgr_review', title: 'مراجعة مدير المبيعات', englishSubtitle: 'MANAGER APPROVAL', slaBadge: '12 ساعة', category: 'active', ownersLabel: 'مدير المبيعات', onCanvas: true, x: 390, y: 185 },
        { id: 'qt_fin_review', title: 'اعتماد الإدارة المالية', englishSubtitle: 'FINANCE GOVERNANCE', slaBadge: '24 ساعة', category: 'normal', ownersLabel: 'المدير المالي CFO', onCanvas: true, x: 700, y: 185 },
        { id: 'qt_sent_client', title: 'مرسل للعميل لاعتماده', englishSubtitle: 'SENT TO CUSTOMER', slaBadge: '3 أيام', category: 'normal', ownersLabel: 'مندوب المبيعات', onCanvas: true, x: 1010, y: 185 },
        { id: 'qt_accepted', title: 'معتمد ومحول لأمر بيع', englishSubtitle: 'ACCEPTED & CONVERTED', slaBadge: 'معتمد', category: 'won', ownersLabel: 'النظام المالي', onCanvas: true, x: 1330, y: 120 },
      ],
      transitions: [
        {
          id: 'tr_qt_submit_mgr',
          name: 'رفع لمدير المبيعات',
          englishName: 'SUBMIT TO MANAGER',
          fromStageId: 'qt_draft',
          toStageId: 'qt_mgr_review',
          tone: 'normal',
          slaDurationLabel: 'خلال 4 ساعات',
          enabled: true,
          roles: ['مندوب المبيعات (Sales Rep)', 'مندوب مبيعات أول (Senior AE)'],
          beforeConditions: [
            { id: 'qc1', fieldLabel: 'بنود عرض السعر', operatorLabel: 'أكبر من', valueLabel: 'بند واحد على الأقل', enabled: true },
          ],
          mandatoryFields: [
            { id: 'qmf1', fieldName: 'مبررات منح الخصم التجاري', fieldType: 'نص', required: true },
          ],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'qchk1', title: 'التأكد من صحة الضريبة المضافة 15% وبيانات العميل', required: true },
          ],
          afterActions: [
            { id: 'qact1', type: 'create_task', label: 'إشعار فوري لمدير المبيعات لاعتماد العرض', targetDetail: 'تنبيه داخلي', systemTag: 'Approval Alert', enabled: true },
          ],
        },
        {
          id: 'tr_qt_mgr_to_fin',
          name: 'إحالة للاعتماد المالي',
          englishName: 'ESCALATE TO FINANCE',
          fromStageId: 'qt_mgr_review',
          toStageId: 'qt_fin_review',
          tone: 'normal',
          slaDurationLabel: 'خلال 12 ساعة',
          enabled: true,
          roles: ['مدير المبيعات (Sales Director)'],
          beforeConditions: [
            { id: 'qc2', fieldLabel: 'هامش الربح الإجمالي', operatorLabel: 'أكبر من أو يساوي', valueLabel: '22%', enabled: true },
          ],
          mandatoryFields: [],
          requireNotes: true,
          requireAttachment: false,
          requireDigitalSignature: false,
          checklist: [
            { id: 'qchk2', title: 'مراجعة هامش الربح وشروط الدفع الآجلة', required: true },
          ],
          afterActions: [],
        },
        {
          id: 'tr_qt_fin_to_send',
          name: 'اعتماد وإرسال للعميل',
          englishName: 'APPROVE & SEND',
          fromStageId: 'qt_fin_review',
          toStageId: 'qt_sent_client',
          tone: 'normal',
          slaDurationLabel: 'خلال 24 ساعة',
          enabled: true,
          roles: ['المدير المالي (CFO)', 'مدير النظام (System Admin)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'qmf2', fieldName: 'تاريخ انتهاء صلاحية العرض', fieldType: 'تاريخ', required: true },
          ],
          requireNotes: false,
          requireAttachment: false,
          requireDigitalSignature: true,
          checklist: [
            { id: 'qchk3', title: 'ختم العرض إلكترونياً بختم الإدارة المالية', required: true },
          ],
          afterActions: [
            { id: 'qact2', type: 'whatsapp_email', label: 'إرسال PDF عرض السعر المعتمد للعميل', targetDetail: 'بريد + واتساب', systemTag: 'Auto Send', enabled: true },
          ],
        },
        {
          id: 'tr_qt_client_accept',
          name: 'تعميد العميل وتحويل لأمر بيع',
          englishName: 'CLIENT ACCEPTED',
          fromStageId: 'qt_sent_client',
          toStageId: 'qt_accepted',
          tone: 'won',
          slaDurationLabel: 'فوري',
          enabled: true,
          roles: ['مندوب مبيعات أول (Senior AE)', 'مدير المبيعات (Sales Director)', 'المدير المالي (CFO)'],
          beforeConditions: [],
          mandatoryFields: [
            { id: 'qmf3', fieldName: 'تعميد العميل أو أمر الشراء الموقع', fieldType: 'مرفق PDF', required: true },
          ],
          requireNotes: true,
          requireAttachment: true,
          requireDigitalSignature: false,
          checklist: [
            { id: 'qchk4', title: 'إنشاء أمر بيع تلقائي في قسم المبيعات', required: true },
          ],
          afterActions: [
            { id: 'qact3', type: 'webhook', label: 'توليد أمر بيع تلقائي وربطه بالصفقة', targetDetail: 'وحدة أوامر البيع', systemTag: 'Sales Order Sync', enabled: true },
          ],
        },
      ],
    },
  ];
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BlueprintBuilderPage: React.FC = () => {
  const { firebaseUser, currentUser } = useCrm();
  const { currentOrgId } = useSetup();

  const [toastBanner, setToastBanner] = useState<{
    message: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, tone: 'success' | 'error' | 'info' = 'success') => {
    setToastBanner({ message, tone });
    window.setTimeout(() => {
      setToastBanner((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const storageKey = `riwaq_zoho_blueprints_v2_${currentOrgId}`;

  // Load blueprints for currentOrgId
  const [blueprints, setBlueprints] = useState<BlueprintDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(`riwaq_zoho_blueprints_v2_${currentOrgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return currentOrgId === 'org_riwaq_main' ? createSeedBlueprints(currentOrgId) : [];
  });

  // View step: 'list' (Blueprints table) or 'editor' (Visual Flowchart Builder)
  const [viewStep, setViewStep] = useState<'list' | 'editor'>('list');
  const [activeBlueprintId, setActiveBlueprintId] = useState<string>(
    () => (currentOrgId === 'org_riwaq_main' ? 'bp_enterprise_deals' : ''),
  );

  // Sync when switching organizations
  useEffect(() => {
    let loaded: BlueprintDefinition[] = [];
    try {
      const saved = localStorage.getItem(`riwaq_zoho_blueprints_v2_${currentOrgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) loaded = parsed;
      } else if (currentOrgId === 'org_riwaq_main') {
        loaded = createSeedBlueprints(currentOrgId);
      }
    } catch {
      loaded = currentOrgId === 'org_riwaq_main' ? createSeedBlueprints(currentOrgId) : [];
    }
    setBlueprints(loaded);
    setViewStep('list');
    setActiveBlueprintId(loaded[0]?.id ?? '');

    if (firebaseUser) {
      const ref = doc(db, 'organizations', currentOrgId, 'settings', 'blueprints_definitions');
      getDoc(ref)
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.items)) {
              setBlueprints(data.items as BlueprintDefinition[]);
              localStorage.setItem(`riwaq_zoho_blueprints_v2_${currentOrgId}`, JSON.stringify(data.items));
            }
          }
        })
        .catch(() => {
          // fallback to local state silently
        });
    }
  }, [currentOrgId, firebaseUser]);

  // Persist helper (saves to localStorage + Firestore settings + blueprints summary collection)
  const persistBlueprintsList = async (
    nextList: BlueprintDefinition[],
    changedBlueprint?: BlueprintDefinition,
  ) => {
    setBlueprints(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {
      // ignore quota errors
    }

    if (firebaseUser) {
      try {
        await setDoc(
          doc(db, 'organizations', currentOrgId, 'settings', 'blueprints_definitions'),
          {
            items: nextList,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.fullName || 'مدير النظام',
          },
          { merge: true },
        );

        if (changedBlueprint) {
          const stagesCount = Math.max(
            1,
            Math.min(30, changedBlueprint.stages.filter((s) => s.onCanvas).length || 1),
          );
          await setDoc(
            doc(db, 'blueprints', changedBlueprint.id),
            {
              ownerId: firebaseUser.uid,
              org_id: currentOrgId.slice(0, 128),
              name: changedBlueprint.name.slice(0, 120),
              module: changedBlueprint.module.slice(0, 60),
              active: Boolean(changedBlueprint.active),
              stagesCount,
              description: (changedBlueprint.description || changedBlueprint.criteria || '').slice(0, 300),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'organizations/settings/blueprints_definitions');
        } catch {
          // handled
        }
      }
    }
  };

  // List View Filters
  const [listSearch, setListSearch] = useState('');
  const [listModuleFilter, setListModuleFilter] = useState<string>('ALL');
  const [listStatusFilter, setListStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Create New Blueprint Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBpName, setNewBpName] = useState('');
  const [newBpModule, setNewBpModule] = useState(MODULE_OPTIONS[0].module);
  const [newBpField, setNewBpField] = useState(MODULE_OPTIONS[0].fields[0]);
  const [newBpCriteria, setNewBpCriteria] = useState('كافة السجلات في الموديول');
  const [newBpDescription, setNewBpDescription] = useState('');

  // Active Blueprint in Editor
  const activeBlueprint = useMemo(
    () => blueprints.find((b) => b.id === activeBlueprintId) ?? blueprints[0] ?? null,
    [blueprints, activeBlueprintId],
  );

  // Selected element in Editor: either a Transition or a Stage
  const [selectedElement, setSelectedElement] = useState<{
    type: 'transition' | 'stage';
    id: string;
  } | null>(null);

  // Active tab in Transition Inspector ('before' | 'during' | 'after')
  const [inspectorTab, setInspectorTab] = useState<'before' | 'during' | 'after'>('during');

  // Ensure a valid selection when entering editor or changing activeBlueprint
  useEffect(() => {
    if (!activeBlueprint) {
      setSelectedElement(null);
      return;
    }
    if (selectedElement) {
      if (
        selectedElement.type === 'transition' &&
        activeBlueprint.transitions.some((t) => t.id === selectedElement.id)
      ) {
        return;
      }
      if (
        selectedElement.type === 'stage' &&
        activeBlueprint.stages.some((s) => s.id === selectedElement.id)
      ) {
        return;
      }
    }
    if (activeBlueprint.transitions.length > 0) {
      setSelectedElement({ type: 'transition', id: activeBlueprint.transitions[0].id });
    } else {
      const firstCanvasStage = activeBlueprint.stages.find((s) => s.onCanvas) ?? activeBlueprint.stages[0];
      if (firstCanvasStage) {
        setSelectedElement({ type: 'stage', id: firstCanvasStage.id });
      }
    }
  }, [activeBlueprintId, activeBlueprint]);

  // Canvas Zoom & Pan State
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Dragging a Stage Node on the Canvas
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const dragNodeRef = useRef<{
    stageId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Interactive Connection Creation (Click "+" or Drag from Stage Port to another Stage)
  const [connectingFromStageId, setConnectingFromStageId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Add New Stage Modal
  const [newStageModalOpen, setNewStageModalOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageSub, setNewStageSub] = useState('');
  const [newStageSla, setNewStageSla] = useState('24 ساعة');
  const [newStageCategory, setNewStageCategory] = useState<BlueprintStageCategory>('normal');
  const [newStageOwner, setNewStageOwner] = useState('مندوب المبيعات');

  // Create Transition Modal (when user clicks "+ إضافة انتقال" or connects two nodes)
  const [newTransitionModal, setNewTransitionModal] = useState<{
    open: boolean;
    fromStageId: string;
    toStageId: string;
    name: string;
    englishName: string;
    tone: BlueprintTransitionTone;
    sla: string;
  }>({
    open: false,
    fromStageId: '',
    toStageId: '',
    name: '',
    englishName: '',
    tone: 'normal',
    sla: 'خلال 24 ساعة',
  });

  // Inspector inline forms
  const [newConditionField, setNewConditionField] = useState('');
  const [newConditionOp, setNewConditionOp] = useState('غير فارغ');
  const [newConditionVal, setNewConditionVal] = useState('محدد');

  const [newMandatoryFieldName, setNewMandatoryFieldName] = useState('');
  const [newMandatoryFieldType, setNewMandatoryFieldType] = useState('نص');

  const [newChecklistText, setNewChecklistText] = useState('');

  const [newActionType, setNewActionType] = useState<BlueprintAfterActionType>('field_update');
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionTarget, setNewActionTarget] = useState('');

  const [isSavingCloud, setIsSavingCloud] = useState(false);

  // Interactive Simulator Modal State
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simCurrentStageId, setSimCurrentStageId] = useState<string>('');
  const [simRole, setSimRole] = useState<string>('مدير المبيعات (Sales Director)');
  const [simActiveTransitionId, setSimActiveTransitionId] = useState<string | null>(null);
  const [simFieldValues, setSimFieldValues] = useState<Record<string, string>>({});
  const [simChecklistValues, setSimChecklistValues] = useState<Record<string, boolean>>({});
  const [simNotes, setSimNotes] = useState('');
  const [simAttachmentAdded, setSimAttachmentAdded] = useState(false);
  const [simSignatureSigned, setSimSignatureSigned] = useState(false);
  const [simHistory, setSimHistory] = useState<
    { fromTitle: string; toTitle: string; transitionName: string; time: string; actionsRun: string[] }[]
  >([]);

  // ============================================================================
  // MUTATION HELPERS FOR ACTIVE BLUEPRINT
  // ============================================================================

  const updateActiveBlueprint = (updater: (bp: BlueprintDefinition) => BlueprintDefinition) => {
    if (!activeBlueprint) return;
    const updatedBp = updater({
      ...activeBlueprint,
      updatedAt: 'الآن',
    });
    const nextList = blueprints.map((b) => (b.id === updatedBp.id ? updatedBp : b));
    setBlueprints(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const selectedTransition = useMemo(() => {
    if (!activeBlueprint || selectedElement?.type !== 'transition') return null;
    return activeBlueprint.transitions.find((t) => t.id === selectedElement.id) ?? null;
  }, [activeBlueprint, selectedElement]);

  const selectedStage = useMemo(() => {
    if (!activeBlueprint || selectedElement?.type !== 'stage') return null;
    return activeBlueprint.stages.find((s) => s.id === selectedElement.id) ?? null;
  }, [activeBlueprint, selectedElement]);

  const updateSelectedTransition = (
    updater: (tr: BlueprintTransitionConfig) => BlueprintTransitionConfig,
  ) => {
    if (!selectedTransition) return;
    updateActiveBlueprint((bp) => ({
      ...bp,
      transitions: bp.transitions.map((t) => (t.id === selectedTransition.id ? updater(t) : t)),
    }));
  };

  const updateSelectedStage = (updater: (st: BlueprintStageNode) => BlueprintStageNode) => {
    if (!selectedStage) return;
    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: bp.stages.map((s) => (s.id === selectedStage.id ? updater(s) : s)),
    }));
  };

  // ============================================================================
  // BLUEPRINTS LIST ACTIONS
  // ============================================================================

  const filteredBlueprints = useMemo(() => {
    return blueprints.filter((bp) => {
      const q = listSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        bp.name.toLowerCase().includes(q) ||
        bp.module.toLowerCase().includes(q) ||
        bp.linkedField.toLowerCase().includes(q) ||
        bp.criteria.toLowerCase().includes(q);
      const matchesModule = listModuleFilter === 'ALL' || bp.module === listModuleFilter;
      const matchesStatus =
        listStatusFilter === 'ALL' ||
        (listStatusFilter === 'ACTIVE' && bp.active) ||
        (listStatusFilter === 'INACTIVE' && !bp.active);
      return matchesQuery && matchesModule && matchesStatus;
    });
  }, [blueprints, listSearch, listModuleFilter, listStatusFilter]);

  const handleCreateBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newBpName.trim();
    if (!cleanName) {
      showToast('يرجى إدخال اسم البلوبرينت أولاً.', 'error');
      return;
    }

    const modulePreset =
      MODULE_OPTIONS.find((m) => m.module === newBpModule) ?? MODULE_OPTIONS[0];

    const initialStages: BlueprintStageNode[] = modulePreset.defaultStates.map((st, idx) => ({
      ...st,
      onCanvas: idx < 4, // Place first 4 stages neatly on the canvas automatically
      x: 90 + idx * 310,
      y: 185,
    }));

    // Build starter transitions between the first 3 placed stages
    const starterTransitions: BlueprintTransitionConfig[] = [];
    const placed = initialStages.filter((s) => s.onCanvas);
    for (let i = 0; i < placed.length - 1; i++) {
      const fromSt = placed[i];
      const toSt = placed[i + 1];
      starterTransitions.push({
        id: `tr_${Date.now()}_${i}`,
        name: `الانتقال إلى ${toSt.title}`,
        englishName: `MOVE TO ${toSt.englishSubtitle}`,
        fromStageId: fromSt.id,
        toStageId: toSt.id,
        tone: toSt.category === 'won' ? 'won' : toSt.category === 'lost' ? 'lost' : 'normal',
        slaDurationLabel: 'خلال 24 ساعة',
        enabled: true,
        roles: ['مندوب المبيعات (Sales Rep)', 'مدير المبيعات (Sales Director)'],
        beforeConditions: [
          {
            id: `cond_${Date.now()}_${i}`,
            fieldLabel: newBpField,
            operatorLabel: 'يساوي',
            valueLabel: fromSt.title,
            enabled: true,
          },
        ],
        mandatoryFields: [
          {
            id: `mf_${Date.now()}_${i}`,
            fieldName: `ملاحظات مرحلة ${toSt.title}`,
            fieldType: 'نص',
            required: true,
          },
        ],
        requireNotes: true,
        requireAttachment: false,
        requireDigitalSignature: false,
        checklist: [
          {
            id: `chk_${Date.now()}_${i}`,
            title: `استكمال متطلبات مرحلة "${fromSt.title}"`,
            required: true,
          },
        ],
        afterActions: [
          {
            id: `act_${Date.now()}_${i}`,
            type: 'field_update',
            label: `تحديث ${newBpField} تلقائياً إلى "${toSt.title}"`,
            targetDetail: newBpModule,
            systemTag: 'Field Update',
            enabled: true,
          },
        ],
      });
    }

    const created: BlueprintDefinition = {
      id: `bp_${Date.now()}`,
      orgId: currentOrgId,
      name: cleanName,
      description:
        newBpDescription.trim() ||
        `مخطط سير عمل مؤتمت لوحدة ${newBpModule} مرتبط بحقل ${newBpField}.`,
      module: newBpModule,
      linkedField: newBpField,
      criteria: newBpCriteria.trim() || 'كافة السجلات في الموديول',
      active: true,
      updatedAt: 'الآن',
      createdBy: currentUser.fullName || 'مدير النظام',
      stages: initialStages,
      transitions: starterTransitions,
    };

    const nextList = [created, ...blueprints];
    await persistBlueprintsList(nextList, created);

    setCreateModalOpen(false);
    setNewBpName('');
    setNewBpDescription('');
    setNewBpCriteria('كافة السجلات في الموديول');

    setActiveBlueprintId(created.id);
    if (starterTransitions[0]) {
      setSelectedElement({ type: 'transition', id: starterTransitions[0].id });
    } else if (placed[0]) {
      setSelectedElement({ type: 'stage', id: placed[0].id });
    }
    setViewStep('editor');
    showToast(`تم إنشاء البلوبرينت "${created.name}" وفتح المحرر البصري.`, 'success');
  };

  const handleToggleBlueprintActive = async (bp: BlueprintDefinition) => {
    const updated = { ...bp, active: !bp.active, updatedAt: 'الآن' };
    const nextList = blueprints.map((item) => (item.id === bp.id ? updated : item));
    await persistBlueprintsList(nextList, updated);
    showToast(
      updated.active
        ? `تم تفعيل مخطط "${updated.name}" بنجاح.`
        : `تم إيقاف مخطط "${updated.name}" مؤقتاً.`,
      'info',
    );
  };

  const handleDuplicateBlueprint = async (bp: BlueprintDefinition) => {
    const cloned: BlueprintDefinition = {
      ...JSON.parse(JSON.stringify(bp)),
      id: `bp_${Date.now()}`,
      name: `${bp.name} (نسخة)`,
      active: false,
      updatedAt: 'الآن',
      createdBy: currentUser.fullName || 'مدير النظام',
    };
    const nextList = [cloned, ...blueprints];
    await persistBlueprintsList(nextList, cloned);
    showToast(`تم نسخ المخطط إلى "${cloned.name}".`, 'success');
  };

  const handleDeleteBlueprint = async (bp: BlueprintDefinition) => {
    const nextList = blueprints.filter((item) => item.id !== bp.id);
    setBlueprints(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {
      // ignore
    }
    if (firebaseUser) {
      try {
        await setDoc(
          doc(db, 'organizations', currentOrgId, 'settings', 'blueprints_definitions'),
          { items: nextList, updatedAt: serverTimestamp() },
          { merge: true },
        );
        await deleteDoc(doc(db, 'blueprints', bp.id));
      } catch {
        // ignore if doc wasn't in cloud yet
      }
    }
    if (activeBlueprintId === bp.id) {
      setActiveBlueprintId(nextList[0]?.id ?? '');
    }
    showToast(`تم حذف البلوبرينت "${bp.name}".`, 'info');
  };

  // ============================================================================
  // CANVAS INTERACTION HANDLERS (DRAG NODES, PAN, ZOOM, AUTO-ARRANGE, CONNECT)
  // ============================================================================

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only pan when clicking directly on background grid
    if ((e.target as HTMLElement).dataset.canvasBg === 'true') {
      if (connectingFromStageId) {
        setConnectingFromStageId(null);
        setMouseCanvasPos(null);
        return;
      }
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleStageMouseDown = (e: React.MouseEvent, stage: BlueprintStageNode) => {
    e.stopPropagation();
    // If we are in "connecting mode" from another stage, clicking this stage completes the connection!
    if (connectingFromStageId && connectingFromStageId !== stage.id) {
      openQuickTransitionBuilder(connectingFromStageId, stage.id);
      setConnectingFromStageId(null);
      setMouseCanvasPos(null);
      return;
    }

    setSelectedElement({ type: 'stage', id: stage.id });
    setDraggingStageId(stage.id);
    dragNodeRef.current = {
      stageId: stage.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: stage.x,
      origY: stage.y,
      moved: false,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingStageId && dragNodeRef.current && activeBlueprint) {
      // Note: page is RTL, but SVG/absolute left coordinates increase from left to right
      const dx = (e.clientX - dragNodeRef.current.startClientX) / zoom;
      const dy = (e.clientY - dragNodeRef.current.startClientY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragNodeRef.current.moved = true;
      }
      const nextX = Math.max(20, Math.round((dragNodeRef.current.origX + dx) / 10) * 10);
      const nextY = Math.max(20, Math.round((dragNodeRef.current.origY + dy) / 10) * 10);

      updateActiveBlueprint((bp) => ({
        ...bp,
        stages: bp.stages.map((s) =>
          s.id === dragNodeRef.current?.stageId ? { ...s, x: nextX, y: nextY } : s,
        ),
      }));
      return;
    }

    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    if (connectingFromStageId && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setMouseCanvasPos({ x, y });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingStageId(null);
    dragNodeRef.current = null;
    setIsPanning(false);
    panStartRef.current = null;
  };

  // Drag & drop available state from Right Sidebar onto Canvas
  const handleSidebarStageDragStart = (e: React.DragEvent, stageId: string) => {
    e.dataTransfer.setData('text/blueprint-stage-id', stageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stageId = e.dataTransfer.getData('text/blueprint-stage-id');
    if (!stageId || !activeBlueprint || !canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const dropX = Math.max(30, Math.round(((e.clientX - rect.left - pan.x) / zoom - 110) / 10) * 10);
    const dropY = Math.max(30, Math.round(((e.clientY - rect.top - pan.y) / zoom - 45) / 10) * 10);

    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: bp.stages.map((s) =>
        s.id === stageId ? { ...s, onCanvas: true, x: dropX, y: dropY } : s,
      ),
    }));
    setSelectedElement({ type: 'stage', id: stageId });
    const st = activeBlueprint.stages.find((s) => s.id === stageId);
    if (st) {
      showToast(`تم وضع مرحلة "${st.title}" على لوحة المخطط.`, 'success');
    }
  };

  const handlePlaceStageOnCanvas = (stageId: string) => {
    if (!activeBlueprint) return;
    const canvasStages = activeBlueprint.stages.filter((s) => s.onCanvas);
    const maxX = canvasStages.reduce((max, s) => Math.max(max, s.x), 60);
    const nextX = canvasStages.length === 0 ? 80 : maxX + 290;
    const nextY = 185;

    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: bp.stages.map((s) =>
        s.id === stageId ? { ...s, onCanvas: true, x: nextX, y: nextY } : s,
      ),
    }));
    setSelectedElement({ type: 'stage', id: stageId });
    const st = activeBlueprint.stages.find((s) => s.id === stageId);
    if (st) {
      showToast(`تمت إضافة مرحلة "${st.title}" إلى لوحة الرسم.`, 'success');
    }
  };

  const handleRemoveStageFromCanvas = (stageId: string) => {
    if (!activeBlueprint) return;
    const st = activeBlueprint.stages.find((s) => s.id === stageId);
    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: bp.stages.map((s) => (s.id === stageId ? { ...s, onCanvas: false } : s)),
      transitions: bp.transitions.filter(
        (t) => t.fromStageId !== stageId && t.toStageId !== stageId,
      ),
    }));
    setSelectedElement(null);
    if (st) {
      showToast(`تمت إزالة مرحلة "${st.title}" من اللوحة وإعادتها للمراحل المتاحة.`, 'info');
    }
  };

  const handleAutoArrangeCanvas = () => {
    if (!activeBlueprint) return;
    const canvasStages = activeBlueprint.stages.filter((s) => s.onCanvas);
    const normalStages = canvasStages.filter((s) => s.category !== 'won' && s.category !== 'lost');
    const terminalStages = canvasStages.filter((s) => s.category === 'won' || s.category === 'lost');

    const arrangedMap = new Map<string, { x: number; y: number }>();
    normalStages.forEach((st, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      arrangedMap.set(st.id, {
        x: 75 + col * 295,
        y: 185 + row * 210,
      });
    });

    const termX = 75 + Math.min(normalStages.length, 5) * 295;
    terminalStages.forEach((st, idx) => {
      arrangedMap.set(st.id, {
        x: Math.max(380, termX),
        y: 105 + idx * 185,
      });
    });

    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: bp.stages.map((s) => {
        const pos = arrangedMap.get(s.id);
        return pos ? { ...s, x: pos.x, y: pos.y } : s;
      }),
    }));
    setPan({ x: 20, y: 20 });
    setZoom(0.95);
    showToast('تم تنسيق وترتيب عقد المخطط البصري تلقائياً.', 'success');
  };

  // Create New Custom Stage
  const handleCreateCustomStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlueprint || !newStageTitle.trim()) return;
    const canvasStages = activeBlueprint.stages.filter((s) => s.onCanvas);
    const maxX = canvasStages.reduce((max, s) => Math.max(max, s.x), 60);
    const newStage: BlueprintStageNode = {
      id: `st_custom_${Date.now()}`,
      title: newStageTitle.trim(),
      englishSubtitle: (newStageSub.trim() || 'CUSTOM STAGE').toUpperCase(),
      slaBadge: newStageSla.trim() || '24 ساعة',
      category: newStageCategory,
      ownersLabel: newStageOwner.trim() || 'مندوب المبيعات',
      onCanvas: true,
      x: canvasStages.length === 0 ? 80 : maxX + 290,
      y: 185,
    };

    updateActiveBlueprint((bp) => ({
      ...bp,
      stages: [...bp.stages, newStage],
    }));
    setSelectedElement({ type: 'stage', id: newStage.id });
    setNewStageModalOpen(false);
    setNewStageTitle('');
    setNewStageSub('');
    showToast(`تم إنشاء مرحلة "${newStage.title}" وإضافتها إلى اللوحة.`, 'success');
  };

  // Open Transition Builder Modal between two stages
  const openQuickTransitionBuilder = (fromId: string, toId: string) => {
    if (!activeBlueprint) return;
    const fromSt = activeBlueprint.stages.find((s) => s.id === fromId);
    const toSt = activeBlueprint.stages.find((s) => s.id === toId);
    if (!fromSt || !toSt) return;

    const inferredTone: BlueprintTransitionTone =
      toSt.category === 'won'
        ? 'won'
        : toSt.category === 'lost'
          ? 'lost'
          : toSt.x < fromSt.x
            ? 'loop'
            : 'normal';

    setNewTransitionModal({
      open: true,
      fromStageId: fromId,
      toStageId: toId,
      name: `الانتقال إلى ${toSt.title}`,
      englishName: `TO ${toSt.englishSubtitle}`,
      tone: inferredTone,
      sla: 'خلال 24 ساعة',
    });
  };

  const handleConfirmCreateTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlueprint) return;
    const { fromStageId, toStageId, name, englishName, tone, sla } = newTransitionModal;
    if (!fromStageId || !toStageId || !name.trim()) return;

    const toStage = activeBlueprint.stages.find((s) => s.id === toStageId);

    const newTr: BlueprintTransitionConfig = {
      id: `tr_${Date.now()}`,
      name: name.trim(),
      englishName: (englishName.trim() || 'TRANSITION').toUpperCase(),
      fromStageId,
      toStageId,
      tone,
      slaDurationLabel: sla.trim() || 'خلال 24 ساعة',
      enabled: true,
      roles: ['مندوب المبيعات (Sales Rep)', 'مدير المبيعات (Sales Director)'],
      beforeConditions: [],
      mandatoryFields: [
        {
          id: `mf_${Date.now()}`,
          fieldName: `ملاحظات الانتقال إلى ${toStage?.title ?? ''}`,
          fieldType: 'نص',
          required: true,
        },
      ],
      requireNotes: true,
      requireAttachment: false,
      requireDigitalSignature: false,
      checklist: [
        {
          id: `chk_${Date.now()}`,
          title: `التحقق من اكتمال متطلبات ${name.trim()}`,
          required: true,
        },
      ],
      afterActions: [
        {
          id: `act_${Date.now()}`,
          type: 'field_update',
          label: `تحديث ${activeBlueprint.linkedField} إلى "${toStage?.title ?? ''}"`,
          targetDetail: activeBlueprint.module,
          systemTag: 'Field Update',
          enabled: true,
        },
      ],
    };

    updateActiveBlueprint((bp) => ({
      ...bp,
      transitions: [...bp.transitions, newTr],
    }));
    setSelectedElement({ type: 'transition', id: newTr.id });
    setInspectorTab('during');
    setNewTransitionModal((prev) => ({ ...prev, open: false }));
    showToast(`تم إنشاء الانتقال "${newTr.name}" وربطه على المخطط.`, 'success');
  };

  const handleDeleteTransition = (trId: string) => {
    if (!activeBlueprint) return;
    const tr = activeBlueprint.transitions.find((t) => t.id === trId);
    updateActiveBlueprint((bp) => ({
      ...bp,
      transitions: bp.transitions.filter((t) => t.id !== trId),
    }));
    setSelectedElement(null);
    if (tr) {
      showToast(`تم حذف الانتقال "${tr.name}".`, 'info');
    }
  };

  // Save & Publish Blueprint to Cloud + Local
  const handleSaveAndPublishBlueprint = async () => {
    if (!activeBlueprint) return;
    setIsSavingCloud(true);
    try {
      await persistBlueprintsList(blueprints, activeBlueprint);
      showToast(
        firebaseUser
          ? `تم حفظ ونشر البلوبرينت "${activeBlueprint.name}" في سحابة Firestore بنجاح.`
          : `تم حفظ ونشر البلوبرينت "${activeBlueprint.name}" في مساحة المؤسسة بنجاح.`,
        'success',
      );
    } finally {
      setIsSavingCloud(false);
    }
  };

  // ============================================================================
  // INTERACTIVE SIMULATOR LOGIC
  // ============================================================================

  const openSimulator = (bpToSimulate?: BlueprintDefinition) => {
    const bp = bpToSimulate ?? activeBlueprint;
    if (!bp) return;
    if (bp.id !== activeBlueprintId) {
      setActiveBlueprintId(bp.id);
    }
    const canvasStages = bp.stages.filter((s) => s.onCanvas);
    // Find initial stage (a stage with outgoing transitions and no incoming forward transitions, or first canvas stage)
    const firstStage = canvasStages[0];
    setSimCurrentStageId(firstStage?.id ?? '');
    setSimActiveTransitionId(null);
    setSimFieldValues({});
    setSimChecklistValues({});
    setSimNotes('');
    setSimAttachmentAdded(false);
    setSimSignatureSigned(false);
    setSimHistory([]);
    setSimModalOpen(true);
  };

  const handleTriggerSimulatedTransition = (tr: BlueprintTransitionConfig) => {
    if (!activeBlueprint) return;
    // Check Role permission (Before)
    if (tr.roles.length > 0 && !tr.roles.includes(simRole)) {
      showToast(`الدور الحالي (${simRole}) غير مصرح له بتنفيذ انتقال "${tr.name}".`, 'error');
      return;
    }
    setSimActiveTransitionId(tr.id);
    setSimFieldValues({});
    setSimChecklistValues({});
    setSimNotes('');
    setSimAttachmentAdded(false);
    setSimSignatureSigned(false);
  };

  const handleCompleteSimulatedTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlueprint || !simActiveTransitionId) return;
    const tr = activeBlueprint.transitions.find((t) => t.id === simActiveTransitionId);
    if (!tr) return;

    // Validate mandatory fields
    for (const mf of tr.mandatoryFields) {
      if (mf.required && !simFieldValues[mf.id]?.trim()) {
        showToast(`يرجى تعبئة الحقل الإلزامي: "${mf.fieldName}"`, 'error');
        return;
      }
    }
    // Validate required notes
    if (tr.requireNotes && !simNotes.trim()) {
      showToast('إدخال ملاحظات المندوب إلزامي لإتمام هذا الانتقال.', 'error');
      return;
    }
    // Validate required attachment
    if (tr.requireAttachment && !simAttachmentAdded) {
      showToast('يرجى إرفاق المستند المطلوب قبل تنفيذ الانتقال.', 'error');
      return;
    }
    // Validate digital signature
    if (tr.requireDigitalSignature && !simSignatureSigned) {
      showToast('التوقيع الإلكتروني المعتمد مطلوب لإتمام هذا الانتقال.', 'error');
      return;
    }
    // Validate checklist
    for (const item of tr.checklist) {
      if (item.required && !simChecklistValues[item.id]) {
        showToast(`يرجى التأشير على بند التحقق الإلزامي: "${item.title}"`, 'error');
        return;
      }
    }

    const fromSt = activeBlueprint.stages.find((s) => s.id === tr.fromStageId);
    const toSt = activeBlueprint.stages.find((s) => s.id === tr.toStageId);

    setSimCurrentStageId(tr.toStageId);
    setSimActiveTransitionId(null);
    setSimHistory((prev) => [
      ...prev,
      {
        fromTitle: fromSt?.title ?? '',
        toTitle: toSt?.title ?? '',
        transitionName: tr.name,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        actionsRun: tr.afterActions.filter((a) => a.enabled).map((a) => a.label),
      },
    ]);
    showToast(`تم تنفيذ الانتقال "${tr.name}" بنجاح وتشغيل الإجراءات التلقائية.`, 'success');
  };

  // ============================================================================
  // GEOMETRY CALCULATION FOR SVG CURVES & BADGES
  // ============================================================================

  const NODE_WIDTH = 216;
  const NODE_HEIGHT = 96;

  const canvasTransitionsWithGeometry = useMemo(() => {
    if (!activeBlueprint) return [];
    const stageMap = new Map<string, BlueprintStageNode>();
    activeBlueprint.stages.forEach((s) => {
      if (s.onCanvas) stageMap.set(s.id, s);
    });

    // Track multiple transitions between same pair for clean vertical offset
    const pairCounter = new Map<string, number>();

    return activeBlueprint.transitions
      .map((tr) => {
        const from = stageMap.get(tr.fromStageId);
        const to = stageMap.get(tr.toStageId);
        if (!from || !to) return null;

        const pairKey = [from.id, to.id].sort().join('__');
        const pairIdx = pairCounter.get(pairKey) ?? 0;
        pairCounter.set(pairKey, pairIdx + 1);

        const isBackwardOrLoop = to.x < from.x - 20 || tr.tone === 'loop';

        let startX: number;
        let startY: number;
        let endX: number;
        let endY: number;
        let pathD: string;
        let midX: number;
        let midY: number;

        if (!isBackwardOrLoop) {
          startX = from.x + NODE_WIDTH;
          startY = from.y + NODE_HEIGHT / 2 + (pairIdx > 0 ? pairIdx * 24 : 0);
          endX = to.x;
          endY = to.y + NODE_HEIGHT / 2 + (pairIdx > 0 ? pairIdx * 24 : 0);
          const dx = Math.max(60, Math.abs(endX - startX) * 0.45);
          pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
          midX = (startX + endX) / 2;
          midY = (startY + endY) / 2 + (pairIdx > 0 ? pairIdx * 18 : 0);
        } else {
          // Curved loop arch underneath the nodes
          startX = from.x + NODE_WIDTH / 2;
          startY = from.y + NODE_HEIGHT;
          endX = to.x + NODE_WIDTH / 2;
          endY = to.y + NODE_HEIGHT;
          const archY = Math.max(startY, endY) + 95 + pairIdx * 35;
          pathD = `M ${startX} ${startY} C ${startX} ${archY}, ${endX} ${archY}, ${endX} ${endY}`;
          midX = (startX + endX) / 2;
          midY = archY - 22;
        }

        return {
          tr,
          from,
          to,
          pathD,
          midX,
          midY,
          isBackwardOrLoop,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [activeBlueprint]);

  // ============================================================================
  // RENDER: VIEW 1 — BLUEPRINTS LIST VIEW (قائمة البلوبرينت المتعددة)
  // ============================================================================

  if (viewStep === 'list') {
    const activeCount = blueprints.filter((b) => b.active).length;
    const totalStagesCount = blueprints.reduce(
      (sum, b) => sum + b.stages.filter((s) => s.onCanvas).length,
      0,
    );
    const totalTransitionsCount = blueprints.reduce((sum, b) => sum + b.transitions.length, 0);

    return (
      <div dir="rtl" className="min-h-full bg-[#F8FAFC] p-4 sm:p-6 space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[#0F172A]">
                    مخططات سير العمل والحوكمة (Zoho CRM Blueprints)
                  </h1>
                  <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] border border-[#BFDBFE]">
                    Multi-Blueprint Engine
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  صمّم مسارات عمل تفاعلية لكل وحدة، واضبط شروط ما قبل الانتقال (Before)، متطلبات التنفيذ وقوائم التحقق (During)، والأتمتة الفورية (After).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {blueprints.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  const seeded = createSeedBlueprints(currentOrgId);
                  void persistBlueprintsList(seeded, seeded[0]);
                  showToast('تم تحميل 3 مخططات بلوبرينت قياسية جاهزة للمؤسسة.', 'success');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-xs font-bold text-[#334155] hover:bg-[#F8FAFC] transition cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-[#2563EB]" />
                <span>تحميل قوالب بلوبرينت جاهزة</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNewBpName('');
                setNewBpModule(MODULE_OPTIONS[0].module);
                setNewBpField(MODULE_OPTIONS[0].fields[0]);
                setNewBpCriteria('كافة السجلات في الموديول');
                setNewBpDescription('');
                setCreateModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ إنشاء بلوبرينت جديد</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="ابحث باسم البلوبرينت، الموديول، أو الحقل المرتبط..."
              className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] pr-9 pl-3 text-xs text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <Filter className="h-3.5 w-3.5" />
              <span>الموديول:</span>
            </div>
            <select
              value={listModuleFilter}
              onChange={(e) => setListModuleFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="ALL">جميع الموديولات</option>
              {MODULE_OPTIONS.map((m) => (
                <option key={m.module} value={m.module}>
                  {m.module}
                </option>
              ))}
            </select>

            <select
              value={listStatusFilter}
              onChange={(e) => setListStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="ALL">كل الحالات</option>
              <option value="ACTIVE">نشط فقط</option>
              <option value="INACTIVE">معطل فقط</option>
            </select>
          </div>
        </div>

        {/* Blueprints Table */}
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
          {filteredBlueprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-[#0F172A]">لا توجد مخططات بلوبرينت مطابقة</h3>
              <p className="mt-1 max-w-md text-xs text-[#64748B]">
                أنشئ مخطط بلوبرينت جديداً لتحديد المراحل والانتقالات والحقول الإلزامية لفريق المبيعات والعمليات.
              </p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>+ إنشاء بلوبرينت جديد</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#475569]">
                    <th className="py-3.5 px-4">اسم البلوبرينت والوصف</th>
                    <th className="py-3.5 px-4">الموديول المستهدف</th>
                    <th className="py-3.5 px-4">الحقل المرتبط</th>
                    <th className="py-3.5 px-4">معايير التطبيق</th>
                    <th className="py-3.5 px-4 text-center">المراحل / الانتقالات</th>
                    <th className="py-3.5 px-4 text-center">الحالة (تفعيل/تعطيل)</th>
                    <th className="py-3.5 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredBlueprints.map((bp) => {
                    const canvasCount = bp.stages.filter((s) => s.onCanvas).length;
                    return (
                      <tr
                        key={bp.id}
                        className="group hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBlueprintId(bp.id);
                              setViewStep('editor');
                            }}
                            className="text-right font-bold text-[#0F172A] hover:text-[#2563EB] transition cursor-pointer block"
                          >
                            {bp.name}
                          </button>
                          <p className="mt-0.5 text-[11px] text-[#64748B] line-clamp-1">
                            {bp.description}
                          </p>
                          <span className="mt-1 inline-block text-[10px] text-[#94A3B8]">
                            آخر تحديث: {bp.updatedAt} • بواسطة {bp.createdBy}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#334155]">
                            {bp.module}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB]">
                            {bp.linkedField}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-[220px]">
                          <span className="text-[11px] text-[#475569] line-clamp-2">
                            {bp.criteria}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#334155] tabular-nums">
                            <span>{canvasCount} مراحل</span>
                            <span className="text-[#CBD5E1]">|</span>
                            <span className="text-[#2563EB]">{bp.transitions.length} انتقالات</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => void handleToggleBlueprintActive(bp)}
                            role="switch"
                            aria-checked={bp.active}
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                              bp.active
                                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                                : 'border-[#E2E8F0] bg-[#F1F5F9] text-[#64748B]'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                bp.active ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                              }`}
                            />
                            <span>{bp.active ? 'مفعّل' : 'معطّل'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBlueprintId(bp.id);
                                setViewStep('editor');
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-[11px] font-bold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>تعديل المخطط</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openSimulator(bp)}
                              title="محاكاة واختبار هذا البلوبرينت"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC] transition cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5 text-[#2563EB]" />
                              <span className="hidden xl:inline">محاكاة</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDuplicateBlueprint(bp)}
                              title="نسخ المخطط (Clone)"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDeleteBlueprint(bp)}
                              title="حذف المخطط"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6] transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create New Blueprint Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
            <div
              dir="rtl"
              className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <GitBranch className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A]">إنشاء بلوبرينت جديد</h2>
                    <p className="text-[11px] text-[#64748B]">
                      حدد الموديول والحقل المرتبط للانتقال مباشرةً إلى المحرر البصري التفاعلي
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={(e) => void handleCreateBlueprint(e)} className="p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                    اسم البلوبرينت <span className="text-[#E11D48]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBpName}
                    onChange={(e) => setNewBpName(e.target.value)}
                    placeholder="مثال: مسار صفقات القطاع الحكومي أو مسار اعتماد الخصومات"
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                      الموديول المستهدف <span className="text-[#E11D48]">*</span>
                    </label>
                    <select
                      value={newBpModule}
                      onChange={(e) => {
                        const mod = e.target.value;
                        setNewBpModule(mod);
                        const preset = MODULE_OPTIONS.find((m) => m.module === mod);
                        if (preset && preset.fields[0]) {
                          setNewBpField(preset.fields[0]);
                        }
                      }}
                      className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    >
                      {MODULE_OPTIONS.map((m) => (
                        <option key={m.module} value={m.module}>
                          {m.module}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                      الحقل المرتبط (Stage / Status) <span className="text-[#E11D48]">*</span>
                    </label>
                    <select
                      value={newBpField}
                      onChange={(e) => setNewBpField(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    >
                      {(
                        MODULE_OPTIONS.find((m) => m.module === newBpModule)?.fields ?? [
                          'المرحلة (Stage)',
                        ]
                      ).map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                    معايير التطبيق الاختيارية (Criteria)
                  </label>
                  <input
                    type="text"
                    value={newBpCriteria}
                    onChange={(e) => setNewBpCriteria(e.target.value)}
                    placeholder="مثال: قيمة الصفقة >= 50,000 ر.س أو كافة السجلات"
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                    وصف مختصر للمسار
                  </label>
                  <textarea
                    rows={2}
                    value={newBpDescription}
                    onChange={(e) => setNewBpDescription(e.target.value)}
                    placeholder="اشرح الهدف من هذا المسار والفرق المستفيدة منه..."
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <span>إنشاء وفتح المحرر البصري</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Simulator Modal if triggered from list */}
        {simModalOpen && activeBlueprint && renderSimulatorModal()}

        {/* Toast Notification */}
        {toastBanner && (
          <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#0F172A] px-4 py-3 text-xs font-bold text-white shadow-xl">
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                toastBanner.tone === 'error'
                  ? 'text-[#F43F5E]'
                  : toastBanner.tone === 'info'
                    ? 'text-[#60A5FA]'
                    : 'text-[#10B981]'
              }`}
            />
            <span>{toastBanner.message}</span>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER HELPER: SIMULATOR MODAL
  // ============================================================================

  function renderSimulatorModal() {
    if (!activeBlueprint) return null;
    const currentStage = activeBlueprint.stages.find((s) => s.id === simCurrentStageId);
    const outgoingTransitions = activeBlueprint.transitions.filter(
      (t) => t.fromStageId === simCurrentStageId && t.enabled,
    );
    const activeSimTransition = activeBlueprint.transitions.find(
      (t) => t.id === simActiveTransitionId,
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]">
        <div
          dir="rtl"
          className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#0F172A] px-5 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  محاكاة تنفيذ البلوبرينت: {activeBlueprint.name}
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  اختبر صلاحيات الأدوار (Before)، الحقول الإلزامية وقائمة التحقق (During)، والأتمتة الفورية (After) كما يراها المندوب
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSimModalOpen(false)}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Role Selector & Current State Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  المرحلة الحالية للسجل ({activeBlueprint.linkedField}):
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1 text-xs font-bold text-white">
                    {currentStage?.title ?? 'غير محدد'}
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    (SLA: {currentStage?.slaBadge ?? '—'})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#334155]">اختبار بصلاحية دور:</label>
                <select
                  value={simRole}
                  onChange={(e) => setSimRole(e.target.value)}
                  className="h-8 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A]"
                >
                  {AVAILABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openSimulator(activeBlueprint)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>إعادة من البداية</span>
                </button>
              </div>
            </div>

            {/* Available Transition Buttons (Zoho Blueprint Strip) */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="mb-2.5 text-xs font-bold text-[#0F172A]">
                أزرار الانتقال المتاحة في شريط السجل (Transitions Bar):
              </p>
              {outgoingTransitions.length === 0 ? (
                <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-xs font-semibold text-[#059669]">
                  وصل السجل إلى مرحلة نهائية ({currentStage?.title}) ولا توجد انتقالات تالية.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {outgoingTransitions.map((tr) => {
                    const roleAllowed = tr.roles.length === 0 || tr.roles.includes(simRole);
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => handleTriggerSimulatedTransition(tr)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                          simActiveTransitionId === tr.id
                            ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-xs'
                            : roleAllowed
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
                              : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] opacity-80'
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>{tr.name}</span>
                        {!roleAllowed && (
                          <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px]">
                            مقيد للدور
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Transition "During" Gate Form */}
            {activeSimTransition && (
              <form
                onSubmit={handleCompleteSimulatedTransition}
                className="rounded-xl border-2 border-[#2563EB] bg-[#F8FAFC] p-4 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#2563EB]">
                      نافذة التحقق أثناء الانتقال (During Transition Gate)
                    </span>
                    <h4 className="text-sm font-bold text-[#0F172A]">
                      تنفيذ: {activeSimTransition.name}
                    </h4>
                  </div>
                  <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] border border-[#E2E8F0]">
                    {activeSimTransition.slaDurationLabel}
                  </span>
                </div>

                {/* Mandatory Fields */}
                {activeSimTransition.mandatoryFields.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-[#0F172A]">1. الحقول الإلزامية المطلوبة:</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {activeSimTransition.mandatoryFields.map((mf) => (
                        <div key={mf.id}>
                          <label className="mb-1 block text-xs font-semibold text-[#334155]">
                            {mf.fieldName} ({mf.fieldType}){' '}
                            {mf.required && <span className="text-[#E11D48]">*</span>}
                          </label>
                          <input
                            type="text"
                            value={simFieldValues[mf.id] ?? ''}
                            onChange={(e) =>
                              setSimFieldValues((prev) => ({ ...prev, [mf.id]: e.target.value }))
                            }
                            placeholder={`أدخل ${mf.fieldName}...`}
                            className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist */}
                {activeSimTransition.checklist.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#0F172A]">
                      2. قائمة التحقق الإلزامية (Checklist):
                    </p>
                    <div className="space-y-1.5">
                      {activeSimTransition.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(simChecklistValues[item.id])}
                            onChange={(e) =>
                              setSimChecklistValues((prev) => ({
                                ...prev,
                                [item.id]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                          />
                          <span>{item.title}</span>
                          {item.required && (
                            <span className="mr-auto rounded bg-[#FFF1F2] px-1.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                              إلزامي
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes / Attachments / Digital Signature */}
                <div className="space-y-3">
                  {activeSimTransition.requireNotes && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                        ملاحظات المندوب الإلزامية <span className="text-[#E11D48]">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={simNotes}
                        onChange={(e) => setSimNotes(e.target.value)}
                        placeholder="اكتب ملخص الإجراء والملاحظات..."
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5 text-xs"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {activeSimTransition.requireAttachment && (
                      <label className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simAttachmentAdded}
                          onChange={(e) => setSimAttachmentAdded(e.target.checked)}
                          className="h-4 w-4 text-[#2563EB]"
                        />
                        <Paperclip className="h-3.5 w-3.5 text-[#2563EB]" />
                        <span>إرفاق المستند المطلوب (PDF)</span>
                      </label>
                    )}

                    {activeSimTransition.requireDigitalSignature && (
                      <label className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simSignatureSigned}
                          onChange={(e) => setSimSignatureSigned(e.target.checked)}
                          className="h-4 w-4 text-[#2563EB]"
                        />
                        <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                        <span>اعتماد التوقيع الإلكتروني الرسمي</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                  <button
                    type="button"
                    onClick={() => setSimActiveTransitionId(null)}
                    className="h-8 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#475569]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#10B981] px-4 text-xs font-bold text-white hover:bg-[#059669] cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>تأكيد الانتقال وتشغيل الأتمتة</span>
                  </button>
                </div>
              </form>
            )}

            {/* Execution Log */}
            {simHistory.length > 0 && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2.5">
                <p className="text-xs font-bold text-[#0F172A]">
                  سجل انتقالات المحاكاة والإجراءات المنفذة (After Actions Log):
                </p>
                <div className="space-y-2">
                  {simHistory.map((h, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-[#0F172A]">
                        <span>
                          {h.fromTitle} ← {h.toTitle} (عبر: {h.transitionName})
                        </span>
                        <span className="text-[11px] text-[#64748B] tabular-nums">{h.time}</span>
                      </div>
                      {h.actionsRun.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {h.actionsRun.map((act, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#059669] border border-[#A7F3D0]"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {act}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: VIEW 2 — ZOHO VISUAL FLOWCHART EDITOR & SYNCHRONIZED INSPECTOR
  // ============================================================================

  if (!activeBlueprint) {
    return (
      <div dir="rtl" className="p-8 text-center">
        <p className="text-sm font-semibold text-[#475569]">لم يتم تحديد أي مخطط بلوبرينت.</p>
        <button
          type="button"
          onClick={() => setViewStep('list')}
          className="mt-3 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white"
        >
          العودة لقائمة المخططات
        </button>
      </div>
    );
  }

  const canvasStages = activeBlueprint.stages.filter((s) => s.onCanvas);
  const unplacedStages = activeBlueprint.stages.filter((s) => !s.onCanvas);

  return (
    <div dir="rtl" className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#F8FAFC]">
      {/* ====================================================================
          CLEAN TOP EDITOR TOOLBAR
         ==================================================================== */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-2.5 shadow-2xs z-20">
        {/* Right side: Back to list + Blueprint identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setConnectingFromStageId(null);
              setViewStep('list');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs font-bold text-[#334155] hover:bg-[#F1F5F9] transition cursor-pointer shrink-0"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>رجوع للقائمة</span>
          </button>

          <div className="h-5 w-px bg-[#E2E8F0] hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activeBlueprint.name}
                onChange={(e) =>
                  updateActiveBlueprint((bp) => ({ ...bp, name: e.target.value }))
                }
                aria-label="اسم البلوبرينت"
                className="truncate rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-bold text-[#0F172A] hover:border-[#CBD5E1] focus:border-[#2563EB] focus:bg-white focus:outline-none max-w-[260px] sm:max-w-[340px]"
              />
              <span className="hidden md:inline-flex items-center rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB] border border-[#BFDBFE] shrink-0">
                {activeBlueprint.module} • {activeBlueprint.linkedField}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] truncate max-w-[420px]">
              المعايير: {activeBlueprint.criteria}
            </p>
          </div>
        </div>

        {/* Left side: Active switch, Auto-Arrange, Simulator, Save & Publish */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Toggle */}
          <button
            type="button"
            onClick={() => void handleToggleBlueprintActive(activeBlueprint)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
              activeBlueprint.active
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                activeBlueprint.active ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
              }`}
            />
            <span>{activeBlueprint.active ? 'مخطط نشط' : 'مخطط معطل'}</span>
          </button>

          {/* Auto-Arrange */}
          <button
            type="button"
            onClick={handleAutoArrangeCanvas}
            title="ترتيب وتنسيق العقد تلقائياً على اللوحة"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-bold text-[#334155] hover:bg-[#F8FAFC] transition cursor-pointer"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">تنسيق تلقائي</span>
          </button>

          {/* Simulate & Test */}
          <button
            type="button"
            onClick={() => openSimulator(activeBlueprint)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] transition cursor-pointer"
          >
            <Play className="h-3.5 w-3.5" />
            <span>محاكاة واختبار</span>
          </button>

          {/* Save & Publish */}
          <button
            type="button"
            disabled={isSavingCloud}
            onClick={() => void handleSaveAndPublishBlueprint()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-60 transition cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSavingCloud ? 'جاري النشر...' : 'حفظ ونشر'}</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          3-PANE ZOHO BLUEPRINT WORKSPACE:
          1. RIGHT PANE: Available States (المراحل المتاحة)
          2. CENTER PANE: Interactive Dot-Grid Flowchart Canvas
          3. LEFT PANE: Synchronized Inspector (Before / During / After)
         ==================================================================== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ==================================================================
            1. RIGHT SIDEBAR: AVAILABLE STATES (المراحل المتاحة)
           ================================================================== */}
        <aside className="flex w-68 shrink-0 flex-col border-l border-[#E2E8F0] bg-white z-10">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <h2 className="text-xs font-bold text-[#0F172A]">المراحل المتاحة (States)</h2>
              <p className="text-[10px] text-[#64748B]">
                اسحب أي مرحلة للوحة أو انقر لإضافتها
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewStageModalOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#EFF6FF] px-2 text-[11px] font-bold text-[#2563EB] hover:bg-[#DBEAFE] transition cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>مرحلة جديدة</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Unplaced States (Ready to drag/add to canvas) */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#475569]">
                <span>غير موضوعة على اللوحة ({unplacedStages.length})</span>
              </div>
              {unplacedStages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-center text-[11px] text-[#64748B]">
                  جميع المراحل موضوعة حالياً على لوحة المخطط. يمكنك إضافة مرحلة جديدة أعلاه.
                </div>
              ) : (
                <div className="space-y-2">
                  {unplacedStages.map((stage) => (
                    <div
                      key={stage.id}
                      draggable
                      onDragStart={(e) => handleSidebarStageDragStart(e, stage.id)}
                      className="group flex items-center justify-between rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 hover:border-[#2563EB] hover:bg-white transition cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-4 w-4 text-[#94A3B8] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0F172A] truncate">{stage.title}</p>
                          <p className="text-[10px] text-[#64748B] truncate">
                            {stage.englishSubtitle}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlaceStageOnCanvas(stage.id)}
                        title="إضافة إلى لوحة المخطط"
                        className="inline-flex h-6 items-center gap-1 rounded bg-[#2563EB] px-2 text-[10px] font-bold text-white hover:bg-[#1D4ED8] shrink-0 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Placed States on Canvas */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#475569]">
                <span>المراحل النشطة على اللوحة ({canvasStages.length})</span>
              </div>
              <div className="space-y-1.5">
                {canvasStages.map((stage) => {
                  const isSelected =
                    selectedElement?.type === 'stage' && selectedElement.id === stage.id;
                  return (
                    <div
                      key={stage.id}
                      onClick={() => setSelectedElement({ type: 'stage', id: stage.id })}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs transition cursor-pointer ${
                        isSelected
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            stage.category === 'won'
                              ? 'bg-[#10B981]'
                              : stage.category === 'lost'
                                ? 'bg-[#E11D48]'
                                : stage.category === 'active'
                                  ? 'bg-[#2563EB]'
                                  : 'bg-[#64748B]'
                          }`}
                        />
                        <span className="font-semibold truncate">{stage.title}</span>
                      </div>
                      <span className="text-[10px] text-[#64748B] shrink-0">{stage.slaBadge}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Tip Box */}
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/70 p-3 text-[11px] text-[#1E40AF] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                <span>طريقة الاستخدام (Zoho Style):</span>
              </p>
              <ul className="list-disc pr-4 space-y-0.5 text-[10px] text-[#334155]">
                <li>اسحب أي مرحلة لتحريكها بحرية على الشبكة.</li>
                <li>انقر زر <b>(+)</b> على أي مرحلة ثم انقر مرحلة أخرى لإنشاء انتقال (Transition).</li>
                <li>انقر أي مرحلة أو انتقال لتعديل إعداداته فوراً في اللوحة اليسرى.</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* ==================================================================
            2. CENTER INTERACTIVE DOT-GRID FLOWCHART CANVAS
           ================================================================== */}
        <main
          ref={canvasContainerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          data-canvas-bg="true"
          className={`relative flex-1 overflow-hidden select-none ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            backgroundColor: '#F1F5F9',
            backgroundImage: 'radial-gradient(#CBD5E1 1.35px, transparent 1.35px)',
            backgroundSize: '22px 22px',
          }}
        >
          {/* Floating Top-Right Canvas Helper Banner when Connecting */}
          {connectingFromStageId && (
            <div className="absolute top-3 right-1/2 translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-[#2563EB] bg-[#0F172A] px-4 py-1.5 text-xs font-bold text-white shadow-lg">
              <Link2 className="h-3.5 w-3.5 text-[#60A5FA]" />
              <span>
                وضع الربط السريع: انقر الآن على المرحلة المستهدفة لإنشاء انتقال جديد...
              </span>
              <button
                type="button"
                onClick={() => {
                  setConnectingFromStageId(null);
                  setMouseCanvasPos(null);
                }}
                className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] hover:bg-white/25"
              >
                إلغاء (Esc)
              </button>
            </div>
          )}

          {/* Floating Zoom & Canvas Controls */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white/95 p-1.5 shadow-md backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
              title="تصغير (Zoom Out)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[46px] text-center text-[11px] font-bold text-[#0F172A] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.1).toFixed(2))))}
              title="تكبير (Zoom In)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-[#E2E8F0] mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setZoom(0.95);
                setPan({ x: 20, y: 20 });
              }}
              title="إعادة ضبط العرض"
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" />
              <span>ضبط المركز</span>
            </button>
          </div>

          {/* Transformed Canvas Plane (LTR coordinate space for crisp SVG + Node alignment) */}
          <div
            dir="ltr"
            data-canvas-bg="true"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '2400px',
              height: '1400px',
            }}
            className="relative"
          >
            {/* SVG Layer for Curved Arrows */}
            <svg
              width="2400"
              height="1400"
              className="pointer-events-none absolute inset-0 overflow-visible"
            >
              <defs>
                <marker
                  id="arrow-normal"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#64748B" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#2563EB" />
                </marker>
                <marker
                  id="arrow-won"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#10B981" />
                </marker>
                <marker
                  id="arrow-lost"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#E11D48" />
                </marker>
                <marker
                  id="arrow-loop"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#D97706" />
                </marker>
              </defs>

              {canvasTransitionsWithGeometry.map(({ tr, pathD, isBackwardOrLoop }) => {
                const isSelected =
                  selectedElement?.type === 'transition' && selectedElement.id === tr.id;
                const strokeColor = isSelected
                  ? '#2563EB'
                  : tr.tone === 'won'
                    ? '#10B981'
                    : tr.tone === 'lost'
                      ? '#E11D48'
                      : tr.tone === 'loop' || isBackwardOrLoop
                        ? '#D97706'
                        : '#94A3B8';

                const markerId = isSelected
                  ? 'url(#arrow-selected)'
                  : tr.tone === 'won'
                    ? 'url(#arrow-won)'
                    : tr.tone === 'lost'
                      ? 'url(#arrow-lost)'
                      : tr.tone === 'loop' || isBackwardOrLoop
                        ? 'url(#arrow-loop)'
                        : 'url(#arrow-normal)';

                return (
                  <g key={tr.id}>
                    {/* Invisible wide hit-area path so clicking the line selects the transition */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElement({ type: 'transition', id: tr.id });
                      }}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : 2.2}
                      strokeDasharray={
                        !tr.enabled ? '5 5' : isBackwardOrLoop ? '6 4' : undefined
                      }
                      markerEnd={markerId}
                    />
                  </g>
                );
              })}

              {/* Interactive live rubber-band line when connecting from a stage */}
              {connectingFromStageId &&
                mouseCanvasPos &&
                (() => {
                  const fromSt = canvasStages.find((s) => s.id === connectingFromStageId);
                  if (!fromSt) return null;
                  const sx = fromSt.x + NODE_WIDTH;
                  const sy = fromSt.y + NODE_HEIGHT / 2;
                  return (
                    <line
                      x1={sx}
                      y1={sy}
                      x2={mouseCanvasPos.x}
                      y2={mouseCanvasPos.y}
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      markerEnd="url(#arrow-selected)"
                    />
                  );
                })()}
            </svg>

            {/* Clickable Transition Badges in the Middle of Each SVG Curve */}
            {canvasTransitionsWithGeometry.map(({ tr, midX, midY }) => {
              const isSelected =
                selectedElement?.type === 'transition' && selectedElement.id === tr.id;

              const toneClasses = isSelected
                ? 'border-[#2563EB] bg-[#2563EB] text-white ring-4 ring-[#2563EB]/20'
                : tr.tone === 'won'
                  ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5]'
                  : tr.tone === 'lost'
                    ? 'border-[#FDA4AF] bg-[#FFF1F2] text-[#9F1239] hover:bg-[#FFE4E6]'
                    : tr.tone === 'loop'
                      ? 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]'
                      : 'border-[#CBD5E1] bg-white text-[#1E293B] hover:border-[#2563EB]';

              return (
                <button
                  key={`badge_${tr.id}`}
                  type="button"
                  dir="rtl"
                  style={{
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElement({ type: 'transition', id: tr.id });
                  }}
                  className={`absolute z-20 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm transition cursor-pointer whitespace-nowrap ${toneClasses}`}
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  <span>{tr.name}</span>
                  {!tr.enabled && (
                    <span className="rounded bg-black/10 px-1 text-[9px]">معطل</span>
                  )}
                </button>
              );
            })}

            {/* Stage Nodes on Canvas */}
            {canvasStages.map((stage) => {
              const isSelected =
                selectedElement?.type === 'stage' && selectedElement.id === stage.id;
              const isConnectSource = connectingFromStageId === stage.id;

              const headerBarClass =
                stage.category === 'won'
                  ? 'bg-[#10B981]'
                  : stage.category === 'lost'
                    ? 'bg-[#E11D48]'
                    : stage.category === 'active'
                      ? 'bg-[#2563EB]'
                      : 'bg-[#475569]';

              const borderClass = isSelected
                ? 'border-[#2563EB] ring-4 ring-[#2563EB]/20'
                : isConnectSource
                  ? 'border-[#2563EB] ring-4 ring-[#60A5FA]/30'
                  : connectingFromStageId
                    ? 'border-[#94A3B8] hover:border-[#2563EB] hover:ring-2 hover:ring-[#2563EB]/30'
                    : 'border-[#CBD5E1] hover:border-[#64748B]';

              return (
                <div
                  key={stage.id}
                  dir="rtl"
                  style={{
                    left: `${stage.x}px`,
                    top: `${stage.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                  }}
                  onMouseDown={(e) => handleStageMouseDown(e, stage)}
                  className={`group absolute z-10 flex flex-col justify-between rounded-xl border-2 bg-white shadow-md transition-shadow select-none cursor-move ${borderClass}`}
                >
                  {/* Top colored accent bar */}
                  <div className={`h-1.5 w-full rounded-t-[10px] ${headerBarClass}`} />

                  {/* Body */}
                  <div className="flex flex-1 flex-col justify-between px-3.5 py-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0F172A] truncate">{stage.title}</p>
                        <p className="text-[9px] font-semibold tracking-wider text-[#64748B] truncate uppercase">
                          {stage.englishSubtitle}
                        </p>
                      </div>
                      <Move className="h-3.5 w-3.5 text-[#CBD5E1] group-hover:text-[#64748B] shrink-0" />
                    </div>

                    <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-1.5 text-[10px]">
                      <span className="inline-flex items-center gap-1 font-medium text-[#475569] truncate max-w-[115px]">
                        <UserCheck className="h-3 w-3 text-[#2563EB] shrink-0" />
                        <span className="truncate">{stage.ownersLabel}</span>
                      </span>
                      <span className="rounded bg-[#F8FAFC] px-1.5 py-0.5 font-semibold text-[#64748B] border border-[#E2E8F0] shrink-0">
                        {stage.slaBadge}
                      </span>
                    </div>
                  </div>

                  {/* Output Connection Port ("+" button on right edge of node) */}
                  <button
                    type="button"
                    title="انقر لربط هذه المرحلة بمرحلة أخرى (إنشاء انتقال)"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (connectingFromStageId === stage.id) {
                        setConnectingFromStageId(null);
                        setMouseCanvasPos(null);
                      } else {
                        setConnectingFromStageId(stage.id);
                        showToast(
                          `انقر الآن على المرحلة المستهدفة لربطها بمرحلة "${stage.title}".`,
                          'info',
                        );
                      }
                    }}
                    className={`absolute -right-3.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition cursor-pointer ${
                      isConnectSource
                        ? 'border-white bg-[#2563EB] text-white scale-110'
                        : 'border-[#2563EB] bg-white text-[#2563EB] hover:bg-[#2563EB] hover:text-white'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </main>

        {/* ==================================================================
            3. LEFT SYNCHRONIZED INSPECTOR PANEL (BEFORE / DURING / AFTER)
           ================================================================== */}
        <aside className="flex w-96 shrink-0 flex-col border-r border-[#E2E8F0] bg-white z-10">
          {/* CASE A: A TRANSITION IS SELECTED */}
          {selectedTransition ? (
            <>
              {/* Inspector Header */}
              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB] border border-[#BFDBFE]">
                    <Zap className="h-3 w-3" />
                    <span>إعدادات الانتقال المحدد (Transition)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTransition(selectedTransition.id)}
                    title="حذف هذا الانتقال"
                    className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-2 py-1 text-[10px] font-bold text-[#E11D48] hover:bg-[#FFE4E6] cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>حذف</span>
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#475569]">
                    اسم زر الانتقال (Transition Name)
                  </label>
                  <input
                    type="text"
                    value={selectedTransition.name}
                    onChange={(e) =>
                      updateSelectedTransition((tr) => ({ ...tr, name: e.target.value }))
                    }
                    className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                {/* From -> To Stage Pill */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px]">
                  <span className="font-semibold text-[#334155] truncate">
                    من:{' '}
                    {activeBlueprint.stages.find((s) => s.id === selectedTransition.fromStageId)
                      ?.title ?? '—'}
                  </span>
                  <ArrowLeft className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                  <span className="font-bold text-[#2563EB] truncate">
                    إلى:{' '}
                    {activeBlueprint.stages.find((s) => s.id === selectedTransition.toStageId)
                      ?.title ?? '—'}
                  </span>
                </div>

                {/* Tone & SLA Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold text-[#64748B]">
                      نوع المسار
                    </label>
                    <select
                      value={selectedTransition.tone}
                      onChange={(e) =>
                        updateSelectedTransition((tr) => ({
                          ...tr,
                          tone: e.target.value as BlueprintTransitionTone,
                        }))
                      }
                      className="h-7 w-full rounded border border-[#CBD5E1] bg-white px-2 text-[11px] font-semibold text-[#0F172A]"
                    >
                      <option value="normal">مسار قياسي (Normal)</option>
                      <option value="won">إغلاق ناجح (Won)</option>
                      <option value="lost">إغلاق خاسر (Lost)</option>
                      <option value="loop">مسار رجوع / مراجعة (Loop)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold text-[#64748B]">
                      مهلة التنفيذ (SLA)
                    </label>
                    <input
                      type="text"
                      value={selectedTransition.slaDurationLabel}
                      onChange={(e) =>
                        updateSelectedTransition((tr) => ({
                          ...tr,
                          slaDurationLabel: e.target.value,
                        }))
                      }
                      className="h-7 w-full rounded border border-[#CBD5E1] bg-white px-2 text-[11px] text-[#0F172A]"
                    />
                  </div>
                </div>
              </div>

              {/* 3 Zoho Tabs: BEFORE / DURING / AFTER */}
              <div className="grid grid-cols-3 border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInspectorTab('before')}
                  className={`py-2.5 text-center border-b-2 transition cursor-pointer ${
                    inspectorTab === 'before'
                      ? 'border-[#2563EB] bg-white text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  1. قبل (Before)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('during')}
                  className={`py-2.5 text-center border-b-2 transition cursor-pointer ${
                    inspectorTab === 'during'
                      ? 'border-[#2563EB] bg-white text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  2. أثناء (During)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('after')}
                  className={`py-2.5 text-center border-b-2 transition cursor-pointer ${
                    inspectorTab === 'after'
                      ? 'border-[#2563EB] bg-white text-[#2563EB]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  3. بعد (After)
                </button>
              </div>

              {/* Tab Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* ==========================================================
                    TAB 1: BEFORE (قبل الانتقال)
                   ========================================================== */}
                {inspectorTab === 'before' && (
                  <>
                    {/* Authorized Roles */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>الأدوار المصرح لها برؤية زر الانتقال</span>
                        </h3>
                        <span className="text-[10px] font-semibold text-[#64748B]">
                          ({selectedTransition.roles.length} أدوار)
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B]">
                        حدد المسميات الوظيفية التي يحق لها تنفيذ انتقال "{selectedTransition.name}":
                      </p>
                      <div className="space-y-1.5 pt-1">
                        {AVAILABLE_ROLES.map((role) => {
                          const checked = selectedTransition.roles.includes(role);
                          return (
                            <label
                              key={role}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition cursor-pointer ${
                                checked
                                  ? 'border-[#BFDBFE] bg-[#EFF6FF]/60 font-bold text-[#1E40AF]'
                                  : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              <span>{role}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  updateSelectedTransition((tr) => ({
                                    ...tr,
                                    roles: isChecked
                                      ? [...tr.roles, role]
                                      : tr.roles.filter((r) => r !== role),
                                  }));
                                }}
                                className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pre-Conditions */}
                    <div className="space-y-2.5 border-t border-[#E2E8F0] pt-4">
                      <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                        <span>شروط التحقق المسبقة (Pre-Conditions)</span>
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        شروط يجب توفرها في السجل قبل السماح بظهور أو تفعيل هذا الانتقال:
                      </p>

                      {selectedTransition.beforeConditions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-center text-[11px] text-[#64748B]">
                          لا توجد شروط مسبقة مقيدة حالياً.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTransition.beforeConditions.map((cond) => (
                            <div
                              key={cond.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs"
                            >
                              <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cond.enabled}
                                  onChange={(e) =>
                                    updateSelectedTransition((tr) => ({
                                      ...tr,
                                      beforeConditions: tr.beforeConditions.map((c) =>
                                        c.id === cond.id
                                          ? { ...c, enabled: e.target.checked }
                                          : c,
                                      ),
                                    }))
                                  }
                                  className="h-3.5 w-3.5 text-[#2563EB]"
                                />
                                <span className="truncate font-semibold text-[#0F172A]">
                                  {cond.fieldLabel}{' '}
                                  <span className="text-[#2563EB]">{cond.operatorLabel}</span>{' '}
                                  "{cond.valueLabel}"
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedTransition((tr) => ({
                                    ...tr,
                                    beforeConditions: tr.beforeConditions.filter(
                                      (c) => c.id !== cond.id,
                                    ),
                                  }))
                                }
                                className="text-[#94A3B8] hover:text-[#E11D48]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Condition Mini Form */}
                      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-2">
                        <p className="text-[11px] font-bold text-[#334155]">+ إضافة شرط تحقق جديد</p>
                        <input
                          type="text"
                          value={newConditionField}
                          onChange={(e) => setNewConditionField(e.target.value)}
                          placeholder="اسم الحقل (مثال: الميزانية التقديرية)"
                          className="h-8 w-full rounded border border-[#CBD5E1] bg-white px-2.5 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={newConditionOp}
                            onChange={(e) => setNewConditionOp(e.target.value)}
                            className="h-8 rounded border border-[#CBD5E1] bg-white px-2 text-xs"
                          >
                            <option value="غير فارغ">غير فارغ</option>
                            <option value="يساوي">يساوي</option>
                            <option value="أكبر من">أكبر من</option>
                            <option value="أكبر من أو يساوي">أكبر من أو يساوي</option>
                          </select>
                          <input
                            type="text"
                            value={newConditionVal}
                            onChange={(e) => setNewConditionVal(e.target.value)}
                            placeholder="القيمة المطلوبة"
                            className="h-8 rounded border border-[#CBD5E1] bg-white px-2 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newConditionField.trim()) return;
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              beforeConditions: [
                                ...tr.beforeConditions,
                                {
                                  id: `cond_${Date.now()}`,
                                  fieldLabel: newConditionField.trim(),
                                  operatorLabel: newConditionOp,
                                  valueLabel: newConditionVal.trim() || 'محدد',
                                  enabled: true,
                                },
                              ],
                            }));
                            setNewConditionField('');
                          }}
                          className="w-full rounded-lg bg-[#2563EB] py-1.5 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          + إدراج الشرط
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ==========================================================
                    TAB 2: DURING (أثناء الانتقال)
                   ========================================================== */}
                {inspectorTab === 'during' && (
                  <>
                    {/* Mandatory Fields */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>الحقول الإلزامية (Mandatory Fields)</span>
                        </h3>
                        <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]">
                          {selectedTransition.mandatoryFields.length} حقول
                        </span>
                      </div>

                      {selectedTransition.mandatoryFields.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-center text-[11px] text-[#64748B]">
                          لا توجد حقول إلزامية مضافة لهذا الانتقال.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedTransition.mandatoryFields.map((mf) => (
                            <div
                              key={mf.id}
                              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-[#0F172A] truncate">{mf.fieldName}</p>
                                <p className="text-[10px] text-[#64748B]">النوع: {mf.fieldType}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedTransition((tr) => ({
                                    ...tr,
                                    mandatoryFields: tr.mandatoryFields.filter(
                                      (f) => f.id !== mf.id,
                                    ),
                                  }))
                                }
                                className="text-[#94A3B8] hover:text-[#E11D48]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newMandatoryFieldName}
                          onChange={(e) => setNewMandatoryFieldName(e.target.value)}
                          placeholder="اسم الحقل الإلزامي..."
                          className="h-8 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                        />
                        <select
                          value={newMandatoryFieldType}
                          onChange={(e) => setNewMandatoryFieldType(e.target.value)}
                          className="h-8 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs"
                        >
                          <option value="نص">نص</option>
                          <option value="عملة (SAR)">عملة</option>
                          <option value="تاريخ">تاريخ</option>
                          <option value="مرفق PDF">مرفق</option>
                          <option value="قائمة">قائمة</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newMandatoryFieldName.trim()) return;
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              mandatoryFields: [
                                ...tr.mandatoryFields,
                                {
                                  id: `mf_${Date.now()}`,
                                  fieldName: newMandatoryFieldName.trim(),
                                  fieldType: newMandatoryFieldType,
                                  required: true,
                                },
                              ],
                            }));
                            setNewMandatoryFieldName('');
                          }}
                          className="h-8 rounded-lg bg-[#2563EB] px-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          + إضافة
                        </button>
                      </div>
                    </div>

                    {/* Notes, Attachment & Signature Toggles */}
                    <div className="space-y-2 border-t border-[#E2E8F0] pt-4">
                      <h3 className="text-xs font-bold text-[#0F172A]">
                        متطلبات التوثيق والمرفقات:
                      </h3>

                      <label className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>إلزامية كتابة ملاحظة عند الانتقال</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedTransition.requireNotes}
                          onChange={(e) =>
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              requireNotes: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded text-[#2563EB]"
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                        <span className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>إلزامية إرفاق ملف / مستند رسمي</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedTransition.requireAttachment}
                          onChange={(e) =>
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              requireAttachment: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded text-[#2563EB]"
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                          <span>طلب توقيع إلكتروني معتمد</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedTransition.requireDigitalSignature}
                          onChange={(e) =>
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              requireDigitalSignature: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded text-[#2563EB]"
                        />
                      </label>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-2.5 border-t border-[#E2E8F0] pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5 text-[#10B981]" />
                          <span>قائمة التحقق (Checklist) للمندوب</span>
                        </h3>
                        <span className="text-[10px] font-semibold text-[#64748B]">
                          ({selectedTransition.checklist.length} بنود)
                        </span>
                      </div>

                      {selectedTransition.checklist.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-center text-[11px] text-[#64748B]">
                          لا توجد بنود تحقق مضافة حالياً.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedTransition.checklist.map((chk) => (
                            <div
                              key={chk.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-[#0F172A]">{chk.title}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedTransition((tr) => ({
                                    ...tr,
                                    checklist: tr.checklist.filter((c) => c.id !== chk.id),
                                  }))
                                }
                                className="text-[#94A3B8] hover:text-[#E11D48] shrink-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newChecklistText}
                          onChange={(e) => setNewChecklistText(e.target.value)}
                          placeholder="أضف بند تحقق يلتزم به المندوب..."
                          className="h-8 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newChecklistText.trim()) return;
                            updateSelectedTransition((tr) => ({
                              ...tr,
                              checklist: [
                                ...tr.checklist,
                                {
                                  id: `chk_${Date.now()}`,
                                  title: newChecklistText.trim(),
                                  required: true,
                                },
                              ],
                            }));
                            setNewChecklistText('');
                          }}
                          className="h-8 rounded-lg bg-[#2563EB] px-3 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          + إضافة
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ==========================================================
                    TAB 3: AFTER (بعد الانتقال - الأتمتة)
                   ========================================================== */}
                {inspectorTab === 'after' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-[#D97706]" />
                        <span>الأتمتة التلقائية بعد الانتقال (Post Actions)</span>
                      </h3>
                      <span className="rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-bold text-[#B45309]">
                        {selectedTransition.afterActions.length} إجراءات
                      </span>
                    </div>

                    {selectedTransition.afterActions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-center text-[11px] text-[#64748B]">
                        لا توجد إجراءات تلقائية مضافة بعد هذا الانتقال.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedTransition.afterActions.map((act) => (
                          <div
                            key={act.id}
                            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={act.enabled}
                                  onChange={(e) =>
                                    updateSelectedTransition((tr) => ({
                                      ...tr,
                                      afterActions: tr.afterActions.map((a) =>
                                        a.id === act.id ? { ...a, enabled: e.target.checked } : a,
                                      ),
                                    }))
                                  }
                                  className="h-3.5 w-3.5 text-[#2563EB]"
                                />
                                <span>{act.label}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedTransition((tr) => ({
                                    ...tr,
                                    afterActions: tr.afterActions.filter((a) => a.id !== act.id),
                                  }))
                                }
                                className="text-[#94A3B8] hover:text-[#E11D48]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#64748B] pr-5">
                              <span>{act.targetDetail}</span>
                              <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-[#2563EB] border border-[#E2E8F0]">
                                {act.systemTag}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* + Add Automation Action Form */}
                    <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 space-y-2.5">
                      <p className="text-xs font-bold text-[#0F172A]">+ إضافة إجراء تلقائي جديد</p>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                          نوع الإجراء
                        </label>
                        <select
                          value={newActionType}
                          onChange={(e) =>
                            setNewActionType(e.target.value as BlueprintAfterActionType)
                          }
                          className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A]"
                        >
                          <option value="field_update">تحديث حقل تلقائياً (Field Update)</option>
                          <option value="whatsapp_email">إرسال قالب واتساب / بريد إلكتروني</option>
                          <option value="create_task">إنشاء مهمة متابعة للفريق</option>
                          <option value="webhook">إطلاق Webhook لنظام خارجي / ERP</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                          وصف الإجراء
                        </label>
                        <input
                          type="text"
                          value={newActionLabel}
                          onChange={(e) => setNewActionLabel(e.target.value)}
                          placeholder={
                            newActionType === 'field_update'
                              ? 'مثال: تحديث احتمالية الإغلاق إلى 80%'
                              : newActionType === 'whatsapp_email'
                                ? 'مثال: إرسال رسالة واتساب للعميل بتأكيد المرحلة'
                                : newActionType === 'create_task'
                                  ? 'مثال: إنشاء مهمة إعداد العقد خلال 24 ساعة'
                                  : 'مثال: إرسال بيانات الصفقة إلى نظام الفوترة ERP'
                          }
                          className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-[#64748B]">
                          الهدف / القالب / الرابط
                        </label>
                        <input
                          type="text"
                          value={newActionTarget}
                          onChange={(e) => setNewActionTarget(e.target.value)}
                          placeholder="مثال: قالب واتساب الرسمي أو POST /api/webhook"
                          className="h-8 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!newActionLabel.trim()) return;
                          const tagMap: Record<BlueprintAfterActionType, string> = {
                            field_update: 'Field Update',
                            whatsapp_email: 'WhatsApp / Email',
                            create_task: 'Auto Task',
                            webhook: 'Webhook API',
                          };
                          updateSelectedTransition((tr) => ({
                            ...tr,
                            afterActions: [
                              ...tr.afterActions,
                              {
                                id: `act_${Date.now()}`,
                                type: newActionType,
                                label: newActionLabel.trim(),
                                targetDetail: newActionTarget.trim() || activeBlueprint.module,
                                systemTag: tagMap[newActionType],
                                enabled: true,
                              },
                            ],
                          }));
                          setNewActionLabel('');
                          setNewActionTarget('');
                          showToast('تمت إضافة الإجراء التلقائي إلى مرحلة ما بعد الانتقال.', 'success');
                        }}
                        className="w-full rounded-lg bg-[#2563EB] py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                      >
                        + إضافة إجراء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : selectedStage ? (
            /* ================================================================
               CASE B: A STAGE NODE IS SELECTED
               ================================================================ */
            <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB] border border-[#BFDBFE]">
                  <Layers className="h-3.5 w-3.5" />
                  <span>إعدادات المرحلة المحددة (State)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveStageFromCanvas(selectedStage.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-[10px] font-bold text-[#E11D48] hover:bg-[#FFE4E6] cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>إزالة من اللوحة</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                    اسم المرحلة (State Title)
                  </label>
                  <input
                    type="text"
                    value={selectedStage.title}
                    onChange={(e) =>
                      updateSelectedStage((st) => ({ ...st, title: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                    الرمز الإنجليزي (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={selectedStage.englishSubtitle}
                    onChange={(e) =>
                      updateSelectedStage((st) => ({
                        ...st,
                        englishSubtitle: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                      تصنيف المرحلة
                    </label>
                    <select
                      value={selectedStage.category}
                      onChange={(e) =>
                        updateSelectedStage((st) => ({
                          ...st,
                          category: e.target.value as BlueprintStageCategory,
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A]"
                    >
                      <option value="normal">مرحلة قياسية</option>
                      <option value="active">مرحلة نشطة محورية</option>
                      <option value="won">مرحلة إغلاق ناجح (Won)</option>
                      <option value="lost">مرحلة إغلاق خاسر (Lost)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                      مهلة البقاء (SLA)
                    </label>
                    <input
                      type="text"
                      value={selectedStage.slaBadge}
                      onChange={(e) =>
                        updateSelectedStage((st) => ({ ...st, slaBadge: e.target.value }))
                      }
                      className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#0F172A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                    المسؤول الافتراضي عن المرحلة
                  </label>
                  <input
                    type="text"
                    value={selectedStage.ownersLabel}
                    onChange={(e) =>
                      updateSelectedStage((st) => ({ ...st, ownersLabel: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Create Outgoing Transition from this Stage */}
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[#1E40AF]">
                  + إنشاء انتقال جديد يخرج من "{selectedStage.title}":
                </p>
                <div className="space-y-1.5">
                  {canvasStages
                    .filter((s) => s.id !== selectedStage.id)
                    .map((targetSt) => (
                      <button
                        key={targetSt.id}
                        type="button"
                        onClick={() => openQuickTransitionBuilder(selectedStage.id, targetSt.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB] transition cursor-pointer"
                      >
                        <span>ربط مع: {targetSt.title}</span>
                        <Plus className="h-3.5 w-3.5 text-[#2563EB]" />
                      </button>
                    ))}
                </div>
              </div>

              {/* Outgoing Transitions from this Stage */}
              <div className="space-y-2 border-t border-[#E2E8F0] pt-4">
                <p className="text-xs font-bold text-[#0F172A]">
                  الانتقالات الخارجة من هذه المرحلة:
                </p>
                {activeBlueprint.transitions
                  .filter((t) => t.fromStageId === selectedStage.id)
                  .map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setSelectedElement({ type: 'transition', id: tr.id })}
                      className="flex w-full items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer"
                    >
                      <span>{tr.name}</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-[#64748B]">
              <GitBranch className="h-8 w-8 text-[#94A3B8] mb-2" />
              <p className="font-bold text-[#0F172A]">لم يتم تحديد عنصر على اللوحة</p>
              <p className="mt-1">
                انقر على أي مرحلة (State) أو أي شارة انتقال (Transition) على الأسهم المنحنية لعرض وتعديل إعدادات Before / During / After.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ====================================================================
          MODAL: CREATE NEW CUSTOM STAGE
         ==================================================================== */}
      {newStageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            dir="rtl"
            className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#0F172A]">إضافة مرحلة جديدة (New State)</h3>
              <button
                type="button"
                onClick={() => setNewStageModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomStage} className="p-5 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                  اسم المرحلة بالعربية <span className="text-[#E11D48]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  placeholder="مثال: الفحص الأمني والتقني"
                  className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                  الاسم الإنجليزي المختصر
                </label>
                <input
                  type="text"
                  value={newStageSub}
                  onChange={(e) => setNewStageSub(e.target.value)}
                  placeholder="SECURITY REVIEW"
                  className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">نوع المرحلة</label>
                  <select
                    value={newStageCategory}
                    onChange={(e) =>
                      setNewStageCategory(e.target.value as BlueprintStageCategory)
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold"
                  >
                    <option value="normal">مرحلة قياسية</option>
                    <option value="active">مرحلة محورية</option>
                    <option value="won">إغلاق ناجح (Won)</option>
                    <option value="lost">إغلاق خاسر (Lost)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">مهلة SLA</label>
                  <input
                    type="text"
                    value={newStageSla}
                    onChange={(e) => setNewStageSla(e.target.value)}
                    placeholder="24 ساعة"
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                  المسؤول عن المرحلة
                </label>
                <input
                  type="text"
                  value={newStageOwner}
                  onChange={(e) => setNewStageOwner(e.target.value)}
                  placeholder="مندوب المبيعات / الفريق التقني"
                  className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setNewStageModalOpen(false)}
                  className="h-9 rounded-lg border border-[#CBD5E1] px-4 text-xs font-semibold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  إضافة للوحة المخطط
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CREATE NEW TRANSITION BETWEEN TWO STAGES
         ==================================================================== */}
      {newTransitionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            dir="rtl"
            className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#0F172A]">إنشاء انتقال جديد (New Transition)</h3>
              <button
                type="button"
                onClick={() => setNewTransitionModal((p) => ({ ...p, open: false }))}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateTransition} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-bold text-[#1E40AF]">
                <span>
                  من:{' '}
                  {activeBlueprint.stages.find((s) => s.id === newTransitionModal.fromStageId)
                    ?.title ?? ''}
                </span>
                <ArrowLeft className="h-4 w-4" />
                <span>
                  إلى:{' '}
                  {activeBlueprint.stages.find((s) => s.id === newTransitionModal.toStageId)
                    ?.title ?? ''}
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#0F172A]">
                  اسم زر الانتقال <span className="text-[#E11D48]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTransitionModal.name}
                  onChange={(e) =>
                    setNewTransitionModal((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="مثال: اعتماد العرض المالي"
                  className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">نوع الانتقال</label>
                  <select
                    value={newTransitionModal.tone}
                    onChange={(e) =>
                      setNewTransitionModal((p) => ({
                        ...p,
                        tone: e.target.value as BlueprintTransitionTone,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold"
                  >
                    <option value="normal">انتقال قياسي</option>
                    <option value="won">إغلاق ناجح (Won)</option>
                    <option value="lost">إغلاق خاسر (Lost)</option>
                    <option value="loop">مسار رجوع / مراجعة</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0F172A]">مهلة SLA</label>
                  <input
                    type="text"
                    value={newTransitionModal.sla}
                    onChange={(e) =>
                      setNewTransitionModal((p) => ({ ...p, sla: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setNewTransitionModal((p) => ({ ...p, open: false }))}
                  className="h-9 rounded-lg border border-[#CBD5E1] px-4 text-xs font-semibold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  إنشاء الانتقال وفتح الإعدادات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {simModalOpen && renderSimulatorModal()}

      {/* Toast Notification */}
      {toastBanner && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#0F172A] px-4 py-3 text-xs font-bold text-white shadow-xl">
          <CheckCircle2
            className={`h-4 w-4 shrink-0 ${
              toastBanner.tone === 'error'
                ? 'text-[#F43F5E]'
                : toastBanner.tone === 'info'
                  ? 'text-[#60A5FA]'
                  : 'text-[#10B981]'
            }`}
          />
          <span>{toastBanner.message}</span>
        </div>
      )}
    </div>
  );
};
export default BlueprintBuilderPage;
