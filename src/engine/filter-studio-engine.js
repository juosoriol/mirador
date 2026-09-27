import { COL_FILTER } from './filter-types.js';
import {
  DEFAULT_CHIP_LIMIT,
  buildCandidateRowIndices,
  countColumnValueMap,
  countNullRows,
  findCedulaColumn,
  getChipFilterDisplayLabel,
  selectionSetFromFilter,
} from './chip-filter-engine.js';

export const FILTER_UI_METHODS = ['window', 'drawer', 'smart'];
export const FILTER_UI_KEY = 'mirador_filter_ui';

/** Lowercase + strip accents for tolerant matching. */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filterable columns with their kind: 'cedula' (with/without), 'date' (range) or 'values' (multi-select).
 * @param {object} tab
 * @param {number} [chipLimit]
 */
export function listFilterColumns(tab, chipLimit = DEFAULT_CHIP_LIMIT) {
  if (!tab?.columns?.length) return [];
  const colUniques = tab.colUniques || {};
  const colFilters = tab.colFilters || {};
  const hidden = tab.hiddenCols || new Set();
  const dates = new Set(tab.dateColsDetected || []);
  const cedula = findCedulaColumn(tab.columns);
  const out = [];
  for (const col of tab.columns) {
    const uniques = colUniques[col]?.size || 0;
    let kind = null;
    if (cedula && col === cedula) kind = 'cedula';
    else if (hidden.has(col)) continue;
    else if (dates.has(col)) kind = 'date';
    else if (uniques >= 1 && uniques <= chipLimit) kind = 'values';
    if (!kind) continue;
    const active = colFilters[col] !== undefined;
    out.push({
      col,
      kind,
      uniques,
      active,
      label: active ? getChipFilterDisplayLabel(colFilters[col]) : '',
    });
  }
  return out;
}

/** @param {ReturnType<typeof listFilterColumns>} cols @param {string} query */
export function filterColumnList(cols, query) {
  const q = normalizeText(query);
  if (!q) return cols;
  return cols.filter((c) => normalizeText(c.col).includes(q));
}

/**
 * Values of one column with counts over rows matching every *other* filter.
 * Sorted by count desc, then alphabetically.
 * @param {object} tab
 * @param {string} col
 * @param {{ query?: string, sort?: 'count'|'alpha' }} [opts]
 */
export function columnFacet(tab, col, opts = {}) {
  const { query = '', sort = 'count' } = opts;
  const rawData = tab.rawData || [];
  const colFilters = tab.colFilters || {};
  const candidates = buildCandidateRowIndices(rawData, colFilters, col);
  const counts = countColumnValueMap(rawData, candidates, col);
  const selection = selectionSetFromFilter(colFilters[col]);
  const all = tab.colUniques?.[col] ? [...tab.colUniques[col]] : Object.keys(counts);
  const q = normalizeText(query);
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  let values = all
    .filter((v) => !q || normalizeText(v).includes(q))
    .map((v) => ({ value: String(v), count: counts[v] || 0, selected: selection.has(v) }));
  values.sort((a, b) =>
    sort === 'alpha' ? collator.compare(a.value, b.value) : b.count - a.count || collator.compare(a.value, b.value),
  );
  const maxCount = values.reduce((m, v) => Math.max(m, v.count), 0);
  return {
    values,
    totalValues: all.length,
    selectedCount: selection.size,
    candidateCount: candidates.length,
    nullCount: countNullRows(rawData, candidates, col),
    maxCount,
    filter: colFilters[col],
  };
}

/** Set/unset one value in a multi-select filter. Returns undefined when nothing remains. */
export function setValueSelected(curFilter, value, on) {
  const sel = selectionSetFromFilter(curFilter);
  if (on) sel.add(value);
  else sel.delete(value);
  return sel.size ? [...sel] : undefined;
}

/** Select every value in `values` on top of the current selection. */
export function selectValues(curFilter, values) {
  const sel = selectionSetFromFilter(curFilter);
  values.forEach((v) => sel.add(v));
  return sel.size ? [...sel] : undefined;
}

