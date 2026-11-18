import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  Plus,
  GripVertical,
  Type,
  Hash,
  Calendar,
  ListFilter,
  CheckSquare,
  Mail,
  Phone,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Shield,
  Eye,
  Lock,
  Trash2,
  Settings2,
  Save,
  Sparkles,
  Layers,
  CheckCircle2,
  Sliders,
  ArrowUp,
  ArrowDown,
  GitBranch,
  X,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCrm } from '../context/CrmContext';

type ModuleKey = 'leads' | 'contacts' | 'accounts' | 'deals' | 'tasks';

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'picklist'
  | 'multiselect'
  | 'checkbox'
  | 'email'
  | 'phone'
  | 'url'
  | 'lookup'
  | 'formula';

interface CustomFieldItem {
  id: string;
  label: string;
  apiName: string;
  type: FieldType;
  sectionId: string;
  required: boolean;
  unique: boolean;
  encrypted: boolean;
  visibleToProfiles: string[];
  picklistOptions?: string[];
  formulaExpression?: string;
  helpText?: string;
  isSystem?: boolean;
}

interface LayoutSection {
  id: string;
  title: string;
  columns: 1 | 2;
}

interface ConditionalLayoutRule {
  id: string;
  name: string;
  triggerFieldId: string;
  operator: 'equals' | 'not_equals' | 'not_empty';
  triggerValue: string;
  actionType: 'show_field' | 'make_required';
  targetFieldId: string;
  active: boolean;
}

interface ModuleLayoutState {
  sections: LayoutSection[];
  fields: CustomFieldItem[];
  unusedFields: CustomFieldItem[];
  rules: ConditionalLayoutRule[];
}

const MODULE_META: Record<ModuleKey, { label: string; badgeColor: string }> = {
  leads: { label: 'العملاء المحتملين', badgeColor: 'Leads' },
  contacts: { label: 'جهات الاتصال', badgeColor: 'Contacts' },
  accounts: { label: 'الشركات والحسابات', badgeColor: 'Accounts' },
  deals: { label: 'الصفقات والمبيعات', badgeColor: 'Deals' },
  tasks: { label: 'المهام والأنشطة', badgeColor: 'Activities' },
};

const FIELD_PALETTE: { type: FieldType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { type: 'text', label: 'نص قصير (Single Line)', icon: Type },
  { type: 'textarea', label: 'نص متعدد الأسطر', icon: FileText },
  { type: 'number', label: 'رقم قياسي (Number)', icon: Hash },
  { type: 'currency', label: 'عملة مالية (ر.س)', icon: DollarSign },
  { type: 'picklist', label: 'قائمة منسدلة (Picklist)', icon: ListFilter },
  { type: 'multiselect', label: 'اختيار متعدد (Multi-Select)', icon: Layers },
  { type: 'date', label: 'تاريخ / وقت (Date)', icon: Calendar },
  { type: 'checkbox', label: 'خانة اختيار (Boolean)', icon: CheckSquare },
  { type: 'phone', label: 'رقم هاتف / واتساب', icon: Phone },
  { type: 'email', label: 'بريد إلكتروني', icon: Mail },
  { type: 'url', label: 'رابط ويب (URL)', icon: LinkIcon },
  { type: 'formula', label: 'معادلة حسابية (Formula)', icon: Sparkles },
];

