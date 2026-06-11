import { describe, expect, it, beforeAll } from 'vitest';
import {
  detectBestHeaderRow,
  detectDateColumns,
  extractSheetDataFromHeaderRow,
  getVisibleSheetNames,
  normalizeSheetData,
} from '../../src/engine/sheet-loader.js';
import {
  applyParsedSheetToTab,
  createTabState,
  resetTabFiltersForNewSheet,
} from '../../src/engine/tab-model.js';

beforeAll(() => {
  globalThis.XLSX = {
    utils: {
      encode_cell: ({ r, c }) => `${r},${c}`,
    },
  };
});

function mockWorksheet(cells, range = { s: { r: 0, c: 0 }, e: { r: 5, c: 2 } }) {
  return cells;
}

describe('getVisibleSheetNames', () => {
  it('excludes hidden sheets', () => {
    const names = getVisibleSheetNames({
      SheetNames: ['A', 'B', 'C'],
      Workbook: { Sheets: [{ Hidden: 0 }, { Hidden: 1 }, {}] },
    });
    expect(names).toEqual(['A', 'C']);
  });
});

describe('extractSheetDataFromHeaderRow', () => {
  it('uses header row and skips blank data rows', () => {
    const ws = mockWorksheet({
      '0,0': { v: 'Nombre' },
      '0,1': { v: 'Estado' },
      '1,0': { v: 'Ana' },
      '1,1': { v: 'Activo' },
      '2,0': { v: '' },
      '2,1': { v: '' },
      '3,0': { v: 'Bob' },
      '3,1': { v: 'Inactivo' },
    });
    const range = { s: { r: 0, c: 0 }, e: { r: 3, c: 1 } };
    const { columns, raw, hdrRow } = extractSheetDataFromHeaderRow(ws, range, 0);
    expect(columns).toEqual(['Nombre', 'Estado']);
    expect(hdrRow).toBe(0);
    expect(raw).toHaveLength(2);
    expect(raw[0].Nombre).toBe('Ana');
  });

  it('deduplicates empty column names', () => {
    const ws = mockWorksheet({
      '0,0': { v: 'A' },
      '0,1': { v: '' },
      '0,2': { v: '' },
      '1,0': { v: 1 },
      '1,1': { v: 2 },
      '1,2': { v: 3 },
    });
    const range = { s: { r: 0, c: 0 }, e: { r: 1, c: 2 } };
    const { columns } = extractSheetDataFromHeaderRow(ws, range, 0);
    expect(columns).toEqual(['A', '__EMPTY', '__EMPTY_1']);
  });
});

describe('detectBestHeaderRow', () => {
  it('prefers text header row over numeric data row', () => {
    const ws = mockWorksheet({
      '0,0': { v: 1 },
      '0,1': { v: 2 },
      '1,0': { v: 'Nombre' },
      '1,1': { v: 'Edad' },
      '2,0': { v: 'Ana' },
      '2,1': { v: 30 },
    });
    const range = { s: { r: 0, c: 0 }, e: { r: 2, c: 1 } };
    expect(detectBestHeaderRow(ws, range, 5)).toBe(1);
  });
});

describe('normalizeSheetData', () => {
  it('normalizes dd/mm/yyyy in Fecha columns', () => {
    const columns = ['Nombre', 'Fecha ingreso'];
    const raw = [
      { Nombre: 'Ana', 'Fecha ingreso': '15/03/2024' },
      { Nombre: 'Bob', 'Fecha ingreso': '01/04/2024' },
      { Nombre: 'Carla', 'Fecha ingreso': '20/05/2024' },
    ];
    const { rawData, dateColsDetected } = normalizeSheetData(raw, columns);
    expect(rawData[0]['Fecha ingreso']).toBe('2024-03-15');
    expect(dateColsDetected).toContain('Fecha ingreso');
  });

  it('formats integers and rounds decimals', () => {
    const columns = ['Valor'];
    const raw = [{ Valor: 42 }, { Valor: 3.14159 }];
    const { rawData } = normalizeSheetData(raw, columns);
    expect(rawData[0].Valor).toBe('42');
    expect(rawData[1].Valor).toBe('3.14');
  });
});

describe('detectDateColumns', () => {
  it('detects columns with mostly ISO dates', () => {
    const columns = ['Fecha', 'Notas'];
    const rawData = Array.from({ length: 10 }, (_, i) => ({
      Fecha: `2024-01-${String(i + 1).padStart(2, '0')}`,
      Notas: `note ${i}`,
    }));
    expect(detectDateColumns(columns, rawData)).toEqual(['Fecha']);
  });
});

describe('tab-model', () => {
  it('createTabState returns expected defaults', () => {
    const tab = createTabState(1, 'test.xlsx', '#fff');
    expect(tab.fileName).toBe('test.xlsx');
    expect(tab.rawData).toEqual([]);
    expect(tab.colFilters).toEqual({});
  });

  it('applyParsedSheetToTab updates tab fields', () => {
    const tab = createTabState(1, 'test.xlsx', '#fff');
    tab.colFilters = { Estado: 'Activo' };
    const parsed = {
      columns: ['Nombre'],
      rawData: [{ Nombre: 'Ana' }],
      hdrRow: 2,
      dateColsDetected: [],
    };
    const meta = applyParsedSheetToTab(tab, 'Hoja1', parsed, 0, false);
    expect(tab.rawData).toHaveLength(1);
    expect(tab._hdrBySheet.Hoja1.row).toBe(2);
    expect(tab.searchText).toBe('');
    expect(meta.rowCount).toBe(1);
  });

  it('resetTabFiltersForNewSheet clears filters', () => {
    const tab = createTabState(1, 'x.xlsx', '#000');
    tab.colFilters = { x: 1 };
    tab.selected.add(0);
    resetTabFiltersForNewSheet(tab);
    expect(tab.colFilters).toEqual({});
    expect(tab.selected.size).toBe(0);
  });
});
