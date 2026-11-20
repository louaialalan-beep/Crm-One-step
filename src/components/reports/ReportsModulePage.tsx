import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CalendarClock,
  FileBarChart2,
  Database,
  CheckCircle2,
  Lock,
  Plus,
} from 'lucide-react';
import type {
  ReportDefinition,
  ReportFolder,
  ReportExecutionResult,
  UserSecurityContext,
  ModuleName,
} from '../../types/reports';
import {
  STANDARD_FOLDERS,
  STANDARD_REPORTS,
} from '../../lib/reports/standard-reports-seed';
import { executeReport } from '../../lib/reports/query-engine';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCrm } from '../../context/CrmContext';
import { ReportsHome } from './ReportsHome';
import { ReportWizard } from './ReportWizard';
import { ReportViewer, PinnedDashboardWidgetConfig } from './ReportViewer';
import { ReportScheduler, ExtendedReportSchedule } from './ReportScheduler';
import { ExportModal } from './ExportModal';

const STORAGE_KEYS = {
  REPORTS: 'riwaq_crm_reports_v4',
  FOLDERS: 'riwaq_crm_report_folders_v4',
  SCHEDULES: 'riwaq_crm_report_schedules_v4',
  PINNED: 'riwaq_pinned_reports',
};

const ALL_MODULES: ModuleName[] = [
  'leads',
  'contacts',
  'accounts',
  'deals',
  'touchpoints',
  'campaigns',
  'quotes',
  'sales_orders',
  'invoices',
  'tasks',
  'calls',
  'whatsapp_messages',
  'stage_history',
  'order_attributions',
];

const EMPTY_HIDDEN_FIELDS: Record<ModuleName, string[]> = {
  leads: [],
  contacts: [],
  accounts: [],
  deals: [],
  touchpoints: [],
  campaigns: [],
  quotes: [],
  sales_orders: [],
  invoices: [],
  tasks: [],
  calls: [],
  whatsapp_messages: [],
  stage_history: [],
  order_attributions: [],
};

const SECURITY_PRESETS: {
  id: string;
  label: string;
  userName: string;
  badge: string;
  context: UserSecurityContext;
}[] = [
  {
    id: 'ceo',
    label: 'طارق العتيبي (المدير التنفيذي CEO — وصول شامل لكافة السجلات)',
    userName: 'طارق العتيبي',
    badge: 'Super Admin',
    context: {
      userId: 'usr-1',
      roleId: 'role_ceo',
      subordinateUserIds: ['usr-2', 'usr-3', 'usr-4'],
      canViewAllModules: ALL_MODULES,
      hiddenFieldsByModule: EMPTY_HIDDEN_FIELDS,
    },
  },
  {
    id: 'manager',
    label: 'سارة المهيدب (مدير مبيعات إقليمي — سجلاتها وسجلات المرؤوسين فقط)',
    userName: 'سارة المهيدب',
    badge: 'Regional Manager',
    context: {
      userId: 'usr-2',
      roleId: 'role_sales_manager',
      subordinateUserIds: ['usr-3', 'usr-4'],
      canViewAllModules: ['campaigns', 'accounts'],
      hiddenFieldsByModule: EMPTY_HIDDEN_FIELDS,
    },
  },
  {
    id: 'rep_fls',
    label: 'خالد الدوسري (مندوب مبيعات — تفعيل حجب الحقول المالية الحساسة FLS)',
    userName: 'خالد الدوسري',
    badge: 'FLS Restricted',
    context: {
      userId: 'usr-3',
      roleId: 'role_sales_rep',
      subordinateUserIds: [],
      canViewAllModules: [],
      hiddenFieldsByModule: {
        ...EMPTY_HIDDEN_FIELDS,
        leads: ['valueSAR'],
        deals: ['amount', 'probability'],
        campaigns: ['spendSAR', 'revenueSAR'],
        order_attributions: ['orderAmountSAR', 'roasMultiplier'],
      },
    },
  },
];

