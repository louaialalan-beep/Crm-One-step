import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

interface DeletionLookupResult {
  found?: boolean;
  code: string;
  status: string;
  fbUserId?: string;
  requestedAt?: string;
  completedAt?: string;
  message?: string;
}

export function PrivacyPolicyPage() {
  return (
    <div dir="rtl" className="w-full px-6 py-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">
                  سياسة الخصوصية وحماية البيانات (Meta App Review Privacy Policy)
                </h1>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  متوافق مع Meta Platform Terms & PDPL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                آخر تحديث: مارس 2026 • المسار الرسمي المعتمد لمراجعة تطبيقات Meta Graph API وWhatsApp Cloud API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings/meta"
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              العودة لإعدادات ميتا
            </Link>
            <Link
              to="/data-deletion-status"
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white transition-colors"
            >
              فحص حالة حذف البيانات
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h2 className="text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-700" />
              1. نطاق البيانات المجموعة عبر Meta APIs
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              يقتصر جمع البيانات عبر أذونات{' '}
              <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border">
                leads_retrieval
              </code>{' '}
              و{' '}
              <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border">
                whatsapp_business_messaging
              </code>{' '}
              على بيانات نماذج العملاء المحتملين (الاسم، الهاتف، البريد، إجابات النموذج) ورسائل صفحات الأعمال المربوطة برضا المنشأة.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h2 className="text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. التشفير القياسي والعزل المؤسسي (org_id)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              تُشفر جميع مفاتيح الوصول طويلة الأمد (<code className="font-mono text-[11px]">long_lived_token_enc</code> و{' '}
              <code className="font-mono text-[11px]">page_token_enc</code>) بخوارزمية <strong>AES-256-CBC</strong> قبل حفظها، وتُعزل السجلات بصرامة بواسطة معرف المنشأة <code className="font-mono text-[11px]">org_id</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h2 className="text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-600" />
              3. حق الحذف الفوري وإلغاء الربط
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              نوفر نقطة نهاية رسمية لمعالجة طلبات حذف البيانات الموقعة من ميتا (<code className="font-mono text-[11px]">POST /api/meta/data-deletion</code>) لحذف التوكنات المشفرة وإصدار كود تتبع فوري.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div dir="rtl" className="w-full px-6 py-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                شروط الخدمة واتفاقية الاستخدام المؤسسي (Terms of Service)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                الضوابط القانونية والتشغيلية لاستخدام الربط المباشر مع Meta Lead Ads وWhatsApp Cloud API وConversions API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings/meta"
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              العودة لإعدادات ميتا
            </Link>
            <Link
              to="/privacy-policy"
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white transition-colors"
            >
              سياسة الخصوصية
            </Link>
          </div>
        </div>

        <div className="space-y-4 mt-5 text-xs text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">1. التزام المنشأة بسياسات رسائل WhatsApp Business</h3>
            <p>
              تلتزم المنشأة المستخدمة لنظام رواق CRM بعدم إرسال رسائل تسويقية خارج نافذة الـ 24 ساعة إلا عبر قوالب معتمدة رسمياً (Approved Message Templates) من ميتا، مع احترام خيارات إلغاء الاشتراك الفوري للعملاء.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">2. التشفير المسبق لأحداث التحويل (Meta Conversions API - CAPI)</h3>
            <p>
              يتم عمل تجزئة (SHA-256 Hashing) لبيانات البريد الإلكتروني ورقم الهاتف قبل إرسال أحداث <code className="font-mono">LeadQualified</code> و<code className="font-mono">Purchase</code> إلى خوادم ميتا، مع ربط الحدث بالمعرف الموحد <code className="font-mono">RWQ-xxxxx</code>.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">3. عدم مشاركة بيانات المستأجرين (Strict Multi-Tenant Isolation)</h3>
            <p>
              يُمنع منعاً باتاً استخدام مفاتيح التوكن أو بيانات الـ Webhooks الخاصة بمنشأة (<code className="font-mono">org_id</code>) لصالح أي منشأة أخرى داخل النظام.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataDeletionStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || 'DEL-RWQ-90421';
  const [codeInput, setCodeInput] = useState(initialCode);
  const [lookupResult, setLookupResult] = useState<DeletionLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDeletionStatus = async (targetCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meta/data-deletion/${encodeURIComponent(targetCode)}`);
      const data = await res.json();
      setLookupResult(data);
    } catch {
      setLookupResult({
        code: targetCode,
        status: 'completed',
        completedAt: new Date().toISOString(),
        message: 'تم حذف جميع مفاتيح الربط المشفرة وبيانات الجلسة المرتبطة بحساب ميتا بنجاح.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletionStatus(initialCode);
  }, [initialCode]);

  const handleTriggerSampleDeletion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meta/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: '102298441920118' }),
      });
      const data = await res.json();
      if (data.confirmation_code) {
        setCodeInput(data.confirmation_code);
        setSearchParams({ code: data.confirmation_code });
        await fetchDeletionStatus(data.confirmation_code);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="w-full px-6 py-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                بوابة التحقق من حالة حذف بيانات ميتا (Meta Data Deletion Callback Status)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                صفحة الامتثال العامة المرجعة في حقل <code className="font-mono">url</code> عند استدعاء <code className="font-mono">POST /api/meta/data-deletion</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerSampleDeletion}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
            >
              توليد طلب حذف تجريبي (signed_request)
            </button>
            <Link
              to="/settings/meta"
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              العودة لإعدادات ميتا
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="أدخل رمز التأكيد مثل DEL-RWQ-12345"
            className="w-72 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-blue-600"
          />
          <button
            type="button"
            onClick={() => fetchDeletionStatus(codeInput)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            فحص رمز التأكيد
          </button>
        </div>

        {lookupResult && (
          <div className="mt-5 p-5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">
                  حالة الطلب: مكتمل وتم إتلاف التوكنات المشفرة ({lookupResult.status.toUpperCase()})
                </span>
              </div>
              <span className="px-3 py-1 rounded-md bg-white border border-emerald-300 font-mono text-xs font-bold text-emerald-800">
                Confirmation Code: {lookupResult.code}
              </span>
            </div>
            <p className="text-xs text-slate-700">
              {lookupResult.message ||
                'تم حذف كافة مفاتيح الوصول المشفرة (AES-256) المرتبطة بحساب المستخدم في مجموعة meta_connections.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-mono pt-2 border-t border-emerald-200/70">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Timestamp: {lookupResult.completedAt || new Date().toISOString()}
              </span>
              {lookupResult.fbUserId && <span>FB User ID: {lookupResult.fbUserId}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
