export type CrmModuleKey =
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'deals'
  | 'quotes'
  | 'sales_orders'
  | 'invoices'
  | 'tasks';

export type FieldAccessLevel = 'read_write' | 'read_only' | 'hidden';

export interface CrmAddonFlags {
  whatsapp_campaigns: boolean;
  meta_direct: boolean;
  custom_functions: boolean;
}

export type OrganizationPlan = 'Starter' | 'Pro' | 'Enterprise';

export interface CrmOrganization {
  id: string;
  org_id: string;
  ownerId: string;
  name: string;
  plan: OrganizationPlan;
  seats_limit: number;
  active_users_count: number;
  addons: CrmAddonFlags;
  numbers_limit?: number;
  messages_used?: number;
  messages_limit?: number;
  created_by: string;
  created_at?: string;
}

export interface ModuleCrudPermission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface CrmUser {
  id: string;
  uid: string;
  org_id?: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  profileId: string;
  roleId: string;
  department?: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
}

export interface CrmProfile {
  id: string;
  ownerId: string;
  org_id?: string;
  name: string;
  description?: string;
  isSystem: boolean;
  modulePermissions: Record<CrmModuleKey, ModuleCrudPermission>;
  fieldSecurity: Record<string, Record<string, FieldAccessLevel>>;
  addonPermissions?: CrmAddonFlags;
}

export interface CrmRole {
  id: string;
  ownerId: string;
  org_id?: string;
  name: string;
  reportsToRoleId?: string;
  dataVisibility: 'private' | 'team' | 'organization';
  hide_subordinates_data?: boolean;
  description?: string;
}

export interface CustomField {
  id: string;
  ownerId: string;
  org_id?: string;
  module: CrmModuleKey;
  fieldKey: string;
  api_name?: string;
  label: string;
  fieldType: 'text' | 'number' | 'currency' | 'select' | 'date' | 'boolean' | 'email' | 'phone';
  section: string;
  required: boolean;
  order: number;
  options?: string[];
}

export type LeadStatus = 'جديد' | 'تم التواصل' | 'مؤهل للتحويل' | 'غير مهتم';

export type LeadChannel =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'website'
  | 'phone'
  | 'referral';

export interface Lead {
  id: string;
  ownerId: string;
  org_id?: string;
  unique_id: string; // RWQ-xxxxx
  fullName: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  altContact?: string;
  source?: string;
  channel?: LeadChannel;
  campaign?: string;
  adId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: LeadStatus;
  aiScore: number;
  estimatedValue: number;
  approvedBudget?: number;
  assignedToName: string;
  city?: string;
  tags?: string[];
  lastActivityLabel?: string;
  lastMessageSnippet?: string;
  awaitingReplyHours?: number;
  followUpAt?: string;
  notes?: string;
  converted?: boolean;
  convertedAt?: string;
  convertedContactId?: string;
  convertedAccountId?: string;
  convertedDealId?: string;
  customValues?: Record<string, string | number | boolean>;
  opt_out?: boolean;
  last_campaign_sent_at?: string;
}

export type ContactStatus =
  | 'عميل نشط'
  | 'بانتظار عرض سعر'
  | 'عميل متكرر (VIP)'
  | 'متوقف / غير نشط';

export interface Contact {
  id: string;
  ownerId: string;
  org_id?: string;
  fullName: string;
  accountId: string;
  accountName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  city?: string;
  isPrimary: boolean;
  leadUniqueId?: string;
  primarySource?: string;
  contactStatus?: ContactStatus | string;
  channel?: LeadChannel;
  assignedToName?: string;
  tags?: string[];
  lastActivityLabel?: string;
  lastMessageSnippet?: string;
  notes?: string;
  customValues?: Record<string, string | number | boolean>;
  opt_out?: boolean;
  last_campaign_sent_at?: string;
}

export interface Account {
  id: string;
  ownerId: string;
  org_id?: string;
  name: string;
  industry: string;
  city?: string;
  tier: 'استراتيجي' | 'مؤسسات' | 'نمو';
  annualRevenue: number;
  employeesCount?: number;
  website?: string;
  accountManager: string;
  leadUniqueId?: string;
}

export type DealStage =
  | 'تأهيل مبدئي'
  | 'تحديد الاحتياج'
  | 'عرض سعر'
  | 'تفاوض'
  | 'مكتملة'
  | 'خسارة';

export interface Deal {
  id: string;
  ownerId: string;
  org_id?: string;
  title: string;
  accountId: string;
  accountName: string;
  amount: number;
  currency: 'SAR' | 'USD' | 'AED';
  stage: DealStage;
  probability: number;
  closeDate: string;
  ownerName: string;
  nextStep?: string;
  leadUniqueId?: string;
  contactId?: string;
}

export interface Quote {
  id: string;
  ownerId: string;
  org_id?: string;
  quoteNumber: string;
  subject: string;
  dealId: string;
  accountName: string;
  totalAmount: number;
  status: 'مسودة' | 'مرسل' | 'مؤهل' | 'مكتملة' | 'خسارة';
  validUntil: string;
}

export interface SalesOrder {
  id: string;
  ownerId: string;
  org_id?: string;
  orderNumber: string;
  quoteId?: string;
  accountName: string;
  totalAmount: number;
  status: 'قيد التجهيز' | 'مؤهل' | 'مكتملة' | 'مؤجلة';
  deliveryDate: string;
}

export interface Invoice {
  id: string;
  ownerId: string;
  org_id?: string;
  invoiceNumber: string;
  salesOrderId?: string;
  accountName: string;
  totalAmount: number;
  paidAmount: number;
  status: 'مكتملة' | 'مؤجلة' | 'متأخرة' | 'مسودة';
  dueDate: string;
}

