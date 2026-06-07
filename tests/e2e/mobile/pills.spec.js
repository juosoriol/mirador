import { test, expect } from '@playwright/test';
import {
  login, loadFixture, enterPillsMode, closeAllTabs, expectEmptyState,
} from '../../helpers/mirador.js';

test.describe('Móvil — modo Pills', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
    await enterPillsMode(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('pills visibles con toggle en topbar', async ({ page }) => {
    await expect(page.locator('#btn-pills-mode')).toBeVisible();
    await expect(page.locator('#pills-view')).toHaveClass(/open/);
    await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
  });

  test('barra inferior abre panel de filtros', async ({ page }) => {
    await expect(page.locator('#mobile-bnav')).toBeVisible();
    await page.locator('#mbnav-filters').click();
    await expect(page.locator('#mobile-filter-overlay')).toHaveClass(/open/);
    await expect(page.locator('#mf-chips-host .chip').first()).toBeVisible();
    await page.evaluate(() => closeMobileFilterSheet());
    await expect(page.locator('#mobile-filter-overlay')).not.toHaveClass(/open/);
  });

  test('cerrar última pestaña limpia pills', async ({ page }) => {
    await closeAllTabs(page);
    await expectEmptyState(page);
  });
});
