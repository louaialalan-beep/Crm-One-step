export type ReportType = 'tabular' | 'summary' | 'matrix' | 'joined';

export type ModuleName =
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'deals'
  | 'touchpoints'
  | 'campaigns'
  | 'quotes'
  | 'sales_orders'
  | 'invoices'
  | 'tasks'
  | 'calls'
  | 'whatsapp_messages'
  | 'stage_history'
  | 'order_attributions';

export type JoinType = 'inclusive' | 'exclusive';

export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type DateGroupingGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list';

export interface BucketRange {
  label: string;
  min?: number;
  max?: number;
}

export interface BucketColumn {
  id: string;
  label: string;
  sourceField: string;
  ranges: BucketRange[];
  defaultLabel: string;
}

export interface FormulaColumn {
  id: string;
  label: string;
  expression: string;
  returnType: 'number' | 'currency' | 'percentage';
}

export interface RelatedModuleJoin {
  module: ModuleName;
  joinType: JoinType;
  foreignKey: string;
  primaryKey?: string;
}

export interface ReportGroupingField {
  field: string;
  dateGranularity?: DateGroupingGranularity;
  label?: string;
}

export interface ReportAggregationSpec {
  field: string;
  fn: AggregateFunction;
  label: string;
}

export interface ReportDateFilter {
  field: string;
  preset:
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'this_month'
    | 'this_quarter'
    | 'this_year'
    | 'all_time'
    | 'custom'
    | string;
  customStart?: string;
  customEnd?: string;
}

export interface ReportCriterion {
  index: number;
  field: string;
  operator: FilterOperator;
  value: any;
}

export type ReportChartType =
  | 'bar'
  | 'column'
  | 'line'
  | 'pie'
  | 'donut'
  | 'funnel'
  | 'stacked_bar';

export interface ReportChartConfig {
  enabled: boolean;
  type: ReportChartType;
  xAxisField: string;
  yAxisMetric: string;
  secondaryGroupingField?: string;
  showLabels: boolean;
}

export interface ReportSharingConfig {
  scope: 'only_me' | 'everyone' | 'selected';
  userIds?: string[];
  roleIds?: string[];
}

export interface JoinedReportBlock {
  id: string;
  title: string;
  primaryModule: ModuleName;
  relatedModules?: RelatedModuleJoin[];
  selectedColumns: string[];
  aggregations: ReportAggregationSpec[];
  criteria?: ReportCriterion[];
  criteriaPattern?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  folderId: string;
  reportType: ReportType;
  primaryModule: ModuleName;
  relatedModules: RelatedModuleJoin[];
  selectedColumns: string[];
  groupByRows: ReportGroupingField[];
  groupByColumns?: ReportGroupingField[];
  aggregations: ReportAggregationSpec[];
  buckets?: BucketColumn[];
  formulas?: FormulaColumn[];
  dateFilter?: ReportDateFilter;
  criteria: ReportCriterion[];
  criteriaPattern?: string;
  chartConfig?: ReportChartConfig;
  joinedBlocks?: JoinedReportBlock[];
  sharing: ReportSharingConfig;
  isFavorite: boolean;
  isStandard: boolean;
  createdBy: string;
  lastRunAt?: string;
  org_id?: string;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  reportName: string;
  org_id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  deliveryTime: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  format: 'csv' | 'xlsx' | 'pdf';
  recipientEmails: string[];
  recipientUserIds: string[];
  active: boolean;
  lastSentAt?: string;
  nextRunAt: string;
  createdBy: string;
}

export interface ReportFolder {
  id: string;
  name: string;
  description: string;
  iconName?: string;
  isSystem: boolean;
  sortOrder: number;
  sharing?: ReportSharingConfig;
}

export interface UserSecurityContext {
  userId: string;
  roleId: string;
  subordinateUserIds: string[];
  canViewAllModules: ModuleName[];
  hiddenFieldsByModule: Record<ModuleName, string[]>;
}

export type ComputedAggregateMap = Record<string, number>;

export interface SummaryGroupNode {
  groupKey: string;
  groupField: string;
  groupValue: string;
  level: number;
  rowCount: number;
  recordIds: string[];
  subtotals: ComputedAggregateMap;
  rows: Record<string, any>[];
  children?: SummaryGroupNode[];
}

export interface MatrixCellResult {
  rowKey: string;
  colKey: string;
  rowCount: number;
  recordIds: string[];
  aggregates: ComputedAggregateMap;
}

export interface MatrixExecutionGrid {
  rowHeaders: string[];
  columnHeaders: string[];
  cells: Record<string, Record<string, MatrixCellResult>>;
  rowTotals: Record<string, ComputedAggregateMap>;
  columnTotals: Record<string, ComputedAggregateMap>;
  grandTotals: ComputedAggregateMap;
}

export interface JoinedBlockExecutionResult {
  blockId: string;
  title: string;
  primaryModule: ModuleName;
  visibleColumns: string[];
  rows: Record<string, any>[];
  subtotalsByGroup: Record<string, ComputedAggregateMap>;
  grandTotals: ComputedAggregateMap;
}

export interface ChartDataPoint {
  key: string;
  label: string;
  value: number;
  secondarySeries?: Record<string, number>;
  recordCount: number;
  recordIds: string[];
}

export interface ReportExecutionResult {
  reportId: string;
  reportName: string;
  reportType: ReportType;
  executedAt: string;
  visibleColumns: string[];
  strippedHiddenColumns: string[];
  totalRecordsMatched: number;
  rows: Record<string, any>[];
  grandTotals: ComputedAggregateMap;
  summaryGroups?: SummaryGroupNode[];
  matrixGrid?: MatrixExecutionGrid;
  joinedBlocks?: JoinedBlockExecutionResult[];
  chartData?: ChartDataPoint[];
  drillDownMap: Record<string, string[]>;
}
