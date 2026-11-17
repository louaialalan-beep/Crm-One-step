import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Edit3,
  Mail,
  MessageCircle,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ReportDefinition, ReportSchedule } from '../../types/reports';

export interface ExtendedReportSchedule extends ReportSchedule {
  includeRecordId: boolean;
  startDate: string;
  repeatType: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  endType: 'never' | 'after_occurrences' | 'on_date';
  endAfterCount?: number;
  endOnDate?: string;
  deliveryChannel: 'email' | 'in_app' | 'whatsapp';
  templateName: string;
  recipientRoleIds: string[];
  recipientGroupIds: string[];
}

export interface ReportSchedulerProps {
  reports: ReportDefinition[];
  schedules?: ExtendedReportSchedule[];
  preselectedReport?: ReportDefinition | null;
  autoOpenModal?: boolean;
  onBackToReports?: () => void;
  onSaveSchedule?: (schedule: ExtendedReportSchedule) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onToggleScheduleActive?: (scheduleId: string) => void;
}

const DEFAULT_SCHEDULES_SEED: ExtendedReportSchedule[] = [
  {
    id: 'sched_1',
    reportId: 'rpt_deals_by_stage',
    reportName: 'صفقات مسار المبيعات حسب المرحلة (Deals by Stage)',
    org_id: 'ORG-8401',
    frequency: 'daily',
    repeatType: 'daily',
    deliveryTime: '08:30',
    startDate: '2026-11-18',
    endType: 'never',
    format: 'pdf',
    includeRecordId: true,
    deliveryChannel: 'email',
    templateName: 'قالب الملخص التنفيذي الصباحي للإدارة العليا',
    recipientEmails: ['ceo@riwaq.sa', 'tareq@riwaq.sa'],
    recipientUserIds: ['usr_tareq', 'usr_sara'],
    recipientRoleIds: ['role_ceo', 'role_vp_sales'],
    recipientGroupIds: ['grp_exec'],
    active: true,
    lastSentAt: '2026-11-17 08:30',
    nextRunAt: '2026-11-18 08:30',
    createdBy: 'طارق العتيبي',
  },
  {
    id: 'sched_2',
    reportId: 'rpt_10plus_order_attribution_matrix',
    reportName: 'مصفوفة إسناد الطلبات المتكررة (+10 عمليات شراء)',
    org_id: 'ORG-8401',
    frequency: 'weekly',
    repeatType: 'weekly',
    deliveryTime: '09:00',
    startDate: '2026-11-22',
    endType: 'never',
    format: 'xlsx',
    includeRecordId: true,
    deliveryChannel: 'whatsapp',
    templateName: 'تقرير إسناد مبيعات وحملات ميتا الأسبوعي',
    recipientEmails: ['marketing@riwaq.sa'],
    recipientUserIds: ['usr_tareq'],
    recipientRoleIds: ['role_vp_sales'],
    recipientGroupIds: ['grp_marketing'],
    active: true,
    lastSentAt: '2026-11-15 09:00',
    nextRunAt: '2026-11-22 09:00',
    createdBy: 'طارق العتيبي',
  },
  {
    id: 'sched_3',
    reportId: 'rpt_paid_vs_unpaid_invoices',
    reportName: 'الفواتير المسددة مقابل المستحقة والضريبية ZATCA',
    org_id: 'ORG-8401',
    frequency: 'monthly',
    repeatType: 'monthly',
    deliveryTime: '10:00',
    startDate: '2026-12-01',
    endType: 'after_occurrences',
    endAfterCount: 12,
    format: 'csv',
    includeRecordId: true,
    deliveryChannel: 'email',
    templateName: 'تقرير المطابقة المالية والضريبية الشهري',
    recipientEmails: ['finance@riwaq.sa'],
    recipientUserIds: ['usr_naif'],
    recipientRoleIds: ['role_ceo'],
    recipientGroupIds: ['grp_finance'],
    active: true,
    lastSentAt: '2026-11-01 10:00',
    nextRunAt: '2026-12-01 10:00',
    createdBy: 'سارة المنصور',
  },
];

const REPEAT_TYPE_LABELS: Record<ExtendedReportSchedule['repeatType'], string> = {
  once: 'مرة واحدة (Once)',
  daily: 'يومياً (Daily)',
  weekly: 'أسبوعياً (Weekly)',
  monthly: 'شهرياً (Monthly)',
  yearly: 'سنوياً (Yearly)',
  custom: 'مخصص (Custom)',
};

