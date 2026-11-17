import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { Deal, DealStage } from '../types/crm';
import {
  computeDealPipelineMetrics,
  DEAL_OWNERS,
  DEFAULT_DEAL_DOCKED_FILTER,
  filterDeals,
  getBlueprintTransitionRequirements,
  getDealColumnForStage,
  hasActiveDealDockedFilter,
  resolveDealLastTouchAttribution,
  type BlueprintTransitionRequirement,
  type DealDockedFilterCriteria,
  type DealPipelineKey,
  type DealQuickFilterKey,
  type DealsViewMode,
} from '../utils/dealsLogic';
import { CreateDealModal } from '../components/deals/CreateDealModal';
import { BlueprintTransitionModal } from '../components/deals/BlueprintTransitionModal';
import { DealsBulkActionBar } from '../components/deals/DealsBulkActionBar';
import { DealsChartView } from '../components/deals/DealsChartView';
import { DealsDockedFilterPanel } from '../components/deals/DealsDockedFilterPanel';
import { DealsHeader } from '../components/deals/DealsHeader';
import { DealsKanbanView } from '../components/deals/DealsKanbanView';
import { DealsTableView } from '../components/deals/DealsTableView';

export const DealsPage: React.FC = () => {
  const {
    deals,
    contacts,
    touchpoints,
    blueprints,
    currentUser,
    activeProfile,
    canViewField,
    canEditField,
    updateDealFields,
    bulkUpdateDeals,
    softDeleteDeals,
  } = useCrm();

  const [pipeline, setPipeline] = useState<DealPipelineKey>('enterprise');
  const [viewMode, setViewMode] = useState<DealsViewMode>('kanban');
  const [quickFilter, setQuickFilter] = useState<DealQuickFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [dockedFilter, setDockedFilter] = useState<DealDockedFilterCriteria>(
    DEFAULT_DEAL_DOCKED_FILTER
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<DealStage>('تأهيل مبدئي');

  const [pendingBlueprint, setPendingBlueprint] = useState<{
    deal: Deal;
    requirement: BlueprintTransitionRequirement;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const canCreateDeal = activeProfile?.modulePermissions?.deals?.create ?? true;
  const canUpdateDeal = activeProfile?.modulePermissions?.deals?.update ?? true;
  const canDeleteDeal = activeProfile?.modulePermissions?.deals?.delete ?? true;
  const canViewAmount = canViewField('deals', 'amount');
  const canEditAmount = canEditField('deals', 'amount');

  const availableOwners = useMemo(() => {
    const set = new Set<string>(DEAL_OWNERS);
    for (const d of deals) {
      if (d.ownerName) set.add(d.ownerName);
    }
    return Array.from(set);
  }, [deals]);

  const availableAttributions = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      set.add(resolveDealLastTouchAttribution(d, contacts, touchpoints));
    }
    return Array.from(set);
  }, [contacts, deals, touchpoints]);

  const quickCounts = useMemo<Record<DealQuickFilterKey, number>>(() => {
    const base = {
      pipeline,
      currentUserName: currentUser.fullName,
      searchQuery: '',
      dockedFilter: DEFAULT_DEAL_DOCKED_FILTER,
    };
    return {
      all: filterDeals(deals, contacts, touchpoints, {
        ...base,
        quickFilter: 'all',
      }).length,
      my_deals: filterDeals(deals, contacts, touchpoints, {
        ...base,
        quickFilter: 'my_deals',
      }).length,
      closing_this_month: filterDeals(deals, contacts, touchpoints, {
        ...base,
        quickFilter: 'closing_this_month',
      }).length,
      overdue: filterDeals(deals, contacts, touchpoints, {
        ...base,
        quickFilter: 'overdue',
      }).length,
    };
  }, [contacts, currentUser.fullName, deals, pipeline, touchpoints]);

  const filteredDeals = useMemo(
    () =>
      filterDeals(deals, contacts, touchpoints, {
        pipeline,
        quickFilter,
        currentUserName: currentUser.fullName,
        searchQuery,
        dockedFilter,
      }),
    [contacts, currentUser.fullName, deals, dockedFilter, pipeline, quickFilter, searchQuery, touchpoints]
  );

  const metrics = useMemo(
    () => computeDealPipelineMetrics(filteredDeals),
    [filteredDeals]
  );

  const activeDockedFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count += 1;
    if (dockedFilter.stages.length > 0) count += 1;
    if (dockedFilter.ownerName !== 'all') count += 1;
    if (dockedFilter.attributionSource !== 'all') count += 1;
    if (dockedFilter.minAmount.trim() || dockedFilter.maxAmount.trim()) count += 1;
    return count;
  }, [dockedFilter, searchQuery]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateModalOpen(false);
        setPendingBlueprint(null);
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleToggleSelect = (dealId: string) => {
    setSelectedIds((prev) =>
      prev.includes(dealId)
        ? prev.filter((id) => id !== dealId)
        : [...prev, dealId]
    );
  };

  const handleToggleSelectAll = () => {
    const filteredIds = filteredDeals.map((d) => d.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : filteredIds);
  };

  const handleRequestStageChange = async (deal: Deal, targetStage: DealStage) => {
    if (!canUpdateDeal || deal.stage === targetStage) return;
    const req = getBlueprintTransitionRequirements(blueprints, targetStage);
    if (req.requiresModal) {
      setPendingBlueprint({ deal, requirement: req });
      return;
    }

    const col = getDealColumnForStage(targetStage);
    await updateDealFields(deal.id, {
      stage: targetStage,
      probability: col.defaultProbability,
    });
    setToastMsg(`تم نقل الصفقة "${deal.title}" إلى مرحلة ${col.title}`);
  };

  const handleConfirmBlueprintTransition = async (payload: {
    dealId: string;
    targetStage: DealStage;
    probability: number;
    amount: number;
    nextStep: string;
    closeDate: string;
    auditSummary: string;
  }) => {
    await updateDealFields(
      payload.dealId,
      {
        stage: payload.targetStage,
        probability: payload.probability,
        amount: payload.amount,
        nextStep: payload.nextStep,
        closeDate: payload.closeDate,
      },
      { summary: payload.auditSummary }
    );
    setToastMsg(`تم اعتماد انتقال Blueprint وحفظ المرحلة (${payload.targetStage})`);
  };

  const handleDeleteSingle = async (dealId: string) => {
    await softDeleteDeals([dealId]);
    setSelectedIds((prev) => prev.filter((id) => id !== dealId));
    setToastMsg('تم نقل الصفقة إلى سلة المحذوفات');
  };

  const handleExportDealsCsv = () => {
    const header = ['المعرف', 'عنوان الصفقة', 'الشركة', 'القيمة', 'المرحلة', 'الاحتمال', 'تاريخ الإغلاق', 'المسؤول'];
    const rows = filteredDeals.map((d) => [
      d.leadUniqueId || d.id,
      `"${d.title.replace(/"/g, '""')}"`,
      `"${d.accountName.replace(/"/g, '""')}"`,
      String(d.amount),
      d.stage,
      `${d.probability}%`,
      d.closeDate,
      `"${d.ownerName.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'riwaq-deals-export.csv';
    link.click();
    URL.revokeObjectURL(url);
    setToastMsg(`تم تصدير ${filteredDeals.length} صفقة بصيغة CSV بنجاح`);
  };

  return (
    <div className="space-y-4 pb-16">
      <DealsHeader
        pipeline={pipeline}
        onChangePipeline={(next) => {
          setPipeline(next);
          setSelectedIds([]);
        }}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        quickFilter={quickFilter}
        onChangeQuickFilter={setQuickFilter}
        quickCounts={quickCounts}
        metrics={metrics}
        filterPanelOpen={filterPanelOpen}
        activeDockedFilterCount={activeDockedFilterCount}
        onToggleFilterPanel={() => setFilterPanelOpen((prev) => !prev)}
        onOpenCreateDeal={() => {
          setCreateInitialStage('تأهيل مبدئي');
          setCreateModalOpen(true);
        }}
        onExportCsv={handleExportDealsCsv}
        canCreateDeal={canCreateDeal}
        canViewAmount={canViewAmount}
      />

      {filterPanelOpen && (
        <DealsDockedFilterPanel
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          criteria={dockedFilter}
          onChangeCriteria={setDockedFilter}
          availableOwners={availableOwners}
          availableAttributions={availableAttributions}
          onClose={() => setFilterPanelOpen(false)}
        />
      )}

      {!filterPanelOpen &&
        (hasActiveDealDockedFilter(dockedFilter) || searchQuery.trim().length > 0) && (
          <div className="flex items-center justify-between rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3.5 py-2 text-[12px]">
            <span className="font-semibold text-[#1D4ED8]">
              يتم عرض {filteredDeals.length} صفقة وفق الفلاتر المخصصة النشطة
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDockedFilter(DEFAULT_DEAL_DOCKED_FILTER);
              }}
              className="text-[11px] font-bold text-[#2563EB] hover:underline"
            >
              مسح جميع الفلاتر
            </button>
          </div>
        )}

      {viewMode === 'kanban' && (
        <DealsKanbanView
          deals={filteredDeals}
          contacts={contacts}
          touchpoints={touchpoints}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onRequestStageChange={handleRequestStageChange}
          onQuickAddInStage={(stage) => {
            setCreateInitialStage(stage);
            setCreateModalOpen(true);
          }}
          canUpdateDeal={canUpdateDeal}
          canCreateDeal={canCreateDeal}
          canViewAmount={canViewAmount}
        />
      )}

      {viewMode === 'table' && (
        <DealsTableView
          deals={filteredDeals}
          contacts={contacts}
          touchpoints={touchpoints}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onRequestStageChange={handleRequestStageChange}
          onDeleteDeal={handleDeleteSingle}
          canUpdateDeal={canUpdateDeal}
          canDeleteDeal={canDeleteDeal}
          canViewAmount={canViewAmount}
        />
      )}

      {viewMode === 'chart' && (
        <DealsChartView
          deals={filteredDeals}
          contacts={contacts}
          touchpoints={touchpoints}
          canViewAmount={canViewAmount}
        />
      )}

      <DealsBulkActionBar
        selectedCount={selectedIds.length}
        canUpdate={canUpdateDeal}
        canDelete={canDeleteDeal}
        onClearSelection={() => setSelectedIds([])}
        onBulkUpdateStage={async (stage, probability) => {
          await bulkUpdateDeals(selectedIds, { stage, probability });
          setToastMsg(`تم تحديث مرحلة ${selectedIds.length} صفقة`);
          setSelectedIds([]);
        }}
        onBulkAssignOwner={async (ownerName) => {
          await bulkUpdateDeals(selectedIds, { ownerName });
          setToastMsg(`تم إسناد ${selectedIds.length} صفقة إلى ${ownerName}`);
          setSelectedIds([]);
        }}
        onBulkDelete={async () => {
          const count = selectedIds.length;
          await softDeleteDeals(selectedIds);
          setSelectedIds([]);
          setToastMsg(`تم نقل ${count} صفقة إلى سلة المحذوفات`);
        }}
      />

      <CreateDealModal
        open={createModalOpen}
        initialStage={createInitialStage}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(deal) => {
          setToastMsg(`تمت إضافة الصفقة "${deal.title}" بنجاح`);
        }}
      />

      <BlueprintTransitionModal
        open={Boolean(pendingBlueprint)}
        deal={pendingBlueprint?.deal ?? null}
        requirement={pendingBlueprint?.requirement ?? null}
        canEditAmount={canEditAmount}
        onClose={() => setPendingBlueprint(null)}
        onConfirmTransition={handleConfirmBlueprintTransition}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#131b2e] text-[#ffffff] px-4 py-2.5 text-[12px] font-semibold shadow-xl border border-[#334155]"
        >
          <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="إغلاق التنبيه"
            className="text-[#94A3B8] hover:text-[#ffffff]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
