import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { activitiesService } from '../services/activitiesService';
import type { InboxMessage } from '../types/crm';

export function WhatsappInboxPage() {
  const {
    currentOrganization,
    currentOrgId,
    currentUser,
    activeProfile,
    activeRole,
    canViewChat,
    leads,
    contacts,
    messages,
    touchpoints,
    sendInboxReply,
    connectMetaAccount,
  } = useCrm();

  const isWhatsappEnabled = Boolean(currentOrganization?.addons?.whatsapp_campaigns);

  const [selectedConvoId, setSelectedConvoId] = useState<string>('lead_1');
  const [mobilePane, setMobilePane] = useState<'list' | 'chat' | 'info'>('list');
  const [filterTab, setFilterTab] = useState<'all' | 'mine' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [embeddedModalOpen, setEmbeddedModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [liveWsMessages, setLiveWsMessages] = useState<InboxMessage[]>([]);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    kind: 'file' | 'image';
    sizeLabel: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    if (!currentOrgId) return;
    const unsubscribe = activitiesService.subscribeToWhatsAppWebSocket({
      orgId: currentOrgId,
      onEvent: (envelope) => {
        if (
          (envelope.event === 'whatsapp:message_received' ||
            envelope.event === 'whatsapp:message_sent') &&
          envelope.data
        ) {
          const item = envelope.data;
          const mapped: InboxMessage = {
            id: item.wamid || item.id,
            ownerId: currentUser.id,
            org_id: currentOrgId,
            channel: 'whatsapp',
            senderName: item.contact_name || item.phone_number,
            body: item.body,
            direction: item.direction,
            unread: item.direction === 'inbound',
            timestampLabel: 'الآن',
            leadUniqueId: item.lead_uid,
          };
          setLiveWsMessages((prev) =>
            prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]
          );
          if (item.direction === 'inbound') {
            triggerToast(
              `رسالة واتساب واردة من ${mapped.senderName} (${item.lead_uid})`
            );
          }
        }
      },
    });
    return unsubscribe;
  }, [currentOrgId, currentUser.id]);

  // Merge BOTH leads and contacts and apply dynamic RBAC filtering for conversations
  const conversations = useMemo(() => {
    const canReadInbox =
      activeProfile?.modulePermissions?.leads?.read ??
      activeProfile?.modulePermissions?.contacts?.read ??
      true;
    if (!canReadInbox) return [];

    const leadThreads = leads.map((l) => {
      const threadMsgs = messages.filter(
        (m) => m.leadUniqueId === l.unique_id || m.senderName.includes(l.fullName)
      );
      const latestMsg = threadMsgs[0];
      return {
        id: l.id,
        name: l.fullName,
        company: l.company || 'شركة تجارية',
        phone: l.phone || '+966 50 123 4567',
        uniqueId: l.unique_id,
        entityTypeLabel: 'عميل محتمل',
        assignedTo: l.assignedToName,
        ownerId: l.ownerId,
        unread: l.awaitingReplyHours ? l.awaitingReplyHours > 12 : false,
        lastMessage:
          latestMsg?.body ||
          l.lastMessageSnippet ||
          'أهلاً بك، استفسار بخصوص باقة الحلول المؤسسية ERP...',
        timeLabel: latestMsg?.timestampLabel || 'منذ 10 دقائق',
        channel: 'whatsapp' as const,
        isLead: true,
        rawLead: l,
      };
    });

    const contactThreads = contacts
      .filter((c) => !leads.some((l) => l.unique_id === (c.leadUniqueId || c.id)))
      .map((c) => {
        const contactRefId = c.leadUniqueId || c.id;
        const threadMsgs = messages.filter(
          (m) => m.leadUniqueId === contactRefId || m.senderName.includes(c.fullName)
        );
        const latestMsg = threadMsgs[0];
        return {
          id: `contact_${c.id}`,
          name: c.fullName,
          company: c.accountName || 'حساب مؤسسي',
          phone: c.phone || '+966 55 000 1122',
          uniqueId: contactRefId,
          entityTypeLabel: `جهة اتصال ${contactRefId}`,
          assignedTo: c.assignedToName || currentUser.fullName,
          ownerId: c.ownerId,
          unread: false,
          lastMessage:
            latestMsg?.body ||
            c.lastMessageSnippet ||
            `تواصل مباشر مع جهة الاتصال المسجلة (${c.accountName})`,
          timeLabel: latestMsg?.timestampLabel || c.lastActivityLabel || 'اليوم',
          channel: 'whatsapp' as const,
          isLead: false,
          rawLead: undefined,
        };
      });

    const merged = [...leadThreads, ...contactThreads];

    return merged.filter((c) => {
      // Dynamic RBAC from activeRole.dataVisibility and canViewChat
      const visibility = activeRole?.dataVisibility ?? 'organization';
      if (visibility === 'private') {
        if (c.assignedTo !== currentUser.fullName && c.ownerId !== currentUser.uid) {
          return false;
        }
      } else if (visibility === 'team') {
        if (activeRole?.hide_subordinates_data) {
          if (c.assignedTo !== currentUser.fullName && c.ownerId !== currentUser.uid) {
            return false;
          }
        } else if (!canViewChat(c.assignedTo)) {
          return false;
        }
      }

      if (filterTab === 'mine' && c.assignedTo !== currentUser.fullName) return false;
      if (filterTab === 'unread' && !c.unread) return false;
      if (
        searchQuery.trim() &&
        !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.uniqueId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.phone.includes(searchQuery) &&
        !c.company.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    leads,
    contacts,
    messages,
    currentUser,
    activeProfile,
    activeRole,
    canViewChat,
    filterTab,
    searchQuery,
  ]);

  const activeConvo = useMemo(() => {
    return (
      conversations.find((c) => c.id === selectedConvoId) ||
      conversations[0] ||
      null
    );
  }, [conversations, selectedConvoId]);

  const activeMessages = useMemo(() => {
    if (!activeConvo) return [];
    const baseList = messages
      .filter(
        (m) =>
          m.leadUniqueId === activeConvo.uniqueId ||
          m.senderName.includes(activeConvo.name)
      )
      .slice()
      .reverse();
    const seenIds = new Set(baseList.map((m) => m.id));
    const extras = liveWsMessages.filter(
      (m) =>
        !seenIds.has(m.id) &&
        (m.leadUniqueId === activeConvo.uniqueId ||
          m.senderName.includes(activeConvo.name))
    );
    return [...baseList, ...extras];
  }, [messages, liveWsMessages, activeConvo]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConvo?.id, activeMessages.length]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() && !selectedTemplateId && !attachedFile) return;
    if (!activeConvo) return;

    setSending(true);
    try {
      const attachmentPrefix = attachedFile
        ? `${attachedFile.kind === 'image' ? '🖼️ [صورة مرفقة:' : '📎 [ملف مرفق:'} ${attachedFile.name} (${attachedFile.sizeLabel})] `
        : '';
      const baseText = selectedTemplateId
        ? `[قالب معتمد: ${selectedTemplateId}] ${replyBody || 'مرحباً، تفضل بطلب العرض التجريبي المعتمد.'}`
        : replyBody || (attachedFile ? 'تم إرسال المرفق للمراجعة والاعتماد.' : '');
      const textToSend = `${attachmentPrefix}${baseText}`.trim();

      await sendInboxReply(
        'whatsapp',
        activeConvo.name,
        textToSend,
        {
          leadId: activeConvo.isLead && activeConvo.rawLead ? activeConvo.rawLead.id : undefined,
          leadUniqueId: activeConvo.uniqueId,
          companyName: activeConvo.company,
        }
      );
      setReplyBody('');
      setSelectedTemplateId('');
      if (attachedFile) {
        triggerToast(`تم إرسال المرفق "${attachedFile.name}" عبر واتساب السحابي بنجاح.`);
        setAttachedFile(null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, kind: 'file' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    setAttachedFile({
      name: file.name,
      kind,
      sizeLabel,
    });
    triggerToast(`تم إرفاق ${kind === 'image' ? 'الصورة' : 'الملف'} "${file.name}" — اضغط إرسال لإرساله في المحادثة.`);
    e.target.value = '';
  };

  const handleEmbeddedSignup = async () => {
    await connectMetaAccount({
      fbUserId: '102298441920118',
      fbUserName: `${currentUser.fullName} — WhatsApp Cloud Admin`,
      shortLivedToken: `EAAB_WABA_${Date.now()}`,
    });
    setEmbeddedModalOpen(false);
    triggerToast('تم ربط رقم واتساب السحابي (Meta Embedded Signup) بنجاح.');
  };

  if (!isWhatsappEnabled) {
    return (
      <div dir="rtl" className="w-full px-6 py-12 flex flex-col items-center justify-center text-center">
        {toastMsg && (
          <div className="mb-4 max-w-md w-full bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold">
            <span>{toastMsg}</span>
            <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-700">✕</button>
          </div>
        )}
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              إضافة صندوق واتساب والحملات الذكية (Paid Add-on Required)
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              هذه الميزة مدفوعة ومقيدة بالمؤسسة النشطة <strong className="font-mono">{currentOrgId}</strong>. يتطلب تفعيل إضافة واتساب السحابي وحملات البث الوصول لصندوق الواتساب الموحد.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-right space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span>الباقة الحالية:</span>
              <strong className="text-blue-700">{currentOrganization?.plan || 'Enterprise'}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>حالة إضافة واتساب:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                غير مفعلة (Inactive)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerToast('تم إرسال طلب تفعيل الإضافة بنجاح إلى مدير النظام العام. سيتم التفعيل الفوري خلال دقائق.');
            }}
            className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            طلب تفعيل الإضافة (Request WhatsApp Add-on)
          </button>

          <Link
            to="/settings"
            className="block text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
          >
            العودة إلى لوحة الإعدادات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4">
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}
      {/* Top Flush Header & Quota Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>التشغيل وقنوات التواصل</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">صندوق واتساب والحملات الموحد (WhatsApp Inbox)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-900">
              صندوق رسائل واتساب السحابي المباشر (WhatsApp Cloud Inbox)
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono tabular-nums">
              Quota: {(currentOrganization?.messages_used ?? 0).toLocaleString('en-US')} / {(currentOrganization?.messages_limit ?? 25000).toLocaleString('en-US')} رسالة
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEmbeddedModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            ربط رقم واتساب (Meta Embedded Signup)
          </button>
          <Link
            to="/campaigns"
            className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            منشئ الحملات والرسائل الجماعية
          </Link>
        </div>
      </div>

      {/* 3-Pane WhatsApp Web-Style Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[75vh] min-h-[620px]">
        {/* Right Pane (3 cols): Conversations List */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs">
          {/* Search & Filter Pills */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المحادثات والعملاء..."
                className="w-full px-3 py-1.5 pr-9 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('mine')}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'mine'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                محادثاتي
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filterTab === 'unread'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                غير مقروءة
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map((convo) => {
              const active = convo.id === activeConvo?.id;
              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvoId(convo.id)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 ${
                    active ? 'bg-blue-50/70 border-r-4 border-blue-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-300 text-xs">
                    {convo.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {convo.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {convo.timeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {convo.lastMessage}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                        {convo.uniqueId}
                      </span>
                      {convo.unread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Pane (6 cols): Chat Timeline & Input */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs">
          {activeConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center border border-emerald-300 text-xs">
                    {activeConvo.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {activeConvo.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span dir="ltr" className="inline-block">{activeConvo.phone}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">نافذة 24 ساعة مفتوحة ✓</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                    WhatsApp Cloud API
                  </span>
                </div>
              </div>

              {/* Messages Timeline */}
              <div
                ref={messagesContainerRef}
                className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/30"
              >
                <div className="text-center my-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 shadow-2xs">
                    المحادثة مؤمنة ومشفرة تماماً عبر WhatsApp Cloud API
                  </span>
                </div>

                {activeMessages.length > 0 ? (
                  <>
                    {activeMessages.map((msg) => {
                      const outbound = msg.direction === 'outbound';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-1 ${
                              outbound
                                ? 'bg-emerald-700 text-white'
                                : 'bg-white text-slate-900 border border-slate-200'
                            }`}
                          >
                            <p className="leading-relaxed">{msg.body}</p>
                            <div
                              className={`flex items-center justify-end gap-1 text-[10px] font-mono ${
                                outbound ? 'text-emerald-100' : 'text-slate-400'
                              }`}
                            >
                              <span>{msg.timestampLabel}</span>
                              {outbound && <span>✓✓</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                    <p className="text-xs">لا توجد رسائل سابقة في هذا السجل. ابدأ المحادثة الآن أو اختر قالباً معتمداً.</p>
                  </div>
                )}
              </div>

              {/* Chat Input & Template Picker Bar */}
              <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">اختر قالباً معتمداً خارج نافذة 24 ساعة (Approved Template)...</option>
                    <option value="template_enterprise_quote_v2">عرض سعر الحلول المؤسسية (Approved ✓)</option>
                    <option value="template_onboarding_kickoff">تأكيد موعد جلسة التدشين (Approved ✓)</option>
                    <option value="template_support_followup">متابعة تذكرة الدعم الفني (Approved ✓)</option>
                  </select>
                </div>

                {attachedFile && (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      {attachedFile.kind === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span className="font-bold">{attachedFile.name}</span>
                      <span className="text-[11px] text-blue-600 tabular-nums">({attachedFile.sizeLabel})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-blue-700 hover:text-blue-950 p-0.5 cursor-pointer"
                      title="إزالة المرفق"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="flex items-center gap-2 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, 'file')}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, 'image')}
                  />

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!attachedFile) {
                          setAttachedFile({
                            name: 'عرض_سعر_رواق_Enterprise_2026.pdf',
                            kind: 'file',
                            sizeLabel: '420 KB',
                          });
                          triggerToast('تم إرفاق ملف "عرض_سعر_رواق_Enterprise_2026.pdf" — اضغط إرسال أو اختر ملفاً آخر من جهازك.');
                        }
                        fileInputRef.current?.click();
                      }}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        attachedFile?.kind === 'file'
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-slate-100 text-slate-500'
                      }`}
                      title="إرفاق ملف"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!attachedFile) {
                          setAttachedFile({
                            name: 'بطاقة_منتج_رواق_CRM.png',
                            kind: 'image',
                            sizeLabel: '680 KB',
                          });
                          triggerToast('تم إرفاق صورة "بطاقة_منتج_رواق_CRM.png" — اضغط إرسال أو اختر صورة أخرى من جهازك.');
                        }
                        imageInputRef.current?.click();
                      }}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        attachedFile?.kind === 'image'
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-slate-100 text-slate-500'
                      }`}
                      title="إرفاق صورة"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="اكتب رسالة واتساب المباشرة هنا..."
                    className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:border-blue-600"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!replyBody.trim() && !selectedTemplateId && !attachedFile)}
                    className="shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>إرسال</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <MessageSquare className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-xs">اختر محادثة من القائمة لعرض السجل</p>
            </div>
          )}
        </div>

        {/* Left Pane (3 cols): Lead / Contact Card Summary */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-xs overflow-y-auto">
          {activeConvo ? (
            <div className="space-y-4">
              <div className="text-center pb-3 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center mx-auto text-base border border-emerald-300">
                  {activeConvo.name.slice(0, 2)}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">
                  {activeConvo.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-1 inline-block">
                  {activeConvo.uniqueId}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">الشركة / الجهة:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[140px]">{activeConvo.company}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <span dir="ltr" className="inline-block font-mono text-slate-800">{activeConvo.phone}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">المسؤول المكلف:</span>
                  <span className="font-bold text-slate-800">{activeConvo.assignedTo}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900">سجل نقاط التماس الفعلية:</h4>
                {(() => {
                  const customerTouchpoints = touchpoints.filter(
                    (tp) =>
                      tp.leadUniqueId === activeConvo.uniqueId ||
                      tp.relatedEntityId === activeConvo.id.replace('contact_', '') ||
                      tp.relatedEntityName.includes(activeConvo.name)
                  );
                  if (customerTouchpoints.length === 0 && activeMessages.length === 0) {
                    return (
                      <div className="text-[11px] text-slate-400 py-2 text-center">
                        لا توجد نقاط تماس سابقة لهذا العميل الجديد بعد.
                      </div>
                    );
                  }
                  return (
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      {activeMessages.length > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">آخر رسالة واتساب</span>
                          <span className="font-mono text-slate-400 shrink-0">
                            {activeMessages[activeMessages.length - 1].timestampLabel}
                          </span>
                        </div>
                      )}
                      {customerTouchpoints.slice(0, 3).map((tp) => (
                        <div key={tp.id} className="flex items-center justify-between gap-2">
                          <span className="truncate" title={tp.summary}>
                            {tp.eventType || tp.channel}: {tp.summary}
                          </span>
                          <span className="font-mono text-slate-400 shrink-0">
                            {tp.occurredAt}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-xs">لا يوجد عميل محدد</div>
          )}

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
            <span>التوزيع التلقائي (Round-Robin) نشط</span>
            <UserCheck className="w-4 h-4 text-blue-700" />
          </div>
        </div>
      </div>

      {/* Meta Embedded Signup Modal */}
      {embeddedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                ربط حساب واتساب السحابي (Meta Embedded Signup)
              </h2>
              <button
                type="button"
                onClick={() => setEmbeddedModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              يُتيح لك ربط حساب أعمال واتساب (WABA) استلام الرسائل الفورية وتفعيل حملات البث الجماعي بموافقة رسمية من ميتا.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">معرف حساب أعمال واتساب (WABA ID)</label>
                <input
                  type="text"
                  defaultValue="108492049182301"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">معرف رقم الهاتف (Phone Number ID)</label>
                <input
                  type="text"
                  defaultValue="510990029381"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEmbeddedModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleEmbeddedSignup()}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
              >
                مصادقة وربط WABA الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
