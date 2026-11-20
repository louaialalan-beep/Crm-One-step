import type {
  Blueprint,
  Contact,
  Deal,
  DealStage,
  Touchpoint,
} from '../types/crm';
import { isMyLead } from './leadsLogic';

export type DealsViewMode = 'kanban' | 'table' | 'chart';

export type DealPipelineKey = 'enterprise' | 'smb' | 'renewals' | 'all';

export interface DealPipelineOption {
  key: DealPipelineKey;
  label: string;
  shortLabel: string;
}

export const DEAL_PIPELINES: readonly DealPipelineOption[] = [
  {
    key: 'enterprise',
    label: 'مسار مبيعات كبار العملاء (Enterprise)',
    shortLabel: 'كبار العملاء',
  },
  {
    key: 'smb',
    label: 'مسار الشركات المتوسطة والصغيرة (SMB)',
    shortLabel: 'الشركات المتوسطة',
  },
  {
    key: 'renewals',
    label: 'مسار تجديد الاشتراكات والتوسع',
    shortLabel: 'التجديد والتوسع',
  },
  {
    key: 'all',
    label: 'جميع مسارات البيع النشطة',
    shortLabel: 'جميع المسارات',
  },
] as const;

export type DealQuickFilterKey = 'all' | 'my_deals' | 'closing_this_month' | 'overdue';

export interface DealKanbanColumnConfig {
  id: 'qualifying' | 'proposal' | 'negotiation' | 'won' | 'lost';
  title: string;
  targetStage: DealStage;
  matchStages: DealStage[];
  probabilityLabel: string;
  defaultProbability: number;
  barColor: string;
  dotColor: string;
}

export const DEAL_KANBAN_COLUMNS: readonly DealKanbanColumnConfig[] = [
  {
    id: 'qualifying',
    title: 'التأهيل المبدئي',
    targetStage: 'تأهيل مبدئي',
    matchStages: ['تأهيل مبدئي', 'تحديد الاحتياج'],
    probabilityLabel: '20% احتمال',
    defaultProbability: 20,
    barColor: 'bg-[#2563EB]',
    dotColor: 'bg-[#2563EB]',
  },
  {
    id: 'proposal',
    title: 'تم تقديم العرض',
    targetStage: 'عرض سعر',
    matchStages: ['عرض سعر'],
    probabilityLabel: '50% احتمال',
    defaultProbability: 50,
    barColor: 'bg-[#3B82F6]',
    dotColor: 'bg-[#3B82F6]',
  },
  {
    id: 'negotiation',
    title: 'التفاوض والعقود',
    targetStage: 'تفاوض',
    matchStages: ['تفاوض'],
    probabilityLabel: '80% احتمال',
    defaultProbability: 80,
    barColor: 'bg-[#2563EB]',
    dotColor: 'bg-[#2563EB]',
  },
  {
    id: 'won',
    title: 'تم الإغلاق بنجاح',
    targetStage: 'مكتملة',
    matchStages: ['مكتملة'],
    probabilityLabel: '100% احتمال',
    defaultProbability: 100,
    barColor: 'bg-[#10B981]',
    dotColor: 'bg-[#10B981]',
  },
  {
    id: 'lost',
    title: 'صفقات خاسرة',
    targetStage: 'خسارة',
    matchStages: ['خسارة'],
    probabilityLabel: '0% احتمال',
    defaultProbability: 0,
    barColor: 'bg-[#F43F5E]',
    dotColor: 'bg-[#F43F5E]',
  },
] as const;

export const DEAL_OWNERS: readonly string[] = [
  'سلمان القحطاني',
  'نورة السبيعي',
  'طارق الدوسري',
] as const;

export interface DealDockedFilterCriteria {
  stages: DealStage[];
  ownerName: string;
  attributionSource: string;
  minAmount: string;
  maxAmount: string;
}

export const DEFAULT_DEAL_DOCKED_FILTER: DealDockedFilterCriteria = {
  stages: [],
  ownerName: 'all',
  attributionSource: 'all',
  minAmount: '',
  maxAmount: '',
};

export function hasActiveDealDockedFilter(criteria: DealDockedFilterCriteria): boolean {
  return (
    criteria.stages.length > 0 ||
    criteria.ownerName !== 'all' ||
    criteria.attributionSource !== 'all' ||
    criteria.minAmount.trim().length > 0 ||
    criteria.maxAmount.trim().length > 0
  );
}

