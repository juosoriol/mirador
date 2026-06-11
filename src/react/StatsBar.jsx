import { memo } from 'react';

function StatsBarInner() {
  return <div id="stats-bar" />;
}

/** core.js fills innerHTML via updateStats(). */
export const StatsBar = memo(StatsBarInner);
