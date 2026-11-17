import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Filter,
  GripVertical,
  Layers,
  MessageCircle,
  Move,
  Phone,
  Plus,
  Search,
  Sparkles,
  User,
  Video,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useCrm } from '../../context/CrmContext';
import { formatCurrencySAR } from '../../utils/formatters';
import type { CrmTask } from '../../types/crm';
import { OverdueTasksAlertSidebar } from './OverdueTasksAlertSidebar';

const CURRENT_REFERENCE_DAY = 17; // 17 November 2026

export type CalendarViewType = 'month' | 'week';
export type CalendarCategoryFilter = 'all' | 'task' | 'meeting' | 'deal';

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  category: 'task' | 'meeting' | 'deal';
  dayOfMonth: number; // 1..30
  hourSlot: number; // 9..17
  timeRangeLabel: string;
  dateIso: string;
  companyName: string;
  ownerName: string;
  rwqId: string;
  completed?: boolean;
  priority?: CrmTask['priority'];
  dealAmount?: number;
  dealStage?: string;
  dealProbability?: number;
  meetingLinkLabel?: string;
  participantsCount?: number;
  sourceCollection?: 'tasks' | 'deals' | 'curated';
  sourceRecordId?: string;
}

const ARABIC_WEEKDAYS = [
  { index: 0, short: 'سبت', full: 'السبت' },
  { index: 1, short: 'أحد', full: 'الأحد' },
  { index: 2, short: 'إثن', full: 'الإثنين' },
  { index: 3, short: 'ثلا', full: 'الثلاثاء' },
  { index: 4, short: 'أرب', full: 'الأربعاء' },
  { index: 5, short: 'خمي', full: 'الخميس' },
  { index: 6, short: 'جمع', full: 'الجمعة' },
];

const HOUR_SLOTS = [
  { hour: 9, label: '09:00 ص' },
  { hour: 10, label: '10:00 ص' },
  { hour: 11, label: '11:00 ص' },
  { hour: 12, label: '12:00 م' },
  { hour: 13, label: '01:00 م' },
  { hour: 14, label: '02:00 م' },
  { hour: 15, label: '03:00 م' },
  { hour: 16, label: '04:00 م' },
  { hour: 17, label: '05:00 م' },
];

const AVAILABLE_MONTHS = [
  { key: '2026-11', label: 'نوفمبر 2026 (الحالي)', year: 2026, month: 11, startOffset: 0 },
  { key: '2026-12', label: 'ديسمبر 2026', year: 2026, month: 12, startOffset: 2 },
  { key: '2026-10', label: 'أكتوبر 2026', year: 2026, month: 10, startOffset: 5 },
];

function extractDayFromDateString(dateStr: string, fallbackDay: number): number {
  const m = dateStr.match(/-(\d{2})$/);
  if (m) {
    const parsed = parseInt(m[1], 10);
    if (parsed >= 1 && parsed <= 30) return parsed;
  }
  return fallbackDay;
}

function formatHourSlotRange(
  hour: number,
  category: 'task' | 'meeting' | 'deal'
): string {
  if (category === 'deal') {
    const h12 = hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? 'م' : 'ص';
    return `${h12}:00 ${period} • موعد إغلاق مستهدف`;
  }
  const h12 = hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? 'م' : 'ص';
  const durationMins = category === 'meeting' ? '45' : '30';
  return `${h12}:00 ${period} - ${h12}:${durationMins} ${period}`;
}

interface UnifiedCalendarModuleProps {
  embedded?: boolean;
  defaultView?: CalendarViewType;
  onSwitchToListView?: () => void;
}

