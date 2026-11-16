import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Compass,
  FileSpreadsheet,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SIDEBAR_MODULES } from '../../config/navigation';
import { useCrm } from '../../context/CrmContext';
import { formatCurrencySAR } from '../../utils/formatters';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenQuickDeal: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  path: string;
  icon: 'nav' | 'lead' | 'deal' | 'account' | 'contact' | 'quote';
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onOpenQuickDeal,
}) => {
  const navigate = useNavigate();
  const { leads, deals, accounts, contacts, quotes } = useCrm();
  const [queryText, setQueryText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQueryText('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    for (const mod of SIDEBAR_MODULES) {
      items.push({
        id: `nav_${mod.id}`,
        title: mod.label,
        subtitle: `الانتقال إلى وحدة ${mod.label}`,
        category: 'التنقل السريع',
        path: mod.path,
        icon: 'nav',
      });
      if (mod.subItems) {
        for (const sub of mod.subItems) {
          items.push({
            id: `nav_${sub.id}`,
            title: sub.label,
            subtitle: `${mod.label} · ${sub.label}`,
            category: 'التنقل السريع',
            path: sub.path,
            icon: 'nav',
          });
        }
      }
    }

    for (const lead of leads) {
      items.push({
        id: `lead_${lead.id}`,
        title: `${lead.fullName} (${lead.unique_id})`,
        subtitle: `${lead.city || lead.source || 'عميل محتمل'} · ${lead.phone || lead.status}`,
        category: 'العملاء المحتملين',
        path: `/leads/${lead.id}`,
        icon: 'lead',
      });
    }

    for (const deal of deals) {
      items.push({
        id: `deal_${deal.id}`,
        title: deal.title,
        subtitle: `${deal.accountName} · ${formatCurrencySAR(deal.amount, deal.currency)} · ${deal.stage}`,
        category: 'الصفقات',
        path: '/deals',
        icon: 'deal',
      });
    }

    for (const account of accounts) {
      items.push({
        id: `acc_${account.id}`,
        title: account.name,
        subtitle: `${account.industry} · ${account.city || 'المملكة'}`,
        category: 'الشركات والحسابات',
        path: '/accounts',
        icon: 'account',
      });
    }

    for (const contact of contacts) {
      items.push({
        id: `con_${contact.id}`,
        title: contact.fullName,
        subtitle: `${contact.jobTitle || 'جهة اتصال'} · ${contact.accountName}`,
        category: 'جهات الاتصال',
        path: '/contacts',
        icon: 'contact',
      });
    }

    for (const qt of quotes) {
      items.push({
        id: `qt_${qt.id}`,
        title: `${qt.quoteNumber} — ${qt.subject}`,
        subtitle: `${qt.accountName} · ${formatCurrencySAR(qt.totalAmount)}`,
        category: 'عروض الأسعار',
        path: '/quotes',
        icon: 'quote',
      });
    }

    return items;
  }, [accounts, contacts, deals, leads, quotes]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return allItems.slice(0, 12);
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [allItems, queryText]);

  if (!open) return null;

  const renderIcon = (icon: PaletteItem['icon']) => {
    switch (icon) {
      case 'lead':
        return <UserPlus className="h-4 w-4 text-[#6366F1]" />;
      case 'deal':
        return <Briefcase className="h-4 w-4 text-[#2563EB]" />;
      case 'account':
        return <Building2 className="h-4 w-4 text-[#0F172A]" />;
      case 'contact':
        return <Users className="h-4 w-4 text-[#10B981]" />;
      case 'quote':
        return <FileSpreadsheet className="h-4 w-4 text-[#F59E0B]" />;
      default:
        return <Compass className="h-4 w-4 text-[#64748B]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0F172A]/45 p-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="لوحة الأوامر والبحث الشامل"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="ابحث بالاسم، معرف RWQ، اسم الشركة، أو انتقل إلى وحدة..."
            className="w-full bg-transparent text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الأوامر"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[#F1F5F9]">
          <div className="flex items-center justify-between bg-[#F8FAFC] px-4 py-2">
            <span className="text-[11px] font-semibold text-[#64748B]">
              {queryText.trim() ? `نتائج البحث (${filtered.length})` : 'إجراءات سريعة وسجلات حديثة'}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQuickDeal();
              }}
              className="text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
            >
              + إنشاء صفقة سريعة
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[#64748B]">
              لا توجد نتائج مطابقة لعبارة "{queryText}". جرب البحث برقم RWQ أو اسم شركة.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF]">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                      {item.title}
                    </p>
                    <p className="text-[12px] text-[#64748B] truncate tabular-nums">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-[#64748B] whitespace-nowrap shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
