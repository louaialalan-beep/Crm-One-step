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

export interface ModuleCrudPermission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface CrmUser {
  id: string;
  uid: string;
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
  name: string;
  description?: string;
  isSystem: boolean;
  modulePermissions: Record<CrmModuleKey, ModuleCrudPermission>;
  fieldSecurity: Record<string, Record<string, FieldAccessLevel>>;
}

export interface CrmRole {
  id: string;
  ownerId: string;
  name: string;
  reportsToRoleId?: string;
  dataVisibility: 'private' | 'team' | 'organization';
  description?: string;
}

export interface CustomField {
  id: string;
  ownerId: string;
  module: CrmModuleKey;
  fieldKey: string;
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
}

export type ContactStatus =
  | 'عميل نشط'
  | 'بانتظار عرض سعر'
  | 'عميل متكرر (VIP)'
  | 'متوقف / غير نشط';

export interface Contact {
  id: string;
  ownerId: string;
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
}

export interface Account {
  id: string;
  ownerId: string;
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
  name: string;
  module: string;
  active: boolean;
  stagesCount: number;
  description?: string;
}

export interface WorkflowRule {
  id: string;
  ownerId: string;
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
