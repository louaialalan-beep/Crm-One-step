import React, { useEffect, useState } from 'react';
import {
  Mail,
  Send,
  RefreshCw,
  Reply,
  Inbox,
  ArrowUpLeft,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  EmailMessageItem,
  getEntityEmailMessages,
  sendEntityEmailReply,
  syncInboundImapEmails,
} from '../../services/emailService';

interface EntityEmailTimelineTabProps {
  orgId: string;
  leadUid: string;
  leadId?: string;
  dealId?: string;
  customerName: string;
  customerEmail?: string;
}

export default function EntityEmailTimelineTab({
  orgId,
  leadUid,
  leadId,
  dealId,
  customerName,
  customerEmail,
}: EntityEmailTimelineTabProps) {
  const resolvedEmail = (customerEmail || 'client@enterprise-sa.com').trim();
  const [messages, setMessages] = useState<EmailMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const [toEmail, setToEmail] = useState(resolvedEmail);
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState(`متابعة بخصوص (${leadUid}) — ${customerName}`);
  const [bodyText, setBodyText] = useState('');
  const [inReplyTo, setInReplyTo] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const list = await getEntityEmailMessages({
        orgId,
        leadUid,
        leadId,
        dealId,
        customerEmail: resolvedEmail,
        customerName,
      });
      setMessages(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setToEmail(resolvedEmail);
    loadMessages();
  }, [orgId, leadUid, leadId, dealId, resolvedEmail]);

  const handleSyncImap = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      await syncInboundImapEmails({
        orgId,
        leadUid,
        leadId,
        dealId,
        customerEmail: resolvedEmail,
        customerName,
      });
      await loadMessages();
      setFeedback('تمت مزامنة البريد الوارد عبر IMAP وتحديث السجل الزمني للعميل.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReplyClick = (msg: EmailMessageItem) => {
    setToEmail(msg.direction === 'inbound' ? msg.from_email : msg.to_email);
    setSubject(msg.subject.startsWith('رد:') ? msg.subject : `رد: ${msg.subject}`);
    setInReplyTo(msg.message_id_header || undefined);
    setBodyText(
      `\n\n--- في ${new Date(msg.created_at).toLocaleString('ar-SA')} كتب ${msg.from_email} ---\n${msg.body_text}`
    );
    setShowComposer(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !subject.trim() || !bodyText.trim()) return;
    setIsSending(true);
    setFeedback(null);
    try {
      const created = await sendEntityEmailReply({
        orgId,
        leadUid,
        leadId,
        dealId,
        toEmail,
        ccEmail: ccEmail.trim() || undefined,
        subject,
        bodyText,
        inReplyTo,
      });
      setMessages((prev) => [created, ...prev]);
      setBodyText('');
      setInReplyTo(undefined);
      setShowComposer(false);
      setFeedback('تم إرسال البريد الإلكتروني عبر خادم SMTP وتسجيله في الخط الزمني بنجاح.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              المراسلات البريدية ثنائية الاتجاه (IMAP / SMTP)
            </h3>
            <span
              dir="ltr"
              className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-blue-100 text-blue-800"
            >
              {leadUid}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            البريد المرتبط بالعميل:{' '}
            <span dir="ltr" className="font-mono text-slate-700 font-semibold">
              {resolvedEmail}
            </span>{' '}
            •{' '}
            <Link to="/settings/email" className="text-blue-600 hover:underline font-medium">
              إعدادات خادم IMAP/SMTP
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSyncImap}
            disabled={isSyncing}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'جاري الجلب...' : 'مزامنة IMAP'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInReplyTo(undefined);
              setSubject(`متابعة بخصوص (${leadUid}) — ${customerName}`);
              setBodyText('');
              setShowComposer((prev) => !prev);
            }}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>رسالة بريد جديدة</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Direct Composer / Reply Box */}
      {showComposer && (
        <form
          onSubmit={handleSendEmail}
          className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>{inReplyTo ? 'إرسال رد مباشر عبر SMTP' : 'إرسال بريد إلكتروني جديد عبر SMTP'}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              إغلاق ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى (To)</label>
              <input
                type="email"
                dir="ltr"
                required
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">نسخة (CC - اختياري)</label>
              <input
                type="text"
                dir="ltr"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="manager@company.sa"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الموضوع (Subject)</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">نص الرسالة</label>
            <textarea
              rows={5}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={`مرحباً ${customerName}،\nاكتب رسالتك أو ردك المباشر هنا...`}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'جاري الإرسال عبر SMTP...' : 'إرسال البريد الآن'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Email Timeline List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">جاري تحميل رسائل البريد الإلكتروني...</div>
      ) : messages.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-2">
          <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700">لا توجد رسائل بريد إلكتروني مسجلة بعد</p>
          <p className="text-xs text-slate-500">
            اضغط على "مزامنة IMAP" لجلب الرسائل الواردة أو "رسالة بريد جديدة" لإرسال بريد مباشر.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isInbound = msg.direction === 'inbound';
            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 transition-all ${
                  isInbound
                    ? 'bg-white border-slate-200'
                    : 'bg-blue-50/40 border-blue-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isInbound
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isInbound ? (
                        <>
                          <ArrowDownRight className="w-3 h-3" />
                          <span>وارد (IMAP)</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpLeft className="w-3 h-3" />
                          <span>صادر (SMTP)</span>
                        </>
                      )}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{msg.subject}</h4>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1" dir="ltr">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.created_at).toLocaleString('ar-SA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReplyClick(msg)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-3 h-3" />
                      <span>رد</span>
                    </button>
                  </div>
                </div>

                <div className="py-2 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div>
                    <span className="font-semibold text-slate-600">من: </span>
                    <span dir="ltr" className="font-mono text-slate-800">
                      {msg.from_email}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">إلى: </span>
                    <span dir="ltr" className="font-mono text-slate-800">
                      {msg.to_email}
                    </span>
                  </div>
                  {msg.cc_email && (
                    <div>
                      <span className="font-semibold text-slate-600">نسخة: </span>
                      <span dir="ltr" className="font-mono text-slate-700">
                        {msg.cc_email}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                  {msg.body_text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
