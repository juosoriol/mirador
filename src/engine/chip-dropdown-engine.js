import { COL_FILTER } from './filter-types.js';
import {
  buildCandidateRowIndices,
  countColumnValueMap,
  countNullRows,
  countNonNullRows,
  selectionSetFromFilter,
  sortColumnValues,
} from './chip-filter-engine.js';

/**
 * Pure data bundle for chip dropdown rendering.
 * @param {object} params
 * @param {Array<Record<string, unknown>>} params.rawData
 * @param {Record<string, unknown>} params.colFilters
 * @param {Record<string, Set<unknown>>} params.colUniques
 * @param {string} params.col
 */
export function prepareCdpPanelData({ rawData, colFilters, colUniques, col }) {
  const candidateRows = buildCandidateRowIndices(rawData, colFilters, col);
  const valueCounts = countColumnValueMap(rawData, candidateRows, col);
  const allValues = colUniques[col] ? sortColumnValues(colUniques[col]) : [];
  const curFilter = colFilters[col];
  const selection = selectionSetFromFilter(curFilter);
  return {
    candidateRows,
    valueCounts,
    allValues,
    curFilter,
    selection,
  };
}

/** @param {string[]} allValues @param {string} [query] */
export function filterCdpOptionValues(allValues, query = '') {
  const q = query.trim().toLowerCase();
  if (!q) return allValues;
  return allValues.filter((v) => String(v).toLowerCase().includes(q));
}

export function cdpHeaderCountLabel(selectionSize, totalValues) {
  return selectionSize > 0 ? `${selectionSize}/${totalValues}` : `0/${totalValues}`;
}

/** @param {Array<Record<string, unknown>>} rawData @param {number[]} candidateRows @param {string} col */
export function cdpSpecCounts(rawData, candidateRows, col) {
  return {
    all: candidateRows.length,
    withValue: countNonNullRows(rawData, candidateRows, col),
    null: countNullRows(rawData, candidateRows, col),
  };
}

/** @param {unknown} curFilter */
export function isContainsChipFilter(curFilter) {
  return typeof curFilter === 'string' && curFilter.startsWith(COL_FILTER.CONTAINS_PREFIX);
}

/** @param {unknown} curFilter */
export function getContainsChipQuery(curFilter) {
  return isContainsChipFilter(curFilter)
    ? curFilter.slice(COL_FILTER.CONTAINS_PREFIX.length)
    : '';
}

/**
 * Compute fixed-position dropdown coordinates (standard value panel).
 * @param {{ top: number, left: number, right: number, bottom: number }} refRect
 * @param {{ width?: number, height?: number, panelW?: number }} [viewport]
 */
export function computeChipDropdownLayout(refRect, viewport = {}) {
  const vw = viewport.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
  const vh = viewport.height ?? (typeof window !== 'undefined' ? window.innerHeight : 600);
  const panelW = viewport.panelW ?? 320;
  const isMobile = vw <= 500;

  let left = refRect.left;
  if (left + panelW > vw - 10) left = Math.max(6, refRect.right - panelW);
  const top = refRect.bottom + 4;
  const available = vh - top - 12;
  const safeLeft = isMobile ? 8 : Math.max(6, Math.min(left, vw - panelW - 6));

  return {
    left: safeLeft,
    top,
    maxHeight: Math.min(420, Math.max(180, available)),
    width: isMobile ? vw - 16 : null,
  };
}

/**
 * Compute layout for date-range chip mini-panel.
 * @param {{ top: number, left: number, right: number, bottom: number }} refRect
 * @param {{ width?: number, panelW?: number }} [viewport]
 */
export function computeDateChipPanelLayout(refRect, viewport = {}) {
  const vw = viewport.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
  const panelW = viewport.panelW ?? 280;
  let left = refRect.left;
  if (left + panelW > vw - 10) left = Math.max(6, refRect.right - panelW);
  const isMobile = vw <= 500;
  const safeLeft = isMobile ? 8 : Math.max(6, Math.min(left, vw - panelW - 6));
  return {
    left: safeLeft,
    top: refRect.bottom + 4,
    maxHeight: 200,
    width: isMobile ? vw - 16 : null,
  };
}
