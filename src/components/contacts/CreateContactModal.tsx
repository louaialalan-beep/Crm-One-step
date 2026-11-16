import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Tag,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { ContactStatus, LeadChannel } from '../../types/crm';
import {
  CONTACT_OWNERS,
  CONTACT_STATUSES,
  findLiveDuplicateContactsForInput,
  parseContactsCsv,
  pickRoundRobinContactOwner,
} from '../../utils/contactsLogic';
import { CHANNEL_LABELS } from '../../utils/leadsLogic';

interface CreateContactModalProps {
  open: boolean;
  initialTab?: 'manual' | 'csv';
  onClose: () => void;
  onCreated: (contactId: string) => void;
  onInspectExisting: (contactId: string) => void;
}

const ROUND_ROBIN_VALUE = '__round_robin__';

const SAMPLE_CSV = `الاسم الكامل,المنشأة / الشركة,المسمى الوظيفي,رقم الجوال,البريد الإلكتروني,القناة,المدينة,المصدر الأساسي,الحالة,مالك السجل,الوسوم,الملاحظات
أ. ماجد عبد العزيز الدوسري,شركة الأفق السحابي,مدير المشتريات,+966 55 820 3311,m.aldosari@ofoq-cloud.sa,واتساب,"الرياض، السعودية",حملة الأعمال B2B,عميل نشط,سلمان القحطاني,B2B | باقة_مؤسسات,طلب ربط فوري لفروع الرياض وجدة
أ. سارة خالد الحربي,عميل فردي B2C,مستشارة تسويق,+966 50 712 8840,sara.harbi@gmail.com,إنستغرام,"جدة، السعودية",حملة إنستغرام,بانتظار عرض سعر,نورة السبيعي,B2C,استفسار عن الباقة السنوية`;

