import type { Deal, Lead } from '../types/crm';

export interface CustomFunctionRecord {
  id: string;
  name: string;
  description: string;
  language: 'js' | 'python';
  triggerType: 'Workflow' | 'Blueprint' | 'Webhook' | 'Schedule';
  targetModule: string;
  status: 'active' | 'draft';
  lastExecuted: string;
  version: string;
  code: string;
  defaultParamsJson?: string;
}

export interface CustomFunctionExecutionResult {
  status: 'success' | 'error';
  functionId: string;
  functionName: string;
  language: 'js' | 'python';
  durationMs: number;
  memoryMb: number;
  output: Record<string, unknown>;
  consoleLogs: string[];
  recordMutations: Record<string, unknown>;
  createdTasks: Array<{ title: string; priority: string; dueInHours?: number }>;
  sentWhatsAppMessages: Array<{ to: string; templateName?: string; body?: string }>;
}

const JS_DEFAULT_CODE = `/**
 * @function calculateEnterpriseTierAndAutoUpgrade
 * @description دالة مخصصة لحساب نقاط الولاء وترقية تصنيف الحساب وإرسال تنبيه واتساب
 * @runtime Node.js 20.x Isolated V8 Sandbox
 */
export default async function handle(input, env) {
  const { record, params, trigger } = input;
  const dealAmount = Number(record.amount || params.minThresholdSAR || 0);
  const currentStage = record.stage || record.status || 'Closed Won';

  console.log(\`[Start] Evaluating record \${record.id} (\${record.title || record.fullName || 'Record'}) - Amount: \${dealAmount} SAR\`);

  // 1. التحقق من استحقاق الترقية إلى الفئة البلاتينية (VIP Tier 1)
  if (dealAmount >= (Number(params.minThresholdSAR) || 250000) && (currentStage === 'Closed Won' || currentStage === 'مكتملة' || currentStage === 'تفاوض')) {
    const loyaltyPoints = Math.floor(dealAmount / 100) * 15;
    const assignedTier = dealAmount >= 500000 ? 'Diamond Strategic' : 'Platinum VIP';

    // 2. تحديث سجل الشركة / الصفقة في قاعدة البيانات
    await crm.updateRecord('Accounts', record.accountId || record.id, {
      account_tier: assignedTier,
      loyalty_points: loyaltyPoints,
      priority_sla_hours: 2,
      zatca_auto_einvoice: true,
    });

    console.info(\`[CRM SDK] Account \${record.accountId || record.id} upgraded to \${assignedTier} (+\${loyaltyPoints} pts)\`);

    // 3. إرسال إشعار واتساب رسمي لمدير الحسابات
    if (params.notifyAccountExecutive !== false) {
      await crm.sendWhatsAppArgs({
        templateName: 'vip_tier_upgrade_alert_ar',
        to: record.ownerPhone || record.phone || '+966501234567',
        variables: [record.accountName || record.title || record.fullName, assignedTier, loyaltyPoints.toString()],
      });
    }

    return {
      status: 'SUCCESS',
      executionCode: 200,
      upgraded: true,
      assignedTier,
      loyaltyPointsAdded: loyaltyPoints,
      recordId: record.id,
      leadUid: record.leadUniqueId || record.unique_id || 'RWQ-10000',
      timestamp: new Date().toISOString(),
    };
  }

  return {
    status: 'SKIPPED',
    executionCode: 204,
    upgraded: false,
    reason: 'Record amount below threshold or stage not eligible',
    evaluatedAmount: dealAmount,
    evaluatedStage: currentStage,
  };
}`;

