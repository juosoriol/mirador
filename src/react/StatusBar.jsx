import { memo } from 'react';

function StatusBarInner() {
  return (
    <div id="statusbar">
      <span>
        Total: <span className="sv" id="st-total">0</span>
      </span>
      <span>
        Visibles: <span className="sv" id="st-vis">0</span>
      </span>
      <span>
        Sel: <span className="sv" id="st-sel">0</span>
      </span>
    </div>
  );
}

export const StatusBar = memo(StatusBarInner);