const INITIAL_MODULE_LAYOUTS: Record<ModuleKey, ModuleLayoutState> = {
  leads: {
    sections: [
      { id: 'sec_lead_basic', title: 'المعلومات الأساسية للعميل المحتمل', columns: 2 },
      { id: 'sec_lead_qual', title: 'بيانات التأهيل والميزانية التسويقية', columns: 2 },
    ],
    fields: [
      { id: 'lf_1', label: 'الاسم الكامل للعميل', apiName: 'full_name', type: 'text', sectionId: 'sec_lead_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'lf_2', label: 'رقم الجوال (واتساب)', apiName: 'mobile_whatsapp', type: 'phone', sectionId: 'sec_lead_basic', required: true, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'lf_3', label: 'اسم الجهة / الشركة', apiName: 'company_name', type: 'text', sectionId: 'sec_lead_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'lf_4', label: 'السجل التجاري (CR)', apiName: 'commercial_reg_no', type: 'number', sectionId: 'sec_lead_basic', required: false, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
      { id: 'lf_5', label: 'الميزانية التقديرية السنوية (ر.س)', apiName: 'annual_budget_sar', type: 'currency', sectionId: 'sec_lead_qual', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
      { id: 'lf_6', label: 'مصدر الحملة الإعلانية', apiName: 'campaign_source', type: 'picklist', sectionId: 'sec_lead_qual', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], picklistOptions: ['إعلانات Meta', 'Google Ads', 'توصية عميل', 'معرض جايتكس'] },
    ],
    unusedFields: [
      { id: 'lf_u1', label: 'تاريخ انتهاء الرخصة التجارية', apiName: 'license_expiry_date', type: 'date', sectionId: 'sec_lead_basic', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
      { id: 'lf_u2', label: 'عدد الفروع داخل المملكة', apiName: 'ksa_branches_count', type: 'number', sectionId: 'sec_lead_qual', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'] },
    ],
    rules: [
      {
        id: 'rule_lead_1',
        name: 'إلزام السجل التجاري عند اختيار حملة معرض جايتكس',
        triggerFieldId: 'lf_6',
        operator: 'equals',
        triggerValue: 'معرض جايتكس',
        actionType: 'make_required',
        targetFieldId: 'lf_4',
        active: true,
      },
    ],
  },
  contacts: {
    sections: [
      { id: 'sec_con_basic', title: 'بيانات التواصل الشخصية والوظيفية', columns: 2 },
      { id: 'sec_con_pref', title: 'تفضيلات التواصل وصلاحيات القرار', columns: 2 },
    ],
    fields: [
      { id: 'cf_1', label: 'اسم جهة الاتصال', apiName: 'contact_full_name', type: 'text', sectionId: 'sec_con_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'cf_2', label: 'المسمى الوظيفي', apiName: 'job_title', type: 'text', sectionId: 'sec_con_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'] },
      { id: 'cf_3', label: 'البريد الإلكتروني الرسمي', apiName: 'work_email', type: 'email', sectionId: 'sec_con_basic', required: true, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'cf_4', label: 'مستوى صنع القرار', apiName: 'decision_role', type: 'picklist', sectionId: 'sec_con_pref', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'], picklistOptions: ['صانع قرار نهائي (C-Level)', 'مؤثر تقني', 'مدير مشتريات', 'مستخدم نهائي'] },
      { id: 'cf_5', label: 'القناة المفضلة للمتابعة', apiName: 'preferred_channel', type: 'picklist', sectionId: 'sec_con_pref', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], picklistOptions: ['واتساب للأعمال', 'البريد الإلكتروني', 'اتصال هاتفي مباشر'] },
    ],
    unusedFields: [
      { id: 'cf_u1', label: 'حساب LinkedIn الرسمي', apiName: 'linkedin_profile_url', type: 'url', sectionId: 'sec_con_basic', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
    ],
    rules: [],
  },
  accounts: {
    sections: [
      { id: 'sec_acc_basic', title: 'الهوية القانونية والضريبية للمنشأة', columns: 2 },
      { id: 'sec_acc_fin', title: 'التصنيف الائتماني والعنوان الوطني', columns: 2 },
    ],
    fields: [
      { id: 'af_1', label: 'الاسم التجاري للشركة', apiName: 'account_legal_name', type: 'text', sectionId: 'sec_acc_basic', required: true, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'af_2', label: 'الرقم الضريبي (VAT 15 Digits)', apiName: 'zatca_vat_number', type: 'number', sectionId: 'sec_acc_basic', required: true, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
      { id: 'af_3', label: 'القطاع الاقتصادي', apiName: 'industry_sector', type: 'picklist', sectionId: 'sec_acc_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], picklistOptions: ['التقنية والاتصالات', 'الرعاية الصحية', 'العقارات والمقاولات', 'التجزئة والتجارة'] },
      { id: 'af_4', label: 'الحد الائتماني المعتمد (ر.س)', apiName: 'credit_limit_sar', type: 'currency', sectionId: 'sec_acc_fin', required: false, unique: false, encrypted: true, visibleToProfiles: ['مدير النظام'] },
      { id: 'af_5', label: 'العنوان الوطني المختصر', apiName: 'national_short_address', type: 'text', sectionId: 'sec_acc_fin', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'] },
    ],
    unusedFields: [
      { id: 'af_u1', label: 'الموقع الإلكتروني للشركة', apiName: 'website_url', type: 'url', sectionId: 'sec_acc_basic', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'] },
    ],
    rules: [],
  },
  deals: {
    sections: [
      { id: 'sec_deal_basic', title: 'بيانات الفرصة البيعية والمرحلة', columns: 2 },
      { id: 'sec_deal_fin', title: 'التفاصيل المالية والعوائد المتوقعة', columns: 2 },
    ],
    fields: [
      { id: 'df_1', label: 'مسمى الصفقة / المشروع', apiName: 'deal_title', type: 'text', sectionId: 'sec_deal_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'df_2', label: 'تاريخ الإغلاق المتوقع', apiName: 'expected_close_date', type: 'date', sectionId: 'sec_deal_basic', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'df_3', label: 'قيمة العقد الإجمالية (ر.س)', apiName: 'deal_amount_sar', type: 'currency', sectionId: 'sec_deal_fin', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'df_4', label: 'نسبة الخصم الاستثنائي (%)', apiName: 'discount_percent', type: 'number', sectionId: 'sec_deal_fin', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
      { id: 'df_5', label: 'صافي الربح المتوقع (Formula)', apiName: 'expected_net_profit', type: 'formula', sectionId: 'sec_deal_fin', required: false, unique: false, encrypted: true, visibleToProfiles: ['مدير النظام'], formulaExpression: 'AMOUNT * 0.35' },
    ],
    unusedFields: [
      { id: 'df_u1', label: 'رقم منافسة منصة اعتماد', apiName: 'etimad_tender_no', type: 'text', sectionId: 'sec_deal_basic', required: false, unique: true, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات'] },
    ],
    rules: [],
  },
  tasks: {
    sections: [
      { id: 'sec_task_main', title: 'تفاصيل المهمة والجدولة الزمنية', columns: 2 },
    ],
    fields: [
      { id: 'tf_1', label: 'عنوان المهمة', apiName: 'task_subject', type: 'text', sectionId: 'sec_task_main', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'tf_2', label: 'تاريخ الاستحقاق', apiName: 'due_date', type: 'date', sectionId: 'sec_task_main', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], isSystem: true },
      { id: 'tf_3', label: 'درجة الأولوية', apiName: 'priority_level', type: 'picklist', sectionId: 'sec_task_main', required: true, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'], picklistOptions: ['عاجلة جداً', 'مرتفعة', 'متوسطة', 'عادية'] },
      { id: 'tf_4', label: 'ملاحظات المتابعة الميدانية', apiName: 'followup_notes', type: 'textarea', sectionId: 'sec_task_main', required: false, unique: false, encrypted: false, visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'] },
    ],
    unusedFields: [],
    rules: [],
  },
};

export const CustomFieldsBuilderPage: React.FC = () => {
  const { firebaseUser, isPreviewMode, currentOrgId } = useCrm();

  const [layoutsByModule, setLayoutsByModule] = useState<Record<ModuleKey, ModuleLayoutState>>(() => {
    const saved = localStorage.getItem('riwaq_custom_layouts_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_MODULE_LAYOUTS;
  });

  const [selectedModule, setSelectedModule] = useState<ModuleKey>('leads');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('lf_5');
  const [draggedPaletteType, setDraggedPaletteType] = useState<{ type: FieldType; label: string } | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);

  // Modals state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionCols, setNewSectionCols] = useState<1 | 2>(2);

  // Conditional Rule Creator state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTriggerField, setNewRuleTriggerField] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<'show_field' | 'make_required'>('make_required');
  const [newRuleTargetField, setNewRuleTargetField] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const currentLayout = layoutsByModule[selectedModule];
  const selectedField =
    currentLayout.fields.find((f) => f.id === selectedFieldId) || currentLayout.fields[0] || null;

  const updateCurrentModuleLayout = (updater: (prev: ModuleLayoutState) => ModuleLayoutState) => {
    setLayoutsByModule((prev) => ({
      ...prev,
      [selectedModule]: updater(prev[selectedModule]),
    }));
  };

  const handleSelectModule = (mod: ModuleKey) => {
    setSelectedModule(mod);
    const firstField = layoutsByModule[mod].fields[0];
    if (firstField) setSelectedFieldId(firstField.id);
  };

  const addFieldToSection = (type: FieldType, label: string, targetSectionId?: string) => {
    const secId = targetSectionId || currentLayout.sections[0]?.id || 'sec_default';
    const newId = `cf_${selectedModule}_${Date.now()}`;
    const newField: CustomFieldItem = {
      id: newId,
      label: `${label.split('(')[0].trim()} مخصص`,
      apiName: `custom_${type}_${Math.floor(100 + Math.random() * 900)}`,
      type,
      sectionId: secId,
      required: false,
      unique: false,
      encrypted: false,
      visibleToProfiles: ['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات'],
      picklistOptions: type === 'picklist' || type === 'multiselect' ? ['خيار 1', 'خيار 2', 'خيار 3'] : undefined,
      formulaExpression: type === 'formula' ? 'AMOUNT * 0.15' : undefined,
    };

    updateCurrentModuleLayout((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldId(newId);
    showToast(`تمت إضافة حقل "${newField.label}" إلى قسم النموذج`);
  };

  const updateSelectedField = (patch: Partial<CustomFieldItem>) => {
    if (!selectedField) return;
    updateCurrentModuleLayout((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === selectedField.id ? { ...f, ...patch } : f)),
    }));
  };

  const moveFieldOrder = (fieldId: string, dir: -1 | 1) => {
    const field = currentLayout.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const sectionFields = currentLayout.fields.filter((f) => f.sectionId === field.sectionId);
    const idx = sectionFields.findIndex((f) => f.id === fieldId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sectionFields.length) return;

    const swappedId = sectionFields[targetIdx].id;
    const allCopy = [...currentLayout.fields];
    const indexA = allCopy.findIndex((f) => f.id === fieldId);
    const indexB = allCopy.findIndex((f) => f.id === swappedId);
    const temp = allCopy[indexA];
    allCopy[indexA] = allCopy[indexB];
    allCopy[indexB] = temp;

    updateCurrentModuleLayout((prev) => ({
      ...prev,
      fields: allCopy,
    }));
  };

  const removeFieldToUnused = (fieldId: string) => {
    const target = currentLayout.fields.find((f) => f.id === fieldId);
    if (!target || target.isSystem) return;
    updateCurrentModuleLayout((prev) => {
      const remaining = prev.fields.filter((f) => f.id !== fieldId);
      return {
        ...prev,
        fields: remaining,
        unusedFields: [target, ...prev.unusedFields],
      };
    });
    const nextFirst = currentLayout.fields.find((f) => f.id !== fieldId);
    if (nextFirst) setSelectedFieldId(nextFirst.id);
    showToast(`تم نقل "${target.label}" إلى الحقول غير المستخدمة`);
  };

  const restoreUnusedField = (unusedId: string) => {
    const target = currentLayout.unusedFields.find((f) => f.id === unusedId);
    if (!target) return;
    const targetSection = currentLayout.sections[0]?.id || target.sectionId;
    updateCurrentModuleLayout((prev) => ({
      ...prev,
      unusedFields: prev.unusedFields.filter((f) => f.id !== unusedId),
      fields: [...prev.fields, { ...target, sectionId: targetSection }],
    }));
    setSelectedFieldId(target.id);
    showToast(`تمت استعادة الحقل "${target.label}" إلى التخطيط النشط`);
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    const sec: LayoutSection = {
      id: `sec_${selectedModule}_${Date.now()}`,
      title: newSectionTitle.trim(),
      columns: newSectionCols,
    };
    updateCurrentModuleLayout((prev) => ({
      ...prev,
      sections: [...prev.sections, sec],
    }));
    setNewSectionTitle('');
    setShowNewSectionModal(false);
    showToast(`تمت إضافة القسم "${sec.title}" بنجاح`);
  };

  const handleAddConditionalRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const triggerId = newRuleTriggerField || currentLayout.fields[0]?.id || '';
    const targetId = newRuleTargetField || currentLayout.fields[1]?.id || currentLayout.fields[0]?.id || '';
    const rule: ConditionalLayoutRule = {
      id: `lrule_${Date.now()}`,
      name: newRuleName.trim(),
      triggerFieldId: triggerId,
      operator: 'equals',
      triggerValue: newRuleValue.trim() || 'نعم',
      actionType: newRuleAction,
      targetFieldId: targetId,
      active: true,
    };
    updateCurrentModuleLayout((prev) => ({
      ...prev,
      rules: [rule, ...prev.rules],
    }));
    setNewRuleName('');
    setNewRuleValue('');
    showToast('تمت إضافة قاعدة التخطيط الشرطية بنجاح');
  };

  const handleSaveAndPublish = async () => {
    localStorage.setItem('riwaq_custom_layouts_v2', JSON.stringify(layoutsByModule));
    if (firebaseUser && !isPreviewMode) {
      try {
        await setDoc(
          doc(db, 'settings_layouts', `${currentOrgId}_${selectedModule}`),
          {
            orgId: currentOrgId,
            module: selectedModule,
            layout: currentLayout,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    }
    showToast(`تم حفظ ونشر تخطيط «${MODULE_META[selectedModule].label}» (${currentLayout.fields.length} حقل) بنجاح!`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-14">
      {toastMsg && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl bg-[#0F172A] text-white text-xs font-bold border border-[#1E293B]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#475569]"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>الإعدادات</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-lg font-extrabold text-[#0F172A]">
                محرر الحقول المخصصة وتخطيط الصفحات (Module Layout & FLS Builder)
              </h1>
              <span className="bg-blue-50 text-[#2563EB] border border-blue-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                Zoho-Grade Schema Engine
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              اسحب وأفلت الحقول في الأقسام، خصص الصلاحيات على مستوى الحقل (FLS)، وأنشئ قواعد التخطيط الشرطية لكل وحدة مستقلة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>قواعد التخطيط الشرطية ({currentLayout.rules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>معاينة النموذج الحقيقي</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndPublish}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#2563EB] rounded-md hover:bg-[#1D4ED8] shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>حفظ ونشر التخطيط</span>
          </button>
        </div>
      </div>

      {/* Module Selector Bar — Fixed Badge Contrast on Inactive Tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-[#64748B] ml-2">اختر الموديول:</span>
          {(Object.keys(MODULE_META) as ModuleKey[]).map((mod) => {
            const isActive = selectedModule === mod;
            const fieldCount = layoutsByModule[mod].fields.length;
            return (
              <button
                key={mod}
                type="button"
                onClick={() => handleSelectModule(mod)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'bg-[#F8FAFC] text-[#334155] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
                }`}
              >
                <span>{MODULE_META[mod].label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#E2E8F0] text-[#0F172A]'
                  }`}
                >
                  {fieldCount} حقل
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-[#64748B]">
          <span>
            التخطيط النشط: <strong className="text-[#0F172A]">التخطيط المؤسسي الافتراضي (Standard Layout)</strong>
          </span>
          <span className="text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            يدعم السحب والإفلات المباشر
          </span>
        </div>
      </div>

      {/* 3-Pane Workspace */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Pane: Field Types Palette + Unused Fields (3 Cols) */}
        <div className="lg:col-span-3 bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-5">
          <div>
            <h2 className="text-xs font-extrabold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#2563EB]" />
              <span>حقول جديدة جاهزة للسحب أو النقر</span>
            </h2>
            <p className="text-[11px] text-[#64748B] mb-3">
              اسحب نوع الحقل إلى أي قسم في الوسط أو انقر عليه لإضافته مباشرةً
            </p>
            <div className="grid grid-cols-1 gap-2">
              {FIELD_PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedPaletteType({ type: item.type, label: item.label })}
                    onDragEnd={() => setDraggedPaletteType(null)}
                    onClick={() => addFieldToSection(item.type, item.label)}
                    className="flex items-center justify-between p-2.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-blue-50/60 hover:border-blue-300 transition-all text-right group cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded bg-white border border-[#E2E8F0] flex items-center justify-center text-[#475569] group-hover:text-[#2563EB] shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-[#0F172A] truncate">{item.label}</span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2563EB] shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unused Fields Box — Fully Visible & Restorable */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#0F172A]">
                الحقول غير المستخدمة ({currentLayout.unusedFields.length})
              </h3>
              <span className="text-[10px] font-semibold text-[#64748B]">انقر للاستعادة</span>
            </div>

            {currentLayout.unusedFields.length === 0 ? (
              <div className="p-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#64748B] text-center">
                جميع الحقول المعرفة مستخدمة حالياً في التخطيط
              </div>
            ) : (
              <div className="space-y-1.5">
                {currentLayout.unusedFields.map((uf) => (
                  <div
                    key={uf.id}
                    className="p-2.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A] truncate">{uf.label}</p>
                      <p className="text-[10px] font-mono text-[#64748B] truncate">{uf.apiName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreUnusedField(uf.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-[#2563EB] hover:bg-blue-100 text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>إدراج</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Pane: Form Sections Canvas (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {currentLayout.sections.map((section) => {
            const sectionFields = currentLayout.fields.filter((f) => f.sectionId === section.id);
            return (
              <div
                key={section.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedPaletteType) {
                    addFieldToSection(draggedPaletteType.type, draggedPaletteType.label, section.id);
                    setDraggedPaletteType(null);
                  } else if (draggedFieldId) {
                    updateCurrentModuleLayout((prev) => ({
                      ...prev,
                      fields: prev.fields.map((f) =>
                        f.id === draggedFieldId ? { ...f, sectionId: section.id } : f
                      ),
                    }));
                    setDraggedFieldId(null);
                    showToast(`تم نقل الحقل إلى قسم "${section.title}"`);
                  }
                }}
                className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden transition-colors"
              >
                <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-[#94A3B8]" />
                    <h3 className="text-xs font-extrabold text-[#0F172A]">{section.title}</h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-white border border-[#E2E8F0] text-[#64748B]">
                      {sectionFields.length} حقول
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentModuleLayout((prev) => ({
                          ...prev,
                          sections: prev.sections.map((s) =>
                            s.id === section.id ? { ...s, columns: s.columns === 2 ? 1 : 2 } : s
                          ),
                        }))
                      }
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#CBD5E1] text-[#475569] cursor-pointer"
                    >
                      {section.columns === 2 ? 'عمودان (2 Cols)' : 'عمود واحد (1 Col)'}
                    </button>
                  </div>
                </div>

                <div
                  className={`p-4 grid gap-3 ${
                    section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {sectionFields.map((field, idx) => {
                    const isSelected = selectedField?.id === field.id;
                    return (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={() => setDraggedFieldId(field.id)}
                        onDragEnd={() => setDraggedFieldId(null)}
                        onClick={() => setSelectedFieldId(field.id)}
                        className={`p-3 rounded-lg border text-right cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/40 ring-2 ring-blue-500/15'
                            : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 cursor-grab" />
                            <span className="text-xs font-bold text-[#0F172A] truncate">
                              {field.label}
                            </span>
                            {field.required && (
                              <span className="text-red-500 text-xs font-bold">*</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => moveFieldOrder(field.id, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 cursor-pointer"
                              title="تحريك لأعلى"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFieldOrder(field.id, 1)}
                              disabled={idx === sectionFields.length - 1}
                              className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 cursor-pointer"
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            {!field.isSystem && (
                              <button
                                type="button"
                                onClick={() => removeFieldToUnused(field.id)}
                                className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                                title="إزالة إلى الحقول غير المستخدمة"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-[#F1F5F9]">
                          <span className="font-mono text-[#475569]">{field.apiName}</span>
                          <div className="flex items-center gap-1">
                            {field.encrypted && <Lock className="w-3 h-3 text-amber-600" />}
                            <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#334155] font-semibold uppercase">
                              {field.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowNewSectionModal(true)}
            className="w-full py-3 border-2 border-dashed border-[#CBD5E1] rounded-lg text-xs font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] bg-white/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة قسم تخطيط جديد (Add Form Section)</span>
          </button>
        </div>

        {/* Left Pane: Field Properties & FLS Matrix (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-5 sticky top-20">
          {selectedField ? (
            <>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#2563EB]" />
                  <h2 className="text-sm font-extrabold text-[#0F172A]">خصائص الحقل وصلاحيات FLS</h2>
                </div>
                {!selectedField.isSystem ? (
                  <button
                    type="button"
                    onClick={() => removeFieldToUnused(selectedField.id)}
                    className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة</span>
                  </button>
                ) : (
                  <span className="text-[10px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded font-bold">
                    حقل نظام أساسي
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    الاسم الظاهر للحقل (Field Label)
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => updateSelectedField({ label: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white font-bold text-[#0F172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      الاسم البرمجي (API Name)
                    </label>
                    <input
                      type="text"
                      value={selectedField.apiName}
                      disabled={selectedField.isSystem}
                      onChange={(e) => updateSelectedField({ apiName: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono rounded-md border border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">القسم (Section)</label>
                    <select
                      value={selectedField.sectionId}
                      onChange={(e) => updateSelectedField({ sectionId: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      {currentLayout.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedField.type === 'picklist' && (
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      خيارات القائمة المنسدلة (سطر لكل خيار)
                    </label>
                    <textarea
                      rows={3}
                      value={(selectedField.picklistOptions || []).join('\n')}
                      onChange={(e) =>
                        updateSelectedField({
                          picklistOptions: e.target.value.split('\n').filter(Boolean),
                        })
                      }
                      className="w-full p-2.5 text-xs rounded-md border border-[#CBD5E1] bg-white"
                    />
                  </div>
                )}

                {selectedField.type === 'formula' && (
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      المعادلة الحسابية (Formula Expression)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={selectedField.formulaExpression || ''}
                      onChange={(e) => updateSelectedField({ formulaExpression: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono rounded-md border border-purple-300 bg-purple-50/40 text-purple-900"
                    />
                  </div>
                )}

                {/* Validation Checkboxes */}
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <span className="block text-xs font-bold text-[#0F172A]">قواعد التحقق والقيود</span>
                  <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={(e) => updateSelectedField({ required: e.target.checked })}
                      className="rounded text-[#2563EB]"
                    />
                    <span>حقل إلزامي (Required) — يمنع حفظ السجل بدونه</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedField.unique}
                      onChange={(e) => updateSelectedField({ unique: e.target.checked })}
                      className="rounded text-[#2563EB]"
                    />
                    <span>قيمة فريدة (Unique) — منع تكرار السجل في النظام</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedField.encrypted}
                      onChange={(e) => updateSelectedField({ encrypted: e.target.checked })}
                      className="rounded text-[#2563EB]"
                    />
                    <span>تشفير الحقل أمنياً (AES-256 Field Encryption)</span>
                  </label>
                </div>

                {/* FLS Profile Permissions */}
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#0F172A]">
                      صلاحيات الرؤية حسب الملف (Field-Level Security)
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {['مدير النظام', 'مدير مبيعات', 'مندوب مبيعات', 'محاسب مالي'].map((prof) => {
                      const checked = selectedField.visibleToProfiles.includes(prof);
                      return (
                        <label
                          key={prof}
                          className="flex items-center justify-between p-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs cursor-pointer"
                        >
                          <span className="font-semibold text-[#0F172A]">{prof}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedField.visibleToProfiles, prof]
                                : selectedField.visibleToProfiles.filter((p) => p !== prof);
                              updateSelectedField({ visibleToProfiles: next });
                            }}
                            className="rounded text-[#2563EB]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* MODAL 1: Live Form Preview (معاينة النموذج الحقيقي) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  معاينة النموذج الحقيقي — وحدة {MODULE_META[selectedModule].label}
                </h3>
                <p className="text-xs text-[#64748B]">
                  هكذا يظهر النموذج الفعلي لمندوبي المبيعات عند إضافة أو تعديل سجل
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {currentLayout.sections.map((sec) => {
                const secFields = currentLayout.fields.filter((f) => f.sectionId === sec.id);
                return (
                  <div key={sec.id} className="space-y-3">
                    <h4 className="text-xs font-extrabold text-[#2563EB] border-b border-[#E2E8F0] pb-1.5">
                      {sec.title}
                    </h4>
                    <div className={`grid gap-4 ${sec.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {secFields.map((f) => (
                        <div key={f.id}>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">
                            {f.label} {f.required && <span className="text-red-500">*</span>}
                          </label>
                          {f.type === 'picklist' ? (
                            <select className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white">
                              {(f.picklistOptions || ['خيار 1', 'خيار 2']).map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : f.type === 'textarea' ? (
                            <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white" />
                          ) : f.type === 'checkbox' ? (
                            <input type="checkbox" className="rounded text-[#2563EB]" />
                          ) : (
                            <input
                              type={f.type === 'date' ? 'date' : f.type === 'number' || f.type === 'currency' ? 'number' : 'text'}
                              placeholder={`أدخل ${f.label}...`}
                              className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-md border border-[#CBD5E1] bg-white text-xs font-bold text-[#475569] cursor-pointer"
              >
                إغلاق المعاينة
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  void handleSaveAndPublish();
                }}
                className="px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
              >
                اعتماد ونشر هذا النموذج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Conditional Layout Rules (قواعد التخطيط الشرطية) */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  قواعد التخطيط الشرطية (Conditional Layout Rules) — {MODULE_META[selectedModule].label}
                </h3>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleAddConditionalRule} className="p-4 rounded-lg border border-blue-200 bg-blue-50/40 space-y-3">
                <h4 className="text-xs font-extrabold text-[#0F172A]">+ إنشاء قاعدة شرطية جديدة (IF / THEN)</h4>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="وصف القاعدة (مثال: إذا كان المصدر معرض جايتكس ← اجعل السجل التجاري إلزامياً)"
                  className="w-full px-3 py-2 text-xs rounded border border-[#CBD5E1] bg-white"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">إذا كانت قيمة الحقل (IF Field):</label>
                    <select
                      value={newRuleTriggerField}
                      onChange={(e) => setNewRuleTriggerField(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold rounded border border-[#CBD5E1] bg-white"
                    >
                      {currentLayout.fields.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">تساوي القيمة (Equals):</label>
                    <input
                      type="text"
                      value={newRuleValue}
                      onChange={(e) => setNewRuleValue(e.target.value)}
                      placeholder="مثال: شركة كبرى / نعم"
                      className="w-full px-3 py-2 text-xs rounded border border-[#CBD5E1] bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">نفّذ الإجراء (THEN Action):</label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value as any)}
                      className="w-full px-2.5 py-2 text-xs font-bold rounded border border-[#CBD5E1] bg-white"
                    >
                      <option value="make_required">اجعل الحقل إلزامياً (Make Mandatory)</option>
                      <option value="show_field">أظهر الحقل في النموذج (Show Field)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">على الحقل المستهدف (Target Field):</label>
                    <select
                      value={newRuleTargetField}
                      onChange={(e) => setNewRuleTargetField(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold rounded border border-[#CBD5E1] bg-white"
                    >
                      {currentLayout.fields.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="px-4 py-2 rounded bg-[#2563EB] text-white text-xs font-bold cursor-pointer">
                  حفظ وتفعيل القاعدة الشرطية
                </button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-[#0F172A]">القواعد الشرطية النشطة ({currentLayout.rules.length})</h4>
                {currentLayout.rules.length === 0 ? (
                  <p className="text-xs text-[#64748B]">لا توجد قواعد شرطية مضافة لهذا الموديول بعد.</p>
                ) : (
                  currentLayout.rules.map((r) => {
                    const trigLabel = currentLayout.fields.find((f) => f.id === r.triggerFieldId)?.label || 'حقل المصدر';
                    const targLabel = currentLayout.fields.find((f) => f.id === r.targetFieldId)?.label || 'الحقل المستهدف';
                    return (
                      <div key={r.id} className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-[#0F172A]">{r.name}</div>
                          <div className="text-[11px] text-[#475569]">
                            إذا كان <strong>[{trigLabel}]</strong> = <strong>"{r.triggerValue}"</strong> ←{' '}
                            <span className="text-[#2563EB] font-bold">
                              {r.actionType === 'make_required' ? 'اجعل إلزامياً:' : 'أظهر الحقل:'} [{targLabel}]
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateCurrentModuleLayout((prev) => ({
                              ...prev,
                              rules: prev.rules.filter((item) => item.id !== r.id),
                            }))
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-bold cursor-pointer"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add New Section */}
      {showNewSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleAddSection} className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-[#0F172A]">إضافة قسم جديد في تخطيط {MODULE_META[selectedModule].label}</h3>
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">عنوان القسم</label>
              <input
                type="text"
                required
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="مثال: بيانات التسليم والفوترة الضريبية"
                className="w-full px-3 py-2 text-xs rounded border border-[#CBD5E1]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">عدد الأعمدة</label>
              <select
                value={newSectionCols}
                onChange={(e) => setNewSectionCols(Number(e.target.value) as 1 | 2)}
                className="w-full px-3 py-2 text-xs font-bold rounded border border-[#CBD5E1]"
              >
                <option value={2}>عمودان (2 Columns)</option>
                <option value={1}>عمود واحد كامل العرض (1 Column)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNewSectionModal(false)} className="px-4 py-2 rounded border border-[#CBD5E1] text-xs font-bold">
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 rounded bg-[#2563EB] text-white text-xs font-bold">
                إضافة القسم
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
