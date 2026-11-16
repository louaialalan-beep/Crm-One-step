import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { Contact, ContactStatus, LeadChannel } from '../types/crm';
import {
  computeContactsSummaryMetrics,
  DEFAULT_CONTACT_DOCKED_FILTER,
  exportContactsToCsv,
  filterContacts,
  findDuplicateContacts,
  hasActiveContactDockedFilter,
  sortContacts,
  type ContactChartGroupBy,
  type ContactDockedFilterCriteria,
  type ContactQuickFilterKey,
  type ContactSortKey,
} from '../utils/contactsLogic';
import { ContactsBulkActionBar } from '../components/contacts/ContactsBulkActionBar';
import { ContactsChartView } from '../components/contacts/ContactsChartView';
import { ContactsDockedFilterPanel } from '../components/contacts/ContactsDockedFilterPanel';
import {
  ContactsHeader,
  type ContactsViewMode,
} from '../components/contacts/ContactsHeader';
import { ContactsKanbanView } from '../components/contacts/ContactsKanbanView';
import { ContactsSplitView } from '../components/contacts/ContactsSplitView';
import { ContactsTableView } from '../components/contacts/ContactsTableView';
import { CreateContactDealModal } from '../components/contacts/CreateContactDealModal';
import { CreateContactModal } from '../components/contacts/CreateContactModal';
import { MergeDuplicateContactsDrawer } from '../components/contacts/MergeDuplicateContactsDrawer';

