import { TableIcon, PillsIcon } from '../icons/index.jsx';

export function SegmentedToggle({ mode, onChange, compact = false }) {
  return (
    <button
      type="button"
      className="demo-seg-toggle"
      onClick={() => onChange(mode === 'table' ? 'pills' : 'table')}
      title="Alternar vista Tabla / Pills"
      style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 18,
        padding: 3,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 0 : 5,
          padding: compact ? '6px 10px' : '5px 12px',
          borderRadius: 14,
          fontSize: 11,
          fontWeight: 600,
          background: mode === 'table' ? 'rgba(255,255,255,0.14)' : 'transparent',
          color: mode === 'table' ? '#fff' : 'rgba(255,255,255,0.4)',
        }}
      >
        <TableIcon size={12} />
        {!compact && 'Tabla'}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 0 : 5,
          padding: compact ? '6px 10px' : '5px 12px',
          borderRadius: 14,
          fontSize: 11,
          fontWeight: 600,
          background: mode === 'pills' ? 'rgba(255,255,255,0.14)' : 'transparent',
          color: mode === 'pills' ? '#fff' : 'rgba(255,255,255,0.4)',
        }}
      >
        <PillsIcon size={12} />
        {!compact && 'Pills'}
      </span>
    </button>
  );
}
