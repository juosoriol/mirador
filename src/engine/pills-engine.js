export const PILLS_COLOR_PALETTE = [
  '#22c55e',
  '#f59e0b',
  '#f87171',
  '#60a5fa',
  '#c084fc',
  '#34d399',
  '#fb923c',
  '#a78bfa',
];

export const PILLS_AVATAR_PALETTE = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#b45309',
  '#be123c',
  '#0e7490',
  '#7c3aed',
  '#6d28d9',
];

/** Find first column matching any regex pattern (case-insensitive). */
export function pillsFindColumn(cols, patterns) {
  for (const p of patterns) {
    const r = new RegExp(p, 'i');
    const found = cols.find((c) => r.test(c));
    if (found) return found;
  }
  return null;
}

export function pillsInitials(str) {
  const w = String(str || '')
    .trim()
    .split(/\s+/);
  if (w.length >= 2) return (w[0][0] + w[w.length - 1][0]).toUpperCase();
  return (str || '?')[0]?.toUpperCase() || '?';
}

export function pillsAvatarColor(str, palette = PILLS_AVATAR_PALETTE) {
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return palette[h % palette.length];
}

export function buildPillsColorMap(rows, colorCol, palette = PILLS_COLOR_PALETTE) {
  if (!colorCol || colorCol === 'none') return {};
  const uniq = [...new Set(rows.map((r) => r[colorCol] || ''))];
  const map = {};
  uniq.forEach((v, i) => {
    map[v] = palette[i % palette.length];
  });
  return map;
}

export function buildPillsToolbarCount(filteredLen, totalLen, activeFilters) {
  const base = filteredLen.toLocaleString() + ' registros';
  if (!activeFilters) return base;
  return (
    base +
    ` <span style="color:var(--acc-text);font-size:10px">(filtrado de ${totalLen.toLocaleString()})</span>`
  );
}

/** Filtered row objects for pills grid. */
export function getPillsDisplayRows(tab) {
  return (tab.filtered || []).map((i) => tab.rawData[i]).filter(Boolean);
}

export function resolvePillsSelectors(cols, saved = {}, tabSel = {}) {
  const cfg = saved && typeof saved === 'object' ? saved : {};
  const sel = tabSel && typeof tabSel === 'object' ? tabSel : {};
  const smartMain = pillsFindColumn(cols, ['c[eé]dula', 'id', 'rut', 'codigo', 'code', 'dni', 'nit']);
  const smartSec = pillsFindColumn(cols, [
    'nombre.apell',
    'apell.*nombre',
    'nombre',
    'name',
    'empleado',
    'funcionario',
  ]);
  const smartAvatar = pillsFindColumn(cols, [
    'nombre.apell',
    'apell.*nombre',
    'nombre',
    'name',
    'empleado',
    'funcionario',
  ]);

  const main =
    (sel.main && cols.includes(sel.main) && sel.main) ||
    (cfg.main && cols.includes(cfg.main) && cfg.main) ||
    smartMain ||
    cols[0] ||
    '';

  const sec =
    (sel.sec && cols.includes(sel.sec) && sel.sec) ||
    (cfg.sec && cols.includes(cfg.sec) && cfg.sec) ||
    smartSec ||
    cols[1] ||
    cols[0] ||
    '';

  const avatar =
    (sel.avatar && cols.includes(sel.avatar) && sel.avatar) ||
    (cfg.avatar && cols.includes(cfg.avatar) && cfg.avatar) ||
    smartAvatar ||
    sec ||
    main;

  const color = sel.color || cfg.color || 'none';

  const design = sel.design && sel.design !== 'd7' ? sel.design : cfg.design || 'd1';

  return { main, sec, avatar, color, design };
}
