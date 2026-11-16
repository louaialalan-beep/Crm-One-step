import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { CommandPalette } from '../overlays/CommandPalette';
import { QuickDealModal } from '../overlays/QuickDealModal';
import { InboxDrawer } from '../overlays/InboxDrawer';
import { SignalsDrawer } from '../overlays/SignalsDrawer';
import { useCrm } from '../../context/CrmContext';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { inboxOpen, openInboxForLead, closeInbox } = useCrm();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickDealOpen, setQuickDealOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setQuickDealOpen(false);
        closeInbox();
        setSignalsOpen(false);
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeInbox]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]" dir="rtl">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenQuickDeal={() => setQuickDealOpen(true)}
          onOpenInbox={() => openInboxForLead()}
          onOpenSignals={() => setSignalsOpen(true)}
        />

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenQuickDeal={() => setQuickDealOpen(true)}
      />
      <QuickDealModal open={quickDealOpen} onClose={() => setQuickDealOpen(false)} />
      <InboxDrawer open={inboxOpen} onClose={closeInbox} />
      <SignalsDrawer open={signalsOpen} onClose={() => setSignalsOpen(false)} />
    </div>
  );
};
