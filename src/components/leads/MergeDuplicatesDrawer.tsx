import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GitMerge, Layers, MessageSquare, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { Lead, LeadStatus } from '../../types/crm';
import { findDuplicateLeads, LEAD_OWNERS, LEAD_STAGES } from '../../utils/leadsLogic';

interface MergeDuplicatesDrawerProps {
  open: boolean;
  initialLeadIds: string[];
  onClose: () => void;
  onMerged: (masterId: string) => void;
}

export const MergeDuplicatesDrawer: React.FC<MergeDuplicatesDrawerProps> = ({
  open,
  initialLeadIds,
  onClose,
  onMerged,
}) => {
  const { leads, touchpoints, messages, tasks, mergeDuplicateLeads } = useCrm();

  const candidateLeads = useMemo(() => {
    if (initialLeadIds.length >= 2) {
      return leads.filter((l) => initialLeadIds.includes(l.id));
    }
    const dupInfo = findDuplicateLeads(leads);
    if (dupInfo.groups.length > 0) {
      const firstGroupIds = dupInfo.groups[0].leadIds;
      return leads.filter((l) => firstGroupIds.includes(l.id));
    }
    return [];
  }, [initialLeadIds, leads]);

  const [masterId, setMasterId] = useState<string>('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolvedPhone, setResolvedPhone] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [resolvedSource, setResolvedSource] = useState('');
  const [resolvedStatus, setResolvedStatus] = useState<LeadStatus>('تم التواصل');
  const [resolvedOwner, setResolvedOwner] = useState<string>(LEAD_OWNERS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || candidateLeads.length === 0) return;
    const first = candidateLeads[0];
    setMasterId(first.id);
    setResolvedName(first.fullName);
    setResolvedPhone(first.phone ?? '');
    setResolvedEmail(first.email ?? '');
    setResolvedCity(first.city ?? '');
    setResolvedSource(first.source ?? '');
    setResolvedStatus(first.status);
    setResolvedOwner(first.assignedToName);
  }, [open, candidateLeads]);

  if (!open) return null;

  const duplicateLeads = candidateLeads.filter((l) => l.id !== masterId);
  const dupIdSet = new Set(duplicateLeads.map((d) => d.id));

  const migratedTouchpointsCount = touchpoints.filter(
    (tp) => tp.leadId && dupIdSet.has(tp.leadId)
  ).length;
  const migratedMessagesCount = messages.filter(
    (m) => m.leadId && dupIdSet.has(m.leadId)
  ).length;
  const migratedTasksCount = tasks.filter(
    (t) => t.leadId && dupIdSet.has(t.leadId)
  ).length;

  const masterLead = candidateLeads.find((l) => l.id === masterId) ?? candidateLeads[0];

  const handleSelectMaster = (lead: Lead) => {
    setMasterId(lead.id);
    setResolvedName(lead.fullName);
    setResolvedPhone(lead.phone ?? '');
    setResolvedEmail(lead.email ?? '');
    setResolvedCity(lead.city ?? '');
    setResolvedSource(lead.source ?? '');
    setResolvedStatus(lead.status);
    setResolvedOwner(lead.assignedToName);
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterLead || duplicateLeads.length === 0) return;
    setSubmitting(true);
    try {
      await mergeDuplicateLeads({
        masterId: masterLead.id,
        duplicateIds: duplicateLeads.map((d) => d.id),
        resolvedFields: {
          fullName: resolvedName.trim() || masterLead.fullName,
          phone: resolvedPhone.trim() || undefined,
          email: resolvedEmail.trim() || undefined,
          city: resolvedCity.trim() || undefined,
          source: resolvedSource.trim() || undefined,
          status: resolvedStatus,
          assignedToName: resolvedOwner,
        },
      });
      onMerged(masterLead.id);
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
      aria-label="دمج السجلات المكررة"
    >
      <div className="fixed inset-0 bg-[#0F172A]/45" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#D97706]">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#0F172A]">
                مقارنة ودمج السجلات المكررة
              </h2>
              <p className="text-[12px] text-[#64748B]">
                اختر السجل الرئيسي (Master) وحدد القيم النهائية مع ترحيل كافة نقاط التماس والمحادثات.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الدمج"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {candidateLeads.length < 2 ? (
          <div className="flex-1 p-8 text-center space-y-2">
            <p className="text-[14px] font-semibold text-[#0F172A]">
              لم يتم العثور على سجلين أو أكثر للدمج
            </p>
            <p className="text-[12px] text-[#64748B]">
              حدد سجلين من الجدول أو استخدم فلتر &quot;مكرر محتمل&quot; لاختيار السجلات المتطابقة.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMergeSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Master Record Selector Cards */}
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-[#0F172A]">
                  1. اختر السجل الرئيسي (سيحتفظ بالمعرف RWQ-xxxxx):
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {candidateLeads.map((lead) => {
                    const isMaster = lead.id === masterLead?.id;
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => handleSelectMaster(lead)}
                        className={`rounded-lg border p-3 text-right transition-all ${
                          isMaster
                            ? 'border-[#2563EB] bg-[#EFF6FF]/60 ring-1 ring-[#2563EB]'
                            : 'border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-[#0F172A]">
                            {lead.fullName}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                              isMaster
                                ? 'bg-[#2563EB] text-[#FFFFFF]'
                                : 'bg-[#F1F5F9] text-[#475569]'
                            }`}
                          >
                            {isMaster ? 'السجل الرئيسي · ' : ''}
                            {lead.unique_id}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#64748B]">
                          {lead.city || lead.source || '—'}
                        </p>
                        <p className="mt-1 text-[11px] text-[#475569] tabular-nums" dir="ltr">
                          {lead.phone || '—'} · {lead.email || '—'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-Side Field Conflict Resolution */}
              <div className="space-y-3">
                <p className="text-[12px] font-bold text-[#0F172A]">
                  2. مطابقة واختيار القيم النهائية للسجل المدمج:
                </p>

                <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0]">
                  {/* Full Name */}
                  <div className="p-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#64748B]">الاسم الكامل</span>
                    <div className="flex flex-wrap gap-2">
                      {candidateLeads.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setResolvedName(l.fullName)}
                          className={`rounded border px-2.5 py-1 text-[12px] ${
                            resolvedName === l.fullName
                              ? 'border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#2563EB]'
                              : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]'
                          }`}
                        >
                          {l.fullName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone & Email */}
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        رقم الجوال المعتمد
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={resolvedPhone}
                        onChange={(e) => setResolvedPhone(e.target.value)}
                        className="input-control h-8 w-full px-2.5 text-[12px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        البريد الإلكتروني المعتمد
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        value={resolvedEmail}
                        onChange={(e) => setResolvedEmail(e.target.value)}
                        className="input-control h-8 w-full px-2.5 text-[12px]"
                      />
                    </div>
                  </div>

                  {/* City & Source */}
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        المدينة / الدولة
                      </label>
                      <input
                        type="text"
                        value={resolvedCity}
                        onChange={(e) => setResolvedCity(e.target.value)}
                        className="input-control h-8 w-full px-2.5 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        مصدر الاستقطاب الأساسي
                      </label>
                      <input
                        type="text"
                        value={resolvedSource}
                        onChange={(e) => setResolvedSource(e.target.value)}
                        className="input-control h-8 w-full px-2.5 text-[12px]"
                      />
                    </div>
                  </div>

                  {/* Stage & Owner */}
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        المرحلة النهائية
                      </label>
                      <select
                        value={resolvedStatus}
                        onChange={(e) => setResolvedStatus(e.target.value as LeadStatus)}
                        className="input-control h-8 w-full px-2 text-[12px]"
                      >
                        {LEAD_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        مالك السجل النهائي
                      </label>
                      <select
                        value={resolvedOwner}
                        onChange={(e) => setResolvedOwner(e.target.value)}
                        className="input-control h-8 w-full px-2 text-[12px]"
                      >
                        {LEAD_OWNERS.map((owner) => (
                          <option key={owner} value={owner}>
                            {owner}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Migration Summary Banner */}
              <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-[12px] font-bold text-[#1E40AF]">
                  <CheckCircle2 className="h-4 w-4 text-[#2563EB]" />
                  <span>ملخص الترحيل التلقائي إلى السجل الرئيسي ({masterLead?.unique_id})</span>
                </div>
                <div className="flex flex-wrap gap-4 text-[12px] text-[#334155] tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                    ترحيل {migratedTouchpointsCount} نقطة تماس
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-[#2563EB]" />
                    ترحيل {migratedMessagesCount} محادثة
                  </span>
                  <span>ترحيل {migratedTasksCount} مهمة</span>
                  <span className="text-[#B45309]">
                    نقل {duplicateLeads.length} سجل مكرر إلى سلة المحذوفات
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-md border border-[#CBD5E1] bg-[#FFFFFF] px-4 text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-4 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                <GitMerge className="h-4 w-4" />
                <span>{submitting ? 'جاري الدمج...' : 'تأكيد دمج السجلات'}</span>
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};
