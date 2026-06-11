import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function MobileFilterSheetInner() {
  return (
    <div id="mobile-filter-overlay" onClick={() => callLegacy('closeMobileFilterSheet')}>
      <div className="mf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mf-sheet-hdr">
          <h3>Filtros avanzados</h3>
          <button
            type="button"
            className="mf-sheet-close"
            onClick={() => callLegacy('closeMobileFilterSheet')}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="mf-sheet-body">
          <p
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              marginBottom: 14,
              lineHeight: 1.4,
            }}
          >
            La búsqueda de texto queda arriba en tiempo real. Aquí: columnas, chips y opciones.
          </p>
          <div className="mf-sec">
            <div className="mf-sec-t">Buscar en columna</div>
            <select
              className="mf-field"
              id="mf-search-col"
              onChange={(e) => callLegacy('mobileFilterColChange', e.target.value)}
            />
          </div>
          <div className="mf-sec">
            <div className="mf-sec-t">Opciones</div>
            <div className="mf-tog">
              <label id="mf-l-regex">
                <input
                  type="checkbox"
                  id="mf-chk-regex"
                  onChange={(e) => callLegacy('mobileFilterRegexToggle', e.target.checked)}
                />{' '}
                Regex
              </label>
              <label id="mf-l-excl">
                <input
                  type="checkbox"
                  id="mf-chk-excl"
                  onChange={(e) => callLegacy('mobileFilterExclToggle', e.target.checked)}
                />{' '}
                Excluir
              </label>
            </div>
          </div>
          <div className="mf-sec">
            <div className="mf-sec-t">Filtrar por columna</div>
            <div className="mf-sec-hint" id="mf-active-hint">
              Ningún filtro de columna activo
            </div>
            <div className="mf-chips-host" id="mf-chips-host" />
          </div>
        </div>
        <div className="mf-sheet-ftr">
          <button type="button" className="mf-btn" onClick={() => callLegacy('clearChipFiltersOnly')}>
            Limpiar chips
          </button>
          <button
            type="button"
            className="mf-btn primary"
            onClick={() => callLegacy('closeMobileFilterSheet')}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mobile advanced filters bottom sheet — core.js syncs chips into #mf-chips-host. */
export const MobileFilterSheet = memo(MobileFilterSheetInner);
