import type {
  CrmModuleKey,
  CrmProfile,
  Deal,
  DealStage,
  FieldAccessLevel,
  Lead,
  OrganizationCurrency,
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

const KNOWN_CURRENCY_SYMBOLS: Record<string, { symbol: string; position: 'prefix' | 'suffix' }> = {
  SAR: { symbol: 'ر.س', position: 'suffix' },
  USD: { symbol: '$', position: 'prefix' },
  AED: { symbol: 'د.إ', position: 'suffix' },
  EUR: { symbol: '€', position: 'prefix' },
  GBP: { symbol: '£', position: 'prefix' },
  KWD: { symbol: 'د.ك', position: 'suffix' },
  BHD: { symbol: 'د.ب', position: 'suffix' },
  OMR: { symbol: 'ر.ع', position: 'suffix' },
  QAR: { symbol: 'ر.ق', position: 'suffix' },
  EGP: { symbol: 'ج.م', position: 'suffix' },
  TRY: { symbol: '₺', position: 'prefix' },
  CHF: { symbol: 'CHF', position: 'suffix' },
  CNY: { symbol: '¥', position: 'prefix' },
};

export function formatCurrencySAR(
  amount: number,
  currency: string = 'SAR',
  customSymbol?: string,
  symbolPosition?: 'prefix' | 'suffix',
  decimals?: number
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'SAR').toUpperCase();
  const hasFraction = Math.abs(safeAmount % 1) > 0.001;
  const maxDigits = decimals !== undefined ? decimals : hasFraction ? 2 : 0;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasFraction ? Math.min(2, maxDigits) : 0,
    maximumFractionDigits: maxDigits,
  }).format(safeAmount);

  const known = KNOWN_CURRENCY_SYMBOLS[code];
  const symbol = customSymbol || known?.symbol || code;
  const pos = symbolPosition || known?.position || (symbol.length === 1 && !/[ء-ي]/.test(symbol) ? 'prefix' : 'suffix');

  return pos === 'prefix' ? `${symbol}${formattedNumber}` : `${formattedNumber} ${symbol}`;
}

export function formatCurrencyByConfig(
  amount: number,
  currencyCode: string | undefined,
  currencies: OrganizationCurrency[],
  baseCurrency?: OrganizationCurrency
): string {
  const targetCode = (currencyCode || baseCurrency?.code || 'SAR').toUpperCase();
  const match = currencies.find((c) => c.code.toUpperCase() === targetCode);
  if (match) {
    return formatCurrencySAR(
      amount,
      match.code,
      match.symbol,
      match.symbolPosition,
      match.decimals
    );
  }
  return formatCurrencySAR(amount, targetCode);
}

export function convertAmountBetweenCurrencies(
  amount: number,
  fromCode: string,
  toCode: string,
  currencies: OrganizationCurrency[],
  explicitFromRateToBase?: number
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const cleanFrom = (fromCode || 'SAR').toUpperCase();
  const cleanTo = (toCode || 'SAR').toUpperCase();
  if (cleanFrom === cleanTo) return Math.round(safeAmount * 100) / 100;

  const fromCurr = currencies.find((c) => c.code.toUpperCase() === cleanFrom);
  const toCurr = currencies.find((c) => c.code.toUpperCase() === cleanTo);

  const fromRateToBase =
    explicitFromRateToBase && explicitFromRateToBase > 0
      ? explicitFromRateToBase
      : fromCurr?.isPrimary
        ? 1
        : fromCurr?.rateToBase || 1;

  const toRateToBase = toCurr?.isPrimary ? 1 : toCurr?.rateToBase || 1;

  const amountInBase = safeAmount * fromRateToBase;
  const converted = toRateToBase > 0 ? amountInBase / toRateToBase : amountInBase;
  return Math.round(converted * 100) / 100;
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
