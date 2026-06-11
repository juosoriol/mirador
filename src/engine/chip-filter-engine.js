import { buildFilterOps, rowMatchesFilterOps } from './filter-engine.js';
import { COL_FILTER } from './filter-types.js';

export const DEFAULT_CHIP_LIMIT = 500;

const valueCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

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

/** @param {Array<Record<string, unknown>>} data @param {number[]} rowIndices @param {string} col */
export function countNonNullRows(data, rowIndices, col) {
  let n = 0;
  for (const i of rowIndices) {
    const row = data[i];
    if (row && row[col] !== '' && row[col] != null) n++;
  }
  return n;
}

/** @param {Iterable<string>|Set<string>} values */
export function sortColumnValues(values) {
  return [...values].sort(valueCollator.compare);
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

/**
 * Columns that should render as standard chips (excludes cédula, dates, hidden).
 * @param {object} opts
 * @param {string[]} opts.columns
 * @param {Record<string, Set<unknown>>} opts.colUniques
 * @param {string[]} opts.dateColsDetected
 * @param {Set<string>} [opts.hiddenCols]
 * @param {string|null} [opts.cedulaCol]
 * @param {number} [opts.chipLimit]
 */
export function getChipEligibleColumns({
  columns,
  colUniques,
  dateColsDetected,
  hiddenCols = new Set(),
  cedulaCol = null,
  chipLimit = DEFAULT_CHIP_LIMIT,
}) {
  const dateSet = new Set(dateColsDetected || []);
  return columns.filter((col) => {
    if (hiddenCols.has(col)) return false;
    if (cedulaCol && col === cedulaCol) return false;
    if (dateSet.has(col)) return false;
    const u = colUniques[col]?.size || 0;
    return u >= 1 && u <= chipLimit;
  });
}

/**
 * Non-empty value counts per chip column within filtered rows.
 * @param {Array<Record<string, unknown>>} rawData
 * @param {number[]} filtered
 * @param {Iterable<string>} chipCols
 */
export function computeFilteredNonEmptyCounts(rawData, filtered, chipCols) {
  /** @type {Record<string, number>} */
  const filtCnt = {};
  for (const i of filtered) {
    const row = rawData[i];
    if (!row) continue;
    for (const col of chipCols) {
      const v = row[col];
      if (v != null && v !== '') filtCnt[col] = (filtCnt[col] || 0) + 1;
    }
  }
  return filtCnt;
}

/** Toggle one value in a multi-select chip filter set. Returns undefined to clear. */
export function toggleChipSelection(curFilter, value) {
  const sel = selectionSetFromFilter(curFilter);
  sel.has(value) ? sel.delete(value) : sel.add(value);
  if (sel.size === 0) return undefined;
  return [...sel];
}

/**
 * Invert checkbox selection for chip dropdown.
 * @param {string[]} allVals
 * @param {unknown} curFilter
 * @returns {{ ok: true, action: 'clear'|'invert', values?: string[], message?: string } | { ok: false, reason: string, message?: string }}
 */
export function invertChipSelection(allVals, curFilter) {
  if (!allVals.length) return { ok: false, reason: 'empty' };
  if (curFilter === undefined) {
    return {
      ok: false,
      reason: 'no_selection',
      message: 'No hay selección para invertir. Selecciona algunos valores primero.',
    };
  }
  const curSet = selectionSetFromFilter(curFilter);
  if (
    curFilter === COL_FILTER.NULL ||
    curFilter === COL_FILTER.WITH ||
    (typeof curFilter === 'string' &&
      (curFilter.startsWith(COL_FILTER.CONTAINS_PREFIX) ||
        curFilter.startsWith(COL_FILTER.DATE_RANGE_PREFIX)))
  ) {
    return {
      ok: false,
      reason: 'special_filter',
      message: 'Usa Invertir solo con valores seleccionados por checkbox',
    };
  }
  if (curSet.size === 0) {
    return {
      ok: false,
      reason: 'no_selection',
      message: 'No hay selección para invertir. Selecciona algunos valores primero.',
    };
  }
  const allSelected =
    curSet.size >= allVals.length && allVals.every((v) => curSet.has(v));
  if (allSelected) {
    return { ok: true, action: 'clear', message: 'Todo estaba seleccionado → filtro removido' };
  }
  const inverted = allVals.filter((v) => !curSet.has(v));
  return {
    ok: true,
    action: 'invert',
    values: inverted,
    message: `Invertido: ${inverted.length} de ${allVals.length} valores`,
  };
}
