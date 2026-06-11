import { useMemo, useState } from 'react';

export const MOBILE_ROWS = [
  { nombre: 'María García López', cargo: 'Coordinadora', nivel: 'Directivo', initials: 'MG' },
  { nombre: 'Juan Rodríguez Morales', cargo: 'Operario', nivel: 'Asistencial', initials: 'JR' },
  { nombre: 'Lucía Pérez Castillo', cargo: 'Analista', nivel: 'Profesional', initials: 'LP' },
  { nombre: 'Carlos Hernández', cargo: 'Supervisor', nivel: 'Directivo', initials: 'CH' },
  { nombre: 'Ana Vargas Niño', cargo: 'Auxiliar', nivel: 'Asistencial', initials: 'AV' },
  { nombre: 'Pedro Salazar Ruiz', cargo: 'Asesor Comercial', nivel: 'Profesional', initials: 'PS' },
  { nombre: 'Gloria Esperanza Giraldo', cargo: 'Coordinadora', nivel: 'Directivo', initials: 'GG' },
  { nombre: 'Alejandro Alfaro Murillo', cargo: 'Supervisor', nivel: 'Directivo', initials: 'AA' },
  { nombre: 'Carolina del Pilar Hernández', cargo: 'Director Técnico', nivel: 'Directivo', initials: 'CH' },
  { nombre: 'José Manuel Sánchez', cargo: 'Asesor Comercial', nivel: 'Profesional', initials: 'JS' },
  { nombre: 'María Fernanda Ruiz', cargo: 'Analista', nivel: 'Profesional', initials: 'MR' },
  { nombre: 'William Erazo Rodríguez', cargo: 'Almacenista', nivel: 'Asistencial', initials: 'WE' },
];

export const MOBILE_CHIP_OPTIONS = {
  nivel: ['Asistencial', 'Profesional', 'Directivo'],
  cargo: ['Coordinadora', 'Operario', 'Analista', 'Supervisor', 'Asesor Comercial', 'Director Técnico', 'Almacenista'],
};

export function useMobileFilters(rows = MOBILE_ROWS) {
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState(null);
  const [chipCol, setChipCol] = useState(null);
  const [regex, setRegex] = useState(false);
  const [exclude, setExclude] = useState(false);
  const [col, setCol] = useState('');

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const hay = [row.nombre, row.cargo, row.nivel].join(' ').toLowerCase();
        let hit = false;
        if (regex) {
          try {
            hit = new RegExp(q, 'i').test(col ? String(row[col] || '') : hay);
          } catch {
            hit = false;
          }
        } else {
          hit = col ? String(row[col] || '').toLowerCase().includes(q) : hay.includes(q);
        }
        if (exclude ? hit : !hit) return false;
      }
      if (chip && chipCol && row[chipCol] !== chip) return false;
      return true;
    });
  }, [rows, search, chip, chipCol, regex, exclude, col]);

  const advCount = [chip, regex, exclude, col].filter(Boolean).length;
  const totalFilt = advCount + (search.trim() ? 1 : 0);

  const clearAll = () => {
    setSearch('');
    setChip(null);
    setChipCol(null);
    setRegex(false);
    setExclude(false);
    setCol('');
  };

  const removeFilter = (key) => {
    if (key === 'live') setSearch('');
    if (key === 'chip') {
      setChip(null);
      setChipCol(null);
    }
    if (key === 'regex') setRegex(false);
    if (key === 'excl') setExclude(false);
    if (key === 'col') setCol('');
  };

  const toggleChip = (colName, value) => {
    if (chip === value && chipCol === colName) {
      setChip(null);
      setChipCol(null);
    } else {
      setChip(value);
      setChipCol(colName);
    }
  };

  return {
    search,
    setSearch,
    chip,
    setChip,
    chipCol,
    setChipCol,
    regex,
    setRegex,
    exclude,
    setExclude,
    col,
    setCol,
    filtered,
    advCount,
    totalFilt,
    clearAll,
    removeFilter,
    toggleChip,
  };
}

export const NIVEL_COLORS = {
  Asistencial: { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80', dot: '#22c55e' },
  Profesional: { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa', dot: '#3b82f6' },
  Directivo: { bg: 'rgba(168,85,247,0.15)', fg: '#c084fc', dot: '#a855f7' },
};

export function getNivelColor(nivel) {
  return NIVEL_COLORS[nivel] ?? NIVEL_COLORS.Profesional;
}
