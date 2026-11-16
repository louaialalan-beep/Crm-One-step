import React from 'react';

export type BadgeTone = 'won' | 'hold' | 'lost' | 'qualified' | 'insight' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  won: 'text-[#10B981] bg-[#ECFDF5] border-[#A7F3D0]',
  hold: 'text-[#F59E0B] bg-[#FFFBEB] border-[#FDE68A]',
  lost: 'text-[#F43F5E] bg-[#FFF1F2] border-[#FECDD3]',
  qualified: 'text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]',
  insight: 'text-[#6366F1] bg-[#EEF2FF] border-[#C7D2FE]',
  neutral: 'text-[#475569] bg-[#F1F5F9] border-[#E2E8F0]',
};

export function resolveStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'مكتملة':
    case 'مؤهل للتحويل':
    case 'نشط':
    case 'مفعل':
      return 'won';
    case 'مؤجلة':
    case 'قيد التجهيز':
    case 'قيد التنفيذ':
    case 'قيد التواصل':
    case 'تم التواصل':
    case 'مرسل':
    case 'تفاوض':
      return 'hold';
    case 'خسارة':
    case 'متأخرة':
    case 'غير مهتم':
      return 'lost';
    case 'مؤهل':
    case 'عرض سعر':
    case 'استراتيجي':
      return 'qualified';
    case 'جديد':
    case 'تأهيل مبدئي':
    case 'تحديد الاحتياج':
      return 'insight';
    default:
      return 'neutral';
  }
}

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone }) => {
  const resolved = tone ?? resolveStatusTone(label);
  return (
    <span
      className={`inline-flex h-[22px] items-center justify-center rounded border px-2 text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 ${TONE_CLASSES[resolved]}`}
    >
      {label}
    </span>
  );
};
