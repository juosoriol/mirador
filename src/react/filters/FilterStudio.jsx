import { useCallback, useEffect, useState } from 'react';
import { FILTER_UI_METHODS } from '../../engine/filter-studio-engine.js';
import { loadFilterMethod, saveFilterMethod, useActiveTab } from './filter-bridge.js';
import { FilterWindow } from './FilterWindow.jsx';
import { FacetDrawer } from './FacetDrawer.jsx';
import { SmartBar } from './SmartBar.jsx';
import '../../styles/filter-studio.css';

const VIEWS = { window: FilterWindow, drawer: FacetDrawer, smart: SmartBar };

export function FilterStudio() {
  const { tab, version } = useActiveTab();
  const [state, setState] = useState({ open: false, method: loadFilterMethod(), col: null });

  const open = useCallback((method, col = null) => {
    const m = FILTER_UI_METHODS.includes(method) ? method : loadFilterMethod();
    if (!window.T?.()?.rawData?.length) return;
    window.closeDropdown?.();
    window.closeMobileFilterSheet?.();
    setState({ open: true, method: m, col });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const setMethod = useCallback((m) => {
    saveFilterMethod(m);
    setState((s) => ({ ...s, method: m }));
  }, []);

  useEffect(() => {
    window.openFilterStudio = open;
    window.closeFilterStudio = close;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open('smart');
      } else if (e.key === 'Escape') {
        setState((s) => (s.open ? { ...s, open: false } : s));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    document.body.classList.toggle('fs-open', state.open && !!tab);
  }, [state.open, tab]);

  if (!state.open || !tab) return null;
  const View = VIEWS[state.method] || FilterWindow;
  return <View key={state.method} tab={tab} version={version} method={state.method} onMethod={setMethod} onClose={close} initialCol={state.col} />;
}
