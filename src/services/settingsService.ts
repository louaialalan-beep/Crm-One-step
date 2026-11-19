import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  BlueprintProcess,
  CrmOrganization,
  CustomFieldDefinition,
  PermissionProfile,
  RecycleBinItem,
  RoleHierarchyNode,
  WorkflowRule,
} from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

export interface CapiEventLogDto {
  id: string;
  org_id: string;
  lead_uid: string;
  event_name: string;
  event_id: string;
  entity_type?: string | null;
  entity_id?: string | null;
  value: number;
  currency: string;
  status: string;
  attempts: number;
  created_at: string;
}

export interface WorkflowLogDto {
  id: string;
  org_id: string;
  rule_id?: string | null;
  module: string;
  record_id: string;
  lead_uid?: string | null;
  action_type: string;
  status: string;
  details: Record<string, unknown>;
  executed_at: string;
}

export const settingsService = {
  async listOrganizations(params: {
    fallbackOrganizations?: CrmOrganization[];
  }): Promise<CrmOrganization[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/organizations',
      method: 'GET',
      fallback: () => params.fallbackOrganizations || [],
    });
  },

  async provisionOrganization(params: {
    organization: CrmOrganization;
    onPreviewApply?: () => void;
  }): Promise<CrmOrganization> {
    return executeWithAdapter({
      endpoint: '/api/v1/organizations',
      method: 'POST',
      payload: {
        name: params.organization.name,
        slug: params.organization.org_id || params.organization.id,
        plan_tier: params.organization.plan,
        seat_limit: params.organization.seats_limit,
      },
      fallback: () => {
        params.onPreviewApply?.();
        return params.organization;
      },
    });
  },

  async listRecycleBin(params: {
    orgId: string;
    fallbackItems?: RecycleBinItem[];
  }): Promise<RecycleBinItem[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/recycle-bin',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackItems || [],
    });
  },

  async restoreRecycleBinItem(params: {
    orgId: string;
    entityType: string;
    entityId: string;
    onPreviewApply?: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: '/api/v1/recycle-bin/restore',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        entity_type: params.entityType,
        entity_id: params.entityId,
      },
      fallback: () => {
        params.onPreviewApply?.();
      },
    });
  },

  async listCapiEventsLog(params: {
    orgId: string;
    leadUid?: string;
  }): Promise<CapiEventLogDto[]> {
    const q = params.leadUid ? `?lead_uid=${encodeURIComponent(params.leadUid)}` : '';
    return executeWithAdapter({
      endpoint: `/api/v1/analytics/capi-logs${q}`,
      method: 'GET',
      orgId: params.orgId,
      fallback: () => [],
    });
  },

  async listWorkflowLogs(params: {
    orgId: string;
  }): Promise<WorkflowLogDto[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/settings/workflow-logs',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => [],
    });
  },

  async saveWorkflowRule(params: {
    orgId: string;
    isCloudMode: boolean;
    rule: WorkflowRule;
    isUpdate?: boolean;
    onPreviewApply?: () => void;
  }): Promise<WorkflowRule> {
    return executeWithAdapter({
      endpoint: params.isUpdate ? `/api/v1/settings/workflows/${params.rule.id}` : '/api/v1/settings/workflows',
      method: params.isUpdate ? 'PATCH' : 'POST',
      orgId: params.orgId,
      payload: params.rule,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            const { id: wfId, ...rest } = params.rule;
            if (params.isUpdate) {
              await updateDoc(doc(db, 'workflows', wfId), {
                ...stripUndefinedFields(rest),
                updatedAt: serverTimestamp(),
              });
            } else {
              await setDoc(doc(db, 'workflows', wfId), {
                ...stripUndefinedFields(rest),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `workflows/${params.rule.id}`);
          }
        }
        return params.rule;
      },
    });
  },

  async toggleWorkflowActive(params: {
    orgId: string;
    isCloudMode: boolean;
    workflowId: string;
    active: boolean;
    onPreviewApply?: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/settings/workflows/${params.workflowId}/toggle`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: { active: params.active },
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            await updateDoc(doc(db, 'workflows', params.workflowId), {
              active: params.active,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `workflows/${params.workflowId}`);
          }
        }
      },
    });
  },

  async deleteWorkflowRule(params: {
    orgId: string;
    isCloudMode: boolean;
    workflowId: string;
    onPreviewApply?: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/settings/workflows/${params.workflowId}`,
      method: 'DELETE',
      orgId: params.orgId,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            await deleteDoc(doc(db, 'workflows', params.workflowId));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `workflows/${params.workflowId}`);
          }
        }
      },
    });
  },

  async saveCustomField(params: {
    orgId: string;
    isCloudMode: boolean;
    field: CustomFieldDefinition;
    onPreviewApply?: () => void;
  }): Promise<CustomFieldDefinition> {
    return executeWithAdapter({
      endpoint: '/api/v1/settings/custom-fields',
      method: 'POST',
      orgId: params.orgId,
      payload: params.field,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            const { id: fId, ...rest } = params.field;
            await setDoc(doc(db, 'custom_fields', fId), {
              ...stripUndefinedFields(rest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `custom_fields/${params.field.id}`);
          }
        }
        return params.field;
      },
    });
  },

  async saveProfile(params: {
    orgId: string;
    isCloudMode: boolean;
    profile: PermissionProfile;
    onPreviewApply?: () => void;
  }): Promise<PermissionProfile> {
    return executeWithAdapter({
      endpoint: `/api/v1/settings/profiles/${params.profile.id}`,
      method: 'PUT',
      orgId: params.orgId,
      payload: params.profile,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            const { id: pId, ...rest } = params.profile;
            await setDoc(
              doc(db, 'profiles', pId),
              {
                ...stripUndefinedFields(rest),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `profiles/${params.profile.id}`);
          }
        }
        return params.profile;
      },
    });
  },

  async saveRoleNode(params: {
    orgId: string;
    isCloudMode: boolean;
    role: RoleHierarchyNode;
    onPreviewApply?: () => void;
  }): Promise<RoleHierarchyNode> {
    return executeWithAdapter({
      endpoint: `/api/v1/settings/roles/${params.role.id}`,
      method: 'PUT',
      orgId: params.orgId,
      payload: params.role,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            const { id: rId, ...rest } = params.role;
            await setDoc(
              doc(db, 'roles', rId),
              {
                ...stripUndefinedFields(rest),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `roles/${params.role.id}`);
          }
        }
        return params.role;
      },
    });
  },

  async saveBlueprintSummary(params: {
    orgId: string;
    isCloudMode: boolean;
    blueprint: BlueprintProcess;
    onPreviewApply?: () => void;
  }): Promise<BlueprintProcess> {
    return executeWithAdapter({
      endpoint: `/api/v1/settings/blueprints/${params.blueprint.id}`,
      method: 'PUT',
      orgId: params.orgId,
      payload: params.blueprint,
      fallback: async () => {
        params.onPreviewApply?.();
        if (params.isCloudMode) {
          try {
            const { id: bpId, ...rest } = params.blueprint;
            await setDoc(
              doc(db, 'blueprints', bpId),
              {
                ...stripUndefinedFields(rest),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `blueprints/${params.blueprint.id}`);
          }
        }
        return params.blueprint;
      },
    });
  },

  async createCheckoutSession(params: {
    orgId: string;
    provider: 'moyasar' | 'tap' | 'stripe';
    planTier: 'Free' | 'Growth' | 'Enterprise';
    billingCycle: 'monthly' | 'yearly';
    onPreviewApply?: (result: {
      session_id: string;
      provider: 'moyasar' | 'tap' | 'stripe';
      plan_tier: 'Free' | 'Growth' | 'Enterprise';
      amount_sar: number;
      checkout_url: string;
      status: string;
    }) => void;
  }): Promise<{
    session_id: string;
    provider: string;
    plan_tier: string;
    amount_sar: number;
    checkout_url: string;
    status: string;
  }> {
    const monthlyPrices: Record<'Free' | 'Growth' | 'Enterprise', number> = {
      Free: 0,
      Growth: 749,
      Enterprise: 1990,
    };
    const base = monthlyPrices[params.planTier] ?? 749;
    const computedAmount =
      params.billingCycle === 'yearly' ? Math.round(base * 12 * 0.8) : base;

    return executeWithAdapter({
      endpoint: '/api/v1/billing/checkout-session',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        provider: params.provider,
        plan_tier: params.planTier,
        billing_cycle: params.billingCycle,
      },
      fallback: () => {
        const simulated = {
          session_id: `chk_${params.provider}_${Date.now().toString(36)}`,
          provider: params.provider,
          plan_tier: params.planTier,
          amount_sar: computedAmount,
          checkout_url: `https://checkout.${params.provider}.com/pay/crm-one-step-${params.planTier.toLowerCase()}`,
          status: 'paid',
        };
        params.onPreviewApply?.(simulated);
        return simulated;
      },
    });
  },

  async sendTransactionalEmail(params: {
    orgId: string;
    templateType: 'employee_invite' | 'invoice_notification' | 'password_reset';
    toEmail: string;
    recipientName: string;
    organizationName?: string;
    roleName?: string;
    invoiceNumber?: string;
    invoiceTotal?: string;
    leadUid?: string;
  }): Promise<{
    job_id: string;
    status: string;
    template_type: string;
    to_email: string;
    queued_via_arq: boolean;
    message: string;
  }> {
    return executeWithAdapter({
      endpoint: '/api/v1/billing/send-email',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        template_type: params.templateType,
        to_email: params.toEmail,
        recipient_name: params.recipientName,
        organization_name: params.organizationName,
        role_name: params.roleName,
        invoice_number: params.invoiceNumber,
        invoice_total: params.invoiceTotal,
        lead_uid: params.leadUid,
      },
      fallback: () => ({
        job_id: `smtp_arq_${Date.now().toString(36)}`,
        status: 'queued',
        template_type: params.templateType,
        to_email: params.toEmail,
        queued_via_arq: true,
        message: `تم جدولة إرسال البريد (${params.templateType}) عبر طابور ARQ SMTP إلى ${params.toEmail} بنجاح.`,
      }),
    });
  },

  async listSuperAdminOrganizations(params: {
    fallbackOrganizations: Array<{
      id: string;
      org_id: string;
      name: string;
      slug: string;
      vat_number: string;
      base_currency: string;
      plan_tier: string;
      seat_limit: number;
      users_count: number;
      customers_count: number;
      payment_status: string;
      billing_provider?: string;
      is_active: boolean;
      created_at: string;
    }>;
  }) {
    return executeWithAdapter({
      endpoint: '/api/v1/super-admin/organizations',
      method: 'GET',
      fallback: () => params.fallbackOrganizations,
    });
  },

  async updateSuperAdminOrganization(params: {
    orgId: string;
    planTier?: string;
    seatLimit?: number;
    paymentStatus?: string;
    isActive?: boolean;
    onPreviewApply?: () => void;
  }) {
    return executeWithAdapter({
      endpoint: `/api/v1/super-admin/organizations/${params.orgId}`,
      method: 'PATCH',
      payload: {
        plan_tier: params.planTier,
        seat_limit: params.seatLimit,
        payment_status: params.paymentStatus,
        is_active: params.isActive,
      },
      fallback: () => {
        params.onPreviewApply?.();
        return {
          id: params.orgId,
          plan_tier: params.planTier,
          seat_limit: params.seatLimit,
          payment_status: params.paymentStatus,
          is_active: params.isActive,
        };
      },
    });
  },
};

