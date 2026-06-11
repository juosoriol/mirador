import { useMemo, useState } from 'react';
import { SearchIcon } from '../icons/index.jsx';
import { CHIP_ROWS, filterBySearch, getRoleColor } from '../data/chipViewData.js';
import { DemoSection } from '../components/DemoSection.jsx';

function ChipSearch({ value, onChange }) {
  return (
    <div className="chips-search-bar">
      <SearchIcon size={16} />
      <input type="text" placeholder="Buscar…" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DesignA({ rows }) {
  return (
    <div className="chip-ca-wrap">
      {rows.map((r) => (
        <div key={r.id} className="chip-ca">
          <div className="chip-ca-name">{r.name}</div>
          <div className="chip-ca-id">{r.id}</div>
        </div>
      ))}
    </div>
  );
}

function DesignB({ rows }) {
  return (
    <div className="chip-cb-wrap">
      {rows.map((r) => {
        const c = getRoleColor(r.role);
        return (
          <div key={r.id} className="chip-cb" style={{ borderLeftColor: c.border }}>
            <div className="chip-cb-name">{r.name}</div>
            <div className="chip-cb-id">
              {r.id} · {r.role}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesignC({ rows }) {
  return (
    <div className="chip-cc-wrap">
      {rows.map((r) => {
        const c = getRoleColor(r.role);
        return (
          <div key={r.id} className="chip-cc" style={{ background: c.bg, borderColor: `${c.border}44` }}>
            <div className="chip-cc-name" style={{ color: c.fg }}>
              {r.name}
            </div>
            <div className="chip-cc-id" style={{ color: c.fg }}>
              {r.id}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesignD({ rows }) {
  const avColors = ['#14532d', '#7c3aed', '#0e7490', '#b45309', '#be123c', '#6d28d9', '#059669', '#2563eb'];
  return (
    <div className="chip-cd-wrap">
      {rows.map((r, i) => (
        <div key={r.id} className="chip-cd">
          <div className="chip-cd-av" style={{ background: avColors[i % avColors.length] }}>
            {r.initials}
          </div>
          <div className="chip-cd-body">
            <div className="chip-cd-name">{r.name}</div>
            <div className="chip-cd-id">{r.id}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DesignE({ rows }) {
  return (
    <div className="chip-ce-wrap">
      {rows.map((r) => {
        const c = getRoleColor(r.role);
        return (
          <div key={r.id} className="chip-ce">
            <div className="chip-ce-name">
              {r.name}{' '}
              <span className="chip-ce-id-inline">{r.id}</span>
            </div>
            <div className="chip-ce-badge" style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}44` }}>
              {r.role}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesignF({ rows }) {
  return (
    <div className="chip-cf-wrap">
      {rows.map((r) => {
        const c = getRoleColor(r.role);
        return (
          <div key={r.id} className="chip-cf" style={{ background: c.bg, borderColor: `${c.border}33` }}>
            <div className="chip-cf-dot" style={{ background: c.dot }} />
            <div className="chip-cf-name" style={{ color: c.fg }}>
              {r.name}
            </div>
            <div className="chip-cf-id" style={{ color: c.fg }}>
              {r.id}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesignG({ rows }) {
  return (
    <div className="chip-cg-wrap">
      {rows.map((r) => {
        const c = getRoleColor(r.role);
        return (
          <div key={r.id} className="chip-cg">
            <div className="chip-cg-name">{r.name}</div>
            <div className="chip-cg-meta" style={{ color: c.fg }}>
              {r.role} · {r.id}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DESIGNS = [
  { id: 'a', title: 'A · Pill redondeado', tag: 'nombre + cédula abajo', Component: DesignA, note: 'Nombre completo visible · Cédula debajo en gris · Click → ficha' },
  { id: 'b', title: 'B · Borde color izquierdo', tag: 'categoría por color', Component: DesignB, note: 'Borde izquierdo indica categoría · Cargo en subtexto gris' },
  { id: 'c', title: 'C · Fondo coloreado', tag: 'color por categoría', Component: DesignC, note: 'Fondo y texto del color de la categoría · Muy visual · Alta densidad' },
  { id: 'd', title: 'D · Avatar mini circular', tag: 'iniciales + color', Component: DesignD, note: 'Avatar determinista por nombre · Compacto · Doble info visible' },
  { id: 'e', title: 'E · Tag de estado/cargo', tag: 'badge derecha', Component: DesignE, note: 'Nombre + cédula en línea · Badge de cargo a la derecha' },
  { id: 'f', title: 'F · Fila ancho completo', tag: 'máxima legibilidad', Component: DesignF, note: 'Nombre completo · Cédula alineada derecha · Color categoría fondo + texto' },
  { id: 'g', title: 'G · Grid 2 columnas', tag: 'sin ID, solo nombre', Component: DesignG, note: '2 columnas · Nombre grande · Cargo + cédula en color abajo' },
];

export function ChipsSection() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterBySearch(CHIP_ROWS, search), [search]);

  return (
    <DemoSection
      title="Filter Chips"
      description="Siete diseños de chips para resultados de búsqueda y filtros activos — portados desde demo-chips.html. Cada variante optimiza densidad vs legibilidad."
      changes="Chips con tokens del tema activo; búsqueda en vivo compartida; color por cargo en variantes B/C/E/F/G."
    >
      {DESIGNS.map(({ id, title, tag, Component, note }) => (
        <div key={id} className="pills-design-block">
          <div className="pills-design-title">
            {title}
            <span>{tag}</span>
          </div>
          <ChipSearch value={search} onChange={setSearch} />
          <Component rows={filtered} />
          <div className="demo-design-note">{note}</div>
        </div>
      ))}
    </DemoSection>
  );
}
