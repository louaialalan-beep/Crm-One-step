import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Account,
  Contact,
  ContactStatus,
  CrmTask,
  Deal,
  DealStage,
  Lead,
  LeadChannel,
  LeadStatus,
  RecycleBinItem,
  Touchpoint,
  TouchpointChannel,
} from '../types/crm';
import { generateLeadUniqueId } from '../utils/formatters';
import type { ParsedCsvContactDraft } from '../utils/contactsLogic';
import type { ParsedCsvLeadDraft } from '../utils/leadsLogic';
import { PREVIEW_OWNER_ID, stripUndefined, useAuth } from './AuthContext';
import { useSetup } from './SetupContext';

export interface CreateLeadInput {
  fullName: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  altContact?: string;
  source?: string;
  channel: LeadChannel;
  campaign?: string;
  adId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: LeadStatus;
  aiScore?: number;
  estimatedValue?: number;
  approvedBudget?: number;
  assignedToName: string;
  city?: string;
  tags?: string[];
  followUpAt?: string;
  notes?: string;
  customValues?: Record<string, string | number | boolean>;
}

export interface ConvertLeadInput {
  leadId: string;
  contactMode: 'new' | 'existing';
  existingContactId?: string;
  contactFullName: string;
  contactJobTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactCity?: string;
  accountMode: 'none' | 'new' | 'existing';
  existingAccountId?: string;
  accountName?: string;
  accountIndustry?: string;
  accountTier?: Account['tier'];
  createDeal: boolean;
  dealTitle?: string;
  dealAmount?: number;
  dealStage?: DealStage;
  dealCloseDate?: string;
  dealOwnerName?: string;
}

export interface CreateContactInput {
  fullName: string;
  accountMode: 'none' | 'existing' | 'new';
  existingAccountId?: string;
  accountName?: string;
  accountIndustry?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  city?: string;
  channel: LeadChannel;
  primarySource?: string;
  contactStatus: ContactStatus;
  assignedToName: string;
  isPrimary?: boolean;
  tags?: string[];
  notes?: string;
  customValues?: Record<string, string | number | boolean>;
}

export interface CreateAccountInput {
  name: string;
  industry: string;
  city?: string;
  tier: Account['tier'];
  annualRevenue: number;
  employeesCount?: number;
  website?: string;
  accountManager?: string;
  leadUniqueId?: string;
}

export interface LeadsContactsContextValue {
  leads: Lead[];
  contacts: Contact[];
  accounts: Account[];
  touchpoints: Touchpoint[];

  createLead: (input: CreateLeadInput) => Promise<Lead>;
  importLeadsBatch: (drafts: ParsedCsvLeadDraft[]) => Promise<number>;
  updateLeadFields: (leadId: string, patch: Partial<Lead>) => Promise<void>;
  bulkUpdateLeads: (leadIds: string[], patch: Partial<Lead>) => Promise<void>;
  bulkManageTags: (leadIds: string[], mode: 'add' | 'remove', tag: string) => Promise<void>;
  bulkCreateTasksForLeads: (
    leadIds: string[],
    input: {
      title: string;
      priority: CrmTask['priority'];
      dueDate: string;
      assignedToName?: string;
    }
  ) => Promise<void>;
  mergeDuplicateLeads: (input: {
    masterId: string;
    duplicateIds: string[];
    resolvedFields: Partial<Lead>;
  }) => Promise<void>;
  softDeleteLeads: (leadIds: string[]) => Promise<void>;
  addLeadTouchpoint: (
    leadId: string,
    input: {
      channel: TouchpointChannel;
      summary: string;
      eventType?: string;
      campaign?: string;
      adId?: string;
      utmSource?: string;
    }
  ) => Promise<void>;
  addLeadTask: (
    leadId: string,
    input: {
      title: string;
      priority: CrmTask['priority'];
      dueDate: string;
      assignedToName?: string;
    }
  ) => Promise<void>;
  convertLead: (
    input: ConvertLeadInput
  ) => Promise<{ contactId: string; accountId?: string; dealId?: string }>;

  createContact: (input: CreateContactInput) => Promise<Contact>;
  importContactsBatch: (drafts: ParsedCsvContactDraft[]) => Promise<number>;
  updateContactFields: (contactId: string, patch: Partial<Contact>) => Promise<void>;
  bulkUpdateContacts: (contactIds: string[], patch: Partial<Contact>) => Promise<void>;
  bulkManageContactTags: (contactIds: string[], mode: 'add' | 'remove', tag: string) => Promise<void>;
  bulkCreateTasksForContacts: (
    contactIds: string[],
    input: {
      title: string;
      priority: CrmTask['priority'];
      dueDate: string;
      assignedToName?: string;
    }
  ) => Promise<void>;
  mergeDuplicateContacts: (input: {
    masterId: string;
    duplicateIds: string[];
    resolvedFields: Partial<Contact>;
  }) => Promise<void>;
  softDeleteContacts: (contactIds: string[]) => Promise<void>;
  addContactTouchpoint: (
    contactId: string,
    input: {
      channel: TouchpointChannel;
      summary: string;
      eventType?: string;
      campaign?: string;
    }
  ) => Promise<void>;
  addContactTask: (
    contactId: string,
    input: {
      title: string;
      priority: CrmTask['priority'];
      dueDate: string;
      assignedToName?: string;
    }
  ) => Promise<void>;

  createAccount: (input: CreateAccountInput) => Promise<Account>;
  updateAccountFields: (accountId: string, patch: Partial<Account>) => Promise<void>;
}

const LeadsContactsContext = createContext<LeadsContactsContextValue | null>(null);

