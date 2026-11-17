import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';

export function ApprovalsAndAuditPage() {
  const { currentOrganization, currentOrgId, deals, updateDealFields } = useCrm();

  const [activeTab, setActiveTab] = useState<'rules' | 'pending' | 'audit'>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeals, setPendingDeals] = useState([
    {
      id: 'deal_demo_8492',
      uniqueId: 'DEAL-8492',
      title: 'باقة ERP وحلول المبيعات المتقدمة',
      client: 'شركة المدار للحلول التقنية المتقدمة',
      rep: 'سارة المنصور (مندوب مبيعات أول)',
      amountLabel: '175,000 ر.س (القيمة: 225,000 ر.س)',
      discountText: 'الخصم المطلوب: 22%',
      reasonText: '«العميل مستعد لتوقيع العقد فوراً لمدة سنتين مع سداد كامل القيمة مقدماً بشيك مصدق مقابل هذا الخصم.»',
      status: 'pending',
    },
    {
      id: 'deal_demo_6192',
      uniqueId: 'DEAL-6192',
      title: 'ترخيص سنوي 50 مستخدم — شركة الأفق القابضة',
      client: 'شركة الأفق القابضة للبتروكيماويات',
      rep: 'طارق العتيبي (مدير مبيعات أول)',
      amountLabel: '94,000 ر.س',
      discountText: 'الطلب: تمديد فترة السداد لـ 60 يوماً',
      reasonText: '«عميل استراتيجي سابق ويمتلك ملاءة مالية معتمدة من اللجنة الإدارية.»',
      status: 'pending',
    },
  ]);

  const handleApproveDeal = async (dealId: string) => {
    try {
      await updateDealFields(dealId, { stage: 'تفاوض' }, { summary: 'تم الاعتماد النهائي عبر مسار الموافقات الإدارية' });
      setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
      alert('تم اعتماد الطلب بنجاح ونشر التحديث في السجل.');
    } catch {
      setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
    }
  };

  const handleRejectDeal = async (dealId: string) => {
    setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
    alert('تم رفض الطلب وإرسال إشعار مسبب لمسؤول المبيعات.');
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4">
      {/* Top Flush Header & Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>الإعدادات والنظام</span>
              <span>/</span>
              <span>إدارة العمليات والأمان</span>
              <span>/</span>
              <span className="text-slate-900 font-bold">مسارات الموافقات وسجل التدقيق (Approvals & Audit Log)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900">
                مسارات الموافقات وسجل التدقيق الأمني (Approvals & Compliance Audit)
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                محرك الامتثال والحوكمة v2.8 نشط
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تشفير سجل العمليات متوافق مع معايير ISO 27001 / NCA • 1,480 حدث اليوم • إعدادات الإسناد التلقائي والمفوضين.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => alert('جاري تصدير تقرير التدقيق الأمني (CSV/PDF) المشفّر بشهادة SHA-256...')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير تقرير التدقيق (CSV/PDF)
            </button>
            <button
              type="button"
              onClick={() => alert('فتح معالج إنشاء مسار موافقة جديد.')}
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + إنشاء مسار موافقة جديد
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            مسارات وقواعد الموافقات (6 مسارات نشطة)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>طلبات بانتظار موافقتي</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
              {pendingDeals.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            سجل التدقيق الأمني الشامل (Audit Trail)
          </button>
        </div>
      </div>

      {/* 2-Column Workspace matching screen_e29a8963.png */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Right Column (7 cols ~ 62%): Approval Rules Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                مسارات قواعد الموافقات المعتمده في النظام (Approval Workflows)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active & Enforced
              </span>
            </div>

            {/* Rule 1: High-Discount Approval > 15% */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-extrabold bg-blue-100 text-blue-800">
                    #1 الأولوية القصوى
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">
                    موافقة الخصومات الاستثنائية على الصفقات High-Discount (Approval)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    مفصل
                  </span>
                  <div className="w-9 h-5 bg-emerald-600 rounded-full p-0.5 flex items-center justify-end">
                    <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                <span>معيار الإطلاق:</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">نسبة الخصم الإجمالية &gt; 15% OR مبلغ الخصم &gt; 20,000 ر.س</span>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">تسلسل مراحل التدقيق والموافقة (Approval Flow):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700">خطوة 1</span>
                      <span className="text-[10px] text-slate-400 font-mono">SLA: أقصاها 4 ساعات عمل</span>
                    </div>
                    <div className="font-bold text-slate-900">المدير المباشر (Reporting To / Sales Lead)</div>
                    <p className="text-[11px] text-slate-500">الشرط: خصم بين 15% و 25% • الإجراء: اعتماد فوري أو تصعيد للمستوى التالي</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700">خطوة 2</span>
                      <span className="text-[10px] text-slate-400 font-mono">SLA: أقصاها 24 ساعة</span>
                    </div>
                    <div className="font-bold text-slate-900">مدير المبيعات الإقليمي (Regional Sales Director)</div>
                    <p className="text-[11px] text-slate-500">الشرط: إذا تجاوز الخصم 25% • الإجراء: لاعتماد العروض المالية والخاصة</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-700" />
                  قفل السجل لمنع التلاعب + إشعار WhatsApp + Signals
                </span>
                <button type="button" onClick={() => alert('تعديل مسار الموافقة #1')} className="text-blue-700 font-bold hover:underline">
                  تعديل المسار
                </button>
              </div>
            </div>

            {/* Rule 2: Enterprise Deals >= 200K */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-extrabold bg-indigo-100 text-indigo-800">
                    #2 أولوية متوسطة
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">
                    اعتماد عقود وعروض المؤسسات الكبرى (&gt;= 200,000 ر.س) Enterprise Deals
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    مفصل
                  </span>
                  <div className="w-9 h-5 bg-emerald-600 rounded-full p-0.5 flex items-center justify-end">
                    <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                <span>معيار الإطلاق:</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">قيمة الصفقة &gt;= 200,000 OR باقة Enterprise السحابية المخصصة</span>
              </div>
            </div>

            {/* Rule 3: Lead & Deal Deletion Protection */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-extrabold bg-rose-100 text-rose-800">
                    حماية البيانات والامتثال
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">
                    موافقة حذف السجلات والعملاء نهائياً (Lead & Deal Deletion Protection)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    مفصل
                  </span>
                  <div className="w-9 h-5 bg-emerald-600 rounded-full p-0.5 flex items-center justify-end">
                    <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يتطلب أي إجراء نقل سجل إلى سلة المهملات أو التفريغ النهائي موافقة صريحة من <strong>مدير أمن البيانات (Data Protection Officer)</strong> أو مسؤول النظام العام (Super Admin) لتفادي تسريب أو فقدان بيانات المبيعات الحساسة.
              </p>
            </div>
          </div>
        </div>

        {/* Left Column (5 cols ~ 38%): Pending Approvals & Immutable Audit Trail */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Card: طلبات بانتظار قرارك */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  طلبات بانتظار قرارك (Pending My Approval)
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">
                {pendingDeals.length} معلقة
              </span>
            </div>

            <div className="space-y-3">
              {pendingDeals.length > 0 ? (
                pendingDeals.map((deal) => (
                  <div key={deal.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                          متبقي ساعتان
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 mt-1">
                          {deal.title} — {deal.client}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          المسؤول: {deal.rep}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white border border-rose-300 font-mono text-xs font-bold text-rose-800">
                        {deal.uniqueId}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span>القيمة والخصم:</span>
                        <span className="text-blue-700">{deal.amountLabel}</span>
                      </div>
                      <div className="text-emerald-700 font-bold">{deal.discountText}</div>
                      <p className="text-slate-600 italic text-[11px]">{deal.reasonText}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200/70">
                      <button
                        type="button"
                        onClick={() => void handleRejectDeal(deal.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition-colors cursor-pointer"
                      >
                        رفض مسبب ✗
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApproveDeal(deal.id)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        اعتماد ونشر ✓
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد طلبات معلقة بانتظار قرارك حالياً.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Card: سجل التدقيق الأمني اللحظي (Immutable Audit Trail) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  سجل التدقيق الأمني اللحظي (Immutable Audit Trail)
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                SHA-256 Ledger
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                  <span className="text-rose-700 font-bold">تعديل صلاحيات ملف المبيعات (Sales Profile)</span>
                  <span>منذ 8 دقائق</span>
                </div>
                <p className="text-slate-800 font-bold">منفذ العملية: أحمد الشمري (مدير النظام) | IP: 192.168.1.45</p>
                <p className="text-[11px] text-slate-500">تم إضافة صلاحية تصدير التقارير المالية لملف «مبيعات الشركات».</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                  <span className="text-blue-700 font-bold">تصدير دفعة عملاء محتملين (Leads 480)</span>
                  <span>منذ 34 دقيقة</span>
                </div>
                <p className="text-slate-800 font-bold">منفذ العملية: نايف الحربي | IP: 10.0.4.12</p>
                <p className="text-[11px] text-emerald-700">✓ تم التحقق عبر المصادقة الثنائية 2FA بنجاح</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                  <span className="text-amber-700 font-bold">إعادة تعيين 25 عميل تلقائياً عبر Round-Robin</span>
                  <span>منذ ساعتين</span>
                </div>
                <p className="text-slate-800 font-bold">منفذ العملية: محرك الأتمتة (System Bot)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