export const UnifiedCalendarModule: React.FC<UnifiedCalendarModuleProps> = ({
  embedded = false,
  defaultView = 'month',
  onSwitchToListView,
}) => {
  const navigate = useNavigate();
  const {
    currentOrgId,
    firebaseUser,
    tasks,
    deals,
    leads,
    contacts,
    toggleTaskStatus,
    createDeal,
    openInboxForLead,
    openInboxForContact,
  } = useCrm();

  const [calendarView, setCalendarView] = useState<CalendarViewType>(defaultView);
  const [monthIndex, setMonthIndex] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(17);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(2); // Week containing day 15..21
  const [categoryFilter, setCategoryFilter] = useState<CalendarCategoryFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeMeetingBanner, setActiveMeetingBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag & Drop State for Weekly & Monthly Rescheduling
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dropTargetSlot, setDropTargetSlot] = useState<{
    day: number;
    hour?: number;
  } | null>(null);

  // Local custom/rescheduled overrides so user can drag/reschedule any event immediately
  const [dayOverrides, setDayOverrides] = useState<Record<string, { day: number; hour: number }>>(
    {}
  );
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, boolean>>({});
  const [customEvents, setCustomEvents] = useState<UnifiedCalendarEvent[]>([]);

  // Quick Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [newEventCategory, setNewEventCategory] = useState<'task' | 'meeting' | 'deal'>('meeting');
  const [newEventTitle, setNewEventTitle] = useState<string>('');
  const [newEventCompany, setNewEventCompany] = useState<string>('شركة قمة التقنية للحلول');
  const [newEventRwq, setNewEventRwq] = useState<string>('RWQ-10482');
  const [newEventDay, setNewEventDay] = useState<number>(17);
  const [newEventHour, setNewEventHour] = useState<number>(11);
  const [newEventPriority, setNewEventPriority] = useState<CrmTask['priority']>('عالية');
  const [newDealAmount, setNewDealAmount] = useState<string>('240000');
  const [isSavingEvent, setIsSavingEvent] = useState<boolean>(false);

  const currentMonthMeta = AVAILABLE_MONTHS[monthIndex] ?? AVAILABLE_MONTHS[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Build Unified Calendar Events from Firestore `tasks`, `deals`, and curated executive meetings
  const allUnifiedEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const list: UnifiedCalendarEvent[] = [];

    // 1. Map Firestore `tasks` (Tasks & Meetings)
    tasks.forEach((task, idx) => {
      const isMeeting =
        task.title.includes('اجتماع') ||
        task.title.includes('عرض') ||
        task.title.includes('Demo') ||
        task.title.includes('ورشة') ||
        task.title.includes('مكالمة');
      const baseDay = extractDayFromDateString(task.dueDate, ((idx * 3 + 12) % 26) + 2);
      const baseHour = 9 + ((idx * 2) % 8);
      const override = dayOverrides[task.id];
      const finalDay = override?.day ?? baseDay;
      const finalHour = override?.hour ?? baseHour;

      list.push({
        id: task.id,
        title: task.title,
        category: isMeeting ? 'meeting' : 'task',
        dayOfMonth: finalDay,
        hourSlot: finalHour,
        timeRangeLabel:
          finalHour < 12
            ? `${finalHour}:00 ص - ${finalHour}:45 ص`
            : `${finalHour === 12 ? 12 : finalHour - 12}:00 م - ${
                finalHour === 12 ? 12 : finalHour - 12
              }:45 م`,
        dateIso: `${currentMonthMeta.key}-${String(finalDay).padStart(2, '0')}`,
        companyName: task.relatedTo || 'شركة أفق للحلول الرقمية',
        ownerName: task.assignedToName || 'طارق العتيبي',
        rwqId: task.leadUniqueId || 'RWQ-10482',
        completed: completedOverrides[task.id] ?? task.status === 'مكتملة',
        priority: task.priority,
        meetingLinkLabel: isMeeting ? 'Zoom Enterprise / Google Meet' : undefined,
        participantsCount: isMeeting ? 4 : undefined,
        sourceCollection: 'tasks',
        sourceRecordId: task.id,
      });
    });

    // 2. Map Firestore `deals` (Scheduled Deals by closeDate)
    deals.forEach((deal, idx) => {
      const dealEventId = `cal_deal_${deal.id}`;
      const baseDay = extractDayFromDateString(
        deal.closeDate,
        ((idx * 4 + 14) % 27) + 2
      );
      const baseHour = 13 + (idx % 4);
      const override = dayOverrides[dealEventId];
      const finalDay = override?.day ?? baseDay;
      const finalHour = override?.hour ?? baseHour;

      list.push({
        id: dealEventId,
        title: `استحقاق إغلاق صفقة: ${deal.title}`,
        category: 'deal',
        dayOfMonth: finalDay,
        hourSlot: finalHour,
        timeRangeLabel: `${finalHour - 12}:00 م • موعد إغلاق مستهدف`,
        dateIso: `${currentMonthMeta.key}-${String(finalDay).padStart(2, '0')}`,
        companyName: deal.accountName,
        ownerName: deal.ownerName || 'طارق العتيبي',
        rwqId: deal.leadUniqueId || 'RWQ-10482',
        dealAmount: deal.amount,
        dealStage: deal.stage,
        dealProbability: deal.probability,
        completed: deal.stage === 'مكتملة',
        sourceCollection: 'deals',
        sourceRecordId: deal.id,
      });
    });

    // 3. Curated Executive Meetings & Milestones to ensure rich Monthly & Weekly density
    const rawCuratedSeeds: Array<{
      id: string;
      title: string;
      category: 'task' | 'meeting' | 'deal';
      defaultDay: number;
      defaultHour: number;
      companyName: string;
      ownerName: string;
      rwqId: string;
      priority: CrmTask['priority'];
      meetingLinkLabel?: string;
      participantsCount?: number;
      completed?: boolean;
    }> = [
      {
        id: 'cal_cur_meeting_1',
        title: 'عرض توضيحي فني لمنظومة الربط السحابي (Enterprise Demo)',
        category: 'meeting',
        defaultDay: 17,
        defaultHour: 11,
        companyName: 'بنك الاستثمار العربي المتحد',
        ownerName: 'طارق العتيبي',
        rwqId: 'RWQ-11029',
        priority: 'عالية',
        meetingLinkLabel: 'غرفة Zoom الموحدة',
        participantsCount: 5,
      },
      {
        id: 'cal_cur_meeting_2',
        title: 'اجتماع مطابقة شروط العقد المالي والفوترة الإلكترونية ZATCA',
        category: 'meeting',
        defaultDay: 18,
        defaultHour: 14,
        companyName: 'شركة المدار القابضة للحلول المتطورة',
        ownerName: 'سارة القحطاني',
        rwqId: 'RWQ-10395',
        priority: 'عالية',
        meetingLinkLabel: 'Google Meet مباشر',
        participantsCount: 3,
      },
      {
        id: 'cal_cur_task_3',
        title: 'مراجعة واعتماد عرض السعر النهائي قبل الإرسال للعميل',
        category: 'task',
        defaultDay: 16,
        defaultHour: 10,
        companyName: 'مجموعة النخبة الطبي المتخصص',
        ownerName: 'طارق العتيبي',
        rwqId: 'RWQ-10440',
        priority: 'عالية',
        completed: false,
      },
      {
        id: 'cal_cur_task_overdue_1',
        title: 'إرسال ملحق اتفاقية مستوى الخدمة SLA المحدث للاعتماد القانوني',
        category: 'task',
        defaultDay: 14,
        defaultHour: 11,
        companyName: 'شركة الرواد للخدمات اللوجستية',
        ownerName: 'طارق العتيبي',
        rwqId: 'RWQ-10312',
        priority: 'عالية',
        completed: false,
      },
      {
        id: 'cal_cur_task_overdue_2',
        title: 'متابعة تحصيل الدفعة الأولى لعقد التراخيص السحابية السنوي',
        category: 'task',
        defaultDay: 15,
        defaultHour: 13,
        companyName: 'مؤسسة آفاق الخليج التجارية',
        ownerName: 'سارة القحطاني',
        rwqId: 'RWQ-10519',
        priority: 'متوسطة',
        completed: false,
      },
      {
        id: 'cal_cur_meeting_4',
        title: 'ورشة عمل تسليم المشروع وتدريب فريق التشغيل (Onboarding)',
        category: 'meeting',
        defaultDay: 19,
        defaultHour: 10,
        companyName: 'شركة قمة التقنية للحلول',
        ownerName: 'طارق العتيبي',
        rwqId: 'RWQ-10482',
        priority: 'متوسطة',
        meetingLinkLabel: 'حضوري • المقر الرئيسي بالرياض',
        participantsCount: 6,
      },
    ];

    const curatedSeeds: UnifiedCalendarEvent[] = rawCuratedSeeds.map((seed) => {
      const finalDay = dayOverrides[seed.id]?.day ?? seed.defaultDay;
      const finalHour = dayOverrides[seed.id]?.hour ?? seed.defaultHour;
      return {
        id: seed.id,
        title: seed.title,
        category: seed.category,
        dayOfMonth: finalDay,
        hourSlot: finalHour,
        timeRangeLabel: formatHourSlotRange(finalHour, seed.category),
        dateIso: `${currentMonthMeta.key}-${String(finalDay).padStart(2, '0')}`,
        companyName: seed.companyName,
        ownerName: seed.ownerName,
        rwqId: seed.rwqId,
        priority: seed.priority,
        meetingLinkLabel: seed.meetingLinkLabel,
        participantsCount: seed.participantsCount,
        completed: completedOverrides[seed.id] ?? seed.completed,
        sourceCollection: 'curated',
      };
    });

    const mappedCustomEvents: UnifiedCalendarEvent[] = customEvents.map((ev) => {
      const finalDay = dayOverrides[ev.id]?.day ?? ev.dayOfMonth;
      const finalHour = dayOverrides[ev.id]?.hour ?? ev.hourSlot;
      return {
        ...ev,
        dayOfMonth: finalDay,
        hourSlot: finalHour,
        completed: completedOverrides[ev.id] ?? ev.completed,
        timeRangeLabel: formatHourSlotRange(finalHour, ev.category),
        dateIso: `${currentMonthMeta.key}-${String(finalDay).padStart(2, '0')}`,
      };
    });

    return [...list, ...curatedSeeds, ...mappedCustomEvents];
  }, [completedOverrides, currentMonthMeta.key, customEvents, dayOverrides, deals, tasks]);

  // Apply category, owner, and search filters
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUnifiedEvents.filter((ev) => {
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
      if (ownerFilter === 'tareq' && !ev.ownerName.includes('طارق')) return false;
      if (ownerFilter === 'sara' && !ev.ownerName.includes('سارة')) return false;
      if (q) {
        const hay = `${ev.title} ${ev.companyName} ${ev.rwqId} ${ev.ownerName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allUnifiedEvents, categoryFilter, ownerFilter, searchQuery]);

  // Group events by dayOfMonth (1..30)
  const eventsByDay = useMemo(() => {
    const map: Record<number, UnifiedCalendarEvent[]> = {};
    for (let d = 1; d <= 30; d += 1) {
      map[d] = [];
    }
    filteredEvents.forEach((ev) => {
      const d = Math.max(1, Math.min(30, ev.dayOfMonth));
      map[d].push(ev);
    });
    Object.keys(map).forEach((k) => {
      map[Number(k)].sort((a, b) => a.hourSlot - b.hourSlot);
    });
    return map;
  }, [filteredEvents]);

  // Summary KPIs
  const calendarKpis = useMemo(() => {
    const tasksCount = filteredEvents.filter((e) => e.category === 'task').length;
    const meetingsCount = filteredEvents.filter((e) => e.category === 'meeting').length;
    const scheduledDeals = filteredEvents.filter((e) => e.category === 'deal');
    const dealsValueTotal = scheduledDeals.reduce((s, d) => s + (d.dealAmount || 0), 0);
    return {
      totalCount: filteredEvents.length,
      tasksCount,
      meetingsCount,
      dealsCount: scheduledDeals.length,
      dealsValueTotal,
    };
  }, [filteredEvents]);

  // Automatically detect Overdue Tasks (incomplete tasks/meetings scheduled before CURRENT_REFERENCE_DAY)
  const overdueEvents = useMemo(() => {
    return allUnifiedEvents
      .filter(
        (ev) =>
          ev.category !== 'deal' &&
          !ev.completed &&
          ev.dayOfMonth < CURRENT_REFERENCE_DAY
      )
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  }, [allUnifiedEvents]);

  const selectedDayEvents = useMemo(
    () => eventsByDay[selectedDay] ?? [],
    [eventsByDay, selectedDay]
  );

  const activeSelectedEvent = useMemo(() => {
    if (selectedEventId) {
      const found = filteredEvents.find((e) => e.id === selectedEventId);
      if (found) return found;
    }
    return selectedDayEvents[0] ?? filteredEvents[0] ?? null;
  }, [filteredEvents, selectedDayEvents, selectedEventId]);

  // 5 weeks of 7 days for Month Grid
  const monthGridCells = useMemo(() => {
    const cells: Array<{ day: number; inMonth: boolean; weekdayIndex: number }> = [];
    const offset = currentMonthMeta.startOffset;
    for (let i = 0; i < offset; i += 1) {
      cells.push({ day: 29 - offset + i + 1, inMonth: false, weekdayIndex: i % 7 });
    }
    for (let d = 1; d <= 30; d += 1) {
      cells.push({
        day: d,
        inMonth: true,
        weekdayIndex: (offset + d - 1) % 7,
      });
    }
    while (cells.length < 35) {
      const nextDay = cells.length - (offset + 30) + 1;
      cells.push({
        day: nextDay,
        inMonth: false,
        weekdayIndex: cells.length % 7,
      });
    }
    return cells;
  }, [currentMonthMeta.startOffset]);

  // 7 days for the currently selected Week in Weekly View
  const activeWeekDays = useMemo(() => {
    const startDay = Math.max(1, Math.min(24, selectedWeekIndex * 7 + 1));
    return Array.from({ length: 7 }, (_, idx) => {
      const dayNum = Math.min(30, startDay + idx);
      return {
        dayNum,
        weekday: ARABIC_WEEKDAYS[idx],
        events: eventsByDay[dayNum] ?? [],
      };
    });
  }, [eventsByDay, selectedWeekIndex]);

  const handleOpenScheduleOnSlot = (day: number, hour = 11) => {
    setNewEventDay(day);
    setNewEventHour(hour);
    setNewEventTitle('');
    setScheduleModalOpen(true);
  };

  const handleRescheduleEventDay = async (
    ev: UnifiedCalendarEvent,
    targetDay: number,
    targetHour?: number
  ) => {
    const clampedDay = Math.max(1, Math.min(30, targetDay));
    const resolvedHour =
      targetHour !== undefined ? Math.max(9, Math.min(17, targetHour)) : ev.hourSlot;

    if (clampedDay === ev.dayOfMonth && resolvedHour === ev.hourSlot) {
      return;
    }

    const newIsoDate = `${currentMonthMeta.key}-${String(clampedDay).padStart(2, '0')}`;
    const slotLabel =
      HOUR_SLOTS.find((s) => s.hour === resolvedHour)?.label ?? `${resolvedHour}:00`;

    setDayOverrides((prev) => ({
      ...prev,
      [ev.id]: { day: clampedDay, hour: resolvedHour },
    }));
    setSelectedDay(clampedDay);
    setSelectedEventId(ev.id);

    if (firebaseUser && ev.sourceCollection === 'tasks' && ev.sourceRecordId) {
      try {
        await updateDoc(doc(db, 'tasks', ev.sourceRecordId), {
          dueDate: newIsoDate,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${ev.sourceRecordId}`);
      }
    } else if (firebaseUser && ev.sourceCollection === 'deals' && ev.sourceRecordId) {
      try {
        await updateDoc(doc(db, 'deals', ev.sourceRecordId), {
          closeDate: newIsoDate,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `deals/${ev.sourceRecordId}`);
      }
    }

    showToast(
      `تمت إعادة جدولة "${ev.title}" إلى يوم ${clampedDay} ${currentMonthMeta.label} (${slotLabel})`
    );
  };

  // HTML5 Drag & Drop Handlers for Weekly and Monthly Views
  const handleEventDragStart = (e: React.DragEvent, eventId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedEventId(eventId);
    setSelectedEventId(eventId);
  };

  const handleEventDragEnd = () => {
    setDraggedEventId(null);
    setDropTargetSlot(null);
  };

  const handleSlotDragOver = (e: React.DragEvent, day: number, hour?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetSlot?.day !== day || dropTargetSlot?.hour !== hour) {
      setDropTargetSlot({ day, hour });
    }
  };

  const handleSlotDrop = (e: React.DragEvent, targetDay: number, targetHour?: number) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedId = e.dataTransfer.getData('text/plain') || draggedEventId;
    setDraggedEventId(null);
    setDropTargetSlot(null);

    if (!droppedId) return;
    const foundEvent = allUnifiedEvents.find((item) => item.id === droppedId);
    if (!foundEvent) return;

    void handleRescheduleEventDay(foundEvent, targetDay, targetHour);
  };

  const handleRescheduleAllOverdueToToday = async () => {
    if (overdueEvents.length === 0) return;
    const newIsoDate = `${currentMonthMeta.key}-${String(CURRENT_REFERENCE_DAY).padStart(
      2,
      '0'
    )}`;

    const nextOverrides: Record<string, { day: number; hour: number }> = {};
    overdueEvents.forEach((ev, idx) => {
      const targetHour = 9 + ((idx + 1) % 8);
      nextOverrides[ev.id] = { day: CURRENT_REFERENCE_DAY, hour: targetHour };
    });

    setDayOverrides((prev) => ({
      ...prev,
      ...nextOverrides,
    }));
    setSelectedDay(CURRENT_REFERENCE_DAY);
    setSelectedWeekIndex(2);

    if (firebaseUser) {
      for (const ev of overdueEvents) {
        if (ev.sourceCollection === 'tasks' && ev.sourceRecordId) {
          try {
            await updateDoc(doc(db, 'tasks', ev.sourceRecordId), {
              dueDate: newIsoDate,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `tasks/${ev.sourceRecordId}`);
          }
        }
      }
    }

    showToast(
      `تمت إعادة جدولة جميع المهام المتأخرة (${overdueEvents.length}) إلى اليوم (${CURRENT_REFERENCE_DAY} ${currentMonthMeta.label}) بضغطة واحدة.`
    );
  };

  const handleToggleEventComplete = async (ev: UnifiedCalendarEvent) => {
    setCompletedOverrides((prev) => ({
      ...prev,
      [ev.id]: !ev.completed,
    }));
    if (ev.sourceCollection === 'tasks' && ev.sourceRecordId) {
      await toggleTaskStatus(ev.sourceRecordId);
      showToast(`تم تحديث حالة المهمة "${ev.title}" في Firestore.`);
      return;
    }
    setCustomEvents((prev) =>
      prev.map((item) =>
        item.id === ev.id ? { ...item, completed: !item.completed } : item
      )
    );
    showToast(`تم تحديث حالة "${ev.title}" كمكتملة.`);
  };

  const handleNavigateToEntity = (ev: UnifiedCalendarEvent) => {
    if (ev.category === 'deal' && ev.sourceRecordId) {
      navigate(`/deals/${ev.sourceRecordId}`);
      return;
    }
    const matchedDeal = deals.find(
      (d) => d.leadUniqueId === ev.rwqId || d.accountName === ev.companyName
    );
    if (matchedDeal) {
      navigate(`/deals/${matchedDeal.id}`);
      return;
    }
    const matchedContact = contacts.find((c) => c.leadUniqueId === ev.rwqId);
    if (matchedContact) {
      navigate(`/contacts/${matchedContact.id}`);
      return;
    }
    const matchedLead = leads.find((l) => l.unique_id === ev.rwqId);
    if (matchedLead) {
      navigate(`/leads/${matchedLead.id}`);
      return;
    }
    navigate('/deals');
  };

  const handleOpenEventChat = (ev: UnifiedCalendarEvent) => {
    const matchedLead = leads.find((l) => l.unique_id === ev.rwqId);
    if (matchedLead) {
      openInboxForLead(matchedLead.id);
      return;
    }
    const matchedContact = contacts.find((c) => c.leadUniqueId === ev.rwqId);
    if (matchedContact) {
      openInboxForContact(matchedContact.id);
      return;
    }
    navigate('/whatsapp-inbox');
  };

  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || isSavingEvent) return;
    setIsSavingEvent(true);

    const targetDateIso = `${currentMonthMeta.key}-${String(newEventDay).padStart(2, '0')}`;
    const cleanTitle = newEventTitle.trim().slice(0, 150);
    const cleanCompany = newEventCompany.trim().slice(0, 130) || 'شركة قمة التقنية';
    const cleanRwq = newEventRwq.trim().match(/^RWQ-\d{5}$/)
      ? newEventRwq.trim()
      : 'RWQ-10482';

    try {
      if (newEventCategory === 'deal') {
        const parsedAmount = Math.max(1000, Number(newDealAmount) || 150000);
        await createDeal({
          title: cleanTitle,
          accountId: 'acc_1',
          accountName: cleanCompany,
          amount: parsedAmount,
          stage: 'تفاوض',
          probability: 75,
          closeDate: targetDateIso,
          ownerName: 'طارق العتيبي',
        });
        setSelectedDay(newEventDay);
        setScheduleModalOpen(false);
        showToast(`تمت جدولة الصفقة "${cleanTitle}" بتاريخ إغلاق ${targetDateIso}`);
      } else {
        const taskId = `task_cal_${Date.now()}`;
        const prefixedTitle =
          newEventCategory === 'meeting' && !cleanTitle.includes('اجتماع')
            ? `اجتماع: ${cleanTitle}`
            : cleanTitle;

        if (firebaseUser) {
          try {
            await setDoc(doc(db, 'tasks', taskId), {
              ownerId: firebaseUser.uid,
              org_id: currentOrgId,
              title: prefixedTitle,
              priority: newEventPriority,
              status: 'قيد التنفيذ',
              dueDate: targetDateIso,
              relatedTo: cleanCompany,
              assignedToName: 'طارق العتيبي',
              leadUniqueId: cleanRwq,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
          }
        } else {
          setCustomEvents((prev) => [
            {
              id: taskId,
              title: prefixedTitle,
              category: newEventCategory,
              dayOfMonth: newEventDay,
              hourSlot: newEventHour,
              timeRangeLabel: `${newEventHour}:00`,
              dateIso: targetDateIso,
              companyName: cleanCompany,
              ownerName: 'طارق العتيبي',
              rwqId: cleanRwq,
              priority: newEventPriority,
              completed: false,
              sourceCollection: 'curated',
            },
            ...prev,
          ]);
        }

        setDayOverrides((prev) => ({
          ...prev,
          [taskId]: { day: newEventDay, hour: newEventHour },
        }));
        setSelectedDay(newEventDay);
        setScheduleModalOpen(false);
        showToast(
          `تمت جدولة ${
            newEventCategory === 'meeting' ? 'الاجتماع' : 'المهمة'
          } "${prefixedTitle}" في يوم ${newEventDay} بنجاح.`
        );
      }
    } finally {
      setIsSavingEvent(false);
    }
  };

  return (
    <div dir="rtl" className="w-full space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46] shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#047857] hover:text-[#065F46]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Active Meeting Join Banner */}
      {activeMeetingBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-[12px] font-bold text-[#1E3A8A] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Video className="h-4 w-4 text-[#2563EB] animate-pulse shrink-0" />
            <span>{activeMeetingBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveMeetingBanner(null)}
            className="rounded-lg bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-[#FFFFFF] cursor-pointer"
          >
            مغادرة الغرفة
          </button>
        </div>
      )}

      {/* 1. UNIFIED CALENDAR KPI RIBBON (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B]">
              إجمالي الأحداث المجدولة
            </p>
            <p className="text-[22px] font-extrabold text-[#0F172A] tabular-nums mt-0.5">
              {calendarKpis.totalCount}
              <span className="text-[12px] font-semibold text-[#64748B] mr-1.5">
                حدث نشط
              </span>
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B]">
              الاجتماعات والعروض التوضيحية
            </p>
            <p className="text-[22px] font-extrabold text-[#2563EB] tabular-nums mt-0.5">
              {calendarKpis.meetingsCount}
              <span className="text-[12px] font-semibold text-[#64748B] mr-1.5">
                اجتماع (Zoom / Meet)
              </span>
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <Video className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B]">
              المهام التنفيذية والمتابعات
            </p>
            <p className="text-[22px] font-extrabold text-[#D97706] tabular-nums mt-0.5">
              {calendarKpis.tasksCount}
              <span className="text-[12px] font-semibold text-[#64748B] mr-1.5">
                مهمة مرتبطة
              </span>
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFBEB] text-[#D97706]">
            <ClipboardCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B]">
              الصفقات المجدولة للإغلاق ({calendarKpis.dealsCount})
            </p>
            <p className="text-[20px] font-extrabold text-[#059669] tabular-nums mt-0.5">
              {formatCurrencySAR(calendarKpis.dealsValueTotal)}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669]">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. CALENDAR CONTROL BAR: VIEW SWITCHER (MONTH / WEEK) + CATEGORY PILLS + MONTH NAVIGATION */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Right: Month/Week Navigation & Current Period */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => {
                  if (calendarView === 'month') {
                    setMonthIndex((prev) =>
                      prev > 0 ? prev - 1 : AVAILABLE_MONTHS.length - 1
                    );
                  } else {
                    setSelectedWeekIndex((prev) => (prev > 0 ? prev - 1 : 3));
                  }
                }}
                aria-label="الفترة السابقة"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#FFFFFF] hover:text-[#0F172A] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="px-3 text-[13px] font-extrabold text-[#0F172A] whitespace-nowrap">
                {calendarView === 'month'
                  ? currentMonthMeta.label
                  : `الأسبوع ${selectedWeekIndex + 1} • ${currentMonthMeta.label}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (calendarView === 'month') {
                    setMonthIndex((prev) => (prev + 1) % AVAILABLE_MONTHS.length);
                  } else {
                    setSelectedWeekIndex((prev) => (prev + 1) % 4);
                  }
                }}
                aria-label="الفترة التالية"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#FFFFFF] hover:text-[#0F172A] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMonthIndex(0);
                setSelectedDay(17);
                setSelectedWeekIndex(2);
              }}
              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-bold text-[#0F172A] cursor-pointer"
            >
              اليوم (17 نوفمبر)
            </button>

            {/* Entity Legend Pills / Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  key: 'all' as const,
                  label: `الكل (${allUnifiedEvents.length})`,
                  activeClass: 'bg-[#0F172A] text-[#FFFFFF]',
                },
                {
                  key: 'meeting' as const,
                  label: 'الاجتماعات والعروض',
                  dot: 'bg-[#2563EB]',
                  activeClass: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
                },
                {
                  key: 'task' as const,
                  label: 'المهام التنفيذية',
                  dot: 'bg-[#F59E0B]',
                  activeClass: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
                },
                {
                  key: 'deal' as const,
                  label: 'الصفقات المجدولة للإغلاق',
                  dot: 'bg-[#10B981]',
                  activeClass: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
                },
              ].map((pill) => {
                const active = categoryFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setCategoryFilter(pill.key)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? pill.activeClass
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    {pill.dot && <span className={`h-2 w-2 rounded-full ${pill.dot}`} />}
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left: Monthly / Weekly View Toggle + Search + "+ جدولة في التقويم" */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Monthly vs Weekly Toggle */}
            <div className="inline-flex items-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-1 text-[12px] font-bold">
              <button
                type="button"
                onClick={() => setCalendarView('month')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  calendarView === 'month'
                    ? 'bg-[#2563EB] text-[#FFFFFF] shadow-2xs font-extrabold'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                العرض الشهري (Month)
              </button>
              <button
                type="button"
                onClick={() => setCalendarView('week')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  calendarView === 'week'
                    ? 'bg-[#2563EB] text-[#FFFFFF] shadow-2xs font-extrabold'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                العرض الأسبوعي (Week)
              </button>
              {embedded && onSwitchToListView && (
                <button
                  type="button"
                  onClick={onSwitchToListView}
                  className="px-3 py-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] cursor-pointer"
                >
                  عرض القائمة
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenScheduleOnSlot(selectedDay, 11)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ جدولة مهمة / اجتماع / صفقة</span>
            </button>
          </div>
        </div>

        {/* Sub-row: Search & Team Owner Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-bold text-[#64748B] flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-[#2563EB]" />
              تصفية حسب المسؤول:
            </span>
            {[
              { key: 'all', label: 'كل الفريق' },
              { key: 'tareq', label: 'طارق العتيبي' },
              { key: 'sara', label: 'سارة القحطاني' },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setOwnerFilter(o.key)}
                className={`rounded-lg px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                  ownerFilter === o.key
                    ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#1E40AF]">
              <Move className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>اسحب وأفلت المهام والاجتماعات لإعادة الجدولة الفورية (Drag & Drop)</span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في التقويم (صفقة، عميل، RWQ)..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] pr-8 pl-3 py-1.5 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN 2-COLUMN CALENDAR WORKSPACE: RIGHT CALENDAR GRID (72%) + LEFT EVENT/DAY INSPECTOR (28%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* RIGHT (9 COLS): INTERACTIVE MONTHLY OR WEEKLY GRID */}
        <div className="xl:col-span-9">
          {calendarView === 'month' ? (
            /* =============================================================== */
            /* MONTHLY INTERACTIVE CALENDAR GRID                               */
            /* =============================================================== */
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
              {/* 7-Day Weekday Header */}
              <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC] text-center">
                {ARABIC_WEEKDAYS.map((wd) => (
                  <div
                    key={wd.index}
                    className="py-3 text-[12px] font-extrabold text-[#475569] border-l last:border-l-0 border-[#E2E8F0]"
                  >
                    {wd.full}
                  </div>
                ))}
              </div>

              {/* 35-Cell Month Grid */}
              <div className="grid grid-cols-7 divide-y divide-[#E2E8F0]">
                {monthGridCells.map((cell, idx) => {
                  const dayEvents = cell.inMonth ? eventsByDay[cell.day] ?? [] : [];
                  const isToday = cell.inMonth && cell.day === 17 && monthIndex === 0;
                  const isSelected = cell.inMonth && cell.day === selectedDay;
                  const dayDealSum = dayEvents
                    .filter((e) => e.category === 'deal')
                    .reduce((s, d) => s + (d.dealAmount || 0), 0);

                  const isDropTargetDay =
                    cell.inMonth &&
                    dropTargetSlot?.day === cell.day &&
                    dropTargetSlot?.hour === undefined;

                  return (
                    <div
                      key={`${cell.day}_${idx}`}
                      onDragOver={(e) => {
                        if (!cell.inMonth) return;
                        handleSlotDragOver(e, cell.day);
                      }}
                      onDrop={(e) => {
                        if (!cell.inMonth) return;
                        handleSlotDrop(e, cell.day);
                      }}
                      onClick={() => {
                        if (!cell.inMonth) return;
                        setSelectedDay(cell.day);
                        if (dayEvents[0]) {
                          setSelectedEventId(dayEvents[0].id);
                        }
                      }}
                      className={`group min-h-[132px] p-2 border-l last:border-l-0 border-[#E2E8F0] flex flex-col justify-between transition-all ${
                        !cell.inMonth
                          ? 'bg-[#F8FAFC]/60 text-[#CBD5E1]'
                          : isDropTargetDay
                            ? 'bg-[#DBEAFE]/70 ring-2 ring-inset ring-[#2563EB]'
                            : isSelected
                              ? 'bg-[#EFF6FF]/45 ring-2 ring-inset ring-[#2563EB]'
                              : 'bg-[#FFFFFF] hover:bg-[#F8FAFC]/80 cursor-pointer'
                      }`}
                    >
                      {/* Top of Day Cell: Day Number + Quick Add Button */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold tabular-nums ${
                              !cell.inMonth
                                ? 'text-[#CBD5E1]'
                                : isToday
                                  ? 'bg-[#2563EB] text-[#FFFFFF]'
                                  : isSelected
                                    ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                                    : 'text-[#0F172A]'
                            }`}
                          >
                            {cell.day}
                          </span>
                          {isToday && (
                            <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[9px] font-extrabold text-[#1D4ED8]">
                              اليوم
                            </span>
                          )}
                        </div>

                        {cell.inMonth && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenScheduleOnSlot(cell.day, 11);
                            }}
                            title={`إضافة حدث في يوم ${cell.day}`}
                            className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-[#FFFFFF] transition-all cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Middle of Day Cell: Draggable Event Pills (Tasks, Meetings, Scheduled Deals) */}
                      <div className="my-1.5 space-y-1 flex-1">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const badgeStyle =
                            ev.category === 'meeting'
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]'
                              : ev.category === 'deal'
                                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                                : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]';
                          const isBeingDragged = draggedEventId === ev.id;

                          return (
                            <div
                              key={ev.id}
                              draggable
                              onDragStart={(e) => handleEventDragStart(e, ev.id)}
                              onDragEnd={handleEventDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDay(cell.day);
                                setSelectedEventId(ev.id);
                              }}
                              title="اسحب وأفلت لنقل الموعد إلى يوم آخر"
                              className={`w-full text-right rounded-md border px-1.5 py-1 text-[10px] font-bold truncate flex items-center justify-between gap-1 transition-all hover:scale-[1.01] cursor-grab active:cursor-grabbing select-none ${badgeStyle} ${
                                ev.completed ? 'line-through opacity-65' : ''
                              } ${isBeingDragged ? 'opacity-40 ring-2 ring-[#2563EB]' : ''}`}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <GripVertical className="h-3 w-3 opacity-60 shrink-0" />
                                <span className="truncate">{ev.title}</span>
                              </div>
                              {ev.category === 'deal' && ev.dealAmount && (
                                <span className="font-mono text-[9px] font-extrabold shrink-0 tabular-nums">
                                  {Math.round(ev.dealAmount / 1000)}K
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <div className="text-[10px] font-extrabold text-[#2563EB] px-1">
                            +{dayEvents.length - 3} أحداث أخرى
                          </div>
                        )}
                      </div>

                      {/* Bottom of Day Cell: Scheduled Deal Value Indicator if present */}
                      {cell.inMonth && dayDealSum > 0 && (
                        <div className="border-t border-[#F1F5F9] pt-1 flex items-center justify-between text-[9px] font-extrabold text-[#059669] tabular-nums">
                          <span>صفقات:</span>
                          <span>{formatCurrencySAR(dayDealSum)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            /* =============================================================== */
            /* WEEKLY INTERACTIVE TIME-GRID VIEW WITH DRAG & DROP              */
            /* =============================================================== */
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs overflow-hidden">
              {/* Weekly Drag-and-Drop Instruction Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#EFF6FF]/65 px-4 py-2.5 text-[11px]">
                <div className="flex items-center gap-2 font-bold text-[#1E3A8A]">
                  <GripVertical className="h-4 w-4 text-[#2563EB]" />
                  <span>
                    وضع السحب والإفلات التفاعلي (Weekly Drag & Drop): اسحب أي مهمة أو اجتماع وأفلته في أي يوم أو ساعة لإعادة جدولته فوراً.
                  </span>
                </div>
                {draggedEventId && (
                  <span className="rounded-md bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-extrabold text-[#FFFFFF] animate-pulse">
                    أفلت البطاقة في خانة اليوم والساعة المطلوبة...
                  </span>
                )}
              </div>

              {/* Weekly Header Row */}
              <div className="grid grid-cols-8 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="p-3 text-center text-[11px] font-extrabold text-[#64748B] border-l border-[#E2E8F0]">
                  الساعة / اليوم
                </div>
                {activeWeekDays.map((wd) => {
                  const isSelected = wd.dayNum === selectedDay;
                  const isDayHeaderDropTarget =
                    dropTargetSlot?.day === wd.dayNum && dropTargetSlot?.hour === undefined;
                  const dealTotal = wd.events
                    .filter((e) => e.category === 'deal')
                    .reduce((s, d) => s + (d.dealAmount || 0), 0);
                  return (
                    <button
                      key={wd.dayNum}
                      type="button"
                      onClick={() => setSelectedDay(wd.dayNum)}
                      onDragOver={(e) => handleSlotDragOver(e, wd.dayNum)}
                      onDrop={(e) => handleSlotDrop(e, wd.dayNum)}
                      className={`p-2.5 text-center border-l last:border-l-0 border-[#E2E8F0] transition-all cursor-pointer ${
                        isDayHeaderDropTarget
                          ? 'bg-[#DBEAFE] ring-2 ring-inset ring-[#2563EB]'
                          : isSelected
                            ? 'bg-[#EFF6FF]'
                            : 'hover:bg-[#F1F5F9]/60'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-[#64748B]">
                        {wd.weekday.full}
                      </p>
                      <p
                        className={`text-[15px] font-extrabold tabular-nums mt-0.5 ${
                          isSelected ? 'text-[#2563EB]' : 'text-[#0F172A]'
                        }`}
                      >
                        {wd.dayNum}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold">
                        <span className="rounded bg-[#E2E8F0]/70 px-1.5 py-0.5 text-[#334155] tabular-nums">
                          {wd.events.length} حدث
                        </span>
                        {dealTotal > 0 && (
                          <span className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[#059669] tabular-nums">
                            {Math.round(dealTotal / 1000)}K
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Hourly Time Slots Grid */}
              <div className="divide-y divide-[#E2E8F0]">
                {HOUR_SLOTS.map((slot) => (
                  <div key={slot.hour} className="grid grid-cols-8 min-h-[84px]">
                    {/* Hour Label Column */}
                    <div className="p-2.5 bg-[#F8FAFC]/70 border-l border-[#E2E8F0] flex items-start justify-center text-[11px] font-mono font-bold text-[#64748B] tabular-nums">
                      {slot.label}
                    </div>

                    {/* 7 Day Slot Cells (Drop Zones) */}
                    {activeWeekDays.map((wd) => {
                      const slotEvents = wd.events.filter((e) => e.hourSlot === slot.hour);
                      const isSlotDropTarget =
                        dropTargetSlot?.day === wd.dayNum &&
                        dropTargetSlot?.hour === slot.hour;

                      return (
                        <div
                          key={`${wd.dayNum}_${slot.hour}`}
                          onDragOver={(e) => handleSlotDragOver(e, wd.dayNum, slot.hour)}
                          onDrop={(e) => handleSlotDrop(e, wd.dayNum, slot.hour)}
                          onClick={() => handleOpenScheduleOnSlot(wd.dayNum, slot.hour)}
                          className={`p-1.5 border-l last:border-l-0 border-[#E2E8F0] transition-all cursor-pointer space-y-1.5 ${
                            isSlotDropTarget
                              ? 'bg-[#DBEAFE]/65 ring-2 ring-inset ring-[#2563EB]'
                              : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          {isSlotDropTarget && (
                            <div className="rounded-md border border-dashed border-[#2563EB] bg-[#EFF6FF] px-1.5 py-1 text-center text-[9px] font-extrabold text-[#1D4ED8]">
                              أفلت هنا • يوم {wd.dayNum} ({slot.label})
                            </div>
                          )}

                          {slotEvents.map((ev) => {
                            const style =
                              ev.category === 'meeting'
                                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]'
                                : ev.category === 'deal'
                                  ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46]'
                                  : 'border-[#F59E0B] bg-[#FFFBEB] text-[#92400E]';
                            const isDraggingThis = draggedEventId === ev.id;
                            const isSelectedCard = activeSelectedEvent?.id === ev.id;

                            return (
                              <div
                                key={ev.id}
                                draggable
                                onDragStart={(e) => handleEventDragStart(e, ev.id)}
                                onDragEnd={handleEventDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDay(wd.dayNum);
                                  setSelectedEventId(ev.id);
                                }}
                                title="اسحب وأفلت لإعادة جدولة اليوم أو الساعة"
                                className={`group/card rounded-lg border-r-3 p-1.5 text-[10px] shadow-2xs transition-all cursor-grab active:cursor-grabbing select-none ${style} ${
                                  isDraggingThis
                                    ? 'opacity-40 scale-95 ring-2 ring-[#2563EB]'
                                    : isSelectedCard
                                      ? 'ring-2 ring-[#2563EB]'
                                      : 'hover:shadow-sm'
                                } ${ev.completed ? 'line-through opacity-65' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-extrabold line-clamp-1">{ev.title}</p>
                                  <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover/card:opacity-100" />
                                </div>
                                <p className="text-[9px] opacity-80 truncate mt-0.5">
                                  {ev.companyName}
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-1 text-[9px]">
                                  <span className="font-mono opacity-75 tabular-nums">
                                    {slot.label}
                                  </span>
                                  {ev.dealAmount ? (
                                    <span className="font-mono font-extrabold tabular-nums">
                                      {formatCurrencySAR(ev.dealAmount)}
                                    </span>
                                  ) : (
                                    <span className="font-mono opacity-75">{ev.rwqId}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* LEFT (3 COLS): OVERDUE TASKS ALERT SIDEBAR + SELECTED EVENT INSPECTOR + DAY AGENDA */}
        <aside className="xl:col-span-3 space-y-4">
          {/* Card 0: Overdue Tasks Alert Sidebar (1-Click Rescheduling) */}
          <OverdueTasksAlertSidebar
            overdueEvents={overdueEvents}
            currentReferenceDay={CURRENT_REFERENCE_DAY}
            monthLabel={currentMonthMeta.label}
            selectedEventId={activeSelectedEvent?.id ?? null}
            draggedEventId={draggedEventId}
            onSelectEvent={(ev) => {
              setSelectedDay(ev.dayOfMonth);
              setSelectedEventId(ev.id);
            }}
            onOneClickReschedule={(ev, targetDay, targetHour) => {
              void handleRescheduleEventDay(ev, targetDay, targetHour);
            }}
            onRescheduleAllToToday={() => {
              void handleRescheduleAllOverdueToToday();
            }}
            onMarkComplete={(ev) => {
              void handleToggleEventComplete(ev);
            }}
            onDragStart={handleEventDragStart}
            onDragEnd={handleEventDragEnd}
          />

          {/* Card 1: Selected Event Inspector */}
          {activeSelectedEvent && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-extrabold ${
                    activeSelectedEvent.category === 'meeting'
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : activeSelectedEvent.category === 'deal'
                        ? 'bg-[#ECFDF5] text-[#059669]'
                        : 'bg-[#FFFBEB] text-[#D97706]'
                  }`}
                >
                  {activeSelectedEvent.category === 'meeting'
                    ? 'اجتماع / عرض مجدول'
                    : activeSelectedEvent.category === 'deal'
                      ? 'صفقة مجدولة للإغلاق'
                      : 'مهمة تنفيذية'}
                </span>
                <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB] tabular-nums">
                  {activeSelectedEvent.rwqId}
                </span>
              </div>

              <div>
                <h3 className="text-[14px] font-extrabold text-[#0F172A] leading-snug">
                  {activeSelectedEvent.title}
                </h3>
                <p className="text-[12px] font-semibold text-[#475569] mt-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>{activeSelectedEvent.companyName}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">التاريخ والموعد:</span>
                  <span className="font-extrabold text-[#0F172A] tabular-nums">
                    يوم {activeSelectedEvent.dayOfMonth} •{' '}
                    {activeSelectedEvent.timeRangeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">المسؤول:</span>
                  <span className="font-bold text-[#0F172A]">
                    {activeSelectedEvent.ownerName}
                  </span>
                </div>
                {activeSelectedEvent.dealAmount && (
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-1.5">
                    <span className="text-[#64748B]">قيمة الصفقة المستهدفة:</span>
                    <span className="font-extrabold text-[#059669] tabular-nums">
                      {formatCurrencySAR(activeSelectedEvent.dealAmount)}
                    </span>
                  </div>
                )}
                {activeSelectedEvent.dealStage && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">مرحلة الصفقة:</span>
                    <span className="font-bold text-[#2563EB]">
                      {activeSelectedEvent.dealStage} ({activeSelectedEvent.dealProbability}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Reschedule Day & Hour Controls */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-[#475569]">
                  إعادة جدولة سريعة (أو عبر السحب والإفلات):
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void handleRescheduleEventDay(
                        activeSelectedEvent,
                        activeSelectedEvent.dayOfMonth - 1,
                        activeSelectedEvent.hourSlot
                      )
                    }
                    className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] py-1.5 text-[11px] font-bold text-[#0F172A] cursor-pointer"
                  >
                    ← يوم سابق
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleRescheduleEventDay(
                        activeSelectedEvent,
                        activeSelectedEvent.dayOfMonth + 1,
                        activeSelectedEvent.hourSlot
                      )
                    }
                    className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] py-1.5 text-[11px] font-bold text-[#0F172A] cursor-pointer"
                  >
                    يوم تالٍ →
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#64748B] shrink-0">
                    تغيير الساعة:
                  </span>
                  <select
                    value={activeSelectedEvent.hourSlot}
                    onChange={(e) =>
                      void handleRescheduleEventDay(
                        activeSelectedEvent,
                        activeSelectedEvent.dayOfMonth,
                        Number(e.target.value)
                      )
                    }
                    className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-bold text-[#0F172A]"
                  >
                    {HOUR_SLOTS.map((slot) => (
                      <option key={slot.hour} value={slot.hour}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {activeSelectedEvent.category === 'meeting' ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMeetingBanner(
                        `متصل الآن بغرفة الاجتماع: ${activeSelectedEvent.title} (${activeSelectedEvent.companyName})`
                      )
                    }
                    className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2 text-[12px] font-extrabold text-[#FFFFFF] cursor-pointer"
                  >
                    <Video className="h-4 w-4" />
                    <span>انضم للاجتماع الآن</span>
                  </button>
                ) : activeSelectedEvent.category === 'task' ? (
                  <button
                    type="button"
                    onClick={() => void handleToggleEventComplete(activeSelectedEvent)}
                    className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] py-2 text-[12px] font-extrabold text-[#FFFFFF] cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {activeSelectedEvent.completed
                        ? 'إعادة فتح المهمة'
                        : 'تحديد المهمة كمكتملة'}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleNavigateToEntity(activeSelectedEvent)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] py-2 text-[11px] font-bold text-[#0F172A] cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>فتح السجل</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEventChat(activeSelectedEvent)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] py-2 text-[11px] font-bold text-[#065F46] cursor-pointer"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>محادثة واتساب</span>
                </button>
              </div>
            </section>
          )}

          {/* Card 2: Selected Day Unified Agenda List */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div>
                <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                  أجندة يوم {selectedDay} {currentMonthMeta.label}
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  {selectedDayEvents.length} عناصر مجدولة في هذا اليوم
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenScheduleOnSlot(selectedDay, 12)}
                className="rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-extrabold text-[#2563EB] cursor-pointer"
              >
                + إضافة
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center space-y-2">
                <p className="text-[12px] font-bold text-[#64748B]">
                  لا توجد مهام أو صفقات مجدولة في هذا اليوم
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenScheduleOnSlot(selectedDay, 10)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>جدولة حدث الآن</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {selectedDayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`rounded-xl border p-3 transition-all cursor-pointer ${
                      activeSelectedEvent?.id === ev.id
                        ? 'border-[#2563EB] bg-[#EFF6FF]/60'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B]">
                      <span className="tabular-nums">{ev.timeRangeLabel}</span>
                      <span className="font-mono text-[#2563EB]">{ev.rwqId}</span>
                    </div>
                    <p className="text-[12px] font-extrabold text-[#0F172A] mt-1">
                      {ev.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#475569] truncate">{ev.companyName}</span>
                      {ev.dealAmount && (
                        <span className="font-extrabold text-[#059669] tabular-nums">
                          {formatCurrencySAR(ev.dealAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE NEW TASK / MEETING / DEAL ON CALENDAR                     */}
      {/* ========================================================================= */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                  جدولة عنصر جديد في التقويم الموحد
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  اليوم المحدد: {newEventDay} {currentMonthMeta.label} • الساعة {newEventHour}:00
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCalendarEvent} className="space-y-3.5">
              {/* Category Selector */}
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1.5">
                  نوع الحدث في التقويم
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'meeting' as const, label: 'اجتماع / عرض Demo' },
                    { key: 'task' as const, label: 'مهمة تنفيذية' },
                    { key: 'deal' as const, label: 'صفقة مجدولة للإغلاق' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setNewEventCategory(item.key)}
                      className={`rounded-xl border py-2 px-2 text-[11px] font-extrabold cursor-pointer ${
                        newEventCategory === item.key
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  العنوان / الموضوع *
                </label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder={
                    newEventCategory === 'deal'
                      ? 'مثال: ترقية باقة ERP المؤسسية - 35 مستخدم'
                      : 'مثال: اجتماع مراجعة العرض المالي والربط التقني'
                  }
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    الشركة / المنشأة المرتبطة
                  </label>
                  <input
                    type="text"
                    value={newEventCompany}
                    onChange={(e) => setNewEventCompany(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    معرف العميل (RWQ)
                  </label>
                  <input
                    type="text"
                    value={newEventRwq}
                    onChange={(e) => setNewEventRwq(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 font-mono text-[12px] text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    اليوم في الشهر
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={newEventDay}
                    onChange={(e) => setNewEventDay(Number(e.target.value) || 17)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    الساعة
                  </label>
                  <select
                    value={newEventHour}
                    onChange={(e) => setNewEventHour(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                  >
                    {HOUR_SLOTS.map((s) => (
                      <option key={s.hour} value={s.hour}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {newEventCategory === 'deal' ? (
                  <div>
                    <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                      قيمة الصفقة (ر.س)
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={5000}
                      value={newDealAmount}
                      onChange={(e) => setNewDealAmount(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] font-bold text-[#059669] tabular-nums"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                      الأولوية
                    </label>
                    <select
                      value={newEventPriority}
                      onChange={(e) =>
                        setNewEventPriority(e.target.value as CrmTask['priority'])
                      }
                      className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A]"
                    >
                      <option value="عالية">عالية</option>
                      <option value="متوسطة">متوسطة</option>
                      <option value="منخفضة">منخفضة</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-[#64748B]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] cursor-pointer"
                >
                  {isSavingEvent ? 'جارٍ الحفظ...' : 'حفظ في التقويم و Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
