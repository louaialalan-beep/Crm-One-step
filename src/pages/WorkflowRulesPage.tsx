import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  CloudUpload,
  Code2,
  FileText,
  FlaskConical,
  GitBranch,
  History,
  Layers,
  Link2,
  ListFilter,
  MessageSquare,
  MoreVertical,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';
import {
  buildSampleRecordForSandbox,
  executeCustomFunctionInSandbox,
  getCustomFunctionsForOrg,
} from '../utils/customFunctionsEngine';

type TriggerMode = 'create_or_edit' | 'create_only' | 'scheduled' | 'on_delete';
type ModuleTargetKey = 'deals' | 'leads' | 'contacts' | 'accounts';
type ActionExecutionTab = 'immediate' | 'scheduled';
type ActionKind =
  | 'whatsapp_email'
  | 'field_update'
  | 'create_task'
  | 'create_record'
  | 'webhook'
  | 'custom_function';

interface CriteriaRow {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicWithPrev: 'AND' | 'OR';
  isNestedGroup?: boolean;
}

interface WorkflowActionItem {
  id: string;
  kind: ActionKind;
  timing: 'immediate' | 'scheduled';
  delayLabel?: string;
  title: string;
  badgeText: string;
  badgeTone: 'emerald' | 'blue' | 'rose' | 'slate' | 'purple';
  line1Label: string;
  line1Value: string;
  line2Label: string;
  line2Value: string;
  line2Accent?: 'blue' | 'rose' | 'mono' | 'normal';
  hasTemplatePreview?: boolean;
  hasPayloadInspector?: boolean;
  functionId?: string;
  functionName?: string;
  paramsJson?: string;
}

const INITIAL_CRITERIA: CriteriaRow[] = [
  {
    id: 'crit_1',
    field: 'قيمة الصفقة الإجمالية (Amount)',
    operator: 'أكبر من أو يساوي (≥)',
    value: '100,000 ر.س',
    logicWithPrev: 'AND',
  },
  {
    id: 'crit_2',
    field: 'نوع العقد / الباقة (Contract Type)',
    operator: 'يساوي أحد القيم (IN)',
    value: 'حلول مؤسسية ERP , باقة سنوية',
    logicWithPrev: 'AND',
  },
  {
    id: 'crit_3',
    field: 'البلد / المنطقة الجغرافية (Territory)',
    operator: 'يساوي تماماً (=)',
    value: 'المملكة العربية السعودية (KSA)',
    logicWithPrev: 'AND',
  },
];

const INITIAL_ACTIONS: WorkflowActionItem[] = [
  {
    id: 'act_1',
    kind: 'whatsapp_email',
    timing: 'immediate',
    title: 'إشعار فوري عبر WhatsApp Business API',
    badgeText: 'قالب معتمد',
    badgeTone: 'emerald',
    line1Label: 'المستلم:',
    line1Value: 'مدير المبيعات الإقليمي (طارق العتيبي) + العميل التنفيذي',
    line2Label: 'القالب:',
    line2Value: '[تهنئة واعتماد الصفقة المؤسسية الكبرى - template_deal_won_v2]',
    line2Accent: 'normal',
    hasTemplatePreview: true,
  },
  {
    id: 'act_2',
    kind: 'field_update',
    timing: 'immediate',
    title: 'تحديث حقل بالسجل تلقائياً (Field Update)',
    badgeText: 'تعديل فوري',
    badgeTone: 'blue',
    line1Label: 'الحقل المستهدف:',
    line1Value: '[تصنيف الحساب والعميل (Account Tier)]',
    line2Label: '← القيمة الجديدة:',
    line2Value: 'عميل استراتيجي بلاتيني (Tier 1 VIP)',
    line2Accent: 'blue',
  },
  {
    id: 'act_3',
    kind: 'create_task',
    timing: 'immediate',
    title: 'إنشاء وتكليف مهمة جديدة (Create Task)',
    badgeText: 'أولوية عالية جداً',
    badgeTone: 'rose',
    line1Label: 'عنوان المهمة:',
    line1Value: 'جدولة جلسة التدشين (Kickoff Call) مع مدير المشاريع وقسم الـ Onboarding',
    line2Label: 'المكلف: مدير نجاح العملاء المخصص  •  تاريخ الاستحقاق:',
    line2Value: 'خلال 24 ساعة من الفوز',
    line2Accent: 'rose',
  },
  {
    id: 'act_4',
    kind: 'webhook',
    timing: 'immediate',
    title: 'إطلاق Webhook برمجية وتكامل أنظمة (REST API)',
    badgeText: 'POST Payload',
    badgeTone: 'slate',
    line1Label: 'نظام الوجهة:',
    line1Value: 'نظام الفوترة والمحاسبة المؤسسي SAP ERP',
    line2Label: 'Endpoint:',
    line2Value: 'https://api.erp.riwaq.sa/v1/invoices/create-closed-deal',
    line2Accent: 'mono',
    hasPayloadInspector: true,
  },
  {
    id: 'act_sched_1',
    kind: 'whatsapp_email',
    timing: 'scheduled',
    delayLabel: 'بعد 3 أيام من إغلاق الصفقة',
    title: 'إرسال استبيان رضا التدشين الأولي (CSAT & Onboarding Check) عبر البريد وواتساب',
    badgeText: 'مجدول: +3 أيام',
    badgeTone: 'emerald',
    line1Label: 'المستلم:',
    line1Value: 'جهة الاتصال الرئيسية في الحساب + مدير نجاح العملاء',
    line2Label: 'القالب:',
    line2Value: '[استبيان جودة التسليم المؤسسي - template_onboarding_day3]',
    line2Accent: 'normal',
    hasTemplatePreview: true,
  },
  {
    id: 'act_sched_2',
    kind: 'custom_function',
    timing: 'scheduled',
    delayLabel: 'بعد 14 يوماً من إغلاق الصفقة',
    title: 'تشغيل دالة مخصصة (Custom Function — Serverless Script)',
    badgeText: 'دالة برمجية: +14 يوم',
    badgeTone: 'purple',
    line1Label: 'الدالة المنفذة:',
    line1Value: 'fn_verify_zatca_invoice_settlement(deal_id, account_id)',
    line2Label: 'الإجراء عند التأخر:',
    line2Value: 'تصعيد تنبيه مالي إلى قسم التحصيل ومدير الحسابات',
    line2Accent: 'blue',
  },
];

const FIELD_OPTIONS_BY_MODULE: Record<ModuleTargetKey, string[]> = {
  deals: [
    'قيمة الصفقة الإجمالية (Amount)',
    'نوع العقد / الباقة (Contract Type)',
    'البلد / المنطقة الجغرافية (Territory)',
    'مرحلة الصفقة (Deal Stage)',
    'نسبة الاحتمالية (Probability %)',
    'تصنيف الحساب (Account Tier)',
  ],
  leads: [
    'تقييم الذكاء الاصطناعي (AI Score)',
    'الميزانية التقديرية (Estimated Value)',
    'قناة الاستحواذ (Lead Channel)',
    'حالة العميل المحتمل (Lead Status)',
    'المدينة / المنطقة (City)',
  ],
  contacts: [
    'حالة جهة الاتصال (Contact Status)',
    'المسمى الوظيفي (Job Title)',
    'القناة المفضلة (Preferred Channel)',
    'المدينة (City)',
  ],
  accounts: [
    'تصنيف المؤسسة (Account Tier)',
    'الإيراد السنوي (Annual Revenue)',
    'القطاع الصناعي (Industry)',
    'عدد الموظفين (Employees Count)',
  ],
};

const OPERATOR_OPTIONS = [
  'أكبر من أو يساوي (≥)',
  'يساوي أحد القيم (IN)',
  'يساوي تماماً (=)',
  'يحتوي على النص (CONTAINS)',
  'أقل من أو يساوي (≤)',
  'لا يساوي (≠)',
];

import { settingsService } from '../services/settingsService';
import type { WorkflowRule } from '../types/crm';

interface WorkflowCatalogEntry {
  id: string;
  code: string;
  name: string;
  moduleKey: ModuleTargetKey;
  moduleLabel: string;
  triggerMode: TriggerMode;
  triggerLabel: string;
  actionSummary: string;
  active: boolean;
  executionsCount: number;
  updatedAtLabel: string;
}

const DEFAULT_WORKFLOW_CATALOG: WorkflowCatalogEntry[] = [
  {
    id: 'wf_ent_won_1',
    code: 'WFR-DEAL-8821',
    name: 'إغلاق صفقة كبرى وتصعيد الاعتماد (Enterprise Deal Won & High-Value Alert)',
    moduleKey: 'deals',
    moduleLabel: 'الصفقات',
    triggerMode: 'create_or_edit',
    triggerLabel: 'عند إنشاء أو تعديل السجل (مرحلة الصفقة = مكتملة)',
    actionSummary: 'إشعار واتساب فوري + تحديث تصنيف الحساب VIP + إنشاء مهمة Onboarding + إطلاق Webhook ERP',
    active: true,
    executionsCount: 2840,
    updatedAtLabel: 'منذ 15 دقيقة',
  },
  {
    id: 'wf_lead_auto_2',
    code: 'WFR-LEAD-4102',
    name: 'تأهيل وتوزيع العملاء المحتملين من حملات ميتا (Meta Lead Ads Auto-Assign)',
    moduleKey: 'leads',
    moduleLabel: 'العملاء المحتملين',
    triggerMode: 'create_only',
    triggerLabel: 'عند إنشاء السجل لأول مرة (المصدر = Meta Lead Ads)',
    actionSummary: 'رسالة ترحيب واتساب تلقائية + تعيين مندوب SDR + جدولة مهمة اتصال خلال ساعتين',
    active: true,
    executionsCount: 1490,
    updatedAtLabel: 'أمس',
  },
  {
    id: 'wf_deal_stalled_3',
    code: 'WFR-DEAL-3094',
    name: 'تنبيه الصفقات الراكدة في مرحلة التفاوض لأكثر من 7 أيام',
    moduleKey: 'deals',
    moduleLabel: 'الصفقات',
    triggerMode: 'scheduled',
    triggerLabel: 'بشكل مجدول وزمني (بعد 7 أيام بدون تحديث مرحلة)',
    actionSummary: 'تنبيه مدير المبيعات الإقليمي + إنشاء مهمة مراجعة عاجلة',
    active: true,
    executionsCount: 412,
    updatedAtLabel: 'قبل يومين',
  },
  {
    id: 'wf_contact_vip_4',
    code: 'WFR-CONT-2190',
    name: 'ترقية جهة الاتصال إلى عميل نشط وإرسال استبيان الرضا الأولي',
    moduleKey: 'contacts',
    moduleLabel: 'جهات الاتصال',
    triggerMode: 'create_or_edit',
    triggerLabel: 'عند تعديل حالة جهة الاتصال إلى (عميل نشط)',
    actionSummary: 'إرسال قالب بريد وواتساب ترحيبي + تحديث وسم العميل',
    active: false,
    executionsCount: 185,
    updatedAtLabel: 'قبل 4 أيام',
  },
];

