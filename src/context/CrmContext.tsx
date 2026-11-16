import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from '../firebase';
import { buildSeedDataset, INITIAL_SIGNALS, type SeedDataset } from '../data/seedData';
import type {
  Account,
  Blueprint,
  Contact,
  ContactStatus,
  CrmModuleKey,
  CrmProfile,
  CrmRole,
  CrmTask,
  CrmUser,
  CustomField,
  Deal,
  DealStage,
  FieldAccessLevel,
  InboxMessage,
  Invoice,
  Lead,
  LeadChannel,
  LeadStatus,
  Quote,
  RecycleBinItem,
  SalesOrder,
  SignalNotification,
  Touchpoint,
  TouchpointChannel,
  WorkflowRule,
} from '../types/crm';
import { evaluateFieldAccess, generateLeadUniqueId } from '../utils/formatters';
import type { ParsedCsvContactDraft } from '../utils/contactsLogic';
import type { ParsedCsvLeadDraft } from '../utils/leadsLogic';

export interface QuickDealPayload {
  title: string;
  accountId: string;
  amount: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  nextStep?: string;
}

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

function stripUndefined<T extends object>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

interface CrmContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  currentUser: CrmUser;
  syncStatus: 'cloud' | 'preview' | 'syncing' | 'offline';
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;

  // Collections
  profiles: CrmProfile[];
  roles: CrmRole[];
  customFields: CustomField[];
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  touchpoints: Touchpoint[];
  messages: InboxMessage[];
  tasks: CrmTask[];
  blueprints: Blueprint[];
  workflows: WorkflowRule[];
  recycleBin: RecycleBinItem[];
  signals: SignalNotification[];

  // Active Profile & FLS
  activeProfile: CrmProfile | undefined;
  setActiveProfileId: (profileId: string) => void;
  canViewField: (module: CrmModuleKey, fieldKey: string) => boolean;
  canEditField: (module: CrmModuleKey, fieldKey: string) => boolean;
  getFieldAccess: (module: CrmModuleKey, fieldKey: string) => FieldAccessLevel;

  // Global Inbox Overlay State
  inboxOpen: boolean;
  inboxFilterLeadId: string | null;
  inboxFilterContactId: string | null;
  openInboxForLead: (leadId?: string) => void;
  openInboxForContact: (contactId?: string) => void;
  closeInbox: () => void;
  clearInboxLeadFilter: () => void;
  clearInboxContactFilter: () => void;

  // Actions
  createQuickDeal: (payload: QuickDealPayload) => Promise<void>;
  toggleTaskStatus: (taskId: string) => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  sendInboxReply: (
    channel: InboxMessage['channel'],
    recipientName: string,
    body: string,
    meta?: { leadId?: string; contactId?: string; leadUniqueId?: string; companyName?: string }
  ) => Promise<void>;
  markAllSignalsRead: () => void;
  createProfile: (input: { name: string; description: string }) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  restoreRecycleItem: (itemId: string) => Promise<void>;

  // Contacts Module Actions
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
  createDealForContact: (input: CreateContactDealInput) => Promise<Deal>;

  // Leads Module Actions
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

  // Deals Module Actions
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

const CrmContext = createContext<CrmContextValue | null>(null);

const PREVIEW_OWNER_ID = 'preview-user';

