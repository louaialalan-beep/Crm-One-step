import type {
  Contact,
  ContactStatus,
  Deal,
  LeadChannel,
} from '../types/crm';
import {
  CHANNEL_LABELS,
  isMyLead,
  LEAD_OWNERS,
  normalizeEmail,
  normalizePhone,
} from './leadsLogic';

export const CONTACT_STATUSES: readonly ContactStatus[] = [
  'عميل نشط',
  'بانتظار عرض سعر',
  'عميل متكرر (VIP)',
  'متوقف / غير نشط',
] as const;

export const CONTACT_OWNERS = LEAD_OWNERS;

export type ContactQuickFilterKey =
  | 'all'
  | 'my_contacts'
  | 'purchased'
  | 'open_deals'
  | 'duplicates';

export type ContactSortKey = 'recent' | 'deals_value' | 'name' | 'status';

export type ContactRuleField =
  | 'city'
  | 'primarySource'
  | 'accountName'
  | 'phone'
  | 'email'
  | 'notes';

export type ContactRuleOperator = 'contains' | 'equals';

export interface ContactDockedFilterRule {
  id: string;
  field: ContactRuleField;
  operator: ContactRuleOperator;
  value: string;
}

export interface ContactDockedFilterCriteria {
  channels: LeadChannel[];
  statuses: ContactStatus[];
  dealFilter: 'all' | 'has_open' | 'purchased' | 'no_deals';
  tags: string[];
  ownerName: string;
  logicOperator: 'AND' | 'OR';
  rules: ContactDockedFilterRule[];
}

export const DEFAULT_CONTACT_DOCKED_FILTER: ContactDockedFilterCriteria = {
  channels: [],
  statuses: [],
  dealFilter: 'all',
  tags: [],
  ownerName: 'all',
  logicOperator: 'AND',
  rules: [],
};

export function resolveContactStatus(raw?: string): ContactStatus {
  if (
    raw === 'عميل نشط' ||
    raw === 'بانتظار عرض سعر' ||
    raw === 'عميل متكرر (VIP)' ||
    raw === 'متوقف / غير نشط'
  ) {
    return raw;
  }
  if (raw === 'نشط') return 'عميل نشط';
  return 'عميل نشط';
}

export function getContactOwnerName(contact: Contact): string {
  return contact.assignedToName?.trim() || 'سلمان القحطاني';
}

export function getDealsForContact(contact: Contact, deals: Deal[]): Deal[] {
  return deals.filter((deal) => {
    if (deal.contactId && deal.contactId === contact.id) return true;
    if (contact.leadUniqueId && deal.leadUniqueId && deal.leadUniqueId === contact.leadUniqueId) {
      return true;
    }
    if (
      !deal.contactId &&
      contact.accountId &&
      contact.accountId !== 'unassigned' &&
      deal.accountId === contact.accountId &&
      contact.isPrimary
    ) {
      return true;
    }
    return false;
  });
}

export function hasPurchased(contact: Contact, contactDeals: Deal[]): boolean {
  return (
    contactDeals.some((d) => d.stage === 'مكتملة') ||
    resolveContactStatus(contact.contactStatus) === 'عميل متكرر (VIP)'
  );
}

export function hasOpenDeals(contactDeals: Deal[]): boolean {
  return contactDeals.some((d) => d.stage !== 'مكتملة' && d.stage !== 'خسارة');
}

export function isRepeatBuyer(contact: Contact, contactDeals: Deal[]): boolean {
  const wonDealsCount = contactDeals.filter((d) => d.stage === 'مكتملة').length;
  return (
    wonDealsCount >= 2 ||
    (contactDeals.length >= 2 && hasPurchased(contact, contactDeals)) ||
    resolveContactStatus(contact.contactStatus) === 'عميل متكرر (VIP)'
  );
}

export interface ContactDuplicateGroup {
  key: string;
  type: 'phone' | 'email';
  value: string;
  reason: string;
  contactIds: string[];
}

export interface ContactDuplicateResult {
  duplicateContactIds: Set<string>;
  reasonsByContactId: Map<string, string>;
  groups: ContactDuplicateGroup[];
}

