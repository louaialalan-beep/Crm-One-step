import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Account,
  Contact,
  CrmTask,
  Deal,
  RecycleBinItem,
  Touchpoint,
} from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

export interface StageBottleneckMetricDto {
  stage: string;
  transitions_count: number;
  avg_dwell_seconds: number;
  avg_dwell_hours: number;
  max_dwell_seconds: number;
  bottleneck_severity: 'normal' | 'warning' | 'critical';
}

export interface StageBottlenecksReportDto {
  org_id: string;
  total_tracked_transitions: number;
  most_congested_stage?: string | null;
  stages: StageBottleneckMetricDto[];
}

export const dealsService = {
  async listDeals(params: {
    orgId: string;
    fallbackDeals?: Deal[];
  }): Promise<Deal[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/deals',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackDeals || [],
    });
  },

  async createDealWithEntities(params: {
    orgId: string;
    isCloudMode: boolean;
    deal: Deal;
    newAccount: Account | null;
    newContact: Contact | null;
    initialTouchpoint: Touchpoint;
    onPreviewApply: () => void;
  }): Promise<Deal> {
    return executeWithAdapter({
      endpoint: '/api/v1/deals',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        lead_uid: params.deal.leadUniqueId,
        title: params.deal.title,
        stage: params.deal.stage,
        amount: params.deal.amount,
        currency: params.deal.currency || 'SAR',
        probability: params.deal.probability,
        expected_close_date: params.deal.closeDate,
        owner_id: params.deal.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.deal;
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
          const { id: dealId, ...dealRest } = params.deal;
          batch.set(doc(db, 'deals', dealId), {
            ...stripUndefinedFields(dealRest),
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
          handleFirestoreError(err, OperationType.CREATE, `deals/${params.deal.id}`);
        }
        return params.deal;
      },
    });
  },

  /**
   * Blueprint Stage Transition Engine (`POST /api/v1/deals/{id}/transition`):
   * Validates Before/During rules in FastAPI, records `dwell_seconds` in `stage_history`,
   * fires After-Actions & Workflow Rules via ARQ, and queues Meta CAPI `Purchase` on Won deals.
   */
  async transitionDealStage(params: {
    orgId: string;
    isCloudMode: boolean;
    dealId: string;
    toStage: Deal['stage'];
    amount?: number;
    probability?: number;
    lostReason?: string;
    reviewNotes?: string;
    nextStep?: string;
    duringFields?: Record<string, unknown>;
    onPreviewApply: () => void;
  }): Promise<void> {
    await executeWithAdapter({
      endpoint: `/api/v1/deals/${params.dealId}/transition`,
      method: 'POST',
      orgId: params.orgId,
      payload: {
        to_stage: params.toStage,
        amount: params.amount,
        probability: params.probability,
        lost_reason: params.lostReason,
        review_notes: params.reviewNotes,
        next_step: params.nextStep,
        during_fields: params.duringFields || {},
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'deals', params.dealId), {
            ...stripUndefinedFields({
              stage: params.toStage,
              amount: params.amount,
              probability: params.probability,
              nextStep: params.nextStep,
            }),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `deals/${params.dealId}`);
        }
      },
    });
  },

  /**
   * Queries `GET /api/v1/analytics/bottlenecks` for average stage dwell duration from `stage_history`.
   */
  async getStageBottlenecksAnalytics(params: {
    orgId: string;
    fallbackReport?: StageBottlenecksReportDto;
  }): Promise<StageBottlenecksReportDto> {
    return executeWithAdapter({
      endpoint: '/api/v1/analytics/bottlenecks',
      method: 'GET',
      orgId: params.orgId,
      fallback: () =>
        params.fallbackReport || {
          org_id: params.orgId,
          total_tracked_transitions: 0,
          most_congested_stage: null,
          stages: [],
        },
    });
  },

  async updateDealFields(params: {
    orgId: string;
    isCloudMode: boolean;
    dealId: string;
    patch: Partial<Deal>;
    onPreviewApply: () => void;
  }): Promise<void> {
    if (params.patch.stage) {
      return this.transitionDealStage({
        orgId: params.orgId,
        isCloudMode: params.isCloudMode,
        dealId: params.dealId,
        toStage: params.patch.stage,
        amount: params.patch.amount,
        probability: params.patch.probability,
        nextStep: params.patch.nextStep,
        onPreviewApply: params.onPreviewApply,
      });
    }

    return executeWithAdapter({
      endpoint: `/api/v1/deals/${params.dealId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: {
        title: params.patch.title,
        stage: params.patch.stage,
        amount: params.patch.amount,
        probability: params.patch.probability,
        expected_close_date: params.patch.closeDate,
        owner_id: params.patch.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'deals', params.dealId), {
            ...stripUndefinedFields(params.patch),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `deals/${params.dealId}`);
        }
      },
    });
  },

  async bulkUpdateDeals(params: {
    orgId: string;
    isCloudMode: boolean;
    dealIds: string[];
    patch: Partial<Deal>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/deals/bulk-update',
      method: 'PATCH',
      orgId: params.orgId,
      payload: { dealIds: params.dealIds, patch: params.patch },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const sanitized = stripUndefinedFields(params.patch);
          const batch = writeBatch(db);
          for (const id of params.dealIds) {
            batch.update(doc(db, 'deals', id), {
              ...sanitized,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'deals_bulk_update');
        }
      },
    });
  },

  async softDeleteDeals(params: {
    orgId: string;
    isCloudMode: boolean;
    targets: Deal[];
    recycleEntries: RecycleBinItem[];
    onPreviewApply: () => void;
  }): Promise<void> {
    const firstId = params.targets[0]?.id;
    return executeWithAdapter({
      endpoint:
        firstId && params.targets.length === 1
          ? `/api/v1/deals/${firstId}`
          : '/api/v1/deals/soft-delete',
      method: firstId && params.targets.length === 1 ? 'DELETE' : 'POST',
      orgId: params.orgId,
      payload:
        firstId && params.targets.length === 1
          ? undefined
          : { dealIds: params.targets.map((d) => d.id) },
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
          for (const deal of params.targets) {
            batch.delete(doc(db, 'deals', deal.id));
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'deals_soft_delete');
        }
      },
    });
  },

  async addDealTouchpoint(params: {
    orgId: string;
    isCloudMode: boolean;
    touchpoint: Touchpoint;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/activities/touchpoints',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        lead_uid: params.touchpoint.leadUniqueId || 'RWQ-10000',
        channel: params.touchpoint.channel,
        campaign_name: params.touchpoint.campaign,
        ad_id: params.touchpoint.adId,
        source: params.touchpoint.channel,
        metadata: { summary: params.touchpoint.summary },
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const { id: tpId, ...rest } = params.touchpoint;
          await setDoc(doc(db, 'touchpoints', tpId), {
            ...stripUndefinedFields(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `touchpoints/${params.touchpoint.id}`);
        }
      },
    });
  },

  async addDealTask(params: {
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
