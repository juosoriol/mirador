import { memo } from 'react';

function callLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') fn(...args);
}

function ChipsBarInner() {
  return (
    <div id="chips-bar" style={{ display: 'none' }}>
      <div id="chip-search-wrap" style={{ display: 'none', flexShrink: 0, alignItems: 'center', gap: 5 }}>
        <input type="text" id="chip-search" placeholder="🔍 Filtros..." autoComplete="off" />
        <button
          type="button"
          id="btn-clear-chips"
          onClick={() => callLegacy('_clearChipSearch')}
          title="Limpiar búsqueda y filtros"
          style={{
            padding: '4px 11px',
            borderRadius: 20,
            fontSize: 12,
            border: '1px solid #ef444433',
            background: '#ef444411',
            color: '#ef4444',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            opacity: 0.3,
            transition: 'opacity .15s,transform .1s',
            flexShrink: 0,
          }}
        >
          🧹 Limpiar
        </button>
        <span id="chips-count" style={{ fontSize: 10, color: 'var(--acc-text)', whiteSpace: 'nowrap' }} />
        <button
          type="button"
          id="chips-toggle"
          onClick={() => callLegacy('toggleChipsBar')}
          style={{
            display: 'none',
            padding: '4px 11px',
            borderRadius: 20,
            fontSize: 12,
            border: '1px solid var(--acc)',
            background: 'var(--acc-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            transition: 'all .15s',
            flexShrink: 0,
            alignItems: 'center',
            gap: 4,
            color: 'var(--acc-text)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6,9 12,15 18,9" />
          </svg>
          <span id="chips-toggle-label">Ver todos</span>
        </button>
      </div>
      <span id="chips-placeholder" style={{ color: 'var(--muted)', fontSize: 12 }}>
        Abre un archivo para ver los filtros
      </span>
      <div id="chips-right" style={{ display: 'none', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
        <span id="chips-more-badge" />
      </div>
    </div>
  );
}

/** Static shell — core.js injects .chip nodes and toggles visibility. */
export const ChipsBar = memo(ChipsBarInner);
