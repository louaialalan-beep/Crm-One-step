import type {
  AggregateFunction,
  BucketColumn,
  ChartDataPoint,
  ComputedAggregateMap,
  DateGroupingGranularity,
  FilterOperator,
  FormulaColumn,
  JoinedBlockExecutionResult,
  MatrixCellResult,
  MatrixExecutionGrid,
  ModuleName,
  RelatedModuleJoin,
  ReportAggregationSpec,
  ReportCriterion,
  ReportDateFilter,
  ReportDefinition,
  ReportExecutionResult,
  ReportGroupingField,
  SummaryGroupNode,
  UserSecurityContext,
} from '../../types/reports';

const ARABIC_MONTH_NAMES: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
};

/**
 * Safely resolves a field value from a record, supporting both direct keys
 * (`row['amount']`), prefixed keys (`row['deals.amount']`), and nested dot paths.
 */
export function resolveFieldValue(row: Record<string, any>, fieldPath: string): any {
  if (!row || !fieldPath) return undefined;
  if (fieldPath in row) {
    return row[fieldPath];
  }
  const stripped = fieldPath.includes('.') ? fieldPath.split('.').slice(1).join('.') : fieldPath;
  if (stripped in row) {
    return row[stripped];
  }
  const parts = fieldPath.split('.');
  let current: any = row;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Converts a date string or timestamp into a Date object, or null if invalid.
 */
function parseDateValue(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'object' && typeof raw.toDate === 'function') {
    const converted = raw.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Formats a date value according to the requested DateGroupingGranularity in Arabic/ISO format.
 */
export function formatDateByGranularity(
  rawValue: any,
  granularity?: DateGroupingGranularity
): string {
  if (!granularity) {
    return rawValue == null || rawValue === '' ? 'غير محدد' : String(rawValue);
  }
  const dateObj = parseDateValue(rawValue);
  if (!dateObj) {
    return rawValue == null || rawValue === '' ? 'غير محدد' : String(rawValue);
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  switch (granularity) {
    case 'day':
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'week': {
      const weekOfMonth = Math.min(4, Math.floor((day - 1) / 7) + 1);
      return `الأسبوع ${weekOfMonth} - ${ARABIC_MONTH_NAMES[month] ?? month} ${year}`;
    }
    case 'month':
      return `${ARABIC_MONTH_NAMES[month] ?? month} ${year}`;
    case 'quarter': {
      const quarter = Math.floor((month - 1) / 3) + 1;
      const quarterNames: Record<number, string> = {
        1: 'الربع الأول (Q1)',
        2: 'الربع الثاني (Q2)',
        3: 'الربع الثالث (Q3)',
        4: 'الربع الرابع (Q4)',
      };
      return `${quarterNames[quarter]} ${year}`;
    }
    case 'year':
      return `${year}`;
    default:
      return String(rawValue);
  }
}

/**
 * Step 1: Enforce Role Hierarchy & Field-Level Security (FLS).
 */
function filterRecordsBySecurity(
  records: Record<string, any>[],
  moduleName: ModuleName,
  security: UserSecurityContext
): Record<string, any>[] {
  const canViewAll = security.canViewAllModules.includes(moduleName);
  if (canViewAll) {
    return records;
  }

  const allowedOwners = new Set<string>([
    security.userId,
    ...(security.subordinateUserIds || []),
  ]);

  return records.filter((rec) => {
    const ownerId = rec.ownerId ?? rec.assignedTo ?? rec.createdBy;
    if (!ownerId) return true;
    return allowedOwners.has(String(ownerId));
  });
}

function buildHiddenFieldsSet(
  primaryModule: ModuleName,
  relatedModules: RelatedModuleJoin[],
  security: UserSecurityContext
): Set<string> {
  const hiddenSet = new Set<string>();
  const modulesToCheck: ModuleName[] = [
    primaryModule,
    ...relatedModules.map((r) => r.module),
  ];

  for (const mod of modulesToCheck) {
    const fields = security.hiddenFieldsByModule?.[mod] ?? [];
    for (const f of fields) {
      hiddenSet.add(f);
      hiddenSet.add(`${mod}.${f}`);
    }
  }
  return hiddenSet;
}

function stripHiddenFieldsFromRow(
  row: Record<string, any>,
  hiddenFields: Set<string>
): Record<string, any> {
  if (hiddenFields.size === 0) return { ...row };
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    const bareKey = key.includes('.') ? key.split('.').slice(1).join('.') : key;
    if (!hiddenFields.has(key) && !hiddenFields.has(bareKey)) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Step 2: Join Related Modules (`inclusive` = Left Join, `exclusive` = Inner Join).
 */
function joinRelatedModules(
  primaryRows: Record<string, any>[],
  primaryModule: ModuleName,
  relatedModules: RelatedModuleJoin[],
  dataset: Record<ModuleName, any[]>,
  security: UserSecurityContext
): Record<string, any>[] {
  let currentRows: Record<string, any>[] = primaryRows.map((row) => {
    const seeded: Record<string, any> = { ...row };
    for (const [k, v] of Object.entries(row)) {
      seeded[`${primaryModule}.${k}`] = v;
    }
    return seeded;
  });

  for (const rel of relatedModules) {
    const rawRelated = dataset[rel.module] ?? [];
    const securedRelated = filterRecordsBySecurity(rawRelated, rel.module, security);
    const nextRows: Record<string, any>[] = [];

    for (const parentRow of currentRows) {
      const parentIdentifiers = new Set<string>(
        [
          parentRow[rel.primaryKey || 'id'],
          parentRow.id,
          parentRow.unique_id,
          parentRow.leadUniqueId,
          parentRow.accountId,
          parentRow.contactId,
          parentRow.dealId,
          parentRow[rel.foreignKey],
        ]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .map((v) => String(v))
      );

      const matches = securedRelated.filter((child) => {
        const fkValue = child[rel.foreignKey];
        if (fkValue !== undefined && fkValue !== null && parentIdentifiers.has(String(fkValue))) {
          return true;
        }
        const fallbackKeys = ['leadUniqueId', 'unique_id', 'dealId', 'accountId', 'contactId', 'leadId'];
        for (const k of fallbackKeys) {
          if (child[k] !== undefined && child[k] !== null && parentIdentifiers.has(String(child[k]))) {
            return true;
          }
        }
        return false;
      });

      if (matches.length > 0) {
        for (const child of matches) {
          const merged: Record<string, any> = { ...parentRow };
          for (const [cKey, cVal] of Object.entries(child)) {
            merged[`${rel.module}.${cKey}`] = cVal;
            if (!(cKey in merged)) {
              merged[cKey] = cVal;
            }
          }
          nextRows.push(merged);
        }
      } else if (rel.joinType === 'inclusive') {
        nextRows.push({ ...parentRow });
      }
    }

    currentRows = nextRows;
  }

  return currentRows;
}

/**
 * Step 3A: Evaluate Date Filter Presets.
 */
function matchesDateFilter(
  row: Record<string, any>,
  dateFilter?: ReportDateFilter,
  referenceNow: Date = new Date('2026-11-17T12:00:00Z')
): boolean {
  if (!dateFilter || !dateFilter.field || !dateFilter.preset || dateFilter.preset === 'all_time') {
    return true;
  }

  const rawDate = resolveFieldValue(row, dateFilter.field);
  const recordDate = parseDateValue(rawDate);
  if (!recordDate) return false;

  const refYear = referenceNow.getFullYear();
  const refMonth = referenceNow.getMonth();
  const refDay = referenceNow.getDate();

  switch (dateFilter.preset) {
    case 'today':
      return (
        recordDate.getFullYear() === refYear &&
        recordDate.getMonth() === refMonth &&
        recordDate.getDate() === refDay
      );
    case 'yesterday': {
      const yest = new Date(referenceNow);
      yest.setDate(yest.getDate() - 1);
      return (
        recordDate.getFullYear() === yest.getFullYear() &&
        recordDate.getMonth() === yest.getMonth() &&
        recordDate.getDate() === yest.getDate()
      );
    }
    case 'this_week': {
      const diffMs = Math.abs(referenceNow.getTime() - recordDate.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }
    case 'this_month':
      return recordDate.getFullYear() === refYear && recordDate.getMonth() === refMonth;
    case 'this_quarter': {
      const refQ = Math.floor(refMonth / 3);
      const recQ = Math.floor(recordDate.getMonth() / 3);
      return recordDate.getFullYear() === refYear && recQ === refQ;
    }
    case 'this_year':
      return recordDate.getFullYear() === refYear;
    case 'custom': {
      const start = dateFilter.customStart ? parseDateValue(dateFilter.customStart) : null;
      const end = dateFilter.customEnd ? parseDateValue(dateFilter.customEnd) : null;
      if (start && recordDate < start) return false;
      if (end && recordDate > end) return false;
      return true;
    }
    default:
      return true;
  }
}

/**
 * Step 3B: Single Criterion Evaluation.
 */
function evaluateSingleCriterion(row: Record<string, any>, criterion: ReportCriterion): boolean {
  const rawVal = resolveFieldValue(row, criterion.field);
  const op: FilterOperator = criterion.operator;
  const target = criterion.value;

  if (op === 'is_empty') {
    return rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
  }
  if (op === 'is_not_empty') {
    return rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
  }

  const strVal = rawVal == null ? '' : String(rawVal).toLowerCase();
  const strTarget = target == null ? '' : String(target).toLowerCase();
  const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
  const numTarget = typeof target === 'number' ? target : Number(target);

  switch (op) {
    case 'equals':
      if (!Number.isNaN(numVal) && !Number.isNaN(numTarget) && strVal !== '' && strTarget !== '') {
        return numVal === numTarget;
      }
      return strVal === strTarget;
    case 'not_equals':
      if (!Number.isNaN(numVal) && !Number.isNaN(numTarget) && strVal !== '' && strTarget !== '') {
        return numVal !== numTarget;
      }
      return strVal !== strTarget;
    case 'contains':
      return strVal.includes(strTarget);
    case 'not_contains':
      return !strVal.includes(strTarget);
    case 'starts_with':
      return strVal.startsWith(strTarget);
    case 'gt':
      return !Number.isNaN(numVal) && !Number.isNaN(numTarget) && numVal > numTarget;
    case 'gte':
      return !Number.isNaN(numVal) && !Number.isNaN(numTarget) && numVal >= numTarget;
    case 'lt':
      return !Number.isNaN(numVal) && !Number.isNaN(numTarget) && numVal < numTarget;
    case 'lte':
      return !Number.isNaN(numVal) && !Number.isNaN(numTarget) && numVal <= numTarget;
    case 'between': {
      if (Array.isArray(target) && target.length >= 2) {
        const min = Number(target[0]);
        const max = Number(target[1]);
        if (!Number.isNaN(numVal) && !Number.isNaN(min) && !Number.isNaN(max)) {
          return numVal >= min && numVal <= max;
        }
      }
      return false;
    }
    case 'in_list': {
      const list: string[] = Array.isArray(target)
        ? target.map((x) => String(x).toLowerCase().trim())
        : String(target ?? '')
            .split(',')
            .map((x) => x.toLowerCase().trim())
            .filter(Boolean);
      return list.includes(strVal);
    }
    default:
      return true;
  }
}

/**
 * Step 3C: Safe Recursive-Descent Boolean Criteria Pattern Evaluator (NO `eval()`).
 * Supports expressions such as `(1 AND 2) OR 3`, `1 AND NOT 2`, etc.
 */
type BoolToken =
  | { type: 'INDEX'; value: number }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'NOT' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

function tokenizeCriteriaPattern(pattern: string): BoolToken[] {
  const tokens: BoolToken[] = [];
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i += 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let numStr = '';
      while (i < len && /\d/.test(pattern[i])) {
        numStr += pattern[i];
        i += 1;
      }
      tokens.push({ type: 'INDEX', value: parseInt(numStr, 10) });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let word = '';
      while (i < len && /[a-zA-Z]/.test(pattern[i])) {
        word += pattern[i];
        i += 1;
      }
      const upper = word.toUpperCase();
      if (upper === 'AND') tokens.push({ type: 'AND' });
      else if (upper === 'OR') tokens.push({ type: 'OR' });
      else if (upper === 'NOT') tokens.push({ type: 'NOT' });
      continue;
    }
    i += 1;
  }

  return tokens;
}

export function evaluateCriteriaPattern(
  row: Record<string, any>,
  criteria: ReportCriterion[],
  criteriaPattern?: string
): boolean {
  if (!criteria || criteria.length === 0) return true;

  const resultMap = new Map<number, boolean>();
  criteria.forEach((c, idx) => {
    const indexKey = c.index ?? idx + 1;
    resultMap.set(indexKey, evaluateSingleCriterion(row, c));
  });

  if (!criteriaPattern || criteriaPattern.trim() === '') {
    for (const val of resultMap.values()) {
      if (!val) return false;
    }
    return true;
  }

  const tokens = tokenizeCriteriaPattern(criteriaPattern);
  if (tokens.length === 0) {
    for (const val of resultMap.values()) {
      if (!val) return false;
    }
    return true;
  }

  let pos = 0;

  function parseOr(): boolean {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos].type === 'OR') {
      pos += 1;
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }

  function parseAnd(): boolean {
    let left = parseUnary();
    while (pos < tokens.length && tokens[pos].type === 'AND') {
      pos += 1;
      const right = parseUnary();
      left = left && right;
    }
    return left;
  }

  function parseUnary(): boolean {
    if (pos < tokens.length && tokens[pos].type === 'NOT') {
      pos += 1;
      return !parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): boolean {
    if (pos >= tokens.length) return true;
    const tok = tokens[pos];
    if (tok.type === 'LPAREN') {
      pos += 1;
      const val = parseOr();
      if (pos < tokens.length && tokens[pos].type === 'RPAREN') {
        pos += 1;
      }
      return val;
    }
    if (tok.type === 'INDEX') {
      pos += 1;
      return resultMap.get(tok.value) ?? true;
    }
    pos += 1;
    return true;
  }

  return parseOr();
}

/**
 * Step 4A: Compute Bucket Columns dynamically per row.
 */
function evaluateBucketColumn(row: Record<string, any>, bucket: BucketColumn): string {
  const rawVal = resolveFieldValue(row, bucket.sourceField);
  const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);

  if (Number.isNaN(numVal)) {
    return bucket.defaultLabel;
  }

  for (const range of bucket.ranges) {
    const minOk = range.min === undefined || numVal >= range.min;
    const maxOk = range.max === undefined || numVal <= range.max;
    if (minOk && maxOk) {
      return range.label;
    }
  }

  return bucket.defaultLabel;
}

/**
 * Step 4B: Safe Recursive-Descent Arithmetic Formula Evaluator (NO `eval()`).
 * Supports `+`, `-`, `*`, `/`, parentheses, numeric constants, and field identifiers
 * (e.g., `amount * probability / 100` or `[deals.amount] - [deals.cost]`).
 */
type MathToken =
  | { type: 'NUMBER'; value: number }
  | { type: 'FIELD'; name: string }
  | { type: 'OP'; op: '+' | '-' | '*' | '/' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

function tokenizeFormulaExpression(expr: string): MathToken[] {
  const tokens: MathToken[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', op: ch });
      i += 1;
      continue;
    }
    if (ch === '[') {
      i += 1;
      let fieldName = '';
      while (i < len && expr[i] !== ']') {
        fieldName += expr[i];
        i += 1;
      }
      if (i < len && expr[i] === ']') i += 1;
      tokens.push({ type: 'FIELD', name: fieldName.trim() });
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(expr[i + 1]))) {
      let numStr = '';
      while (i < len && (/\d/.test(expr[i]) || expr[i] === '.')) {
        numStr += expr[i];
        i += 1;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) || 0 });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_.]/.test(expr[i])) {
        ident += expr[i];
        i += 1;
      }
      tokens.push({ type: 'FIELD', name: ident });
      continue;
    }
    i += 1;
  }

  return tokens;
}

