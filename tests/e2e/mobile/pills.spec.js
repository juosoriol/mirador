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

  test('pills visibles sin toggle en topbar', async ({ page }) => {
    await expect(page.locator('#btn-pills-mode')).toBeHidden();
    await expect(page.locator('#pills-view')).toHaveClass(/open/);
    await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
  });

  test('botón Filtros expande chips', async ({ page }) => {
    const filterBtn = page.locator('#pills-filter-btn');
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();
    await expect(page.locator('#chips-bar.pills-mode')).toBeVisible();
  });

  test('cerrar última pestaña limpia pills', async ({ page }) => {
    await closeAllTabs(page);
    await expectEmptyState(page);
  });
});
