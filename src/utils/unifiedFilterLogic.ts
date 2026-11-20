import type {
  Account,
  Contact,
  CrmModuleKey,
  CustomField,
  Deal,
  Lead,
  LeadChannel,
  Touchpoint,
} from '../types/crm';

export type UnifiedFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_empty';

export interface UnifiedDynamicRule {
  id: string;
  field: string;
  operator: UnifiedFilterOperator;
  value: string;
}

export interface UnifiedFieldOptionMeta {
  key: string;
  label: string;
  group: 'standard' | 'touchpoints' | 'campaigns' | 'custom';
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options?: Array<{ value: string; label: string }>;
}

export const UNIFIED_OPERATOR_OPTIONS: Array<{
  value: UnifiedFilterOperator;
  label: string;
}> = [
  { value: 'equals', label: 'يساوي (=)' },
  { value: 'not_equals', label: 'لا يساوي (≠)' },
  { value: 'contains', label: 'يحتوي على' },
  { value: 'gt', label: 'أكبر من (>)' },
  { value: 'lt', label: 'أصغر من (<)' },
  { value: 'gte', label: 'أكبر من أو يساوي (≥)' },
  { value: 'lte', label: 'أصغر من أو يساوي (≤)' },
  { value: 'is_empty', label: 'فارغ' },
];

export const ENTRY_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'whatsapp', label: 'واتساب (WhatsApp)' },
  { value: 'instagram', label: 'إنستغرام (Instagram)' },
  { value: 'messenger', label: 'ماسنجر (Messenger)' },
  { value: 'website', label: 'موقع إلكتروني (Website)' },
  { value: 'phone', label: 'مكالمة هاتفية (Call)' },
];

export const TOUCHPOINT_COUNT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'جميع أعداد نقاط التماس' },
  { value: '1', label: 'نقطة تماس واحدة أو أكثر (≥ 1)' },
  { value: '2', label: 'نقطتا تماس أو أكثر — إعادة استهداف (≥ 2)' },
  { value: '3', label: '3 نقاط تماس أو أكثر (≥ 3)' },
  { value: '5', label: '5 نقاط تماس أو أكثر — تفاعل مكثف (≥ 5)' },
];

export const LINKED_DEALS_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'جميع حالات الصفقات المرتبطة' },
  { value: 'has_open', label: 'لديهم صفقات نشطة / مفتوحة' },
  { value: 'purchased', label: 'صفقات مغلقة رابحة (عملاء مشترون)' },
  { value: 'no_deals', label: 'بدون صفقات مرتبطة حالياً' },
];

export const CAMPAIGN_SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'meta', label: 'إعلانات ميتا (meta / facebook)' },
  { value: 'whatsapp', label: 'واتساب السحابي (whatsapp / ctwa)' },
  { value: 'instagram', label: 'إنستغرام دايركت (instagram)' },
  { value: 'messenger', label: 'ماسنجر (messenger)' },
  { value: 'google', label: 'إعلانات بحث جوجل (google)' },
  { value: 'website', label: 'الموقع الإلكتروني (website)' },
  { value: 'direct', label: 'مباشر / إحالة (direct)' },
];

export function normalizeChannelKey(raw?: string): string {
  if (!raw) return '';
  const v = raw.trim().toLowerCase();
  if (v.includes('whats') || v.includes('واتساب')) return 'whatsapp';
  if (v.includes('insta') || v.includes('إنستغرام') || v.includes('انستغرام')) return 'instagram';
  if (v.includes('mess') || v.includes('ماسنجر')) return 'messenger';
  if (v.includes('web') || v.includes('موقع')) return 'website';
  if (v.includes('phone') || v.includes('call') || v.includes('مكالمة') || v.includes('هاتف') || v.includes('اتصال'))
    return 'phone';
  if (v.includes('ref') || v.includes('إحالة')) return 'referral';
  return v;
}

