import { buildFilterOps, rowMatchesFilterOps } from './filter-engine.js';
import { COL_FILTER } from './filter-types.js';

export const DEFAULT_CHIP_LIMIT = 500;

/** @param {string[]} columns */
export function findCedulaColumn(columns) {
  return columns.find((c) => /^c[eé]dula$/i.test(c.trim())) ?? null;
}

/**
 * Precalculate unique values and null counts per column (one pass over rawData).
 * Mutates tab.colUniques / tab.colNulls when tab object is passed.
 * @param {{ rawData: Array<Record<string, unknown>>, columns: string[] }} tab
 */
export function precalcColStats(tab) {
  tab.colUniques = {};
  tab.colNulls = {};
  for (const row of tab.rawData) {
    if (!row) continue;
    for (const col of tab.columns) {
      const v = row[col];
      if (v === '' || v == null) {
        tab.colNulls[col] = (tab.colNulls[col] || 0) + 1;
      } else {
        if (!tab.colUniques[col]) tab.colUniques[col] = new Set();
        tab.colUniques[col].add(v);
      }
    }
  }
}

/**
 * Row indices matching all colFilters except excludeCol (for chip dropdown candidates).
 * @param {Array<Record<string, unknown>>} data
 * @param {Record<string, unknown>} colFilters
 * @param {string} excludeCol
 */
export function buildCandidateRowIndices(data, colFilters, excludeCol) {
  const otherEntries = Object.entries(colFilters || {}).filter(([c]) => c !== excludeCol);
  if (!otherEntries.length) {
    return data.map((_, i) => i).filter((i) => data[i]);
  }
  const filterOps = buildFilterOps(Object.fromEntries(otherEntries));
  const indices = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    if (rowMatchesFilterOps(row, filterOps)) indices.push(i);
  }
  return indices;
}

/**
 * @param {Array<Record<string, unknown>>} data
 * @param {number[]} rowIndices
 * @param {string} col
 */
export function countColumnValueMap(data, rowIndices, col) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const i of rowIndices) {
    const row = data[i];
    if (!row) continue;
    const v = row[col];
    if (v != null && v !== '') counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

/** @param {Array<Record<string, unknown>>} data @param {number[]} rowIndices @param {string} col */
export function countNullRows(data, rowIndices, col) {
  let n = 0;
  for (const i of rowIndices) {
    const row = data[i];
    if (row && (row[col] === '' || row[col] == null)) n++;
  }
  return n;
}

/** @param {unknown} curFilter */
export function selectionSetFromFilter(curFilter) {
  if (Array.isArray(curFilter)) return new Set(curFilter);
  if (
    curFilter &&
    curFilter !== COL_FILTER.NULL &&
    curFilter !== COL_FILTER.WITH &&
    typeof curFilter === 'string' &&
    !curFilter.startsWith(COL_FILTER.CONTAINS_PREFIX) &&
    !curFilter.startsWith(COL_FILTER.DATE_RANGE_PREFIX)
  ) {
    return new Set([curFilter]);
  }
  return new Set();
}

/** Human-readable label for an active chip filter value. */
export function getChipFilterDisplayLabel(val) {
  if (Array.isArray(val)) {
    return val.length === 1 ? val[0] : `${val.length} seleccionados`;
  }
  if (val === COL_FILTER.NULL) return 'sin cédula';
  if (val === COL_FILTER.WITH) return 'con cédula';
  if (typeof val === 'string' && val.startsWith(COL_FILTER.CONTAINS_PREFIX)) {
    return `contiene "${val.slice(COL_FILTER.CONTAINS_PREFIX.length)}"`;
  }
  if (typeof val === 'string' && val.startsWith(COL_FILTER.DATE_RANGE_PREFIX)) {
    const body = val.slice(COL_FILTER.DATE_RANGE_PREFIX.length);
    const [from = '*', to = '*'] = body.split(COL_FILTER.DATE_TO_SEPARATOR);
    return `${from || '*'} → ${to || '*'}`;
  }
  return String(val ?? '');
}

/** @param {unknown} curFilter */
export function parseDateChipFilter(curFilter) {
  if (typeof curFilter !== 'string') return { from: '', to: '' };
  const from =
    curFilter.startsWith('__FROM__:') ? curFilter.slice(9) : '';
  const to = curFilter.includes('__TO__:') ? curFilter.split('__TO__:')[1] : '';
  if (curFilter.startsWith(COL_FILTER.DATE_RANGE_PREFIX)) {
    const body = curFilter.slice(COL_FILTER.DATE_RANGE_PREFIX.length);
    const parts = body.split(COL_FILTER.DATE_TO_SEPARATOR);
    return { from: parts[0] || '', to: parts[1] || '' };
  }
  return { from, to };
}

/** Build date-range filter string from from/to inputs. */
export function buildDateRangeFilter(from, to) {
  const f = (from || '').trim();
  const t = (to || '').trim();
  if (!f && !t) return undefined;
  return `${COL_FILTER.DATE_RANGE_PREFIX}${f}${COL_FILTER.DATE_TO_SEPARATOR}${t}`;
}
