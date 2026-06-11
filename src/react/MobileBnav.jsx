import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function MobileBnavInner() {
  return (
    <nav id="mobile-bnav" aria-label="Navegación móvil">
      <div className="mbnav-inner">
        <div className="mbnav-btn mbnav-view-wrap" id="mbnav-view">
          <button type="button" id="btn-pills-mode-bnav" onClick={() => callLegacy('togglePillsMode')} title="Alternar Tabla / Pills">
            <span className="pills-toggle-seg seg-table">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              Tabla
            </span>
            <span className="pills-toggle-seg seg-pills">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="7" cy="12" r="3" />
                <circle cx="17" cy="12" r="3" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              Pills
            </span>
          </button>
        </div>
        <button type="button" className="mbnav-btn" id="mbnav-filters" onClick={() => callLegacy('openMobileFilterSheet')}>
          <span className="mbnav-ico">
            ⛃<span className="mbnav-badge" id="mbnav-filter-badge">0</span>
          </span>
          Filtros
        </button>
        <button type="button" className="mbnav-btn" id="mbnav-menu" onClick={() => callLegacy('toggleActionsPanel')}>
          <span className="mbnav-ico">☰</span>
          Menú
        </button>
      </div>
    </nav>
  );
}

export const MobileBnav = memo(MobileBnavInner);
