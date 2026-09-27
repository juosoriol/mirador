import { useEffect, useMemo, useState } from 'react';
import { filterColumnList, listFilterColumns } from '../../engine/filter-studio-engine.js';
import { clearAllColFilters } from './filter-bridge.js';
import { ActiveTokens, ColumnEditor, MethodSwitch, ResultCount, kindIcon } from './shared.jsx';

/** Method 1 — centered window: column list on the left, value editor on the right. */
export function FilterWindow({ tab, version, method, onMethod, onClose, initialCol }) {
  const columns = useMemo(() => listFilterColumns(tab), [tab, version]);
  const [colQuery, setColQuery] = useState('');
  const [current, setCurrent] = useState(
    () =>
      initialCol ||
      columns.find((c) => c.active)?.col ||
      columns.find((c) => c.kind === 'values' && c.uniques > 1 && c.uniques <= 30)?.col ||
      columns[0]?.col ||
      null,
  );
  const [mobileStep, setMobileStep] = useState(initialCol ? 'values' : 'columns');
  const visibleCols = filterColumnList(columns, colQuery);
  const column = columns.find((c) => c.col === current) || null;

  useEffect(() => {
    if (current && !columns.some((c) => c.col === current)) setCurrent(columns[0]?.col || null);
  }, [columns, current]);

  const pick = (col) => {
    setCurrent(col);
    setMobileStep('values');
  };

  return (
    <div className="fs-overlay fs-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`fs-window step-${mobileStep}`} role="dialog" aria-label="Filtros">
        <header className="fs-head">
          <div className="fs-title">
            <span className="fs-title-icon">⚲</span> Filtros
            <ResultCount tab={tab} />
          </div>
          <MethodSwitch method={method} onChange={onMethod} />
          <button type="button" className="fs-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <ActiveTokens tab={tab} onPick={pick} />
        <div className="fs-window-body">
          <aside className="fs-cols">
            <input className="fs-input" type="text" placeholder="Buscar columna…" value={colQuery} onChange={(e) => setColQuery(e.target.value)} />
            <div className="fs-cols-list">
              {visibleCols.map((c) => (
                <button
                  key={c.col}
                  type="button"
                  className={`fs-col${c.col === current ? ' on' : ''}${c.active ? ' active' : ''}`}
                  onClick={() => pick(c.col)}
                >
                  <span className="fs-col-icon">{kindIcon(c.kind)}</span>
                  <span className="fs-col-main">
                    <span className="fs-col-name">{c.col}</span>
                    <span className="fs-col-sub">{c.active ? c.label : c.kind === 'values' ? `${c.uniques} valores` : c.kind === 'date' ? 'Rango de fechas' : 'Con / sin'}</span>
                  </span>
                  {c.active && <span className="fs-dot" />}
                </button>
              ))}
              {!visibleCols.length && <div className="fs-empty">Ninguna columna coincide</div>}
            </div>
          </aside>
          <section className="fs-pane">
            {column ? (
              <>
                <div className="fs-pane-head">
                  <button type="button" className="fs-back" onClick={() => setMobileStep('columns')}>
                    ‹ Columnas
                  </button>
                  <h4>
                    {kindIcon(column.kind)} {column.col}
                  </h4>
                </div>
                <ColumnEditor tab={tab} column={column} version={version} />
              </>
            ) : (
              <div className="fs-empty">No hay columnas filtrables</div>
            )}
          </section>
        </div>
        <footer className="fs-foot">
          <button type="button" className="fs-btn ghost" onClick={clearAllColFilters}>
            Limpiar todo
          </button>
          <button type="button" className="fs-btn primary" onClick={onClose}>
            Ver {tab.filtered.length.toLocaleString()} registros
          </button>
        </footer>
      </div>
    </div>
  );
}
