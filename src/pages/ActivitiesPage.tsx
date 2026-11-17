import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpDown,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Lightbulb,
  List,
  Mail,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  RotateCcw,
  Search,
  TrendingUp,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';
import type { CrmTask } from '../types/crm';
import { UnifiedCalendarModule } from '../components/calendar/UnifiedCalendarModule';

type ActivityKind = 'all' | 'task' | 'meeting' | 'call';
type QuickScopeKey = 'all_sections' | 'today' | 'overdue' | 'upcoming' | 'completed';
type SortMode = 'priority' | 'time' | 'amount';

interface ActivityRecord {
  id: string;
  title: string;
  kind: 'task' | 'meeting' | 'call';
  section: 'overdue' | 'today' | 'upcoming';
  completed: boolean;
  priority: CrmTask['priority'];
  priorityBadgeLabel: string;
  rwqId: string;
  companyName: string;
  contactName?: string;
  ownerName: string;
  stageLabel?: string;
  timeLabel: string;
  overdueLabel?: string;
  participantsCount?: number;
  dealValueLabel?: string;
  attachmentsCount?: number;
  deliveryModeLabel?: 'حضوري' | 'افتراضي';
  primaryActionType: 'zoom' | 'sip_call' | 'attachments' | 'call_icon' | 'mail_icon' | 'chat';
  isFromFirestore?: boolean;
}

const INITIAL_CURATED_ACTIVITIES: ActivityRecord[] = [
  // Overdue (أنشطة متجاوزة لموعد الاستحقاق)
  {
    id: 'act_overdue_1',
    title: 'مكالمة متابعة العرض التسعيري المالي النهائي',
    kind: 'call',
    section: 'overdue',
    completed: false,
    priority: 'عالية',
    priorityBadgeLabel: 'أولوية قصوى',
    rwqId: 'RWQ-10482',
    companyName: 'مجموعة الخزامى القابضة',
    ownerName: 'طارق العتيبي',
    stageLabel: 'المرحلة: التفاوض النهائي',
    timeLabel: '12 مايو',
    overdueLabel: 'متأخر منذ يومين (12 مايو)',
    primaryActionType: 'call_icon',
  },
  {
    id: 'act_overdue_2',
    title: 'إرسال مسودة العقد المحدثة بعد المراجعة القانونية',
    kind: 'task',
    section: 'overdue',
    completed: false,
    priority: 'متوسطة',
    priorityBadgeLabel: 'أولوية عادية',
    rwqId: 'RWQ-09941',
    companyName: 'شركة النماء للخدمات الرقمية',
    ownerName: 'سارة القحطاني',
    timeLabel: '13 مايو',
    overdueLabel: 'متأخر منذ أمس (13 مايو)',
    primaryActionType: 'mail_icon',
  },

  // Today (أنشطة ومواعيد اليوم - الأربعاء 14 مايو)
  {
    id: 'act_today_1',
    title: 'عرض توضيحي فني لمنظومة الأمان والربط السحابي (Demo)',
    kind: 'meeting',
    section: 'today',
    completed: false,
    priority: 'عالية',
    priorityBadgeLabel: 'اجتماع مجدول',
    rwqId: 'RWQ-11029',
    companyName: 'بنك الاستثمار العربي المتحد',
    ownerName: 'طارق العتيبي',
    timeLabel: '11:30 ص - 12:30 م (بعد 45 دقيقة)',
    participantsCount: 4,
    primaryActionType: 'zoom',
  },
  {
    id: 'act_today_2',
    title: 'مكالمة تأهيل واحتياجات التوسع مع المدير التقني',
    kind: 'call',
    section: 'today',
    completed: false,
    priority: 'عالية',
    priorityBadgeLabel: 'مكالمة مجدولة',
    rwqId: 'RWQ-11420',
    companyName: 'مستشفى الأمل التخصصي',
    contactName: 'م. فيصل الشمري - مستشفى الأمل التخصصي',
    ownerName: 'طارق العتيبي',
    timeLabel: '02:00 م - 02:30 م',
    primaryActionType: 'sip_call',
  },
  {
    id: 'act_today_3',
    title: 'تجهيز أمر الشراء والتنسيق مع الإدارة المالية للتوقيع',
    kind: 'task',
    section: 'today',
    completed: false,
    priority: 'عالية',
    priorityBadgeLabel: 'مهمة تنفيذية',
    rwqId: 'RWQ-10874',
    companyName: 'شركة التقنية اللوجستية الحديثة',
    ownerName: 'طارق العتيبي',
    timeLabel: '04:15 م',
    dealValueLabel: 'قيمة الصفقة: 450,000 ر.س',
    attachmentsCount: 3,
    primaryActionType: 'attachments',
  },

  // Upcoming (الأنشطة المجدولة لاحقاً - غداً وما بعده)
  {
    id: 'act_upcoming_1',
    title: 'ورشة عمل تسليم المشروع وتدريب فريق التشغيل',
    kind: 'meeting',
    section: 'upcoming',
    completed: false,
    priority: 'متوسطة',
    priorityBadgeLabel: 'حضوري',
    rwqId: 'RWQ-09312',
    companyName: 'المقر الرئيسي',
    ownerName: 'طارق العتيبي',
    timeLabel: 'غداً، الخميس 15 مايو • 10:00 ص - 12:00 م • المقر الرئيسي',
    deliveryModeLabel: 'حضوري',
    primaryActionType: 'zoom',
  },
  {
    id: 'act_upcoming_2',
    title: 'مراجعة ربع سنوية لمؤشرات الأداء مع العميل الاستراتيجي',
    kind: 'meeting',
    section: 'upcoming',
    completed: false,
    priority: 'عالية',
    priorityBadgeLabel: 'افتراضي',
    rwqId: 'RWQ-08219',
    companyName: 'Google Meet',
    ownerName: 'طارق العتيبي',
    timeLabel: 'الأحد، 18 مايو • 01:00 م • عبر Google Meet',
    deliveryModeLabel: 'افتراضي',
    primaryActionType: 'zoom',
  },
];

