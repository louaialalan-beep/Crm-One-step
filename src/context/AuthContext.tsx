import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from '../firebase';
import {
  buildSeedDataset,
  DEFAULT_ORG_ID,
  INITIAL_SIGNALS,
  type SeedDataset,
} from '../data/seedData';
import type { CrmUser, SignalNotification } from '../types/crm';
import type { ModuleName, UserSecurityContext } from '../types/reports';

export const PREVIEW_OWNER_ID = 'preview-user';

export function stripUndefined<T extends object>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

export function createInitialPreviewUser(): CrmUser {
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

export interface AuthContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  currentUser: CrmUser;
  setCurrentUser: React.Dispatch<React.SetStateAction<CrmUser>>;
  syncStatus: 'cloud' | 'preview' | 'syncing' | 'offline';
  setSyncStatus: React.Dispatch<React.SetStateAction<'cloud' | 'preview' | 'syncing' | 'offline'>>;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  currentOrgId: string;
  setCurrentOrgId: React.Dispatch<React.SetStateAction<string>>;
  belongsToCurrentOrg: (recordOrgId?: string) => boolean;
  userSecurityContext: UserSecurityContext;
  // Shared internal state for atomic multi-collection CRM operations
  data: SeedDataset;
  setData: React.Dispatch<React.SetStateAction<SeedDataset>>;
  signals: SignalNotification[];
  setSignals: React.Dispatch<React.SetStateAction<SignalNotification[]>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ALL_REPORT_MODULES: ModuleName[] = [
  'leads',
  'contacts',
  'accounts',
  'deals',
  'touchpoints',
  'campaigns',
  'quotes',
  'sales_orders',
  'invoices',
  'tasks',
  'calls',
  'whatsapp_messages',
  'stage_history',
  'order_attributions',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialSeed = useMemo(() => buildSeedDataset(PREVIEW_OWNER_ID, DEFAULT_ORG_ID), []);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'cloud' | 'preview' | 'syncing' | 'offline'>('preview');
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentOrgId, setCurrentOrgId] = useState<string>(DEFAULT_ORG_ID);
  const [currentUser, setCurrentUser] = useState<CrmUser>(createInitialPreviewUser);
  const [data, setData] = useState<SeedDataset>(initialSeed);
  const [signals, setSignals] = useState<SignalNotification[]>(INITIAL_SIGNALS);

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

  const belongsToCurrentOrg = useCallback(
    (recordOrgId?: string) => {
      if (!recordOrgId) {
        return currentOrgId === DEFAULT_ORG_ID;
      }
      return recordOrgId === currentOrgId || recordOrgId.endsWith(`_${currentOrgId}`);
    },
    [currentOrgId]
  );

  const userSecurityContext = useMemo<UserSecurityContext>(() => {
    const activeProfile = data.profiles.find(
      (p) => p.id === currentUser.profileId || p.id.endsWith(`_${currentUser.profileId}`)
    );
    const activeRole = data.roles.find(
      (r) => r.id === currentUser.roleId || r.id.endsWith(`_${currentUser.roleId}`)
    );
    const isAdminOrOrg =
      Boolean(activeProfile?.isSystem) ||
      currentUser.profileId.includes('prof_admin') ||
      activeRole?.dataVisibility === 'organization';

    const hiddenFieldsByModule: Record<ModuleName, string[]> = {
      leads: [],
      contacts: [],
      accounts: [],
      deals: [],
      touchpoints: [],
      campaigns: [],
      quotes: [],
      sales_orders: [],
      invoices: [],
      tasks: [],
      calls: [],
      whatsapp_messages: [],
      stage_history: [],
      order_attributions: [],
    };

    if (activeProfile?.fieldSecurity) {
      for (const [modKey, fieldsMap] of Object.entries(activeProfile.fieldSecurity)) {
        if (modKey in hiddenFieldsByModule && fieldsMap) {
          hiddenFieldsByModule[modKey as ModuleName] = Object.entries(fieldsMap)
            .filter(([, access]) => access === 'hidden')
            .map(([fieldKey]) => fieldKey);
        }
      }
    }

    return {
      userId: currentUser.uid,
      roleId: currentUser.roleId,
      subordinateUserIds: activeRole?.dataVisibility === 'team' ? ['usr-2', 'usr-3', 'usr-4'] : [],
      canViewAllModules: isAdminOrOrg ? ALL_REPORT_MODULES : [],
      hiddenFieldsByModule,
    };
  }, [currentUser.profileId, currentUser.roleId, currentUser.uid, data.profiles, data.roles]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
      firebaseUser,
      currentUser,
      setCurrentUser,
      syncStatus,
      setSyncStatus,
      authError,
      signInWithGoogle,
      signOutUser,
      currentOrgId,
      setCurrentOrgId,
      belongsToCurrentOrg,
      userSecurityContext,
      data,
      setData,
      signals,
      setSignals,
    }),
    [
      authReady,
      firebaseUser,
      currentUser,
      syncStatus,
      authError,
      signInWithGoogle,
      signOutUser,
      currentOrgId,
      belongsToCurrentOrg,
      userSecurityContext,
      data,
      signals,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
