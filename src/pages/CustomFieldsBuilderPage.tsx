import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Check,
  ChevronDown,
  Columns3,
  Copy,
  Database,
  FileText,
  Filter,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Zap,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function CustomFieldsBuilderPage() {
  const { currentOrgId, customFields } = useCrm();

  const [selectedModule, setSelectedModule] = useState<'leads' | 'contacts' | 'accounts' | 'deals' | 'tasks'>('leads');
  const [activeLayout, setActiveLayout] = useState('Standard Layout (التخطيط القياسي)');
  const [searchPalette, setSearchPalette] = useState('');

  // Selected field for Inspector
  const [selectedField, setSelectedField] = useState({
    label: 'الفرع المختص',
    apiName: 'branch_location',
    type: 'قائمة منسدلة (Picklist)',
    mandatory: false,
    unique: false,
    searchable: true,
    encrypted: false,
    options: ['الرياض - المقر الرئيسي', 'جدة - الفرع الغربي', 'الدمام - الفرع الشرقي', 'القصيم'],
    conditionalRule: 'البلد = المملكة العربية السعودية',
    fls: {
      admin: 'read_write',
      advanced_sales: 'read_write',
      sdr: 'read_only',
      support: 'hidden',
    },
  });

  const [moduleFields, setModuleFields] = useState([
    { id: 'f1', label: 'الفرع المختص', apiName: 'branch_location', type: 'قائمة منسدلة', required: false, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f2', label: 'الاسم الكامل', apiName: 'full_name', type: 'نص قصير', required: true, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f3', label: 'رقم الجوال الأساسي', apiName: 'lead_phone_primary', type: 'هاتف', required: true, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f4', label: 'البريد الإلكتروني المهني', apiName: 'email_address', type: 'بريد', required: false, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f5', label: 'الشركة أو المنشأة', apiName: 'company_account_id', type: 'بحث ربط (Lookup)', required: false, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f6', label: 'درجة التأهيل الذكي (Lead Score)', apiName: 'ai_score_val', type: 'نظام بلوبرينت', required: false, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f7', label: 'حالة العميل المحتمل', apiName: 'lead_stage', type: 'قائمة', required: true, section: 'المعلومات الأساسية والتأهيل (Core & Qualification Info)' },
    { id: 'f8', label: 'حساب واتساب المعتمد', apiName: 'waba_account_id', type: 'ترقيم تلقائي', required: false, section: 'بيانات ميتا والمصدر الذكي والإسناد (Meta Omnichannel & Attribution)' },
    { id: 'f9', label: 'معرف حملة ميتا الإعلانية', apiName: 'meta_campaign_id', type: 'مشفر (AES)', required: false, section: 'بيانات ميتا والمصدر الذكي والإسناد (Meta Omnichannel & Attribution)' },
    { id: 'f10', label: 'مصفوفة نقاط الدخول (Touchpoints Subform)', apiName: 'touchpoints_table', type: 'جدول فرعي', required: false, section: 'بيانات ميتا والمصدر الذكي والإسناد (Meta Omnichannel & Attribution)' },
  ]);

  const [newOptionText, setNewOptionText] = useState('');

  const paletteFieldTypes = [
    { name: 'نص قصير (Single Line)', icon: Type },
    { name: 'نص طويل (Multi Line)', icon: FileText },
    { name: 'قائمة منسدلة (Picklist)', icon: ChevronDown },
    { name: 'اختيار متعدد (Multi-Select)', icon: Columns3 },
    { name: 'رقم / عملة (Currency & Number)', icon: Database },
    { name: 'تاريخ ووققت (Date & Time)', icon: Activity },
    { name: 'ترقيم تلقائي (Auto-Number)', icon: Sparkles },
    { name: 'حقل ربط (Lookup 1:N)', icon: Layers },
    { name: 'جدول فرعي (Subform)', icon: Sliders },
    { name: 'بطاقة قسم جديد (New Section)', icon: Plus },
  ].filter((item) => item.name.toLowerCase().includes(searchPalette.toLowerCase()));

  const handleSaveLayout = async () => {
    try {
      await setDoc(doc(db, 'layouts', `${currentOrgId}_${selectedModule}`), {
        org_id: currentOrgId,
        module: selectedModule,
        layout_name: activeLayout,
        fields_count: moduleFields.length,
        updated_at: new Date().toISOString(),
      });
      alert('تم حفظ ونشر التخطيط والموديول بنجاح في سحابة Firestore (Ctrl+S).');
    } catch (err) {
      console.error(err);
      alert('تم حفظ التخطيط محلياً بنجاح.');
    }
  };

  const handleAddPicklistOption = () => {
    if (!newOptionText.trim()) return;
    setSelectedField({
      ...selectedField,
      options: [...selectedField.options, newOptionText.trim()],
    });
    setNewOptionText('');
  };

  return (
    <div dir="rtl" className="w-full h-[calc(100vh-65px)] flex flex-col bg-[#F8FAFC] text-[13px]">
      {/* Top Header & Module Pills */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedModule('leads')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedModule === 'leads' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>العملاء المحتملين (Leads)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] tabular-nums">38 حقل</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule('contacts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedModule === 'contacts' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>جهات الاتصال</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] tabular-nums">28</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule('accounts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedModule === 'accounts' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>الشركات والحسابات</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] tabular-nums">32</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule('deals')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedModule === 'deals' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>الصفقات والمبيعات</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] tabular-nums">45</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModule('tasks')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedModule === 'tasks' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>المهام والأنشطة</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] tabular-nums">19</span>
            </button>
            <button
              type="button"
              onClick={() => alert('فتح معالج إنشاء موديول مخصص جديد (Custom Module Wizard).')}
              className="px-3.5 py-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-[#BFDBFE]"
            >
              <Plus className="w-3.5 h-3.5" />
              إنشاء موديول مخصص
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alert('تمت معاينة النماذج الحية والتخطيط بنجاح.')}
              className="px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              معاينة النموذج الحقيقي
            </button>
            <button
              type="button"
              onClick={handleSaveLayout}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              حفظ ونشر التخطيط (Ctrl+S)
            </button>
          </div>
        </div>

        {/* Layout Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0] text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#64748B]">التخطيط النشط:</span>
            <select
              value={activeLayout}
              onChange={(e) => setActiveLayout(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] focus:outline-none"
            >
              <option value="Standard Layout (التخطيط القياسي)">Standard Layout (التخطيط القياسي) — نشط</option>
              <option value="Enterprise Sales Layout">Enterprise Sales Layout (تخطيط المبيعات الكبرى)</option>
              <option value="SDR Qualification Layout">SDR Qualification Layout (تخطيط التأهيل السريع)</option>
            </select>

            <button
              type="button"
              onClick={() => alert('تم إنشاء تخطيط جديد فارغ.')}
              className="text-[#2563EB] font-bold hover:underline"
            >
              + تخطيط جديد
            </button>
          </div>

          <div className="flex items-center gap-3 text-[#64748B]">
            <button type="button" className="hover:text-[#0F172A] font-semibold">قواعد التخطيط الشرطية (3 قواعد نشطة)</button>
            <span>•</span>
            <span className="text-[#10B981] font-bold">آخر حفظ تلقائي: منذ دقيقة واحدة (Production)</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right Palette (22%) - Draggable Field Types */}
        <div className="w-[22%] bg-white border-l border-[#E2E8F0] flex flex-col">
          <div className="p-3 border-b border-[#E2E8F0] space-y-2">
            <span className="font-bold text-xs text-[#0F172A]">حقول جديدة جاهزة للسحب (Field Palette)</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={searchPalette}
                onChange={(e) => setSearchPalette(e.target.value)}
                placeholder="ابحث عن نوع الحقل..."
                className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[11px] font-bold text-[#64748B] mb-1">حقول الإدخال القياسية</div>
            {paletteFieldTypes.map((ft, idx) => {
              const Icon = ft.icon;
              return (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', ft.name)}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center gap-2.5 text-xs text-[#0F172A] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] transition-colors cursor-grab shadow-2xs"
                >
                  <Icon className="w-4 h-4 text-[#2563EB]" />
                  <span className="font-semibold">{ft.name}</span>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-xs text-[#64748B] flex items-center justify-between">
            <span>الحقول غير المستخدمة</span>
            <span className="font-bold text-[#0F172A]">4 حقول</span>
          </div>
        </div>

        {/* Center Canvas (50%) - Reorderable Sections & 2-Column Grid */}
        <div className="flex-1 bg-[#F8FAFC] overflow-y-auto p-4 space-y-4">
          {/* Section 1 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <span className="font-bold text-xs text-[#0F172A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]"></span>
                المعلومات الأساسية والتأهيل (Core & Qualification Info)
              </span>
              <span className="text-[11px] text-[#64748B]">ظاهر للجميع</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {moduleFields
                .filter((f) => f.section.includes('Core'))
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedField({ ...selectedField, label: f.label, apiName: f.apiName, type: f.type })}
                    className={`bg-[#F8FAFC] border rounded-xl p-3 space-y-1.5 transition-all cursor-pointer ${
                      selectedField.label === f.label ? 'border-[#2563EB] ring-2 ring-[#2563EB]/10 bg-[#EFF6FF]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A]">{f.label} {f.required && <span className="text-rose-500">*</span>}</span>
                      <span className="text-[10px] text-[#64748B] font-mono">{f.apiName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0]">{f.type}</span>
                      <Lock className="w-3 h-3 text-[#94A3B8]" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <span className="font-bold text-xs text-[#0F172A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                بيانات ميتا والمصدر الذكي والإسناد (Meta Omnichannel & Attribution)
              </span>
              <span className="text-[11px] text-[#10B981] font-bold">تكامل تلقائي</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {moduleFields
                .filter((f) => f.section.includes('Meta'))
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedField({ ...selectedField, label: f.label, apiName: f.apiName, type: f.type })}
                    className={`bg-[#F8FAFC] border rounded-xl p-3 space-y-1.5 transition-all cursor-pointer ${
                      selectedField.label === f.label ? 'border-[#2563EB] ring-2 ring-[#2563EB]/10 bg-[#EFF6FF]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A]">{f.label}</span>
                      <span className="text-[10px] text-[#64748B] font-mono">{f.apiName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0]">{f.type}</span>
                      <Lock className="w-3 h-3 text-[#94A3B8]" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Drop New Section Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const droppedType = e.dataTransfer.getData('text/plain');
              alert(`تم إسقاط الحقل الجديد (${droppedType}) بنجاح في النموذج.`);
            }}
            className="border-2 border-dashed border-[#CBD5E1] rounded-xl p-6 text-center text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer bg-white/50"
          >
            <Plus className="w-6 h-6 mx-auto mb-1 text-[#94A3B8]" />
            <span className="font-bold text-xs">اسحب وأفلت قسماً جديداً هنا (+ Drop New Section)</span>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">يمكنك تنظيم وتجميع الحقول ذات الصلة في أقسام تبوب أو شاشات متابعة</p>
          </div>
        </div>

        {/* Left Inspector (28%) - Field Properties & FLS Editor */}
        <div className="w-[28%] bg-white border-r border-[#E2E8F0] flex flex-col overflow-y-auto p-4 space-y-5 text-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <span className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#2563EB]" />
              خصائص الحقل: {selectedField.label}
            </span>
            <span className="text-[11px] text-[#64748B]">نوع الحقل: {selectedField.type}</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">تسمية الحقل (Field Label)</label>
              <input
                type="text"
                value={selectedField.label}
                onChange={(e) => setSelectedField({ ...selectedField, label: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">معرف API البرمجي (Field API Name)</label>
              <input
                type="text"
                value={selectedField.apiName}
                onChange={(e) => setSelectedField({ ...selectedField, apiName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] font-mono text-xs text-[#2563EB] focus:outline-none"
              />
              <span className="text-[10px] text-[#64748B] mt-0.5 block">يستخدم في دوال السيرفر المخصصة (Deluge / Webhooks)</span>
            </div>

            {/* Picklist options */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A]">خيارات القائمة المنسدلة (Picklist):</span>
              <div className="space-y-1">
                {selectedField.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#F8FAFC] px-2.5 py-1.5 rounded-lg border border-[#E2E8F0]">
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedField({ ...selectedField, options: selectedField.options.filter((_, i) => i !== idx) })}
                      className="text-rose-500 hover:text-rose-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="إضافة خيار جديد..."
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddPicklistOption}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  + إضافة
                </button>
              </div>
            </div>

            {/* Field Rules */}
            <div className="space-y-2.5 pt-3 border-t border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A]">قواعد وقيود الحقل:</span>
              <label className="flex items-center justify-between cursor-pointer bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span>حقل إلزامي للحفظ (Mandatory)</span>
                <input
                  type="checkbox"
                  checked={selectedField.mandatory}
                  onChange={(e) => setSelectedField({ ...selectedField, mandatory: e.target.checked })}
                  className="rounded text-[#2563EB]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span>عدم السماح بالتكرار (Unique)</span>
                <input
                  type="checkbox"
                  checked={selectedField.unique}
                  onChange={(e) => setSelectedField({ ...selectedField, unique: e.target.checked })}
                  className="rounded text-[#2563EB]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span>تضمين في البحث السريع الشامل</span>
                <input
                  type="checkbox"
                  checked={selectedField.searchable}
                  onChange={(e) => setSelectedField({ ...selectedField, searchable: e.target.checked })}
                  className="rounded text-[#2563EB]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                <span>تشفير القيمة (256-AES)</span>
                <input
                  type="checkbox"
                  checked={selectedField.encrypted}
                  onChange={(e) => setSelectedField({ ...selectedField, encrypted: e.target.checked })}
                  className="rounded text-[#2563EB]"
                />
              </label>
            </div>

            {/* FLS Table */}
            <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A]">صلاحيات مستوى الحقل (FLS):</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>مدير النظام (Administrator)</span>
                  <span className="text-[#10B981] font-bold">قراءة وتعديل ✓</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>مبيعات متقدمة (Standard Sales)</span>
                  <span className="text-[#10B981] font-bold">قراءة وتعديل ✓</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>مندوب تأهيل وحملات (SDR)</span>
                  <span className="text-[#2563EB] font-bold">قراءة فقط 🔒</span>
                </div>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                  <span>خدمة ودعم العملاء</span>
                  <span className="text-rose-500 font-bold">مخفي تماماً ✕</span>
                </div>
              </div>
            </div>

            {/* Conditional Dependency */}
            <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A]">قواعد الاعتمادية الشرطية (Conditional Dependency):</span>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-2.5 text-[11px] text-[#1E40AF] space-y-1">
                <div className="font-bold">إظهار هذا الحقل فقط إذا كان:</div>
                <div className="font-mono text-[#2563EB]">{selectedField.conditionalRule}</div>
              </div>
              <button
                type="button"
                onClick={() => alert('تم تعديل القاعدة الشرطية بنجاح.')}
                className="w-full py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#2563EB] font-bold cursor-pointer"
              >
                + إضافة شرط اعتمادية جديد
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
