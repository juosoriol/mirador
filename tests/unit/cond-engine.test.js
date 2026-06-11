import { describe, expect, it } from 'vitest';
import {
  filterActiveCondRules,
  getCondColorForCell,
  matchCondRule,
} from '../../src/engine/cond-engine.js';

describe('filterActiveCondRules', () => {
  it('keeps only complete rules', () => {
    const rules = [
      { col: 'Estado', op: '=', val: 'Activo', color: '#f00' },
      { col: 'Estado', op: '=', val: '', color: '#0f0' },
      { op: '=', val: 'x', color: '#00f' },
    ];
    expect(filterActiveCondRules(rules)).toHaveLength(1);
  });
});

describe('matchCondRule', () => {
  it('matches each operator', () => {
    expect(matchCondRule('Activo', { op: '=', val: 'activo' })).toBe(true);
    expect(matchCondRule('Activo', { op: '!=', val: 'Inactivo' })).toBe(true);
    expect(matchCondRule('10', { op: '>', val: '5' })).toBe(true);
    expect(matchCondRule('3', { op: '<', val: '5' })).toBe(true);
    expect(matchCondRule('Analista senior', { op: 'contiene', val: 'anal' })).toBe(true);
  });
});

describe('getCondColorForCell', () => {
  it('returns first matching rule color for the column', () => {
    const rules = filterActiveCondRules([
      { col: 'Estado', op: '=', val: 'Activo', color: '#0f0' },
      { col: 'Estado', op: '=', val: 'Inactivo', color: '#f00' },
    ]);
    expect(getCondColorForCell('Activo', 'Estado', rules)).toBe('#0f0');
    expect(getCondColorForCell('Otro', 'Estado', rules)).toBe('');
    expect(getCondColorForCell('Activo', 'Depto', rules)).toBe('');
  });
});
