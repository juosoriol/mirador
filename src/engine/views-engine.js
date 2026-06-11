import { COL_FILTER } from './filter-types.js';
import { createTabState } from './tab-model.js';

/** @param {string|null|undefined} raw */
export function parseFavoritesJson(raw) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

/** @param {unknown[]} favs */
export function serializeFavorites(favs) {
  return JSON.stringify(favs);
}

/**
 * @param {string} storageKey
 * @param {Storage|null|undefined} [storage]
 */
export function readFavoritesFromStorage(storageKey, storage = globalThis.localStorage) {
  if (!storage) return [];
  return parseFavoritesJson(storage.getItem(storageKey));
}

/**
 * @param {string} storageKey
 * @param {unknown[]} favs
 * @param {Storage|null|undefined} [storage]
 * @returns {{ ok: true } | { ok: false, quota: boolean }}
 */
export function writeFavoritesToStorage(storageKey, favs, storage = globalThis.localStorage) {
  if (!storage) return { ok: false, quota: false };
  try {
    storage.setItem(storageKey, serializeFavorites(favs));
    return { ok: true };
  } catch (e) {
    const quota = e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message || ''));
    return { ok: false, quota };
  }
}

/** @param {unknown} val */
export function formatFilterSummaryValue(val) {
  if (Array.isArray(val)) {
    return val.length === 1 ? val[0] : `${val.length} valores`;
  }
  if (val === COL_FILTER.NULL) return 'sin valor';
  if (val === COL_FILTER.WITH) return 'con valor';
  if (typeof val === 'string' && val.startsWith(COL_FILTER.CONTAINS_PREFIX)) {
    return `~${val.slice(COL_FILTER.CONTAINS_PREFIX.length)}`;
  }
  return String(val ?? '');
}

/** Human-readable one-line summary of saved view filters. */
export function buildFilterSummary(st) {
  const parts = [];
  Object.entries(st?.colFilters || {}).forEach(([col, val]) => {
    parts.push(`${col}:${formatFilterSummaryValue(val)}`);
  });
  if (st?.searchText) parts.push(`"${st.searchText}"`);
  if (st?.dateFrom || st?.dateTo) {
    parts.push(`${st.dateCol || 'fecha'}:${st.dateFrom || '*'}→${st.dateTo || '*'}`);
  }
  return parts.length ? parts.join(' · ') : '(sin filtros)';
}

/**
 * Snapshot tab + search UI into a storable view state object.
 * @param {object} tab
 * @param {object} [ui]
 * @param {{ compact?: boolean }} [opts]
 */
export function buildViewState(tab, ui = {}, { compact = false } = {}) {
  const state = {
    colFilters: JSON.parse(JSON.stringify(tab.colFilters || {})),
    searchText: tab.searchText ?? ui.searchText ?? '',
    searchCol: tab.searchCol ?? ui.searchCol ?? '',
    dateFrom: tab.dateFrom ?? ui.dateFrom ?? '',
    dateTo: tab.dateTo ?? ui.dateTo ?? '',
    dateCol: tab.dateCol ?? ui.dateCol ?? '',
    fileName: tab.fileName,
    activeSheet: tab.activeSheet,
    sheets: tab.sheets,
    dateColsDetected: tab.dateColsDetected,
    color: tab.color,
  };
  if (!compact) {
    state.columns = tab.columns;
    state.rawData = tab.rawData;
  }
  return state;
}

export function defaultFavoriteName(fileName) {
  return (fileName || 'Vista').replace(/\.[^.]+$/, '');
}

/** @param {unknown[]} favs @param {string} fileName */
export function findFavoriteByFileName(favs, fileName) {
  return favs.findIndex((f) => f.state?.fileName === fileName);
}

/** @param {unknown[]} favs @param {string} name */
export function findFavoriteByName(favs, name) {
  return favs.findIndex((f) => f.name === name);
}

/** @param {unknown[]} favs @param {string} fileName */
export function isFavoriteFile(favs, fileName) {
  return favs.some((f) => f.state?.fileName === fileName);
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {object} params.state
 * @param {string} [params.date]
 */
export function createFavoriteEntry({ name, state, date }) {
  const localeDate = date ?? new Date().toLocaleDateString('es-CO');
  return {
    name,
    summary: buildFilterSummary(state),
    state,
    date: localeDate,
  };
}

/** @param {unknown[]} favs @param {object} entry @param {'fileName'|'name'} matchBy */
export function upsertFavorite(favs, entry, matchBy = 'fileName') {
  const key = matchBy === 'name' ? entry.name : entry.state?.fileName;
  const idx =
    matchBy === 'name'
      ? findFavoriteByName(favs, key)
      : findFavoriteByFileName(favs, key);
  if (idx >= 0) favs[idx] = entry;
  else favs.push(entry);
  return favs;
}

/** @param {object} fav @param {number} id @param {string} defaultColor */
export function createTabFromFavoriteState(fav, id, defaultColor) {
  const st = fav.state || {};
  const tab = createTabState(id, st.fileName || fav.name, st.color || defaultColor);
  tab.sheets = st.sheets || [st.activeSheet || ''];
  tab.activeSheet = st.activeSheet || '';
  tab.rawData = st.rawData || [];
  tab.columns = st.columns || [];
  tab.colFilters = JSON.parse(JSON.stringify(st.colFilters || {}));
  tab.dateColsDetected = st.dateColsDetected || [];
  tab.searchText = st.searchText || '';
  tab.searchCol = st.searchCol || '';
  tab.dateFrom = st.dateFrom || '';
  tab.dateTo = st.dateTo || '';
  tab.dateCol = st.dateCol || '';
  return tab;
}

/** Apply saved filter/search fields onto an already-open tab. */
export function applyFavoriteFiltersToTab(tab, state) {
  tab.colFilters = JSON.parse(JSON.stringify(state.colFilters || {}));
  tab.searchText = state.searchText || '';
  tab.searchCol = state.searchCol || '';
  tab.dateFrom = state.dateFrom || '';
  tab.dateTo = state.dateTo || '';
  tab.dateCol = state.dateCol || '';
}