export function findDuplicateContacts(contacts: Contact[]): ContactDuplicateResult {
  const phoneMap = new Map<string, Contact[]>();
  const emailMap = new Map<string, Contact[]>();

  for (const contact of contacts) {
    const normPhone = normalizePhone(contact.phone);
    if (normPhone.length >= 7) {
      const list = phoneMap.get(normPhone) ?? [];
      list.push(contact);
      phoneMap.set(normPhone, list);
    }

    const normEmail = normalizeEmail(contact.email);
    if (normEmail.includes('@')) {
      const list = emailMap.get(normEmail) ?? [];
      list.push(contact);
      emailMap.set(normEmail, list);
    }
  }

  const duplicateContactIds = new Set<string>();
  const reasonsByContactId = new Map<string, string>();
  const groups: ContactDuplicateGroup[] = [];

  for (const [phoneDigits, grouped] of phoneMap.entries()) {
    if (grouped.length > 1) {
      const displayVal = grouped[0].phone || phoneDigits;
      const reason = `تطابق رقم الجوال (${displayVal})`;
      groups.push({
        key: `phone_${phoneDigits}`,
        type: 'phone',
        value: displayVal,
        reason,
        contactIds: grouped.map((c) => c.id),
      });
      for (const c of grouped) {
        duplicateContactIds.add(c.id);
        reasonsByContactId.set(c.id, reason);
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
        contactIds: grouped.map((c) => c.id),
      });
      for (const c of grouped) {
        duplicateContactIds.add(c.id);
        const existing = reasonsByContactId.get(c.id);
        reasonsByContactId.set(c.id, existing ? `${existing} + ${reason}` : reason);
      }
    }
  }

  return { duplicateContactIds, reasonsByContactId, groups };
}

export function findLiveDuplicateContactsForInput(
  contacts: Contact[],
  input: { phone?: string; email?: string; excludeId?: string }
): Array<{ contact: Contact; reason: string }> {
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const matches: Array<{ contact: Contact; reason: string }> = [];

  for (const contact of contacts) {
    if (input.excludeId && contact.id === input.excludeId) continue;
    const phoneMatch = normPhone.length >= 7 && normalizePhone(contact.phone) === normPhone;
    const emailMatch = normEmail.includes('@') && normalizeEmail(contact.email) === normEmail;
    if (phoneMatch && emailMatch) {
      matches.push({ contact, reason: 'تطابق الجوال والبريد الإلكتروني' });
    } else if (phoneMatch) {
      matches.push({ contact, reason: 'تطابق رقم الجوال' });
    } else if (emailMatch) {
      matches.push({ contact, reason: 'تطابق البريد الإلكتروني' });
    }
  }

  return matches;
}

export function hasActiveContactDockedFilter(filter: ContactDockedFilterCriteria): boolean {
  return (
    filter.channels.length > 0 ||
    filter.statuses.length > 0 ||
    filter.dealFilter !== 'all' ||
    filter.tags.length > 0 ||
    filter.ownerName !== 'all' ||
    filter.rules.some((r) => r.value.trim().length > 0)
  );
}

function evaluateDynamicContactRule(contact: Contact, rule: ContactDockedFilterRule): boolean {
  const rawVal = rule.value.trim().toLowerCase();
  if (!rawVal) return true;
  const fieldVal = String(contact[rule.field] ?? '').toLowerCase();
  if (rule.operator === 'equals') return fieldVal === rawVal;
  return fieldVal.includes(rawVal);
}

