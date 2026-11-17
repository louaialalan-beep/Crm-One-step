import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  Filter,
  Gauge,
  Info,
  LineChart,
  MessageCircle,
  MessageSquare,
  PlayCircle,
  Plus,
  Search,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useCrm } from '../context/CrmContext';
import type { CrmUser } from '../types/crm';

type AnalyticsTabKey =
  | 'attribution_meta'
  | 'blueprint_bottlenecks'
  | 'sales_reps'
  | 'forecasting';

type DateRangeKey = 'q2_current' | 'h1_2025' | 'this_month' | 'full_year';

interface DateRangeOption {
  key: DateRangeKey;
  label: string;
  subtitle: string;
  multiplier: number;
  daysLeftLabel: string;
}

const DATE_RANGE_OPTIONS: readonly DateRangeOption[] = [
  {
    key: 'q2_current',
    label: 'الربع الحالي (Q2 2025)',
    subtitle: 'البيانات المالية للنصف الأول 2025 (يناير - يونيو)',
    multiplier: 1,
    daysLeftLabel: 'خلال 45 يوماً',
  },
  {
    key: 'h1_2025',
    label: 'النصف الأول (H1 2025)',
    subtitle: 'إجمالي الأداء التراكمي للربعين الأول والثاني 2025',
    multiplier: 1.45,
    daysLeftLabel: 'خلال 90 يوماً',
  },
  {
    key: 'this_month',
    label: 'الشهر الحالي (يونيو)',
    subtitle: 'تحليل الأداء اللحظي للشهر الجاري',
    multiplier: 0.42,
    daysLeftLabel: 'خلال 14 يوماً',
  },
  {
    key: 'full_year',
    label: 'العام المالي (2025)',
    subtitle: 'المسار السنوي الكامل ومؤشرات النمو التراكمية',
    multiplier: 2.1,
    daysLeftLabel: 'خلال 180 يوماً',
  },
] as const;

interface RepLeaderboardRow {
  rank: number;
  name: string;
  roleTitle: string;
  isLeader?: boolean;
  wonRevenue: number;
  winRatePercent: number;
  responseMinutes: number;
  fastBadge?: boolean;
}

