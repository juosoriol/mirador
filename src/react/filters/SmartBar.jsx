import { useEffect, useMemo, useRef, useState } from 'react';
import { activeFilterTokens, containsFilter, quickPicks, setValueSelected, smartSuggestions } from '../../engine/filter-studio-engine.js';
import { clearAllColFilters, setColFilter, setGlobalSearch } from './filter-bridge.js';
import { MethodSwitch, ResultCount } from './shared.jsx';

function suggestionKey(s) {
  return `${s.type}|${s.col ?? ''}|${s.value ?? ''}`;
}

/** Method 3 — command palette: type "columna: valor" or any text, pick with keyboard. */
export function SmartBar({ tab, version, method, onMethod, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const suggestions = useMemo(() => smartSuggestions(tab, query), [tab, query, version]);
  const picks = useMemo(() => (query.trim() ? [] : quickPicks(tab)), [tab, query, version]);
  const tokens = activeFilterTokens(tab.colFilters);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('.fs-sug.on')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const apply = (s) => {
    if (!s) return;
    if (s.type === 'column') {
      setQuery(`${s.col}: `);
    } else if (s.type === 'value') {
      setColFilter(s.col, setValueSelected(tab.colFilters[s.col], s.value, !s.selected));
      setQuery('');
    } else if (s.type === 'contains') {
      setColFilter(s.col, containsFilter(s.value));
      setQuery('');
    } else if (s.type === 'search') {
      setGlobalSearch(s.value);
      onClose();
      return;
    }
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      apply(suggestions[cursor]);
    } else if (e.key === 'Tab' && suggestions[cursor]?.type === 'column') {
      e.preventDefault();
      apply(suggestions[cursor]);
    } else if (e.key === 'Backspace' && !query && tokens.length) {
      setColFilter(tokens[tokens.length - 1].col, undefined);
    }
  };

  const columnSugs = suggestions.filter((s) => s.type === 'column');
  const otherSugs = suggestions.filter((s) => s.type !== 'column');
  const indexOf = (s) => suggestions.indexOf(s);

  const renderSug = (s) => {
    const i = indexOf(s);
    return (
      <button
        key={suggestionKey(s)}
        type="button"
        className={`fs-sug${i === cursor ? ' on' : ''}${s.selected ? ' sel' : ''}`}
        onMouseEnter={() => setCursor(i)}
        onClick={() => apply(s)}
      >
        {s.type === 'column' && (
          <>
            <span className="fs-sug-icon">≡</span>
            <span className="fs-sug-main">
              Filtrar por <strong>{s.col}</strong>
            </span>
            <span className="fs-sug-meta">{s.count} valores ⇥</span>
          </>
        )}
        {s.type === 'value' && (
          <>
            <span className="fs-sug-icon">{s.selected ? '✓' : '+'}</span>
            <span className="fs-sug-main">
              <span className="fs-sug-col">{s.col}</span> {s.value}
            </span>
            <span className="fs-sug-meta">{s.count.toLocaleString()}</span>
          </>
        )}
        {s.type === 'contains' && (
          <>
            <span className="fs-sug-icon">≈</span>
            <span className="fs-sug-main">
              <span className="fs-sug-col">{s.col}</span> contiene «{s.value}»
            </span>
          </>
        )}
        {s.type === 'search' && (
          <>
            <span className="fs-sug-icon">⌕</span>
            <span className="fs-sug-main">
              Buscar «{s.value}» en toda la hoja
            </span>
            <span className="fs-sug-meta">↵</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="fs-overlay fs-top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fs-palette" role="dialog" aria-label="Filtro rápido">
        <div className="fs-palette-input" onClick={() => inputRef.current?.focus()}>
          <span className="fs-palette-icon">⚲</span>
          {tokens.map((t) => (
            <span key={t.col} className="fs-token sm">
              <span className="fs-token-body static">
                <span className="fs-token-col">{t.col}</span>
                <span className="fs-token-val">{t.label}</span>
              </span>
              <button type="button" className="fs-token-x" onClick={() => setColFilter(t.col, undefined)} aria-label={`Quitar ${t.col}`}>
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            placeholder={tokens.length ? 'Añadir otro filtro…' : 'Escribe un valor o "columna: valor"…'}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="fs-palette-sub">
          <MethodSwitch method={method} onChange={onMethod} />
          <ResultCount tab={tab} />
          {tokens.length > 0 && (
            <button type="button" className="fs-link" onClick={clearAllColFilters}>
              Limpiar todo
            </button>
          )}
          <button type="button" className="fs-close fs-palette-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="fs-palette-list" ref={listRef}>
          {query.trim() === '' &&
            picks.map((p) => (
              <div key={p.col} className="fs-pick-row">
                <button type="button" className="fs-pick-col" onClick={() => setQuery(`${p.col}: `)}>
                  {p.col}
                </button>
                <div className="fs-pills">
                  {p.values.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      className={`fs-pill${v.selected ? ' on' : ''}`}
                      onClick={() => setColFilter(p.col, setValueSelected(tab.colFilters[p.col], v.value, !v.selected))}
                    >
                      <span className="fs-pill-label">{v.value}</span>
                      <span className="fs-pill-count">{v.count.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          {columnSugs.length > 0 && <div className="fs-group">Columnas</div>}
          {columnSugs.map(renderSug)}
          {otherSugs.some((s) => s.type !== 'search') && <div className="fs-group">Valores</div>}
          {otherSugs.map(renderSug)}
          {query.trim() !== '' && suggestions.length === 0 && <div className="fs-empty">Ninguna columna se llama así</div>}
        </div>
        <div className="fs-palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> aplicar</span>
          <span><kbd>⌫</kbd> quitar último</span>
          <span><kbd>Esc</kbd> cerrar</span>
          <span className="fs-palette-tip">Tip: <code>estado: activo</code></span>
        </div>
      </div>
    </div>
  );
}
