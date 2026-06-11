export const STATS_PILL_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#ec4899',
  '#14b8a6',
];

/** Auto-detect default stats panel columns from sheet headers. */
export function detectDefaultStatsPanels(columns) {
  const panels = [];
  const vCol = columns.find((c) => /vinculaci/i.test(c));
  const eCol = columns.find((c) => /^estado$/i.test(c.trim()));
  const sCol = columns.find(
    (c) => /^sexo$/i.test(c.trim()) || /^g[eé]nero$/i.test(c.trim())
  );
  if (vCol) panels.push(vCol);
  if (eCol) panels.push(eCol);
  if (sCol) panels.push(sCol);
  return panels;
}

/** Normalize grouping key (e.g. uppercase gender codes). */
export function normalizeStatsPanelKey(col, value) {
  if (/^sexo$/i.test(col) || /^g[eé]nero$/i.test(col)) return String(value).toUpperCase();
  return value;
}

/**
 * Count values per stats panel column over filtered rows.
 * @param {Array<Record<string, unknown>>} rawData
 * @param {number[]} filtered
 * @param {string[]} panels
 */
export function computeStatsPanelCounts(rawData, filtered, panels) {
  /** @type {Record<string, Record<string, number>>} */
  const panelCounts = {};
  panels.forEach((c) => {
    panelCounts[c] = {};
  });
  filtered.forEach((i) => {
    const row = rawData[i];
    if (!row) return;
    for (const col of panels) {
      const v = row[col];
      if (!v) continue;
      const key = normalizeStatsPanelKey(col, v);
      panelCounts[col][key] = (panelCounts[col][key] || 0) + 1;
    }
  });
  return panelCounts;
}

/** Top N entries by count, descending. */
export function topStatsEntries(counts, max = 5) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
}

/** Short label for stats pill display (first two words). */
export function shortStatsPillLabel(key) {
  return String(key).split(' ').slice(0, 2).join(' ');
}

/**
 * Toggle stats-bar pill click → new colFilters value (undefined = remove filter).
 * @param {unknown} currentFilter
 * @param {string} val
 * @param {boolean} multiSelect ctrl/meta held
 */
export function toggleStatsPillFilter(currentFilter, val, multiSelect) {
  if (multiSelect) {
    let sel = new Set(
      Array.isArray(currentFilter)
        ? currentFilter
        : currentFilter &&
            currentFilter !== '__NULL__' &&
            currentFilter !== '__WITH__' &&
            typeof currentFilter === 'string' &&
            !currentFilter.startsWith('__CONTAINS__:')
          ? [currentFilter]
          : []
    );
    sel.has(val) ? sel.delete(val) : sel.add(val);
    if (sel.size === 0) return undefined;
    return [...sel];
  }
  if (typeof currentFilter === 'string' && currentFilter === val) return undefined;
  if (
    Array.isArray(currentFilter) &&
    currentFilter.length === 1 &&
    currentFilter[0] === val
  ) {
    return undefined;
  }
  return val;
}
