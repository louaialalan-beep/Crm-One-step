import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Code2,
  Database,
  GitBranch,
  LayoutGrid,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';

interface SetupLinkItem {
  id: string;
  label: string;
  path: string;
  keywords: string[];
  badgeText?: string;
  badgeTone?: 'blue' | 'indigo' | 'emerald' | 'slate';
}

interface SetupCategoryCard {
  id: string;
  titleAr: string;
  titleEn: string;
  countLabel: string;
  iconType:
    | 'general'
    | 'security'
    | 'channels'
    | 'customization'
    | 'automation'
    | 'process'
    | 'data'
    | 'developer'
    | 'ai';
  iconBoxStyle: string;
  items: SetupLinkItem[];
}

const SETUP_CATEGORIES: SetupCategoryCard[] = [
  // 1. الإعدادات العامة (General)
  {
    id: 'general',
    titleAr: 'الإعدادات العامة',
    titleEn: 'GENERAL',
    countLabel: '6 إعدادات',
    iconType: 'general',
    iconBoxStyle: 'bg-[#DBEAFE] text-[#2563EB]',
    items: [
      {
        id: 'users',
        label: 'المستخدمون وإدارة الفريق',
        path: '/settings/users',
        keywords: ['المستخدمون', 'إدارة الفريق', 'users', 'team', 'موظفين'],
        badgeText: '18 مستخدم',
        badgeTone: 'blue',
      },
      {
        id: 'company',
        label: 'إعدادات المنشأة والباقة والإضافات',
        path: '/settings/subscription',
        keywords: ['إعدادات المنشأة والباقة', 'الشركة', 'الباقة', 'الإضافات', 'subscription', 'company'],
        badgeText: 'Enterprise',
        badgeTone: 'indigo',
      },
      {
        id: 'currencies',
        label: 'إدارة العملات المتعددة',
        path: '/settings/currencies',
        keywords: ['العملات المتعددة', 'SAR', 'USD', 'AED', 'currencies'],
        badgeText: 'SAR, USD, AED',
        badgeTone: 'slate',
      },
      {
        id: 'business-hours',
        label: 'ساعات العمل والمناوبات',
        path: '/settings/business-hours',
        keywords: ['ساعات العمل', 'المناوبات', 'shifts', 'hours'],
      },
      {
        id: 'teams',
        label: 'المجموعات والفرق',
        path: '/settings/teams',
        keywords: ['المجموعات والفرق', 'groups', 'teams'],
      },
    ],
  },

  // 2. التحكم الأمني والصلاحيات (Security Control)
  {
    id: 'security',
    titleAr: 'التحكم الأمني والصلاحيات',
    titleEn: 'SECURITY CONTROL',
    countLabel: '4 إعدادات',
    iconType: 'security',
    iconBoxStyle: 'bg-[#EDE9FE] text-[#4F46E5]',
    items: [
      {
        id: 'profiles',
        label: 'ملفات الصلاحيات المخصصة',
        path: '/settings/profiles',
        keywords: ['ملفات الصلاحيات', 'الصلاحيات', 'profiles', 'CRUD', 'FLS'],
        badgeText: '5 ملفات',
        badgeTone: 'indigo',
      },
      {
        id: 'roles',
        label: 'الأدوار والهيكل الإداري',
        path: '/settings/roles',
        keywords: ['الأدوار والهيكل التنظيمي', 'الأدوار', 'roles', 'hierarchy'],
      },
      {
        id: 'data-sharing',
        label: 'قواعد مشاركة البيانات والأمان',
        path: '/settings/data-sharing',
        keywords: ['قواعد مشاركة البيانات', 'الأمان', 'sharing rules'],
      },
      {
        id: 'audit-log',
        label: 'سجل التدقيق والأنشطة',
        path: '/settings/audit-log',
        keywords: ['سجل التدقيق', 'الأمان', 'audit log'],
        badgeText: 'مراقب آلياً',
        badgeTone: 'emerald',
      },
    ],
  },

  // 3. القنوات وربط ميتا (Channels & Meta)
  {
    id: 'channels',
    titleAr: 'القنوات وربط ميتا',
    titleEn: 'CHANNELS & META',
    countLabel: '5 قنوات',
    iconType: 'channels',
    iconBoxStyle: 'bg-[#6EE7B7]/75 text-[#065F46]',
    items: [
      {
        id: 'whatsapp',
        label: 'واتساب للأعمال (WhatsApp Cloud API)',
        path: '/settings/whatsapp',
        keywords: ['واتساب الأعمال', 'واتساب', 'whatsapp', 'cloud api'],
        badgeText: 'متصل ومفعل ✓',
        badgeTone: 'emerald',
      },
      {
        id: 'social',
        label: 'فيسبوك ماسنجر وإنستغرام',
        path: '/settings/social-channels',
        keywords: ['فيسبوك ماسنجر وإنستغرام', 'ماسنجر', 'إنستغرام', 'messenger', 'instagram'],
        badgeText: 'نشط 3 حسابات',
        badgeTone: 'slate',
      },
      {
        id: 'meta',
        label: 'تكامل إعلانات ميتا (Lead Ads & CAPI)',
        path: '/settings/meta',
        keywords: ['تكامل إعلانات ميتا وCAPI', 'ميتا', 'CAPI', 'meta', 'lead ads'],
        badgeText: 'CAPI متزامن',
        badgeTone: 'blue',
      },
      {
        id: 'email',
        label: 'خوادم البريد (IMAP/SMTP & M365)',
        path: '/settings/email',
        keywords: ['البريد', 'خوادم البريد', 'IMAP', 'SMTP', 'M365'],
      },
      {
        id: 'webforms',
        label: 'نماذج الويب واقتناص الفرص',
        path: '/settings/webforms',
        keywords: ['نماذج الويب', 'اقتناص الفرص', 'webforms'],
      },
    ],
  },

  // 4. التخصيص والحقول (Customization & Studio)
  {
    id: 'customization',
    titleAr: 'التخصيص والحقول',
    titleEn: 'CUSTOMIZATION & STUDIO',
    countLabel: '5 إعدادات',
    iconType: 'customization',
    iconBoxStyle: 'bg-[#DBEAFE] text-[#2563EB]',
    items: [
      {
        id: 'custom-fields',
        label: 'الموديولات والحقول المخصصة',
        path: '/settings/custom-fields',
        keywords: ['الموديولات والحقول المخصصة', 'الحقول', 'custom fields'],
      },
      {
        id: 'page-layouts',
        label: 'تخطيط الصفحات وصلاحيات الحقول',
        path: '/settings/profiles',
        keywords: ['تخطيط الصفحات وFLS', 'صلاحيات الحقول', 'FLS', 'layouts'],
      },
      {
        id: 'validation-rules',
        label: 'قواعد التحقق وتطابق البيانات',
        path: '/settings/validation-rules',
        keywords: ['قواعد التحقق', 'تطابق البيانات', 'validation'],
      },
      {
        id: 'templates',
        label: 'قوالب البريد والواتساب التلقائية',
        path: '/settings/templates',
        keywords: ['قوالب البريد والواتساب', 'القوالب', 'templates'],
        badgeText: '24 قالباً',
        badgeTone: 'blue',
      },
      {
        id: 'pipelines',
        label: 'مسارات وتصنيفات الصفقات',
        path: '/settings/pipelines',
        keywords: ['مسارات الصفقات', 'تصنيفات الصفقات', 'pipelines'],
      },
    ],
  },

  // 5. الأتمتة وقواعد العمل (Automation)
  {
    id: 'automation',
    titleAr: 'الأتمتة وقواعد العمل',
    titleEn: 'AUTOMATION',
    countLabel: '5 إعدادات',
    iconType: 'automation',
    iconBoxStyle: 'bg-[#E0E7FF] text-[#2563EB]',
    items: [
      {
        id: 'workflows',
        label: 'قواعد الورك فلو والتنفيذ',
        path: '/settings/workflows',
        keywords: ['قواعد الورك فلو', 'الورك فلو', 'workflows', 'الأتمتة'],
        badgeText: '14 قاعدة نشطة',
        badgeTone: 'emerald',
      },
      {
        id: 'assignment-rules',
        label: 'قواعد التوزيع الآلي للمندوبين',
        path: '/settings/assignment-rules',
        keywords: ['قواعد التوزيع الآلي', 'توزيع المندوبين', 'assignment'],
      },
      {
        id: 'scoring-rules',
        label: 'قواعد احتساب النقاط والتأهيل',
        path: '/settings/scoring-rules',
        keywords: ['قواعد التقييم', 'احتساب النقاط', 'scoring'],
      },
      {
        id: 'scheduled-actions',
        label: 'الإجراءات المجدولة والتنبيهات',
        path: '/settings/scheduled-actions',
        keywords: ['الإجراءات المجدولة', 'التنبيهات', 'scheduled'],
      },
      {
        id: 'webhooks-auto',
        label: 'خطافات التنبيه التلقائي (Webhooks)',
        path: '/settings/webhooks',
        keywords: ['Webhooks', 'خطافات التنبيه', 'ويب هوك'],
      },
    ],
  },

  // 6. إدارة العمليات والبلوبرينت (Process Management)
  {
    id: 'process',
    titleAr: 'إدارة العمليات والبلوبرينت',
    titleEn: 'PROCESS MANAGEMENT',
    countLabel: '3 عمليات',
    iconType: 'process',
    iconBoxStyle: 'bg-[#DBEAFE] text-[#1D4ED8]',
    items: [
      {
        id: 'blueprints',
        label: 'منشئ البلوبرينت ومسار الحالات',
        path: '/settings/blueprints',
        keywords: ['منشئ البلوبرينت', 'البلوبرينت', 'blueprints', 'مسار الحالات'],
        badgeText: 'مفعل للمبيعات',
        badgeTone: 'blue',
      },
      {
        id: 'approvals',
        label: 'مسارات الموافقات والاعتمادات',
        path: '/settings/approvals',
        keywords: ['مسارات الموافقات', 'الاعتمادات', 'approvals'],
      },
      {
        id: 'transition-rules',
        label: 'شروط الانتقال والتحقق الإلزامي',
        path: '/settings/blueprints',
        keywords: ['شروط الانتقال', 'التحقق الإلزامي', 'transitions'],
      },
    ],
  },

  // 7. إدارة البيانات والتخزين (Data Administration)
  {
    id: 'data',
    titleAr: 'إدارة البيانات والتخزين',
    titleEn: 'DATA ADMINISTRATION',
    countLabel: '3 إعدادات',
    iconType: 'data',
    iconBoxStyle: 'bg-[#6EE7B7]/75 text-[#065F46]',
    items: [
      {
        id: 'import-export',
        label: 'استيراد وتصدير البيانات الشامل',
        path: '/settings/import-export',
        keywords: ['الاستيراد والتصدير', 'استيراد', 'تصدير', 'import', 'export'],
      },
      {
        id: 'deduplication',
        label: 'فحص ودمج التكرار التلقائي',
        path: '/settings/deduplication',
        keywords: ['تنظيف التكرار', 'فحص ودمج التكرار', 'deduplication'],
      },
      {
        id: 'recycle-bin',
        label: 'سلة المهملات واستعادة السجلات',
        path: '/settings/recycle-bin',
        keywords: ['سلة المهملات', 'استعادة السجلات', 'recycle bin'],
      },
    ],
  },

  // 8. مساحة المطورين والربط البرمجي (Developer Space)
  {
    id: 'developer',
    titleAr: 'مساحة المطورين والربط البرمجي',
    titleEn: 'DEVELOPER SPACE',
    countLabel: '3 أدوات',
    iconType: 'developer',
    iconBoxStyle: 'bg-[#EEF2FF] text-[#4338CA]',
    items: [
      {
        id: 'api-keys',
        label: 'مفاتيح وتصاريح API (OAuth 2.0)',
        path: '/settings/api-keys',
        keywords: ['مفاتيح API', 'OAuth', 'REST API'],
        badgeText: 'v2 REST API',
        badgeTone: 'indigo',
      },
      {
        id: 'webhooks-dev',
        label: 'نقاط الاستماع والويب هوك',
        path: '/settings/webhooks',
        keywords: ['Webhooks', 'نقاط الاستماع', 'ويب هوك'],
      },
      {
        id: 'functions',
        label: 'الدوال المخصصة وسيرفرلس (Functions)',
        path: '/settings/functions',
        keywords: ['الدوال المخصصة', 'Functions', 'سيرفرلس'],
      },
    ],
  },

  // 9. الذكاء الاصطناعي والمؤشرات (AI Engine)
  {
    id: 'ai',
    titleAr: 'الذكاء الاصطناعي والمؤشرات',
    titleEn: 'AI ENGINE',
    countLabel: '1 محرك نشط',
    iconType: 'ai',
    iconBoxStyle: 'bg-[#FFE4E6] text-[#E11D48]',
    items: [
      {
        id: 'ai-scoring',
        label: 'التقييم الذكي التلقائي للعملاء',
        path: '/settings/ai-scoring',
        keywords: ['التقييم الذكي للعملاء', 'الذكاء الاصطناعي', 'ai scoring'],
        badgeText: 'دقة 94%',
        badgeTone: 'emerald',
      },
    ],
  },
];

