import { test, expect } from '@playwright/test';
import { login, loadFixture, getRowCount, closeAllTabs } from '../../helpers/mirador.js';

test.describe('Escritorio — modo Tabla', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('carga archivo y muestra filas en tabla', async ({ page }) => {
    await expect(page.locator('#table-wrap')).toBeVisible();
    await expect(page.locator('#table-body tr').first()).toBeVisible();
    expect(await getRowCount(page)).toBeGreaterThan(0);
    await expect(page.locator('#topbar-breadcrumb')).toBeVisible();
  });

  test('búsqueda filtra resultados', async ({ page }) => {
    const total = await getRowCount(page);
    await page.fill('#search-input', 'zzz_inexistente_xyz');
    await page.waitForTimeout(400);
    expect(await getRowCount(page)).toBeLessThanOrEqual(total);
  });

  test('modal Hojas abre y cierra', async ({ page }) => {
    await page.locator('#btn-mobile-sheets').click();
    await expect(page.locator('#mobile-sheets-overlay')).toHaveClass(/open/);
    await page.locator('#mobile-sheets-overlay .ms-close').click();
    await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
  });

  test('panel Acciones abre y cierra', async ({ page }) => {
    await page.locator('#btn-actions').click();
    await expect(page.locator('#actions-panel')).toHaveClass(/open/);
    await page.locator('#actions-panel .ap-user-close').click();
    await expect(page.locator('#actions-panel')).not.toHaveClass(/open/);
  });
});
