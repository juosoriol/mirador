export const RECENT_SEARCH_MAX = 8;

/** Fade duration: 48 hours in ms */
export const RECENT_SEARCH_FADE_MS = 172800000;

export const RECENT_SEARCH_COLORS = [
  { bg: '#3b82f611', border: '#3b82f633', text: '#60a5fa' },
  { bg: '#10b98111', border: '#10b98133', text: '#34d399' },
  { bg: '#8b5cf611', border: '#8b5cf633', text: '#a78bfa' },
  { bg: '#f59e0b11', border: '#f59e0b33', text: '#fbbf24' },
  { bg: '#ef444411', border: '#ef444433', text: '#f87171' },
  { bg: '#ec489911', border: '#ec489933', text: '#f472b6' },
];

export const RECENT_SEARCH_ENABLED_KEY = 'mirador_recent_enabled';
export const RECENT_SEARCH_STORAGE_KEY = 'mirador_recent_searches_v1';

/** @param {string|null|undefined} raw */
export function parseRecentSearchesJson(raw) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

/** @param {unknown[]} arr */
export function serializeRecentSearches(arr) {
  return JSON.stringify(arr);
}

export function readRecentSearchesFromStorage(
  storageKey,
  storage = globalThis.localStorage
) {
  if (!storage) return [];
  return parseRecentSearchesJson(storage.getItem(storageKey));
}

export function writeRecentSearchesToStorage(
  storageKey,
  arr,
  storage = globalThis.localStorage
) {
  if (!storage) return false;
  storage.setItem(storageKey, serializeRecentSearches(arr));
  return true;
}

export function isRecentSearchEnabled(storage = globalThis.localStorage) {
  if (!storage) return true;
  return storage.getItem(RECENT_SEARCH_ENABLED_KEY) !== '0';
}

export function setRecentSearchEnabled(enabled, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(RECENT_SEARCH_ENABLED_KEY, enabled ? '1' : '0');
}

/**
 * @param {Array<{ q: string, ts?: number, color?: number }>} arr
 * @param {string} q
 * @param {number} [now]
 */
export function addRecentSearchEntry(arr, q, now = Date.now()) {
  if (!q || q.length < 2) return arr;
  const next = arr.filter((r) => r.q !== q);
  next.unshift({ q, ts: now, color: next.length % RECENT_SEARCH_COLORS.length });
  if (next.length > RECENT_SEARCH_MAX) next.length = RECENT_SEARCH_MAX;
  return next;
}

/** @param {Array<unknown>} arr @param {number} idx */
export function deleteRecentSearchAt(arr, idx) {
  arr.splice(idx, 1);
  return arr;
}

/** Opacity for recent search chip based on age (fresh → faded over 48h). */
export function computeRecentSearchOpacity(ts, now = Date.now()) {
  const age = now - ts;
  return Math.max(0.15, 1 - age / RECENT_SEARCH_FADE_MS);
}

/** @param {{ color?: number }} entry */
export function getRecentSearchChipStyle(entry) {
  return RECENT_SEARCH_COLORS[entry.color || 0] || RECENT_SEARCH_COLORS[0];
}