export type TouchpointChannel =
  | 'مكالمة'
  | 'اجتماع'
  | 'بريد إلكتروني'
  | 'واتساب'
  | 'إنستغرام'
  | 'موقع ويب'
  | 'حدث';

export interface Touchpoint {
  id: string;
  ownerId: string;
  org_id?: string;
  channel: TouchpointChannel;
  summary: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEntityName: string;
  occurredAt: string;
  leadId?: string;
  leadUniqueId?: string;
  campaign?: string;
  adId?: string;
  utmSource?: string;
  eventType?: string;
}

export interface InboxMessage {
  id: string;
  ownerId: string;
  org_id?: string;
  channel: 'whatsapp' | 'email' | 'chat' | 'instagram' | 'messenger';
  senderName: string;
  companyName?: string;
  subject?: string;
  body: string;
  direction: 'inbound' | 'outbound';
  unread: boolean;
  timestampLabel: string;
  leadId?: string;
  leadUniqueId?: string;
  campaign?: string;
}

export interface CrmTask {
  id: string;
  ownerId: string;
  org_id?: string;
  title: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  status: 'قيد التنفيذ' | 'مكتملة' | 'مؤجلة';
  dueDate: string;
  relatedTo: string;
  assignedToName: string;
  leadId?: string;
  leadUniqueId?: string;
}

export interface Blueprint {
  id: string;
  ownerId: string;
  org_id?: string;
  name: string;
  module: string;
  active: boolean;
  stagesCount: number;
  description?: string;
}

export interface WorkflowRule {
  id: string;
  ownerId: string;
  org_id?: string;
  name: string;
  module: string;
  trigger: string;
  actionSummary: string;
  active: boolean;
  executionsCount: number;
}

export interface RecycleBinItem {
  id: string;
  ownerId: string;
  org_id?: string;
  entityType: string;
  originalId: string;
  displayName: string;
  deletedBy: string;
  deletedAtLabel: string;
  expiresInDays: number;
  payloadJson?: string;
}

export interface SignalNotification {
  id: string;
  title: string;
  description: string;
  category: 'deal' | 'lead' | 'task' | 'system';
  timeLabel: string;
  unread: boolean;
  route: string;
}

export type MetaConnectionStatus = 'connected' | 'reconnect_required';

export interface MetaConnection {
  id: string;
  ownerId: string;
  org_id: string;
  fb_user_id: string;
  fb_user_name?: string;
  long_lived_token_enc: string; // AES-256 encrypted
  token_expires_at: string;
  status: MetaConnectionStatus;
  scopes?: string[];
  last_error_message?: string;
}

export interface MetaPage {
  id: string;
  ownerId: string;
  org_id: string;
  page_id: string;
  page_name: string;
  ig_account_id: string;
  waba_id: string;
  phone_number_id: string;
  page_token_enc: string; // AES-256 encrypted
  subscribed_fields: string[]; // ['leadgen', 'messages']
}

export interface MetaFieldMapping {
  id: string;
  ownerId: string;
  org_id: string;
  form_id: string;
  form_name?: string;
  page_id?: string;
  mappings: Record<string, string>;
  store_extra_in?: 'custom_values' | 'notes';
}

export type MetaWebhookLogStatus = 'queued' | 'processed' | 'failed';

export interface MetaWebhookLog {
  id: string;
  ownerId: string;
  org_id: string;
  event_id: string; // for idempotency
  event_type: string;
  status: MetaWebhookLogStatus;
  retry_count: number;
  error_message?: string;
  payload_summary?: string;
  lead_unique_id?: string;
  created_at: string;
}

export interface WhatsAppTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'OPT_OUT';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppTemplate {
  id: string;
  ownerId: string;
  org_id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  header_type: 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: WhatsAppTemplateButton[];
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

export interface WhatsAppCampaign {
  id: string;
  ownerId: string;
  org_id: string;
  name: string;
  template_id: string;
  template_name: string;
  target_audience: 'all' | 'segment' | 'filter';
  cooldown_days: number;
  exclude_past_campaign_ids: string[];
  prevent_duplicate_sends: boolean;
  exclude_opt_out: boolean;
  daily_batch_limit: number;
  scheduled_at: string;
  ab_testing_enabled: boolean;
  ab_template_b_id?: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  replied_count: number;
  created_at: string;
}

export interface CampaignLog {
  id: string;
  ownerId: string;
  org_id: string;
  campaign_id: string;
  template_id: string;
  contact_id?: string;
  lead_id?: string;
  recipient_phone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'replied' | 'opt_out';
  sent_at: string;
}

export interface CampaignBatch {
  id: string;
  ownerId: string;
  org_id: string;
  campaign_id: string;
  batch_index: number;
  total_batches: number;
  size: number;
  status: 'pending' | 'processing' | 'completed';
  scheduled_for: string;
}

export interface CustomFunction {
  id: string;
  ownerId: string;
  org_id: string;
  name: string;
  apiName: string;
  language: 'javascript' | 'python';
  triggerType: 'workflow' | 'custom_button' | 'cron' | 'webhook';
  code: string;
  description?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface OrgSecret {
  id: string;
  org_id: string;
  keyName: string;
  encryptedValue: string;
  updatedAt: string;
}

export interface FunctionExecutionLog {
  id: string;
  org_id: string;
  functionId: string;
  functionName: string;
  triggerType: string;
  status: 'success' | 'failed' | 'timeout';
  durationMs: number;
  memoryMb: number;
  inputPayload: any;
  outputResult: any;
  consoleLogs: string[];
  executedAt: string;
}

