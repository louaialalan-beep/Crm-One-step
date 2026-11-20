import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Eye, LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { AppShell } from './components/layout/AppShell';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PredictiveAnalyticsPage } from './pages/PredictiveAnalyticsPage';
import { BlueprintBuilderPage } from './pages/BlueprintBuilderPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DealDetailPage } from './pages/DealDetailPage';
import { DealsPage } from './pages/DealsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadsPage } from './pages/LeadsPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { RoleHierarchyPage } from './pages/RoleHierarchyPage';
import { SetupHubPage } from './pages/SetupHubPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { WorkflowRulesPage } from './pages/WorkflowRulesPage';
import { MetaIntegrationPage } from './pages/MetaIntegrationPage';
import { WhatsappInboxPage } from './pages/WhatsappInboxPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { FinancialModulePage } from './pages/FinancialModulePage';
import { CustomFunctionsPage } from './pages/CustomFunctionsPage';
import { AssignmentRulesPage } from './pages/AssignmentRulesPage';
import { CustomFieldsBuilderPage } from './pages/CustomFieldsBuilderPage';
import {
  ImportExportPage,
  TemplatesManagerPage,
  PipelinesSettingsPage,
  DataSharingSettingsPage,
  WebformsBuilderPage,
  CurrenciesSettingsPage,
} from './pages/EnterpriseSettingsPages';
import { ApprovalsAndAuditPage } from './pages/ApprovalsAndAuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import EmailSettingsPage from './pages/EmailSettingsPage';
import {
  DataDeletionStatusPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from './pages/MetaCompliancePages';

function LoginPage() {
  const { firebaseUser, authReady, isPreviewMode, enterPreviewMode, signInWithGoogle, authError } = useCrm();
  const navigate = useNavigate();

  if (authReady && (firebaseUser || isPreviewMode)) {
    return <Navigate to="/" replace />;
  }

  const handleEnterPreview = () => {
    enterPreviewMode();
    navigate('/', { replace: true });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans text-[#0F172A]"
    >
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-extrabold text-sm shadow-xs" dir="ltr">
            C1
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">Crm-One-step — بوابة المؤسسات</h1>
            <p className="text-xs text-[#64748B]">منصة المبيعات والأتمتة السحابية المتكاملة</p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-xs text-[#475569]">
          <div className="flex items-center gap-2 font-bold text-[#0F172A]">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <span>تسجيل دخول آمن وموحد (Google Workspace SSO)</span>
          </div>
          <p className="leading-relaxed">
            يرجى تسجيل الدخول باستخدام حساب Google المعتمد للوصول إلى مساحة عمل المؤسسة وقواعد صلاحيات الأدوار (RBAC)، أو الدخول في وضع المعاينة المحلية لتجربة كافة وحدات النظام فوراً.
          </p>
        </div>

        {authError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
            {authError}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول عبر Google</span>
          </button>

          <button
            type="button"
            onClick={handleEnterPreview}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] hover:border-[#2563EB] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#2563EB]" />
            <span>الدخول في الوضع التجريبي (معاينة النظام)</span>
          </button>
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
          <a href="/privacy-policy" className="hover:text-[#2563EB] transition-colors">
            سياسة الخصوصية
          </a>
          <span>•</span>
          <a href="/terms" className="hover:text-[#2563EB] transition-colors">
            شروط الخدمة
          </a>
          <span>•</span>
          <a href="/data-deletion-status" className="hover:text-[#2563EB] transition-colors">
            حالة حذف البيانات
          </a>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authReady, firebaseUser, isPreviewMode } = useCrm();
  const location = useLocation();

  if (!authReady && !isPreviewMode) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3 text-[#0F172A]"
      >
        <div className="w-10 h-10 rounded-full border-3 border-[#CBD5E1] border-t-[#2563EB] animate-spin" />
        <p className="text-xs font-bold text-[#475569] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#2563EB]" />
          <span>جارٍ التحقق من الجلسة السحابية وتحميل صلاحيات المؤسسة...</span>
        </p>
      </div>
    );
  }

  // Allow authenticated Google users or users who activated Preview Mode in the current session
  if (!firebaseUser && !isPreviewMode) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <CrmProvider>
        <Routes>
          {/* Public Standalone Routes (Accessible to Meta Crawlers & Visitors without AppShell/Auth) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/data-deletion-status" element={<DataDeletionStatusPage />} />

          {/* Protected Application Routes inside AppShell */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/leads/:id" element={<LeadDetailPage />} />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route path="/contacts/:id" element={<ContactDetailPage />} />
                    <Route path="/accounts" element={<AccountsPage />} />
                    <Route path="/accounts/:id" element={<AccountDetailPage />} />
                    <Route path="/deals" element={<DealsPage />} />
                    <Route path="/deals/:id" element={<DealDetailPage />} />
                    <Route path="/quotes" element={<FinancialModulePage defaultTab="quotes" />} />
                    <Route path="/sales-orders" element={<FinancialModulePage defaultTab="sales_orders" />} />
                    <Route path="/invoices" element={<FinancialModulePage defaultTab="invoices" />} />
                    <Route path="/purchase-orders" element={<FinancialModulePage defaultTab="purchase_orders" />} />
                    <Route path="/tasks" element={<ActivitiesPage defaultTab="tasks" />} />
                    <Route path="/activities" element={<ActivitiesPage defaultTab="activities" />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/whatsapp-inbox" element={<WhatsappInboxPage />} />
                    <Route path="/campaigns" element={<CampaignsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/predictive-analytics" element={<PredictiveAnalyticsPage />} />
                    <Route path="/analytics/predictive" element={<PredictiveAnalyticsPage />} />
                    <Route path="/settings" element={<SetupHubPage />} />
                    <Route path="/super-admin" element={<SuperAdminPage />} />
                    <Route path="/settings/super-admin" element={<SuperAdminPage />} />
                    <Route path="/settings/users" element={<UsersManagementPage />} />
                    <Route path="/settings/subscription" element={<SubscriptionPage defaultTab="subscription" />} />
                    <Route path="/settings/company" element={<SubscriptionPage defaultTab="company" />} />
                    <Route path="/settings/profiles" element={<ProfilesPage />} />
                    <Route path="/settings/roles" element={<RoleHierarchyPage />} />
                    <Route path="/settings/custom-fields" element={<CustomFieldsBuilderPage />} />
                    <Route path="/settings/blueprints" element={<BlueprintBuilderPage />} />
                    <Route path="/settings/functions" element={<CustomFunctionsPage />} />
                    <Route path="/settings/workflows" element={<WorkflowRulesPage />} />
                    <Route path="/settings/approvals" element={<ApprovalsAndAuditPage defaultTab="rules" />} />
                    <Route path="/settings/audit-log" element={<ApprovalsAndAuditPage defaultTab="audit" />} />
                    <Route path="/settings/assignment-rules" element={<AssignmentRulesPage defaultTab="assignment" />} />
                    <Route path="/settings/scoring-rules" element={<AssignmentRulesPage defaultTab="scoring" />} />
                    <Route path="/settings/ai-scoring" element={<AssignmentRulesPage defaultTab="scoring" />} />
                    <Route path="/settings/meta" element={<MetaIntegrationPage defaultTab="meta" />} />
                    <Route path="/settings/whatsapp" element={<MetaIntegrationPage defaultTab="whatsapp" />} />
                    <Route path="/settings/social-channels" element={<MetaIntegrationPage defaultTab="social" />} />
                    <Route path="/settings/import-export" element={<ImportExportPage />} />
                    <Route path="/settings/templates" element={<TemplatesManagerPage />} />
                    <Route path="/settings/pipelines" element={<PipelinesSettingsPage />} />
                    <Route path="/settings/data-sharing" element={<DataSharingSettingsPage />} />
                    <Route path="/settings/webforms" element={<WebformsBuilderPage />} />
                    <Route path="/settings/currencies" element={<CurrenciesSettingsPage />} />
                    <Route path="/settings/business-hours" element={<SubscriptionPage defaultTab="company" />} />
                    <Route path="/settings/teams" element={<UsersManagementPage />} />
                    <Route path="/settings/email" element={<EmailSettingsPage />} />
                    <Route path="/settings/validation-rules" element={<CustomFieldsBuilderPage />} />
                    <Route path="/settings/scheduled-actions" element={<WorkflowRulesPage />} />
                    <Route path="/settings/webhooks" element={<CustomFunctionsPage />} />
                    <Route path="/settings/api-keys" element={<CustomFunctionsPage />} />
                    <Route path="/settings/deduplication" element={<ImportExportPage />} />
                    <Route path="/settings/recycle-bin" element={<ModulePlaceholderPage />} />
                    <Route path="/settings/:section" element={<ModulePlaceholderPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </CrmProvider>
    </BrowserRouter>
  );
}

