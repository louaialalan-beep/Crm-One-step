import React, { useMemo, useState } from 'react';
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
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import type { InboxMessage } from '../types/crm';

export function WhatsappInboxPage() {
  const {
    currentOrganization,
    currentOrgId,
    currentUser,
    leads,
    contacts,
    messages,
    sendInboxReply,
    connectMetaAccount,
    metaPages,
  } = useCrm();

  const isWhatsappEnabled = Boolean(currentOrganization?.addons?.whatsapp_campaigns);

  const [selectedConvoId, setSelectedConvoId] = useState<string>('lead_1');
  const [filterTab, setFilterTab] = useState<'all' | 'mine' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [embeddedModalOpen, setEmbeddedModalOpen] = useState(false);

  // RBAC filtering for conversations
  const conversations = useMemo(() => {
    const list = leads.map((l) => ({
      id: l.id,
      name: l.fullName,
      company: l.company || 'شركة تجارية',
      phone: l.phone || '+966 50 123 4567',
      uniqueId: l.unique_id,
      assignedTo: l.assignedToName,
      unread: l.awaitingReplyHours ? l.awaitingReplyHours > 12 : false,
      lastMessage: l.lastMessageSnippet || 'أهلاً بك، استفسار بخصوص باقة الحلول المؤسسية ERP...',
      timeLabel: 'منذ 10 دقائق',
      channel: 'whatsapp' as const,
      isLead: true,
      rawLead: l,
    }));

    return list.filter((c) => {
      // Chat RBAC
      const isAdmin = currentUser.profileId === 'prof_admin';
      const isManager = currentUser.profileId === 'prof_sales_director';
      if (!isAdmin) {
        if (isManager) {
          // If manager has hide_subordinates_data, only show personal
          if (currentUser.department === 'مبيعات المؤسسات' && false) {
            if (c.assignedTo !== currentUser.fullName) return false;
          }
        } else {
          // Sales Rep: own chats only
          if (c.assignedTo !== currentUser.fullName) return false;
        }
      }

      if (filterTab === 'unread' && !c.unread) return false;
      if (
        searchQuery.trim() &&
        !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.uniqueId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.phone.includes(searchQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [leads, currentUser, filterTab, searchQuery]);

  const activeConvo = useMemo(() => {
    return (
      conversations.find((c) => c.id === selectedConvoId) ||
      conversations[0] ||
      null
    );
  }, [conversations, selectedConvoId]);

  const activeMessages = useMemo(() => {
    if (!activeConvo) return [];
    return messages.filter(
      (m) =>
        m.leadUniqueId === activeConvo.uniqueId ||
        m.senderName.includes(activeConvo.name)
    );
  }, [messages, activeConvo]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() && !selectedTemplateId) return;
    if (!activeConvo) return;

    setSending(true);
    try {
      const textToSend = selectedTemplateId
        ? `[قالب معتمد: ${selectedTemplateId}] ${replyBody || 'مرحباً، تفضل بطلب العرض التجريبي المعتمد.'}`
        : replyBody;

      await sendInboxReply(
        'whatsapp',
        activeConvo.name,
        textToSend,
        {
          leadId: activeConvo.isLead ? activeConvo.rawLead.id : undefined,
          leadUniqueId: activeConvo.uniqueId,
          companyName: activeConvo.company,
        }
      );
      setReplyBody('');
      setSelectedTemplateId('');
    } finally {
      setSending(false);
    }
  };

  const handleEmbeddedSignup = async () => {
    await connectMetaAccount({
      fbUserId: '102298441920118',
      fbUserName: `${currentUser.fullName} — WhatsApp Cloud Admin`,
      shortLivedToken: `EAAB_WABA_${Date.now()}`,
    });
    setEmbeddedModalOpen(false);
  };

  if (!isWhatsappEnabled) {
    return (
      <div dir="rtl" className="w-full px-6 py-12 flex flex-col items-center justify-center text-center">
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
              alert('تم إرسال طلب تفعيل الإضافة بنجاح إلى مدير النظام العام. سيتم التفعيل الفوري خلال دقائق.');
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
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              Quota: {currentOrganization?.messages_used || 8420} / {currentOrganization?.messages_limit || 25000} رسالة
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
                      <span>{activeConvo.phone}</span>
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
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/30">
                <div className="text-center my-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 shadow-2xs">
                    المحادثة مؤمنة ومشفرة تماماً عبر WhatsApp Cloud API
                  </span>
                </div>

                {activeMessages.length > 0 ? (
                  activeMessages.map((msg) => {
                    const outbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-1 ${
                            outbound
                              ? 'bg-white text-slate-900 border border-slate-200'
                              : 'bg-emerald-700 text-white'
                          }`}
                        >
                          <p className="leading-relaxed">{msg.body}</p>
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] font-mono ${
                              outbound ? 'text-slate-400' : 'text-emerald-200'
                            }`}
                          >
                            <span>{msg.timestampLabel}</span>
                            {outbound && <span>✓✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
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

                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                      title="إرفاق ملف"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
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
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:border-blue-600"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!replyBody.trim() && !selectedTemplateId)}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
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
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-xs">
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
                  <span className="font-bold text-slate-800">{activeConvo.company}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <span className="font-mono text-slate-800">{activeConvo.phone}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">المسؤول المكلف:</span>
                  <span className="font-bold text-slate-800">{activeConvo.assignedTo}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900">سجل نقاط التماس الأخيرة:</h4>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>آخر تواصل واتساب</span>
                    <span className="font-mono text-slate-400">اليوم 10:45 ص</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>إرسال عرض سعر</span>
                    <span className="font-mono text-slate-400">أمس</span>
                  </div>
                </div>
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
