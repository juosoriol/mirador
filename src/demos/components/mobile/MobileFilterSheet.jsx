import { CloseIcon } from '../../icons/index.jsx';
import { MOBILE_CHIP_OPTIONS } from '../../hooks/useMobileFilters.js';

export function MobileFilterSheet({
  open,
  onClose,
  rows,
  col,
  setCol,
  regex,
  setRegex,
  exclude,
  setExclude,
  chip,
  chipCol,
  toggleChip,
  onClear,
  variant = 'bottom',
  search,
  setSearch,
}) {
  if (!open) return null;

  const sheet = (
    <>
      <div className={`mob-sheet-hdr${variant === 'center' ? ' mob-sheet-hdr-center' : ''}`}>
        <h2>Filtros avanzados</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar">
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="mob-sheet-body">
        <p className="mob-sheet-intro">
          {variant === 'center'
            ? 'Panel centrado — todos los filtros en un solo lugar, incluida búsqueda por columna.'
            : 'La búsqueda de texto queda arriba en tiempo real. Aquí: chips, columna y opciones.'}
        </p>
        {variant === 'center' && setSearch && (
          <div className="mobile-sec">
            <div className="mobile-sec-t">Búsqueda en la hoja</div>
            <input
              className="mobile-field"
              type="search"
              placeholder="Buscar texto…"
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <div className="mobile-sec">
          <div className="mobile-sec-t">Buscar en columna</div>
          <select className="mobile-field" value={col} onChange={(e) => setCol(e.target.value)}>
            <option value="">Todas las columnas</option>
            <option value="nombre">Nombre</option>
            <option value="cargo">Cargo</option>
            <option value="nivel">Nivel</option>
          </select>
        </div>
        <div className="mobile-sec">
          <div className="mobile-sec-t">Opciones</div>
          <div className="mobile-tog">
            <label className={regex ? 'on' : ''}>
              <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
              Regex
            </label>
            <label className={exclude ? 'on' : ''}>
              <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
              Excluir
            </label>
          </div>
        </div>
        {Object.entries(MOBILE_CHIP_OPTIONS).map(([colName, vals]) => (
          <div key={colName} className="mobile-chip-group">
            <div className="mobile-chip-group-t">{colName === 'nivel' ? 'Nivel' : 'Cargo'}</div>
            <div className="mobile-chips">
              {vals.map((v) => {
                const count = rows.filter((r) => r[colName] === v).length;
                const isOn = chip === v && chipCol === colName;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`mobile-chip${isOn ? ' on' : ''}`}
                    onClick={() => toggleChip(colName, v)}
                  >
                    {v}
                    <span className="n">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mob-sheet-footer">
        <button type="button" className="mobile-btn" onClick={onClear}>
          Limpiar chips
        </button>
        <button type="button" className="mobile-btn primary" onClick={onClose}>
          Listo
        </button>
      </div>
    </>
  );

  if (variant === 'center') {
    return (
      <div className="mob-overlay-center" onClick={onClose}>
        <div className="mob-sheet-center" onClick={(e) => e.stopPropagation()}>
          {sheet}
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-overlay" onClick={onClose}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
        {sheet}
      </div>
    </div>
  );
}

export function MobileActivePills({ totalFilt, search, chip, chipCol, regex, exclude, onRemove, onClearAll, showClear = true }) {
  if (totalFilt === 0) return null;

  return (
    <div className="mobile-active-bar show">
      <div className="mobile-active-pills">
        {search.trim() && (
          <span className="mobile-apill">
            &quot;{search.trim()}&quot;
            <button type="button" onClick={() => onRemove('live')} title="Quitar">
              ×
            </button>
          </span>
        )}
        {chip && (
          <span className="mobile-apill">
            {chipCol}: {chip}
            <button type="button" onClick={() => onRemove('chip')} title="Quitar">
              ×
            </button>
          </span>
        )}
        {regex && (
          <span className="mobile-apill">
            Regex
            <button type="button" onClick={() => onRemove('regex')} title="Quitar">
              ×
            </button>
          </span>
        )}
        {exclude && (
          <span className="mobile-apill">
            Excluir
            <button type="button" onClick={() => onRemove('excl')} title="Quitar">
              ×
            </button>
          </span>
        )}
      </div>
      {showClear && (
        <button type="button" className="mobile-quick-clear" onClick={onClearAll}>
          Limpiar
        </button>
      )}
    </div>
  );
}
