import { describe, expect, it } from 'vitest';
import {
  applyFavoriteFiltersToTab,
  buildFilterSummary,
  buildViewState,
  createFavoriteEntry,
  createTabFromFavoriteState,
  defaultFavoriteName,
  findFavoriteByFileName,
  isFavoriteFile,
  parseFavoritesJson,
  upsertFavorite,
  writeFavoritesToStorage,
} from '../../src/engine/views-engine.js';
import { COL_FILTER } from '../../src/engine/filter-types.js';

describe('parseFavoritesJson', () => {
  it('parses valid JSON and falls back on invalid', () => {
    expect(parseFavoritesJson('[{"name":"A"}]')).toEqual([{ name: 'A' }]);
    expect(parseFavoritesJson('bad')).toEqual([]);
  });
});

describe('buildFilterSummary', () => {
  it('summarizes filters, search, and dates', () => {
    const summary = buildFilterSummary({
      colFilters: {
        Estado: 'Activo',
        Notas: COL_FILTER.NULL,
        Tags: ['A', 'B'],
      },
      searchText: 'ana',
      dateCol: 'Fecha',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });
    expect(summary).toContain('Estado:Activo');
    expect(summary).toContain('Notas:sin valor');
    expect(summary).toContain('2 valores');
    expect(summary).toContain('"ana"');
    expect(summary).toContain('Fecha:2024-01-01→2024-12-31');
  });

  it('returns placeholder when empty', () => {
    expect(buildFilterSummary({})).toBe('(sin filtros)');
  });
});

describe('buildViewState', () => {
  it('compact state omits raw rows', () => {
    const state = buildViewState(
      {
        fileName: 'data.xlsx',
        colFilters: { A: 1 },
        columns: ['A'],
        rawData: [{ A: 1 }],
        sheets: ['H1'],
        activeSheet: 'H1',
        dateColsDetected: [],
        color: '#fff',
      },
      {},
      { compact: true }
    );
    expect(state.fileName).toBe('data.xlsx');
    expect(state.rawData).toBeUndefined();
    expect(state.columns).toBeUndefined();
  });
});

describe('favorite helpers', () => {
  const favs = [
    { name: 'Vista A', state: { fileName: 'a.xlsx' } },
    { name: 'Vista B', state: { fileName: 'b.xlsx' } },
  ];

  it('finds and checks favorites by file name', () => {
    expect(findFavoriteByFileName(favs, 'b.xlsx')).toBe(1);
    expect(isFavoriteFile(favs, 'a.xlsx')).toBe(true);
    expect(isFavoriteFile(favs, 'missing.xlsx')).toBe(false);
  });

  it('upserts by file name or display name', () => {
    const list = [...favs];
    upsertFavorite(
      list,
      createFavoriteEntry({
        name: 'Vista A',
        state: { fileName: 'a.xlsx', colFilters: { X: 1 } },
        date: '1/1/2024',
      }),
      'fileName'
    );
    expect(list).toHaveLength(2);
    expect(list[0].state.colFilters).toEqual({ X: 1 });

    upsertFavorite(
      list,
      createFavoriteEntry({ name: 'New', state: { fileName: 'c.xlsx' }, date: '2/2/2024' }),
      'name'
    );
    expect(list).toHaveLength(3);
  });

  it('defaultFavoriteName strips extension', () => {
    expect(defaultFavoriteName('report.xlsx')).toBe('report');
  });
});

describe('createTabFromFavoriteState', () => {
  it('hydrates tab fields from saved favorite', () => {
    const tab = createTabFromFavoriteState(
      {
        name: 'My view',
        state: {
          fileName: 'data.xlsx',
          activeSheet: 'H1',
          sheets: ['H1'],
          colFilters: { Estado: 'Activo' },
          searchText: 'test',
          rawData: [{ Estado: 'Activo' }],
          columns: ['Estado'],
        },
      },
      3,
      '#2563eb'
    );
    expect(tab.id).toBe(3);
    expect(tab.fileName).toBe('data.xlsx');
    expect(tab.colFilters).toEqual({ Estado: 'Activo' });
    expect(tab.searchText).toBe('test');
  });
});

describe('applyFavoriteFiltersToTab', () => {
  it('copies filter and search fields onto tab', () => {
    const tab = { colFilters: {}, searchText: '', searchCol: '', dateFrom: '', dateTo: '', dateCol: '' };
    applyFavoriteFiltersToTab(tab, {
      colFilters: { A: 1 },
      searchText: 'q',
      searchCol: 'A',
      dateFrom: '2024-01-01',
      dateTo: '',
      dateCol: 'Fecha',
    });
    expect(tab.colFilters).toEqual({ A: 1 });
    expect(tab.searchText).toBe('q');
    expect(tab.dateCol).toBe('Fecha');
  });
});

describe('writeFavoritesToStorage', () => {
  it('writes and reads through mock storage', () => {
    /** @type {Record<string, string>} */
    const bag = {};
    const storage = {
      getItem: (k) => bag[k] ?? null,
      setItem: (k, v) => {
        bag[k] = v;
      },
    };
    const result = writeFavoritesToStorage('test_favs', [{ name: 'X' }], storage);
    expect(result.ok).toBe(true);
    expect(JSON.parse(bag.test_favs)).toEqual([{ name: 'X' }]);
  });
});