export function evaluateFormulaExpression(
  row: Record<string, any>,
  expression: string
): number {
  const tokens = tokenizeFormulaExpression(expression);
  if (tokens.length === 0) return 0;

  let pos = 0;

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (
      pos < tokens.length &&
      tokens[pos].type === 'OP' &&
      ((tokens[pos] as { type: 'OP'; op: string }).op === '+' ||
        (tokens[pos] as { type: 'OP'; op: string }).op === '-')
    ) {
      const op = (tokens[pos] as { type: 'OP'; op: '+' | '-' }).op;
      pos += 1;
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parseUnary();
    while (
      pos < tokens.length &&
      tokens[pos].type === 'OP' &&
      ((tokens[pos] as { type: 'OP'; op: string }).op === '*' ||
        (tokens[pos] as { type: 'OP'; op: string }).op === '/')
    ) {
      const op = (tokens[pos] as { type: 'OP'; op: '*' | '/' }).op;
      pos += 1;
      const right = parseUnary();
      if (op === '*') {
        left *= right;
      } else {
        left = right === 0 ? 0 : left / right;
      }
    }
    return left;
  }

  function parseUnary(): number {
    if (pos < tokens.length && tokens[pos].type === 'OP') {
      const op = (tokens[pos] as { type: 'OP'; op: string }).op;
      if (op === '-') {
        pos += 1;
        return -parseUnary();
      }
      if (op === '+') {
        pos += 1;
        return parseUnary();
      }
    }
    return parseAtom();
  }

  function parseAtom(): number {
    if (pos >= tokens.length) return 0;
    const tok = tokens[pos];
    if (tok.type === 'LPAREN') {
      pos += 1;
      const val = parseAddSub();
      if (pos < tokens.length && tokens[pos].type === 'RPAREN') {
        pos += 1;
      }
      return val;
    }
    if (tok.type === 'NUMBER') {
      pos += 1;
      return tok.value;
    }
    if (tok.type === 'FIELD') {
      pos += 1;
      const raw = resolveFieldValue(row, tok.name);
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    pos += 1;
    return 0;
  }

  const result = parseAddSub();
  return Number.isFinite(result) ? Number(result.toFixed(4)) : 0;
}

function enrichRowWithBucketsAndFormulas(
  row: Record<string, any>,
  buckets?: BucketColumn[],
  formulas?: FormulaColumn[]
): Record<string, any> {
  const enriched: Record<string, any> = { ...row };

  if (buckets && buckets.length > 0) {
    for (const bucket of buckets) {
      const bucketValue = evaluateBucketColumn(enriched, bucket);
      enriched[bucket.id] = bucketValue;
      enriched[bucket.label] = bucketValue;
    }
  }

  if (formulas && formulas.length > 0) {
    for (const formula of formulas) {
      const val = evaluateFormulaExpression(enriched, formula.expression);
      enriched[formula.id] = val;
      enriched[formula.label] = val;
    }
  }

  return enriched;
}

/**
 * Step 5A: Aggregation Calculator (`sum`, `avg`, `min`, `max`, `count`).
 */
export function computeAggregationsForRows(
  rows: Record<string, any>[],
  aggregations: ReportAggregationSpec[]
): ComputedAggregateMap {
  const result: ComputedAggregateMap = {
    count: rows.length,
  };

  for (const agg of aggregations) {
    const key = `${agg.fn}_${agg.field}`;
    if (agg.fn === 'count') {
      result[key] = rows.length;
      result[agg.label] = rows.length;
      continue;
    }

    const numericValues: number[] = [];
    for (const r of rows) {
      let raw = resolveFieldValue(r, agg.field);
      if ((raw === null || raw === undefined) && agg.field === 'valueSAR') {
        raw =
          r['estimatedValueSAR'] ??
          r['estimatedValue'] ??
          r['approvedBudget'] ??
          r['amountSAR'] ??
          r['amount'];
      }
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        numericValues.push(num);
      }
    }

    if (numericValues.length === 0) {
      result[key] = 0;
      result[agg.label] = 0;
      continue;
    }

    let computed = 0;
    switch (agg.fn) {
      case 'sum':
        computed = numericValues.reduce((acc, v) => acc + v, 0);
        break;
      case 'avg':
        computed =
          numericValues.reduce((acc, v) => acc + v, 0) / numericValues.length;
        break;
      case 'min':
        computed = Math.min(...numericValues);
        break;
      case 'max':
        computed = Math.max(...numericValues);
        break;
      default:
        computed = numericValues.length;
    }

    const rounded = Number(computed.toFixed(2));
    result[key] = rounded;
    result[agg.label] = rounded;
  }

  return result;
}

