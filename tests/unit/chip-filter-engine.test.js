import { describe, expect, it } from 'vitest';
import {
  buildCandidateRowIndices,
  buildDateRangeFilter,
  computeFilteredNonEmptyCounts,
  countColumnValueMap,
  countNullRows,
  countNonNullRows,
  findCedulaColumn,
  getChipFilterDisplayLabel,
  invertChipSelection,
  precalcColStats,
  selectionSetFromFilter,
  sortColumnValues,
  toggleChipSelection,
} from '../../src/engine/chip-filter-engine.js';
import { COL_FILTER } from '../../src/engine/filter-types.js';

const data = [
  { Nombre: 'Ana', Estado: 'Activo', Cedula: '123', Depto: 'A' },
  { Nombre: 'Bob', Estado: 'Inactivo', Cedula: '', Depto: 'B' },
  { Nombre: 'Carla', Estado: 'Activo', Cedula: '456', Depto: 'A' },
  { Nombre: 'Diego', Estado: 'Activo', Cedula: null, Depto: 'C' },
];

describe('findCedulaColumn', () => {
  it('finds cédula column case-insensitively', () => {
    expect(findCedulaColumn(['Nombre', 'Cédula', 'Estado'])).toBe('Cédula');
    expect(findCedulaColumn(['cedula'])).toBe('cedula');
    expect(findCedulaColumn(['Nombre'])).toBeNull();
  });
});

describe('precalcColStats', () => {
  it('counts uniques and nulls per column', () => {
    const tab = { rawData: data, columns: ['Nombre', 'Estado', 'Cedula', 'Depto'] };
    precalcColStats(tab);
    expect(tab.colUniques.Estado.size).toBe(2);
    expect(tab.colNulls.Cedula).toBe(2);
    expect(tab.colUniques.Depto.has('A')).toBe(true);
  });
});

describe('buildCandidateRowIndices', () => {
  it('returns all rows when no other filters', () => {
    expect(buildCandidateRowIndices(data, { Estado: 'Activo' }, 'Depto')).toEqual([0, 2, 3]);
  });

  it('excludes the active column filter from candidate set', () => {
    const indices = buildCandidateRowIndices(
      data,
      { Estado: 'Activo', Depto: 'A' },
      'Depto'
    );
    expect(indices).toEqual([0, 2, 3]);
  });
});

describe('count helpers', () => {
  const rows = [0, 1, 2, 3];

  it('counts value occurrences', () => {
    expect(countColumnValueMap(data, rows, 'Estado')).toEqual({
      Activo: 3,
      Inactivo: 1,
    });
  });

  it('counts null and non-null cédula rows', () => {
    expect(countNullRows(data, rows, 'Cedula')).toBe(2);
    expect(countNonNullRows(data, rows, 'Cedula')).toBe(2);
  });
});

describe('getChipFilterDisplayLabel', () => {
  it('formats filter labels for chips', () => {
    expect(getChipFilterDisplayLabel(['A', 'B'])).toBe('2 seleccionados');
    expect(getChipFilterDisplayLabel(['Solo'])).toBe('Solo');
    expect(getChipFilterDisplayLabel(COL_FILTER.NULL)).toBe('sin cédula');
    expect(getChipFilterDisplayLabel(`${COL_FILTER.CONTAINS_PREFIX}ana`)).toBe('contiene "ana"');
    expect(
      getChipFilterDisplayLabel(`${COL_FILTER.DATE_RANGE_PREFIX}2024-01-01${COL_FILTER.DATE_TO_SEPARATOR}2024-12-31`)
    ).toBe('2024-01-01 → 2024-12-31');
  });
});

describe('toggleChipSelection', () => {
  it('adds and removes values from multi-select', () => {
    expect(toggleChipSelection(undefined, 'A')).toEqual(['A']);
    expect(toggleChipSelection(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleChipSelection(['A', 'B'], 'A')).toEqual(['B']);
    expect(toggleChipSelection(['A'], 'A')).toBeUndefined();
  });
});

describe('invertChipSelection', () => {
  const all = ['A', 'B', 'C'];

  it('rejects invert without prior selection', () => {
    expect(invertChipSelection(all, undefined).ok).toBe(false);
  });

  it('clears when all values selected', () => {
    const r = invertChipSelection(all, ['A', 'B', 'C']);
    expect(r).toMatchObject({ ok: true, action: 'clear' });
  });

  it('inverts partial selection', () => {
    const r = invertChipSelection(all, ['A']);
    expect(r).toMatchObject({ ok: true, action: 'invert', values: ['B', 'C'] });
  });
});

describe('sortColumnValues', () => {
  it('sorts numerically when possible', () => {
    expect(sortColumnValues(['10', '2', '1'])).toEqual(['1', '2', '10']);
  });
});

describe('buildDateRangeFilter', () => {
  it('builds and clears date range tokens', () => {
    expect(buildDateRangeFilter('2024-01-01', '2024-12-31')).toContain('__DATE_RANGE__');
    expect(buildDateRangeFilter('', '')).toBeUndefined();
  });
});

describe('computeFilteredNonEmptyCounts', () => {
  it('counts non-empty values for chip columns in filtered set', () => {
    const counts = computeFilteredNonEmptyCounts(data, [0, 2, 3], new Set(['Estado', 'Depto']));
    expect(counts.Estado).toBe(3);
    expect(counts.Depto).toBe(3);
  });
});

describe('selectionSetFromFilter', () => {
  it('ignores special filter tokens', () => {
    expect(selectionSetFromFilter(COL_FILTER.NULL).size).toBe(0);
    expect(selectionSetFromFilter(['X']).has('X')).toBe(true);
    expect(selectionSetFromFilter('X').has('X')).toBe(true);
  });
});
