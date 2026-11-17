import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, List } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { UnifiedCalendarModule } from '../components/calendar/UnifiedCalendarModule';

export const CalendarPage: React.FC = () => {
  const { currentOrgId } = useCrm();

  return (
    <div dir="rtl" className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 min-h-screen bg-[#F8FAFC] pb-12">
      {/* Flush White Page Header */}
      <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] mb-0.5">
                <Link to="/" className="hover:text-[#2563EB] font-semibold">
                  لوحة القيادة
                </Link>
                <span>/</span>
                <Link to="/activities" className="hover:text-[#2563EB] font-semibold">
                  المهام والأنشطة
                </Link>
                <span>/</span>
                <span className="font-bold text-[#0F172A]">
                  التقويم الموحد (Calendar Module)
                </span>
                <span>•</span>
                <span className="rounded bg-[#EFF6FF] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                  {currentOrgId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[19px] sm:text-[21px] font-extrabold text-[#0F172A] leading-tight">
                  وحدة عرض التقويم الموحدة (Unified Calendar Module)
                </h1>
                <span className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                  تزامن لحظي: المهام + الاجتماعات + الصفقات
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                تخطيط وجدولة تفاعلية تربط المهام التنفيذية، اجتماعات العملاء (Zoom / Meet)، ومواعيد إغلاق الصفقات المستهدفة في عرض شهري وأسبوعي موحد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/activities"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] px-3.5 text-[12px] font-bold text-[#0F172A] transition-colors"
            >
              <List className="h-4 w-4 text-[#2563EB]" />
              <span>عرض قائمة المهام والأنشطة</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Calendar Workspace (`w-full px-6 py-5`) */}
      <div className="w-full px-6 py-5">
        <UnifiedCalendarModule defaultView="week" />
      </div>
    </div>
  );
};
