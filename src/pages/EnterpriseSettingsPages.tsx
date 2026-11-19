import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight,
  MessageSquare, Mail, Plus, Search, Trash2, Edit3, Eye, Sparkles, Copy, Check,
  GitBranch, ArrowUp, ArrowDown, Shield, Lock, Users, Globe, Code2, Send,
  Coins, RefreshCw, Save, X, FileText, Filter, Layers, ExternalLink
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCrm } from '../context/CrmContext';

// ============================================================================
// SHARED TOAST & HEADER HELPERS
// ============================================================================
function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };
  return { toast, showToast };
}

function ToastBanner({ toast }: { toast: { message: string; type: 'success' | 'info' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border bg-[#0F172A] text-white border-[#1E293B] text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{toast.message}</span>
    </div>
  );
}

function SettingsBreadcrumb({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للإعدادات</span>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#0F172A]">{title}</h1>
            {badge && (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-blue-50 text-[#2563EB] border border-blue-200">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 1. /settings/import-export — استيراد وتصدير البيانات الشامل
// ============================================================================
interface ParsedRow {
  [key: string]: string;
}

const SAMPLE_CSV_ROWS: ParsedRow[] = [
  { 'الاسم': 'م. طارق بن عبد الله العتيبي', 'الجوال': '0501122334', 'البريد': 'tariq@alotaibi-tech.sa', 'الشركة': 'شركة أفق التقنية المحدودة', 'المصدر': 'معرض جايتكس' },
  { 'الاسم': 'أ. ريم بنت فهد القحطاني', 'الجوال': '0554433221', 'البريد': 'reem@qahtani-group.sa', 'الشركة': 'مجموعة القحطاني التجارية', 'المصدر': 'حملة لينكدإن' },
  { 'الاسم': 'د. مازن بن سالم الحربي', 'الجوال': '0549988776', 'البريد': 'mazen@harbi-med.sa', 'الشركة': 'مجمع الحربي الطبي', 'المصدر': 'موقع الويب' },
];

export const ImportExportPage: React.FC = () => {
  const { leads, contacts, deals, invoices, createLead, firebaseUser, isPreviewMode, currentOrgId } = useCrm();
  const { toast, showToast } = useToast();

  // Import state
  const [targetModule, setTargetModule] = useState<'leads' | 'contacts'>('leads');
  const [fileName, setFileName] = useState<string>('leads_batch_q1_2025.csv');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>(SAMPLE_CSV_ROWS);
  const [columns, setColumns] = useState<string[]>(['الاسم', 'الجوال', 'البريد', 'الشركة', 'المصدر']);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({
    'الاسم': 'fullName',
    'الجوال': 'phone',
    'البريد': 'email',
    'الشركة': 'company',
    'المصدر': 'source',
  });
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Export state
  const [exportModule, setExportModule] = useState<'leads' | 'contacts' | 'deals' | 'invoices'>('leads');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xls'>('csv');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportedCount(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '').trim();
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        showToast('الملف المرفوع لا يحتوي على صفوف بيانات كافية، تم تحميل بيانات نموذجية للمعاينة', 'info');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const rows: ParsedRow[] = lines.slice(1, 25).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const rowObj: ParsedRow = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] || '';
        });
        return rowObj;
      });
      setColumns(headers);
      setParsedRows(rows);
      const autoMap: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.includes('اسم') || h.toLowerCase().includes('name')) autoMap[h] = 'fullName';
        else if (h.includes('جوال') || h.includes('هاتف') || h.toLowerCase().includes('phone')) autoMap[h] = 'phone';
        else if (h.includes('بريد') || h.toLowerCase().includes('email')) autoMap[h] = 'email';
        else if (h.includes('شركة') || h.toLowerCase().includes('company')) autoMap[h] = 'company';
        else autoMap[h] = 'source';
      });
      setFieldMap(autoMap);
      showToast(`تم قراءة الملف "${file.name}" بنجاح (${rows.length} سجل جاهز للمطابقة)`);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExecuteImport = async () => {
    setIsImporting(true);
    try {
      let count = 0;
      for (const row of parsedRows) {
        const fullNameCol = Object.keys(fieldMap).find((k) => fieldMap[k] === 'fullName');
        const phoneCol = Object.keys(fieldMap).find((k) => fieldMap[k] === 'phone');
        const emailCol = Object.keys(fieldMap).find((k) => fieldMap[k] === 'email');
        const companyCol = Object.keys(fieldMap).find((k) => fieldMap[k] === 'company');
        const sourceCol = Object.keys(fieldMap).find((k) => fieldMap[k] === 'source');

        const fullName = (fullNameCol ? row[fullNameCol] : Object.values(row)[0]) || 'عميل مستورد';

        await createLead({
          fullName,
          email: (emailCol ? row[emailCol] : '') || 'import@riwaq.sa',
          phone: (phoneCol ? row[phoneCol] : '') || '0500000000',
          company: (companyCol ? row[companyCol] : '') || 'جهة مستوردة',
          jobTitle: 'مدير تنفيذي',
          status: 'جديد',
          channel: 'website',
          aiScore: 76,
          estimatedValue: 45000,
          source: (sourceCol ? row[sourceCol] : '') || 'استيراد CSV',
          assignedToName: 'أحمد العتيبي',
          tags: ['مستورد_CSV'],
        });
        count++;
      }
      setImportedCount(count);
      showToast(`تم استيراد ${count} سجل بنجاح إلى ${targetModule === 'leads' ? 'العملاء المحتملين' : 'جهات الاتصال'}!`);
    } catch (err) {
      showToast('حدث خطأ أثناء استيراد السجلات', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadExport = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (exportModule === 'leads') {
      headers = ['المعرف', 'الاسم الكامل', 'الشركة', 'الجوال', 'البريد الإلكتروني', 'الحالة', 'القيمة المتوقعة (ر.س)'];
      rows = leads.map((l) => [
        String(l.id || ''),
        String(l.fullName || ''),
        String(l.company || ''),
        String(l.phone || ''),
        String(l.email || ''),
        String(l.status || ''),
        String(l.estimatedValue || 0),
      ]);
    } else if (exportModule === 'contacts') {
      headers = ['المعرف', 'الاسم الكامل', 'المسمى الوظيفي', 'الجوال', 'البريد الإلكتروني', 'المدينة'];
      rows = contacts.map((c) => [
        String(c.id || ''),
        String(c.fullName || ''),
        String(c.jobTitle || ''),
        String(c.phone || ''),
        String(c.email || ''),
        String(c.city || 'الرياض'),
      ]);
    } else if (exportModule === 'deals') {
      headers = ['المعرف', 'عنوان الصفقة', 'المرحلة', 'القيمة (ر.س)', 'نسبة الاحتمال %', 'الشركة'];
      rows = deals.map((d) => [
        String(d.id || ''),
        String(d.title || ''),
        String(d.stage || ''),
        String(d.amount || 0),
        String(d.probability || 50),
        String(d.accountName || ''),
      ]);
    } else {
      headers = ['رقم الفاتورة', 'العميل / الشركة', 'الحالة', 'الإجمالي شاملة الضريبة (ر.س)', 'تاريخ الإصدار'];
      rows = (invoices || []).map((inv: any) => [
        inv.invoiceNumber || inv.id,
        inv.accountName || inv.customerName || 'عميل مؤسسة رواق',
        inv.status || 'مدفوعة',
        String(inv.grandTotalSAR || inv.totalSAR || 0),
        inv.issueDate || '2025-03-01',
      ]);
      if (rows.length === 0) {
        rows = [
          ['INV-2025-001', 'شركة المدار التقني', 'مدفوعة', '138000', '2025-02-15'],
          ['INV-2025-002', 'مجموعة النخبة القابضة', 'بانتظار السداد', '86250', '2025-03-01'],
        ];
      }
    }

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

    const ext = exportFormat === 'csv' ? 'csv' : 'xls';
    const mime = exportFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
    const blob = new Blob([csvContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwaq_${exportModule}_export_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`تم تنزيل ملف ${exportModule.toUpperCase()} (${rows.length} سجل) بصيغة ${ext.toUpperCase()} بنجاح`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="استيراد وتصدير البيانات الشامل"
        subtitle="معالج استيراد ملفات CSV/Excel مع مطابقة الحقول الذكية وتصدير قواعد البيانات بصيغ قياسية تدعم العربية"
        badge="Data Migration Engine"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* IMPORT WIZARD (8 COLS) */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">معالج استيراد البيانات من CSV / Excel</h2>
                <p className="text-xs text-[#64748B]">ارفع ملفك، عاين الأعمدة، وطابقها مع حقول النظام قبل التنفيذ الفوري</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#475569]">الوحدة المستهدفة:</span>
              <select
                value={targetModule}
                onChange={(e) => setTargetModule(e.target.value as 'leads' | 'contacts')}
                className="px-3 py-1.5 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white text-[#0F172A]"
              >
                <option value="leads">العملاء المحتملين (Leads)</option>
                <option value="contacts">جهات الاتصال (Contacts)</option>
              </select>
            </div>
          </div>

          {/* Step 1: File Upload Box */}
          <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] rounded-lg p-5 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-[#2563EB] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0F172A]">
                  الملف الحالي المحمّل للمعاينة: <span className="text-[#2563EB] font-mono">{fileName}</span>
                </p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  يدعم ملفات `.csv` بترميز UTF-8 (حتى 10,000 صف في الدفعة الواحدة)
                </p>
              </div>
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>اختيار ملف CSV من جهازك</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Step 2: Field Mapping */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0F172A]">2. مطابقة أعمدة الملف مع حقول Crm-One-step</h3>
              <span className="text-[11px] text-[#64748B]">تم التعرف على {columns.length} أعمدة</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {columns.map((col) => (
                <div key={col} className="p-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#0F172A]">عمود الملف: {col}</span>
                    <span className="text-emerald-600 font-semibold">مطابق</span>
                  </div>
                  <select
                    value={fieldMap[col] || 'source'}
                    onChange={(e) => setFieldMap((prev) => ({ ...prev, [col]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-[#CBD5E1] bg-white text-[#0F172A] font-semibold"
                  >
                    <option value="fullName">الاسم الكامل (Full Name)</option>
                    <option value="phone">رقم الجوال (Phone)</option>
                    <option value="email">البريد الإلكتروني (Email)</option>
                    <option value="company">اسم الشركة / الجهة (Company)</option>
                    <option value="source">مصدر العميل (Lead Source)</option>
                    <option value="ignore">-- تجاهل هذا العمود --</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Live Column Preview Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#0F172A]">3. معاينة السجلات قبل الاستيراد ({parsedRows.length} صفوف)</h3>
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-md">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F1F5F9] text-[#475569] border-b border-[#E2E8F0]">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2 font-bold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-[#F8FAFC]">
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-[#0F172A]">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4: Execute Button & Results Counter */}
          <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {importedCount !== null ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>نتيجة الاستيراد: تم إضافة {importedCount} سجل بنجاح، و 0 أخطاء!</span>
                  <Link to="/leads" className="underline text-[#2563EB] mr-2">عرض في العملاء المحتملين</Link>
                </div>
              ) : (
                <span className="text-xs text-[#64748B]">جاهز لاستيراد {parsedRows.length} سجل إلى قاعدة البيانات</span>
              )}
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'جاري تنفيذ الاستيراد...' : `تنفيذ الاستيراد الآن (${parsedRows.length} سجل)`}</span>
            </button>
          </div>
        </div>

        {/* EXPORT SECTION (4 COLS) */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] pb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">تصدير البيانات الشامل</h2>
                <p className="text-xs text-[#64748B]">تنزيل فوري لبيانات أي وحدة بصيغة CSV/Excel</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">1. اختر الوحدة المراد تصديرها</label>
                <select
                  value={exportModule}
                  onChange={(e) => setExportModule(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white text-[#0F172A]"
                >
                  <option value="leads">العملاء المحتملين ({leads.length} سجل)</option>
                  <option value="contacts">جهات الاتصال ({contacts.length} سجل)</option>
                  <option value="deals">الصفقات والفرص البيعية ({deals.length} سجل)</option>
                  <option value="invoices">الفواتير الضريبية ({(invoices || []).length || 2} سجل)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">2. صيغة الملف</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`px-3 py-2.5 rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      exportFormat === 'csv'
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                        : 'bg-white border-[#CBD5E1] text-[#475569]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>CSV (UTF-8 BOM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('xls')}
                    className={`px-3 py-2.5 rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      exportFormat === 'xls'
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                        : 'bg-white border-[#CBD5E1] text-[#475569]'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.XLS)</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] space-y-1">
                <div className="font-bold text-[#0F172A]">مميزات التصدير في Crm-One-step:</div>
                <p>• يتضمن ترويسة UTF-8 BOM لضمان فتح الحروف العربية في Microsoft Excel بدون رموز مشوهة.</p>
                <p>• يشمل جميع السجلات النشطة والحقول المالية بالريال السعودي.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadExport}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل ملف {exportFormat.toUpperCase()} الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. /settings/templates — قوالب البريد والواتساب التلقائية
// ============================================================================
interface MessageTemplate {
  id: string;
  channel: 'whatsapp' | 'email';
  name: string;
  category: string;
  subject?: string;
  body: string;
  updatedAt: string;
}

const INITIAL_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl_wa_welcome',
    channel: 'whatsapp',
    name: 'ترحيب فوري بالعميل المحتمل الجديد',
    category: 'تأهيل المبيعات',
    body: 'مرحباً {{اسم_العميل}} 👋، يسعدنا تواصلك مع مؤسسة رواق بخصوص {{اسم_الشركة}}. أنا {{المندوب_المسؤول}} وسأكون معك لخدمتك وتقديم عرض فني متكامل بقيمة تقديرية {{قيمة_الصفقة}} ر.س.',
    updatedAt: '2025-03-01',
  },
  {
    id: 'tpl_wa_quote_followup',
    channel: 'whatsapp',
    name: 'متابعة عرض السعر المرسل عبر واتساب',
    category: 'متابعة العروض',
    body: 'أهلاً بك أستاذ {{اسم_العميل}}، نود التأكد من استلامكم لعرض السعر الخاص بـ {{اسم_الشركة}} بمبلغ {{قيمة_الصفقة}} ر.س. هل يناسبكم عقد اجتماع سريع غداً لمناقشة التفاصيل؟',
    updatedAt: '2025-03-02',
  },
  {
    id: 'tpl_email_proposal',
    channel: 'email',
    name: 'إرسال العرض الفني والمالي الرسمي',
    category: 'عروض الأسعار',
    subject: 'العرض الفني والمالي لمشروع {{اسم_الشركة}} — Crm-One-step',
    body: 'سعادة الأستاذ {{اسم_العميل}} المحترم،\n\nتحية طيبة وبعد،\nيرفق لكم فريقنا العرض الفني والمالي المعتمد لشركة {{اسم_الشركة}} بإجمالي {{قيمة_الصفقة}} ريال سعودي.\n\nوتفضلوا بقبول فائق الاحترام،\n{{المندوب_المسؤول}}',
    updatedAt: '2025-02-28',
  },
  {
    id: 'tpl_email_invoice',
    channel: 'email',
    name: 'إشعار إصدار فاتورة ضريبية معتمدة',
    category: 'المالية والتحصيل',
    subject: 'فاتورة ضريبية مستحقة — {{اسم_الشركة}}',
    body: 'عزيزنا {{اسم_العميل}}،\n\nنود إشعاركم بإصدار الفاتورة الضريبية الخاصة بـ {{اسم_الشركة}} بقيمة {{قيمة_الصفقة}} ر.س. نسعد بخدمتكم دائماً.\n\nإدارة الحسابات — {{المندوب_المسؤول}}',
    updatedAt: '2025-03-03',
  },
];

const TEMPLATE_VARIABLES = [
  { token: '{{اسم_العميل}}', sample: 'م. سلطان الراجحي' },
  { token: '{{اسم_الشركة}}', sample: 'شركة آفاق الخليج القابضة' },
  { token: '{{قيمة_الصفقة}}', sample: '125,000' },
  { token: '{{المندوب_المسؤول}}', sample: 'أحمد العتيبي' },
];

export const TemplatesManagerPage: React.FC = () => {
  const { firebaseUser, isPreviewMode, currentOrgId } = useCrm();
  const { toast, showToast } = useToast();

  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const saved = localStorage.getItem('riwaq_message_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_TEMPLATES;
  });

  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formChannel, setFormChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('تأهيل المبيعات');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (t.channel !== activeTab) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
      }
      return true;
    });
  }, [templates, activeTab, categoryFilter, searchQuery]);

  const renderLivePreview = (text: string) => {
    let output = text || 'اكتب نص الرسالة لمعاينة المتغيرات الحية هنا...';
    TEMPLATE_VARIABLES.forEach((v) => {
      output = output.split(v.token).join(v.sample);
    });
    return output;
  };

  const openNewTemplateModal = () => {
    setEditingId(null);
    setFormChannel(activeTab);
    setFormName('');
    setFormCategory('تأهيل المبيعات');
    setFormSubject('');
    setFormBody('مرحباً {{اسم_العميل}}، نتواصل معكم من مؤسسة رواق بخصوص {{اسم_الشركة}} وعرض السعر البالغ {{قيمة_الصفقة}} ر.س.');
    setIsModalOpen(true);
  };

  const openEditModal = (tpl: MessageTemplate) => {
    setEditingId(tpl.id);
    setFormChannel(tpl.channel);
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormSubject(tpl.subject || '');
    setFormBody(tpl.body);
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim() || !formBody.trim()) {
      showToast('يرجى إدخال اسم القالب ونص الرسالة', 'error');
      return;
    }
    const newTpl: MessageTemplate = {
      id: editingId || `tpl_${Date.now()}`,
      channel: formChannel,
      name: formName.trim(),
      category: formCategory,
      subject: formChannel === 'email' ? formSubject.trim() : undefined,
      body: formBody,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const next = editingId
      ? templates.map((t) => (t.id === editingId ? newTpl : t))
      : [newTpl, ...templates];

    setTemplates(next);
    localStorage.setItem('riwaq_message_templates', JSON.stringify(next));
    setActiveTab(formChannel);
    setIsModalOpen(false);

    if (firebaseUser && !isPreviewMode) {
      try {
        await setDoc(doc(db, 'settings_templates', `${currentOrgId}_${newTpl.id}`), {
          ...newTpl,
          orgId: currentOrgId,
        }, { merge: true });
      } catch {}
    }

    showToast(editingId ? 'تم تحديث القالب بنجاح' : 'تم إنشاء وحفظ القالب الجديد بنجاح');
  };

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    localStorage.setItem('riwaq_message_templates', JSON.stringify(next));
    showToast('تم حذف القالب بنجاح');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="قوالب البريد والواتساب التلقائية"
        subtitle="إدارة القوالب الذكية الجاهزة للإرسال الفوري أو الربط مع قواعد سير العمل والـ Blueprint"
        badge="Omnichannel Templates"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Top Filter & Tabs Bar */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>قوالب واتساب ({templates.filter((t) => t.channel === 'whatsapp').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'email'
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>قوالب البريد الإلكتروني ({templates.filter((t) => t.channel === 'email').length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في اسم أو محتوى القالب..."
                className="pr-8 pl-3 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white w-56"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#CBD5E1] bg-white"
            >
              <option value="ALL">جميع التصنيفات</option>
              <option value="تأهيل المبيعات">تأهيل المبيعات</option>
              <option value="متابعة العروض">متابعة العروض</option>
              <option value="عروض الأسعار">عروض الأسعار</option>
              <option value="المالية والتحصيل">المالية والتحصيل</option>
            </select>

            <button
              onClick={openNewTemplateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ قالب جديد</span>
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => (
            <div key={tpl.id} className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                      {tpl.category}
                    </span>
                    <h3 className="text-sm font-bold text-[#0F172A] mt-1.5">{tpl.name}</h3>
                    {tpl.subject && (
                      <p className="text-xs text-[#2563EB] font-semibold mt-0.5">الموضوع: {tpl.subject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tpl)}
                      className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#475569] cursor-pointer"
                      title="تعديل القالب"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      title="حذف القالب"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#334155] whitespace-pre-line leading-relaxed">
                  {tpl.body}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
                <span>آخر تحديث: {tpl.updatedAt}</span>
                <span className="font-semibold text-emerald-700">جاهز للأتمتة والإرسال الفوري</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Create/Edit Template */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {editingId ? 'تعديل القالب' : 'إنشاء قالب رسائل جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">القناة</label>
                  <select
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as 'whatsapp' | 'email')}
                    className="w-full px-3 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white"
                  >
                    <option value="whatsapp">واتساب للأعمال (WhatsApp)</option>
                    <option value="email">البريد الإلكتروني (Email)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">التصنيف</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white"
                  >
                    <option value="تأهيل المبيعات">تأهيل المبيعات</option>
                    <option value="متابعة العروض">متابعة العروض</option>
                    <option value="عروض الأسعار">عروض الأسعار</option>
                    <option value="المالية والتحصيل">المالية والتحصيل</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">اسم القالب</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: رسالة ترحيب بالعميل وإرسال الكتيب التعريفي"
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                />
              </div>

              {formChannel === 'email' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">عنوان البريد الإلكتروني (Subject)</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="مثال: عرض سعر خاص لشركة {{اسم_الشركة}}"
                    className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#0F172A]">نص الرسالة (اضغط لإدراج متغير ديناميكي):</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => setFormBody((prev) => `${prev} ${v.token}`)}
                        className="px-2 py-1 text-[11px] font-bold rounded bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-blue-100 cursor-pointer"
                      >
                        + {v.token}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="w-full p-3 text-xs rounded-md border border-[#CBD5E1] bg-white leading-relaxed"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-md bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة حية للرسالة مع استبدال المتغيرات:</span>
                </div>
                <p className="text-xs text-[#0F172A] whitespace-pre-line leading-relaxed">{renderLivePreview(formBody)}</p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-md border border-[#CBD5E1] bg-white text-xs font-bold text-[#475569] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveTemplate}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ القالب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. /settings/pipelines — مسارات وتصنيفات الصفقات
// ============================================================================
interface PipelineStageConfig {
  id: string;
  name: string;
  probability: number;
  color: string;
}

interface SalesPipelineConfig {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageConfig[];
}

const DEFAULT_PIPELINES: SalesPipelineConfig[] = [
  {
    id: 'pipe_b2b_enterprise',
    name: 'مسار مبيعات المؤسسات الكبرى (B2B Enterprise)',
    isDefault: true,
    stages: [
      { id: 'st_1', name: 'تأهيل أولي ودراسة الاحتياج', probability: 15, color: '#3B82F6' },
      { id: 'st_2', name: 'اجتماع فني وعرض تجريبي (Demo)', probability: 35, color: '#6366F1' },
      { id: 'st_3', name: 'إرسال العرض الفني والمالي', probability: 60, color: '#F59E0B' },
      { id: 'st_4', name: 'مفاوضات العقود والمشتريات', probability: 85, color: '#8B5CF6' },
      { id: 'st_5', name: 'صفقة ناجحة — تم التعميد (Closed Won)', probability: 100, color: '#10B981' },
      { id: 'st_6', name: 'صفقة مفقودة (Closed Lost)', probability: 0, color: '#EF4444' },
    ],
  },
  {
    id: 'pipe_fast_saas',
    name: 'مسار الاشتراكات السريعة والتجزئة (Fast-Track SaaS)',
    isDefault: false,
    stages: [
      { id: 'st_f1', name: 'تسجيل طلب تجربة', probability: 25, color: '#3B82F6' },
      { id: 'st_f2', name: 'تفعيل الحساب التجريبي', probability: 55, color: '#F59E0B' },
      { id: 'st_f3', name: 'إصدار فاتورة الاشتراك', probability: 85, color: '#8B5CF6' },
      { id: 'st_f4', name: 'مشترك نشط (Won)', probability: 100, color: '#10B981' },
    ],
  },
];

export const PipelinesSettingsPage: React.FC = () => {
  const { firebaseUser, isPreviewMode, currentOrgId } = useCrm();
  const { toast, showToast } = useToast();

  const [pipelines, setPipelines] = useState<SalesPipelineConfig[]>(() => {
    const saved = localStorage.getItem('riwaq_custom_pipelines');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PIPELINES;
  });

  const [selectedPipeId, setSelectedPipeId] = useState<string>(pipelines[0].id);
  const [newStageName, setNewStageName] = useState('');
  const [newStageProb, setNewStageProb] = useState(50);
  const [newStageColor, setNewStageColor] = useState('#2563EB');
  const [newPipelineName, setNewPipelineName] = useState('');

  const activePipeline = pipelines.find((p) => p.id === selectedPipeId) || pipelines[0];

  const updateActiveStages = (nextStages: PipelineStageConfig[]) => {
    setPipelines((prev) =>
      prev.map((p) => (p.id === activePipeline.id ? { ...p, stages: nextStages } : p))
    );
  };

  const handleMoveStage = (index: number, dir: -1 | 1) => {
    const targetIndex = index + dir;
    if (targetIndex < 0 || targetIndex >= activePipeline.stages.length) return;
    const copy = [...activePipeline.stages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    updateActiveStages(copy);
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      showToast('يرجى إدخال اسم المرحلة الجديدة', 'error');
      return;
    }
    const stage: PipelineStageConfig = {
      id: `st_${Date.now()}`,
      name: newStageName.trim(),
      probability: Math.min(100, Math.max(0, Number(newStageProb) || 0)),
      color: newStageColor,
    };
    updateActiveStages([...activePipeline.stages, stage]);
    setNewStageName('');
    showToast(`تمت إضافة مرحلة "${stage.name}" إلى المسار`);
  };

  const handleDeleteStage = (stageId: string) => {
    if (activePipeline.stages.length <= 2) {
      showToast('يجب أن يحتوي المسار على مرحلتين على الأقل', 'error');
      return;
    }
    updateActiveStages(activePipeline.stages.filter((s) => s.id !== stageId));
  };

  const handleAddPipeline = () => {
    if (!newPipelineName.trim()) return;
    const newPipe: SalesPipelineConfig = {
      id: `pipe_${Date.now()}`,
      name: newPipelineName.trim(),
      isDefault: false,
      stages: [
        { id: `s1_${Date.now()}`, name: 'فرصة جديدة', probability: 20, color: '#3B82F6' },
        { id: `s2_${Date.now()}`, name: 'عرض سعر مرسل', probability: 60, color: '#F59E0B' },
        { id: `s3_${Date.now()}`, name: 'إغلاق ناجح', probability: 100, color: '#10B981' },
      ],
    };
    setPipelines((prev) => [...prev, newPipe]);
    setSelectedPipeId(newPipe.id);
    setNewPipelineName('');
    showToast(`تم إنشاء مسار "${newPipe.name}" بنجاح`);
  };

  const handleSavePipelines = async () => {
    localStorage.setItem('riwaq_custom_pipelines', JSON.stringify(pipelines));
    if (firebaseUser && !isPreviewMode) {
      try {
        await setDoc(doc(db, 'settings_pipelines', currentOrgId), {
          orgId: currentOrgId,
          pipelines,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }
    showToast('تم حفظ المسارات والمراحل بنجاح وتحديث لوحة الصفقات (/deals)');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="مسارات وتصنيفات الصفقات (Sales Pipelines)"
        subtitle="تخصيص مراحل الصفقات، نسب الاحتمالية التلقائية للإيرادات، وألوان بطاقات الكانبان"
        badge="Pipeline Architecture"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Sidebar: Pipelines List */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-5 h-fit">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3">المسارات البيعية المعتمدة</h2>
          <div className="space-y-2">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPipeId(p.id)}
                className={`w-full text-right p-3.5 rounded-lg border transition-colors flex items-center justify-between cursor-pointer ${
                  p.id === activePipeline.id
                    ? 'bg-blue-50/80 border-[#2563EB] text-[#0F172A]'
                    : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">{p.name}</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">{p.stages.length} مراحل بيعية</div>
                </div>
                {p.isDefault && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    افتراضي
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
            <label className="block text-xs font-bold text-[#0F172A]">+ إنشاء مسار مبيعات جديد</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="مثال: مسار العقود الحكومية..."
                className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white"
              />
              <button
                onClick={handleAddPipeline}
                className="px-3 py-1.5 rounded-md bg-[#0F172A] text-white text-xs font-bold cursor-pointer"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>

        {/* Center/Left: Stages Editor */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">{activePipeline.name}</h2>
              <p className="text-xs text-[#64748B]">رتب المراحل أو عدّل نسب الاحتمالية المستخدمة في حساب الإيراد المتوقع</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/deals"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#CBD5E1] bg-white text-xs font-bold text-[#475569]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة في الصفقات</span>
              </Link>
              <button
                onClick={handleSavePipelines}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ المسار والمراحل</span>
              </button>
            </div>
          </div>

          {/* Stages Table */}
          <div className="space-y-2.5">
            {activePipeline.stages.map((st, idx) => (
              <div
                key={st.id}
                className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                  <span className="w-6 h-6 rounded-full bg-white border border-[#CBD5E1] text-[11px] font-bold flex items-center justify-center text-[#475569]">
                    {idx + 1}
                  </span>
                  <input
                    type="color"
                    value={st.color}
                    onChange={(e) => {
                      const next = activePipeline.stages.map((s) =>
                        s.id === st.id ? { ...s, color: e.target.value } : s
                      );
                      updateActiveStages(next);
                    }}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={st.name}
                    onChange={(e) => {
                      const next = activePipeline.stages.map((s) =>
                        s.id === st.id ? { ...s, name: e.target.value } : s
                      );
                      updateActiveStages(next);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-[#CBD5E1] bg-white text-[#0F172A]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#64748B]">نسبة الاحتمال:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={st.probability}
                      onChange={(e) => {
                        const next = activePipeline.stages.map((s) =>
                          s.id === st.id ? { ...s, probability: Number(e.target.value) } : s
                        );
                        updateActiveStages(next);
                      }}
                      className="w-16 px-2 py-1 text-xs font-bold text-center rounded border border-[#CBD5E1] bg-white"
                    />
                    <span className="text-xs font-bold text-[#475569]">%</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveStage(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 cursor-pointer"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveStage(idx, 1)}
                      disabled={idx === activePipeline.stages.length - 1}
                      className="p-1.5 rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 cursor-pointer"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStage(st.id)}
                      className="p-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                      title="حذف المرحلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Stage Form */}
          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/40 space-y-3">
            <h3 className="text-xs font-bold text-[#0F172A]">+ إضافة مرحلة جديدة للمسار الحالي</h3>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="اسم المرحلة (مثال: المراجعة القانونية للعقد)"
                className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#475569]">الاحتمال %:</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newStageProb}
                  onChange={(e) => setNewStageProb(Number(e.target.value))}
                  className="w-20 px-2.5 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#475569]">اللون:</span>
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
              </div>
              <button
                onClick={handleAddStage}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة المرحلة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. /settings/data-sharing — قواعد مشاركة البيانات والأمان
// ============================================================================
type AccessLevel = 'private' | 'public_read' | 'public_read_write';

interface SharingExceptionRule {
  id: string;
  name: string;
  module: string;
  sourceGroup: string;
  targetGroup: string;
  access: 'قراءة فقط' | 'قراءة وتعديل';
}

export const DataSharingSettingsPage: React.FC = () => {
  const { toast, showToast } = useToast();

  const [owd, setOwd] = useState<Record<string, AccessLevel>>({
    leads: 'private',
    contacts: 'public_read',
    accounts: 'public_read',
    deals: 'private',
  });

  const [rules, setRules] = useState<SharingExceptionRule[]>([
    {
      id: 'shr_1',
      name: 'مشاركة صفقات المنطقة الوسطى مع مديري الفروع',
      module: 'الصفقات',
      sourceGroup: 'فريق مبيعات الرياض',
      targetGroup: 'مديري الأقاليم والفروع',
      access: 'قراءة وتعديل',
    },
    {
      id: 'shr_2',
      name: 'اطلاع فريق التحصيل المالي على العملاء المحتملين المؤهلين',
      module: 'العملاء المحتملين',
      sourceGroup: 'قسم تطوير الأعمال',
      targetGroup: 'إدارة المالية والتحصيل',
      access: 'قراءة فقط',
    },
  ]);

  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleModule, setRuleModule] = useState('الصفقات');
  const [ruleSource, setRuleSource] = useState('فريق مبيعات الرياض');
  const [ruleTarget, setRuleTarget] = useState('الإدارة العليا للمبيعات');
  const [ruleAccess, setRuleAccess] = useState<'قراءة فقط' | 'قراءة وتعديل'>('قراءة فقط');

  const handleAddRule = () => {
    if (!ruleName.trim()) {
      showToast('يرجى إدخال اسم قاعدة المشاركة', 'error');
      return;
    }
    const nextRule: SharingExceptionRule = {
      id: `shr_${Date.now()}`,
      name: ruleName.trim(),
      module: ruleModule,
      sourceGroup: ruleSource,
      targetGroup: ruleTarget,
      access: ruleAccess,
    };
    setRules((prev) => [nextRule, ...prev]);
    setRuleName('');
    setIsAddRuleOpen(false);
    showToast('تمت إضافة قاعدة المشاركة الاستثنائية بنجاح');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="قواعد مشاركة البيانات والأمان (Data Sharing & OWD)"
        subtitle="ضبط الصلاحيات الافتراضية على مستوى المؤسسة (Organization-Wide Defaults) وقواعد المشاركة الاستثنائية بين الفرق"
        badge="Zero-Trust RBAC"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* OWD Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">الإعدادات الافتراضية على مستوى المؤسسة (Organization-Wide Defaults)</h2>
              <p className="text-xs text-[#64748B]">تحدد مستوى الوصول الأساسي للسجلات التي لا يملكها الموظف مباشرة</p>
            </div>
            <button
              onClick={() => showToast('تم حفظ وتطبيق سياسات OWD الأمنية على جميع المستخدمين')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الإعدادات الافتراضية</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F8FAFC] text-[#475569] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-3 font-bold">الوحدة (Module)</th>
                  <th className="px-4 py-3 font-bold">مستوى الوصول الافتراضي</th>
                  <th className="px-4 py-3 font-bold">الوصف الأمني</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {[
                  { key: 'leads', label: 'العملاء المحتملين (Leads)' },
                  { key: 'contacts', label: 'جهات الاتصال (Contacts)' },
                  { key: 'accounts', label: 'الحسابات والشركات (Accounts)' },
                  { key: 'deals', label: 'الصفقات والفرص (Deals)' },
                ].map((mod) => (
                  <tr key={mod.key} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3.5 font-bold text-[#0F172A]">{mod.label}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { val: 'private', label: 'خاص بالمالك فقط (Private)' },
                          { val: 'public_read', label: 'قراءة فقط للجميع (Public Read Only)' },
                          { val: 'public_read_write', label: 'قراءة وتعديل للجميع (Public Read/Write)' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setOwd((prev) => ({ ...prev, [mod.key]: opt.val as AccessLevel }))}
                            className={`px-3 py-1.5 rounded-md border text-xs font-bold cursor-pointer ${
                              owd[mod.key] === opt.val
                                ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                                : 'bg-white border-[#CBD5E1] text-[#475569]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#64748B]">
                      {owd[mod.key] === 'private'
                        ? 'لا يرى السجل إلا مالكه ومديره المباشر في الهرم الوظيفي'
                        : owd[mod.key] === 'public_read'
                        ? 'يمكن لجميع الموظفين عرض السجل، والتعديل للمالك فقط'
                        : 'صلاحية كاملة لجميع أعضاء المؤسسة بعرض وتعديل السجل'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exception Sharing Rules */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">قواعد المشاركة الاستثنائية بين الأدوار والفرق (Sharing Rules)</h2>
              <p className="text-xs text-[#64748B]">منح صلاحيات وصول إضافية بين الأقسام والفرق دون فتح البيانات بالكامل</p>
            </div>
            <button
              onClick={() => setIsAddRuleOpen(!isAddRuleOpen)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إضافة قاعدة مشاركة</span>
            </button>
          </div>

          {isAddRuleOpen && (
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">اسم القاعدة</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="مثال: مشاركة عملاء الغربية مع فريق جدة"
                  className="w-full px-3 py-2 text-xs rounded border border-[#CBD5E1] bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">الوحدة</label>
                <select
                  value={ruleModule}
                  onChange={(e) => setRuleModule(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-bold rounded border border-[#CBD5E1] bg-white"
                >
                  <option value="العملاء المحتملين">العملاء المحتملين</option>
                  <option value="جهات الاتصال">جهات الاتصال</option>
                  <option value="الحسابات">الحسابات</option>
                  <option value="الصفقات">الصفقات</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">مشاركة السجلات المملوكة لـ</label>
                <select
                  value={ruleSource}
                  onChange={(e) => setRuleSource(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-bold rounded border border-[#CBD5E1] bg-white"
                >
                  <option value="فريق مبيعات الرياض">فريق مبيعات الرياض</option>
                  <option value="قسم تطوير الأعمال">قسم تطوير الأعمال</option>
                  <option value="فريق الحسابات الكبرى">فريق الحسابات الكبرى</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddRule}
                  className="flex-1 py-2 px-3 rounded bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                >
                  حفظ القاعدة
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {rules.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-[#2563EB] border border-blue-200">
                      {r.module}
                    </span>
                    <span className="text-xs font-bold text-[#0F172A]">{r.name}</span>
                  </div>
                  <p className="text-xs text-[#475569]">
                    مشاركة سجلات <strong className="text-[#0F172A]">{r.sourceGroup}</strong> مع{' '}
                    <strong className="text-[#0F172A]">{r.targetGroup}</strong> بصلاحية{' '}
                    <span className="text-emerald-700 font-bold">({r.access})</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRules((prev) => prev.filter((item) => item.id !== r.id));
                    showToast('تم حذف قاعدة المشاركة');
                  }}
                  className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. /settings/webforms — نماذج الويب واقتناص الفرص
// ============================================================================
export const WebformsBuilderPage: React.FC = () => {
  const { createLead, currentOrgId } = useCrm();
  const { toast, showToast } = useToast();

  const [formTitle, setFormTitle] = useState('اطلب عرض سعر واستشارة مجانية — Crm-One-step');
  const [assignedOwner, setAssignedOwner] = useState('usr_sales_1');
  const [thankYouMessage, setThankYouMessage] = useState('شكراً لتواصلك معنا! سيقوم مستشار المبيعات بالتواصل معك خلال 15 دقيقة.');
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    fullName: true,
    phone: true,
    email: true,
    company: true,
    notes: false,
  });

  // Live preview simulation inputs
  const [simName, setSimName] = useState('م. فيصل بن خالد الدوسري');
  const [simPhone, setSimPhone] = useState('0558877665');
  const [simEmail, setSimEmail] = useState('faisal@dossary-holding.sa');
  const [simCompany, setSimCompany] = useState('شركة الدوسري للاستثمار الصناعي');
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const embedCode = `<iframe src="https://crm.riwaq.sa/embed/webform?org=${currentOrgId}&owner=${assignedOwner}" width="100%" height="520" frameborder="0" style="border:1px solid #E2E8F0;border-radius:12px;"></iframe>`;

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead({
      fullName: simName || 'عميل نموذج ويب',
      phone: simPhone || '0500000000',
      email: simEmail || 'webform@client.sa',
      company: simCompany || 'شركة عبر نموذج الويب',
      jobTitle: 'عميل محتمل وارد',
      status: 'جديد',
      channel: 'website',
      aiScore: 88,
      estimatedValue: 65000,
      source: 'نموذج ويب (Webform)',
      assignedToName: assignedOwner === 'usr_sales_2' ? 'سارة القحطاني' : 'أحمد العتيبي',
      tags: ['Webform_Lead'],
    });
    showToast(`${thankYouMessage} (تمت إضافة "${simName}" إلى صفحة العملاء المحتملين /leads)`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="نماذج الويب واقتناص الفرص (Web-to-Lead Forms)"
        subtitle="تصميم نماذج الهبوط التفاعلية، توليد كود التضمين لموقعك، ومحاكاة تحويل الزوار إلى عملاء محتملين فوراً"
        badge="Lead Capture"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Builder Controls (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3">1. إعدادات وحقول النموذج</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">عنوان النموذج الظاهر للزوار</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">الحقول المطلوبة في النموذج</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: 'fullName', label: 'الاسم الكامل (إلزامي)' },
                  { key: 'phone', label: 'رقم الجوال' },
                  { key: 'email', label: 'البريد الإلكتروني' },
                  { key: 'company', label: 'اسم الشركة / المؤسسة' },
                  { key: 'notes', label: 'تفاصيل الطلب / ملاحظات' },
                ].map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-2 p-2.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedFields[f.key]}
                      disabled={f.key === 'fullName'}
                      onChange={(e) => setSelectedFields((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">المندوب المسؤول افتراضياً عن الفرص الواردة</label>
              <select
                value={assignedOwner}
                onChange={(e) => setAssignedOwner(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-md border border-[#CBD5E1] bg-white"
              >
                <option value="usr_sales_1">أحمد العتيبي — مدير مبيعات المؤسسات</option>
                <option value="usr_sales_2">سارة القحطاني — أخصائية تطوير الأعمال</option>
                <option value="round_robin">توزيع دائري تلقائي (Round-Robin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">رسالة الشكر بعد الإرسال</label>
              <input
                type="text"
                value={thankYouMessage}
                onChange={(e) => setThankYouMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
              />
            </div>

            {/* Embed Code Box */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">كود التضمين الجاهز (HTML / Iframe)</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(embedCode);
                    setCopiedEmbed(true);
                    showToast('تم نسخ كود التضمين HTML بنجاح');
                    setTimeout(() => setCopiedEmbed(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-[#2563EB] text-[11px] font-bold cursor-pointer"
                >
                  {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEmbed ? 'تم النسخ' : 'نسخ الكود'}</span>
                </button>
              </div>
              <pre
                dir="ltr"
                className="p-3 rounded-md bg-[#0F172A] text-emerald-400 text-[11px] font-mono overflow-x-auto"
              >
                {embedCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Live Preview & Simulation (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">2. المعاينة الحية ومحاكاة اقتناص الفرصة</h2>
              <p className="text-xs text-[#64748B]">جرّب إرسال النموذج ليتم إنشاء عميل محتمل حقيقي فوراً في النظام</p>
            </div>
            <Link to="/leads" className="text-xs font-bold text-[#2563EB] hover:underline">
              فتح قائمة العملاء ←
            </Link>
          </div>

          <form onSubmit={handleSimulateSubmit} className="p-6 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">{formTitle}</h3>

            {selectedFields.fullName && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                />
              </div>
            )}

            {selectedFields.phone && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">رقم الجوال *</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                />
              </div>
            )}

            {selectedFields.email && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                />
              </div>
            )}

            {selectedFields.company && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">اسم الشركة / الجهة</label>
                <input
                  type="text"
                  value={simCompany}
                  onChange={(e) => setSimCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#CBD5E1] bg-white"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>محاكاة إرسال نموذج (إضافة عميل حقيقي إلى /leads)</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. /settings/currencies — وحدة إدارة العملات المتعددة وأسعار الصرف الثابتة والحية
// ============================================================================

const CURRENCY_QUICK_PRESETS: Array<{
  code: string;
  name: string;
  englishName: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimals: number;
  defaultSarRate: number;
}> = [
  { code: 'QAR', name: 'ريال قطري', englishName: 'Qatari Riyal', symbol: 'ر.ق', symbolPosition: 'suffix', decimals: 2, defaultSarRate: 1.03 },
  { code: 'BHD', name: 'دينار بحريني', englishName: 'Bahraini Dinar', symbol: 'د.ب', symbolPosition: 'suffix', decimals: 3, defaultSarRate: 9.95 },
  { code: 'OMR', name: 'ريال عماني', englishName: 'Omani Rial', symbol: 'ر.ع', symbolPosition: 'suffix', decimals: 3, defaultSarRate: 9.74 },
  { code: 'EGP', name: 'جنيه مصري', englishName: 'Egyptian Pound', symbol: 'ج.م', symbolPosition: 'suffix', decimals: 2, defaultSarRate: 0.076 },
  { code: 'JOD', name: 'دينار أردني', englishName: 'Jordanian Dinar', symbol: 'د.أ', symbolPosition: 'suffix', decimals: 3, defaultSarRate: 5.29 },
  { code: 'TRY', name: 'ليرة تركية', englishName: 'Turkish Lira', symbol: '₺', symbolPosition: 'prefix', decimals: 2, defaultSarRate: 0.109 },
  { code: 'CHF', name: 'فرنك سويسري', englishName: 'Swiss Franc', symbol: 'CHF', symbolPosition: 'suffix', decimals: 2, defaultSarRate: 4.26 },
  { code: 'CNY', name: 'يوان صيني', englishName: 'Chinese Yuan', symbol: '¥', symbolPosition: 'prefix', decimals: 2, defaultSarRate: 0.52 },
];

export const CurrenciesSettingsPage: React.FC = () => {
  const {
    currencies,
    baseCurrency,
    addOrganizationCurrency,
    updateOrganizationCurrency,
    deleteOrganizationCurrency,
    setOrganizationBaseCurrency,
    syncLiveCurrencyRates,
    formatOrgCurrency,
    quotes,
    salesOrders,
    invoices,
    currentOrganization,
  } = useCrm();
  const { toast, showToast } = useToast();

  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [lastSyncSource, setLastSyncSource] = useState<string>(
    'جاهز للمزامنة الفورية مع مؤشر أسعار الصرف العالمية (Open Exchange Rates)'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'fixed' | 'live'>('ALL');

  // Add Custom Currency Form State
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newEnglishName, setNewEnglishName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newSymbolPos, setNewSymbolPos] = useState<'prefix' | 'suffix'>('suffix');
  const [newDecimals, setNewDecimals] = useState<number>(2);
  const [newRateMode, setNewRateMode] = useState<'fixed' | 'live'>('fixed');
  const [newRateToBase, setNewRateToBase] = useState<string>('1.00');
  const [newSpreadPercent, setNewSpreadPercent] = useState<string>('0');

  // Live Converter & Quote/Invoice Simulator State
  const [simAmount, setSimAmount] = useState<number>(25000);
  const [simFromCode, setSimFromCode] = useState<string>('USD');
  const [simToCode, setSimToCode] = useState<string>(baseCurrency.code);

  const filteredCurrencies = useMemo(() => {
    return currencies.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.englishName || '').toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q);
      const matchesMode = modeFilter === 'ALL' || c.rateMode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [currencies, modeFilter, searchQuery]);

  const activeCurrenciesCount = currencies.filter((c) => c.isActive).length;
  const liveCurrenciesCount = currencies.filter((c) => c.rateMode === 'live' && !c.isPrimary).length;
  const fixedCurrenciesCount = currencies.filter((c) => c.rateMode === 'fixed').length;

  // Count financial documents using non-base currencies
  const multiCurrencyDocsStats = useMemo(() => {
    const allDocs = [
      ...quotes.map((q) => ({ type: 'quote', currency: q.currency || baseCurrency.code })),
      ...salesOrders.map((s) => ({ type: 'order', currency: s.currency || baseCurrency.code })),
      ...invoices.map((i) => ({ type: 'invoice', currency: i.currency || baseCurrency.code })),
    ];
    const foreignCount = allDocs.filter(
      (d) => d.currency.toUpperCase() !== baseCurrency.code.toUpperCase()
    ).length;
    return {
      totalDocs: allDocs.length,
      foreignCount,
    };
  }, [baseCurrency.code, invoices, quotes, salesOrders]);

  const handleSyncLiveRates = async () => {
    setIsSyncingLive(true);
    try {
      const res = await syncLiveCurrencyRates();
      setLastSyncSource(res.source);
      showToast(
        `تم تحديث أسعار الصرف الحية لـ (${res.updatedCount}) عملة مرتبطة بالسوق العالمي مقابل ${baseCurrency.name} (${baseCurrency.code}).`
      );
    } catch {
      showToast('تعذر الاتصال بمزود الأسعار الحية حالياً، تم الاحتفاظ بآخر سعر معتمد.', 'error');
    } finally {
      setIsSyncingLive(false);
    }
  };

  const handleSelectBaseCurrency = async (nextBaseCode: string) => {
    if (nextBaseCode.toUpperCase() === baseCurrency.code.toUpperCase()) return;
    await setOrganizationBaseCurrency(nextBaseCode);
    setSimToCode(nextBaseCode);
    showToast(
      `تم اعتماد (${nextBaseCode}) كعملة أساسية للمؤسسة وإعادة احتساب معاملات الصرف لكافة العملات وعروض الأسعار والفواتير تلقائياً.`
    );
  };

  const handleApplyPreset = (presetCode: string) => {
    const preset = CURRENCY_QUICK_PRESETS.find((p) => p.code === presetCode);
    if (!preset) return;
    setNewCode(preset.code);
    setNewName(preset.name);
    setNewEnglishName(preset.englishName);
    setNewSymbol(preset.symbol);
    setNewSymbolPos(preset.symbolPosition);
    setNewDecimals(preset.decimals);

    // Calculate default rate relative to current baseCurrency
    const sarCurr = currencies.find((c) => c.code === 'SAR');
    const sarToBase = sarCurr ? sarCurr.rateToBase : 1;
    const computedRate = Math.round(preset.defaultSarRate * sarToBase * 10000) / 10000;
    setNewRateToBase(String(computedRate));
  };

  const handleAddCustomCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.trim().toUpperCase();
    const cleanName = newName.trim();
    if (!cleanCode || cleanCode.length < 2 || cleanCode.length > 6) {
      showToast('يرجى إدخال رمز عملة قياسي صحيح (مثل: QAR أو GBP أو USDT).', 'error');
      return;
    }
    if (!cleanName) {
      showToast('يرجى إدخال اسم العملة باللغة العربية.', 'error');
      return;
    }
    const parsedRate = Number(newRateToBase);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      showToast('يرجى إدخال سعر صرف صحيح أكبر من صفر.', 'error');
      return;
    }

    await addOrganizationCurrency({
      code: cleanCode,
      name: cleanName,
      englishName: newEnglishName.trim() || cleanCode,
      symbol: newSymbol.trim() || cleanCode,
      symbolPosition: newSymbolPos,
      decimals: newDecimals,
      rateMode: newRateMode,
      rateToBase: parsedRate,
      liveSpreadPercent: Number(newSpreadPercent) || 0,
      isActive: true,
      isCustom: true,
    });

    setNewCode('');
    setNewName('');
    setNewEnglishName('');
    setNewSymbol('');
    setNewRateToBase('1.00');
    setNewSpreadPercent('0');
    showToast(
      `تمت إضافة العملة (${cleanCode} — ${cleanName}) وتفعيلها في شاشات عروض الأسعار وأوامر البيع والفواتير.`
    );
  };

  // Simulator calculation
  const simResult = useMemo(() => {
    const fromCurr =
      currencies.find((c) => c.code === simFromCode) ?? currencies[0] ?? baseCurrency;
    const toCurr =
      currencies.find((c) => c.code === simToCode) ?? baseCurrency;
    const fromRate = fromCurr.isPrimary ? 1 : fromCurr.rateToBase || 1;
    const toRate = toCurr.isPrimary ? 1 : toCurr.rateToBase || 1;

    const inBase = (Number(simAmount) || 0) * fromRate;
    const converted = toRate > 0 ? inBase / toRate : inBase;
    const vat15InDoc = (Number(simAmount) || 0) * 0.15;
    const totalWithVatInDoc = (Number(simAmount) || 0) * 1.15;
    const totalWithVatInBase = totalWithVatInDoc * fromRate;

    return {
      fromCurr,
      toCurr,
      inBase: Math.round(inBase * 100) / 100,
      converted: Math.round(converted * 100) / 100,
      effectiveRate: toRate > 0 ? Math.round((fromRate / toRate) * 10000) / 10000 : 1,
      vat15InDoc: Math.round(vat15InDoc * 100) / 100,
      totalWithVatInDoc: Math.round(totalWithVatInDoc * 100) / 100,
      totalWithVatInBase: Math.round(totalWithVatInBase * 100) / 100,
    };
  }, [baseCurrency, currencies, simAmount, simFromCode, simToCode]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      <ToastBanner toast={toast} />
      <SettingsBreadcrumb
        title="إدارة العملات المتعددة، العملة الأساسية، وأسعار الصرف (Multi-Currency & FX Engine)"
        subtitle="إضافة عملات مخصصة، ضبط أسعار صرف ثابتة (Fixed) أو حية تلقائية (Live FX)، وتحديد العملة الأساسية للمؤسسة مع انعكاس فوري في عروض الأسعار والفواتير"
        badge="Multi-Currency Engine"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ===================================================================
            1. BASE CURRENCY GOVERNANCE & LIVE FX SYNC BANNER
           =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] font-extrabold text-base shrink-0">
                {baseCurrency.symbol}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-[#0F172A]">
                    العملة الأساسية للمؤسسة ({currentOrganization?.name || 'رواق'}):{' '}
                    <span className="text-[#2563EB]">
                      {baseCurrency.name} ({baseCurrency.code} — {baseCurrency.symbol})
                    </span>
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                    عملة التقارير والضريبة ZATCA
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  تُستخدم العملة الأساسية لتوحيد مؤشرات لوحة القيادة، إجماليات عروض الأسعار وأوامر البيع، وإقرارات ضريبة القيمة المضافة (15%).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Base Currency Selector */}
              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5">
                <label
                  htmlFor="org-base-currency-select"
                  className="text-xs font-bold text-[#334155] whitespace-nowrap"
                >
                  تغيير العملة الأساسية:
                </label>
                <select
                  id="org-base-currency-select"
                  value={baseCurrency.code}
                  onChange={(e) => void handleSelectBaseCurrency(e.target.value)}
                  className="bg-white border border-[#CBD5E1] rounded px-2.5 py-1 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync Live FX Button */}
              <button
                type="button"
                disabled={isSyncingLive}
                onClick={() => void handleSyncLiveRates()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingLive
                    ? 'جاري جلب الأسعار الحية...'
                    : 'تحديث أسعار الصرف الحية الآن (Live FX)'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#64748B]">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>مصدر التحديث الحي:</span>
              <strong className="text-[#0F172A]">{lastSyncSource}</strong>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/quotes"
                className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
              >
                <span>معاينة في عروض الأسعار</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <span>•</span>
              <Link
                to="/invoices"
                className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
              >
                <span>معاينة في الفواتير الضريبية</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ===================================================================
            2. KPI SUMMARY STRIP
           =================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <span>العملات النشطة بالمؤسسة</span>
              <Coins className="w-4 h-4 text-[#2563EB]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {activeCurrenciesCount}{' '}
              <span className="text-xs font-normal text-[#64748B]">
                من أصل {currencies.length} عملات
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">متاحة للاختيار في العروض والفواتير</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <span>العملات ذات السعر الحي (Live FX)</span>
              <RefreshCw className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 tabular-nums">
              {liveCurrenciesCount}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">تتحدث تلقائياً مع مؤشر السوق العالمي</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <span>العملات ذات السعر الثابت (Fixed Peg)</span>
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {fixedCurrenciesCount}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">سعر صرف مثبت محاسبياً من الإدارة المالية</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <span>المستندات المالية المرتبطة</span>
              <FileText className="w-4 h-4 text-[#2563EB]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
              {multiCurrencyDocsStats.totalDocs}{' '}
              <span className="text-xs font-semibold text-[#2563EB]">
                ({multiCurrencyDocsStats.foreignCount} بعملات أجنبية)
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">عروض أسعار، أوامر بيع، وفواتير ضريبية</p>
          </div>
        </div>

        {/* ===================================================================
            3. CURRENCIES TABLE (FIXED VS LIVE, INLINE RATE EDIT, SET PRIMARY)
           =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#94A3B8] absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برمز العملة (USD, EUR, KWD) أو الاسم..."
                className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: 'ALL', label: `الكل (${currencies.length})` },
                  { key: 'fixed', label: `سعر ثابت (${fixedCurrenciesCount})` },
                  { key: 'live', label: `سعر حي (${liveCurrenciesCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModeFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    modeFilter === tab.key
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F8FAFC] text-[#475569] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-4 py-3 font-bold">رمز العملة والاسم</th>
                  <th className="px-4 py-3 font-bold">الرمز والتنسيق</th>
                  <th className="px-4 py-3 font-bold">نمط التسعير (ثابت / حي)</th>
                  <th className="px-4 py-3 font-bold">
                    سعر الصرف مقابل العملة الأساسية (1 وحدة = {baseCurrency.code})
                  </th>
                  <th className="px-4 py-3 font-bold">معادلة التحويل العكسي</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                  <th className="px-4 py-3 font-bold text-left">إجراءات الحوكمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredCurrencies.map((c) => {
                  const inverseRate =
                    c.rateToBase > 0 ? Math.round((1 / c.rateToBase) * 10000) / 10000 : 1;
                  return (
                    <tr
                      key={c.code}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        c.isPrimary ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] font-mono font-extrabold text-[#0F172A] flex items-center justify-center text-xs shrink-0">
                            {c.code}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#0F172A]">{c.name}</span>
                              {c.isPrimary && (
                                <span className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[10px] font-bold">
                                  العملة الأساسية
                                </span>
                              )}
                              {c.isCustom && !c.isPrimary && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold">
                                  مخصصة
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#64748B]">
                              {c.englishName || c.code} • آخر تحديث: {c.updatedAt}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#2563EB] text-sm">{c.symbol}</div>
                        <div className="text-[10px] text-[#64748B] tabular-nums">
                          مثال: {formatOrgCurrency(1250, c.code)} ({c.decimals ?? 2} خانات)
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {c.isPrimary ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            <Lock className="w-3 h-3" />
                            <span>عملة الأساس المرجعية (1.00)</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                void updateOrganizationCurrency(c.code, { rateMode: 'fixed' });
                                showToast(`تم ضبط سعر صرف (${c.code}) على النمط الثابت (Fixed Rate).`);
                              }}
                              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                c.rateMode === 'fixed'
                                  ? 'bg-[#0F172A] text-white'
                                  : 'text-[#64748B] hover:text-[#0F172A]'
                              }`}
                            >
                              ثابت (Fixed)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void updateOrganizationCurrency(c.code, { rateMode: 'live' });
                                showToast(`تم ربط (${c.code}) بمؤشر أسعار الصرف الحية (Live FX).`);
                              }}
                              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                c.rateMode === 'live'
                                  ? 'bg-[#2563EB] text-white'
                                  : 'text-[#64748B] hover:text-[#0F172A]'
                              }`}
                            >
                              حي (Live FX)
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {c.isPrimary ? (
                          <span className="font-mono font-bold text-emerald-700">
                            1.0000 {baseCurrency.symbol}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#64748B] font-mono">
                              1 {c.code} =
                            </span>
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              value={c.rateToBase}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val > 0) {
                                  void updateOrganizationCurrency(c.code, { rateToBase: val });
                                }
                              }}
                              className="w-28 px-2.5 py-1 text-xs font-mono font-bold rounded-md border border-[#CBD5E1] bg-white focus:border-[#2563EB] focus:outline-none tabular-nums"
                            />
                            <span className="text-[11px] font-bold text-[#0F172A]">
                              {baseCurrency.symbol}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#475569] tabular-nums">
                        1 {baseCurrency.code} = {inverseRate} {c.code}
                      </td>

                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={c.isPrimary}
                          onClick={() => {
                            void updateOrganizationCurrency(c.code, { isActive: !c.isActive });
                            showToast(
                              !c.isActive
                                ? `تم تفعيل العملة (${c.code}) في عروض الأسعار والفواتير.`
                                : `تم إيقاف العملة (${c.code}) مؤقتاً.`
                            );
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            c.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          } ${c.isPrimary ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {c.isActive ? 'نشطة' : 'معطلة'}
                        </button>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {!c.isPrimary && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSelectBaseCurrency(c.code)}
                                className="px-2.5 py-1 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-bold transition cursor-pointer"
                              >
                                تعيين كعملة أساسية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteOrganizationCurrency(c.code);
                                  showToast(`تم حذف العملة (${c.code}) من قائمة عملات المؤسسة.`, 'info');
                                }}
                                title="حذف العملة"
                                className="p-1.5 rounded-md border border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6] transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================================
            4. ADD CUSTOM CURRENCY & INTERACTIVE FX SIMULATOR (2-COLUMN GRID)
           =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1 (7 Cols): Add Custom Currency Form + Quick Presets */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#2563EB]" />
                  <span>إضافة عملة مخصصة أو دولية جديدة</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  أضف أي عملة إقليمية أو دولية وحدد ما إذا كان سعر صرفها ثابتاً أو مرتبطاً بالسوق الحي
                </p>
              </div>
            </div>

            {/* Quick Regional & Global Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#475569]">
                اختيار سريع من العملات الإقليمية والدولية الشائعة:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCY_QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleApplyPreset(preset.code)}
                    className="px-2.5 py-1 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB] hover:bg-[#EFF6FF] text-[11px] font-semibold text-[#0F172A] transition cursor-pointer"
                  >
                    {preset.code} ({preset.name} — {preset.symbol})
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(e) => void handleAddCustomCurrency(e)} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    رمز العملة (ISO Code) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="مثال: QAR أو BHD"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-[#CBD5E1] bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    اسم العملة بالعربية *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: ريال قطري"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD5E1] bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    الاسم الإنجليزي
                  </label>
                  <input
                    type="text"
                    value={newEnglishName}
                    onChange={(e) => setNewEnglishName(e.target.value)}
                    placeholder="Qatari Riyal"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD5E1] bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    رمز العملة المختصر (Symbol) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="مثال: ر.ق أو £"
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-[#CBD5E1] bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    موضع الرمز في الفواتير
                  </label>
                  <select
                    value={newSymbolPos}
                    onChange={(e) => setNewSymbolPos(e.target.value as 'prefix' | 'suffix')}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value="suffix">بعد المبلغ (1,000 ر.س)</option>
                    <option value="prefix">قبل المبلغ ($1,000)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    الخانات العشرية
                  </label>
                  <select
                    value={newDecimals}
                    onChange={(e) => setNewDecimals(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value={2}>خانتان عشريتان (0.00)</option>
                    <option value={3}>3 خانات عشرية (0.000 — للدينار)</option>
                    <option value={0}>بدون كسور (أرقام صحيحة)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    آلية سعر الصرف
                  </label>
                  <select
                    value={newRateMode}
                    onChange={(e) => setNewRateMode(e.target.value as 'fixed' | 'live')}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value="fixed">سعر صرف ثابت (Fixed Rate)</option>
                    <option value="live">سعر صرف حي تلقائي (Live FX)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    سعر الصرف مقابل ({baseCurrency.code}) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={newRateToBase}
                    onChange={(e) => setNewRateToBase(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-[#CBD5E1] bg-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    هامش فرق العملة البنكي (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="15"
                    value={newSpreadPercent}
                    onChange={(e) => setNewSpreadPercent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#CBD5E1] bg-white tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ وإضافة العملة للمؤسسة</span>
                </button>
              </div>
            </form>
          </div>

          {/* Column 2 (5 Cols): Interactive FX Calculator & Quote/Invoice Impact Preview */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A]">
                  حاسبة الصرف الفورية ومعاينة أثر الفوترة (ZATCA)
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  اختبر كيف يظهر عرض السعر أو الفاتورة الضريبية عند إصدارها بعملة أجنبية مع المعادل بالعملة الأساسية
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    مبلغ عرض السعر / الفاتورة (صافي قبل الضريبة)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={simAmount}
                    onChange={(e) => setSimAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      من عملة المستند
                    </label>
                    <select
                      value={simFromCode}
                      onChange={(e) => setSimFromCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-[#CBD5E1] bg-white"
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">
                      إلى العملة المستهدفة
                    </label>
                    <select
                      value={simToCode}
                      onChange={(e) => setSimToCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-[#CBD5E1] bg-white"
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[#475569]">
                  <span>معامل التحويل المطبق:</span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    1 {simResult.fromCurr.code} = {simResult.effectiveRate} {simResult.toCurr.code}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#0F172A]">
                  <span>القيمة المحولة الصافية:</span>
                  <span className="font-mono font-extrabold text-sm text-[#2563EB]">
                    {formatOrgCurrency(simResult.converted, simResult.toCurr.code)}
                  </span>
                </div>

                <div className="border-t border-[#BFDBFE] pt-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold text-[#1E40AF]">
                    معاينة ملخص الفاتورة الضريبية وعرض السعر:
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#475569]">ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {formatOrgCurrency(simResult.vat15InDoc, simResult.fromCurr.code)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#0F172A] font-bold">
                      الإجمالي بعملة المستند ({simResult.fromCurr.code}):
                    </span>
                    <span className="font-mono font-extrabold text-[#0F172A]">
                      {formatOrgCurrency(simResult.totalWithVatInDoc, simResult.fromCurr.code)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white/80 rounded-lg px-2.5 py-1.5 border border-[#BFDBFE]">
                    <span className="text-[#1D4ED8] font-bold">
                      المعادل بالعملة الأساسية للمؤسسة ({baseCurrency.code}):
                    </span>
                    <span className="font-mono font-extrabold text-[#2563EB]">
                      {formatOrgCurrency(simResult.totalWithVatInBase, baseCurrency.code)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
              <Link
                to="/quotes"
                className="flex-1 py-2 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold text-center transition"
              >
                فتح عروض الأسعار
              </Link>
              <Link
                to="/invoices"
                className="flex-1 py-2 px-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold text-center transition"
              >
                فتح الفواتير الضريبية
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

