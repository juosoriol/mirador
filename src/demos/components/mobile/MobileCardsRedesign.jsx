import { useState } from 'react';
import { CloseIcon, FilterIcon, MenuIcon, SearchIcon } from '../../icons/index.jsx';
import { getNivelColor, MOBILE_CHIP_OPTIONS, MOBILE_ROWS, useMobileFilters } from '../../hooks/useMobileFilters.js';
import { PhoneFrame } from '../PhoneFrame.jsx';
import { MobileFilterSheet } from './MobileFilterSheet.jsx';

export function MobileCardsRedesign() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const f = useMobileFilters();

  const quickChips = MOBILE_CHIP_OPTIONS.nivel;

  return (
    <PhoneFrame className="mob-cards-frame">
      <div className="mob-cards-header">
        <div className="mob-cards-header-top">
          <div className="mobile-logo">
            <SearchIcon size={14} />
          </div>
          <div className="mob-cards-title-block">
            <div className="mob-cards-file">Vacantes DPSA 2025</div>
            <div className="mob-cards-meta">
              {f.filtered.length} de {MOBILE_ROWS.length} · {f.totalFilt} filtro{f.totalFilt !== 1 ? 's' : ''}
            </div>
          </div>
          <button type="button" className="mob-icon-btn">
            <MenuIcon size={15} />
          </button>
        </div>

        <div className="mob-cards-search">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Buscar persona, cargo, nivel…"
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
          />
          {f.search.trim() && (
            <button type="button" className="mobile-search-clear show" onClick={() => f.setSearch('')}>
              ×
            </button>
          )}
          <button type="button" className="mob-cards-filter-btn" onClick={() => setSheetOpen(true)}>
            <FilterIcon size={14} />
            {f.advCount > 0 && <span className="mob-cards-filter-badge">{f.advCount}</span>}
          </button>
        </div>

        <div className="mob-cards-chip-scroll">
          <button
            type="button"
            className={`mob-quick-chip${!f.chip ? ' on' : ''}`}
            onClick={() => {
              f.setChip(null);
              f.setChipCol(null);
            }}
          >
            Todos
          </button>
          {quickChips.map((nivel) => {
            const count = MOBILE_ROWS.filter((r) => r.nivel === nivel).length;
            const isOn = f.chip === nivel && f.chipCol === 'nivel';
            const c = getNivelColor(nivel);
            return (
              <button
                key={nivel}
                type="button"
                className={`mob-quick-chip${isOn ? ' on' : ''}`}
                style={isOn ? { background: c.bg, borderColor: c.fg, color: c.fg } : undefined}
                onClick={() => f.toggleChip('nivel', nivel)}
              >
                {nivel}
                <span className="mob-quick-chip-n">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mob-cards-list">
        {f.filtered.map((row) => {
          const c = getNivelColor(row.nivel);
          return (
            <button key={row.nombre} type="button" className="mob-card-row" onClick={() => setSelected(row)}>
              <div className="mob-card-av" style={{ background: c.bg, color: c.fg }}>
                {row.initials}
              </div>
              <div className="mob-card-body">
                <div className="mob-card-name">{row.nombre}</div>
                <div className="mob-card-role">{row.cargo}</div>
              </div>
              <span className="mob-card-nivel" style={{ background: c.bg, color: c.fg }}>
                {row.nivel}
              </span>
            </button>
          );
        })}
        {f.filtered.length === 0 && (
          <div className="mob-cards-empty">Sin resultados — prueba otro filtro o búsqueda.</div>
        )}
      </div>

      {selected && (
        <div className="mobile-overlay" onClick={() => setSelected(null)}>
          <div className="mob-card-detail" onClick={(e) => e.stopPropagation()}>
            <div className="mob-card-detail-hdr">
              <h3>Detalle</h3>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar">
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="mob-card-detail-body">
              <div className="mob-card-detail-name">{selected.nombre}</div>
              <div className="mob-card-detail-grid">
                {[
                  ['Cargo', selected.cargo],
                  ['Nivel', selected.nivel],
                ].map(([k, v]) => (
                  <div key={k} className="mob-card-detail-row">
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        rows={MOBILE_ROWS}
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
