import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { LoginApp } from './LoginApp.jsx';
import { TabBar } from './TabBar.jsx';
import { TopBar } from './TopBar.jsx';
import { ChipsBar } from './ChipsBar.jsx';
import { SearchBar } from './SearchBar.jsx';

export function mountAppShell() {
  const loginRoot = document.getElementById('login-root');
  if (loginRoot) {
    createRoot(loginRoot).render(
      <StrictMode>
        <AuthProvider>
          <LoginApp />
        </AuthProvider>
      </StrictMode>
    );
  }

  const topbarRoot = document.getElementById('topbar-root');
  if (topbarRoot) {
    // Sin StrictMode: evita remount que borra estilos que core.js aplica al DOM.
    createRoot(topbarRoot).render(<TopBar />);
  }

  const tabsRoot = document.getElementById('tabs-bar-root');
  if (tabsRoot) {
    createRoot(tabsRoot).render(<TabBar />);
  }

  const chipsRoot = document.getElementById('chips-bar-root');
  if (chipsRoot) {
    createRoot(chipsRoot).render(<ChipsBar />);
  }

  const searchRoot = document.getElementById('searchbar-root');
  if (searchRoot) {
    createRoot(searchRoot).render(<SearchBar />);
  }
}
