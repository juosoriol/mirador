import {
  ALL_COLUMNS_LABEL,
  COL_FILTER,
  FILTER_OP,
} from './filter-types.js';

/**
 * Parse one tab.colFilters entry into a runtime filter op.
 * @param {string} col
 * @param {unknown} val
 */
export function parseColFilterEntry(col, val) {
  if (Array.isArray(val)) {
    return { col, type: FILTER_OP.SET, set: new Set(val) };
  }
  if (val === COL_FILTER.NULL) {
    return { col, type: FILTER_OP.NULL };
  }
  if (val === COL_FILTER.WITH) {
    return { col, type: FILTER_OP.WITH };
  }
  if (typeof val === 'string' && val.startsWith(COL_FILTER.CONTAINS_PREFIX)) {
    return { col, type: FILTER_OP.CONTAINS, q: val.slice(COL_FILTER.CONTAINS_PREFIX.length) };
  }
  if (typeof val === 'string' && val.startsWith(COL_FILTER.DATE_RANGE_PREFIX)) {
    const parts = val.slice(COL_FILTER.DATE_RANGE_PREFIX.length).split(COL_FILTER.DATE_TO_SEPARATOR);
    return { col, type: FILTER_OP.DATE_RANGE, from: parts[0] || '', to: parts[1] || '' };
  }
  return { col, type: FILTER_OP.EXACT, val };
}

/** @param {Record<string, unknown>} colFilters */
export function buildFilterOps(colFilters) {
  const entries = Object.entries(colFilters || {});
  if (!entries.length) return null;
  return entries.map(([col, val]) => parseColFilterEntry(col, val));
}

/** @param {import('./filter-types.js').FILTER_OP[keyof typeof FILTER_OP]} type */
export function rowMatchesFilterOp(row, op) {
  const rv = row[op.col];
  switch (op.type) {
    case FILTER_OP.SET:
      return op.set.has(rv);
    case FILTER_OP.EXACT:
      return rv === op.val;
    case FILTER_OP.NULL:
      return rv === '' || rv == null;
    case FILTER_OP.WITH:
      return rv !== '' && rv != null;
    case FILTER_OP.CONTAINS:
      return (rv || '').toLowerCase().includes(op.q);
    case FILTER_OP.DATE_RANGE: {
      const rv2 = rv || '';
      if (op.from && rv2 < op.from) return false;
      if (op.to && rv2 > op.to) return false;
      return true;
    }
    default:
      return true;
  }
}

/** @param {Record<string, unknown>} row */
export function rowMatchesFilterOps(row, filterOps) {
  if (!filterOps?.length) return true;
  for (let f = 0; f < filterOps.length; f++) {
    if (!rowMatchesFilterOp(row, filterOps[f])) return false;
  }
  return true;
}

/** @param {Record<string, unknown>} row */
export function rowMatchesDateRange(row, dateCol, dateFrom, dateTo) {
  if (!dateCol || (!dateFrom && !dateTo)) return true;
  const rv = row[dateCol] || '';
  if (dateFrom && rv < dateFrom) return false;
  if (dateTo && rv > dateTo) return false;
  return true;
}

/**
 * Build or reuse lowercase concatenated search index for all-column text search.
 * @param {Array<Record<string, unknown>>} data
 * @param {string[]} columns
 * @param {string[]|null} existingIndex
 */
export function buildSearchIndex(data, columns, existingIndex) {
  if (existingIndex) return existingIndex;
  const len = data.length;
  const idx = new Array(len);
  for (let i = 0; i < len; i++) {
    const row = data[i];
    if (!row) {
      idx[i] = '';
      continue;
    }
    let s = '';
    for (let c = 0; c < columns.length; c++) s += row[columns[c]] || '';
    idx[i] = s.toLowerCase();
  }
  return idx;
}

/**
 * @param {string} rawText
 * @param {boolean} useRegex
 * @param {string} regexFlags
 * @returns {RegExp|null}
 */
