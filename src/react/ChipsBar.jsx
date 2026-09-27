import { memo } from 'react';

function callLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') fn(...args);
}

function ChipsBarInner() {
  return (
    <div id="chips-bar" style={{ display: 'none' }}>
      <div id="chip-search-wrap" style={{ display: 'none', flexShrink: 0, alignItems: 'center', gap: 5 }}>
        <button
          type="button"
          id="btn-filter-studio"
          className="fs-launch"
          onClick={() => callLegacy('openFilterStudio')}
          title="Abrir filtros (Ctrl+K para la barra rápida)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filtros
          <span id="fs-launch-count" className="fs-launch-count" />
        </button>
        <button
          type="button"
          id="btn-cond-rules"
          className="cond-launch"
          onClick={() => callLegacy('openCondModal')}
          title="Pintar celdas según reglas (colores condicionales)"
        >
          <span className="cond-launch-swatch" aria-hidden="true" />
          Colores
          <span id="cond-rules-count" className="fs-launch-count" />
        </button>
        <button
          type="button"
          id="btn-clear-chips"
          onClick={() => callLegacy('clearChipFiltersOnly')}
          title="Quitar todos los filtros de columna"
          style={{
            display: 'none',
            padding: '4px 11px',
            borderRadius: 20,
            fontSize: 12,
            border: '1px solid #ef444433',
            background: '#ef444411',
            color: '#ef4444',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            transition: 'transform .1s',
            flexShrink: 0,
          }}
        >
          🧹 Limpiar
        </button>
        <span id="chips-count" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} />
      </div>
      <span id="chips-placeholder" style={{ color: 'var(--muted)', fontSize: 12 }}>
        Abre un archivo para ver los filtros
      </span>
      <div id="chips-right" style={{ display: 'none', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }} />
    </div>
  );
}

/** Static shell — core.js injects active-filter .chip nodes before #chips-right. */
export const ChipsBar = memo(ChipsBarInner);
