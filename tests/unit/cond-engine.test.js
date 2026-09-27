import { describe, expect, it } from 'vitest';
import {
  condTextColor,
  countCondMatches,
  filterActiveCondRules,
  getCondColorForCell,
  matchCondRule,
} from '../../src/engine/cond-engine.js';

describe('condTextColor', () => {
  it('picks readable text for light and dark backgrounds', () => {
    expect(condTextColor('#fde047')).toBe('#000');
    expect(condTextColor('#1e3a8a')).toBe('#fff');
    expect(condTextColor('nope')).toBe('#000');
  });
});

describe('countCondMatches', () => {
  it('counts matching values', () => {
    expect(countCondMatches(['Activo', 'Inactivo', 'activo'], { op: '=', val: 'Activo' })).toBe(2);
  });
});

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
