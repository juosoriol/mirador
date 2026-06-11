import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function openFileInput() {
  document.getElementById('file-input')?.click();
}

function SidebarInner() {
  return (
    <div id="sidebar">
      <div
        id="sidebar-hover-strip"
        onMouseEnter={() => callLegacy('_sidebarReveal', true)}
      />
      <button
        type="button"
        id="sidebar-pin"
        onClick={() => callLegacy('_sidebarTogglePin')}
        title="Fijar panel"
      >
        📌
      </button>
      <div id="sidebar-sheets">
        <div className="sh">Hojas</div>
        <div id="sheet-list">
          <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 11 }}>
            Abre un .xlsx
          </div>
        </div>
      </div>
      <div
        id="sidebar-files-toggle"
        role="button"
        tabIndex={0}
        onClick={() => callLegacy('toggleFilesSidebar')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callLegacy('toggleFilesSidebar');
          }
        }}
        style={{
          padding: '8px 12px',
          marginTop: 60,
          borderTop: '1px solid var(--border)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: 'var(--acc-text)',
          transition: 'background .1s',
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--s2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '';
        }}
      >
        <span style={{ fontSize: 13 }}>📁</span> Archivos{' '}
        <span
          id="files-chevron"
          style={{ marginLeft: 'auto', fontSize: 12, transition: 'transform .2s' }}
        >
          ▸
        </span>
      </div>
      <div
        id="sidebar-files"
        style={{
          display: 'none',
          flexDirection: 'column',
          borderTop: '1px solid var(--border)',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span
            className="fm-tab fm-tab-on"
            id="fm-tab-recent"
            role="button"
            tabIndex={0}
            onClick={() => callLegacy('fmShowTab', 'recent')}
          >
            Recientes
          </span>
          <span
            className="fm-tab"
            id="fm-tab-fav"
            role="button"
            tabIndex={0}
            onClick={() => callLegacy('fmShowTab', 'fav')}
          >
            Favoritos
          </span>
          <span
            className="fm-tab"
            id="fm-tab-folders"
            role="button"
            tabIndex={0}
            onClick={() => callLegacy('fmShowTab', 'folders')}
          >
            Carpetas
          </span>
        </div>
        <div id="fm-panel-recent" style={{ flex: 1, overflowY: 'auto', padding: 4 }} />
        <div
          id="fm-panel-fav"
          style={{ flex: 1, overflowY: 'auto', padding: 4, display: 'none' }}
        />
        <div
          id="fm-panel-folders"
          style={{ flex: 1, overflowY: 'auto', padding: 4, display: 'none' }}
        />
        <div
          style={{
            padding: '5px 8px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={openFileInput}
            style={{ flex: 1, fontSize: 10, padding: '3px 6px' }}
          >
            📂 Abrir
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callLegacy('fmNewFolder')}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            + Carpeta
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sheet list + file manager — core.js updates #sheet-list and fm panels. */
export const Sidebar = memo(SidebarInner);
