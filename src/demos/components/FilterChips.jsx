import { countByField } from '../data/mockData.js';

export function FilterChips({ rows, active, onChange, group }) {
  const options = group === 'nivel'
    ? ['Asistencial', 'Profesional', 'Directivo']
    : group === 'dept'
      ? ['Ventas', 'Administrativo', 'Planta Norte', 'Bodega', 'TI']
      : ['ACTIVO', 'VACACIÓN', 'LICENCIA'];

  const field = group === 'status' ? 'statusLabel' : group;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const count = countByField(rows, field, opt);
        const isActive = active === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(isActive ? null : opt)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid ${isActive ? 'var(--chip-active-border)' : 'var(--border)'}`,
              background: isActive ? 'var(--chip-active-bg)' : 'var(--s2)',
              color: isActive ? 'var(--chip-active-text)' : 'var(--text)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {opt}
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--s3)',
                color: isActive ? 'inherit' : 'var(--muted)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
