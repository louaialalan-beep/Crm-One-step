import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Folder,
  FolderInput,
  FolderPlus,
  Layers,
  Megaphone,
  MessageCircle,
  MoreVertical,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  ReportDefinition,
  ReportFolder,
  ReportType,
  UserSecurityContext,
} from '../../types/reports';
import {
  STANDARD_FOLDERS,
  STANDARD_REPORTS,
} from '../../lib/reports/standard-reports-seed';
import { FolderModal } from './FolderModal';
import { ReportWizard } from './ReportWizard';

export type SmartViewKey =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'scheduled'
  | 'created_by_me'
  | 'shared_with_me';

export interface ReportsHomeProps {
  reports?: ReportDefinition[];
  folders?: ReportFolder[];
  scheduledReportIds?: string[];
  recentReportIds?: string[];
  currentUserName?: string;
  security?: UserSecurityContext;
  onOpenReport?: (report: ReportDefinition) => void;
  onSaveReport?: (report: ReportDefinition, runImmediately: boolean) => void;
  onDeleteReport?: (reportId: string) => void;
  onToggleFavorite?: (reportId: string) => void;
  onOpenScheduler?: (report?: ReportDefinition) => void;
  onExportReport?: (report: ReportDefinition) => void;
  onSaveFolder?: (folder: ReportFolder) => void;
  onDeleteFolder?: (folderId: string) => void;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  tabular: 'جدولي (Tabular)',
  summary: 'ملخص (Summary)',
  matrix: 'مصفوفي (Matrix)',
  joined: 'مدمج (Joined)',
};