export function getEntityTouchpoints(
  entity: {
    id?: string;
    unique_id?: string;
    leadUniqueId?: string;
    contactId?: string;
    accountId?: string;
    name?: string;
    accountName?: string;
  },
  touchpoints: Touchpoint[]
): Touchpoint[] {
  const rwq = entity.unique_id || entity.leadUniqueId;
  return touchpoints.filter((tp) => {
    if (rwq && tp.leadUniqueId && tp.leadUniqueId === rwq) return true;
    if (entity.id && (tp.relatedEntityId === entity.id || tp.leadId === entity.id)) return true;
    if (entity.contactId && tp.relatedEntityId === entity.contactId) return true;
    if (
      entity.name &&
      tp.relatedEntityName &&
      tp.relatedEntityName.trim() === entity.name.trim()
    ) {
      return true;
    }
    return false;
  });
}

export function buildModuleFilterFields(
  module: CrmModuleKey,
  customFields: CustomField[],
  optionsContext: {
    owners?: string[];
    stagesOrStatuses?: string[];
    campaigns?: string[];
    adIds?: string[];
  } = {}
): UnifiedFieldOptionMeta[] {
  const ownerOpts = (optionsContext.owners ?? []).map((o) => ({ value: o, label: o }));
  const stageOpts = (optionsContext.stagesOrStatuses ?? []).map((s) => ({ value: s, label: s }));
  const campaignOpts = (optionsContext.campaigns ?? []).map((c) => ({ value: c, label: c }));
  const adIdOpts = (optionsContext.adIds ?? []).map((a) => ({ value: a, label: a }));

  const standardFields: UnifiedFieldOptionMeta[] = [];

  if (module === 'leads') {
    standardFields.push(
      { key: 'fullName', label: 'الاسم الكامل للعميل', group: 'standard', type: 'text' },
      { key: 'unique_id', label: 'المعرّف الموحد (RWQ-xxxxx)', group: 'standard', type: 'text' },
      { key: 'company', label: 'الشركة / المنشأة', group: 'standard', type: 'text' },
      {
        key: 'status',
        label: 'مرحلة التأهيل / الحالة',
        group: 'standard',
        type: 'select',
        options: stageOpts,
      },
      {
        key: 'assignedToName',
        label: 'مالك السجل',
        group: 'standard',
        type: 'select',
        options: ownerOpts,
      },
      { key: 'city', label: 'المدينة / الدولة', group: 'standard', type: 'text' },
      { key: 'source', label: 'مصدر الاستقطاب الأساسي', group: 'standard', type: 'text' },
      { key: 'phone', label: 'رقم الجوال', group: 'standard', type: 'text' },
      { key: 'email', label: 'البريد الإلكتروني', group: 'standard', type: 'text' },
      { key: 'estimatedValue', label: 'القيمة المتوقعة (ر.س)', group: 'standard', type: 'number' },
      { key: 'aiScore', label: 'تقييم التأهيل الذكي (AI Score)', group: 'standard', type: 'number' },
      { key: 'notes', label: 'الملاحظات', group: 'standard', type: 'text' }
    );
  } else if (module === 'contacts') {
    standardFields.push(
      { key: 'fullName', label: 'اسم جهة الاتصال', group: 'standard', type: 'text' },
      { key: 'leadUniqueId', label: 'المعرّف الموحد (RWQ-xxxxx)', group: 'standard', type: 'text' },
      { key: 'accountName', label: 'المنشأة / الشركة', group: 'standard', type: 'text' },
      {
        key: 'contactStatus',
        label: 'حالة جهة الاتصال',
        group: 'standard',
        type: 'select',
        options: stageOpts,
      },
      {
        key: 'assignedToName',
        label: 'مالك السجل',
        group: 'standard',
        type: 'select',
        options: ownerOpts,
      },
      { key: 'city', label: 'المدينة / الدولة', group: 'standard', type: 'text' },
      { key: 'primarySource', label: 'المصدر الأساسي', group: 'standard', type: 'text' },
      { key: 'phone', label: 'رقم الجوال', group: 'standard', type: 'text' },
      { key: 'email', label: 'البريد الإلكتروني', group: 'standard', type: 'text' },
      { key: 'lifetimeRevenue', label: 'القيمة الدائمة LTV (ر.س)', group: 'standard', type: 'number' },
      { key: 'repeatOrderCount', label: 'عدد الطلبات المتكررة', group: 'standard', type: 'number' },
      { key: 'notes', label: 'الملاحظات', group: 'standard', type: 'text' }
    );
  } else if (module === 'accounts') {
    standardFields.push(
      { key: 'name', label: 'اسم المنشأة / الشركة', group: 'standard', type: 'text' },
      { key: 'industry', label: 'القطاع التجاري', group: 'standard', type: 'text' },
      {
        key: 'tier',
        label: 'تصنيف المنشأة',
        group: 'standard',
        type: 'select',
        options: [
          { value: 'استراتيجي', label: 'استراتيجي' },
          { value: 'مؤسسات', label: 'مؤسسات' },
          { value: 'نمو', label: 'نمو' },
        ],
      },
      {
        key: 'accountManager',
        label: 'مالك السجل / مدير الحساب',
        group: 'standard',
        type: 'select',
        options: ownerOpts,
      },
      { key: 'city', label: 'المدينة', group: 'standard', type: 'text' },
      { key: 'annualRevenue', label: 'الإيراد السنوي (ر.س)', group: 'standard', type: 'number' },
      { key: 'employeesCount', label: 'عدد الموظفين', group: 'standard', type: 'number' },
      { key: 'website', label: 'الموقع الإلكتروني', group: 'standard', type: 'text' }
    );
  } else if (module === 'deals') {
    standardFields.push(
      { key: 'title', label: 'عنوان الصفقة', group: 'standard', type: 'text' },
      { key: 'leadUniqueId', label: 'المعرّف الموحد (RWQ-xxxxx)', group: 'standard', type: 'text' },
      { key: 'accountName', label: 'المنشأة / الشركة', group: 'standard', type: 'text' },
      {
        key: 'stage',
        label: 'المرحلة البيعية',
        group: 'standard',
        type: 'select',
        options: stageOpts,
      },
      {
        key: 'ownerName',
        label: 'مالك السجل / مسؤول الصفقة',
        group: 'standard',
        type: 'select',
        options: ownerOpts,
      },
      { key: 'amount', label: 'قيمة الصفقة (ر.س)', group: 'standard', type: 'number' },
      { key: 'probability', label: 'احتمالية الإغلاق (%)', group: 'standard', type: 'number' },
      { key: 'closeDate', label: 'تاريخ الإغلاق المتوقع', group: 'standard', type: 'date' },
      { key: 'nextStep', label: 'الخطوة التالية', group: 'standard', type: 'text' }
    );
  }

  const touchpointFields: UnifiedFieldOptionMeta[] = [
    {
      key: 'tp_channel',
      label: 'نقاط التماس: قناة الدخول (واتساب / إنستغرام / ماسنجر / موقع / مكالمة)',
      group: 'touchpoints',
      type: 'select',
      options: ENTRY_CHANNEL_OPTIONS,
    },
    {
      key: 'tp_count',
      label: 'نقاط التماس: عدد نقاط التماس (Touchpoints Count)',
      group: 'touchpoints',
      type: 'number',
    },
  ];

  const campaignFields: UnifiedFieldOptionMeta[] = [
    {
      key: 'campaign_name',
      label: 'سجل الحملات: اسم الحملة الإعلانية (Campaign Name)',
      group: 'campaigns',
      type: campaignOpts.length > 0 ? 'select' : 'text',
      options: campaignOpts.length > 0 ? campaignOpts : undefined,
    },
    {
      key: 'ad_id',
      label: 'سجل الحملات: معرّف الإعلان (AD-ID)',
      group: 'campaigns',
      type: adIdOpts.length > 0 ? 'select' : 'text',
      options: adIdOpts.length > 0 ? adIdOpts : undefined,
    },
    {
      key: 'utm_source',
      label: 'سجل الحملات: مصدر الحملة (utm_source / meta)',
      group: 'campaigns',
      type: 'select',
      options: CAMPAIGN_SOURCE_OPTIONS,
    },
  ];

  const moduleCustomFields: UnifiedFieldOptionMeta[] = customFields
    .filter((cf) => cf.module === module)
    .map((cf) => {
      const isSelect = cf.fieldType === 'select' && Array.isArray(cf.options) && cf.options.length > 0;
      const isBool = cf.fieldType === 'boolean';
      const isNum = cf.fieldType === 'number' || cf.fieldType === 'currency';
      const isDate = cf.fieldType === 'date';

      return {
        key: `custom:${cf.fieldKey}`,
        label: `${cf.label} (حقل مخصص)`,
        group: 'custom',
        type: isSelect || isBool ? 'select' : isNum ? 'number' : isDate ? 'date' : 'text',
        options: isSelect
          ? (cf.options ?? []).map((opt) => ({ value: opt, label: opt }))
          : isBool
            ? [
                { value: 'true', label: 'نعم' },
                { value: 'false', label: 'لا' },
              ]
            : undefined,
      };
    });

  return [
    ...standardFields,
    ...touchpointFields,
    ...campaignFields,
    ...moduleCustomFields,
  ];
}

