import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, PieChart, X } from 'lucide-react';
import type { Contact, Deal, Touchpoint } from '../../types/crm';
import {
  aggregateDealsForChart,
  type DealChartBucket,
  type DealChartGroupBy,
  type DealChartMeasure,
  type DealChartType,
} from '../../utils/dealsLogic';
import { formatCurrencySAR } from '../../utils/formatters';

interface DealsChartViewProps {
  deals: Deal[];
  contacts: Contact[];
  touchpoints: Touchpoint[];
  canViewAmount: boolean;
}

const CHART_PALETTE = [
  '#2563EB',
  '#3B82F6',
  '#10B981',
  '#6366F1',
  '#F59E0B',
  '#E11D48',
];

export const DealsChartView: React.FC<DealsChartViewProps> = ({
  deals,
  contacts,
  touchpoints,
  canViewAmount,
}) => {
  const [groupBy, setGroupBy] = useState<DealChartGroupBy>('stage');
  const [measure, setMeasure] = useState<DealChartMeasure>(
    canViewAmount ? 'amount' : 'count'
  );
  const [chartType, setChartType] = useState<DealChartType>('bar');
  const [drillBucket, setDrillBucket] = useState<DealChartBucket | null>(null);

  const effectiveMeasure: DealChartMeasure = canViewAmount ? measure : 'count';

  const buckets = useMemo(
    () =>
      aggregateDealsForChart(
        deals,
        contacts,
        touchpoints,
        groupBy,
        effectiveMeasure
      ),
    [contacts, deals, effectiveMeasure, groupBy, touchpoints]
  );

  const maxValue = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.value)),
    [buckets]
  );
  const totalValue = useMemo(
    () => buckets.reduce((sum, b) => sum + b.value, 0),
    [buckets]
  );

  const drillDeals = useMemo(() => {
    if (!drillBucket) return [];
    const idSet = new Set(drillBucket.dealIds);
    return deals.filter((d) => idSet.has(d.id));
  }, [deals, drillBucket]);

  const formatMetricValue = (val: number) => {
    if (effectiveMeasure === 'count') return `${val} صفقة`;
    return formatCurrencySAR(val);
  };

  // Compute SVG donut / pie segments
  const pieSegments = useMemo(() => {
    const safeTotal = totalValue > 0 ? totalValue : 1;
    let cumulativePercent = 0;
    return buckets.map((bucket, idx) => {
      const percent = (bucket.value / safeTotal) * 100;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return {
        bucket,
        percent,
        start,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
      };
    });
  }, [buckets, totalValue]);

  return (
    <div className="space-y-4">
      {/* Chart Config Bar */}
      <div className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-[#64748B]">تجميع حسب:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as DealChartGroupBy)}
              aria-label="تجميع المخطط حسب"
              className="rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-1.5 text-[12px] font-semibold text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="stage">مرحلة المسار</option>
              <option value="ownerName">مسؤول المبيعات</option>
              <option value="attribution">مصدر الإسناد (Last-Touch)</option>
              <option value="accountName">الشركة / الحساب</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-[#64748B]">المقياس:</span>
            <select
              value={effectiveMeasure}
              onChange={(e) => setMeasure(e.target.value as DealChartMeasure)}
              aria-label="المقياس الإحصائي"
              className="rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-1.5 text-[12px] font-semibold text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
            >
              {canViewAmount && (
                <>
                  <option value="amount">إجمالي القيمة المالية (ر.س)</option>
                  <option value="weighted">العائد المرجح حسب الاحتمالية (ر.س)</option>
                </>
              )}
              <option value="count">عدد الصفقات</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#64748B]">نوع المخطط:</span>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as DealChartType)}
            aria-label="نوع الرسم البياني"
            className="rounded-xl border border-[#CBD5E1] bg-[#ffffff] px-3 py-1.5 text-[12px] font-semibold text-[#131b2e] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="bar">أعمدة رأسية (Column)</option>
            <option value="horizontal">أشرطة أفقية (Bar)</option>
            <option value="pie">دائري (Pie)</option>
            <option value="donut">مجوف (Donut)</option>
          </select>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="rounded-2xl bg-[#ffffff] border border-[#E2E8F0] p-6 shadow-2xs">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            {chartType === 'pie' || chartType === 'donut' ? (
              <PieChart className="h-5 w-5 text-[#2563EB]" />
            ) : (
              <BarChart3 className="h-5 w-5 text-[#2563EB]" />
            )}
            <div>
              <h2 className="text-[15px] font-bold text-[#131b2e]">
                تحليل أداء مسار الصفقات ({deals.length} صفقة)
              </h2>
              <p className="text-[11px] text-[#64748B]">
                انقر على أي عمود أو شريحة لعرض قائمة الصفقات المطابقة (Drill-Down)
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-1.5 text-[12px] font-bold text-[#131b2e] tabular-nums">
            الإجمالي: {formatMetricValue(totalValue)}
          </div>
        </div>

        {buckets.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#64748B]">
            لا توجد بيانات كافية للعرض البياني.
          </div>
        ) : chartType === 'bar' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 items-end pt-6 pb-2 min-h-[280px]">
            {buckets.map((bucket, idx) => {
              const heightPercent = Math.max(10, Math.round((bucket.value / maxValue) * 100));
              const color = CHART_PALETTE[idx % CHART_PALETTE.length];
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => setDrillBucket(bucket)}
                  className="group flex flex-col items-center gap-2 focus:outline-none"
                >
                  <span className="text-[11px] font-bold text-[#131b2e] tabular-nums">
                    {formatMetricValue(bucket.value)}
                  </span>
                  <div className="w-full max-w-[84px] h-44 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-end p-1.5 group-hover:border-[#2563EB] transition-colors">
                    <div
                      className="w-full rounded-lg transition-all duration-500 group-hover:opacity-90"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] font-bold text-[#131b2e] group-hover:text-[#2563EB] block truncate max-w-[130px]">
                      {bucket.label}
                    </span>
                    <span className="text-[10px] text-[#64748B] tabular-nums">
                      {bucket.count} صفقة
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : chartType === 'horizontal' ? (
          <div className="space-y-3.5">
            {buckets.map((bucket, idx) => {
              const widthPercent = Math.max(6, Math.round((bucket.value / maxValue) * 100));
              const color = CHART_PALETTE[idx % CHART_PALETTE.length];
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => setDrillBucket(bucket)}
                  className="w-full text-right group block rounded-xl p-2 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-bold text-[#131b2e] group-hover:text-[#2563EB]">
                      {bucket.label} ({bucket.count})
                    </span>
                    <span className="font-bold text-[#334155] tabular-nums">
                      {formatMetricValue(bucket.value)}
                    </span>
                  </div>
                  <div className="h-3.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-4">
            <div className="flex justify-center">
              <svg viewBox="0 0 200 200" className="w-56 h-56 -rotate-90">
                {pieSegments.map((seg) => {
                  const radius = 72;
                  const circumference = 2 * Math.PI * radius;
                  const strokeLength = (seg.percent / 100) * circumference;
                  const dashOffset = -((seg.start / 100) * circumference);
                  return (
                    <circle
                      key={seg.bucket.key}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={chartType === 'donut' ? 32 : 70}
                      strokeDasharray={`${strokeLength} ${circumference}`}
                      strokeDashoffset={dashOffset}
                      onClick={() => setDrillBucket(seg.bucket)}
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                    />
                  );
                })}
              </svg>
            </div>

            <div className="space-y-2">
              {pieSegments.map((seg) => (
                <button
                  key={seg.bucket.key}
                  type="button"
                  onClick={() => setDrillBucket(seg.bucket)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] hover:border-[#2563EB] px-3.5 py-2.5 text-right transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[12px] font-bold text-[#131b2e] truncate">
                      {seg.bucket.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 tabular-nums text-[12px]">
                    <span className="text-[#64748B]">
                      {Math.round(seg.percent)}% ({seg.bucket.count})
                    </span>
                    <span className="font-bold text-[#2563EB]">
                      {formatMetricValue(seg.bucket.value)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drill-Down Modal */}
      {drillBucket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deals-drilldown-title"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#ffffff] border border-[#E2E8F0] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div>
                <h3
                  id="deals-drilldown-title"
                  className="text-[15px] font-bold text-[#131b2e]"
                >
                  الصفقات المطابقة: {drillBucket.label}
                </h3>
                <p className="text-[11px] text-[#64748B] tabular-nums">
                  {drillDeals.length} صفقة ·{' '}
                  {canViewAmount
                    ? `الإجمالي ${formatCurrencySAR(drillBucket.totalAmount)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrillBucket(null)}
                aria-label="إغلاق نافذة التفاصيل"
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#E2E8F0]/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 max-h-[65vh] overflow-y-auto">
              <table className="w-full text-right text-[12px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#64748B]">
                    <th className="py-2 px-2">الصفقة</th>
                    <th className="py-2 px-2">الشركة</th>
                    <th className="py-2 px-2">المرحلة</th>
                    <th className="py-2 px-2">القيمة</th>
                    <th className="py-2 px-2">المسؤول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {drillDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-2">
                        <Link
                          to={`/deals/${deal.id}`}
                          onClick={() => setDrillBucket(null)}
                          className="font-bold text-[#2563EB] hover:underline"
                        >
                          {deal.title}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-[#475569]">{deal.accountName}</td>
                      <td className="py-2.5 px-2 font-semibold text-[#131b2e]">
                        {deal.stage}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-[#2563EB] tabular-nums">
                        {canViewAmount
                          ? formatCurrencySAR(deal.amount, deal.currency)
                          : 'محجوب'}
                      </td>
                      <td className="py-2.5 px-2 text-[#475569]">{deal.ownerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
