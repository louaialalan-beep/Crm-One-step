import React, { createContext, useContext, useMemo } from 'react';
import { AuthProvider, useAuth, type AuthContextValue } from './AuthContext';
import { SetupProvider, useSetup, type SetupContextValue } from './SetupContext';
import {
  LeadsContactsProvider,
  useLeadsContacts,
  type LeadsContactsContextValue,
  type CreateLeadInput,
  type ConvertLeadInput,
  type CreateContactInput,
  type CreateAccountInput,
} from './LeadsContactsContext';
import {
  DealsFinancialProvider,
  useDealsFinancial,
  type DealsFinancialContextValue,
  type QuickDealPayload,
  type CreateContactDealInput,
  type CreateDealInput,
  type StageHistoryEntry,
  type OrderAttributionEntry,
} from './DealsFinancialContext';
import {
  CommsActivitiesProvider,
  useCommsActivities,
  type CommsActivitiesContextValue,
} from './CommsActivitiesContext';

export {
  useAuth,
  useSetup,
  useLeadsContacts,
  useDealsFinancial,
  useCommsActivities,
  type AuthContextValue,
  type SetupContextValue,
  type LeadsContactsContextValue,
  type DealsFinancialContextValue,
  type CommsActivitiesContextValue,
  type CreateLeadInput,
  type ConvertLeadInput,
  type CreateContactInput,
  type CreateAccountInput,
  type QuickDealPayload,
  type CreateContactDealInput,
  type CreateDealInput,
  type StageHistoryEntry,
  type OrderAttributionEntry,
};

export type CrmContextValue = Omit<
  AuthContextValue,
  'setCurrentUser' | 'setSyncStatus' | 'setCurrentOrgId' | 'belongsToCurrentOrg' | 'data' | 'setData' | 'setSignals'
> &
  SetupContextValue &
  LeadsContactsContextValue &
  DealsFinancialContextValue &
  CommsActivitiesContextValue;

const CrmContext = createContext<CrmContextValue | null>(null);

function CrmFacadeBridge({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const setup = useSetup();
  const leadsContacts = useLeadsContacts();
  const dealsFinancial = useDealsFinancial();
  const commsActivities = useCommsActivities();

  const value = useMemo<CrmContextValue>(
    () => ({
      authReady: auth.authReady,
      firebaseUser: auth.firebaseUser,
      currentUser: auth.currentUser,
      syncStatus: auth.syncStatus,
      authError: auth.authError,
      signInWithGoogle: auth.signInWithGoogle,
      signOutUser: auth.signOutUser,
      userSecurityContext: auth.userSecurityContext,
      ...setup,
      ...leadsContacts,
      ...dealsFinancial,
      ...commsActivities,
    }),
    [auth, setup, leadsContacts, dealsFinancial, commsActivities]
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

/**
 * Composes all 5 domain providers (Auth -> Setup -> LeadsContacts -> DealsFinancial -> CommsActivities)
 * and provides a 100% backward-compatible `useCrm()` facade alongside granular domain hooks.
 */
export function CrmProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SetupProvider>
        <LeadsContactsProvider>
          <DealsFinancialProvider>
            <CommsActivitiesProvider>
              <CrmFacadeBridge>{children}</CrmFacadeBridge>
            </CommsActivitiesProvider>
          </DealsFinancialProvider>
        </LeadsContactsProvider>
      </SetupProvider>
    </AuthProvider>
  );
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) {
    throw new Error('useCrm must be used inside CrmProvider');
  }
  return ctx;
}
