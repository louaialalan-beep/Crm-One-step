import React, { useMemo, useState } from 'react';
import {
  Camera,
  FilterX,
  Mail,
  MessageCircle,
  MessagesSquare,
  Send,
  X,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import type { InboxMessage } from '../../types/crm';

interface InboxDrawerProps {
  open: boolean;
  onClose: () => void;
}

type ChannelFilter = 'all' | 'whatsapp' | 'instagram' | 'messenger' | 'email' | 'chat';

export const InboxDrawer: React.FC<InboxDrawerProps> = ({ open, onClose }) => {
  const {
    messages,
    leads,
    contacts,
    inboxFilterLeadId,
    inboxFilterContactId,
    clearInboxLeadFilter,
    clearInboxContactFilter,
    markMessageRead,
    sendInboxReply,
  } = useCrm();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [selectedId, setSelectedId] = useState<string>(messages[0]?.id ?? '');
  const [replyText, setReplyText] = useState('');

  const focusedLead = useMemo(
    () => (inboxFilterLeadId ? leads.find((l) => l.id === inboxFilterLeadId) ?? null : null),
    [inboxFilterLeadId, leads]
  );

  const focusedContact = useMemo(
    () =>
      inboxFilterContactId
        ? contacts.find((c) => c.id === inboxFilterContactId) ?? null
        : null,
    [contacts, inboxFilterContactId]
  );

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (focusedLead) {
        const matchesLead =
          m.leadId === focusedLead.id ||
          (Boolean(m.leadUniqueId) && m.leadUniqueId === focusedLead.unique_id) ||
          m.senderName === focusedLead.fullName;
        if (!matchesLead) return false;
      }
      if (focusedContact) {
        const matchesContact =
          (Boolean(focusedContact.leadUniqueId) &&
            m.leadUniqueId === focusedContact.leadUniqueId) ||
          m.senderName === focusedContact.fullName ||
          (m.direction === 'outbound' && m.subject?.includes(focusedContact.fullName));
        if (!matchesContact) return false;
      }
      if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
      return true;
    });
  }, [channelFilter, focusedContact, focusedLead, messages]);

  const activeMessage =
    filteredMessages.find((m) => m.id === selectedId) ?? filteredMessages[0] ?? null;

  if (!open) return null;

  const channelLabel = (ch: InboxMessage['channel']) => {
    if (ch === 'whatsapp') return 'واتساب الأعمال';
    if (ch === 'instagram') return 'إنستغرام';
    if (ch === 'messenger') return 'فيسبوك ماسنجر';
    if (ch === 'email') return 'البريد الإلكتروني';
    return 'المحادثة المباشرة';
  };

  const renderChannelIcon = (ch: InboxMessage['channel']) => {
    if (ch === 'whatsapp') return <MessageCircle className="h-4 w-4 shrink-0 text-[#10B981]" />;
    if (ch === 'instagram') return <Camera className="h-4 w-4 shrink-0 text-[#F43F5E]" />;
    if (ch === 'email') return <Mail className="h-4 w-4 shrink-0 text-[#2563EB]" />;
    return <MessagesSquare className="h-4 w-4 shrink-0 text-[#6366F1]" />;
  };

  const focusedChannel = focusedLead?.channel ?? focusedContact?.channel;
  const fallbackChannel: InboxMessage['channel'] =
    focusedChannel === 'whatsapp' ||
    focusedChannel === 'instagram' ||
    focusedChannel === 'messenger'
      ? focusedChannel
      : 'whatsapp';

  const replyTargetChannel: InboxMessage['channel'] =
    activeMessage?.channel ?? fallbackChannel;
  const replyTargetName =
    activeMessage?.senderName ?? focusedLead?.fullName ?? focusedContact?.fullName ?? '';
  const replyTargetCompany =
    activeMessage?.companyName ??
    (focusedLead?.company ||
      focusedLead?.city ||
      focusedLead?.source ||
      focusedContact?.accountName ||
      focusedContact?.city);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !replyTargetName) return;
    await sendInboxReply(replyTargetChannel, replyTargetName, replyText, {
      leadId: activeMessage?.leadId ?? focusedLead?.id,
      contactId: focusedContact?.id,
      leadUniqueId:
        activeMessage?.leadUniqueId ?? focusedLead?.unique_id ?? focusedContact?.leadUniqueId,
      companyName: replyTargetCompany,
    });
    setReplyText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start"
      role="dialog"
      aria-modal="true"
      aria-label="صندوق الوارد الموحد"
    >
      <div className="fixed inset-0 bg-[#0F172A]/40" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">صندوق الوارد الموحد</h2>
            <p className="text-[12px] text-[#64748B]">
              محادثات واتساب الأعمال، إنستغرام، ماسنجر، والبريد الإلكتروني في مكان واحد.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق صندوق الوارد"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lead / Contact Filter Banner */}
        {(focusedLead || focusedContact) && (
          <div className="flex items-center justify-between gap-2 border-b border-[#BFDBFE] bg-[#EFF6FF] px-5 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#1E40AF] truncate">
                {focusedContact ? 'محادثات جهة الاتصال: ' : 'محادثات العميل: '}
                {focusedLead?.fullName ?? focusedContact?.fullName}{' '}
                {(focusedLead?.unique_id || focusedContact?.leadUniqueId) && (
                  <span className="tabular-nums text-[#2563EB]">
                    ({focusedLead?.unique_id ?? focusedContact?.leadUniqueId})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-[#475569] truncate">
                {focusedContact
                  ? `${focusedContact.accountName} ${focusedContact.phone ? `· ${focusedContact.phone}` : ''}`
                  : `${focusedLead?.city || focusedLead?.source || 'عميل محتمل'} ${focusedLead?.phone ? `· ${focusedLead.phone}` : ''}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearInboxLeadFilter();
                clearInboxContactFilter();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>عرض جميع المحادثات</span>
            </button>
          </div>
        )}

        {/* Channel Filter Segmented Bar */}
        <div className="flex items-center gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-2.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'whatsapp', label: 'واتساب' },
              { id: 'instagram', label: 'إنستغرام' },
              { id: 'messenger', label: 'ماسنجر' },
              { id: 'email', label: 'البريد' },
              { id: 'chat', label: 'المحادثة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setChannelFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                channelFilter === tab.id
                  ? 'bg-[#FFFFFF] text-[#2563EB] border border-[#E2E8F0] font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-[13px] font-medium text-[#0F172A]">
                {focusedLead || focusedContact
                  ? `لا توجد رسائل سابقة مسجلة لـ ${focusedLead?.fullName ?? focusedContact?.fullName}.`
                  : 'لا توجد رسائل في هذه القناة حالياً.'}
              </p>
              {(focusedLead || focusedContact) && (
                <p className="text-[12px] text-[#64748B]">
                  يمكنك إرسال رسالة افتتاحية مباشرة من شريط الرد أدناه وسيتم ربطها بالسجل (
                  <span className="tabular-nums">
                    {focusedLead?.unique_id ?? focusedContact?.leadUniqueId ?? focusedContact?.id}
                  </span>
                  ).
                </p>
              )}
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = activeMessage?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(msg.id);
                    if (msg.unread) {
                      void markMessageRead(msg.id);
                    }
                  }}
                  className={`w-full px-5 py-3.5 text-right transition-colors ${
                    isSelected
                      ? 'bg-[#EFF6FF]/60 border-r-2 border-r-[#2563EB]'
                      : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderChannelIcon(msg.channel)}
                      <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                        {msg.senderName}
                      </span>
                      {msg.leadUniqueId && (
                        <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569] tabular-nums shrink-0">
                          {msg.leadUniqueId}
                        </span>
                      )}
                      {msg.unread && (
                        <span className="rounded bg-[#EFF6FF] border border-[#BFDBFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                          جديد
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0 tabular-nums">
                      {msg.timestampLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] font-medium text-[#475569] truncate">
                    {channelLabel(msg.channel)} · {msg.companyName || 'جهة خارجية'}
                  </p>
                  <p className="mt-1 text-[13px] text-[#0F172A] line-clamp-2">{msg.body}</p>
                </button>
              );
            })
          )}
        </div>

        {/* Reply Composer */}
        {(activeMessage || focusedLead || focusedContact) && (
          <form
            onSubmit={handleSend}
            className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between text-[12px] text-[#64748B]">
              <span>
                الرد عبر {channelLabel(replyTargetChannel)} إلى{' '}
                <strong className="text-[#0F172A]">{replyTargetName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                className="input-control flex-1 px-3 py-2 text-[13px]"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563EB] px-3.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>إرسال</span>
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};
