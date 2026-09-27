export const COND_OPS = ['=', '!=', '>', '<', 'contiene'];

/** @param {Array<{ col?: string, op?: string, val?: string, color?: string }>} rules */
export function filterActiveCondRules(rules) {
  return (rules || []).filter((r) => r.col && r.op && r.val && r.color);
}

/**
 * @param {unknown} cellValue
 * @param {{ op: string, val: string }} rule
 */
export function matchCondRule(cellValue, rule) {
  const v = String(cellValue ?? '').toLowerCase();
  const rv2 = String(rule.val ?? '').toLowerCase();
  switch (rule.op) {
    case '=':
      return v === rv2;
    case '!=':
      return v !== rv2;
    case '>':
      return parseFloat(String(cellValue)) > parseFloat(rule.val);
    case '<':
      return parseFloat(String(cellValue)) < parseFloat(rule.val);
    case 'contiene':
      return v.includes(rv2);
    default:
      return false;
  }
}

/** Black or white text, whichever reads better on the given #rrggbb background. */
export function condTextColor(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!m) return '#000';
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#000' : '#fff';
}

/** How many of the given cell values match a rule. */
export function countCondMatches(values, rule) {
  let n = 0;
  for (const v of values) if (matchCondRule(v, rule)) n++;
  return n;
}

/**
 * First matching rule color for a cell, or empty string.
 * @param {unknown} cellValue
 * @param {string} col
 * @param {Array<{ col: string, op: string, val: string, color: string }>} rules
 */
export function getCondColorForCell(cellValue, col, rules) {
  for (const rule of rules) {
    if (rule.col !== col) continue;
    if (matchCondRule(cellValue, rule)) return rule.color;
  }
  return '';
}
