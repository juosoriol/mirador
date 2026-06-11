import { memo } from 'react';

function openFileInput() {
  document.getElementById('file-input')?.click();
}

function TabBarInner() {
  return (
    <div id="tabs-bar" style={{ display: 'none' }}>
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
      >
        +
      </div>
    </div>
  );
}

/** Static shell — core.js renderTabs() inserts .tab nodes before #tab-add. */
export const TabBar = memo(TabBarInner);
