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

  test('siempre abre en Ventana', async ({ page }) => {
    await page.locator('#btn-filter-studio').click();
    await page.locator('.fs-switch button', { hasText: 'Panel' }).click();
    await expect(page.locator('.fs-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#btn-filter-studio').click();
    await expect(page.locator('.fs-window')).toBeVisible();
  });

  test('Contiene reduce la lista de valores', async ({ page }) => {
    await page.locator('#btn-filter-studio').click();
    const win = page.locator('.fs-window');
    const values = win.locator('.fs-values .fs-check .fs-check-label');
    const before = await values.count();
    const q = (await values.first().innerText()).trim().slice(0, 6).toLowerCase();
    await win.locator('.fs-contains input').fill(q);
    await expect(win.locator('.fs-contains-hint')).toBeVisible();
    await expect.poll(() => values.count()).toBeLessThan(before);
    const labels = await values.allInnerTexts();
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l.toLowerCase()).toContain(q);
  });

  test('historial de búsqueda se activa y guarda', async ({ page }) => {
    const chk = page.locator('#chk-recent');
    await page.evaluate(() => localStorage.removeItem('mirador_recent_searches_v1'));
    if (!(await chk.isChecked())) await chk.click();
    await expect(chk).toBeChecked();
    await page.locator('#search-input').fill('zzhist');
    await page.locator('#search-input').press('Enter');
    await expect(page.locator('#search-recents .search-recent', { hasText: 'zzhist' })).toBeVisible();
    await chk.click();
    await expect(chk).not.toBeChecked();
    await expect(page.locator('#search-recents .search-recent')).toHaveCount(0);
    await chk.click();
    await expect(chk).toBeChecked();
    await page.evaluate(() => window._clearLiveSearch?.());
  });

  test('botón Colores pinta celdas por regla', async ({ page }) => {
    const btn = page.locator('#btn-cond-rules');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('#cond-overlay')).toHaveClass(/open/);
    await page.locator('#cond-overlay button', { hasText: 'Agregar regla' }).click();
    const row = page.locator('#cond-rules-list .cm-row').first();
    const rule = await page.evaluate(() => {
      const tab = window.T();
      const first = tab.rawData[tab.filtered[0]];
      const col = tab.columns.find((c) => String(first[c] ?? '').trim().length >= 2);
      return { col, val: String(first[col]).trim().slice(0, 2) };
    });
    await row.locator('select[data-f="col"]').selectOption(rule.col);
    await row.locator('select[data-f="op"]').selectOption('contiene');
    await row.locator('input[data-f="val"]').fill(rule.val);
    await expect(row.locator('.cm-match')).toContainText(/\d+ celda/);
    await page.locator('#cond-done').click();
    await expect(page.locator('#cond-overlay')).not.toHaveClass(/open/);
    await expect(btn).toHaveClass(/on/);
    await expect(page.locator('td.cond-cell').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-4-colores.png` });
    await page.evaluate(() => { window.T().condRules = []; window._condRulesChanged?.(); });
  });
});
