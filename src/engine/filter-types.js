/** Sentinel values stored in tab.colFilters (legacy contract). */
export const COL_FILTER = {
  NULL: '__NULL__',
  WITH: '__WITH__',
  CONTAINS_PREFIX: '__CONTAINS__:',
  DATE_RANGE_PREFIX: '__DATE_RANGE__:',
  DATE_TO_SEPARATOR: '__TO__:',
};

/** Internal op types produced by buildFilterOps(). */
export const FILTER_OP = {
  EXACT: 0,
  SET: 1,
  NULL: 2,
  WITH: 3,
  CONTAINS: 4,
  DATE_RANGE: 5,
};

export const ALL_COLUMNS_LABEL = '(Todas las columnas)';
