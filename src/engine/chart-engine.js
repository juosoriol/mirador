export const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#a855f7',
  '#eab308',
  '#6366f1',
  '#22c55e',
  '#fb923c',
];

/** Categorical columns suitable for charting (unique count in range). */
export function getChartEligibleColumns(columns, colUniques, minUnique = 2, maxUnique = 200) {
  return columns.filter((c) => {
    const n = colUniques[c]?.size || 0;
    return n >= minUnique && n <= maxUnique;
  });
}

/**
 * Count label frequencies for one column over filtered row indices.
 * @param {Array<Record<string, unknown>>} rawData
 * @param {number[]} filtered
 * @param {string} col
 */
export function countChartValues(rawData, filtered, col) {
  /** @type {Record<string, number>} */
  const counts = {};
  filtered.forEach((i) => {
    const r = rawData[i];
    if (!r) return;
    const v = (r[col] || '(vacío)').toString().trim() || '(vacío)';
    counts[v] = (counts[v] || 0) + 1;
  });
  return counts;
}

/** @param {[string, number][]} entries */
export function sortChartEntries(entries, order) {
  const sorted = [...entries];
  if (order === 'desc') sorted.sort((a, b) => b[1] - a[1]);
  else if (order === 'asc') sorted.sort((a, b) => a[1] - b[1]);
  else sorted.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return sorted;
}

/** @param {[string, number][]} entries */
export function sliceChartTopN(entries, topN) {
  if (!topN || topN <= 0 || entries.length <= topN) return entries;
  return entries.slice(0, topN);
}

/**
 * Prepare labels, values, and colors for canvas rendering.
 * @param {object} opts
 * @param {Array<Record<string, unknown>>} opts.rawData
 * @param {number[]} opts.filtered
 * @param {string} opts.col
 * @param {string} [opts.order]
 * @param {number} [opts.topN]
 * @param {string[]} [opts.palette]
 */
export function prepareChartSeries({
  rawData,
  filtered,
  col,
  order = 'desc',
  topN = 0,
  palette = CHART_COLORS,
}) {
  const counts = countChartValues(rawData, filtered, col);
  const uniqueCount = Object.keys(counts).length;
  let entries = sortChartEntries(Object.entries(counts), order);
  entries = sliceChartTopN(entries, topN);
  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const colors = entries.map((_, i) => palette[i % palette.length]);
  return {
    labels,
    values,
    colors,
    uniqueCount,
    filteredCount: filtered.length,
    truncated: topN > 0 && uniqueCount > topN,
  };
}

export function drawBarChart(ctx, canvas, labels, values, colors, tc, mc, gc) {
  const W = canvas.width;
  const H = canvas.height;
  const pad = { t: 20, r: 20, b: 70, l: 55 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const max = Math.max(...values, 1);
  let barW = Math.max(8, Math.min(50, (cW / labels.length) * 0.7));
  let gap = (cW - barW * labels.length) / (labels.length + 1);
  if (gap < 2) {
    barW = Math.max(4, (cW / (labels.length + 1)) * 0.7);
    gap = Math.max(1, (cW - barW * labels.length) / (labels.length + 1));
  }

  ctx.strokeStyle = gc;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + cH - (cH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + cW, y);
    ctx.stroke();
    ctx.fillStyle = mc;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((max * i) / 5).toLocaleString(), pad.l - 4, y + 3);
  }

  labels.forEach((lbl, i) => {
    const x = pad.l + gap + i * (barW + gap);
    const bH = Math.max(2, (values[i] / max) * cH);
    const y = pad.t + cH - bH;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    const r = Math.min(4, barW / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + bH);
    ctx.lineTo(x, y + bH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.fillStyle = tc;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    if (bH > 16) ctx.fillText(String(values[i]), x + barW / 2, y - 4);
    ctx.save();
    ctx.translate(x + barW / 2, pad.t + cH + 8);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = mc;
    ctx.textAlign = 'right';
    ctx.font = '10px sans-serif';
    const maxLbl = 12;
    ctx.fillText(lbl.length > maxLbl ? `${lbl.slice(0, maxLbl)}…` : lbl, 0, 0);
    ctx.restore();
  });
}

