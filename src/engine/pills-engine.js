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

/** CSS class names for pills grid container by design id. */
export function getPillsGridClassNames(design) {
  if (design === 'd3') return ['pg-wrap'];
  if (design === 'd7') return ['pg-col', 'pg-glass-bg'];
  return ['pg-col'];
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} index
 * @param {{ mk: string, sk: string, ak: string, ck: string, cols: string[], colorMap: Record<string, string>, design: string }} opts
 */
export function buildPillCardModel(row, index, { mk, sk, ak, ck, cols, colorMap, design }) {
  const main = mk && row[mk] != null && row[mk] !== '' ? row[mk] : cols[0] ? row[cols[0]] : '—';
  const sec = sk && sk !== mk && row[sk] != null && row[sk] !== '' ? String(row[sk]) : '';
  const avSrc = ak && row[ak] != null && row[ak] !== '' ? String(row[ak]) : sec || String(main);
  const dotColor = ck && ck !== 'none' ? colorMap[String(row[ck] || '')] || '#475569' : null;
  return {
    index,
    main,
    sec,
    avSrc,
    dotColor,
    av: pillsAvatarColor(avSrc),
    init: pillsInitials(avSrc),
    mk,
    ck,
    design,
    colorVal: ck && ck !== 'none' ? String(row[ck] || '') : '',
  };
}

/**
 * @param {ReturnType<typeof buildPillCardModel>} model
 * @param {(s: unknown) => string} eh
 */
export function buildPillCardHtml(model, eh) {
  const { index, main, sec, dotColor, av, init, mk, ck, design, colorVal } = model;
  const badgeVal = dotColor ? eh(colorVal) : '';

  if (design === 'd7') {
    return `<div class="mpill-d7" onclick="pillsOpenFicha(${index})">
        <div class="pg-glyph" style="background:${av}">${init}</div>
        <div class="pg-body">
          <div class="pg-name">${eh(main)}</div>
          ${sec ? `<div class="pg-sub">${eh(sec)}</div>` : ''}
        </div>
        ${badgeVal ? `<div class="pg-right"><div class="pg-badge" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${badgeVal}</div></div>` : ''}
      </div>`;
  }
  if (design === 'd1') {
    const accentColor = dotColor || av;
    const badge = dotColor
      ? `<div class="pd-badge" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${badgeVal}</div>`
      : '';
    return `<div class="mpill-d1" onclick="pillsOpenFicha(${index})" style="background:linear-gradient(to right,${accentColor}18 0%,var(--s1) 45%);border-color:${accentColor}33">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${accentColor};border-radius:14px 0 0 14px"></div>
        <div class="pd-avatar" style="background:${av};box-shadow:0 0 0 3px ${av}44">${init}</div>
        <div class="pd-body">
          <div class="pd-id">${eh(mk)} · ${eh(main)}</div>
          <div class="pd-name">${eh(sec || main)}</div>
        </div>
        ${badge}
      </div>`;
  }
  if (design === 'd2') {
    const dot = `<div class="pl-dot" style="background:${dotColor || 'var(--border)'}"></div>`;
    const tagHtml = badgeVal
      ? `<div class="pl-tag" style="background:${dotColor}22;color:${dotColor}">${badgeVal}</div>`
      : '';
    return `<div class="mpill-d2" onclick="pillsOpenFicha(${index})">
        ${dot}
        <div class="pl-body">
          <div class="pl-name">${eh(sec || main)}</div>
          <div class="pl-id">${eh(mk)}: ${eh(main)}</div>
        </div>
        ${tagHtml}
      </div>`;
  }
  if (design === 'd3') {
    const borderColor = dotColor ? `border-color:${dotColor}44` : '';
    return `<div class="mpill-d3" onclick="pillsOpenFicha(${index})" style="${borderColor}">
        <div class="pc-av" style="background:${av}">${init}</div>
        <div class="pc-body">
          <div class="pc-name">${eh(sec || main)}</div>
          <div class="pc-id">${eh(main)}</div>
        </div>
      </div>`;
  }
  if (design === 'd5') {
    const tags = badgeVal
      ? `<span class="pt-tag" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${badgeVal}</span>`
      : '';
    const trackColor = dotColor || av;
    return `<div class="mpill-d5" onclick="pillsOpenFicha(${index})">
        <div class="pt-circle" style="background:${av};box-shadow:0 0 0 3px ${av}44,0 2px 8px ${av}33">${init}</div>
        <div class="pt-body" style="border-left-color:${trackColor}44">
          <div class="pt-name">${eh(sec || main)}</div>
          <div class="pt-meta">${eh(mk)}: ${eh(main)}</div>
          ${tags ? `<div class="pt-tags">${tags}</div>` : ''}
        </div>
      </div>`;
  }
  const dotHtml = dotColor ? `<span class="mpill-dot" style="background:${dotColor}"></span>` : '';
  return `<div class="mpill" onclick="pillsOpenFicha(${index})">${dotHtml}<span class="mpill-main">${eh(main)}</span>${sec ? `<span class="mpill-sec">${eh(sec)}</span>` : ''}</div>`;
}

/** @param {string[]} cols @param {Record<string, unknown>} row @param {(s: unknown) => string} eh */
export function buildPillsFichaBodyHtml(cols, row, eh) {
  return `
    <div class="pf-section">Todos los campos</div>
    ${cols
      .map((c) => {
        const v = row[c] || '';
        return `<div class="pf-field">
        <span class="pf-key">${eh(c)}</span>
        <span class="pf-val${!v ? ' empty' : ''}">${v ? eh(v) : 'Sin información'}</span>
      </div>`;
      })
      .join('')}`;
}
