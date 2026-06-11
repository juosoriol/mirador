import { memo } from 'react';

function ChipDropdownInner() {
  return <div id="chip-dropdown" />;
}

/** Static shell — core.js renders filter panel HTML into #chip-dropdown. */
export const ChipDropdown = memo(ChipDropdownInner);