export function drawHBarChart(ctx, canvas, labels, values, colors, tc, mc, gc) {
  const W = canvas.width;
  const H = canvas.height;
  const maxLblW = Math.min(150, W * 0.3);
  const pad = { t: 10, r: 60, b: 10, l: maxLblW + 10 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const max = Math.max(...values, 1);
  const barH = Math.max(8, Math.min(36, (cH / labels.length) * 0.7));
  const gap = (cH - barH * labels.length) / (labels.length + 1);

  labels.forEach((lbl, i) => {
    const y = pad.t + gap + i * (barH + gap);
    const bW = Math.max(2, (values[i] / max) * cW);
    ctx.fillStyle = mc;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    const disp = lbl.length > 18 ? `${lbl.slice(0, 17)}…` : lbl;
    ctx.fillText(disp, pad.l - 6, y + barH / 2 + 4);
    ctx.fillStyle = colors[i];
    const r = Math.min(3, barH / 2);
    ctx.beginPath();
    ctx.moveTo(pad.l, y + r);
    ctx.quadraticCurveTo(pad.l, y, pad.l + r, y);
    ctx.lineTo(pad.l + bW - r, y);
    ctx.quadraticCurveTo(pad.l + bW, y, pad.l + bW, y + r);
    ctx.lineTo(pad.l + bW, y + barH - r);
    ctx.quadraticCurveTo(pad.l + bW, y + barH, pad.l + bW - r, y + barH);
    ctx.lineTo(pad.l + r, y + barH);
    ctx.quadraticCurveTo(pad.l, y + barH, pad.l, y + barH - r);
    ctx.fill();
    ctx.fillStyle = tc;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(values[i]), pad.l + bW + 4, y + barH / 2 + 4);
  });
}

export function drawPieChart(ctx, canvas, labels, values, colors, isDonut, tc, mc, bgStroke) {
  const W = canvas.width;
  const H = canvas.height;
  const legendW = Math.min(200, W * 0.35);
  const cx = (W - legendW) / 2;
  const cy = H / 2;
  const r = Math.min(cx - 10, (H - 20) / 2);
  const inner = isDonut ? r * 0.55 : 0;
  const total = values.reduce((a, b) => a + b, 0);
  let angle = -Math.PI / 2;

  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    if (inner > 0) ctx.arc(cx, cy, inner, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    ctx.strokeStyle = bgStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += sweep;
  });

  if (isDonut) {
    ctx.fillStyle = tc;
    ctx.font = `bold ${Math.round(r * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(total.toLocaleString(), cx, cy + 4);
    ctx.fillStyle = mc;
    ctx.font = `${Math.round(r * 0.13)}px sans-serif`;
    ctx.fillText('total', cx, cy + r * 0.2);
  }

  const lx = W - legendW + 8;
  const ly0 = Math.max(10, (H - labels.length * 20) / 2);
  labels.forEach((lbl, i) => {
    const ly = ly0 + i * 22;
    if (ly > H - 10) return;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(lx + 2, ly);
    ctx.lineTo(lx + 10, ly);
    ctx.quadraticCurveTo(lx + 12, ly, lx + 12, ly + 2);
    ctx.lineTo(lx + 12, ly + 10);
    ctx.quadraticCurveTo(lx + 12, ly + 12, lx + 10, ly + 12);
    ctx.lineTo(lx + 2, ly + 12);
    ctx.quadraticCurveTo(lx, ly + 12, lx, ly + 10);
    ctx.lineTo(lx, ly + 2);
    ctx.quadraticCurveTo(lx, ly, lx + 2, ly);
    ctx.fill();
    ctx.fillStyle = mc;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    const pct = `${((values[i] / total) * 100).toFixed(1)}%`;
    const disp = `${lbl.length > 16 ? `${lbl.slice(0, 15)}…` : lbl} ${pct}`;
    ctx.fillText(disp, lx + 16, ly + 9);
  });
}
