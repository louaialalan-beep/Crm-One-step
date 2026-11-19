import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Account } from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

export const accountsService = {
  async listAccounts(params: {
    orgId: string;
    fallbackAccounts?: Account[];
  }): Promise<Account[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/accounts',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackAccounts || [],
    });
  },

  async createAccount(params: {
    orgId: string;
    isCloudMode: boolean;
    account: Account;
    onPreviewApply: () => void;
  }): Promise<Account> {
    return executeWithAdapter({
      endpoint: '/api/v1/accounts',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        lead_uid: params.account.leadUniqueId,
        name: params.account.name,
        industry: params.account.industry,
        tier: params.account.tier || 'Enterprise',
        city: params.account.city,
        website: params.account.website,
        annual_revenue: params.account.annualRevenue || 0,
        owner_id: params.account.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.account;
        }
        try {
          const { id: accId, ...rest } = params.account;
          await setDoc(doc(db, 'accounts', accId), {
            ...stripUndefinedFields(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `accounts/${params.account.id}`);
        }
        return params.account;
      },
    });
  },

  async updateAccountFields(params: {
    orgId: string;
    isCloudMode: boolean;
    accountId: string;
    patch: Partial<Account>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/accounts/${params.accountId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: {
        name: params.patch.name,
        industry: params.patch.industry,
        tier: params.patch.tier,
        city: params.patch.city,
        website: params.patch.website,
        annual_revenue: params.patch.annualRevenue,
        owner_id: params.patch.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'accounts', params.accountId), {
            ...stripUndefinedFields(params.patch),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `accounts/${params.accountId}`);
        }
      },
    });
  },

  async softDeleteAccount(params: {
    orgId: string;
    accountId: string;
    onPreviewApply?: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/accounts/${params.accountId}`,
      method: 'DELETE',
      orgId: params.orgId,
      fallback: () => {
        params.onPreviewApply?.();
      },
    });
  },
};
