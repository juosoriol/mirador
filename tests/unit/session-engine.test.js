import { describe, expect, it } from 'vitest';
import {
  compactTabForSession,
  compactSheetCacheForSession,
  workbookIdbKey,
  DEFAULT_MAX_SESSION_ROWS,
  WORKBOOK_IDB_PREFIX,
} from '../../src/engine/session-engine.js';

describe('workbookIdbKey', () => {
  it('prefixes tab id for IndexedDB storage', () => {
    expect(workbookIdbKey('tab-3')).toBe(`${WORKBOOK_IDB_PREFIX}tab-3`);
  });
});

describe('compactTabForSession', () => {
  it('drops empty columns and caps row count', () => {
    const tab = {
      columns: ['A', 'B', 'C'],
      rawData: [
        { A: 1, B: '', C: null },
        { A: 2, B: '', C: null },
      ],
    };
    const maxRows = 1;
    const compact = compactTabForSession(tab, maxRows);
    expect(compact.columns).toEqual(['A']);
    expect(compact.rawData).toHaveLength(1);
    expect(compact.rawData[0]).toEqual({ A: 1 });
  });

  it('uses default max rows constant', () => {
    const tab = {
      columns: ['X'],
      rawData: Array.from({ length: DEFAULT_MAX_SESSION_ROWS + 5 }, (_, i) => ({ X: i })),
    };
    expect(compactTabForSession(tab).rawData).toHaveLength(DEFAULT_MAX_SESSION_ROWS);
  });
});

describe('compactSheetCacheForSession', () => {
  it('compacts each cached sheet entry', () => {
    const cache = {
      Hoja1: {
        columns: ['A', 'B'],
        rawData: [{ A: 1, B: '' }],
        dateColsDetected: ['Fecha'],
        _manualHdrRow: 2,
      },
    };
    const out = compactSheetCacheForSession(cache, 8000);
    expect(out.Hoja1.columns).toEqual(['A']);
    expect(out.Hoja1.rawData).toEqual([{ A: 1 }]);
    expect(out.Hoja1.dateColsDetected).toEqual(['Fecha']);
    expect(out.Hoja1._manualHdrRow).toBe(2);
  });
});
