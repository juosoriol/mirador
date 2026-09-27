import './styles/main.css';
import { mountAppShell, SHELL_IDS } from './react/mount-app.jsx';

mountAppShell();

async function waitForShells(timeoutMs = 10_000) {
  const start = performance.now();
  for (;;) {
    const missing = SHELL_IDS.filter((id) => !document.getElementById(id));
    if (!missing.length) return;
    if (performance.now() - start > timeoutMs) {
      console.warn('[Mirador] shells still missing, booting anyway:', missing);
      return;
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
}

async function boot() {
  try {
    await waitForShells();
    await import('./app/core.js');
    await import('./services/firebase-app.js');
    if (typeof window._mobileUiRefresh === 'function') {
      window._mobileUiRefresh();
    }
  } catch (err) {
    console.error('[Mirador] boot failed:', err);
  }
}

boot();
