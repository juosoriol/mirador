import { describe, expect, it } from 'vitest';
import {
  getExportColumns,
  detectNumericExportColumns,
  exportCellValue,
  buildExportDataRows,
  buildSingleTabExportFileName,
  safeExportName,
  uniqueWorksheetName,
  columnWidthsForExport,
} from '../../src/engine/export-engine.js';

describe('getExportColumns', () => {
  it('respects frozen order and hidden columns', () => {
    const tab = {
      columns: ['A', 'B', 'C', 'D'],
      frozenCols: new Set(['B', 'D']),
      frozenOrder: ['D', 'B'],
      hiddenCols: new Set(['C']),
    };
    expect(getExportColumns(tab)).toEqual(['D', 'B', 'A']);
  });
});

describe('detectNumericExportColumns', () => {
  it('detects mostly numeric columns and skips dates and ids', () => {
    const cols = ['Monto', 'Fecha', 'ID'];
    const raw = [
      { Monto: 100, Fecha: '2024-01-01', ID: '123' },
      { Monto: 200, Fecha: '2024-02-01', ID: '456' },
      { Monto: 50, Fecha: '2024-03-01', ID: '789' },
    ];
    const num = detectNumericExportColumns(cols, raw, new Set(['Fecha']));
    expect(num.has('Monto')).toBe(true);
    expect(num.has('Fecha')).toBe(false);
    expect(num.has('ID')).toBe(false);
  });
});

describe('exportCellValue', () => {
  it('converts dates and numbers', () => {
    const numColSet = new Set(['Monto']);
    const dateCols = new Set(['Fecha']);
    expect(exportCellValue('Monto', '42', numColSet)).toBe(42);
    expect(exportCellValue('Fecha', '2024-06-15', numColSet, dateCols)).toEqual(
      new Date(2024, 5, 15)
    );
    expect(exportCellValue('Nombre', 'Ana', numColSet)).toBe('Ana');
    expect(exportCellValue('Monto', '', numColSet)).toBe(null);
  });
});

describe('buildExportDataRows', () => {
  it('maps filtered rows to typed export values', () => {
    const tab = {
      columns: ['Nombre', 'Monto'],
      rawData: [
        { Nombre: 'Ana', Monto: 10 },
        { Nombre: 'Bob', Monto: 20 },
        { Nombre: 'Cal', Monto: 30 },
        { Nombre: 'Dan', Monto: 40 },
      ],
      filtered: [1],
      dateColsDetected: [],
    };
    const exportCols = ['Nombre', 'Monto'];
    const { dataRows } = buildExportDataRows(tab, exportCols);
    expect(dataRows).toEqual([['Bob', 20]]);
  });
});

describe('safeExportName', () => {
  it('strips illegal filename characters', () => {
    expect(safeExportName('Planilla: Q1/2024')).toBe('Planilla_ Q1_2024');
  });
});

describe('buildSingleTabExportFileName', () => {
  it('builds dated filename from tab metadata', () => {
    const name = buildSingleTabExportFileName({
      fileName: 'Empleados.xlsx',
      activeSheet: 'Hoja 1',
    });
    expect(name).toMatch(/^Empleados_Hoja_1_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe('uniqueWorksheetName', () => {
  it('avoids duplicate worksheet names', () => {
    const wb = { worksheets: [{ name: 'Datos' }, { name: 'Datos_1' }] };
    expect(uniqueWorksheetName(wb, 'Datos', 0)).toBe('Datos_1_2');
  });
});

describe('columnWidthsForExport', () => {
  it('computes widths from header and sample data', () => {
    const widths = columnWidthsForExport(['Nombre'], [['Alice'], ['Bob']]);
    expect(widths[0].width).toBeGreaterThanOrEqual(8);
  });
});
