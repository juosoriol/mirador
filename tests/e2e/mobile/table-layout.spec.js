import { test, expect } from '@playwright/test';
import {
  login, loadFixture, closeAllTabs, assertTableLayoutStable,
} from '../../helpers/mirador.js';

test.describe('Móvil — estabilidad tabla', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('tabla no se desplaza al hacer scroll horizontal/vertical', async ({ page }) => {
    await assertTableLayoutStable(page);
  });

  test('botón restablecer vista tras foco en búsqueda', async ({ page }) => {
    await page.locator('#search-input').focus();
    await page.waitForTimeout(600);
    const btn = page.locator('#viewport-restore-btn');
    const visible = await btn.evaluate((el) => el.classList.contains('show'));
    if (visible) {
      await btn.click();
      await page.waitForTimeout(300);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(15);
    }
  });

  test('table-wrap permanece visible tras scroll en vt-scroll', async ({ page }) => {
    const scroll = page.locator('#vt-scroll');
    await scroll.evaluate((el) => { el.scrollTop = 400; el.scrollLeft = 200; });
    await page.waitForTimeout(400);
    await expect(page.locator('#table-wrap')).toBeVisible();
    await expect(page.locator('#table-body tr').first()).toBeVisible();
    const box = await page.locator('#table-wrap').boundingBox();
    expect(box?.height).toBeGreaterThan(100);
  });
});