export function filterContacts(
  contacts: Contact[],
  deals: Deal[],
  options: {
    quickFilter: ContactQuickFilterKey;
    currentUserName: string;
    searchQuery: string;
    dockedFilter: ContactDockedFilterCriteria;
    duplicateContactIds?: Set<string>;
  }
): Contact[] {
  const {
    quickFilter,
    currentUserName,
    searchQuery,
    dockedFilter,
    duplicateContactIds,
  } = options;

  const dupSet = duplicateContactIds ?? findDuplicateContacts(contacts).duplicateContactIds;
  const queryLower = searchQuery.trim().toLowerCase();

  return contacts.filter((contact) => {
    const contactDeals = getDealsForContact(contact, deals);
    const ownerName = getContactOwnerName(contact);

    if (quickFilter === 'my_contacts' && !isMyLead(ownerName, currentUserName)) {
      return false;
    }
    if (quickFilter === 'purchased' && !hasPurchased(contact, contactDeals)) {
      return false;
    }
    if (quickFilter === 'open_deals' && !hasOpenDeals(contactDeals)) {
      return false;
    }
    if (quickFilter === 'duplicates' && !dupSet.has(contact.id)) {
      return false;
    }

    if (queryLower) {
      const haystack = [
        contact.leadUniqueId ?? '',
        contact.fullName,
        contact.accountName,
        contact.jobTitle ?? '',
        contact.phone ?? '',
        contact.email ?? '',
        contact.city ?? '',
        contact.primarySource ?? '',
        ownerName,
        ...(contact.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(queryLower)) {
        return false;
      }
    }

    const checks: boolean[] = [];

    if (dockedFilter.channels.length > 0) {
      checks.push(Boolean(contact.channel && dockedFilter.channels.includes(contact.channel)));
    }
    if (dockedFilter.statuses.length > 0) {
      const resolved = resolveContactStatus(contact.contactStatus);
      checks.push(dockedFilter.statuses.includes(resolved));
    }
    if (dockedFilter.dealFilter !== 'all') {
      if (dockedFilter.dealFilter === 'has_open') checks.push(hasOpenDeals(contactDeals));
      else if (dockedFilter.dealFilter === 'purchased')
        checks.push(hasPurchased(contact, contactDeals));
      else if (dockedFilter.dealFilter === 'no_deals') checks.push(contactDeals.length === 0);
    }
    if (dockedFilter.tags.length > 0) {
      const contactTags = contact.tags ?? [];
      checks.push(dockedFilter.tags.some((t) => contactTags.includes(t)));
    }
    if (dockedFilter.ownerName && dockedFilter.ownerName !== 'all') {
      checks.push(ownerName === dockedFilter.ownerName);
    }

    for (const rule of dockedFilter.rules) {
      if (rule.value.trim()) {
        checks.push(evaluateDynamicContactRule(contact, rule));
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

export function sortContacts(
  contacts: Contact[],
  deals: Deal[],
  sortBy: ContactSortKey
): Contact[] {
  const list = [...contacts];
  if (sortBy === 'name') {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
    return list;
  }
  if (sortBy === 'status') {
    list.sort(
      (a, b) =>
        CONTACT_STATUSES.indexOf(resolveContactStatus(a.contactStatus)) -
        CONTACT_STATUSES.indexOf(resolveContactStatus(b.contactStatus))
    );
    return list;
  }
  if (sortBy === 'deals_value') {
    list.sort((a, b) => {
      const valA = getDealsForContact(a, deals).reduce((s, d) => s + d.amount, 0);
      const valB = getDealsForContact(b, deals).reduce((s, d) => s + d.amount, 0);
      return valB - valA;
    });
    return list;
  }
  return list;
}

export interface ContactsSummaryMetrics {
  totalCount: number;
  totalDealsValue: number;
  repeatPurchasePercent: number;
  repeatBuyersCount: number;
  activeDealsCount: number;
}

export function computeContactsSummaryMetrics(
  contacts: Contact[],
  deals: Deal[]
): ContactsSummaryMetrics {
  const totalCount = contacts.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      totalDealsValue: 0,
      repeatPurchasePercent: 0,
      repeatBuyersCount: 0,
      activeDealsCount: 0,
    };
  }

  const seenDealIds = new Set<string>();
  let totalDealsValue = 0;
  let activeDealsCount = 0;
  let repeatBuyersCount = 0;

  for (const contact of contacts) {
    const contactDeals = getDealsForContact(contact, deals);
    if (isRepeatBuyer(contact, contactDeals)) {
      repeatBuyersCount += 1;
    }
    for (const d of contactDeals) {
      if (seenDealIds.has(d.id)) continue;
      seenDealIds.add(d.id);
      if (d.stage !== 'خسارة') {
        totalDealsValue += d.amount;
      }
      if (d.stage !== 'مكتملة' && d.stage !== 'خسارة') {
        activeDealsCount += 1;
      }
    }
  }

  const repeatPurchasePercent = Math.round((repeatBuyersCount / totalCount) * 100);

  return {
    totalCount,
    totalDealsValue,
    repeatPurchasePercent,
    repeatBuyersCount,
    activeDealsCount,
  };
}

export function formatCompactDealValue(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (amount >= 1000000) {
    const m = amount / 1000000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return amount.toLocaleString('en-US');
}

export function pickRoundRobinContactOwner(
  contacts: Contact[],
  owners: readonly string[] = CONTACT_OWNERS
): string {
  if (owners.length === 0) return CONTACT_OWNERS[0];
  const counts = new Map<string, number>();
  for (const owner of owners) counts.set(owner, 0);
  for (const c of contacts) {
    const owner = getContactOwnerName(c);
    const matched = owners.find((o) => isMyLead(owner, o));
    if (matched) counts.set(matched, (counts.get(matched) ?? 0) + 1);
  }
  let chosen = owners[0];
  let minCount = counts.get(chosen) ?? 0;
  for (const owner of owners) {
    const cnt = counts.get(owner) ?? 0;
    if (cnt < minCount) {
      minCount = cnt;
      chosen = owner;
    }
  }
  return chosen;
}

export interface ParsedCsvContactDraft {
  fullName: string;
  accountName: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  city?: string;
  primarySource?: string;
  channel: LeadChannel;
  contactStatus: ContactStatus;
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

function resolveChannel(raw?: string): LeadChannel {
  const val = (raw ?? '').trim().toLowerCase();
  if (val.includes('whats') || val.includes('واتساب')) return 'whatsapp';
  if (val.includes('insta') || val.includes('إنستغرام') || val.includes('انستغرام'))
    return 'instagram';
  if (val.includes('mess') || val.includes('ماسنجر')) return 'messenger';
  if (val.includes('phone') || val.includes('هاتف') || val.includes('اتصال')) return 'phone';
  if (val.includes('ref') || val.includes('إحالة')) return 'referral';
  return 'website';
}

export function parseContactsCsv(csvText: string): ParsedCsvContactDraft[] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase());
  const idx = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const nameIdx = idx(['fullname', 'full_name', 'name', 'الاسم']);
  const accountIdx = idx(['account', 'company', 'المنشأة', 'الشركة']);
  const jobIdx = idx(['job', 'title', 'المسمى']);
  const phoneIdx = idx(['phone', 'mobile', 'الجوال', 'الهاتف']);
  const emailIdx = idx(['email', 'البريد']);
  const cityIdx = idx(['city', 'المدينة']);
  const sourceIdx = idx(['source', 'المصدر']);
  const channelIdx = idx(['channel', 'القناة']);
  const statusIdx = idx(['status', 'الحالة']);
  const ownerIdx = idx(['owner', 'assigned', 'المالك']);
  const tagsIdx = idx(['tags', 'الوسوم']);
  const notesIdx = idx(['notes', 'الملاحظات']);

  const drafts: ParsedCsvContactDraft[] = [];

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
      accountName: (accountIdx >= 0 ? cols[accountIdx] : '')?.trim() || 'عميل فردي B2C',
      jobTitle: jobIdx >= 0 ? cols[jobIdx] || undefined : undefined,
      phone: phoneIdx >= 0 ? cols[phoneIdx] || undefined : undefined,
      email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
      city: cityIdx >= 0 ? cols[cityIdx] || undefined : 'الرياض، السعودية',
      primarySource: sourceIdx >= 0 ? cols[sourceIdx] || 'استيراد CSV' : 'استيراد CSV',
      channel: resolveChannel(channelIdx >= 0 ? cols[channelIdx] : undefined),
      contactStatus: resolveContactStatus(statusIdx >= 0 ? cols[statusIdx] : undefined),
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

export function exportContactsToCsv(contacts: Contact[], deals: Deal[]): string {
  const header = [
    'المعرف الفريد',
    'الاسم الكامل',
    'المنشأة / الشركة',
    'رقم الجوال',
    'القناة',
    'البريد الإلكتروني',
    'حالة جهة الاتصال',
    'المصدر الأساسي',
    'عدد الصفقات',
    'إجمالي قيمة الصفقات',
    'مالك السجل',
    'المدينة',
  ];

  const rows = contacts.map((contact) => {
    const contactDeals = getDealsForContact(contact, deals);
    const dealsSum = contactDeals.reduce((s, d) => s + d.amount, 0);
    return [
      contact.leadUniqueId ?? contact.id,
      contact.fullName,
      contact.accountId === 'unassigned' ? 'عميل فردي B2C' : contact.accountName,
      contact.phone ?? '',
      contact.channel ? CHANNEL_LABELS[contact.channel] : 'واتساب',
      contact.email ?? '',
      resolveContactStatus(contact.contactStatus),
      contact.primarySource ?? 'تحويل مباشر',
      contactDeals.length,
      dealsSum,
      getContactOwnerName(contact),
      contact.city ?? '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return `\uFEFF${[header.map(escapeCsvCell).join(','), ...rows].join('\n')}`;
}

export type ContactChartGroupBy =
  | 'contactStatus'
  | 'channel'
  | 'primarySource'
  | 'assignedToName'
  | 'city'
  | 'accountType';

export type ContactChartMeasure = 'count' | 'dealsValue';
export type ContactChartType = 'bar' | 'horizontal' | 'pie' | 'donut';
export type ContactChartTimeRange = 'all' | 'today' | '7d' | '30d' | 'quarter';

export interface ContactChartBucket {
  key: string;
  label: string;
  value: number;
  count: number;
  totalDealsValue: number;
  contactIds: string[];
}

function estimateHoursFromLabel(label?: string): number | null {
  if (!label) return null;
  const text = label.trim();
  if (text.includes('الآن') || text.includes('اليوم') || text.includes('د')) return 2;
  if (text.includes('أمس')) return 28;
  const numMatch = text.match(/(\d+)/);
  const num = numMatch ? Number(numMatch[1]) : 1;
  if (text.includes('ساعة') || text.includes('ساعات')) return num;
  if (text.includes('يوم') || text.includes('أيام') || text.includes('يوماً')) return num * 24;
  return 12;
}

export function filterContactsByChartTimeRange(
  contacts: Contact[],
  timeRange: ContactChartTimeRange
): Contact[] {
  if (timeRange === 'all') return contacts;
  const maxHours =
    timeRange === 'today'
      ? 24
      : timeRange === '7d'
      ? 7 * 24
      : timeRange === '30d'
      ? 30 * 24
      : 90 * 24;

  return contacts.filter((c) => {
    const hours = estimateHoursFromLabel(c.lastActivityLabel) ?? 12;
    return hours <= maxHours;
  });
}

export function aggregateContactsForChart(
  contacts: Contact[],
  deals: Deal[],
  groupBy: ContactChartGroupBy,
  measure: ContactChartMeasure
): ContactChartBucket[] {
  const map = new Map<
    string,
    { label: string; contactIds: string[]; totalDealsValue: number }
  >();

  for (const contact of contacts) {
    let key = '';
    let label = '';

    if (groupBy === 'contactStatus') {
      key = resolveContactStatus(contact.contactStatus);
      label = key;
    } else if (groupBy === 'channel') {
      key = contact.channel ?? 'whatsapp';
      label = CHANNEL_LABELS[key as LeadChannel] ?? 'واتساب';
    } else if (groupBy === 'primarySource') {
      key = contact.primarySource?.trim() || 'غير محدد';
      label = key;
    } else if (groupBy === 'city') {
      const shortCity = (contact.city ?? '').split('،')[0].split(',')[0].trim();
      key = shortCity || 'غير محدد';
      label = key;
    } else if (groupBy === 'accountType') {
      const isB2C = contact.accountId === 'unassigned' || contact.accountName === 'عميل فردي B2C';
      key = isB2C ? 'b2c' : 'b2b';
      label = isB2C ? 'عملاء أفراد (B2C)' : 'منشآت وشركات (B2B)';
    } else {
      key = getContactOwnerName(contact);
      label = key;
    }

    const contactDealsVal = getDealsForContact(contact, deals).reduce(
      (s, d) => s + (d.stage !== 'خسارة' ? d.amount : 0),
      0
    );

    const entry = map.get(key) ?? {
      label,
      contactIds: [],
      totalDealsValue: 0,
    };
    entry.contactIds.push(contact.id);
    entry.totalDealsValue += contactDealsVal;
    map.set(key, entry);
  }

  const buckets: ContactChartBucket[] = Array.from(map.entries()).map(([key, entry]) => {
    const count = entry.contactIds.length;
    const value = measure === 'count' ? count : entry.totalDealsValue;
    return {
      key,
      label: entry.label,
      value,
      count,
      totalDealsValue: entry.totalDealsValue,
      contactIds: entry.contactIds,
    };
  });

  if (groupBy === 'contactStatus') {
    buckets.sort(
      (a, b) =>
        CONTACT_STATUSES.indexOf(a.key as ContactStatus) -
        CONTACT_STATUSES.indexOf(b.key as ContactStatus)
    );
  } else {
    buckets.sort((a, b) => b.value - a.value);
  }

  return buckets;
}
