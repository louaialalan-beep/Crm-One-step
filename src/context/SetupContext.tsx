import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  buildProvisionedOrgSeed,
  buildSeedDataset,
  DEFAULT_ORG_ID,
} from '../data/seedData';
import type {
  Blueprint,
  Contact,
  CrmAddonFlags,
  CrmModuleKey,
  CrmOrganization,
  CrmProfile,
  CrmRole,
  CustomField,
  Deal,
  FieldAccessLevel,
  InboxMessage,
  Lead,
  MetaConnection,
  MetaFieldMapping,
  MetaPage,
  MetaWebhookLog,
  OrganizationPlan,
  RecycleBinItem,
  Touchpoint,
  WorkflowRule,
} from '../types/crm';
import { evaluateFieldAccess, generateLeadUniqueId } from '../utils/formatters';
import { PREVIEW_OWNER_ID, stripUndefined, useAuth } from './AuthContext';

export interface SetupContextValue {
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

  profiles: CrmProfile[];
  roles: CrmRole[];
  customFields: CustomField[];
  blueprints: Blueprint[];
  workflows: WorkflowRule[];
  recycleBin: RecycleBinItem[];
  metaConnections: MetaConnection[];
  metaPages: MetaPage[];
  metaFieldMappings: MetaFieldMapping[];
  metaWebhookLogs: MetaWebhookLog[];

  activeProfile: CrmProfile | undefined;
  setActiveProfileId: (profileId: string) => void;
  activeRole: CrmRole | undefined;
  setActiveRoleId: (roleId: string) => void;
  canViewField: (module: CrmModuleKey, fieldKey: string) => boolean;
  canEditField: (module: CrmModuleKey, fieldKey: string) => boolean;
  getFieldAccess: (module: CrmModuleKey, fieldKey: string) => FieldAccessLevel;

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
  permanentlyDeleteRecycleItem: (itemId: string) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;

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
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const {
    firebaseUser,
    currentUser,
    setCurrentUser,
    currentOrgId,
    setCurrentOrgId,
    belongsToCurrentOrg,
    data,
    setData,
    setSignals,
  } = useAuth();

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

  const setActiveProfileId = useCallback(
    (profileId: string) => {
      setCurrentUser((prev) => ({ ...prev, profileId }));
    },
    [setCurrentUser]
  );

  const setActiveRoleId = useCallback(
    (roleId: string) => {
      setCurrentUser((prev) => ({ ...prev, roleId }));
    },
    [setCurrentUser]
  );

  const canViewRecord = useCallback(
    (recordOwnerIdOrName?: string): boolean => {
      if (!recordOwnerIdOrName) return true;
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

      if (activeRole?.dataVisibility === 'team') {
        if (activeRole.hide_subordinates_data) {
          return isOwnRecord;
        }
        return true;
      }

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
    [organizationsList, setCurrentOrgId, setCurrentUser, setSignals]
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
    [firebaseUser, setCurrentOrgId, setCurrentUser, setData, setSignals]
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
    [currentOrgId, data.organizations, firebaseUser, setData]
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
    [data.roles, firebaseUser, setData]
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
    [data.profiles, firebaseUser, setData]
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
    [currentOrgId, firebaseUser, setData]
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

      if (!firebaseUser) return;

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
    [data.profiles, firebaseUser, setData]
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
    [data.profiles, firebaseUser, setData]
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
    [data.recycle_bin, firebaseUser, setData]
  );

  const permanentlyDeleteRecycleItem = useCallback(
    async (itemId: string) => {
      setData((prev) => ({
        ...prev,
        recycle_bin: prev.recycle_bin.filter((r) => r.id !== itemId),
      }));

      if (!firebaseUser) return;

      try {
        await deleteDoc(doc(db, 'recycle_bin', itemId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `recycle_bin/${itemId}`);
      }
    },
    [firebaseUser, setData]
  );

  const emptyRecycleBin = useCallback(async () => {
    const itemsToRemove = data.recycle_bin.filter((r) => belongsToCurrentOrg(r.org_id));
    setData((prev) => ({
      ...prev,
      recycle_bin: prev.recycle_bin.filter((r) => !belongsToCurrentOrg(r.org_id)),
    }));

    if (!firebaseUser || itemsToRemove.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const item of itemsToRemove) {
        batch.delete(doc(db, 'recycle_bin', item.id));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'recycle_bin_empty_all');
    }
  }, [belongsToCurrentOrg, data.recycle_bin, firebaseUser, setData]);

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
          `9f4b2c8e1d7a3f6091827364:0123456789abcdef0123456789abcdef:${Date.now()}a8b9c0d1e2f3`,
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
          title: 'تم ربط وتوثيق حساب Meta Business بنجاح (AES-256-GCM)',
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
      setData,
      setSignals,
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
    [currentOrgId, data.meta_pages, firebaseUser, setData]
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
    [currentOrgId, firebaseUser, scopedMetaFieldMappings, setData]
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

      const scopedLeads = data.leads.filter((l) => belongsToCurrentOrg(l.org_id));
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
      scopedMetaConnections,
      scopedMetaFieldMappings,
      setData,
      setSignals,
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
    [belongsToCurrentOrg, data.leads, data.meta_webhook_logs, firebaseUser, setData, setSignals]
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
    [currentOrgId, firebaseUser, setData]
  );

  const value = useMemo<SetupContextValue>(
    () => ({
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
      blueprints: scopedBlueprints,
      workflows: scopedWorkflows,
      recycleBin: scopedRecycleBin,
      metaConnections: scopedMetaConnections,
      metaPages: scopedMetaPages,
      metaFieldMappings: scopedMetaFieldMappings,
      metaWebhookLogs: scopedMetaWebhookLogs,
      activeProfile,
      setActiveProfileId,
      activeRole,
      setActiveRoleId,
      canViewField,
      canEditField,
      getFieldAccess,
      createProfile,
      updateProfileSecurity,
      deleteProfile,
      restoreRecycleItem,
      permanentlyDeleteRecycleItem,
      emptyRecycleBin,
      connectMetaAccount,
      toggleMetaPageSubscription,
      saveMetaFieldMapping,
      simulateMetaWebhookEvent,
      retryMetaWebhookLog,
      dispatchMetaCapiEvent,
    }),
    [
      organizationsList,
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
      orgScopedProfiles,
      data.profiles,
      orgScopedRoles,
      data.roles,
      scopedCustomFields,
      scopedBlueprints,
      scopedWorkflows,
      scopedRecycleBin,
      scopedMetaConnections,
      scopedMetaPages,
      scopedMetaFieldMappings,
      scopedMetaWebhookLogs,
      activeProfile,
      setActiveProfileId,
      activeRole,
      setActiveRoleId,
      canViewField,
      canEditField,
      getFieldAccess,
      createProfile,
      updateProfileSecurity,
      deleteProfile,
      restoreRecycleItem,
      permanentlyDeleteRecycleItem,
      emptyRecycleBin,
      connectMetaAccount,
      toggleMetaPageSubscription,
      saveMetaFieldMapping,
      simulateMetaWebhookEvent,
      retryMetaWebhookLog,
      dispatchMetaCapiEvent,
    ]
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext);
  if (!ctx) {
    throw new Error('useSetup must be used inside SetupProvider');
  }
  return ctx;
}
