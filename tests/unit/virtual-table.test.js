import { describe, expect, it } from 'vitest';
import {
  VT_BUFFER,
  VT_ROW_H,
  computeAverageRowHeight,
  computeVisibleRange,
  getOrderedColumns,
  getRenderColumns,
  invalidateVirtualTableCache,
  virtualTableState,
} from '../../src/engine/virtual-table.js';

describe('computeAverageRowHeight', () => {
  it('returns default when no measurements', () => {
    expect(computeAverageRowHeight({})).toBe(VT_ROW_H);
  });

  it('uses measured average capped at default minimum', () => {
    expect(computeAverageRowHeight({ 0: 40, 1: 50 })).toBe(45);
  });
});

describe('computeVisibleRange', () => {
  it('computes buffered visible row range', () => {
    const { startRow, endRow, rowH } = computeVisibleRange({
      scrollTop: 300,
      viewH: 600,
      totalRows: 1000,
      rowHeights: {},
      buffer: VT_BUFFER,
    });
    expect(startRow).toBe(Math.max(0, Math.floor(300 / VT_ROW_H) - VT_BUFFER));
    expect(endRow).toBeLessThanOrEqual(999);
    expect(rowH).toBe(VT_ROW_H);
  });

  it('handles empty dataset', () => {
    const r = computeVisibleRange({ scrollTop: 0, viewH: 400, totalRows: 0, rowHeights: {} });
    expect(r.endRow).toBe(-1);
  });
});

describe('getOrderedColumns', () => {
  it('places frozen columns first and skips hidden', () => {
    const tab = {
      columns: ['A', 'B', 'C', 'D'],
      hiddenCols: new Set(['B']),
      frozenCols: new Set(['C']),
      frozenOrder: ['C'],
    };
    expect(getOrderedColumns(tab)).toEqual(['C', 'A', 'D']);
    expect(getRenderColumns(tab)).toEqual(['C', 'A', 'D']);
  });
});

describe('virtualTableState', () => {
  it('invalidateVirtualTableCache resets scroll window', () => {
    virtualTableState.lastStart = 10;
    virtualTableState.lastEnd = 50;
    virtualTableState.rowHeights = { 10: 32 };
    invalidateVirtualTableCache();
    expect(virtualTableState.lastStart).toBe(-1);
    expect(virtualTableState.lastEnd).toBe(-1);
    expect(virtualTableState.rowHeights).toEqual({});
  });
});
