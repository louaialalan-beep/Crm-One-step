import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  Hash,
  IdCard,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  SlidersHorizontal,
  Tag,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { LeadChannel, LeadStatus } from '../../types/crm';
import { generateLeadUniqueId } from '../../utils/formatters';
import {
  findLiveDuplicatesForInput,
  isValidEmailFormat,
  isValidSaudiWhatsappPhone,
  LEAD_OWNERS,
  LEAD_STAGES,
  parseLeadsCsv,
  pickRoundRobinOwner,
} from '../../utils/leadsLogic';

interface CreateLeadModalProps {
  open: boolean;
  initialTab?: 'manual' | 'csv';
  onClose: () => void;
  onCreated: (leadId: string) => void;
  onInspectExisting: (leadId: string) => void;
}

const SAMPLE_CSV = `الاسم الكامل,الجوال,البريد الإلكتروني,القناة المفضلة,المدينة / الدولة,مصدر الاستقطاب الأساسي,المرحلة,مالك السجل,الوسوم,الملاحظات
ياسر عبد الله الفوزان,+966 55 812 9044,y.alfozan@najd-tech.sa,واتساب,"الرياض، السعودية",إعلان ميتا - السحابة Q4,جديد,سلمان القحطاني,ساخن | طلب_فوري,مهتم بالربط المباشر مع واتساب الأعمال
ريم محمد العتيبي,+966 50 944 1180,r.alotaibi@madar-srv.sa,إنستغرام,"جدة، السعودية",حملة إنستغرام الممولة,تم التواصل,نورة السبيعي,عرض_حي,تطلب حجز جلسة عرض حي الأسبوع القادم`;

const LEAD_SOURCES = [
  'إعلانات ميتا (Lead Ads)',
  'واتساب الأعمال المباشر',
  'إنستغرام — رسالة إعلانية',
  'فيسبوك ماسنجر',
  'نموذج الموقع الإلكتروني',
  'اتصال هاتفي مباشر',
  'إحالة عميل حالي',
  'بوابة الشركاء',
];

const COUNTRIES = [
  'المملكة العربية السعودية',
  'الإمارات العربية المتحدة',
  'الكويت',
  'قطر',
  'البحرين',
  'سلطنة عمان',
  'مصر',
  'الأردن',
];

const QUICK_TAG_SUGGESTIONS = ['ساخن', 'عميل_VIP', 'حملة_الصيف', 'طلب_فوري', 'مؤتمر_ليب'];

const META_CHANNELS: Array<{
  id: Extract<LeadChannel, 'whatsapp' | 'instagram' | 'phone' | 'messenger'>;
  label: string;
}> = [
  { id: 'whatsapp', label: 'واتساب' },
  { id: 'instagram', label: 'إنستغرام' },
  { id: 'phone', label: 'هاتف مباشر' },
  { id: 'messenger', label: 'ماسنجر' },
];

const ROUND_ROBIN_VALUE = '__round_robin__';

function buildFullSaudiPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('05')) return `+966 ${digits.slice(1)}`;
  return `+966 ${trimmed}`;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  open,
  initialTab = 'manual',
  onClose,
  onCreated,
  onInspectExisting,
}) => {
  const {
    leads,
    customFields,
    currentUser,
    getFieldAccess,
    createLead,
    importLeadsBatch,
  } = useCrm();

  const [formMode, setFormMode] = useState<'quick' | 'full'>('full');

  // Core info
  const [ownerSelection, setOwnerSelection] = useState<string>(ROUND_ROBIN_VALUE);
  const [status, setStatus] = useState<LeadStatus>('جديد');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [email, setEmail] = useState('');
  const [altContact, setAltContact] = useState('');
  const [tags, setTags] = useState<string[]>(['ساخن']);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // Dynamic tenant custom fields
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean>>({});

  // Meta & Attribution
  const [channel, setChannel] = useState<LeadChannel>('whatsapp');
  const [source, setSource] = useState<string>(LEAD_SOURCES[0]);
  const [campaign, setCampaign] = useState('');
  const [adId, setAdId] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');

  // Geographic Address & Qualification Notes
  const [country, setCountry] = useState('المملكة العربية السعودية');
  const [cityName, setCityName] = useState('الرياض');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  // CSV tab state
  const [csvText, setCsvText] = useState('');

  // UI feedback state
  const [errorMsg, setErrorMsg] = useState('');
  const [savedAnotherBanner, setSavedAnotherBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ownerOptions = useMemo(() => {
    const list = [...LEAD_OWNERS];
    const shortCurrent = currentUser.fullName.trim();
    if (shortCurrent && !list.some((o) => shortCurrent.includes(o) || o.includes(shortCurrent))) {
      list.push(shortCurrent);
    }
    return list;
  }, [currentUser.fullName]);

  const roundRobinAssignee = useMemo(
    () => pickRoundRobinOwner(leads, ownerOptions),
    [leads, ownerOptions]
  );

  const resolvedOwnerName =
    ownerSelection === ROUND_ROBIN_VALUE ? roundRobinAssignee : ownerSelection;

  const nextUniqueId = useMemo(
    () => generateLeadUniqueId(leads.map((l) => l.unique_id)),
    [leads]
  );

  const combinedPhone = useMemo(() => buildFullSaudiPhone(phoneInput), [phoneInput]);

  const isWhatsappValid = useMemo(
    () => isValidSaudiWhatsappPhone(combinedPhone),
    [combinedPhone]
  );

  const isEmailValid = useMemo(() => isValidEmailFormat(email), [email]);

  const liveDuplicates = useMemo(
    () => findLiveDuplicatesForInput(leads, { phone: combinedPhone, email }),
    [combinedPhone, email, leads]
  );

  const leadCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'leads')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const visibleCustomFields = useMemo(
    () =>
      leadCustomFields.filter((cf) => getFieldAccess('leads', cf.fieldKey) !== 'hidden'),
    [getFieldAccess, leadCustomFields]
  );

  const parsedCsvDrafts = useMemo(() => parseLeadsCsv(csvText), [csvText]);

  const resetManualForm = useCallback(() => {
    setOwnerSelection(ROUND_ROBIN_VALUE);
    setStatus('جديد');
    setFirstName('');
    setLastName('');
    setPhoneInput('');
    setEmail('');
    setAltContact('');
    setTags(['ساخن']);
    setAddingTag(false);
    setNewTagText('');
    setCustomValues({});
    setChannel('whatsapp');
    setSource(LEAD_SOURCES[0]);
    setCampaign('');
    setAdId('');
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setCountry('المملكة العربية السعودية');
    setCityName('الرياض');
    setDistrict('');
    setPostalCode('');
    setNotes('');
    setErrorMsg('');
  }, []);

  useEffect(() => {
    if (open) {
      setErrorMsg('');
      setSavedAnotherBanner('');
    }
  }, [open]);

  const validateManualForm = useCallback(
    (isDraft: boolean): string | null => {
      const fullNameCombined = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      if (!fullNameCombined) {
        return 'يرجى إدخال الاسم الأول والاسم الأخير للعميل المحتمل.';
      }
      if (!isDraft && !firstName.trim()) {
        return 'يرجى إدخال الاسم الأول.';
      }
      if (!isDraft && !phoneInput.trim()) {
        return 'يرجى إدخال رقم الجوال الأساسي للعميل.';
      }
      if (!isDraft) {
        for (const cf of visibleCustomFields) {
          const access = getFieldAccess('leads', cf.fieldKey);
          if (
            cf.required &&
            access === 'read_write' &&
            !String(customValues[cf.fieldKey] ?? '').trim()
          ) {
            return `يرجى تعبئة الحقل الإلزامي: ${cf.label}`;
          }
        }
      }
      return null;
    },
    [customValues, firstName, getFieldAccess, lastName, phoneInput, visibleCustomFields]
  );

  const missingRequiredCount = useMemo(() => {
    let missing = 0;
    if (!firstName.trim()) missing += 1;
    if (!lastName.trim()) missing += 1;
    if (!phoneInput.trim()) missing += 1;
    for (const cf of visibleCustomFields) {
      if (
        cf.required &&
        getFieldAccess('leads', cf.fieldKey) === 'read_write' &&
        !String(customValues[cf.fieldKey] ?? '').trim()
      ) {
        missing += 1;
      }
    }
    return missing;
  }, [customValues, firstName, getFieldAccess, lastName, phoneInput, visibleCustomFields]);

  const submitLeadRecord = useCallback(
    async (mode: 'save' | 'save_and_new' | 'draft') => {
      setErrorMsg('');
      setSavedAnotherBanner('');

      const isDraft = mode === 'draft';
      const validationError = validateManualForm(isDraft);
      if (validationError) {
        setErrorMsg(validationError);
        return;
      }

      setSubmitting(true);
      try {
        const fullNameCombined = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const finalTags = isDraft
          ? Array.from(new Set([...tags, 'مسودة'])).slice(0, 20)
          : tags;

        const shortCountry =
          country === 'المملكة العربية السعودية' ? 'السعودية' : country.trim();
        const combinedCity = [cityName.trim(), shortCountry].filter(Boolean).join('، ');

        const mergedCustomValues: Record<string, string | number | boolean> = {
          ...customValues,
          ...(country.trim() ? { addressCountry: country.trim() } : {}),
          ...(district.trim() ? { addressDistrict: district.trim() } : {}),
          ...(postalCode.trim() ? { addressPostalCode: postalCode.trim() } : {}),
        };

        const created = await createLead({
          fullName: fullNameCombined,
          phone: combinedPhone || undefined,
          email: email.trim() || undefined,
          altContact: altContact.trim().slice(0, 160) || undefined,
          channel,
          city: combinedCity || 'الرياض، السعودية',
          source: source.trim() || LEAD_SOURCES[0],
          campaign: campaign.trim() || undefined,
          adId: adId.trim() || undefined,
          utmSource: utmSource.trim() || undefined,
          utmMedium: utmMedium.trim() || undefined,
          utmCampaign: utmCampaign.trim() || undefined,
          status: isDraft ? 'جديد' : status,
          estimatedValue: 0,
          assignedToName: resolvedOwnerName,
          tags: finalTags,
          notes: notes.trim() || undefined,
          customValues:
            Object.keys(mergedCustomValues).length > 0 ? mergedCustomValues : undefined,
        });

        if (mode === 'save_and_new') {
          resetManualForm();
          setSavedAnotherBanner(
            `تم حفظ العميل (${created.fullName} — ${created.unique_id}) وتسجيل نقطة الدخول بنجاح. يمكنك إضافة سجل جديد الآن.`
          );
          return;
        }

        resetManualForm();
        onCreated(created.id);
        onClose();
      } finally {
        setSubmitting(false);
      }
    },
    [
      adId,
      altContact,
      campaign,
      channel,
      cityName,
      combinedPhone,
      country,
      createLead,
      customValues,
      district,
      email,
      firstName,
      lastName,
      notes,
      onClose,
      onCreated,
      postalCode,
      resetManualForm,
      resolvedOwnerName,
      source,
      status,
      tags,
      utmCampaign,
      utmMedium,
      utmSource,
      validateManualForm,
    ]
  );

  // Ctrl+S / Cmd+S shortcut for manual create view
  useEffect(() => {
    if (!open || initialTab !== 'manual') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!submitting) {
          void submitLeadRecord('save');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialTab, open, submitLeadRecord, submitting]);

  const handleAddTag = (tagVal?: string) => {
    const clean = (tagVal ?? newTagText).trim().replace(/^#/, '');
    if (!clean) return;
    setTags((prev) => Array.from(new Set([...prev, clean])).slice(0, 20));
    if (!tagVal) {
      setNewTagText('');
      setAddingTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedCsvDrafts.length === 0) {
      setErrorMsg('لم يتم التعرف على صفوف صالحة في ملف CSV.');
      return;
    }
    setSubmitting(true);
    try {
      await importLeadsBatch(parsedCsvDrafts);
      setCsvText('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // CSV Import remains a focused dialog when opened from split-button dropdown
  if (initialTab === 'csv') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="استيراد عملاء من CSV"
      >
        <div className="fixed inset-0 bg-[#0F172A]/45" onClick={onClose} aria-hidden="true" />
        <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] drawer-surface max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#0F172A]">استيراد عملاء من ملف CSV</h2>
                <p className="text-[12px] text-[#64748B]">
                  توليد معرف RWQ تلقائياً لكل صف مستورد مع ربط قنوات الاستقطاب.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة استيراد CSV"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleImportSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {errorMsg && (
                <div className="rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-[12px] font-semibold text-[#E11D48]">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-5 w-5 text-[#10B981]" />
                  <div>
                    <p className="text-[13px] font-bold text-[#0F172A]">رفع ملف CSV أو لصق البيانات</p>
                    <p className="text-[11px] text-[#64748B]">
                      يدعم الأعمدة العربية والإنجليزية مع توليد معرف RWQ تلقائياً لكل صف.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvText(SAMPLE_CSV)}
                    className="h-8 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    تحميل نموذج تجريبي
                  </button>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded bg-[#2563EB] px-3 text-[11px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>اختيار ملف</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="الصق محتوى CSV هنا..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] p-3 text-[12px] font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />

              {parsedCsvDrafts.length > 0 && (
                <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                  <div className="bg-[#F8FAFC] px-3 py-2 text-[12px] font-bold text-[#0F172A] border-b border-[#E2E8F0] tabular-nums">
                    معاينة الصفوف الجاهزة للاستيراد ({parsedCsvDrafts.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[#E2E8F0]">
                    {parsedCsvDrafts.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-[12px]">
                        <div>
                          <span className="font-semibold text-[#0F172A]">{row.fullName}</span>
                          <span className="text-[#64748B]"> · {row.city || row.source || '—'}</span>
                        </div>
                        <span className="text-[11px] text-[#475569] tabular-nums">
                          {row.phone || '—'} · {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-4 text-[13px] font-medium text-[#0F172A]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || parsedCsvDrafts.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {submitting ? 'جاري الاستيراد...' : `استيراد ${parsedCsvDrafts.length} عملاء`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const renderChannelCardIcon = (
    chId: Extract<LeadChannel, 'whatsapp' | 'instagram' | 'phone' | 'messenger'>,
    active: boolean
  ) => {
    if (chId === 'whatsapp') {
      return (
        <MessageCircle
          className={`h-4 w-4 ${active ? 'text-[#047857]' : 'text-[#059669]'}`}
        />
      );
    }
    if (chId === 'instagram') {
      return (
        <Camera
          className={`h-4 w-4 ${active ? 'text-[#4338CA]' : 'text-[#6366F1]'}`}
        />
      );
    }
    if (chId === 'phone') {
      return (
        <Phone className={`h-4 w-4 ${active ? 'text-[#1D4ED8]' : 'text-[#64748B]'}`} />
      );
    }
    return (
      <MessageSquare
        className={`h-4 w-4 ${active ? 'text-[#1D4ED8]' : 'text-[#2563EB]'}`}
      />
    );
  };

  return (
    <div
      className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 -mb-4 lg:-mb-6 min-h-[calc(100vh-64px)] flex flex-col justify-between bg-[#F8FAFC]"
      role="region"
      aria-label="إضافة عميل محتمل جديد"
    >
      <div className="flex-1">
        {/* 1. Flush White Header Strip */}
        <div className="w-full bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center text-[#2563EB] shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[18px] lg:text-[20px] font-bold text-[#0F172A] leading-tight">
                  إضافة عميل محتمل جديد
                </h1>
                <span className="text-[11px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full tabular-nums">
                  {nextUniqueId}
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                أدخل بيانات العميل يدوياً أو تتبع مصادر الحملات الرقمية تلقائياً
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]"
              role="tablist"
              aria-label="وضع إدخال العميل"
            >
              <button
                type="button"
                role="tab"
                aria-selected={formMode === 'quick'}
                onClick={() => setFormMode('quick')}
                className={`px-3 py-1 rounded-md text-[12px] transition-all whitespace-nowrap ${
                  formMode === 'quick'
                    ? 'bg-[#FFFFFF] text-[#2563EB] font-bold shadow-2xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                إدخال سريع
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={formMode === 'full'}
                onClick={() => setFormMode('full')}
                className={`px-3 py-1 rounded-md text-[12px] transition-all whitespace-nowrap ${
                  formMode === 'full'
                    ? 'bg-[#FFFFFF] text-[#2563EB] font-bold shadow-2xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                النموذج الكامل
              </button>
            </div>

            <Link
              to="/settings/custom-fields"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[12px] font-semibold transition-colors whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5 text-[#64748B]" />
              <span>تخصيص التخطيط والصلاحيات</span>
            </Link>
          </div>
        </div>

        {/* 2. Form Content */}
        <form
          id="createLeadFullForm"
          onSubmit={(e) => {
            e.preventDefault();
            void submitLeadRecord('save');
          }}
          className="w-full px-6 pt-4 pb-24 space-y-4"
        >
          {errorMsg && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-4 py-2.5 text-[12px] font-semibold text-[#BE123C]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="text-[#BE123C] hover:opacity-75"
                aria-label="إغلاق رسالة الخطأ"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {savedAnotherBanner && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-semibold text-[#065F46]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                <span>{savedAnotherBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setSavedAnotherBanner('')}
                className="text-[#065F46] hover:opacity-75"
                aria-label="إغلاق تنبيه الحفظ"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            className={
              formMode === 'full'
                ? 'grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 items-start w-full'
                : 'max-w-4xl mx-auto w-full'
            }
          >
            {/* RIGHT COLUMN (55%): المعلومات الأساسية والتأهيل */}
            <section className="bg-[#FFFFFF] p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 bg-[#F8FAFC] -mx-5 -mt-5 px-5 pt-3.5 rounded-t-xl border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center text-[#2563EB]">
                    <IdCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] text-[#0F172A] font-bold">
                      المعلومات الأساسية والتأهيل
                    </h2>
                    <p className="text-[11px] text-[#64748B]">
                      البيانات التعريفية وتخصيصات المنشأة المعتمدة
                    </p>
                  </div>
                </div>
                <span className="text-[11px] bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] px-2 py-0.5 rounded font-bold">
                  مطلوب *
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5">
                {/* مالك السجل (with Round-Robin auto-assign option) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#0F172A] font-semibold flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5">
                      <span>مالك السجل</span>
                      {ownerSelection === ROUND_ROBIN_VALUE && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] px-1.5 py-0.5 rounded font-semibold">
                          <RefreshCw className="h-2.5 w-2.5" />
                          <span>Round-Robin</span>
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOwnerSelection(ROUND_ROBIN_VALUE)}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline"
                    >
                      توزيع تلقائي
                    </button>
                  </label>
                  <select
                    aria-label="مالك السجل"
                    value={ownerSelection}
                    onChange={(e) => setOwnerSelection(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                  >
                    <option value={ROUND_ROBIN_VALUE}>
                      توزيع تلقائي (Round-Robin) — التالي: {roundRobinAssignee}
                    </option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </div>

                {/* مرحلة التأهيل */}
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#0F172A] font-semibold flex items-center gap-1">
                    <span>مرحلة التأهيل</span>
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    aria-label="مرحلة التأهيل"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                    className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                  >
                    {LEAD_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* الاسم الأول */}
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#0F172A] font-semibold flex items-center gap-1">
                    <span>الاسم الأول</span>
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثال: عبد الرحمن"
                    className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                  />
                </div>

                {/* الاسم الأخير */}
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#0F172A] font-semibold flex items-center gap-1">
                    <span>الاسم الأخير</span>
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثال: العتيبي"
                    className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                  />
                </div>

                {/* رقم الجوال الأساسي + Live WhatsApp & Duplicate Check */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-[12px] text-[#0F172A] font-semibold flex items-center gap-1">
                      <span>رقم الجوال الأساسي</span>
                      <span className="text-[#EF4444]">*</span>
                    </label>
                    {isWhatsappValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        <span>رقم واتساب نشط ومفحوص ✓</span>
                      </span>
                    ) : phoneInput.trim().length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                        <span>أدخل 9 أرقام تبدأ بـ 5 للتحقق من واتساب</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
                        <span>تحقق واتساب وتكرار لحظي</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 h-10 px-3 bg-[#FFFFFF] rounded-lg border border-[#CBD5E1] text-[#0F172A] shrink-0">
                      <span className="text-[12px] font-bold tabular-nums" dir="ltr">
                        +966
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="50 123 4567"
                        className="w-full h-10 text-left pl-3 pr-9 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px] font-mono tabular-nums tracking-wide"
                      />
                      <Phone className="h-4 w-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Live Duplicate Phone / Email Check Alert */}
                  {liveDuplicates.length > 0 ? (
                    <div className="mt-1.5 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#B45309]">
                        <AlertTriangle className="h-4 w-4 text-[#D97706] shrink-0" />
                        <span>
                          تنبيه تكرار لحظي: تم العثور على {liveDuplicates.length} سجل مطابق في
                          قاعدة البيانات!
                        </span>
                      </div>
                      <div className="space-y-1">
                        {liveDuplicates.map(({ lead, reason }) => (
                          <div
                            key={lead.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-[#FFFFFF] border border-[#FDE68A] px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="text-[#0F172A]">
                              <strong>{lead.fullName}</strong>{' '}
                              <span className="text-[#64748B] tabular-nums">({lead.unique_id})</span>{' '}
                              — {reason}
                            </span>
                            <button
                              type="button"
                              onClick={() => onInspectExisting(lead.id)}
                              className="text-[11px] font-bold text-[#2563EB] hover:underline shrink-0"
                            >
                              فتح السجل
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (isWhatsappValid || isEmailValid) ? (
                    <div className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                      <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                      <span className="text-[11px] font-semibold">
                        تنبيه النظام الذكي: الرقم والبريد فريد — لا يوجد سجل مكرر في قاعدة البيانات
                        (سجل فريد 100%)
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* البريد الإلكتروني */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-[#0F172A] font-semibold">
                      البريد الإلكتروني
                    </label>
                    {isEmailValid && (
                      <span className="text-[10px] font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-1.5 py-0.5 rounded">
                        مفحوص MX ✓
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.sa"
                      className="w-full h-10 pl-9 pr-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px] text-left font-mono"
                    />
                    <Mail className="h-4 w-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* بريد إلكتروني بديل / هاتف إضافي */}
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#0F172A] font-semibold">
                    بريد إلكتروني بديل / هاتف إضافي
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    maxLength={160}
                    value={altContact}
                    onChange={(e) => setAltContact(e.target.value)}
                    placeholder="personal@gmail.com / +966 5..."
                    className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px] text-left font-mono tabular-nums"
                  />
                </div>

                {/* Quick Mode inline Channel & Source */}
                {formMode === 'quick' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        قناة التواصل المفضلة
                      </label>
                      <select
                        aria-label="قناة التواصل المفضلة"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as LeadChannel)}
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                      >
                        {META_CHANNELS.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        مصدر العميل <span className="text-[#EF4444]">*</span>
                      </label>
                      <select
                        aria-label="مصدر العميل"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                      >
                        {LEAD_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Dynamic Tenant Custom Fields (FLS-aware: read_write / read_only / hidden) */}
                {visibleCustomFields.length > 0 &&
                  (formMode === 'full' ||
                    visibleCustomFields.some((cf) => cf.required)) && (
                    <>
                      <div className="md:col-span-2 pt-2 pb-0.5 border-t border-[#F1F5F9] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-[#6366F1]" />
                          <span className="text-[12px] font-bold text-[#1E293B]">
                            حقول مخصصة للمنشأة (Tenant Custom Fields)
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                          خاضعة لصلاحيات FLS
                        </span>
                      </div>

                      {visibleCustomFields.map((cf) => {
                        const access = getFieldAccess('leads', cf.fieldKey);
                        if (access === 'hidden') return null;
                        if (formMode === 'quick' && !cf.required) return null;

                        const isReadOnly = access === 'read_only';
                        const val = customValues[cf.fieldKey] ?? '';

                        return (
                          <div key={cf.id} className="flex flex-col gap-1">
                            <label className="text-[12px] text-[#0F172A] font-semibold flex items-center justify-between gap-1">
                              <span>
                                {cf.label}
                                {cf.required && <span className="text-[#EF4444]"> *</span>}
                              </span>
                              {isReadOnly ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 rounded">
                                  <Lock className="h-2.5 w-2.5" />
                                  <span>قراءة فقط</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-1.5 py-0.5 rounded">
                                  مخصص
                                </span>
                              )}
                            </label>

                            {cf.fieldType === 'select' && cf.options ? (
                              <select
                                value={String(val)}
                                disabled={isReadOnly}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [cf.fieldKey]: e.target.value,
                                  }))
                                }
                                className="w-full h-10 px-3 bg-[#FFFFFF] disabled:bg-[#F8FAFC] disabled:text-[#64748B] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                              >
                                <option value="">اختر...</option>
                                {cf.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : cf.fieldType === 'boolean' ? (
                              <label className="flex items-center gap-2 h-10 px-3 bg-[#FFFFFF] rounded-lg border border-[#CBD5E1] text-[13px] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val)}
                                  disabled={isReadOnly}
                                  onChange={(e) =>
                                    setCustomValues((prev) => ({
                                      ...prev,
                                      [cf.fieldKey]: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                                />
                                <span>{Boolean(val) ? 'نعم' : 'لا'}</span>
                              </label>
                            ) : (
                              <input
                                type={
                                  cf.fieldType === 'number' || cf.fieldType === 'currency'
                                    ? 'number'
                                    : cf.fieldType === 'date'
                                    ? 'date'
                                    : cf.fieldType === 'email'
                                    ? 'email'
                                    : 'text'
                                }
                                value={String(val)}
                                disabled={isReadOnly}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [cf.fieldKey]: e.target.value,
                                  }))
                                }
                                placeholder={isReadOnly ? 'مقيد بالصلاحية' : `أدخل ${cf.label}`}
                                className="w-full h-10 px-3 bg-[#FFFFFF] disabled:bg-[#F8FAFC] disabled:text-[#64748B] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px] tabular-nums"
                              />
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                {/* الوسوم (Tags) */}
                {formMode === 'full' && (
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[12px] text-[#0F172A] font-semibold">
                      الوسوم والتصنيف السريع (Tags)
                    </label>
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg min-h-[44px]">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] text-[12px] rounded-lg font-semibold"
                        >
                          <Tag className="h-3 w-3 text-[#2563EB]" />
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            aria-label={`إزالة وسم ${t}`}
                            className="text-[#94A3B8] hover:text-[#DC2626] font-bold leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {addingTag ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            value={newTagText}
                            onChange={(e) => setNewTagText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                              } else if (e.key === 'Escape') {
                                setAddingTag(false);
                                setNewTagText('');
                              }
                            }}
                            placeholder="اسم الوسم..."
                            autoFocus
                            className="h-7 w-28 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px] text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTag()}
                            className="h-7 rounded-md bg-[#2563EB] px-2 text-[11px] font-bold text-[#FFFFFF]"
                          >
                            إضافة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTag(false);
                              setNewTagText('');
                            }}
                            className="h-7 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-1.5 text-[11px] text-[#64748B]"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingTag(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FFFFFF] border border-dashed border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] text-[11px] rounded-lg transition-colors font-bold"
                        >
                          <Plus className="h-3 w-3" />
                          <span>إضافة وسم</span>
                        </button>
                      )}
                    </div>

                    {addingTag && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-[#64748B]">اقتراحات:</span>
                        {QUICK_TAG_SUGGESTIONS.filter((s) => !tags.includes(s)).map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleAddTag(sug)}
                            className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-0.5 text-[10px] font-semibold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* LEFT COLUMN (45%): Card 1 (Meta & Attribution) + Card 2 (Address & Notes) */}
            {formMode === 'full' && (
              <div className="flex flex-col gap-4">
                {/* Card 1: بيانات ميتا والمصدر الذكي */}
                <section className="bg-[#FFFFFF] p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
                  <div className="flex items-center justify-between pb-3 mb-4 bg-[#F8FAFC] -mx-5 -mt-5 px-5 pt-3.5 rounded-t-xl border-b border-[#E2E8F0] gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center text-[#2563EB]">
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-[15px] text-[#0F172A] font-bold">
                          بيانات ميتا والمصدر الذكي (Meta &amp; Attribution)
                        </h2>
                        <p className="text-[11px] text-[#64748B]">
                          تتبع الحملات الترويجية ومعلمات UTM تلقائياً
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] px-2 py-0.5 rounded-full font-bold">
                        API Live
                      </span>
                      <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] px-2 py-0.5 rounded-full font-bold">
                        Meta Partner
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-y-3.5">
                    {/* قناة التواصل المفضلة */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        قناة التواصل المفضلة
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {META_CHANNELS.map((ch) => {
                          const active = channel === ch.id;
                          return (
                            <label
                              key={ch.id}
                              className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                                active
                                  ? ch.id === 'whatsapp'
                                    ? 'bg-[#ECFDF5]/70 border-2 border-[#10B981] text-[#065F46]'
                                    : 'bg-[#EFF6FF]/70 border-2 border-[#2563EB] text-[#1E3A8A]'
                                  : 'bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              <input
                                type="radio"
                                name="comm_channel"
                                checked={active}
                                onChange={() => setChannel(ch.id)}
                                className="h-3.5 w-3.5 accent-[#10B981]"
                              />
                              {renderChannelCardIcon(ch.id, active)}
                              <span className="text-[12px] font-semibold">{ch.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* مصدر العميل */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold flex items-center gap-1">
                        <span>مصدر العميل</span>
                        <span className="text-[#EF4444]">*</span>
                      </label>
                      <select
                        aria-label="مصدر العميل"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                      >
                        {LEAD_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* اسم الحملة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        اسم الحملة الإعلانية (Campaign)
                      </label>
                      <input
                        type="text"
                        value={campaign}
                        onChange={(e) => setCampaign(e.target.value)}
                        placeholder="[ميتا] حملة أصحاب الأعمال - الرياض Q2"
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px]"
                      />
                    </div>

                    {/* معرف الإعلان */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold flex items-center justify-between">
                        <span>معرّف الإعلان (Ad ID / Form ID)</span>
                        <span className="text-[10px] text-[#64748B] font-mono">Meta ID</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          dir="ltr"
                          value={adId}
                          onChange={(e) => setAdId(e.target.value)}
                          placeholder="META_AD_984210984"
                          className="w-full h-10 pl-3 pr-9 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 font-mono text-[12px] text-left"
                        />
                        <Hash className="h-4 w-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* معاملات UTM */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        معاملات التتبع (UTM Parameters)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={utmSource}
                          onChange={(e) => setUtmSource(e.target.value)}
                          placeholder="utm_source"
                          title="UTM Source"
                          className="w-full h-9 px-2.5 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] font-mono text-[11px] text-left"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={utmMedium}
                          onChange={(e) => setUtmMedium(e.target.value)}
                          placeholder="utm_medium"
                          title="UTM Medium"
                          className="w-full h-9 px-2.5 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] font-mono text-[11px] text-left"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={utmCampaign}
                          onChange={(e) => setUtmCampaign(e.target.value)}
                          placeholder="utm_campaign"
                          title="UTM Campaign"
                          className="w-full h-9 px-2.5 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] font-mono text-[11px] text-left"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Card 2: العنوان الجغرافي والملاحظات */}
                <section className="bg-[#FFFFFF] p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
                  <div className="flex items-center justify-between pb-3 mb-4 bg-[#F8FAFC] -mx-5 -mt-5 px-5 pt-3.5 rounded-t-xl border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#059669]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-[15px] text-[#0F172A] font-bold">
                          العنوان الجغرافي والملاحظات
                        </h2>
                        <p className="text-[11px] text-[#64748B]">
                          بيانات الموقع الجغرافي وملاحظات التأهيل الأولية
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* الدولة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">الدولة</label>
                      <div className="relative">
                        <select
                          aria-label="الدولة"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full h-10 pr-8 pl-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <Globe className="h-4 w-4 text-[#94A3B8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* المدينة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">المدينة</label>
                      <input
                        type="text"
                        value={cityName}
                        onChange={(e) => setCityName(e.target.value)}
                        placeholder="مثال: الرياض"
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                      />
                    </div>

                    {/* الحي / الشارع */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        الحي / الشارع
                      </label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="مثال: حي العليا - طريق الملك فهد"
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px]"
                      />
                    </div>

                    {/* الرمز البريدي */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        الرمز البريدي
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="12214"
                        className="w-full h-10 px-3 bg-[#FFFFFF] text-[#0F172A] rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#2563EB] text-[13px] font-mono tabular-nums text-left"
                      />
                    </div>

                    {/* ملاحظات التأهيل */}
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-[12px] text-[#0F172A] font-semibold">
                        ملاحظات التأهيل
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="أدخل اهتمامات العميل ومتطلبات التأهيل وملاحظات المتابعة..."
                        className="w-full p-3 bg-[#FFFFFF] text-[#0F172A] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 text-[13px] leading-relaxed"
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 3. Sticky Bottom Save Bar */}
      <div className="sticky bottom-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E2E8F0] px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2.5 flex-wrap">
          {missingRequiredCount === 0 ? (
            <div className="inline-flex items-center gap-1.5 text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1 rounded-full">
              <CheckCircle2 className="h-4 w-4 text-[#059669]" />
              <span className="text-[12px] font-bold">
                تم التحقق من الحقول الإلزامية بنجاح
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full">
              <span className="text-[12px] font-semibold tabular-nums">
                متبقي {missingRequiredCount} حقول إلزامية للحفظ
              </span>
            </div>
          )}
          <span className="hidden sm:inline text-[12px] text-[#64748B] tabular-nums">
            · المعرف التلقائي: <strong className="text-[#0F172A]">{nextUniqueId}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              resetManualForm();
              onClose();
            }}
            className="h-9 px-4 bg-[#FFFFFF] border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] text-[13px] rounded-lg transition-colors font-semibold whitespace-nowrap"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitLeadRecord('draft')}
            className="h-9 px-4 bg-[#FFFFFF] border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] text-[13px] rounded-lg transition-colors font-semibold whitespace-nowrap disabled:opacity-50"
          >
            حفظ كمسودة
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitLeadRecord('save_and_new')}
            className="h-9 px-4 bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] hover:bg-[#DBEAFE] text-[13px] rounded-lg transition-colors font-bold whitespace-nowrap disabled:opacity-50"
          >
            حفظ وإضافة آخر
          </button>

          <button
            type="submit"
            form="createLeadFullForm"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] text-[13px] rounded-lg transition-colors font-bold shadow-xs whitespace-nowrap disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            <span>{submitting ? 'جاري الحفظ...' : 'حفظ السجل (Ctrl+S)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
