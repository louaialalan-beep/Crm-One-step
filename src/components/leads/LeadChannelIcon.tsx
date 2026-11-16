import React from 'react';
import {
  Camera,
  Globe,
  MessageCircle,
  MessagesSquare,
  Phone,
  Users,
} from 'lucide-react';
import type { LeadChannel } from '../../types/crm';
import { CHANNEL_LABELS } from '../../utils/leadsLogic';

export function getArabicInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ر';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`;
}

export const LeadChannelBadge: React.FC<{ channel?: LeadChannel; compact?: boolean }> = ({
  channel = 'website',
  compact = false,
}) => {
  const config: Record<
    LeadChannel,
    { icon: React.ReactNode; bg: string; text: string; border: string }
  > = {
    whatsapp: {
      icon: <MessageCircle className="h-3.5 w-3.5" />,
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#059669]',
      border: 'border-[#A7F3D0]',
    },
    instagram: {
      icon: <Camera className="h-3.5 w-3.5" />,
      bg: 'bg-[#FFF1F2]',
      text: 'text-[#E11D48]',
      border: 'border-[#FECDD3]',
    },
    messenger: {
      icon: <MessagesSquare className="h-3.5 w-3.5" />,
      bg: 'bg-[#EFF6FF]',
      text: 'text-[#2563EB]',
      border: 'border-[#BFDBFE]',
    },
    website: {
      icon: <Globe className="h-3.5 w-3.5" />,
      bg: 'bg-[#F1F5F9]',
      text: 'text-[#475569]',
      border: 'border-[#CBD5E1]',
    },
    phone: {
      icon: <Phone className="h-3.5 w-3.5" />,
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#D97706]',
      border: 'border-[#FDE68A]',
    },
    referral: {
      icon: <Users className="h-3.5 w-3.5" />,
      bg: 'bg-[#EEF2FF]',
      text: 'text-[#4F46E5]',
      border: 'border-[#C7D2FE]',
    },
  };

  const c = config[channel] ?? config.website;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${c.bg} ${c.text} ${c.border}`}
    >
      {c.icon}
      {!compact && <span>{CHANNEL_LABELS[channel] ?? 'الموقع'}</span>}
    </span>
  );
};
