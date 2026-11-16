import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { Lead, LeadChannel, LeadStatus } from '../types/crm';
import {
  computeVelocityMetrics,
  DEFAULT_DOCKED_FILTER,
  exportLeadsToCsv,
  filterLeads,
  findDuplicateLeads,
  hasActiveDockedFilter,
  type DockedFilterCriteria,
  type QuickFilterKey,
} from '../utils/leadsLogic';
import { BulkActionBar } from '../components/leads/BulkActionBar';
import { ConvertLeadModal } from '../components/leads/ConvertLeadModal';
import { CreateLeadModal } from '../components/leads/CreateLeadModal';
import { DockedFilterPanel } from '../components/leads/DockedFilterPanel';
import {
  LeadsHeader,
  type LeadsViewMode,
  type LeadTableColumnKey,
} from '../components/leads/LeadsHeader';
import { LeadsChartView } from '../components/leads/LeadsChartView';
import { LeadsKanbanView } from '../components/leads/LeadsKanbanView';
import { LeadsSplitView } from '../components/leads/LeadsSplitView';
import { LeadsTableView } from '../components/leads/LeadsTableView';
import { MergeDuplicatesDrawer } from '../components/leads/MergeDuplicatesDrawer';

const DEFAULT_VISIBLE_COLUMNS: LeadTableColumnKey[] = [
  'unique_id',
  'channel',
  'phone',
  'source',
  'status',
  'lastActivity',
];

