import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  Globe,
  MessageCircle,
  MessageSquare,
  Minus,
  MoreVertical,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import type {
  Contact,
  ContactStatus,
  Deal,
  LeadChannel,
} from '../../types/crm';
import {
  CONTACT_STATUSES,
  formatCompactDealValue,
  getContactOwnerName,
  getDealsForContact,
  resolveContactStatus,
  type ContactSortKey,
} from '../../utils/contactsLogic';

interface ContactsTableViewProps {
  contacts: Contact[];
  deals: Deal[];
  selectedIds: string[];
  duplicateReasons: Map<string, string>;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  sortBy: ContactSortKey;
  onChangeSortBy: (s: ContactSortKey) => void;
  activeDockedCount: number;
  onToggleFilterPanel: () => void;
  onExportCsv: () => void;
  canUpdateContact: boolean;
  canDeleteContact: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onChangeStatus: (contactId: string, status: ContactStatus) => void;
  onQuickChat: (contactId: string) => void;
  onOpenCreateDeal: (contact: Contact) => void;
  onOpenSplitView: (contactId: string) => void;
  onSoftDeleteContact: (contactId: string) => void;
  onInspectDuplicate: (contactId: string) => void;
}

type ContactColumnId =
  | 'uniqueId'
  | 'contact'
  | 'account'
  | 'phone'
  | 'channel'
  | 'email'
  | 'status'
  | 'source'
  | 'deals'
  | 'owner';

const CONTACT_COLUMNS_META: Array<{ id: ContactColumnId; label: string }> = [
  { id: 'uniqueId', label: 'المعرف الفريد (RWQ)' },
  { id: 'contact', label: 'الاسم الكامل وآخر رسالة' },
  { id: 'account', label: 'المنشأة / الشركة' },
  { id: 'phone', label: 'رقم الجوال' },
  { id: 'channel', label: 'القناة' },
  { id: 'email', label: 'البريد الإلكتروني' },
  { id: 'status', label: 'حالة جهة الاتصال' },
  { id: 'source', label: 'المصدر الأساسي' },
  { id: 'deals', label: 'الصفقات المرتبطة' },
  { id: 'owner', label: 'مالك السجل' },
];

const SORT_LABELS: Record<ContactSortKey, string> = {
  recent: 'الأحدث نشاطاً',
  deals_value: 'أعلى قيمة صفقات',
  name: 'الاسم أبجدياً',
  status: 'حالة جهة الاتصال',
};

const AVATAR_TONES = [
  'bg-[#dbe1ff] text-[#00174b]',
  'bg-[#e1e0ff] text-[#07006c]',
  'bg-[#6ffbbe] text-[#002113]',
  'bg-[#ffdad6] text-[#93000a]',
  'bg-[#eaedff] text-[#434655]',
];

const OWNER_TONES = [
  'bg-[#004ac6] text-[#ffffff]',
  'bg-[#4648d4] text-[#ffffff]',
  'bg-[#006242] text-[#ffffff]',
];

function getInitialChar(fullName: string): string {
  const cleaned = fullName.replace(/^(م\.|د\.|أ\.)\s*/u, '').trim();
  return cleaned.charAt(0) || 'ع';
}

function getToneIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % length;
  }
  return Math.abs(hash) % length;
}

function renderChannelPill(channel?: LeadChannel) {
  switch (channel) {
    case 'whatsapp':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#6ffbbe] text-[#002113] whitespace-nowrap">
          <MessageCircle className="h-2.5 w-2.5 text-[#006242]" />
          <span>واتساب</span>
        </span>
      );
    case 'instagram':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#e1e0ff] text-[#07006c] whitespace-nowrap">
          <Camera className="h-2.5 w-2.5 text-[#4648d4]" />
          <span>إنستغرام</span>
        </span>
      );
    case 'messenger':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#eaedff] text-[#004ac6] whitespace-nowrap">
          <MessageSquare className="h-2.5 w-2.5 text-[#004ac6]" />
          <span>ماسنجر</span>
        </span>
      );
    case 'phone':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#e2e7ff] text-[#131b2e] whitespace-nowrap">
          <Phone className="h-2.5 w-2.5 text-[#434655]" />
          <span>هاتفي</span>
        </span>
      );
    case 'referral':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#f2f3ff] text-[#434655] whitespace-nowrap">
          <Users className="h-2.5 w-2.5 text-[#4648d4]" />
          <span>إحالة</span>
        </span>
      );
    case 'website':
    default:
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#dbe1ff] text-[#00174b] whitespace-nowrap">
          <Globe className="h-2.5 w-2.5 text-[#004ac6]" />
          <span>الويب</span>
        </span>
      );
  }
}

