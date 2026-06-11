import { describe, expect, it } from 'vitest';
import {
  pillsFindColumn,
  pillsInitials,
  pillsAvatarColor,
  buildPillsColorMap,
  buildPillsToolbarCount,
  getPillsDisplayRows,
  resolvePillsSelectors,
} from '../../src/engine/pills-engine.js';

describe('pillsFindColumn', () => {
  it('matches first column by regex pattern', () => {
    const cols = ['Cédula', 'Nombre', 'Cargo'];
    expect(pillsFindColumn(cols, ['nombre', 'name'])).toBe('Nombre');
    expect(pillsFindColumn(cols, ['salario'])).toBe(null);
  });
});

describe('pillsInitials', () => {
  it('returns two-letter initials when possible', () => {
    expect(pillsInitials('Ana García')).toBe('AG');
    expect(pillsInitials('Bob')).toBe('B');
    expect(pillsInitials('')).toBe('?');
  });
});

describe('pillsAvatarColor', () => {
  it('returns deterministic color from string', () => {
    expect(pillsAvatarColor('Ana García')).toBe(pillsAvatarColor('Ana García'));
    expect(pillsAvatarColor('Ana García')).not.toBe(pillsAvatarColor('Bob Smith'));
  });
});

describe('buildPillsColorMap', () => {
  it('maps unique color column values to palette', () => {
    const rows = [
      { Estado: 'Activo' },
      { Estado: 'Inactivo' },
      { Estado: 'Activo' },
    ];
    const map = buildPillsColorMap(rows, 'Estado');
    expect(Object.keys(map)).toEqual(['Activo', 'Inactivo']);
    expect(map.Activo).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns empty map when color column is none', () => {
    expect(buildPillsColorMap([{ A: 1 }], 'none')).toEqual({});
    expect(buildPillsColorMap([{ A: 1 }], null)).toEqual({});
  });
});

describe('buildPillsToolbarCount', () => {
  it('shows filtered hint when filters are active', () => {
    expect(buildPillsToolbarCount(10, 100, false)).toBe('10 registros');
    expect(buildPillsToolbarCount(10, 100, true)).toContain('filtrado de');
  });
});

describe('getPillsDisplayRows', () => {
  it('returns row objects for filtered indices', () => {
    const tab = {
      rawData: [{ id: 1 }, { id: 2 }, { id: 3 }],
      filtered: [0, 2],
    };
    expect(getPillsDisplayRows(tab)).toEqual([{ id: 1 }, { id: 3 }]);
  });
});

describe('resolvePillsSelectors', () => {
  it('prefers saved tab selectors over smart defaults', () => {
    const cols = ['Cédula', 'Nombre Completo', 'Cargo'];
    const resolved = resolvePillsSelectors(
      cols,
      { main: 'Cargo', sec: 'Nombre Completo' },
      { main: 'Cédula' }
    );
    expect(resolved.main).toBe('Cédula');
    expect(resolved.sec).toBe('Nombre Completo');
    expect(resolved.design).toBe('d1');
  });

  it('handles null saved config', () => {
    const cols = ['Cédula', 'Nombre'];
    const resolved = resolvePillsSelectors(cols, null, null);
    expect(resolved.main).toBe('Cédula');
    expect(resolved.sec).toBe('Nombre');
  });
});
