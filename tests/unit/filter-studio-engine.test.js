import { describe, expect, it } from 'vitest';
import {
  activeFilterTokens,
  columnFacet,
  containsFilter,
  filterColumnList,
  listFilterColumns,
  normalizeText,
  parseSmartQuery,
  quickPicks,
  selectValues,
  setValueSelected,
  smartSuggestions,
} from '../../src/engine/filter-studio-engine.js';
import { precalcColStats } from '../../src/engine/chip-filter-engine.js';

function makeTab(colFilters = {}) {
  const tab = {
    columns: ['Cédula', 'Nombre', 'Ciudad', 'Estado', 'Fecha'],
    rawData: [
      { Cédula: '1', Nombre: 'Ana', Ciudad: 'Bogotá', Estado: 'Activo', Fecha: '2024-01-01' },
      { Cédula: '', Nombre: 'Luis', Ciudad: 'Medellín', Estado: 'Activo', Fecha: '2024-02-01' },
      { Cédula: '3', Nombre: 'María', Ciudad: 'Cali', Estado: 'Inactivo', Fecha: '2024-03-01' },
      { Cédula: '4', Nombre: 'Juan', Ciudad: 'Bogotá', Estado: 'Inactivo', Fecha: '' },
    ],
    dateColsDetected: ['Fecha'],
    colFilters,
  };
  precalcColStats(tab);
  return tab;
}

describe('normalizeText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeText('  Bogotá ')).toBe('bogota');
  });
});

describe('listFilterColumns', () => {
  it('classifies cedula, date and value columns', () => {
    const cols = listFilterColumns(makeTab({ Estado: ['Activo'] }));
    expect(cols.map((c) => [c.col, c.kind])).toEqual([
      ['Cédula', 'cedula'],
      ['Nombre', 'values'],
      ['Ciudad', 'values'],
      ['Estado', 'values'],
      ['Fecha', 'date'],
    ]);
    expect(cols.find((c) => c.col === 'Estado')).toMatchObject({ active: true, label: 'Activo' });
  });

  it('skips hidden columns and respects the chip limit', () => {
    const tab = makeTab();
    tab.hiddenCols = new Set(['Ciudad']);
    const cols = listFilterColumns(tab, 3).map((c) => c.col);
    expect(cols).not.toContain('Ciudad');
    expect(cols).not.toContain('Nombre');
  });

  it('filterColumnList matches accent-insensitively', () => {
    const cols = listFilterColumns(makeTab());
    expect(filterColumnList(cols, 'cedu').map((c) => c.col)).toEqual(['Cédula']);
  });
});

describe('columnFacet', () => {
  it('counts values over rows matching other filters, sorted by count', () => {
    const facet = columnFacet(makeTab({ Estado: ['Activo'] }), 'Ciudad');
    expect(facet.candidateCount).toBe(2);
    expect(facet.values[0]).toMatchObject({ count: 1 });
    expect(facet.values.find((v) => v.value === 'Cali').count).toBe(0);
    expect(facet.totalValues).toBe(3);
  });

  it('marks selected values and filters by query', () => {
    const facet = columnFacet(makeTab({ Ciudad: ['Cali'] }), 'Ciudad', { query: 'cal' });
    expect(facet.values).toEqual([{ value: 'Cali', count: 1, selected: true }]);
    expect(facet.selectedCount).toBe(1);
  });

  it('counts nulls among candidates', () => {
    expect(columnFacet(makeTab(), 'Cédula').nullCount).toBe(1);
  });
});

describe('selection helpers', () => {
  it('setValueSelected adds and removes', () => {
    expect(setValueSelected(undefined, 'A', true)).toEqual(['A']);
    expect(setValueSelected(['A'], 'A', false)).toBeUndefined();
  });

  it('selectValues merges', () => {
    expect(selectValues(['A'], ['B', 'C']).sort()).toEqual(['A', 'B', 'C']);
  });

  it('containsFilter builds the sentinel', () => {
    expect(containsFilter(' Bog ')).toBe('__CONTAINS__:bog');
    expect(containsFilter('  ')).toBeUndefined();
  });

  it('activeFilterTokens labels filters', () => {
    expect(activeFilterTokens({ Estado: ['Activo', 'Inactivo'] })).toEqual([
      { col: 'Estado', label: '2 seleccionados', value: ['Activo', 'Inactivo'] },
    ]);
  });
});

describe('smart bar', () => {
  it('parseSmartQuery splits on the first colon', () => {
    expect(parseSmartQuery('estado: act')).toEqual({ col: 'estado', value: 'act' });
    expect(parseSmartQuery('bogota')).toEqual({ col: null, value: 'bogota' });
  });

  it('suggests values of a column for "col: value"', () => {
    const s = smartSuggestions(makeTab(), 'est: inac');
    expect(s[0]).toMatchObject({ type: 'value', col: 'Estado', value: 'Inactivo', count: 2 });
  });

  it('offers a contains option when no exact value matches', () => {
    const s = smartSuggestions(makeTab(), 'ciudad: bog');
    expect(s.some((x) => x.type === 'contains' && x.col === 'Ciudad')).toBe(true);
  });

  it('matches columns and values for free text', () => {
    const s = smartSuggestions(makeTab(), 'bogo');
    expect(s.find((x) => x.type === 'value')).toMatchObject({ col: 'Ciudad', value: 'Bogotá', count: 2 });
    expect(s.at(-1)).toEqual({ type: 'search', value: 'bogo' });
    expect(smartSuggestions(makeTab(), 'ciu')[0]).toMatchObject({ type: 'column', col: 'Ciudad' });
  });

  it('returns nothing for empty query', () => {
    expect(smartSuggestions(makeTab(), '')).toEqual([]);
  });

  it('quickPicks returns top values of multi-valued columns', () => {
    const picks = quickPicks(makeTab(), { columns: 2, perColumn: 2 });
    expect(picks.map((p) => p.col)).toEqual(['Nombre', 'Ciudad']);
    expect(picks[1].values[0]).toMatchObject({ value: 'Bogotá', count: 2 });
  });
});
