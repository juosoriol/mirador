import './styles/main.css';
import { mountAppShell } from './react/mount-app.jsx';

mountAppShell();

async function boot() {
  try {
    // Let React commit all shell roots before legacy core touches the DOM.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
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
