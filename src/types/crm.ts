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

export type OrganizationPlan = 'Free' | 'Growth' | 'Starter' | 'Pro' | 'Enterprise';

export type PaymentStatus = 'paid' | 'trialing' | 'past_due' | 'suspended';
export type BillingProvider = 'moyasar' | 'tap' | 'stripe';

export interface CrmOrganization {
  id: string;
  org_id: string;
  ownerId: string;
  name: string;
  plan: OrganizationPlan;
  seats_limit: number;
  active_users_count: number;
  customers_count?: number;
  payment_status?: PaymentStatus;
  billing_provider?: BillingProvider;
  subscription_id?: string;
  is_active?: boolean;
  vat_number?: string;
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
  is_super_admin?: boolean;
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
  leadUniqueId?: string;
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
  leadScore?: number;
  ownerName?: string;
  createdAt?: string;
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
  repeatOrderCount?: number;
  lifetimeRevenue?: number;
  lastTouchSource?: string;
  ownerName?: string;
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
  ownerName?: string;
}

export type DealStage =
  | 'تأهيل مبدئي'
  | 'تحديد الاحتياج'
  | 'عرض سعر'
  | 'تفاوض'
  | 'مكتملة'
  | 'خسارة';

export type CurrencyRateMode = 'fixed' | 'live';

export interface OrganizationCurrency {
  code: string;
  name: string;
  englishName?: string;
  symbol: string;
  symbolPosition?: 'prefix' | 'suffix';
  decimals?: number;
  rateMode: CurrencyRateMode;
  rateToBase: number;
  liveSpreadPercent?: number;
  isPrimary: boolean;
  isActive: boolean;
  isCustom?: boolean;
  updatedAt: string;
}

export interface Deal {
  id: string;
  ownerId: string;
  org_id?: string;
  title: string;
  accountId: string;
  accountName: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  ownerName: string;
  nextStep?: string;
  leadUniqueId?: string;
  contactId?: string;
}

export type TaxMode = 'exclusive' | 'inclusive';

export type LineItemUnit = 'حبة' | 'ساعة' | 'اشتراك' | 'مشروع';

export type DiscountType = 'percentage' | 'fixed' | 'amount';

export interface FinancialLineItem {
  id: string;
  productName?: string;
  name?: string;
  description?: string;
  unit?: LineItemUnit;
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  taxRate?: 15 | 0 | number;
  vatRate?: number;
  // Quantity tracking for Sales Orders
  deliveredQuantity?: number;
  invoicedQuantity?: number;
}

export interface InvoicePaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'تحويل بنكي' | 'مدى' | 'بطاقة ائتمانية' | 'نقدي';
  referenceNumber: string;
  notes?: string;
}

export interface Quote {
  id: string;
  ownerId: string;
  org_id?: string;
  quoteNumber: string;
  subject: string;
  dealId: string;
  dealTitle?: string;
  accountId?: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  leadUniqueId?: string;
  ownerName?: string;
  issueDate?: string;
  validUntil: string;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  deliveryDuration?: string;
  termsAndConditions?: string;
  customerNotes?: string;
  notes?: string;
  taxMode?: TaxMode;
  lineItems?: FinancialLineItem[];
  subtotalAmount?: number;
  discountTotal?: number;
  taxableAmount?: number;
  vatAmount?: number;
  totalAmount: number;
  status: 'مسودة' | 'مرسل' | 'مؤهل' | 'مقبول' | 'مكتملة' | 'مرفوض' | 'منتهي' | 'خسارة';
}

export interface SalesOrder {
  id: string;
  ownerId: string;
  org_id?: string;
  orderNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  customerPoNumber?: string;
  dealId?: string;
  dealTitle?: string;
  accountId?: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  leadUniqueId?: string;
  ownerName?: string;
  orderDate?: string;
  issueDate?: string;
  deliveryDate: string;
  billingAddress?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  notes?: string;
  taxMode?: TaxMode;
  lineItems?: FinancialLineItem[];
  subtotalAmount?: number;
  discountTotal?: number;
  taxableAmount?: number;
  vatAmount?: number;
  totalAmount: number;
  status: 'قيد التجهيز' | 'قيد التأكيد' | 'قيد التنفيذ' | 'تسليم جزئي' | 'مؤهل' | 'مكتملة' | 'مؤجلة' | 'ملغي';
}

export interface Invoice {
  id: string;
  ownerId: string;
  org_id?: string;
  invoiceNumber: string;
  invoiceType?: 'فاتورة ضريبية (B2B)' | 'فاتورة ضريبية مبسطة (B2C)' | 'إشعار دائن';
  salesOrderId?: string;
  salesOrderNumber?: string;
  orderId?: string;
  quoteId?: string;
  quoteNumber?: string;
  dealId?: string;
  dealTitle?: string;
  accountId?: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  leadUniqueId?: string;
  ownerName?: string;
  issueDate?: string;
  supplyDate?: string;
  dueDate: string;
  sellerName?: string;
  sellerCrNumber?: string;
  sellerVatNumber?: string;
  sellerAddress?: string;
  buyerVatNumber?: string;
  buyerAddress?: string;
  bankName?: string;
  ibanNumber?: string;
  currency?: string;
  exchangeRate?: number;
  taxMode?: TaxMode;
  lineItems?: FinancialLineItem[];
  subtotalAmount?: number;
  discountTotal?: number;
  taxableAmount?: number;
  vatAmount?: number;
  totalAmount: number;
  totalWithVat?: number;
  paidAmount: number;
  zatcaQrBase64?: string;
  notes?: string;
  payments?: InvoicePaymentRecord[];
  status: 'مكتملة' | 'مدفوعة' | 'مدفوعة جزئياً' | 'غير مدفوعة' | 'مؤجلة' | 'متأخرة' | 'مسودة';
}

export interface PurchaseOrder {
  id: string;
  ownerId: string;
  org_id?: string;
  poNumber: string;
  vendorName: string;
  vendorContact?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorVatNumber?: string;
  subject?: string;
  dealId?: string;
  dealTitle?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  ownerName?: string;
  issueDate?: string;
  expectedDeliveryDate: string;
  deliveryAddress?: string;
  shippingAddress?: string;
  paymentTerms?: string;
  notes?: string;
  currency?: string;
  exchangeRate?: number;
  taxMode?: TaxMode;
  lineItems?: FinancialLineItem[];
  subtotalAmount?: number;
  discountTotal?: number;
  taxableAmount?: number;
  vatAmount?: number;
  totalAmount: number;
  status: 'مسودة' | 'مرسل للمورد' | 'مؤكد' | 'مستلم جزئياً' | 'مستلم بالكامل' | 'ملغي';
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
  timestamp?: string;
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
  dealId?: string;
  leadId?: string;
  leadUniqueId?: string;
}

export interface BlueprintStageRequirementConfig {
  requireFinalAmount?: boolean;
  requireDiscountPercent?: boolean;
  requireContractPdf?: boolean;
  requireLossReason?: boolean;
  requireNextStep?: boolean;
  checklistItems?: string[];
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
  stageSteps?: string[];
  stageRequirements?: Record<string, BlueprintStageRequirementConfig>;
}

export interface QuickReplyTemplate {
  id: string;
  command: string;
  label: string;
  template: string;
  module?: 'leads' | 'contacts' | 'deals' | 'all';
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
  org_id?: string;
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

export type BlueprintProcess = Blueprint;
export type CustomFieldDefinition = CustomField;
export type PermissionProfile = CrmProfile;
export type RoleHierarchyNode = CrmRole;


