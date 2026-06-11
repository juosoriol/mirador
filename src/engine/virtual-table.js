import { ALL_COLUMNS_LABEL } from './filter-types.js';
import { filterActiveCondRules, getCondColorForCell } from './cond-engine.js';

export const VT_ROW_H = 30;
export const VT_BUFFER = 12;

/** Mutable virtual-scroll state (shared with legacy window globals). */
export const virtualTableState = {
  raf: null,
  rowTap: { idx: null, t: 0 },
  lastStart: -1,
  lastEnd: -1,
  frzLeftMap: {},
  rowHeights: {},
  totalH: 0,
};

export function invalidateVirtualTableCache(clearHeights = true) {
  virtualTableState.lastStart = -1;
  virtualTableState.lastEnd = -1;
  if (clearHeights) virtualTableState.rowHeights = {};
}

/** @param {Record<string, number>} rowHeights */
export function computeAverageRowHeight(rowHeights, defaultRowH = VT_ROW_H) {
  const keys = Object.keys(rowHeights);
  if (!keys.length) return defaultRowH;
  const sum = keys.reduce((s, k) => s + rowHeights[k], 0);
  return Math.max(defaultRowH, sum / keys.length);
}

/**
 * @returns {{ startRow: number, endRow: number, rowH: number }}
 */
export function computeVisibleRange({
  scrollTop,
  viewH,
  totalRows,
  rowHeights,
  buffer = VT_BUFFER,
  defaultRowH = VT_ROW_H,
}) {
  if (totalRows <= 0) {
    return { startRow: 0, endRow: -1, rowH: defaultRowH };
  }
  const rowH = computeAverageRowHeight(rowHeights, defaultRowH);
  let startRow = Math.floor(scrollTop / rowH) - buffer;
  let endRow = Math.ceil((scrollTop + viewH) / rowH) + buffer;
  startRow = Math.max(0, startRow);
  endRow = Math.min(totalRows - 1, endRow);
  return { startRow, endRow, rowH };
}

/** @param {object} tab */
export function getOrderedColumns(tab) {
  const hid = tab.hiddenCols || new Set();
  const frz = tab.frozenCols || new Set();
  const frozenOrder = tab.frozenOrder || [...frz];
  return [
    ...frozenOrder.filter((c) => frz.has(c) && !hid.has(c)),
    ...tab.columns.filter((c) => !frz.has(c) && !hid.has(c)),
  ];
}

/** @param {object} tab */
export function getRenderColumns(tab) {
  const hid = tab.hiddenCols || new Set();
  const frz = tab.frozenCols || new Set();
  const frozenOrder = tab.frozenOrder || [...frz];
  return [
    ...frozenOrder.filter((c) => frz.has(c) && !hid.has(c)),
    ...tab.columns.filter((c) => !frz.has(c) && !hid.has(c)),
  ];
}

/**
 * @param {object} deps
 * @param {() => object|null} deps.getTab
 * @param {(id: string) => HTMLElement|null} deps.$
 * @param {Function} deps.eh
 * @param {Function} deps.ejs
 * @param {Function} deps.el
 * @param {Function} deps.fmtCell
 * @param {Function} deps.toggleRow
 * @param {Function} deps.openDetail
 */
