import { memo } from 'react';

function callLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') fn(...args);
}

function SearchBarInner() {
  return (
    <div id="searchbar">
      <input
        type="text"
        id="search-input"
        placeholder="🔍  Buscar en la hoja..."
        onInput={() => {
          callLegacy('onSearch');
          callLegacy('_updateMobileActiveBar');
          callLegacy('_updateSearchClearBtn');
        }}
        onKeyDown={(e) => callLegacy('_onSearchKey', e.nativeEvent)}
        disabled
        inputMode="search"
        enterKeyHint="search"
      />
      <button
        type="button"
        id="btn-search-clear-mobile"
        onClick={() => callLegacy('_clearLiveSearch')}
        title="Borrar búsqueda"
        style={{ display: 'none' }}
      >
        ×
      </button>
      <div id="search-recents" />
      <label
        id="recent-toggle"
        title="Guardar búsquedas recientes"
        style={{
          display: 'none',
          alignItems: 'center',
          gap: 4,
          fontSize: 10,
          color: 'var(--muted)',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          id="chk-recent"
          style={{ accentColor: 'var(--acc)' }}
          onChange={() => callLegacy('_toggleRecentSave')}
        />{' '}
        Recientes
      </label>
      <label
        id="regex-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: 'var(--muted)',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
        title="Regex: usa * para 'contiene' (ej: cargo* = contiene 'cargo'). Activa expresiones regulares completas."
      >
        <input
          type="checkbox"
          id="chk-regex"
          style={{ accentColor: 'var(--acc)' }}
          onChange={() => callLegacy('onRegexChange')}
          disabled
        />{' '}
        Regex*
      </label>
      <button
        type="button"
        id="btn-regex-flags"
        onClick={() => callLegacy('toggleRegexFlagsPanel')}
        disabled
        title="Flags de regex"
        style={{
          display: 'none',
          padding: '2px 7px',
          fontSize: 10,
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}
      >
        flags
      </button>
      <div
        id="regex-flags-panel"
        style={{
          display: 'none',
          position: 'fixed',
          zIndex: 600,
          background: 'var(--s1)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.3)',
          padding: '10px 14px',
          minWidth: 180,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontSize: 11 }}>Opciones de Regex</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', cursor: 'pointer', color: 'var(--text)' }}>
          <input type="checkbox" id="chk-regex-i" defaultChecked style={{ accentColor: 'var(--acc)' }} />{' '}
          <span>
            Ignorar mayúsculas <code style={{ fontSize: 10, background: 'var(--s2)', padding: '1px 4px', borderRadius: 3 }}>i</code>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', cursor: 'pointer', color: 'var(--text)' }}>
          <input type="checkbox" id="chk-regex-m" style={{ accentColor: 'var(--acc)' }} />{' '}
          <span>
            Multilínea <code style={{ fontSize: 10, background: 'var(--s2)', padding: '1px 4px', borderRadius: 3 }}>m</code>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', cursor: 'pointer', color: 'var(--text)' }}>
          <input type="checkbox" id="chk-regex-s" style={{ accentColor: 'var(--acc)' }} />{' '}
          <span>
            Punto incluye saltos <code style={{ fontSize: 10, background: 'var(--s2)', padding: '1px 4px', borderRadius: 3 }}>s</code>
          </span>
        </label>
        <div
          style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, fontSize: 10, color: 'var(--muted)' }}
          id="regex-preview-status"
        />
      </div>
      <label
        id="excl-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: 'var(--muted)',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          id="chk-excl"
          style={{ accentColor: 'var(--acc)' }}
          onChange={() => callLegacy('applyFilters')}
          disabled
        />{' '}
        Excluir
      </label>
      <select id="search-col" onChange={() => callLegacy('onSearchColChange')} disabled>
        <option>Todas las columnas</option>
      </select>
      <input type="date" id="date-from" style={{ display: 'none' }} onChange={() => callLegacy('applyFilters')} />
      <input type="date" id="date-to" style={{ display: 'none' }} onChange={() => callLegacy('applyFilters')} />
      <select id="date-col" style={{ display: 'none' }} onChange={() => callLegacy('applyFilters')}>
        <option value="" />
      </select>
      <button type="button" id="btn-date-cols" style={{ display: 'none' }} />
      <button
        type="button"
        className="btn"
        id="btn-clear-inline"
        onClick={() => callLegacy('clearFilters')}
        disabled
        title="Limpiar filtros"
        style={{ padding: '5px 8px', fontSize: 12, marginLeft: 'auto' }}
      >
        ✕ Limpiar
      </button>
    </div>
  );
}

/** Static shell — core.js enables controls and updates search state. */
export const SearchBar = memo(SearchBarInner);
