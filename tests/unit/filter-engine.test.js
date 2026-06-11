import { describe, expect, it } from 'vitest';
import {
  buildFilterOps,
  compileSearchRegex,
  filterRows,
  rowMatchesFilterOp,
  rowMatchesFilterOps,
} from '../../src/engine/filter-engine.js';
import { COL_FILTER, FILTER_OP } from '../../src/engine/filter-types.js';

const sampleData = [
  { Nombre: 'Ana García', Estado: 'Activo', Sexo: 'F', Fecha: '2024-01-15', Cargo: 'Analista' },
  { Nombre: 'Bob Smith', Estado: 'Inactivo', Sexo: 'M', Fecha: '2024-03-20', Cargo: 'Director' },
  { Nombre: 'Carla López', Estado: 'Activo', Sexo: 'F', Fecha: '2024-06-01', Cargo: null },
  { Nombre: 'Diego Ruiz', Estado: '', Sexo: 'M', Fecha: '2023-12-01', Cargo: 'Analista' },
];

const columns = ['Nombre', 'Estado', 'Sexo', 'Fecha', 'Cargo'];

describe('buildFilterOps', () => {
  it('parses exact, set, null, with, contains, and date range filters', () => {
    const ops = buildFilterOps({
      Estado: 'Activo',
      Sexo: ['F', 'M'],
      Cargo: COL_FILTER.NULL,
      Notas: COL_FILTER.WITH,
      Nombre: `${COL_FILTER.CONTAINS_PREFIX}gar`,
      Fecha: `${COL_FILTER.DATE_RANGE_PREFIX}2024-01-01${COL_FILTER.DATE_TO_SEPARATOR}2024-06-30`,
    });

    expect(ops).toHaveLength(6);
    expect(ops[0]).toMatchObject({ col: 'Estado', type: FILTER_OP.EXACT, val: 'Activo' });
    expect(ops[1].type).toBe(FILTER_OP.SET);
    expect(ops[1].set.has('F')).toBe(true);
    expect(ops[2].type).toBe(FILTER_OP.NULL);
    expect(ops[3].type).toBe(FILTER_OP.WITH);
    expect(ops[4]).toMatchObject({ type: FILTER_OP.CONTAINS, q: 'gar' });
    expect(ops[5]).toMatchObject({ type: FILTER_OP.DATE_RANGE, from: '2024-01-01', to: '2024-06-30' });
  });
});

describe('rowMatchesFilterOp', () => {
  it('matches each filter type', () => {
    expect(rowMatchesFilterOp(sampleData[0], { col: 'Estado', type: FILTER_OP.EXACT, val: 'Activo' })).toBe(true);
    expect(rowMatchesFilterOp(sampleData[1], { col: 'Estado', type: FILTER_OP.EXACT, val: 'Activo' })).toBe(false);
    expect(rowMatchesFilterOp(sampleData[0], { col: 'Sexo', type: FILTER_OP.SET, set: new Set(['F']) })).toBe(true);
    expect(rowMatchesFilterOp(sampleData[2], { col: 'Cargo', type: FILTER_OP.NULL })).toBe(true);
    expect(rowMatchesFilterOp(sampleData[0], { col: 'Cargo', type: FILTER_OP.NULL })).toBe(false);
    expect(rowMatchesFilterOp(sampleData[0], { col: 'Cargo', type: FILTER_OP.WITH })).toBe(true);
    expect(rowMatchesFilterOp(sampleData[2], { col: 'Cargo', type: FILTER_OP.WITH })).toBe(false);
    expect(rowMatchesFilterOp(sampleData[0], { col: 'Nombre', type: FILTER_OP.CONTAINS, q: 'ana' })).toBe(true);
    expect(
      rowMatchesFilterOp(sampleData[1], {
        col: 'Fecha',
        type: FILTER_OP.DATE_RANGE,
        from: '2024-01-01',
        to: '2024-12-31',
      })
    ).toBe(true);
  });
});

describe('filterRows', () => {
  it('returns all indices with no filters', () => {
    const { filtered } = filterRows({ data: sampleData, columns });
    expect(filtered).toEqual([0, 1, 2, 3]);
  });

  it('filters by exact column value', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      colFilters: { Estado: 'Activo' },
    });
    expect(filtered).toEqual([0, 2]);
  });

  it('filters by multi-value set', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      colFilters: { Sexo: ['M'] },
    });
    expect(filtered).toEqual([1, 3]);
  });

  it('filters by text search across all columns', () => {
    const { filtered, searchIndex } = filterRows({
      data: sampleData,
      columns,
      searchText: 'director',
    });
    expect(filtered).toEqual([1]);
    expect(searchIndex).toHaveLength(4);
    expect(searchIndex[1]).toContain('director');
  });

  it('filters by text search in one column', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      searchText: 'ana',
      searchCol: 'Nombre',
    });
    expect(filtered).toEqual([0]);
  });

  it('excludes rows matching search when useExclude is true', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      searchText: 'ana',
      useExclude: true,
    });
    expect(filtered).toEqual([1, 2]);
  });

  it('supports regex search with wildcard asterisk', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      searchText: '*analista',
      useRegex: true,
      regexFlags: 'i',
    });
    expect(filtered).toEqual([0, 3]);
  });

  it('filters by global date range using detected date column', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      dateFrom: '2024-02-01',
      dateTo: '2024-12-31',
      dateColsDetected: ['Fecha'],
    });
    expect(filtered).toEqual([1, 2]);
  });

  it('combines column filters with search', () => {
    const { filtered } = filterRows({
      data: sampleData,
      columns,
      colFilters: { Estado: 'Activo' },
      searchText: 'carla',
    });
    expect(filtered).toEqual([2]);
  });

  it('invalidates search index when switching to regex', () => {
    const first = filterRows({
      data: sampleData,
      columns,
      searchText: 'ana',
    });
    expect(first.searchIndex).toHaveLength(4);

    const second = filterRows({
      data: sampleData,
      columns,
      searchText: 'Ana',
      useRegex: true,
      searchCol: 'Nombre',
      searchIndex: first.searchIndex,
      lastUseRegex: first.lastUseRegex,
    });
    expect(second.searchIndex).toBeNull();
    expect(second.lastUseRegex).toBe(true);
    expect(second.filtered).toEqual([0]);
  });

  it('skips empty row slots', () => {
    const sparse = [sampleData[0], null, sampleData[2]];
    const { filtered } = filterRows({ data: sparse, columns });
    expect(filtered).toEqual([0, 2]);
  });
});

describe('compileSearchRegex', () => {
  it('returns null for invalid patterns', () => {
    expect(compileSearchRegex('[', true, 'i')).toBeNull();
  });
});

describe('rowMatchesFilterOps', () => {
  it('requires all ops to pass', () => {
    const ops = buildFilterOps({ Estado: 'Activo', Sexo: ['F'] });
    expect(rowMatchesFilterOps(sampleData[0], ops)).toBe(true);
    expect(rowMatchesFilterOps(sampleData[1], ops)).toBe(false);
  });
});
