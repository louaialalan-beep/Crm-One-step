export interface PinnedReportWidget {
  id: string;
  org_id: string;
  reportId: string;
  title: string;
  folderLabel: string;
  reportType: 'summary' | 'tabular';
  firstTouchRevenue: number;
  lastTouchRevenue: number;
  totalLeads: number;
  totalDeals: number;
  roas: number;
  pinnedAt: string;
}

const STORAGE_KEY_PREFIX = 'riwaq_pinned_reports_';
export const PINNED_REPORTS_EVENT = 'riwaq-pinned-reports-updated';

const DEFAULT_PINNED_REPORTS: Omit<PinnedReportWidget, 'org_id'>[] = [
  {
    id: 'pin_default_meta_roas',
    reportId: 'rep_meta_attribution_roas',
    title: 'تقرير إسناد إيرادات ميتا (First-Touch vs Last-Touch & ROAS)',
    folderLabel: 'تقارير ميتا والمصادر',
    reportType: 'summary',
    firstTouchRevenue: 825000,
    lastTouchRevenue: 1185000,
    totalLeads: 184,
    totalDeals: 34,
    roas: 5.4,
    pinnedAt: 'مثبت في لوحة القيادة',
  },
];

export function getPinnedReportsForOrg(orgId: string): PinnedReportWidget[] {
  if (typeof window === 'undefined') {
    return DEFAULT_PINNED_REPORTS.map((r) => ({ ...r, org_id: orgId }));
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgId}`);
    if (!raw) {
      return DEFAULT_PINNED_REPORTS.map((r) => ({ ...r, org_id: orgId }));
    }
    const parsed = JSON.parse(raw) as PinnedReportWidget[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return DEFAULT_PINNED_REPORTS.map((r) => ({ ...r, org_id: orgId }));
  }
}

export function savePinnedReportsForOrg(
  orgId: string,
  widgets: PinnedReportWidget[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${orgId}`,
      JSON.stringify(widgets)
    );
    window.dispatchEvent(new CustomEvent(PINNED_REPORTS_EVENT, { detail: { orgId } }));
  } catch {
    // ignore storage errors
  }
}

export function togglePinReportForOrg(
  orgId: string,
  widget: Omit<PinnedReportWidget, 'org_id'>
): { pinned: boolean; list: PinnedReportWidget[] } {
  const current = getPinnedReportsForOrg(orgId);
  const exists = current.some((w) => w.reportId === widget.reportId);
  let next: PinnedReportWidget[];
  if (exists) {
    next = current.filter((w) => w.reportId !== widget.reportId);
  } else {
    next = [{ ...widget, org_id: orgId }, ...current];
  }
  savePinnedReportsForOrg(orgId, next);
  return { pinned: !exists, list: next };
}