const CHANNEL_LABELS: Record<ExtendedReportSchedule['deliveryChannel'], string> = {
  email: 'البريد الإلكتروني (Email)',
  in_app: 'إشعار داخلي في النظام',
  whatsapp: 'WhatsApp Cloud API',
};

const AVAILABLE_USERS = [
  { id: 'usr_tareq', label: 'طارق العتيبي (مدير مبيعات أول)' },
  { id: 'usr_sara', label: 'سارة المنصور (مدير حسابات إقليمي)' },
  { id: 'usr_naif', label: 'نايف الحربي (مدير مبيعات الشركات)' },
  { id: 'usr_fahad', label: 'فهد الشمري (مسؤول كبار الحسابات)' },
];

const AVAILABLE_ROLES = [
  { id: 'role_ceo', label: 'الرئيس التنفيذي (CEO)' },
  { id: 'role_vp_sales', label: 'نائب الرئيس للمبيعات (VP Sales)' },
  { id: 'role_regional_mgr', label: 'مدير مبيعات إقليمي' },
];

const AVAILABLE_GROUPS = [
  { id: 'grp_exec', label: 'مجموعة اللجنة التنفيذية' },
  { id: 'grp_marketing', label: 'فريق النمو وإعلانات ميتا' },
  { id: 'grp_finance', label: 'فريق الفوترة والتحصيل المالي' },
];