function extractRecordId(row: Record<string, any>, fallbackIndex: number): string {
  return String(
    row.id ??
      row.unique_id ??
      row.leadUniqueId ??
      row['deals.id'] ??
      row['leads.id'] ??
      `row_${fallbackIndex}`
  );
}

/**
 * Step 5B: Recursive Summary Grouping Engine.
 */
function buildSummaryGroupsRecursive(
  rows: Record<string, any>[],
  groupFields: ReportGroupingField[],
  aggregations: ReportAggregationSpec[],
  level = 0
): SummaryGroupNode[] {
  if (groupFields.length === 0) return [];

  const currentGrouping = groupFields[0];
  const remainingGroupings = groupFields.slice(1);
  const buckets = new Map<string, Record<string, any>[]>();

  for (const row of rows) {
    const rawVal = resolveFieldValue(row, currentGrouping.field);
    const groupValue = formatDateByGranularity(rawVal, currentGrouping.dateGranularity);
    const list = buckets.get(groupValue) ?? [];
    list.push(row);
    buckets.set(groupValue, list);
  }

  const nodes: SummaryGroupNode[] = [];
  for (const [groupValue, groupRows] of buckets.entries()) {
    const recordIds = groupRows.map((r, i) => extractRecordId(r, i));
    const subtotals = computeAggregationsForRows(groupRows, aggregations);
    const children =
      remainingGroupings.length > 0
        ? buildSummaryGroupsRecursive(groupRows, remainingGroupings, aggregations, level + 1)
        : undefined;

    nodes.push({
      groupKey: `${currentGrouping.field}:${groupValue}`,
      groupField: currentGrouping.field,
      groupValue,
      level,
      rowCount: groupRows.length,
      recordIds,
      subtotals,
      rows: groupRows,
      children,
    });
  }

  return nodes;
}