function getStatusPillStyle(status: ContactStatus): {
  pill: string;
  dot: string;
} {
  switch (status) {
    case 'عميل نشط':
      return {
        pill: 'bg-[#ECFDF5] text-[#065f46]',
        dot: 'bg-[#10B981]',
      };
    case 'بانتظار عرض سعر':
      return {
        pill: 'bg-[#EFF6FF] text-[#1e40af]',
        dot: 'bg-[#2563EB]',
      };
    case 'عميل متكرر (VIP)':
      return {
        pill: 'bg-[#F3E8FF] text-[#6B21A8]',
        dot: 'bg-[#A855F7]',
      };
    case 'متوقف / غير نشط':
    default:
      return {
        pill: 'bg-[#e2e7ff] text-[#434655]',
        dot: 'bg-[#737686]',
      };
  }
}

function getQuickChatButtonStyle(channel?: LeadChannel): string {
  if (channel === 'instagram') {
    return 'bg-[#e1e0ff] text-[#07006c] hover:bg-[#c0c1ff]';
  }
  if (channel === 'messenger') {
    return 'bg-[#eaedff] text-[#004ac6] hover:bg-[#dbe1ff]';
  }
  return 'bg-[#6ffbbe] text-[#002113] hover:bg-[#4edea3]';
}

