import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function DocsPanelInner() {
  return (
    <div id="docs-panel">
      <div className="docs-modal">
        <div className="docs-header">
          <span className="docs-title">📂 Mis documentos</span>
          <button type="button" className="docs-close" onClick={() => callLegacy('closeDocsPanel')}>
            ×
          </button>
        </div>
        <div className="docs-body" id="docs-body">
          <div className="docs-empty">Cargando...</div>
        </div>
      </div>
    </div>
  );
}

/** Cloud documents panel — firebase-app.js fills #docs-body. */
export const DocsPanel = memo(DocsPanelInner);
