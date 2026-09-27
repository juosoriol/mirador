import { test, expect } from '@playwright/test';
import { login, loadFixture, getRowCount, closeAllTabs } from '../../helpers/mirador.js';

const SHOTS = '.shots/filter-studio';

async function visibleCount(page) {
  return page.evaluate(() => window.T().filtered.length);
}

test.describe('Escritorio — nuevos filtros', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
    await page.evaluate(() => localStorage.removeItem('mirador_filter_ui'));
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => window.closeFilterStudio?.());
    await closeAllTabs(page);
  });

  test('Ventana central filtra por valor de columna', async ({ page }) => {
    const total = await visibleCount(page);
    await page.locator('#btn-filter-studio').click();
    const win = page.locator('.fs-window');
    await expect(win).toBeVisible();
    await win.locator('.fs-values .fs-check input').first().check();
    await expect(win.locator('.fs-token')).toHaveCount(1);
    expect(await visibleCount(page)).toBeLessThan(total);
    await page.screenshot({ path: `${SHOTS}/desktop-1-ventana.png` });
    await win.locator('.fs-btn.primary').click();
    await expect(win).toBeHidden();
    await expect(page.locator('#chips-bar .chip.active')).toHaveCount(1);
    expect(await getRowCount(page)).toBeGreaterThan(0);
  });

  test('Panel lateral alterna pills', async ({ page }) => {
    const total = await visibleCount(page);
    await page.evaluate(() => window.openFilterStudio('drawer'));
    const drawer = page.locator('.fs-drawer');
    await expect(drawer).toBeVisible();
    const pill = drawer.locator('.fs-facet.open .fs-pill').first();
    await pill.click();
    await expect(pill).toHaveClass(/on/);
    expect(await visibleCount(page)).toBeLessThan(total);
    await page.screenshot({ path: `${SHOTS}/desktop-2-panel.png` });
    await drawer.locator('.fs-token-x').first().click();
    expect(await visibleCount(page)).toBe(total);
  });

  test('Barra inteligente con Ctrl+K y teclado', async ({ page }) => {
    const total = await visibleCount(page);
    await page.keyboard.press('Control+k');
    const palette = page.locator('.fs-palette');
    await expect(palette).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/desktop-3-barra-inicio.png` });
    const col = await page.evaluate(() => {
      const tab = window.T();
      return tab.columns.find((c) => {
        const u = tab.colUniques?.[c]?.size || 0;
        return u > 1 && u <= 30 && !tab.dateColsDetected.includes(c);
      });
    });
    await palette.locator('input').fill(`${col.slice(0, 4)}: `);
    await expect(palette.locator('.fs-sug').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-3-barra-sugerencias.png` });
    await page.keyboard.press('Enter');
    await expect(palette.locator('.fs-token')).toHaveCount(1);
    expect(await visibleCount(page)).toBeLessThan(total);
    await palette.locator('input').press('Backspace');
    await expect(palette.locator('.fs-token')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('el estilo elegido se recuerda', async ({ page }) => {
    await page.locator('#btn-filter-studio').click();
    await page.locator('.fs-switch button', { hasText: 'Panel' }).click();
    await expect(page.locator('.fs-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#btn-filter-studio').click();
    await expect(page.locator('.fs-drawer')).toBeVisible();
  });
});
