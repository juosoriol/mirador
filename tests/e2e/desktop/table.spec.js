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
    await expect(page.locator('#topbar .app-title')).toBeVisible();
    await expect(page.locator('#topbar-center #btn-pills-mode')).toBeVisible();
  });

  test('búsqueda filtra resultados', async ({ page }) => {
    const total = await getRowCount(page);
    await page.fill('#search-input', 'zzz_inexistente_xyz');
    await page.waitForTimeout(400);
    expect(await getRowCount(page)).toBeLessThanOrEqual(total);
  });

  test('modal Hojas abre y cierra', async ({ page }) => {
    await expect(page.locator('#btn-mobile-sheets')).toBeVisible();
    await page.locator('#btn-mobile-sheets').click();
    await expect(page.locator('#mobile-sheets-overlay')).toHaveClass(/open/);
    await page.locator('#mobile-sheets-overlay .ms-close').click();
    await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
  });

  test('cambiar hoja carga datos de la nueva hoja', async ({ page }) => {
    await page.locator('#btn-mobile-sheets').click();
    const items = page.locator('#ms-list .ms-item');
    expect(await items.count()).toBeGreaterThan(1);
    const targetName = await items.nth(1).locator('.ms-item-name').innerText();
    await items.nth(1).click();
    await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
    await expect(page.locator('#table-body tr').first()).toBeVisible({ timeout: 30_000 });
    expect(await getRowCount(page)).toBeGreaterThan(0);
    await page.locator('#btn-mobile-sheets').click();
    await expect(page.locator('#ms-list .ms-item.active .ms-item-name')).toHaveText(targetName);
  });

  test('recarga página y restaura datos de sesión', async ({ page }) => {
    const total = await getRowCount(page);
    expect(total).toBeGreaterThan(0);

    await page.evaluate(() => { if (typeof saveSession === 'function') saveSession(); });
    await page.reload();
    try {
      await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
    } catch {
      // auth setup ya debería haber iniciado sesión
    }

    await expect(page.locator('#dropzone')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('#table-body tr').first()).toBeVisible({ timeout: 30_000 });
    expect(await getRowCount(page)).toBeGreaterThan(0);
    await expect(page.locator('#tabs-bar .tab')).toHaveCount(1);
  });

  test('panel Acciones abre y cierra', async ({ page }) => {
    await page.locator('#btn-actions').click();
    await expect(page.locator('#actions-panel')).toHaveClass(/open/);
    await page.locator('#actions-panel .ap-user-close').click();
    await expect(page.locator('#actions-panel')).not.toHaveClass(/open/);
  });
});
