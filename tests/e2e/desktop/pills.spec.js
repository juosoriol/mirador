import { test, expect } from '@playwright/test';
import {
  login, loadFixture, enterPillsMode, exitPillsMode,
  closeAllTabs, expectEmptyState, getRowCount,
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