const RECENT_SETUP_CHANGES = [
  {
    id: 'chg_1',
    title: 'تحديث مصفوفة الصلاحيات ومستوى الحقول (Enterprise Sales Profile)',
    actor: 'طارق العتيبي',
    time: 'منذ 12 دقيقة',
    module: 'التحكم الأمني والصلاحيات',
  },
  {
    id: 'chg_2',
    title: 'تعديل شروط الانتقال الإلزامية في مسار مبيعات كبار العملاء (Blueprint v3.2)',
    actor: 'طارق العتيبي',
    time: 'منذ ساعتين',
    module: 'إدارة العمليات والبلوبرينت',
  },
  {
    id: 'chg_3',
    title: 'مزامنة رمز التحويل المباشر لحدث الشراء في Meta Conversions API (CAPI)',
    actor: 'سارة المنصور',
    time: 'أمس، 04:30 م',
    module: 'القنوات وربط ميتا',
  },
  {
    id: 'chg_4',
    title: 'اعتماد هيكل الأدوار الإقليمية وتفعيل توارث السجلات التنازلي (Roll-Up)',
    actor: 'سعود بن فهد',
    time: 'قبل يومين',
    module: 'الأدوار والهيكل الإداري',
  },
];

const HIDDEN_INCOMPLETE_SETTING_IDS = new Set([
  'fiscal-year',
  'territories',
  'review-processes',
  'backups',
  'sandbox',
  'erp',
  'api-logs',
  'ai-forecasting',
  'ai-best-time',
  'ai-sentiment',
  'ai-anomaly',
]);