/** Active filters as display tokens. */
export function activeFilterTokens(colFilters) {
  return Object.entries(colFilters || {})
    .filter(([, v]) => v !== undefined)
    .map(([col, v]) => ({ col, label: getChipFilterDisplayLabel(v), value: v }));
}

export function containsFilter(text) {
  const t = String(text ?? '').trim().toLowerCase();
  return t ? `${COL_FILTER.CONTAINS_PREFIX}${t}` : undefined;
}

/** Split "columna: valor" into parts; col is null when there is no colon. */
export function parseSmartQuery(query) {
  const s = String(query ?? '');
  const idx = s.indexOf(':');
  if (idx < 0) return { col: null, value: s.trim() };
  return { col: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
}

function resolveColumn(cols, name) {
  const n = normalizeText(name);
  if (!n) return null;
  return (
    cols.find((c) => normalizeText(c.col) === n) ||
    cols.find((c) => normalizeText(c.col).startsWith(n)) ||
    cols.find((c) => normalizeText(c.col).includes(n)) ||
    null
  );
}

/**
 * Suggestions for the smart filter bar.
 * - "col: val" → values of that column (plus a "contains" option).
 * - free text → matching columns, then matching values across columns.
 * @param {object} tab
 * @param {string} query
 * @param {{ limit?: number, maxValueCols?: number }} [opts]
 * @returns {Array<{ type: 'column'|'value'|'contains'|'search', col?: string, value?: string, count?: number, selected?: boolean, kind?: string }>}
 */
export function smartSuggestions(tab, query, opts = {}) {
  const { limit = 12, maxValueCols = 8 } = opts;
  const cols = listFilterColumns(tab).filter((c) => c.kind === 'values');
  const { col: colPart, value } = parseSmartQuery(query);
  const out = [];

  if (colPart !== null) {
    const target = resolveColumn(cols, colPart);
    if (!target) return out;
    const facet = columnFacet(tab, target.col, { query: value });
    facet.values.slice(0, limit).forEach((v) =>
      out.push({ type: 'value', col: target.col, value: v.value, count: v.count, selected: v.selected }),
    );
    if (value && !facet.values.some((v) => normalizeText(v.value) === normalizeText(value))) {
      out.push({ type: 'contains', col: target.col, value });
    }
    return out;
  }

  const q = normalizeText(value);
  if (!q) return out;

  cols
    .filter((c) => normalizeText(c.col).includes(q))
    .slice(0, 4)
    .forEach((c) => out.push({ type: 'column', col: c.col, count: c.uniques }));

  let scanned = 0;
  for (const c of cols) {
    if (out.length >= limit || scanned >= maxValueCols) break;
    const uniques = tab.colUniques?.[c.col];
    if (!uniques) continue;
    const hits = [];
    for (const v of uniques) {
      if (normalizeText(v).includes(q)) hits.push(String(v));
      if (hits.length >= limit) break;
    }
    if (!hits.length) continue;
    scanned++;
    const facet = columnFacet(tab, c.col);
    const byVal = new Map(facet.values.map((v) => [v.value, v]));
    hits
      .map((h) => byVal.get(h))
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .forEach((v) => {
        if (out.length < limit) {
          out.push({ type: 'value', col: c.col, value: v.value, count: v.count, selected: v.selected });
        }
      });
  }
  out.push({ type: 'search', value: value.trim() });
  return out;
}

/** Top values per column for the empty-state quick picks. */
export function quickPicks(tab, { columns = 4, perColumn = 4 } = {}) {
  return listFilterColumns(tab)
    .filter((c) => c.kind === 'values' && c.uniques > 1)
    .sort((a, b) => (a.uniques <= 30) === (b.uniques <= 30) ? 0 : a.uniques <= 30 ? -1 : 1)
    .slice(0, columns)
    .map((c) => ({ col: c.col, values: columnFacet(tab, c.col).values.slice(0, perColumn) }));
}