export const ContactsTableView: React.FC<ContactsTableViewProps> = ({
  contacts,
  deals,
  selectedIds,
  duplicateReasons,
  searchQuery,
  onChangeSearchQuery,
  sortBy,
  onChangeSortBy,
  activeDockedCount,
  onToggleFilterPanel,
  onExportCsv,
  canUpdateContact,
  canDeleteContact,
  onToggleSelect,
  onToggleSelectAll,
  onChangeStatus,
  onQuickChat,
  onOpenCreateDeal,
  onOpenSplitView,
  onSoftDeleteContact,
  onInspectDuplicate,
}) => {
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeCols, setActiveCols] = useState<ContactColumnId[]>([
    'uniqueId',
    'contact',
    'account',
    'phone',
    'channel',
    'email',
    'status',
    'source',
    'deals',
    'owner',
  ]);

  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setStatusMenuId(null);
        setActionsMenuId(null);
        setSortMenuOpen(false);
        setColumnsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const totalPages = Math.max(1, Math.ceil(contacts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedContacts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return contacts.slice(start, start + pageSize);
  }, [contacts, pageSize, safePage]);

  const allSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.includes(c.id));
  const someSelected =
    !allSelected && contacts.some((c) => selectedIds.includes(c.id));

  const isColVisible = (col: ContactColumnId) => activeCols.includes(col);
  const toggleColumn = (col: ContactColumnId) => {
    setActiveCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleCopyText = (key: string, text?: string) => {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(key);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 1500);
  };

  const startItem = contacts.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, contacts.length);

  return (
    <section
      ref={containerRef}
      className="flex flex-col bg-[#ffffff] rounded-xl shadow-sm border border-[#e2e7ff]/80 overflow-visible mb-8"
    >
      {/* Toolbar Strip (Search, Advanced Filter, Sort, Export, Column Picker) */}
      <div className="px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-[#ffffff] rounded-t-xl border-b border-[#f2f3ff]">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737686]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onChangeSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث سريع بالاسم، الشركة، الجوال، البريد، أو المعرف..."
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#f2f3ff] text-[#131b2e] placeholder:text-[#737686] text-[12px] focus:outline-none focus:bg-[#ffffff] focus:ring-2 focus:ring-[#2563EB] border border-transparent focus:border-[#CBD5E1] transition-all"
            />
          </div>
          <button
            type="button"
            onClick={onToggleFilterPanel}
            className="h-9 px-3 rounded-lg bg-[#e2e7ff] hover:bg-[#dae2fd] text-[#131b2e] text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#004ac6]" />
            <span>تصفية متقدمة</span>
            {activeDockedCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#2563EB] text-[#ffffff] text-[10px] flex items-center justify-center font-bold tabular-nums">
                {activeDockedCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap self-end md:self-auto">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setColumnsPopoverOpen(false);
                setSortMenuOpen((p) => !p);
              }}
              className="h-9 px-2.5 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#131b2e] text-[12px] flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#737686]" />
              <span>الترتيب:</span>
              <span className="font-bold text-[#131b2e]">{SORT_LABELS[sortBy]}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#737686]" />
            </button>

            {sortMenuOpen && (
              <div className="flyout-surface absolute left-0 top-10 z-40 w-44 rounded-xl py-1 text-right">
                {(Object.keys(SORT_LABELS) as ContactSortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChangeSortBy(key);
                      setSortMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-[12px] hover:bg-[#f2f3ff] ${
                      sortBy === key ? 'text-[#004ac6] font-bold bg-[#dbe1ff]/30' : 'text-[#131b2e]'
                    }`}
                  >
                    <span>{SORT_LABELS[key]}</span>
                    {sortBy === key && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 px-2.5 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#131b2e] text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-[#006242]" />
            <span>تصدير CSV</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSortMenuOpen(false);
                setColumnsPopoverOpen((p) => !p);
              }}
              title="تخصيص الأعمدة"
              aria-label="تخصيص أعمدة الجدول"
              className="h-9 w-9 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#434655] hover:text-[#131b2e] flex items-center justify-center transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {columnsPopoverOpen && (
              <div className="flyout-surface absolute left-0 top-10 z-40 w-56 rounded-xl p-2 text-right">
                <p className="px-2 py-1 text-[11px] font-bold text-[#737686] border-b border-[#f2f3ff] mb-1">
                  الأعمدة الظاهرة ({activeCols.length})
                </p>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {CONTACT_COLUMNS_META.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-[#131b2e] hover:bg-[#f2f3ff] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isColVisible(col.id)}
                        disabled={col.id === 'contact'}
                        onChange={() => toggleColumn(col.id)}
                        className="h-3.5 w-3.5 rounded border-[#c3c6d7] text-[#004ac6]"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {contacts.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <p className="text-[14px] font-semibold text-[#131b2e]">
            لا توجد جهات اتصال مطابقة للفلاتر الحالية
          </p>
          <p className="text-[12px] text-[#737686]">
            جرّب مسح شروط البحث أو إعادة تعيين الفلاتر المتقدمة لعرض كافة جهات الاتصال.
          </p>
        </div>
      ) : (
        <>
          {/* Compact 12-Column Analytical Table (Fits 100% inside 1440px viewport without left-edge clipping) */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right border-collapse select-none text-xs">
              <thead>
                <tr className="bg-[#f2f3ff] text-[#434655] text-[11px] font-semibold tracking-tight">
                  <th className="py-2.5 px-1 w-7 text-center" scope="col">
                    <label className="relative inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={onToggleSelectAll}
                        aria-label="تحديد جميع جهات الاتصال"
                        className="peer sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                          allSelected || someSelected
                            ? 'bg-[#004ac6] text-[#ffffff] shadow-2xs'
                            : 'bg-[#ffffff] border border-[#c3c6d7]'
                        }`}
                      >
                        {allSelected ? (
                          <Check className="h-3 w-3 stroke-[3]" />
                        ) : someSelected ? (
                          <Minus className="h-3 w-3 stroke-[3]" />
                        ) : null}
                      </span>
                    </label>
                  </th>

                  {isColVisible('uniqueId') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      المعرف
                    </th>
                  )}
                  {isColVisible('contact') && (
                    <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                      الاسم الكامل وآخر رسالة
                    </th>
                  )}
                  {isColVisible('account') && (
                    <th className="py-2.5 px-1.5 whitespace-nowrap" scope="col">
                      المنشأة / الشركة
                    </th>
                  )}
                  {isColVisible('phone') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      رقم الجوال
                    </th>
                  )}
                  {isColVisible('channel') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      القناة
                    </th>
                  )}
                  {isColVisible('email') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      البريد
                    </th>
                  )}
                  {isColVisible('status') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      حالة جهة الاتصال
                    </th>
                  )}
                  {isColVisible('source') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      المصدر الأساسي
                    </th>
                  )}
                  {isColVisible('deals') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      الصفقات المرتبطة
                    </th>
                  )}
                  {isColVisible('owner') && (
                    <th className="py-2.5 px-1 whitespace-nowrap" scope="col">
                      مالك السجل
                    </th>
                  )}

                  <th className="py-2.5 px-1.5 text-center whitespace-nowrap" scope="col">
                    إجراءات
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f2f3ff] text-xs text-[#131b2e] bg-[#ffffff]">
                {paginatedContacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  const dupReason = duplicateReasons.get(contact.id);
                  const status = resolveContactStatus(contact.contactStatus);
                  const statusStyle = getStatusPillStyle(status);
                  const ownerName = getContactOwnerName(contact);
                  const contactDeals = getDealsForContact(contact, deals);
                  const dealsSum = contactDeals.reduce((s, d) => s + d.amount, 0);
                  const isB2C =
                    !contact.accountId ||
                    contact.accountId === 'unassigned' ||
                    contact.accountName === 'عميل فردي B2C';
                  const uniqueCode = contact.leadUniqueId || contact.id.slice(0, 9);
                  const avatarTone =
                    AVATAR_TONES[getToneIndex(contact.id || contact.fullName, AVATAR_TONES.length)];
                  const ownerTone =
                    OWNER_TONES[getToneIndex(ownerName, OWNER_TONES.length)];

                  return (
                    <tr
                      key={contact.id}
                      className={`transition-colors relative group ${
                        isSelected
                          ? 'bg-[#dbe1ff]/25 hover:bg-[#dbe1ff]/35'
                          : 'hover:bg-[#f2f3ff]/70'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-1 text-center relative">
                        {isSelected && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#004ac6]" />
                        )}
                        <label className="relative inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(contact.id)}
                            aria-label={`تحديد ${contact.fullName}`}
                            className="peer sr-only"
                          />
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-[#004ac6] text-[#ffffff]'
                                : 'bg-[#ffffff] border border-[#c3c6d7] hover:border-[#004ac6]'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                        </label>
                      </td>

                      {/* المعرف الفريد */}
                      {isColVisible('uniqueId') && (
                        <td className="py-2.5 px-1 whitespace-nowrap">
                          <div className="flex items-center gap-0.5 group/copy">
                            <span className="font-mono text-[10px] font-semibold px-1 py-0.5 rounded bg-[#eaedff] text-[#434655] tabular-nums">
                              {uniqueCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(`id_${contact.id}`, uniqueCode)}
                              title="نسخ المعرف"
                              className="opacity-0 group-hover/copy:opacity-100 text-[#737686] hover:text-[#004ac6] transition-opacity"
                            >
                              {copiedId === `id_${contact.id}` ? (
                                <Check className="h-3 w-3 text-[#006242]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}

                      {/* الاسم الكامل وآخر رسالة */}
                      {isColVisible('contact') && (
                        <td className="py-2.5 px-1 min-w-[116px] max-w-[128px]">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${avatarTone}`}
                            >
                              {getInitialChar(contact.fullName)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                <Link
                                  to={`/contacts/${contact.id}`}
                                  className="text-[11px] font-semibold text-[#131b2e] hover:text-[#004ac6] truncate leading-snug"
                                >
                                  {contact.fullName}
                                </Link>
                                {status === 'عميل متكرر (VIP)' && (
                                  <span className="px-1 py-0.2 rounded text-[9px] bg-[#e1e0ff] text-[#07006c] font-bold shrink-0">
                                    VIP
                                  </span>
                                )}
                                {dupReason && (
                                  <button
                                    type="button"
                                    onClick={() => onInspectDuplicate(contact.id)}
                                    title={dupReason}
                                    className="text-[#ba1a1a] shrink-0"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-[#737686] truncate">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    status === 'متوقف / غير نشط' ? 'bg-[#c3c6d7]' : 'bg-[#006242]'
                                  }`}
                                />
                                <span className="truncate">
                                  {contact.lastActivityLabel || 'اليوم'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* المنشأة / الشركة */}
                      {isColVisible('account') && (
                        <td className="py-2.5 px-1 max-w-[96px]">
                          {isB2C ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] text-[#434655] bg-[#f2f3ff] font-medium whitespace-nowrap">
                              عميل فردي B2C
                            </span>
                          ) : (
                            <Link
                              to="/accounts"
                              title={contact.accountName}
                              className="text-[11px] font-semibold text-[#004ac6] hover:underline flex items-center gap-0.5 truncate max-w-[92px]"
                            >
                              <span className="truncate">{contact.accountName}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </Link>
                          )}
                        </td>
                      )}

                      {/* رقم الجوال */}
                      {isColVisible('phone') && (
                        <td className="py-2.5 px-1 whitespace-nowrap">
                          <span
                            className="font-mono text-[10.5px] tracking-tight text-[#131b2e] tabular-nums"
                            dir="ltr"
                          >
                            {contact.phone || '—'}
                          </span>
                        </td>
                      )}

                      {/* القناة */}
                      {isColVisible('channel') && (
                        <td className="py-2.5 px-1 whitespace-nowrap">
                          {renderChannelPill(contact.channel)}
                        </td>
                      )}

                      {/* البريد */}
                      {isColVisible('email') && (
                        <td className="py-2.5 px-1 max-w-[82px]">
                          <div className="flex items-center gap-0.5 group/email text-[#434655] font-mono text-[10px] min-w-0">
                            <span
                              className="truncate max-w-[64px]"
                              dir="ltr"
                              title={contact.email}
                            >
                              {contact.email || '—'}
                            </span>
                            {contact.email && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(`email_${contact.id}`, contact.email)}
                                title="نسخ البريد"
                                className="opacity-0 group-hover/email:opacity-100 text-[#737686] hover:text-[#004ac6] shrink-0"
                              >
                                {copiedId === `email_${contact.id}` ? (
                                  <Check className="h-3 w-3 text-[#006242]" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* حالة جهة الاتصال (Inline Dropdown) */}
                      {isColVisible('status') && (
                        <td className="py-2.5 px-1 whitespace-nowrap relative">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              disabled={!canUpdateContact}
                              onClick={() => {
                                setActionsMenuId(null);
                                setStatusMenuId((prev) =>
                                  prev === contact.id ? null : contact.id
                                );
                              }}
                              aria-label={`تغيير حالة ${contact.fullName}`}
                              aria-expanded={statusMenuId === contact.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 ${statusStyle.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              <span>{status}</span>
                              {canUpdateContact && <ChevronDown className="h-2.5 w-2.5 opacity-80" />}
                            </button>

                            {statusMenuId === contact.id && (
                              <div className="flyout-surface absolute right-0 top-full mt-1 w-44 rounded-xl p-1.5 z-40 text-right">
                                <div className="px-2 py-1 text-[10px] font-bold text-[#737686] border-b border-[#f2f3ff] mb-1 flex items-center justify-between">
                                  <span>تحديث الحالة</span>
                                  <Zap className="h-3 w-3 text-[#006242]" />
                                </div>
                                {CONTACT_STATUSES.map((st) => {
                                  const stStyle = getStatusPillStyle(st);
                                  const active = status === st;
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => {
                                        setStatusMenuId(null);
                                        onChangeStatus(contact.id, st);
                                      }}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                                        active
                                          ? 'bg-[#dbe1ff]/40 text-[#004ac6] font-bold'
                                          : 'text-[#131b2e] hover:bg-[#f2f3ff]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${stStyle.dot}`} />
                                        <span>{st}</span>
                                      </div>
                                      {active && <Check className="h-3 w-3 text-[#004ac6]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* المصدر الأساسي (First-Touch) */}
                      {isColVisible('source') && (
                        <td className="py-2.5 px-1 max-w-[78px]">
                          <span
                            title={contact.primarySource || 'تحويل مباشر'}
                            className="text-[#434655] text-[10px] px-1 py-0.5 rounded bg-[#f2f3ff] truncate block max-w-[74px]"
                          >
                            {contact.primarySource || 'تحويل مباشر'}
                          </span>
                        </td>
                      )}

                      {/* الصفقات المرتبطة */}
                      {isColVisible('deals') && (
                        <td className="py-2.5 px-1 whitespace-nowrap">
                          {contactDeals.length > 0 ? (
                            <span
                              title={`إجمالي ${dealsSum.toLocaleString('en-US')} ر.س`}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#dbe1ff] text-[#003ea8] tabular-nums inline-block"
                            >
                              {contactDeals.length} {contactDeals.length === 1 ? 'صفقة' : 'صفقات'} •{' '}
                              {formatCompactDealValue(dealsSum)}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-[#737686] bg-[#f2f3ff]">
                              لا صفقات
                            </span>
                          )}
                        </td>
                      )}

                      {/* مالك السجل */}
                      {isColVisible('owner') && (
                        <td className="py-2.5 px-1 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${ownerTone}`}
                            >
                              {getInitialChar(ownerName)}
                            </div>
                            <span className="text-[10.5px] font-medium text-[#131b2e] max-w-[46px] truncate">
                              {ownerName}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* إجراءات: محادثة + "+ صفقة" + ⋮ */}
                      <td className="py-2.5 px-1 text-center whitespace-nowrap relative">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onQuickChat(contact.id)}
                            title="محادثة سريعة في صندوق الوارد"
                            className={`px-1.5 py-1 rounded-md text-[10px] font-semibold inline-flex items-center gap-0.5 transition-colors whitespace-nowrap ${getQuickChatButtonStyle(
                              contact.channel
                            )}`}
                          >
                            <MessageCircle className="h-3 w-3" />
                            <span>محادثة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenCreateDeal(contact)}
                            title="إنشاء صفقة جديدة مرتبطة بجهة الاتصال"
                            className="px-1.5 py-1 rounded-md bg-[#e2e7ff] text-[#131b2e] hover:bg-[#2563EB] hover:text-[#ffffff] text-[10px] font-semibold inline-flex items-center gap-0.5 transition-colors whitespace-nowrap"
                          >
                            <Plus className="h-3 w-3" />
                            <span>صفقة</span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setStatusMenuId(null);
                                setActionsMenuId((prev) =>
                                  prev === contact.id ? null : contact.id
                                );
                              }}
                              aria-label={`المزيد من الخيارات لـ ${contact.fullName}`}
                              className="p-0.5 rounded text-[#737686] hover:bg-[#eaedff] hover:text-[#131b2e]"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {actionsMenuId === contact.id && (
                              <div className="flyout-surface absolute left-0 top-full mt-1 w-48 rounded-xl p-1.5 z-40 text-right">
                                <Link
                                  to={`/contacts/${contact.id}`}
                                  onClick={() => setActionsMenuId(null)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#131b2e] hover:bg-[#eaedff]"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 text-[#004ac6]" />
                                  <span>عرض الملف الكامل</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsMenuId(null);
                                    onOpenSplitView(contact.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#131b2e] hover:bg-[#eaedff]"
                                >
                                  <Columns3 className="h-3.5 w-3.5 text-[#434655]" />
                                  <span>فتح العرض المقسم</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsMenuId(null);
                                    onOpenCreateDeal(contact);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#006242] hover:bg-[#6ffbbe]/40"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>إنشاء صفقة جديدة</span>
                                </button>

                                {dupReason && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      onInspectDuplicate(contact.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#D97706] hover:bg-[#FEF3C7]/60"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>فحص ودمج التكرار</span>
                                  </button>
                                )}

                                {canDeleteContact && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      onSoftDeleteContact(contact.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[#ba1a1a] hover:bg-[#ffdad6]/50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>نقل لسلة المحذوفات</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RTL Pagination Footer */}
          <div className="px-4 py-3 bg-[#f2f3ff]/60 border-t border-[#f2f3ff] rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[#737686] text-[12px] font-medium">
              <span>
                عرض{' '}
                <strong className="text-[#131b2e] tabular-nums">
                  {startItem} - {endItem}
                </strong>{' '}
                من أصل{' '}
                <strong className="text-[#131b2e] tabular-nums">
                  {contacts.length} جهة اتصال
                </strong>
              </span>
              <span className="w-1 h-1 rounded-full bg-[#c3c6d7]" />
              <div className="flex items-center gap-1.5">
                <span>عرض:</span>
                <select
                  aria-label="عدد السجلات في الصفحة"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#ffffff] text-[#131b2e] rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums border border-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                >
                  <option value={10}>10 سجلات في الصفحة</option>
                  <option value={25}>25 سجلاً في الصفحة</option>
                  <option value={50}>50 سجلاً في الصفحة</option>
                </select>
              </div>
            </div>

            <nav aria-label="تنقل صفحات جهات الاتصال" className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-[#ffffff] hover:bg-[#e2e7ff] text-[#131b2e] text-[11px] font-medium flex items-center gap-0.5 border border-[#E2E8F0] disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>السابق</span>
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const isCurrent = pageNum === safePage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`w-7 h-7 rounded text-[11px] font-bold tabular-nums transition-colors ${
                      isCurrent
                        ? 'bg-[#2563EB] text-[#ffffff] shadow-xs'
                        : 'bg-[#ffffff] hover:bg-[#e2e7ff] text-[#131b2e] border border-[#E2E8F0]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-[#ffffff] hover:bg-[#e2e7ff] text-[#131b2e] text-[11px] font-medium flex items-center gap-0.5 border border-[#E2E8F0] disabled:opacity-40"
              >
                <span>التالي</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </nav>
          </div>
        </>
      )}
    </section>
  );
};