export function evaluateUnifiedRuleOnEntity(
  entity: Record<string, any>,
  rule: UnifiedDynamicRule,
  context: {
    touchpoints?: Touchpoint[];
    linkedContacts?: Contact[];
    linkedLeads?: Lead[];
    linkedDeals?: Deal[];
  } = {}
): boolean {
  const { field, operator, value } = rule;
  const trimmedTarget = (value ?? '').trim();

  // If not 'is_empty' and value is blank, don't filter out
  if (operator !== 'is_empty' && !trimmedTarget) {
    return true;
  }

  const tps = getEntityTouchpoints(entity, context.touchpoints ?? []);

  // Resolve candidate values for the field (can be array of values for touchpoints/campaigns)
  let candidates: any[] = [];

  if (field === 'tp_channel') {
    const directCh = normalizeChannelKey(entity.channel);
    if (directCh) candidates.push(directCh);
    for (const tp of tps) {
      const c = normalizeChannelKey(tp.channel);
      if (c) candidates.push(c);
    }
    for (const c of context.linkedContacts ?? []) {
      const ch = normalizeChannelKey(c.channel);
      if (ch) candidates.push(ch);
    }
  } else if (field === 'tp_count') {
    const count = Math.max(tps.length, entity.channel ? 1 : 0);
    candidates = [count];
  } else if (field === 'campaign_name') {
    if (entity.campaign) candidates.push(entity.campaign);
    if (entity.utmCampaign) candidates.push(entity.utmCampaign);
    if (entity.source) candidates.push(entity.source);
    if (entity.primarySource) candidates.push(entity.primarySource);
    for (const tp of tps) {
      if (tp.campaign) candidates.push(tp.campaign);
      if (tp.summary) candidates.push(tp.summary);
    }
  } else if (field === 'ad_id') {
    if (entity.adId) candidates.push(entity.adId);
    for (const tp of tps) {
      if (tp.adId) candidates.push(tp.adId);
    }
    for (const l of context.linkedLeads ?? []) {
      if (l.adId) candidates.push(l.adId);
    }
  } else if (field === 'utm_source') {
    if (entity.utmSource) candidates.push(entity.utmSource);
    if (entity.source) candidates.push(entity.source);
    if (entity.primarySource) candidates.push(entity.primarySource);
    if (entity.channel) candidates.push(entity.channel);
    for (const tp of tps) {
      if (tp.utmSource) candidates.push(tp.utmSource);
      if (tp.channel) candidates.push(tp.channel);
      if (tp.campaign) candidates.push(tp.campaign);
    }
  } else if (field.startsWith('custom:')) {
    const rawKey = field.slice('custom:'.length);
    const customMap = entity.customValues ?? {};
    const val = customMap[rawKey] ?? entity[rawKey];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      candidates = [val];
    }
  } else {
    const val = entity[field];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      candidates = [val];
    }
  }

  if (operator === 'is_empty') {
    return candidates.length === 0 || candidates.every((c) => String(c ?? '').trim() === '');
  }

  if (candidates.length === 0) {
    return operator === 'not_equals';
  }

  const targetLower = trimmedTarget.toLowerCase();
  const targetNum = Number(trimmedTarget);

  const matchSingle = (rawVal: any): boolean => {
    const strVal = String(rawVal ?? '').trim().toLowerCase();
    const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    const bothNumeric =
      !Number.isNaN(numVal) &&
      !Number.isNaN(targetNum) &&
      strVal !== '' &&
      trimmedTarget !== '';

    switch (operator) {
      case 'equals':
        if (field === 'tp_channel') {
          return normalizeChannelKey(strVal) === normalizeChannelKey(targetLower);
        }
        if (field === 'utm_source') {
          if (targetLower === 'meta') {
            return (
              strVal.includes('meta') ||
              strVal.includes('ميتا') ||
              strVal.includes('facebook') ||
              strVal.includes('فيسبوك') ||
              strVal.includes('instagram') ||
              strVal.includes('إنستغرام') ||
              strVal.includes('واتساب') ||
              strVal.includes('whatsapp')
            );
          }
          return strVal.includes(targetLower) || normalizeChannelKey(strVal) === targetLower;
        }
        if (bothNumeric) return numVal === targetNum;
        return strVal === targetLower;
      case 'not_equals':
        if (field === 'tp_channel') {
          return normalizeChannelKey(strVal) !== normalizeChannelKey(targetLower);
        }
        if (bothNumeric) return numVal !== targetNum;
        return strVal !== targetLower;
      case 'contains':
        return strVal.includes(targetLower);
      case 'gt':
        if (bothNumeric) return numVal > targetNum;
        return strVal > targetLower;
      case 'gte':
        if (bothNumeric) return numVal >= targetNum;
        return strVal >= targetLower;
      case 'lt':
        if (bothNumeric) return numVal < targetNum;
        return strVal < targetLower;
      case 'lte':
        if (bothNumeric) return numVal <= targetNum;
        return strVal <= targetLower;
      default:
        return true;
    }
  };

  if (operator === 'not_equals') {
    return candidates.every(matchSingle);
  }
  return candidates.some(matchSingle);
}

