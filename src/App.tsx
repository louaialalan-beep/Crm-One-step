import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CrmProvider } from './context/CrmContext';
import { AppShell } from './components/layout/AppShell';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
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
  DataDeletionStatusPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from './pages/MetaCompliancePages';

export default function App() {
  return (
    <BrowserRouter>
      <CrmProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/accounts" element={<ModulePlaceholderPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealDetailPage />} />
            <Route path="/quotes" element={<FinancialModulePage />} />
            <Route path="/sales-orders" element={<FinancialModulePage />} />
            <Route path="/invoices" element={<FinancialModulePage />} />
            <Route path="/tasks" element={<ActivitiesPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/whatsapp-inbox" element={<WhatsappInboxPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/reports" element={<AnalyticsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SetupHubPage />} />
            <Route path="/settings/users" element={<UsersManagementPage />} />
            <Route path="/settings/subscription" element={<SubscriptionPage />} />
            <Route path="/settings/company" element={<SubscriptionPage />} />
            <Route path="/settings/profiles" element={<ProfilesPage />} />
            <Route path="/settings/roles" element={<RoleHierarchyPage />} />
            <Route path="/settings/custom-fields" element={<CustomFieldsBuilderPage />} />
            <Route path="/settings/blueprints" element={<BlueprintBuilderPage />} />
            <Route path="/settings/functions" element={<CustomFunctionsPage />} />
            <Route path="/settings/workflows" element={<WorkflowRulesPage />} />
            <Route path="/settings/assignment-rules" element={<AssignmentRulesPage />} />
            <Route path="/settings/scoring-rules" element={<AssignmentRulesPage />} />
            <Route path="/settings/ai-scoring" element={<AssignmentRulesPage />} />
            <Route path="/settings/meta" element={<MetaIntegrationPage />} />
            <Route path="/settings/whatsapp" element={<MetaIntegrationPage />} />
            <Route path="/settings/social-channels" element={<MetaIntegrationPage />} />
            <Route path="/settings/recycle-bin" element={<ModulePlaceholderPage />} />
            <Route path="/settings/:section" element={<ModulePlaceholderPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/data-deletion-status" element={<DataDeletionStatusPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </CrmProvider>
    </BrowserRouter>
  );
}
