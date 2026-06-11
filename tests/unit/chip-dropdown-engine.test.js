import { describe, expect, it } from 'vitest';
import {
  cdpHeaderCountLabel,
  cdpSpecCounts,
  computeChipDropdownLayout,
  computeDateChipPanelLayout,
  filterCdpOptionValues,
  getContainsChipQuery,
  isContainsChipFilter,
  prepareCdpPanelData,
} from '../../src/engine/chip-dropdown-engine.js';
import { COL_FILTER } from '../../src/engine/filter-types.js';

const rawData = [
  { Estado: 'Activo', Depto: 'A' },
  { Estado: 'Inactivo', Depto: 'B' },
  { Estado: 'Activo', Depto: 'A' },
];

describe('prepareCdpPanelData', () => {
  it('builds candidate rows and value counts excluding active column filter', () => {
    const colUniques = {
      Estado: new Set(['Activo', 'Inactivo']),
      Depto: new Set(['A', 'B']),
    };
    const data = prepareCdpPanelData({
      rawData,
      colFilters: { Estado: 'Activo' },
      colUniques,
      col: 'Depto',
    });
    expect(data.candidateRows).toEqual([0, 2]);
    expect(data.valueCounts).toEqual({ A: 2 });
    expect(data.allValues).toEqual(['A', 'B']);
    expect(data.selection.size).toBe(0);
  });
});

describe('filterCdpOptionValues', () => {
  it('filters values by query', () => {
    expect(filterCdpOptionValues(['Alpha', 'Beta', 'Gamma'], 'ta')).toEqual(['Beta']);
    expect(filterCdpOptionValues(['Alpha', 'Beta', 'Gamma'], 'ma')).toEqual(['Gamma']);
    expect(filterCdpOptionValues(['Alpha'], '')).toEqual(['Alpha']);
  });
});

describe('cdpHeaderCountLabel', () => {
  it('formats selection counter', () => {
    expect(cdpHeaderCountLabel(2, 5)).toBe('2/5');
    expect(cdpHeaderCountLabel(0, 5)).toBe('0/5');
  });
});

describe('cdpSpecCounts', () => {
  it('counts all, with-value, and null rows', () => {
    const withNull = [...rawData, { Estado: '', Depto: null }];
    expect(cdpSpecCounts(withNull, [0, 1, 2, 3], 'Estado')).toEqual({
      all: 4,
      withValue: 3,
      null: 1,
    });
  });
});

describe('contains filter helpers', () => {
  it('detects and reads contains chip filters', () => {
    const val = `${COL_FILTER.CONTAINS_PREFIX}ana`;
    expect(isContainsChipFilter(val)).toBe(true);
    expect(getContainsChipQuery(val)).toBe('ana');
    expect(isContainsChipFilter('Activo')).toBe(false);
  });
});

describe('computeChipDropdownLayout', () => {
  it('clamps panel within viewport', () => {
    const layout = computeChipDropdownLayout(
      { top: 100, left: 700, right: 780, bottom: 130 },
      { width: 800, height: 600, panelW: 320 }
    );
    expect(layout.left).toBeLessThanOrEqual(474);
    expect(layout.top).toBe(134);
    expect(layout.maxHeight).toBeGreaterThan(0);
  });

  it('uses full width on mobile', () => {
    const layout = computeChipDropdownLayout(
      { top: 50, left: 10, right: 90, bottom: 80 },
      { width: 390, height: 700, panelW: 320 }
    );
    expect(layout.width).toBe(374);
    expect(layout.left).toBe(8);
  });
});

describe('computeDateChipPanelLayout', () => {
  it('positions date mini-panel below chip', () => {
    const layout = computeDateChipPanelLayout(
      { top: 40, left: 100, right: 180, bottom: 68 },
      { width: 1024, panelW: 280 }
    );
    expect(layout.top).toBe(72);
    expect(layout.maxHeight).toBe(200);
  });
});
