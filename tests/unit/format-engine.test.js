import { describe, expect, it } from 'vitest';
import {
  colFilterLabel,
  formatCellValue,
  formatIsoDate,
} from '../../src/engine/format-engine.js';

describe('formatIsoDate', () => {
  it('converts ISO yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(formatIsoDate('2024-03-15')).toBe('15/03/2024');
  });

  it('repairs legacy mm/dd/yyyy when day > 12', () => {
    expect(formatIsoDate('03/25/2024')).toBe('25/03/2024');
  });

  it('passes through ambiguous and empty values', () => {
    expect(formatIsoDate('not a date')).toBe('not a date');
    expect(formatIsoDate('')).toBe('');
    expect(formatIsoDate(null)).toBe(null);
  });
});

describe('formatCellValue', () => {
  const tab = { dateColsDetected: ['Fecha'] };

  it('formats values in detected date columns', () => {
    expect(formatCellValue('Fecha', '2024-03-15', tab)).toBe('15/03/2024');
  });

  it('leaves non-date columns untouched', () => {
    expect(formatCellValue('Nombre', 'Ana', tab)).toBe('Ana');
  });

  it('handles null tab and empty values', () => {
    expect(formatCellValue('Fecha', '2024-03-15', null)).toBe('2024-03-15');
    expect(formatCellValue('Fecha', '', tab)).toBe('');
    expect(formatCellValue('Fecha', null, tab)).toBe('');
  });
});

describe('colFilterLabel', () => {
  it('summarizes arrays', () => {
    expect(colFilterLabel(['Activo'])).toBe('Activo');
    expect(colFilterLabel(['Activo', 'Inactivo'])).toBe('2 valores');
  });

  it('handles special markers', () => {
    expect(colFilterLabel('__NULL__')).toBe('sin cédula');
    expect(colFilterLabel('__WITH__')).toBe('con cédula');
    expect(colFilterLabel('__CONTAINS__:abc')).toBe('contiene "abc"');
    expect(colFilterLabel('__DATE_RANGE__:2024-01-01__TO__:2024-12-31')).toBe(
      ':2024-01-01 → 2024-12-31'
    );
  });

  it('stringifies plain values', () => {
    expect(colFilterLabel(42)).toBe('42');
  });
});
