import { describe, expect, it } from 'vitest';
import {
  computeStatsPanelCounts,
  detectDefaultStatsPanels,
  normalizeStatsPanelKey,
  shortStatsPillLabel,
  toggleStatsPillFilter,
  topStatsEntries,
} from '../../src/engine/stats-engine.js';

const data = [
  { Estado: 'Activo', Sexo: 'f', Vinculación: 'Planta' },
  { Estado: 'Inactivo', Sexo: 'M', Vinculación: 'Planta' },
  { Estado: 'Activo', Sexo: 'F', Vinculación: 'Contrato' },
  { Estado: 'Activo', Sexo: 'm', Vinculación: 'Contrato' },
];

describe('detectDefaultStatsPanels', () => {
  it('auto-detects vinculación, estado, and sexo columns', () => {
    expect(detectDefaultStatsPanels(['Nombre', 'Vinculación laboral', 'Estado', 'Sexo'])).toEqual([
      'Vinculación laboral',
      'Estado',
      'Sexo',
    ]);
  });
});

describe('normalizeStatsPanelKey', () => {
  it('uppercases gender values', () => {
    expect(normalizeStatsPanelKey('Sexo', 'f')).toBe('F');
    expect(normalizeStatsPanelKey('Estado', 'Activo')).toBe('Activo');
  });
});

describe('computeStatsPanelCounts', () => {
  it('aggregates counts over filtered indices', () => {
    const panels = ['Estado', 'Sexo'];
    const counts = computeStatsPanelCounts(data, [0, 1, 2, 3], panels);
    expect(counts.Estado).toEqual({ Activo: 3, Inactivo: 1 });
    expect(counts.Sexo).toEqual({ F: 2, M: 2 });
  });
});

describe('topStatsEntries', () => {
  it('returns top values by count', () => {
    expect(topStatsEntries({ A: 5, B: 10, C: 2 }, 2)).toEqual([
      ['B', 10],
      ['A', 5],
    ]);
  });
});

describe('shortStatsPillLabel', () => {
  it('truncates to first two words', () => {
    expect(shortStatsPillLabel('Contrato temporal')).toBe('Contrato temporal');
    expect(shortStatsPillLabel('Uno Dos Tres')).toBe('Uno Dos');
  });
});

describe('toggleStatsPillFilter', () => {
  it('toggles single and multi select filters', () => {
    expect(toggleStatsPillFilter(undefined, 'Activo', false)).toBe('Activo');
    expect(toggleStatsPillFilter('Activo', 'Activo', false)).toBeUndefined();
    expect(toggleStatsPillFilter(undefined, 'A', true)).toEqual(['A']);
    expect(toggleStatsPillFilter(['A'], 'B', true)).toEqual(['A', 'B']);
    expect(toggleStatsPillFilter(['A', 'B'], 'A', true)).toEqual(['B']);
  });
});