/**
 * Step 5C: 2D Matrix Cross-Tab Grid Builder (`rowKeys` x `colKeys`).
 */
function buildMatrixGrid(
  rows: Record<string, any>[],
  rowGroupings: ReportGroupingField[],
  colGroupings: ReportGroupingField[],
  aggregations: ReportAggregationSpec[]
): MatrixExecutionGrid {
  const rowField = rowGroupings[0] ?? { field: 'ownerName' };
  const colField = colGroupings[0] ?? { field: 'stage' };

  const rowHeaderSet = new Set<string>();
  const colHeaderSet = new Set<string>();
  const cellRowsMap: Record<string, Record<string, Record<string, any>[]>> = {};
  const rowsByRowKey: Record<string, Record<string, any>[]> = {};
  const rowsByColKey: Record<string, Record<string, any>[]> = {};

  for (const row of rows) {
    const rKey = formatDateByGranularity(
      resolveFieldValue(row, rowField.field),
      rowField.dateGranularity
    );
    const cKey = formatDateByGranularity(
      resolveFieldValue(row, colField.field),
      colField.dateGranularity
    );

    rowHeaderSet.add(rKey);
    colHeaderSet.add(cKey);

    if (!cellRowsMap[rKey]) cellRowsMap[rKey] = {};
    if (!cellRowsMap[rKey][cKey]) cellRowsMap[rKey][cKey] = [];
    cellRowsMap[rKey][cKey].push(row);

    if (!rowsByRowKey[rKey]) rowsByRowKey[rKey] = [];
    rowsByRowKey[rKey].push(row);

    if (!rowsByColKey[cKey]) rowsByColKey[cKey] = [];
    rowsByColKey[cKey].push(row);
  }

  const rowHeaders = Array.from(rowHeaderSet);
  const columnHeaders = Array.from(colHeaderSet);
  const cells: Record<string, Record<string, MatrixCellResult>> = {};
  const rowTotals: Record<string, ComputedAggregateMap> = {};
  const columnTotals: Record<string, ComputedAggregateMap> = {};

  for (const rKey of rowHeaders) {
    cells[rKey] = {};
    rowTotals[rKey] = computeAggregationsForRows(rowsByRowKey[rKey] ?? [], aggregations);
    for (const cKey of columnHeaders) {
      const matchingRows = cellRowsMap[rKey]?.[cKey] ?? [];
      cells[rKey][cKey] = {
        rowKey: rKey,
        colKey: cKey,
        rowCount: matchingRows.length,
        recordIds: matchingRows.map((r, i) => extractRecordId(r, i)),
        aggregates: computeAggregationsForRows(matchingRows, aggregations),
      };
    }
  }

  for (const cKey of columnHeaders) {
    columnTotals[cKey] = computeAggregationsForRows(rowsByColKey[cKey] ?? [], aggregations);
  }

  const grandTotals = computeAggregationsForRows(rows, aggregations);

  return {
    rowHeaders,
    columnHeaders,
    cells,
    rowTotals,
    columnTotals,
    grandTotals,
  };
}