function createInitialPreviewUser(): CrmUser {
  return {
    id: 'user_preview',
    uid: PREVIEW_OWNER_ID,
    fullName: 'سلمان عبد العزيز القحطاني',
    email: 's.alqahtani@riwaq-crm.sa',
    jobTitle: 'مدير المبيعات التنفيذي',
    profileId: 'prof_admin',
    roleId: 'role_exec_director',
    department: 'مبيعات المؤسسات',
    status: 'active',
  };
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const initialSeed = useMemo(() => buildSeedDataset(PREVIEW_OWNER_ID), []);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'cloud' | 'preview' | 'syncing' | 'offline'>('preview');
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<CrmUser>(createInitialPreviewUser);
  const [data, setData] = useState<SeedDataset>(initialSeed);
  const [signals, setSignals] = useState<SignalNotification[]>(INITIAL_SIGNALS);

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxFilterLeadId, setInboxFilterLeadId] = useState<string | null>(null);
  const [inboxFilterContactId, setInboxFilterContactId] = useState<string | null>(null);

  useEffect(() => {
    void testConnection().then((ok) => {
      if (!ok) setSyncStatus('offline');
    });
  }, []);

  const seedFirestoreIfEmpty = useCallback(async (uid: string) => {
    const leadsRef = collection(db, 'leads');
    const existingLeadsSnap = await getDocs(query(leadsRef, where('ownerId', '==', uid), limit(1)));
    const profilesSnap = await getDocs(
      query(collection(db, 'profiles'), where('ownerId', '==', uid), limit(1))
    );

    if (!existingLeadsSnap.empty && !profilesSnap.empty) {
      return;
    }

    const seed = buildSeedDataset(uid);
    const batch = writeBatch(db);

    const collectionsMap: Array<[string, Array<{ id: string } & object>]> = [
      ['profiles', seed.profiles],
      ['roles', seed.roles],
      ['custom_fields', seed.custom_fields],
      ['accounts', seed.accounts],
      ['contacts', seed.contacts],
      ['leads', seed.leads],
      ['deals', seed.deals],
      ['quotes', seed.quotes],
      ['sales_orders', seed.sales_orders],
      ['invoices', seed.invoices],
      ['touchpoints', seed.touchpoints],
      ['messages', seed.messages],
      ['tasks', seed.tasks],
      ['blueprints', seed.blueprints],
      ['workflows', seed.workflows],
      ['recycle_bin', seed.recycle_bin],
    ];

    for (const [colName, items] of collectionsMap) {
      for (const item of items) {
        const { id: docId, ...rest } = item;
        const ref = doc(db, colName, `${uid.slice(0, 8)}_${docId}`);
        batch.set(ref, {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch_seed');
    }
  }, []);

  const ensureUserDoc = useCallback(async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const newUserPayload = {
          uid: user.uid,
          fullName: user.displayName || 'موظف رواق',
          email: user.email || 'user@riwaq-crm.sa',
          jobTitle: 'مدير المبيعات التنفيذي',
          profileId: 'prof_admin',
          roleId: 'role_exec_director',
          department: 'مبيعات المؤسسات',
          avatarUrl: user.photoURL || '',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newUserPayload);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setSyncStatus('preview');
        setCurrentUser(createInitialPreviewUser());
        setData(buildSeedDataset(PREVIEW_OWNER_ID));
        return;
      }

      setSyncStatus('syncing');
      try {
        await ensureUserDoc(user);
        await seedFirestoreIfEmpty(user.uid);
        setSyncStatus('cloud');
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubAuth();
  }, [ensureUserDoc, seedFirestoreIfEmpty]);

  useEffect(() => {
    if (!authReady || !firebaseUser) {
      return;
    }

    const uid = firebaseUser.uid;
    const unsubscribers: Array<() => void> = [];

    const userDocRef = doc(db, 'users', uid);
    unsubscribers.push(
      onSnapshot(
        userDocRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.data();
            setCurrentUser({
              id: snap.id,
              uid: String(val.uid ?? uid),
              fullName: String(val.fullName ?? firebaseUser.displayName ?? 'موظف رواق'),
              email: String(val.email ?? firebaseUser.email ?? ''),
              jobTitle: val.jobTitle ? String(val.jobTitle) : 'مدير المبيعات التنفيذي',
              profileId: String(val.profileId ?? 'prof_admin'),
              roleId: String(val.roleId ?? 'role_exec_director'),
              department: val.department ? String(val.department) : 'مبيعات المؤسسات',
              avatarUrl: val.avatarUrl ? String(val.avatarUrl) : '',
              status: val.status === 'inactive' ? 'inactive' : 'active',
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${uid}`);
        }
      )
    );

    const subscribeCollection = <K extends keyof SeedDataset>(colName: K) => {
      const q = query(collection(db, colName), where('ownerId', '==', uid));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as unknown as SeedDataset[K];
          setData((prev) => ({
            ...prev,
            [colName]: items,
          }));
          setSyncStatus('cloud');
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, colName);
        }
      );
      unsubscribers.push(unsub);
    };

    (
      [
        'profiles',
        'roles',
        'custom_fields',
        'accounts',
        'contacts',
        'leads',
        'deals',
        'quotes',
        'sales_orders',
        'invoices',
        'touchpoints',
        'messages',
        'tasks',
        'blueprints',
        'workflows',
        'recycle_bin',
      ] as Array<keyof SeedDataset>
    ).forEach(subscribeCollection);

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google';
      setAuthError(msg);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const activeProfile = useMemo(() => {
    const matched = data.profiles.find(
      (p) => p.id === currentUser.profileId || p.id.endsWith(`_${currentUser.profileId}`)
    );
    return matched ?? data.profiles[0];
  }, [data.profiles, currentUser.profileId]);

  const setActiveProfileId = useCallback((profileId: string) => {
    setCurrentUser((prev) => ({ ...prev, profileId }));
  }, []);

  const getFieldAccess = useCallback(
    (module: CrmModuleKey, fieldKey: string): FieldAccessLevel => {
      return evaluateFieldAccess(activeProfile, module, fieldKey);
    },
    [activeProfile]
  );

  const canViewField = useCallback(
    (module: CrmModuleKey, fieldKey: string) => getFieldAccess(module, fieldKey) !== 'hidden',
    [getFieldAccess]
  );

  const canEditField = useCallback(
    (module: CrmModuleKey, fieldKey: string) => getFieldAccess(module, fieldKey) === 'read_write',
    [getFieldAccess]
  );

  const openInboxForLead = useCallback((leadId?: string) => {
    setInboxFilterContactId(null);
    setInboxFilterLeadId(leadId ?? null);
    setInboxOpen(true);
  }, []);

  const openInboxForContact = useCallback((contactId?: string) => {
    setInboxFilterLeadId(null);
    setInboxFilterContactId(contactId ?? null);
    setInboxOpen(true);
  }, []);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
  }, []);

  const clearInboxLeadFilter = useCallback(() => {
    setInboxFilterLeadId(null);
  }, []);

  const clearInboxContactFilter = useCallback(() => {
    setInboxFilterContactId(null);
  }, []);

  const createQuickDeal = useCallback(
    async (payload: QuickDealPayload) => {
      const account = data.accounts.find((a) => a.id === payload.accountId);
      const accountName = account ? account.name : 'حساب مؤسسة';
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const newId = `deal_${Date.now()}`;

      const newDeal: Deal = {
        id: newId,
        ownerId,
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
    [currentUser.fullName, data.accounts, firebaseUser]
  );

  const toggleTaskStatus = useCallback(
    async (taskId: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const nextStatus: CrmTask['status'] = task.status === 'مكتملة' ? 'قيد التنفيذ' : 'مكتملة';

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      }
    },
    [data.tasks, firebaseUser]
  );

  const markMessageRead = useCallback(
    async (messageId: string) => {
      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          messages: prev.messages.map((m) => (m.id === messageId ? { ...m, unread: false } : m)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'messages', messageId), {
          unread: false,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
      }
    },
    [firebaseUser]
  );

  const sendInboxReply = useCallback(
    async (
      channel: InboxMessage['channel'],
      recipientName: string,
      body: string,
      meta?: { leadId?: string; contactId?: string; leadUniqueId?: string; companyName?: string }
    ) => {
      const cleanBody = body.trim();
      if (!cleanBody) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const msgId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newMsg: InboxMessage = {
        id: msgId,
        ownerId,
        channel,
        senderName: currentUser.fullName,
        companyName: meta?.companyName ?? recipientName,
        subject: `رد صادر إلى ${recipientName}`,
        body: cleanBody,
        direction: 'outbound',
        unread: false,
        timestampLabel: 'الآن',
        leadId: meta?.leadId,
        leadUniqueId: meta?.leadUniqueId,
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          messages: [newMsg, ...prev.messages],
          leads: meta?.leadId
            ? prev.leads.map((l) =>
                l.id === meta.leadId
                  ? {
                      ...l,
                      awaitingReplyHours: 0,
                      lastActivityLabel: 'الآن',
                      lastMessageSnippet: cleanBody,
                    }
                  : l
              )
            : prev.leads,
          contacts: meta?.contactId
            ? prev.contacts.map((c) =>
                c.id === meta.contactId
                  ? {
                      ...c,
                      lastActivityLabel: 'الآن',
                      lastMessageSnippet: cleanBody,
                    }
                  : c
              )
            : prev.contacts,
        }));
        return;
      }

      try {
        const { id: _id, ...rest } = newMsg;
        await setDoc(doc(db, 'messages', msgId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (meta?.leadId) {
          await updateDoc(doc(db, 'leads', meta.leadId), {
            awaitingReplyHours: 0,
            lastActivityLabel: 'الآن',
            lastMessageSnippet: cleanBody.slice(0, 280),
            updatedAt: serverTimestamp(),
          });
        }
        if (meta?.contactId) {
          await updateDoc(doc(db, 'contacts', meta.contactId), {
            lastActivityLabel: 'الآن',
            lastMessageSnippet: cleanBody.slice(0, 280),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `messages/${msgId}`);
      }
    },
    [currentUser.fullName, firebaseUser]
  );

  const markAllSignalsRead = useCallback(() => {
    setSignals((prev) => prev.map((s) => ({ ...s, unread: false })));
  }, []);

  const createProfile = useCallback(
    async (input: { name: string; description: string }) => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const profileId = `prof_${Date.now()}`;
      const newProfile: CrmProfile = {
        id: profileId,
        ownerId,
        name: input.name.trim(),
        description: input.description.trim(),
        isSystem: false,
        modulePermissions: {
          leads: { create: true, read: true, update: true, delete: false },
          contacts: { create: true, read: true, update: true, delete: false },
          accounts: { create: false, read: true, update: true, delete: false },
          deals: { create: true, read: true, update: true, delete: false },
          quotes: { create: true, read: true, update: false, delete: false },
          sales_orders: { create: false, read: true, update: false, delete: false },
          invoices: { create: false, read: true, update: false, delete: false },
          tasks: { create: true, read: true, update: true, delete: false },
        },
        fieldSecurity: {
          leads: { estimatedValue: 'read_only', approvedBudget: 'hidden' },
          deals: { amount: 'read_only' },
          invoices: { paidAmount: 'hidden' },
        },
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          profiles: [...prev.profiles, newProfile],
        }));
        return;
      }

      try {
        const { id: _id, ...rest } = newProfile;
        await setDoc(doc(db, 'profiles', profileId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `profiles/${profileId}`);
      }
    },
    [firebaseUser]
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const target = data.profiles.find((p) => p.id === profileId);
      if (!target || target.isSystem) return;

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          profiles: prev.profiles.filter((p) => p.id !== profileId),
        }));
        return;
      }

      try {
        await deleteDoc(doc(db, 'profiles', profileId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `profiles/${profileId}`);
      }
    },
    [data.profiles, firebaseUser]
  );

  const restoreRecycleItem = useCallback(
    async (itemId: string) => {
      const item = data.recycle_bin.find((r) => r.id === itemId);
      let parsedLead: Lead | null = null;
      let parsedContact: Contact | null = null;
      let parsedDeal: Deal | null = null;
      if (
        (item?.entityType === 'عميل محتمل' || item?.entityType === 'عميل محتمل مدمج') &&
        item.payloadJson
      ) {
        try {
          parsedLead = JSON.parse(item.payloadJson) as Lead;
        } catch {
          parsedLead = null;
        }
      } else if (
        (item?.entityType === 'جهة اتصال' || item?.entityType === 'جهة اتصال مدمجة') &&
        item.payloadJson
      ) {
        try {
          parsedContact = JSON.parse(item.payloadJson) as Contact;
        } catch {
          parsedContact = null;
        }
      } else if (item?.entityType === 'صفقة' && item.payloadJson) {
        try {
          parsedDeal = JSON.parse(item.payloadJson) as Deal;
        } catch {
          parsedDeal = null;
        }
      }

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          leads: parsedLead ? [parsedLead, ...prev.leads] : prev.leads,
          contacts: parsedContact ? [parsedContact, ...prev.contacts] : prev.contacts,
          deals: parsedDeal ? [parsedDeal, ...prev.deals] : prev.deals,
          recycle_bin: prev.recycle_bin.filter((r) => r.id !== itemId),
        }));
        return;
      }

      try {
        const batch = writeBatch(db);
        if (parsedLead) {
          const { id: leadDocId, ...leadRest } = parsedLead;
          batch.set(doc(db, 'leads', leadDocId), {
            ...stripUndefined(leadRest),
            ownerId: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        if (parsedContact) {
          const { id: contactDocId, ...contactRest } = parsedContact;
          batch.set(doc(db, 'contacts', contactDocId), {
            ...stripUndefined(contactRest),
            ownerId: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        if (parsedDeal) {
          const { id: dealDocId, ...dealRest } = parsedDeal;
          batch.set(doc(db, 'deals', dealDocId), {
            ...stripUndefined(dealRest),
            ownerId: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        batch.delete(doc(db, 'recycle_bin', itemId));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `recycle_bin/${itemId}`);
      }
    },
    [data.recycle_bin, firebaseUser]
  );

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
    [currentUser.fullName, data.leads, firebaseUser]
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
    [data.leads, firebaseUser]
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
    [firebaseUser]
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
    [firebaseUser]
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
    [data.leads, firebaseUser]
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
    [currentUser.fullName, data.leads, firebaseUser]
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
    [currentUser.fullName, data.leads, data.messages, data.tasks, data.touchpoints, firebaseUser]
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
    [currentUser.fullName, data.leads, firebaseUser]
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
    [data.leads, firebaseUser]
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
    [currentUser.fullName, data.leads, firebaseUser]
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

      // 1. Account (Optional)
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
          name: resolvedAccountName,
          industry: input.accountIndustry?.trim() || 'التقنية والأعمال',
          city: input.contactCity || lead.city || 'الرياض',
          tier: input.accountTier || 'مؤسسات',
          annualRevenue: Math.max((lead.estimatedValue || 100000) * 8, 1200000),
          accountManager: lead.assignedToName || currentUser.fullName,
          leadUniqueId: lead.unique_id,
        };
      }

      // 2. Contact (Mandatory)
      let resolvedContactId = '';
      let newContact: Contact | null = null;

      if (input.contactMode === 'existing' && input.existingContactId) {
        resolvedContactId = input.existingContactId;
      } else {
        resolvedContactId = `con_conv_${Date.now()}`;
        newContact = {
          id: resolvedContactId,
          ownerId,
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

      // 3. Deal (Optional)
      let resolvedDealId: string | undefined;
      let newDeal: Deal | null = null;
      if (input.createDeal) {
        resolvedDealId = `deal_conv_${Date.now()}`;
        newDeal = {
          id: resolvedDealId,
          ownerId,
          title: input.dealTitle?.trim() || `صفقة ${lead.fullName}`,
          accountId: resolvedAccountId || 'unassigned',
          accountName: resolvedAccountName,
          amount:
            input.dealAmount && input.dealAmount > 0 ? input.dealAmount : lead.estimatedValue || 100000,
          currency: 'SAR',
          stage: input.dealStage || 'تحديد الاحتياج',
          probability: 50,
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
    [currentUser.fullName, data.accounts, data.leads, data.touchpoints, firebaseUser]
  );

  // ==========================================
  // Contacts Module Real-Time Actions
  // ==========================================
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
    [currentUser.fullName, data.accounts, data.contacts, data.leads, firebaseUser]
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
    [data.accounts, data.contacts, data.leads, firebaseUser]
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
    [firebaseUser]
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
    [firebaseUser]
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
    [data.contacts, firebaseUser]
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
    [currentUser.fullName, data.contacts, firebaseUser]
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
    [currentUser.fullName, data.contacts, data.deals, data.touchpoints, firebaseUser]
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
    [currentUser.fullName, data.contacts, firebaseUser]
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
    [data.contacts, firebaseUser]
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
    [currentUser.fullName, data.contacts, firebaseUser]
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
    [currentUser.fullName, data.contacts, firebaseUser]
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
        title: input.title.trim(),
        accountId: account?.id || input.accountId || 'unassigned',
        accountName: account?.name || input.accountName?.trim() || contact?.accountName || 'عميل فردي B2C',
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
    [currentUser.fullName, data.accounts, data.contacts, firebaseUser]
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
    [data.deals, firebaseUser]
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
    [firebaseUser]
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
    [currentUser.fullName, data.deals, firebaseUser]
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
    [data.deals, firebaseUser]
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
    [currentUser.fullName, data.deals, firebaseUser]
  );

  const value: CrmContextValue = {
    authReady,
    firebaseUser,
    currentUser,
    syncStatus,
    authError,
    signInWithGoogle,
    signOutUser,
    profiles: data.profiles,
    roles: data.roles,
    customFields: data.custom_fields,
    accounts: data.accounts,
    contacts: data.contacts,
    leads: data.leads,
    deals: data.deals,
    quotes: data.quotes,
    salesOrders: data.sales_orders,
    invoices: data.invoices,
    touchpoints: data.touchpoints,
    messages: data.messages,
    tasks: data.tasks,
    blueprints: data.blueprints,
    workflows: data.workflows,
    recycleBin: data.recycle_bin,
    signals,
    activeProfile,
    setActiveProfileId,
    canViewField,
    canEditField,
    getFieldAccess,
    inboxOpen,
    inboxFilterLeadId,
    inboxFilterContactId,
    openInboxForLead,
    openInboxForContact,
    closeInbox,
    clearInboxLeadFilter,
    clearInboxContactFilter,
    createQuickDeal,
    toggleTaskStatus,
    markMessageRead,
    sendInboxReply,
    markAllSignalsRead,
    createProfile,
    deleteProfile,
    restoreRecycleItem,
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
    createDealForContact,
    createDeal,
    updateDealFields,
    bulkUpdateDeals,
    softDeleteDeals,
    addDealTouchpoint,
    addDealTask,
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) {
    throw new Error('useCrm must be used inside CrmProvider');
  }
  return ctx;
}