export function createVirtualTableController(deps) {
  const { getTab, $, eh, ejs, el, fmtCell, toggleRow, openDetail } = deps;
  const st = virtualTableState;

  function buildHeaderHtml(tab, orderedCols) {
    const hid = tab.hiddenCols || new Set();
    const frz = tab.frozenCols || new Set();
    return (
      '<tr>' +
      orderedCols
        .map((col) => {
          if (hid.has(col)) return '';
          const sc = tab.sortCol === col ? (tab.sortDir === 1 ? 'asc' : 'desc') : '';
          const isFrz = frz.has(col);
          const frzCls = isFrz ? 'frozen' : '';
          const frzStyle = isFrz ? ' style="left:0"' : '';
          const lockIcon = isFrz ? ' 🔒' : '';
          return `<th class="${sc} ${frzCls}" data-col="${eh(col)}"${frzStyle}
      onclick="sortBy('${ejs(col)}')"
      oncontextmenu="openColMenu(event,'${ejs(col)}')"
      style="position:sticky;top:0${isFrz ? ';left:0' : ''}"
      >${eh(col)}${lockIcon} <button class="col-expand-btn" onclick="event.stopPropagation();toggleColExpand(this)" title="Expandir/colapsar columna">⤢</button></th>`;
        })
        .join('') +
      '</tr>'
    );
  }

  function buildRow(tab, row, renderCols, hid, frz, rules, txt, scol, allCols) {
    const i = tab.filtered[row];
    if (i === undefined) return null;
    const rowData = tab.rawData[i];
    if (!rowData) return null;
    const tr = document.createElement('tr');
    if (tab.selected.has(i)) tr.className = 'selected';
    tr.dataset.idx = String(i);
    tr.dataset.vrow = String(row);
    tr.onclick = (e) => {
      const now = Date.now();
      if (st.rowTap.idx === i && now - st.rowTap.t < 400) {
        st.rowTap = { idx: null, t: 0 };
        openDetail(i);
        return;
      }
      st.rowTap = { idx: i, t: now };
      toggleRow(e, i);
    };
    tr.ondblclick = (e) => {
      e.preventDefault();
      st.rowTap = { idx: null, t: 0 };
      openDetail(i);
    };

    renderCols.forEach((col) => {
      const td = document.createElement('td');
      if (hid.has(col)) {
        td.className = 'col-hidden';
        tr.appendChild(td);
        return;
      }
      if (frz.has(col)) {
        td.className = 'frozen';
        const left = st.frzLeftMap[col] || 0;
        td.style.left = `${left}px`;
      }
      const raw_v = rowData[col] ?? '';
      const v = fmtCell(col, raw_v, tab);
      td.title = v;

      let bg = getCondColorForCell(v, col, rules);

      if (txt && v && (!scol || allCols || scol === col)) {
        const idx = v.toLowerCase().indexOf(txt);
        if (idx >= 0) {
          const pre = document.createTextNode(v.slice(0, idx));
          const mark = el('span', { cls: 'hl' }, [v.slice(idx, idx + txt.length)]);
          const post = document.createTextNode(v.slice(idx + txt.length));
          if (bg) {
            const wrap = el('span', {
              style: `background:${bg};color:#000;border-radius:3px;padding:0 4px`,
            });
            wrap.append(pre, mark, post);
            td.appendChild(wrap);
          } else {
            td.append(pre, mark, post);
          }
          tr.appendChild(td);
          return;
        }
      }
      if (bg) {
        td.innerHTML = `<span style="background:${bg};color:#000;border-radius:3px;padding:0 4px">${eh(v)}</span>`;
      } else {
        td.textContent = v;
      }
      tr.appendChild(td);
    });
    return tr;
  }

  function applyExpandedCols() {
    const tab = getTab();
    if (!tab) return;
    const expanded = tab.expandedCols || new Set();
    $('table-body')
      ?.querySelectorAll('tr')
      .forEach((tr) => {
        [...tr.children].forEach((td, i) => {
          const th = $('table-head')?.querySelector(`th:nth-child(${i + 1})`);
          const col = th?.dataset.col;
          if (col) td.classList.toggle('col-expanded', expanded.has(col));
        });
      });
    $('table-head')
      ?.querySelectorAll('th[data-col]')
      .forEach((th) => {
        const col = th.dataset.col;
        const btn = th.querySelector('.col-expand-btn');
        const isExp = expanded.has(col);
        th.classList.toggle('col-expanded', isExp);
        if (btn) btn.textContent = isExp ? '⤡' : '⤢';
      });
  }

  function renderVisible() {
    const tab = getTab();
    if (!tab) return;
    const scroll = $('vt-scroll');
    if (!scroll) return;
    const scrollTop = scroll.scrollTop;
    const viewH = scroll.clientHeight;
    const totalRows = tab.filtered.length;

    const { startRow, endRow, rowH } = computeVisibleRange({
      scrollTop,
      viewH,
      totalRows,
      rowHeights: st.rowHeights,
    });

    if (startRow === st.lastStart && endRow === st.lastEnd) return;

    const txt = ($('search-input')?.value || '').toLowerCase().trim();
    const scol = $('search-col')?.value;
    const allCols = scol === ALL_COLUMNS_LABEL || !scol;
    const hid = tab.hiddenCols || new Set();
    const frz = tab.frozenCols || new Set();
    const rules = filterActiveCondRules(tab.condRules);
    const visColCount = tab.columns.filter((c) => !hid.has(c)).length || 1;
    const renderCols = getRenderColumns(tab);
    const tbody = $('table-body');
    if (!tbody) return;

    const prevStart = st.lastStart;
    const prevEnd = st.lastEnd;
    st.lastStart = startRow;
    st.lastEnd = endRow;

    const isFullRebuild = prevStart === -1;

    if (isFullRebuild) {
      const frag = document.createDocumentFragment();
      if (startRow > 0) {
        const sp = document.createElement('tr');
        sp.id = 'vt-pad-top';
        sp.innerHTML = `<td colspan="${visColCount}" style="height:${startRow * rowH}px;padding:0;border:none"></td>`;
        frag.appendChild(sp);
      }
      for (let row = startRow; row <= endRow; row++) {
        const tr = buildRow(tab, row, renderCols, hid, frz, rules, txt, scol, allCols);
        if (tr) frag.appendChild(tr);
      }
      const botH = (totalRows - (endRow + 1)) * rowH;
      if (botH > 0) {
        const sp = document.createElement('tr');
        sp.id = 'vt-pad-bot';
        sp.innerHTML = `<td colspan="${visColCount}" style="height:${botH}px;padding:0;border:none"></td>`;
        frag.appendChild(sp);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
    } else {
      tbody.querySelectorAll('tr[data-vrow]').forEach((tr) => {
        const vr = +tr.dataset.vrow;
        const h = tr.offsetHeight;
        if (h > 0) st.rowHeights[vr] = h;
      });

      if (startRow > prevStart) {
        for (let row = prevStart; row < Math.min(startRow, prevEnd + 1); row++) {
          tbody.querySelector(`tr[data-vrow="${row}"]`)?.remove();
        }
      }
      if (endRow < prevEnd) {
        for (let row = Math.max(endRow + 1, prevStart); row <= prevEnd; row++) {
          tbody.querySelector(`tr[data-vrow="${row}"]`)?.remove();
        }
      }

      let padTop = tbody.querySelector('#vt-pad-top');
      const topH = startRow * rowH;
      if (topH > 0) {
        if (!padTop) {
          padTop = document.createElement('tr');
          padTop.id = 'vt-pad-top';
          padTop.innerHTML = `<td colspan="${visColCount}" style="height:${topH}px;padding:0;border:none"></td>`;
          tbody.insertBefore(padTop, tbody.firstChild);
        } else {
          const td = padTop.querySelector('td');
          if (td) td.style.height = `${topH}px`;
        }
      } else {
        padTop?.remove();
      }

      let padBot = tbody.querySelector('#vt-pad-bot');
      const botH = (totalRows - (endRow + 1)) * rowH;
      if (botH > 0) {
        if (!padBot) {
          padBot = document.createElement('tr');
          padBot.id = 'vt-pad-bot';
          padBot.innerHTML = `<td colspan="${visColCount}" style="height:${botH}px;padding:0;border:none"></td>`;
          tbody.appendChild(padBot);
        } else {
          const td = padBot.querySelector('td');
          if (td) td.style.height = `${botH}px`;
        }
      } else {
        padBot?.remove();
      }

      if (startRow < prevStart) {
        const existingFirst = tbody.querySelector('tr[data-vrow]');
        const padTopEl = tbody.querySelector('#vt-pad-top');
        const anchor = existingFirst || (padTopEl ? padTopEl.nextSibling : tbody.firstChild);
        const newRows = [];
        for (let row = prevStart - 1; row >= startRow; row--) {
          const tr = buildRow(tab, row, renderCols, hid, frz, rules, txt, scol, allCols);
          if (tr) newRows.push(tr);
        }
        for (let j = newRows.length - 1; j >= 0; j--) {
          tbody.insertBefore(newRows[j], anchor);
        }
      }

      if (endRow > prevEnd) {
        const anchorBot = tbody.querySelector('#vt-pad-bot');
        for (let row = prevEnd + 1; row <= endRow; row++) {
          const tr = buildRow(tab, row, renderCols, hid, frz, rules, txt, scol, allCols);
          if (tr) {
            if (anchorBot) tbody.insertBefore(tr, anchorBot);
            else tbody.appendChild(tr);
          }
        }
      }
    }

    applyExpandedCols();
  }

  function onScroll() {
    if (st.raf) return;
    st.raf = requestAnimationFrame(() => {
      st.raf = null;
      try {
        renderVisible();
      } catch (e) {
        console.error('vtRender error:', e);
      }
    });
  }

  function renderTable() {
    const tab = getTab();
    if (!tab) return;

    const orderedCols = getOrderedColumns(tab);
    st.frzLeftMap = {};

    $('table-head').innerHTML = buildHeaderHtml(tab, orderedCols);

    const scroll = $('vt-scroll');
    if (scroll) scroll.onscroll = onScroll;

    const totalRows = tab.filtered.length;
    const info = $('vt-info');
    if (info) {
      if (totalRows > 200) {
        info.classList.add('visible');
        info.textContent = `${totalRows.toLocaleString()} filas · scroll virtual activo`;
      } else {
        info.classList.remove('visible');
      }
    }

    invalidateVirtualTableCache();
    renderVisible();

    requestAnimationFrame(() => {
      const ths = [...($('table-head')?.querySelectorAll('th') || [])];
      ths.forEach((th) => {
        const w = th.offsetWidth;
        if (w > 0) th.style.minWidth = `${w}px`;
      });
      let leftAccum = 0;
      ths.filter((th) => th.classList.contains('frozen')).forEach((th) => {
        const col = th.dataset.col;
        st.frzLeftMap[col] = leftAccum;
        th.style.left = `${leftAccum}px`;
        leftAccum += th.offsetWidth;
      });
      invalidateVirtualTableCache();
      renderVisible();
    });
  }

  function toggleColExpand(btn) {
    const th = btn.closest('th');
    if (!th) return;
    const col = th.dataset.col;
    const tab = getTab();
    if (!tab) return;
    if (!tab.expandedCols) tab.expandedCols = new Set();

    const isExpanded = tab.expandedCols.has(col);
    if (isExpanded) tab.expandedCols.delete(col);
    else tab.expandedCols.add(col);

    th.classList.toggle('col-expanded', !isExpanded);
    btn.textContent = isExpanded ? '⤢' : '⤡';
    applyExpandedCols();
  }

  return {
    renderTable,
    renderVisible,
    onScroll,
    applyExpandedCols,
    toggleColExpand,
    invalidateCache: invalidateVirtualTableCache,
  };
}
