import { useSyncExternalStore } from 'react';

const EVENT = 'mirador:filters-changed';
let version = 0;

function subscribe(cb) {
  const handler = () => {
    version++;
    cb();
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Re-render whenever core.js finishes a filter pass; returns the active tab (or null). */
export function useActiveTab() {
  const v = useSyncExternalStore(subscribe, () => version);
  const tab = typeof window.T === 'function' ? window.T() : null;
  if (tab && tab.rawData?.length && !tab.colUniques && typeof window.precalcColStats === 'function') {
    window.precalcColStats(tab);
  }
  return { tab: tab?.rawData?.length ? tab : null, version: v };
}

export function setColFilter(col, next) {
  const tab = window.T?.();
  if (!tab) return;
  if (next === undefined) delete tab.colFilters[col];
  else tab.colFilters[col] = next;
  window.applyFilters?.();
}

export function clearAllColFilters() {
  const tab = window.T?.();
  if (!tab) return;
  Object.keys(tab.colFilters).forEach((k) => delete tab.colFilters[k]);
  window.applyFilters?.();
}

function isPillsMode() {
  return !!document.getElementById('pills-view')?.classList.contains('open');
}

/** Put text into the live search box of the current view and run the filter. */
export function setGlobalSearch(text) {
  const tab = window.T?.();
  if (!tab) return;
  const pills = isPillsMode();
  const input = document.getElementById(pills ? 'pills-search-input' : 'search-input');
  if (input) input.value = text;
  if (pills) tab.pillsSearchText = text;
  else tab.searchText = text;
  window.applyFilters?.();
}

/** Text currently typed in the live search box of the active view. */
export function getGlobalSearch(tab) {
  if (!tab) return '';
  const text = typeof window._activeSearchText === 'function' ? window._activeSearchText(tab) : tab.searchText;
  return String(text ?? '').trim();
}

/** Row indices matching every filter (including the text search) except the one on `col`. */
export function facetRowsExcept(col) {
  return typeof window._facetRowsExcept === 'function' ? window._facetRowsExcept(col) : undefined;
}