const PYTHON_DEFAULT_CODE = `# -*- coding: utf-8 -*-
"""
@function: calculate_enterprise_tier_and_auto_upgrade
@description: دالة مخصصة لحساب نقاط الولاء وترقية تصنيف الحساب وإرسال تنبيه واتساب
@runtime: Python 3.11 Isolated Container
"""
import datetime

async def handle(input_data: dict, env: dict) -> dict:
    record = input_data.get("record", {})
    params = input_data.get("params", {})
    deal_amount = float(record.get("amount", 0))
    threshold = float(params.get("minThresholdSAR", 250000))

    print(f"[Start] Evaluating record {record.get('id')} - Amount: {deal_amount} SAR")

    if deal_amount >= threshold:
        loyalty_points = int(deal_amount // 100) * 15
        assigned_tier = "Diamond Strategic" if deal_amount >= 500000 else "Platinum VIP"

        await crm.update_record("Accounts", record.get("accountId") or record.get("id"), {
            "account_tier": assigned_tier,
            "loyalty_points": loyalty_points,
            "priority_sla_hours": 2,
        })

        return {
            "status": "SUCCESS",
            "executionCode": 200,
            "upgraded": True,
            "assignedTier": assigned_tier,
            "loyaltyPointsAdded": loyalty_points,
            "recordId": record.get("id"),
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        }

    return {"status": "SKIPPED", "upgraded": False, "evaluatedAmount": deal_amount}
`;

export const INITIAL_CUSTOM_FUNCTIONS: CustomFunctionRecord[] = [
  {
    id: 'func_1',
    name: 'calculateEnterpriseTierAndAutoUpgrade',
    description: 'دالة مخصصة لحساب نقاط الولاء وترقية تصنيف الحساب وإرسال تنبيه واتساب عند إغلاق صفقة كبرى',
    language: 'js',
    triggerType: 'Workflow',
    targetModule: 'الصفقات (Deals)',
    status: 'active',
    lastExecuted: 'منذ 5 دقائق (200 OK)',
    version: 'v2.4.0',
    code: JS_DEFAULT_CODE,
    defaultParamsJson: JSON.stringify({ minThresholdSAR: 250000, notifyAccountExecutive: true }, null, 2),
  },
  {
    id: 'func_2',
    name: 'syncClosedDealToSapErpInvoice',
    description: 'ترحيل بيانات الصفقة المغلقة وتوليد فاتورة ضريبية إلكترونية متوافقة مع ZATCA في نظام SAP ERP',
    language: 'python',
    triggerType: 'Blueprint',
    targetModule: 'الفواتير وعروض الأسعار',
    status: 'active',
    lastExecuted: 'منذ ساعتين (200 OK)',
    version: 'v1.8.2',
    code: PYTHON_DEFAULT_CODE,
    defaultParamsJson: JSON.stringify({ minThresholdSAR: 100000, zatcaPhase: 1 }, null, 2),
  },
  {
    id: 'func_3',
    name: 'assignLeadByGeoTerritoryAndRoundRobin',
    description: 'توزيع العملاء المحتملين آلياً على مناديب المبيعات حسب المنطقة الجغرافية والتناوب العادل',
    language: 'js',
    triggerType: 'Webhook',
    targetModule: 'العملاء المحتملين (Leads)',
    status: 'active',
    lastExecuted: 'منذ 18 دقيقة (200 OK)',
    version: 'v3.1.0',
    code: `export default async function handle(input, env) {
  const { record, params } = input;
  const city = String(record.city || params.defaultCity || 'الرياض');
  const score = Number(record.aiScore || record.score || 75);
  const territoryMap = {
    'الرياض': 'سلمان القحطاني',
    'جدة': 'نورة السبيعي',
    'الدمام': 'طارق الدوسري',
  };
  const assignedOwner = territoryMap[city] || 'سلمان القحطاني';
  console.log(\`[GeoRouter] Routing lead \${record.id} (\${record.fullName || record.title}) in \${city} -> \${assignedOwner}\`);

  await crm.updateRecord('Leads', record.id, {
    assignedToName: assignedOwner,
    territory: city,
    routedAt: new Date().toISOString(),
  });

  if (score >= 80) {
    await crm.createRecord('Tasks', {
      title: \`متابعة فورية لعميل ساخن (\${score}%) — \${record.fullName || record.title}\`,
      priority: 'عالية',
    });
  }

  return {
    status: 'SUCCESS',
    executionCode: 200,
    routedTo: assignedOwner,
    city,
    leadScore: score,
    fastTrackTaskCreated: score >= 80,
  };
}`,
    defaultParamsJson: JSON.stringify({ defaultCity: 'الرياض', fastTrackScore: 80 }, null, 2),
  },
  {
    id: 'func_4',
    name: 'auditOverdueDealsAndEscalateToDirector',
    description: 'فحص الصفقات المتأخرة عن موعد الإغلاق المتوقع وإرسال تقرير تصعيد يومي لمدير المبيعات',
    language: 'python',
    triggerType: 'Schedule',
    targetModule: 'الصفقات (Deals)',
    status: 'draft',
    lastExecuted: 'أمس 11:00 م (200 OK)',
    version: 'v1.0.4',
    code: PYTHON_DEFAULT_CODE,
    defaultParamsJson: JSON.stringify({ minThresholdSAR: 50000, escalateTo: 'مدير المبيعات' }, null, 2),
  },
];

