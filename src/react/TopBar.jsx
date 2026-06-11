import { memo } from 'react';

function openFileInput() {
  document.getElementById('file-input')?.click();
}

function callLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') fn(...args);
}

function TopBarInner() {
  return (
    <div id="topbar">
      <div id="topbar-left">
        <div
          className="logo"
          style={{
            width: 32,
            height: 32,
            padding: 0,
            overflow: 'hidden',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
        </div>
        <div className="app-title" style={{ marginRight: 8, flexShrink: 0 }}>
          Mirador{' '}
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}>— análisis de planillas</span>
        </div>
        <div
          id="topbar-breadcrumb"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: 'var(--topbar-muted,#94a3b8)',
            minWidth: 0,
          }}
        >
          <span id="tb-filename" style={{ color: 'var(--topbar-muted)' }} />
          <span className="tb-sep" style={{ opacity: 0.4 }}>
            /
          </span>
          <span id="tb-sheetname" style={{ color: 'var(--topbar-text,#e2e8f0)', fontWeight: 500 }} />
          <span id="tb-rowinfo" style={{ fontSize: 10, color: 'var(--topbar-muted)', marginLeft: 2 }} />
        </div>
      </div>

      <div id="topbar-center">
        <button
          type="button"
          id="btn-pills-mode"
          onClick={() => callLegacy('togglePillsMode')}
          title="Alternar vista Tabla / Pills"
        >
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

      <div id="topbar-right">
        <button
          type="button"
          className="btn"
          id="btn-open-file"
          onClick={openFileInput}
          title="Abrir archivo"
          style={{ display: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M12 11v6" />
            <path d="M9 14l3-3 3 3" />
          </svg>
          Abrir
        </button>

        <button
          type="button"
          className="btn"
          id="btn-mobile-sheets"
          onClick={() => callLegacy('openMobileSheets')}
          title="Hojas del archivo"
          style={{ display: 'none' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="2" width="18" height="20" rx="2" fill="#217346" opacity=".2" />
            <rect x="3" y="2" width="18" height="20" rx="2" stroke="#217346" strokeWidth="1.5" />
            <path d="M3 8h18M8 8v14" stroke="#217346" strokeWidth="1.2" />
            <rect x="10" y="11" width="9" height="2" rx=".5" fill="#217346" />
            <rect x="10" y="15" width="7" height="2" rx=".5" fill="#217346" opacity=".7" />
          </svg>
          <span id="btn-sheets-label" style={{ whiteSpace: 'nowrap' }}>
            Hojas
          </span>
          <span id="btn-sheets-badge" className="sheets-badge" />
        </button>

        <button
          type="button"
          className="btn"
          id="btn-save-cloud"
          onClick={() => callLegacy('saveToCloud')}
          title="Guardar en la nube"
          style={{
            display: 'none',
            padding: '5px 11px',
            background: 'rgba(16,185,129,.15)',
            borderColor: 'rgba(16,185,129,.4)',
            color: '#10b981',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Guardar
        </button>

        <button
          type="button"
          className="btn"
          id="btn-my-docs"
          onClick={() => callLegacy('openDocsPanel')}
          title="Mis documentos"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Documentos
        </button>

        <button
          type="button"
          className="btn success"
          id="btn-export"
          onClick={() => callLegacy('exportExcel')}
          disabled
          style={{ display: 'none' }}
        >
          ↓ Exportar
        </button>

        <button
          type="button"
          className="btn"
          id="btn-actions"
          onClick={() => callLegacy('toggleActionsPanel')}
          title="Acciones"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <button
          type="button"
          id="btn-mobile-menu"
          onClick={() => callLegacy('toggleMobileMenu')}
          title="Menú"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 10px',
            borderRadius: 'var(--r)',
            border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.1)',
            color: 'var(--topbar-text,var(--text))',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ⋯
        </button>

        <button
          type="button"
          className="btn"
          id="btn-session"
          onClick={() => callLegacy('openSessionPanel')}
          title="Sesión guardada"
          style={{ padding: '5px 9px', fontSize: 13 }}
        >
          ⏱
        </button>

        <button
          type="button"
          className="btn"
          id="btn-theme"
          onClick={() => callLegacy('openThemeModal')}
          title="Cambiar tema"
          style={{ padding: '5px 9px', fontSize: 15 }}
        >
          🎨
        </button>

        <div id="topbar-actions" style={{ display: 'none' }}>
          <button type="button" className="btn" id="btn-graph" onClick={() => callLegacy('openGraphPanel')} disabled>
            Gráfico
          </button>
          <button type="button" className="btn warn-btn" id="btn-cond" onClick={() => callLegacy('openCondModal')} disabled>
            Colores
          </button>
          <button type="button" className="btn" id="btn-views" onClick={() => callLegacy('openViewsPanel')}>
            Vistas
          </button>
          <button type="button" className="btn" id="btn-cols" onClick={() => callLegacy('openColPanel')} disabled>
            Columnas
          </button>
          <button type="button" className="btn" id="btn-copy" onClick={() => callLegacy('copySelection')} disabled>
            Copiar
          </button>
          <button type="button" className="btn" id="btn-refresh" onClick={() => callLegacy('openRefreshModal')} disabled>
            Actualizar
          </button>
          <button type="button" className="btn" id="btn-export-all" onClick={() => callLegacy('exportAllTabs')} disabled>
            Todas
          </button>
        </div>

        <button type="button" id="btn-copy-all" onClick={() => callLegacy('copyFiltered')} style={{ display: 'none' }} disabled />
        <button type="button" id="btn-fav" onClick={() => callLegacy('openViewsPanel')} style={{ display: 'none' }} disabled />
        <button type="button" id="btn-clear" onClick={() => callLegacy('clearFilters')} style={{ display: 'none' }} disabled />
      </div>

      <input
        type="file"
        id="file-input"
        accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.tsv,.ods,.json,.txt"
        onChange={(e) => callLegacy('openFileTab', e.target)}
        multiple
      />
    </div>
  );
}

/** Static shell — legacy core.js updates visibility/text via getElementById. */
export const TopBar = memo(TopBarInner);