export function LeadsContactsProvider({ children }: { children: React.ReactNode }) {
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

  const createLead = useCallback(
    async (input: CreateLeadInput): Promise<Lead> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const existingIds = data.leads.map((l) => l.unique_id);
      const unique_id = generateLeadUniqueId(existingIds);
      const ts = Date.now();
      const rnd = Math.floor(Math.random() * 1000);
      const newId = `lead_${ts}_${rnd}`;
      const tpId = `tp_init_${ts}_${rnd}`;

      const newLead: Lead = {
        id: newId,
        ownerId,
        org_id: currentOrgId,
        unique_id,
        fullName: input.fullName.trim(),
        company: input.company?.trim() || undefined,
        jobTitle: input.jobTitle?.trim() || undefined,
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        altContact: input.altContact?.trim() || undefined,
        source: input.source?.trim() || 'إدخال يدوي',
        channel: input.channel,
        campaign: input.campaign?.trim() || undefined,
        adId: input.adId?.trim() || undefined,
        utmSource: input.utmSource?.trim() || undefined,
        utmMedium: input.utmMedium?.trim() || undefined,
        utmCampaign: input.utmCampaign?.trim() || undefined,
        status: input.status,
        aiScore: input.aiScore ?? 78,
        estimatedValue: Number.isFinite(input.estimatedValue) ? (input.estimatedValue ?? 0) : 0,
        approvedBudget: input.approvedBudget,
        assignedToName: input.assignedToName.trim() || currentUser.fullName,
        city: input.city?.trim() || 'الرياض، السعودية',
        tags: input.tags && input.tags.length > 0 ? input.tags : ['جديد'],
        lastActivityLabel: 'الآن',
        lastMessageSnippet: input.notes?.trim() || 'تم تسجيل العميل المحتمل في رواق CRM.',
        awaitingReplyHours: 0,
        followUpAt: input.followUpAt?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        converted: false,
        customValues: input.customValues,
      };

      const channelToTouchpoint: Record<LeadChannel, TouchpointChannel> = {
        whatsapp: 'واتساب',
        instagram: 'إنستغرام',
        messenger: 'موقع ويب',
        website: 'موقع ويب',
        phone: 'مكالمة',
        referral: 'حدث',
      };

      const initialTouchpoint: Touchpoint = {
        id: tpId,
        ownerId,
        org_id: currentOrgId,
        channel: channelToTouchpoint[input.channel] ?? 'حدث',
        summary: `تسجيل عميل محتمل جديد (${newLead.source || 'إدخال يدوي'})`.slice(0, 300),
        relatedEntityType: 'lead',
        relatedEntityId: newId,
        relatedEntityName: newLead.fullName.slice(0, 140),
        occurredAt: 'الآن',
        leadId: newId,
        leadUniqueId: unique_id,
        campaign: newLead.campaign?.slice(0, 140),
        adId: newLead.adId?.slice(0, 80),
        utmSource: newLead.utmSource?.slice(0, 80),
        eventType: 'نقطة دخول أولية',
      };

      setSignals((prev) => [
        {
          id: `sig_${Date.now()}`,
          org_id: currentOrgId,
          title: `عميل محتمل جديد (${newLead.unique_id}): ${newLead.fullName}`,
          description: `${newLead.city || newLead.source || 'عميل محتمل'} · ${newLead.phone || newLead.unique_id}`,
          category: 'lead',
          timeLabel: 'الآن',
          unread: true,
          route: `/leads/${newLead.id}`,
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: [newLead, ...prev.leads],
          touchpoints: [initialTouchpoint, ...prev.touchpoints],
        }));
        return newLead;
      }

      try {
        const batch = writeBatch(db);
        const { id: _id, ...rest } = newLead;
        batch.set(doc(db, 'leads', newId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const { id: _tpId, ...tpRest } = initialTouchpoint;
        batch.set(doc(db, 'touchpoints', tpId), {
          ...stripUndefined(tpRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `leads/${newId}`);
      }

      return newLead;
    },
    [currentOrgId, currentUser.fullName, data.leads, firebaseUser, setData, setSignals]
  );

  const importLeadsBatch = useCallback(
    async (drafts: ParsedCsvLeadDraft[]): Promise<number> => {
      if (drafts.length === 0) return 0;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const runningIds = data.leads.map((l) => l.unique_id);
      const createdLeads: Lead[] = [];

      drafts.forEach((draft, idx) => {
        const unique_id = generateLeadUniqueId(runningIds);
        runningIds.push(unique_id);
        createdLeads.push({
          id: `lead_csv_${Date.now()}_${idx}`,
          ownerId,
          org_id: currentOrgId,
          unique_id,
          fullName: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          city: draft.city || 'الرياض، السعودية',
          source: draft.source || 'استيراد CSV',
          channel: draft.channel,
          status: draft.status,
          aiScore: 74,
          estimatedValue: 0,
          assignedToName: draft.assignedToName,
          tags: draft.tags && draft.tags.length > 0 ? draft.tags : ['استيراد_CSV'],
          notes: draft.notes,
          lastActivityLabel: 'الآن',
          lastMessageSnippet: draft.notes || 'تم استيراد السجل عبر ملف CSV.',
          awaitingReplyHours: 0,
          converted: false,
        });
      });

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: [...createdLeads, ...prev.leads],
        }));
        return createdLeads.length;
      }

      try {
        const batch = writeBatch(db);
        for (const lead of createdLeads) {
          const { id: docId, ...rest } = lead;
          batch.set(doc(db, 'leads', docId), {
            ...stripUndefined(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'leads_csv_import');
      }

      return createdLeads.length;
    },
    [currentOrgId, data.leads, firebaseUser, setData]
  );

  const updateLeadFields = useCallback(
    async (leadId: string, patch: Partial<Lead>) => {
      const sanitizedPatch = stripUndefined(patch);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: prev.leads.map((l) => (l.id === leadId ? { ...l, ...patch } : l)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'leads', leadId), {
          ...sanitizedPatch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${leadId}`);
      }
    },
    [firebaseUser, setData]
  );

  const bulkUpdateLeads = useCallback(
    async (leadIds: string[], patch: Partial<Lead>) => {
      if (leadIds.length === 0) return;
      const idSet = new Set(leadIds);
      const sanitizedPatch = stripUndefined(patch);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: prev.leads.map((l) => (idSet.has(l.id) ? { ...l, ...patch } : l)),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const id of leadIds) {
          batch.update(doc(db, 'leads', id), {
            ...sanitizedPatch,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'leads_bulk_update');
      }
    },
    [firebaseUser, setData]
  );

  const bulkManageTags = useCallback(
    async (leadIds: string[], mode: 'add' | 'remove', tag: string) => {
      const cleanTag = tag.trim();
      if (!cleanTag || leadIds.length === 0) return;
      const idSet = new Set(leadIds);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: prev.leads.map((l) => {
            if (!idSet.has(l.id)) return l;
            const currentTags = l.tags ?? [];
            const nextTags =
              mode === 'add'
                ? Array.from(new Set([...currentTags, cleanTag])).slice(0, 20)
                : currentTags.filter((t) => t !== cleanTag);
            return { ...l, tags: nextTags };
          }),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const id of leadIds) {
          const lead = data.leads.find((l) => l.id === id);
          if (!lead) continue;
          const currentTags = lead.tags ?? [];
          const nextTags =
            mode === 'add'
              ? Array.from(new Set([...currentTags, cleanTag])).slice(0, 20)
              : currentTags.filter((t) => t !== cleanTag);
          batch.update(doc(db, 'leads', id), {
            tags: nextTags,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'leads_bulk_tags');
      }
    },
    [data.leads, firebaseUser, setData]
  );

  const bulkCreateTasksForLeads = useCallback(
    async (
      leadIds: string[],
      input: {
        title: string;
        priority: CrmTask['priority'];
        dueDate: string;
        assignedToName?: string;
      }
    ) => {
      if (leadIds.length === 0 || !input.title.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const newTasks: CrmTask[] = [];

      leadIds.forEach((leadId, idx) => {
        const lead = data.leads.find((l) => l.id === leadId);
        if (!lead) return;
        newTasks.push({
          id: `task_bulk_${Date.now()}_${idx}`,
          ownerId,
          org_id: currentOrgId,
          title: `${input.title.trim()} (${lead.unique_id})`,
          priority: input.priority,
          status: 'قيد التنفيذ',
          dueDate: input.dueDate,
          relatedTo: lead.fullName,
          assignedToName: input.assignedToName || lead.assignedToName || currentUser.fullName,
          leadId: lead.id,
          leadUniqueId: lead.unique_id,
        });
      });

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          tasks: [...newTasks, ...prev.tasks],
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const task of newTasks) {
          const { id: docId, ...rest } = task;
          batch.set(doc(db, 'tasks', docId), {
            ...stripUndefined(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tasks_bulk_create');
      }
    },
    [currentOrgId, currentUser.fullName, data.leads, firebaseUser, setData]
  );

  const mergeDuplicateLeads = useCallback(
    async (input: { masterId: string; duplicateIds: string[]; resolvedFields: Partial<Lead> }) => {
      const master = data.leads.find((l) => l.id === input.masterId);
      const dupIds = input.duplicateIds.filter((id) => id !== input.masterId);
      if (!master || dupIds.length === 0) return;

      const dupIdSet = new Set(dupIds);
      const duplicates = data.leads.filter((l) => dupIdSet.has(l.id));
      const mergedTags = Array.from(
        new Set([
          ...(master.tags ?? []),
          ...duplicates.flatMap((d) => d.tags ?? []),
          ...(input.resolvedFields.tags ?? []),
        ])
      )
        .filter((t) => t !== 'مراجعة_تكرار')
        .slice(0, 20);

      const masterUpdate: Partial<Lead> = {
        ...input.resolvedFields,
        tags: mergedTags,
        lastActivityLabel: 'الآن (سجل مدمج)',
      };

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const recycleEntries: RecycleBinItem[] = duplicates.map((dup, idx) => ({
        id: `rb_merge_${Date.now()}_${idx}`,
        ownerId,
        org_id: currentOrgId,
        entityType: 'عميل محتمل مدمج',
        originalId: dup.id,
        displayName: `${dup.fullName} (${dup.unique_id}) ← دُمج في ${master.unique_id}`,
        deletedBy: currentUser.fullName,
        deletedAtLabel: 'الآن',
        expiresInDays: 30,
        payloadJson: JSON.stringify(dup),
      }));

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: prev.leads
            .filter((l) => !dupIdSet.has(l.id))
            .map((l) => (l.id === master.id ? { ...l, ...masterUpdate } : l)),
          touchpoints: prev.touchpoints.map((tp) =>
            tp.leadId && dupIdSet.has(tp.leadId)
              ? {
                  ...tp,
                  leadId: master.id,
                  leadUniqueId: master.unique_id,
                  relatedEntityId: master.id,
                  relatedEntityName: input.resolvedFields.fullName ?? master.fullName,
                }
              : tp
          ),
          messages: prev.messages.map((msg) =>
            msg.leadId && dupIdSet.has(msg.leadId)
              ? {
                  ...msg,
                  leadId: master.id,
                  leadUniqueId: master.unique_id,
                }
              : msg
          ),
          tasks: prev.tasks.map((t) =>
            t.leadId && dupIdSet.has(t.leadId)
              ? {
                  ...t,
                  leadId: master.id,
                  leadUniqueId: master.unique_id,
                }
              : t
          ),
          recycle_bin: [...recycleEntries, ...prev.recycle_bin],
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'leads', master.id), {
          ...stripUndefined(masterUpdate),
          updatedAt: serverTimestamp(),
        });

        for (const tp of data.touchpoints) {
          if (tp.leadId && dupIdSet.has(tp.leadId)) {
            batch.update(doc(db, 'touchpoints', tp.id), {
              leadId: master.id,
              leadUniqueId: master.unique_id,
              relatedEntityType: tp.relatedEntityType || 'lead',
              relatedEntityId: master.id,
              relatedEntityName: input.resolvedFields.fullName ?? master.fullName,
              updatedAt: serverTimestamp(),
            });
          }
        }

        for (const msg of data.messages) {
          if (msg.leadId && dupIdSet.has(msg.leadId)) {
            batch.update(doc(db, 'messages', msg.id), {
              leadId: master.id,
              leadUniqueId: master.unique_id,
              senderName: msg.senderName,
              companyName: msg.companyName || master.city || master.fullName,
              updatedAt: serverTimestamp(),
            });
          }
        }

        for (const t of data.tasks) {
          if (t.leadId && dupIdSet.has(t.leadId)) {
            batch.update(doc(db, 'tasks', t.id), {
              title: t.title,
              priority: t.priority,
              status: t.status,
              dueDate: t.dueDate,
              relatedTo: input.resolvedFields.fullName ?? master.fullName,
              assignedToName: t.assignedToName,
              leadId: master.id,
              leadUniqueId: master.unique_id,
              updatedAt: serverTimestamp(),
            });
          }
        }

        for (const entry of recycleEntries) {
          const { id: rbId, ...rbRest } = entry;
          batch.set(doc(db, 'recycle_bin', rbId), {
            ...stripUndefined(rbRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const dupId of dupIds) {
          batch.delete(doc(db, 'leads', dupId));
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'leads_merge_duplicates');
      }
    },
    [
      currentOrgId,
      currentUser.fullName,
      data.leads,
      data.messages,
      data.tasks,
      data.touchpoints,
      firebaseUser,
      setData,
    ]
  );

  const softDeleteLeads = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      const idSet = new Set(leadIds);
      const targets = data.leads.filter((l) => idSet.has(l.id));
      if (targets.length === 0) return;

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const recycleEntries: RecycleBinItem[] = targets.map((lead, idx) => ({
        id: `rb_lead_${Date.now()}_${idx}`,
        ownerId,
        org_id: currentOrgId,
        entityType: 'عميل محتمل',
        originalId: lead.id,
        displayName: `${lead.fullName} (${lead.unique_id})`,
        deletedBy: currentUser.fullName,
        deletedAtLabel: 'الآن',
        expiresInDays: 30,
        payloadJson: JSON.stringify(lead),
      }));

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: prev.leads.filter((l) => !idSet.has(l.id)),
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
        for (const lead of targets) {
          batch.delete(doc(db, 'leads', lead.id));
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'leads_soft_delete');
      }
    },
    [currentOrgId, currentUser.fullName, data.leads, firebaseUser, setData]
  );

  const addLeadTouchpoint = useCallback(
    async (
      leadId: string,
      input: {
        channel: TouchpointChannel;
        summary: string;
        eventType?: string;
        campaign?: string;
        adId?: string;
        utmSource?: string;
      }
    ) => {
      const lead = data.leads.find((l) => l.id === leadId);
      if (!lead || !input.summary.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const tpId = `tp_${Date.now()}`;

      const newTp: Touchpoint = {
        id: tpId,
        ownerId,
        org_id: currentOrgId,
        channel: input.channel,
        summary: input.summary.trim(),
        relatedEntityType: 'lead',
        relatedEntityId: lead.id,
        relatedEntityName: lead.fullName,
        occurredAt: 'الآن',
        leadId: lead.id,
        leadUniqueId: lead.unique_id,
        campaign: input.campaign?.trim() || lead.campaign,
        adId: input.adId?.trim() || lead.adId,
        utmSource: input.utmSource?.trim() || lead.utmSource,
        eventType: input.eventType?.trim() || 'نقطة تماس يدوية',
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          touchpoints: [newTp, ...prev.touchpoints],
          leads: prev.leads.map((l) =>
            l.id === leadId ? { ...l, lastActivityLabel: 'الآن' } : l
          ),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        const { id: _id, ...rest } = newTp;
        batch.set(doc(db, 'touchpoints', tpId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'leads', leadId), {
          lastActivityLabel: 'الآن',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `touchpoints/${tpId}`);
      }
    },
    [currentOrgId, data.leads, firebaseUser, setData]
  );

  const addLeadTask = useCallback(
    async (
      leadId: string,
      input: {
        title: string;
        priority: CrmTask['priority'];
        dueDate: string;
        assignedToName?: string;
      }
    ) => {
      const lead = data.leads.find((l) => l.id === leadId);
      if (!lead || !input.title.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const taskId = `task_${Date.now()}`;

      const newTask: CrmTask = {
        id: taskId,
        ownerId,
        org_id: currentOrgId,
        title: input.title.trim(),
        priority: input.priority,
        status: 'قيد التنفيذ',
        dueDate: input.dueDate,
        relatedTo: lead.fullName,
        assignedToName: input.assignedToName || lead.assignedToName || currentUser.fullName,
        leadId: lead.id,
        leadUniqueId: lead.unique_id,
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
    [currentOrgId, currentUser.fullName, data.leads, firebaseUser, setData]
  );

  const convertLead = useCallback(
    async (
      input: ConvertLeadInput
    ): Promise<{ contactId: string; accountId?: string; dealId?: string }> => {
      const lead = data.leads.find((l) => l.id === input.leadId);
      if (!lead) {
        throw new Error('لم يتم العثور على سجل العميل المحتمل');
      }

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const nowIso = new Date().toISOString().slice(0, 10);

      let resolvedAccountId = '';
      let resolvedAccountName = lead.company?.trim() || lead.fullName;
      let newAccount: Account | null = null;

      if (input.accountMode === 'existing' && input.existingAccountId) {
        const existingAcc = data.accounts.find((a) => a.id === input.existingAccountId);
        if (existingAcc) {
          resolvedAccountId = existingAcc.id;
          resolvedAccountName = existingAcc.name;
        }
      } else if (input.accountMode === 'new') {
        resolvedAccountId = `acc_conv_${Date.now()}`;
        resolvedAccountName = input.accountName?.trim() || lead.company?.trim() || lead.fullName;
        newAccount = {
          id: resolvedAccountId,
          ownerId,
          org_id: currentOrgId,
          name: resolvedAccountName,
          industry: input.accountIndustry?.trim() || 'التقنية والأعمال',
          city: input.contactCity || lead.city || 'الرياض',
          tier: input.accountTier || 'مؤسسات',
          annualRevenue: Math.max((lead.estimatedValue || 100000) * 8, 1200000),
          accountManager: lead.assignedToName || currentUser.fullName,
          leadUniqueId: lead.unique_id,
        };
      }

      let resolvedContactId = '';
      let newContact: Contact | null = null;

      if (input.contactMode === 'existing' && input.existingContactId) {
        resolvedContactId = input.existingContactId;
      } else {
        resolvedContactId = `con_conv_${Date.now()}`;
        newContact = {
          id: resolvedContactId,
          ownerId,
          org_id: currentOrgId,
          fullName: input.contactFullName.trim() || lead.fullName,
          accountId: resolvedAccountId || 'unassigned',
          accountName: resolvedAccountId ? resolvedAccountName : 'عميل فردي B2C',
          jobTitle: input.contactJobTitle?.trim() || lead.jobTitle,
          email: input.contactEmail?.trim() || lead.email,
          phone: input.contactPhone?.trim() || lead.phone,
          city: input.contactCity?.trim() || lead.city,
          isPrimary: true,
          leadUniqueId: lead.unique_id,
          primarySource: lead.source || lead.campaign || 'تحويل عميل محتمل',
          contactStatus: 'عميل نشط',
          channel: lead.channel || 'whatsapp',
          assignedToName: lead.assignedToName || currentUser.fullName,
          tags: lead.tags ?? ['عميل_نشط'],
          lastActivityLabel: lead.lastActivityLabel || 'الآن',
          lastMessageSnippet: lead.lastMessageSnippet || lead.notes,
          notes: lead.notes,
        };
      }

      let resolvedDealId: string | undefined;
      let newDeal: Deal | null = null;
      if (input.createDeal) {
        resolvedDealId = `deal_conv_${Date.now()}`;
        const targetStage = input.dealStage || 'تأهيل مبدئي';
        const stageProbMap: Record<DealStage, number> = {
          'تأهيل مبدئي': 20,
          'تحديد الاحتياج': 20,
          'عرض سعر': 50,
          'تفاوض': 80,
          'مكتملة': 100,
          'خسارة': 0,
        };
        newDeal = {
          id: resolvedDealId,
          ownerId,
          org_id: currentOrgId,
          title: input.dealTitle?.trim() || `صفقة ${lead.fullName}`,
          accountId: resolvedAccountId || 'unassigned',
          accountName: resolvedAccountName,
          amount:
            input.dealAmount && input.dealAmount > 0 ? input.dealAmount : lead.estimatedValue || 100000,
          currency: 'SAR',
          stage: targetStage,
          probability: stageProbMap[targetStage] ?? 20,
          closeDate: input.dealCloseDate || '2026-12-25',
          ownerName: input.dealOwnerName?.trim() || lead.assignedToName || currentUser.fullName,
          nextStep: `متابعة العميل المحول (${lead.unique_id})`,
          leadUniqueId: lead.unique_id,
          contactId: resolvedContactId,
        };
      }

      const targetEntityType = newDeal ? 'deal' : 'contact';
      const targetEntityId = newDeal ? newDeal.id : resolvedContactId;
      const targetEntityName = newDeal ? newDeal.title : input.contactFullName || lead.fullName;

      const leadPatch: Partial<Lead> = {
        converted: true,
        convertedAt: nowIso,
        convertedContactId: resolvedContactId,
        convertedAccountId: resolvedAccountId || undefined,
        convertedDealId: resolvedDealId,
        status: 'مؤهل للتحويل',
      };

      setSignals((prev) => [
        {
          id: `sig_conv_${Date.now()}`,
          org_id: currentOrgId,
          title: `تم تحويل العميل (${lead.unique_id}) بنجاح`,
          description: newDeal
            ? `تم إنشاء جهة اتصال وصفقة بقيمة ${newDeal.amount.toLocaleString('en-US')} ر.س مع الحفاظ على نقاط التماس.`
            : `تم تحويل ${lead.fullName} إلى جهة اتصال مع ترحيل كافة نقاط التماس والمحادثات.`,
          category: 'lead',
          timeLabel: 'الآن',
          unread: true,
          route: newDeal ? '/deals' : '/contacts',
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          accounts: newAccount ? [newAccount, ...prev.accounts] : prev.accounts,
          contacts: newContact ? [newContact, ...prev.contacts] : prev.contacts,
          deals: newDeal ? [newDeal, ...prev.deals] : prev.deals,
          leads: prev.leads.map((l) => (l.id === lead.id ? { ...l, ...leadPatch } : l)),
          touchpoints: prev.touchpoints.map((tp) =>
            tp.leadId === lead.id || tp.leadUniqueId === lead.unique_id
              ? {
                  ...tp,
                  leadUniqueId: lead.unique_id,
                  relatedEntityType: targetEntityType,
                  relatedEntityId: targetEntityId,
                  relatedEntityName: targetEntityName,
                }
              : tp
          ),
          messages: prev.messages.map((msg) =>
            msg.leadId === lead.id || msg.leadUniqueId === lead.unique_id
              ? { ...msg, leadUniqueId: lead.unique_id }
              : msg
          ),
        }));

        return {
          contactId: resolvedContactId,
          accountId: resolvedAccountId || undefined,
          dealId: resolvedDealId,
        };
      }

      try {
        const batch = writeBatch(db);
        if (newAccount) {
          const { id: accId, ...accRest } = newAccount;
          batch.set(doc(db, 'accounts', accId), {
            ...stripUndefined(accRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        if (newContact) {
          const { id: conId, ...conRest } = newContact;
          batch.set(doc(db, 'contacts', conId), {
            ...stripUndefined(conRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        if (newDeal) {
          const { id: dId, ...dRest } = newDeal;
          batch.set(doc(db, 'deals', dId), {
            ...stripUndefined(dRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        batch.update(doc(db, 'leads', lead.id), {
          ...stripUndefined(leadPatch),
          updatedAt: serverTimestamp(),
        });

        for (const tp of data.touchpoints) {
          if (tp.leadId === lead.id || tp.leadUniqueId === lead.unique_id) {
            batch.update(doc(db, 'touchpoints', tp.id), {
              relatedEntityType: targetEntityType,
              relatedEntityId: targetEntityId,
              relatedEntityName: targetEntityName,
              leadId: lead.id,
              leadUniqueId: lead.unique_id,
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `leads_convert/${lead.id}`);
      }

      return {
        contactId: resolvedContactId,
        accountId: resolvedAccountId || undefined,
        dealId: resolvedDealId,
      };
    },
    [
      currentOrgId,
      currentUser.fullName,
      data.accounts,
      data.leads,
      data.touchpoints,
      firebaseUser,
      setData,
      setSignals,
    ]
  );

  const createContact = useCallback(
    async (input: CreateContactInput): Promise<Contact> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const existingUniqueIds = [
        ...data.leads.map((l) => l.unique_id),
        ...data.contacts.map((c) => c.leadUniqueId).filter((v): v is string => Boolean(v)),
      ];
      const leadUniqueId = generateLeadUniqueId(existingUniqueIds);
      const ts = Date.now();
      const rnd = Math.floor(Math.random() * 1000);
      const newContactId = `con_${ts}_${rnd}`;

      let resolvedAccountId = 'unassigned';
      let resolvedAccountName = 'عميل فردي B2C';
      let newAccount: Account | null = null;

      if (input.accountMode === 'existing' && input.existingAccountId) {
        const matched = data.accounts.find((a) => a.id === input.existingAccountId);
        if (matched) {
          resolvedAccountId = matched.id;
          resolvedAccountName = matched.name;
        }
      } else if (input.accountMode === 'new' && input.accountName?.trim()) {
        resolvedAccountId = `acc_con_${ts}`;
        resolvedAccountName = input.accountName.trim();
        newAccount = {
          id: resolvedAccountId,
          ownerId,
          org_id: currentOrgId,
          name: resolvedAccountName,
          industry: input.accountIndustry?.trim() || 'التقنية والأعمال',
          city: input.city?.trim() || 'الرياض',
          tier: 'مؤسسات',
          annualRevenue: 1500000,
          accountManager: input.assignedToName.trim() || currentUser.fullName,
          leadUniqueId,
        };
      }

      const newContact: Contact = {
        id: newContactId,
        ownerId,
        org_id: currentOrgId,
        fullName: input.fullName.trim(),
        accountId: resolvedAccountId,
        accountName: resolvedAccountName,
        jobTitle: input.jobTitle?.trim() || undefined,
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        city: input.city?.trim() || 'الرياض، السعودية',
        isPrimary: input.isPrimary ?? true,
        leadUniqueId,
        primarySource: input.primarySource?.trim() || 'إضافة مباشرة',
        contactStatus: input.contactStatus,
        channel: input.channel,
        assignedToName: input.assignedToName.trim() || currentUser.fullName,
        tags: input.tags && input.tags.length > 0 ? input.tags : ['عميل_نشط'],
        lastActivityLabel: 'الآن',
        lastMessageSnippet:
          input.notes?.trim() || 'تم تسجيل جهة الاتصال في قاعدة العملاء بنجاح.',
        notes: input.notes?.trim() || undefined,
        customValues: input.customValues,
      };

      const channelToTp: Record<LeadChannel, TouchpointChannel> = {
        whatsapp: 'واتساب',
        instagram: 'إنستغرام',
        messenger: 'موقع ويب',
        website: 'موقع ويب',
        phone: 'مكالمة',
        referral: 'حدث',
      };

      const initialTp: Touchpoint = {
        id: `tp_con_${ts}_${rnd}`,
        ownerId,
        org_id: currentOrgId,
        channel: channelToTp[input.channel] ?? 'حدث',
        summary: `تسجيل جهة اتصال (${newContact.primarySource || 'إدخال يدوي'})`.slice(0, 300),
        relatedEntityType: 'contact',
        relatedEntityId: newContactId,
        relatedEntityName: newContact.fullName.slice(0, 140),
        occurredAt: 'الآن',
        leadUniqueId,
        eventType: 'تسجيل جهة اتصال',
      };

      setSignals((prev) => [
        {
          id: `sig_con_${Date.now()}`,
          org_id: currentOrgId,
          title: `جهة اتصال جديدة (${leadUniqueId}): ${newContact.fullName}`,
          description: `${resolvedAccountName} · ${newContact.phone || leadUniqueId}`,
          category: 'lead',
          timeLabel: 'الآن',
          unread: true,
          route: `/contacts/${newContactId}`,
        },
        ...prev,
      ]);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          accounts: newAccount ? [newAccount, ...prev.accounts] : prev.accounts,
          contacts: [newContact, ...prev.contacts],
          touchpoints: [initialTp, ...prev.touchpoints],
        }));
        return newContact;
      }

      try {
        const batch = writeBatch(db);
        if (newAccount) {
          const { id: _aId, ...accRest } = newAccount;
          batch.set(doc(db, 'accounts', resolvedAccountId), {
            ...stripUndefined(accRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        const { id: _cId, ...conRest } = newContact;
        batch.set(doc(db, 'contacts', newContactId), {
          ...stripUndefined(conRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const { id: tpId, ...tpRest } = initialTp;
        batch.set(doc(db, 'touchpoints', tpId), {
          ...stripUndefined(tpRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `contacts/${newContactId}`);
      }

      return newContact;
    },
    [
      currentOrgId,
      currentUser.fullName,
      data.accounts,
      data.contacts,
      data.leads,
      firebaseUser,
      setData,
      setSignals,
    ]
  );

  const importContactsBatch = useCallback(
    async (drafts: ParsedCsvContactDraft[]): Promise<number> => {
      if (drafts.length === 0) return 0;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const runningIds = [
        ...data.leads.map((l) => l.unique_id),
        ...data.contacts.map((c) => c.leadUniqueId).filter((v): v is string => Boolean(v)),
      ];
      const created: Contact[] = [];

      drafts.forEach((draft, idx) => {
        const leadUniqueId = generateLeadUniqueId(runningIds);
        runningIds.push(leadUniqueId);
        const matchedAccount = data.accounts.find(
          (a) => a.name.trim().toLowerCase() === draft.accountName.trim().toLowerCase()
        );
        created.push({
          id: `con_csv_${Date.now()}_${idx}`,
          ownerId,
          org_id: currentOrgId,
          fullName: draft.fullName,
          accountId: matchedAccount ? matchedAccount.id : 'unassigned',
          accountName: matchedAccount ? matchedAccount.name : draft.accountName || 'عميل فردي B2C',
          jobTitle: draft.jobTitle,
          email: draft.email,
          phone: draft.phone,
          city: draft.city || 'الرياض، السعودية',
          isPrimary: true,
          leadUniqueId,
          primarySource: draft.primarySource || 'استيراد CSV',
          contactStatus: draft.contactStatus,
          channel: draft.channel,
          assignedToName: draft.assignedToName,
          tags: draft.tags && draft.tags.length > 0 ? draft.tags : ['استيراد_CSV'],
          lastActivityLabel: 'الآن',
          lastMessageSnippet: draft.notes || 'تم استيراد جهة الاتصال عبر CSV.',
          notes: draft.notes,
        });
      });

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: [...created, ...prev.contacts],
        }));
        return created.length;
      }

      try {
        const batch = writeBatch(db);
        for (const c of created) {
          const { id: docId, ...rest } = c;
          batch.set(doc(db, 'contacts', docId), {
            ...stripUndefined(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'contacts_csv_import');
      }

      return created.length;
    },
    [currentOrgId, data.accounts, data.contacts, data.leads, firebaseUser, setData]
  );

  const updateContactFields = useCallback(
    async (contactId: string, patch: Partial<Contact>) => {
      const sanitizedPatch = stripUndefined(patch);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'contacts', contactId), {
          ...sanitizedPatch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `contacts/${contactId}`);
      }
    },
    [firebaseUser, setData]
  );

  const bulkUpdateContacts = useCallback(
    async (contactIds: string[], patch: Partial<Contact>) => {
      if (contactIds.length === 0) return;
      const idSet = new Set(contactIds);
      const sanitizedPatch = stripUndefined(patch);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.map((c) => (idSet.has(c.id) ? { ...c, ...patch } : c)),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const id of contactIds) {
          batch.update(doc(db, 'contacts', id), {
            ...sanitizedPatch,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'contacts_bulk_update');
      }
    },
    [firebaseUser, setData]
  );

  const bulkManageContactTags = useCallback(
    async (contactIds: string[], mode: 'add' | 'remove', tag: string) => {
      const cleanTag = tag.trim();
      if (!cleanTag || contactIds.length === 0) return;
      const idSet = new Set(contactIds);

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.map((c) => {
            if (!idSet.has(c.id)) return c;
            const currentTags = c.tags ?? [];
            const nextTags =
              mode === 'add'
                ? Array.from(new Set([...currentTags, cleanTag])).slice(0, 20)
                : currentTags.filter((t) => t !== cleanTag);
            return { ...c, tags: nextTags };
          }),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const id of contactIds) {
          const c = data.contacts.find((item) => item.id === id);
          if (!c) continue;
          const currentTags = c.tags ?? [];
          const nextTags =
            mode === 'add'
              ? Array.from(new Set([...currentTags, cleanTag])).slice(0, 20)
              : currentTags.filter((t) => t !== cleanTag);
          batch.update(doc(db, 'contacts', id), {
            tags: nextTags,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'contacts_bulk_tags');
      }
    },
    [data.contacts, firebaseUser, setData]
  );

  const bulkCreateTasksForContacts = useCallback(
    async (
      contactIds: string[],
      input: {
        title: string;
        priority: CrmTask['priority'];
        dueDate: string;
        assignedToName?: string;
      }
    ) => {
      if (contactIds.length === 0 || !input.title.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const newTasks: CrmTask[] = [];

      contactIds.forEach((contactId, idx) => {
        const c = data.contacts.find((item) => item.id === contactId);
        if (!c) return;
        newTasks.push({
          id: `task_con_bulk_${Date.now()}_${idx}`,
          ownerId,
          org_id: currentOrgId,
          title: `${input.title.trim()} (${c.leadUniqueId || c.fullName})`,
          priority: input.priority,
          status: 'قيد التنفيذ',
          dueDate: input.dueDate,
          relatedTo: c.fullName,
          assignedToName: input.assignedToName || c.assignedToName || currentUser.fullName,
          leadUniqueId: c.leadUniqueId,
        });
      });

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          tasks: [...newTasks, ...prev.tasks],
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const task of newTasks) {
          const { id: docId, ...rest } = task;
          batch.set(doc(db, 'tasks', docId), {
            ...stripUndefined(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'contacts_bulk_tasks');
      }
    },
    [currentOrgId, currentUser.fullName, data.contacts, firebaseUser, setData]
  );

  const mergeDuplicateContacts = useCallback(
    async (input: {
      masterId: string;
      duplicateIds: string[];
      resolvedFields: Partial<Contact>;
    }) => {
      const master = data.contacts.find((c) => c.id === input.masterId);
      const dupIds = input.duplicateIds.filter((id) => id !== input.masterId);
      if (!master || dupIds.length === 0) return;

      const dupIdSet = new Set(dupIds);
      const duplicates = data.contacts.filter((c) => dupIdSet.has(c.id));
      const dupUniqueIds = new Set(
        duplicates.map((d) => d.leadUniqueId).filter((v): v is string => Boolean(v))
      );

      const mergedTags = Array.from(
        new Set([
          ...(master.tags ?? []),
          ...duplicates.flatMap((d) => d.tags ?? []),
          ...(input.resolvedFields.tags ?? []),
        ])
      )
        .filter((t) => t !== 'مراجعة_تكرار')
        .slice(0, 20);

      const masterUpdate: Partial<Contact> = {
        ...input.resolvedFields,
        tags: mergedTags,
        lastActivityLabel: 'الآن (سجل مدمج)',
      };

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const recycleEntries: RecycleBinItem[] = duplicates.map((dup, idx) => ({
        id: `rb_con_merge_${Date.now()}_${idx}`,
        ownerId,
        org_id: currentOrgId,
        entityType: 'جهة اتصال مدمجة',
        originalId: dup.id,
        displayName: `${dup.fullName} (${dup.leadUniqueId || dup.id}) ← دُمج في ${master.leadUniqueId || master.fullName}`,
        deletedBy: currentUser.fullName,
        deletedAtLabel: 'الآن',
        expiresInDays: 30,
        payloadJson: JSON.stringify(dup),
      }));

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts
            .filter((c) => !dupIdSet.has(c.id))
            .map((c) => (c.id === master.id ? { ...c, ...masterUpdate } : c)),
          deals: prev.deals.map((d) =>
            (d.contactId && dupIdSet.has(d.contactId)) ||
            (d.leadUniqueId && dupUniqueIds.has(d.leadUniqueId))
              ? {
                  ...d,
                  contactId: master.id,
                  leadUniqueId: master.leadUniqueId || d.leadUniqueId,
                }
              : d
          ),
          touchpoints: prev.touchpoints.map((tp) =>
            (tp.relatedEntityType === 'contact' && dupIdSet.has(tp.relatedEntityId)) ||
            (tp.leadUniqueId && dupUniqueIds.has(tp.leadUniqueId))
              ? {
                  ...tp,
                  leadUniqueId: master.leadUniqueId || tp.leadUniqueId,
                  relatedEntityType: 'contact',
                  relatedEntityId: master.id,
                  relatedEntityName: input.resolvedFields.fullName ?? master.fullName,
                }
              : tp
          ),
          messages: prev.messages.map((msg) =>
            msg.leadUniqueId && dupUniqueIds.has(msg.leadUniqueId)
              ? {
                  ...msg,
                  leadUniqueId: master.leadUniqueId || msg.leadUniqueId,
                }
              : msg
          ),
          recycle_bin: [...recycleEntries, ...prev.recycle_bin],
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'contacts', master.id), {
          ...stripUndefined(masterUpdate),
          updatedAt: serverTimestamp(),
        });

        for (const d of data.deals) {
          if (
            (d.contactId && dupIdSet.has(d.contactId)) ||
            (d.leadUniqueId && dupUniqueIds.has(d.leadUniqueId))
          ) {
            batch.update(doc(db, 'deals', d.id), {
              contactId: master.id,
              leadUniqueId: master.leadUniqueId || d.leadUniqueId || '',
              updatedAt: serverTimestamp(),
            });
          }
        }

        for (const tp of data.touchpoints) {
          if (
            (tp.relatedEntityType === 'contact' && dupIdSet.has(tp.relatedEntityId)) ||
            (tp.leadUniqueId && dupUniqueIds.has(tp.leadUniqueId))
          ) {
            batch.update(doc(db, 'touchpoints', tp.id), {
              relatedEntityType: 'contact',
              relatedEntityId: master.id,
              relatedEntityName: input.resolvedFields.fullName ?? master.fullName,
              leadUniqueId: master.leadUniqueId || tp.leadUniqueId || '',
              updatedAt: serverTimestamp(),
            });
          }
        }

        for (const entry of recycleEntries) {
          const { id: rbId, ...rbRest } = entry;
          batch.set(doc(db, 'recycle_bin', rbId), {
            ...stripUndefined(rbRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const dupId of dupIds) {
          batch.delete(doc(db, 'contacts', dupId));
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'contacts_merge_duplicates');
      }
    },
    [
      currentOrgId,
      currentUser.fullName,
      data.contacts,
      data.deals,
      data.touchpoints,
      firebaseUser,
      setData,
    ]
  );

  const softDeleteContacts = useCallback(
    async (contactIds: string[]) => {
      if (contactIds.length === 0) return;
      const idSet = new Set(contactIds);
      const targets = data.contacts.filter((c) => idSet.has(c.id));
      if (targets.length === 0) return;

      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const recycleEntries: RecycleBinItem[] = targets.map((c, idx) => ({
        id: `rb_con_${Date.now()}_${idx}`,
        ownerId,
        org_id: currentOrgId,
        entityType: 'جهة اتصال',
        originalId: c.id,
        displayName: `${c.fullName} (${c.leadUniqueId || c.id})`,
        deletedBy: currentUser.fullName,
        deletedAtLabel: 'الآن',
        expiresInDays: 30,
        payloadJson: JSON.stringify(c),
      }));

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.filter((c) => !idSet.has(c.id)),
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
        for (const c of targets) {
          batch.delete(doc(db, 'contacts', c.id));
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'contacts_soft_delete');
      }
    },
    [currentOrgId, currentUser.fullName, data.contacts, firebaseUser, setData]
  );

  const addContactTouchpoint = useCallback(
    async (
      contactId: string,
      input: {
        channel: TouchpointChannel;
        summary: string;
        eventType?: string;
        campaign?: string;
      }
    ) => {
      const contact = data.contacts.find((c) => c.id === contactId);
      if (!contact || !input.summary.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const tpId = `tp_con_${Date.now()}`;

      const newTp: Touchpoint = {
        id: tpId,
        ownerId,
        org_id: currentOrgId,
        channel: input.channel,
        summary: input.summary.trim(),
        relatedEntityType: 'contact',
        relatedEntityId: contact.id,
        relatedEntityName: contact.fullName,
        occurredAt: 'الآن',
        leadUniqueId: contact.leadUniqueId,
        campaign: input.campaign?.trim() || contact.primarySource,
        eventType: input.eventType?.trim() || 'تواصل مع جهة الاتصال',
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          touchpoints: [newTp, ...prev.touchpoints],
          contacts: prev.contacts.map((c) =>
            c.id === contactId ? { ...c, lastActivityLabel: 'الآن' } : c
          ),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        const { id: _id, ...rest } = newTp;
        batch.set(doc(db, 'touchpoints', tpId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'contacts', contactId), {
          lastActivityLabel: 'الآن',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `touchpoints/${tpId}`);
      }
    },
    [currentOrgId, data.contacts, firebaseUser, setData]
  );

  const addContactTask = useCallback(
    async (
      contactId: string,
      input: {
        title: string;
        priority: CrmTask['priority'];
        dueDate: string;
        assignedToName?: string;
      }
    ) => {
      const contact = data.contacts.find((c) => c.id === contactId);
      if (!contact || !input.title.trim()) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const taskId = `task_con_${Date.now()}`;

      const newTask: CrmTask = {
        id: taskId,
        ownerId,
        org_id: currentOrgId,
        title: input.title.trim(),
        priority: input.priority,
        status: 'قيد التنفيذ',
        dueDate: input.dueDate,
        relatedTo: contact.fullName,
        assignedToName: input.assignedToName || contact.assignedToName || currentUser.fullName,
        leadUniqueId: contact.leadUniqueId,
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
    [currentOrgId, currentUser.fullName, data.contacts, firebaseUser, setData]
  );

  const createAccount = useCallback(
    async (input: CreateAccountInput): Promise<Account> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const newId = `acc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const cleanName = input.name.trim().slice(0, 150) || 'منشأة أعمال جديدة';
      const cleanIndustry = input.industry.trim().slice(0, 100) || 'تقنية المعلومات والبرمجيات';
      const cleanManager = (input.accountManager || currentUser.fullName || 'طارق العتيبي')
        .trim()
        .slice(0, 120);

      const newAcc: Account = {
        id: newId,
        ownerId,
        org_id: currentOrgId,
        name: cleanName,
        industry: cleanIndustry,
        city: input.city?.trim().slice(0, 80) || 'الرياض',
        tier: input.tier,
        annualRevenue: Math.max(0, Number(input.annualRevenue) || 0),
        employeesCount:
          input.employeesCount !== undefined
            ? Math.max(0, Number(input.employeesCount) || 0)
            : 120,
        website: input.website?.trim().slice(0, 200) || undefined,
        accountManager: cleanManager,
        leadUniqueId: input.leadUniqueId?.trim().slice(0, 16) || undefined,
      };

      setData((prev) => ({
        ...prev,
        accounts: [newAcc, ...prev.accounts],
      }));

      setSignals((prev) => [
        {
          id: `sig_acc_${Date.now()}`,
          org_id: currentOrgId,
          title: `تم تسجيل منشأة جديدة: ${newAcc.name}`,
          description: `التصنيف: ${newAcc.tier} · القطاع: ${newAcc.industry}`,
          category: 'deal',
          timeLabel: 'الآن',
          unread: true,
          route: `/accounts/${newAcc.id}`,
        },
        ...prev,
      ]);

      if (firebaseUser) {
        try {
          const { id: _id, ...rest } = newAcc;
          await setDoc(doc(db, 'accounts', newId), {
            ...stripUndefined(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `accounts/${newId}`);
        }
      }

      return newAcc;
    },
    [currentOrgId, currentUser.fullName, firebaseUser, setData, setSignals]
  );

  const updateAccountFields = useCallback(
    async (accountId: string, patch: Partial<Account>) => {
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === accountId ? { ...a, ...patch } : a
        ),
      }));

      if (!firebaseUser) return;
      const target = data.accounts.find((a) => a.id === accountId);
      if (!target) return;

      const allowedPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) allowedPatch.name = patch.name.trim().slice(0, 150);
      if (patch.industry !== undefined) allowedPatch.industry = patch.industry.trim().slice(0, 100);
      if (patch.city !== undefined) allowedPatch.city = patch.city.trim().slice(0, 80);
      if (patch.tier !== undefined) allowedPatch.tier = patch.tier;
      if (patch.annualRevenue !== undefined)
        allowedPatch.annualRevenue = Math.max(0, Number(patch.annualRevenue) || 0);
      if (patch.employeesCount !== undefined)
        allowedPatch.employeesCount = Math.max(0, Number(patch.employeesCount) || 0);
      if (patch.website !== undefined) allowedPatch.website = patch.website.trim().slice(0, 200);
      if (patch.accountManager !== undefined)
        allowedPatch.accountManager = patch.accountManager.trim().slice(0, 120);

      try {
        await updateDoc(doc(db, 'accounts', target.id), {
          ...stripUndefined(allowedPatch),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `accounts/${target.id}`);
      }
    },
    [data.accounts, firebaseUser, setData]
  );

  const scopedLeads = useMemo(
    () =>
      data.leads.filter(
        (l) => belongsToCurrentOrg(l.org_id) && canViewRecord(l.assignedToName || l.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.leads]
  );

  const scopedContacts = useMemo(
    () =>
      data.contacts.filter(
        (c) => belongsToCurrentOrg(c.org_id) && canViewRecord(c.assignedToName || c.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.contacts]
  );

  const scopedAccounts = useMemo(
    () =>
      data.accounts.filter(
        (a) => belongsToCurrentOrg(a.org_id) && canViewRecord(a.accountManager || a.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.accounts]
  );

  const scopedTouchpoints = useMemo(
    () => data.touchpoints.filter((t) => belongsToCurrentOrg(t.org_id)),
    [belongsToCurrentOrg, data.touchpoints]
  );

  const value = useMemo<LeadsContactsContextValue>(
    () => ({
      leads: scopedLeads,
      contacts: scopedContacts,
      accounts: scopedAccounts,
      touchpoints: scopedTouchpoints,
      createLead,
      importLeadsBatch,
      updateLeadFields,
      bulkUpdateLeads,
      bulkManageTags,
      bulkCreateTasksForLeads,
      mergeDuplicateLeads,
      softDeleteLeads,
      addLeadTouchpoint,
      addLeadTask,
      convertLead,
      createContact,
      importContactsBatch,
      updateContactFields,
      bulkUpdateContacts,
      bulkManageContactTags,
      bulkCreateTasksForContacts,
      mergeDuplicateContacts,
      softDeleteContacts,
      addContactTouchpoint,
      addContactTask,
      createAccount,
      updateAccountFields,
    }),
    [
      scopedLeads,
      scopedContacts,
      scopedAccounts,
      scopedTouchpoints,
      createLead,
      importLeadsBatch,
      updateLeadFields,
      bulkUpdateLeads,
      bulkManageTags,
      bulkCreateTasksForLeads,
      mergeDuplicateLeads,
      softDeleteLeads,
      addLeadTouchpoint,
      addLeadTask,
      convertLead,
      createContact,
      importContactsBatch,
      updateContactFields,
      bulkUpdateContacts,
      bulkManageContactTags,
      bulkCreateTasksForContacts,
      mergeDuplicateContacts,
      softDeleteContacts,
      addContactTouchpoint,
      addContactTask,
      createAccount,
      updateAccountFields,
    ]
  );

  return (
    <LeadsContactsContext.Provider value={value}>
      {children}
    </LeadsContactsContext.Provider>
  );
}

export function useLeadsContacts(): LeadsContactsContextValue {
  const ctx = useContext(LeadsContactsContext);
  if (!ctx) {
    throw new Error('useLeadsContacts must be used inside LeadsContactsProvider');
  }
  return ctx;
}
