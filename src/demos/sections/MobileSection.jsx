import { DemoSection } from '../components/DemoSection.jsx';
import { MobileCardsRedesign } from '../components/mobile/MobileCardsRedesign.jsx';
import { MobileFabRedesign } from '../components/mobile/MobileFabRedesign.jsx';
import { MobileV2BottomNav } from '../components/mobile/MobileV2BottomNav.jsx';

const VARIANTS = [
  {
    id: 'v2',
    label: 'v2 · Barra inferior',
    tag: 'propuesta actual',
    Component: MobileV2BottomNav,
    note: 'Búsqueda siempre visible, barra de filtros activos removibles, bottom nav con badge.',
  },
  {
    id: 'fab',
    label: 'Nuevo · FAB flotante',
    tag: 'más área de tabla',
    Component: MobileFabRedesign,
    note: 'Sin bottom nav — FAB con badge abre panel centrado. Barra resumen compacta bajo stats. Status bar al pie.',
  },
  {
    id: 'cards',
    label: 'Nuevo · Cards + chips',
    tag: 'touch-first',
    Component: MobileCardsRedesign,
    note: 'Header mínimo, búsqueda sticky, chips de nivel horizontales, lista tipo tarjeta con tap → detalle.',
  },
];

export function MobileSection() {
  return (
    <DemoSection
      title="Mobile"
      description="Tres propuestas de frontend móvil para Mirador. Cada teléfono es interactivo: prueba búsqueda, filtros y navegación."
      changes="v2 portado de demo-mobile-filters-v2; FAB y Cards son rediseños nuevos inspirados en demo-mobile-filters.html (variantes A) y exploración cards-first."
    >
      <div className="mob-variants-grid">
        {VARIANTS.map(({ id, label, tag, Component, note }) => (
          <div key={id} className="mob-variant-col">
            <div className="mob-variant-label">
              {label}
              <span>{tag}</span>
            </div>
            <Component />
            <p className="mob-variant-note">{note}</p>
          </div>
        ))}
      </div>
    </DemoSection>
  );
}
