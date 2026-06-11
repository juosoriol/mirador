import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  buildThemeGridHtml,
  findTheme,
  isLightThemeTop,
  readTheme,
  writeTheme,
} from '../../src/engine/theme-engine.js';

function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('theme catalog', () => {
  it('exposes the expected number of themes with palettes', () => {
    expect(THEMES.length).toBe(8);
    THEMES.forEach((t) => {
      expect(t.p).toHaveLength(4);
      expect(t.id).toBeTruthy();
    });
  });
});

describe('readTheme / writeTheme', () => {
  it('defaults when storage is empty and persists writes', () => {
    const storage = makeStorage();
    expect(readTheme(storage)).toBe(DEFAULT_THEME);
    writeTheme('verde', storage);
    expect(readTheme(storage)).toBe('verde');
  });
});

describe('findTheme', () => {
  it('finds by id and returns null when missing', () => {
    expect(findTheme('amber').label).toBe('Cálido arena ámbar');
    expect(findTheme('nope')).toBeNull();
  });
});

describe('isLightThemeTop', () => {
  it('detects light top colors', () => {
    expect(isLightThemeTop('#ffffff')).toBe(true);
    expect(isLightThemeTop('#ecfdf5')).toBe(true);
    expect(isLightThemeTop('#1e293b')).toBe(false);
  });
});

describe('buildThemeGridHtml', () => {
  it('marks the active theme and renders all entries', () => {
    const html = buildThemeGridHtml('dark');
    expect(html).toContain('activo');
    expect(html).toContain("applyTheme('dark')");
    expect(html).toContain("applyTheme('amber')");
  });
});