/**
 * Step 5D: Joined Multi-Block Report Builder.
 */
function buildJoinedBlocks(
  report: ReportDefinition,
  dataset: Record<ModuleName, any[]>,
  security: UserSecurityContext,
  baseFilteredRows: Record<string, any>[],
  visibleColumns: string[]
): JoinedBlockExecutionResult[] {
  const groupField = report.groupByRows[0]?.field || 'unique_id';

  if (report.joinedBlocks && report.joinedBlocks.length > 0) {
    return report.joinedBlocks.map((block) => {
      const rawBlockRecords = dataset[block.primaryModule] ?? [];
      const secured = filterRecordsBySecurity(rawBlockRecords, block.primaryModule, security);
      const joined = joinRelatedModules(
        secured,
        block.primaryModule,
        block.relatedModules ?? [],
        dataset,
        security
      );
      const filtered = joined.filter((r) =>
        evaluateCriteriaPattern(r, block.criteria ?? [], block.criteriaPattern)
      );
      const hidden = buildHiddenFieldsSet(
        block.primaryModule,
        block.relatedModules ?? [],
        security
      );
      const cleanedRows = filtered.map((r) => stripHiddenFieldsFromRow(r, hidden));
      const blockVisibleCols = block.selectedColumns.filter((c) => !hidden.has(c));

      const subtotalsByGroup: Record<string, ComputedAggregateMap> = {};
      const groupedMap = new Map<string, Record<string, any>[]>();
      for (const r of cleanedRows) {
        const gVal = String(resolveFieldValue(r, groupField) ?? 'غير محدد');
        const arr = groupedMap.get(gVal) ?? [];
        arr.push(r);
        groupedMap.set(gVal, arr);
      }
      for (const [gKey, gRows] of groupedMap.entries()) {
        subtotalsByGroup[gKey] = computeAggregationsForRows(gRows, block.aggregations);
      }

      return {
        blockId: block.id,
        title: block.title,
        primaryModule: block.primaryModule,
        visibleColumns: blockVisibleCols,
        rows: cleanedRows,
        subtotalsByGroup,
        grandTotals: computeAggregationsForRows(cleanedRows, block.aggregations),
      };
    });
  }

  // Synthesize Joined Blocks from Primary Module + each Related Module
  const blocks: JoinedBlockExecutionResult[] = [];
  const primarySubtotals: Record<string, ComputedAggregateMap> = {};
  const primaryGroups = new Map<string, Record<string, any>[]>();

  for (const r of baseFilteredRows) {
    const gVal = String(resolveFieldValue(r, groupField) ?? 'غير محدد');
    const list = primaryGroups.get(gVal) ?? [];
    list.push(r);
    primaryGroups.set(gVal, list);
  }
  for (const [gKey, gRows] of primaryGroups.entries()) {
    primarySubtotals[gKey] = computeAggregationsForRows(gRows, report.aggregations);
  }

  blocks.push({
    blockId: `block_${report.primaryModule}`,
    title: `الكتلة الأساسية: ${report.primaryModule}`,
    primaryModule: report.primaryModule,
    visibleColumns,
    rows: baseFilteredRows,
    subtotalsByGroup: primarySubtotals,
    grandTotals: computeAggregationsForRows(baseFilteredRows, report.aggregations),
  });

  for (const rel of report.relatedModules) {
    const relRecords = filterRecordsBySecurity(dataset[rel.module] ?? [], rel.module, security);
    const relHidden = buildHiddenFieldsSet(rel.module, [], security);
    const cleanedRelRows = relRecords.map((r) => stripHiddenFieldsFromRow(r, relHidden));
    const relSubtotals: Record<string, ComputedAggregateMap> = {};
    const relGroups = new Map<string, Record<string, any>[]>();

    for (const r of cleanedRelRows) {
      const gVal = String(resolveFieldValue(r, rel.foreignKey) ?? resolveFieldValue(r, groupField) ?? 'غير محدد');
      const list = relGroups.get(gVal) ?? [];
      list.push(r);
      relGroups.set(gVal, list);
    }
    for (const [gKey, gRows] of relGroups.entries()) {
      relSubtotals[gKey] = computeAggregationsForRows(gRows, report.aggregations);
    }

    blocks.push({
      blockId: `block_${rel.module}`,
      title: `الكتلة المرتبطة: ${rel.module}`,
      primaryModule: rel.module,
      visibleColumns: Object.keys(cleanedRelRows[0] ?? {}).slice(0, 6),
      rows: cleanedRelRows,
      subtotalsByGroup: relSubtotals,
      grandTotals: computeAggregationsForRows(cleanedRelRows, report.aggregations),
    });
  }

  return blocks;
}

