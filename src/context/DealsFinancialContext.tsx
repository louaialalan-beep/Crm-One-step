import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CrmTask,
  Deal,
  DealStage,
  Invoice,
  Quote,
  RecycleBinItem,
  SalesOrder,
  Touchpoint,
  TouchpointChannel,
} from '../types/crm';
import { PREVIEW_OWNER_ID, stripUndefined, useAuth } from './AuthContext';
import { useSetup } from './SetupContext';

export interface QuickDealPayload {
  title: string;
  accountId: string;
  amount: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  nextStep?: string;
}

export interface CreateContactDealInput {
  contactId: string;
  title: string;
  amount: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  ownerName?: string;
  nextStep?: string;
}

export interface CreateDealInput {
  title: string;
  accountId: string;
  accountName?: string;
  contactId?: string;
  amount: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  ownerName?: string;
  nextStep?: string;
  attributionSource?: string;
}

export interface StageHistoryEntry {
  id: string;
  dealId: string;
  dealTitle: string;
  fromStage: string;
  toStage: string;
  dwellDays: number;
  changedBy: string;
  changedAt: string;
  org_id?: string;
}

export interface OrderAttributionEntry {
  id: string;
  leadUniqueId: string;
  customerName: string;
  orderIndex: number;
  orderSequenceLabel: string;
  campaignName: string;
  channel: string;
  orderAmountSAR: number;
  roasMultiplier: number;
  orderedAt: string;
  org_id?: string;
}

