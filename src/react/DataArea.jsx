import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function DataAreaInner() {
  return (
    <div id="data-area">
      <div
        id="dropzone"
        role="button"
        tabIndex={0}
        title="Abrir archivo Excel"
        onClick={() => callLegacy('openFilePicker')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callLegacy('openFilePicker');
          }
        }}
        onDragOver={(e) => callLegacy('onDragOver', e.nativeEvent)}
        onDrop={(e) => callLegacy('onDrop', e.nativeEvent)}
        onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
      >
        <div className="drop-icon">📊</div>
        <h2>Arrastra tu archivo Excel aquí</h2>
        <p style={{ fontSize: 12 }}>o haz clic para elegir un archivo</p>
        <button
          type="button"
          className="drop-open-btn"
          onClick={(e) => {
            e.stopPropagation();
            callLegacy('openFilePicker');
          }}
        >
          📂 Abrir archivo
        </button>
        <p style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>
          Mirador — Abre varios archivos en pestañas independientes
        </p>
      </div>
      <div id="loading">
        <div className="spinner" />
        <span>Cargando...</span>
      </div>
      <div id="table-wrap">
        <div id="vt-scroll">
          <table className="vt-table" id="vt-body-table">
            <thead id="table-head" />
            <tbody id="table-body" />
          </table>
        </div>
        <div id="vt-info" />
      </div>
    </div>
  );
}

/** Virtual table shell — core.js renders rows into #table-head / #table-body. */
export const DataArea = memo(DataAreaInner);
