import { useMemo, useState } from 'react';
import { AVATAR_COLORS } from '../data/mockData.js';
import {
  VIEW_ROWS,
  filterBySearch,
  statusBadgeClass,
  statusDotClass,
} from '../data/chipViewData.js';
import { ChevronRightIcon, SearchIcon } from '../icons/index.jsx';
import { DemoSection } from '../components/DemoSection.jsx';

const MODES = [
  { id: 'cards', label: 'A — Tarjetas', tag: 'pocos campos clave' },
  { id: 'pills', label: 'B — Pills', tag: 'listas grandes' },
  { id: 'ficha', label: 'C — Ficha', tag: 'un registro a la vez' },
  { id: 'list', label: 'D — Lista compacta', tag: 'híbrido tabla/card' },
];

function ViewCards({ rows }) {
  return (
    <div className="views-cards-grid">
      {rows.map((r) => {
        const av = AVATAR_COLORS[r.status === 'active' ? 'blue' : r.status === 'leave' ? 'amber' : 'red'];
        return (
          <div key={r.id} className="views-card">
            <div className="views-card-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="views-card-avatar" style={{ background: av.bg, color: av.fg }}>
                  {r.initials}
                </div>
                <div>
                  <div className="views-card-title">{r.name}</div>
                  <div className="views-card-sub">{r.id}</div>
                </div>
              </div>
              <span className={statusBadgeClass(r.status)}>{r.statusLabel}</span>
            </div>
            <div className="views-card-fields">
              {[
                ['Cargo', r.role],
                ['Área', r.dept],
                ['Ingreso', r.ingreso],
              ].map(([k, v]) => (
                <div key={k} className="views-card-field">
                  <span className="views-card-field-key">{k}</span>
                  <span className="views-card-field-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ViewPills({ rows }) {
  return (
    <div className="views-pills-wrap">
      {rows.map((r) => (
        <div key={r.id} className="views-pill">
          <span className={`views-pill-dot ${statusDotClass(r.status)}`} />
          <span className="views-pill-name">{r.name}</span>
          <span className="views-pill-code">{r.id}</span>
        </div>
      ))}
    </div>
  );
}

function ViewFicha({ rows }) {
  const [index, setIndex] = useState(0);
  const row = rows[index] ?? rows[0];
  if (!row) return null;

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(rows.length - 1, i + 1));

  return (
    <div className="views-ficha-wrap">
      <div className="views-ficha-nav">
        <button type="button" className="views-ficha-nav-btn" onClick={prev} disabled={index === 0}>
          ◀ Anterior
        </button>
        <span className="views-ficha-counter">
          Registro {index + 1} de {rows.length}
        </span>
        <button type="button" className="views-ficha-nav-btn" onClick={next} disabled={index >= rows.length - 1}>
          Siguiente ▶
        </button>
      </div>
      <div className="views-ficha-header">
        <div className="views-ficha-avatar">{row.initials}</div>
        <div>
          <div className="views-ficha-name">{row.name}</div>
          <div className="views-ficha-role">
            {row.role} · {row.dept}
          </div>
        </div>
        <span className={statusBadgeClass(row.status)} style={{ marginLeft: 'auto' }}>
          {row.statusLabel}
        </span>
      </div>
      <div className="views-ficha-body">
        {[
          ['RUT', row.id],
          ['Cargo', row.role],
          ['Área', row.dept],
          ['Fecha ingreso', row.ingreso],
          ['Email', row.email],
        ].map(([k, v]) => (
          <div key={k} className="views-ficha-row">
            <span className="views-ficha-key">{k}</span>
            <span className="views-ficha-val">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewList({ rows }) {
  return (
    <>
      <div className="views-list-header">
        <span style={{ flex: 2 }}>NOMBRE</span>
        <span style={{ flex: 1 }}>CARGO</span>
        <span style={{ flex: 1 }}>ÁREA</span>
        <span style={{ width: 64, textAlign: 'center' }}>ESTADO</span>
      </div>
      <div className="views-list-wrap">
        {rows.map((r) => (
          <div key={r.id} className="views-list-item">
            <span className="views-list-col-main">{r.name}</span>
            <span className="views-list-col-sec">{r.role}</span>
            <span className="views-list-col-sec">{r.dept}</span>
            <span className="views-list-col-tag">
              <span className={statusBadgeClass(r.status)}>{r.statusLabel}</span>
            </span>
            <ChevronRightIcon />
          </div>
        ))}
      </div>
    </>
  );
}

export function ViewsSection() {
  const [mode, setMode] = useState('cards');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterBySearch(VIEW_ROWS, search), [search]);

  const activeMode = MODES.find((m) => m.id === mode);

  return (
    <DemoSection
      title="View Modes"
      description="Cuatro modos de vista alternativos a la tabla para búsqueda rápida — portados desde demo-views.html. Cambia el modo y filtra con la búsqueda compartida."
      changes="Selector de modo interactivo; ficha con navegación anterior/siguiente; badges de estado con tokens semánticos."
    >
      <div className="views-mode-picker">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`views-mode-btn${mode === m.id ? ' active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {activeMode && (
        <div className="views-mode-desc">
          {activeMode.label} <span>{activeMode.tag}</span>
        </div>
      )}

      <div className="views-search-bar">
        <SearchIcon size={16} />
        <input
          type="text"
          placeholder="Buscar persona, RUT, área…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="views-count">{filtered.length} registros</div>
      </div>

      {mode === 'cards' && <ViewCards rows={filtered} />}
      {mode === 'pills' && <ViewPills rows={filtered} />}
      {mode === 'ficha' && <ViewFicha rows={filtered} key={filtered.map((r) => r.id).join(',')} />}
      {mode === 'list' && <ViewList rows={filtered} />}
    </DemoSection>
  );
}
