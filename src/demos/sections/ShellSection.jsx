import { useMemo, useState } from 'react';
import {
  ClockIcon,
  FileIcon,
  FolderIcon,
  LogoIcon,
  MenuIcon,
  SearchIcon,
  ThemeIcon,
} from '../icons/index.jsx';
import { MOCK_ROWS, MOCK_TABS, filterRows } from '../data/mockData.js';
import { DemoSection } from '../components/DemoSection.jsx';
import { SegmentedToggle } from '../components/SegmentedToggle.jsx';
import { StatBar } from '../components/StatBar.jsx';
import { FilterChips } from '../components/FilterChips.jsx';

export function ShellSection() {
  const [tabs, setTabs] = useState(MOCK_TABS);
  const [mode, setMode] = useState('table');
  const [search, setSearch] = useState('');
  const [regex, setRegex] = useState(false);
  const [exclude, setExclude] = useState(false);
  const [deptFilter, setDeptFilter] = useState(null);
  const [nivelFilter, setNivelFilter] = useState(null);
  const [showStats, setShowStats] = useState(true);

  const activeTab = tabs.find((t) => t.active) ?? tabs[0];

  const filtered = useMemo(
    () =>
      filterRows(MOCK_ROWS, {
        search,
        dept: deptFilter,
        nivel: nivelFilter,
        regex,
        exclude,
      }),
    [search, deptFilter, nivelFilter, regex, exclude]
  );

  const filterCount = [deptFilter, nivelFilter, search.trim(), regex, exclude].filter(Boolean).length;

  return (
    <DemoSection
      title="App Shell"
      description="Barra superior, pestañas, estadísticas, búsqueda y chips de filtro — reconstruido en React puro con datos de ejemplo."
      changes="Emoji reemplazados por SVG; logo 32px unificado; colores vía tokens del tema activo; sin callLegacy()."
    >
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />
          Mostrar barra de stats
        </label>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Vista: <strong style={{ color: 'var(--acc-text)' }}>{mode === 'table' ? 'Tabla' : 'Pills'}</strong>
        </span>
      </div>

      <div className="shell-preview">
        {/* Topbar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '8px 14px',
            gap: 8,
            background: 'var(--topbar-bg)',
            color: 'var(--topbar-text)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--acc), #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoIcon size={20} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
              Mirador{' '}
              <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}>— análisis de planillas</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: 'var(--topbar-muted)',
                marginLeft: 8,
                minWidth: 0,
              }}
            >
              <span>{activeTab.name}</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span style={{ color: 'var(--topbar-text)', fontWeight: 500 }}>Hoja1</span>
            </div>
          </div>

          <SegmentedToggle mode={mode} onChange={setMode} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
            {[
              { icon: <FileIcon size={14} />, label: 'Abrir' },
              { icon: <FolderIcon size={14} />, label: 'Documentos' },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--topbar-text)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 9px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--topbar-text)',
                cursor: 'pointer',
              }}
              title="Sesión"
            >
              <ClockIcon />
            </button>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 9px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--topbar-text)',
                cursor: 'pointer',
              }}
              title="Tema"
            >
              <ThemeIcon />
            </button>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 9px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--topbar-text)',
                cursor: 'pointer',
              }}
              title="Acciones"
            >
              <MenuIcon />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 3,
            padding: '6px 10px 0',
            background: 'var(--tabs-bg)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabs(tabs.map((t) => ({ ...t, active: t.id === tab.id })))}
              style={{
                padding: '7px 14px 5px',
                borderRadius: '8px 8px 0 0',
                background: tab.active ? 'var(--bg)' : 'var(--tab-inactive)',
                border: `1px solid ${tab.active ? 'var(--acc)' : 'var(--border)'}`,
                borderBottom: 'none',
                borderTop: tab.active ? '2px solid var(--acc)' : '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{tab.name}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{tab.rows} filas</div>
            </button>
          ))}
        </div>

        {showStats && <StatBar total={MOCK_ROWS.length} visible={filtered.length} filters={filterCount} />}

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--s1)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Buscar en la hoja…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          {[
            { label: 'Regex', val: regex, set: setRegex },
            { label: 'Excluir', val: exclude, set: setExclude },
          ].map((tog) => (
            <button
              key={tog.label}
              type="button"
              onClick={() => tog.set(!tog.val)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: `1px solid ${tog.val ? 'var(--acc)' : 'var(--border)'}`,
                background: tog.val ? 'var(--acc-dim)' : 'transparent',
                color: tog.val ? 'var(--acc-text)' : 'var(--muted)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tog.label}
            </button>
          ))}
        </div>

        {/* Chips */}
        <div style={{ padding: '8px 14px', background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Nivel
          </div>
          <FilterChips rows={MOCK_ROWS} active={nivelFilter} onChange={setNivelFilter} group="nivel" />
          <div style={{ fontSize: 10, color: 'var(--muted)', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Departamento
          </div>
          <FilterChips rows={MOCK_ROWS} active={deptFilter} onChange={setDeptFilter} group="dept" />
        </div>

        {/* Table / Pills preview */}
        <div className="shell-preview-table">
          {mode === 'table' ? (
            <table className="shell-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Depto</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{row.id}</td>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td>{row.role}</td>
                    <td>{row.dept}</td>
                    <td>{row.nivel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {filtered.map((row) => (
                <div
                  key={row.id}
                  style={{
                    background: 'var(--s1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'var(--acc-dim)',
                      color: 'var(--acc-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {row.initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: '6px 14px',
            background: 'var(--s1)',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {filtered.length} de {MOCK_ROWS.length} registros · {filterCount} filtro{filterCount !== 1 ? 's' : ''} activo{filterCount !== 1 ? 's' : ''}
        </div>
      </div>
    </DemoSection>
  );
}
