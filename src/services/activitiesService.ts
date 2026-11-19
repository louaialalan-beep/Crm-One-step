import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { CrmTask, InboxMessage, Touchpoint } from '../types/crm';
import {
  connectWhatsAppWebSocket,
  executeWithAdapter,
  stripUndefinedFields,
  type WhatsAppRealtimePayload,
  type WhatsAppSocketEnvelope,
} from './apiClient';

export const activitiesService = {
  async listActivities(params: {
    orgId: string;
    fallbackTasks?: CrmTask[];
  }): Promise<CrmTask[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/activities',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackTasks || [],
    });
  },

  async createTask(params: {
    orgId: string;
    isCloudMode: boolean;
    task: CrmTask;
    onPreviewApply: () => void;
  }): Promise<CrmTask> {
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
          return params.task;
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
        return params.task;
      },
    });
  },

  async updateTaskStatus(params: {
    orgId: string;
    isCloudMode: boolean;
    taskId: string;
    nextStatus: CrmTask['status'];
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/activities/${params.taskId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: { status: params.nextStatus },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'tasks', params.taskId), {
            status: params.nextStatus,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tasks/${params.taskId}`);
        }
      },
    });
  },

  async logTouchpoint(params: {
    orgId: string;
    isCloudMode: boolean;
    touchpoint: Touchpoint;
    onPreviewApply: () => void;
  }): Promise<Touchpoint> {
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
          return params.touchpoint;
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
        return params.touchpoint;
      },
    });
  },

  /**
   * Sends an outbound WhatsApp message via `/api/v1/whatsapp/send` (or general activity for other channels)
   * when `VITE_API_URL` is configured, with seamless Preview Mode / Firestore fallback.
   */
  async sendOmnichannelMessage(params: {
    orgId: string;
    isCloudMode: boolean;
    message: InboxMessage;
    phoneNumber?: string;
    mediaUrl?: string;
    onPreviewApply: () => void;
  }): Promise<InboxMessage> {
    const isWhatsApp = params.message.channel === 'whatsapp';
    return executeWithAdapter({
      endpoint: isWhatsApp ? '/api/v1/whatsapp/send' : '/api/v1/activities',
      method: 'POST',
      orgId: params.orgId,
      payload: isWhatsApp
        ? {
            phone_number: params.phoneNumber || '+966501234567',
            contact_name: params.message.senderName,
            lead_uid: params.message.leadUniqueId || 'RWQ-10000',
            message_type: params.mediaUrl ? 'document' : 'text',
            body: params.message.body,
            media_url: params.mediaUrl,
          }
        : {
            activity_type: params.message.channel,
            title: `رسالة إلى ${params.message.senderName}`,
            description: params.message.body,
            status: 'مكتملة',
            payload: {
              direction: params.message.direction,
              sender: params.message.senderName,
              channel: params.message.channel,
            },
          },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.message;
        }
        try {
          const { id: msgId, ...rest } = params.message;
          await setDoc(doc(db, 'messages', msgId), {
            ...stripUndefinedFields(rest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `messages/${params.message.id}`);
        }
        return params.message;
      },
    });
  },

  async listWhatsAppCloudMessages(params: {
    orgId: string;
    leadUid?: string;
    fallbackMessages?: WhatsAppRealtimePayload[];
  }): Promise<WhatsAppRealtimePayload[]> {
    const query = params.leadUid ? `?lead_uid=${encodeURIComponent(params.leadUid)}` : '';
    return executeWithAdapter({
      endpoint: `/api/v1/whatsapp/messages${query}`,
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackMessages || [],
    });
  },

  subscribeToWhatsAppWebSocket(params: {
    orgId: string;
    onEvent: (envelope: WhatsAppSocketEnvelope) => void;
  }): () => void {
    return connectWhatsAppWebSocket(params);
  },
};