/**
 * Step 6: Chart Data & Drill-Down Map Builder.
 */
function buildChartDataAndDrillDown(
  report: ReportDefinition,
  rows: Record<string, any>[]
): { chartData: ChartDataPoint[]; drillDownMap: Record<string, string[]> } {
  const drillDownMap: Record<string, string[]> = {};
  const chartData: ChartDataPoint[] = [];

  const xAxisField =
    report.chartConfig?.xAxisField ||
    report.groupByRows[0]?.field ||
    report.selectedColumns[0] ||
    'id';
  const xGranularity = report.groupByRows.find((g) => g.field === xAxisField)?.dateGranularity;
  const yAxisMetric = report.chartConfig?.yAxisMetric || 'count';
  const secondaryField =
    report.chartConfig?.secondaryGroupingField || report.groupByColumns?.[0]?.field;

  const grouped = new Map<string, Record<string, any>[]>();
  for (const row of rows) {
    const keyLabel = formatDateByGranularity(resolveFieldValue(row, xAxisField), xGranularity);
    const list = grouped.get(keyLabel) ?? [];
    list.push(row);
    grouped.set(keyLabel, list);
  }

  for (const [keyLabel, groupRows] of grouped.entries()) {
    const recordIds = groupRows.map((r, idx) => extractRecordId(r, idx));
    drillDownMap[keyLabel] = recordIds;

    const aggMap = computeAggregationsForRows(groupRows, report.aggregations);
    let metricValue = groupRows.length;

    if (yAxisMetric in aggMap && aggMap[yAxisMetric] > 0) {
      metricValue = aggMap[yAxisMetric];
    } else {
      const numericSum = groupRows.reduce((sum, r) => {
        const v = Number(resolveFieldValue(r, yAxisMetric));
        return Number.isNaN(v) ? sum : sum + v;
      }, 0);
      if (numericSum > 0) {
        metricValue = Number(numericSum.toFixed(2));
      } else {
        metricValue = groupRows.length;
      }
    }

    let secondarySeries: Record<string, number> | undefined;
    if (secondaryField) {
      secondarySeries = {};
      const subBuckets = new Map<string, Record<string, any>[]>();
      for (const r of groupRows) {
        const subKey = String(resolveFieldValue(r, secondaryField) ?? 'غير محدد');
        const arr = subBuckets.get(subKey) ?? [];
        arr.push(r);
        subBuckets.set(subKey, arr);
      }
      for (const [subKey, subRows] of subBuckets.entries()) {
        const subAgg = computeAggregationsForRows(subRows, report.aggregations);
        secondarySeries[subKey] =
          yAxisMetric in subAgg ? subAgg[yAxisMetric] : subRows.length;
      }
    }

    chartData.push({
      key: keyLabel,
      label: keyLabel,
      value: metricValue,
      secondarySeries,
      recordCount: groupRows.length,
      recordIds,
    });
  }

  return { chartData, drillDownMap };
}

