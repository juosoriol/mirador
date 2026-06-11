import { findCedulaColumn } from './chip-filter-engine.js';

/** @param {string[]} columns @param {RegExp[]} patterns */
function findColumn(columns, patterns, trim = false) {
  for (const col of columns) {
    const target = trim ? col.trim() : col;
    if (patterns.some((p) => p.test(target))) return col;
  }
  return null;
}

/** Resolve well-known HR column keys from sheet headers. */
export function resolveDetailColumns(columns) {
  return {
    nameCol:
      findColumn(columns, [
        /apellidos.nombre|nombre.apellidos/i,
        /primer.apellido/i,
        /nombre|apellido/i,
      ]) || null,
    cargoCol: findColumn(columns, [/cargo.actual/i, /cargo|encargo/i]),
    dirCol: findColumn(columns, [/^direcci/i]),
    estCol: findColumn(columns, [/^estado$/i], true),
    vinCol: findColumn(columns, [/vinculaci/i]),
    nivCol: findColumn(columns, [/nivel.jer/i]),
    cedCol: findCedulaColumn(columns),
    escalCol: findColumn(columns, [/escal/i]),
    posCol: findColumn(columns, [/posici/i]),
    evalCol: findColumn(columns, [/evaluaci/i]),
    correoCol: findColumn(columns, [/correo/i]),
    ciudadCol: findColumn(columns, [/^ciudad$/i], true),
  };
}

/** @param {Record<string, unknown>} row */
function hasValue(row, col) {
  return row[col] !== '' && row[col] != null;
}

/** Group columns with values for detail panel tabs. */
export function groupDetailFieldColumns(columns, row) {
  const withVal = (pred) => columns.filter((c) => pred.test(c) && hasValue(row, c));
  return {
    allFields: columns.filter((c) => hasValue(row, c)),
    grpCargo: withVal(/cargo|encargo|nivel.jer|escalera|posici/i),
    grpDir: withVal(/direcci|dependencia|tipo.dep|^pais$|^departamento|^ciudad|correo|municipio/i),
    grpPers: withVal(/nombre|apellido|cedula|cédula|sexo|nacimiento/i),
    grpAcad: withVal(/titulo|título|escolaridad|especiali/i),
    grpVinc: withVal(/vinculaci|ingreso|estado|evaluaci|teletrab/i),
  };
}

/** @param {string} name */
export function detailInitials(name) {
  const parts = String(name || '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '');
  return parts.join('').toUpperCase() || '?';
}

/** @param {string} estado */
export function isActiveEstado(estado) {
  return /activ/i.test(String(estado || ''));
}

/**
 * @param {object} params
 * @param {string} [params.estado]
 * @param {string} [params.niv]
 * @param {string} [params.vinc]
 * @param {string} [params.evalu]
 */
export function buildDetailBadgeItems({ estado, niv, vinc, evalu }) {
  /** @type {Array<{ label: string, className: string }>} */
  const items = [];
  if (estado) {
    items.push({
      label: estado,
      className: isActiveEstado(estado) ? 'db-green' : 'db-gray',
    });
  }
  if (niv) items.push({ label: niv, className: 'db-blue' });
  if (vinc) items.push({ label: String(vinc).split(' ')[0], className: 'db-warn' });
  if (evalu) items.push({ label: evalu, className: 'db-green' });
  return items;
}

/**
 * Side column list for detail style 3.
 * @param {ReturnType<typeof resolveDetailColumns>} cols
 * @param {Record<string, unknown>} row
 */
export function buildDetailSideFields(cols, row) {
  const pairs = [
    [cols.estCol, row[cols.estCol]],
    [cols.cedCol, row[cols.cedCol]],
    [cols.posCol, row[cols.posCol]],
    [cols.escalCol, row[cols.escalCol]],
    [cols.nivCol, row[cols.nivCol]],
    [cols.evalCol, row[cols.evalCol]],
    [cols.vinCol, row[cols.vinCol]],
    [cols.ciudadCol, row[cols.ciudadCol]],
    [cols.correoCol, row[cols.correoCol]],
  ];
  return pairs.filter(([k, v]) => k && v);
}

/** Fields offered in "filter like row" dialog. */
export function getFilterLikeRowFields(columns, row, skipPattern = /^(identificador|id_|codigo_|_id$)/i) {
  return columns.filter((c) => hasValue(row, c) && !skipPattern.test(c));
}

/** Default pre-selected columns in filter-like-row UI. */
export function isFilterLikePreselected(col) {
  return /^(estado|direcci|nivel|sexo|g[eé]nero|cargo|vinculaci|dependencia|tipo|municipio|ciudad|grado)/i.test(
    col
  );
}

/**
 * Extract display values from a detail row.
 * @param {ReturnType<typeof resolveDetailColumns>} cols
 * @param {Record<string, unknown>} row
 * @param {number} idx
 */
/** @param {ReturnType<typeof buildDetailBadgeItems>} items @param {(s: unknown) => string} eh */
export function buildDetailBadgesHtml(items, eh) {
  return items
    .map((b) => `<span class="d-badge ${b.className}">${eh(b.label)}</span>`)
    .join('');
}

export function extractDetailRowValues(cols, row, idx) {
  const name = cols.nameCol ? row[cols.nameCol] : `Registro #${idx + 1}`;
  return {
    name,
    cargo: cols.cargoCol ? row[cols.cargoCol] : '',
    dir: cols.dirCol ? row[cols.dirCol] : '',
    estado: cols.estCol ? row[cols.estCol] : '',
    vinc: cols.vinCol ? row[cols.vinCol] : '',
    niv: cols.nivCol ? row[cols.nivCol] : '',
    ced: cols.cedCol ? row[cols.cedCol] : '',
    escal: cols.escalCol ? row[cols.escalCol] : '',
    pos: cols.posCol ? row[cols.posCol] : '',
    evalu: cols.evalCol ? row[cols.evalCol] : '',
    initials: detailInitials(name),
    isActive: isActiveEstado(cols.estCol ? row[cols.estCol] : ''),
  };
}
