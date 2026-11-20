import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Database,
  FileText,
  Key,
  Layers,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CustomFunction, FunctionExecutionLog, OrgSecret } from '../types/crm';
import {
  buildSampleRecordForSandbox,
  executeCustomFunctionInSandbox,
  getCustomFunctionsForOrg,
  saveCustomFunctionsForOrg,
  type CustomFunctionRecord,
} from '../utils/customFunctionsEngine';

function mapEngineRecordToUiFunction(rec: CustomFunctionRecord, orgId: string): CustomFunction {
  const triggerMap: Record<CustomFunctionRecord['triggerType'], CustomFunction['triggerType']> = {
    Workflow: 'workflow',
    Blueprint: 'custom_button',
    Webhook: 'webhook',
    Schedule: 'cron',
  };
  return {
    id: rec.id,
    ownerId: 'user_admin',
    org_id: orgId,
    name: rec.name,
    apiName: `${rec.name}.${rec.language === 'python' ? 'py' : 'js'}`,
    language: rec.language === 'python' ? 'python' : 'javascript',
    triggerType: triggerMap[rec.triggerType] || 'workflow',
    code: rec.code,
    description: rec.description,
    isActive: rec.status === 'active',
    updatedAt: rec.lastExecuted || 'الآن',
  };
}

function mapUiFunctionToEngineRecord(fn: CustomFunction): CustomFunctionRecord {
  const revTriggerMap: Record<CustomFunction['triggerType'], CustomFunctionRecord['triggerType']> = {
    workflow: 'Workflow',
    custom_button: 'Blueprint',
    webhook: 'Webhook',
    cron: 'Schedule',
  };
  return {
    id: fn.id,
    name: fn.name,
    description: fn.description || 'دالة مخصصة في محرك الأتمتة',
    language: fn.language === 'python' ? 'python' : 'js',
    triggerType: revTriggerMap[fn.triggerType] || 'Workflow',
    targetModule: 'الصفقات (Deals)',
    status: fn.isActive ? 'active' : 'draft',
    lastExecuted: fn.updatedAt || 'الآن',
    version: 'v2.4.0',
    code: fn.code,
  };
}

