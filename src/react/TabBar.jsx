import { memo } from 'react';

function openFileInput() {
  document.getElementById('file-input')?.click();
}

function TabBarInner() {
  return (
    <div id="tabs-bar">
      <div id="tabs-empty-state">
        <span id="tabs-empty-icon">📂</span>
        <span id="tabs-empty-text">
          Abre un archivo <kbd>.xlsx</kbd> para comenzar
        </span>
        <button type="button" id="tabs-empty-btn" onClick={openFileInput}>
          📁 Abrir archivo
        </button>
      </div>
      <div
        id="tab-add"
        role="button"
        tabIndex={0}
        onClick={openFileInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFileInput();
          }
        }}
        title="Abrir otro archivo"
        style={{ display: 'none' }}
      >
        +
      </div>
    </div>
  );
}

/** Static shell — core.js renderTabs() inserts .tab nodes before #tab-add. */
export const TabBar = memo(TabBarInner);
