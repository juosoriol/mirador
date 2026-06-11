export function StatBar({ total, visible, filters }) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s1)',
      }}
    >
      {[
        { label: 'Total', value: total },
        { label: 'Visibles', value: visible },
        { label: 'Filtros', value: filters },
      ].map((stat, i, arr) => (
        <div
          key={stat.label}
          style={{
            flex: 1,
            padding: '8px 14px',
            textAlign: 'center',
            borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {stat.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--acc-text)', marginTop: 2 }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
