export const AVATAR_COLORS = {
  blue: { bg: '#1e3a5f', fg: '#60a5fa' },
  green: { bg: '#14532d', fg: '#4ade80' },
  amber: { bg: '#451a03', fg: '#fbbf24' },
  red: { bg: '#450a0a', fg: '#f87171' },
  purple: { bg: '#2e1065', fg: '#c084fc' },
  sky: { bg: '#0c4a6e', fg: '#38bdf8' },
  teal: { bg: '#134e4a', fg: '#2dd4bf' },
  rose: { bg: '#4c0519', fg: '#fb7185' },
};

export const STATUS_COLORS = {
  active: '#22c55e',
  vacation: '#f59e0b',
  leave: '#ef4444',
};

export const MOCK_ROWS = [
  {
    id: '10234567',
    name: 'María García López',
    role: 'Coordinadora',
    dept: 'Planta Norte',
    nivel: 'Directivo',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'MG',
    color: 'blue',
    score: 94,
  },
  {
    id: '87654321',
    name: 'Juan Rodríguez Morales',
    role: 'Operario',
    dept: 'Bodega',
    nivel: 'Asistencial',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'JR',
    color: 'green',
    score: 88,
  },
  {
    id: '30123456',
    name: 'Lucía Pérez Castillo',
    role: 'Analista',
    dept: 'Administrativo',
    nivel: 'Profesional',
    status: 'vacation',
    statusLabel: 'VACACIÓN',
    initials: 'LP',
    color: 'amber',
    score: 91,
  },
  {
    id: '50987654',
    name: 'Carlos Hernández',
    role: 'Supervisor',
    dept: 'Turno B',
    nivel: 'Directivo',
    status: 'leave',
    statusLabel: 'LICENCIA',
    initials: 'CH',
    color: 'red',
    score: 76,
  },
  {
    id: '22334455',
    name: 'Ana Vargas Niño',
    role: 'Auxiliar',
    dept: 'Planta Sur',
    nivel: 'Asistencial',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'AV',
    color: 'purple',
    score: 85,
  },
  {
    id: '66778899',
    name: 'Pedro Salazar Ruiz',
    role: 'Asesor Comercial',
    dept: 'Ventas',
    nivel: 'Profesional',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'PS',
    color: 'sky',
    score: 92,
  },
  {
    id: '11223344',
    name: 'Gloria Esperanza Giraldo',
    role: 'Coordinadora',
    dept: 'Comercial',
    nivel: 'Directivo',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'GG',
    color: 'teal',
    score: 89,
  },
  {
    id: '99887766',
    name: 'Alejandro Alfaro Murillo',
    role: 'Supervisor',
    dept: 'Operaciones',
    nivel: 'Directivo',
    status: 'vacation',
    statusLabel: 'VACACIÓN',
    initials: 'AA',
    color: 'rose',
    score: 87,
  },
  {
    id: '55443322',
    name: 'Carolina del Pilar Hernández',
    role: 'Director Técnico',
    dept: 'TI',
    nivel: 'Directivo',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'CH',
    color: 'blue',
    score: 96,
  },
  {
    id: '77889900',
    name: 'José Manuel Sánchez',
    role: 'Asesor Comercial',
    dept: 'Ventas',
    nivel: 'Profesional',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'JS',
    color: 'green',
    score: 83,
  },
  {
    id: '33445566',
    name: 'María Fernanda Ruiz',
    role: 'Analista',
    dept: 'Finanzas',
    nivel: 'Profesional',
    status: 'active',
    statusLabel: 'ACTIVO',
    initials: 'MR',
    color: 'amber',
    score: 90,
  },
  {
    id: '88776655',
    name: 'William Erazo Rodríguez',
    role: 'Almacenista',
    dept: 'Logística',
    nivel: 'Asistencial',
    status: 'leave',
    statusLabel: 'LICENCIA',
    initials: 'WE',
    color: 'purple',
    score: 79,
  },
];

export const MOCK_TABS = [
  { id: 'tab1', name: 'Vacantes DPSA 2025', rows: 918, active: true },
  { id: 'tab2', name: 'Personal Q1', rows: 412, active: false },
  { id: 'tab3', name: 'Inventario', rows: 156, active: false },
];

export const FILTER_CHIPS = {
  nivel: ['Asistencial', 'Profesional', 'Directivo'],
  dept: ['Ventas', 'Administrativo', 'Planta Norte', 'Bodega', 'TI'],
  status: ['ACTIVO', 'VACACIÓN', 'LICENCIA'],
};

export function countByField(rows, field, value) {
  return rows.filter((r) => {
    if (field === 'status') return r.statusLabel === value;
    return r[field] === value;
  }).length;
}

export function filterRows(rows, { search = '', dept = null, nivel = null, status = null, regex = false, exclude = false }) {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (dept && row.dept !== dept) return false;
    if (nivel && row.nivel !== nivel) return false;
    if (status && row.statusLabel !== status) return false;
    if (!q) return true;
    const hay = [row.name, row.role, row.dept, row.id, row.nivel].join(' ').toLowerCase();
    let hit = false;
    if (regex) {
      try {
        hit = new RegExp(q, 'i').test(hay);
      } catch {
        hit = false;
      }
    } else {
      hit = hay.includes(q);
    }
    return exclude ? !hit : hit;
  });
}

export function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