export function compileSearchRegex(rawText, useRegex, regexFlags) {
  if (!useRegex || !rawText) return null;
  try {
    const pattern = rawText.replace(/\*/g, '.*');
    return new RegExp(pattern, regexFlags || 'i');
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} rowIndex
 * @param {object} opts
 * @param {string} opts.text - normalized search text (lower unless regex)
 * @param {boolean} opts.useRegex
 * @param {boolean} opts.useExclude
 * @param {RegExp|null} opts.regex
 * @param {boolean} opts.allColumns
 * @param {string} opts.searchCol
 * @param {string[]} opts.columns
 * @param {string[]|null} opts.searchIndex
 */
export function rowMatchesTextSearch(row, rowIndex, opts) {
  const {
    text,
    useRegex,
    useExclude,
    regex,
    allColumns,
    searchCol,
    columns,
    searchIndex,
  } = opts;

  if (!text) return true;

  let match;
  if (regex) {
    const hay = allColumns
      ? columns.map((c) => row[c] || '').join('')
      : row[searchCol] || '';
    match = regex.test(String(hay));
  } else {
    const hay = allColumns
      ? (searchIndex
          ? searchIndex[rowIndex]
          : columns.map((c) => row[c] || '').join('').toLowerCase())
      : String(row[searchCol] || '').toLowerCase();
    match = hay.includes(text);
  }

  return useExclude ? !match : match;
}

/**
 * Pure filter pipeline: raw rows → matching row indices.
 * @param {object} params
 * @param {Array<Record<string, unknown>>} params.data
 * @param {string[]} params.columns
 * @param {Record<string, unknown>} [params.colFilters]
 * @param {string} [params.searchText]
 * @param {boolean} [params.useRegex]
 * @param {boolean} [params.useExclude]
 * @param {string} [params.regexFlags]
 * @param {string} [params.searchCol]
 * @param {string} [params.dateFrom]
 * @param {string} [params.dateTo]
 * @param {string} [params.dateCol]
 * @param {string[]} [params.dateColsDetected]
 * @param {string[]|null} [params.searchIndex]
 * @param {boolean} [params.lastUseRegex]
 * @returns {{ filtered: number[], searchIndex: string[]|null, lastUseRegex: boolean }}
 */
export function filterRows({
  data,
  columns,
  colFilters = {},
  searchText = '',
  useRegex = false,
  useExclude = false,
  regexFlags = 'i',
  searchCol = ALL_COLUMNS_LABEL,
  dateFrom = '',
  dateTo = '',
  dateCol = '',
  dateColsDetected = [],
  searchIndex = null,
  lastUseRegex = false,
}) {
  const rawText = String(searchText ?? '').trim();
  const text = useRegex ? rawText : rawText.toLowerCase();
  const allColumns = !searchCol || searchCol === ALL_COLUMNS_LABEL;
  const effectiveDateCol =
    dateCol || (dateColsDetected?.length === 1 ? dateColsDetected[0] : '');
  const hasDates = !!(effectiveDateCol && (dateFrom || dateTo));
  const hasText = text !== '';
  const filterOps = buildFilterOps(colFilters);

  let nextSearchIndex = searchIndex;
  if (useRegex || (!useRegex && lastUseRegex)) {
    nextSearchIndex = null;
  }
  const nextLastUseRegex = useRegex;

  if (hasText && allColumns && !useRegex) {
    if (nextSearchIndex && nextSearchIndex.length !== data.length) {
      nextSearchIndex = null;
    }
    nextSearchIndex = buildSearchIndex(data, columns, nextSearchIndex);
  }

  const regex = compileSearchRegex(rawText, useRegex, regexFlags);
  const len = data.length;
  const filtered = [];

  for (let i = 0; i < len; i++) {
    const row = data[i];
    if (!row) continue;

    if (!rowMatchesFilterOps(row, filterOps)) continue;
    if (!rowMatchesDateRange(row, effectiveDateCol, dateFrom, dateTo)) continue;
    if (
      hasText &&
      !rowMatchesTextSearch(row, i, {
        text,
        useRegex,
        useExclude: useExclude,
        regex,
        allColumns,
        searchCol,
        columns,
        searchIndex: nextSearchIndex,
      })
    ) {
      continue;
    }

    filtered.push(i);
  }

  return {
    filtered,
    searchIndex: nextSearchIndex,
    lastUseRegex: nextLastUseRegex,
  };
}
