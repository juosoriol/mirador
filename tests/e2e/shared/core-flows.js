import {
  login,
  loadFixture,
  closeAllTabs,
  getRowCount,
  flushSession,
  reloadAndExpectData,
  discoverSearchTerm,
  searchAndExpectReduction,
  clearSearch,
  enterPillsMode,
  exitPillsMode,
  openSheetsModal,
  switchToSheet,
  applyFirstChipFilter,
  clearAllFilters,
  openSecondTab,
  clickTabByIndex,
  openDocsPanel,
  openActionsPanel,
  deleteCloudTestDocs,
  installFilePickerGuard,
  expectNoFilePicker,
  FIXTURE_XLSX,
} from '../../helpers/mirador.js';

/**
 * @param {import('@playwright/test').test} test
 * @param {typeof import('@playwright/test').expect} expect
 * @param {{ isMobile: boolean }} opts
 */
export function registerCoreFlows(test, expect, { isMobile }) {
  const label = isMobile ? 'Móvil' : 'Escritorio';

  test.describe(`${label} — flujos core`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await deleteCloudTestDocs(page);
    });

    test.afterEach(async ({ page }) => {
      await deleteCloudTestDocs(page);
      await closeAllTabs(page);
    });

    test('1 — abrir documento local muestra tabla', async ({ page }) => {
      await loadFixture(page);
      await expect(page.locator('#table-wrap')).toBeVisible();
      expect(await getRowCount(page)).toBeGreaterThan(0);
      await expect(page.locator('#dropzone')).toBeHidden();
    });

    test('1b — panel documentos en la nube abre', async ({ page }) => {
      await loadFixture(page);
      await openDocsPanel(page, { isMobile });
      await expect(page.locator('#docs-panel')).toHaveClass(/open/);
      const body = page.locator('#docs-body');
      await expect(body).toBeVisible();
      await page.evaluate(() => { if (typeof closeDocsPanel === 'function') closeDocsPanel(); });
    });

    test('2 — guardar documento en la nube', async ({ page }) => {
      test.setTimeout(180_000);
      await loadFixture(page);
      await page.evaluate(() => { if (typeof _showFileActions === 'function') _showFileActions(); });

      const testFileName = `e2e-test-${Date.now()}.xlsx`;
      await page.evaluate((name) => {
        const tab = typeof T === 'function' ? T() : null;
        if (tab) tab.fileName = name;
      }, testFileName);

      page.on('dialog', (d) => d.accept());
      await openActionsPanel(page, { isMobile });
      await page.locator('#ap-save-cloud').click();
      await page.waitForTimeout(8000);

      await openDocsPanel(page, { isMobile });
      await expect(page.locator('#docs-body')).toContainText(testFileName, { timeout: 60_000 });
      await page.evaluate(() => { if (typeof closeDocsPanel === 'function') closeDocsPanel(); });
    });

    test('3 — búsqueda en tiempo real en modo tabla', async ({ page }) => {
      await loadFixture(page);
      const term = await discoverSearchTerm(page);
      const { before, after } = await searchAndExpectReduction(page, '#search-input', term);
      expect(after).toBeLessThan(before);
      await clearSearch(page, '#search-input');
      expect(await getRowCount(page)).toBe(before);
    });

    test('3b — búsqueda en pills no usa barra superior', async ({ page }) => {
      await loadFixture(page);
      await enterPillsMode(page);
      await expect(page.locator('#searchbar')).toBeHidden();
      const term = await discoverSearchTerm(page);
      const total = await getRowCount(page);
      await page.fill('#pills-search-input', term);
      await page.waitForTimeout(500);
      expect(await getRowCount(page)).toBeLessThanOrEqual(total);
    });

    test('4 — aplicar y quitar filtros de columna', async ({ page }) => {
      await loadFixture(page);
      const { before, after } = await applyFirstChipFilter(page, { isMobile });
      expect(after).toBeLessThanOrEqual(before);
      if (after < before) {
        await clearAllFilters(page, { isMobile });
        expect(await getRowCount(page)).toBe(before);
      }
      if (isMobile) {
        await applyFirstChipFilter(page, { isMobile });
        await expect(page.locator('#mobile-active-bar')).toHaveClass(/show/);
        await clearAllFilters(page, { isMobile });
      }
    });

    test('5 — cambiar pestañas en modo tabla', async ({ page }) => {
      await loadFixture(page);
      const firstCount = await getRowCount(page);
      await openSecondTab(page);
      const secondCount = await getRowCount(page);
      await clickTabByIndex(page, 0);
      expect(await getRowCount(page)).toBe(firstCount);
      await clickTabByIndex(page, 1);
      expect(await getRowCount(page)).toBe(secondCount);
    });

    test('5b — cambiar pestañas en modo pills', async ({ page }) => {
      await loadFixture(page);
      await enterPillsMode(page);
      const firstMain = await page.locator('#pills-grid [class*="mpill"]').first().textContent();
      await openSecondTab(page);
      await enterPillsMode(page);
      await clickTabByIndex(page, 0);
      await page.waitForTimeout(800);
      await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
      const restored = await page.locator('#pills-grid [class*="mpill"]').first().textContent();
      expect(restored).toBe(firstMain);
      await exitPillsMode(page);
      await expect(page.locator('#table-wrap')).toBeVisible();
    });

    test('6 — recarga F5 restaura datos en tabla', async ({ page }) => {
      await loadFixture(page);
      const count = await getRowCount(page);
      await reloadAndExpectData(page);
      expect(await getRowCount(page)).toBeGreaterThan(0);
      expect(await getRowCount(page)).toBe(count);
    });

    test('6b — recarga F5 restaura pills', async ({ page }) => {
      await loadFixture(page);
      await enterPillsMode(page);
      const count = await getRowCount(page);
      await flushSession(page);
      await page.reload();
      try {
        await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
      } catch { /* ok */ }
      await expect(page.locator('#dropzone')).toBeHidden({ timeout: 60_000 });
      await enterPillsMode(page);
      expect(await getRowCount(page)).toBeGreaterThan(0);
      expect(await getRowCount(page)).toBe(count);
    });

    test('6c — recarga preserva búsqueda y filtros', async ({ page }) => {
      await loadFixture(page);
      const total = await getRowCount(page);
      const term = await discoverSearchTerm(page);
      await page.fill('#search-input', term);
      await page.waitForTimeout(500);
      const filtered = await getRowCount(page);
      expect(filtered).toBeLessThan(total);
      await flushSession(page);
      await page.reload();
      try {
        await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
      } catch { /* ok */ }
      await expect(page.locator('#dropzone')).toBeHidden({ timeout: 60_000 });
      const searchVal = await page.locator('#search-input').inputValue();
      expect(searchVal.length).toBeGreaterThan(0);
      const afterReload = await getRowCount(page);
      expect(afterReload).toBeGreaterThan(0);
      expect(afterReload).toBeLessThanOrEqual(filtered + 5);
    });

    test('9 — cambiar hoja tras recarga sin reabrir archivo', async ({ page }) => {
      await loadFixture(page);
      const countBefore = await getRowCount(page);
      await switchToSheet(page, 1);
      const countSheet2 = await getRowCount(page);
      expect(countSheet2).toBeGreaterThan(0);

      await flushSession(page);
      await page.reload();
      try {
        await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
      } catch { /* ok */ }
      await expect(page.locator('#dropzone')).toBeHidden({ timeout: 60_000 });
      expect(await getRowCount(page)).toBeGreaterThan(0);

      await installFilePickerGuard(page);
      await switchToSheet(page, 0);
      await expectNoFilePicker(page);
      const countAfter = await getRowCount(page);
      expect(countAfter).toBeGreaterThan(0);
      if (countBefore !== countSheet2) {
        expect(countAfter).toBe(countBefore);
      }
    });

    test('9b — selector de encabezado tras recarga sin file picker', async ({ page }) => {
      await loadFixture(page);
      await flushSession(page);
      await page.reload();
      try {
        await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
      } catch { /* ok */ }
      await expect(page.locator('#table-body tr').first()).toBeVisible({ timeout: 60_000 });

      await installFilePickerGuard(page);
      await page.evaluate(() => { if (typeof reopenHdrPicker === 'function') reopenHdrPicker(); });
      await page.waitForTimeout(1500);
      await expectNoFilePicker(page);
      const hdrOpen = await page.locator('#hdr-overlay').evaluate((el) => el.classList.contains('open'));
      expect(hdrOpen).toBe(true);
      await page.evaluate(() => { if (typeof cancelHdrPicker === 'function') cancelHdrPicker(); });
    });
  });
}
