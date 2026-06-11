import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function PillsViewInner() {
  return (
    <div id="pills-view">
      <div id="pills-search-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          id="pills-search-input"
          placeholder="🔍  Buscar..."
          autoComplete="off"
          onInput={(e) => callLegacy('pillsOnSearch', e.currentTarget.value)}
          style={{
            flex: 1,
            background: 'var(--s1)',
            border: '1.5px solid var(--border)',
            borderRadius: 20,
            padding: '9px 14px',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'var(--font)',
            transition: 'border-color .15s',
          }}
        />
        <button
          type="button"
          id="pills-search-clear"
          onClick={() => callLegacy('pillsClearSearch')}
          style={{
            display: 'none',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            border: '1px solid var(--border2)',
            background: 'var(--s1)',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ✕ Limpiar
        </button>
      </div>
      <div className="pills-toolbar">
        <span className="pills-toolbar-count" id="pills-toolbar-count" />
        <button
          type="button"
          className="pills-cfg-btn"
          id="pills-filter-btn"
          onClick={() => callLegacy('pillsToggleMobileFilter')}
          style={{ display: 'none' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span id="pills-filter-label">Filtros</span>
        </button>
        <button type="button" className="pills-cfg-btn" id="pills-cfg-btn" onClick={() => callLegacy('pillsToggleConfig')}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
          </svg>
          Configurar
        </button>
      </div>
      <div id="pills-cfg-panel">
        <div className="pills-cfg-row">
          <span className="pills-cfg-label">Campo principal</span>
          <select className="pills-cfg-select" id="pills-sel-main" onChange={() => callLegacy('renderPillsView')}>
            <option value="" />
          </select>
        </div>
        <div className="pills-cfg-row">
          <span className="pills-cfg-label">Campo secundario</span>
          <select className="pills-cfg-select" id="pills-sel-sec" onChange={() => callLegacy('renderPillsView')}>
            <option value="" />
          </select>
        </div>
        <div className="pills-cfg-row">
          <span className="pills-cfg-label">Color por</span>
          <select className="pills-cfg-select" id="pills-sel-color" onChange={() => callLegacy('renderPillsView')}>
            <option value="none">Sin color</option>
          </select>
        </div>
        <div className="pills-cfg-row">
          <span className="pills-cfg-label">Avatar</span>
          <select className="pills-cfg-select" id="pills-sel-avatar" onChange={() => callLegacy('renderPillsView')}>
            <option value="" />
          </select>
        </div>
        <div className="pills-cfg-row">
          <span className="pills-cfg-label">Diseño</span>
          <select className="pills-cfg-select" id="pills-sel-design" onChange={() => callLegacy('renderPillsView')}>
            <option value="d1">▣ ID Card</option>
            <option value="d2">≡ Lista compacta</option>
            <option value="d3">○ Chips</option>
            <option value="d5">◎ Timeline</option>
          </select>
        </div>
        <div className="pills-cfg-row" style={{ justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => callLegacy('pillsResetDefaults')}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            ↺ Por defecto
          </button>
        </div>
      </div>
      <div id="pills-grid-wrap">
        <div id="pills-loading" aria-live="polite" aria-busy="false">
          <div className="spinner" />
          <span id="pills-loading-text">Cargando registros…</span>
        </div>
        <div id="pills-grid" />
      </div>
    </div>
  );
}

/** core.js renders cards into #pills-grid and toggles .open on #pills-view. */
export const PillsView = memo(PillsViewInner);