export function getDealColumnForStage(stage: DealStage): DealKanbanColumnConfig {
  return (
    DEAL_KANBAN_COLUMNS.find((col) => col.matchStages.includes(stage)) ??
    DEAL_KANBAN_COLUMNS[0]
  );
}

export function getNextAdvanceStage(stage: DealStage): DealStage | null {
  const currentCol = getDealColumnForStage(stage);
  if (currentCol.id === 'qualifying') return 'عرض سعر';
  if (currentCol.id === 'proposal') return 'تفاوض';
  if (currentCol.id === 'negotiation') return 'مكتملة';
  return null;
}

export function resolveDealContact(deal: Deal, contacts: Contact[]): Contact | null {
  if (deal.contactId) {
    const byId = contacts.find((c) => c.id === deal.contactId);
    if (byId) return byId;
  }
  if (deal.leadUniqueId) {
    const byRwq = contacts.find((c) => c.leadUniqueId === deal.leadUniqueId);
    if (byRwq) return byRwq;
  }
  if (deal.accountId && deal.accountId !== 'unassigned') {
    const byAcc = contacts.find((c) => c.accountId === deal.accountId && c.isPrimary);
    if (byAcc) return byAcc;
  }
  return null;
}

export function resolveDealLastTouchAttribution(
  deal: Deal,
  contacts: Contact[],
  touchpoints: Touchpoint[]
): string {
  const linkedTouchpoints = touchpoints.filter(
    (tp) =>
      (tp.relatedEntityType === 'deal' && tp.relatedEntityId === deal.id) ||
      (deal.contactId && tp.relatedEntityType === 'contact' && tp.relatedEntityId === deal.contactId) ||
      (deal.leadUniqueId && tp.leadUniqueId === deal.leadUniqueId)
  );
  if (linkedTouchpoints.length > 0) {
    const latest = linkedTouchpoints[0];
    if (latest.campaign?.trim()) return latest.campaign.trim();
    if (latest.channel) return latest.channel;
  }
  const contact = resolveDealContact(deal, contacts);
  if (contact?.primarySource?.trim()) return contact.primarySource.trim();
  return 'تواصل مباشر';
}

export function isDealOverdue(deal: Deal, referenceDate = '2026-11-15'): boolean {
  if (deal.stage === 'مكتملة' || deal.stage === 'خسارة') return false;
  if (!deal.closeDate) return false;
  return deal.closeDate < referenceDate;
}

export function isDealClosingThisMonth(deal: Deal, referenceMonth = '2026-11'): boolean {
  if (deal.stage === 'مكتملة' || deal.stage === 'خسارة') return false;
  return Boolean(deal.closeDate && deal.closeDate.startsWith(referenceMonth));
}

export function matchesDealPipeline(deal: Deal, pipeline: DealPipelineKey): boolean {
  if (pipeline === 'all' || pipeline === 'enterprise') {
    // Enterprise shows primary corporate/high-value opportunities plus all active B2B in default view
    if (pipeline === 'all') return true;
    return deal.amount >= 50000 || deal.accountId !== 'unassigned';
  }
  if (pipeline === 'smb') {
    return deal.amount < 300000 || deal.accountId === 'unassigned';
  }
  // renewals
  return (
    deal.title.includes('تجديد') ||
    deal.title.includes('توسعة') ||
    deal.title.includes('إضافة') ||
    deal.title.includes('اشتراك')
  );
}