export const ReportScheduler: React.FC<ReportSchedulerProps> = ({
  reports,
  schedules: externalSchedules,
  preselectedReport = null,
  autoOpenModal = false,
  onBackToReports,
  onSaveSchedule,
  onDeleteSchedule,
  onToggleScheduleActive,
}) => {
  const [localSchedules, setLocalSchedules] = useState<ExtendedReportSchedule[]>(
    DEFAULT_SCHEDULES_SEED
  );
  const activeSchedules = externalSchedules ?? localSchedules;

  const [modalOpen, setModalOpen] = useState<boolean>(autoOpenModal);
  const [editingSchedule, setEditingSchedule] =
    useState<ExtendedReportSchedule | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Form State
  const [selectedReportId, setSelectedReportId] = useState<string>(
    preselectedReport?.id ?? reports[0]?.id ?? 'rpt_deals_by_stage'
  );
  const [includeRecordId, setIncludeRecordId] = useState<boolean>(true);
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'pdf'>('pdf');
  const [startDate, setStartDate] = useState<string>('2026-11-18');
  const [deliveryTime, setDeliveryTime] = useState<string>('08:30');
  const [repeatType, setRepeatType] =
    useState<ExtendedReportSchedule['repeatType']>('weekly');
  const [endType, setEndType] =
    useState<ExtendedReportSchedule['endType']>('never');
  const [endAfterCount, setEndAfterCount] = useState<number>(10);
  const [endOnDate, setEndOnDate] = useState<string>('2027-03-31');
  const [deliveryChannel, setDeliveryChannel] =
    useState<ExtendedReportSchedule['deliveryChannel']>('email');
  const [templateName, setTemplateName] = useState<string>(
    'قالب الملخص التنفيذي الصباحي للإدارة العليا'
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(['usr_tareq']);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(['role_vp_sales']);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(['grp_exec']);
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState<string>(
    'ceo@riwaq.sa, analytics@riwaq.sa'
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedReport) {
      setSelectedReportId(preselectedReport.id);
    }
    if (autoOpenModal) {
      setModalOpen(true);
    }
  }, [autoOpenModal, preselectedReport]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleOpenNewModal = () => {
    setEditingSchedule(null);
    setSelectedReportId(
      preselectedReport?.id ?? reports[0]?.id ?? 'rpt_deals_by_stage'
    );
    setIncludeRecordId(true);
    setFormat('pdf');
    setStartDate('2026-11-18');
    setDeliveryTime('08:30');
    setRepeatType('weekly');
    setEndType('never');
    setDeliveryChannel('email');
    setTemplateName('قالب الملخص التنفيذي الصباحي للإدارة العليا');
    setSelectedUserIds(['usr_tareq']);
    setSelectedRoleIds(['role_vp_sales']);
    setSelectedGroupIds(['grp_exec']);
    setAdditionalEmailsInput('ceo@riwaq.sa');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (sched: ExtendedReportSchedule) => {
    setEditingSchedule(sched);
    setSelectedReportId(sched.reportId);
    setIncludeRecordId(sched.includeRecordId);
    setFormat(sched.format);
    setStartDate(sched.startDate);
    setDeliveryTime(sched.deliveryTime);
    setRepeatType(sched.repeatType);
    setEndType(sched.endType);
    setEndAfterCount(sched.endAfterCount ?? 10);
    setEndOnDate(sched.endOnDate ?? '2027-03-31');
    setDeliveryChannel(sched.deliveryChannel);
    setTemplateName(sched.templateName);
    setSelectedUserIds(sched.recipientUserIds);
    setSelectedRoleIds(sched.recipientRoleIds);
    setSelectedGroupIds(sched.recipientGroupIds);
    setAdditionalEmailsInput(sched.recipientEmails.join(', '));
    setFormError(null);
    setModalOpen(true);
  };

  const toggleItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSaveScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEmails = additionalEmailsInput
      .split(',')
      .map((em) => em.trim())
      .filter(Boolean);

    if (parsedEmails.length > 50) {
      setFormError('الحد الأقصى للمستلمين الإضافيين هو 50 بريداً إلكترونياً.');
      return;
    }

    const matchedReport = reports.find((r) => r.id === selectedReportId);
    const freqMap: Record<
      ExtendedReportSchedule['repeatType'],
      ReportSchedule['frequency']
    > = {
      once: 'daily',
      daily: 'daily',
      weekly: 'weekly',
      monthly: 'monthly',
      yearly: 'quarterly',
      custom: 'weekly',
    };

    const payload: ExtendedReportSchedule = {
      id: editingSchedule?.id ?? `sched_${Date.now()}`,
      reportId: selectedReportId,
      reportName: matchedReport?.name ?? 'تقرير مخصص',
      org_id: 'ORG-8401',
      frequency: freqMap[repeatType],
      repeatType,
      deliveryTime,
      startDate,
      endType,
      endAfterCount: endType === 'after_occurrences' ? endAfterCount : undefined,
      endOnDate: endType === 'on_date' ? endOnDate : undefined,
      format,
      includeRecordId,
      deliveryChannel,
      templateName,
      recipientEmails: parsedEmails,
      recipientUserIds: selectedUserIds,
      recipientRoleIds: selectedRoleIds,
      recipientGroupIds: selectedGroupIds,
      active: editingSchedule?.active ?? true,
      lastSentAt: editingSchedule?.lastSentAt ?? 'لم يُرسل بعد',
      nextRunAt: `${startDate} ${deliveryTime}`,
      createdBy: 'طارق العتيبي',
    };

    if (onSaveSchedule) {
      onSaveSchedule(payload);
    } else {
      setLocalSchedules((prev) => {
        const exists = prev.some((s) => s.id === payload.id);
        if (exists) {
          return prev.map((s) => (s.id === payload.id ? payload : s));
        }
        return [payload, ...prev];
      });
    }

    setModalOpen(false);
    showToast(`تم حفظ جدولة التقرير "${payload.reportName}" بنجاح.`);
  };

  const handleToggleActive = (id: string) => {
    if (onToggleScheduleActive) {
      onToggleScheduleActive(id);
    } else {
      setLocalSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
      );
    }
  };

  const handleDelete = (sched: ExtendedReportSchedule) => {
    if (onDeleteSchedule) {
      onDeleteSchedule(sched.id);
    } else {
      setLocalSchedules((prev) => prev.filter((s) => s.id !== sched.id));
    }
    showToast(`تم إلغاء وحذف جدولة "${sched.reportName}".`);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#F8FAFC]">
      {/* Flush Header */}
      <header className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToReports && (
              <button
                type="button"
                onClick={onBackToReports}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-extrabold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <ArrowRight className="h-4 w-4 text-[#2563EB]" />
                <span>العودة للتقارير</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] sm:text-[20px] font-extrabold text-[#0F172A]">
                  إدارة التقارير المجدولة للتسليم الآلي (Scheduled Reports Manager)
                </h1>
                <span className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#2563EB] tabular-nums">
                  {activeSchedules.length} جدولة نشطة
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[#64748B]">
                أتمتة إرسال التقارير التنفيذية بصيغ XLS و CSV و PDF عبر البريد الإلكتروني أو WhatsApp Cloud API
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ جدولة تقرير جديد</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-4">
        {toastMessage && (
          <div className="flex items-center justify-between rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#059669]" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-[#047857]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scheduled Reports Table */}
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                  <th className="py-3 px-4">اسم التقرير المجدول</th>
                  <th className="py-3 px-4">صيغة المرفق</th>
                  <th className="py-3 px-4">دورية التكرار</th>
                  <th className="py-3 px-4">قناة الإرسال والمستلمون</th>
                  <th className="py-3 px-4">التشغيل القادم</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {activeSchedules.map((sched) => (
                  <tr key={sched.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3.5 px-4">
                      <p className="font-extrabold text-[#0F172A]">
                        {sched.reportName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        القالب: {sched.templateName} •{' '}
                        {sched.includeRecordId
                          ? 'يتضمن معرف RWQ-ID'
                          : 'بدون معرف السجل'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-extrabold uppercase text-[#2563EB]">
                        {sched.format === 'xlsx' ? 'XLS' : sched.format.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-[#334155]">
                      {REPEAT_TYPE_LABELS[sched.repeatType]}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                        {sched.deliveryChannel === 'whatsapp' ? (
                          <MessageCircle className="h-3.5 w-3.5 text-[#059669]" />
                        ) : (
                          <Mail className="h-3.5 w-3.5 text-[#2563EB]" />
                        )}
                        <span>{CHANNEL_LABELS[sched.deliveryChannel]}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-[#64748B] truncate max-w-xs">
                        {sched.recipientEmails.join(' , ')}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-[#0F172A] tabular-nums">
                      {sched.nextRunAt}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sched.id)}
                        className={`rounded-lg px-3 py-1 text-[11px] font-extrabold transition-colors cursor-pointer ${
                          sched.active
                            ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                            : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                        }`}
                      >
                        {sched.active ? 'مفعّل (ON)' : 'متوقف (OFF)'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            showToast(
                              `تم إرسال نسخة تجريبية فورية من "${sched.reportName}" إلى المستلمين (${sched.format.toUpperCase()}).`
                            )
                          }
                          title="تشغيل تجريبي الآن"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB] hover:bg-[#2563EB] hover:text-[#FFFFFF] cursor-pointer"
                        >
                          <Play className="h-3 w-3" />
                          <span>تشغيل تجريبي الآن</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sched)}
                          title="تعديل الجدولة"
                          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(sched)}
                          title="حذف الجدولة"
                          className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* NEW / EDIT REPORT SCHEDULER MODAL (EXACT ZOHO FIELDS)               */}
      {/* =================================================================== */}
      {modalOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-[1px]"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                    {editingSchedule ? 'تعديل جدولة التقرير' : 'جدولة إرسال تقرير دوري جديد'}
                  </h2>
                  <p className="text-[12px] text-[#64748B]">
                    حدد التقرير وصيغة المرفق وتوقيت الإرسال والمستلمين
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSaveScheduleSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                {formError && (
                  <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[12px] font-bold text-[#DC2626]">
                    {formError}
                  </div>
                )}

                {/* 1. Select Report & Record ID Checkbox */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-8">
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      اختيار التقرير <span className="text-[#DC2626]">*</span>
                    </label>
                    <select
                      value={selectedReportId}
                      onChange={(e) => setSelectedReportId(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[12px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    >
                      {reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-[11px] font-bold text-[#0F172A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeRecordId}
                        onChange={(e) => setIncludeRecordId(e.target.checked)}
                        className="h-4 w-4 accent-[#2563EB]"
                      />
                      <span>تضمين عمود معرّف السجل (RWQ-ID)</span>
                    </label>
                  </div>
                </div>

                {/* 2. File Format, Start Date & Time, Repeat Type */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      صيغة الملف المرفق
                    </label>
                    <select
                      value={format}
                      onChange={(e) =>
                        setFormat(e.target.value as 'xlsx' | 'csv' | 'pdf')
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A]"
                    >
                      <option value="xlsx">Excel (XLS)</option>
                      <option value="csv">CSV (UTF-8)</option>
                      <option value="pdf">PDF (تقرير مطبوع)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      تاريخ البدء
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      وقت الإرسال
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      نوع التكرار (Repeat Type)
                    </label>
                    <select
                      value={repeatType}
                      onChange={(e) =>
                        setRepeatType(
                          e.target.value as ExtendedReportSchedule['repeatType']
                        )
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A]"
                    >
                      <option value="once">مرة واحدة</option>
                      <option value="daily">يومياً</option>
                      <option value="weekly">أسبوعياً</option>
                      <option value="monthly">شهرياً</option>
                      <option value="yearly">سنوياً</option>
                      <option value="custom">مخصص</option>
                    </select>
                  </div>
                </div>

                {/* 3. Schedule End Condition */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      نهاية الجدولة
                    </label>
                    <select
                      value={endType}
                      onChange={(e) =>
                        setEndType(
                          e.target.value as ExtendedReportSchedule['endType']
                        )
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A]"
                    >
                      <option value="never">بلا نهاية (مستمر)</option>
                      <option value="after_occurrences">بعد عدد مرات محدد</option>
                      <option value="on_date">في تاريخ محدد</option>
                    </select>
                  </div>

                  {endType === 'after_occurrences' && (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                        عدد مرات الإرسال
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={endAfterCount}
                        onChange={(e) =>
                          setEndAfterCount(Number(e.target.value) || 10)
                        }
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums"
                      />
                    </div>
                  )}

                  {endType === 'on_date' && (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                        تاريخ انتهاء الجدولة
                      </label>
                      <input
                        type="date"
                        value={endOnDate}
                        onChange={(e) => setEndOnDate(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Delivery Channel & Message Template */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      إرسال التقرير عبر
                    </label>
                    <select
                      value={deliveryChannel}
                      onChange={(e) =>
                        setDeliveryChannel(
                          e.target.value as ExtendedReportSchedule['deliveryChannel']
                        )
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A]"
                    >
                      <option value="email">البريد الإلكتروني (Email)</option>
                      <option value="in_app">إشعار النظام الداخلي</option>
                      <option value="whatsapp">WhatsApp Cloud API</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-extrabold text-[#0F172A]">
                      قالب الرسالة (Message/Email Template)
                    </label>
                    <select
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A]"
                    >
                      <option value="قالب الملخص التنفيذي الصباحي للإدارة العليا">
                        قالب الملخص التنفيذي الصباحي للإدارة العليا
                      </option>
                      <option value="تقرير إسناد مبيعات وحملات ميتا الأسبوعي">
                        تقرير إسناد مبيعات وحملات ميتا الأسبوعي
                      </option>
                      <option value="تقرير المطابقة المالية والضريبية الشهري">
                        تقرير المطابقة المالية والضريبية الشهري
                      </option>
                    </select>
                  </div>
                </div>

                {/* 5. Multi-Select Recipients (Users, Roles, Groups + Additional Emails) */}
                <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
                  <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-2">
                    <Users className="h-4 w-4 text-[#2563EB]" />
                    <span className="text-[12px] font-extrabold text-[#0F172A]">
                      المستلمون (المستخدمون، الأدوار التنظيمية، والمجموعات)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* Users */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-extrabold text-[#475569]">
                        المستخدمون ({selectedUserIds.length})
                      </p>
                      {AVAILABLE_USERS.map((u) => {
                        const checked = selectedUserIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() =>
                              toggleItem(selectedUserIds, setSelectedUserIds, u.id)
                            }
                            className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-right text-[11px] font-semibold cursor-pointer ${
                              checked
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]'
                            }`}
                          >
                            <span className="truncate">{u.label}</span>
                            {checked && <Check className="h-3 w-3 shrink-0 text-[#2563EB]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Roles */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-extrabold text-[#475569]">
                        الأدوار الوظيفية ({selectedRoleIds.length})
                      </p>
                      {AVAILABLE_ROLES.map((r) => {
                        const checked = selectedRoleIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() =>
                              toggleItem(selectedRoleIds, setSelectedRoleIds, r.id)
                            }
                            className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-right text-[11px] font-semibold cursor-pointer ${
                              checked
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]'
                            }`}
                          >
                            <span className="truncate">{r.label}</span>
                            {checked && <Check className="h-3 w-3 shrink-0 text-[#2563EB]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Groups */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-extrabold text-[#475569]">
                        المجموعات ({selectedGroupIds.length})
                      </p>
                      {AVAILABLE_GROUPS.map((g) => {
                        const checked = selectedGroupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              toggleItem(
                                selectedGroupIds,
                                setSelectedGroupIds,
                                g.id
                              )
                            }
                            className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-right text-[11px] font-semibold cursor-pointer ${
                              checked
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                                : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]'
                            }`}
                          >
                            <span className="truncate">{g.label}</span>
                            {checked && <Check className="h-3 w-3 shrink-0 text-[#2563EB]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional Comma-Separated Emails */}
                  <div className="pt-2">
                    <label className="mb-1 block text-[11px] font-extrabold text-[#0F172A]">
                      مستلمون إضافيون (عناوين بريد إلكتروني مفصولة بفاصلة — بحد أقصى 50 مستلماً)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={additionalEmailsInput}
                      onChange={(e) => setAdditionalEmailsInput(e.target.value)}
                      placeholder="ceo@riwaq.sa, board@riwaq.sa"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 font-mono text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Single Sticky Bottom Bar */}
              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>حفظ الجدولة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
