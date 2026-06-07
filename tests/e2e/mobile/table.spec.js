import { test, expect } from '@playwright/test';
import { login, loadFixture, getRowCount, closeAllTabs } from '../../helpers/mirador.js';

test.describe('Móvil — modo Tabla', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('carga archivo y muestra tabla', async ({ page }) => {
    await expect(page.locator('#table-wrap')).toBeVisible();
    await expect(page.locator('#table-body tr').first()).toBeVisible();
    await expect(page.locator('#btn-pills-mode')).toBeVisible();
    expect(await getRowCount(page)).toBeGreaterThan(0);
  });

  test('botones móvil visibles', async ({ page }) => {
    await expect(page.locator('#btn-pills-mode')).toBeVisible();
    await expect(page.locator('#btn-mobile-sheets')).toBeVisible();
    await expect(page.locator('#topbar #btn-actions')).toBeHidden();
    await expect(page.locator('#mobile-bnav')).toBeVisible();
    await expect(page.locator('#mbnav-menu')).toBeVisible();
    await expect(page.locator('#mbnav-filters')).toBeVisible();
    await expect(page.locator('#btn-open-file')).toBeHidden();
    await expect(page.locator('#btn-my-docs')).toBeHidden();
  });

  test('modal Hojas abre en móvil', async ({ page }) => {
    await page.locator('#btn-mobile-sheets').click();
    await expect(page.locator('#mobile-sheets-overlay')).toHaveClass(/open/);
    await page.evaluate(() => closeMobileSheets());
    await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
  });
});
