import { useMemo, useState } from 'react';
import { columnFacet, filterColumnList, listFilterColumns, setValueSelected } from '../../engine/filter-studio-engine.js';
import { COL_FILTER } from '../../engine/filter-types.js';
import { clearAllColFilters, facetRowsExcept, setColFilter } from './filter-bridge.js';
import { ActiveTokens, CedulaEditor, DateEditor, MethodSwitch, ResultCount, kindIcon } from './shared.jsx';

const PILL_PREVIEW = 10;
const PILL_CAP = 200;

function ValuePills({ tab, col, version }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const cur = tab.colFilters[col];
  const contains = typeof cur === 'string' && cur.startsWith(COL_FILTER.CONTAINS_PREFIX) ? cur.slice(COL_FILTER.CONTAINS_PREFIX.length) : '';
  const facet = useMemo(
    () => columnFacet(tab, col, { query, contains, candidates: facetRowsExcept(col) }),
    [tab, col, query, contains, version],
  );
  const limit = expanded ? PILL_CAP : PILL_PREVIEW;
  const shown = facet.values.slice(0, limit);
  const rest = facet.values.length - shown.length;

  return (
    <div className="fs-facet-body">
      {expanded && (
        <input className="fs-input sm" type="text" placeholder={`Buscar en ${col}…`} value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
      )}
      <div className="fs-pills">
        {shown.map((v) => (
          <button
            key={v.value}
            type="button"
            className={`fs-pill${v.selected ? ' on' : ''}${v.count === 0 && !v.selected ? ' dim' : ''}`}
            onClick={() => setColFilter(col, setValueSelected(cur, v.value, !v.selected))}
            title={v.value}
          >
            <span className="fs-pill-label">{v.value}</span>
            <span className="fs-pill-count">{v.count.toLocaleString()}</span>
          </button>
        ))}
        {!shown.length && <span className="fs-empty">Sin resultados</span>}
      </div>
      {rest > 0 && !expanded && (
        <button type="button" className="fs-link" onClick={() => setExpanded(true)}>
          Ver {rest} más
        </button>
      )}
      {rest > 0 && expanded && <span className="fs-hint">+{rest} más — usa la búsqueda</span>}
      {expanded && (
        <button type="button" className="fs-link" onClick={() => { setExpanded(false); setQuery(''); }}>
          Ver menos
        </button>
      )}
    </div>
  );
}

function Facet({ tab, column, version, open, onToggle }) {
  return (
    <div className={`fs-facet${open ? ' open' : ''}${column.active ? ' active' : ''}`}>
      <button type="button" className="fs-facet-head" onClick={onToggle} aria-expanded={open}>
        <span className="fs-col-icon">{kindIcon(column.kind)}</span>
        <span className="fs-facet-name">{column.col}</span>
        {column.active ? <span className="fs-facet-badge">{column.label}</span> : <span className="fs-facet-sub">{column.kind === 'values' ? column.uniques : ''}</span>}
        <span className="fs-chev">›</span>
      </button>
      {open && (
        <div className="fs-facet-content">
          {column.kind === 'values' && <ValuePills tab={tab} col={column.col} version={version} />}
          {column.kind === 'date' && <DateEditor tab={tab} col={column.col} />}
          {column.kind === 'cedula' && <CedulaEditor tab={tab} col={column.col} />}
          {column.active && column.kind === 'values' && (
            <button type="button" className="fs-link" onClick={() => setColFilter(column.col, undefined)}>
              Quitar filtro de {column.col}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Method 2 — side drawer with one collapsible facet per column and toggle pills. */
export function FacetDrawer({ tab, version, method, onMethod, onClose, initialCol }) {
  const columns = useMemo(() => listFilterColumns(tab), [tab, version]);
  const [colQuery, setColQuery] = useState('');
  const [openSet, setOpenSet] = useState(() => {
    const s = new Set(columns.filter((c) => c.active).map((c) => c.col));
    if (initialCol) s.add(initialCol);
    columns
      .filter((c) => c.kind === 'values' && c.uniques > 1 && c.uniques <= 30)
      .slice(0, 3)
      .forEach((c) => s.add(c.col));
    return s;
  });
  const toggle = (col) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  const visible = filterColumnList(columns, colQuery);

  return (
    <div className="fs-overlay fs-right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="fs-drawer" role="dialog" aria-label="Filtros">
        <header className="fs-head">
          <div className="fs-title">
            <span className="fs-title-icon">⚲</span> Filtros
          </div>
          <button type="button" className="fs-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="fs-drawer-sub">
          <MethodSwitch method={method} onChange={onMethod} />
          <ResultCount tab={tab} />
        </div>
        <ActiveTokens tab={tab} onPick={(col) => setOpenSet((p) => new Set(p).add(col))} />
        <div className="fs-drawer-search">
          <input className="fs-input" type="text" placeholder="Buscar columna…" value={colQuery} onChange={(e) => setColQuery(e.target.value)} />
        </div>
        <div className="fs-drawer-body">
          {visible.map((c) => (
            <Facet key={c.col} tab={tab} column={c} version={version} open={openSet.has(c.col) || !!colQuery} onToggle={() => toggle(c.col)} />
          ))}
          {!visible.length && <div className="fs-empty">Ninguna columna coincide</div>}
        </div>
        <footer className="fs-foot">
          <button type="button" className="fs-btn ghost" onClick={clearAllColFilters}>
            Limpiar todo
          </button>
          <button type="button" className="fs-btn primary" onClick={onClose}>
            Ver {tab.filtered.length.toLocaleString()} registros
          </button>
        </footer>
      </aside>
    </div>
  );
}
