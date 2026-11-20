import type { Lead, LeadChannel, LeadStatus } from '../types/crm';

export const LEAD_STAGES: readonly LeadStatus[] = [
  'جديد',
  'تم التواصل',
  'مؤهل للتحويل',
  'غير مهتم',
] as const;

export const LEAD_OWNERS: readonly string[] = [
  'سلمان القحطاني',
  'نورة السبيعي',
  'طارق الدوسري',
] as const;

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  whatsapp: 'واتساب',
  instagram: 'إنستغرام',
  messenger: 'ماسنجر',
  website: 'الموقع الإلكتروني',
  phone: 'اتصال هاتفي',
  referral: 'إحالة عميل',
};

export type QuickFilterKey = 'all' | 'my_leads' | 'unanswered' | 'hot' | 'duplicates';

export type DynamicRuleField =
  | 'city'
  | 'source'
  | 'phone'
  | 'email'
  | 'notes'
  | 'aiScore'
  | 'channel'
  | 'touchpoints_count'
  | 'campaign_name'
  | 'ad_id'
  | 'utm_source'
  | 'deal_stage'
  | 'amount'
  | 'company_name'
  | 'annual_revenue'
  | (string & {});

export type DynamicRuleOperator =
  | 'contains'
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'empty'
  | 'gte'
  | 'lte';

export interface DockedFilterRule {
  id: string;
  field: DynamicRuleField;
  operator: DynamicRuleOperator;
  value: string;
}

export interface DockedFilterCriteria {
  channels: LeadChannel[];
  slaOnly: boolean;
  stages: LeadStatus[];
  tags: string[];
  ownerName: string;
  logicOperator: 'AND' | 'OR';
  rules: DockedFilterRule[];
}

export const DEFAULT_DOCKED_FILTER: DockedFilterCriteria = {
  channels: [],
  slaOnly: false,
  stages: [],
  tags: [],
  ownerName: 'all',
  logicOperator: 'AND',
  rules: [],
};

export function normalizePhone(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('05') && digits.length === 10) {
    digits = `966${digits.slice(1)}`;
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = `966${digits}`;
  }
  return digits;
}