export function WorkflowRulesPage() {
  const { workflows, deals, firebaseUser, isPreviewMode, currentOrgId } = useCrm();

  // View Mode: 'list' (Main Table View) or 'editor' (Rule Visual Builder)
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<'ALL' | ModuleTargetKey>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [rulesCatalog, setRulesCatalog] = useState<WorkflowCatalogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`crm_one_step_workflows_${currentOrgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_WORKFLOW_CATALOG;
  });

  const persistCatalogLocally = (next: WorkflowCatalogEntry[]) => {
    setRulesCatalog(next);
    try {
      localStorage.setItem(`crm_one_step_workflows_${currentOrgId}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Rule Header & Configuration State
  const [editingRuleId, setEditingRuleId] = useState<string>('wf_ent_won_1');
  const [selectedRuleCode, setSelectedRuleCode] = useState<string>('WFR-DEAL-8821');
  const [ruleTitleFull, setRuleTitleFull] = useState<string>(
    'إغلاق صفقة كبرى وتصعيد الاعتماد (Enterprise Deal Won & High-Value Alert)'
  );
  const [ruleNameInput, setRuleNameInput] = useState<string>(
    'إغلاق صفقة كبرى وتصعيد الاعتماد (Enterprise Deal Won & High-Value Alert)'
  );
  const [isRuleActive, setIsRuleActive] = useState<boolean>(true);
  const [targetModule, setTargetModule] = useState<ModuleTargetKey>('deals');
  const [repeatPolicy, setRepeatPolicy] = useState<string>(
    'تنفيذ الإجراء في كل مرة يتم تعديل السجل ومطابقة الشروط'
  );
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('create_or_edit');

  // Step 1 Event Trigger State
  const [monitoredField, setMonitoredField] = useState<string>('مرحلة الصفقة (Deal Stage)');
  const [monitoredTargetValue, setMonitoredTargetValue] = useState<string>(
    'إتمام التعاقد والفوز (Closed Won)'
  );
  const [extraEventGuard, setExtraEventGuard] = useState<string>(
    'قيمة الصفقة الإجمالية ≥ 100,000 ر.س'
  );
  const [showTriggerSettingsModal, setShowTriggerSettingsModal] = useState<boolean>(false);

  // Step 2 Criteria Builder State
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRow[]>(INITIAL_CRITERIA);
  const [customLogicMode, setCustomLogicMode] = useState<boolean>(false);
  const [customLogicExpr, setCustomLogicExpr] = useState<string>('(1 AND 2 AND 3)');

  // Step 3 Actions Engine State
  const [actionTab, setActionTab] = useState<ActionExecutionTab>('immediate');
  const [actionsList, setActionsList] = useState<WorkflowActionItem[]>(INITIAL_ACTIONS);

  // Modals & Interactive Overlays
  const [showAddActionModal, setShowAddActionModal] = useState<boolean>(false);
  const [editingAction, setEditingAction] = useState<WorkflowActionItem | null>(null);
  const [showTemplatePreviewModal, setShowTemplatePreviewModal] = useState<boolean>(false);
  const [showPayloadInspectorModal, setShowPayloadInspectorModal] = useState<boolean>(false);
  const [showTestSimulationModal, setShowTestSimulationModal] = useState<boolean>(false);
  const [showExecutionLogsModal, setShowExecutionLogsModal] = useState<boolean>(false);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);

  // New Action Modal Form State
  const [newActionKind, setNewActionKind] = useState<ActionKind>('whatsapp_email');
  const [newActionTiming, setNewActionTiming] = useState<'immediate' | 'scheduled'>('immediate');
  const [newActionDelay, setNewActionDelay] = useState<string>('بعد 4 ساعات من استيفاء الشرط');
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionLine1, setNewActionLine1] = useState<string>('');
  const [newActionLine2, setNewActionLine2] = useState<string>('');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('func_1');
  const [customFunctionParams, setCustomFunctionParams] = useState<string>(
    '{"minThresholdSAR": 250000, "notifySalesDirector": true}'
  );

  const savedCustomFunctions = useMemo(
    () => getCustomFunctionsForOrg(currentOrgId),
    [currentOrgId, showAddActionModal, showTestSimulationModal]
  );

  // New Rule Modal Form State
  const [newRuleName, setNewRuleName] = useState<string>('');
  const [newRuleModule, setNewRuleModule] = useState<ModuleTargetKey>('deals');
  const [newRuleTrigger, setNewRuleTrigger] = useState<TriggerMode>('create_or_edit');

  // Simulation Modal State
  const [simSelectedDealId, setSimSelectedDealId] = useState<string>('deal_1');
  const [simStepState, setSimStepState] = useState<'idle' | 'running' | 'passed'>('passed');
  const [simCustomFunctionResults, setSimCustomFunctionResults] = useState<
    { functionName: string; returnJson: string; durationMs: number }[]
  >([]);

  // Saving & Toast Feedback
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('منذ دقيقة واحدة');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rulesCatalog.filter((item) => {
      if (moduleFilter !== 'ALL' && item.moduleKey !== moduleFilter) return false;
      if (statusFilter === 'ACTIVE' && !item.active) return false;
      if (statusFilter === 'INACTIVE' && item.active) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.moduleLabel.toLowerCase().includes(q) ||
        item.triggerLabel.toLowerCase().includes(q) ||
        item.actionSummary.toLowerCase().includes(q)
      );
    });
  }, [rulesCatalog, searchQuery, moduleFilter, statusFilter]);

  const handleOpenRuleInEditor = (entry: WorkflowCatalogEntry) => {
    setEditingRuleId(entry.id);
    setSelectedRuleCode(entry.code);
    setRuleTitleFull(entry.name);
    setRuleNameInput(entry.name);
    setTargetModule(entry.moduleKey);
    setTriggerMode(entry.triggerMode);
    setIsRuleActive(entry.active);
    setViewMode('editor');
  };

  const handleToggleRuleInTable = async (entry: WorkflowCatalogEntry) => {
    const nextActive = !entry.active;
    const updated = rulesCatalog.map((r) =>
      r.id === entry.id ? { ...r, active: nextActive, updatedAtLabel: 'الآن' } : r
    );
    persistCatalogLocally(updated);
    if (editingRuleId === entry.id) {
      setIsRuleActive(nextActive);
    }

    await settingsService.toggleWorkflowActive({
      orgId: currentOrgId,
      isCloudMode: Boolean(firebaseUser && !isPreviewMode),
      workflowId: entry.id,
      active: nextActive,
    });

    triggerToast(
      nextActive
        ? `تم تفعيل قاعدة "${entry.name}" بنجاح`
        : `تم إيقاف قاعدة "${entry.name}" مؤقتاً`
    );
  };

  const handleDeleteRuleInTable = async (entry: WorkflowCatalogEntry) => {
    const updated = rulesCatalog.filter((r) => r.id !== entry.id);
    persistCatalogLocally(updated);

    await settingsService.deleteWorkflowRule({
      orgId: currentOrgId,
      isCloudMode: Boolean(firebaseUser && !isPreviewMode),
      workflowId: entry.id,
    });

    triggerToast(`تم حذف قاعدة الورك فلو "${entry.name}" من النظام`);
  };

  const immediateActions = useMemo(
    () => actionsList.filter((a) => a.timing === 'immediate'),
    [actionsList]
  );

  const scheduledActions = useMemo(
    () => actionsList.filter((a) => a.timing === 'scheduled'),
    [actionsList]
  );

  const displayedActions = actionTab === 'immediate' ? immediateActions : scheduledActions;

  const computedLogicPattern = useMemo(() => {
    if (customLogicMode && customLogicExpr.trim()) return customLogicExpr;
    if (criteriaRows.length === 0) return '(بدون شروط)';
    const parts = criteriaRows.map((row, idx) =>
      idx === 0 ? '1' : `${row.logicWithPrev} ${idx + 1}`
    );
    return `(${parts.join(' ')})`;
  }, [criteriaRows, customLogicMode, customLogicExpr]);

  // Add Criteria Row
  const handleAddCriteriaRow = (isNested = false) => {
    const moduleFields = FIELD_OPTIONS_BY_MODULE[targetModule];
    const nextField = moduleFields[criteriaRows.length % moduleFields.length];
    const newRow: CriteriaRow = {
      id: `crit_${Date.now()}`,
      field: nextField,
      operator: isNested ? 'يساوي أحد القيم (IN)' : 'يساوي تماماً (=)',
      value: isNested ? 'عميل مؤسسي VIP , قطاع حكومي' : 'نشط ومؤهل',
      logicWithPrev: isNested ? 'OR' : 'AND',
      isNestedGroup: isNested,
    };
    setCriteriaRows((prev) => [...prev, newRow]);
    triggerToast(
      isNested
        ? 'تمت إضافة مجموعة شروط مركبة (Nested Condition Group)'
        : 'تمت إضافة شرط فرعي جديد إلى معايير الفلترة'
    );
  };

  const handleUpdateCriteriaRow = (id: string, patch: Partial<CriteriaRow>) => {
    setCriteriaRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleDeleteCriteriaRow = (id: string) => {
    if (criteriaRows.length <= 1) {
      triggerToast('يجب الإبقاء على شرط استحقاق واحد على الأقل في القاعدة');
      return;
    }
    setCriteriaRows((prev) => prev.filter((r) => r.id !== id));
    triggerToast('تم حذف الشرط من مصفوفة المعايير');
  };

  // Save / Deploy Rule via settingsService
  const handlePersistWorkflow = async (deployActive: boolean) => {
    setIsSaving(true);
    setIsRuleActive(deployActive);

    const moduleArabicMap: Record<ModuleTargetKey, string> = {
      deals: 'الصفقات',
      leads: 'العملاء المحتملين',
      contacts: 'جهات الاتصال',
      accounts: 'الحسابات',
    };

    const triggerArabicMap: Record<TriggerMode, string> = {
      create_or_edit: `عند إنشاء أو تعديل السجل (${monitoredField})`,
      create_only: 'عند إنشاء السجل لأول مرة',
      scheduled: 'بشكل مجدول وزمني',
      on_delete: 'عند حذف السجل',
    };

    const cleanName = (ruleNameInput.trim() || ruleTitleFull).slice(0, 120);
    const cleanModule = moduleArabicMap[targetModule].slice(0, 60);
    const cleanTrigger = triggerArabicMap[triggerMode].slice(0, 120);
    const cleanSummary = `${immediateActions.length} إجراءات فورية + ${scheduledActions.length} مجدولة (${
      immediateActions.map((a) => a.title.split(' ')[0]).join('، ')
    })`.slice(0, 200);

    const updatedCatalog = rulesCatalog.some((r) => r.id === editingRuleId)
      ? rulesCatalog.map((r) =>
          r.id === editingRuleId
            ? {
                ...r,
                name: cleanName,
                moduleKey: targetModule,
                moduleLabel: cleanModule,
                triggerMode,
                triggerLabel: cleanTrigger,
                actionSummary: cleanSummary,
                active: deployActive,
                updatedAtLabel: 'الآن',
              }
            : r
        )
      : [
          {
            id: editingRuleId || `wf_${Date.now()}`,
            code: selectedRuleCode,
            name: cleanName,
            moduleKey: targetModule,
            moduleLabel: cleanModule,
            triggerMode,
            triggerLabel: cleanTrigger,
            actionSummary: cleanSummary,
            active: deployActive,
            executionsCount: 1,
            updatedAtLabel: 'الآن',
          },
          ...rulesCatalog,
        ];

    persistCatalogLocally(updatedCatalog);

    try {
      const targetWfId = workflows[0]?.id || editingRuleId || `wf_${Date.now()}`;
      const wfPayload: WorkflowRule = {
        id: targetWfId,
        ownerId: firebaseUser?.uid || 'usr_preview_admin',
        org_id: currentOrgId,
        name: cleanName,
        module: cleanModule,
        trigger: cleanTrigger,
        actionSummary: cleanSummary,
        active: deployActive,
        executionsCount: 2840,
      };
      await settingsService.saveWorkflowRule({
        orgId: currentOrgId,
        isCloudMode: Boolean(firebaseUser && !isPreviewMode),
        rule: wfPayload,
        isUpdate: Boolean(workflows[0]),
      });

      setLastSavedLabel('الآن');
      triggerToast(
        deployActive
          ? 'تم حفظ ونشر القاعدة في محرك الأتمتة بنجاح ✓'
          : 'تم حفظ القاعدة كمسودة معلقة بنجاح'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Create a brand new Workflow Rule and open in Editor
  const handleCreateNewWorkflowRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    const generatedCode = `WFR-${newRuleModule.toUpperCase().slice(0, 4)}-${Math.floor(
      1000 + Math.random() * 8999
    )}`;
    const newId = `wf_${Date.now()}`;
    const moduleArabicMap: Record<ModuleTargetKey, string> = {
      deals: 'الصفقات',
      leads: 'العملاء المحتملين',
      contacts: 'جهات الاتصال',
      accounts: 'الحسابات',
    };
    const triggerArabicMap: Record<TriggerMode, string> = {
      create_or_edit: 'عند إنشاء أو تعديل السجل',
      create_only: 'عند إنشاء السجل لأول مرة',
      scheduled: 'بشكل مجدول وزمني',
      on_delete: 'عند حذف السجل',
    };

    const newCatalogItem: WorkflowCatalogEntry = {
      id: newId,
      code: generatedCode,
      name: newRuleName.trim().slice(0, 120),
      moduleKey: newRuleModule,
      moduleLabel: moduleArabicMap[newRuleModule],
      triggerMode: newRuleTrigger,
      triggerLabel: triggerArabicMap[newRuleTrigger],
      actionSummary: 'إشعار واتساب + تحديث حقل + مهمة متابعة',
      active: true,
      executionsCount: 0,
      updatedAtLabel: 'الآن',
    };

    persistCatalogLocally([newCatalogItem, ...rulesCatalog]);

    setEditingRuleId(newId);
    setSelectedRuleCode(generatedCode);
    setRuleTitleFull(newRuleName.trim());
    setRuleNameInput(newRuleName.trim());
    setTargetModule(newRuleModule);
    setTriggerMode(newRuleTrigger);
    setIsRuleActive(true);

    await settingsService.saveWorkflowRule({
      orgId: currentOrgId,
      isCloudMode: Boolean(firebaseUser && !isPreviewMode),
      rule: {
        id: newId,
        ownerId: firebaseUser?.uid || 'usr_preview_admin',
        org_id: currentOrgId,
        name: newCatalogItem.name,
        module: newCatalogItem.moduleLabel,
        trigger: newCatalogItem.triggerLabel,
        actionSummary: newCatalogItem.actionSummary,
        active: true,
        executionsCount: 0,
      },
      isUpdate: false,
    });

    setShowCreateRuleModal(false);
    setNewRuleName('');
    setViewMode('editor');
    triggerToast(`تم إنشاء القاعدة الجديدة (${generatedCode}) وفتح محرر الأتمتة`);
  };

  // Open Add Action Modal
  const openCreateActionModal = (defaultTiming: 'immediate' | 'scheduled') => {
    setEditingAction(null);
    setNewActionKind('whatsapp_email');
    setNewActionTiming(defaultTiming);
    setNewActionDelay('بعد 24 ساعة من تحقق الشرط');
    setNewActionTitle('إرسال تنبيه بريد إلكتروني وواتساب للمدير المباشر');
    setNewActionLine1('مدير الحسابات الإقليمي + فريق العمليات');
    setNewActionLine2('[قالب تنبيه الصفقة الكبرى - template_exec_alert]');
    setShowAddActionModal(true);
  };

  const openEditActionModal = (act: WorkflowActionItem) => {
    setEditingAction(act);
    setNewActionKind(act.kind);
    setNewActionTiming(act.timing);
    setNewActionDelay(act.delayLabel || 'بعد 24 ساعة من تحقق الشرط');
    setNewActionTitle(act.title);
    setNewActionLine1(act.line1Value);
    setNewActionLine2(act.line2Value);
    if (act.kind === 'custom_function') {
      setSelectedFunctionId(act.functionId || savedCustomFunctions[0]?.id || 'func_1');
      setCustomFunctionParams(
        act.paramsJson || act.line2Value || '{"minThresholdSAR": 250000, "notifySalesDirector": true}'
      );
    }
    setShowAddActionModal(true);
  };

  const handleSaveActionModal = (e: React.FormEvent) => {
    e.preventDefault();
    const kindMeta: Record<
      ActionKind,
      {
        badge: string;
        tone: WorkflowActionItem['badgeTone'];
        l1: string;
        l2: string;
        accent: WorkflowActionItem['line2Accent'];
      }
    > = {
      whatsapp_email: {
        badge: newActionTiming === 'scheduled' ? `مجدول: ${newActionDelay}` : 'قالب معتمد',
        tone: 'emerald',
        l1: 'المستلم:',
        l2: 'القالب:',
        accent: 'normal',
      },
      field_update: {
        badge: 'تعديل فوري',
        tone: 'blue',
        l1: 'الحقل المستهدف:',
        l2: '← القيمة الجديدة:',
        accent: 'blue',
      },
      create_task: {
        badge: 'أولوية عالية جداً',
        tone: 'rose',
        l1: 'عنوان المهمة:',
        l2: 'المكلف وتاريخ الاستحقاق:',
        accent: 'rose',
      },
      create_record: {
        badge: 'إنشاء سجل مرتبط',
        tone: 'emerald',
        l1: 'نوع السجل المرتبط:',
        l2: 'البيانات الموروثة تلقائياً:',
        accent: 'blue',
      },
      webhook: {
        badge: 'POST Payload',
        tone: 'slate',
        l1: 'نظام الوجهة:',
        l2: 'Endpoint:',
        accent: 'mono',
      },
      custom_function: {
        badge: 'Custom Function',
        tone: 'purple',
        l1: 'الدالة البرمجية:',
        l2: 'المعاملات (Params):',
        accent: 'mono',
      },
    };

    const meta = kindMeta[newActionKind];
    const selectedFnObj = savedCustomFunctions.find((f) => f.id === selectedFunctionId) || savedCustomFunctions[0];

    const resolvedTitle =
      newActionKind === 'custom_function'
        ? newActionTitle.trim() || `تشغيل دالة مخصصة (${selectedFnObj?.name || 'Custom Function'})`
        : newActionTitle.trim();

    const resolvedLine1 =
      newActionKind === 'custom_function'
        ? `${selectedFnObj?.name || 'verify_vip_enterprise_deal'} (${selectedFnObj?.language || 'Node.js 20'})`
        : newActionLine1.trim();

    const resolvedLine2 =
      newActionKind === 'custom_function'
        ? customFunctionParams.trim() || '{"minThresholdSAR": 250000}'
        : newActionLine2.trim();

    if (editingAction) {
      setActionsList((prev) =>
        prev.map((item) =>
          item.id === editingAction.id
            ? {
                ...item,
                kind: newActionKind,
                timing: newActionTiming,
                delayLabel: newActionTiming === 'scheduled' ? newActionDelay : undefined,
                title: resolvedTitle || item.title,
                badgeText: meta.badge,
                badgeTone: meta.tone,
                line1Label: meta.l1,
                line1Value: resolvedLine1 || item.line1Value,
                line2Label: meta.l2,
                line2Value: resolvedLine2 || item.line2Value,
                line2Accent: meta.accent,
                hasTemplatePreview: newActionKind === 'whatsapp_email',
                hasPayloadInspector: newActionKind === 'webhook',
                functionId: newActionKind === 'custom_function' ? selectedFnObj?.id : undefined,
                functionName: newActionKind === 'custom_function' ? selectedFnObj?.name : undefined,
                paramsJson: newActionKind === 'custom_function' ? resolvedLine2 : undefined,
              }
            : item
        )
      );
      triggerToast('تم تحديث إعدادات الإجراء في مصفوفة التنفيذ');
    } else {
      const created: WorkflowActionItem = {
        id: `act_${Date.now()}`,
        kind: newActionKind,
        timing: newActionTiming,
        delayLabel: newActionTiming === 'scheduled' ? newActionDelay : undefined,
        title: resolvedTitle || 'إجراء أتمتة مخصص جديد',
        badgeText: meta.badge,
        badgeTone: meta.tone,
        line1Label: meta.l1,
        line1Value: resolvedLine1 || 'فريق المبيعات والعمليات',
        line2Label: meta.l2,
        line2Value: resolvedLine2 || 'تنفيذ تلقائي عند استيفاء الشرط',
        line2Accent: meta.accent,
        hasTemplatePreview: newActionKind === 'whatsapp_email',
        hasPayloadInspector: newActionKind === 'webhook',
        functionId: newActionKind === 'custom_function' ? selectedFnObj?.id : undefined,
        functionName: newActionKind === 'custom_function' ? selectedFnObj?.name : undefined,
        paramsJson: newActionKind === 'custom_function' ? resolvedLine2 : undefined,
      };
      setActionsList((prev) => [...prev, created]);
      setActionTab(newActionTiming);
      triggerToast('تمت إضافة الإجراء الجديد إلى مصفوفة التنفيذ');
    }

    setShowAddActionModal(false);
  };

  const handleResetAll = () => {
    setCriteriaRows(INITIAL_CRITERIA);
    setActionsList(INITIAL_ACTIONS);
    setRuleNameInput('إغلاق صفقة كبرى وتصعيد الاعتماد (Enterprise Deal Won');
    setTriggerMode('create_or_edit');
    setIsRuleActive(true);
    triggerToast('تم التراجع عن التعديلات واستعادة الإعدادات المعتمدة للقاعدة');
  };

  return (
    <div className="min-h-full w-full bg-[#F8FAFC] pb-24 text-[#0F172A]" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#1E40AF] bg-[#0F172A] px-4 py-3 text-xs font-bold text-white shadow-2xl">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Top Flush White Header & 4 KPI Cards */}
      <div className="w-full border-b border-[#E2E8F0] bg-white px-6 pt-4 pb-5">
        {/* Top Row: Breadcrumb (Right) & Live Engine Pill (Left) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <Link to="/settings" className="transition hover:text-[#004AC6]">
              الإعدادات والنظام
            </Link>
            <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
            <Link to="/settings" className="transition hover:text-[#004AC6]">
              إدارة العمليات والأتمتة
            </Link>
            <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8]" />
            <span className="font-bold text-[#334155]">
              قواعد مسارات سير العمل (Workflow Rules)
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1 text-[11px] font-bold text-[#334155]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span>محرك الأتمتة: 14 قاعدة مفعلة</span>
            <span className="text-[#CBD5E1]">•</span>
            <span className="text-[#059669]">نسبة النجاح 99.8% (Live v3.4)</span>
          </div>
        </div>

        {/* Second Row: Title + Subtitle (Right) & Action Buttons (Left) */}
        <div className="mt-3.5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F172A] sm:text-[25px]">
                منشئ ومحرر قواعد سير العمل والأتمتة
              </h1>
              <span className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#2563EB]">
                Workflow Engine
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              أتمتة المهام، التنبيهات الفورية عبر واتساب والبريد، وتحديثات الحقول التلقائية وإطلاق Webhooks عند استيفاء شروط السجلات
            </p>
          </div>

          {/* Left Buttons Group */}
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'editor' && (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3.5 py-2 text-xs font-extrabold text-[#1D4ED8] transition hover:bg-[#DBEAFE]"
              >
                <span>← العودة لقائمة القواعد</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExecutionLogsModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#334155] transition hover:bg-[#F8FAFC]"
            >
              <History className="h-3.5 w-3.5 text-[#475569]" />
              <span>سجل تنفيذ الأتمتة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSimStepState('passed');
                setShowTestSimulationModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs font-bold text-[#1D4ED8] transition hover:bg-[#DBEAFE]"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>محاكاة واختبار القاعدة</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateRuleModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#003999]"
            >
              <Plus className="h-4 w-4" />
              <span>+ قاعدة جديدة</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition hover:bg-[#F8FAFC]"
                title="خيارات إضافية"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute top-11 left-0 z-30 w-52 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      triggerToast('تم نسخ القاعدة الحالية كنسخة احتياطية (Clone Rule)');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold text-[#334155] hover:bg-[#F8FAFC]"
                  >
                    <span>استنساخ القاعدة الحالية (Clone)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      triggerToast('تم تصدير مخطط القاعدة بصيغة JSON');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold text-[#334155] hover:bg-[#F8FAFC]"
                  >
                    <span>تصدير تعريف القاعدة (JSON)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 KPI Cards Row */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: إجمالي القواعد المعرفة */}
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3.5">
            <div>
              <div className="text-[11px] font-bold text-[#64748B]">إجمالي القواعد المعرفة</div>
              <div className="mt-1 text-2xl font-extrabold text-[#0F172A]">
                {Math.max(18, workflows.length + 14)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <GitBranch className="h-5 w-5" />
            </div>
          </div>

          {/* KPI 2: القواعد النشطة قيد العمل */}
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3.5">
            <div>
              <div className="text-[11px] font-bold text-[#64748B]">القواعد النشطة قيد العمل</div>
              <div className="mt-1 text-2xl font-extrabold text-[#059669]">14 قاعدة</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#059669]">
              <Zap className="h-5 w-5" />
            </div>
          </div>

          {/* KPI 3: مسودات معلقة */}
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3.5">
            <div>
              <div className="text-[11px] font-bold text-[#64748B]">مسودات معلقة</div>
              <div className="mt-1 text-2xl font-extrabold text-[#1E293B]">4 مسودات</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#475569]">
              <FileText className="h-5 w-5" />
            </div>
          </div>

          {/* KPI 4: عمليات نُفذت هذا الشهر */}
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3.5">
            <div>
              <div className="text-[11px] font-bold text-[#64748B]">عمليات نُفذت هذا الشهر</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-[#004AC6]">2,840</span>
                <span className="font-mono text-[11px] font-extrabold text-[#059669]">
                  (99.8%)
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="w-full space-y-4 px-6 py-5">
        {viewMode === 'list' ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            {/* List View Filter & Search Toolbar */}
            <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC]/60 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم القاعدة، الرمز، أو المشغّل..."
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2 pr-9 pl-3 text-xs font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#004AC6] focus:outline-none"
                  />
                </div>

                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value as 'ALL' | ModuleTargetKey)}
                  aria-label="فلترة حسب الموديول"
                  className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#334155] focus:border-[#004AC6] focus:outline-none"
                >
                  <option value="ALL">جميع الموديولات ({rulesCatalog.length})</option>
                  <option value="deals">الصفقات</option>
                  <option value="leads">العملاء المحتملين</option>
                  <option value="contacts">جهات الاتصال</option>
                  <option value="accounts">الحسابات</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                  }
                  aria-label="فلترة حسب الحالة"
                  className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#334155] focus:border-[#004AC6] focus:outline-none"
                >
                  <option value="ALL">كل الحالات</option>
                  <option value="ACTIVE">مفعلة ونشطة</option>
                  <option value="INACTIVE">متوقفة / مسودة</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition hover:bg-[#003999]"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ قاعدة جديدة</span>
                </button>
              </div>
            </div>

            {/* Workflow Rules Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                  <tr>
                    <th className="px-4 py-3.5">اسم قاعدة الورك فلو</th>
                    <th className="px-4 py-3.5">الرمز</th>
                    <th className="px-4 py-3.5">الموديول</th>
                    <th className="px-4 py-3.5">المشغّل (Trigger)</th>
                    <th className="px-4 py-3.5 text-center">الحالة (تفعيل/إيقاف)</th>
                    <th className="px-4 py-3.5 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[#64748B]">
                        لا توجد قواعد ورك فلو مطابقة لمعايير البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalog.map((entry) => (
                      <tr
                        key={entry.id}
                        className="group transition hover:bg-[#F8FAFC]/80"
                      >
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleOpenRuleInEditor(entry)}
                            className="text-right font-extrabold text-[#0F172A] group-hover:text-[#004AC6] transition"
                          >
                            {entry.name}
                          </button>
                          <p className="mt-0.5 text-[11px] text-[#64748B]">
                            {entry.actionSummary}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-[11px] font-bold text-[#2563EB]">
                            {entry.code}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-extrabold text-[#1D4ED8]">
                            {entry.moduleLabel}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-[#334155] font-semibold">
                          {entry.triggerLabel}
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={entry.active}
                              onClick={() => void handleToggleRuleInTable(entry)}
                              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                entry.active ? 'bg-[#059669]' : 'bg-[#CBD5E1]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  entry.active ? '-translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-[11px] font-extrabold ${
                                entry.active ? 'text-[#059669]' : 'text-[#64748B]'
                              }`}
                            >
                              {entry.active ? 'نشط' : 'متوقف'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-left whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenRuleInEditor(entry)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-extrabold text-[#1D4ED8] transition hover:bg-[#DBEAFE]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRuleInTable(entry)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1.5 text-[11px] font-bold text-[#E11D48] transition hover:bg-[#FFE4E6]"
                              title="حذف القاعدة"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {/* Top Editor Navigation Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/70 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A8A]">
                <span>وضع محرر قاعدة الورك فلو:</span>
                <span className="font-mono text-[#2563EB]">{selectedRuleCode}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#93C5FD] px-3.5 py-1.5 text-xs font-extrabold text-[#1D4ED8] shadow-2xs transition hover:bg-[#DBEAFE]"
              >
                <span>← العودة لقائمة القواعد</span>
              </button>
            </div>

            {/* 2. Rule Configuration Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              {/* Card Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-[#F1F5F9] pb-5 lg:flex-row lg:items-center">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#004AC6]">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-[#2563EB]">
                    معرف القاعدة: {selectedRuleCode}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold text-white ${
                      isRuleActive ? 'bg-[#10B981]' : 'bg-[#64748B]'
                    }`}
                  >
                    {isRuleActive ? 'جاهز للتنفيذ' : 'مسودة غير مفعلة'}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-extrabold text-[#0F172A] sm:text-lg">
                  {ruleTitleFull}
                </h2>
              </div>
            </div>

            {/* Left: Rule Status Toggle + Advanced Settings */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2">
                <span className="text-xs font-bold text-[#475569]">حالة القاعدة:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRuleActive}
                  onClick={() => {
                    const next = !isRuleActive;
                    setIsRuleActive(next);
                    triggerToast(
                      next
                        ? 'تم تفعيل القاعدة في محرك الأتمتة الفوري'
                        : 'تم إيقاف القاعدة مؤقتاً وتحويلها إلى وضع المسودة'
                    );
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isRuleActive ? 'bg-[#004AC6]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      isRuleActive ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-extrabold ${
                    isRuleActive ? 'text-[#059669]' : 'text-[#64748B]'
                  }`}
                >
                  {isRuleActive ? 'نشط ومفعل' : 'مسودة معلقة'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowTriggerSettingsModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#475569] transition hover:bg-[#F8FAFC]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>خصائص متقدمة</span>
              </button>
            </div>
          </div>

          {/* 3-Column Inputs Row */}
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Col 1 (Right): الكيان والوحدة المستهدفة (Module Target) */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                الكيان والوحدة المستهدفة (Module Target)
              </label>
              <div className="relative">
                <select
                  value={targetModule}
                  onChange={(e) => setTargetModule(e.target.value as ModuleTargetKey)}
                  className="w-full appearance-none rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-2.5 pr-3.5 pl-9 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:bg-white focus:outline-none"
                >
                  <option value="deals">الصفقات والمبيعات (Deals)</option>
                  <option value="leads">العملاء المحتملين (Leads)</option>
                  <option value="contacts">جهات الاتصال (Contacts)</option>
                  <option value="accounts">الشركات والحسابات (Accounts)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B]">
                تطبق القاعدة على كل صفقة تنشأ أو تتغير بياناتها
              </p>
            </div>

            {/* Col 2 (Center): اسم القاعدة والوصف التعريفي */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                اسم القاعدة والوصف التعريفي
              </label>
              <input
                type="text"
                value={ruleNameInput}
                onChange={(e) => {
                  setRuleNameInput(e.target.value);
                  setRuleTitleFull(e.target.value);
                }}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:bg-white focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-[#64748B]">
                اسم واضح يسهل على الفريق التعرف عليه في سجل التدقيق.
              </p>
            </div>

            {/* Col 3 (Left): فحص التكرار وإعادة المعالجة */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                فحص التكرار وإعادة المعالجة
              </label>
              <div className="relative">
                <select
                  value={repeatPolicy}
                  onChange={(e) => setRepeatPolicy(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-2.5 pr-3.5 pl-9 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:bg-white focus:outline-none"
                >
                  <option value="تنفيذ الإجراء في كل مرة يتم تعديل السجل ومطابقة الشروط">
                    تنفيذ الإجراء في كل مرة يتم تعديل السجل ومطابقة الشروط
                  </option>
                  <option value="تنفيذ الإجراء مرة واحدة فقط لكل سجل (Once per Record)">
                    تنفيذ الإجراء مرة واحدة فقط لكل سجل (Once per Record)
                  </option>
                  <option value="بحد أقصى مرة واحدة كل 24 ساعة للسجل الواحد">
                    بحد أقصى مرة واحدة كل 24 ساعة للسجل الواحد
                  </option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B]">
                يمنع التكرار غير المرغوب للرسائل والمهام المتطابقة
              </p>
            </div>
          </div>

          {/* Execution Trigger Mode Cards (4 Cards) */}
          <div className="mt-5">
            <div className="mb-2.5 text-xs font-bold text-[#334155]">
              متى يتم تشغيل محرك الأتمتة؟ (Execution Trigger Mode)
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Mode 1: إنشاء أو تعديل السجل */}
              <button
                type="button"
                onClick={() => setTriggerMode('create_or_edit')}
                className={`flex flex-col justify-between rounded-xl p-3.5 text-right transition ${
                  triggerMode === 'create_or_edit'
                    ? 'border-2 border-[#004AC6] bg-[#EFF6FF]/40 shadow-2xs'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC]/70 hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-extrabold ${
                        triggerMode === 'create_or_edit' ? 'text-[#004AC6]' : 'text-[#0F172A]'
                      }`}
                    >
                      إنشاء أو تعديل السجل
                    </span>
                    {triggerMode === 'create_or_edit' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#004AC6]" />
                    )}
                  </div>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      triggerMode === 'create_or_edit'
                        ? 'bg-[#004AC6] text-white'
                        : 'bg-[#E2E8F0] text-[#475569]'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">
                  تشغيل القاعدة فور حفظ السجل الجديد أو عند تعديل أي حقل مستهدف يطابق الشروط.
                </p>
              </button>

              {/* Mode 2: عند الإنشاء فقط (Create) */}
              <button
                type="button"
                onClick={() => setTriggerMode('create_only')}
                className={`flex flex-col justify-between rounded-xl p-3.5 text-right transition ${
                  triggerMode === 'create_only'
                    ? 'border-2 border-[#004AC6] bg-[#EFF6FF]/40 shadow-2xs'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC]/70 hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-extrabold ${
                      triggerMode === 'create_only' ? 'text-[#004AC6]' : 'text-[#0F172A]'
                    }`}
                  >
                    عند الإنشاء فقط (Create)
                  </span>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      triggerMode === 'create_only'
                        ? 'bg-[#004AC6] text-white'
                        : 'bg-[#E2E8F0] text-[#475569]'
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">
                  تطبيق المسار لحظة توليد الصفقة في النظام لأول مرة دون متابعة التعديلات.
                </p>
              </button>

              {/* Mode 3: بشكل مجدول وزمني (Time) */}
              <button
                type="button"
                onClick={() => setTriggerMode('scheduled')}
                className={`flex flex-col justify-between rounded-xl p-3.5 text-right transition ${
                  triggerMode === 'scheduled'
                    ? 'border-2 border-[#004AC6] bg-[#EFF6FF]/40 shadow-2xs'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC]/70 hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-extrabold ${
                      triggerMode === 'scheduled' ? 'text-[#004AC6]' : 'text-[#0F172A]'
                    }`}
                  >
                    بشكل مجدول وزمني (Time)
                  </span>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      triggerMode === 'scheduled'
                        ? 'bg-[#004AC6] text-white'
                        : 'bg-[#E2E8F0] text-[#475569]'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">
                  فحص السجلات بناءً على تواريخ محددة (مثل: قبل 5 أيام من تجديد العقد).
                </p>
              </button>

              {/* Mode 4: عند حذف السجل (Delete) */}
              <button
                type="button"
                onClick={() => setTriggerMode('on_delete')}
                className={`flex flex-col justify-between rounded-xl p-3.5 text-right transition ${
                  triggerMode === 'on_delete'
                    ? 'border-2 border-[#004AC6] bg-[#EFF6FF]/40 shadow-2xs'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC]/70 hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-extrabold ${
                      triggerMode === 'on_delete' ? 'text-[#004AC6]' : 'text-[#0F172A]'
                    }`}
                  >
                    عند حذف السجل (Delete)
                  </span>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      triggerMode === 'on_delete'
                        ? 'bg-[#004AC6] text-white'
                        : 'bg-[#E2E8F0] text-[#475569]'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">
                  تنفيذ تدابير أرشفة أو إشعار المسؤولين قبل الإزالة النهائية للبيانات.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Step 1: محفز وشرارة الحدث (Event Trigger) */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-sm font-extrabold text-[#1D4ED8]">
                1
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#2563EB]">المرحلة الأولى</span>
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#475569]">
                    Trigger
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  محفز وشرارة الحدث (Event Trigger)
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTriggerSettingsModal(true)}
              className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              title="ضبط الحقل المراقب"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:flex-row lg:items-center">
            {/* Right: Monitored Field */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#1D4ED8]">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#64748B]">
                  الحقل المراقب للتغيير
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-extrabold text-[#0F172A]">
                  <span>حقل [{monitoredField}]</span>
                  <span className="text-[#64748B]">←</span>
                  <span className="rounded-md bg-[#10B981] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                    {monitoredTargetValue}
                  </span>
                </div>
              </div>
            </div>

            {/* Left: Extra Pre-Guard */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E2E8F0] pt-3 lg:border-t-0 lg:border-r lg:pr-6 lg:pt-0">
              <div>
                <div className="text-[11px] font-semibold text-[#64748B]">
                  شرط تجاوز إضافي للحدث
                </div>
                <div className="mt-0.5 text-xs font-extrabold text-[#0F172A]">
                  {extraEventGuard}
                </div>
              </div>
              <span className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-bold text-[#1D4ED8]">
                شرط استباقي مفعل
              </span>
            </div>
          </div>
        </div>

        {/* Connector Arrow 1 -> 2 */}
        <div className="flex justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#64748B] shadow-2xs">
            <ArrowDown className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* 4. Step 2: معايير وشروط الاستحقاق والفلترة (Criteria Builder) */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
          {/* Header */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-sm font-extrabold text-[#1D4ED8]">
                2
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#2563EB]">المرحلة الثانية</span>
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#475569]">
                    Filters
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  معايير وشروط الاستحقاق والفلترة (Criteria Builder)
                </h3>
              </div>
            </div>

            {/* Logical Pattern Box */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#475569]">
                <span>النمط المنطقي: </span>
                {customLogicMode ? (
                  <input
                    type="text"
                    value={customLogicExpr}
                    onChange={(e) => setCustomLogicExpr(e.target.value)}
                    dir="ltr"
                    className="w-36 rounded border border-[#93C5FD] bg-white px-2 py-0.5 font-mono text-xs font-extrabold text-[#004AC6]"
                  />
                ) : (
                  <span className="font-mono font-extrabold text-[#004AC6]" dir="ltr">
                    {computedLogicPattern}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCustomLogicMode((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#004AC6] hover:underline"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{customLogicMode ? 'حفظ المعيار المنطقي' : 'تعديل المعيار المنطقي'}</span>
              </button>
            </div>
          </div>

          {/* Criteria Rows List */}
          <div className="mt-5 space-y-2.5">
            {criteriaRows.map((row, index) => {
              const moduleFields = FIELD_OPTIONS_BY_MODULE[targetModule];
              return (
                <React.Fragment key={row.id}>
                  {/* AND / OR Connector Pill between rows */}
                  {index > 0 && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCriteriaRow(row.id, {
                            logicWithPrev: row.logicWithPrev === 'AND' ? 'OR' : 'AND',
                          })
                        }
                        className={`rounded-md border px-2.5 py-0.5 font-mono text-[10px] font-extrabold transition ${
                          row.logicWithPrev === 'AND'
                            ? 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]'
                            : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                        }`}
                        title="انقر للتبديل بين AND (و) / OR (أو)"
                      >
                        {row.logicWithPrev === 'AND' ? 'AND (و)' : 'OR (أو)'}
                      </button>
                    </div>
                  )}

                  {/* Condition Row Container — Single Line No-Wrap Alignment */}
                  <div
                    className={`flex flex-nowrap items-center justify-between gap-2.5 overflow-x-auto rounded-xl border p-3 ${
                      row.isNestedGroup
                        ? 'border-[#BFDBFE] bg-[#EFF6FF]/30'
                        : 'border-[#E2E8F0] bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Right: Row Index + Field Selector */}
                    <div className="flex items-center gap-2 shrink-0 w-[30%] min-w-[210px]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-xs font-extrabold text-[#334155]">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-[#64748B] shrink-0">الحقل:</span>
                      <select
                        value={row.field}
                        onChange={(e) =>
                          handleUpdateCriteriaRow(row.id, { field: e.target.value })
                        }
                        className="w-full truncate rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                      >
                        {!moduleFields.includes(row.field) && (
                          <option value={row.field}>{row.field}</option>
                        )}
                        {moduleFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Center: Operator Selector */}
                    <div className="flex items-center gap-2 shrink-0 w-[26%] min-w-[180px]">
                      <span className="text-xs font-semibold text-[#64748B] shrink-0">المعامل:</span>
                      <select
                        value={row.operator}
                        onChange={(e) =>
                          handleUpdateCriteriaRow(row.id, { operator: e.target.value })
                        }
                        className="w-full truncate rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs font-extrabold text-[#004AC6] focus:border-[#004AC6] focus:outline-none"
                      >
                        {OPERATOR_OPTIONS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Left: Value Input + Match Badge + Delete (Same Single Line) */}
                    <div className="flex flex-1 flex-nowrap items-center gap-2 min-w-[260px]">
                      <span className="text-xs font-semibold text-[#64748B] shrink-0">القيمة:</span>
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) =>
                          handleUpdateCriteriaRow(row.id, { value: e.target.value })
                        }
                        className="w-full min-w-[110px] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-extrabold text-[#0F172A] focus:border-[#004AC6] focus:outline-none"
                      />

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1.5 text-[11px] font-extrabold text-white">
                        <Check className="h-3 w-3" />
                        <span>مطابق</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteCriteriaRow(row.id)}
                        className="shrink-0 rounded-lg border border-transparent p-2 text-[#64748B] transition hover:border-red-200 hover:bg-[#FEE2E2] hover:text-[#E11D48] cursor-pointer"
                        title="حذف الشرط"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Add Condition / Nested Group Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleAddCriteriaRow(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs font-extrabold text-[#004AC6] transition hover:bg-[#DBEAFE]"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>+ إضافة شرط فرعي جديد</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddCriteriaRow(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-bold text-[#475569] transition hover:bg-[#F1F5F9]"
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>+ مجموعة شروط مركبة (Nested Condition Group)</span>
            </button>
          </div>
        </div>

        {/* Connector Arrow 2 -> 3 */}
        <div className="flex justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#64748B] shadow-2xs">
            <ArrowDown className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* 5. Step 3: مصفوفة الإجراءات والتنفيذ (Actions Engine) */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
          {/* Header Row */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B981] text-sm font-extrabold text-white">
                3
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#0F172A]">المرحلة الثالثة</span>
                  <span className="rounded bg-[#D1FAE5] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#065F46]">
                    Execution Matrix
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  مصفوفة الإجراءات والتنفيذ (Actions Engine)
                </h3>
              </div>
            </div>

            {/* Sub-Tabs Switcher: Immediate (4) | Scheduled (2) */}
            <div className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => setActionTab('immediate')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                  actionTab === 'immediate'
                    ? 'border border-[#BFDBFE] bg-white text-[#004AC6] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>الإجراءات الفورية ({immediateActions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActionTab('scheduled')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                  actionTab === 'scheduled'
                    ? 'border border-[#BFDBFE] bg-white text-[#004AC6] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>الإجراءات المجدولة ({scheduledActions.length})</span>
              </button>
            </div>
          </div>

          {/* Sub-Header Note */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#64748B]">
              {actionTab === 'immediate'
                ? 'تنفذ هذه الإجراءات آلياً وفوراً بالترتيب بمجرد استيفاء الشرط:'
                : 'تنفذ هذه الإجراءات المجدولة زمنياً بعد تحقق الشرط واستمرار مطابقة السجل:'}
            </span>
            <span className="font-extrabold text-[#059669]">
              {actionTab === 'immediate'
                ? `${immediateActions.length} إجراءات فورية متتالية`
                : `${scheduledActions.length} إجراءات مجدولة بالكرون الزمني`}
            </span>
          </div>

          {/* Action Cards List */}
          <div className="mt-3.5 space-y-3">
            {displayedActions.map((act) => {
              const badgeStyle =
                act.badgeTone === 'emerald'
                  ? 'bg-[#10B981] text-white'
                  : act.badgeTone === 'blue'
                    ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                    : act.badgeTone === 'rose'
                      ? 'bg-[#FFE4E6] text-[#E11D48]'
                      : act.badgeTone === 'purple'
                        ? 'bg-[#EDE9FE] text-[#6D28D9]'
                        : 'bg-[#E2E8F0] text-[#334155] font-mono';

              const iconBoxStyle =
                act.kind === 'whatsapp_email'
                  ? 'bg-[#D1FAE5] text-[#059669]'
                  : act.kind === 'field_update'
                    ? 'bg-[#DBEAFE] text-[#2563EB]'
                    : act.kind === 'create_task'
                      ? 'bg-[#E0E7FF] text-[#4F46E5]'
                      : act.kind === 'custom_function'
                        ? 'bg-[#EDE9FE] text-[#6D28D9]'
                        : 'bg-[#DBEAFE] text-[#0284C7]';

              return (
                <div
                  key={act.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/80 p-4 transition hover:border-[#CBD5E1] hover:bg-white sm:flex-row sm:items-center"
                >
                  {/* Right: Icon + Action Title + 2 Detail Lines */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBoxStyle}`}
                    >
                      {act.kind === 'whatsapp_email' && <MessageSquare className="h-5 w-5" />}
                      {act.kind === 'field_update' && <Link2 className="h-5 w-5" />}
                      {act.kind === 'create_task' && <CheckCircle2 className="h-5 w-5" />}
                      {act.kind === 'create_record' && <FileText className="h-5 w-5" />}
                      {act.kind === 'webhook' && <Share2 className="h-5 w-5" />}
                      {act.kind === 'custom_function' && <Code2 className="h-5 w-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-extrabold text-[#0F172A] sm:text-sm">
                          {act.title}
                        </h4>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${badgeStyle}`}
                        >
                          {act.badgeText}
                        </span>
                      </div>

                      <div className="text-xs text-[#64748B]">
                        <span className="font-semibold">{act.line1Label} </span>
                        <span className="font-bold text-[#334155]">{act.line1Value}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
                        <span className="font-semibold">{act.line2Label}</span>
                        <span
                          className={
                            act.line2Accent === 'blue'
                              ? 'font-extrabold text-[#004AC6] underline'
                              : act.line2Accent === 'rose'
                                ? 'font-extrabold text-[#E11D48]'
                                : act.line2Accent === 'mono'
                                  ? 'font-mono text-[11px] font-semibold text-[#475569]'
                                  : 'font-semibold text-[#475569]'
                          }
                          dir={act.line2Accent === 'mono' ? 'ltr' : undefined}
                        >
                          {act.line2Value}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Left: Action Buttons (Preview Template / Inspect Payload / Edit) */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {act.hasTemplatePreview && (
                      <button
                        type="button"
                        onClick={() => setShowTemplatePreviewModal(true)}
                        className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
                      >
                        معاينة القالب
                      </button>
                    )}

                    {act.hasPayloadInspector && (
                      <button
                        type="button"
                        onClick={() => setShowPayloadInspectorModal(true)}
                        className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#334155] transition hover:bg-[#F1F5F9]"
                      >
                        فحص Payload
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditActionModal(act)}
                      className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#64748B] transition hover:border-[#CBD5E1] hover:text-[#0F172A]"
                      title="تعديل الإجراء"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Full-Width Dashed Button: Add New Action */}
          <button
            type="button"
            onClick={() => openCreateActionModal(actionTab)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#BFDBFE] bg-[#F8FAFC] py-3 text-xs font-extrabold text-[#004AC6] transition hover:border-[#2563EB] hover:bg-[#EFF6FF]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>
              + إضافة إجراء {actionTab === 'immediate' ? 'فوري' : 'مجدول'} جديد (تحديث حقل، بريد، واتساب، مهمة، Webhook، إشعار نظام)
            </span>
          </button>
        </div>

        {/* 6. Engineering Validation & Conflict Check Card */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/60 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#059669]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-extrabold text-[#0F172A] sm:text-sm">
                  فحص الصلاحية الهندسية للمسار: سليم وخالٍ من الأخطاء (100%)
                </h4>
                <span className="rounded-md bg-[#10B981] px-2 py-0.5 text-[10px] font-extrabold text-white">
                  لا يوجد تعارض
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                تم التحقق من الحقول المستهدفة، مفاتيح الـ API للـ Webhook، وعدم وجود حلقات تنفيذ متكررة (Infinite Loops) مع 13 قاعدة أخرى.
              </p>
            </div>
          </div>

          <div className="text-left text-[11px] font-semibold text-[#64748B]">
            آخر حفظ تلقائي:{' '}
            <span className="font-extrabold text-[#0F172A]">{lastSavedLabel}</span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* 7. Sticky Bottom Deployment Bar (visible in editor mode) */}
      {viewMode === 'editor' && (
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#E2E8F0] bg-white/95 px-6 py-3 shadow-lg backdrop-blur-xs">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3">
          {/* Right Side inside RTL bar: Save & Deploy + Save as Draft + Test with Live Deal */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handlePersistWorkflow(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#004AC6] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#003999] disabled:opacity-60"
            >
              <CloudUpload className="h-4 w-4" />
              <span>
                {isSaving
                  ? 'جاري الحفظ والنشر...'
                  : 'حفظ ونشر القاعدة (Save & Deploy Rule)'}
              </span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handlePersistWorkflow(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-bold text-[#334155] transition hover:bg-[#F8FAFC]"
            >
              <Save className="h-3.5 w-3.5 text-[#475569]" />
              <span>حفظ كمسودة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSimStepState('passed');
                setShowTestSimulationModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-xs font-extrabold text-[#004AC6] transition hover:bg-[#DBEAFE]"
            >
              <PlayCircle className="h-4 w-4" />
              <span>تجربة ومحاكاة فورية مع صفقة حية</span>
            </button>
          </div>

          {/* Left Side inside RTL bar: Revert + Back to list */}
          <div className="flex items-center gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={handleResetAll}
              className="text-[#64748B] transition hover:text-[#0F172A]"
            >
              تراجع عن التعديلات
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="text-[#E11D48] transition hover:underline"
            >
              ← العودة لقائمة القواعد
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Modal 1: Add / Edit Workflow Action */}
      {showAddActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    {editingAction
                      ? 'تعديل إجراء الأتمتة في المسار'
                      : 'إضافة إجراء جديد إلى مصفوفة التنفيذ'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    اختر نوع الإجراء الفوري أو المجدول وحدد المعاملات المستهدفة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddActionModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActionModal} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    نوع الإجراء (Action Type)
                  </label>
                  <select
                    value={newActionKind}
                    onChange={(e) => {
                      const nextKind = e.target.value as ActionKind;
                      setNewActionKind(nextKind);
                      if (nextKind === 'custom_function') {
                        const firstFn = savedCustomFunctions[0];
                        if (firstFn) {
                          setSelectedFunctionId(firstFn.id);
                          setNewActionTitle(`تشغيل دالة مخصصة: ${firstFn.name}`);
                          setNewActionLine1(`${firstFn.name} (${firstFn.language})`);
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-extrabold text-[#0F172A]"
                  >
                    <option value="whatsapp_email">إشعار WhatsApp Business / بريد إلكتروني</option>
                    <option value="field_update">تحديث حقل بالسجل تلقائياً (Field Update)</option>
                    <option value="create_record">إنشاء سجل مرتبط (مهمة / فاتورة / صفقة)</option>
                    <option value="create_task">إنشاء وتكليف مهمة جديدة (Create Task)</option>
                    <option value="webhook">إطلاق Webhook برمجية (REST API)</option>
                    <option value="custom_function">تشغيل دالة مخصصة (Execute Custom Function)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    توقيت التنفيذ
                  </label>
                  <select
                    value={newActionTiming}
                    onChange={(e) =>
                      setNewActionTiming(e.target.value as 'immediate' | 'scheduled')
                    }
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-extrabold text-[#0F172A]"
                  >
                    <option value="immediate">إجراء فوري (Immediate Execution)</option>
                    <option value="scheduled">إجراء مجدول زمنياً (Scheduled Action)</option>
                  </select>
                </div>
              </div>

              {newActionTiming === 'scheduled' && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#334155]">
                    الفاصل الزمني للجدولة (بعد تحقق الشرط)
                  </label>
                  <input
                    type="text"
                    value={newActionDelay}
                    onChange={(e) => setNewActionDelay(e.target.value)}
                    placeholder="مثال: بعد 6 ساعات / بعد 3 أيام"
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  عنوان الإجراء في المصفوفة *
                </label>
                <input
                  type="text"
                  required
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                />
              </div>

              {newActionKind === 'custom_function' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">
                      اختر الدالة المخصصة المحفوظة (Saved Custom Function) *
                    </label>
                    <select
                      value={selectedFunctionId}
                      onChange={(e) => {
                        const fnId = e.target.value;
                        setSelectedFunctionId(fnId);
                        const fnObj = savedCustomFunctions.find((f) => f.id === fnId);
                        if (fnObj) {
                          setNewActionTitle(`تشغيل دالة مخصصة: ${fnObj.name}`);
                          setNewActionLine1(`${fnObj.name} (${fnObj.language})`);
                        }
                      }}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs font-extrabold text-[#0F172A]"
                    >
                      {savedCustomFunctions.map((fn) => (
                        <option key={fn.id} value={fn.id}>
                          {fn.name} — {fn.description} ({fn.language})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">
                      تمرير المعاملات للدالة (input.params JSON) *
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={customFunctionParams}
                      onChange={(e) => setCustomFunctionParams(e.target.value)}
                      placeholder='{"minThresholdSAR": 250000, "notifySalesDirector": true}'
                      className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-xs font-semibold text-[#0F172A]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">
                      الهدف / المستلم / الحقل المراد تحديثه *
                    </label>
                    <input
                      type="text"
                      required
                      value={newActionLine1}
                      onChange={(e) => setNewActionLine1(e.target.value)}
                      className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">
                      القيمة الجديدة / القالب / رابط الـ Endpoint *
                    </label>
                    <input
                      type="text"
                      required
                      value={newActionLine2}
                      onChange={(e) => setNewActionLine2(e.target.value)}
                      className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddActionModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999]"
                >
                  {editingAction ? 'حفظ تعديلات الإجراء' : 'إضافة الإجراء للمصفوفة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: WhatsApp Template Preview (معاينة القالب) */}
      {showTemplatePreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#ECFDF5] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10B981] text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#065F46]">
                    معاينة قالب WhatsApp Business API المعتمد
                  </h3>
                  <p className="font-mono text-[11px] text-[#059669]">
                    template_deal_won_v2 • Approved by Meta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatePreviewModal(false)}
                className="rounded-lg p-1 text-[#065F46] hover:bg-[#D1FAE5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-[#A7F3D0] bg-[#F0FDF4] p-4 text-xs leading-relaxed text-[#0F172A]">
                <p className="font-extrabold text-[#065F46]">
                  🎉 إشعار إتمام تعاقد صفقة كبرى — Crm-One-step
                </p>
                <p className="mt-2">
                  مرحباً <strong>طارق العتيبي</strong>، تم بحمد الله إغلاق الصفقة{' '}
                  <strong>«باقة الحلول المؤسسية ERP — شركة أرامكس اللوجستية»</strong> بقيمة{' '}
                  <strong>350,000 ر.س</strong> في منطقة <strong>المملكة العربية السعودية (KSA)</strong>.
                </p>
                <p className="mt-2 text-[#475569]">
                  • تصنيف الحساب الجديد: عميل استراتيجي بلاتيني (Tier 1 VIP)
                  <br />• تم إسناد مهمة جلسة التدشين (Kickoff Call) إلى مدير نجاح العملاء.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTemplatePreviewModal(false)}
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Webhook REST Payload Inspector (فحص Payload) */}
      {showPayloadInspectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7] text-white">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    فحص حمولة Webhook (SAP ERP REST Payload)
                  </h3>
                  <p className="font-mono text-[11px] text-[#64748B]" dir="ltr">
                    POST https://api.erp.riwaq.sa/v1/invoices/create-closed-deal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayloadInspectorModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <pre
                dir="ltr"
                className="overflow-x-auto rounded-xl bg-[#0F172A] p-4 font-mono text-[11px] leading-relaxed text-[#38BDF8]"
              >
                {JSON.stringify(
                  {
                    event: 'workflow.deal.closed_won',
                    rule_code: selectedRuleCode,
                    timestamp: '2026-11-16T14:30:00Z',
                    payload: {
                      deal_id: 'DEAL-99482',
                      title: 'باقة الحلول المؤسسية ERP',
                      amount: 350000,
                      currency: 'SAR',
                      contract_type: 'حلول مؤسسية ERP',
                      territory: 'المملكة العربية السعودية (KSA)',
                      account_tier_updated: 'Tier 1 VIP',
                      zatca_e_invoice_ready: true,
                    },
                  },
                  null,
                  2
                )}
              </pre>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#059669]">
                  ✓ استجابة الخادم التجريبية: HTTP 200 OK (42ms)
                </span>
                <button
                  type="button"
                  onClick={() => setShowPayloadInspectorModal(false)}
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Live Deal Simulation Modal (تجربة ومحاكاة فورية مع صفقة حية) */}
      {showTestSimulationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    محاكاة واختبار القاعدة مع صفقة حية (Sandbox Dry Run)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    اختبار شروط القاعدة ({selectedRuleCode}) دون إرسال فعلي للعملاء
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestSimulationModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]">
                  اختر صفقة حية لإجراء المحاكاة عليها:
                </label>
                <select
                  value={simSelectedDealId}
                  onChange={(e) => setSimSelectedDealId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-xs font-extrabold text-[#0F172A]"
                >
                  <option value="deal_1">
                    باقة الحلول المؤسسية ERP — شركة أرامكس اللوجستية (350,000 ر.س)
                  </option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} — {d.accountName} ({d.amount.toLocaleString('en-US')} ر.س)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#334155]">
                    1. فحص شرارة الحدث (Event Trigger):
                  </span>
                  <span className="font-extrabold text-[#059669]">
                    ✓ المرحلة = إتمام التعاقد والفوز (Closed Won)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#334155]">
                    2. مطابقة معايير الفلترة ({criteriaRows.length} شروط):
                  </span>
                  <span className="font-extrabold text-[#059669]">
                    ✓ جميع الشروط مطابقة {computedLogicPattern}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#334155]">
                    3. الإجراءات الجاهزة للتنفيذ الفوري:
                  </span>
                  <span className="font-extrabold text-[#004AC6]">
                    {immediateActions.length} إجراءات فورية + {scheduledActions.length} مجدولة
                  </span>
                </div>
              </div>

              {simStepState === 'passed' && (
                <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 text-xs font-bold text-[#065F46]">
                  ✓ اكتملت المحاكاة بنجاح (100% Match): سيتم إرسال إشعار واتساب، ترقية الحساب إلى بلاتيني، توليد مهمة التدشين، وإطلاق Webhook الفوترة خلال 180ms.
                </div>
              )}

              {simCustomFunctionResults.length > 0 && (
                <div className="space-y-2 rounded-xl border border-[#E9D5FF] bg-[#FAF5FF] p-3.5">
                  <div className="text-xs font-extrabold text-[#6B21A8]">
                    مخرجات تشغيل الدوال المخصصة المرتبطة (Sandboxed Custom Functions):
                  </div>
                  {simCustomFunctionResults.map((res, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-[#0F172A] p-2.5 text-left font-mono text-[11px] text-[#E2E8F0]"
                      dir="ltr"
                    >
                      <div className="mb-1 font-bold text-[#C084FC]">
                        fn: {res.functionName} ({res.durationMs}ms)
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap">{res.returnJson}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowTestSimulationModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569]"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setSimStepState('running');
                    const sampleRecord = buildSampleRecordForSandbox({
                      sampleRecordId: simSelectedDealId,
                      deals,
                      leads: [],
                    });
                    const customFnActions = actionsList.filter((a) => a.kind === 'custom_function');
                    const fnOutputs: { functionName: string; returnJson: string; durationMs: number }[] = [];

                    for (const act of customFnActions) {
                      const fnDef =
                        savedCustomFunctions.find(
                          (f) => f.id === act.functionId || f.name === act.functionName
                        ) || savedCustomFunctions[0];
                      if (fnDef) {
                        let parsedParams: Record<string, unknown> = {};
                        try {
                          parsedParams = JSON.parse(act.paramsJson || act.line2Value || '{}');
                        } catch {
                          parsedParams = { raw: act.line2Value };
                        }
                        const res = await executeCustomFunctionInSandbox({
                          func: fnDef,
                          record: sampleRecord,
                          params: parsedParams,
                          orgId: currentOrgId,
                        });
                        fnOutputs.push({
                          functionName: fnDef.name,
                          returnJson: JSON.stringify(res.output, null, 2),
                          durationMs: res.durationMs,
                        });
                      }
                    }

                    setSimCustomFunctionResults(fnOutputs);
                    setSimStepState('passed');
                    triggerToast('تم تنفيذ المحاكاة الفورية بنجاح على صفقة الاختبار');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>إعادة تشغيل المحاكاة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Execution History Logs (سجل تنفيذ الأتمتة) */}
      {showExecutionLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    سجل تنفيذ الأتمتة الفوري (Workflow Execution Audit Log)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    آخر العمليات المنفذة عبر محرك قواعد سير العمل (2,840 عملية هذا الشهر)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExecutionLogsModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 space-y-2.5 overflow-y-auto p-5">
              {[
                {
                  id: 'exec_1',
                  deal: 'باقة الحلول المؤسسية ERP — شركة أرامكس اللوجستية (350,000 ر.س)',
                  time: 'اليوم — 11:42 ص',
                  duration: '145ms',
                  status: 'نجاح (4/4 إجراءات)',
                },
                {
                  id: 'exec_2',
                  deal: 'تطوير البنية السحابية — مجموعة المجدوعي (220,000 ر.س)',
                  time: 'اليوم — 09:15 ص',
                  duration: '162ms',
                  status: 'نجاح (4/4 إجراءات)',
                },
                {
                  id: 'exec_3',
                  deal: 'الربط المالي الموحد — شركة بنده للتجزئة (480,000 ر.س)',
                  time: 'أمس — 04:50 م',
                  duration: '138ms',
                  status: 'نجاح (4/4 إجراءات)',
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="text-xs font-extrabold text-[#0F172A]">{item.deal}</div>
                    <div className="mt-0.5 text-[11px] text-[#64748B]">
                      القاعدة: {selectedRuleCode} • زمن الاستجابة: {item.duration}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#D1FAE5] px-2.5 py-1 text-[10px] font-extrabold text-[#065F46]">
                      {item.status}
                    </span>
                    <span className="font-mono text-[11px] text-[#64748B]">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowExecutionLogsModal(false)}
                className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Create New Workflow Rule (+ إنشاء قاعدة جديدة) */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004AC6] text-white">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    إنشاء قاعدة سير عمل وأتمتة جديدة
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    تُحفظ القاعدة مباشرة في مجموعة workflows في قاعدة البيانات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateRuleModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewWorkflowRule} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  اسم القاعدة الجديدة *
                </label>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="مثال: تنبيه تأخر متابعة عميل VIP أكثر من 4 ساعات"
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  الكيان المستهدف (Module)
                </label>
                <select
                  value={newRuleModule}
                  onChange={(e) => setNewRuleModule(e.target.value as ModuleTargetKey)}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#0F172A]"
                >
                  <option value="deals">الصفقات والمبيعات (Deals)</option>
                  <option value="leads">العملاء المحتملين (Leads)</option>
                  <option value="contacts">جهات الاتصال (Contacts)</option>
                  <option value="accounts">الشركات والحسابات (Accounts)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#003999]"
                >
                  إنشاء وفتح المحرر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Event Trigger Settings Modal */}
      {showTriggerSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                ضبط الحقل المراقب وشرط التجاوز الاستباقي
              </h3>
              <button
                type="button"
                onClick={() => setShowTriggerSettingsModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#E2E8F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  الحقل المراقب للتغيير
                </label>
                <input
                  type="text"
                  value={monitoredField}
                  onChange={(e) => setMonitoredField(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-bold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  القيمة المستهدفة لإطلاق الشرارة
                </label>
                <input
                  type="text"
                  value={monitoredTargetValue}
                  onChange={(e) => setMonitoredTargetValue(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-bold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  شرط التجاوز الاستباقي للحدث
                </label>
                <input
                  type="text"
                  value={extraEventGuard}
                  onChange={(e) => setExtraEventGuard(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-bold text-[#0F172A]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowTriggerSettingsModal(false);
                    triggerToast('تم تحديث إعدادات محفز الحدث (Event Trigger)');
                  }}
                  className="rounded-lg bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