function buildEnterpriseDataset(): Record<ModuleName, any[]> {
  const leads = [
    {
      id: 'LEAD-1001',
      unique_id: 'RWQ-10482',
      leadUniqueId: 'RWQ-10482',
      name: 'م. بدر بن عبد الإله المنصور',
      company: 'شركة قمة التقنية للحلول الرقمية',
      phone: '+966508899001',
      email: 'badr@qimmah-tech.sa',
      source: 'إعلانات ميتا (Meta Lead Ads)',
      status: 'مؤهل (Qualified)',
      valueSAR: 485000,
      daysWithoutFollowUp: 1,
      city: 'الرياض',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-10-12T08:30:00Z',
    },
    {
      id: 'LEAD-1002',
      unique_id: 'RWQ-10489',
      leadUniqueId: 'RWQ-10489',
      name: 'د. فيصل بن عبد العزيز السالم',
      company: 'مجمع النخبة الطبي المتقدم',
      phone: '+966501122334',
      email: 'faisal@elite-med.sa',
      source: 'إعلانات ميتا (Meta Lead Ads)',
      status: 'مؤهل (Qualified)',
      valueSAR: 340000,
      daysWithoutFollowUp: 2,
      city: 'الرياض',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-10-18T09:15:00Z',
    },
    {
      id: 'LEAD-1003',
      unique_id: 'RWQ-10504',
      leadUniqueId: 'RWQ-10504',
      name: 'أ. نورة بنت محمد القحطاني',
      company: 'شركة ريادة للتطوير العقاري',
      phone: '+966552233445',
      email: 'noura@riyadah-dev.sa',
      source: 'واتساب للأعمال (WhatsApp API)',
      status: 'عرض سعر (Proposal Sent)',
      valueSAR: 620000,
      daysWithoutFollowUp: 3,
      city: 'الرياض',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      createdAt: '2026-10-25T11:30:00Z',
    },
    {
      id: 'LEAD-1004',
      unique_id: 'RWQ-10519',
      leadUniqueId: 'RWQ-10519',
      name: 'م. عمر بن فهد الخالدي',
      company: 'مجموعة إعمار الشرق القابضة',
      phone: '+966543344556',
      email: 'omar@emaar-east.sa',
      source: 'إعلانات بحث جوجل (Google Search)',
      status: 'تواصل أولي (Contacted)',
      valueSAR: 275000,
      daysWithoutFollowUp: 9,
      city: 'الدمام',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-11-01T14:20:00Z',
    },
    {
      id: 'LEAD-1005',
      unique_id: 'RWQ-10532',
      leadUniqueId: 'RWQ-10532',
      name: 'أ. كمال بن عبد الله الغامدي',
      company: 'شركة المتجر الرقمي المتكامل',
      phone: '+966564455667',
      email: 'kamal@digital-store.sa',
      source: 'إنستغرام دايركت (Instagram DM)',
      status: 'مؤهل (Qualified)',
      valueSAR: 145000,
      daysWithoutFollowUp: 1,
      city: 'جدة',
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
      createdAt: '2026-11-05T16:45:00Z',
    },
    {
      id: 'LEAD-1006',
      unique_id: 'RWQ-10548',
      leadUniqueId: 'RWQ-10548',
      name: 'د. سلطان بن تركي العتيبي',
      company: 'مستشفيات الرعاية الحديثة',
      phone: '+966505566778',
      email: 'sultan@modern-care.sa',
      source: 'إعلانات ميتا (Meta Lead Ads)',
      status: 'جديد (New)',
      valueSAR: 510000,
      daysWithoutFollowUp: 11,
      city: 'الرياض',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      createdAt: '2026-11-09T10:05:00Z',
    },
    {
      id: 'LEAD-1007',
      unique_id: 'RWQ-10561',
      leadUniqueId: 'RWQ-10561',
      name: 'م. ماجد بن راشد الحربي',
      company: 'مصنع الخليج للصناعات الدقيقة',
      phone: '+966536677889',
      email: 'majed@gulf-ind.sa',
      source: 'معرض LEAP التقني',
      status: 'تواصل أولي (Contacted)',
      valueSAR: 390000,
      daysWithoutFollowUp: 14,
      city: 'الخبر',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-11-11T13:10:00Z',
    },
  ];

  const accounts = [
    {
      id: 'ACC-201',
      accountId: 'ACC-201',
      name: 'شركة قمة التقنية للحلول الرقمية (RWQ-10482)',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      industry: 'تقنية المعلومات والبرمجيات السحابية',
      city: 'الرياض',
      annualRevenue: 18500000,
      employeesCount: 420,
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-06-10T09:00:00Z',
    },
    {
      id: 'ACC-202',
      accountId: 'ACC-202',
      name: 'مجمع النخبة الطبي المتقدم',
      accountName: 'مجمع النخبة الطبي المتقدم',
      industry: 'الرعاية الصحية والمستشفيات',
      city: 'الرياض',
      annualRevenue: 9800000,
      employeesCount: 260,
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-07-14T11:20:00Z',
    },
    {
      id: 'ACC-203',
      accountId: 'ACC-203',
      name: 'شركة ريادة للتطوير العقاري',
      accountName: 'شركة ريادة للتطوير العقاري',
      industry: 'العقارات والمقاولات',
      city: 'الرياض',
      annualRevenue: 24000000,
      employeesCount: 510,
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      createdAt: '2026-08-03T10:15:00Z',
    },
    {
      id: 'ACC-204',
      accountId: 'ACC-204',
      name: 'مجموعة إعمار الشرق القابضة',
      accountName: 'مجموعة إعمار الشرق القابضة',
      industry: 'الاستثمار والتطوير التجاري',
      city: 'الدمام',
      annualRevenue: 14200000,
      employeesCount: 310,
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-09-09T14:00:00Z',
    },
    {
      id: 'ACC-205',
      accountId: 'ACC-205',
      name: 'شركة المتجر الرقمي المتكامل',
      accountName: 'شركة المتجر الرقمي المتكامل',
      industry: 'التجارة الإلكترونية والتجزئة',
      city: 'جدة',
      annualRevenue: 4600000,
      employeesCount: 85,
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
      createdAt: '2026-10-02T16:30:00Z',
    },
  ];

  const contacts = [
    {
      id: 'RWQ-10482',
      leadUniqueId: 'RWQ-10482',
      accountId: 'ACC-201',
      name: 'م. بدر بن عبد الإله المنصور (RWQ-10482)',
      roleTitle: 'الرئيس التنفيذي لتقنية المعلومات CTO',
      company: 'شركة قمة التقنية للحلول الرقمية',
      phone: '+966508899001',
      email: 'badr@qimmah-tech.sa',
      city: 'الرياض',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-06-10T09:00:00Z',
    },
    {
      id: 'CNT-302',
      leadUniqueId: 'RWQ-10489',
      accountId: 'ACC-202',
      name: 'د. فيصل السالم',
      roleTitle: 'المدير الطبي التنفيذي',
      company: 'مجمع النخبة الطبي المتقدم',
      phone: '+966501122334',
      email: 'faisal@elite-med.sa',
      city: 'الرياض',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-07-14T11:20:00Z',
    },
    {
      id: 'CNT-303',
      leadUniqueId: 'RWQ-10504',
      accountId: 'ACC-203',
      name: 'أ. نورة القحطاني',
      roleTitle: 'مديرة التحول الرقمي وتجربة العملاء',
      company: 'شركة ريادة للتطوير العقاري',
      phone: '+966552233445',
      email: 'noura@riyadah-dev.sa',
      city: 'الرياض',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      createdAt: '2026-08-03T10:15:00Z',
    },
    {
      id: 'CNT-304',
      leadUniqueId: 'RWQ-10519',
      accountId: 'ACC-204',
      name: 'م. عمر الخالدي',
      roleTitle: 'مدير العمليات التجارية',
      company: 'مجموعة إعمار الشرق القابضة',
      phone: '+966543344556',
      email: 'omar@emaar-east.sa',
      city: 'الدمام',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-09-09T14:00:00Z',
    },
    {
      id: 'CNT-305',
      leadUniqueId: 'RWQ-10532',
      accountId: 'ACC-205',
      name: 'أ. كمال الغامدي',
      roleTitle: 'المؤسس والرئيس التنفيذي',
      company: 'شركة المتجر الرقمي المتكامل',
      phone: '+966564455667',
      email: 'kamal@digital-store.sa',
      city: 'جدة',
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
      createdAt: '2026-10-02T16:30:00Z',
    },
  ];

  const deals = [
    {
      id: 'DEAL-501',
      dealId: 'DEAL-501',
      leadUniqueId: 'RWQ-10482',
      accountId: 'ACC-201',
      title: 'ترخيص منظومة رواق CRM Enterprise + ربط واتساب المركزي',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      stage: 'مغلقة رابحة (Closed Won)',
      amount: 485000,
      probability: 100,
      closeDate: '2026-11-15',
      lossReason: '',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-10-28T09:00:00Z',
    },
    {
      id: 'DEAL-502',
      dealId: 'DEAL-502',
      leadUniqueId: 'RWQ-10489',
      accountId: 'ACC-202',
      title: 'أتمتة حجز المواعيد الطبية عبر WhatsApp Cloud API',
      accountName: 'مجمع النخبة الطبي المتقدم',
      stage: 'مغلقة رابحة (Closed Won)',
      amount: 340000,
      probability: 100,
      closeDate: '2026-11-16',
      lossReason: '',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-10-29T11:30:00Z',
    },
    {
      id: 'DEAL-503',
      dealId: 'DEAL-503',
      leadUniqueId: 'RWQ-10504',
      accountId: 'ACC-203',
      title: 'مشروع بوابة المبيعات العقارية والربط مع فاتورة زاتكا',
      accountName: 'شركة ريادة للتطوير العقاري',
      stage: 'مراجعة العقد (Contract Review)',
      amount: 620000,
      probability: 85,
      closeDate: '2026-11-28',
      lossReason: '',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      createdAt: '2026-11-04T10:00:00Z',
    },
    {
      id: 'DEAL-504',
      dealId: 'DEAL-504',
      leadUniqueId: 'RWQ-10519',
      accountId: 'ACC-204',
      title: 'باقة أتمتة المبيعات الميدانية وتتبع المناديب',
      accountName: 'مجموعة إعمار الشرق القابضة',
      stage: 'التفاوض المالي (Negotiation)',
      amount: 275000,
      probability: 65,
      closeDate: '2026-12-05',
      lossReason: '',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-10-25T13:15:00Z',
    },
    {
      id: 'DEAL-505',
      dealId: 'DEAL-505',
      leadUniqueId: 'RWQ-10532',
      accountId: 'ACC-205',
      title: 'ربط سلة وزد مع صندوق المحادثات الموحد Omni-Inbox',
      accountName: 'شركة المتجر الرقمي المتكامل',
      stage: 'مغلقة رابحة (Closed Won)',
      amount: 145000,
      probability: 100,
      closeDate: '2026-11-14',
      lossReason: '',
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
      createdAt: '2026-11-03T15:45:00Z',
    },
    {
      id: 'DEAL-506',
      dealId: 'DEAL-506',
      leadUniqueId: 'RWQ-10482',
      accountId: 'ACC-201',
      title: 'ترقية خوادم الذكاء الاصطناعي وتوسعة المقاعد السنوية (RWQ-10482)',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      stage: 'مغلقة رابحة (Closed Won)',
      amount: 515200,
      probability: 100,
      closeDate: '2026-11-17',
      lossReason: '',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      createdAt: '2026-11-07T12:00:00Z',
    },
    {
      id: 'DEAL-507',
      dealId: 'DEAL-507',
      leadUniqueId: 'RWQ-10561',
      accountId: 'ACC-204',
      title: 'باقة CRM الأساسية لفرع الجبيل الصناعي',
      accountName: 'مصنع الخليج للصناعات الدقيقة',
      stage: 'مغلقة خاسرة (Closed Lost)',
      amount: 68000,
      probability: 0,
      closeDate: '2026-11-10',
      lossReason: 'تأجيل الميزانية للعام القادم',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
      createdAt: '2026-10-06T10:00:00Z',
    },
  ];

  // 10 Repeat Purchases for VIP Customer RWQ-10482 across Meta, Google, and WhatsApp Broadcast
  const order_attributions = [
    {
      id: 'ORD-ATTR-01',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 1,
      orderSequenceLabel: 'الطلب 1 (استحواذ أولي)',
      campaignName: 'حملة التحول الرقمي لكبار العملاء Q4',
      channel: 'إعلانات ميتا (Meta Lead Ads)',
      orderAmountSAR: 65000,
      roasMultiplier: 6.8,
      orderedAt: '2026-06-14',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-02',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 2,
      orderSequenceLabel: 'الطلب 2 (تكرار ثانٍ)',
      campaignName: 'حملة بحث جوجل - تكامل API المالي',
      channel: 'إعلانات بحث جوجل (Google Search)',
      orderAmountSAR: 48000,
      roasMultiplier: 5.4,
      orderedAt: '2026-07-02',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-03',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 3,
      orderSequenceLabel: 'الطلب 3 (تكرار ثالث)',
      campaignName: 'حملة إعادة استهداف العملاء VIP عبر واتساب',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 72000,
      roasMultiplier: 11.2,
      orderedAt: '2026-07-19',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-04',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 4,
      orderSequenceLabel: 'الطلب 4 (تكرار رابع)',
      campaignName: 'حملة ترقية المقاعد السنوية Q3',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 55000,
      roasMultiplier: 9.6,
      orderedAt: '2026-08-05',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-05',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 5,
      orderSequenceLabel: 'الطلب 5 (ولاء متقدم)',
      campaignName: 'حملة إطلاق أتمتة سير العمل الذكي',
      channel: 'إعلانات ميتا لإعادة الاستهداف (Meta Retargeting)',
      orderAmountSAR: 84000,
      roasMultiplier: 8.5,
      orderedAt: '2026-08-24',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-06',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 6,
      orderSequenceLabel: 'الطلب 6 (توسعة الفروع)',
      campaignName: 'حملة عروض المؤسسات الكبرى',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 62000,
      roasMultiplier: 10.4,
      orderedAt: '2026-09-12',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-07',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 7,
      orderSequenceLabel: 'الطلب 7 (ربط الفوترة)',
      campaignName: 'حملة الربط السحابي مع ZATCA Phase 2',
      channel: 'إعلانات بحث جوجل (Google Search)',
      orderAmountSAR: 95000,
      roasMultiplier: 7.9,
      orderedAt: '2026-09-29',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-08',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 8,
      orderSequenceLabel: 'الطلب 8 (توسعة إقليمية)',
      campaignName: 'حملة التوسع الإقليمي Q4',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 110000,
      roasMultiplier: 13.5,
      orderedAt: '2026-10-15',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-09',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 9,
      orderSequenceLabel: 'الطلب 9 (باقة الذكاء الاصطناعي)',
      campaignName: 'حملة التحول الرقمي لكبار العملاء Q4',
      channel: 'إعلانات ميتا لإعادة الاستهداف (Meta Retargeting)',
      orderAmountSAR: 135000,
      roasMultiplier: 9.8,
      orderedAt: '2026-11-02',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-10',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية (RWQ-10482)',
      orderIndex: 10,
      orderSequenceLabel: 'الطلب +10 (شريك استراتيجي VIP)',
      campaignName: 'حملة إعادة استهداف العملاء VIP عبر واتساب',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 274200,
      roasMultiplier: 16.4,
      orderedAt: '2026-11-16',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-11',
      leadUniqueId: 'RWQ-10489',
      customerName: 'د. فيصل السالم — مجمع النخبة الطبي',
      orderIndex: 1,
      orderSequenceLabel: 'الطلب 1 (استحواذ أولي)',
      campaignName: 'حملة القطاع الطبي والعيادات - الرياض',
      channel: 'إعلانات ميتا (Meta Lead Ads)',
      orderAmountSAR: 190000,
      roasMultiplier: 6.2,
      orderedAt: '2026-10-22',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'ORD-ATTR-12',
      leadUniqueId: 'RWQ-10489',
      customerName: 'د. فيصل السالم — مجمع النخبة الطبي',
      orderIndex: 2,
      orderSequenceLabel: 'الطلب 2 (تكرار ثانٍ)',
      campaignName: 'حملة القطاع الطبي والعيادات - الرياض',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 150000,
      roasMultiplier: 9.1,
      orderedAt: '2026-11-15',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
  ];

  const touchpoints = [
    {
      id: 'TP-701',
      leadUniqueId: 'RWQ-10482',
      campaignName: 'حملة التحول الرقمي لكبار العملاء Q4',
      source: 'إعلانات ميتا (Meta Lead Ads)',
      medium: 'Paid Social - Lead Form',
      adId: 'meta_ad_992817261',
      fbclid: 'IwAR2x9kLmPq817261_rwq_vip',
      isReengaged: true,
      timestamp: '2026-10-28T09:12:00Z',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'TP-702',
      leadUniqueId: 'RWQ-10482',
      campaignName: 'حملة إعادة استهداف العملاء VIP عبر واتساب',
      source: 'واتساب للأعمال (WhatsApp API)',
      medium: 'WhatsApp Retargeting Broadcast',
      adId: 'wa_bcast_vip_2026',
      fbclid: 'IwAR8z7vBnMq551920_rwq_wa',
      isReengaged: true,
      timestamp: '2026-11-14T14:30:00Z',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'TP-703',
      leadUniqueId: 'RWQ-10489',
      campaignName: 'حملة القطاع الطبي والعيادات - الرياض',
      source: 'إعلانات ميتا (Meta Lead Ads)',
      medium: 'Click-to-WhatsApp Ad',
      adId: 'meta_ad_881726354',
      fbclid: 'IwAR1a2b3c4d_med_riyadh',
      isReengaged: true,
      timestamp: '2026-10-30T10:45:00Z',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'TP-704',
      leadUniqueId: 'RWQ-10504',
      campaignName: 'حملة التطوير العقاري والمجمعات السكنية',
      source: 'واتساب للأعمال (WhatsApp API)',
      medium: 'Direct CTWA Ad',
      adId: 'ctwa_ad_7746152',
      fbclid: 'IwAR9q8w7e6r_real_estate',
      isReengaged: false,
      timestamp: '2026-11-05T11:20:00Z',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
    },
    {
      id: 'TP-705',
      leadUniqueId: 'RWQ-10519',
      campaignName: 'حملة بحث جوجل - أفضل نظام CRM سعودي',
      source: 'إعلانات بحث جوجل (Google Search)',
      medium: 'CPC Search Keyword',
      adId: 'gads_ksa_crm_01',
      fbclid: '',
      isReengaged: false,
      timestamp: '2026-11-02T16:10:00Z',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
    },
    {
      id: 'TP-706',
      leadUniqueId: 'RWQ-10532',
      campaignName: 'حملة متاجر التجارة الإلكترونية Instagram',
      source: 'إنستغرام دايركت (Instagram DM)',
      medium: 'Instagram Reels Ad',
      adId: 'ig_reel_ad_44321',
      fbclid: 'IwAR5t4y3u2i_ig_ecom',
      isReengaged: true,
      timestamp: '2026-11-08T18:05:00Z',
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
    },
  ];

  const stage_history = [
    {
      id: 'SH-801',
      dealId: 'DEAL-501',
      dealTitle: 'ترخيص منظومة رواق CRM Enterprise (RWQ-10482)',
      fromStage: 'تأهيل أولي (Qualified)',
      toStage: 'تقديم العرض الفني والمالي (Proposal)',
      dwellDays: 4,
      changedBy: 'طارق العتيبي',
      ownerId: 'usr-1',
      changedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'SH-802',
      dealId: 'DEAL-501',
      dealTitle: 'ترخيص منظومة رواق CRM Enterprise (RWQ-10482)',
      fromStage: 'تقديم العرض الفني والمالي (Proposal)',
      toStage: 'التفاوض المالي (Negotiation)',
      dwellDays: 6,
      changedBy: 'طارق العتيبي',
      ownerId: 'usr-1',
      changedAt: '2026-11-07T14:30:00Z',
    },
    {
      id: 'SH-803',
      dealId: 'DEAL-501',
      dealTitle: 'ترخيص منظومة رواق CRM Enterprise (RWQ-10482)',
      fromStage: 'التفاوض المالي (Negotiation)',
      toStage: 'مغلقة رابحة (Closed Won)',
      dwellDays: 8,
      changedBy: 'طارق العتيبي',
      ownerId: 'usr-1',
      changedAt: '2026-11-15T16:00:00Z',
    },
    {
      id: 'SH-804',
      dealId: 'DEAL-502',
      dealTitle: 'أتمتة حجز المواعيد الطبية عبر WhatsApp Cloud API',
      fromStage: 'تأهيل أولي (Qualified)',
      toStage: 'تقديم العرض الفني والمالي (Proposal)',
      dwellDays: 7,
      changedBy: 'طارق العتيبي',
      ownerId: 'usr-1',
      changedAt: '2026-11-05T11:00:00Z',
    },
    {
      id: 'SH-805',
      dealId: 'DEAL-502',
      dealTitle: 'أتمتة حجز المواعيد الطبية عبر WhatsApp Cloud API',
      fromStage: 'تقديم العرض الفني والمالي (Proposal)',
      toStage: 'مغلقة رابحة (Closed Won)',
      dwellDays: 11,
      changedBy: 'طارق العتيبي',
      ownerId: 'usr-1',
      changedAt: '2026-11-16T15:20:00Z',
    },
    {
      id: 'SH-806',
      dealId: 'DEAL-503',
      dealTitle: 'مشروع بوابة المبيعات العقارية والربط مع فاتورة زاتكا',
      fromStage: 'تقديم العرض الفني والمالي (Proposal)',
      toStage: 'مراجعة العقد (Contract Review)',
      dwellDays: 12,
      changedBy: 'سارة المهيدب',
      ownerId: 'usr-2',
      changedAt: '2026-11-15T13:10:00Z',
    },
    {
      id: 'SH-807',
      dealId: 'DEAL-504',
      dealTitle: 'باقة أتمتة المبيعات الميدانية وتتبع المناديب',
      fromStage: 'تقديم العرض الفني والمالي (Proposal)',
      toStage: 'التفاوض المالي (Negotiation)',
      dwellDays: 19,
      changedBy: 'خالد الدوسري',
      ownerId: 'usr-3',
      changedAt: '2026-11-13T09:45:00Z',
    },
  ];

  const campaigns = [
    {
      id: 'CMP-01',
      name: 'حملة التحول الرقمي لكبار العملاء Q4',
      campaignName: 'حملة التحول الرقمي لكبار العملاء Q4',
      channel: 'إعلانات ميتا (Meta Lead Ads)',
      status: 'نشطة (Active)',
      spendSAR: 85000,
      revenueSAR: 1000200,
      leadsGenerated: 142,
      wonDealsCount: 10,
      sentCount: 4500,
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'CMP-02',
      name: 'حملة القطاع الطبي والعيادات - الرياض',
      campaignName: 'حملة القطاع الطبي والعيادات - الرياض',
      channel: 'إعلانات ميتا (Meta Lead Ads)',
      status: 'نشطة (Active)',
      spendSAR: 42000,
      revenueSAR: 340000,
      leadsGenerated: 96,
      wonDealsCount: 5,
      sentCount: 3200,
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'CMP-03',
      name: 'حملة التطوير العقاري والمجمعات السكنية',
      campaignName: 'حملة التطوير العقاري والمجمعات السكنية',
      channel: 'واتساب للأعمال (WhatsApp API)',
      status: 'نشطة (Active)',
      spendSAR: 35000,
      revenueSAR: 620000,
      leadsGenerated: 118,
      wonDealsCount: 6,
      sentCount: 5800,
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
    },
    {
      id: 'CMP-04',
      name: 'حملة بحث جوجل - أفضل نظام CRM سعودي',
      campaignName: 'حملة بحث جوجل - أفضل نظام CRM سعودي',
      channel: 'إعلانات بحث جوجل (Google Search)',
      status: 'نشطة (Active)',
      spendSAR: 58000,
      revenueSAR: 275000,
      leadsGenerated: 74,
      wonDealsCount: 4,
      sentCount: 1900,
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
    },
  ];

  const quotes = [
    {
      id: 'QT-401',
      quoteNumber: 'QT-2026-0081',
      leadUniqueId: 'RWQ-10482',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      status: 'معتمد وموقع (Accepted)',
      subtotalSAR: 510000,
      discountSAR: 25000,
      totalSAR: 485000,
      validUntil: '2026-12-01',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'QT-402',
      quoteNumber: 'QT-2026-0089',
      leadUniqueId: 'RWQ-10504',
      accountName: 'شركة ريادة للتطوير العقاري',
      status: 'قيد المراجعة القانونية (Under Review)',
      subtotalSAR: 650000,
      discountSAR: 30000,
      totalSAR: 620000,
      validUntil: '2026-12-15',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
    },
  ];

  const sales_orders = [
    {
      id: 'SO-9010',
      orderNumber: 'SO-2026-9010',
      leadUniqueId: 'RWQ-10482',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      status: 'مكتمل ومفعل (Fulfilled)',
      totalSAR: 274200,
      orderDate: '2026-11-16',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'SO-9012',
      orderNumber: 'SO-2026-9012',
      leadUniqueId: 'RWQ-10489',
      accountName: 'مجمع النخبة الطبي المتقدم',
      status: 'مكتمل ومفعل (Fulfilled)',
      totalSAR: 150000,
      orderDate: '2026-11-15',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
  ];

  const invoices = [
    {
      id: 'INV-701',
      invoiceNumber: 'INV-ZATCA-2026-101',
      leadUniqueId: 'RWQ-10482',
      accountName: 'شركة قمة التقنية للحلول الرقمية',
      status: 'مدفوعة بالكامل (Paid)',
      amountSAR: 421739,
      vatSAR: 63261,
      totalWithVatSAR: 485000,
      daysOverdue: 0,
      dueDate: '2026-11-16',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'INV-702',
      invoiceNumber: 'INV-ZATCA-2026-108',
      leadUniqueId: 'RWQ-10489',
      accountName: 'مجمع النخبة الطبي المتقدم',
      status: 'مدفوعة بالكامل (Paid)',
      amountSAR: 295652,
      vatSAR: 44348,
      totalWithVatSAR: 340000,
      daysOverdue: 0,
      dueDate: '2026-11-17',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'INV-703',
      invoiceNumber: 'INV-ZATCA-2026-115',
      leadUniqueId: 'RWQ-10519',
      accountName: 'مجموعة إعمار الشرق القابضة',
      status: 'متأخرة السداد (Overdue)',
      amountSAR: 120000,
      vatSAR: 18000,
      totalWithVatSAR: 138000,
      daysOverdue: 19,
      dueDate: '2026-10-29',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
    },
  ];

  const tasks = [
    {
      id: 'TSK-601',
      leadUniqueId: 'RWQ-10482',
      title: 'مراجعة واعتماد عقد التوسعة العاشرة مع م. بدر المنصور (RWQ-10482)',
      relatedTo: 'شركة قمة التقنية للحلول الرقمية',
      priority: 'عاجل جداً (High)',
      status: 'مكتملة (Completed)',
      dueDate: '2026-11-16',
      assignedToName: 'طارق العتيبي',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
    },
    {
      id: 'TSK-602',
      leadUniqueId: 'RWQ-10504',
      title: 'إرسال مسودة اتفاقية مستوى الخدمة SLA لشركة ريادة العقارية',
      relatedTo: 'شركة ريادة للتطوير العقاري',
      priority: 'عاجل جداً (High)',
      status: 'قيد التنفيذ (In Progress)',
      dueDate: '2026-11-19',
      assignedToName: 'سارة المهيدب',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
    },
    {
      id: 'TSK-603',
      leadUniqueId: 'RWQ-10519',
      title: 'متابعة عرض الأسعار المالي مع م. عمر الخالدي',
      relatedTo: 'مجموعة إعمار الشرق القابضة',
      priority: 'متوسطة (Medium)',
      status: 'متأخرة (Overdue)',
      dueDate: '2026-11-12',
      assignedToName: 'خالد الدوسري',
      ownerId: 'usr-3',
      ownerName: 'خالد الدوسري',
    },
  ];

  const calls = [
    {
      id: 'CALL-101',
      leadUniqueId: 'RWQ-10482',
      contactName: 'م. بدر المنصور (RWQ-10482)',
      direction: 'مكالمة صادرة (Outbound)',
      durationSeconds: 1480,
      outcome: 'تم الاتفاق على الترقية (Interested)',
      agentName: 'طارق العتيبي',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      calledAt: '2026-11-15T11:00:00Z',
    },
    {
      id: 'CALL-102',
      leadUniqueId: 'RWQ-10504',
      contactName: 'أ. نورة القحطاني',
      direction: 'مكالمة صادرة (Outbound)',
      durationSeconds: 1920,
      outcome: 'طلب مسودة العقد (Contract Requested)',
      agentName: 'سارة المهيدب',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      calledAt: '2026-11-16T14:00:00Z',
    },
  ];

  const whatsapp_messages = [
    {
      id: 'WA-901',
      leadUniqueId: 'RWQ-10482',
      senderName: 'م. بدر المنصور (RWQ-10482)',
      channel: 'واتساب للأعمال (WhatsApp API)',
      status: 'تمت القراءة والرد (Replied)',
      responseTimeMinutes: 1.2,
      within24hWindow: true,
      assignedAgent: 'طارق العتيبي',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      sentAt: '2026-11-17T09:14:00Z',
    },
    {
      id: 'WA-902',
      leadUniqueId: 'RWQ-10489',
      senderName: 'د. فيصل السالم',
      channel: 'واتساب للأعمال (WhatsApp API)',
      status: 'تمت القراءة والرد (Replied)',
      responseTimeMinutes: 1.8,
      within24hWindow: true,
      assignedAgent: 'طارق العتيبي',
      ownerId: 'usr-1',
      ownerName: 'طارق العتيبي',
      sentAt: '2026-11-17T10:30:00Z',
    },
    {
      id: 'WA-903',
      leadUniqueId: 'RWQ-10504',
      senderName: 'أ. نورة القحطاني',
      channel: 'واتساب للأعمال (WhatsApp API)',
      status: 'تم التسليم (Delivered)',
      responseTimeMinutes: 2.4,
      within24hWindow: true,
      assignedAgent: 'سارة المهيدب',
      ownerId: 'usr-2',
      ownerName: 'سارة المهيدب',
      sentAt: '2026-11-17T12:15:00Z',
    },
    {
      id: 'WA-904',
      leadUniqueId: 'RWQ-10532',
      senderName: 'أ. كمال الغامدي',
      channel: 'إنستغرام دايركت (Instagram DM)',
      status: 'تمت القراءة والرد (Replied)',
      responseTimeMinutes: 1.5,
      within24hWindow: true,
      assignedAgent: 'ريم الشمري',
      ownerId: 'usr-4',
      ownerName: 'ريم الشمري',
      sentAt: '2026-11-17T15:40:00Z',
    },
  ];

  return {
    leads,
    contacts,
    accounts,
    deals,
    touchpoints,
    campaigns,
    quotes,
    sales_orders,
    invoices,
    tasks,
    calls,
    whatsapp_messages,
    stage_history,
    order_attributions,
  };
}

export const ReportsModulePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    isPreviewMode,
    currentUser,
    syncStatus,
    currentOrgId,
    currentOrganization,
    leads: orgLeads,
    contacts: orgContacts,
    accounts: orgAccounts,
    deals: orgDeals,
    quotes: orgQuotes,
    salesOrders: orgSalesOrders,
    invoices: orgInvoices,
    tasks: orgTasks,
    touchpoints: orgTouchpoints,
    messages: orgMessages,
    stageHistory: orgStageHistory,
    orderAttributions: orgOrderAttributions,
  } = useCrm();
  const orgCampaigns: any[] = [];
  const prefUid = firebaseUser?.uid || currentUser?.uid;

  useEffect(() => {
    if (!prefUid || !firebaseUser || isPreviewMode || syncStatus === 'preview') return;
    const pinnedRef = doc(db, 'users', prefUid, 'preferences', 'pinned_reports');
    const unsub = onSnapshot(
      pinnedRef,
      (snap) => {
        if (snap.exists()) {
          const pinned = snap.data()?.pinnedReports;
          if (Array.isArray(pinned)) {
            try {
              localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(pinned));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [prefUid, firebaseUser, isPreviewMode, syncStatus]);

  const [reports, setReports] = useState<ReportDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REPORTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return STANDARD_REPORTS;
  });

  const [folders, setFolders] = useState<ReportFolder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return STANDARD_FOLDERS;
  });

  const [schedules, setSchedules] = useState<ExtendedReportSchedule[] | undefined>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return undefined;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    } catch {
      // ignore
    }
  }, [reports]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [folders]);

  useEffect(() => {
    if (schedules) {
      try {
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
      } catch {
        // ignore
      }
    }
  }, [schedules]);

  // Active Security Preset
  const [selectedSecurityId, setSelectedSecurityId] = useState<string>('ceo');
  const activeSecurityPreset = useMemo(
    () => SECURITY_PRESETS.find((p) => p.id === selectedSecurityId) || SECURITY_PRESETS[0],
    [selectedSecurityId]
  );

  // Active View Mode: 'home' | 'viewer' | 'scheduler'
  const [viewMode, setViewMode] = useState<'home' | 'viewer' | 'scheduler'>('home');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [recentReportIds, setRecentReportIds] = useState<string[]>([
    'rpt_10plus_order_attribution_matrix',
    'rpt_deals_by_stage',
    'rpt_leads_by_source',
  ]);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportDefinition | null>(null);
  const [isCloneWizard, setIsCloneWizard] = useState(false);

  const [exportModalState, setExportModalState] = useState<{
    report: ReportDefinition;
    result: ReportExecutionResult;
  } | null>(null);

  const [preselectedScheduleReport, setPreselectedScheduleReport] =
    useState<ReportDefinition | null>(null);
  const [autoOpenScheduleModal, setAutoOpenScheduleModal] = useState(false);

  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 4000);
  };

  const dataset = useMemo<any>(() => {
    const liveLeads = orgLeads.map((l) => ({
      id: l.id,
      leadUniqueId: l.leadUniqueId || l.unique_id,
      fullName: l.fullName,
      company: l.company || l.city || 'منشأة تجارية',
      source: l.source || 'مباشر',
      campaignName: l.campaign || 'حملة مباشرة',
      status: l.status,
      leadScore: l.leadScore ?? l.aiScore ?? 80,
      valueSAR: Number(l.estimatedValue ?? (l as any).valueSAR ?? l.approvedBudget ?? 150000),
      estimatedValueSAR: Number(l.estimatedValue ?? (l as any).valueSAR ?? l.approvedBudget ?? 150000),
      responseMinutes: 2.0,
      ownerId: 'usr-1',
      ownerName: l.ownerName || l.assignedToName || 'سلمان القحطاني',
      createdAt: l.createdAt || new Date().toISOString().slice(0, 10),
    }));

    const liveContacts = orgContacts.map((c) => ({
      id: c.id,
      leadUniqueId: c.leadUniqueId || c.id,
      fullName: c.fullName,
      accountName: c.accountName,
      channel: c.channel,
      totalOrdersCount: c.repeatOrderCount || 1,
      lifetimeValueSAR: c.lifetimeRevenue || 0,
      primarySource: c.primarySource || 'مباشر',
      lastOrderSource: c.lastTouchSource || c.primarySource || 'مباشر',
      ownerId: 'usr-1',
      ownerName: c.ownerName,
    }));

    const liveAccounts = orgAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      industry: a.industry,
      city: a.city,
      tier: a.tier,
      annualRevenueSAR: a.annualRevenue,
      openDealsCount: orgDeals.filter((d) => d.accountName === a.name).length,
      ownerId: 'usr-1',
      ownerName: a.ownerName,
    }));

    const liveDeals = orgDeals.map((d) => ({
      id: d.id,
      leadUniqueId: d.leadUniqueId || d.id,
      title: d.title,
      accountId: d.accountId,
      accountName: d.accountName,
      contactId: d.contactId,
      stage:
        d.stage === 'مكتملة'
          ? 'مغلقة - فوز (Closed Won)'
          : d.stage === 'خسارة'
          ? 'مغلقة - خسارة (Closed Lost)'
          : d.stage,
      amountSAR: d.amount,
      expectedRevenueSAR: Math.round((d.amount * (d.probability || 0)) / 100),
      probability: d.probability,
      lossReason: d.stage === 'خسارة' ? d.nextStep || 'سبب مسجل في البلوبرينت' : '—',
      closeDate: d.closeDate,
      cycleDays: 14,
      ownerId: 'usr-1',
      ownerName: d.ownerName,
    }));

    const liveQuotes = orgQuotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      leadUniqueId: q.leadUniqueId || q.dealId,
      subject: q.subject,
      accountName: q.accountName,
      status: q.status,
      totalAmountSAR: q.totalAmount,
      validUntil: q.validUntil,
      ownerId: 'usr-1',
      ownerName: q.ownerName || 'طارق العتيبي',
    }));

    const liveSalesOrders = orgSalesOrders.map((so) => ({
      id: so.id,
      orderNumber: so.orderNumber,
      quoteId: so.quoteId,
      leadUniqueId: so.leadUniqueId || so.dealId || so.id,
      accountName: so.accountName,
      status: so.status,
      totalAmountSAR: so.totalAmount,
      deliveryDate: so.deliveryDate,
      ownerId: 'usr-1',
      ownerName: so.ownerName || 'طارق العتيبي',
    }));

    const liveInvoices = orgInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      leadUniqueId: inv.leadUniqueId || inv.orderId || inv.id,
      accountName: inv.accountName,
      status: inv.status,
      amountSAR: inv.subtotalAmount,
      vatSAR: inv.vatAmount,
      totalWithVatSAR: inv.totalWithVat,
      daysOverdue: inv.status === 'متأخرة' ? 12 : 0,
      dueDate: inv.dueDate,
      ownerId: 'usr-1',
      ownerName: inv.ownerName || 'طارق العتيبي',
    }));

    const liveTasks = orgTasks.map((t) => ({
      id: t.id,
      leadUniqueId: t.leadUniqueId || t.id,
      title: t.title,
      relatedTo: t.relatedTo,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      assignedToName: t.assignedToName,
      ownerId: 'usr-1',
      ownerName: t.assignedToName,
    }));

    const liveTouchpoints = orgTouchpoints.map((tp, idx) => ({
      id: tp.id,
      leadUniqueId: tp.leadUniqueId || tp.relatedEntityId,
      touchOrder: idx + 1,
      touchRole: idx === 0 ? 'First Touch (أول تفاعل)' : 'Follow-up Touch',
      channel: tp.channel,
      campaignName: tp.campaign || 'مباشر',
      eventType: tp.eventType || tp.channel,
      summary: tp.summary,
      attributedRevenueSAR: 0,
      occurredAt: tp.timestamp,
      ownerId: 'usr-1',
      ownerName: currentUser?.fullName || 'طارق العتيبي',
    }));

    const liveCampaigns = orgCampaigns
      .filter((c: any) => !c.org_id || c.org_id === currentOrgId)
      .map((c: any) => ({
        id: c.id,
        campaignName: c.name,
        platform: c.channel,
        spendSAR: c.spendSAR,
        leadsGenerated: c.leadsGenerated,
        wonDealsCount: c.dealsWon,
        revenueSAR: c.revenueAttributed,
        roas: c.roas,
        cplSAR: c.leadsGenerated > 0 ? Math.round(c.spendSAR / c.leadsGenerated) : 0,
        ownerId: 'usr-1',
        ownerName: currentUser?.fullName || 'طارق العتيبي',
      }));

    const liveMessages = orgMessages.map((m) => ({
      id: m.id,
      leadUniqueId: m.leadUniqueId || m.id,
      senderName: m.senderName,
      channel: m.channel,
      status: m.unread ? 'غير مقروءة' : 'تمت القراءة والرد (Replied)',
      responseTimeMinutes: 1.5,
      within24hWindow: true,
      assignedAgent: currentUser?.fullName || 'طارق العتيبي',
      ownerId: 'usr-1',
      ownerName: currentUser?.fullName || 'طارق العتيبي',
      sentAt: m.timestampLabel,
    }));

    const liveStageHistory = orgStageHistory.map((sh) => ({
      id: sh.id,
      dealId: sh.dealId,
      leadUniqueId: sh.leadUniqueId || sh.dealId,
      dealTitle: sh.dealTitle,
      fromStage: sh.fromStage,
      toStage: sh.toStage,
      durationDays: sh.durationDays,
      changedBy: sh.changedBy,
      ownerId: 'usr-1',
      ownerName: sh.changedBy,
      changedAt: sh.changedAt,
    }));

    const liveOrderAttributions = orgOrderAttributions.map((oa) => ({
      id: oa.id,
      orderCode: oa.orderNumber,
      orderSequence: oa.orderIndex,
      leadUniqueId: oa.leadUniqueId,
      customerName: oa.contactName,
      accountName: oa.accountName,
      acquisitionChannel: oa.touchChannel,
      campaignName: oa.campaign,
      touchpointType: oa.touchLabel,
      orderAmountSAR: oa.amount ?? oa.orderAmountSAR ?? 0,
      vatAmountSAR: Math.round((oa.amount ?? oa.orderAmountSAR ?? 0) * 0.15),
      orderDate: oa.orderedAt,
      ownerId: 'usr-1',
      ownerName: currentUser?.fullName || 'طارق العتيبي',
    }));

    if (currentOrgId !== 'org_riwaq_main') {
      return {
        leads: liveLeads,
        contacts: liveContacts,
        accounts: liveAccounts,
        deals: liveDeals,
        touchpoints: liveTouchpoints,
        campaigns: liveCampaigns,
        quotes: liveQuotes,
        sales_orders: liveSalesOrders,
        invoices: liveInvoices,
        tasks: liveTasks,
        calls: [],
        whatsapp_messages: liveMessages,
        stage_history: liveStageHistory,
        order_attributions: liveOrderAttributions,
      };
    }

    const base = buildEnterpriseDataset();
    return {
      ...base,
      leads: liveLeads.length > 0 ? liveLeads : base.leads,
      contacts: liveContacts.length > 0 ? liveContacts : base.contacts,
      accounts: liveAccounts.length > 0 ? liveAccounts : base.accounts,
      deals: liveDeals.length > 0 ? liveDeals : base.deals,
      quotes: liveQuotes.length > 0 ? liveQuotes : base.quotes,
      sales_orders: liveSalesOrders.length > 0 ? liveSalesOrders : base.sales_orders,
      invoices: liveInvoices.length > 0 ? liveInvoices : base.invoices,
      tasks: liveTasks.length > 0 ? liveTasks : base.tasks,
    };
  }, [
    currentOrgId,
    currentUser?.fullName,
    orgAccounts,
    orgCampaigns,
    orgContacts,
    orgDeals,
    orgInvoices,
    orgLeads,
    orgMessages,
    orgOrderAttributions,
    orgQuotes,
    orgSalesOrders,
    orgStageHistory,
    orgTasks,
    orgTouchpoints,
  ]);

  const activeReport = useMemo(
    () => reports.find((r) => r.id === activeReportId) || null,
    [reports, activeReportId]
  );

  // Handlers
  const handleOpenReport = (report: ReportDefinition) => {
    const nowIso = new Date().toISOString();
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, lastRunAt: nowIso } : r))
    );
    setRecentReportIds((prev) => [
      report.id,
      ...prev.filter((id) => id !== report.id),
    ]);
    setActiveReportId(report.id);
    setViewMode('viewer');
  };

  const handleSaveReport = (savedReport: ReportDefinition, runImmediately: boolean) => {
    setReports((prev) => {
      const exists = prev.some((r) => r.id === savedReport.id);
      if (exists) {
        return prev.map((r) => (r.id === savedReport.id ? savedReport : r));
      }
      return [savedReport, ...prev];
    });
    setIsWizardOpen(false);
    setEditingReport(null);
    setIsCloneWizard(false);

    if (runImmediately) {
      setActiveReportId(savedReport.id);
      setViewMode('viewer');
      showToast(`تم حفظ وتشغيل التقرير "${savedReport.name}" بنجاح`);
    } else {
      showToast(`تم حفظ التقرير "${savedReport.name}" في المجلد المختار`);
    }
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    showToast('تم حذف التقرير بنجاح');
  };

  const handleToggleFavorite = (reportId: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  const handleSaveFolder = (folder: ReportFolder) => {
    setFolders((prev) => {
      const exists = prev.some((f) => f.id === folder.id);
      if (exists) {
        return prev.map((f) => (f.id === folder.id ? folder : f));
      }
      return [...prev, folder];
    });
    showToast(`تم حفظ مجلد التقارير "${folder.name}"`);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    showToast('تم حذف المجلد بنجاح');
  };

  const handleOpenExportFromHome = (report: ReportDefinition) => {
    const result = executeReport(report, dataset, activeSecurityPreset.context);
    setExportModalState({ report, result });
  };

  const handlePinToDashboard = (widget: PinnedDashboardWidgetConfig) => {
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEYS.PINNED);
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      const mappedForDashboard = {
        id: widget.id,
        reportId: widget.reportId,
        title: widget.title,
        dashboardCategory: widget.targetDashboard,
        size: widget.size,
        pinnedAt: widget.pinnedAt,
      };
      const updated = [
        mappedForDashboard,
        ...existing.filter((w) => w.reportId !== widget.reportId),
      ];
      localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(updated));
      if (prefUid && firebaseUser && !isPreviewMode && syncStatus !== 'preview') {
        setDoc(
          doc(db, 'users', prefUid, 'preferences', 'pinned_reports'),
          { pinnedReports: updated, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      }
    } catch {
      // ignore
    }
    showToast(`تم تثبيت "${widget.title}" في لوحة القيادة التنفيذية بنجاح`);
  };

  const handleSaveSchedule = (sched: ExtendedReportSchedule) => {
    setSchedules((prev) => {
      const list = prev ?? [];
      const exists = list.some((s) => s.id === sched.id);
      if (exists) {
        return list.map((s) => (s.id === sched.id ? sched : s));
      }
      return [sched, ...list];
    });
    showToast(`تم حفظ جدولة الإرسال التلقائي للتقرير "${sched.reportName}"`);
  };

  const handleToggleScheduleActive = (scheduleId: string) => {
    setSchedules((prev) =>
      (prev ?? []).map((s) => (s.id === scheduleId ? { ...s, active: !s.active } : s))
    );
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setSchedules((prev) => (prev ?? []).filter((s) => s.id !== scheduleId));
    showToast('تم حذف الجدولة الدورية');
  };

  const handleNavigateToRecord = (module: ModuleName, recordId: string, rwqId?: string) => {
    if (module === 'deals') {
      navigate(`/deals/${recordId}`);
    } else if (module === 'leads') {
      navigate(`/leads/${recordId}`);
    } else if (module === 'accounts') {
      navigate(`/accounts/${recordId}`);
    } else if (module === 'contacts' || module === 'order_attributions') {
      navigate(`/contacts/${rwqId || recordId}`);
    } else {
      showToast(`فتح بطاقة السجل المرجعي: ${rwqId || recordId} (${module})`);
    }
  };

  const handleOpenWhatsAppChat = (rwqId: string, name?: string) => {
    showToast(`جاري فتح محادثة واتساب المباشرة مع ${name || rwqId}...`);
    setTimeout(() => {
      navigate('/inbox');
    }, 900);
  };

  return (
    <div dir="rtl" className="flex flex-col min-h-[calc(100vh-56px)] bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Top Enterprise BI Bar: Navigation Tabs + RBAC/FLS Live Security Context Switcher */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('home')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'home' || viewMode === 'viewer'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
          >
            <FileBarChart2 className="w-3.5 h-3.5" />
            <span>مستكشف التقارير ومحلل BI ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreselectedScheduleReport(null);
              setAutoOpenScheduleModal(false);
              setViewMode('scheduler');
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'scheduler'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>التقارير المجدولة تلقائياً</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingReport(null);
              setIsCloneWizard(false);
              setIsWizardOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#2563EB] bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>معالج بناء تقرير (5 خطوات)</span>
          </button>
        </div>

        {/* Live Role Hierarchy & FLS Security Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0]">
            <Database className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>نطاق البيانات النشط:</span>
            <span className="text-[#0F172A] font-bold">
              {currentOrganization.name} ({orgDeals.length} صفقة • {orgLeads.length} عميل محتمل)
            </span>
          </div>

          <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1">
            <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span className="text-[11px] font-bold text-[#475569] whitespace-nowrap">
              محاكاة الصلاحيات (RBAC & FLS):
            </span>
            <select
              value={selectedSecurityId}
              onChange={(e) => setSelectedSecurityId(e.target.value)}
              className="bg-white border border-[#CBD5E1] rounded px-2 py-0.5 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            >
              {SECURITY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            {selectedSecurityId === 'rep_fls' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <Lock className="w-3 h-3" />
                <span>حجب FLS مفعل</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-emerald-700 hover:underline text-[11px]"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col">
        {viewMode === 'home' && (
          <ReportsHome
            reports={reports}
            folders={folders}
            recentReportIds={recentReportIds}
            currentUserName={activeSecurityPreset.userName}
            security={activeSecurityPreset.context}
            onOpenReport={handleOpenReport}
            onSaveReport={handleSaveReport}
            onDeleteReport={handleDeleteReport}
            onToggleFavorite={handleToggleFavorite}
            onOpenScheduler={(rep) => {
              setPreselectedScheduleReport(rep || null);
              setAutoOpenScheduleModal(Boolean(rep));
              setViewMode('scheduler');
            }}
            onExportReport={handleOpenExportFromHome}
            onSaveFolder={handleSaveFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        )}

        {viewMode === 'viewer' && activeReport && (
          <ReportViewer
            report={activeReport}
            dataset={dataset}
            security={activeSecurityPreset.context}
            onBack={() => setViewMode('home')}
            onEditReport={(rep) => {
              setEditingReport(rep);
              setIsCloneWizard(false);
              setIsWizardOpen(true);
            }}
            onCloneReport={(rep) => {
              setEditingReport(rep);
              setIsCloneWizard(true);
              setIsWizardOpen(true);
            }}
            onScheduleReport={(rep) => {
              setPreselectedScheduleReport(rep);
              setAutoOpenScheduleModal(true);
              setViewMode('scheduler');
            }}
            onOpenExportModal={(rep, result) => {
              setExportModalState({ report: rep, result });
            }}
            onNavigateToRecord={handleNavigateToRecord}
            onOpenWhatsAppChat={handleOpenWhatsAppChat}
            onPinToDashboard={handlePinToDashboard}
          />
        )}

        {viewMode === 'scheduler' && (
          <ReportScheduler
            reports={reports}
            schedules={schedules}
            preselectedReport={preselectedScheduleReport}
            autoOpenModal={autoOpenScheduleModal}
            onBackToReports={() => setViewMode('home')}
            onSaveSchedule={handleSaveSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onToggleScheduleActive={handleToggleScheduleActive}
          />
        )}
      </div>

      {/* 5-Step Report Builder Wizard Modal */}
      {isWizardOpen && (
        <ReportWizard
          isOpen={isWizardOpen}
          initialReport={editingReport}
          isCloneMode={isCloneWizard}
          folders={folders}
          security={activeSecurityPreset.context}
          onClose={() => {
            setIsWizardOpen(false);
            setEditingReport(null);
            setIsCloneWizard(false);
          }}
          onSaveReport={handleSaveReport}
        />
      )}

      {/* Client-Side Export Modal (Excel .xls, CSV UTF-8 BOM, Print PDF) */}
      {exportModalState && (
        <ExportModal
          isOpen={Boolean(exportModalState)}
          report={exportModalState.report}
          executionResult={exportModalState.result}
          onClose={() => setExportModalState(null)}
          onExportComplete={(fmt, fileName) => {
            showToast(`تم تصدير التقرير بصيغة ${fmt.toUpperCase()} (${fileName}) بنجاح`);
          }}
        />
      )}
    </div>
  );
};

export default ReportsModulePage;