export function filterDeals(
  deals: Deal[],
  contacts: Contact[],
  touchpoints: Touchpoint[],
  options: {
    pipeline: DealPipelineKey;
    quickFilter: DealQuickFilterKey;
    currentUserName: string;
    searchQuery: string;
    dockedFilter: DealDockedFilterCriteria;
    referenceDate?: string;
    referenceMonth?: string;
  }
): Deal[] {
  const {
    pipeline,
    quickFilter,
    currentUserName,
    searchQuery,
    dockedFilter,
    referenceDate = '2026-11-15',
    referenceMonth = '2026-11',
  } = options;

  const query = searchQuery.trim().toLowerCase();

  return deals.filter((deal) => {
    if (!matchesDealPipeline(deal, pipeline)) return false;

    if (quickFilter === 'my_deals' && !isMyLead(deal.ownerName, currentUserName)) {
      return false;
    }
    if (
      quickFilter === 'closing_this_month' &&
      !isDealClosingThisMonth(deal, referenceMonth)
    ) {
      return false;
    }
    if (quickFilter === 'overdue' && !isDealOverdue(deal, referenceDate)) {
      return false;
    }

    const contact = resolveDealContact(deal, contacts);
    const attribution = resolveDealLastTouchAttribution(deal, contacts, touchpoints);

    if (query) {
      const haystack = [
        deal.title,
        deal.accountName,
        deal.ownerName,
        deal.leadUniqueId ?? '',
        deal.nextStep ?? '',
        contact?.fullName ?? '',
        attribution,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (dockedFilter.stages.length > 0 && !dockedFilter.stages.includes(deal.stage)) {
      return false;
    }
    if (dockedFilter.ownerName !== 'all' && deal.ownerName !== dockedFilter.ownerName) {
      return false;
    }
    if (
      dockedFilter.attributionSource !== 'all' &&
      attribution !== dockedFilter.attributionSource
    ) {
      return false;
    }
    const minVal = Number(dockedFilter.minAmount);
    if (dockedFilter.minAmount.trim() && Number.isFinite(minVal) && deal.amount < minVal) {
      return false;
    }
    const maxVal = Number(dockedFilter.maxAmount);
    if (dockedFilter.maxAmount.trim() && Number.isFinite(maxVal) && deal.amount > maxVal) {
      return false;
    }

    return true;
  });
}

export interface BlueprintAfterActionSummary {
  id: string;
  type: 'field_update' | 'whatsapp_email' | 'create_task' | 'webhook' | 'custom_function';
  label: string;
  targetDetail: string;
  functionId?: string;
  functionName?: string;
  paramsJson?: string;
}

export interface BlueprintTransitionRequirement {
  requiresModal: boolean;
  blueprintName: string;
  targetStage: DealStage;
  targetTitle: string;
  requireFinalAmount: boolean;
  requireDiscountPercent: boolean;
  requireContractPdf: boolean;
  requireLossReason: boolean;
  requireNextStep: boolean;
  checklistItems: string[];
  beforeError?: string | null;
  afterActions?: BlueprintAfterActionSummary[];
}

interface StoredBlueprintDefinitionShape {
  id: string;
  name: string;
  module: string;
  active: boolean;
  stages?: Array<{ id: string; title: string; category?: string }>;
  transitions?: Array<{
    id: string;
    name: string;
    fromStageId: string;
    toStageId: string;
    enabled: boolean;
    roles?: string[];
    beforeConditions?: Array<{
      id: string;
      fieldLabel: string;
      operatorLabel: string;
      valueLabel: string;
      enabled: boolean;
    }>;
    mandatoryFields?: Array<{
      id: string;
      fieldName: string;
      fieldType: string;
      required: boolean;
    }>;
    requireNotes?: boolean;
    requireAttachment?: boolean;
    checklist?: Array<{ id: string; title: string; required: boolean }>;
    afterActions?: Array<{
      id: string;
      type: BlueprintAfterActionSummary['type'];
      label: string;
      targetDetail: string;
      enabled: boolean;
      functionId?: string;
      functionName?: string;
      paramsJson?: string;
    }>;
  }>;
}

function readSavedDealsBlueprintFromStorage(orgId?: string): StoredBlueprintDefinitionShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const keysToTry = orgId
      ? [`crm_enterprise_blueprints_v1_${orgId}`, 'crm_enterprise_blueprints_v1_org_riwaq_default']
      : ['crm_enterprise_blueprints_v1_org_riwaq_default'];
    for (const k of keysToTry) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const found = parsed.find(
          (b: StoredBlueprintDefinitionShape) =>
            b.active &&
            (b.module === 'الصفقات والمبيعات' ||
              b.module?.toLowerCase().includes('deal') ||
              b.name?.includes('صفقات'))
        );
        if (found) return found;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function getBlueprintTransitionRequirements(
  blueprints: Blueprint[],
  targetStage: DealStage,
  options?: { orgId?: string; deal?: Deal }
): BlueprintTransitionRequirement {
  const activeDealsBp = blueprints.find(
    (bp) =>
      bp.active &&
      (bp.module === 'الصفقات والمبيعات' ||
        bp.module.toLowerCase() === 'deals' ||
        bp.name.includes('صفقات'))
  );

  const savedVisualBp = readSavedDealsBlueprintFromStorage(options?.orgId || options?.deal?.org_id);
  const targetCol = getDealColumnForStage(targetStage);
  const bpName =
    savedVisualBp?.name ?? activeDealsBp?.name ?? 'مخطط إغلاق صفقات المؤسسات الكبرى';
  const dynamicRule = activeDealsBp?.stageRequirements?.[targetStage];

  // Extract matching visual transition from BlueprintBuilderPage if present
  let matchedAfterActions: BlueprintAfterActionSummary[] = [];
  let savedChecklist: string[] = [];
  let beforeError: string | null = null;

  if (savedVisualBp?.transitions && savedVisualBp.stages) {
    const targetCategory =
      targetStage === 'مكتملة' ? 'won' : targetStage === 'خسارة' ? 'lost' : 'normal';
    const matchedStageNode = savedVisualBp.stages.find(
      (s) =>
        s.title.includes(targetStage) ||
        (targetCategory === 'won' && (s.category === 'won' || s.title.includes('فوز') || s.title.includes('Won'))) ||
        (targetCategory === 'lost' && (s.category === 'lost' || s.title.includes('خاسر') || s.title.includes('Lost'))) ||
        (targetStage === 'عرض سعر' && s.title.includes('عرض السعر')) ||
        (targetStage === 'تفاوض' && s.title.includes('مفاوضات'))
    );
    if (matchedStageNode) {
      const tr = savedVisualBp.transitions.find(
        (t) => t.enabled && t.toStageId === matchedStageNode.id
      );
      if (tr) {
        matchedAfterActions = (tr.afterActions || [])
          .filter((a) => a.enabled)
          .map((a) => ({
            id: a.id,
            type: a.type,
            label: a.label,
            targetDetail: a.targetDetail,
            functionId: a.functionId,
            functionName: a.functionName,
            paramsJson: a.paramsJson,
          }));
        savedChecklist = (tr.checklist || []).filter((c) => c.required).map((c) => c.title);

        if (options?.deal && tr.beforeConditions) {
          for (const cond of tr.beforeConditions.filter((c) => c.enabled)) {
            if (
              (cond.fieldLabel.includes('القيمة') || cond.fieldLabel.includes('الميزانية')) &&
              cond.operatorLabel.includes('أكبر')
            ) {
              const numVal = Number(cond.valueLabel.replace(/[^0-9.]/g, ''));
              if (Number.isFinite(numVal) && numVal > 0 && options.deal.amount < numVal) {
                beforeError = `شرط البلوبرينت (Before): يجب أن تكون قيمة الصفقة أكبر من ${numVal.toLocaleString('en-US')} ر.س قبل الانتقال.`;
              }
            }
          }
        }
      }
    }
  }

  if (dynamicRule) {
    return {
      requiresModal: true,
      blueprintName: bpName,
      targetStage,
      targetTitle: targetCol.title,
      requireFinalAmount: dynamicRule.requireFinalAmount ?? true,
      requireDiscountPercent: dynamicRule.requireDiscountPercent ?? true,
      requireContractPdf: dynamicRule.requireContractPdf ?? false,
      requireLossReason: dynamicRule.requireLossReason ?? (targetStage === 'خسارة'),
      requireNextStep: dynamicRule.requireNextStep ?? false,
      checklistItems:
        savedChecklist.length > 0
          ? savedChecklist
          : dynamicRule.checklistItems && dynamicRule.checklistItems.length > 0
          ? dynamicRule.checklistItems
          : [
              'تم تأكيد واعتماد شروط الدفع وجدولة الدفعات الرسمية',
              'تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل',
            ],
      beforeError,
      afterActions: matchedAfterActions,
    };
  }

  if (targetStage === 'مكتملة') {
    return {
      requiresModal: Boolean(activeDealsBp ?? true),
      blueprintName: bpName,
      targetStage,
      targetTitle: targetCol.title,
      requireFinalAmount: true,
      requireDiscountPercent: true,
      requireContractPdf: true,
      requireLossReason: false,
      requireNextStep: false,
      checklistItems:
        savedChecklist.length > 0
          ? savedChecklist
          : activeDealsBp?.description
          ? [
              activeDealsBp.description,
              'تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل',
            ]
          : [
              'تم تأكيد واعتماد شروط الدفع وجدولة الدفعات الرسمية',
              'تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل',
            ],
      beforeError,
      afterActions: matchedAfterActions,
    };
  }

  if (targetStage === 'تفاوض' || targetStage === 'عرض سعر') {
    return {
      requiresModal: Boolean(activeDealsBp ?? true),
      blueprintName: bpName,
      targetStage,
      targetTitle: targetCol.title,
      requireFinalAmount: true,
      requireDiscountPercent: true,
      requireContractPdf: true,
      requireLossReason: false,
      requireNextStep: true,
      checklistItems:
        savedChecklist.length > 0
          ? savedChecklist
          : activeDealsBp?.description
          ? [
              activeDealsBp.description,
              'تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل',
            ]
          : [
              'تم تأكيد واعتماد شروط الدفع وجدولة الدفعات الرسمية',
              'تم مطابقة الفاتورة الضريبية وإصدار أمر الشراء (PO) من العميل',
            ],
      beforeError,
      afterActions: matchedAfterActions,
    };
  }

  if (targetStage === 'خسارة') {
    return {
      requiresModal: Boolean(activeDealsBp ?? true),
      blueprintName: bpName,
      targetStage,
      targetTitle: targetCol.title,
      requireFinalAmount: false,
      requireDiscountPercent: false,
      requireContractPdf: false,
      requireLossReason: true,
      requireNextStep: false,
      checklistItems: [],
      beforeError,
      afterActions: matchedAfterActions,
    };
  }

  return {
    requiresModal: false,
    blueprintName: bpName,
    targetStage,
    targetTitle: targetCol.title,
    requireFinalAmount: false,
    requireDiscountPercent: false,
    requireContractPdf: false,
    requireLossReason: false,
    requireNextStep: false,
    checklistItems: [],
    beforeError,
    afterActions: matchedAfterActions,
  };
}

export interface DealPipelineMetrics {
  totalDealsCount: number;
  activeDealsCount: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  weightedRatioPercent: number;
}

export function computeDealPipelineMetrics(deals: Deal[]): DealPipelineMetrics {
  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  let activeDealsCount = 0;

  for (const deal of deals) {
    const col = getDealColumnForStage(deal.stage);
    const stageProbability = col.defaultProbability;
    if (deal.stage !== 'خسارة') {
      totalPipelineValue += deal.amount;
      weightedPipelineValue += (deal.amount * stageProbability) / 100;
    }
    if (deal.stage !== 'مكتملة' && deal.stage !== 'خسارة') {
      activeDealsCount += 1;
    }
  }

  const roundedWeighted = Math.round(weightedPipelineValue);
  const weightedRatioPercent =
    totalPipelineValue > 0 ? Math.round((roundedWeighted / totalPipelineValue) * 100) : 0;

  return {
    totalDealsCount: deals.length,
    activeDealsCount,
    totalPipelineValue,
    weightedPipelineValue: roundedWeighted,
    weightedRatioPercent,
  };
}

export type DealChartGroupBy = 'stage' | 'ownerName' | 'attribution' | 'accountName';
export type DealChartMeasure = 'amount' | 'weighted' | 'count';
export type DealChartType = 'bar' | 'horizontal' | 'pie' | 'donut';

export interface DealChartBucket {
  key: string;
  label: string;
  value: number;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  dealIds: string[];
}

export function aggregateDealsForChart(
  deals: Deal[],
  contacts: Contact[],
  touchpoints: Touchpoint[],
  groupBy: DealChartGroupBy,
  measure: DealChartMeasure
): DealChartBucket[] {
  const map = new Map<
    string,
    { label: string; totalAmount: number; weightedAmount: number; dealIds: string[] }
  >();

  for (const deal of deals) {
    const col = getDealColumnForStage(deal.stage);
    const stageProbability = col.defaultProbability;
    let key = '';
    let label = '';
    if (groupBy === 'stage') {
      key = col.id;
      label = col.title;
    } else if (groupBy === 'ownerName') {
      key = deal.ownerName || 'غير معين';
      label = key;
    } else if (groupBy === 'attribution') {
      key = resolveDealLastTouchAttribution(deal, contacts, touchpoints);
      label = key;
    } else {
      key = deal.accountName || 'غير محدد';
      label = key;
    }

    const entry = map.get(key) ?? {
      label,
      totalAmount: 0,
      weightedAmount: 0,
      dealIds: [],
    };
    entry.dealIds.push(deal.id);
    entry.totalAmount += deal.amount;
    entry.weightedAmount += Math.round((deal.amount * stageProbability) / 100);
    map.set(key, entry);
  }

  const buckets: DealChartBucket[] = Array.from(map.entries()).map(([key, entry]) => {
    const count = entry.dealIds.length;
    const value =
      measure === 'amount'
        ? entry.totalAmount
        : measure === 'weighted'
        ? entry.weightedAmount
        : count;
    return {
      key,
      label: entry.label,
      value,
      count,
      totalAmount: entry.totalAmount,
      weightedAmount: entry.weightedAmount,
      dealIds: entry.dealIds,
    };
  });

  if (groupBy === 'stage') {
    const order = DEAL_KANBAN_COLUMNS.map((c) => c.id as string);
    buckets.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  } else {
    buckets.sort((a, b) => b.value - a.value);
  }

  return buckets;
}
