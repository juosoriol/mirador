import { useEffect, useState } from 'react';
import { LogoIcon } from './icons/index.jsx';
import { ChipsSection } from './sections/ChipsSection.jsx';
import { ViewsSection } from './sections/ViewsSection.jsx';
import { LoginSection } from './sections/LoginSection.jsx';
import { ShellSection } from './sections/ShellSection.jsx';
import { PillsSection } from './sections/PillsSection.jsx';
import { MobileSection } from './sections/MobileSection.jsx';

const SECTIONS = [
  { id: 'login', label: 'Login' },
  { id: 'shell', label: 'App Shell' },
  { id: 'pills', label: 'Pills / Cards' },
  { id: 'chips', label: 'Filter Chips' },
  { id: 'views', label: 'View Modes' },
  { id: 'mobile', label: 'Mobile' },
];

const THEMES = [
  { id: 'refined', label: 'Refined' },
  { id: 'glass', label: 'Glass' },
  { id: 'light', label: 'Light' },
];

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [sectionPart, queryPart] = raw.split('?');
  const section = SECTIONS.find((s) => s.id === sectionPart)?.id ?? 'login';
  const params = new URLSearchParams(queryPart ?? '');
  const theme = THEMES.find((t) => t.id === params.get('theme'))?.id ?? 'refined';
  return { section, theme };
}

function setHash(section, theme) {
  const params = new URLSearchParams();
  if (theme !== 'refined') params.set('theme', theme);
  const qs = params.toString();
  window.location.hash = qs ? `${section}?${qs}` : section;
}

export function DemoGallery() {
  const [section, setSection] = useState(() => parseHash().section);
  const [theme, setTheme] = useState(() => parseHash().theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-demo-theme', theme);
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'azul');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash();
      setSection(parsed.section);
      setTheme(parsed.theme);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goSection = (id) => {
    setSection(id);
    setHash(id, theme);
  };

  const goTheme = (id) => {
    setTheme(id);
    setHash(section, id);
  };

  return (
    <div className="demo-gallery">
      <header className="demo-header">
        <div className="demo-header-left">
          <div className="demo-header-logo">
            <LogoIcon size={18} />
          </div>
          <div>
            <h1>Mirador UI Demos</h1>
            <p>Galería de rediseño React — compara direcciones visuales antes de adoptar en producción.</p>
          </div>
        </div>
        <div className="demo-theme-picker">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`demo-theme-btn${theme === t.id ? ' active' : ''}`}
              onClick={() => goTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="demo-body">
        <nav className="demo-sidebar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`demo-nav-btn${section === s.id ? ' active' : ''}`}
              onClick={() => goSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <main className="demo-content">
          {section === 'login' && <LoginSection />}
          {section === 'shell' && <ShellSection />}
          {section === 'pills' && <PillsSection />}
          {section === 'chips' && <ChipsSection />}
          {section === 'views' && <ViewsSection />}
          {section === 'mobile' && <MobileSection />}
        </main>
      </div>
    </div>
  );
}
