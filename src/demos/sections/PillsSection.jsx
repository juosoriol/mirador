import { useState } from 'react';
import { AVATAR_COLORS, MOCK_ROWS, STATUS_COLORS } from '../data/mockData.js';
import { ChevronRightIcon, CloseIcon } from '../icons/index.jsx';
import { DemoSection } from '../components/DemoSection.jsx';

function FichaDrawer({ row, onClose }) {
  if (!row) return null;
  const colors = AVATAR_COLORS[row.color] ?? AVATAR_COLORS.blue;

  return (
    <div className="ficha-overlay" onClick={onClose}>
      <div className="ficha-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ficha-nav">
          <button type="button" className="ficha-nav-btn" onClick={onClose}>
            ← Anterior
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ficha de detalle</span>
          <button type="button" className="ficha-nav-btn" onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="ficha-header">
          <div className="ficha-avatar" style={{ background: colors.bg, color: colors.fg }}>
            {row.initials}
          </div>
          <div>
            <div className="ficha-name">{row.name}</div>
            <div className="ficha-role">
              {row.role} · {row.dept}
            </div>
          </div>
        </div>
        <div className="ficha-body">
          {[
            ['Cédula', row.id],
            ['Cargo', row.role],
            ['Departamento', row.dept],
            ['Nivel', row.nivel],
            ['Estado', row.statusLabel],
            ['Puntaje', row.score],
          ].map(([key, val]) => (
            <div key={key} className="ficha-row">
              <span className="ficha-key">{key}</span>
              <span className="ficha-val">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PillCardD1({ row, onClick }) {
  const c = AVATAR_COLORS[row.color] ?? AVATAR_COLORS.blue;
  return (
    <div className="pill-d1" onClick={() => onClick(row)}>
      <div className="pill-d1-avatar" style={{ background: c.bg, color: c.fg }}>
        {row.initials}
      </div>
      <div className="pill-d1-body">
        <div className="pill-d1-id">CC · {row.id}</div>
        <div className="pill-d1-name">{row.name}</div>
        <div className="pill-d1-meta">
          {row.role} · {row.dept}
        </div>
      </div>
      <div className="pill-d1-badge">{row.statusLabel}</div>
    </div>
  );
}

function PillCardD2({ row, index, onClick }) {
  return (
    <div className="pill-d2" onClick={() => onClick(row)}>
      <div className="pill-d2-num">{index + 1}</div>
      <div className="pill-d2-dot" style={{ background: STATUS_COLORS[row.status] ?? STATUS_COLORS.active }} />
      <div className="pill-d2-id">{row.id}</div>
      <div className="pill-d2-name">{row.name}</div>
      <div className="pill-d2-tag">{row.role}</div>
      <ChevronRightIcon />
    </div>
  );
}

function PillCardD3({ row, onClick }) {
  return (
    <div className="pill-d3-chip" onClick={() => onClick(row)}>
      <div className="pill-d3-dot" style={{ background: STATUS_COLORS[row.status] ?? STATUS_COLORS.active }} />
      <span className="pill-d3-id">{row.id}</span>
      <span className="pill-d3-name">{row.name.split(' ')[0]}</span>
    </div>
  );
}

function PillCardD4({ row, onClick }) {
  const statusBg =
    row.status === 'active' ? 'rgba(34,197,94,0.15)' : row.status === 'vacation' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  const statusColor =
    row.status === 'active' ? '#4ade80' : row.status === 'vacation' ? '#fbbf24' : '#f87171';

  return (
    <div className="pill-d4" onClick={() => onClick(row)}>
      <div className="pill-d4-header">
        <div className="pill-d4-status" style={{ background: statusBg, color: statusColor }}>
          {row.statusLabel}
        </div>
      </div>
      <div className="pill-d4-name">{row.name}</div>
      <div className="pill-d4-id">{row.id}</div>
      <div className="pill-d4-divider" />
      <div className="pill-d4-row">
        <span className="pill-d4-label">Cargo</span>
        <span className="pill-d4-val">{row.role}</span>
      </div>
      <div className="pill-d4-row">
        <span className="pill-d4-label">Depto</span>
        <span className="pill-d4-val">{row.dept}</span>
      </div>
    </div>
  );
}

function PillCardD5({ row, onClick }) {
  const c = AVATAR_COLORS[row.color] ?? AVATAR_COLORS.blue;
  return (
    <div className="pill-d5-item" onClick={() => onClick(row)}>
      <div className="pill-d5-circle" style={{ background: c.bg, color: c.fg }}>
        {row.initials}
      </div>
      <div>
        <div className="pill-d5-name">{row.name}</div>
        <div className="pill-d5-meta">
          {row.role} · {row.dept}
        </div>
        <div className="pill-d5-tags">
          <span className="pill-d5-tag">{row.nivel}</span>
          <span className="pill-d5-tag">{row.statusLabel}</span>
        </div>
      </div>
    </div>
  );
}

function PillCardD6({ row, onClick }) {
  const c = AVATAR_COLORS[row.color] ?? AVATAR_COLORS.blue;
  return (
    <div className="pill-d6" onClick={() => onClick(row)}>
      <div className="pill-d6-banner" style={{ background: `linear-gradient(135deg, ${c.bg}, var(--s2))` }} />
      <div className="pill-d6-avatar-wrap">
        <div className="pill-d6-avatar" style={{ background: c.bg, color: c.fg }}>
          {row.initials}
        </div>
      </div>
      <div className="pill-d6-body">
        <div className="pill-d6-name">{row.name}</div>
        <div className="pill-d6-id">{row.id}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill-d5-tag">{row.role}</span>
          <span className="pill-d5-tag">{row.dept}</span>
        </div>
      </div>
    </div>
  );
}

function PillCardD7({ rows, onClick }) {
  return (
    <div className="pill-d7-wrap">
      {rows.slice(0, 4).map((row) => (
        <div key={row.id} className="pill-d7-card" onClick={() => onClick(row)}>
          <div className="pill-d7-glyph">{row.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pill-d7-name" style={{ fontSize: 14, fontWeight: 600 }}>
              {row.name}
            </div>
            <div className="pill-d7-sub" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {row.role}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="pill-d7-num">{row.score}</div>
            <div className="pill-d7-label">pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DESIGNS = [
  { id: 'd1', title: 'Diseño 1 · ID Card', tag: 'actual mejorado', render: (rows, onClick) => (
    <div className="pills-grid-2">{rows.slice(0, 4).map((r) => <PillCardD1 key={r.id} row={r} onClick={onClick} />)}</div>
  )},
  { id: 'd2', title: 'Diseño 2 · Lista compacta', tag: 'máxima densidad', render: (rows, onClick) => (
    <div className="pills-grid-1">{rows.slice(0, 5).map((r, i) => <PillCardD2 key={r.id} row={r} index={i} onClick={onClick} />)}</div>
  )},
  { id: 'd3', title: 'Diseño 3 · Chips', tag: 'compacto', render: (rows, onClick) => (
    <div className="pills-chips-wrap">{rows.slice(0, 8).map((r) => <PillCardD3 key={r.id} row={r} onClick={onClick} />)}</div>
  )},
  { id: 'd4', title: 'Diseño 4 · Kanban', tag: 'estado visible', render: (rows, onClick) => (
    <div className="pills-grid-2">{rows.slice(0, 4).map((r) => <PillCardD4 key={r.id} row={r} onClick={onClick} />)}</div>
  )},
  { id: 'd5', title: 'Diseño 5 · Timeline', tag: 'lista vertical', render: (rows, onClick) => (
    <div className="pills-grid-1">{rows.slice(0, 4).map((r) => <PillCardD5 key={r.id} row={r} onClick={onClick} />)}</div>
  )},
  { id: 'd6', title: 'Diseño 6 · Photo Card', tag: 'visual', render: (rows, onClick) => (
    <div className="pills-grid-2">{rows.slice(0, 4).map((r) => <PillCardD6 key={r.id} row={r} onClick={onClick} />)}</div>
  )},
  { id: 'd7', title: 'Diseño 7 · Glass', tag: 'glassmorphism', render: (rows, onClick) => (
    <PillCardD7 rows={rows} onClick={onClick} />
  )},
];

export function PillsSection() {
  const [selected, setSelected] = useState(null);

  return (
    <DemoSection
      title="Pills / Cards"
      description="Siete layouts de tarjetas portados desde demo-pills-designs.html. Haz clic en cualquier tarjeta para abrir la ficha de detalle."
      changes="Componentes React reutilizables; hover y colores respetan el tema activo; ficha como drawer animado."
    >
      {DESIGNS.map((design) => (
        <div key={design.id} className="pills-design-block">
          <div className="pills-design-title">
            {design.title}
            <span>{design.tag}</span>
          </div>
          {design.render(MOCK_ROWS, setSelected)}
        </div>
      ))}

      <FichaDrawer row={selected} onClose={() => setSelected(null)} />
    </DemoSection>
  );
}