export function extractCampaignAndAdOptions(
  leads: Lead[],
  touchpoints: Touchpoint[]
): { campaigns: string[]; adIds: string[] } {
  const campaignSet = new Set<string>([
    'حملة التحول الرقمي لكبار العملاء Q4',
    'حملة إعادة استهداف العملاء VIP عبر واتساب',
    'حملة القطاع الطبي والعيادات - الرياض',
    'حملة التطوير العقاري والمجمعات السكنية',
    'حملة متاجر التجارة الإلكترونية Instagram',
  ]);
  const adIdSet = new Set<string>([
    'meta_ad_992817261',
    'wa_bcast_vip_2026',
    'meta_ad_881726354',
    'ctwa_ad_7746152',
    'ig_reel_ad_44321',
  ]);

  for (const l of leads) {
    if (l.campaign?.trim()) campaignSet.add(l.campaign.trim());
    if (l.utmCampaign?.trim()) campaignSet.add(l.utmCampaign.trim());
    if (l.adId?.trim()) adIdSet.add(l.adId.trim());
  }
  for (const tp of touchpoints) {
    if (tp.campaign?.trim()) campaignSet.add(tp.campaign.trim());
    if (tp.adId?.trim()) adIdSet.add(tp.adId.trim());
  }

  return {
    campaigns: Array.from(campaignSet),
    adIds: Array.from(adIdSet),
  };
}
