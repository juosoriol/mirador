import { describe, expect, it } from 'vitest';
import {
  MOBILE_BREAKPOINT,
} from '../../src/engine/mobile-ui-engine.js';

describe('mobile breakpoint', () => {
  it('defines a reasonable breakpoint', () => {
    expect(MOBILE_BREAKPOINT).toBe(500);
  });

  it('arithmetic: typical keyboard gap is > 120px', () => {
    const windowHeight = 500;
    const vpHeight = 300;
    const gap = windowHeight - vpHeight;
    expect(gap).toBeGreaterThan(120);
  });
});



