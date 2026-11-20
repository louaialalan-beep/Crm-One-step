import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Server,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Send,
  Inbox,
  Clock,
  FileText,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import {
  EmailConnectionTestResult,
  EmailServerSettings,
  getEmailSettings,
  syncInboundImapEmails,
  testEmailServerConnection,
  updateEmailSettings,
} from '../services/emailService';
import { TemplatesManagerPage } from './EnterpriseSettingsPages';

export default function EmailSettingsPage() {
  const { currentOrgId, currentOrganization } = useCrm();
  const orgId = currentOrgId || currentOrganization?.id || 'org-1';

  const [activeSection, setActiveSection] = useState<'imap_smtp' | 'templates'>('imap_smtp');
  const [form, setForm] = useState<EmailServerSettings>({
    org_id: orgId,
    imap_host: 'imap.hostinger.com',
    imap_port: 993,
    imap_username: 'sales@crm-one-step.sa',
    has_imap_password: true,
    imap_use_ssl: true,
    imap_folder: 'INBOX',
    smtp_host: 'smtp.hostinger.com',
    smtp_port: 587,
    smtp_username: 'sales@crm-one-step.sa',
    has_smtp_password: true,
    smtp_use_tls: true,
    from_email: 'sales@crm-one-step.sa',
    from_name: 'فريق المبيعات — Crm-One-step',
    sync_enabled: true,
    sync_interval_minutes: 5,
    last_synced_at: new Date().toISOString(),
    is_encrypted: true,
  });

  const [imapPasswordInput, setImapPasswordInput] = useState('••••••••••••');
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('••••••••••••');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<EmailConnectionTestResult | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    getEmailSettings(orgId).then((loaded) => {
      if (!mounted) return;
      setForm(loaded);
      setImapPasswordInput(loaded.has_imap_password ? '••••••••••••' : '');
      setSmtpPasswordInput(loaded.has_smtp_password ? '••••••••••••' : '');
    });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const applyPreset = (preset: 'google' | 'microsoft365' | 'hostinger') => {
    if (preset === 'google') {
      setForm((prev) => ({
        ...prev,
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        imap_use_ssl: true,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_use_tls: true,
      }));
    } else if (preset === 'microsoft365') {
      setForm((prev) => ({
        ...prev,
        imap_host: 'outlook.office365.com',
        imap_port: 993,
        imap_use_ssl: true,
        smtp_host: 'smtp.office365.com',
        smtp_port: 587,
        smtp_use_tls: true,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        imap_host: 'imap.hostinger.com',
        imap_port: 993,
        imap_use_ssl: true,
        smtp_host: 'smtp.hostinger.com',
        smtp_port: 587,
        smtp_use_tls: true,
      }));
    }
    setBannerMessage({
      type: 'success',
      text: 'تم تطبيق إعدادات الخادم القياسية، يمكنك الآن اختبار الاتصال أو الحفظ.',
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setBannerMessage(null);
    try {
      const result = await testEmailServerConnection(orgId, {
        ...form,
        imap_password: imapPasswordInput.includes('•') ? undefined : imapPasswordInput,
        smtp_password: smtpPasswordInput.includes('•') ? undefined : smtpPasswordInput,
      });
      setTestResult(result);
      if (result.imap_ok && result.smtp_ok) {
        setBannerMessage({
          type: 'success',
          text: `نجح اختبار الاتصال الثنائي (IMAP: ${result.imap_latency_ms}ms | SMTP: ${result.smtp_latency_ms}ms).`,
        });
      } else {
        setBannerMessage({
          type: 'error',
          text: 'تعذّر التحقق من أحد الخادمين، يرجى مراجعة تفاصيل الاختبار أدناه.',
        });
      }
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء اختبار الاتصال',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setBannerMessage(null);
    try {
      const saved = await updateEmailSettings(orgId, {
        ...form,
        imap_password: imapPasswordInput.includes('•') ? undefined : imapPasswordInput,
        smtp_password: smtpPasswordInput.includes('•') ? undefined : smtpPasswordInput,
      });
      setForm(saved);
      setImapPasswordInput('••••••••••••');
      setSmtpPasswordInput('••••••••••••');
      setBannerMessage({
        type: 'success',
        text: `تم تشفير وحفظ إعدادات البريد الإلكتروني (IMAP/SMTP) لمؤسسة "${currentOrganization?.name || 'المؤسسة الحالية'}" بنجاح.`,
      });
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذّر حفظ الإعدادات',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setBannerMessage(null);
    try {
      const res = await syncInboundImapEmails({ orgId });
      setForm((prev) => ({ ...prev, last_synced_at: res.timestamp }));
      setBannerMessage({
        type: 'success',
        text: `اكتملت مزامنة صندوق الوارد (IMAP) عبر عامل الخلفية (worker.py) — تم جلب وربط ${res.synced_count} رسالة بالعملاء المحتملين (RWQ-xxxxx).`,
      });
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'فشلت مزامنة البريد الوارد',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/settings" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الإعدادات</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">إعدادات البريد الإلكتروني ثنائي الاتجاه (IMAP/SMTP)</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Mail className="w-6 h-6 text-blue-600" />
              <span>البريد الإلكتروني ثنائي الاتجاه (IMAP / SMTP)</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" />
              مشفّر على مستوى المؤسسة (RLS + Encrypted Vault)
            </span>
          </div>
          <p className="text-sm text-slate-600">
            اربط خادم البريد الوارد (IMAP) والصادر (SMTP) لمزامنة رسائل العملاء تلقائياً مع الخط الزمني للعميل والصفقة عبر المعرّف الموحد <span dir="ltr" className="font-mono font-semibold text-blue-700">RWQ-xxxxx</span>.
          </p>
        </div>

        {/* Section switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveSection('imap_smtp')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'imap_smtp'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>خادم IMAP / SMTP</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('templates')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'templates'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>قوالب البريد والرسائل</span>
          </button>
        </div>
      </div>

      {activeSection === 'templates' ? (
        <TemplatesManagerPage />
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Notification Banner */}
          {bannerMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="text-sm font-medium">{bannerMessage.text}</div>
            </div>
          )}

          {/* Quick Provider Presets & Sync Status Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 ml-1">إعداد سريع لمزود الخدمة:</span>
              <button
                type="button"
                onClick={() => applyPreset('google')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 transition-colors"
              >
                Google Workspace / Gmail
              </button>
              <button
                type="button"
                onClick={() => applyPreset('microsoft365')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 transition-colors"
              >
                Microsoft 365 / Outlook
              </button>
              <button
                type="button"
                onClick={() => applyPreset('hostinger')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 transition-colors"
              >
                Hostinger / cPanel Enterprise
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {form.last_synced_at && (
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>آخر مزامنة IMAP:</span>
                  <span dir="ltr" className="font-mono text-slate-700">
                    {new Date(form.last_synced_at).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'جاري مزامنة IMAP...' : 'مزامنة البريد الوارد الآن'}</span>
              </button>
            </div>
          </div>

          {/* Two columns: IMAP Inbound & SMTP Outbound */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* IMAP Inbound Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">خادم البريد الوارد (IMAP)</h2>
                    <p className="text-xs text-slate-500">مزامنة رسائل العملاء الواردة وربطها بجدول email_messages</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono font-semibold" dir="ltr">
                  IMAP4_SSL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عنوان خادم IMAP (Host)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={form.imap_host}
                    onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                    placeholder="imap.yourdomain.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المنفذ (Port)
                  </label>
                  <input
                    type="number"
                    dir="ltr"
                    required
                    value={form.imap_port}
                    onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المستخدم / البريد الإلكتروني (IMAP Username)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={form.imap_username}
                  onChange={(e) => setForm({ ...form, imap_username: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>كلمة مرور IMAP / App Password</span>
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-normal">
                    <KeyRound className="w-3 h-3" />
                    تُحفظ مشفرة في الخادم
                  </span>
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={imapPasswordInput}
                  onChange={(e) => setImapPasswordInput(e.target.value)}
                  placeholder="أدخل كلمة المرور أو App Password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    مجلد المزامنة الافتراضي
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.imap_folder}
                    onChange={(e) => setForm({ ...form, imap_folder: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.imap_use_ssl}
                      onChange={(e) => setForm({ ...form, imap_use_ssl: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700">تفعيل تشفير SSL/TLS (موصى به)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* SMTP Outbound Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">خادم البريد الصادر (SMTP)</h2>
                    <p className="text-xs text-slate-500">إرسال الردود المباشرة من صفحة العميل والصفقة</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold" dir="ltr">
                  STARTTLS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عنوان خادم SMTP (Host)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={form.smtp_host}
                    onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                    placeholder="smtp.yourdomain.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المنفذ (Port)
                  </label>
                  <input
                    type="number"
                    dir="ltr"
                    required
                    value={form.smtp_port}
                    onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم مستخدم SMTP
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={form.smtp_username}
                  onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>كلمة مرور SMTP / App Password</span>
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-normal">
                    <KeyRound className="w-3 h-3" />
                    تُحفظ مشفرة في الخادم
                  </span>
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={smtpPasswordInput}
                  onChange={(e) => setSmtpPasswordInput(e.target.value)}
                  placeholder="أدخل كلمة المرور أو App Password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم المرسل الظاهر للعميل
                  </label>
                  <input
                    type="text"
                    value={form.from_name}
                    onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عنوان البريد المرسل (From Email)
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={form.from_email}
                    onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Worker Sync Interval & Test Result */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  id="sync_enabled_toggle"
                  type="checkbox"
                  checked={form.sync_enabled}
                  onChange={(e) => setForm({ ...form, sync_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="sync_enabled_toggle" className="text-sm font-bold text-slate-800 cursor-pointer">
                  تفعيل المزامنة الدورية التلقائية للرسائل الواردة في الخلفية (ARQ Worker `sync_imap_emails_task`)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">فترة المزامنة:</span>
                <select
                  value={form.sync_interval_minutes}
                  onChange={(e) => setForm({ ...form, sync_interval_minutes: Number(e.target.value) })}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                >
                  <option value={2}>كل دقيقتين</option>
                  <option value={5}>كل 5 دقائق</option>
                  <option value={15}>كل 15 دقيقة</option>
                  <option value={30}>كل 30 دقيقة</option>
                </select>
              </div>
            </div>

            {testResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    testResult.imap_ok
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold">فحص IMAP ({testResult.imap_latency_ms}ms)</div>
                    <div>{testResult.imap_message}</div>
                  </div>
                </div>
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    testResult.smtp_ok
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold">فحص SMTP ({testResult.smtp_latency_ms}ms)</div>
                    <div>{testResult.smtp_message}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isTesting ? 'جاري اختبار خوادم IMAP و SMTP...' : 'اختبار الاتصال (IMAP & SMTP)'}</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isSaving ? 'جاري التشفير والحفظ...' : 'حفظ الإعدادات مشفرة للمؤسسة'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