const CALENDAR_DAYS: Array<{
  day: number;
  inCurrentMonth: boolean;
  dotColor?: 'blue' | 'red' | 'green';
}> = [
  { day: 26, inCurrentMonth: false },
  { day: 27, inCurrentMonth: false },
  { day: 28, inCurrentMonth: false },
  { day: 29, inCurrentMonth: false },
  { day: 30, inCurrentMonth: false },
  { day: 1, inCurrentMonth: true },
  { day: 2, inCurrentMonth: true },
  { day: 3, inCurrentMonth: true },
  { day: 4, inCurrentMonth: true, dotColor: 'blue' },
  { day: 5, inCurrentMonth: true },
  { day: 6, inCurrentMonth: true },
  { day: 7, inCurrentMonth: true, dotColor: 'blue' },
  { day: 8, inCurrentMonth: true },
  { day: 9, inCurrentMonth: true },
  { day: 10, inCurrentMonth: true },
  { day: 11, inCurrentMonth: true },
  { day: 12, inCurrentMonth: true, dotColor: 'red' },
  { day: 13, inCurrentMonth: true, dotColor: 'red' },
  { day: 14, inCurrentMonth: true, dotColor: 'green' },
  { day: 15, inCurrentMonth: true, dotColor: 'green' },
  { day: 16, inCurrentMonth: true },
  { day: 17, inCurrentMonth: true },
  { day: 18, inCurrentMonth: true, dotColor: 'blue' },
  { day: 19, inCurrentMonth: true },
  { day: 20, inCurrentMonth: true },
  { day: 21, inCurrentMonth: true },
  { day: 22, inCurrentMonth: true },
  { day: 23, inCurrentMonth: true },
  { day: 24, inCurrentMonth: true },
  { day: 25, inCurrentMonth: true },
  { day: 26, inCurrentMonth: true },
  { day: 27, inCurrentMonth: true },
  { day: 28, inCurrentMonth: true },
  { day: 29, inCurrentMonth: true },
  { day: 30, inCurrentMonth: true },
];

function inferKindFromTitle(title: string): 'task' | 'meeting' | 'call' {
  if (
    title.includes('اجتماع') ||
    title.includes('عرض') ||
    title.includes('ورشة') ||
    title.includes('Demo') ||
    title.includes('Zoom')
  ) {
    return 'meeting';
  }
  if (title.includes('مكالمة') || title.includes('اتصال') || title.includes('هاتف')) {
    return 'call';
  }
  return 'task';
}

