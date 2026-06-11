import { useState } from 'react';
import { FilterIcon, MenuIcon, SearchIcon, TableIcon } from '../../icons/index.jsx';
import { MOBILE_ROWS, useMobileFilters } from '../../hooks/useMobileFilters.js';
import { PhoneFrame } from '../PhoneFrame.jsx';
import { SegmentedToggle } from '../SegmentedToggle.jsx';
import { MobileActivePills, MobileFilterSheet } from './MobileFilterSheet.jsx';

export function MobileV2BottomNav() {
  const [mode, setMode] = useState('table');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bnav, setBnav] = useState('table');
  const f = useMobileFilters();

  return (
    <PhoneFrame>
      <div className="mobile-topbar">
        <div className="mobile-tb-l">
          <div className="mobile-logo">
            <TableIcon size={14} />
          </div>
          <span className="mobile-app-name">Mirador</span>
        </div>
        <SegmentedToggle mode={mode} onChange={setMode} compact />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="mob-icon-btn">
            <MenuIcon size={15} />
          </button>
        </div>
      </div>

      <div className="mobile-tabs">
        <div className="mobile-tab active">
          <div className="mobile-tab-t">Vacantes DPSA 2025</div>
          <div className="mobile-tab-m">
            {f.filtered.length} / {MOBILE_ROWS.length} registros
          </div>
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

      <div className="mobile-search">
        <SearchIcon size={16} />
        <input type="text" placeholder="Buscar en la hoja…" value={f.search} onChange={(e) => f.setSearch(e.target.value)} />
        <button
          type="button"
          className={`mobile-search-clear${f.search.trim() ? ' show' : ''}`}
          onClick={() => f.setSearch('')}
        >
          ×
        </button>
      </div>

      <MobileActivePills
        totalFilt={f.totalFilt}
        search={f.search}
        chip={f.chip}
        chipCol={f.chipCol}
        regex={f.regex}
        exclude={f.exclude}
        onRemove={f.removeFilter}
        onClearAll={f.clearAll}
      />

      <div className="mobile-rows">
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

      <nav className="mobile-bnav">
        <button type="button" className={`mobile-bn${bnav === 'table' ? ' active' : ''}`} onClick={() => setBnav('table')}>
          <span className="mobile-bn-ico">
            <TableIcon size={16} />
          </span>
          Tabla
        </button>
        <button
          type="button"
          className={`mobile-bn${bnav === 'filters' ? ' active' : ''}`}
          onClick={() => {
            setBnav('filters');
            setSheetOpen(true);
          }}
        >
          <span className="mobile-bn-ico">
            <FilterIcon size={16} />
            <span className={`mobile-bn-badge${f.advCount > 0 ? ' on' : ''}`}>{f.advCount || ''}</span>
          </span>
          Filtros
        </button>
        <button type="button" className={`mobile-bn${bnav === 'menu' ? ' active' : ''}`} onClick={() => setBnav('menu')}>
          <span className="mobile-bn-ico">
            <MenuIcon size={16} />
          </span>
          Menú
        </button>
      </nav>

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
        onClear={() => {
          f.setChip(null);
          f.setChipCol(null);
          f.setRegex(false);
          f.setExclude(false);
          f.setCol('');
        }}
      />
    </PhoneFrame>
  );
}
