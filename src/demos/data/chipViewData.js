export const CHIP_ROWS = [
  { id: '51915846', name: 'Sandra Ponce Zapata', role: 'Almacenista', initials: 'SP' },
  { id: '12915841', name: 'William Erazo Rodríguez', role: 'Asesor Comercial', initials: 'WE' },
  { id: '19256240', name: 'José Félix Bonells Rovira', role: 'Asesor Comercial', initials: 'JB' },
  { id: '39749503', name: 'Olga Lucía Niño Hernández', role: 'Asesor Comercial', initials: 'ON' },
  { id: '53081487', name: 'Carolina del Pilar Hernández V.', role: 'Coordinadora', initials: 'CH' },
  { id: '65726132', name: 'Gloria Esperanza Giraldo López', role: 'Asesor Comercial', initials: 'GG' },
  { id: '80756272', name: 'Alejandro Alfaro Murillo', role: 'Supervisor', initials: 'AA' },
  { id: '1010172202', name: 'José Manuel Sánchez Tamayo', role: 'Asesor Comercial', initials: 'JS' },
];

export const ROLE_COLORS = {
  Almacenista: { border: '#22c55e', bg: '#14532d22', fg: '#4ade80', dot: '#22c55e', av: '#14532d' },
  'Asesor Comercial': { border: '#f59e0b', bg: '#45130322', fg: '#fbbf24', dot: '#f59e0b', av: '#7c3aed' },
  Coordinadora: { border: '#3b82f6', bg: '#1e3a5f22', fg: '#60a5fa', dot: '#3b82f6', av: '#be123c' },
  Supervisor: { border: '#a855f7', bg: '#2e106522', fg: '#c084fc', dot: '#a855f7', av: '#059669' },
  Analista: { border: '#14b8a6', bg: '#134e4a22', fg: '#2dd4bf', dot: '#14b8a6', av: '#0e7490' },
  default: { border: '#475569', bg: '#1e293b', fg: '#94a3b8', dot: '#475569', av: '#2563eb' },
};

export function getRoleColor(role) {
  return ROLE_COLORS[role] ?? ROLE_COLORS.default;
}

export const VIEW_ROWS = [
  {
    id: '12.345.678-9',
    name: 'Juan Pérez',
    role: 'Analista',
    dept: 'Finanzas',
    status: 'active',
    statusLabel: 'Activo',
    initials: 'JP',
    ingreso: '12/03/2021',
    email: 'j.perez@empresa.cl',
  },
  {
    id: '9.876.543-2',
    name: 'María López',
    role: 'Gerente',
    dept: 'RRHH',
    status: 'active',
    statusLabel: 'Activo',
    initials: 'ML',
    ingreso: '05/07/2018',
    email: 'm.lopez@empresa.cl',
  },
  {
    id: '15.234.901-K',
    name: 'Carlos Ruiz',
    role: 'Contador',
    dept: 'Contabilidad',
    status: 'leave',
    statusLabel: 'Licencia',
    initials: 'CR',
    ingreso: '20/11/2019',
    email: 'c.ruiz@empresa.cl',
  },
  {
    id: '11.098.765-3',
    name: 'Ana Torres',
    role: 'Coordinadora',
    dept: 'Operaciones',
    status: 'inactive',
    statusLabel: 'Inactivo',
    initials: 'AT',
    ingreso: '14/01/2022',
    email: 'a.torres@empresa.cl',
  },
  {
    id: '8.432.100-7',
    name: 'Pedro Soto',
    role: 'Jefe de Área',
    dept: 'TI',
    status: 'active',
    statusLabel: 'Activo',
    initials: 'PS',
    ingreso: '03/09/2020',
    email: 'p.soto@empresa.cl',
  },
  {
    id: '13.567.890-1',
    name: 'Luis Díaz',
    role: 'Analista',
    dept: 'Finanzas',
    status: 'active',
    statusLabel: 'Activo',
    initials: 'LD',
    ingreso: '22/06/2021',
    email: 'l.diaz@empresa.cl',
  },
];

export function filterBySearch(rows, search) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.name, r.id, r.role, r.dept, r.initials].some((v) => String(v).toLowerCase().includes(q))
  );
}

export function statusBadgeClass(status) {
  if (status === 'active') return 'views-badge active';
  if (status === 'leave') return 'views-badge warn';
  return 'views-badge inactive';
}

export function statusDotClass(status) {
  if (status === 'active') return 'green';
  if (status === 'leave') return 'amber';
  return 'red';
}