export const ActivitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    tasks,
    deals,
    contacts,
    leads,
    toggleTaskStatus,
    openInboxForContact,
    openInboxForLead,
  } = useCrm();

  const [curatedActivities, setCuratedActivities] = useState<ActivityRecord[]>(
    INITIAL_CURATED_ACTIVITIES
  );
  const [activeKind, setActiveKind] = useState<ActivityKind>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [quickScope, setQuickScope] = useState<QuickScopeKey>('all_sections');
  const [ownerFilter, setOwnerFilter] = useState<string>('mine');
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(14);

  // Split button & Create Activity modal
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'task' | 'meeting' | 'call'>('task');
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('شركة قمة التقنية للحلول');
  const [newRwq, setNewRwq] = useState('RWQ-10482');
  const [newTimeLabel, setNewTimeLabel] = useState('03:30 م - 04:00 م');
  const [newPriority, setNewPriority] = useState<CrmTask['priority']>('عالية');
  const [creatingActivity, setCreatingActivity] = useState(false);

  const [activeCallBanner, setActiveCallBanner] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const splitRef = useRef<HTMLDivElement>(null);
  const ownerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitMenuOpen(false);
      }
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target as Node)) {
        setOwnerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  // Merge Firestore `tasks` with the curated visual items so both real-time Firestore mutations and visual sections work seamlessly
  const allActivities = useMemo<ActivityRecord[]>(() => {
    const dynamicFromFirestore: ActivityRecord[] = tasks.map((t) => {
      const kind = inferKindFromTitle(t.title);
      const isOverdue = t.dueDate < '2026-11-16' && t.status !== 'مكتملة';
      const isUpcoming = t.dueDate > '2026-11-16';
      const section: ActivityRecord['section'] = isOverdue
        ? 'overdue'
        : isUpcoming
        ? 'upcoming'
        : 'today';

      return {
        id: t.id,
        title: t.title,
        kind,
        section,
        completed: t.status === 'مكتملة',
        priority: t.priority,
        priorityBadgeLabel:
          t.priority === 'عالية'
            ? 'أولوية قصوى'
            : t.priority === 'متوسطة'
            ? 'أولوية عادية'
            : 'أولوية منخفضة',
        rwqId: t.leadUniqueId || 'RWQ-10421',
        companyName: t.relatedTo,
        ownerName: t.assignedToName || 'طارق العتيبي',
        timeLabel: t.dueDate,
        overdueLabel: isOverdue ? `متأخر (${t.dueDate})` : undefined,
        deliveryModeLabel: kind === 'meeting' ? 'افتراضي' : undefined,
        primaryActionType:
          kind === 'meeting' ? 'zoom' : kind === 'call' ? 'sip_call' : 'chat',
        isFromFirestore: true,
      };
    });

    return [...curatedActivities, ...dynamicFromFirestore];
  }, [curatedActivities, tasks]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allActivities.filter((act) => {
      if (activeKind !== 'all' && act.kind !== activeKind) return false;
      if (ownerFilter === 'tareq' && !act.ownerName.includes('طارق')) return false;
      if (ownerFilter === 'sara' && !act.ownerName.includes('سارة')) return false;

      if (quickScope === 'overdue' && act.section !== 'overdue') return false;
      if (quickScope === 'today' && act.section !== 'today') return false;
      if (quickScope === 'upcoming' && act.section !== 'upcoming') return false;
      if (quickScope === 'completed' && !act.completed) return false;

      if (q) {
        const hay = `${act.title} ${act.companyName} ${act.rwqId} ${act.ownerName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortMode === 'priority') {
      const rank: Record<CrmTask['priority'], number> = {
        عالية: 0,
        متوسطة: 1,
        منخفضة: 2,
      };
      return [...list].sort((a, b) => rank[a.priority] - rank[b.priority]);
    }
    return list;
  }, [activeKind, allActivities, ownerFilter, quickScope, searchQuery, sortMode]);

  const overdueList = useMemo(
    () => filteredActivities.filter((a) => a.section === 'overdue' && !a.completed),
    [filteredActivities]
  );

  const todayList = useMemo(
    () =>
      filteredActivities.filter(
        (a) => a.section === 'today' || (quickScope === 'completed' && a.completed)
      ),
    [filteredActivities, quickScope]
  );

  const upcomingList = useMemo(
    () => filteredActivities.filter((a) => a.section === 'upcoming'),
    [filteredActivities]
  );

  // Today completion progress
  const todayStats = useMemo(() => {
    const allToday = allActivities.filter((a) => a.section === 'today');
    const doneInList = allToday.filter((a) => a.completed).length;
    const completedCount = 3 + doneInList;
    const totalCount = Math.max(8, 5 + allToday.length);
    const pct = Math.min(100, Math.round((completedCount / totalCount) * 100));
    return { completedCount, totalCount, pct };
  }, [allActivities]);

  const handleToggleActivityComplete = async (act: ActivityRecord) => {
    if (act.isFromFirestore) {
      await toggleTaskStatus(act.id);
      setToastMsg(
        act.completed
          ? `تمت إعادة فتح النشاط: ${act.title}`
          : `تم تحديد النشاط كمكتمل في Firestore: ${act.title}`
      );
      return;
    }

    setCuratedActivities((prev) =>
      prev.map((item) =>
        item.id === act.id ? { ...item, completed: !item.completed } : item
      )
    );
    setToastMsg(
      act.completed
        ? `تمت إعادة تنشيط المهمة: ${act.title}`
        : `تم إنجاز النشاط بنجاح: ${act.title}`
    );
  };

  const handleSnoozeAllOverdue = async () => {
    // Move curated overdue items to today
    setCuratedActivities((prev) =>
      prev.map((item) =>
        item.section === 'overdue'
          ? {
              ...item,
              section: 'today',
              overdueLabel: undefined,
              timeLabel: 'اليوم • 05:00 م (مؤجلة)',
            }
          : item
      )
    );

    // Also update any overdue Firestore tasks
    if (firebaseUser) {
      const overdueFs = tasks.filter(
        (t) => t.dueDate < '2026-11-16' && t.status !== 'مكتملة'
      );
      for (const t of overdueFs) {
        try {
          await updateDoc(doc(db, 'tasks', t.id), {
            dueDate: '2026-11-16',
            status: 'مؤجلة',
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tasks/${t.id}`);
        }
      }
    }

    setToastMsg('تم تأجيل كافة الأنشطة المتأخرة وجدولتها ضمن مواعيد اليوم');
  };

  const handleNavigateByRwq = (rwqId: string, companyName: string) => {
    const matchedDeal = deals.find(
      (d) => d.leadUniqueId === rwqId || d.accountName === companyName
    );
    if (matchedDeal) {
      navigate(`/deals/${matchedDeal.id}`);
      return;
    }
    const matchedContact = contacts.find((c) => c.leadUniqueId === rwqId);
    if (matchedContact) {
      navigate(`/contacts/${matchedContact.id}`);
      return;
    }
    const matchedLead = leads.find((l) => l.unique_id === rwqId);
    if (matchedLead) {
      navigate(`/leads/${matchedLead.id}`);
      return;
    }
    navigate('/deals');
  };

  const handleOpenCreateModal = (kind: 'task' | 'meeting' | 'call') => {
    setCreateKind(kind);
    setSplitMenuOpen(false);
    setNewTitle(
      kind === 'meeting'
        ? 'اجتماع مراجعة العرض الفني والربط السحابي'
        : kind === 'call'
        ? 'مكالمة متابعة اعتماد أمر الشراء'
        : 'متابعة توقيع اتفاقية مستوى الخدمة (SLA)'
    );
    setCreateModalOpen(true);
  };

  const handleCreateActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creatingActivity) return;
    setCreatingActivity(true);

    const ts = Date.now();
    const taskId = `task_act_${ts}`;
    const cleanTitle = newTitle.trim().slice(0, 155);
    const cleanCompany = newCompany.trim().slice(0, 135) || 'شركة قمة التقنية';
    const cleanRwq = newRwq.trim().match(/^RWQ-\d{5}$/)
      ? newRwq.trim()
      : 'RWQ-10482';

    try {
      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'tasks', taskId), {
            ownerId: firebaseUser.uid,
            title: cleanTitle,
            priority: newPriority,
            status: 'قيد التنفيذ',
            dueDate: '2026-11-16',
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
        const added: ActivityRecord = {
          id: taskId,
          title: cleanTitle,
          kind: createKind,
          section: 'today',
          completed: false,
          priority: newPriority,
          priorityBadgeLabel:
            newPriority === 'عالية' ? 'أولوية قصوى' : 'أولوية عادية',
          rwqId: cleanRwq,
          companyName: cleanCompany,
          ownerName: 'طارق العتيبي',
          timeLabel: newTimeLabel || 'اليوم • 03:30 م',
          primaryActionType:
            createKind === 'meeting'
              ? 'zoom'
              : createKind === 'call'
              ? 'sip_call'
              : 'chat',
        };
        setCuratedActivities((prev) => [added, ...prev]);
      }

      setCreateModalOpen(false);
      setNewTitle('');
      setToastMsg('تمت إضافة النشاط الجديد وحفظه في جدول اليوم');
    } finally {
      setCreatingActivity(false);
    }
  };

  // Mini circular progress SVG
  const ringR = 13;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (todayStats.pct / 100) * ringC;

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] pb-12">
      {/* 1. FLUSH WHITE HEADER & FILTERS */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-5 pb-4">
        <div className="w-full space-y-4">
          {/* Row 1: Title + Type Tabs (Right in RTL) | View Switcher + Split Button (Left in RTL) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Right Side: Title + Type Tabs */}
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] shrink-0 mt-0.5">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#0F172A] leading-tight">
                    المهام والأنشطة اليومية
                  </h1>
                  <p className="text-[12px] text-[#64748B]">
                    إدارة الجداول الزمنية، مكالمات المتابعة، والاجتماعات البيعية
                  </p>
                </div>
              </div>

              {/* Type Tabs ("الكل", "المهام", "الاجتماعات", "المكالمات") */}
              <div
                role="tablist"
                aria-label="تصنيف الأنشطة"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeKind === 'all'}
                  onClick={() => setActiveKind('all')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    activeKind === 'all'
                      ? 'bg-[#FFFFFF] text-[#0F172A] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <span>الكل</span>
                  <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-extrabold text-[#FFFFFF] tabular-nums">
                    28
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeKind === 'task'}
                  onClick={() => setActiveKind('task')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    activeKind === 'task'
                      ? 'bg-[#FFFFFF] text-[#0F172A] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <span>المهام</span>
                  <span className="rounded-full bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-bold text-[#475569] tabular-nums">
                    15
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeKind === 'meeting'}
                  onClick={() => setActiveKind('meeting')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    activeKind === 'meeting'
                      ? 'bg-[#FFFFFF] text-[#0F172A] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <span>الاجتماعات</span>
                  <span className="rounded-full bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-bold text-[#475569] tabular-nums">
                    7
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeKind === 'call'}
                  onClick={() => setActiveKind('call')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    activeKind === 'call'
                      ? 'bg-[#FFFFFF] text-[#0F172A] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <span>المكالمات</span>
                  <span className="rounded-full bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-bold text-[#475569] tabular-nums">
                    6
                  </span>
                </button>
              </div>
            </div>

            {/* Left Side: View Switcher ("قائمة" | "تقويم") + Split Button "[ + نشاط جديد | ⌄ ]" */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher */}
              <div className="inline-flex items-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    viewMode === 'list'
                      ? 'bg-[#EFF6FF] text-[#2563EB] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>قائمة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                    viewMode === 'calendar'
                      ? 'bg-[#EFF6FF] text-[#2563EB] shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>تقويم</span>
                </button>
              </div>

              {/* Split Button: [ + نشاط جديد | ⌄ ] */}
              <div className="relative" ref={splitRef}>
                <div className="inline-flex items-center rounded-xl bg-[#2563EB] text-[#FFFFFF] shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal('task')}
                    className="inline-flex h-9 items-center gap-1.5 px-3.5 text-[12px] font-extrabold hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>نشاط جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMenuOpen((p) => !p)}
                    aria-label="خيارات إنشاء نشاط جديد"
                    className="inline-flex h-9 items-center justify-center border-r border-[#FFFFFF]/25 px-2.5 hover:bg-[#1D4ED8] transition-colors"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {splitMenuOpen && (
                  <div className="flyout-surface absolute left-0 top-11 z-30 w-48 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal('task')}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-right text-[12px] font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                    >
                      <ClipboardCheck className="h-4 w-4 text-[#2563EB]" />
                      <span>مهمة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal('meeting')}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-right text-[12px] font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                    >
                      <Video className="h-4 w-4 text-[#2563EB]" />
                      <span>اجتماع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal('call')}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-right text-[12px] font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                    >
                      <Phone className="h-4 w-4 text-[#059669]" />
                      <span>تسجيل مكالمة</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Quick Filter Pills (Right in RTL) | Search & Sort Controls (Left in RTL) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuickScope((prev) =>
                    prev === 'today' ? 'all_sections' : 'today'
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                  quickScope === 'all_sections' || quickScope === 'today'
                    ? 'bg-[#2563EB] text-[#FFFFFF] shadow-2xs'
                    : 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#FFFFFF]" />
                <span>اليوم</span>
                <span className="rounded-full bg-[#FFFFFF]/20 px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums">
                  8
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setQuickScope((prev) =>
                    prev === 'overdue' ? 'all_sections' : 'overdue'
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                  quickScope === 'overdue'
                    ? 'border-[#E11D48] bg-[#E11D48] text-[#FFFFFF]'
                    : 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FFE4E6]'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>متأخرة</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums ${
                    quickScope === 'overdue'
                      ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                      : 'bg-[#E11D48] text-[#FFFFFF]'
                  }`}
                >
                  {overdueList.length > 0 ? 5 : 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setQuickScope((prev) =>
                    prev === 'upcoming' ? 'all_sections' : 'upcoming'
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                  quickScope === 'upcoming'
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                    : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                <span>القادمة</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setQuickScope((prev) =>
                    prev === 'completed' ? 'all_sections' : 'completed'
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap ${
                  quickScope === 'completed'
                    ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                    : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                <span>مكتملة</span>
              </button>

              <span className="mx-1 text-[#CBD5E1]">|</span>

              {/* Owner Filter Dropdown ("المسؤول: أنا") */}
              <div className="relative" ref={ownerMenuRef}>
                <button
                  type="button"
                  onClick={() => setOwnerMenuOpen((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFFFFF] px-3.5 py-1.5 text-[12px] font-bold text-[#334155] transition-colors whitespace-nowrap"
                >
                  <User className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>
                    {ownerFilter === 'mine'
                      ? 'المسؤول: أنا'
                      : ownerFilter === 'tareq'
                      ? 'المسؤول: طارق العتيبي'
                      : ownerFilter === 'sara'
                      ? 'المسؤول: سارة القحطاني'
                      : 'المسؤول: كل الفريق'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-[#64748B]" />
                </button>

                {ownerMenuOpen && (
                  <div className="flyout-surface absolute right-0 top-10 z-30 w-48 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1 shadow-xl">
                    {[
                      { key: 'mine', label: 'المسؤول: أنا' },
                      { key: 'all', label: 'كافة أعضاء الفريق' },
                      { key: 'tareq', label: 'طارق العتيبي' },
                      { key: 'sara', label: 'سارة القحطاني' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setOwnerFilter(opt.key);
                          setOwnerMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3.5 py-2 text-right text-[12px] font-semibold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                      >
                        <span>{opt.label}</span>
                        {ownerFilter === opt.key && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="تصفية حسب المهمة، العميل، المعرف..."
                  className="h-9 w-64 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-9 pl-3 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setSortMode((prev) =>
                    prev === 'priority'
                      ? 'time'
                      : prev === 'time'
                      ? 'amount'
                      : 'priority'
                  )
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#334155] transition-colors whitespace-nowrap"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-[#64748B]" />
                <span>
                  {sortMode === 'priority'
                    ? 'الترتيب: الأولوية'
                    : sortMode === 'time'
                    ? 'الترتيب: الموعد الزمني'
                    : 'الترتيب: قيمة الصفقة'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Active Call/Meeting Banner if triggered */}
      {activeCallBanner && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span>{activeCallBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveCallBanner(null)}
            className="rounded-lg bg-[#059669] px-3 py-1 text-[11px] text-[#FFFFFF]"
          >
            إنهاء الجلسة
          </button>
        </div>
      )}

      {/* 2. WORKSPACE: LIST VIEW OR UNIFIED CALENDAR MODULE */}
      {viewMode === 'calendar' ? (
        <div className="w-full px-6 py-5">
          <UnifiedCalendarModule
            embedded
            onSwitchToListView={() => setViewMode('list')}
          />
        </div>
      ) : (
      <div className="w-full px-6 py-5 grid grid-cols-1 xl:grid-cols-[minmax(0,68fr)_minmax(0,32fr)] gap-5 items-start">
        {/* RIGHT COLUMN (68%) */}
        <div className="space-y-5 min-w-0">
          {/* SECTION 1: Urgent Rose Section ("أنشطة متجاوزة لموعد الاستحقاق") */}
          {overdueList.length > 0 && (
            <section className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2]/75 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#E11D48] shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                      أنشطة متجاوزة لموعد الاستحقاق
                    </h2>
                    <p className="text-[11px] font-semibold text-[#E11D48]">
                      يتطلب تدخل فوري لتفادي تعطل مسار الصفقات (5 أنشطة)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSnoozeAllOverdue()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-[#BE123C] hover:bg-[#FFE4E6] transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>تأجيل الكل</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {overdueList.map((act) => (
                  <article
                    key={act.id}
                    className="rounded-xl border border-[#FECDD3] bg-[#FFFFFF] p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                  >
                    {/* Right Side: Checkbox + Icon + Title & Metadata */}
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={act.completed}
                        onChange={() => void handleToggleActivityComplete(act)}
                        aria-label={`إتمام ${act.title}`}
                        className="mt-2 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer shrink-0"
                      />

                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5 ${
                          act.kind === 'call'
                            ? 'bg-[#FEE2E2] text-[#E11D48]'
                            : 'bg-[#EFF6FF] text-[#2563EB]'
                        }`}
                      >
                        {act.kind === 'call' ? (
                          <Phone className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-extrabold text-[#0F172A]">
                            {act.title}
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              handleNavigateByRwq(act.rwqId, act.companyName)
                            }
                            className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB] hover:underline tabular-nums"
                          >
                            {act.rwqId}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              handleNavigateByRwq(act.rwqId, act.companyName)
                            }
                            className="rounded bg-[#F1F5F9] px-2 py-0.5 font-bold text-[#334155] hover:text-[#2563EB]"
                          >
                            {act.companyName}
                          </button>

                          <span className="inline-flex items-center gap-1 font-bold text-[#E11D48]">
                            <Clock className="h-3 w-3" />
                            <span>{act.overdueLabel || act.timeLabel}</span>
                          </span>

                          <span className="text-[#64748B]">
                            المسؤول: {act.ownerName}
                          </span>

                          {act.stageLabel && (
                            <span className="text-[#64748B]">{act.stageLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left Side: Priority Badge + Quick Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                          act.priority === 'عالية'
                            ? 'bg-[#FEE2E2] text-[#DC2626]'
                            : 'bg-[#F1F5F9] text-[#475569]'
                        }`}
                      >
                        {act.priorityBadgeLabel}
                      </span>

                      {act.primaryActionType === 'call_icon' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCallBanner(
                              `جارٍ الاتصال عبر SIP بـ ${act.companyName} (${act.rwqId})...`
                            )
                          }
                          aria-label="بدء المكالمة"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openInboxForContact()}
                          aria-label="إرسال رسالة أو بريد"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB]"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleToggleActivityComplete(act)}
                        aria-label="خيارات النشاط"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC]"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 2: Today's Section ("أنشطة ومواعيد اليوم") */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-[#FFFFFF] shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                    أنشطة ومواعيد اليوم (الأربعاء {selectedCalendarDay} مايو)
                  </h2>
                  <p className="text-[11px] text-[#64748B] tabular-nums">
                    تم إنجاز {todayStats.completedCount} من أصل {todayStats.totalCount} مهام مبرمجة
                  </p>
                </div>
              </div>

              {/* Circular Completion % Progress Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5">
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-[#64748B]">
                    نسبة الإنجاز
                  </p>
                  <p className="text-[13px] font-extrabold text-[#2563EB] tabular-nums leading-none mt-0.5">
                    {todayStats.pct}%
                  </p>
                </div>
                <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r={ringR}
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="3"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r={ringR}
                    fill="transparent"
                    stroke="#2563EB"
                    strokeWidth="3"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              {todayList.map((act) => (
                <article
                  key={act.id}
                  className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4 transition-all ${
                    act.completed
                      ? 'border-[#A7F3D0] bg-[#ECFDF5]/40 opacity-80'
                      : 'border-[#E2E8F0] bg-[#F8FAFC]/80 hover:bg-[#FFFFFF] hover:border-[#CBD5E1]'
                  }`}
                >
                  {/* Right Side */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={act.completed}
                      onChange={() => void handleToggleActivityComplete(act)}
                      aria-label={`إتمام ${act.title}`}
                      className="mt-2.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer shrink-0"
                    />

                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5 ${
                        act.kind === 'meeting'
                          ? 'bg-[#2563EB] text-[#FFFFFF]'
                          : act.kind === 'call'
                          ? 'bg-[#059669] text-[#FFFFFF]'
                          : 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                      }`}
                    >
                      {act.kind === 'meeting' ? (
                        <Video className="h-5 w-5" />
                      ) : act.kind === 'call' ? (
                        <Phone className="h-5 w-5" />
                      ) : (
                        <ClipboardCheck className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <h3
                        className={`text-[14px] font-extrabold leading-snug ${
                          act.completed
                            ? 'line-through text-[#64748B]'
                            : 'text-[#0F172A]'
                        }`}
                      >
                        {act.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            handleNavigateByRwq(act.rwqId, act.companyName)
                          }
                          className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB] hover:underline tabular-nums"
                        >
                          {act.rwqId}
                        </button>

                        <span
                          className={`inline-flex items-center gap-1 font-bold tabular-nums ${
                            act.kind === 'meeting'
                              ? 'text-[#2563EB]'
                              : 'text-[#334155]'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>{act.timeLabel}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                        <button
                          type="button"
                          onClick={() =>
                            handleNavigateByRwq(act.rwqId, act.companyName)
                          }
                          className="inline-flex items-center gap-1 font-medium text-[#475569] hover:text-[#2563EB]"
                        >
                          {act.contactName ? (
                            <>
                              <User className="h-3.5 w-3.5" />
                              <span>{act.contactName}</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{act.companyName}</span>
                            </>
                          )}
                        </button>

                        {act.participantsCount && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            <span>{act.participantsCount} مشاركين</span>
                          </span>
                        )}

                        {act.dealValueLabel && (
                          <button
                            type="button"
                            onClick={() =>
                              handleNavigateByRwq(act.rwqId, act.companyName)
                            }
                            className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-extrabold text-[#059669] tabular-nums"
                          >
                            {act.dealValueLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left Side: 1-Click Primary Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {act.primaryActionType === 'zoom' && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCallBanner(
                            `تم فتح غرفة اجتماع Zoom المباشرة: ${act.title}`
                          )
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors whitespace-nowrap"
                      >
                        <Video className="h-4 w-4" />
                        <span>الانضمام عبر Zoom</span>
                      </button>
                    )}

                    {act.primaryActionType === 'sip_call' && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCallBanner(
                            `جارٍ الاتصال الهاتفي المباشر (SIP) بـ ${act.companyName}...`
                          )
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:border-[#059669] hover:text-[#059669] px-3.5 text-[12px] font-extrabold text-[#0F172A] transition-colors whitespace-nowrap"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>بدء الاتصال (SIP)</span>
                      </button>
                    )}

                    {act.primaryActionType === 'attachments' && (
                      <button
                        type="button"
                        onClick={() => openInboxForContact()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:border-[#2563EB] hover:text-[#2563EB] px-3.5 text-[12px] font-bold text-[#334155] transition-colors whitespace-nowrap"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>المرفقات ({act.attachmentsCount ?? 3})</span>
                      </button>
                    )}

                    {act.primaryActionType === 'chat' && (
                      <button
                        type="button"
                        onClick={() => openInboxForLead()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-3.5 text-[12px] font-bold text-[#059669] transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>فتح المحادثة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleToggleActivityComplete(act)}
                      aria-label="المزيد من الإجراءات"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* SECTION 3: Upcoming Section ("الأنشطة المجدولة لاحقاً (غداً وما بعده)") */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#475569]" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  الأنشطة المجدولة لاحقاً (غداً وما بعده)
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#64748B]">
                15 نشاط مستقبلي
              </span>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {upcomingList.map((act, idx) => (
                <div
                  key={act.id}
                  onClick={() => handleNavigateByRwq(act.rwqId, act.companyName)}
                  className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F8FAFC] px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                        idx % 2 === 0 ? 'bg-[#2563EB]' : 'bg-[#059669]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-extrabold text-[#0F172A]">
                          {act.title}
                        </p>
                        <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] font-bold text-[#475569] tabular-nums">
                          {act.rwqId}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {act.timeLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold text-[#475569]">
                      {act.deliveryModeLabel || 'مجدول'}
                    </span>
                    <ChevronLeft className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* LEFT COLUMN (32%): Mini Calendar + Today's Agenda + Daily Productivity */}
        <aside className="space-y-5 min-w-0">
          {/* Card 1: Interactive Mini Calendar */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  مايو 2025
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCalendarDay((d) => (d > 1 ? d - 1 : 14))
                  }
                  aria-label="اليوم السابق"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCalendarDay((d) => (d < 30 ? d + 1 : 14))
                  }
                  aria-label="اليوم التالي"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#64748B]">
              <span>سبت</span>
              <span>أحد</span>
              <span>إثن</span>
              <span>ثلا</span>
              <span>أرب</span>
              <span>خمي</span>
              <span>جمع</span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {CALENDAR_DAYS.map((cell, idx) => {
                const isSelected =
                  cell.inCurrentMonth && cell.day === selectedCalendarDay;
                return (
                  <button
                    key={`${cell.day}_${idx}`}
                    type="button"
                    disabled={!cell.inCurrentMonth}
                    onClick={() => setSelectedCalendarDay(cell.day)}
                    className={`mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-xl text-[12px] tabular-nums transition-colors ${
                      !cell.inCurrentMonth
                        ? 'text-[#CBD5E1] cursor-default'
                        : isSelected
                        ? 'bg-[#2563EB] font-extrabold text-[#FFFFFF] shadow-xs'
                        : cell.dotColor === 'red'
                        ? 'font-bold text-[#E11D48] hover:bg-[#FFF1F2]'
                        : 'font-semibold text-[#0F172A] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {cell.dotColor && (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${
                          isSelected
                            ? 'bg-[#FFFFFF]'
                            : cell.dotColor === 'red'
                            ? 'bg-[#E11D48]'
                            : cell.dotColor === 'green'
                            ? 'bg-[#10B981]'
                            : 'bg-[#2563EB]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Card 2: الجدول الزمني لليوم (Today's Agenda) */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  الجدول الزمني لليوم
                </h2>
              </div>
              <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#475569] tabular-nums">
                الآن: 10:45 ص
              </span>
            </div>

            <div className="relative pr-5 space-y-3.5 before:absolute before:right-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0]">
              {/* Agenda Item 1 */}
              <div className="relative">
                <span className="absolute -right-[21px] top-2 h-3 w-3 rounded-full bg-[#2563EB] ring-4 ring-[#DBEAFE]" />
                <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-[#2563EB] tabular-nums">
                      11:30 ص - 12:30 م
                    </span>
                    <span className="rounded bg-[#2563EB] px-2 py-0.5 text-[9px] font-bold text-[#FFFFFF]">
                      قادم
                    </span>
                  </div>
                  <div>
                    <p className="text-[13px] font-extrabold text-[#0F172A]">
                      عرض تقني عن بُعد
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      بنك الاستثمار العربي
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCallBanner(
                        'تم الانضمام إلى غرفة العرض التقني — بنك الاستثمار العربي'
                      )
                    }
                    className="w-full rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] py-1.5 text-[11px] font-extrabold text-[#FFFFFF] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>انضم الآن</span>
                  </button>
                </div>
              </div>

              {/* Agenda Item 2 */}
              <div className="relative">
                <span className="absolute -right-[20px] top-3 h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-[#64748B] tabular-nums">
                    02:00 م - 02:30 م
                  </p>
                  <div>
                    <p className="text-[13px] font-extrabold text-[#0F172A]">
                      مكالمة تدقيق المواصفات
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      مستشفى الأمل التخصصي
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigateByRwq('RWQ-11420', 'مستشفى الأمل التخصصي')}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#2563EB] py-1.5 text-[11px] font-bold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-[#475569]" />
                    <span>تجهيز السجل</span>
                  </button>
                </div>
              </div>

              {/* Agenda Item 3 */}
              <div className="relative">
                <span className="absolute -right-[20px] top-3 h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-[#64748B] tabular-nums">
                    04:15 م
                  </p>
                  <p className="text-[13px] font-extrabold text-[#0F172A]">
                    مراجعة العقود وتوقيع أمر الشراء
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    التقنية اللوجستية الحديثة
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Card 3: إنتاجية الأنشطة اليومية */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#059669]" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  إنتاجية الأنشطة اليومية
                </h2>
              </div>
              <span className="text-[11px] font-extrabold text-[#059669] tabular-nums">
                +18.4%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Completed Calls */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-center">
                <p className="text-[11px] text-[#64748B]">المكالمات المنفذة</p>
                <p className="text-[22px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                  12<span className="text-[12px] font-semibold text-[#94A3B8]">/15</span>
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full w-4/5 rounded-full bg-[#2563EB]" />
                </div>
              </div>

              {/* Response Rate */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-center">
                <p className="text-[11px] text-[#64748B]">معدل الاستجابة</p>
                <p className="text-[22px] font-extrabold text-[#059669] tabular-nums leading-none">
                  94%
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#059669]"
                    style={{ width: '94%' }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 flex items-start gap-2 text-[11px] text-[#475569] leading-relaxed">
              <Lightbulb className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
              <span>
                إنجاز مكالمة الخزامى المتأخرة يعيد معدل إغلاق مسارك البيعي إلى النطاق المثالي.
              </span>
            </div>
          </section>
        </aside>
      </div>
      )}

      {/* Create Activity Modal ("مهمة" | "اجتماع" | "تسجيل مكالمة") */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                {createKind === 'meeting'
                  ? 'جدولة اجتماع جديد'
                  : createKind === 'call'
                  ? 'تسجيل / جدولة مكالمة'
                  : 'إضافة مهمة تنفيذية جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateActivitySubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  عنوان النشاط *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    الشركة / العميل المرتبط
                  </label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    معرف العميل (RWQ)
                  </label>
                  <input
                    type="text"
                    value={newRwq}
                    onChange={(e) => setNewRwq(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 font-mono text-[12px] text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    الموعد / الفترة الزمنية
                  </label>
                  <input
                    type="text"
                    value={newTimeLabel}
                    onChange={(e) => setNewTimeLabel(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                    درجة الأولوية
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as CrmTask['priority'])
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                  >
                    <option value="عالية">عالية (قصوى)</option>
                    <option value="متوسطة">متوسطة (عادية)</option>
                    <option value="منخفضة">منخفضة</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#475569]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingActivity}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF]"
                >
                  {creatingActivity ? 'جارٍ الحفظ...' : 'حفظ النشاط في Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-[12px] font-semibold text-[#FFFFFF] shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="إغلاق التنبيه"
            className="text-[#94A3B8] hover:text-[#FFFFFF]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