function formatArabicDateTime(isoStr?: string): string {
  if (!isoStr) return 'لم يُشغّل بعد';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} • ${hh}:${min}`;
}

function renderFolderIcon(iconName?: string) {
  switch (iconName) {
    case 'Users':
      return <Users className="h-4 w-4 text-[#2563EB]" />;
    case 'Building2':
      return <Building2 className="h-4 w-4 text-[#2563EB]" />;
    case 'Briefcase':
      return <Briefcase className="h-4 w-4 text-[#2563EB]" />;
    case 'ClipboardCheck':
      return <ClipboardCheck className="h-4 w-4 text-[#2563EB]" />;
    case 'Megaphone':
      return <Megaphone className="h-4 w-4 text-[#2563EB]" />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet className="h-4 w-4 text-[#2563EB]" />;
    case 'MessageCircle':
      return <MessageCircle className="h-4 w-4 text-[#2563EB]" />;
    default:
      return <Folder className="h-4 w-4 text-[#2563EB]" />;
  }
}

export const ReportsHome: React.FC<ReportsHomeProps> = ({
  reports: externalReports,
  folders: externalFolders,
  scheduledReportIds = [
    'rpt_deals_by_stage',
    'rpt_closed_won_this_month',
    'rpt_campaign_roi_performance',
    'rpt_whatsapp_24h_window_sla',
  ],
  recentReportIds: externalRecentIds,
  currentUserName = 'طارق العتيبي',
  security,
  onOpenReport,
  onSaveReport,
  onDeleteReport,
  onToggleFavorite,
  onOpenScheduler,
  onExportReport,
  onSaveFolder,
  onDeleteFolder,
}) => {
  // Local fallback state when used standalone
  const [localReports, setLocalReports] =
    useState<ReportDefinition[]>(STANDARD_REPORTS);
  const [localFolders, setLocalFolders] =
    useState<ReportFolder[]>(STANDARD_FOLDERS);
  const [localRecentIds, setLocalRecentIds] = useState<string[]>([
    'rpt_10plus_order_attribution_matrix',
    'rpt_stage_dwell_time_velocity',
    'rpt_deals_by_stage',
    'rpt_campaign_roi_performance',
    'rpt_vip_customers_ltv',
  ]);

  const activeReports = externalReports ?? localReports;
  const activeFolders = externalFolders ?? localFolders;
  const recentIds = externalRecentIds ?? localRecentIds;

  // Navigation & Filtering State
  const [selectedView, setSelectedView] = useState<
    { kind: 'smart'; key: SmartViewKey } | { kind: 'folder'; folderId: string }
  >({ kind: 'smart', key: 'all' });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | ReportType>('all');

  // Action Menu & Modals State
  const [openMenuReportId, setOpenMenuReportId] = useState<string | null>(null);
  const [moveFolderReport, setMoveFolderReport] =
    useState<ReportDefinition | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Folder Modal State
  const [folderModalOpen, setFolderModalOpen] = useState<boolean>(false);
  const [editingFolder, setEditingFolder] = useState<ReportFolder | null>(null);

  // Report Wizard State
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [wizardInitialReport, setWizardInitialReport] =
    useState<ReportDefinition | null>(null);
  const [wizardCloneMode, setWizardCloneMode] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    window.setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Folder Map for quick lookups
  const folderMap = useMemo(() => {
    const map = new Map<string, ReportFolder>();
    for (const f of activeFolders) {
      map.set(f.id, f);
    }
    return map;
  }, [activeFolders]);

  // Smart View Counts
  const smartCounts = useMemo(() => {
    return {
      all: activeReports.length,
      favorites: activeReports.filter((r) => r.isFavorite).length,
      recent: activeReports.filter((r) => recentIds.includes(r.id)).length,
      scheduled: activeReports.filter((r) => scheduledReportIds.includes(r.id))
        .length,
      created_by_me: activeReports.filter(
        (r) => !r.isStandard || r.createdBy === currentUserName
      ).length,
      shared_with_me: activeReports.filter(
        (r) => r.sharing.scope === 'everyone' || r.sharing.scope === 'selected'
      ).length,
    };
  }, [activeReports, currentUserName, recentIds, scheduledReportIds]);

  // Per-Folder Report Counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of activeFolders) {
      counts[f.id] = 0;
    }
    for (const r of activeReports) {
      counts[r.folderId] = (counts[r.folderId] ?? 0) + 1;
    }
    return counts;
  }, [activeFolders, activeReports]);

  // Filter Reports by Smart View / Folder + Search + Type
  const displayedReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return activeReports.filter((rpt) => {
      // 1. View / Folder Match
      if (selectedView.kind === 'smart') {
        switch (selectedView.key) {
          case 'favorites':
            if (!rpt.isFavorite) return false;
            break;
          case 'recent':
            if (!recentIds.includes(rpt.id)) return false;
            break;
          case 'scheduled':
            if (!scheduledReportIds.includes(rpt.id)) return false;
            break;
          case 'created_by_me':
            if (rpt.isStandard && rpt.createdBy !== currentUserName)
              return false;
            break;
          case 'shared_with_me':
            if (rpt.sharing.scope === 'only_me') return false;
            break;
          case 'all':
          default:
            break;
        }
      } else if (rpt.folderId !== selectedView.folderId) {
        return false;
      }

      // 2. Report Type Filter
      if (typeFilter !== 'all' && rpt.reportType !== typeFilter) {
        return false;
      }

      // 3. Search Query
      if (q) {
        const hay =
          `${rpt.name} ${rpt.description} ${rpt.createdBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    activeReports,
    currentUserName,
    recentIds,
    scheduledReportIds,
    searchQuery,
    selectedView,
    typeFilter,
  ]);

  // Current Header Title & Subtitle
  const currentHeaderMeta = useMemo(() => {
    if (selectedView.kind === 'smart') {
      const smartTitles: Record<SmartViewKey, { title: string; desc: string }> =
        {
          all: {
            title: 'جميع التقارير (All Reports)',
            desc: 'مستودع التقارير الموحد لكافة وحدات المبيعات، التسويق، الفوترة، وخدمة العملاء.',
          },
          favorites: {
            title: 'التقارير المفضلة (Favorites)',
            desc: 'التقارير التنفيذية المثبتة للوصول اليومي السريع.',
          },
          recent: {
            title: 'تمت مشاهدتها مؤخراً (Recently Viewed)',
            desc: 'آخر التقارير التي قمت بتشغيلها أو استعراضها خلال الجلسة.',
          },
          scheduled: {
            title: 'التقارير المجدولة للتسليم الآلي (Scheduled Reports)',
            desc: 'تقارير يتم توليدها وإرسالها دورياً عبر البريد الإلكتروني بصيغ PDF و Excel.',
          },
          created_by_me: {
            title: 'تقارير من إنشائي (Created by Me)',
            desc: 'التقارير المخصصة التي قمت ببنائها عبر معالج التقارير.',
          },
          shared_with_me: {
            title: 'تقارير مشاركة معي (Shared with Me)',
            desc: 'التقارير المشتركة مع دورك الوظيفي أو مع كافة أعضاء المؤسسة.',
          },
        };
      return smartTitles[selectedView.key];
    }

    const folder = folderMap.get(selectedView.folderId);
    return {
      title: folder?.name ?? 'مجلد التقارير',
      desc: folder?.description ?? 'استعراض وتشغيل التقارير المحفوظة في هذا المجلد.',
    };
  }, [folderMap, selectedView]);

  // Handlers
  const handleToggleFav = (reportId: string) => {
    if (onToggleFavorite) {
      onToggleFavorite(reportId);
    } else {
      setLocalReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, isFavorite: !r.isFavorite } : r
        )
      );
    }
  };

  const handleRunReport = (report: ReportDefinition) => {
    setLocalRecentIds((prev) => [
      report.id,
      ...prev.filter((id) => id !== report.id),
    ]);
    if (onOpenReport) {
      onOpenReport(report);
    } else {
      showToast(`تم تشغيل التقرير: "${report.name}" بنجاح.`);
    }
  };

  const handleSaveWizardReport = (
    savedReport: ReportDefinition,
    runImmediately: boolean
  ) => {
    if (onSaveReport) {
      onSaveReport(savedReport, runImmediately);
    } else {
      setLocalReports((prev) => {
        const exists = prev.some((r) => r.id === savedReport.id);
        if (exists) {
          return prev.map((r) => (r.id === savedReport.id ? savedReport : r));
        }
        return [savedReport, ...prev];
      });
      showToast(`تم حفظ التقرير "${savedReport.name}" بنجاح.`);
      if (runImmediately && onOpenReport) {
        onOpenReport(savedReport);
      }
    }
  };

  const handleDeleteReportInternal = (report: ReportDefinition) => {
    if (report.isStandard) return;
    if (onDeleteReport) {
      onDeleteReport(report.id);
    } else {
      setLocalReports((prev) => prev.filter((r) => r.id !== report.id));
    }
    setOpenMenuReportId(null);
    showToast(`تم حذف التقرير المخصص "${report.name}".`);
  };

  const handleConfirmMoveFolder = () => {
    if (!moveFolderReport || !targetMoveFolderId) return;
    const updatedReport: ReportDefinition = {
      ...moveFolderReport,
      folderId: targetMoveFolderId,
    };
    handleSaveWizardReport(updatedReport, false);
    const targetFolderName =
      folderMap.get(targetMoveFolderId)?.name ?? 'المجلد الجديد';
    setMoveFolderReport(null);
    showToast(
      `تم نقل التقرير "${moveFolderReport.name}" إلى "${targetFolderName}".`
    );
  };

  const handleExportReportCsv = (report: ReportDefinition) => {
    setOpenMenuReportId(null);
    if (onExportReport) {
      onExportReport(report);
      return;
    }
    const headers = report.selectedColumns.join(',');
    const csvContent = `\uFEFF# ${report.name}\n${headers}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`تم تصدير هيكل وبيانات التقرير "${report.name}" بصيغة CSV.`);
  };

  const handleSaveFolderInternal = (folder: ReportFolder) => {
    if (onSaveFolder) {
      onSaveFolder(folder);
    } else {
      setLocalFolders((prev) => {
        const exists = prev.some((f) => f.id === folder.id);
        if (exists) {
          return prev.map((f) => (f.id === folder.id ? folder : f));
        }
        return [...prev, folder];
      });
    }
    setSelectedView({ kind: 'folder', folderId: folder.id });
    showToast(`تم حفظ المجلد "${folder.name}" بنجاح.`);
  };

  const handleDeleteFolderInternal = (folderId: string) => {
    if (onDeleteFolder) {
      onDeleteFolder(folderId);
    } else {
      setLocalFolders((prev) => prev.filter((f) => f.id !== folderId));
    }
    setSelectedView({ kind: 'smart', key: 'all' });
    showToast('تم حذف المجلد المخصص.');
  };

  const SMART_VIEWS: Array<{
    key: SmartViewKey;
    label: string;
    count: number;
    icon: React.FC<{ className?: string }>;
  }> = [
    { key: 'all', label: 'جميع التقارير', count: smartCounts.all, icon: Layers },
    {
      key: 'favorites',
      label: 'المفضلة',
      count: smartCounts.favorites,
      icon: Star,
    },
    {
      key: 'recent',
      label: 'تمت مشاهدتها مؤخراً',
      count: smartCounts.recent,
      icon: Clock,
    },
    {
      key: 'scheduled',
      label: 'التقارير المجدولة',
      count: smartCounts.scheduled,
      icon: CalendarClock,
    },
    {
      key: 'created_by_me',
      label: 'تقارير من إنشائي',
      count: smartCounts.created_by_me,
      icon: UserCheck,
    },
    {
      key: 'shared_with_me',
      label: 'تقارير مشاركة معي',
      count: smartCounts.shared_with_me,
      icon: Share2,
    },
  ];

  return (
    <div dir="rtl" className="flex min-h-[calc(100vh-4rem)] w-full bg-[#F8FAFC]">
      {/* =================================================================== */}
      {/* 1. RIGHT FIXED FOLDER TRAY (`w-72 bg-white border-l border-[#E2E8F0]`) */}
      {/* =================================================================== */}
      <aside className="w-72 shrink-0 border-l border-[#E2E8F0] bg-[#FFFFFF] flex flex-col">
        {/* Tray Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-4">
          <div>
            <h2 className="text-[14px] font-extrabold text-[#0F172A]">
              مجلدات التقارير
            </h2>
            <p className="text-[11px] text-[#64748B]">
              تنظيم ذكي وصلاحيات مخصصة
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingFolder(null);
              setFolderModalOpen(true);
            }}
            title="إنشاء مجلد تقارير جديد"
            className="inline-flex items-center gap-1 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1.5 text-[11px] font-extrabold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>+ مجلد جديد</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* System Smart Views */}
          <div className="space-y-1">
            <p className="px-2.5 pb-1 text-[10px] font-extrabold text-[#64748B]">
              العروض الذكية للنظام
            </p>
            {SMART_VIEWS.map((sv) => {
              const IconComp = sv.icon;
              const isActive =
                selectedView.kind === 'smart' && selectedView.key === sv.key;

              return (
                <button
                  key={sv.key}
                  type="button"
                  onClick={() => {
                    setSelectedView({ kind: 'smart', key: sv.key });
                    if (sv.key === 'scheduled' && onOpenScheduler) {
                      onOpenScheduler();
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-[12px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EFF6FF] font-extrabold text-[#2563EB]'
                      : 'font-semibold text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComp
                      className={`h-4 w-4 shrink-0 ${
                        sv.key === 'favorites'
                          ? 'text-[#F59E0B]'
                          : isActive
                            ? 'text-[#2563EB]'
                            : 'text-[#64748B]'
                      }`}
                    />
                    <span className="truncate">{sv.label}</span>
                  </div>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                      isActive
                        ? 'bg-[#2563EB] text-[#FFFFFF]'
                        : 'bg-[#F1F5F9] text-[#475569]'
                    }`}
                  >
                    {sv.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Standard & Custom Folders List */}
          <div className="space-y-1 border-t border-[#F1F5F9] pt-4">
            <div className="flex items-center justify-between px-2.5 pb-1">
              <p className="text-[10px] font-extrabold text-[#64748B]">
                المجلدات القياسية والمخصصة ({activeFolders.length})
              </p>
            </div>

            {activeFolders.map((folder) => {
              const isActive =
                selectedView.kind === 'folder' &&
                selectedView.folderId === folder.id;
              const count = folderCounts[folder.id] ?? 0;

              return (
                <div
                  key={folder.id}
                  onClick={() =>
                    setSelectedView({ kind: 'folder', folderId: folder.id })
                  }
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-[12px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EFF6FF] font-extrabold text-[#2563EB]'
                      : 'font-semibold text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderFolderIcon(folder.iconName)}
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setFolderModalOpen(true);
                      }}
                      title="إعدادات ومشاركة المجلد"
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-[#64748B] hover:bg-[#FFFFFF] hover:text-[#2563EB] transition-opacity cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                        isActive
                          ? 'bg-[#2563EB] text-[#FFFFFF]'
                          : 'bg-[#F1F5F9] text-[#475569]'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* 2. LEFT MAIN WORKSPACE                                              */}
      {/* =================================================================== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Flush Full-Width Header (`bg-white border-b border-[#E2E8F0]`) */}
        <header className="border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[18px] sm:text-[20px] font-extrabold text-[#0F172A]">
                  {currentHeaderMeta.title}
                </h1>
                <span className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#2563EB] tabular-nums">
                  {displayedReports.length} تقرير
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[#64748B]">
                {currentHeaderMeta.desc}
              </p>
            </div>

            {/* Search + Report Type Filter + "+ إنشاء تقرير جديد" */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-64">
                <Search className="h-4 w-4 text-[#94A3B8] absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم التقرير أو الوصف..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] pr-9 pl-3 py-2 text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as 'all' | ReportType)
                }
                aria-label="تصفية حسب نوع التقرير"
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-[12px] font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none cursor-pointer"
              >
                <option value="all">الكل (جميع الأنواع)</option>
                <option value="tabular">جدولي (Tabular)</option>
                <option value="summary">ملخص (Summary)</option>
                <option value="matrix">مصفوفي (Matrix)</option>
                <option value="joined">مدمج (Joined)</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setWizardInitialReport(null);
                  setWizardCloneMode(false);
                  setWizardOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>+ إنشاء تقرير جديد</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Table Container */}
        <div className="p-6 space-y-4">
          {toastBanner && (
            <div className="flex items-center justify-between rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[12px] font-bold text-[#065F46]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                <span>{toastBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastBanner(null)}
                className="text-[#047857] hover:text-[#065F46]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* High-Density Reports Table (`bg-white rounded-xl border border-[#E2E8F0]`) */}
          <div className="overflow-visible rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[12px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                    <th className="w-10 py-3 px-3 text-center">
                      <Star className="h-3.5 w-3.5 mx-auto text-[#94A3B8]" />
                    </th>
                    <th className="py-3 px-3">اسم التقرير والنوع</th>
                    <th className="py-3 px-3">الوصف التنفيذي</th>
                    <th className="py-3 px-3 whitespace-nowrap">المجلد</th>
                    <th className="py-3 px-3 min-w-[145px] whitespace-nowrap">آخر تشغيل</th>
                    <th className="py-3 px-3 whitespace-nowrap">المالك</th>
                    <th className="min-w-[115px] py-3 pl-4 pr-3 text-center whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {displayedReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <p className="text-[13px] font-extrabold text-[#0F172A]">
                          لا توجد تقارير مطابقة لمعايير البحث الحالية
                        </p>
                        <p className="mt-1 text-[12px] text-[#64748B]">
                          جرب تغيير كلمات البحث أو أنشئ تقريراً مخصصاً عبر المعالج.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayedReports.map((rpt) => {
                      const folderName =
                        folderMap.get(rpt.folderId)?.name ?? 'مجلد عام';
                      const isMenuOpen = openMenuReportId === rpt.id;

                      return (
                        <tr
                          key={rpt.id}
                          className="group hover:bg-[#F8FAFC] transition-colors"
                        >
                          {/* 1. Favorite Star */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleFav(rpt.id)}
                              aria-label="تبديل المفضلة"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  rpt.isFavorite
                                    ? 'fill-[#F59E0B] text-[#F59E0B]'
                                    : 'text-[#CBD5E1] hover:text-[#F59E0B]'
                                }`}
                              />
                            </button>
                          </td>

                          {/* 2. Report Name + Type Label */}
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => handleRunReport(rpt)}
                              className="text-right font-extrabold text-[#0F172A] hover:text-[#2563EB] transition-colors cursor-pointer block"
                            >
                              {rpt.name.includes('Unfollowed Leads > 7 Days') ? (
                                <>
                                  {rpt.name.replace('(Unfollowed Leads > 7 Days)', '')}
                                  (<bdi dir="ltr">Unfollowed Leads &gt; 7 Days</bdi>)
                                </>
                              ) : (
                                rpt.name
                              )}
                            </button>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                              <span className="font-bold text-[#2563EB]">
                                {REPORT_TYPE_LABELS[rpt.reportType]}
                              </span>
                              <span>·</span>
                              <span>الموديول: {rpt.primaryModule}</span>
                            </div>
                          </td>

                          {/* 3. Description */}
                          <td className="py-3 px-3 max-w-xs">
                            <p className="line-clamp-2 text-[11px] text-[#475569] leading-relaxed">
                              {rpt.description}
                            </p>
                          </td>

                          {/* 4. Folder Name */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-[11px] font-bold text-[#334155]">
                              {folderName}
                            </span>
                          </td>

                          {/* 5. Last Run Timestamp */}
                          <td className="py-3 px-3 min-w-[145px] whitespace-nowrap text-[11px] text-[#64748B] tabular-nums">
                            <span dir="ltr" className="inline-block">
                              {formatArabicDateTime(rpt.lastRunAt)}
                            </span>
                          </td>

                          {/* 6. Owner */}
                          <td className="py-3 px-3 whitespace-nowrap text-[11px] font-semibold text-[#334155]">
                            {rpt.createdBy}
                          </td>

                          {/* 7. Actions Dropdown (`⋮`) */}
                          <td className="py-3 pl-4 pr-3 min-w-[115px] text-center whitespace-nowrap relative">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleRunReport(rpt)}
                                title="تشغيل التقرير"
                                className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-extrabold text-[#2563EB] hover:bg-[#2563EB] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                              >
                                تشغيل
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuReportId(isMenuOpen ? null : rpt.id)
                                }
                                aria-label="قائمة إجراءات التقرير"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>

                            {isMenuOpen && (
                              <div className="absolute left-4 top-11 z-30 w-48 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 text-right shadow-xl space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuReportId(null);
                                    handleRunReport(rpt);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <Play className="h-3.5 w-3.5 text-[#2563EB]" />
                                  <span>تشغيل التقرير</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuReportId(null);
                                    setWizardInitialReport(rpt);
                                    setWizardCloneMode(false);
                                    setWizardOpen(true);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-[#475569]" />
                                  <span>تعديل التقرير</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuReportId(null);
                                    setWizardInitialReport(rpt);
                                    setWizardCloneMode(true);
                                    setWizardOpen(true);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5 text-[#475569]" />
                                  <span>استنساخ (Clone)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuReportId(null);
                                    if (onOpenScheduler) {
                                      onOpenScheduler(rpt);
                                    } else {
                                      showToast(
                                        `تم فتح إعدادات الجدولة الدورية للتقرير: "${rpt.name}"`
                                      );
                                    }
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <CalendarClock className="h-3.5 w-3.5 text-[#475569]" />
                                  <span>جدولة التقرير</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExportReportCsv(rpt)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <Download className="h-3.5 w-3.5 text-[#475569]" />
                                  <span>تصدير (CSV)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuReportId(null);
                                    setMoveFolderReport(rpt);
                                    setTargetMoveFolderId(rpt.folderId);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
                                >
                                  <FolderInput className="h-3.5 w-3.5 text-[#475569]" />
                                  <span>نقل لمجلد آخر</span>
                                </button>

                                {!rpt.isStandard && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReportInternal(rpt)}
                                    className="flex w-full items-center gap-2 rounded-lg border-t border-[#F1F5F9] px-3 py-2 text-[12px] font-extrabold text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>حذف التقرير</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Move Report to Folder Modal */}
      {moveFolderReport && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-[15px] font-extrabold text-[#0F172A]">
                نقل التقرير إلى مجلد آخر
              </h3>
              <button
                type="button"
                onClick={() => setMoveFolderReport(null)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] text-[#475569]">
                اختر المجلد الهدف لنقل التقرير:{' '}
                <span className="font-bold text-[#0F172A]">
                  {moveFolderReport.name}
                </span>
              </p>
              <select
                value={targetMoveFolderId}
                onChange={(e) => setTargetMoveFolderId(e.target.value)}
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-[12px] font-bold text-[#0F172A]"
              >
                {activeFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
              <button
                type="button"
                onClick={() => setMoveFolderReport(null)}
                className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#475569] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveFolder}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] cursor-pointer"
              >
                تأكيد النقل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Create / Edit / Share Modal */}
      <FolderModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        initialFolder={editingFolder}
        existingFoldersCount={activeFolders.length}
        onSave={handleSaveFolderInternal}
        onDelete={handleDeleteFolderInternal}
      />

      {/* 5-Step Report Builder Wizard */}
      <ReportWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialReport={wizardInitialReport}
        isCloneMode={wizardCloneMode}
        folders={activeFolders}
        defaultFolderId={
          selectedView.kind === 'folder'
            ? selectedView.folderId
            : 'folder_deals_pipeline'
        }
        security={security}
        onSaveReport={handleSaveWizardReport}
      />
    </div>
  );
};
