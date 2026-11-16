import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, GitMerge, Layers, MessageSquare, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Contact, ContactStatus } from '../../types/crm';
import {
  CONTACT_OWNERS,
  CONTACT_STATUSES,
  findDuplicateContacts,
  getContactOwnerName,
  resolveContactStatus,
} from '../../utils/contactsLogic';

interface MergeDuplicateContactsDrawerProps {
  open: boolean;
  initialContactIds: string[];
  onClose: () => void;
  onMerged: (masterId: string) => void;
}

export const MergeDuplicateContactsDrawer: React.FC<MergeDuplicateContactsDrawerProps> = ({
  open,
  initialContactIds,
  onClose,
  onMerged,
}) => {
  const { contacts, deals, touchpoints, messages, mergeDuplicateContacts } = useCrm();

  const candidateContacts = useMemo(() => {
    if (initialContactIds.length >= 2) {
      return contacts.filter((c) => initialContactIds.includes(c.id));
    }
    const dupInfo = findDuplicateContacts(contacts);
    if (dupInfo.groups.length > 0) {
      const firstGroupIds = dupInfo.groups[0].contactIds;
      return contacts.filter((c) => firstGroupIds.includes(c.id));
    }
    return [];
  }, [contacts, initialContactIds]);

  const [masterId, setMasterId] = useState<string>('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolvedPhone, setResolvedPhone] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [resolvedSource, setResolvedSource] = useState('');
  const [resolvedStatus, setResolvedStatus] = useState<ContactStatus>('عميل نشط');
  const [resolvedOwner, setResolvedOwner] = useState<string>(CONTACT_OWNERS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || candidateContacts.length === 0) return;
    const first = candidateContacts[0];
    setMasterId(first.id);
    setResolvedName(first.fullName);
    setResolvedPhone(first.phone ?? '');
    setResolvedEmail(first.email ?? '');
    setResolvedCity(first.city ?? '');
    setResolvedSource(first.primarySource ?? '');
    setResolvedStatus(resolveContactStatus(first.contactStatus));
    setResolvedOwner(getContactOwnerName(first));
  }, [candidateContacts, open]);

  if (!open) return null;

  const duplicateContacts = candidateContacts.filter((c) => c.id !== masterId);
  const dupIdSet = new Set(duplicateContacts.map((d) => d.id));
  const dupUniqueSet = new Set(
    duplicateContacts.map((d) => d.leadUniqueId).filter((v): v is string => Boolean(v))
  );

  const migratedDealsCount = deals.filter(
    (d) =>
      (d.contactId && dupIdSet.has(d.contactId)) ||
      (d.leadUniqueId && dupUniqueSet.has(d.leadUniqueId))
  ).length;
  const migratedTouchpointsCount = touchpoints.filter(
    (tp) =>
      (tp.relatedEntityType === 'contact' && dupIdSet.has(tp.relatedEntityId)) ||
      (tp.leadUniqueId && dupUniqueSet.has(tp.leadUniqueId))
  ).length;
  const migratedMessagesCount = messages.filter(
    (m) => m.leadUniqueId && dupUniqueSet.has(m.leadUniqueId)
  ).length;

  const masterContact =
    candidateContacts.find((c) => c.id === masterId) ?? candidateContacts[0];

  const handleSelectMaster = (contact: Contact) => {
    setMasterId(contact.id);
    setResolvedName(contact.fullName);
    setResolvedPhone(contact.phone ?? '');
    setResolvedEmail(contact.email ?? '');
    setResolvedCity(contact.city ?? '');
    setResolvedSource(contact.primarySource ?? '');
    setResolvedStatus(resolveContactStatus(contact.contactStatus));
    setResolvedOwner(getContactOwnerName(contact));
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterContact || duplicateContacts.length === 0) return;
    setSubmitting(true);
    try {
      await mergeDuplicateContacts({
        masterId: masterContact.id,
        duplicateIds: duplicateContacts.map((d) => d.id),
        resolvedFields: {
          fullName: resolvedName.trim() || masterContact.fullName,
          phone: resolvedPhone.trim() || undefined,
          email: resolvedEmail.trim() || undefined,
          city: resolvedCity.trim() || undefined,
          primarySource: resolvedSource.trim() || undefined,
          contactStatus: resolvedStatus,
          assignedToName: resolvedOwner,
        },
      });
      onMerged(masterContact.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start"
      role="dialog"
      aria-modal="true"
      aria-label="دمج جهات الاتصال المكررة"
    >
      <div className="fixed inset-0 bg-[#0F172A]/45" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
              <GitMerge className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#131B2E]">
                فحص ودمج جهات الاتصال المكررة
              </h2>
              <p className="text-[11px] text-[#737686]">
                توحيد السجلات المتطابقة ونقل الصفقات ونقاط التماس والمحادثات تلقائياً
              </p>
            </div>
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

        {candidateContacts.length < 2 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-[#059669]" />
            <h3 className="text-sm font-bold text-[#131B2E]">
              لا توجد مجموعات تكرار تتطلب الدمج حالياً
            </h3>
            <p className="text-xs text-[#737686]">
              يمكنك أيضاً تحديد أي سجلين من الجدول ثم الضغط على «دمج المحدد» في الشريط السفلي.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMergeSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Select Master Record */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#131B2E]">
                1. اختر السجل الأساسي الذي سيبقى معتمداً (Master Record):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidateContacts.map((c) => {
                  const isMaster = c.id === masterId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectMaster(c)}
                      className={`rounded-xl border p-3 text-right transition-all ${
                        isMaster
                          ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/20'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#2563EB]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#131B2E]">{c.fullName}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isMaster
                              ? 'bg-[#2563EB] text-[#FFFFFF]'
                              : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}
                        >
                          {isMaster ? 'السجل الأساسي' : 'سيُدمج ويُنقل للسلة'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#434655]">{c.accountName}</p>
                      <p className="mt-1 font-mono text-[11px] text-[#737686] tabular-nums" dir="ltr">
                        {c.phone || '—'} · {c.email || '—'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Migration Impact Summary */}
            <div className="rounded-xl border border-[#DBE1FF] bg-[#F2F3FF] p-3 flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#004AC6] tabular-nums">
                <Briefcase className="h-3.5 w-3.5" />
                <span>نقل {migratedDealsCount} صفقة</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#4648D4] tabular-nums">
                <Layers className="h-3.5 w-3.5" />
                <span>دمج {migratedTouchpointsCount} نقطة تماس</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#006242] tabular-nums">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>ربط {migratedMessagesCount} رسالة</span>
              </span>
            </div>

            {/* Final Resolved Fields */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#131B2E]">
                2. راجع البيانات النهائية بعد التوحيد:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    value={resolvedName}
                    onChange={(e) => setResolvedName(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    رقم الجوال
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={resolvedPhone}
                    onChange={(e) => setResolvedPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={resolvedEmail}
                    onChange={(e) => setResolvedEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    حالة جهة الاتصال
                  </label>
                  <select
                    value={resolvedStatus}
                    onChange={(e) => setResolvedStatus(e.target.value as ContactStatus)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                  >
                    {CONTACT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    المدينة
                  </label>
                  <input
                    type="text"
                    value={resolvedCity}
                    onChange={(e) => setResolvedCity(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#737686]">
                    مالك السجل
                  </label>
                  <select
                    value={resolvedOwner}
                    onChange={(e) => setResolvedOwner(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                  >
                    {CONTACT_OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#434655]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                <GitMerge className="h-4 w-4" />
                <span>{submitting ? 'جارٍ الدمج...' : 'تأكيد دمج جهات الاتصال'}</span>
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};
