import { describe, expect, it } from 'vitest';
import {
  buildDetailBadgeItems,
  buildDetailBadgesHtml,
  buildDetailSideFields,
  detailInitials,
  extractDetailRowValues,
  getFilterLikeRowFields,
  groupDetailFieldColumns,
  isActiveEstado,
  isFilterLikePreselected,
  resolveDetailColumns,
} from '../../src/engine/detail-engine.js';

const columns = [
  'Apellidos y Nombre',
  'Cargo Actual',
  'Dirección',
  'Estado',
  'Vinculación',
  'Nivel Jerárquico',
  'Cédula',
  'Escalera',
  'Posición',
  'Evaluación',
  'Correo',
  'Ciudad',
  'Titulo',
];

const row = {
  'Apellidos y Nombre': 'Ana García',
  'Cargo Actual': 'Analista',
  Dirección: 'RRHH',
  Estado: 'Activo',
  'Nivel Jerárquico': 'N3',
  Cédula: '123',
  Escalera: 'A',
  Posición: '5',
  Evaluación: 'Sobresaliente',
  Vinculación: 'Planta Permanente',
  Correo: 'ana@example.com',
  Ciudad: 'Bogotá',
  Titulo: 'Economista',
};

describe('resolveDetailColumns', () => {
  it('finds HR columns by pattern', () => {
    const cols = resolveDetailColumns(columns);
    expect(cols.nameCol).toBe('Apellidos y Nombre');
    expect(cols.cedCol).toBe('Cédula');
    expect(cols.estCol).toBe('Estado');
  });
});

describe('groupDetailFieldColumns', () => {
  it('groups populated columns', () => {
    const groups = groupDetailFieldColumns(columns, row);
    expect(groups.grpPers).toContain('Apellidos y Nombre');
    expect(groups.grpCargo).toContain('Cargo Actual');
    expect(groups.grpAcad).toContain('Titulo');
    expect(groups.allFields.length).toBeGreaterThan(5);
  });
});

describe('extractDetailRowValues', () => {
  it('extracts display values and initials', () => {
    const dCols = resolveDetailColumns(columns);
    const values = extractDetailRowValues(dCols, row, 0);
    expect(values.name).toBe('Ana García');
    expect(values.initials).toBe('AG');
    expect(values.isActive).toBe(true);
  });
});

describe('detail badges', () => {
  it('builds badge items and html', () => {
    const items = buildDetailBadgeItems({
      estado: 'Activo',
      niv: 'N3',
      vinc: 'Planta Permanente',
      evalu: 'Sobresaliente',
    });
    expect(items.some((b) => b.className === 'db-green')).toBe(true);
    const html = buildDetailBadgesHtml(items, (s) => String(s));
    expect(html).toContain('d-badge');
    expect(html).toContain('Activo');
  });
});

describe('isActiveEstado', () => {
  it('detects active states', () => {
    expect(isActiveEstado('Activo')).toBe(true);
    expect(isActiveEstado('Retirado')).toBe(false);
  });
});

describe('detailInitials', () => {
  it('returns up to two initials', () => {
    expect(detailInitials('Ana García López')).toBe('AG');
  });
});

describe('buildDetailSideFields', () => {
  it('returns key-value pairs with values only', () => {
    const dCols = resolveDetailColumns(columns);
    const side = buildDetailSideFields(dCols, row);
    expect(side.some(([k]) => k === 'Estado')).toBe(true);
    expect(side.every(([, v]) => v)).toBe(true);
  });
});

describe('filter like row helpers', () => {
  it('lists non-empty fields and preselects common columns', () => {
    const fields = getFilterLikeRowFields(columns, row);
    expect(fields).toContain('Estado');
    expect(isFilterLikePreselected('Estado')).toBe(true);
    expect(isFilterLikePreselected('Titulo')).toBe(false);
  });
});