export const LeadsPage: React.FC = () => {
  const {
    leads,
    touchpoints,
    currentUser,
    activeProfile,
    openInboxForLead,
    updateLeadFields,
    bulkUpdateLeads,
    bulkManageTags,
    bulkCreateTasksForLeads,
    softDeleteLeads,
    addLeadTouchpoint,
  } = useCrm();

  const [viewMode, setViewMode] = useState<LeadsViewMode>('table');
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [dockedFilter, setDockedFilter] = useState<DockedFilterCriteria>(DEFAULT_DOCKED_FILTER);
  const [visibleColumns, setVisibleColumns] = useState<LeadTableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitLeadId, setSplitLeadId] = useState<string>(leads[0]?.id ?? '');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialTab, setCreateInitialTab] = useState<'manual' | 'csv'>('manual');
  const [convertTargetLead, setConvertTargetLead] = useState<Lead | null>(null);
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false);
  const [mergeCandidateIds, setMergeCandidateIds] = useState<string[]>([]);
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    route?: string;
    routeLabel?: string;
  } | null>(null);

  const canCreateLead = activeProfile?.modulePermissions?.leads?.create ?? true;
  const canUpdateLead = activeProfile?.modulePermissions?.leads?.update ?? true;
  const canDeleteLead = activeProfile?.modulePermissions?.leads?.delete ?? true;

  const duplicateResult = useMemo(() => findDuplicateLeads(leads), [leads]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const lead of leads) {
      for (const t of lead.tags ?? []) {
        tagSet.add(t);
      }
    }
    return Array.from(tagSet);
  }, [leads]);

  const quickCounts = useMemo<Record<QuickFilterKey, number>>(() => {
    const baseOpts = {
      currentUserName: currentUser.fullName,
      searchQuery: '',
      dockedFilter: DEFAULT_DOCKED_FILTER,
      duplicateLeadIds: duplicateResult.duplicateLeadIds,
    };
    return {
      all: leads.length,
      my_leads: filterLeads(leads, { ...baseOpts, quickFilter: 'my_leads' }).length,
      unanswered: filterLeads(leads, { ...baseOpts, quickFilter: 'unanswered' }).length,
      hot: filterLeads(leads, { ...baseOpts, quickFilter: 'hot' }).length,
      duplicates: filterLeads(leads, { ...baseOpts, quickFilter: 'duplicates' }).length,
    };
  }, [currentUser.fullName, duplicateResult.duplicateLeadIds, leads]);

  const filteredLeads = useMemo(
    () =>
      filterLeads(leads, {
        quickFilter,
        currentUserName: currentUser.fullName,
        searchQuery,
        dockedFilter,
        duplicateLeadIds: duplicateResult.duplicateLeadIds,
      }),
    [
      currentUser.fullName,
      dockedFilter,
      duplicateResult.duplicateLeadIds,
      leads,
      quickFilter,
      searchQuery,
    ]
  );

  const metrics = useMemo(() => computeVelocityMetrics(filteredLeads), [filteredLeads]);

  const activeDockedCount = useMemo(() => {
    let count = 0;
    if (dockedFilter.channels.length > 0) count += 1;
    if (dockedFilter.slaOnly) count += 1;
    if (dockedFilter.stages.length > 0) count += 1;
    if (dockedFilter.tags.length > 0) count += 1;
    if (dockedFilter.ownerName !== 'all') count += 1;
    count += dockedFilter.rules.filter((r) => r.value.trim().length > 0).length;
    return count;
  }, [dockedFilter]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateModalOpen(false);
        setConvertTargetLead(null);
        setMergeDrawerOpen(false);
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Keep splitLeadId synced if current disappears
  useEffect(() => {
    if (filteredLeads.length > 0 && !filteredLeads.some((l) => l.id === splitLeadId)) {
      setSplitLeadId(filteredLeads[0].id);
    }
  }, [filteredLeads, splitLeadId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredLeads.map((l) => l.id);
    const allChecked =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allChecked) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleColumn = (col: LeadTableColumnKey) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleExportCsv = () => {
    const csv = exportLeadsToCsv(filteredLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'riwaq-leads-export.csv';
    link.click();
    URL.revokeObjectURL(url);
    setToastInfo({
      message: `تم تصدير ${filteredLeads.length} سجل عميل محتمل بصيغة CSV بنجاح.`,
    });
  };

  const handleOpenSplitForLead = (leadId: string) => {
    setSplitLeadId(leadId);
    setViewMode('split');
  };

  const handleFindDuplicates = () => {
    setQuickFilter('duplicates');
    if (duplicateResult.groups.length > 0) {
      setMergeCandidateIds(duplicateResult.groups[0].leadIds);
      setMergeDrawerOpen(true);
    } else {
      setToastInfo({ message: 'لا توجد سجلات مكررة في القائمة الحالية.' });
    }
  };

  const handleInspectDuplicate = (leadId: string) => {
    const matchingGroup = duplicateResult.groups.find((g) => g.leadIds.includes(leadId));
    if (matchingGroup) {
      setMergeCandidateIds(matchingGroup.leadIds);
      setMergeDrawerOpen(true);
    }
  };

  const handleChangeStage = (leadId: string, status: LeadStatus) => {
    void updateLeadFields(leadId, { status });
  };

  if (createModalOpen && createInitialTab === 'manual') {
    return (
      <CreateLeadModal
        open={createModalOpen}
        initialTab="manual"
        onClose={() => setCreateModalOpen(false)}
        onCreated={(leadId) => {
          setSplitLeadId(leadId);
          setToastInfo({
            message: 'تمت إضافة العميل المحتمل الجديد وتوثيق نقطة الدخول الأولى بنجاح.',
          });
        }}
        onInspectExisting={(existingId) => {
          setCreateModalOpen(false);
          handleOpenSplitForLead(existingId);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Inline Notification Banner */}
      {toastInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-[13px] text-[#065F46]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
            <span className="font-medium">{toastInfo.message}</span>
            {toastInfo.route && (
              <Link
                to={toastInfo.route}
                className="font-bold text-[#2563EB] hover:underline mr-2"
              >
                {toastInfo.routeLabel}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToastInfo(null)}
            aria-label="إغلاق التنبيه"
            className="text-[#059669] hover:text-[#065F46]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Shared 2-Row Flush Header & 4-Way View Switcher */}
      <LeadsHeader
        totalCount={leads.length}
        filteredCount={filteredLeads.length}
        metrics={metrics}
        quickFilter={quickFilter}
        onChangeQuickFilter={setQuickFilter}
        quickCounts={quickCounts}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        filterPanelOpen={filterPanelOpen}
        activeDockedCount={activeDockedCount}
        onToggleFilterPanel={() => setFilterPanelOpen((prev) => !prev)}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onOpenCreateLead={() => {
          setCreateInitialTab('manual');
          setCreateModalOpen(true);
        }}
        onOpenImportCsv={() => {
          setCreateInitialTab('csv');
          setCreateModalOpen(true);
        }}
        onExportCsv={handleExportCsv}
        onFindDuplicates={handleFindDuplicates}
        canCreateLead={canCreateLead}
      />

      {/* Inline Docked Filter Panel (NOT a modal) */}
      <DockedFilterPanel
        open={filterPanelOpen}
        filter={dockedFilter}
        availableTags={availableTags}
        matchCount={filteredLeads.length}
        onChange={setDockedFilter}
        onClose={() => setFilterPanelOpen(false)}
      />

      {/* Active Filter Summary Strip if docked filter applied while collapsed */}
      {!filterPanelOpen && hasActiveDockedFilter(dockedFilter) && (
        <div className="flex items-center justify-between rounded-md border border-[#BFDBFE] bg-[#EFF6FF]/70 px-3.5 py-2 text-[12px] text-[#1E40AF]">
          <span>
            تم تفعيل {activeDockedCount} فلاتر مخصصة — يعرض {filteredLeads.length} من أصل{' '}
            {leads.length} عميل محتمل.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterPanelOpen(true)}
              className="font-semibold hover:underline"
            >
              تعديل الفلاتر
            </button>
            <button
              type="button"
              onClick={() => setDockedFilter(DEFAULT_DOCKED_FILTER)}
              className="font-semibold text-[#E11D48] hover:underline"
            >
              مسح الكل
            </button>
          </div>
        </div>
      )}

      {/* Active View Body */}
      {viewMode === 'table' && (
        <LeadsTableView
          leads={filteredLeads}
          selectedIds={selectedIds}
          visibleColumns={visibleColumns}
          duplicateReasons={duplicateResult.reasonsByLeadId}
          canUpdateLead={canUpdateLead}
          canDeleteLead={canDeleteLead}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onOpenSplitView={handleOpenSplitForLead}
          onChangeStage={handleChangeStage}
          onQuickChat={(leadId) => openInboxForLead(leadId)}
          onConvertLead={(lead) => setConvertTargetLead(lead)}
          onSoftDeleteLead={(leadId) => {
            void softDeleteLeads([leadId]);
            setSelectedIds((prev) => prev.filter((id) => id !== leadId));
            setToastInfo({
              message: 'تم نقل السجل إلى سلة المحذوفات بنجاح.',
              route: '/settings/recycle-bin',
              routeLabel: 'عرض سلة المحذوفات',
            });
          }}
          onInspectDuplicate={handleInspectDuplicate}
        />
      )}

      {viewMode === 'kanban' && (
        <LeadsKanbanView
          leads={filteredLeads}
          touchpoints={touchpoints}
          selectedIds={selectedIds}
          duplicateReasons={duplicateResult.reasonsByLeadId}
          canUpdateLead={canUpdateLead}
          onToggleSelect={toggleSelect}
          onToggleSelectStage={(stageLeadIds, select) => {
            setSelectedIds((prev) =>
              select
                ? Array.from(new Set([...prev, ...stageLeadIds]))
                : prev.filter((id) => !stageLeadIds.includes(id))
            );
          }}
          onChangeStage={handleChangeStage}
          onOpenSplitView={handleOpenSplitForLead}
          onQuickChat={(leadId) => openInboxForLead(leadId)}
          onQuickCall={(lead) => {
            void addLeadTouchpoint(lead.id, {
              channel: 'مكالمة',
              summary: `اتصال هاتفي صادر (${lead.phone || lead.unique_id})`,
              eventType: 'مكالمة صادرة',
            });
            setToastInfo({
              message: `تم توثيق اتصال هاتفي مع ${lead.fullName} (${lead.phone || lead.unique_id}).`,
            });
          }}
          onOpenCreateLead={
            canCreateLead
              ? () => {
                  setCreateInitialTab('manual');
                  setCreateModalOpen(true);
                }
              : undefined
          }
          onConvertLead={(lead) => setConvertTargetLead(lead)}
        />
      )}

      {viewMode === 'split' && (
        <LeadsSplitView
          leads={filteredLeads}
          selectedLeadId={splitLeadId}
          onSelectLead={setSplitLeadId}
          onOpenConvertLead={(lead) => setConvertTargetLead(lead)}
          onNotify={(message) => setToastInfo({ message })}
        />
      )}

      {viewMode === 'chart' && (
        <LeadsChartView
          leads={filteredLeads}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectMany={(ids, select) => {
            setSelectedIds((prev) =>
              select
                ? Array.from(new Set([...prev, ...ids]))
                : prev.filter((id) => !ids.includes(id))
            );
          }}
          onOpenSplitView={handleOpenSplitForLead}
          onQuickChat={(leadId) => openInboxForLead(leadId)}
          onConvertLead={(lead) => setConvertTargetLead(lead)}
          onOpenInTableView={({ groupBy, key, label }) => {
            setQuickFilter('all');
            setSearchQuery('');
            if (groupBy === 'status') {
              setDockedFilter({
                ...DEFAULT_DOCKED_FILTER,
                stages: [key as LeadStatus],
              });
            } else if (groupBy === 'channel') {
              setDockedFilter({
                ...DEFAULT_DOCKED_FILTER,
                channels: [key as LeadChannel],
              });
            } else if (groupBy === 'assignedToName') {
              setDockedFilter({
                ...DEFAULT_DOCKED_FILTER,
                ownerName: key,
              });
            } else if (groupBy === 'city' || groupBy === 'source') {
              setDockedFilter({
                ...DEFAULT_DOCKED_FILTER,
                rules: [
                  {
                    id: `chart_${groupBy}_${Date.now()}`,
                    field: groupBy,
                    operator: 'contains',
                    value: label === 'غير محدد' ? '' : label,
                  },
                ],
              });
            }
            setViewMode('table');
            setToastInfo({
              message: `تم عرض السجلات المطابقة لـ «${label}» في عرض الجدول المخصص.`,
            });
          }}
          onNotify={(message) => setToastInfo({ message })}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        canUpdateLead={canUpdateLead}
        canDeleteLead={canDeleteLead}
        onClearSelection={() => setSelectedIds([])}
        onMassUpdate={async (patch) => {
          await bulkUpdateLeads(selectedIds, patch);
          setToastInfo({ message: `تم تحديث ${selectedIds.length} سجل بنجاح.` });
        }}
        onBulkTag={async (mode, tag) => {
          await bulkManageTags(selectedIds, mode, tag);
          setToastInfo({
            message:
              mode === 'add'
                ? `تمت إضافة الوسم #${tag} إلى ${selectedIds.length} سجل.`
                : `تمت إزالة الوسم #${tag} من ${selectedIds.length} سجل.`,
          });
        }}
        onBulkCreateTask={async (input) => {
          await bulkCreateTasksForLeads(selectedIds, input);
          setToastInfo({
            message: `تم إنشاء ${selectedIds.length} مهمة متابعة مرتبطة بالعملاء المحددين.`,
            route: '/tasks',
            routeLabel: 'عرض المهام',
          });
        }}
        onOpenMergeDuplicates={() => {
          setMergeCandidateIds(selectedIds);
          setMergeDrawerOpen(true);
        }}
        onSoftDeleteSelected={async () => {
          const count = selectedIds.length;
          await softDeleteLeads(selectedIds);
          setSelectedIds([]);
          setToastInfo({
            message: `تم نقل ${count} سجل إلى سلة المحذوفات.`,
            route: '/settings/recycle-bin',
            routeLabel: 'عرض سلة المحذوفات',
          });
        }}
      />

      {/* Side-by-Side Merge Duplicates Drawer */}
      <MergeDuplicatesDrawer
        open={mergeDrawerOpen}
        initialLeadIds={mergeCandidateIds}
        onClose={() => setMergeDrawerOpen(false)}
        onMerged={(masterId) => {
          setSelectedIds([]);
          setSplitLeadId(masterId);
          setToastInfo({
            message: 'تم دمج السجلات المكررة وترحيل نقاط التماس والمحادثات إلى السجل الرئيسي.',
          });
        }}
      />

      {/* Create Lead & CSV Import Modal */}
      <CreateLeadModal
        open={createModalOpen}
        initialTab={createInitialTab}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(leadId) => {
          setSplitLeadId(leadId);
          setToastInfo({ message: 'تمت إضافة العميل المحتمل الجديد بنجاح.' });
        }}
        onInspectExisting={(existingId) => handleOpenSplitForLead(existingId)}
      />

      {/* True Zoho Convert Lead Modal */}
      <ConvertLeadModal
        lead={convertTargetLead}
        onClose={() => setConvertTargetLead(null)}
        onConverted={({ lead, dealId }) => {
          setToastInfo({
            message: dealId
              ? `تم تحويل العميل (${lead.unique_id}) إلى جهة اتصال وحساب وصفقة جديدة مع الحفاظ على نقاط التماس.`
              : `تم تحويل العميل (${lead.unique_id}) إلى جهة اتصال مع الحفاظ على نقاط التماس.`,
            route: dealId ? '/deals' : '/contacts',
            routeLabel: dealId ? 'الانتقال للصفقات' : 'عرض جهات الاتصال',
          });
        }}
      />
    </div>
  );
};
