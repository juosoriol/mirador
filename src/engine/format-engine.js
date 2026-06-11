export const RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const RE_US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Normalize a date string to dd/mm/yyyy.
 * Accepts ISO (yyyy-mm-dd) and legacy mm/dd/yyyy inputs.
 * @param {unknown} v
 */
export function formatIsoDate(v) {
  if (!v) return v;
  const s = String(v);
  const m = s.match(RE_ISO_DATE);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const mUs = s.match(RE_US_DATE);
  if (mUs && parseInt(mUs[2], 10) > 12) {
    return `${mUs[2].padStart(2, '0')}/${mUs[1].padStart(2, '0')}/${mUs[3]}`;
  }
  return s;
}

/**
 * Format a cell value, applying date formatting when the column is a detected date column.
 * @param {string} col
 * @param {unknown} v
 * @param {{ dateColsDetected?: string[] } | null | undefined} tab
 */
export function formatCellValue(col, v, tab) {
  if (v == null || v === '' || !tab) return v ?? '';
  if ((tab.dateColsDetected || []).includes(col)) return formatIsoDate(v);
  return v;
}

/**
 * Human-readable label for a column filter value (chips / breadcrumb).
 * @param {unknown} val
 */
export function colFilterLabel(val) {
  if (Array.isArray(val)) return val.length === 1 ? val[0] : val.length + ' valores';
  if (val === '__NULL__') return 'sin cédula';
  if (val === '__WITH__') return 'con cédula';
  if (typeof val === 'string' && val.startsWith('__CONTAINS__:')) {
    return 'contiene "' + val.slice(13) + '"';
  }
  if (typeof val === 'string' && val.startsWith('__DATE_RANGE__:')) {
    return val.slice(14).split('__TO__:').join(' → ');
  }
  return String(val);
}