export const SetupHubPage: React.FC = () => {
  const { profiles, users, workflows, currentOrganization, currencies } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [sandboxActive, setSandboxActive] = useState(true);
  const [recentLogOpen, setRecentLogOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [storageLimitGb, setStorageLimitGb] = useState(100);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+/ to focus setup search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter items across all 9 cards in real time while hiding the 11 incomplete links
  const filteredCategories = useMemo(() => {
    const activeCurrenciesLabel =
      currencies && currencies.length > 0
        ? currencies
            .filter((c) => c.isActive)
            .slice(0, 3)
            .map((c) => c.code)
            .join(', ')
        : 'SAR, USD, AED';

    const dynamicCategories = SETUP_CATEGORIES.map((cat) => {
      const visibleItems = cat.items
        .filter(
          (item) =>
            !HIDDEN_INCOMPLETE_SETTING_IDS.has(item.id) &&
            !Array.from(HIDDEN_INCOMPLETE_SETTING_IDS).some((slug) =>
              item.path.endsWith(`/${slug}`)
            )
        )
        .map((item) => {
          if (item.id === 'profiles') {
            return {
              ...item,
              badgeText: `${profiles.length} ملفات`,
            };
          }
          if (item.id === 'users') {
            return {
              ...item,
              badgeText: `${users.length} مستخدم`,
            };
          }
          if (item.id === 'company') {
            return {
              ...item,
              badgeText: currentOrganization.plan,
            };
          }
          if (item.id === 'currencies') {
            return {
              ...item,
              badgeText: activeCurrenciesLabel,
            };
          }
          if (item.id === 'workflows') {
            const activeWfCount = workflows.filter((w) => w.active).length;
            return {
              ...item,
              badgeText: `${Math.max(1, activeWfCount)} قاعدة نشطة`,
            };
          }
          return item;
        });

      return {
        ...cat,
        countLabel: `${visibleItems.length} إعدادات`,
        items: visibleItems,
      };
    }).filter((cat) => cat.items.length > 0);

    if (!normalizedQuery) return dynamicCategories;

    return dynamicCategories
      .map((cat) => {
        const categoryMatches =
          cat.titleAr.toLowerCase().includes(normalizedQuery) ||
          cat.titleEn.toLowerCase().includes(normalizedQuery);

        const matchingItems = cat.items.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            (item.badgeText &&
              item.badgeText.toLowerCase().includes(normalizedQuery)) ||
            item.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
        );

        if (categoryMatches && matchingItems.length === 0) {
          return cat;
        }

        return {
          ...cat,
          items: matchingItems,
        };
      })
      .filter((cat) => cat.items.length > 0);
  }, [
    normalizedQuery,
    profiles.length,
    users.length,
    currentOrganization.plan,
    currencies,
    workflows,
  ]);

  const usedStorageGb = 18.4;
  const usedPercentage = Number(
    ((usedStorageGb / storageLimitGb) * 100).toFixed(1)
  );

  const renderCategoryIcon = (type: SetupCategoryCard['iconType']) => {
    switch (type) {
      case 'general':
        return <SlidersHorizontal className="h-5 w-5" />;
      case 'security':
        return <ShieldCheck className="h-5 w-5" />;
      case 'channels':
        return <Share2 className="h-5 w-5" />;
      case 'customization':
        return <LayoutGrid className="h-5 w-5" />;
      case 'automation':
        return <Zap className="h-5 w-5" />;
      case 'process':
        return <GitBranch className="h-5 w-5" />;
      case 'data':
        return <Database className="h-5 w-5" />;
      case 'developer':
        return <Code2 className="h-5 w-5" />;
      case 'ai':
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const renderItemBadge = (
    text?: string,
    tone: SetupLinkItem['badgeTone'] = 'slate'
  ) => {
    if (!text) return null;

    const toneClasses: Record<NonNullable<SetupLinkItem['badgeTone']>, string> = {
      blue: 'bg-[#DBEAFE] text-[#1E40AF]',
      indigo: 'bg-[#E0E7FF] text-[#3730A3]',
      emerald: 'bg-[#6EE7B7]/85 text-[#065F46]',
      slate: 'bg-[#E2E8F0]/90 text-[#334155]',
    };

    return (
      <span
        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold leading-snug tracking-tight ${toneClasses[tone]}`}
      >
        {text}
      </span>
    );
  };

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* 1. FLUSH WHITE SETUP HEADER */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0]">
        {/* Top Main Strip */}
        <div className="w-full px-6 pt-5 pb-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Right: Gear Icon + Title + Subtitle + Description */}
          <div className="flex items-start gap-3.5">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] shadow-2xs">
              <Settings className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <h1 className="text-[22px] sm:text-[25px] font-extrabold text-[#0F172A] leading-tight">
                الإعدادات والنظام
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#DBEAFE] px-2.5 py-0.5 text-[10px] font-extrabold text-[#1D4ED8]">
                  مركز الإدارة المؤسسية
                </span>
                <span
                  className="text-[12px] font-semibold text-[#334155]"
                  dir="ltr"
                >
                  (Setup &amp; Administration)
                </span>
              </div>

              <p className="text-[11px] sm:text-[12px] text-[#64748B] leading-relaxed max-w-[340px]">
                التهيئة المركزية وتخصيص بيئة عمل Crm-One-step وربط قنوات ميتا والأتمتة
              </p>
            </div>
          </div>

          {/* Center: Live Setup Search Input */}
          <div className="w-full xl:max-w-[460px] flex-1">
            <div className="relative flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 focus-within:border-[#2563EB] focus-within:bg-[#FFFFFF] focus-within:ring-2 focus-within:ring-[#2563EB]/15 transition-all">
              <Search className="h-4 w-4 text-[#475569] shrink-0 ml-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في أي إعداد... مثلاً: البلوبرينت، الصلاحيات، ميتا، الورك فلو"
                className="w-full bg-transparent text-[12px] font-medium text-[#0F172A] placeholder:text-[#64748B] focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="mr-2 rounded-md p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div
                  className="mr-2 hidden sm:flex items-center gap-1 shrink-0 text-[10px] font-mono text-[#475569]"
                  dir="ltr"
                >
                  <kbd className="rounded bg-[#E2E8F0] px-1.5 py-0.5 font-bold text-[#334155]">
                    Ctrl
                  </kbd>
                  <span className="text-[#94A3B8]">+</span>
                  <kbd className="rounded bg-[#E2E8F0] px-1.5 py-0.5 font-bold text-[#334155]">
                    /
                  </kbd>
                </div>
              )}
            </div>
          </div>

          {/* Left: Action Buttons ("سجل التعديلات الأخير" + "بيئة الاختبار (Sandbox: نشط)") */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setRecentLogOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9]/80 hover:bg-[#E2E8F0]/70 px-4 py-2.5 text-[12px] font-extrabold text-[#0F172A] transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-[#64748B]" />
              <span className="text-center leading-snug">
                سجل التعديلات الأخير
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !sandboxActive;
                setSandboxActive(next);
                setToastMessage(
                  next
                    ? 'تم تفعيل وضع بيئة الاختبار (Sandbox: نشط)'
                    : 'تم إيقاف بيئة الاختبار والانتقال إلى بيئة الإنتاج المباشرة'
                );
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-extrabold transition-colors ${
                sandboxActive
                  ? 'border-[#E2E8F0] bg-[#F1F5F9]/80 hover:bg-[#E2E8F0]/70 text-[#0F172A]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#475569]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  sandboxActive ? 'bg-[#059669]' : 'bg-[#94A3B8]'
                }`}
              />
              <span className="text-center leading-snug">
                بيئة الاختبار (Sandbox: {sandboxActive ? 'نشط' : 'متوقف'})
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Breadcrumb & Enterprise Version Strip */}
        <div className="w-full border-t border-[#F1F5F9] px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <Link to="/" className="hover:text-[#2563EB] font-medium">
              لوحة التحكم
            </Link>
            <ChevronLeft className="h-3 w-3 text-[#94A3B8]" />
            <span className="font-extrabold text-[#0F172A]">
              إعدادات النظام العامة والمتقدمة
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#475569] font-medium">
              النسخة المؤسسية:{' '}
              <span className="font-mono text-[#0F172A]">v4.8.2-Enterprise</span>
            </span>
            <span className="text-[#CBD5E1]">•</span>
            <span className="inline-flex items-center gap-1 font-extrabold text-[#059669]">
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>جميع الموديولات متزامنة</span>
            </span>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46] shadow-xs">
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

      {/* 2. 3x3 SETUP CATEGORIES GRID + 3. BOTTOM STORAGE & QUOTA BAR */}
      <div className="w-full px-6 py-5 space-y-5 flex-1">
        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-10 text-center space-y-2 shadow-2xs">
            <p className="text-[15px] font-extrabold text-[#0F172A]">
              لا توجد إعدادات مطابقة لعبارة البحث "{searchQuery}"
            </p>
            <p className="text-[12px] text-[#64748B]">
              جرب البحث بكلمات مثل: البلوبرينت، الصلاحيات، ميتا، الورك فلو، الحقول، أو سلة المهملات.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#1D4ED8]"
            >
              إعادة عرض جميع الإعدادات (9 أقسام)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCategories.map((category) => (
              <section
                key={category.id}
                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-2xs flex flex-col justify-between hover:border-[#CBD5E1] transition-colors"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
                    {/* Right: Icon + Arabic Title + English Subtitle */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${category.iconBoxStyle}`}
                      >
                        {renderCategoryIcon(category.iconType)}
                      </div>
                      <div>
                        <h2 className="text-[15px] font-extrabold text-[#0F172A] leading-snug">
                          {category.titleAr}
                        </h2>
                        <p className="mt-0.5 text-[10px] font-mono font-extrabold tracking-wider text-[#334155] uppercase">
                          {category.titleEn}
                        </p>
                      </div>
                    </div>

                    {/* Left: Count Badge */}
                    <span className="shrink-0 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-bold text-[#475569] tabular-nums">
                      {normalizedQuery
                        ? `${category.items.length} مطابق`
                        : category.countLabel}
                    </span>
                  </div>

                  {/* Card Items List */}
                  <ul className="mt-3 divide-y divide-[#F8FAFC]">
                    {category.items.map((item) => {
                      const isMatched =
                        normalizedQuery.length > 0 &&
                        (item.label.toLowerCase().includes(normalizedQuery) ||
                          item.keywords.some((kw) =>
                            kw.toLowerCase().includes(normalizedQuery)
                          ));

                      return (
                        <li key={item.id}>
                          <Link
                            to={item.path}
                            className={`group flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-[12.5px] transition-colors ${
                              isMatched
                                ? 'bg-[#EFF6FF] text-[#1D4ED8] font-extrabold'
                                : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#2563EB] font-semibold'
                            }`}
                          >
                            <span className="leading-snug">{item.label}</span>

                            <div className="flex items-center gap-2 shrink-0">
                              {renderItemBadge(item.badgeText, item.badgeTone)}
                              <ChevronLeft className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#2563EB] group-hover:-translate-x-0.5 transition-all" />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* 3. BOTTOM STORAGE & QUOTA BAR */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Right: Pulse Icon + Title + Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#0F172A]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[14px] font-extrabold text-[#0F172A]">
                استهلاك مساحة التخزين والموارد المؤسسية
              </h3>
              <p className="mt-0.5 text-[11px] text-[#64748B]">
                تم استخدام {usedStorageGb} جيجابايت من أصل {storageLimitGb}{' '}
                جيجابايت المخصصة لمؤسستكم
              </p>
            </div>
          </div>

          {/* Center: Cloud Storage Progress Bar (18.4 / 100 GB) */}
          <div className="w-full lg:max-w-[340px] flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#334155]">
                المساحة السحابية ({usedPercentage}%)
              </span>
              <span
                className="font-mono font-extrabold text-[#2563EB] tabular-nums"
                dir="ltr"
              >
                {usedStorageGb} / {storageLimitGb} GB
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                style={{ width: `${Math.min(100, usedPercentage)}%` }}
              />
            </div>
          </div>

          {/* Left: "ترقية السعة" + "تقرير الصحة التشغيلية" */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] hover:bg-[#E2E8F0] px-4 py-2.5 text-[12px] font-extrabold text-[#0F172A] transition-colors"
            >
              ترقية السعة
            </button>

            <button
              type="button"
              onClick={() => setHealthModalOpen(true)}
              className="rounded-xl bg-[#004AC6] hover:bg-[#1D4ED8] px-5 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors"
            >
              تقرير الصحة التشغيلية
            </button>
          </div>
        </section>
      </div>

      {/* Modal 1: Recent Setup Changes Log ("سجل التعديلات الأخير") */}
      {recentLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-[16px] font-extrabold text-[#0F172A]">
                  سجل التعديلات الأخير في الإعدادات والنظام
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRecentLogOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {RECENT_SETUP_CHANGES.map((item) => (
                <div key={item.id} className="py-3 space-y-1">
                  <p className="text-[13px] font-bold text-[#0F172A]">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>
                      بواسطة: <strong className="text-[#334155]">{item.actor}</strong> ·{' '}
                      {item.module}
                    </span>
                    <span className="tabular-nums">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRecentLogOpen(false)}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#1D4ED8]"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Upgrade Storage Quota ("ترقية السعة") */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[16px] font-extrabold text-[#0F172A]">
                ترقية سعة التخزين السحابي المؤسسي
              </h3>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[12px] text-[#64748B]">
              اختر السعة الإجمالية المطلوبة لمرفقات العقود، رسائل واتساب السحابية، والنسخ الاحتياطي اليومي:
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              {[100, 250, 500].map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => {
                    setStorageLimitGb(cap);
                    setUpgradeModalOpen(false);
                    setToastMessage(
                      `تم تحديث باقة المساحة السحابية إلى ${cap} GB بنجاح`
                    );
                  }}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    storageLimitGb === cap
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:border-[#CBD5E1]'
                  }`}
                >
                  <p className="font-mono text-[15px] font-extrabold">{cap} GB</p>
                  <p className="mt-0.5 text-[10px] text-[#64748B]">
                    {cap === 100
                      ? 'الباقة الحالية'
                      : cap === 250
                      ? 'توسع الأعمال'
                      : 'مؤسسي مفتوح'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Operational Health Report ("تقرير الصحة التشغيلية") */}
      {healthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#059669]" />
                <h3 className="text-[16px] font-extrabold text-[#0F172A]">
                  تقرير الصحة التشغيلية للمنظومة (v4.8.2-Enterprise)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHealthModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3">
                <p className="text-[#047857] font-bold">مزامنة قاعدة البيانات (Firestore)</p>
                <p className="mt-1 text-[15px] font-extrabold text-[#065F46]">
                  متصل — 99.98% Uptime
                </p>
              </div>
              <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                <p className="text-[#1D4ED8] font-bold">ربط WhatsApp Cloud API &amp; CAPI</p>
                <p className="mt-1 text-[15px] font-extrabold text-[#1E40AF]">
                  نشط ومتزامن (0 أخطاء)
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-[#475569] font-bold">قواعد الورك فلو والبلوبرينت</p>
                <p className="mt-1 text-[15px] font-extrabold text-[#0F172A]">
                  14 قاعدة نشطة · سليم
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-[#475569] font-bold">النسخ الاحتياطي السحابي اليومي</p>
                <p className="mt-1 text-[15px] font-extrabold text-[#0F172A]">
                  مكتمل اليوم 03:00 ص
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHealthModalOpen(false)}
                className="rounded-xl bg-[#004AC6] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#1D4ED8]"
              >
                تم الاطلاع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
