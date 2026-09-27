import { test, expect } from '@playwright/test';
import { login, loadFixture, closeAllTabs } from '../../helpers/mirador.js';

const SHOTS = '.shots/filter-studio';

async function visibleCount(page) {
  return page.evaluate(() => window.T().filtered.length);
}

const METHOD_LABELS = { window: 'Ventana', drawer: 'Panel', smart: 'Barra' };

async function openFromSheet(page, method) {
  await page.locator('#mbnav-filters').tap();
  await expect(page.locator('#mobile-filter-overlay')).toHaveClass(/open/);
  await page.locator('#mf-btn-filter-studio').tap();
  await expect(page.locator('#mobile-filter-overlay')).not.toHaveClass(/open/);
  if (method !== 'window') {
    await page.locator('.fs-window .fs-switch button', { hasText: METHOD_LABELS[method] }).tap();
  }
}

test.describe('Móvil — nuevos filtros', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => window.closeFilterStudio?.());
    await closeAllTabs(page);
  });

  test('Ventana: columnas → valores a pantalla completa', async ({ page }) => {
    const total = await visibleCount(page);
    await openFromSheet(page, 'window');
    const win = page.locator('.fs-window');
    await expect(win).toHaveClass(/step-columns/);
    await page.screenshot({ path: `${SHOTS}/mobile-1-ventana-columnas.png` });
    await win.locator('.fs-col').filter({ hasNotText: '📅' }).nth(1).tap();
    await expect(win).toHaveClass(/step-values/);
    await win.locator('.fs-values .fs-check').first().tap();
    expect(await visibleCount(page)).toBeLessThan(total);
    await page.screenshot({ path: `${SHOTS}/mobile-1-ventana-valores.png` });
    await win.locator('.fs-back').tap();
    await expect(win).toHaveClass(/step-columns/);
  });

  test('Panel: hoja inferior con pills', async ({ page }) => {
    const total = await visibleCount(page);
    await openFromSheet(page, 'drawer');
    const drawer = page.locator('.fs-drawer');
    await expect(drawer).toBeVisible();
    await drawer.locator('.fs-facet.open .fs-pill').first().tap();
    expect(await visibleCount(page)).toBeLessThan(total);
    await page.screenshot({ path: `${SHOTS}/mobile-2-panel.png` });
  });

  test('Barra: buscador con sugerencias', async ({ page }) => {
    await openFromSheet(page, 'smart');
    const palette = page.locator('.fs-palette');
    await expect(palette).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/mobile-3-barra.png` });
    await palette.locator('.fs-palette-close').tap();
    await expect(palette).toBeHidden();
  });
});
