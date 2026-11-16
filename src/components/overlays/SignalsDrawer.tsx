import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Briefcase, CheckCheck, CheckSquare, Sparkles, UserPlus, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface SignalsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const SignalsDrawer: React.FC<SignalsDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { signals, markAllSignalsRead } = useCrm();

  if (!open) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'deal':
        return <Briefcase className="h-4 w-4 text-[#2563EB]" />;
      case 'lead':
        return <UserPlus className="h-4 w-4 text-[#6366F1]" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-[#F59E0B]" />;
      default:
        return <Sparkles className="h-4 w-4 text-[#10B981]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start"
      role="dialog"
      aria-modal="true"
      aria-label="مركز الإشعارات والإشارات"
    >
      <div className="fixed inset-0 bg-[#0F172A]/40" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] drawer-surface">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">الإشارات والتنبيهات</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllSignalsRead}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>تحديد الكل كمقروء</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق الإشارات"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
          {signals.map((sig) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => {
                navigate(sig.route);
                onClose();
              }}
              className={`flex w-full items-start gap-3 px-5 py-3.5 text-right transition-colors hover:bg-[#F8FAFC] ${
                sig.unread ? 'bg-[#EFF6FF]/40' : ''
              }`}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF]">
                {getCategoryIcon(sig.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">{sig.title}</p>
                  <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0 tabular-nums">
                    {sig.timeLabel}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#64748B]">{sig.description}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};
