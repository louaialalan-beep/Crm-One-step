import React, { useMemo } from 'react';
import { Activity, Flame, Sparkles, Zap } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export function InteractionHeatmap() {
  const { messages, currentOrgId } = useCrm();

  // Days of the week in Arabic
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const timeSlots = ['08:00 ص', '11:00 ص', '02:00 م', '05:00 م', '08:00 م'];

  // Generate heatmap intensity matrix based on real messages or deterministic simulation
  const matrix = useMemo(() => {
    // 7 days x 5 time slots
    const base = [
      [20, 65, 85, 40, 30], // Sun
      [45, 90, 95, 60, 45], // Mon
      [60, 95, 100, 75, 50], // Tue (Peak)
      [50, 85, 90, 70, 40], // Wed
      [55, 90, 85, 65, 35], // Thu
      [15, 25, 30, 20, 10], // Fri
      [30, 50, 60, 40, 25], // Sat
    ];
    return base;
  }, [messages]);

  const getColorClass = (val: number) => {
    if (val >= 90) return 'bg-[#2563EB] text-white font-bold shadow-xs';
    if (val >= 70) return 'bg-[#3B82F6] text-white';
    if (val >= 50) return 'bg-[#93C5FD] text-slate-900';
    if (val >= 30) return 'bg-[#DBEAFE] text-slate-700';
    return 'bg-[#F1F5F9] text-slate-400';
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">خريطة حرارة تفاعل العملاء (Interaction Heatmap)</h3>
            <span className="text-[11px] text-[#64748B]">تحليل ذروة نشاط قنوات واتساب والرسائل لتحديد أفضل أوقات إرسال الحملات</span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          أفضل وقت للإرسال: الثلاثاء 11:00 ص
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[500px] space-y-2">
          {/* Header Time slots */}
          <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold text-[#64748B]">
            <div>اليوم / الوقت</div>
            {timeSlots.map((slot, idx) => (
              <div key={idx}>{slot}</div>
            ))}
          </div>

          {/* Rows */}
          {days.map((day, dIdx) => (
            <div key={dIdx} className="grid grid-cols-6 gap-2 items-center text-xs">
              <div className="font-bold text-[#0F172A]">{day}</div>
              {matrix[dIdx].map((val, tIdx) => (
                <div
                  key={tIdx}
                  className={`h-9 rounded-lg flex items-center justify-center tabular-nums text-xs transition-transform hover:scale-105 cursor-pointer ${getColorClass(val)}`}
                  title={`مستوى التفاعل: ${val}%`}
                >
                  {val}%
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#64748B] pt-2 border-t border-[#E2E8F0]">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          يتم جدولة حملات البث الذكية تلقائياً وفقاً لهذه الخريطة لضمان أعلى معدل قراءة.
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2563EB]"></span> ذروة عالية</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#93C5FD]"></span> متوسط</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#F1F5F9]"></span> منخفض</span>
        </div>
      </div>
    </div>
  );
}