export const ContactsPage: React.FC = () => {
  const {
    contacts,
    deals,
    touchpoints,
    currentUser,
    activeProfile,
    openInboxForContact,
    updateContactFields,
    bulkUpdateContacts,
    bulkManageContactTags,
    bulkCreateTasksForContacts,
    softDeleteContacts,
    addContactTouchpoint,
  } = useCrm();

  const [viewMode, setViewMode] = useState<ContactsViewMode>('table');
  const [quickFilter, setQuickFilter] = useState<ContactQuickFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ContactSortKey>('recent');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [dockedFilter, setDockedFilter] = useState<ContactDockedFilterCriteria>(
    DEFAULT_CONTACT_DOCKED_FILTER
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitContactId, setSplitContactId] = useState<string>(contacts[0]?.id ?? '');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialTab, setCreateInitialTab] = useState<'manual' | 'csv'>('manual');
  const [dealModalContact, setDealModalContact] = useState<Contact | null>(null);
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false);
  const [mergeCandidateIds, setMergeCandidateIds] = useState<string[]>([]);
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    route?: string;
    routeLabel?: string;
  } | null>(null);

  const canCreateContact = activeProfile?.modulePermissions?.contacts?.create ?? true;
  const canUpdateContact = activeProfile?.modulePermissions?.contacts?.update ?? true;
  const canDeleteContact = activeProfile?.modulePermissions?.contacts?.delete ?? true;

  const duplicateResult = useMemo(() => findDuplicateContacts(contacts), [contacts]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const contact of contacts) {
      for (const t of contact.tags ?? []) {
        tagSet.add(t);
      }
    }
    return Array.from(tagSet);
  }, [contacts]);

  const quickCounts = useMemo<Record<ContactQuickFilterKey, number>>(() => {
    const baseOpts = {
      currentUserName: currentUser.fullName,
      searchQuery: '',
      dockedFilter: DEFAULT_CONTACT_DOCKED_FILTER,
      duplicateContactIds: duplicateResult.duplicateContactIds,
    };
    return {
      all: contacts.length,
      my_contacts: filterContacts(contacts, deals, {
        ...baseOpts,
        quickFilter: 'my_contacts',
      }).length,
      purchased: filterContacts(contacts, deals, {
        ...baseOpts,
        quickFilter: 'purchased',
      }).length,
      open_deals: filterContacts(contacts, deals, {
        ...baseOpts,
        quickFilter: 'open_deals',
      }).length,
      duplicates: filterContacts(contacts, deals, {
        ...baseOpts,
        quickFilter: 'duplicates',
      }).length,
    };
  }, [contacts, currentUser.fullName, deals, duplicateResult.duplicateContactIds]);

  const filteredContacts = useMemo(() => {
    const filtered = filterContacts(contacts, deals, {
      quickFilter,
      currentUserName: currentUser.fullName,
      searchQuery,
      dockedFilter,
      duplicateContactIds: duplicateResult.duplicateContactIds,
    });
    return sortContacts(filtered, deals, sortBy);
  }, [
    contacts,
    currentUser.fullName,
    deals,
    dockedFilter,
    duplicateResult.duplicateContactIds,
    quickFilter,
    searchQuery,
    sortBy,
  ]);

  const metrics = useMemo(
    () => computeContactsSummaryMetrics(filteredContacts, deals),
    [deals, filteredContacts]
  );

  const activeDockedCount = useMemo(() => {
    let count = 0;
    if (dockedFilter.channels.length > 0) count += 1;
    if (dockedFilter.statuses.length > 0) count += 1;
    if (dockedFilter.dealFilter !== 'all') count += 1;
    if (dockedFilter.tags.length > 0) count += 1;
    if (dockedFilter.ownerName !== 'all') count += 1;
    count += dockedFilter.rules.filter((r) => r.value.trim().length > 0).length;
    return count;
  }, [dockedFilter]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateModalOpen(false);
        setDealModalContact(null);
        setMergeDrawerOpen(false);
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const validIds = new Set(contacts.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [contacts]);

  useEffect(() => {
    if (filteredContacts.length > 0 && !filteredContacts.some((c) => c.id === splitContactId)) {
      setSplitContactId(filteredContacts[0].id);
    }
  }, [filteredContacts, splitContactId]);

  const showToast = (message: string, route?: string, routeLabel?: string) => {
    setToastInfo({ message, route, routeLabel });
    window.setTimeout(() => {
      setToastInfo((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (
      filteredContacts.length > 0 &&
      filteredContacts.every((c) => selectedIds.includes(c.id))
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map((c) => c.id));
    }
  };

  const toggleSelectStage = (contactIds: string[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of contactIds) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return Array.from(next);
    });
  };

  const handleExportCsv = () => {
    const targetContacts =
      selectedIds.length > 0
        ? filteredContacts.filter((c) => selectedIds.includes(c.id))
        : filteredContacts;
    const csv = exportContactsToCsv(targetContacts, deals);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwaq-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`تم تصدير ${targetContacts.length} جهة اتصال بصيغة CSV بنجاح.`);
  };

  const handleFindDuplicates = () => {
    if (duplicateResult.groups.length === 0) {
      showToast('لم يتم العثور على تكرارات جديدة في أرقام الجوال أو البريد.');
      return;
    }
    setMergeCandidateIds(duplicateResult.groups[0].contactIds);
    setMergeDrawerOpen(true);
  };

  const handleInspectDuplicate = (contactId: string) => {
    const group = duplicateResult.groups.find((g) => g.contactIds.includes(contactId));
    if (group) {
      setMergeCandidateIds(group.contactIds);
      setMergeDrawerOpen(true);
    } else {
      setQuickFilter('duplicates');
    }
  };

  const handleStatusChange = async (contactId: string, status: ContactStatus) => {
    await updateContactFields(contactId, { contactStatus: status });
    showToast(`تم تحديث حالة جهة الاتصال إلى «${status}».`);
  };

  const handleQuickCall = async (contact: Contact) => {
    await addContactTouchpoint(contact.id, {
      channel: 'مكالمة',
      summary: `اتصال هاتفي سريع بالرقم ${contact.phone ?? ''}`.trim(),
      eventType: 'مكالمة صادرة',
    });
    showToast(`تم تسجيل مكالمة مع ${contact.fullName} في سجل التفاعلات.`);
  };

  const handleOpenInTableViewFromChart = (params: {
    groupBy: ContactChartGroupBy;
    key: string;
    label: string;
  }) => {
    const nextFilter: ContactDockedFilterCriteria = { ...DEFAULT_CONTACT_DOCKED_FILTER };
    if (params.groupBy === 'contactStatus') {
      nextFilter.statuses = [params.key as ContactStatus];
    } else if (params.groupBy === 'channel') {
      nextFilter.channels = [params.key as LeadChannel];
    } else if (params.groupBy === 'assignedToName') {
      nextFilter.ownerName = params.key;
    } else if (params.groupBy === 'primarySource') {
      nextFilter.rules = [
        {
          id: 'chart_drill_source',
          field: 'primarySource',
          operator: 'equals',
          value: params.key,
        },
      ];
    } else if (params.groupBy === 'city') {
      nextFilter.rules = [
        {
          id: 'chart_drill_city',
          field: 'city',
          operator: 'contains',
          value: params.key,
        },
      ];
    } else if (params.groupBy === 'accountType') {
      setSearchQuery(params.key === 'b2c' ? 'عميل فردي B2C' : '');
    }

    setQuickFilter('all');
    setDockedFilter(nextFilter);
    setFilterPanelOpen(true);
    setViewMode('table');
    showToast(`تم تطبيق فلتر «${params.label}» في عرض الجدول.`);
  };

  return (
    <div className="space-y-4 pb-20">
      <ContactsHeader
        totalCount={contacts.length}
        filteredCount={filteredContacts.length}
        metrics={metrics}
        quickFilter={quickFilter}
        onChangeQuickFilter={setQuickFilter}
        quickCounts={quickCounts}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        activeDockedCount={activeDockedCount}
        onToggleFilterPanel={() => setFilterPanelOpen((prev) => !prev)}
        onOpenCreateContact={() => {
          setCreateInitialTab('manual');
          setCreateModalOpen(true);
        }}
        onOpenImportCsv={() => {
          setCreateInitialTab('csv');
          setCreateModalOpen(true);
        }}
        onExportCsv={handleExportCsv}
        onFindDuplicates={handleFindDuplicates}
        canCreateContact={canCreateContact}
      />

      {/* Toast Notification */}
      {toastInfo && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46] shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
            <span className="font-semibold">{toastInfo.message}</span>
            {toastInfo.route && (
              <Link to={toastInfo.route} className="font-bold text-[#004AC6] underline">
                {toastInfo.routeLabel ?? 'عرض التفاصيل'}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToastInfo(null)}
            className="text-[#065F46] hover:text-[#022C22]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Docked Inline Filter Panel */}
      <ContactsDockedFilterPanel
        open={filterPanelOpen}
        filter={dockedFilter}
        availableTags={availableTags}
        matchCount={filteredContacts.length}
        onChange={setDockedFilter}
        onClose={() => setFilterPanelOpen(false)}
      />

      {hasActiveContactDockedFilter(dockedFilter) && !filterPanelOpen && (
        <div className="flex items-center justify-between rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs text-[#1E40AF]">
          <span>تم تفعيل فلاتر متقدمة — السجلات المعروضة: {filteredContacts.length}</span>
          <button
            type="button"
            onClick={() => setDockedFilter(DEFAULT_CONTACT_DOCKED_FILTER)}
            className="font-bold text-[#2563EB] hover:underline"
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* 4-Way View Switcher Body */}
      {viewMode === 'table' && (
        <ContactsTableView
          contacts={filteredContacts}
          deals={deals}
          selectedIds={selectedIds}
          duplicateReasons={duplicateResult.reasonsByContactId}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          sortBy={sortBy}
          onChangeSortBy={setSortBy}
          activeDockedCount={activeDockedCount}
          onToggleFilterPanel={() => setFilterPanelOpen((prev) => !prev)}
          onExportCsv={handleExportCsv}
          canUpdateContact={canUpdateContact}
          canDeleteContact={canDeleteContact}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onChangeStatus={handleStatusChange}
          onQuickChat={(contactId) => openInboxForContact(contactId)}
          onOpenCreateDeal={(contact) => setDealModalContact(contact)}
          onOpenSplitView={(contactId) => {
            setSplitContactId(contactId);
            setViewMode('split');
          }}
          onSoftDeleteContact={async (contactId) => {
            await softDeleteContacts([contactId]);
            setSelectedIds((prev) => prev.filter((id) => id !== contactId));
            showToast('تم نقل جهة الاتصال إلى سلة المحذوفات.');
          }}
          onInspectDuplicate={handleInspectDuplicate}
        />
      )}

      {viewMode === 'kanban' && (
        <ContactsKanbanView
          contacts={filteredContacts}
          deals={deals}
          touchpoints={touchpoints}
          selectedIds={selectedIds}
          duplicateReasons={duplicateResult.reasonsByContactId}
          canUpdateContact={canUpdateContact}
          onToggleSelect={toggleSelect}
          onToggleSelectStage={toggleSelectStage}
          onChangeStatus={handleStatusChange}
          onOpenSplitView={(contactId) => {
            setSplitContactId(contactId);
            setViewMode('split');
          }}
          onQuickChat={(contactId) => openInboxForContact(contactId)}
          onQuickCall={handleQuickCall}
          onOpenCreateDeal={(contact) => setDealModalContact(contact)}
          onOpenCreateContact={() => {
            setCreateInitialTab('manual');
            setCreateModalOpen(true);
          }}
        />
      )}

      {viewMode === 'split' && (
        <ContactsSplitView
          contacts={filteredContacts}
          deals={deals}
          selectedContactId={splitContactId}
          onSelectContact={setSplitContactId}
          onOpenCreateDeal={(contact) => setDealModalContact(contact)}
          onNotify={(msg) => showToast(msg)}
        />
      )}

      {viewMode === 'chart' && (
        <ContactsChartView
          contacts={filteredContacts}
          deals={deals}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenSplitView={(contactId) => {
            setSplitContactId(contactId);
            setViewMode('split');
          }}
          onQuickChat={(contactId) => openInboxForContact(contactId)}
          onOpenCreateDeal={(contact) => setDealModalContact(contact)}
          onOpenInTableView={handleOpenInTableViewFromChart}
          onNotify={(msg) => showToast(msg)}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <ContactsBulkActionBar
        selectedCount={selectedIds.length}
        canUpdateContact={canUpdateContact}
        canDeleteContact={canDeleteContact}
        onClearSelection={() => setSelectedIds([])}
        onMassUpdate={async (patch) => {
          await bulkUpdateContacts(selectedIds, patch);
          showToast(`تم تحديث ${selectedIds.length} جهة اتصال دفعة واحدة.`);
        }}
        onBulkTag={async (mode, tag) => {
          await bulkManageContactTags(selectedIds, mode, tag);
          showToast(`تم ${mode === 'add' ? 'إضافة' : 'إزالة'} الوسم «${tag}» للسجلات المحددة.`);
        }}
        onBulkCreateTask={async (input) => {
          await bulkCreateTasksForContacts(selectedIds, input);
          showToast(`تم إنشاء ${selectedIds.length} مهمة متابعة مرتبطة.`, '/tasks', 'عرض المهام');
        }}
        onOpenMergeDuplicates={() => {
          setMergeCandidateIds(selectedIds);
          setMergeDrawerOpen(true);
        }}
        onSoftDeleteSelected={async () => {
          const count = selectedIds.length;
          await softDeleteContacts(selectedIds);
          setSelectedIds([]);
          showToast(`تم نقل ${count} جهة اتصال إلى سلة المحذوفات.`);
        }}
      />

      {/* Modals & Drawers */}
      <CreateContactModal
        open={createModalOpen}
        initialTab={createInitialTab}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(contactId) => {
          if (contactId) setSplitContactId(contactId);
          showToast('تم حفظ جهة الاتصال بنجاح في قاعدة العملاء.');
        }}
        onInspectExisting={(contactId) => {
          setCreateModalOpen(false);
          setSplitContactId(contactId);
          setViewMode('split');
        }}
      />

      <CreateContactDealModal
        open={Boolean(dealModalContact)}
        contact={dealModalContact}
        onClose={() => setDealModalContact(null)}
        onCreated={(dealTitle) => {
          showToast(`تم إنشاء الصفقة «${dealTitle}» وربطها بجهة الاتصال.`, '/deals', 'فتح الصفقات');
        }}
      />

      <MergeDuplicateContactsDrawer
        open={mergeDrawerOpen}
        initialContactIds={mergeCandidateIds}
        onClose={() => setMergeDrawerOpen(false)}
        onMerged={(masterId) => {
          setSelectedIds([]);
          setSplitContactId(masterId);
          showToast('تم دمج التكرارات ونقل الصفقات وسجل التواصل إلى السجل الأساسي.');
        }}
      />
    </div>
  );
};
