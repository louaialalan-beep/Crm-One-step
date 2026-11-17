import React from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  GripVertical,
  Sparkles,
} from 'lucide-react';
import type { UnifiedCalendarEvent } from './UnifiedCalendarModule';

interface OverdueTasksAlertSidebarProps {
  overdueEvents: UnifiedCalendarEvent[];
  currentReferenceDay: number;
  monthLabel: string;
  selectedEventId: string | null;
  draggedEventId: string | null;
  onSelectEvent: (ev: UnifiedCalendarEvent) => void;
  onOneClickReschedule: (
    ev: UnifiedCalendarEvent,
    targetDay: number,
    targetHour?: number
  ) => void;
  onRescheduleAllToToday: () => void;
  onMarkComplete: (ev: UnifiedCalendarEvent) => void;
  onDragStart: (e: React.DragEvent, eventId: string) => void;
  onDragEnd: () => void;
}

export const OverdueTasksAlertSidebar: React.FC<OverdueTasksAlertSidebarProps> = ({
  overdueEvents,
  currentReferenceDay,
  monthLabel,
  selectedEventId,
  draggedEventId,
  onSelectEvent,
  onOneClickReschedule,
  onRescheduleAllToToday,
  onMarkComplete,
  onDragStart,
  onDragEnd,
}) => {
  const count = overdueEvents.length;

  return (
    <section
      dir="rtl"
      aria-label="شريط التنبيهات الجانبي للمهام المتأخرة"
      className={`rounded-2xl border p-4 shadow-2xs transition-colors space-y-3.5 ${
        count > 0
          ? 'border-[#FECACA] bg-[#FFFFFF]'
          : 'border-[#A7F3D0] bg-[#FFFFFF]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[#F1F5F9] pb-3">
        <div className="flex items-start gap-2.5">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              count > 0
                ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
            }`}
          >
            {count > 0 ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                شريط التنبيهات • المهام المتأخرة
              </h3>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
                  count > 0
                    ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                    : 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                }`}
              >
                {count}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {count > 0
                ? 'أعد جدولة المهام المتأخرة بضغطة واحدة أو اسحبها للتقويم'
                : 'جميع المهام التنفيذية مجدولة في مواعيدها المحددة'}
            </p>
          </div>
        </div>
      </div>

      {/* 1-Click Batch Reschedule Banner when multiple overdue tasks exist */}
      {count > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2]/75 px-3 py-2">
          <div className="text-[11px] font-bold text-[#991B1B]">
            <span>إجمالي {count} مهام تجاوزت موعد الاستحقاق</span>
          </div>
          <button
            type="button"
            onClick={onRescheduleAllToToday}
            className="inline-flex items-center gap-1 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] px-2.5 py-1.5 text-[10px] font-extrabold text-[#FFFFFF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3 w-3" />
            <span>جدولة الكل لليوم ({currentReferenceDay})</span>
          </button>
        </div>
      )}

      {/* Overdue Tasks List or Clean Empty State */}
      {count === 0 ? (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3.5 text-center space-y-1">
          <p className="text-[12px] font-extrabold text-[#065F46]">
            لا توجد أي مهام متأخرة حالياً
          </p>
          <p className="text-[11px] text-[#047857]">
            تمت معالجة وجدولة كافة المهام المتأخرة بنجاح في التقويم الموحد.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pl-0.5">
          {overdueEvents.map((ev) => {
            const daysLate = Math.max(1, currentReferenceDay - ev.dayOfMonth);
            const isSelected = selectedEventId === ev.id;
            const isBeingDragged = draggedEventId === ev.id;

            return (
              <div
                key={ev.id}
                draggable
                onDragStart={(e) => onDragStart(e, ev.id)}
                onDragEnd={onDragEnd}
                onClick={() => onSelectEvent(ev)}
                className={`rounded-xl border p-3 transition-all cursor-grab active:cursor-grabbing select-none space-y-2 ${
                  isBeingDragged
                    ? 'opacity-40 scale-95 ring-2 ring-[#2563EB]'
                    : isSelected
                      ? 'border-[#DC2626] bg-[#FEF2F2]/45 ring-1 ring-[#DC2626]'
                      : 'border-[#FECACA] bg-[#FFFDFD] hover:border-[#F87171] hover:bg-[#FEF2F2]/25'
                }`}
              >
                {/* Top Metadata Row: Overdue Days + Priority + RWQ ID */}
                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#DC2626] tabular-nums">
                    <GripVertical className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      متأخرة منذ {daysLate} {daysLate === 1 ? 'يوم' : 'أيام'}
                    </span>
                    <span className="text-[#94A3B8]">·</span>
                    <span className="font-semibold text-[#64748B]">
                      موعد {ev.dayOfMonth} {monthLabel.split(' ')[0]}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                    {ev.rwqId}
                  </span>
                </div>

                {/* Task Title & Company */}
                <div>
                  <p className="text-[12px] font-extrabold text-[#0F172A] leading-snug">
                    {ev.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0 text-[#94A3B8]" />
                      <span className="truncate">{ev.companyName}</span>
                    </span>
                    {ev.priority && (
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          ev.priority === 'عالية'
                            ? 'text-[#DC2626]'
                            : 'text-[#D97706]'
                        }`}
                      >
                        أولوية {ev.priority}
                      </span>
                    )}
                  </div>
                </div>

                {/* 1-Click Quick Reschedule Action Row */}
                <div
                  className="pt-1.5 border-t border-[#F1F5F9] flex flex-wrap items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onOneClickReschedule(ev, currentReferenceDay, 11)
                    }
                    title={`إعادة الجدولة فوراً إلى اليوم (${currentReferenceDay}) الساعة 11:00 ص`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-2 py-1.5 text-[10px] font-extrabold text-[#FFFFFF] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CalendarCheck className="h-3 w-3 shrink-0" />
                    <span>اليوم ({currentReferenceDay})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOneClickReschedule(
                        ev,
                        Math.min(30, currentReferenceDay + 1),
                        10
                      )
                    }
                    title={`إعادة الجدولة فوراً إلى غداً (${Math.min(
                      30,
                      currentReferenceDay + 1
                    )}) الساعة 10:00 ص`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-2 py-1.5 text-[10px] font-extrabold text-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    <span>غداً ({Math.min(30, currentReferenceDay + 1)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOneClickReschedule(
                        ev,
                        Math.min(30, currentReferenceDay + 3),
                        13
                      )
                    }
                    title="تأجيل لمدة 3 أيام"
                    className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-2 py-1.5 text-[10px] font-bold text-[#334155] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    +3 أيام
                  </button>

                  <button
                    type="button"
                    onClick={() => onMarkComplete(ev)}
                    title="تحديد المهمة كمكتملة"
                    className="inline-flex items-center justify-center rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-2 py-1.5 text-[10px] font-extrabold text-[#065F46] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    ✓ إنجاز
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