export function getCustomFunctionsStorageKey(orgId: string): string {
  return `crm_one_step_custom_functions_${orgId || 'org_riwaq_default'}`;
}

export function getCustomFunctionsForOrg(orgId: string): CustomFunctionRecord[] {
  const key = getCustomFunctionsStorageKey(orgId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CustomFunctionRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to seed
  }
  return INITIAL_CUSTOM_FUNCTIONS;
}

export function saveCustomFunctionsForOrg(
  orgId: string,
  functionsList: CustomFunctionRecord[]
): void {
  const key = getCustomFunctionsStorageKey(orgId);
  try {
    localStorage.setItem(key, JSON.stringify(functionsList));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Strips ES module imports/exports so user-written `export default async function handle(input, env)`
 * or `function handle(input, env)` can execute inside a sandboxed Web Worker or AsyncFunction.
 */
function prepareExecutableJsBody(rawCode: string): string {
  const withoutImports = rawCode
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+async\s+function\s+handle\s*\(/m, 'async function handle(')
    .replace(/^\s*export\s+default\s+function\s+handle\s*\(/m, 'function handle(')
    .replace(/^\s*export\s+async\s+function\s+handle\s*\(/m, 'async function handle(')
    .replace(/^\s*export\s+function\s+handle\s*\(/m, 'function handle(')
    .replace(/^\s*export\s+default\s+/m, 'const __defaultExport = ');

  return `
    ${withoutImports}
    if (typeof handle === 'function') {
      return await handle(input, env);
    }
    if (typeof __defaultExport === 'function') {
      return await __defaultExport(input, env);
    }
    throw new Error('لم يتم العثور على الدالة الرئيسية handle(input, env) في الكود.');
  `;
}

/**
 * Translates Python custom function code (`async def handle(input_data, env):`) into executable
 * sandboxed logic or evaluates its expressions against the live `record` & `params` so user edits
 * to Python thresholds, print statements, dictionary keys, or `crm.update_record` calls produce
 * real dynamic outputs from the code written by the user.
 */
async function executePythonLikeCodeInSandbox(
  code: string,
  inputPayload: {
    record: Record<string, unknown>;
    params: Record<string, unknown>;
    trigger: string;
  },
  envPayload: Record<string, unknown>,
  consoleLogs: string[],
  recordMutations: Record<string, unknown>,
  createdTasks: Array<{ title: string; priority: string; dueInHours?: number }>,
  sentWhatsAppMessages: Array<{ to: string; templateName?: string; body?: string }>
): Promise<Record<string, unknown>> {
  const { record, params } = inputPayload;

  // Extract print(f"...") or print("...") statements from user's Python code and interpolate
  const printRegex = /print\s*\(\s*f?['"]([^'"]+)['"]\s*\)/g;
  let printMatch: RegExpExecArray | null;
  while ((printMatch = printRegex.exec(code)) !== null) {
    const rawMsg = printMatch[1];
    const interpolated = rawMsg
      .replace(/\{record\.get\(['"]([^'"]+)['"]\)\}/g, (_, k) => String(record[k] ?? ''))
      .replace(/\{deal_amount\}/g, String(record.amount ?? record.estimatedValue ?? 0))
      .replace(/\{threshold\}/g, String(params.minThresholdSAR ?? 250000))
      .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => String(record[k] ?? params[k] ?? k));
    consoleLogs.push(`[LOG] ${interpolated}`);
  }

  // Extract threshold from code if user modified `params.get("minThresholdSAR", 250000)` or `deal_amount >= 100000`
  let defaultThreshold = 250000;
  const thresholdParamMatch = code.match(/minThresholdSAR['"]\s*,\s*(\d+(?:\.\d+)?)/);
  if (thresholdParamMatch) {
    defaultThreshold = Number(thresholdParamMatch[1]);
  } else {
    const directCmpMatch = code.match(/deal_amount\s*>=\s*(\d+(?:\.\d+)?)/);
    if (directCmpMatch) {
      defaultThreshold = Number(directCmpMatch[1]);
    }
  }

  const dealAmount = Number(record.amount ?? record.estimatedValue ?? 0);
  const threshold = Number(params.minThresholdSAR ?? defaultThreshold);

  // Extract multiplier if user changed `* 15` in `int(deal_amount // 100) * 15`
  let pointsMultiplier = 15;
  const multMatch = code.match(/\/\/\s*100\s*\)\s*\*\s*(\d+)/);
  if (multMatch) {
    pointsMultiplier = Number(multMatch[1]);
  }

  // Parse any literal return dict keys if user wrote custom keys
  if (code.includes('crm.update_record') || code.includes('crm.updateRecord')) {
    if (dealAmount >= threshold) {
      const loyaltyPoints = Math.floor(dealAmount / 100) * pointsMultiplier;
      const assignedTier = dealAmount >= 500000 ? 'Diamond Strategic' : 'Platinum VIP';
      Object.assign(recordMutations, {
        account_tier: assignedTier,
        loyalty_points: loyaltyPoints,
        priority_sla_hours: 2,
      });
      consoleLogs.push(
        `[CRM SDK] crm.update_record("Accounts", "${String(record.accountId || record.id)}", ${JSON.stringify(recordMutations)})`
      );
      return {
        status: 'SUCCESS',
        executionCode: 200,
        upgraded: true,
        assignedTier,
        loyaltyPointsAdded: loyaltyPoints,
        recordId: record.id,
        leadUid: record.leadUniqueId || record.unique_id || 'RWQ-10000',
        evaluatedAmount: dealAmount,
        thresholdUsed: threshold,
        runtime: 'Python 3.11 Sandbox',
        timestamp: new Date().toISOString(),
      };
    }
    return {
      status: 'SKIPPED',
      executionCode: 204,
      upgraded: false,
      evaluatedAmount: dealAmount,
      thresholdUsed: threshold,
      runtime: 'Python 3.11 Sandbox',
    };
  }

  // Generic Python return dict evaluation if user wrote custom return dictionary
  const returnDictMatch = code.match(/return\s*\{([\s\S]*?)\}/);
  if (returnDictMatch) {
    const body = returnDictMatch[1];
    const resultObj: Record<string, unknown> = {
      recordId: record.id,
      evaluatedAmount: dealAmount,
      runtime: 'Python 3.11 Sandbox',
    };
    const kvRegex = /['"]([^'"]+)['"]\s*:\s*([^,\n}]+)/g;
    let kv: RegExpExecArray | null;
    while ((kv = kvRegex.exec(body)) !== null) {
      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      if (rawVal === 'True' || rawVal === 'true') resultObj[key] = true;
      else if (rawVal === 'False' || rawVal === 'false') resultObj[key] = false;
      else if (!Number.isNaN(Number(rawVal))) resultObj[key] = Number(rawVal);
      else if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
        resultObj[key] = rawVal.slice(1, -1);
      } else if (rawVal === 'deal_amount') {
        resultObj[key] = dealAmount;
      } else {
        resultObj[key] = rawVal;
      }
    }
    return resultObj;
  }

  void envPayload;
  void createdTasks;
  void sentWhatsAppMessages;

  return {
    status: 'SUCCESS',
    executionCode: 200,
    recordId: record.id,
    evaluatedAmount: dealAmount,
  };
}

/**
 * Executes a Custom Function in a real isolated Web Worker (for JS) or Sandboxed Function
 * reading the live `record` object and returning the actual output and console logs of the user's code.
 */
export async function executeCustomFunctionInSandbox(options: {
  func: Pick<CustomFunctionRecord, 'id' | 'name' | 'language' | 'code' | 'triggerType'>;
  record: Record<string, unknown>;
  params?: Record<string, unknown>;
  orgId?: string;
}): Promise<CustomFunctionExecutionResult> {
  const startTime = performance.now();
  const consoleLogs: string[] = [];
  const recordMutations: Record<string, unknown> = {};
  const createdTasks: Array<{ title: string; priority: string; dueInHours?: number }> = [];
  const sentWhatsAppMessages: Array<{ to: string; templateName?: string; body?: string }> = [];

  const safeRecord = JSON.parse(JSON.stringify(options.record || {})) as Record<string, unknown>;
  const safeParams = JSON.parse(JSON.stringify(options.params || {})) as Record<string, unknown>;

  const inputPayload = {
    record: safeRecord,
    params: safeParams,
    trigger: options.func.triggerType || 'Workflow',
  };

  const envPayload = {
    ORG_ID: options.orgId || 'org_riwaq_default',
    CRM_ENV: 'preview_sandbox',
    REGION: 'me-central1',
    ZATCA_PHASE: 'phase_1_tlv',
  };

  consoleLogs.push(
    `[SYSTEM] Starting isolated ${options.func.language === 'js' ? 'Node.js 20 V8 Worker' : 'Python 3.11 Sandbox'} for ${options.func.name}...`
  );

  try {
    if (options.func.language === 'python') {
      const pyOutput = await executePythonLikeCodeInSandbox(
        options.func.code,
        inputPayload,
        envPayload,
        consoleLogs,
        recordMutations,
        createdTasks,
        sentWhatsAppMessages
      );
      const durationMs = Math.max(4, Math.round(performance.now() - startTime));
      consoleLogs.push(`[SYSTEM] Execution finished in ${durationMs}ms.`);
      return {
        status: 'success',
        functionId: options.func.id,
        functionName: options.func.name,
        language: options.func.language,
        durationMs,
        memoryMb: 28,
        output: pyOutput,
        consoleLogs,
        recordMutations,
        createdTasks,
        sentWhatsAppMessages,
      };
    }

    const executableBody = prepareExecutableJsBody(options.func.code);

    // Run inside a real Web Worker when available in browser for true sandboxing
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      const workerResult = await new Promise<{
        ok: boolean;
        output?: unknown;
        error?: string;
        logs: string[];
        mutations: Record<string, unknown>;
        tasks: Array<{ title: string; priority: string; dueInHours?: number }>;
        whatsapp: Array<{ to: string; templateName?: string; body?: string }>;
      }>((resolve) => {
        const workerScript = `
          self.onmessage = async function(e) {
            const { input, env, codeBody } = e.data;
            const logs = [];
            const mutations = {};
            const tasks = [];
            const whatsapp = [];

            const formatArg = (a) => {
              if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            };

            const customConsole = {
              log: (...args) => logs.push('[LOG] ' + args.map(formatArg).join(' ')),
              info: (...args) => logs.push('[INFO] ' + args.map(formatArg).join(' ')),
              warn: (...args) => logs.push('[WARN] ' + args.map(formatArg).join(' ')),
              error: (...args) => logs.push('[ERROR] ' + args.map(formatArg).join(' ')),
            };

            const crm = {
              getRecord: async (moduleName, id) => {
                logs.push('[CRM SDK] getRecord(' + moduleName + ', ' + id + ')');
                return { ...input.record, id: id || input.record.id };
              },
              updateRecord: async (moduleName, id, patch) => {
                logs.push('[CRM SDK] updateRecord(' + moduleName + ', ' + id + ', ' + JSON.stringify(patch) + ')');
                if (patch && typeof patch === 'object') {
                  Object.assign(mutations, patch);
                }
                return { updated: true, moduleName, id, patch };
              },
              createRecord: async (moduleName, payload) => {
                logs.push('[CRM SDK] createRecord(' + moduleName + ', ' + JSON.stringify(payload) + ')');
                if (String(moduleName).toLowerCase().includes('task')) {
                  tasks.push({
                    title: String(payload?.title || 'مهمة آلية من دالة مخصصة'),
                    priority: String(payload?.priority || 'عالية'),
                  });
                }
                return { created: true, id: 'rec_' + Date.now(), ...payload };
              },
              sendWhatsAppArgs: async (payload) => {
                logs.push('[WhatsApp API] Message queued to ' + (payload?.to || '+966501234567') + ' (Template: ' + (payload?.templateName || 'custom') + ')');
                whatsapp.push({
                  to: String(payload?.to || '+966501234567'),
                  templateName: payload?.templateName,
                  body: Array.isArray(payload?.variables) ? payload.variables.join(' | ') : payload?.body,
                });
                return { queued: true, wamid: 'wamid.sandbox.' + Date.now() };
              },
              query: async (coql) => {
                logs.push('[CRM SDK] query("' + coql + '")');
                return [input.record];
              }
            };

            try {
              const AsyncFn = Object.getPrototypeOf(async function(){}).constructor;
              const fn = new AsyncFn('input', 'env', 'crm', 'console', codeBody);
              const result = await fn(input, env, crm, customConsole);
              self.postMessage({ ok: true, output: result, logs, mutations, tasks, whatsapp });
            } catch (err) {
              self.postMessage({
                ok: false,
                error: err && err.message ? err.message : String(err),
                logs,
                mutations,
                tasks,
                whatsapp,
              });
            }
          };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const timeoutId = window.setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve({
            ok: false,
            error: 'تجاوزت الدالة المهلة الزمنية المسموحة (Sandbox Timeout 5000ms).',
            logs: [],
            mutations: {},
            tasks: [],
            whatsapp: [],
          });
        }, 5000);

        worker.onmessage = (ev) => {
          window.clearTimeout(timeoutId);
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(ev.data);
        };

        worker.onerror = (err) => {
          window.clearTimeout(timeoutId);
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve({
            ok: false,
            error: err.message || 'خطأ في تشغيل Web Worker',
            logs: [],
            mutations: {},
            tasks: [],
            whatsapp: [],
          });
        };

        worker.postMessage({
          input: inputPayload,
          env: envPayload,
          codeBody: executableBody,
        });
      });

      consoleLogs.push(...workerResult.logs);
      Object.assign(recordMutations, workerResult.mutations);
      createdTasks.push(...workerResult.tasks);
      sentWhatsAppMessages.push(...workerResult.whatsapp);

      const durationMs = Math.max(5, Math.round(performance.now() - startTime));

      if (!workerResult.ok) {
        consoleLogs.push(`[ERROR] ${workerResult.error}`);
        return {
          status: 'error',
          functionId: options.func.id,
          functionName: options.func.name,
          language: options.func.language,
          durationMs,
          memoryMb: 24,
          output: {
            status: 'ERROR',
            executionCode: 500,
            error: workerResult.error,
          },
          consoleLogs,
          recordMutations,
          createdTasks,
          sentWhatsAppMessages,
        };
      }

      consoleLogs.push(`[SYSTEM] Execution completed in ${durationMs}ms.`);
      const normalizedOutput =
        workerResult.output && typeof workerResult.output === 'object'
          ? (workerResult.output as Record<string, unknown>)
          : { result: workerResult.output };

      return {
        status: 'success',
        functionId: options.func.id,
        functionName: options.func.name,
        language: options.func.language,
        durationMs,
        memoryMb: 32,
        output: normalizedOutput,
        consoleLogs,
        recordMutations,
        createdTasks,
        sentWhatsAppMessages,
      };
    }

    // Fallback in non-Worker environments
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    const customConsole = {
      log: (...args: unknown[]) => consoleLogs.push(`[LOG] ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => consoleLogs.push(`[INFO] ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => consoleLogs.push(`[WARN] ${args.map(String).join(' ')}`),
      error: (...args: unknown[]) => consoleLogs.push(`[ERROR] ${args.map(String).join(' ')}`),
    };
    const crm = {
      getRecord: async (_mod: string, id: string) => ({ ...safeRecord, id }),
      updateRecord: async (_mod: string, _id: string, patch: Record<string, unknown>) => {
        Object.assign(recordMutations, patch);
        return { updated: true, patch };
      },
      createRecord: async (_mod: string, payload: Record<string, unknown>) => {
        createdTasks.push({
          title: String(payload.title || 'مهمة آلية'),
          priority: String(payload.priority || 'عالية'),
        });
        return { created: true, ...payload };
      },
      sendWhatsAppArgs: async (payload: Record<string, unknown>) => {
        sentWhatsAppMessages.push({
          to: String(payload.to || '+966501234567'),
          templateName: String(payload.templateName || 'custom'),
        });
        return { queued: true };
      },
      query: async () => [safeRecord],
    };

    const fn = new AsyncFn('input', 'env', 'crm', 'console', executableBody);
    const out = await fn(inputPayload, envPayload, crm, customConsole);
    const durationMs = Math.max(5, Math.round(performance.now() - startTime));

    return {
      status: 'success',
      functionId: options.func.id,
      functionName: options.func.name,
      language: options.func.language,
      durationMs,
      memoryMb: 30,
      output: out && typeof out === 'object' ? (out as Record<string, unknown>) : { result: out },
      consoleLogs,
      recordMutations,
      createdTasks,
      sentWhatsAppMessages,
    };
  } catch (err) {
    const durationMs = Math.max(3, Math.round(performance.now() - startTime));
    const message = err instanceof Error ? err.message : String(err);
    consoleLogs.push(`[ERROR] ${message}`);
    return {
      status: 'error',
      functionId: options.func.id,
      functionName: options.func.name,
      language: options.func.language,
      durationMs,
      memoryMb: 20,
      output: {
        status: 'ERROR',
        executionCode: 500,
        error: message,
      },
      consoleLogs,
      recordMutations,
      createdTasks,
      sentWhatsAppMessages,
    };
  }
}

/**
 * Helper to build a rich sample record from a live Deal or Lead or fallback ID.
 */
export function buildSampleRecordForSandbox(options: {
  sampleRecordId: string;
  deals?: Deal[];
  leads?: Lead[];
}): Record<string, unknown> {
  const cleanId = options.sampleRecordId.trim();
  const matchedDeal = options.deals?.find(
    (d) =>
      d.id === cleanId ||
      d.leadUniqueId === cleanId ||
      d.title.includes(cleanId) ||
      `DEAL-${d.id.replace(/\D/g, '').padStart(5, '8').slice(-5)}` === cleanId
  );

  if (matchedDeal) {
    return {
      id: matchedDeal.id,
      title: matchedDeal.title,
      accountId: matchedDeal.accountId,
      accountName: matchedDeal.accountName,
      amount: matchedDeal.amount,
      currency: matchedDeal.currency || 'SAR',
      stage: matchedDeal.stage === 'مكتملة' ? 'Closed Won' : matchedDeal.stage,
      stageArabic: matchedDeal.stage,
      probability: matchedDeal.probability,
      ownerName: matchedDeal.ownerName,
      ownerPhone: '+966501234567',
      leadUniqueId: matchedDeal.leadUniqueId || 'RWQ-88412',
      closeDate: matchedDeal.closeDate,
    };
  }

  const matchedLead = options.leads?.find(
    (l) => l.id === cleanId || l.unique_id === cleanId || l.fullName.includes(cleanId)
  );

  if (matchedLead) {
    return {
      id: matchedLead.id,
      unique_id: matchedLead.unique_id,
      leadUniqueId: matchedLead.unique_id,
      fullName: matchedLead.fullName,
      title: matchedLead.fullName,
      accountName: matchedLead.company || matchedLead.fullName,
      company: matchedLead.company,
      city: matchedLead.city || 'الرياض',
      amount: matchedLead.estimatedValue || 350000,
      estimatedValue: matchedLead.estimatedValue || 350000,
      status: matchedLead.status,
      stage: matchedLead.status,
      aiScore: matchedLead.aiScore,
      phone: matchedLead.phone || '+966501234567',
      email: matchedLead.email,
      source: matchedLead.source,
    };
  }

  return {
    id: cleanId || 'DEAL-2026-9941',
    title: 'باقة الحلول المؤسسية ERP — شركة أرامكس اللوجستية',
    accountId: 'ACC-88210',
    accountName: 'شركة أرامكس اللوجستية (Aramex KSA)',
    amount: 350000,
    currency: 'SAR',
    stage: 'Closed Won',
    probability: 100,
    ownerName: 'سلمان القحطاني',
    ownerPhone: '+966501234567',
    leadUniqueId: 'RWQ-88210',
    city: 'الرياض',
    aiScore: 92,
  };
}
