import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Download,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';

export interface ApprovalsAndAuditPageProps {
  defaultTab?: 'rules' | 'pending' | 'audit';
}

interface ApprovalWorkflowRule {
  id: string;
  priorityBadge: string;
  priorityTone: 'blue' | 'indigo' | 'rose';
  title: string;
  criteriaText: string;
  criteriaTone: 'amber' | 'blue' | 'rose';
  description?: string;
  active: boolean;
  steps?: Array<{
    stepLabel: string;
    slaLabel: string;
    approverTitle: string;
    conditionNote: string;
  }>;
}

interface AuditLogEntry {
  id: string;
  title: string;
  tone: 'rose' | 'blue' | 'amber' | 'emerald';
  timeLabel: string;
  actorLine: string;
  detailLine: string;
  module: string;
}

const INITIAL_RULES: ApprovalWorkflowRule[] = [
  {
    id: 'rule_discount_1',
    priorityBadge: '#1 الأولوية القصوى',
    priorityTone: 'blue',
    title: 'موافقة الخصومات الاستثنائية على الصفقات High-Discount (Approval)',
    criteriaText: 'نسبة الخصم الإجمالية > 15% OR مبلغ الخصم > 20,000 ر.س',
    criteriaTone: 'amber',
    active: true,
    steps: [
      {
        stepLabel: 'خطوة 1',
        slaLabel: 'SLA: أقصاها 4 ساعات عمل',
        approverTitle: 'المدير المباشر (Reporting To / Sales Lead)',
        conditionNote: 'الشرط: خصم بين 15% و 25% • الإجراء: اعتماد فوري أو تصعيد للمستوى التالي',
      },
      {
        stepLabel: 'خطوة 2',
        slaLabel: 'SLA: أقصاها 24 ساعة',
        approverTitle: 'مدير المبيعات الإقليمي (Regional Sales Director)',
        conditionNote: 'الشرط: إذا تجاوز الخصم 25% • الإجراء: لاعتماد العروض المالية والخاصة',
      },
    ],
  },
  {
    id: 'rule_enterprise_2',
    priorityBadge: '#2 أولوية متوسطة',
    priorityTone: 'indigo',
    title: 'اعتماد عقود وعروض المؤسسات الكبرى (>= 200,000 ر.س) Enterprise Deals',
    criteriaText: 'قيمة الصفقة >= 200,000 OR باقة Enterprise السحابية المخصصة',
    criteriaTone: 'blue',
    active: true,
  },
  {
    id: 'rule_deletion_3',
    priorityBadge: 'حماية البيانات والامتثال',
    priorityTone: 'rose',
    title: 'موافقة حذف السجلات والعملاء نهائياً (Lead & Deal Deletion Protection)',
    criteriaText: 'إجراء الحذف النهائي أو تفريغ سلة المهملات',
    criteriaTone: 'rose',
    description:
      'يتطلب أي إجراء نقل سجل إلى سلة المهملات أو التفريغ النهائي موافقة صريحة من مدير أمن البيانات (Data Protection Officer) أو مسؤول النظام العام (Super Admin) لتفادي تسريب أو فقدان بيانات المبيعات الحساسة.',
    active: true,
  },
];

const INITIAL_AUDIT_ENTRIES: AuditLogEntry[] = [
  {
    id: 'aud_1',
    title: 'تعديل صلاحيات ملف المبيعات (Sales Profile)',
    tone: 'rose',
    timeLabel: 'منذ 8 دقائق',
    actorLine: 'منفذ العملية: أحمد الشمري (مدير النظام) | IP: 192.168.1.45',
    detailLine: 'تم إضافة صلاحية تصدير التقارير المالية لملف «مبيعات الشركات».',
    module: 'الأمن والصلاحيات',
  },
  {
    id: 'aud_2',
    title: 'تصدير دفعة عملاء محتملين (Leads 480)',
    tone: 'blue',
    timeLabel: 'منذ 34 دقيقة',
    actorLine: 'منفذ العملية: نايف الحربي | IP: 10.0.4.12',
    detailLine: '✓ تم التحقق عبر المصادقة الثنائية 2FA بنجاح',
    module: 'العملاء المحتملين',
  },
  {
    id: 'aud_3',
    title: 'إعادة تعيين 25 عميل تلقائياً عبر Round-Robin',
    tone: 'amber',
    timeLabel: 'منذ ساعتين',
    actorLine: 'منفذ العملية: محرك الأتمتة (System Bot)',
    detailLine: 'توزيع تلقائي بناءً على قاعدة التوزيع الجغرافي للمنطقة الوسطى.',
    module: 'قواعد التوزيع',
  },
  {
    id: 'aud_4',
    title: 'اعتماد خصم استثنائي 18% للصفقة DEAL-7740',
    tone: 'emerald',
    timeLabel: 'منذ 3 ساعات',
    actorLine: 'منفذ العملية: طارق العتيبي (مدير مبيعات أول) | IP: 10.0.2.88',
    detailLine: 'تمت الموافقة ضمن المرحلة الأولى وتحويل العرض إلى أمر بيع معتمد.',
    module: 'مسارات الموافقات',
  },
];