export function isValidSaudiWhatsappPhone(phone?: string): boolean {
  const digits = normalizePhone(phone);
  if (!digits) return false;
  if (digits.startsWith('9665') && digits.length === 12) return true;
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmailFormat(email?: string): boolean {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function pickRoundRobinOwner(
  leads: Lead[],
  owners: readonly string[] = LEAD_OWNERS
): string {
  if (owners.length === 0) return LEAD_OWNERS[0];
  const counts = new Map<string, number>();
  for (const owner of owners) {
    counts.set(owner, 0);
  }
  for (const lead of leads) {
    const matched = owners.find((o) => isMyLead(lead.assignedToName, o));
    if (matched) {
      counts.set(matched, (counts.get(matched) ?? 0) + 1);
    }
  }
  let chosen = owners[0];
  let minCount = counts.get(chosen) ?? 0;
  for (const owner of owners) {
    const c = counts.get(owner) ?? 0;
    if (c < minCount) {
      minCount = c;
      chosen = owner;
    }
  }
  return chosen;
}

export function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase();
}

export function isMyLead(assignedToName: string, currentUserName: string): boolean {
  const leadOwner = assignedToName.trim();
  const user = currentUserName.trim();
  if (!leadOwner || !user) return false;
  if (leadOwner === user) return true;
  if (user.includes(leadOwner) || leadOwner.includes(user)) return true;

  const leadTokens = leadOwner.split(/\s+/).filter(Boolean);
  const userTokens = user.split(/\s+/).filter(Boolean);
  if (leadTokens.length >= 2 && userTokens.length >= 2) {
    return (
      leadTokens[0] === userTokens[0] &&
      leadTokens[leadTokens.length - 1] === userTokens[userTokens.length - 1]
    );
  }
  return false;
}

export interface DuplicateGroup {
  key: string;
  type: 'phone' | 'email';
  value: string;
  reason: string;
  leadIds: string[];
}

export interface DuplicateDetectionResult {
  duplicateLeadIds: Set<string>;
  reasonsByLeadId: Map<string, string>;
  groups: DuplicateGroup[];
}

export function findDuplicateLeads(leads: Lead[]): DuplicateDetectionResult {
  const phoneMap = new Map<string, Lead[]>();
  const emailMap = new Map<string, Lead[]>();

  for (const lead of leads) {
    const normPhone = normalizePhone(lead.phone);
    if (normPhone.length >= 7) {
      const list = phoneMap.get(normPhone) ?? [];
      list.push(lead);
      phoneMap.set(normPhone, list);
    }

    const normEmail = normalizeEmail(lead.email);
    if (normEmail.includes('@')) {
      const list = emailMap.get(normEmail) ?? [];
      list.push(lead);
      emailMap.set(normEmail, list);
    }
  }

  const duplicateLeadIds = new Set<string>();
  const reasonsByLeadId = new Map<string, string>();
  const groups: DuplicateGroup[] = [];

  for (const [phoneDigits, grouped] of phoneMap.entries()) {
    if (grouped.length > 1) {
      const displayVal = grouped[0].phone || phoneDigits;
      const reason = `تطابق رقم الجوال (${displayVal})`;
      groups.push({
        key: `phone_${phoneDigits}`,
        type: 'phone',
        value: displayVal,
        reason,
        leadIds: grouped.map((l) => l.id),
      });
      for (const l of grouped) {
        duplicateLeadIds.add(l.id);
        reasonsByLeadId.set(l.id, reason);
      }
    }
  }

  for (const [email, grouped] of emailMap.entries()) {
    if (grouped.length > 1) {
      const reason = `تطابق البريد الإلكتروني (${email})`;
      groups.push({
        key: `email_${email}`,
        type: 'email',
        value: email,
        reason,
        leadIds: grouped.map((l) => l.id),
      });
      for (const l of grouped) {
        duplicateLeadIds.add(l.id);
        const existing = reasonsByLeadId.get(l.id);
        reasonsByLeadId.set(l.id, existing ? `${existing} + ${reason}` : reason);
      }
    }
  }

  return { duplicateLeadIds, reasonsByLeadId, groups };
}

export function findLiveDuplicatesForInput(
  leads: Lead[],
  input: { phone?: string; email?: string; excludeId?: string }
): Array<{ lead: Lead; reason: string }> {
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const matches: Array<{ lead: Lead; reason: string }> = [];

  for (const lead of leads) {
    if (input.excludeId && lead.id === input.excludeId) continue;
    const phoneMatch = normPhone.length >= 7 && normalizePhone(lead.phone) === normPhone;
    const emailMatch = normEmail.includes('@') && normalizeEmail(lead.email) === normEmail;
    if (phoneMatch && emailMatch) {
      matches.push({ lead, reason: 'تطابق الجوال والبريد الإلكتروني' });
    } else if (phoneMatch) {
      matches.push({ lead, reason: 'تطابق رقم الجوال' });
    } else if (emailMatch) {
      matches.push({ lead, reason: 'تطابق البريد الإلكتروني' });
    }
  }

  return matches;
}

function evaluateDynamicRule(lead: Lead, rule: DockedFilterRule): boolean {
  const rawVal = rule.value.trim();
  if (rule.operator !== 'empty' && !rawVal) return true;

  if (rule.field === 'aiScore') {
    const targetNum = Number(rawVal);
    if (!Number.isFinite(targetNum)) return true;
    const leadNum = lead.aiScore;
    if (rule.operator === 'gte' || rule.operator === 'greater_than') return leadNum >= targetNum;
    if (rule.operator === 'lte' || rule.operator === 'less_than') return leadNum <= targetNum;
    if (rule.operator === 'not_equals') return leadNum !== targetNum;
    return leadNum === targetNum;
  }

  const recordMap = lead as unknown as Record<string, unknown>;
  const resolvedRaw =
    rule.field === 'ad_id'
      ? lead.adId
      : rule.field === 'campaign_name'
        ? lead.campaign
        : recordMap[rule.field] ?? lead.customValues?.[rule.field] ?? '';

  const fieldValue = String(resolvedRaw ?? '').toLowerCase();
  if (rule.operator === 'empty') {
    return fieldValue.trim().length === 0;
  }
  const needle = rawVal.toLowerCase();
  if (rule.operator === 'equals') {
    return fieldValue === needle;
  }
  if (rule.operator === 'not_equals') {
    return fieldValue !== needle;
  }
  return fieldValue.includes(needle);
}

export function hasActiveDockedFilter(filter: DockedFilterCriteria): boolean {
  return (
    filter.channels.length > 0 ||
    filter.slaOnly ||
    filter.stages.length > 0 ||
    filter.tags.length > 0 ||
    filter.ownerName !== 'all' ||
    filter.rules.some((r) => r.value.trim().length > 0)
  );
}

export function filterLeads(
  leads: Lead[],
  options: {
    quickFilter: QuickFilterKey;
    currentUserName: string;
    searchQuery: string;
    dockedFilter: DockedFilterCriteria;
    duplicateLeadIds?: Set<string>;
    showConverted?: boolean;
  }
): Lead[] {
  const {
    quickFilter,
    currentUserName,
    searchQuery,
    dockedFilter,
    duplicateLeadIds,
    showConverted = true,
  } = options;

  const dupSet = duplicateLeadIds ?? findDuplicateLeads(leads).duplicateLeadIds;
  const queryLower = searchQuery.trim().toLowerCase();

  return leads.filter((lead) => {
    if (!showConverted && lead.converted) return false;

    // 1. Quick filter
    if (quickFilter === 'my_leads' && !isMyLead(lead.assignedToName, currentUserName)) {
      return false;
    }
    if (quickFilter === 'unanswered' && (lead.awaitingReplyHours ?? 0) <= 0) {
      return false;
    }
    if (
      quickFilter === 'hot' &&
      lead.aiScore < 85 &&
      !(lead.tags ?? []).includes('ساخن')
    ) {
      return false;
    }
    if (quickFilter === 'duplicates' && !dupSet.has(lead.id)) {
      return false;
    }

    // 2. Search query
    if (queryLower) {
      const haystack = [
        lead.unique_id,
        lead.fullName,
        lead.phone ?? '',
        lead.email ?? '',
        lead.city ?? '',
        lead.source ?? '',
        lead.notes ?? '',
        lead.assignedToName,
        ...(lead.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(queryLower)) {
        return false;
      }
    }

    // 3. Docked Filter conditions
    const checks: boolean[] = [];

    if (dockedFilter.channels.length > 0) {
      checks.push(Boolean(lead.channel && dockedFilter.channels.includes(lead.channel)));
    }
    if (dockedFilter.slaOnly) {
      checks.push((lead.awaitingReplyHours ?? 0) > 2);
    }
    if (dockedFilter.stages.length > 0) {
      checks.push(dockedFilter.stages.includes(lead.status));
    }
    if (dockedFilter.tags.length > 0) {
      const leadTags = lead.tags ?? [];
      checks.push(dockedFilter.tags.some((t) => leadTags.includes(t)));
    }
    if (dockedFilter.ownerName && dockedFilter.ownerName !== 'all') {
      checks.push(lead.assignedToName === dockedFilter.ownerName);
    }

    for (const rule of dockedFilter.rules) {
      if (rule.value.trim()) {
        checks.push(evaluateDynamicRule(lead, rule));
      }
    }

    if (checks.length > 0) {
      if (dockedFilter.logicOperator === 'OR') {
        if (!checks.some(Boolean)) return false;
      } else {
        if (!checks.every(Boolean)) return false;
      }
    }

    return true;
  });
}

export interface ParsedCsvLeadDraft {
  fullName: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  channel: LeadChannel;
  status: LeadStatus;
  assignedToName: string;
  tags?: string[];
  notes?: string;
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function resolveChannelValue(raw?: string): LeadChannel {
  const val = (raw ?? '').trim().toLowerCase();
  if (val.includes('whats') || val.includes('واتساب')) return 'whatsapp';
  if (val.includes('insta') || val.includes('إنستغرام') || val.includes('انستغرام'))
    return 'instagram';
  if (val.includes('mess') || val.includes('ماسنجر')) return 'messenger';
  if (val.includes('phone') || val.includes('هاتف') || val.includes('اتصال')) return 'phone';
  if (val.includes('ref') || val.includes('إحالة')) return 'referral';
  return 'website';
}

function resolveLeadStatusValue(raw?: string): LeadStatus {
  const val = (raw ?? '').trim();
  if (val === 'تم التواصل' || val === 'مؤهل للتحويل' || val === 'غير مهتم') {
    return val;
  }
  return 'جديد';
}

export function parseLeadsCsv(csvText: string): ParsedCsvLeadDraft[] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase());
  const idx = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const nameIdx = idx(['fullname', 'full_name', 'name', 'الاسم']);
  const phoneIdx = idx(['phone', 'mobile', 'الجوال', 'الهاتف']);
  const emailIdx = idx(['email', 'البريد']);
  const cityIdx = idx(['city', 'المدينة', 'الدولة']);
  const sourceIdx = idx(['source', 'المصدر', 'مصدر الاستقطاب']);
  const channelIdx = idx(['channel', 'القناة']);
  const statusIdx = idx(['status', 'stage', 'المرحلة', 'الحالة']);
  const ownerIdx = idx(['assignedtoname', 'owner', 'المالك']);
  const tagsIdx = idx(['tags', 'الوسوم']);
  const notesIdx = idx(['notes', 'الملاحظات']);

  const drafts: ParsedCsvLeadDraft[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvRow(lines[i]);
    const fullName = (nameIdx >= 0 ? cols[nameIdx] : cols[0])?.trim() ?? '';
    if (!fullName) continue;

    const rawTags = tagsIdx >= 0 ? cols[tagsIdx] : '';
    const parsedTags = rawTags
      ? rawTags
          .split(/[|،,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    drafts.push({
      fullName,
      phone: phoneIdx >= 0 ? cols[phoneIdx] || undefined : undefined,
      email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
      city: cityIdx >= 0 ? cols[cityIdx] || undefined : 'الرياض، السعودية',
      source: sourceIdx >= 0 ? cols[sourceIdx] || 'استيراد CSV' : 'استيراد CSV',
      channel: resolveChannelValue(channelIdx >= 0 ? cols[channelIdx] : undefined),
      status: resolveLeadStatusValue(statusIdx >= 0 ? cols[statusIdx] : undefined),
      assignedToName:
        (ownerIdx >= 0 ? cols[ownerIdx] : '')?.trim() || 'سلمان القحطاني',
      tags: parsedTags,
      notes: notesIdx >= 0 ? cols[notesIdx] || undefined : undefined,
    });
  }

  return drafts;
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLeadsToCsv(leads: Lead[]): string {
  const header = [
    'المعرف الفريد',
    'الاسم الكامل',
    'الجوال',
    'البريد الإلكتروني',
    'القناة المفضلة',
    'المدينة / الدولة',
    'مصدر الاستقطاب الأساسي',
    'المرحلة',
    'تقييم AI',
    'مالك السجل',
    'الوسوم',
    'الملاحظات',
  ];

  const rows = leads.map((lead) =>
    [
      lead.unique_id,
      lead.fullName,
      lead.phone ?? '',
      lead.email ?? '',
      lead.channel ? CHANNEL_LABELS[lead.channel] : '',
      lead.city ?? '',
      lead.source ?? '',
      lead.status,
      lead.aiScore,
      lead.assignedToName,
      (lead.tags ?? []).join(' | '),
      lead.notes ?? '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return `\uFEFF${[header.map(escapeCsvCell).join(','), ...rows].join('\n')}`;
}

export type ChartGroupBy = 'status' | 'channel' | 'source' | 'assignedToName' | 'city';
export type ChartMeasure = 'count' | 'estimatedValue' | 'avgAiScore';
export type ChartType = 'bar' | 'horizontal' | 'pie' | 'donut';
export type ChartDateField = 'createdAt' | 'lastActivity' | 'followUpAt';
export type ChartTimeRange = 'all' | 'today' | '7d' | '30d' | 'quarter';

export interface ChartBucket {
  key: string;
  label: string;
  value: number;
  count: number;
  totalEstimatedValue: number;
  avgAiScore: number;
  leadIds: string[];
}

function estimateHoursFromActivityLabel(label?: string): number | null {
  if (!label) return null;
  const text = label.trim();
  if (text.includes('الآن') || text.includes('دقيقة') || text.includes('دقائق')) {
    return 0.5;
  }
  const hourMatch = text.match(/(\d+)/);
  const num = hourMatch ? Number(hourMatch[1]) : 1;
  if (text.includes('ساعة') || text.includes('ساعات')) {
    return num;
  }
  if (text.includes('يوم') || text.includes('أيام')) {
    return num * 24;
  }
  if (text.includes('أسبوع') || text.includes('أسابيع')) {
    return num * 24 * 7;
  }
  if (text.includes('شهر')) {
    return num * 24 * 30;
  }
  return null;
}

export function filterLeadsByChartTimeRange(
  leads: Lead[],
  dateField: ChartDateField,
  timeRange: ChartTimeRange,
  now: Date = new Date('2026-11-15T14:00:00Z')
): Lead[] {
  if (timeRange === 'all') return leads;
  const maxHours =
    timeRange === 'today'
      ? 24
      : timeRange === '7d'
      ? 7 * 24
      : timeRange === '30d'
      ? 30 * 24
      : 90 * 24;

  return leads.filter((lead) => {
    if (dateField === 'followUpAt') {
      if (!lead.followUpAt) return false;
      const dt = new Date(lead.followUpAt);
      if (Number.isNaN(dt.getTime())) return false;
      const diffHours = Math.abs(dt.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHours <= maxHours;
    }

    if (dateField === 'createdAt') {
      const createdStr = (lead as Lead & { createdAt?: string }).createdAt;
      if (createdStr) {
        const dt = new Date(createdStr);
        if (!Number.isNaN(dt.getTime())) {
          const diffHours = Math.max(0, (now.getTime() - dt.getTime()) / (1000 * 60 * 60));
          return diffHours <= maxHours;
        }
      }
    }

    const estHours =
      estimateHoursFromActivityLabel(lead.lastActivityLabel) ??
      lead.awaitingReplyHours ??
      12;
    return estHours <= maxHours;
  });
}

export function aggregateLeadsForChart(
  leads: Lead[],
  groupBy: ChartGroupBy,
  measure: ChartMeasure
): ChartBucket[] {
  const map = new Map<
    string,
    { label: string; leadIds: string[]; totalEstimatedValue: number; totalScore: number }
  >();

  for (const lead of leads) {
    let key = '';
    let label = '';

    if (groupBy === 'status') {
      key = lead.status;
      label = lead.status;
    } else if (groupBy === 'channel') {
      key = lead.channel ?? 'website';
      label = lead.channel ? CHANNEL_LABELS[lead.channel] : 'غير محدد';
    } else if (groupBy === 'source') {
      key = lead.source?.trim() || 'غير محدد';
      label = key;
    } else if (groupBy === 'city') {
      const shortCity = (lead.city ?? '').split('،')[0].split(',')[0].trim();
      key = shortCity || 'غير محدد';
      label = key;
    } else {
      key = lead.assignedToName.trim() || 'غير مسند';
      label = key;
    }

    const entry = map.get(key) ?? {
      label,
      leadIds: [],
      totalEstimatedValue: 0,
      totalScore: 0,
    };
    entry.leadIds.push(lead.id);
    entry.totalEstimatedValue += lead.estimatedValue;
    entry.totalScore += lead.aiScore;
    map.set(key, entry);
  }

  const buckets: ChartBucket[] = Array.from(map.entries()).map(([key, entry]) => {
    const count = entry.leadIds.length;
    const avgAiScore = count > 0 ? Math.round(entry.totalScore / count) : 0;
    const value =
      measure === 'count'
        ? count
        : measure === 'estimatedValue'
        ? entry.totalEstimatedValue
        : avgAiScore;
    return {
      key,
      label: entry.label,
      value,
      count,
      totalEstimatedValue: entry.totalEstimatedValue,
      avgAiScore,
      leadIds: entry.leadIds,
    };
  });

  if (groupBy === 'status') {
    buckets.sort(
      (a, b) =>
        LEAD_STAGES.indexOf(a.key as LeadStatus) - LEAD_STAGES.indexOf(b.key as LeadStatus)
    );
  } else {
    buckets.sort((a, b) => b.value - a.value);
  }

  return buckets;
}

export interface VelocityMetrics {
  totalCount: number;
  qualifiedCount: number;
  convertedCount: number;
  conversionRatePercent: number;
  avgAiScore: number;
  awaitingReplyCount: number;
  avgResponseLabel: string;
}

export function computeVelocityMetrics(leads: Lead[]): VelocityMetrics {
  const totalCount = leads.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      qualifiedCount: 0,
      convertedCount: 0,
      conversionRatePercent: 0,
      avgAiScore: 0,
      awaitingReplyCount: 0,
      avgResponseLabel: '—',
    };
  }

  const qualifiedCount = leads.filter(
    (l) => l.status === 'مؤهل للتحويل' || l.converted
  ).length;
  const convertedCount = leads.filter((l) => Boolean(l.converted)).length;
  const awaitingReplyCount = leads.filter((l) => (l.awaitingReplyHours ?? 0) > 0).length;
  const avgAiScore = Math.round(
    leads.reduce((sum, l) => sum + l.aiScore, 0) / totalCount
  );
  const conversionRatePercent = Math.round((qualifiedCount / totalCount) * 100);

  const avgHours =
    leads.reduce((sum, l) => sum + (l.awaitingReplyHours ?? 0.5), 0) / totalCount;
  const avgResponseLabel =
    avgHours < 1 ? `${Math.max(12, Math.round(avgHours * 60))} دقيقة` : `${avgHours.toFixed(1)} ساعة`;

  return {
    totalCount,
    qualifiedCount,
    convertedCount,
    conversionRatePercent,
    avgAiScore,
    awaitingReplyCount,
    avgResponseLabel,
  };
}
