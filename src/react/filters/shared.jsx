import { useEffect, useMemo, useState } from 'react';
import { activeFilterTokens, columnFacet, containsFilter, selectValues, setValueSelected } from '../../engine/filter-studio-engine.js';
import { COL_FILTER } from '../../engine/filter-types.js';
import { buildDateRangeFilter, parseDateChipFilter } from '../../engine/chip-filter-engine.js';
import { clearAllColFilters, facetRowsExcept, getGlobalSearch, setColFilter, setGlobalSearch } from './filter-bridge.js';

const METHOD_LABELS = { window: 'Ventana', drawer: 'Panel', smart: 'Barra' };
const RENDER_CAP = 300;

export function MethodSwitch({ method, onChange }) {
  return (
    <div className="fs-switch" role="tablist" aria-label="Estilo de filtros">
      {Object.entries(METHOD_LABELS).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={method === id}
          className={method === id ? 'on' : ''}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ResultCount({ tab }) {
  const vis = tab.filtered?.length ?? 0;
  const total = tab.rawData.length;
  return (
    <span className="fs-result">
      <strong>{vis.toLocaleString()}</strong> de {total.toLocaleString()} registros
    </span>
  );
}

export function ActiveTokens({ tab, onPick, empty = 'Sin filtros activos' }) {
  const tokens = activeFilterTokens(tab.colFilters);
  const search = getGlobalSearch(tab);
  if (!tokens.length && !search) return <div className="fs-tokens fs-tokens-empty">{empty}</div>;
  return (
    <div className="fs-tokens">
      {search && (
        <span className="fs-token fs-token-search">
          <span className="fs-token-body" title="Texto de la barra de búsqueda">
            <span className="fs-token-col">Búsqueda</span>
            <span className="fs-token-val">“{search}”</span>
          </span>
          <button type="button" className="fs-token-x" onClick={() => setGlobalSearch('')} aria-label="Quitar búsqueda">
            ×
          </button>
        </span>
      )}
      {tokens.map((t) => (
        <span key={t.col} className="fs-token">
          <button type="button" className="fs-token-body" onClick={() => onPick?.(t.col)} title={`Editar ${t.col}`}>
            <span className="fs-token-col">{t.col}</span>
            <span className="fs-token-val">{t.label}</span>
          </button>
          <button type="button" className="fs-token-x" onClick={() => setColFilter(t.col, undefined)} aria-label={`Quitar ${t.col}`}>
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        className="fs-link"
        onClick={() => {
          if (search) setGlobalSearch('');
          clearAllColFilters();
        }}
      >
        Limpiar todo
      </button>
    </div>
  );
}

export function CountBar({ count, max }) {
  const pct = max ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    <span className="fs-bar" aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Checkbox list of a column's values with search, contains, nulls and bulk actions. */
export function ValuesEditor({ tab, col, version, autoFocus }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const cur = tab.colFilters[col];
  const isNull = cur === COL_FILTER.NULL;
  const containsText = typeof cur === 'string' && cur.startsWith(COL_FILTER.CONTAINS_PREFIX) ? cur.slice(COL_FILTER.CONTAINS_PREFIX.length) : '';
  const [containsInput, setContainsInput] = useState(containsText);
  useEffect(() => {
    setContainsInput((prev) => (prev.trim().toLowerCase() === containsText ? prev : containsText));
  }, [containsText]);
  const facet = useMemo(
    () => columnFacet(tab, col, { query, contains: containsText, candidates: facetRowsExcept(col) }),
    [tab, col, query, containsText, version],
  );
  const shown = showAll ? facet.values : facet.values.slice(0, RENDER_CAP);

  return (
    <div className="fs-editor">
      <div className="fs-editor-tools">
        <input
          className="fs-input"
          type="text"
          placeholder={`Buscar en ${col}…`}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="fs-editor-actions">
          <button type="button" className="fs-mini" onClick={() => setColFilter(col, selectValues(cur, facet.values.map((v) => v.value)))}>
            {query ? 'Marcar resultados' : 'Todos'}
          </button>
          <button type="button" className="fs-mini" onClick={() => setColFilter(col, undefined)} disabled={cur === undefined}>
            Ninguno
          </button>
        </div>
      </div>
      <div className="fs-special">
        <label className={`fs-check${isNull ? ' on' : ''}`}>
          <input type="checkbox" checked={isNull} onChange={() => setColFilter(col, isNull ? undefined : COL_FILTER.NULL)} />
          <span className="fs-check-label fs-muted-i">Vacíos</span>
          <span className="fs-count">{facet.nullCount}</span>
        </label>
        <div className="fs-contains">
          <span className="fs-muted-i">Contiene</span>
          <input
            className="fs-input sm"
            type="text"
            placeholder="texto…"
            value={containsInput}
            onChange={(e) => {
              setContainsInput(e.target.value);
              setColFilter(col, containsFilter(e.target.value));
            }}
          />
        </div>
      </div>
      {containsText && (
        <div className="fs-contains-hint">
          {facet.values.length.toLocaleString()} valor{facet.values.length === 1 ? '' : 'es'} contiene{facet.values.length === 1 ? '' : 'n'} “{containsText}”
        </div>
      )}
      <div className="fs-values">
        {shown.length === 0 && <div className="fs-empty">Sin resultados</div>}
        {shown.map((v) => (
          <label key={v.value} className={`fs-check${v.selected ? ' on' : ''}${v.count === 0 && !v.selected ? ' dim' : ''}`}>
            <input type="checkbox" checked={v.selected} onChange={(e) => setColFilter(col, setValueSelected(cur, v.value, e.target.checked))} />
            <span className="fs-check-label" title={v.value}>
              {v.value}
            </span>
            <CountBar count={v.count} max={facet.maxCount} />
            <span className="fs-count">{v.count.toLocaleString()}</span>
          </label>
        ))}
        {!showAll && facet.values.length > RENDER_CAP && (
          <button type="button" className="fs-link fs-more" onClick={() => setShowAll(true)}>
            Mostrar los {facet.values.length - RENDER_CAP} restantes
          </button>
        )}
      </div>
    </div>
  );
}

export function DateEditor({ tab, col }) {
  const { from, to } = parseDateChipFilter(tab.colFilters[col]);
  const update = (f, t) => setColFilter(col, buildDateRangeFilter(f, t));
  return (
    <div className="fs-date">
      <label>
        Desde
        <input className="fs-input" type="date" value={from} onChange={(e) => update(e.target.value, to)} />
      </label>
      <label>
        Hasta
        <input className="fs-input" type="date" value={to} onChange={(e) => update(from, e.target.value)} />
      </label>
      {(from || to) && (
        <button type="button" className="fs-link" onClick={() => setColFilter(col, undefined)}>
          Quitar rango
        </button>
      )}
    </div>
  );
}

export function CedulaEditor({ tab, col }) {
  const cur = tab.colFilters[col];
  const opts = [
    [undefined, 'Todos'],
    [COL_FILTER.WITH, 'Con cédula'],
    [COL_FILTER.NULL, 'Sin cédula'],
  ];
  return (
    <div className="fs-seg">
      {opts.map(([val, label]) => (
        <button key={label} type="button" className={cur === val ? 'on' : ''} onClick={() => setColFilter(col, val)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ColumnEditor({ tab, column, version, autoFocus }) {
  if (column.kind === 'date') return <DateEditor tab={tab} col={column.col} />;
  if (column.kind === 'cedula') return <CedulaEditor tab={tab} col={column.col} />;
  return <ValuesEditor key={column.col} tab={tab} col={column.col} version={version} autoFocus={autoFocus} />;
}

export function kindIcon(kind) {
  if (kind === 'date') return '📅';
  if (kind === 'cedula') return '🪪';
  return '≡';
}
