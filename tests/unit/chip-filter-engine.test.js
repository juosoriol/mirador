import { describe, expect, it } from 'vitest';
import {
  buildCandidateRowIndices,
  buildDateRangeFilter,
  countColumnValueMap,
  countNullRows,
  findCedulaColumn,
  getChipFilterDisplayLabel,
  precalcColStats,
  selectionSetFromFilter,
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

  it('counts null cédula rows', () => {
    expect(countNullRows(data, rows, 'Cedula')).toBe(2);
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

describe('buildDateRangeFilter', () => {
  it('builds and clears date range tokens', () => {
    expect(buildDateRangeFilter('2024-01-01', '2024-12-31')).toContain('__DATE_RANGE__');
    expect(buildDateRangeFilter('', '')).toBeUndefined();
  });
});

describe('selectionSetFromFilter', () => {
  it('ignores special filter tokens', () => {
    expect(selectionSetFromFilter(COL_FILTER.NULL).size).toBe(0);
    expect(selectionSetFromFilter(['X']).has('X')).toBe(true);
    expect(selectionSetFromFilter('X').has('X')).toBe(true);
  });
});