export interface DealsFinancialContextValue {
  deals: Deal[];
  quotes: Quote[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  stageHistory: StageHistoryEntry[];
  orderAttributions: OrderAttributionEntry[];

  createQuickDeal: (payload: QuickDealPayload) => Promise<void>;
  createDealForContact: (input: CreateContactDealInput) => Promise<Deal>;
  createDeal: (input: CreateDealInput) => Promise<Deal>;
  updateDealFields: (
    dealId: string,
    patch: Partial<Deal>,
    blueprintAudit?: { summary: string }
  ) => Promise<void>;
  bulkUpdateDeals: (dealIds: string[], patch: Partial<Deal>) => Promise<void>;
  softDeleteDeals: (dealIds: string[]) => Promise<void>;
  addDealTouchpoint: (
    dealId: string,
    input: {
      channel: TouchpointChannel;
      summary: string;
      eventType?: string;
      campaign?: string;
    }
  ) => Promise<void>;
  addDealTask: (
    dealId: string,
    input: {
      title: string;
      priority: CrmTask['priority'];
      dueDate: string;
      assignedToName?: string;
    }
  ) => Promise<void>;
}

const DealsFinancialContext = createContext<DealsFinancialContextValue | null>(null);

export function DealsFinancialProvider({ children }: { children: React.ReactNode }) {
  const {
    firebaseUser,
    currentUser,
    currentOrgId,
    belongsToCurrentOrg,
    data,
    setData,
    setSignals,
  } = useAuth();
  const { canViewRecord } = useSetup();

  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([
    {
      id: 'sh_init_1',
      dealId: 'deal_1',
      dealTitle: 'ترخيص منظومة رواق CRM Enterprise',
      fromStage: 'تأهيل مبدئي',
      toStage: 'عرض سعر',
      dwellDays: 4,
      changedBy: 'سلمان عبد العزيز القحطاني',
      changedAt: '2026-11-10T10:00:00Z',
    },
    {
      id: 'sh_init_2',
      dealId: 'deal_1',
      dealTitle: 'ترخيص منظومة رواق CRM Enterprise',
      fromStage: 'عرض سعر',
      toStage: 'تفاوض',
      dwellDays: 6,
      changedBy: 'سلمان عبد العزيز القحطاني',
      changedAt: '2026-11-16T14:30:00Z',
    },
  ]);

  const [orderAttributions] = useState<OrderAttributionEntry[]>([
    {
      id: 'oa_init_1',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية',
      orderIndex: 1,
      orderSequenceLabel: 'الطلب 1 (استحواذ أولي)',
      campaignName: 'حملة التحول الرقمي لكبار العملاء Q4',
      channel: 'إعلانات ميتا (Meta Lead Ads)',
      orderAmountSAR: 65000,
      roasMultiplier: 6.8,
      orderedAt: '2026-06-14',
    },
    {
      id: 'oa_init_10',
      leadUniqueId: 'RWQ-10482',
      customerName: 'م. بدر المنصور — شركة قمة التقنية',
      orderIndex: 10,
      orderSequenceLabel: 'الطلب +10 (شريك استراتيجي VIP)',
      campaignName: 'حملة إعادة استهداف العملاء VIP عبر واتساب',
      channel: 'واتساب للأعمال (WhatsApp Broadcast)',
      orderAmountSAR: 274200,
      roasMultiplier: 16.4,
      orderedAt: '2026-11-16',
    },
  ]);

  const createQuickDeal = useCallback(
    async (payload: QuickDealPayload) => {
      const account = data.accounts.find((a) => a.id === payload.accountId);
      const accountName = account ? account.name : 'حساب مؤسسة';
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const newId = `deal_${Date.now()}`;

      const newDeal: Deal = {
        id: newId,
        ownerId,
        org_id: currentOrgId,
        title: payload.title.trim(),
        accountId: payload.accountId,
        accountName,
        amount: payload.amount,
        currency: 'SAR',
        stage: payload.stage,
        probability: payload.probability,
        closeDate: payload.closeDate,
        ownerName: currentUser.fullName,
        nextStep: payload.nextStep?.trim() || 'مراجعة العرض المبدئي',
      };

      setSignals((prev) => [
        {
          id: `sig_${Date.now()}`,
          title: `تم إنشاء صفقة جديدة: ${newDeal.title}`,
          description: `${newDeal.accountName} · ${newDeal.amount.toLocaleString('en-US')} ر.س`,
          category: 'deal',
          timeLabel: 'الآن',
          unread: true,
          route: '/deals',
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: [newDeal, ...prev.deals],
        }));
        return;
      }

      try {
        const { id: _id, ...firestorePayload } = newDeal;
        await setDoc(doc(db, 'deals', newId), {
          ...stripUndefined(firestorePayload),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `deals/${newId}`);
      }
    },
    [currentOrgId, currentUser.fullName, data.accounts, firebaseUser, setData, setSignals]
  );

  const createDealForContact = useCallback(
    async (input: CreateContactDealInput): Promise<Deal> => {
      const contact = data.contacts.find((c) => c.id === input.contactId);
      if (!contact) {
        throw new Error('لم يتم العثور على جهة الاتصال');
      }
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const ts = Date.now();
      const dealId = `deal_con_${ts}`;
      const newDeal: Deal = {
        id: dealId,
        ownerId,
        org_id: currentOrgId,
        title: input.title.trim(),
        accountId: contact.accountId || 'unassigned',
        accountName: contact.accountName || 'عميل فردي B2C',
        amount: input.amount,
        currency: 'SAR',
        stage: input.stage,
        probability: input.probability,
        closeDate: input.closeDate,
        ownerName: input.ownerName?.trim() || contact.assignedToName || currentUser.fullName,
        nextStep: input.nextStep?.trim() || `متابعة الصفقة مع ${contact.fullName}`,
        contactId: contact.id,
        leadUniqueId: contact.leadUniqueId,
      };

      setSignals((prev) => [
        {
          id: `sig_con_deal_${ts}`,
          title: `تم إنشاء صفقة جديدة لجهة الاتصال: ${contact.fullName}`,
          description: `${newDeal.title} · ${newDeal.amount.toLocaleString('en-US')} ر.س`,
          category: 'deal',
          timeLabel: 'الآن',
          unread: true,
          route: '/deals',
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: [newDeal, ...prev.deals],
          contacts: prev.contacts.map((c) =>
            c.id === contact.id ? { ...c, lastActivityLabel: 'الآن' } : c
          ),
        }));
        return newDeal;
      }

      try {
        const batch = writeBatch(db);
        const { id: _dId, ...dRest } = newDeal;
        batch.set(doc(db, 'deals', dealId), {
          ...stripUndefined(dRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'contacts', contact.id), {
          lastActivityLabel: 'الآن',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `deals/${dealId}`);
      }

      return newDeal;
    },
    [currentOrgId, currentUser.fullName, data.contacts, firebaseUser, setData, setSignals]
  );

  const createDeal = useCallback(
    async (input: CreateDealInput): Promise<Deal> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const ts = Date.now();
      const dealId = `deal_${ts}`;
      const account = data.accounts.find((a) => a.id === input.accountId);
      const contact = input.contactId
        ? data.contacts.find((c) => c.id === input.contactId)
        : data.contacts.find((c) => c.accountId === input.accountId && c.isPrimary);

      const newDeal: Deal = {
        id: dealId,
        ownerId,
        org_id: currentOrgId,
        title: input.title.trim(),
        accountId: account?.id || input.accountId || 'unassigned',
        accountName:
          account?.name || input.accountName?.trim() || contact?.accountName || 'عميل فردي B2C',
        amount: input.amount,
        currency: 'SAR',
        stage: input.stage,
        probability: input.probability,
        closeDate: input.closeDate,
        ownerName: input.ownerName?.trim() || currentUser.fullName,
        nextStep: input.nextStep?.trim() || 'مراجعة نطاق العمل والعرض الفني',
        contactId: contact?.id,
        leadUniqueId: contact?.leadUniqueId,
      };

      const tpId = `tp_deal_init_${ts}`;
      const attributionCampaign = input.attributionSource?.trim();
      const newTp: Touchpoint | null = attributionCampaign
        ? {
            id: tpId,
            ownerId,
            org_id: currentOrgId,
            channel: 'حدث',
            summary: `تسجيل فرصة بيع جديدة (${newDeal.title})`,
            relatedEntityType: 'deal',
            relatedEntityId: dealId,
            relatedEntityName: newDeal.accountName.slice(0, 140),
            occurredAt: 'الآن',
            leadUniqueId: newDeal.leadUniqueId,
            campaign: attributionCampaign.slice(0, 120),
            eventType: 'إنشاء صفقة جديدة',
          }
        : null;

      setSignals((prev) => [
        {
          id: `sig_deal_new_${ts}`,
          title: `تمت إضافة صفقة جديدة: ${newDeal.title}`,
          description: `${newDeal.accountName} · ${newDeal.amount.toLocaleString('en-US')} ر.س`,
          category: 'deal',
          timeLabel: 'الآن',
          unread: true,
          route: `/deals/${dealId}`,
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: [newDeal, ...prev.deals],
          touchpoints: newTp ? [newTp, ...prev.touchpoints] : prev.touchpoints,
        }));
        return newDeal;
      }

      try {
        const batch = writeBatch(db);
        const { id: _dId, ...dRest } = newDeal;
        batch.set(doc(db, 'deals', dealId), {
          ...stripUndefined(dRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (newTp) {
          const { id: _tpId, ...tpRest } = newTp;
          batch.set(doc(db, 'touchpoints', tpId), {
            ...stripUndefined(tpRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `deals/${dealId}`);
      }

      return newDeal;
    },
    [
      currentOrgId,
      currentUser.fullName,
      data.accounts,
      data.contacts,
      firebaseUser,
      setData,
      setSignals,
    ]
  );

  const updateDealFields = useCallback(
    async (
      dealId: string,
      patch: Partial<Deal>,
      blueprintAudit?: { summary: string }
    ) => {
      const target = data.deals.find((d) => d.id === dealId);
      if (!target) return;

      const safePatch = stripUndefined(patch);
      const ts = Date.now();
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const tpId = `tp_bp_${ts}`;

      const auditTp: Touchpoint | null = blueprintAudit?.summary
        ? {
            id: tpId,
            ownerId,
            org_id: currentOrgId,
            channel: 'حدث',
            summary: blueprintAudit.summary.slice(0, 290),
            relatedEntityType: 'deal',
            relatedEntityId: dealId,
            relatedEntityName: (target.accountName || target.title).slice(0, 140),
            occurredAt: 'الآن',
            leadUniqueId: target.leadUniqueId,
            eventType: 'انتقال مرحلة Blueprint',
          }
        : null;

      if (patch.stage && patch.stage !== target.stage) {
        setStageHistory((prev) => [
          {
            id: `sh_${ts}`,
            dealId,
            dealTitle: target.title,
            fromStage: target.stage,
            toStage: patch.stage!,
            dwellDays: 3,
            changedBy: currentUser.fullName,
            changedAt: new Date().toISOString(),
            org_id: currentOrgId,
          },
          ...prev,
        ]);

        setSignals((prev) => [
          {
            id: `sig_deal_stage_${ts}`,
            title: `تحديث مرحلة الصفقة: ${target.title}`,
            description: `انتقلت إلى "${patch.stage}" (${patch.probability ?? target.probability}%)`,
            category: 'deal',
            timeLabel: 'الآن',
            unread: true,
            route: `/deals/${dealId}`,
          },
          ...prev,
        ]);
      }

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: prev.deals.map((d) => (d.id === dealId ? { ...d, ...patch } : d)),
          touchpoints: auditTp ? [auditTp, ...prev.touchpoints] : prev.touchpoints,
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'deals', dealId), {
          ...safePatch,
          updatedAt: serverTimestamp(),
        });
        if (auditTp) {
          const { id: _tpId, ...tpRest } = auditTp;
          batch.set(doc(db, 'touchpoints', tpId), {
            ...stripUndefined(tpRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `deals/${dealId}`);
      }
    },
    [currentOrgId, currentUser.fullName, data.deals, firebaseUser, setData, setSignals]
  );

  const bulkUpdateDeals = useCallback(
    async (dealIds: string[], patch: Partial<Deal>) => {
      if (dealIds.length === 0) return;
      const idSet = new Set(dealIds);
      const safePatch = stripUndefined(patch);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: prev.deals.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d)),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const id of dealIds) {
          batch.update(doc(db, 'deals', id), {
            ...safePatch,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'deals_bulk_update');
      }
    },
    [firebaseUser, setData]
  );

  const softDeleteDeals = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      const idSet = new Set(dealIds);
      const targets = data.deals.filter((d) => idSet.has(d.id));
      if (targets.length === 0) return;

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const recycleEntries: RecycleBinItem[] = targets.map((d, idx) => ({
        id: `rb_deal_${Date.now()}_${idx}`,
        ownerId,
        org_id: currentOrgId,
        entityType: 'صفقة',
        originalId: d.id,
        displayName: `${d.title} (${d.accountName})`.slice(0, 150),
        deletedBy: currentUser.fullName,
        deletedAtLabel: 'الآن',
        expiresInDays: 30,
        payloadJson: JSON.stringify(d),
      }));

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          deals: prev.deals.filter((d) => !idSet.has(d.id)),
          recycle_bin: [...recycleEntries, ...prev.recycle_bin],
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const entry of recycleEntries) {
          const { id: rbId, ...rbRest } = entry;
          batch.set(doc(db, 'recycle_bin', rbId), {
            ...stripUndefined(rbRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        for (const d of targets) {
          batch.delete(doc(db, 'deals', d.id));
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'deals_soft_delete');
      }
    },
    [currentOrgId, currentUser.fullName, data.deals, firebaseUser, setData]
  );

  const addDealTouchpoint = useCallback(
    async (
      dealId: string,
      input: {
        channel: TouchpointChannel;
        summary: string;
        eventType?: string;
        campaign?: string;
      }
    ) => {
      const deal = data.deals.find((d) => d.id === dealId);
      if (!deal || !input.summary.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const tpId = `tp_deal_${Date.now()}`;

      const newTp: Touchpoint = {
        id: tpId,
        ownerId,
        org_id: currentOrgId,
        channel: input.channel,
        summary: input.summary.trim().slice(0, 290),
        relatedEntityType: 'deal',
        relatedEntityId: deal.id,
        relatedEntityName: deal.accountName.slice(0, 140),
        occurredAt: 'الآن',
        leadUniqueId: deal.leadUniqueId,
        campaign: input.campaign?.trim() || undefined,
        eventType: input.eventType?.trim() || 'متابعة صفقة',
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          touchpoints: [newTp, ...prev.touchpoints],
        }));
        return;
      }

      try {
        const { id: _id, ...rest } = newTp;
        await setDoc(doc(db, 'touchpoints', tpId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `touchpoints/${tpId}`);
      }
    },
    [currentOrgId, data.deals, firebaseUser, setData]
  );

  const addDealTask = useCallback(
    async (
      dealId: string,
      input: {
        title: string;
        priority: CrmTask['priority'];
        dueDate: string;
        assignedToName?: string;
      }
    ) => {
      const deal = data.deals.find((d) => d.id === dealId);
      if (!deal || !input.title.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const taskId = `task_deal_${Date.now()}`;

      const newTask: CrmTask = {
        id: taskId,
        ownerId,
        org_id: currentOrgId,
        title: input.title.trim().slice(0, 155),
        priority: input.priority,
        status: 'قيد التنفيذ',
        dueDate: input.dueDate,
        relatedTo: deal.title.slice(0, 135),
        assignedToName: input.assignedToName || deal.ownerName || currentUser.fullName,
        leadUniqueId: deal.leadUniqueId,
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          tasks: [newTask, ...prev.tasks],
        }));
        return;
      }

      try {
        const { id: _id, ...rest } = newTask;
        await setDoc(doc(db, 'tasks', taskId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
      }
    },
    [currentOrgId, currentUser.fullName, data.deals, firebaseUser, setData]
  );

  const scopedDeals = useMemo(
    () =>
      data.deals.filter(
        (d) => belongsToCurrentOrg(d.org_id) && canViewRecord(d.ownerName || d.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.deals]
  );

  const scopedQuotes = useMemo(
    () => data.quotes.filter((q) => belongsToCurrentOrg(q.org_id)),
    [belongsToCurrentOrg, data.quotes]
  );

  const scopedSalesOrders = useMemo(
    () => data.sales_orders.filter((s) => belongsToCurrentOrg(s.org_id)),
    [belongsToCurrentOrg, data.sales_orders]
  );

  const scopedInvoices = useMemo(
    () => data.invoices.filter((i) => belongsToCurrentOrg(i.org_id)),
    [belongsToCurrentOrg, data.invoices]
  );

  const value = useMemo<DealsFinancialContextValue>(
    () => ({
      deals: scopedDeals,
      quotes: scopedQuotes,
      salesOrders: scopedSalesOrders,
      invoices: scopedInvoices,
      stageHistory,
      orderAttributions,
      createQuickDeal,
      createDealForContact,
      createDeal,
      updateDealFields,
      bulkUpdateDeals,
      softDeleteDeals,
      addDealTouchpoint,
      addDealTask,
    }),
    [
      scopedDeals,
      scopedQuotes,
      scopedSalesOrders,
      scopedInvoices,
      stageHistory,
      orderAttributions,
      createQuickDeal,
      createDealForContact,
      createDeal,
      updateDealFields,
      bulkUpdateDeals,
      softDeleteDeals,
      addDealTouchpoint,
      addDealTask,
    ]
  );

  return (
    <DealsFinancialContext.Provider value={value}>
      {children}
    </DealsFinancialContext.Provider>
  );
}

export function useDealsFinancial(): DealsFinancialContextValue {
  const ctx = useContext(DealsFinancialContext);
  if (!ctx) {
    throw new Error('useDealsFinancial must be used inside DealsFinancialProvider');
  }
  return ctx;
}