export const CreateContactModal: React.FC<CreateContactModalProps> = ({
  open,
  initialTab = 'manual',
  onClose,
  onCreated,
  onInspectExisting,
}) => {
  const {
    contacts,
    accounts,
    customFields,
    getFieldAccess,
    createContact,
    importContactsBatch,
  } = useCrm();

  const [tab, setTab] = useState<'manual' | 'csv'>(initialTab);

  // Manual Form State
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [accountMode, setAccountMode] = useState<'none' | 'existing' | 'new'>('existing');
  const [existingAccountId, setExistingAccountId] = useState(accounts[0]?.id ?? '');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountIndustry, setNewAccountIndustry] = useState('التقنية والأعمال');

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('الرياض، السعودية');
  const [channel, setChannel] = useState<LeadChannel>('whatsapp');
  const [primarySource, setPrimarySource] = useState('إضافة مباشرة');
  const [contactStatus, setContactStatus] = useState<ContactStatus>('عميل نشط');
  const [ownerSelection, setOwnerSelection] = useState<string>(ROUND_ROBIN_VALUE);
  const [tags, setTags] = useState<string[]>(['عميل_نشط']);
  const [newTagInput, setNewTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean>>({});

  // CSV State
  const [csvText, setCsvText] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setErrorMsg('');
    setFullName('');
    setJobTitle('');
    setPhone('');
    setEmail('');
    setCity('الرياض، السعودية');
    setChannel('whatsapp');
    setPrimarySource('إضافة مباشرة');
    setContactStatus('عميل نشط');
    setOwnerSelection(ROUND_ROBIN_VALUE);
    setTags(['عميل_نشط']);
    setNewTagInput('');
    setNotes('');
    setCustomValues({});
    if (accounts.length > 0) {
      setExistingAccountId(accounts[0].id);
      setAccountMode('existing');
    } else {
      setAccountMode('none');
    }
  }, [accounts, initialTab, open]);

  const liveDuplicates = useMemo(
    () => findLiveDuplicateContactsForInput(contacts, { phone, email }),
    [contacts, email, phone]
  );

  const contactCustomFields = useMemo(
    () =>
      customFields
        .filter((cf) => cf.module === 'contacts')
        .sort((a, b) => a.order - b.order),
    [customFields]
  );

  const parsedCsvDrafts = useMemo(() => parseContactsCsv(csvText), [csvText]);

  if (!open) return null;

  const handleAddTag = () => {
    const clean = newTagInput.trim();
    if (!clean) return;
    setTags((prev) => Array.from(new Set([...prev, clean])).slice(0, 20));
    setNewTagInput('');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('يرجى إدخال الاسم الكامل لجهة الاتصال.');
      return;
    }
    if (accountMode === 'new' && !newAccountName.trim()) {
      setErrorMsg('يرجى إدخال اسم المنشأة الجديدة أو اختيار عميل فردي B2C.');
      return;
    }

    const resolvedOwner =
      ownerSelection === ROUND_ROBIN_VALUE
        ? pickRoundRobinContactOwner(contacts)
        : ownerSelection;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const created = await createContact({
        fullName: fullName.trim(),
        accountMode,
        existingAccountId: accountMode === 'existing' ? existingAccountId : undefined,
        accountName: accountMode === 'new' ? newAccountName.trim() : undefined,
        accountIndustry: accountMode === 'new' ? newAccountIndustry.trim() : undefined,
        jobTitle: jobTitle.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        channel,
        primarySource: primarySource.trim() || 'إضافة مباشرة',
        contactStatus,
        assignedToName: resolvedOwner,
        tags,
        notes: notes.trim() || undefined,
        customValues,
      });
      onCreated(created.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ جهة الاتصال.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (parsedCsvDrafts.length === 0) {
      setErrorMsg('يرجى لصق بيانات CSV صالحة أو تحميل ملف عينة أولاً.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await importContactsBatch(parsedCsvDrafts);
      onCreated(contacts[0]?.id ?? '');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر استيراد ملف CSV.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة جهة اتصال جديدة"
    >
      <div className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-4 bg-[#FFFFFF]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#131B2E]">
                إضافة جهة اتصال جديدة
              </h2>
              <p className="text-[11px] text-[#737686]">
                ربط فوري بمنشأة قائمة، عميل فردي B2C، أو استيراد دفعي عبر CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-[#F2F3FF] p-1 text-xs">
              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`rounded-lg px-3 py-1 font-semibold transition-colors ${
                  tab === 'manual'
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                    : 'text-[#737686] hover:text-[#131B2E]'
                }`}
              >
                إدخال يدوي
              </button>
              <button
                type="button"
                onClick={() => setTab('csv')}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 font-semibold transition-colors ${
                  tab === 'csv'
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                    : 'text-[#737686] hover:text-[#131B2E]'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>استيراد CSV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="rounded-lg p-1.5 text-[#737686] hover:bg-[#F2F3FF]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {tab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
                {errorMsg}
              </div>
            )}

            {/* Live Duplicate Warning */}
            {liveDuplicates.length > 0 && (
              <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#92400E]">
                  <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                  <span>تنبيه: يوجد تطابق محتمل في جهات الاتصال ({liveDuplicates.length})</span>
                </div>
                {liveDuplicates.slice(0, 2).map((dup) => (
                  <div
                    key={dup.contact.id}
                    className="flex items-center justify-between gap-2 text-[11px] text-[#78350F]"
                  >
                    <span>
                      <strong>{dup.contact.fullName}</strong> ({dup.reason})
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectExisting(dup.contact.id)}
                      className="font-bold text-[#2563EB] hover:underline"
                    >
                      عرض السجل الموجود
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: م. عبد العزيز الشهري"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  المسمى الوظيفي
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="مثال: مدير تقنية المعلومات"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  رقم الجوال
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966 50 123 4567"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#131B2E] tabular-nums focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.sa"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            {/* Account Mode */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#131B2E]">
                  <Building2 className="h-4 w-4 text-[#2563EB]" />
                  <span>ارتباط المنشأة / الحساب</span>
                </span>
                <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAccountMode('existing')}
                    className={`rounded-md px-2.5 py-1 font-semibold ${
                      accountMode === 'existing'
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'text-[#434655]'
                    }`}
                  >
                    منشأة قائمة (B2B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountMode('new')}
                    className={`rounded-md px-2.5 py-1 font-semibold ${
                      accountMode === 'new'
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'text-[#434655]'
                    }`}
                  >
                    منشأة جديدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountMode('none')}
                    className={`rounded-md px-2.5 py-1 font-semibold ${
                      accountMode === 'none'
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'text-[#434655]'
                    }`}
                  >
                    عميل فردي B2C
                  </button>
                </div>
              </div>

              {accountMode === 'existing' && (
                <select
                  value={existingAccountId}
                  onChange={(e) => setExistingAccountId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.industry})
                    </option>
                  ))}
                </select>
              )}

              {accountMode === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="اسم المنشأة الجديدة *"
                    className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E]"
                  />
                  <input
                    type="text"
                    value={newAccountIndustry}
                    onChange={(e) => setNewAccountIndustry(e.target.value)}
                    placeholder="القطاع (مثال: اللوجستيات، التقنية)"
                    className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E]"
                  />
                </div>
              )}
            </div>

            {/* Channel, Status, Source, Owner, City */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  القناة المفضلة
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as LeadChannel)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#131B2E]"
                >
                  {(Object.keys(CHANNEL_LABELS) as LeadChannel[]).map((ch) => (
                    <option key={ch} value={ch}>
                      {CHANNEL_LABELS[ch]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  حالة جهة الاتصال
                </label>
                <select
                  value={contactStatus}
                  onChange={(e) => setContactStatus(e.target.value as ContactStatus)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#131B2E]"
                >
                  {CONTACT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-bold text-[#131B2E]">
                  <RefreshCw className="h-3 w-3 text-[#2563EB]" />
                  <span>مالك السجل</span>
                </label>
                <select
                  value={ownerSelection}
                  onChange={(e) => setOwnerSelection(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#131B2E]"
                >
                  <option value={ROUND_ROBIN_VALUE}>توزيع تلقائي (Round-Robin)</option>
                  {CONTACT_OWNERS.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  المدينة / الدولة
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  المصدر الأساسي (First-Touch)
                </label>
                <input
                  type="text"
                  value={primarySource}
                  onChange={(e) => setPrimarySource(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E]"
                />
              </div>
            </div>

            {/* Dynamic Tenant Custom Fields (Contacts Module) */}
            {contactCustomFields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contactCustomFields.map((cf) => {
                  const access = getFieldAccess('contacts', cf.fieldKey);
                  if (access === 'hidden') return null;
                  const readOnly = access === 'read_only';
                  return (
                    <div key={cf.id}>
                      <label className="mb-1 flex items-center gap-1 text-xs font-bold text-[#131B2E]">
                        <span>{cf.label}</span>
                        {readOnly && <Lock className="h-3 w-3 text-[#D97706]" />}
                      </label>
                      {cf.fieldType === 'select' && cf.options ? (
                        <select
                          disabled={readOnly}
                          value={String(customValues[cf.fieldKey] ?? '')}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [cf.fieldKey]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                        >
                          <option value="">اختر...</option>
                          {cf.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled={readOnly}
                          value={String(customValues[cf.fieldKey] ?? '')}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [cf.fieldKey]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tags & Notes */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#131B2E]">
                  <Tag className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>الوسوم:</span>
                </span>
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4338CA]"
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((item) => item !== t))}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="إضافة وسم..."
                    className="h-7 w-28 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-[#EAEDFF] px-2 text-[11px] font-bold text-[#004AC6]"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#131B2E]">
                  ملاحظات حول جهة الاتصال
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تفاصيل إضافية أو تفضيلات التواصل..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs text-[#131B2E]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#434655] hover:bg-[#F8FAFC]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{submitting ? 'جارٍ الحفظ...' : 'حفظ جهة الاتصال'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DBE1FF] bg-[#F2F3FF] p-3 text-xs">
              <div>
                <p className="font-bold text-[#131B2E]">رفع ملف CSV أو لصق الصفوف مباشرة</p>
                <p className="text-[11px] text-[#737686]">
                  يدعم الأعمدة العربية والإنجليزية مع ربط المنشآت المتطابقة تلقائياً
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="rounded-lg border border-[#2563EB]/30 bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]"
                >
                  تحميل نموذج تجريبي
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF] hover:bg-[#1D4ED8]">
                  <Upload className="h-3.5 w-3.5" />
                  <span>رفع ملف CSV</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="الصق محتوى CSV هنا..."
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] p-3 font-mono text-[11px] text-[#131B2E] focus:border-[#2563EB] focus:outline-none"
            />

            {parsedCsvDrafts.length > 0 && (
              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2.5 text-xs font-semibold text-[#065F46] tabular-nums">
                تمت معاينة {parsedCsvDrafts.length} جهة اتصال جاهزة للاستيراد.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#434655]"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submitting || parsedCsvDrafts.length === 0}
                onClick={() => void handleImportCsv()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#006242] px-5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#005236] disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {submitting
                    ? 'جارٍ الاستيراد...'
                    : `استيراد ${parsedCsvDrafts.length} جهة اتصال`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