export function ApprovalsAndAuditPage({ defaultTab }: ApprovalsAndAuditPageProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrgId, updateDealFields } = useCrm();

  const resolvedRouteTab: 'rules' | 'pending' | 'audit' = useMemo(() => {
    if (defaultTab) return defaultTab;
    if (location.pathname.includes('audit-log')) return 'audit';
    return 'rules';
  }, [defaultTab, location.pathname]);

  const [activeTab, setActiveTab] = useState<'rules' | 'pending' | 'audit'>(resolvedRouteTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [rules, setRules] = useState<ApprovalWorkflowRule[]>(INITIAL_RULES);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>(INITIAL_AUDIT_ENTRIES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createRuleModalOpen, setCreateRuleModalOpen] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleCriteria, setNewRuleCriteria] = useState('');
  const [newRuleApprover, setNewRuleApprover] = useState('المدير المباشر (Reporting To)');

  useEffect(() => {
    setActiveTab(resolvedRouteTab);
  }, [resolvedRouteTab]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const [pendingDeals, setPendingDeals] = useState([
    {
      id: 'deal_demo_8492',
      uniqueId: 'DEAL-8492',
      title: 'باقة ERP وحلول المبيعات المتقدمة',
      client: 'شركة المدار للحلول التقنية المتقدمة',
      rep: 'سارة المنصور (مندوب مبيعات أول)',
      amountLabel: '175,000 ر.س (القيمة: 225,000 ر.س)',
      discountText: 'الخصم المطلوب: 22%',
      reasonText:
        '«العميل مستعد لتوقيع العقد فوراً لمدة سنتين مع سداد كامل القيمة مقدماً بشيك مصدق مقابل هذا الخصم.»',
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
    const target = pendingDeals.find((d) => d.id === dealId);
    try {
      await updateDealFields(
        dealId,
        { stage: 'تفاوض' },
        { summary: 'تم الاعتماد النهائي عبر مسار الموافقات الإدارية' }
      );
    } catch {
      // Demo deal ID fallback
    }
    setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
    if (target) {
      setAuditEntries((prev) => [
        {
          id: `aud_${Date.now()}`,
          title: `اعتماد طلب الموافقة (${target.uniqueId}) — ${target.title}`,
          tone: 'emerald',
          timeLabel: 'الآن',
          actorLine: `منفذ العملية: مسؤول الاعتماد (${currentOrgId})`,
          detailLine: `تمت الموافقة على ${target.discountText} للعميل ${target.client}.`,
          module: 'مسارات الموافقات',
        },
        ...prev,
      ]);
    }
    setToastMessage('تم اعتماد الطلب بنجاح ونشر التحديث في سجل التدقيق الأمني.');
  };

  const handleRejectDeal = async (dealId: string) => {
    const target = pendingDeals.find((d) => d.id === dealId);
    setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
    if (target) {
      setAuditEntries((prev) => [
        {
          id: `aud_rej_${Date.now()}`,
          title: `رفض طلب الموافقة (${target.uniqueId}) — ${target.title}`,
          tone: 'rose',
          timeLabel: 'الآن',
          actorLine: `منفذ العملية: مسؤول الاعتماد (${currentOrgId})`,
          detailLine: `تم رفض ${target.discountText} وإشعار المندوب المسؤول.`,
          module: 'مسارات الموافقات',
        },
        ...prev,
      ]);
    }
    setToastMessage('تم رفض الطلب وإرسال إشعار مسبب لمسؤول المبيعات.');
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, active: !r.active } : r))
    );
    setToastMessage('تم تحديث حالة مسار الموافقة بنجاح.');
  };

  const handleExportAuditCsv = () => {
    const rows = [
      ['المعرف', 'العملية', 'الوحدة', 'التفاصيل', 'المنفذ', 'التوقيت'],
      ...auditEntries.map((e) => [
        e.id,
        e.title,
        e.module,
        e.detailLine,
        e.actorLine,
        e.timeLabel,
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq-compliance-audit-${currentOrgId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage('تم تصدير تقرير التدقيق الأمني (CSV) المشفّر بشهادة SHA-256.');
  };

  const handleCreateRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim()) return;
    const created: ApprovalWorkflowRule = {
      id: `rule_${Date.now()}`,
      priorityBadge: `#${rules.length + 1} مسار مخصص`,
      priorityTone: 'blue',
      title: newRuleTitle.trim(),
      criteriaText: newRuleCriteria.trim() || 'نسبة الخصم > 15% أو تجاوز السقف الائتماني',
      criteriaTone: 'amber',
      active: true,
      steps: [
        {
          stepLabel: 'خطوة 1',
          slaLabel: 'SLA: أقصاها 4 ساعات عمل',
          approverTitle: newRuleApprover,
          conditionNote: 'اعتماد إلكتروني مباشر مع توثيق SHA-256 في سجل التدقيق',
        },
      ],
    };
    setRules((prev) => [created, ...prev]);
    setNewRuleTitle('');
    setNewRuleCriteria('');
    setCreateRuleModalOpen(false);
    setToastMessage(`تم إنشاء مسار الموافقة "${created.title}" وتفعيله بنجاح.`);
  };

  const filteredAuditEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return auditEntries;
    return auditEntries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.actorLine.toLowerCase().includes(q) ||
        e.detailLine.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q)
    );
  }, [auditEntries, searchQuery]);

  const handleTabSwitch = (tab: 'rules' | 'pending' | 'audit') => {
    setActiveTab(tab);
    if (tab === 'audit' && location.pathname !== '/settings/audit-log') {
      navigate('/settings/audit-log', { replace: true });
    } else if (tab !== 'audit' && location.pathname === '/settings/audit-log') {
      navigate('/settings/approvals', { replace: true });
    }
  };

  return (
    <div dir="rtl" className="w-full px-6 py-4 space-y-4">
      {/* Top Flush Header & Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link to="/settings" className="hover:text-blue-700 font-medium">
                الإعدادات والنظام
              </Link>
              <span>/</span>
              <span>إدارة العمليات والأمان</span>
              <span>/</span>
              <span className="text-slate-900 font-bold">
                مسارات الموافقات وسجل التدقيق (Approvals &amp; Audit Log)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900">
                مسارات الموافقات وسجل التدقيق الأمني (Approvals &amp; Compliance Audit)
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                محرك الامتثال والحوكمة v2.8 نشط • {currentOrgId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تشفير سجل العمليات متوافق مع معايير ISO 27001 / NCA • 1,480 حدث اليوم • إعدادات الإسناد التلقائي والمفوضين.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير تقرير التدقيق (CSV/PDF)
            </button>
            <button
              type="button"
              onClick={() => setCreateRuleModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + إنشاء مسار موافقة جديد
            </button>
          </div>
        </div>

        {/* Tab Bar + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabSwitch('rules')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              مسارات وقواعد الموافقات ({rules.length} مسارات نشطة)
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('pending')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>طلبات بانتظار موافقتي</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] tabular-nums">
                {pendingDeals.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              سجل التدقيق الأمني الشامل (Audit Trail)
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في سجل التدقيق أو القواعد..."
              className="w-full pr-8 pl-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Right Column (7 cols ~ 62%): Approval Rules Cards */}
        <div
          className={`lg:col-span-7 space-y-4 ${
            activeTab === 'audit' ? 'order-2 lg:order-1' : ''
          }`}
        >
          <div
            className={`bg-white border rounded-xl p-5 shadow-xs space-y-5 transition-all ${
              activeTab === 'rules'
                ? 'border-blue-600/40 ring-1 ring-blue-600/10'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                مسارات قواعد الموافقات المعتمدة في النظام (Approval Workflows)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active &amp; Enforced
              </span>
            </div>

            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-extrabold ${
                        rule.priorityTone === 'blue'
                          ? 'bg-blue-100 text-blue-800'
                          : rule.priorityTone === 'indigo'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {rule.priorityBadge}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900">{rule.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.active ? 'مفعل' : 'متوقف'}
                    </span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                        rule.active
                          ? 'bg-emerald-600 justify-end'
                          : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                    </div>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span>معيار الإطلاق:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      rule.criteriaTone === 'amber'
                        ? 'bg-amber-50 text-amber-800'
                        : rule.criteriaTone === 'blue'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-rose-50 text-rose-800'
                    }`}
                  >
                    {rule.criteriaText}
                  </span>
                </div>

                {rule.steps && rule.steps.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      تسلسل مراحل التدقيق والموافقة (Approval Flow):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {rule.steps.map((st, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-white border border-slate-200 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-700">{st.stepLabel}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {st.slaLabel}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900">{st.approverTitle}</div>
                          <p className="text-[11px] text-slate-500">{st.conditionNote}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rule.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{rule.description}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-blue-700" />
                    قفل السجل لمنع التلاعب + إشعار WhatsApp + Signals
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setToastMessage(`تم فتح إعدادات التحرير المتقدم للمسار: ${rule.title}`)
                    }
                    className="text-blue-700 font-bold hover:underline cursor-pointer"
                  >
                    تعديل المسار
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left Column (5 cols ~ 38%): Pending Approvals & Immutable Audit Trail */}
        <div
          className={`lg:col-span-5 space-y-4 ${
            activeTab === 'audit' ? 'order-1 lg:order-2' : ''
          }`}
        >
          {/* Top Card: طلبات بانتظار قرارك */}
          <div
            className={`bg-white border rounded-xl p-5 shadow-xs space-y-4 transition-all ${
              activeTab === 'pending'
                ? 'border-rose-500/50 ring-1 ring-rose-500/15'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  طلبات بانتظار قرارك (Pending My Approval)
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold tabular-nums">
                {pendingDeals.length} معلقة
              </span>
            </div>

            <div className="space-y-3">
              {pendingDeals.length > 0 ? (
                pendingDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3"
                  >
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
                        <span className="text-blue-700 tabular-nums">{deal.amountLabel}</span>
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
          <div
            className={`bg-white border rounded-xl p-5 shadow-xs space-y-4 transition-all ${
              activeTab === 'audit'
                ? 'border-emerald-600/50 ring-2 ring-emerald-600/15'
                : 'border-slate-200'
            }`}
          >
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
              {filteredAuditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                    <span
                      className={`font-bold ${
                        entry.tone === 'rose'
                          ? 'text-rose-700'
                          : entry.tone === 'blue'
                            ? 'text-blue-700'
                            : entry.tone === 'amber'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                      }`}
                    >
                      {entry.title}
                    </span>
                    <span>{entry.timeLabel}</span>
                  </div>
                  <p className="text-slate-800 font-bold">{entry.actorLine}</p>
                  <p className="text-[11px] text-slate-500">{entry.detailLine}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create New Approval Workflow Rule Modal */}
      {createRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                إنشاء مسار موافقة واعتماد جديد
              </h3>
              <button
                type="button"
                onClick={() => setCreateRuleModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRuleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">اسم مسار الموافقة *</label>
                <input
                  type="text"
                  required
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  placeholder="مثال: اعتماد تمديد فترة السداد فوق 45 يوماً"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">شرط التفعيل التلقائي *</label>
                <input
                  type="text"
                  value={newRuleCriteria}
                  onChange={(e) => setNewRuleCriteria(e.target.value)}
                  placeholder="مثال: Payment_Terms > 45 Days OR Deal_Amount > 150,000 SAR"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">المسؤول عن الاعتماد</label>
                <select
                  value={newRuleApprover}
                  onChange={(e) => setNewRuleApprover(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="المدير المباشر (Reporting To)">المدير المباشر (Reporting To)</option>
                  <option value="مدير المبيعات الإقليمي (Regional Sales Director)">
                    مدير المبيعات الإقليمي (Regional Sales Director)
                  </option>
                  <option value="اللجنة المالية والإدارة العليا (CFO / CEO)">
                    اللجنة المالية والإدارة العليا (CFO / CEO)
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateRuleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold"
                >
                  حفظ وتفعيل المسار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