export const AnalyticsPage: React.FC = () => {
  const {
    currentOrgId,
    firebaseUser,
    currentUser,
    deals,
    leads,
    touchpoints,
  } = useCrm();

  const [firestoreUsers, setFirestoreUsers] = useState<CrmUser[]>([]);
  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('attribution_meta');
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>('q2_current');
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [showAllReps, setShowAllReps] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [newBoardModalOpen, setNewBoardModalOpen] = useState(false);
  const [customBoardName, setCustomBoardName] = useState('');
  const [customQuarterlyGoal, setCustomQuarterlyGoal] = useState('2000000');
  const [shareEmail, setShareEmail] = useState('finance@riwaq-crm.sa');
  const [shareFrequency, setShareFrequency] = useState('weekly');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const dateMenuRef = useRef<HTMLDivElement>(null);

  // Subscribe to `users` collection for authenticated user
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreUsers([currentUser]);
      return;
    }
    const q = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded: CrmUser[] = snap.docs.map((d) => {
          const val = d.data();
          return {
            id: d.id,
            uid: String(val.uid ?? firebaseUser.uid),
            fullName: String(val.fullName ?? currentUser.fullName),
            email: String(val.email ?? currentUser.email),
            jobTitle: val.jobTitle ? String(val.jobTitle) : 'مدير مبيعات أول',
            profileId: String(val.profileId ?? 'prof_admin'),
            roleId: String(val.roleId ?? 'role_exec_director'),
            department: val.department ? String(val.department) : 'مبيعات المؤسسات',
            status: val.status === 'inactive' ? 'inactive' : 'active',
          };
        });
        setFirestoreUsers(loaded.length > 0 ? loaded : [currentUser]);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    return () => unsub();
  }, [currentUser, firebaseUser]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setDateMenuOpen(false);
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

  const activeRange = useMemo(
    () =>
      DATE_RANGE_OPTIONS.find((r) => r.key === dateRangeKey) ?? DATE_RANGE_OPTIONS[0],
    [dateRangeKey]
  );

  // Dynamically compute analytics from `deals`, `leads`, `touchpoints`, `users`
  const analyticsData = useMemo(() => {
    const mult = activeRange.multiplier;

    // 1. Won deals & Target Gauge (82% default for Q2: 1,640,000 / 2,000,000)
    const wonDeals = deals.filter((d) => d.stage === 'مكتملة');
    const extraWonSum = Math.max(
      0,
      wonDeals.reduce((acc, d) => acc + (d.amount || 0), 0) - 500000
    );
    const baseQuarterActual = 1640000 + extraWonSum;
    const actualWonRevenue = Math.round(baseQuarterActual * mult);
    const parsedCustomGoal = Number(customQuarterlyGoal) || 2000000;
    const quarterlyTarget = Math.round(parsedCustomGoal * mult);
    const targetAchievementPct = Math.min(
      100,
      Math.max(1, Math.round((actualWonRevenue / Math.max(1, quarterlyTarget)) * 100))
    );
    const remainingToTarget = Math.max(0, quarterlyTarget - actualWonRevenue);

    // 2. Sales Cycle Velocity (11.4 days default)
    const negotiationDeals = deals.filter((d) => d.stage === 'تفاوض');
    const qualifyingDeals = deals.filter(
      (d) => d.stage === 'تأهيل مبدئي' || d.stage === 'تحديد الاحتياج'
    );
    const avgCloseDays = Number((11.4 / Math.max(0.85, Math.min(1.15, mult))).toFixed(1));
    const qualifyingDays = Number(
      Math.max(1.5, 2.1 + (qualifyingDeals.length > 10 ? 0.2 : 0)).toFixed(1)
    );
    const negotiationDays = Number(
      Math.max(3.2, 4.8 + (negotiationDeals.length > 10 ? 0.3 : 0)).toFixed(1)
    );

    // 3. First-Touch vs Last-Touch Attribution across WhatsApp, Instagram, Google, Messenger
    const whatsappLeads = leads.filter((l) => l.channel === 'whatsapp').length;
    const instagramLeads = leads.filter((l) => l.channel === 'instagram').length;
    const webGoogleLeads = leads.filter((l) => l.channel === 'website').length;
    const messengerLeads = leads.filter((l) => l.channel === 'messenger').length;

    const whatsappTp = touchpoints.filter((tp) => tp.channel === 'واتساب').length;
    const instagramTp = touchpoints.filter((tp) => tp.channel === 'إنستغرام').length;

    const attributionChannels = [
      {
        id: 'whatsapp',
        label: 'واتساب للأعمال (WhatsApp API)',
        firstTouchK: Math.round((210 + Math.max(0, whatsappLeads - 2) * 5) * mult),
        lastTouchK: Math.round((320 + Math.max(0, whatsappTp - 2) * 8) * mult),
        firstPct: 66,
        lastPct: 96,
      },
      {
        id: 'instagram',
        label: 'إعلانات إنستغرام (Instagram Reels)',
        firstTouchK: Math.round((180 + Math.max(0, instagramLeads - 1) * 4) * mult),
        lastTouchK: Math.round((95 + Math.max(0, instagramTp - 1) * 4) * mult),
        firstPct: 56,
        lastPct: 30,
      },
      {
        id: 'google',
        label: 'إعلانات جوجل المباشرة (Google Search)',
        firstTouchK: Math.round((110 + Math.max(0, webGoogleLeads - 1) * 4) * mult),
        lastTouchK: Math.round(140 * mult),
        firstPct: 36,
        lastPct: 45,
      },
      {
        id: 'messenger',
        label: 'ماسنجر فيسبوك (Meta Messenger)',
        firstTouchK: Math.round((90 + Math.max(0, messengerLeads - 1) * 3) * mult),
        lastTouchK: Math.round(45 * mult),
        firstPct: 28,
        lastPct: 16,
      },
    ];

    // 4. Time Conversion Funnel & Bottlenecks
    const extraLeads = Math.max(0, leads.length - 6);
    const extraDeals = Math.max(0, deals.length - 6);
    const extraWon = Math.max(0, wonDeals.length - 1);

    const newLeadsCount = Math.round((495 + extraLeads) * mult);
    const qualifiedCount = Math.round((336 + extraLeads) * mult);
    const quoteSentCount = Math.round((208 + extraDeals) * mult);
    const negotiationCount = Math.round((118 + negotiationDeals.length) * mult);
    const closedWonCount = Math.round((90 + extraWon) * mult);

    // 5. Cumulative Revenue vs Ad Spend (Jan - Jun)
    const adSpendTotal = Math.round(265000 * mult);
    const roasValue = Number((actualWonRevenue / Math.max(1, adSpendTotal)).toFixed(2));

    const monthlySeries = [
      {
        month: 'يناير',
        revenue: Math.round(210000 * mult),
        spend: Math.round(45000 * mult),
      },
      {
        month: 'فبراير',
        revenue: Math.round(460000 * mult),
        spend: Math.round(88000 * mult),
      },
      {
        month: 'مارس',
        revenue: Math.round(740000 * mult),
        spend: Math.round(132000 * mult),
      },
      {
        month: 'أبريل',
        revenue: Math.round(1050000 * mult),
        spend: Math.round(176000 * mult),
      },
      {
        month: 'مايو',
        revenue: Math.round(1360000 * mult),
        spend: Math.round(220000 * mult),
      },
      {
        month: 'يونيو (الحالي)',
        revenue: actualWonRevenue,
        spend: adSpendTotal,
        isCurrent: true,
      },
    ];

    // 6. Sales Rep Performance Matrix
    const primaryRepTitle = firestoreUsers[0]?.jobTitle || 'قائد المبيعات';
    const baseReps: RepLeaderboardRow[] = [
      {
        rank: 1,
        name: 'طارق العتيبي',
        roleTitle: primaryRepTitle.includes('مدير') ? 'قائد المبيعات' : primaryRepTitle,
        isLeader: true,
        wonRevenue: Math.round(640000 * mult),
        winRatePercent: 42,
        responseMinutes: 8,
        fastBadge: true,
      },
      {
        rank: 2,
        name: 'سارة القحطاني',
        roleTitle: 'أخصائية حسابات رئيسية',
        wonRevenue: Math.round(490000 * mult),
        winRatePercent: 38,
        responseMinutes: 12,
      },
      {
        rank: 3,
        name: 'م. فيصل الشمري',
        roleTitle: 'استشاري مبيعات مؤسسية',
        wonRevenue: Math.round(310000 * mult),
        winRatePercent: 31,
        responseMinutes: 19,
      },
      {
        rank: 4,
        name: 'ريم الدوسري',
        roleTitle: 'أخصائية تطوير أعمال',
        wonRevenue: Math.round(200000 * mult),
        winRatePercent: 27,
        responseMinutes: 25,
      },
      {
        rank: 5,
        name: 'سلمان القحطاني',
        roleTitle: 'مدير حسابات استراتيجية',
        wonRevenue: Math.round(175000 * mult),
        winRatePercent: 25,
        responseMinutes: 28,
      },
      {
        rank: 6,
        name: 'نورة السبيعي',
        roleTitle: 'تنفيذي مبيعات سحابية',
        wonRevenue: Math.round(145000 * mult),
        winRatePercent: 23,
        responseMinutes: 31,
      },
    ];

    return {
      actualWonRevenue,
      quarterlyTarget,
      targetAchievementPct,
      remainingToTarget,
      avgCloseDays,
      qualifyingDays,
      negotiationDays,
      attributionChannels,
      funnel: {
        newLeadsCount,
        qualifiedCount,
        quoteSentCount,
        negotiationCount,
        closedWonCount,
      },
      adSpendTotal,
      roasValue,
      monthlySeries,
      reps: baseReps,
    };
  }, [activeRange.multiplier, customQuarterlyGoal, deals, firestoreUsers, leads, touchpoints]);

  const handleExportReport = () => {
    const csvRows = [
      ['المؤشر', 'القيمة'],
      ['المحقق الفعلي (ر.س)', String(analyticsData.actualWonRevenue)],
      ['المستهدف الربع سنوي (ر.س)', String(analyticsData.quarterlyTarget)],
      ['نسبة الإنجاز (%)', `${analyticsData.targetAchievementPct}%`],
      ['متوسط سرعة إغلاق الصفقة (يوم)', String(analyticsData.avgCloseDays)],
      ['إجمالي الإنفاق التسويقي (ر.س)', String(analyticsData.adSpendTotal)],
      ['العائد على الإنفاق الإعلاني (ROAS)', `${analyticsData.roasValue}x`],
    ];
    const csv = csvRows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq-bi-analytics-${dateRangeKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShareModalOpen(false);
    setToastMsg('تم تصدير تقرير التحليلات ومؤشرات الأداء (CSV)');
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShareModalOpen(false);
    setToastMsg(`تمت جدولة إرسال لوحة الأداء إلى ${shareEmail} بنجاح`);
  };

  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewBoardModalOpen(false);
    setToastMsg(
      `تم حفظ إعدادات لوحة التحليلات "${customBoardName.trim() || 'لوحة مبيعات Q2'}" وتحديث المستهدف`
    );
    setCustomBoardName('');
  };

  // Circular gauge SVG geometry
  const gaugeRadius = 46;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeStrokeOffset =
    gaugeCircumference - (analyticsData.targetAchievementPct / 100) * gaugeCircumference;

  const visibleReps = showAllReps
    ? analyticsData.reps
    : analyticsData.reps.slice(0, 4);

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] pb-12">
      {/* 1. FLUSH WHITE HEADER & TABS */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 pt-5 pb-0">
        <div className="w-full space-y-4">
          {/* Row 1: Title & Subtitle (Right in RTL) | Date Filter + Actions (Left in RTL) */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Right: Title & BI Badge */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] shrink-0 mt-0.5">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#0F172A] leading-tight">
                    التحليلات ولوحات الأداء (Analytics & BI)
                  </h1>
                  <span className="rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-2 py-0.5 font-mono text-[11px] font-bold text-[#475569]">
                    BI & Analytics
                  </span>
                  <span className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#2563EB]">
                    {currentOrgId}
                  </span>
                </div>
                <p className="text-[12px] text-[#64748B]">
                  ذكاء الأعمال، كفاءة قنوات التسويق، وتحليل مسار الصفقات الرقمية في الوقت الفعلي
                </p>
              </div>
            </div>

            {/* Left: Date Range Filter + Share/Schedule + New Dashboard */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date Range Dropdown */}
              <div className="relative" ref={dateMenuRef}>
                <button
                  type="button"
                  onClick={() => setDateMenuOpen((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#475569]" />
                  <span>{activeRange.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </button>

                {dateMenuOpen && (
                  <div className="flyout-surface absolute left-0 top-10 z-30 w-56 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-1.5 shadow-xl">
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setDateRangeKey(opt.key);
                          setDateMenuOpen(false);
                          setToastMsg(`تم تحديث الفترة الزمنية: ${opt.label}`);
                        }}
                        className={`flex w-full items-center justify-between px-3.5 py-2 text-right text-[12px] font-semibold transition-colors ${
                          opt.key === dateRangeKey
                            ? 'bg-[#EFF6FF] text-[#2563EB]'
                            : 'text-[#334155] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.key === dateRangeKey && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* مشاركة / جدولة */}
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 text-[12px] font-bold text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="h-3.5 w-3.5 text-[#475569]" />
                <span>مشاركة / جدولة</span>
              </button>

              {/* + لوحة تحليلات جديدة */}
              <button
                type="button"
                onClick={() => setNewBoardModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-4 text-[12px] font-bold text-[#FFFFFF] shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ لوحة تحليلات جديدة</span>
              </button>
            </div>
          </div>

          {/* Row 2: 4 Navigation Tabs */}
          <div
            role="tablist"
            aria-label="تبويبات التحليلات ولوحات الأداء"
            className="flex items-center gap-6 overflow-x-auto border-t border-[#F1F5F9] pt-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attribution_meta'}
              onClick={() => setActiveTab('attribution_meta')}
              className={`inline-flex items-center gap-2 border-b-2 py-3 text-[13px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'attribution_meta'
                  ? 'border-[#2563EB] font-extrabold text-[#2563EB]'
                  : 'border-transparent font-semibold text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Info className="h-4 w-4" />
              <span>تحليلات المصادر وعائد ميتا</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'blueprint_bottlenecks'}
              onClick={() => setActiveTab('blueprint_bottlenecks')}
              className={`inline-flex items-center gap-2 border-b-2 py-3 text-[13px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'blueprint_bottlenecks'
                  ? 'border-[#2563EB] font-extrabold text-[#2563EB]'
                  : 'border-transparent font-semibold text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>تحليلات البلوبرينت والاختناقات</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sales_reps'}
              onClick={() => setActiveTab('sales_reps')}
              className={`inline-flex items-center gap-2 border-b-2 py-3 text-[13px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'sales_reps'
                  ? 'border-[#2563EB] font-extrabold text-[#2563EB]'
                  : 'border-transparent font-semibold text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>كفاءة مندوبي المبيعات</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'forecasting'}
              onClick={() => setActiveTab('forecasting')}
              className={`inline-flex items-center gap-2 border-b-2 py-3 text-[13px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'forecasting'
                  ? 'border-[#2563EB] font-extrabold text-[#2563EB]'
                  : 'border-transparent font-semibold text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <LineChart className="h-4 w-4" />
              <span>توقعات الإيرادات (Forecasting)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. FULL-WIDTH ANALYTICS WORKSPACE (`w-full px-6 py-5`) */}
      <div className="w-full px-6 py-5 space-y-5">
        {/* TOP ROW: 3 GAUGE & VELOCITY & AI INSIGHT CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {/* Card 1 (Right in RTL): Circular Target Gauge */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#2563EB] shrink-0" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  تحقيق المستهدف الربع سنوي
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                <span>في المسار (On-track)</span>
              </span>
            </div>

            <div className="my-4 flex items-center justify-around gap-4">
              {/* Circular SVG Ring Gauge (Right in RTL) */}
              <div className="relative flex h-28 w-28 items-center justify-center shrink-0">
                <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r={gaugeRadius}
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="10"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={gaugeRadius}
                    fill="transparent"
                    stroke="#2563EB"
                    strokeWidth="10"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeStrokeOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[22px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                    {analyticsData.targetAchievementPct}%
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-[#64748B]">
                    نسبة الإنجاز
                  </span>
                </div>
              </div>

              {/* Financial Figures (Left in RTL) */}
              <div className="space-y-2.5 text-right">
                <div>
                  <p className="text-[11px] font-medium text-[#64748B]">المحقق الفعلي</p>
                  <p className="text-[18px] font-extrabold text-[#2563EB] tabular-nums">
                    {analyticsData.actualWonRevenue.toLocaleString('en-US')}{' '}
                    <span className="text-[12px] font-bold">ر.س</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#64748B]">المستهدف المحدد</p>
                  <p className="text-[14px] font-extrabold text-[#0F172A] tabular-nums">
                    {analyticsData.quarterlyTarget.toLocaleString('en-US')}{' '}
                    <span className="text-[11px] font-semibold">ر.س</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[#0F172A] tabular-nums">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                <span>
                  متبقي {analyticsData.remainingToTarget.toLocaleString('en-US')} ر.س فقط
                </span>
              </div>
              <span className="font-medium text-[#64748B]">
                {activeRange.daysLeftLabel}
              </span>
            </div>
          </section>

          {/* Card 2 (Middle): Sales Cycle Velocity */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#2563EB] shrink-0" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  متوسط سرعة إغلاق الصفقة
                </h2>
              </div>
              <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669] tabular-nums">
                تسارع +22%
              </span>
            </div>

            <div className="my-3 space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[30px] font-extrabold text-[#0F172A] tabular-nums leading-none">
                  {analyticsData.avgCloseDays}
                </span>
                <span className="text-[13px] font-semibold text-[#475569]">
                  يوماً في المتوسط
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-[#64748B] tabular-nums">
                  <span>المعدل الفعلي: {analyticsData.avgCloseDays} يوم</span>
                  <span>الهدف المعياري: 14.0 يوم</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: '78%' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-center">
                  <p className="text-[11px] text-[#64748B]">مرحلة التأهيل</p>
                  <p className="mt-0.5 text-[13px] font-extrabold text-[#0F172A] tabular-nums">
                    {analyticsData.qualifyingDays} يوم
                  </p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-center">
                  <p className="text-[11px] text-[#64748B]">مرحلة التفاوض</p>
                  <p className="mt-0.5 text-[13px] font-extrabold text-[#0F172A] tabular-nums">
                    {analyticsData.negotiationDays} يوم
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-[#059669]">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>أسرع بـ 3.2 أيام مقارنة بالربع السابق</span>
            </div>
          </section>

          {/* Card 3 (Left in RTL): AI Insights & Anomaly Alert */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#2563EB] shrink-0" />
                <h2 className="text-[14px] font-extrabold text-[#0F172A]">
                  ذكاء رواق الاصطناعي والمؤشرات
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-bold text-[#2563EB]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
                <span>تحليل فوري</span>
              </span>
            </div>

            <div className="my-3 space-y-2.5">
              {/* Green Anomaly Surge Box */}
              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3 space-y-1">
                <p className="text-[13px] font-extrabold text-[#065F46]">
                  ↑ طفرة تحويل إعلانات واتساب (+24%)
                </p>
                <p className="text-[11px] text-[#047857] leading-relaxed">
                  سجلت حملات ميتا الموجهة للواتساب أعلى معدل إغلاق صفقات هذا الأسبوع.
                </p>
              </div>

              {/* Blue Recommendation Box */}
              <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/75 p-3 space-y-1">
                <p className="flex items-center gap-1 text-[11px] font-extrabold text-[#2563EB]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>توصية الخوارزمية الذكية:</span>
                </p>
                <p className="text-[11px] text-[#334155] leading-relaxed">
                  رفع ميزانية إعادة استهداف ميتا بنسبة 15% لاستغلال زخم التحويل اللحظي قبل نهاية دورة الطلب.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-[#64748B]">3 إشارات إيجابية مرصودة</span>
              <span className="inline-flex items-center gap-1 font-bold text-[#E11D48]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
                <span>1 اختناق قيد التحليل</span>
              </span>
            </div>
          </section>
        </div>

        {/* MIDDLE ROW: 2 CARDS (First-Touch vs Last-Touch Attribution | Time Conversion Funnel & Bottlenecks) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Middle Right Card: مقارنة الإسناد: مصدر الجلب (First-Touch) مقابل مصدر الإغلاق (Last-Touch) */}
          <section
            className={`rounded-2xl bg-[#FFFFFF] border p-5 flex flex-col justify-between shadow-2xs transition-all ${
              activeTab === 'attribution_meta'
                ? 'border-[#2563EB]/40 ring-1 ring-[#2563EB]/10'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
              <div className="space-y-1">
                <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                  مقارنة الإسناد: First-Touch مقابل Last-Touch
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  تحليل أثر القنوات التسويقية: مصدر الجلب (First-Touch) مقابل مصدر الإغلاق (Last-Touch Attribution)
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold text-[#475569]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#2563EB]" />
                  <span>اللمسة الأولى (First)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#059669]" />
                  <span>اللمسة الحاسمة (Last)</span>
                </span>
              </div>
            </div>

            <div className="my-5 space-y-5">
              {analyticsData.attributionChannels.map((ch) => (
                <div key={ch.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                      {ch.id === 'whatsapp' && (
                        <MessageSquare className="h-4 w-4 text-[#059669] shrink-0" />
                      )}
                      {ch.id === 'instagram' && (
                        <PlayCircle className="h-4 w-4 text-[#2563EB] shrink-0" />
                      )}
                      {ch.id === 'google' && (
                        <Search className="h-4 w-4 text-[#475569] shrink-0" />
                      )}
                      {ch.id === 'messenger' && (
                        <MessageCircle className="h-4 w-4 text-[#2563EB] shrink-0" />
                      )}
                      <span>{ch.label}</span>
                    </div>

                    <div className="font-mono text-[11px] font-bold tabular-nums">
                      <span className="text-[#2563EB]">{ch.firstTouchK}K</span>
                      <span className="mx-1 text-[#94A3B8]">/</span>
                      <span className="text-[#059669]">{ch.lastTouchK}K ر.س</span>
                    </div>
                  </div>

                  {/* Grouped Horizontal Bars */}
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                        style={{ width: `${ch.firstPct}%` }}
                      />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#065F46] transition-all duration-300"
                        style={{ width: `${ch.lastPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/75 px-4 py-2.5 text-[11px]">
              <div className="flex items-center gap-2 font-semibold text-[#1E3A8A]">
                <TrendingUp className="h-4 w-4 text-[#2563EB] shrink-0" />
                <span>
                  واتساب يمثل قناة الحسم وإغلاق الصفقات الأقوى بنسبة{' '}
                  <strong className="font-extrabold">62%</strong> من مجمل العقود الموقعة.
                </span>
              </div>
              <span className="font-extrabold text-[#2563EB] whitespace-nowrap shrink-0">
                تأثير ميتا 84%
              </span>
            </div>
          </section>

          {/* Middle Left Card: قمع التحويل الزمني ومؤشر الاختناقات */}
          <section
            className={`rounded-2xl bg-[#FFFFFF] border p-5 flex flex-col justify-between shadow-2xs transition-all ${
              activeTab === 'blueprint_bottlenecks'
                ? 'border-[#E11D48]/50 ring-1 ring-[#E11D48]/15'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
              <div className="space-y-1">
                <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                  قمع التحويل الزمني ومؤشر الاختناقات (Blueprint Bottlenecks)
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  تحليل مسار تحول العميل وزمن البقاء في كل مرحلة
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-[11px] font-bold text-[#E11D48]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>اختناق في التفاوض</span>
              </span>
            </div>

            <div className="my-4 space-y-2.5">
              {/* Stage 1 */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="font-extrabold text-[#0F172A]">
                    1. عميل محتمل جديد (New Lead)
                  </span>
                  <span className="text-[11px] text-[#64748B] tabular-nums">
                    زمن البقاء: 1.2 يوم
                  </span>
                  <span className="font-extrabold text-[#2563EB] tabular-nums">
                    100% ({analyticsData.funnel.newLeadsCount} عميل)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full w-full rounded-full bg-[#2563EB]" />
                </div>
              </div>

              {/* Stage 2 */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="font-extrabold text-[#0F172A]">
                    2. مؤهل للمبيعات (Qualified)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                    <span className="rounded bg-[#FFF1F2] px-1.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                      -32% تسرب
                    </span>
                    <span className="text-[#64748B]">زمن البقاء: 2.8 يوم</span>
                  </div>
                  <span className="font-extrabold text-[#0F172A] tabular-nums">
                    68% ({analyticsData.funnel.qualifiedCount} عميل)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: '68%' }}
                  />
                </div>
              </div>

              {/* Stage 3 */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="font-extrabold text-[#0F172A]">
                    3. العرض والتسعير (Quote Sent)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                    <span className="rounded bg-[#FFF1F2] px-1.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                      -26% تسرب
                    </span>
                    <span className="text-[#64748B]">زمن البقاء: 3.5 يوم</span>
                  </div>
                  <span className="font-extrabold text-[#0F172A] tabular-nums">
                    42% ({analyticsData.funnel.quoteSentCount} صفقات)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: '42%' }}
                  />
                </div>
              </div>

              {/* Stage 4: Highlighted Bottleneck in Rose */}
              <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/75 px-3.5 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#0F172A]">
                    <AlertCircle className="h-4 w-4 text-[#E11D48] shrink-0" />
                    <span>4. التفاوض ومراجعة العقد (Negotiation)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#E11D48] tabular-nums">
                    <span>نقطة الاختناق</span>
                    <span>زمن البقاء: 5.1 يوم ⚠</span>
                  </div>
                  <span className="font-extrabold text-[#0F172A] tabular-nums">
                    24% ({analyticsData.funnel.negotiationCount} صفقة)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#FECDD3]">
                  <div
                    className="h-full rounded-full bg-[#E11D48]"
                    style={{ width: '24%' }}
                  />
                </div>
              </div>

              {/* Stage 5: Closed Won */}
              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/70 px-3.5 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#065F46]">
                    <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                    <span>5. إغلاق فوز نهائي (Closed Won)</span>
                  </div>
                  <span className="text-[11px] text-[#047857] tabular-nums">
                    زمن البقاء: 1.8 يوم
                  </span>
                  <span className="font-extrabold text-[#059669] tabular-nums">
                    18.2% ({analyticsData.funnel.closedWonCount} صفقة)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#A7F3D0]/50">
                  <div
                    className="h-full rounded-full bg-[#059669]"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 text-[11px] font-semibold text-[#BE123C]">
              <Bell className="h-4 w-4 text-[#E11D48] shrink-0" />
              <span>
                <strong className="font-extrabold">تنبيه البلوبرينت:</strong> إجراءات المراجعة القانونية للعقود تؤخر الصفقات بمعدل{' '}
                <span className="underline font-extrabold">+2.3 يوم</span> فوق المعدل المسموح.
              </span>
            </div>
          </section>
        </div>

        {/* BOTTOM ROW: 2 CARDS (Cumulative Revenue vs Ad Spend Chart | Sales Rep Performance Matrix) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Bottom Right Card: منحنى نمو الإيرادات التراكمي مقابل الإنفاق الإعلاني */}
          <section
            className={`rounded-2xl bg-[#FFFFFF] border p-5 flex flex-col justify-between shadow-2xs transition-all ${
              activeTab === 'forecasting'
                ? 'border-[#2563EB]/40 ring-1 ring-[#2563EB]/10'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
              <div className="space-y-1">
                <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                  منحنى نمو الإيرادات التراكمي مقابل الإنفاق الإعلاني
                </h2>
                <p className="text-[11px] text-[#64748B]">{activeRange.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-extrabold text-[#059669] tabular-nums">
                  ROAS: {analyticsData.roasValue}x
                </span>
                <span className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-extrabold text-[#2563EB] tabular-nums">
                  هامش ربح: 72%
                </span>
              </div>
            </div>

            {/* SVG Cumulative Revenue vs Ad Spend Area/Line Chart */}
            <div className="my-2">
              <div className="relative h-56 w-full">
                <svg
                  viewBox="0 0 600 210"
                  className="h-full w-full overflow-visible"
                  aria-label="منحنى نمو الإيرادات التراكمي مقابل الإنفاق الإعلاني"
                >
                  <defs>
                    <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[35, 80, 125, 170].map((y) => (
                    <line
                      key={y}
                      x1="20"
                      y1={y}
                      x2="580"
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Shaded Area under Cumulative Revenue Curve */}
                  <path
                    d="M 30 175 C 160 130, 340 78, 575 32 L 575 190 L 30 190 Z"
                    fill="url(#revAreaGrad)"
                  />

                  {/* Cumulative Revenue Solid Blue Curve */}
                  <path
                    d="M 30 175 C 160 130, 340 78, 575 32"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Cumulative Ad Spend Dashed Emerald Curve */}
                  <path
                    d="M 30 182 C 180 165, 360 148, 575 128"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                  />

                  {/* Peak End Dots */}
                  <circle
                    cx="575"
                    cy="32"
                    r="5.5"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <circle
                    cx="575"
                    cy="128"
                    r="5"
                    fill="#059669"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </svg>

                {hoveredMonthIndex !== null &&
                  analyticsData.monthlySeries[hoveredMonthIndex] && (
                    <div className="pointer-events-none absolute top-2 left-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/95 px-3 py-2 text-[11px] shadow-md">
                      <p className="font-extrabold text-[#0F172A]">
                        {analyticsData.monthlySeries[hoveredMonthIndex].month}
                      </p>
                      <p className="text-[#2563EB] font-bold tabular-nums">
                        الإيراد:{' '}
                        {analyticsData.monthlySeries[
                          hoveredMonthIndex
                        ].revenue.toLocaleString('en-US')}{' '}
                        ر.س
                      </p>
                      <p className="text-[#059669] font-bold tabular-nums">
                        الإنفاق:{' '}
                        {analyticsData.monthlySeries[
                          hoveredMonthIndex
                        ].spend.toLocaleString('en-US')}{' '}
                        ر.س
                      </p>
                    </div>
                  )}
              </div>

              {/* X-Axis Month Labels */}
              <div className="mt-2 flex items-center justify-between px-2 text-[11px]">
                {analyticsData.monthlySeries.map((pt, idx) => (
                  <button
                    key={pt.month}
                    type="button"
                    onMouseEnter={() => setHoveredMonthIndex(idx)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    onClick={() => setHoveredMonthIndex(idx)}
                    className={`transition-colors ${
                      pt.isCurrent
                        ? 'font-extrabold text-[#2563EB] underline underline-offset-4'
                        : 'font-medium text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {pt.month}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Summary Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-around gap-4 border-t border-[#F1F5F9] pt-3.5">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#2563EB] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#64748B]">الإيراد التراكمي المحقق</p>
                  <p className="text-[15px] font-extrabold text-[#0F172A] tabular-nums">
                    {analyticsData.actualWonRevenue.toLocaleString('en-US')} ر.س
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#059669] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#64748B]">الإنفاق التسويقي التراكمي</p>
                  <p className="text-[15px] font-extrabold text-[#0F172A] tabular-nums">
                    {analyticsData.adSpendTotal.toLocaleString('en-US')} ر.س
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Left Card: مصفوفة كفاءة مندوبي المبيعات */}
          <section
            className={`rounded-2xl bg-[#FFFFFF] border p-5 flex flex-col justify-between shadow-2xs transition-all ${
              activeTab === 'sales_reps'
                ? 'border-[#2563EB]/40 ring-1 ring-[#2563EB]/10'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
              <div className="space-y-1">
                <h2 className="text-[15px] font-extrabold text-[#0F172A]">
                  مصفوفة أداء مندوبي المبيعات
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  مقارنة سرعة الاستجابة الأولى مع نسبة حسم الصفقات
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#64748B]">
                أفضل {visibleReps.length} مندوبين
              </span>
            </div>

            <div className="my-3.5 space-y-2.5">
              {visibleReps.map((rep) => (
                <div
                  key={rep.rank}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 space-y-2"
                >
                  {/* Top Line: Rank + Name + Role (Right in RTL) | Won Revenue (Left in RTL) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums shrink-0 ${
                          rep.rank === 1
                            ? 'bg-[#2563EB] text-[#FFFFFF]'
                            : 'bg-[#E2E8F0] text-[#334155]'
                        }`}
                      >
                        {rep.rank}
                      </span>
                      <span className="text-[13px] font-extrabold text-[#0F172A] truncate">
                        {rep.name}
                      </span>
                      {rep.isLeader ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669] shrink-0">
                          <Trophy className="h-3 w-3 text-[#D97706]" />
                          <span>{rep.roleTitle}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#64748B] truncate">
                          {rep.roleTitle}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[13px] font-extrabold tabular-nums shrink-0 ${
                        rep.rank === 1 ? 'text-[#2563EB]' : 'text-[#0F172A]'
                      }`}
                    >
                      {rep.wonRevenue.toLocaleString('en-US')} ر.س
                    </span>
                  </div>

                  {/* Bottom Line: Win Rate Bar (Right) | Response Speed Bar (Left) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-[#64748B]">نسبة الإغلاق</span>
                        <span className="font-extrabold text-[#059669]">
                          {rep.winRatePercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className="h-full rounded-full bg-[#065F46]"
                          style={{ width: `${Math.min(100, rep.winRatePercent * 1.9)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-[#64748B]">زمن الاستجابة</span>
                        <span
                          className={`inline-flex items-center gap-0.5 font-extrabold ${
                            rep.fastBadge ? 'text-[#2563EB]' : 'text-[#0F172A]'
                          }`}
                        >
                          {rep.fastBadge && (
                            <Zap className="h-3 w-3 text-[#F59E0B] fill-current" />
                          )}
                          <span>
                            {rep.responseMinutes <= 10
                              ? `${rep.responseMinutes} دقائق`
                              : `${rep.responseMinutes} دقيقة`}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className="h-full rounded-full bg-[#2563EB]"
                          style={{
                            width: `${Math.max(25, 100 - rep.responseMinutes * 2.2)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
              <span className="text-[#64748B]">
                الاستجابة خلال أول 10 دقائق ترفع احتمالية الفوز بنسبة{' '}
                <strong className="font-extrabold text-[#0F172A]">3.4x</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowAllReps((prev) => !prev)}
                className="inline-flex items-center gap-1 font-extrabold text-[#2563EB] hover:underline"
              >
                <span>
                  {showAllReps ? 'عرض أفضل 4 مندوبين' : 'عرض كافة الفريق (14)'}
                </span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Share / Schedule Modal */}
      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analytics-share-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3
                id="analytics-share-modal-title"
                className="text-[15px] font-extrabold text-[#0F172A]"
              >
                مشاركة وجدولة تقارير الأداء (BI)
              </h3>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  البريد الإلكتروني للمستلمين
                </label>
                <input
                  type="email"
                  required
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  دورية الإرسال التلقائي
                </label>
                <select
                  value={shareFrequency}
                  onChange={(e) => setShareFrequency(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                >
                  <option value="daily">يومياً (8:00 صباحاً)</option>
                  <option value="weekly">أسبوعياً (كل أحد)</option>
                  <option value="monthly">نهاية كل شهر ميلادي</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2 text-[12px] font-bold text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <Download className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>تصدير CSV فوري</span>
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-bold text-[#FFFFFF]"
                >
                  حفظ الجدولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Customize Analytics Dashboard Modal */}
      {newBoardModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analytics-new-board-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3
                id="analytics-new-board-title"
                className="text-[15px] font-extrabold text-[#0F172A]"
              >
                إنشاء لوحة تحليلات مخصصة
              </h3>
              <button
                type="button"
                onClick={() => setNewBoardModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBoardSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  اسم لوحة التحليلات *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: لوحة عائد حملات الربع الثالث"
                  value={customBoardName}
                  onChange={(e) => setCustomBoardName(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#0F172A] focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] mb-1">
                  المستهدف الربع سنوي المعتمد (ر.س)
                </label>
                <input
                  type="number"
                  min={100000}
                  step={50000}
                  value={customQuarterlyGoal}
                  onChange={(e) => setCustomQuarterlyGoal(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] font-bold text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setNewBoardModalOpen(false)}
                  className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F1F5F9]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-bold text-[#FFFFFF]"
                >
                  حفظ وتطبيق اللوحة
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
