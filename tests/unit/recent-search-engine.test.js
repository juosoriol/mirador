import { describe, expect, it } from 'vitest';
import {
  RECENT_SEARCH_MAX,
  addRecentSearchEntry,
  computeRecentSearchOpacity,
  deleteRecentSearchAt,
  getRecentSearchChipStyle,
  isRecentSearchEnabled,
  parseRecentSearchesJson,
  setRecentSearchEnabled,
} from '../../src/engine/recent-search-engine.js';

describe('parseRecentSearchesJson', () => {
  it('parses valid JSON and falls back on invalid', () => {
    expect(parseRecentSearchesJson('[{"q":"a"}]')).toEqual([{ q: 'a' }]);
    expect(parseRecentSearchesJson('not-json')).toEqual([]);
    expect(parseRecentSearchesJson(null)).toEqual([]);
  });
});

describe('addRecentSearchEntry', () => {
  it('deduplicates, prepends, and caps at max entries', () => {
    const base = [{ q: 'old', ts: 1, color: 0 }];
    const next = addRecentSearchEntry(base, 'new', 100);
    expect(next[0].q).toBe('new');
    expect(next[1].q).toBe('old');

    const deduped = addRecentSearchEntry([{ q: 'ab', ts: 1, color: 0 }], 'ab', 2);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].ts).toBe(2);

    let arr = [];
    for (let i = 0; i < RECENT_SEARCH_MAX + 3; i++) {
      arr = addRecentSearchEntry(arr, `q${i}`, i);
    }
    expect(arr).toHaveLength(RECENT_SEARCH_MAX);
  });

  it('ignores short queries', () => {
    expect(addRecentSearchEntry([], 'a')).toEqual([]);
  });
});

describe('deleteRecentSearchAt', () => {
  it('removes entry by index', () => {
    const arr = [{ q: 'a' }, { q: 'b' }];
    deleteRecentSearchAt(arr, 0);
    expect(arr).toEqual([{ q: 'b' }]);
  });
});

describe('computeRecentSearchOpacity', () => {
  it('fades over 48 hours with minimum opacity', () => {
    expect(computeRecentSearchOpacity(1000, 1000)).toBe(1);
    const half = computeRecentSearchOpacity(0, 86400000);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
    expect(computeRecentSearchOpacity(0, 172800000)).toBe(0.15);
  });
});

describe('recent search enabled flag', () => {
  it('defaults to enabled and respects storage', () => {
    const storage = {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = v;
      },
    };
    expect(isRecentSearchEnabled(storage)).toBe(true);
    setRecentSearchEnabled(false, storage);
    expect(isRecentSearchEnabled(storage)).toBe(false);
  });
});

describe('getRecentSearchChipStyle', () => {
  it('returns palette entry by color index', () => {
    const style = getRecentSearchChipStyle({ color: 2 });
    expect(style.text).toMatch(/^#/);
  });
});
