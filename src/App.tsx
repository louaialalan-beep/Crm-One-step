import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CrmProvider } from './context/CrmContext';
import { AppShell } from './components/layout/AppShell';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DealDetailPage } from './pages/DealDetailPage';
import { DealsPage } from './pages/DealsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadsPage } from './pages/LeadsPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';

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
            <Route path="/quotes" element={<ModulePlaceholderPage />} />
            <Route path="/sales-orders" element={<ModulePlaceholderPage />} />
            <Route path="/invoices" element={<ModulePlaceholderPage />} />
            <Route path="/tasks" element={<ModulePlaceholderPage />} />
            <Route path="/reports" element={<ModulePlaceholderPage />} />
            <Route path="/analytics" element={<ModulePlaceholderPage />} />
            <Route path="/settings" element={<ModulePlaceholderPage />} />
            <Route path="/settings/profiles" element={<ModulePlaceholderPage />} />
            <Route path="/settings/roles" element={<ModulePlaceholderPage />} />
            <Route path="/settings/custom-fields" element={<ModulePlaceholderPage />} />
            <Route path="/settings/blueprints" element={<ModulePlaceholderPage />} />
            <Route path="/settings/workflows" element={<ModulePlaceholderPage />} />
            <Route path="/settings/recycle-bin" element={<ModulePlaceholderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </CrmProvider>
    </BrowserRouter>
  );
}
