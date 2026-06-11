import { memo } from 'react';
import { callLegacy } from './call-legacy.js';

function openFileInput() {
  document.getElementById('file-input')?.click();
}

function closeAnd(fn) {
  return () => {
    callLegacy(fn);
    callLegacy('closeActionsPanel');
  };
}

function closeMobileAnd(fn) {
  return () => {
    callLegacy(fn);
    callLegacy('closeMobileMenu');
  };
}

function AppOverlaysInner() {
  return (
    <>
      <div id="detail-overlay" onClick={(e) => callLegacy('closeDetail', e.nativeEvent)}>
        <div id="detail-panel" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            id="detail-close"
            onClick={() => callLegacy('closeDetail')}
            title="Cerrar (Esc)"
          >
            ×
          </button>
          <div id="detail-style-bar">
            <span>Vista</span>
            <button type="button" className="ds-btn on" data-ds="1" onClick={() => callLegacy('setDetailStyle', 1)}>
              Tabs
            </button>
            <button type="button" className="ds-btn" data-ds="2" onClick={() => callLegacy('setDetailStyle', 2)}>
              Ficha
            </button>
            <button type="button" className="ds-btn" data-ds="3" onClick={() => callLegacy('setDetailStyle', 3)}>
              Expandida
            </button>
          </div>
          <div id="detail-body" />
        </div>
      </div>

      <div className="modal-overlay" id="cond-overlay" onClick={(e) => callLegacy('closeCondModal', e.nativeEvent)}>
        <div className="modal-box" id="cond-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={() => callLegacy('closeCondModal')}>
            ×
          </button>
          <h3>⬛ Coloreado condicional</h3>
          <div id="cond-rules-list" />
          <button
            type="button"
            className="btn"
            onClick={() => callLegacy('addCondRule')}
            style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
          >
            + Agregar regla
          </button>
          <div className="cm-actions">
            <button type="button" className="btn primary" onClick={() => callLegacy('applyCondRules')}>
              Aplicar
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="fav-overlay" onClick={(e) => callLegacy('closeFavModal', e.nativeEvent)}>
        <div className="modal-box" id="fav-modal" onClick={(e) => e.stopPropagation()}>
          <div className="fav-header">
            <h3>⭐ Mis vistas guardadas</h3>
            <button type="button" className="modal-close-new" onClick={() => callLegacy('closeFavModal')}>
              ×
            </button>
          </div>
          <div id="fav-save-row">
            <input
              type="text"
              id="fav-name-input"
              placeholder="Nombre de la vista..."
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === 'Enter') callLegacy('saveFavorite');
              }}
            />
            <button type="button" className="btn primary" onClick={() => callLegacy('saveFavorite')}>
              💾 Guardar vista
            </button>
          </div>
          <div id="fav-list" />
        </div>
      </div>

      <div id="col-menu">
        <div className="cmenu-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxSort', 1)}>
          ↑ Ordenar A → Z
        </div>
        <div className="cmenu-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxSort', -1)}>
          ↓ Ordenar Z → A
        </div>
        <div className="cmenu-sep" />
        <div className="cmenu-item" id="ctx-freeze-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxFreeze')}>
          🔒 Fijar columna
        </div>
        <div className="cmenu-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxHide')}>
          👁 Ocultar columna
        </div>
        <div className="cmenu-sep" />
        <div className="cmenu-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxCopyCol')}>
          ⧉ Copiar valores
        </div>
        <div className="cmenu-item" role="button" tabIndex={0} onClick={() => callLegacy('ctxFilter')}>
          ⊜ Filtrar por esta
        </div>
      </div>

      <div id="col-panel-overlay" onClick={(e) => callLegacy('closeColPanel', e.nativeEvent)}>
        <div id="col-panel" onClick={(e) => e.stopPropagation()}>
          <div id="col-panel-head">
            <h3>Columnas visibles</h3>
            <button type="button" id="col-panel-close" onClick={() => callLegacy('closeColPanel')}>
              ×
            </button>
          </div>
          <div id="col-panel-list" />
          <div id="col-panel-actions">
            <button
              type="button"
              className="btn"
              onClick={() => callLegacy('setAllCols', true)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Mostrar todas
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => callLegacy('setAllCols', false)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Ocultar todas
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="theme-overlay" onClick={(e) => callLegacy('closeThemeModal', e.nativeEvent)}>
        <div
          className="modal-box"
          id="theme-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 480 }}
        >
          <button type="button" className="modal-close" onClick={() => callLegacy('closeThemeModal')}>
            ×
          </button>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text)' }}>
            🎨 Seleccionar tema
          </h3>
          <div id="theme-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} />
        </div>
      </div>

      <div className="modal-overlay" id="datecol-overlay" onClick={(e) => callLegacy('closeDateColPanel', e.nativeEvent)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
          <button type="button" className="modal-close" onClick={() => callLegacy('closeDateColPanel')}>
            ×
          </button>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
            📅 Columnas de fecha
          </h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            Marca las columnas que contienen fechas. Se mostrarán en formato DD/MM/AAAA y podrás
            filtrarlas por rango.
          </p>
          <div
            id="datecol-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              maxHeight: 320,
              overflowY: 'auto',
              marginBottom: 14,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn primary" onClick={() => callLegacy('applyDateColSelection')}>
              Aplicar
            </button>
          </div>
        </div>
      </div>

      <div
        id="hdr-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) callLegacy('cancelHdrPicker');
        }}
      >
        <div id="hdr-modal" onClick={(e) => e.stopPropagation()}>
          <div id="hdr-modal-head">
            <div id="hdr-modal-icon">🔍</div>
            <div id="hdr-modal-info">
              <h3>Seleccionar fila de encabezados</h3>
              <p>
                Mirador detectó automáticamente la fila marcada en azul. Revisa la vista previa y
                haz clic en la fila correcta si la detección no fue precisa.
              </p>
            </div>
            <button
              type="button"
              id="hdr-close"
              onClick={() => callLegacy('cancelHdrPicker')}
              title="Cancelar"
            >
              ×
            </button>
          </div>
          <div id="hdr-auto-banner">
            <span className="hdr-badge">AUTO</span>
            <span id="hdr-auto-msg">
              Encabezado detectado en la fila <strong id="hdr-auto-rownum" />
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
              Haz clic en otra fila para cambiar
            </span>
          </div>
          <div id="hdr-preview-hint">
            💡{' '}
            <span>
              Haz <strong>clic en cualquier fila</strong> para usarla como encabezado — las filas
              superiores serán ignoradas
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              Ir a fila:
              <input
                type="number"
                id="hdr-manual-input"
                min={1}
                placeholder="N°"
                title="Ir a fila específica"
                onChange={(e) => callLegacy('jumpToHdrRow', e.target.value)}
              />
              <button
                type="button"
                className="btn"
                style={{ padding: '3px 10px', fontSize: 11 }}
                onClick={() =>
                  callLegacy('jumpToHdrRow', document.getElementById('hdr-manual-input')?.value)
                }
              >
                Ir
              </button>
            </span>
          </div>
          <div id="hdr-preview-wrap">
            <table id="hdr-table">
              <thead id="hdr-thead" />
              <tbody id="hdr-tbody" />
            </table>
          </div>
          <div id="hdr-footer">
            <div id="hdr-sel-info">
              Fila seleccionada: <strong id="hdr-sel-rownum">—</strong>
            </div>
            <button type="button" className="btn" onClick={() => callLegacy('cancelHdrPicker')}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => callLegacy('autoDetectHeaderAndApply')}
              title="Dejar que Mirador detecte automáticamente"
            >
              🔍 Autodetectar
            </button>
            <button type="button" className="btn primary" id="hdr-confirm-btn" onClick={() => callLegacy('confirmHdrPicker')}>
              ✓ Usar esta fila
            </button>
          </div>
        </div>
      </div>

      <div
        id="chart-overlay"
        style={{
          display: 'none',
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.7)',
          zIndex: 400,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          id="chart-modal"
          style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            width: 820,
            maxWidth: '96vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--acc-dim)',
                border: '1px solid var(--acc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              📊
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Gráfico</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Visualiza los datos filtrados</div>
            </div>
            <button
              type="button"
              onClick={() => callLegacy('closeGraphPanel')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
              Columna:{' '}
              <select id="chart-col" style={{ maxWidth: 200 }} onChange={() => callLegacy('renderChart')}>
                <option value="">— seleccionar —</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
              Tipo:
              <select id="chart-type" onChange={() => callLegacy('renderChart')} style={{ maxWidth: 130 }}>
                <option value="bar">Barras</option>
                <option value="hbar">Barras horiz.</option>
                <option value="pie">Torta</option>
                <option value="donut">Dona</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
              Top:{' '}
              <select id="chart-top" onChange={() => callLegacy('renderChart')} style={{ maxWidth: 80 }}>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="0">Todos</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
              Orden:{' '}
              <select id="chart-order" onChange={() => callLegacy('renderChart')} style={{ maxWidth: 100 }}>
                <option value="desc">Mayor → menor</option>
                <option value="asc">Menor → mayor</option>
                <option value="alpha">Alfabético</option>
              </select>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300,
            }}
          >
            <canvas id="chart-canvas" style={{ maxWidth: '100%', maxHeight: 460 }} />
            <div
              id="chart-empty"
              style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', display: 'none' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              Selecciona una columna para visualizar
            </div>
          </div>
          <div
            id="chart-summary"
            style={{
              padding: '8px 18px',
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--muted)',
              flexShrink: 0,
              display: 'flex',
              gap: 16,
            }}
          />
        </div>
      </div>

      <div id="toast" />

      <div
        id="mobile-sheets-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) callLegacy('closeMobileSheets');
        }}
      >
        <div id="mobile-sheets-panel" onClick={(e) => e.stopPropagation()}>
          <div className="ms-handle-wrap">
            <div className="ms-handle" />
          </div>
          <div className="ms-header">
            <div className="ms-header-icon" id="ms-header-icon" />
            <div className="ms-header-text">
              <div className="ms-title" id="ms-title">
                Hojas del archivo
              </div>
              <div className="ms-subtitle" id="ms-subtitle">
                Selecciona una hoja
              </div>
            </div>
            <button
              type="button"
              className="ms-close"
              onClick={() => callLegacy('closeMobileSheets')}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="ms-list" id="ms-list" />
        </div>
      </div>

      <div
        id="actions-panel-overlay"
        onClick={() => callLegacy('closeActionsPanel')}
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 799,
        }}
      />
      <div id="actions-panel">
        <div id="ap-user-header" style={{ display: 'none' }}>
          <button
            type="button"
            className="ap-user-close"
            onClick={() => callLegacy('closeActionsPanel')}
            aria-label="Cerrar menú"
          >
            ×
          </button>
          <div className="ap-user-stack">
            <button
              type="button"
              className="ap-user-avatar-btn"
              id="ap-user-avatar-btn"
              onClick={(e) => callLegacy('fbShowUserMenu', e.currentTarget)}
            >
              <div className="ap-user-avatar-circle" id="ap-user-avatar" />
            </button>
            <div className="ap-user-name" id="ap-user-name" />
            <div className="ap-user-role" id="ap-user-role" />
            <button
              type="button"
              className="ap-admin-btn"
              id="ap-admin-btn"
              style={{ display: 'none' }}
              onClick={() => {
                callLegacy('fbOpenAdminPanel');
                callLegacy('closeActionsPanel');
              }}
            >
              👥 Admin
            </button>
          </div>
        </div>
        <button
          type="button"
          className="ap-item"
          id="ap-views"
          onClick={closeAnd('openViewsPanel')}
          style={{ background: 'rgba(251,191,36,0.1)', borderLeft: '3px solid #fbbf24' }}
        >
          ⭐ Favoritos / Vistas
        </button>
        <div className="ap-sep" />
        <button
          type="button"
          className="ap-item"
          id="ap-open-file"
          onClick={() => {
            openFileInput();
            callLegacy('closeActionsPanel');
          }}
        >
          📄 Abrir local (sin internet)
        </button>
        <button type="button" className="ap-item" id="ap-docs" onClick={closeAnd('openDocsPanel')}>
          📂 Documentos
        </button>
        <button
          type="button"
          className="ap-item"
          id="ap-save-cloud"
          onClick={closeAnd('saveToCloud')}
          style={{ display: 'none' }}
        >
          ☁️ Guardar en la nube
        </button>
        <div className="ap-sep" />
        <button type="button" className="ap-item" id="ap-graph" onClick={closeAnd('openGraphPanel')} disabled>
          📊 Gráfico
        </button>
        <button
          type="button"
          className="ap-item ap-warn"
          id="ap-cond"
          onClick={closeAnd('openCondModal')}
          disabled
          style={{ color: '#fcd34d' }}
        >
          ⬛ Colores condicionales
        </button>
        <button type="button" className="ap-item" id="ap-cols" onClick={closeAnd('openColPanel')} disabled>
          ▦ Columnas
        </button>
        <div className="ap-sep" />
        <button type="button" className="ap-item" id="ap-export" onClick={closeAnd('exportExcel')} disabled>
          ↓ Exportar filtrado
        </button>
        <button type="button" className="ap-item" id="ap-export-all" onClick={closeAnd('exportAllTabs')} disabled>
          ↓↓ Exportar todas las pestañas
        </button>
        <button type="button" className="ap-item" id="ap-refresh" onClick={closeAnd('openRefreshModal')} disabled>
          ↺ Actualizar / Auto-refresh
        </button>
        <div className="ap-sep" />
        <button type="button" className="ap-item" onClick={closeAnd('openThemeModal')}>
          🎨 Cambiar tema
        </button>
        <button type="button" className="ap-item" onClick={closeAnd('openSessionPanel')}>
          ⏱ Sesión guardada
        </button>
      </div>

      <div id="mobile-menu">
        <button type="button" className="mm-item" id="mm-export" onClick={closeMobileAnd('exportExcel')} disabled>
          ↓ Exportar
        </button>
        <button type="button" className="mm-item" id="mm-graph" onClick={closeMobileAnd('openGraphPanel')} disabled>
          📊 Gráfico
        </button>
        <button type="button" className="mm-item" id="mm-cond" onClick={closeMobileAnd('openCondModal')} disabled>
          ⬛ Colores
        </button>
        <button type="button" className="mm-item" id="mm-cols" onClick={closeMobileAnd('openColPanel')} disabled>
          ▦ Columnas
        </button>
        <button type="button" className="mm-item" id="mm-views" onClick={closeMobileAnd('openViewsPanel')}>
          👁 Vistas
        </button>
        <button type="button" className="mm-item" id="mm-refresh" onClick={closeMobileAnd('openRefreshModal')} disabled>
          ↺ Actualizar
        </button>
        <div className="mm-sep" />
        <button type="button" className="mm-item" onClick={closeMobileAnd('openThemeModal')}>
          🎨 Tema
        </button>
        <button type="button" className="mm-item" onClick={closeMobileAnd('openSessionPanel')}>
          ⏱ Sesión
        </button>
      </div>

      <div id="pills-ficha-overlay" onClick={(e) => callLegacy('pillsFichaOverlayClick', e.nativeEvent)}>
        <div id="pills-ficha-panel">
          <div className="pf-handle-wrap" id="pf-handle">
            <div className="pf-handle" />
          </div>
          <div className="pf-header">
            <div className="pf-avatar" id="pf-avatar" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pf-name" id="pf-name" />
              <div className="pf-sub" id="pf-sub" />
            </div>
            <button type="button" className="pf-close" onClick={() => callLegacy('pillsCloseFicha')}>
              ×
            </button>
          </div>
          <div className="pf-nav">
            <button type="button" className="pf-nav-btn" id="pf-btn-prev" onClick={() => callLegacy('pillsNavigate', -1)}>
              ◀ Anterior
            </button>
            <span className="pf-counter" id="pf-counter" />
            <button type="button" className="pf-nav-btn" id="pf-btn-next" onClick={() => callLegacy('pillsNavigate', 1)}>
              Siguiente ▶
            </button>
          </div>
          <div className="pf-divider" />
          <div className="pf-body" id="pf-body" />
        </div>
      </div>

      <button
        id="viewport-restore-btn"
        type="button"
        onClick={() => callLegacy('restoreMobileViewport')}
        aria-label="Restablecer vista"
      >
        ⌂ Restablecer vista
      </button>
    </>
  );
}

/** Modals, panels, and overlays — core.js / firebase-app.js mutate inner content. */
export const AppOverlays = memo(AppOverlaysInner);
