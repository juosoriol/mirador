import { describe, expect, it } from 'vitest';
import {
  pillsFindColumn,
  pillsInitials,
  pillsAvatarColor,
  buildPillsColorMap,
  buildPillsToolbarCount,
  getPillsDisplayRows,
  resolvePillsSelectors,
  getPillsGridClassNames,
  buildPillCardModel,
  buildPillCardHtml,
  buildPillsFichaBodyHtml,
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

describe('getPillsGridClassNames', () => {
  it('returns layout classes per design', () => {
    expect(getPillsGridClassNames('d3')).toEqual(['pg-wrap']);
    expect(getPillsGridClassNames('d7')).toEqual(['pg-col', 'pg-glass-bg']);
    expect(getPillsGridClassNames('d1')).toEqual(['pg-col']);
  });
});

describe('buildPillCardHtml', () => {
  const eh = (s) => String(s ?? '');

  it('renders d7 card with badge', () => {
    const model = buildPillCardModel(
      { Cédula: '123', Nombre: 'Ana', Estado: 'Activo' },
      0,
      {
        mk: 'Cédula',
        sk: 'Nombre',
        ak: 'Nombre',
        ck: 'Estado',
        cols: ['Cédula', 'Nombre', 'Estado'],
        colorMap: { Activo: '#22c55e' },
        design: 'd7',
      }
    );
    const html = buildPillCardHtml(model, eh);
    expect(html).toContain('mpill-d7');
    expect(html).toContain('Ana');
    expect(html).toContain('pg-badge');
  });

  it('renders fallback chip design', () => {
    const model = buildPillCardModel({ A: '1' }, 2, {
      mk: 'A',
      sk: '',
      ak: 'A',
      ck: 'none',
      cols: ['A'],
      colorMap: {},
      design: 'd0',
    });
    expect(buildPillCardHtml(model, eh)).toContain('mpill');
  });
});

describe('buildPillsFichaBodyHtml', () => {
  it('includes all columns', () => {
    const html = buildPillsFichaBodyHtml(['A', 'B'], { A: '1', B: '' }, (s) => String(s));
    expect(html).toContain('pf-section');
    expect(html).toContain('Sin información');
  });
});