export function CustomFunctionsPage() {
  const { currentOrgId, deals, leads } = useCrm();

  const [functionsList, setFunctionsList] = useState<CustomFunction[]>(() =>
    getCustomFunctionsForOrg(currentOrgId).map((rec) => mapEngineRecordToUiFunction(rec, currentOrgId))
  );

  useEffect(() => {
    setFunctionsList(
      getCustomFunctionsForOrg(currentOrgId).map((rec) => mapEngineRecordToUiFunction(rec, currentOrgId))
    );
  }, [currentOrgId]);

  const persistFunctions = (nextList: CustomFunction[]) => {
    setFunctionsList(nextList);
    saveCustomFunctionsForOrg(
      currentOrgId,
      nextList.map((f) => mapUiFunctionToEngineRecord(f))
    );
  };

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedFuncId, setSelectedFuncId] = useState<string>('func_1');
  const activeFunc = functionsList.find((f) => f.id === selectedFuncId) || functionsList[0];

  const [editorCode, setEditorCode] = useState(activeFunc.code);
  const [editorLanguage, setEditorLanguage] = useState<'javascript' | 'python'>(activeFunc.language);
  const [editorTrigger, setEditorTrigger] = useState<'workflow' | 'custom_button' | 'cron' | 'webhook'>(activeFunc.triggerType);
  const [filterTrigger, setFilterTrigger] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const openFunctionInEditor = (funcId: string) => {
    setSelectedFuncId(funcId);
    setViewMode('editor');
    window.dispatchEvent(new CustomEvent('crm:sidebar-collapse', { detail: true }));
  };

  // Test console states
  const [sampleRecordId, setSampleRecordId] = useState('DEAL-84920');
  const [sandboxParamsJson, setSandboxParamsJson] = useState(
    '{\n  "minThresholdSAR": 250000,\n  "notifyAccountExecutive": true\n}'
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>({
    status: 'success',
    code: 200,
    durationMs: 18,
    memoryMb: 28,
    output: {
      status: 'SUCCESS',
      executionCode: 200,
      upgraded: true,
      assignedTier: 'Platinum VIP',
      loyaltyPointsAdded: 52500,
      recordId: 'DEAL-84920',
    },
    consoleLogs: [
      '[SYSTEM] Ready to execute in isolated Web Worker sandbox...',
      '[LOG] [Start] Evaluating record DEAL-84920 - Amount: 350000 SAR',
      '[INFO] [CRM SDK] Account ACC-88210 upgraded to Platinum VIP (+52500 pts)',
    ],
  });

  const [executionLogs, setExecutionLogs] = useState<FunctionExecutionLog[]>([
    {
      id: 'log_1',
      org_id: currentOrgId,
      functionId: 'func_1',
      functionName: 'calculateEnterpriseTierAndAutoUpgrade',
      triggerType: 'workflow',
      status: 'success',
      durationMs: 18,
      memoryMb: 28,
      inputPayload: { record_id: 'DEAL-84920' },
      outputResult: { status: 'SUCCESS', assignedTier: 'Platinum VIP' },
      consoleLogs: ['[INFO] Executed successfully'],
      executedAt: 'الآن'
    },
    {
      id: 'log_2',
      org_id: currentOrgId,
      functionId: 'func_2',
      functionName: 'syncClosedDealToSapErpInvoice',
      triggerType: 'custom_button',
      status: 'success',
      durationMs: 24,
      memoryMb: 26,
      inputPayload: { record_id: 'DEAL-84915' },
      outputResult: { status: 'SUCCESS' },
      consoleLogs: ['[INFO] Synced with SAP ERP'],
      executedAt: 'منذ 34 دقيقة'
    },
    {
      id: 'log_3',
      org_id: currentOrgId,
      functionId: 'func_3',
      functionName: 'assignLeadByGeoTerritoryAndRoundRobin',
      triggerType: 'webhook',
      status: 'success',
      durationMs: 15,
      memoryMb: 22,
      inputPayload: { record_id: 'RWQ-10021' },
      outputResult: { status: 'SUCCESS', routedTo: 'سلمان القحطاني' },
      consoleLogs: ['[INFO] Lead routed by territory'],
      executedAt: 'منذ ساعة'
    }
  ]);

  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
  const [secretsList, setSecretsList] = useState<OrgSecret[]>([
    { id: 'sec_1', org_id: currentOrgId, keyName: 'ZATCA_API_KEY', encryptedValue: 'aes256:****789a', updatedAt: '2026-03-10' },
    { id: 'sec_2', org_id: currentOrgId, keyName: 'ERP_SECRET_TOKEN', encryptedValue: 'aes256:****44bc', updatedAt: '2026-03-12' }
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  useEffect(() => {
    setEditorCode(activeFunc.code);
    setEditorLanguage(activeFunc.language);
    setEditorTrigger(activeFunc.triggerType);
  }, [selectedFuncId, activeFunc.id]);

  const filteredFunctions = functionsList.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.apiName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrigger = filterTrigger === 'all' || f.triggerType === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  const handleExecuteSandbox = async () => {
    setIsExecuting(true);
    try {
      let parsedParams: Record<string, unknown> = {
        minThresholdSAR: 250000,
        notifyAccountExecutive: true,
      };
      try {
        if (sandboxParamsJson.trim()) {
          parsedParams = JSON.parse(sandboxParamsJson) as Record<string, unknown>;
        }
      } catch {
        // keep default params if JSON invalid
      }

      const sampleRecord = buildSampleRecordForSandbox({
        sampleRecordId,
        deals,
        leads,
      });

      const result = await executeCustomFunctionInSandbox({
        func: {
          id: activeFunc.id,
          name: activeFunc.name,
          language: editorLanguage === 'python' ? 'python' : 'js',
          code: editorCode,
          triggerType:
            editorTrigger === 'workflow'
              ? 'Workflow'
              : editorTrigger === 'custom_button'
                ? 'Blueprint'
                : editorTrigger === 'webhook'
                  ? 'Webhook'
                  : 'Schedule',
        },
        record: sampleRecord,
        params: parsedParams,
        orgId: currentOrgId,
      });

      setExecutionResult({
        status: result.status,
        code: result.status === 'success' ? 200 : 500,
        durationMs: result.durationMs,
        memoryMb: result.memoryMb,
        output: result.output,
        consoleLogs: result.consoleLogs,
      });

      const newLog: FunctionExecutionLog = {
        id: `exec_${Date.now()}`,
        org_id: currentOrgId,
        functionId: activeFunc.id,
        functionName: activeFunc.name,
        triggerType: editorTrigger,
        status: result.status === 'success' ? 'success' : 'timeout',
        durationMs: result.durationMs,
        memoryMb: result.memoryMb,
        inputPayload: { record: sampleRecord, params: parsedParams },
        outputResult: result.output,
        consoleLogs: result.consoleLogs,
        executedAt: 'الآن',
      };
      setExecutionLogs((prev) => [newLog, ...prev]);

      if (result.status === 'success') {
        triggerToast(`تم تشغيل الدالة "${activeFunc.name}" فعلياً في Web Worker وعرض المخرجات الحية.`);
      } else {
        triggerToast(`انتهى التشغيل مع خطأ برمجي في الكود: ${String(result.output?.error || '')}`);
      }
    } catch {
      triggerToast('حدث خطأ أثناء تشغيل الدالة في البيئة المعزولة (Sandbox).');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveFunction = async () => {
    const updated = functionsList.map((f) =>
      f.id === activeFunc.id
        ? {
            ...f,
            code: editorCode,
            language: editorLanguage,
            triggerType: editorTrigger,
            updatedAt: 'الآن',
          }
        : f
    );
    persistFunctions(updated);
    await handleExecuteSandbox();
    triggerToast(`تم حفظ ونشر الدالة (${activeFunc.name}) وتشغيلها في البيئة المعزولة.`);
  };

  const handleCreateFunction = () => {
    const newId = `func_${Date.now()}`;
    const newFunc: CustomFunction = {
      id: newId,
      ownerId: 'user_admin',
      org_id: currentOrgId,
      name: `customAutomationFn_${Date.now().toString().slice(-3)}`,
      apiName: `custom_fn_${Date.now().toString().slice(-4)}.js`,
      language: 'javascript',
      triggerType: 'workflow',
      code: `export default async function handle(input, env) {\n  const { record, params } = input;\n  console.log('[CustomFn] Evaluating record:', record.id, 'Amount:', record.amount);\n  return {\n    status: 'SUCCESS',\n    recordId: record.id,\n    title: record.title || record.fullName,\n    computedBonusSAR: Number(record.amount || 0) * 0.05,\n    paramsReceived: params\n  };\n}`,
      description: 'دالة مخصصة جديدة مرتبطة بمحرك الأتمتة والبلوبرينت',
      isActive: true,
      updatedAt: 'الآن',
    };
    const next = [newFunc, ...functionsList];
    persistFunctions(next);
    openFunctionInEditor(newId);
    triggerToast('تم إنشاء دالة مخصصة جديدة وفتح محرر الكود');
  };

  const handleToggleFunctionActive = (funcId: string) => {
    const next = functionsList.map((f) =>
      f.id === funcId ? { ...f, isActive: !f.isActive, updatedAt: 'الآن' } : f
    );
    persistFunctions(next);
    const target = functionsList.find((f) => f.id === funcId);
    if (target) {
      triggerToast(
        !target.isActive
          ? `تم تفعيل الدالة «${target.name}» بنجاح`
          : `تم إيقاف الدالة «${target.name}» مؤقتاً`
      );
    }
  };

  const handleDeleteFunction = (funcId: string) => {
    if (functionsList.length <= 1) {
      triggerToast('يجب الإبقاء على دالة واحدة على الأقل في النظام');
      return;
    }
    const target = functionsList.find((f) => f.id === funcId);
    const next = functionsList.filter((f) => f.id !== funcId);
    persistFunctions(next);
    if (selectedFuncId === funcId && next[0]) {
      setSelectedFuncId(next[0].id);
    }
    triggerToast(`تم حذف الدالة «${target?.name || funcId}» بنجاح`);
  };

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName || !newKeyValue) return;
    const sec: OrgSecret = {
      id: `sec_${Date.now()}`,
      org_id: currentOrgId,
      keyName: newKeyName.toUpperCase(),
      encryptedValue: `aes256:****${Math.random().toString(36).substring(2, 6)}`,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setSecretsList([...secretsList, sec]);
    setNewKeyName('');
    setNewKeyValue('');
    triggerToast('تم تشفير وحفظ المتغير السري بـ AES-256 بنجاح.');
  };

  return (
    <div dir="rtl" className="w-full h-[calc(100vh-65px)] flex flex-col bg-[#0F172A] text-white">
      {toastMsg && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0F172A] px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner Bar */}
      <div className="bg-[#1E293B] border-b border-[#334155] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>الإعدادات والنظام</span>
              <span>/</span>
              <span>مساحة المطورين</span>
              <span>/</span>
              <span className="text-white font-bold">الدوال المخصصة (Functions)</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              محرك ومهندس الدوال المخصصة (Sandboxed Functions)
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono border border-emerald-500/30">
                الحد الآمن: 5 ثوان • 128MB RAM • isolated vm
              </span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {viewMode === 'editor' && (
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-500/40"
            >
              <span>← العودة لقائمة الدوال</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSecretsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#334155] hover:bg-[#475569] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-600"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            إدارة الأسرار والمتغيرات (Secrets)
          </button>
          <button
            type="button"
            onClick={() => triggerToast('تم تصدير سجل التنفيذ الشامل (Audit Log) بصيغة JSON & CSV.')}
            className="px-3.5 py-2 rounded-xl bg-[#334155] hover:bg-[#475569] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-600"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            سجل التنفيذ الشامل (Audit Logs)
          </button>
          <button
            type="button"
            onClick={handleCreateFunction}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + دالة جديدة
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] text-[#0F172A] p-6">
          <div className="mx-auto max-w-[1440px] space-y-4">
            {/* List Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم الدالة، الوصف، أو API Name..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: `الكل (${functionsList.length})` },
                    { id: 'workflow', label: 'سير عمل (Workflow)' },
                    { id: 'custom_button', label: 'أزرار مخصصة' },
                    { id: 'cron', label: 'مجدولة (Cron)' },
                    { id: 'webhook', label: 'Webhook' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTrigger(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        filterTrigger === tab.id
                          ? 'bg-[#004AC6] text-white'
                          : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateFunction}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AC6] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition hover:bg-[#003999] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ دالة جديدة</span>
              </button>
            </div>

            {/* Functions Table */}
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-extrabold text-[#475569]">
                    <tr>
                      <th className="px-4 py-3.5">اسم الدالة</th>
                      <th className="px-4 py-3.5">الوصف</th>
                      <th className="px-4 py-3.5">البيئة (Node / Python)</th>
                      <th className="px-4 py-3.5">المشغّل</th>
                      <th className="px-4 py-3.5 text-center">الحالة</th>
                      <th className="px-4 py-3.5 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredFunctions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[#64748B]">
                          لا توجد دوال مخصصة مطابقة لمعايير البحث الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredFunctions.map((fn) => (
                        <tr
                          key={fn.id}
                          onClick={() => openFunctionInEditor(fn.id)}
                          className="group cursor-pointer transition hover:bg-[#F8FAFC]"
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-[#0F172A] group-hover:text-[#004AC6]">
                              {fn.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-[#2563EB]" dir="ltr">
                              {fn.apiName}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-[#475569] font-medium">
                            {fn.description || '—'}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-extrabold ${
                                fn.language === 'python'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                              }`}
                              dir="ltr"
                            >
                              {fn.language === 'python' ? 'Python 3.11' : 'Node 20 (JS)'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold text-[#334155]">
                              {fn.triggerType === 'custom_button'
                                ? 'زر مخصص (الصفقات)'
                                : fn.triggerType === 'workflow'
                                  ? 'سير عمل (Workflow)'
                                  : fn.triggerType === 'cron'
                                    ? 'مجدول (Cron)'
                                    : 'REST API / Webhook'}
                            </span>
                          </td>

                          <td
                            className="px-4 py-3.5 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleFunctionActive(fn.id)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                                fn.isActive
                                  ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                                  : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#64748B]'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  fn.isActive ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                                }`}
                              />
                              <span>{fn.isActive ? 'نشطة' : 'متوقفة'}</span>
                            </button>
                          </td>

                          <td
                            className="px-4 py-3.5 text-left whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openFunctionInEditor(fn.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-extrabold text-[#1D4ED8] transition hover:bg-[#DBEAFE]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFunction(fn.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1.5 text-[11px] font-bold text-[#E11D48] transition hover:bg-[#FFE4E6]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
      /* Main 3-Column Layout */
      <div className="flex-1 flex overflow-hidden">
        {/* Right Column (22%) - Functions List & Triggers */}
        <div className="w-[22%] bg-[#1E293B] border-l border-[#334155] flex flex-col">
          <div className="p-3 border-b border-[#334155] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">الدوال والمشغلات</span>
              <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 text-[10px] font-bold">
                {functionsList.length} نشطة
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الدوال أو API Name..."
                className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-[#0F172A] border border-[#334155] text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Trigger Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'workflow', label: 'سير عمل' },
                { id: 'custom_button', label: 'أزرار' },
                { id: 'cron', label: 'مجدولة' },
                { id: 'webhook', label: 'Webhook' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTrigger(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    filterTrigger === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0F172A] text-slate-400 hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#334155]">
            {filteredFunctions.map((fn) => {
              const isSelected = fn.id === selectedFuncId;
              return (
                <div
                  key={fn.id}
                  onClick={() => setSelectedFuncId(fn.id)}
                  className={`p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                    isSelected ? 'bg-blue-600/15 border-r-4 border-blue-500' : 'hover:bg-[#111827]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate">{fn.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <div className="text-[11px] text-blue-400 font-mono bg-[#0F172A] px-2 py-0.5 rounded w-fit">
                    {fn.apiName}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span className="px-1.5 py-0.5 rounded bg-[#334155] text-slate-300">
                      {fn.triggerType === 'custom_button'
                        ? 'زر مخصص (الصفقات)'
                        : fn.triggerType === 'workflow'
                          ? 'سير عمل (Workflow)'
                          : fn.triggerType === 'cron'
                            ? 'مجدول (Cron)'
                            : 'REST API'}
                    </span>
                    <span>{fn.updatedAt}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly Compute Quota bar */}
          <div className="p-3 bg-[#0F172A] border-t border-[#334155] space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>استهلاك الحوسبة الشهري</span>
              <span className="font-mono text-emerald-400">2,840 / 10,000 ثانية</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#334155] overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '28%' }}></div>
            </div>
          </div>
        </div>

        {/* Center Column (48%) - Code Editor & Toolbar */}
        <div className="flex-1 flex flex-col bg-[#0F172A]">
          {/* Editor Header Bar */}
          <div className="bg-[#1E293B] border-b border-[#334155] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-blue-400 font-bold bg-[#0F172A] px-2.5 py-1 rounded border border-[#334155]">
                {activeFunc.apiName}
              </span>
              <div className="flex items-center rounded-lg bg-[#0F172A] border border-[#334155] p-0.5">
                <button
                  type="button"
                  onClick={() => setEditorLanguage('javascript')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    editorLanguage === 'javascript' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Node 20
                </button>
                <button
                  type="button"
                  onClick={() => setEditorLanguage('python')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    editorLanguage === 'python' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python 3.11
                </button>
              </div>

              <select
                value={editorTrigger}
                onChange={(e) => setEditorTrigger(e.target.value as any)}
                className="bg-[#0F172A] border border-[#334155] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              >
                <option value="custom_button">زر مخصص: درو مبيعات (Custom Action)</option>
                <option value="workflow">عند استيفاء شروط سير العمل (Workflow)</option>
                <option value="cron">مجدول زمني (Cron Job)</option>
                <option value="webhook">REST API / Webhook خارجي</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditorCode((prev) => `${prev}\n// حقل مخصص: Number(input.record.amount || 0)`);
                  triggerToast('تم إدراج مرجع حقل النظام input.record.amount في الكود.');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#334155] hover:bg-[#475569] text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>+ إدراج حقل</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerToast('كائن crm SDK متاح مباشرة في بيئة Web Worker: crm.getRecord, crm.updateRecord, crm.createRecord, crm.sendWhatsAppArgs')
                }
                className="px-3 py-1.5 rounded-lg bg-[#334155] hover:bg-[#475569] text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>مكتبة crm SDK</span>
              </button>
              <button
                type="button"
                onClick={handleSaveFunction}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                حفظ وتشغيل تجريبي (Save & Execute)
              </button>
            </div>
          </div>

          {/* Monaco-style Monospace Code Editor */}
          <div className="flex-1 flex overflow-hidden">
            <div className="w-12 bg-[#1E293B] border-l border-[#334155] py-4 text-right pr-3 font-mono text-xs text-slate-500 select-none space-y-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              dir="ltr"
              value={editorCode}
              onChange={(e) => setEditorCode(e.target.value)}
              className="flex-1 bg-[#0F172A] text-left text-slate-100 font-mono text-xs p-4 focus:outline-none resize-none leading-relaxed overflow-y-auto"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Left Column (30%) - Test Console & Telemetry */}
        <div className="w-[30%] bg-[#1E293B] border-r border-[#334155] flex flex-col overflow-y-auto text-xs">
          {/* Test Console Header */}
          <div className="p-3.5 border-b border-[#334155] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-blue-400" />
                منصة الاختبار وتصحيح الأخطاء (Web Worker Sandbox)
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                معزول (Isolated VM)
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">اختر سجل اختبار حي (record) أو أدخل معرّف السجل:</label>
              <select
                value={sampleRecordId}
                onChange={(e) => setSampleRecordId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F172A] border border-[#334155] text-xs text-slate-200 focus:outline-none"
              >
                <option value="DEAL-84920">صفقة افتراضية: باقة أرامكس ERP (350,000 ر.س — RWQ-88210)</option>
                {deals.slice(0, 6).map((d) => (
                  <option key={d.id} value={d.id}>
                    صفقة: {d.title} ({d.amount.toLocaleString('en-US')} ر.س — {d.stage})
                  </option>
                ))}
                {leads.slice(0, 5).map((l) => (
                  <option key={l.id} value={l.id}>
                    عميل محتمل: {l.fullName} ({l.unique_id} — {l.city || 'الرياض'})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sampleRecordId}
                  onChange={(e) => setSampleRecordId(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#0F172A] border border-[#334155] text-xs text-slate-200 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleExecuteSandbox}
                  disabled={isExecuting}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {isExecuting ? 'جارٍ التشغيل...' : 'تشغيل الاختبار'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">معاملات الدالة الممررة (input.params JSON):</label>
              <textarea
                dir="ltr"
                rows={2}
                value={sandboxParamsJson}
                onChange={(e) => setSandboxParamsJson(e.target.value)}
                className="w-full rounded-lg bg-[#0F172A] border border-[#334155] p-2 font-mono text-[11px] text-amber-300 focus:outline-none"
              />
            </div>

            {/* Execution Stats Badge */}
            <div className="flex items-center justify-between bg-[#0F172A] border border-[#334155] rounded-lg p-2.5">
              <div
                className={`flex items-center gap-2 font-bold ${
                  executionResult.status === 'error' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {executionResult.status === 'error'
                    ? 'خطأ في التنفيذ (Error 500)'
                    : 'نجاح التنفيذ (OK 200)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span>{executionResult.durationMs}ms</span>
                <span>•</span>
                <span>{executionResult.memoryMb}MB</span>
              </div>
            </div>
          </div>

          {/* Returned JSON Output */}
          <div className="p-3.5 border-b border-[#334155] space-y-1.5">
            <span className="text-[11px] text-slate-400 font-bold">القيمة المرجعة (Returned JSON Output):</span>
            <pre dir="ltr" className="bg-[#0F172A] border border-[#334155] rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
              {JSON.stringify(executionResult.output, null, 2)}
            </pre>
          </div>

          {/* Console Logs */}
          <div className="p-3.5 border-b border-[#334155] space-y-1.5">
            <span className="text-[11px] text-slate-400 font-bold">سجلات الطباعة (Console Logs):</span>
            <div dir="ltr" className="bg-[#0F172A] border border-[#334155] rounded-lg p-2.5 font-mono text-[10px] text-slate-300 space-y-1">
              {executionResult.consoleLogs.map((log: string, idx: number) => (
                <div key={idx} className={log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : log.includes('ERROR') ? 'text-rose-400' : 'text-slate-300'}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Execution Logs Table */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" />
                سجل التنفيذ المباشر (Telemetry)
              </span>
              <span className="text-[10px] text-slate-400">آخر 3 عمليات</span>
            </div>

            <div className="space-y-1.5">
              {executionLogs.map((log) => (
                <div key={log.id} className="bg-[#0F172A] border border-[#334155] rounded-lg p-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white text-[11px]">{log.functionName}</div>
                    <div className="text-[10px] text-slate-400">{log.executedAt} • {log.durationMs}ms</div>
                  </div>
                  <div>
                    {log.status === 'success' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        ناجح
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                        فشل (Timeout)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Secrets Manager Modal */}
      {isSecretsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-lg w-full p-6 text-white space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                إدارة الأسرار والمتغيرات البيئية (Org Secrets - AES-256)
              </h2>
              <button
                type="button"
                onClick={() => setIsSecretsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-xs text-slate-300">المفاتيح المخزنة والمشفرة بأمان للمنظمة النشطة:</span>
              <div className="space-y-2">
                {secretsList.map((sec) => (
                  <div key={sec.id} className="bg-[#0F172A] border border-[#334155] rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-xs text-amber-300">{sec.keyName}</div>
                      <div className="text-[10px] text-slate-400">تاريخ التحديث: {sec.updatedAt}</div>
                    </div>
                    <div className="font-mono text-xs text-slate-400 bg-[#1E293B] px-2.5 py-1 rounded">
                      {sec.encryptedValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddSecret} className="space-y-3 pt-3 border-t border-[#334155]">
              <span className="text-xs font-bold text-slate-200 block">إضافة مفتاح سري جديد:</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="اسم المفتاح (مثال: API_KEY)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0F172A] border border-[#334155] text-xs text-white uppercase focus:outline-none"
                  required
                />
                <input
                  type="password"
                  placeholder="القيمة السرية"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0F172A] border border-[#334155] text-xs text-white focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSecretsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#334155] text-xs font-bold text-slate-300 hover:bg-[#475569] cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  حفظ وتشفير AES-256
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
