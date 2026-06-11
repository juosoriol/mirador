import { test, expect } from '@playwright/test';
import {
  login, loadFixture, enterPillsMode, exitPillsMode,
  closeAllTabs, expectEmptyState, getRowCount, FIXTURE_XLSX,
} from '../../helpers/mirador.js';

test.describe('Escritorio — modo Pills', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
    await enterPillsMode(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('muestra pills con registros', async ({ page }) => {
    await expect(page.locator('#pills-view')).toHaveClass(/open/);
    await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
    expect(await page.locator('#pills-toolbar-count').textContent()).toMatch(/registro/i);
    expect(await getRowCount(page)).toBeGreaterThan(0);
  });

  test('búsqueda en pills reduce resultados', async ({ page }) => {
    const total = await getRowCount(page);
    await page.fill('#pills-search-input', 'zzz_inexistente_xyz');
    await page.waitForTimeout(400);
    expect(await getRowCount(page)).toBeLessThanOrEqual(total);
  });

  test('cambiar pestaña recarga pills con spinner', async ({ page }) => {
    const firstCount = await getRowCount(page);
    const firstMain = await page.locator('#pills-grid [class*="mpill"]').first().textContent();
    await page.setInputFiles('#file-input', FIXTURE_XLSX);
    await page.locator('#loading').waitFor({ state: 'hidden', timeout: 60_000 });
    await page.locator('.tab').first().click();
    await page.waitForTimeout(800);
    await expect(page.locator('#pills-loading')).not.toHaveClass(/show/);
    expect(await getRowCount(page)).toBe(firstCount);
    const restoredMain = await page.locator('#pills-grid [class*="mpill"]').first().textContent();
    expect(restoredMain).toBe(firstMain);
  });

  test('recargar archivo muestra pills de nuevo', async ({ page }) => {
    const count = await getRowCount(page);
    await page.evaluate(() => reloadTab());
    await page.waitForTimeout(1500);
    expect(await getRowCount(page)).toBe(count);
    await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
  });

  test('volver a tabla oculta pills', async ({ page }) => {
    await exitPillsMode(page);
    await expect(page.locator('#table-wrap')).toBeVisible();
    await expect(page.locator('#pills-view')).not.toHaveClass(/open/);
  });

  test('cerrar última pestaña limpia pills y deja dropzone', async ({ page }) => {
    await closeAllTabs(page);
    await expectEmptyState(page);
  });
});
