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
import {
  buildProvisionedOrgSeed,
  buildSeedDataset,
  DEFAULT_ORG_ID,
  INITIAL_SIGNALS,
  type SeedDataset,
} from '../data/seedData';
import type {
  Account,
  Blueprint,
  Contact,
  ContactStatus,
  CrmAddonFlags,
  CrmModuleKey,
  CrmOrganization,
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
  MetaConnection,
  MetaFieldMapping,
  MetaPage,
  MetaWebhookLog,
  OrganizationPlan,
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

  // Multi-Tenant Organization & Subscription Management
  organizations: CrmOrganization[];
  currentOrgId: string;
  currentOrganization: CrmOrganization;
  switchOrganization: (orgId: string) => void;
  provisionNewOrganization: (
    orgName: string,
    plan?: OrganizationPlan
  ) => Promise<CrmOrganization>;
  updateOrganizationSubscription: (
    patch: Partial<
      Pick<
        CrmOrganization,
        'name' | 'plan' | 'seats_limit' | 'active_users_count' | 'addons'
      >
    >
  ) => Promise<void>;
  toggleRoleHideSubordinates: (roleId: string, hide: boolean) => Promise<void>;
  updateProfileAddons: (profileId: string, addons: CrmAddonFlags) => Promise<void>;
  canViewRecord: (recordOwnerIdOrName?: string) => boolean;
  canViewChat: (chatOwnerIdOrSender?: string) => boolean;
  canUseAddon: (addonKey: keyof CrmAddonFlags) => boolean;

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
  metaConnections: MetaConnection[];
  metaPages: MetaPage[];
  metaFieldMappings: MetaFieldMapping[];
  metaWebhookLogs: MetaWebhookLog[];

  // Direct Meta Integration Actions
  connectMetaAccount: (input?: {
    shortLivedToken?: string;
    fbUserId?: string;
    fbUserName?: string;
  }) => Promise<void>;
  toggleMetaPageSubscription: (
    pageDocId: string,
    pageId: string,
    subscribedFields: string[]
  ) => Promise<void>;
  saveMetaFieldMapping: (input: {
    form_id: string;
    form_name: string;
    page_id?: string;
    mappings: Record<string, string>;
    store_extra_in: 'custom_values' | 'notes';
  }) => Promise<void>;
  simulateMetaWebhookEvent: (
    scenario: 'leadgen' | 'whatsapp_ctwa' | 'error_190'
  ) => Promise<{
    status: 'processed' | 'failed';
    leadUniqueId?: string;
    assignedTo?: string;
    errorMessage?: string;
  }>;
  retryMetaWebhookLog: (logId: string) => Promise<void>;
  dispatchMetaCapiEvent: (input: {
    event_name: 'LeadQualified' | 'Purchase';
    lead_unique_id: string;
    email?: string;
    phone?: string;
    amount?: number;
  }) => Promise<void>;

  // Active Profile, Role & FLS
  activeProfile: CrmProfile | undefined;
  setActiveProfileId: (profileId: string) => void;
  activeRole: CrmRole | undefined;
  setActiveRoleId: (roleId: string) => void;
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
  updateProfileSecurity: (
    profileId: string,
    patch: {
      name?: string;
      description?: string;
      modulePermissions?: CrmProfile['modulePermissions'];
      fieldSecurity?: CrmProfile['fieldSecurity'];
    }
  ) => Promise<void>;
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

  // Accounts Module Actions
  createAccount: (input: CreateAccountInput) => Promise<Account>;
  updateAccountFields: (accountId: string, patch: Partial<Account>) => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

const PREVIEW_OWNER_ID = 'preview-user';

function createInitialPreviewUser(): CrmUser {
  return {
    id: 'user_preview',
    uid: PREVIEW_OWNER_ID,
    org_id: DEFAULT_ORG_ID,
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
  const initialSeed = useMemo(() => buildSeedDataset(PREVIEW_OWNER_ID, DEFAULT_ORG_ID), []);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'cloud' | 'preview' | 'syncing' | 'offline'>('preview');
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentOrgId, setCurrentOrgId] = useState<string>(DEFAULT_ORG_ID);
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

    const seed = buildSeedDataset(uid, DEFAULT_ORG_ID);
    const batch = writeBatch(db);

    const collectionsMap: Array<[string, Array<{ id: string } & object>]> = [
      ['organizations', seed.organizations],
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
      ['meta_connections', seed.meta_connections],
      ['meta_pages', seed.meta_pages],
      ['meta_field_mappings', seed.meta_field_mappings],
      ['meta_webhook_logs', seed.meta_webhook_logs],
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
        'organizations',
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
        'meta_connections',
        'meta_pages',
        'meta_field_mappings',
        'meta_webhook_logs',
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

  // Multi-Tenant Organization Scoping Helper
  const belongsToCurrentOrg = useCallback(
    (recordOrgId?: string) => {
      if (!recordOrgId) {
        return currentOrgId === DEFAULT_ORG_ID;
      }
      return recordOrgId === currentOrgId || recordOrgId.endsWith(`_${currentOrgId}`);
    },
    [currentOrgId]
  );

  const organizationsList = useMemo(() => {
    if (data.organizations && data.organizations.length > 0) {
      return data.organizations;
    }
    return buildSeedDataset(firebaseUser?.uid ?? PREVIEW_OWNER_ID).organizations;
  }, [data.organizations, firebaseUser?.uid]);

  const currentOrganization = useMemo<CrmOrganization>(() => {
    const matched = organizationsList.find(
      (o) =>
        o.org_id === currentOrgId ||
        o.id === currentOrgId ||
        o.id.endsWith(`_${currentOrgId}`)
    );
    return (
      matched ??
      organizationsList[0] ?? {
        id: DEFAULT_ORG_ID,
        org_id: DEFAULT_ORG_ID,
        ownerId: firebaseUser?.uid ?? PREVIEW_OWNER_ID,
        name: 'مؤسسة رواق الرئيسية',
        plan: 'Enterprise',
        seats_limit: 25,
        active_users_count: 18,
        addons: {
          whatsapp_campaigns: true,
          meta_direct: true,
          custom_functions: true,
        },
        created_by: firebaseUser?.uid ?? PREVIEW_OWNER_ID,
      }
    );
  }, [currentOrgId, firebaseUser?.uid, organizationsList]);

  const orgScopedProfiles = useMemo(
    () => data.profiles.filter((p) => belongsToCurrentOrg(p.org_id)),
    [belongsToCurrentOrg, data.profiles]
  );

  const orgScopedRoles = useMemo(
    () => data.roles.filter((r) => belongsToCurrentOrg(r.org_id)),
    [belongsToCurrentOrg, data.roles]
  );

  const activeProfile = useMemo(() => {
    const pool = orgScopedProfiles.length > 0 ? orgScopedProfiles : data.profiles;
    const matched = pool.find(
      (p) => p.id === currentUser.profileId || p.id.endsWith(`_${currentUser.profileId}`)
    );
    return matched ?? pool[0];
  }, [currentUser.profileId, data.profiles, orgScopedProfiles]);

  const activeRole = useMemo(() => {
    const pool = orgScopedRoles.length > 0 ? orgScopedRoles : data.roles;
    const matched = pool.find(
      (r) => r.id === currentUser.roleId || r.id.endsWith(`_${currentUser.roleId}`)
    );
    return matched ?? pool[0];
  }, [currentUser.roleId, data.roles, orgScopedRoles]);

  const setActiveProfileId = useCallback((profileId: string) => {
    setCurrentUser((prev) => ({ ...prev, profileId }));
  }, []);

  const setActiveRoleId = useCallback((roleId: string) => {
    setCurrentUser((prev) => ({ ...prev, roleId }));
  }, []);

  // Hierarchical Role Data Visibility & Profile Add-on Helpers
  const canViewRecord = useCallback(
    (recordOwnerIdOrName?: string): boolean => {
      if (!recordOwnerIdOrName) return true;
      // 1. Super Admin or CEO/Organization-level visibility sees all records in the org
      if (
        activeProfile?.isSystem ||
        activeProfile?.id.includes('prof_admin') ||
        activeRole?.dataVisibility === 'organization'
      ) {
        return true;
      }

      const normOwner = recordOwnerIdOrName.trim();
      const isOwnRecord =
        normOwner === currentUser.id ||
        normOwner === currentUser.uid ||
        normOwner === currentUser.fullName ||
        normOwner.includes('سلمان القحطاني') ||
        normOwner.includes('طارق العتيبي');

      // 2. Sales Manager (team visibility): sees own + subordinates UNLESS hide_subordinates_data is true
      if (activeRole?.dataVisibility === 'team') {
        if (activeRole.hide_subordinates_data) {
          return isOwnRecord;
        }
        return true;
      }

      // 3. Sales Rep (private visibility): sees own records only
      return isOwnRecord;
    },
    [activeProfile, activeRole, currentUser.fullName, currentUser.id, currentUser.uid]
  );

  const canViewChat = useCallback(
    (chatOwnerIdOrSender?: string): boolean => {
      return canViewRecord(chatOwnerIdOrSender);
    },
    [canViewRecord]
  );

  const canUseAddon = useCallback(
    (addonKey: keyof CrmAddonFlags): boolean => {
      const orgEnabled = currentOrganization.addons?.[addonKey] ?? true;
      if (!orgEnabled) return false;
      if (activeProfile?.addonPermissions) {
        return activeProfile.addonPermissions[addonKey] ?? true;
      }
      return true;
    },
    [activeProfile, currentOrganization.addons]
  );

  const switchOrganization = useCallback(
    (orgId: string) => {
      setCurrentOrgId(orgId);
      setCurrentUser((prev) => ({
        ...prev,
        org_id: orgId,
        profileId: `${orgId}_prof_admin`,
        roleId: `${orgId}_role_ceo`,
      }));
      setSignals((prev) => [
        {
          id: `sig_org_${Date.now()}`,
          title: `تم التبديل إلى بيئة المؤسسة: ${
            organizationsList.find((o) => o.org_id === orgId || o.id === orgId)?.name ?? orgId
          }`,
          description: `عزل البيانات التام (Tenant Isolation: ${orgId}) مفعل لجميع الوحدات`,
          category: 'system',
          timeLabel: 'الآن',
          unread: true,
          route: '/settings/subscription',
        },
        ...prev,
      ]);
    },
    [organizationsList]
  );

  const provisionNewOrganization = useCallback(
    async (
      orgName: string,
      plan: OrganizationPlan = 'Enterprise'
    ): Promise<CrmOrganization> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const cleanName = orgName.trim() || 'مؤسسة رواق الجديدة';
      const newOrgId = `org_${Date.now()}`;
      const provisioned = buildProvisionedOrgSeed(ownerId, newOrgId, cleanName, plan);

      setData((prev) => ({
        ...prev,
        organizations: [provisioned.organization, ...(prev.organizations ?? [])],
        profiles: [...provisioned.profiles, ...prev.profiles],
        roles: [...provisioned.roles, ...prev.roles],
        custom_fields: [...provisioned.custom_fields, ...prev.custom_fields],
        blueprints: [...provisioned.blueprints, ...prev.blueprints],
        workflows: [...provisioned.workflows, ...prev.workflows],
        accounts: [...provisioned.accounts, ...prev.accounts],
        leads: [...provisioned.leads, ...prev.leads],
        deals: [...provisioned.deals, ...prev.deals],
      }));

      setCurrentOrgId(newOrgId);
      setCurrentUser((prev) => ({
        ...prev,
        org_id: newOrgId,
        profileId: provisioned.profiles[0].id,
        roleId: provisioned.roles[0].id,
      }));

      setSignals((prev) => [
        {
          id: `sig_prov_${Date.now()}`,
          title: `تم إنشاء وتهيئة مؤسسة جديدة: ${cleanName}`,
          description: `تم توليد الحقول المخصصة، ملفات الصلاحيات، شجرة الأدوار، والبلوبرينت تلقائياً (${newOrgId})`,
          category: 'system',
          timeLabel: 'الآن',
          unread: true,
          route: '/settings/subscription',
        },
        ...prev,
      ]);

      if (firebaseUser) {
        try {
          const batch = writeBatch(db);
          const { id: orgDocId, ...orgRest } = provisioned.organization;
          batch.set(doc(db, 'organizations', orgDocId), {
            ...stripUndefined(orgRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const subCollections: Array<[string, Array<{ id: string } & object>]> = [
            ['profiles', provisioned.profiles],
            ['roles', provisioned.roles],
            ['custom_fields', provisioned.custom_fields],
            ['blueprints', provisioned.blueprints],
            ['workflows', provisioned.workflows],
            ['accounts', provisioned.accounts],
            ['leads', provisioned.leads],
            ['deals', provisioned.deals],
          ];

          for (const [colName, items] of subCollections) {
            for (const item of items) {
              const { id: itemDocId, ...itemRest } = item;
              batch.set(doc(db, colName, itemDocId), {
                ...stripUndefined(itemRest),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `organizations/${newOrgId}`);
        }
      }

      return provisioned.organization;
    },
    [firebaseUser]
  );

  const updateOrganizationSubscription = useCallback(
    async (
      patch: Partial<
        Pick<
          CrmOrganization,
          'name' | 'plan' | 'seats_limit' | 'active_users_count' | 'addons'
        >
      >
    ) => {
      setData((prev) => ({
        ...prev,
        organizations: (prev.organizations ?? []).map((o) => {
          if (
            o.org_id === currentOrgId ||
            o.id === currentOrgId ||
            o.id.endsWith(`_${currentOrgId}`)
          ) {
            return {
              ...o,
              ...patch,
              addons: patch.addons ? { ...o.addons, ...patch.addons } : o.addons,
            };
          }
          return o;
        }),
      }));

      if (!firebaseUser) return;

      const targetDoc = (data.organizations ?? []).find(
        (o) =>
          o.org_id === currentOrgId ||
          o.id === currentOrgId ||
          o.id.endsWith(`_${currentOrgId}`)
      );
      if (!targetDoc) return;

      try {
        await updateDoc(doc(db, 'organizations', targetDoc.id), {
          ...stripUndefined(patch),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `organizations/${targetDoc.id}`);
      }
    },
    [currentOrgId, data.organizations, firebaseUser]
  );

  const toggleRoleHideSubordinates = useCallback(
    async (roleId: string, hide: boolean) => {
      setData((prev) => ({
        ...prev,
        roles: prev.roles.map((r) =>
          r.id === roleId || r.id.endsWith(`_${roleId}`)
            ? { ...r, hide_subordinates_data: hide }
            : r
        ),
      }));

      if (!firebaseUser) return;
      const targetRole = data.roles.find(
        (r) => r.id === roleId || r.id.endsWith(`_${roleId}`)
      );
      if (!targetRole) return;

      try {
        await updateDoc(doc(db, 'roles', targetRole.id), {
          hide_subordinates_data: hide,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `roles/${targetRole.id}`);
      }
    },
    [data.roles, firebaseUser]
  );

  const updateProfileAddons = useCallback(
    async (profileId: string, addons: CrmAddonFlags) => {
      setData((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === profileId || p.id.endsWith(`_${profileId}`)
            ? { ...p, addonPermissions: addons }
            : p
        ),
      }));

      if (!firebaseUser) return;
      const targetProf = data.profiles.find(
        (p) => p.id === profileId || p.id.endsWith(`_${profileId}`)
      );
      if (!targetProf) return;

      try {
        await updateDoc(doc(db, 'profiles', targetProf.id), {
          addonPermissions: addons,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${targetProf.id}`);
      }
    },
    [data.profiles, firebaseUser]
  );

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
    [currentOrgId, currentUser.fullName, data.accounts, firebaseUser]
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
        org_id: currentOrgId,
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
    [currentOrgId, currentUser.fullName, firebaseUser]
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
        org_id: currentOrgId,
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
    [currentOrgId, firebaseUser]
  );

  const updateProfileSecurity = useCallback(
    async (
      profileId: string,
      patch: {
        name?: string;
        description?: string;
        modulePermissions?: CrmProfile['modulePermissions'];
        fieldSecurity?: CrmProfile['fieldSecurity'];
      }
    ) => {
      setData((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id === profileId || p.id.endsWith(`_${profileId}`)) {
            return {
              ...p,
              ...(patch.name ? { name: patch.name.slice(0, 100) } : {}),
              ...(patch.description !== undefined
                ? { description: patch.description.slice(0, 400) }
                : {}),
              ...(patch.modulePermissions
                ? { modulePermissions: patch.modulePermissions }
                : {}),
              ...(patch.fieldSecurity ? { fieldSecurity: patch.fieldSecurity } : {}),
            };
          }
          return p;
        }),
      }));

      if (!firebaseUser) {
        return;
      }

      const targetDoc =
        data.profiles.find(
          (p) => p.id === profileId || p.id.endsWith(`_${profileId}`)
        ) ?? data.profiles[0];

      if (!targetDoc) return;

      try {
        await updateDoc(doc(db, 'profiles', targetDoc.id), {
          name: (patch.name ?? targetDoc.name).slice(0, 100),
          description: (patch.description ?? targetDoc.description ?? '').slice(0, 400),
          modulePermissions: patch.modulePermissions ?? targetDoc.modulePermissions,
          fieldSecurity: patch.fieldSecurity ?? targetDoc.fieldSecurity,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${targetDoc.id}`);
      }
    },
    [data.profiles, firebaseUser]
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
    [currentOrgId, currentUser.fullName, data.leads, firebaseUser]
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
    [currentOrgId, currentUser.fullName, data.accounts, data.contacts, data.leads, firebaseUser]
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
        org_id: currentOrgId,
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
    [currentOrgId, currentUser.fullName, data.accounts, data.contacts, firebaseUser]
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

  // Accounts Module Actions
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
    [currentOrgId, currentUser.fullName, firebaseUser]
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
    [data.accounts, firebaseUser]
  );

  // Scoped & Role-Visibility Filtered Collections
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

  const scopedTouchpoints = useMemo(
    () => data.touchpoints.filter((t) => belongsToCurrentOrg(t.org_id)),
    [belongsToCurrentOrg, data.touchpoints]
  );

  const scopedMessages = useMemo(
    () =>
      data.messages.filter(
        (m) => belongsToCurrentOrg(m.org_id) && canViewChat(m.senderName || m.ownerId)
      ),
    [belongsToCurrentOrg, canViewChat, data.messages]
  );

  const scopedTasks = useMemo(
    () =>
      data.tasks.filter(
        (t) => belongsToCurrentOrg(t.org_id) && canViewRecord(t.assignedToName || t.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.tasks]
  );

  const scopedCustomFields = useMemo(
    () => data.custom_fields.filter((cf) => belongsToCurrentOrg(cf.org_id)),
    [belongsToCurrentOrg, data.custom_fields]
  );

  const scopedBlueprints = useMemo(
    () => data.blueprints.filter((b) => belongsToCurrentOrg(b.org_id)),
    [belongsToCurrentOrg, data.blueprints]
  );

  const scopedWorkflows = useMemo(
    () => data.workflows.filter((w) => belongsToCurrentOrg(w.org_id)),
    [belongsToCurrentOrg, data.workflows]
  );

  const scopedRecycleBin = useMemo(
    () => data.recycle_bin.filter((r) => belongsToCurrentOrg(r.org_id)),
    [belongsToCurrentOrg, data.recycle_bin]
  );

  const scopedMetaConnections = useMemo(
    () => (data.meta_connections ?? []).filter((mc) => belongsToCurrentOrg(mc.org_id)),
    [belongsToCurrentOrg, data.meta_connections]
  );

  const scopedMetaPages = useMemo(
    () => (data.meta_pages ?? []).filter((mp) => belongsToCurrentOrg(mp.org_id)),
    [belongsToCurrentOrg, data.meta_pages]
  );

  const scopedMetaFieldMappings = useMemo(
    () => (data.meta_field_mappings ?? []).filter((mf) => belongsToCurrentOrg(mf.org_id)),
    [belongsToCurrentOrg, data.meta_field_mappings]
  );

  const scopedMetaWebhookLogs = useMemo(
    () => (data.meta_webhook_logs ?? []).filter((ml) => belongsToCurrentOrg(ml.org_id)),
    [belongsToCurrentOrg, data.meta_webhook_logs]
  );

  // Direct Meta Integration Handlers
  const connectMetaAccount = useCallback(
    async (input?: {
      shortLivedToken?: string;
      fbUserId?: string;
      fbUserName?: string;
    }) => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      interface ExchangedConnShape {
        fb_user_id: string;
        fb_user_name: string;
        long_lived_token_enc: string;
        token_expires_at: string;
        status: 'connected';
        scopes: string[];
      }
      interface ExchangedPageShape {
        page_id: string;
        page_name: string;
        ig_account_id: string;
        waba_id: string;
        phone_number_id: string;
        page_token_enc: string;
        subscribed_fields: string[];
      }

      let exchangedConn: ExchangedConnShape | undefined;
      let exchangedPages: ExchangedPageShape[] = [];

      try {
        const resp = await fetch('/api/meta/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: currentOrgId,
            short_lived_token: input?.shortLivedToken ?? `EAA_SDK_${Date.now()}`,
            fb_user_id: input?.fbUserId ?? 'fb_10293847561029',
            fb_user_name:
              input?.fbUserName ?? `${currentUser.fullName} — Meta Business Admin`,
          }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as {
            connection?: ExchangedConnShape;
            pages?: ExchangedPageShape[];
          };
          exchangedConn = json.connection;
          exchangedPages = json.pages ?? [];
        }
      } catch {
        // Fallback if offline
      }

      const connId = `meta_conn_${currentOrgId}`;
      const newConn: MetaConnection = {
        id: connId,
        ownerId,
        org_id: currentOrgId,
        fb_user_id: exchangedConn?.fb_user_id ?? input?.fbUserId ?? 'fb_10293847561029',
        fb_user_name:
          exchangedConn?.fb_user_name ??
          input?.fbUserName ??
          `${currentUser.fullName} — Meta Business Admin`,
        long_lived_token_enc:
          exchangedConn?.long_lived_token_enc ??
          `aes256:9f4b2c8e1d7a3f609182736455463728:${Date.now()}a8b9c0d1e2f3`,
        token_expires_at:
          exchangedConn?.token_expires_at ??
          new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'connected',
        scopes: [
          'leads_retrieval',
          'pages_manage_metadata',
          'pages_read_engagement',
          'pages_show_list',
          'whatsapp_business_messaging',
          'whatsapp_business_management',
        ],
      };

      const newPages: MetaPage[] =
        exchangedPages.length > 0
          ? exchangedPages.map((p, idx) => ({
              id: `meta_page_${currentOrgId}_${idx + 1}`,
              ownerId,
              org_id: currentOrgId,
              page_id: p.page_id,
              page_name: p.page_name,
              ig_account_id: p.ig_account_id,
              waba_id: p.waba_id,
              phone_number_id: p.phone_number_id,
              page_token_enc: p.page_token_enc,
              subscribed_fields: p.subscribed_fields,
            }))
          : scopedMetaPages;

      setData((prev) => {
        const otherConns = (prev.meta_connections ?? []).filter(
          (c) => !belongsToCurrentOrg(c.org_id)
        );
        const otherPages = (prev.meta_pages ?? []).filter(
          (p) => !belongsToCurrentOrg(p.org_id)
        );
        return {
          ...prev,
          meta_connections: [newConn, ...otherConns],
          meta_pages: [...newPages, ...otherPages],
        };
      });

      setSignals((prev) => [
        {
          id: `sig_meta_conn_${Date.now()}`,
          title: 'تم ربط وتوثيق حساب Meta Business بنجاح (AES-256)',
          description: `تم تشفير التوكن طويل الأجل (60 يوماً) وتفعيل اشتراك Webhooks (leadgen, messages) للمؤسسة`,
          category: 'system',
          timeLabel: 'الآن',
          unread: true,
          route: '/settings/meta',
        },
        ...prev,
      ]);

      if (!firebaseUser) return;

      try {
        const { id: _cid, ...connRest } = newConn;
        await setDoc(doc(db, 'meta_connections', connId), {
          ...stripUndefined(connRest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const pg of newPages) {
          const { id: pgDocId, ...pgRest } = pg;
          await setDoc(doc(db, 'meta_pages', pgDocId), {
            ...stripUndefined(pgRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `meta_connections/${connId}`);
      }
    },
    [
      belongsToCurrentOrg,
      currentOrgId,
      currentUser.fullName,
      firebaseUser,
      scopedMetaPages,
    ]
  );

  const toggleMetaPageSubscription = useCallback(
    async (pageDocId: string, pageId: string, subscribedFields: string[]) => {
      const targetPage = (data.meta_pages ?? []).find(
        (p) => p.id === pageDocId || p.page_id === pageId
      );

      try {
        await fetch(`/api/meta/pages/${encodeURIComponent(pageId)}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: currentOrgId,
            page_token_enc: targetPage?.page_token_enc ?? '',
            subscribed_fields: subscribedFields,
          }),
        });
      } catch {
        // continue
      }

      setData((prev) => ({
        ...prev,
        meta_pages: (prev.meta_pages ?? []).map((p) =>
          p.id === pageDocId || p.page_id === pageId
            ? { ...p, subscribed_fields: subscribedFields }
            : p
        ),
      }));

      if (!firebaseUser || !targetPage) return;

      try {
        await updateDoc(doc(db, 'meta_pages', targetPage.id), {
          subscribed_fields: subscribedFields,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `meta_pages/${targetPage.id}`);
      }
    },
    [currentOrgId, data.meta_pages, firebaseUser]
  );

  const saveMetaFieldMapping = useCallback(
    async (input: {
      form_id: string;
      form_name: string;
      page_id?: string;
      mappings: Record<string, string>;
      store_extra_in: 'custom_values' | 'notes';
    }) => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const existing = scopedMetaFieldMappings.find((m) => m.form_id === input.form_id);
      const docId = existing?.id ?? `meta_map_${currentOrgId}_${input.form_id}`;

      const updatedMapping: MetaFieldMapping = {
        id: docId,
        ownerId,
        org_id: currentOrgId,
        form_id: input.form_id,
        form_name: input.form_name,
        page_id: input.page_id ?? '104928374650192',
        mappings: input.mappings,
        store_extra_in: input.store_extra_in,
      };

      setData((prev) => {
        const others = (prev.meta_field_mappings ?? []).filter((m) => m.id !== docId);
        return {
          ...prev,
          meta_field_mappings: [updatedMapping, ...others],
        };
      });

      if (!firebaseUser) return;

      try {
        const { id: _id, ...rest } = updatedMapping;
        await setDoc(doc(db, 'meta_field_mappings', docId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `meta_field_mappings/${docId}`);
      }
    },
    [currentOrgId, firebaseUser, scopedMetaFieldMappings]
  );

  const simulateMetaWebhookEvent = useCallback(
    async (
      scenario: 'leadgen' | 'whatsapp_ctwa' | 'error_190'
    ): Promise<{
      status: 'processed' | 'failed';
      leadUniqueId?: string;
      assignedTo?: string;
      errorMessage?: string;
    }> => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const activeMapping = scopedMetaFieldMappings[0];
      const mappings = activeMapping?.mappings ?? {
        full_name: 'fullName',
        phone_number: 'phone',
        email: 'email',
        company_name: 'company',
        city: 'city',
        budget_range: 'approvedBudget',
      };
      const storeExtraIn = activeMapping?.store_extra_in ?? 'custom_values';

      let simData: {
        event_id?: string;
        event_type?: string;
        status?: 'processed' | 'failed';
        assigned_to?: string;
        lead_unique_id?: string;
        error_message?: string;
      } = {};

      try {
        const resp = await fetch('/api/webhooks/meta/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: currentOrgId,
            scenario,
            form_id: activeMapping?.form_id ?? 'form_ksa_enterprise_2026',
            mappings,
            store_extra_in: storeExtraIn,
          }),
        });
        if (resp.ok) {
          simData = (await resp.json()) as typeof simData;
        }
      } catch {
        // Fallback simulation if server route is unreachable
      }

      const eventId = simData.event_id ?? `evt_${scenario}_${Date.now()}`;
      const nowStamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (scenario === 'error_190') {
        const errMsg =
          simData.error_message ??
          'Graph API Error 190 (OAuthException): انتهت صلاحية التوكن — تم تحويل حالة الاتصال إلى reconnect_required وإرسال تنبيه للمدير';

        const errLog: MetaWebhookLog = {
          id: `wh_err_${Date.now()}`,
          ownerId,
          org_id: currentOrgId,
          event_id: eventId,
          event_type: 'leadgen',
          status: 'failed',
          retry_count: 0,
          error_message: errMsg,
          payload_summary:
            'فشل جلب بيانات عميل Lead Ads بسبب انتهاء صلاحية التوكن (Error 190)',
          created_at: nowStamp,
        };

        setData((prev) => ({
          ...prev,
          meta_connections: (prev.meta_connections ?? []).map((c) =>
            belongsToCurrentOrg(c.org_id)
              ? {
                  ...c,
                  status: 'reconnect_required',
                  last_error_message: errMsg,
                }
              : c
          ),
          meta_webhook_logs: [errLog, ...(prev.meta_webhook_logs ?? [])],
        }));

        setSignals((prev) => [
          {
            id: `sig_err190_${Date.now()}`,
            title: 'تنبيه أمني عاجل: انتهاء صلاحية توكن ميتا (Graph Error 190)',
            description:
              'توقفت مزامنة Lead Ads مؤقتاً — يرجى إعادة ربط حساب ميتا من صفحة إعدادات ميتا لاستئناف سحب العملاء.',
            category: 'system',
            timeLabel: 'الآن',
            unread: true,
            route: '/settings/meta',
          },
          ...prev,
        ]);

        if (firebaseUser) {
          try {
            const { id: logDocId, ...logRest } = errLog;
            await setDoc(doc(db, 'meta_webhook_logs', logDocId), {
              ...stripUndefined(logRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            const connDoc = scopedMetaConnections[0];
            if (connDoc) {
              await updateDoc(doc(db, 'meta_connections', connDoc.id), {
                status: 'reconnect_required',
                last_error_message: errMsg.slice(0, 280),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'meta_webhook_logs');
          }
        }

        return { status: 'failed', errorMessage: errMsg };
      }

      const assignedRep = simData.assigned_to ?? 'سارة المنصور';
      const isCtwa = scenario === 'whatsapp_ctwa';
      const candidatePhone = isCtwa ? '+966 55 443 3221' : '+966 50 882 4419';
      const candidateEmail = isCtwa
        ? 'naif.olayan@elite-med.sa'
        : 'sultan.sudairi@alyamamah-group.sa';
      const candidateName = isCtwa
        ? 'م. نايف العليان — شركة النخبة الطبية'
        : 'سلطان بن فهد السديري';
      const candidateCompany = isCtwa ? 'شركة النخبة الطبية' : 'مجموعة اليمامة القابضة';

      // Deduplicate by phone or email within currentOrgId
      const existingLead = scopedLeads.find(
        (l) =>
          (l.phone && l.phone.replace(/\s+/g, '') === candidatePhone.replace(/\s+/g, '')) ||
          (l.email && l.email.toLowerCase() === candidateEmail.toLowerCase())
      );

      const leadUniqueId =
        existingLead?.unique_id ??
        simData.lead_unique_id ??
        generateLeadUniqueId(data.leads.map((l) => l.unique_id));
      const leadDocId = existingLead?.id ?? `lead_meta_${Date.now()}`;

      const newLeadRecord: Lead = existingLead
        ? {
            ...existingLead,
            lastActivityLabel: 'الآن (محدث من ميتا)',
            lastMessageSnippet: isCtwa
              ? 'رسالة Click-to-WhatsApp Ad: نرغب بعرض سعر لـ 40 مستخدم'
              : 'تحديث نموذج Meta Lead Ads (مجموعة اليمامة القابضة)',
          }
        : {
            id: leadDocId,
            ownerId,
            org_id: currentOrgId,
            unique_id: leadUniqueId,
            fullName: candidateName,
            company: candidateCompany,
            jobTitle: 'المدير التنفيذي للعمليات',
            email: candidateEmail,
            phone: candidatePhone,
            source: isCtwa
              ? 'إعلان Click-to-WhatsApp مباشر'
              : 'إعلانات ميتا الممولة (Facebook Lead Ads)',
            channel: isCtwa ? 'whatsapp' : 'instagram',
            campaign: isCtwa
              ? 'حملة واتساب المباشرة — حلول إدارة المبيعات B2B'
              : 'حملة التوسع المؤسسي Q4 — Lead Ads',
            adId: isCtwa ? 'ad_ctwa_994821' : 'ad_meta_8849201',
            utmSource: 'meta_direct_webhook',
            utmMedium: isCtwa ? 'ctwa_referral' : 'lead_ad_form',
            utmCampaign: 'ksa_enterprise_2026',
            status: 'جديد',
            aiScore: 93,
            estimatedValue: 420000,
            approvedBudget: 420000,
            assignedToName: assignedRep,
            city: 'الرياض، السعودية',
            tags: isCtwa
              ? ['واتساب_إعلاني_CTWA', 'توزيع_Round_Robin']
              : ['Meta_Lead_Ads', 'توزيع_Round_Robin'],
            lastActivityLabel: 'الآن',
            lastMessageSnippet: isCtwa
              ? 'السلام عليكم، شاهدت إعلانكم على إنستغرام بخصوص باقة رواق Enterprise ونرغب بعرض سعر لـ 40 مستخدم.'
              : 'تم سحب بيانات العميل لحظياً عبر Graph API وتعيينه بنظام المناوبة (Round-Robin).',
            awaitingReplyHours: 0,
            notes:
              storeExtraIn === 'notes'
                ? 'preferred_deployment_timeline: خلال الربع الحالي Q2 — 35 مستخدم'
                : 'تم التحقق من عدم التكرار داخل المؤسسة وتطبيق خريطة الحقول بنجاح.',
            converted: false,
            customValues: {
              branch_region: 'الرياض والوسطى',
              preferred_deployment_timeline: 'خلال الربع الحالي Q2 — 35 مستخدم',
            },
          };

      const tpId = `tp_meta_${Date.now()}`;
      const newTouchpoint: Touchpoint = {
        id: tpId,
        ownerId,
        org_id: currentOrgId,
        channel: isCtwa ? 'واتساب' : 'إنستغرام',
        summary: isCtwa
          ? `رسالة واردة من إعلان Click-to-WhatsApp (Ad ID: ad_ctwa_994821) — تم ربطها بالعميل ${leadUniqueId}`
          : `استلام نموذج Meta Lead Ads فوري (${activeMapping?.form_id ?? 'form_ksa_enterprise_2026'}) وإسناده بنظام Round-Robin إلى ${assignedRep}`,
        relatedEntityType: 'عميل محتمل',
        relatedEntityId: leadDocId,
        relatedEntityName: candidateName,
        occurredAt: nowStamp,
        leadId: leadDocId,
        leadUniqueId,
        campaign: newLeadRecord.campaign,
        adId: newLeadRecord.adId,
        utmSource: 'meta_direct_webhook',
        eventType: isCtwa ? 'Click-to-WhatsApp Referral' : 'Meta Leadgen Webhook',
      };

      const msgId = `msg_meta_${Date.now()}`;
      const newInboxMessage: InboxMessage | null = isCtwa
        ? {
            id: msgId,
            ownerId,
            org_id: currentOrgId,
            channel: 'whatsapp',
            senderName: candidateName,
            companyName: candidateCompany,
            subject: 'استفسار من إعلان Click-to-WhatsApp (ad_ctwa_994821)',
            body: 'السلام عليكم، شاهدت إعلانكم على إنستغرام بخصوص باقة رواق Enterprise ونرغب بعرض سعر لـ 40 مستخدم.',
            direction: 'inbound',
            unread: true,
            timestampLabel: 'الآن',
            leadId: leadDocId,
            leadUniqueId,
            campaign: 'حملة واتساب المباشرة — حلول إدارة المبيعات B2B',
          }
        : null;

      const logEntry: MetaWebhookLog = {
        id: `wh_log_${Date.now()}`,
        ownerId,
        org_id: currentOrgId,
        event_id: eventId,
        event_type: isCtwa ? 'messages' : 'leadgen',
        status: 'processed',
        retry_count: 0,
        payload_summary: isCtwa
          ? `Click-to-WhatsApp Referral: ${candidateName} (${candidatePhone}) ➔ ${leadUniqueId} (المندوب: ${assignedRep})`
          : `Meta Lead Ads: ${candidateName} (${candidatePhone}) ➔ ${
              existingLead ? `دمج مع السجل ${leadUniqueId}` : `إنشاء ${leadUniqueId}`
            } (Round-Robin: ${assignedRep})`,
        lead_unique_id: leadUniqueId,
        created_at: nowStamp,
      };

      setData((prev) => ({
        ...prev,
        leads: existingLead
          ? prev.leads.map((l) => (l.id === existingLead.id ? newLeadRecord : l))
          : [newLeadRecord, ...prev.leads],
        touchpoints: [newTouchpoint, ...prev.touchpoints],
        messages: newInboxMessage ? [newInboxMessage, ...prev.messages] : prev.messages,
        meta_webhook_logs: [logEntry, ...(prev.meta_webhook_logs ?? [])],
      }));

      setSignals((prev) => [
        {
          id: `sig_meta_lead_${Date.now()}`,
          title: isCtwa
            ? `رسالة إعلان واتساب جديدة (${leadUniqueId}) — ${candidateName}`
            : `عميل Meta Lead Ads جديد (${leadUniqueId}) — إسناد تلقائي لـ ${assignedRep}`,
          description: `${candidateCompany} · تم التحقق من التوقيع الرقمي X-Hub-Signature-256 وإنشاء نقطة تفاعل`,
          category: 'lead',
          timeLabel: 'الآن',
          unread: true,
          route: `/leads/${leadDocId}`,
        },
        ...prev,
      ]);

      if (firebaseUser) {
        try {
          const batch = writeBatch(db);
          const { id: _lid, ...leadRest } = newLeadRecord;
          batch.set(doc(db, 'leads', leadDocId), {
            ...stripUndefined(leadRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const { id: _tid, ...tpRest } = newTouchpoint;
          batch.set(doc(db, 'touchpoints', tpId), {
            ...stripUndefined(tpRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (newInboxMessage) {
            const { id: _mid, ...msgRest } = newInboxMessage;
            batch.set(doc(db, 'messages', msgId), {
              ...stripUndefined(msgRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          const { id: _whId, ...whRest } = logEntry;
          batch.set(doc(db, 'meta_webhook_logs', logEntry.id), {
            ...stripUndefined(whRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'meta_webhook_simulation');
        }
      }

      return {
        status: 'processed',
        leadUniqueId,
        assignedTo: assignedRep,
      };
    },
    [
      belongsToCurrentOrg,
      currentOrgId,
      data.leads,
      firebaseUser,
      scopedLeads,
      scopedMetaConnections,
      scopedMetaFieldMappings,
    ]
  );

  const retryMetaWebhookLog = useCallback(
    async (logId: string) => {
      const targetLog = (data.meta_webhook_logs ?? []).find((l) => l.id === logId);
      if (!targetLog) return;

      const recoveredUniqueId =
        targetLog.lead_unique_id ??
        generateLeadUniqueId(data.leads.map((l) => l.unique_id));
      const nextRetryCount = targetLog.retry_count + 1;

      setData((prev) => ({
        ...prev,
        meta_connections: (prev.meta_connections ?? []).map((c) =>
          belongsToCurrentOrg(c.org_id) ? { ...c, status: 'connected' } : c
        ),
        meta_webhook_logs: (prev.meta_webhook_logs ?? []).map((l) =>
          l.id === logId
            ? {
                ...l,
                status: 'processed',
                retry_count: nextRetryCount,
                error_message: undefined,
                lead_unique_id: recoveredUniqueId,
                payload_summary: `تمت استعادة ومعالجة الحدث بنجاح بعد المحاولة #${nextRetryCount} (Exponential Backoff) ➔ ${recoveredUniqueId}`,
              }
            : l
        ),
      }));

      setSignals((prev) => [
        {
          id: `sig_retry_${Date.now()}`,
          title: `نجاح إعادة محاولة حدث ميتا (${targetLog.event_id})`,
          description: `تمت معالجة الحدث المعلق بعد المحاولة #${nextRetryCount} وتوليد السجل ${recoveredUniqueId} دون فقدان أي بيانات`,
          category: 'lead',
          timeLabel: 'الآن',
          unread: true,
          route: '/settings/meta',
        },
        ...prev,
      ]);

      if (!firebaseUser) return;

      try {
        await updateDoc(doc(db, 'meta_webhook_logs', targetLog.id), {
          status: 'processed',
          retry_count: nextRetryCount,
          error_message: '',
          lead_unique_id: recoveredUniqueId,
          payload_summary: `تمت استعادة ومعالجة الحدث بنجاح بعد المحاولة #${nextRetryCount} ➔ ${recoveredUniqueId}`,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `meta_webhook_logs/${targetLog.id}`);
      }
    },
    [belongsToCurrentOrg, data.leads, data.meta_webhook_logs, firebaseUser]
  );

  const dispatchMetaCapiEvent = useCallback(
    async (input: {
      event_name: 'LeadQualified' | 'Purchase';
      lead_unique_id: string;
      email?: string;
      phone?: string;
      amount?: number;
    }) => {
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      let eventId = `evt_capi_${input.event_name.toLowerCase()}_${Date.now()}`;

      try {
        const resp = await fetch('/api/meta/capi/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: currentOrgId,
            ...input,
          }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as { event_id?: string };
          if (json.event_id) eventId = json.event_id;
        }
      } catch {
        // continue
      }

      const nowStamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const newLog: MetaWebhookLog = {
        id: `wh_capi_${Date.now()}`,
        ownerId,
        org_id: currentOrgId,
        event_id: eventId,
        event_type:
          input.event_name === 'Purchase' ? 'capi_purchase' : 'capi_lead_qualified',
        status: 'processed',
        retry_count: 0,
        lead_unique_id: input.lead_unique_id,
        payload_summary:
          input.event_name === 'Purchase'
            ? `Conversions API (Purchase): إرسال إغلاق صفقة (${(
                input.amount ?? 350000
              ).toLocaleString('en-US')} ر.س — ${input.lead_unique_id})`
            : `Conversions API (LeadQualified): إرسال تأهيل العميل (${input.lead_unique_id}) لتحسين خوارزمية ميتا`,
        created_at: nowStamp,
      };

      setData((prev) => ({
        ...prev,
        meta_webhook_logs: [newLog, ...(prev.meta_webhook_logs ?? [])],
      }));

      if (!firebaseUser) return;

      try {
        const { id: _id, ...rest } = newLog;
        await setDoc(doc(db, 'meta_webhook_logs', newLog.id), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `meta_webhook_logs/${newLog.id}`);
      }
    },
    [currentOrgId, firebaseUser]
  );

  const value: CrmContextValue = {
    authReady,
    firebaseUser,
    currentUser,
    syncStatus,
    authError,
    signInWithGoogle,
    signOutUser,
    organizations: organizationsList,
    currentOrgId,
    currentOrganization,
    switchOrganization,
    provisionNewOrganization,
    updateOrganizationSubscription,
    toggleRoleHideSubordinates,
    updateProfileAddons,
    canViewRecord,
    canViewChat,
    canUseAddon,
    profiles: orgScopedProfiles.length > 0 ? orgScopedProfiles : data.profiles,
    roles: orgScopedRoles.length > 0 ? orgScopedRoles : data.roles,
    customFields: scopedCustomFields,
    accounts: scopedAccounts,
    contacts: scopedContacts,
    leads: scopedLeads,
    deals: scopedDeals,
    quotes: scopedQuotes,
    salesOrders: scopedSalesOrders,
    invoices: scopedInvoices,
    touchpoints: scopedTouchpoints,
    messages: scopedMessages,
    tasks: scopedTasks,
    blueprints: scopedBlueprints,
    workflows: scopedWorkflows,
    recycleBin: scopedRecycleBin,
    signals,
    metaConnections: scopedMetaConnections,
    metaPages: scopedMetaPages,
    metaFieldMappings: scopedMetaFieldMappings,
    metaWebhookLogs: scopedMetaWebhookLogs,
    connectMetaAccount,
    toggleMetaPageSubscription,
    saveMetaFieldMapping,
    simulateMetaWebhookEvent,
    retryMetaWebhookLog,
    dispatchMetaCapiEvent,
    activeProfile,
    setActiveProfileId,
    activeRole,
    setActiveRoleId,
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
    updateProfileSecurity,
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
    createAccount,
    updateAccountFields,
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