/**
 * Main Entry Point: Deterministically executes a ReportDefinition in memory
 * against a multi-module CRM dataset while enforcing Role Hierarchy & FLS.
 */
export function executeReport(
  report: ReportDefinition,
  dataset: Record<ModuleName, any[]>,
  security: UserSecurityContext
): ReportExecutionResult {
  // 1. Security Enforcement (Record Ownership / Subordinate Hierarchy + FLS)
  const rawPrimaryRecords = dataset[report.primaryModule] ?? [];
  const securedPrimaryRecords = filterRecordsBySecurity(
    rawPrimaryRecords,
    report.primaryModule,
    security
  );

  const hiddenFields = buildHiddenFieldsSet(
    report.primaryModule,
    report.relatedModules ?? [],
    security
  );

  // 2. Related Module Joining (inclusive left join or exclusive inner join)
  const joinedRows = joinRelatedModules(
    securedPrimaryRecords,
    report.primaryModule,
    report.relatedModules ?? [],
    dataset,
    security
  );

  // 3. Compute Buckets & Safe Arithmetic Formulas prior to criteria evaluation so criteria can reference them
  const enrichedRows = joinedRows.map((row) =>
    enrichRowWithBucketsAndFormulas(row, report.buckets, report.formulas)
  );

  // 4. Date Filter & Boolean Criteria Pattern Evaluation (recursive-descent, zero `eval()`)
  const filteredRows = enrichedRows.filter((row) => {
    if (!matchesDateFilter(row, report.dateFilter)) return false;
    return evaluateCriteriaPattern(row, report.criteria ?? [], report.criteriaPattern);
  });

  // 5. Strip FLS Hidden Fields from output rows and selectedColumns
  const visibleColumns: string[] = [];
  const strippedHiddenColumns: string[] = [];

  for (const col of report.selectedColumns) {
    const bareCol = col.includes('.') ? col.split('.').slice(1).join('.') : col;
    if (hiddenFields.has(col) || hiddenFields.has(bareCol)) {
      strippedHiddenColumns.push(col);
    } else {
      visibleColumns.push(col);
    }
  }

  if (report.buckets) {
    for (const b of report.buckets) {
      if (!hiddenFields.has(b.sourceField) && !visibleColumns.includes(b.id)) {
        visibleColumns.push(b.id);
      }
    }
  }
  if (report.formulas) {
    for (const f of report.formulas) {
      if (!visibleColumns.includes(f.id)) {
        visibleColumns.push(f.id);
      }
    }
  }

  const sanitizedRows = filteredRows.map((row) => stripHiddenFieldsFromRow(row, hiddenFields));

  // 6. Execute Report Type Specific Structures (`tabular`, `summary`, `matrix`, `joined`)
  const grandTotals = computeAggregationsForRows(sanitizedRows, report.aggregations ?? []);
  let summaryGroups: SummaryGroupNode[] | undefined;
  let matrixGrid: MatrixExecutionGrid | undefined;
  let joinedBlocks: JoinedBlockExecutionResult[] | undefined;

  if (report.reportType === 'summary') {
    summaryGroups = buildSummaryGroupsRecursive(
      sanitizedRows,
      report.groupByRows ?? [],
      report.aggregations ?? []
    );
  } else if (report.reportType === 'matrix') {
    matrixGrid = buildMatrixGrid(
      sanitizedRows,
      report.groupByRows ?? [],
      report.groupByColumns ?? [],
      report.aggregations ?? []
    );
  } else if (report.reportType === 'joined') {
    joinedBlocks = buildJoinedBlocks(
      report,
      dataset,
      security,
      sanitizedRows,
      visibleColumns
    );
    if ((report.groupByRows?.length ?? 0) > 0) {
      summaryGroups = buildSummaryGroupsRecursive(
        sanitizedRows,
        report.groupByRows,
        report.aggregations ?? []
      );
    }
  }

  // 7. Build Chart Data & Drill-Down Map
  const { chartData, drillDownMap } = buildChartDataAndDrillDown(report, sanitizedRows);

  return {
    reportId: report.id,
    reportName: report.name,
    reportType: report.reportType,
    executedAt: new Date().toISOString(),
    visibleColumns,
    strippedHiddenColumns,
    totalRecordsMatched: sanitizedRows.length,
    rows: sanitizedRows,
    grandTotals,
    summaryGroups,
    matrixGrid,
    joinedBlocks,
    chartData: report.chartConfig?.enabled ? chartData : undefined,
    drillDownMap,
  };
}
