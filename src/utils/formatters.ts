import type {
  CrmModuleKey,
  CrmProfile,
  Deal,
  DealStage,
  FieldAccessLevel,
  Lead,
} from '../types/crm';

export const LEAD_UNIQUE_ID_REGEX = /^RWQ-[0-9]{5}$/;

export const DEAL_STAGES_ORDER: DealStage[] = [
  'تأهيل مبدئي',
  'تحديد الاحتياج',
  'عرض سعر',
  'تفاوض',
  'مكتملة',
  'خسارة',
];

export function formatCurrencySAR(amount: number, currency: 'SAR' | 'USD' | 'AED' = 'SAR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(safeAmount);
  const symbol = currency === 'SAR' ? 'ر.س' : currency === 'AED' ? 'د.إ' : '$';
  return currency === 'USD' ? `$${formattedNumber}` : `${formattedNumber} ${symbol}`;
}

export function formatCompactNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(safe);
}

export function generateLeadUniqueId(existingIds: string[]): string {
  const used = new Set(existingIds);
  let seq = 10429;
  for (const id of existingIds) {
    const match = /^RWQ-(\d{5})$/.exec(id);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed >= seq) {
        seq = parsed + 1;
      }
    }
  }
  while (used.has(`RWQ-${String(seq).padStart(5, '0')}`)) {
    seq += 1;
  }
  return `RWQ-${String(seq).padStart(5, '0')}`;
}

export function isValidLeadUniqueId(id: string): boolean {
  return LEAD_UNIQUE_ID_REGEX.test(id);
}

export interface PipelineSummary {
  openPipelineValue: number;
  weightedPipelineValue: number;
  closedWonValue: number;
  winRatePercent: number;
  openDealsCount: number;
  stageTotals: Array<{
    stage: DealStage;
    count: number;
    amount: number;
  }>;
}

export function calculatePipelineSummary(deals: Deal[]): PipelineSummary {
  let openPipelineValue = 0;
  let weightedPipelineValue = 0;
  let closedWonValue = 0;
  let wonCount = 0;
  let lostCount = 0;
  let openDealsCount = 0;

  const stageMap = new Map<DealStage, { count: number; amount: number }>();
  for (const stage of DEAL_STAGES_ORDER) {
    stageMap.set(stage, { count: 0, amount: 0 });
  }

  for (const deal of deals) {
    const current = stageMap.get(deal.stage) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += deal.amount;
    stageMap.set(deal.stage, current);

    if (deal.stage === 'مكتملة') {
      closedWonValue += deal.amount;
      wonCount += 1;
    } else if (deal.stage === 'خسارة') {
      lostCount += 1;
    } else {
      openPipelineValue += deal.amount;
      weightedPipelineValue += (deal.amount * deal.probability) / 100;
      openDealsCount += 1;
    }
  }

  const closedTotal = wonCount + lostCount;
  const winRatePercent = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

  const stageTotals = DEAL_STAGES_ORDER.map((stage) => {
    const entry = stageMap.get(stage) ?? { count: 0, amount: 0 };
    return { stage, count: entry.count, amount: entry.amount };
  });

  return {
    openPipelineValue,
    weightedPipelineValue: Math.round(weightedPipelineValue),
    closedWonValue,
    winRatePercent,
    openDealsCount,
    stageTotals,
  };
}

export function countQualifiedLeads(leads: Lead[]): number {
  return leads.filter(
    (lead) => lead.status === 'مؤهل للتحويل' || lead.aiScore >= 80
  ).length;
}

export function evaluateFieldAccess(
  profile: CrmProfile | undefined,
  module: CrmModuleKey,
  fieldKey: string
): FieldAccessLevel {
  if (!profile) return 'read_only';
  const modulePerm = profile.modulePermissions?.[module];
  if (!modulePerm || !modulePerm.read) return 'hidden';

  const fls = profile.fieldSecurity?.[module]?.[fieldKey];
  if (fls) return fls;

  return modulePerm.update ? 'read_write' : 'read_only';
}

export function validateQuickDealInput(input: {
  title: string;
  accountId: string;
  amount: number;
  closeDate: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) {
    errors.title = 'يرجى إدخال مسمى الصفقة';
  } else if (input.title.trim().length > 160) {
    errors.title = 'مسمى الصفقة يجب ألا يتجاوز 160 حرفاً';
  }

  if (!input.accountId.trim()) {
    errors.accountId = 'يرجى اختيار الشركة أو الحساب';
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    errors.amount = 'يرجى إدخال قيمة مالية موجبة للصفقة';
  }

  if (!input.closeDate.trim()) {
    errors.closeDate = 'يرجى تحديد تاريخ الإغلاق المتوقع';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
