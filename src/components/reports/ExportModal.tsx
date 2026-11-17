import React, { useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import type { ReportDefinition, ReportExecutionResult } from '../../types/reports';
import { resolveFieldValue } from '../../lib/reports/query-engine';

export type ExportFormatType = 'xls' | 'csv' | 'pdf';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportDefinition | null;
  executionResult?: ReportExecutionResult | null;
  onExportComplete?: (format: ExportFormatType, fileName: string) => void;
}

function escapeCsvCell(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str}"`;
  }
  return str;
}

function escapeHtml(val: any): string {
  if (val === undefined || val === null) return '—';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  report,
  executionResult,
  onExportComplete,
}) => {
  const [format, setFormat] = useState<ExportFormatType>('xls');
  const [includeChart, setIncludeChart] = useState<boolean>(true);
  const [includeRecordId, setIncludeRecordId] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    'landscape'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen || !report) return null;

  const rows = executionResult?.rows ?? [];
  const baseColumns =
    executionResult?.visibleColumns?.length
      ? executionResult.visibleColumns
      : report.selectedColumns;

  const finalColumns = includeRecordId
    ? Array.from(
        new Set([
          report.primaryModule === 'leads' ? 'unique_id' : 'leadUniqueId',
          ...baseColumns,
        ])
      )
    : baseColumns.filter(
        (col) => col !== 'unique_id' && col !== 'leadUniqueId' && col !== 'id'
      );

  const safeSlug = report.id || `riwaq_report_${Date.now()}`;

  const handleExecuteExport = () => {
    setIsExporting(true);

    try {
      if (format === 'csv') {
        // Real UTF-8 with BOM (\uFEFF) CSV download for Arabic Excel compatibility
        const headerLine = finalColumns.map(escapeCsvCell).join(',');
        const dataLines = rows.map((row) =>
          finalColumns
            .map((col) => escapeCsvCell(resolveFieldValue(row, col)))
            .join(',')
        );
        const summaryLine = executionResult?.grandTotals
          ? `\n"الإجمالي الكلي (Grand Total)","عدد السجلات: ${rows.length}"`
          : '';
        const csvString = `\uFEFF${headerLine}\n${dataLines.join('\n')}${summaryLine}`;
        const blob = new Blob([csvString], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `${safeSlug}.csv`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        onExportComplete?.('csv', fileName);
        onClose();
        return;
      }

      if (format === 'xls') {
        // Real Excel HTML/XLS Workbook download with RTL Arabic styling & Grand Totals
        const thCells = finalColumns
          .map(
            (col) =>
              `<th style="background:#1E3A8A;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #CBD5E1;text-align:right;">${escapeHtml(
                col
              )}</th>`
          )
          .join('');

        const bodyRows = rows
          .map((row, idx) => {
            const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            const tds = finalColumns
              .map(
                (col) =>
                  `<td style="background:${bg};padding:7px 12px;border:1px solid #E2E8F0;text-align:right;font-family:'Cairo',sans-serif;">${escapeHtml(
                    resolveFieldValue(row, col)
                  )}</td>`
              )
              .join('');
            return `<tr>${tds}</tr>`;
          })
          .join('');

        const grandTotalEntries = Object.entries(
          executionResult?.grandTotals ?? {}
        )
          .map(
            ([k, v]) =>
              `<span style="margin-left:16px;font-weight:bold;">${escapeHtml(
                k
              )}: ${escapeHtml(v)}</span>`
          )
          .join(' | ');

        const chartMetaRow =
          includeChart && executionResult?.chartData?.length
            ? `<div style="margin-bottom:12px;padding:10px;border:1px solid #DBEAFE;background:#EFF6FF;font-family:'Cairo',sans-serif;">
                 <strong>ملخص الرسم البياني المرافق:</strong>
                 ${executionResult.chartData
                   .map((pt) => `${escapeHtml(pt.label)} (${escapeHtml(pt.value)})`)
                   .join(' • ')}
               </div>`
            : '';

        const xlsHtml = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office"
                xmlns:x="urn:schemas-microsoft-com:office:excel"
                xmlns="http://www.w3.org/TR/REC-html40"
                dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8" />
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>${escapeHtml(report.name.slice(0, 28))}</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayRightToLeft/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
          </head>
          <body dir="rtl" style="font-family:'Cairo',Tahoma,sans-serif;">
            <h2 style="color:#0F172A;margin-bottom:4px;">${escapeHtml(
              report.name
            )}</h2>
            <p style="color:#475569;margin-top:0;margin-bottom:12px;">${escapeHtml(
              report.description
            )} — إجمالي السجلات: ${rows.length}</p>
            ${chartMetaRow}
            <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;direction:rtl;">
              <thead>
                <tr>${thCells}</tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="${Math.max(
                    1,
                    finalColumns.length
                  )}" style="background:#EFF6FF;color:#1E3A8A;font-weight:bold;padding:10px;border:1px solid #BFDBFE;">
                    الإجمالي الكلي (Grand Total): ${grandTotalEntries}
                  </td>
                </tr>
              </tfoot>
            </table>
          </body>
          </html>
        `;

        const blob = new Blob(['\uFEFF', xlsHtml], {
          type: 'application/vnd.ms-excel;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `${safeSlug}.xls`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        onExportComplete?.('xls', fileName);
        onClose();
        return;
      }

      if (format === 'pdf') {
        // Inject dynamic @page orientation rule and trigger native browser Print-to-PDF
        const styleId = 'riwaq-dynamic-print-orientation';
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `@media print { @page { size: A4 ${orientation}; margin: 12mm; } }`;

        onExportComplete?.('pdf', `${safeSlug}.pdf`);
        onClose();
        window.setTimeout(() => {
          window.print();
        }, 120);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-[1px]"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="export-modal-title"
                className="text-[16px] font-extrabold text-[#0F172A]"
              >
                تصدير وطباعة التقرير
              </h2>
              <p className="text-[12px] text-[#64748B] truncate max-w-xs">
                {report.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="block text-[12px] font-extrabold text-[#0F172A]">
              اختر صيغة التصدير
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                {
                  key: 'xls' as const,
                  title: 'Excel (.xls)',
                  sub: 'جدول منسق مع المجاميع',
                  icon: FileSpreadsheet,
                },
                {
                  key: 'csv' as const,
                  title: 'CSV (UTF-8 BOM)',
                  sub: 'متوافق 100% مع العربية',
                  icon: FileText,
                },
                {
                  key: 'pdf' as const,
                  title: 'PDF (طباعة RTL)',
                  sub: 'تخطيط رسمي جاهز للطباعة',
                  icon: Printer,
                },
              ].map((item) => {
                const IconComp = item.icon;
                const active = format === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFormat(item.key)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-right transition-all cursor-pointer ${
                      active
                        ? 'border-[#2563EB] bg-[#EFF6FF]/60 ring-1 ring-[#2563EB]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <IconComp
                        className={`h-5 w-5 ${
                          active ? 'text-[#2563EB]' : 'text-[#64748B]'
                        }`}
                      />
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          active
                            ? 'border-[#2563EB] bg-[#2563EB] text-[#FFFFFF]'
                            : 'border-[#CBD5E1]'
                        }`}
                      >
                        {active && <Check className="h-2.5 w-2.5" />}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <p className="text-[12px] font-extrabold text-[#0F172A]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#64748B]">
                        {item.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
            <p className="text-[12px] font-extrabold text-[#0F172A]">
              خيارات محتوى الملف المصدّر
            </p>

            <label className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#334155] cursor-pointer">
              <span>تضمين ملخص الرسم البياني المرافق</span>
              <input
                type="checkbox"
                checked={includeChart}
                onChange={(e) => setIncludeChart(e.target.checked)}
                className="h-4 w-4 accent-[#2563EB]"
              />
            </label>

            <label className="flex items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5 text-[12px] font-semibold text-[#334155] cursor-pointer">
              <span>تضمين معرّف السجل الموحد (RWQ-ID) في العمود الأول</span>
              <input
                type="checkbox"
                checked={includeRecordId}
                onChange={(e) => setIncludeRecordId(e.target.checked)}
                className="h-4 w-4 accent-[#2563EB]"
              />
            </label>

            {format === 'pdf' && (
              <div className="border-t border-[#F1F5F9] pt-3 space-y-2">
                <label className="block text-[11px] font-extrabold text-[#0F172A]">
                  اتجاه الصفحة (PDF Orientation)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'landscape' as const, label: 'أفقي (Landscape - موصى به للجداول)' },
                    { key: 'portrait' as const, label: 'عمودي (Portrait)' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setOrientation(opt.key)}
                      className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                        orientation === opt.key
                          ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Single Sticky Bottom Bar */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4">
          <span className="text-[11px] font-bold text-[#64748B] tabular-nums">
            إجمالي السجلات الجاهزة للتصدير: {rows.length} سجل
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExecuteExport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 py-2 text-[12px] font-extrabold text-[#FFFFFF] shadow-xs transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>
                {format === 'pdf'
                  ? 'معاينة وطباعة PDF'
                  : `تنزيل ملف ${format.toUpperCase()}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
