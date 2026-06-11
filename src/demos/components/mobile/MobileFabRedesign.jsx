import { useState } from 'react';
import { FilterIcon, MenuIcon, SearchIcon, TableIcon } from '../../icons/index.jsx';
import { MOBILE_ROWS, useMobileFilters } from '../../hooks/useMobileFilters.js';
import { PhoneFrame } from '../PhoneFrame.jsx';
import { SegmentedToggle } from '../SegmentedToggle.jsx';
import { MobileFilterSheet } from './MobileFilterSheet.jsx';

export function MobileFabRedesign() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const f = useMobileFilters();

  return (
    <PhoneFrame className="mob-fab-frame">
      <div className="mobile-topbar">
        <div className="mobile-tb-l">
          <div className="mobile-logo">
            <TableIcon size={14} />
          </div>
          <span className="mobile-app-name">Mirador</span>
        </div>
        <SegmentedToggle mode="table" onChange={() => {}} compact />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="mob-icon-btn">
            <MenuIcon size={15} />
          </button>
        </div>
      </div>

      <div className="mobile-tabs">
        <div className="mobile-tab active">
          <div className="mobile-tab-t">Vacantes DPSA 2025</div>
          <div className="mobile-tab-m">{f.filtered.length} / {MOBILE_ROWS.length} registros</div>
        </div>
      </div>

      <div className="mobile-stats">
        <div className="mobile-st">
          <div className="mobile-st-l">Total</div>
          <div className="mobile-st-v">{MOBILE_ROWS.length}</div>
        </div>
        <div className="mobile-st">
          <div className="mobile-st-v">{f.filtered.length}</div>
          <div className="mobile-st-l">Visibles</div>
        </div>
        <div className="mobile-st">
          <div className="mobile-st-v">{f.totalFilt}</div>
          <div className="mobile-st-l">Filtros</div>
        </div>
      </div>

      <div className={`mob-fab-summary${f.totalFilt > 0 ? ' show' : ''}`}>
        {f.totalFilt > 0 ? (
          <>
            <div className="mob-fab-summary-text">
              <strong>{f.totalFilt}</strong> filtro{f.totalFilt !== 1 ? 's' : ''} activo{f.totalFilt !== 1 ? 's' : ''}
              {f.chip && ` · ${f.chipCol}: ${f.chip}`}
              {f.search.trim() && ` · "${f.search.trim()}"`}
            </div>
            <button type="button" className="mob-fab-summary-clear" onClick={f.clearAll}>
              Limpiar
            </button>
          </>
        ) : (
          <span className="mob-fab-summary-empty">Sin filtros activos</span>
        )}
      </div>

      <div className="mobile-rows mob-fab-content">
        <div className="mobile-trow hdr">
          <span>Denominación</span>
          <span>Nivel</span>
        </div>
        {MOBILE_ROWS.map((row) => {
          const visible = f.filtered.includes(row);
          return (
            <div key={row.nombre} className={`mobile-trow${visible ? '' : ' gone'}`}>
              <span>
                <strong>{row.nombre}</strong>
                <div className="sub">{row.cargo}</div>
              </span>
              <span>{row.nivel}</span>
            </div>
          );
        })}
      </div>

      <div className="mob-statusbar">
        <span>
          <strong>{f.filtered.length}</strong> filas visibles
        </span>
        <span>Doble toque → detalle</span>
      </div>

      <button type="button" className="mob-fab" onClick={() => setSheetOpen(true)} aria-label="Filtros">
        <FilterIcon size={22} />
        {f.advCount > 0 && <span className="mob-fab-badge">{f.advCount}</span>}
      </button>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        variant="center"
        rows={MOBILE_ROWS}
        search={f.search}
        setSearch={f.setSearch}
        col={f.col}
        setCol={f.setCol}
        regex={f.regex}
        setRegex={f.setRegex}
        exclude={f.exclude}
        setExclude={f.setExclude}
        chip={f.chip}
        chipCol={f.chipCol}
        toggleChip={f.toggleChip}
        onClear={f.clearAll}
      />
    </PhoneFrame>
  );
}
