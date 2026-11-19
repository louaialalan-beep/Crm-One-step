import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Account,
  Contact,
  CrmTask,
  Deal,
  Lead,
  RecycleBinItem,
  Touchpoint,
} from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

export interface CsvImportJobDto {
  job_id: string;
  status: string;
  org_id: string;
  total_rows: number;
  imported_count: number;
  skipped_duplicates: number;
  errors: string[];
  queued_via_arq: boolean;
}

export const leadsService = {
  async listLeads(params: {
    orgId: string;
    fallbackLeads?: Lead[];
  }): Promise<Lead[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/leads',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackLeads || [],
    });
  },

  async createLeadWithTouchpoint(params: {
    orgId: string;
    isCloudMode: boolean;
    lead: Lead;
    initialTouchpoint: Touchpoint;
    onPreviewApply: () => void;
  }): Promise<Lead> {
    return executeWithAdapter({
      endpoint: '/api/v1/leads',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        lead_uid: params.lead.unique_id,
        unique_id: params.lead.unique_id,
        full_name: params.lead.fullName,
        company: params.lead.company,
        email: params.lead.email,
        phone: params.lead.phone,
        source: params.lead.source,
        status: params.lead.status,
        score: params.lead.aiScore,
        estimated_value: params.lead.estimatedValue,
        owner_id: params.lead.ownerId,
        campaign_name: params.lead.campaign,
        ad_id: params.lead.adId,
        utm_source: params.lead.utmSource,
        utm_medium: params.lead.utmMedium,
        utm_campaign: params.lead.utmCampaign,
        initial_touchpoint: {
          lead_uid: params.lead.unique_id,
          channel: params.initialTouchpoint.channel,
          campaign_name: params.initialTouchpoint.campaign,
          ad_id: params.initialTouchpoint.adId,
          source: params.lead.source,
          metadata: { summary: params.initialTouchpoint.summary },
        },
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.lead;
        }
        try {
          const batch = writeBatch(db);
          const { id: leadId, ...leadRest } = params.lead;
          batch.set(doc(db, 'leads', leadId), {
            ...stripUndefinedFields(leadRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const { id: tpId, ...tpRest } = params.initialTouchpoint;
          batch.set(doc(db, 'touchpoints', tpId), {
            ...stripUndefinedFields(tpRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `leads/${params.lead.id}`);
        }
        return params.lead;
      },
    });
  },

  /**
   * Background Bulk CSV Import (`POST /api/v1/import/csv` processed via ARQ Worker in batches
   * with deduplication and RWQ-xxxxx generation).
   */
  async importLeadsBatch(params: {
    orgId: string;
    isCloudMode: boolean;
    leads: Lead[];
    csvFile?: File;
    onPreviewApply: () => void;
  }): Promise<number> {
    let payloadBody: unknown = {
      rows: params.leads.map((l) => ({
        lead_uid: l.unique_id,
        full_name: l.fullName,
        company: l.company,
        email: l.email,
        phone: l.phone,
        source: l.source,
        status: l.status,
        estimated_value: l.estimatedValue,
        campaign_name: l.campaign,
      })),
    };

    if (params.csvFile && typeof FormData !== 'undefined') {
      const formData = new FormData();
      formData.append('file', params.csvFile);
      formData.append('default_source', 'استيراد CSV');
      payloadBody = formData;
    }

    const res = await executeWithAdapter<CsvImportJobDto | number>({
      endpoint: '/api/v1/import/csv',
      method: 'POST',
      orgId: params.orgId,
      payload: payloadBody,
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.leads.length;
        }
        try {
          const batch = writeBatch(db);
          for (const lead of params.leads) {
            const { id: docId, ...rest } = lead;
            batch.set(doc(db, 'leads', docId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'leads_csv_import');
        }
        return params.leads.length;
      },
    });

    if (typeof res === 'number') {
      return res;
    }
    return res.imported_count || res.total_rows || params.leads.length;
  },

  async getCsvImportJobStatus(params: {
    orgId: string;
    jobId: string;
  }): Promise<CsvImportJobDto | null> {
    return executeWithAdapter<CsvImportJobDto | null>({
      endpoint: `/api/v1/import/status/${params.jobId}`,
      method: 'GET',
      orgId: params.orgId,
      fallback: () => null,
    });
  },

  async updateLeadFields(params: {
    orgId: string;
    isCloudMode: boolean;
    leadId: string;
    patch: Partial<Lead>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/leads/${params.leadId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: {
        full_name: params.patch.fullName,
        company: params.patch.company,
        email: params.patch.email,
        phone: params.patch.phone,
        source: params.patch.source,
        status: params.patch.status,
        score: params.patch.aiScore,
        estimated_value: params.patch.estimatedValue,
        owner_id: params.patch.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'leads', params.leadId), {
            ...stripUndefinedFields(params.patch),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `leads/${params.leadId}`);
        }
      },
    });
  },

  async bulkUpdateLeads(params: {
    orgId: string;
    isCloudMode: boolean;
    leadIds: string[];
    patch: Partial<Lead>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/leads/bulk-update',
      method: 'PATCH',
      orgId: params.orgId,
      payload: { leadIds: params.leadIds, patch: params.patch },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const sanitized = stripUndefinedFields(params.patch);
          const batch = writeBatch(db);
          for (const id of params.leadIds) {
            batch.update(doc(db, 'leads', id), {
              ...sanitized,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'leads_bulk_update');
        }
      },
    });
  },

  async softDeleteLeads(params: {
    orgId: string;
    isCloudMode: boolean;
    targets: Lead[];
    recycleEntries: RecycleBinItem[];
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/leads/soft-delete',
      method: 'POST',
      orgId: params.orgId,
      payload: { leadIds: params.targets.map((t) => t.id) },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const batch = writeBatch(db);
          for (const entry of params.recycleEntries) {
            const { id: rbId, ...rbRest } = entry;
            batch.set(doc(db, 'recycle_bin', rbId), {
              ...stripUndefinedFields(rbRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const lead of params.targets) {
            batch.delete(doc(db, 'leads', lead.id));
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'leads_soft_delete');
        }
      },
    });
  },

  async convertLeadAtomic(params: {
    orgId: string;
    isCloudMode: boolean;
    lead: Lead;
    leadPatch: Partial<Lead>;
    newAccount: Account | null;
    newContact: Contact | null;
    newDeal: Deal | null;
    touchpointsToMigrate: Touchpoint[];
    targetEntityType: 'deal' | 'contact';
    targetEntityId: string;
    targetEntityName: string;
    resolvedContactId: string;
    resolvedAccountId?: string;
    resolvedDealId?: string;
    onPreviewApply: () => void;
  }): Promise<{ contactId: string; accountId?: string; dealId?: string }> {
    return executeWithAdapter({
      endpoint: `/api/v1/leads/${params.lead.id}/convert`,
      method: 'POST',
      orgId: params.orgId,
      payload: {
        unique_id: params.lead.unique_id,
        create_account: Boolean(params.newAccount),
        account_name: params.newAccount?.name || params.lead.company,
        account_industry: params.newAccount?.industry,
        account_city: params.newAccount?.city,
        create_deal: Boolean(params.newDeal),
        deal_title: params.newDeal?.title,
        deal_stage: params.newDeal?.stage || 'تأهيل',
        deal_amount: params.newDeal?.amount ?? params.lead.estimatedValue,
        deal_probability: params.newDeal?.probability ?? 30,
        expected_close_date: params.newDeal?.closeDate,
        owner_id: params.lead.ownerId,
        newAccount: params.newAccount,
        newContact: params.newContact,
        newDeal: params.newDeal,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return {
            contactId: params.resolvedContactId,
            accountId: params.resolvedAccountId,
            dealId: params.resolvedDealId,
          };
        }

        try {
          const batch = writeBatch(db);
          if (params.newAccount) {
            const { id: accId, ...accRest } = params.newAccount;
            batch.set(doc(db, 'accounts', accId), {
              ...stripUndefinedFields(accRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          if (params.newContact) {
            const { id: conId, ...conRest } = params.newContact;
            batch.set(doc(db, 'contacts', conId), {
              ...stripUndefinedFields(conRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          if (params.newDeal) {
            const { id: dId, ...dRest } = params.newDeal;
            batch.set(doc(db, 'deals', dId), {
              ...stripUndefinedFields(dRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          batch.update(doc(db, 'leads', params.lead.id), {
            ...stripUndefinedFields(params.leadPatch),
            updatedAt: serverTimestamp(),
          });

          for (const tp of params.touchpointsToMigrate) {
            batch.update(doc(db, 'touchpoints', tp.id), {
              relatedEntityType: params.targetEntityType,
              relatedEntityId: params.targetEntityId,
              relatedEntityName: params.targetEntityName,
              leadId: params.lead.id,
              leadUniqueId: params.lead.unique_id,
              updatedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `leads_convert/${params.lead.id}`);
        }

        return {
          contactId: params.resolvedContactId,
          accountId: params.resolvedAccountId,
          dealId: params.resolvedDealId,
        };
      },
    });
  },

  async createLeadTask(params: {
    orgId: string;
    isCloudMode: boolean;
    task: CrmTask;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/activities',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        activity_type: 'task',
        title: params.task.title,
        status: params.task.status,
        priority: params.task.priority,
        due_date: params.task.dueDate,
        owner_id: params.task.assignedToName,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const { id: taskId, ...rest } = params.task;
          await setDoc(doc(db, 'tasks', taskId), {
            ...stripUndefinedFields(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `tasks/${params.task.id}`);
        }
      },
    });
  },
};
