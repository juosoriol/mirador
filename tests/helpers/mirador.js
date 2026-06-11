import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_FIXTURE = path.resolve(__dirname, '../fixtures/cuadro-concurso-2024.xlsx');
const FALLBACK_FIXTURE = path.resolve(__dirname, '../fixtures/sample.csv');
const ONEDRIVE_FIXTURE = 'c:\\Users\\juoso\\OneDrive\\Escritorio\\Cuadro Concurso 2024_CNSC 8-4-2024.xlsx';

function resolveFixturePath() {
  if (process.env.FIXTURE_XLSX && fs.existsSync(process.env.FIXTURE_XLSX)) {
    return path.resolve(process.env.FIXTURE_XLSX);
  }
  if (fs.existsSync(DEFAULT_FIXTURE)) return DEFAULT_FIXTURE;
  if (fs.existsSync(FALLBACK_FIXTURE)) return FALLBACK_FIXTURE;
  if (fs.existsSync(ONEDRIVE_FIXTURE)) return ONEDRIVE_FIXTURE;
  return DEFAULT_FIXTURE;
}

export const FIXTURE_XLSX = resolveFixturePath();

export function requireCredentials() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan TEST_EMAIL y TEST_PASSWORD en .env.test');
  }
  return { email, password };
}

export async function waitForAppReady(page) {
  await page.waitForFunction(() => {
    if (window.__miradorBootDone === true) return true;
    const loading = document.getElementById('loading');
    const loadingHidden = !loading || getComputedStyle(loading).display === 'none';
    return loadingHidden
      && typeof window.openFilePicker === 'function'
      && typeof window.showDropzone === 'function';
  }, null, { timeout: 60_000 });
}

export async function resetToIdleState(page) {
  await waitForAppReady(page);
  await page.evaluate(() => {
    if (typeof clearStoredSession === 'function') clearStoredSession();
    if (typeof tabs !== 'undefined') {
      while (tabs.size > 0) {
        const id = [...tabs.keys()][0];
        if (typeof closeTab !== 'function') break;
        closeTab(id);
      }
    }
    const pv = document.getElementById('pills-view');
    if (pv?.classList.contains('open') && typeof togglePillsMode === 'function') {
      togglePillsMode();
    }
    if (typeof showDropzone === 'function') showDropzone(true);
  });
  await expect(page.locator('#dropzone')).toBeVisible({ timeout: 20_000 });
}

export async function login(page) {
  const { email, password } = requireCredentials();
  await page.goto('/');
  const loginScreen = page.locator('#login-screen');
  await loginScreen.waitFor({ state: 'visible', timeout: 20_000 });

  if (await loginScreen.evaluate((el) => el.classList.contains('hidden'))) {
    await waitForAppReady(page);
    await resetToIdleState(page);
    return;
  }

  try {
    await expect(loginScreen).toHaveClass(/hidden/, { timeout: 10_000 });
    await waitForAppReady(page);
    await resetToIdleState(page);
    return;
  } catch {
    // continuar con login manual
  }

  await page.fill('#login-email', email);
  await page.fill('#login-pass', password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(loginScreen).toHaveClass(/hidden/, { timeout: 30_000 });
  await expect(page.locator('#login-error')).not.toHaveClass(/show/);
  await waitForAppReady(page);
  await resetToIdleState(page);
}

export async function loadFixture(page, filePath = FIXTURE_XLSX) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Fixture no encontrado: ${filePath}. Ejecuta npm run setup:e2e o define FIXTURE_XLSX en .env.test`,
    );
  }

  await waitForAppReady(page);
  await expect(page.locator('#file-input')).toBeAttached();
  await page.setInputFiles('#file-input', filePath);

  await Promise.race([
    page.locator('#loading').waitFor({ state: 'visible', timeout: 8_000 }),
    page.locator('#table-body tr').first().waitFor({ state: 'visible', timeout: 60_000 }),
  ]).catch(() => {});

  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 120_000 });
  await page.locator('#table-body tr').first().waitFor({ state: 'visible', timeout: 60_000 });
  await expect(page.locator('#dropzone')).toBeHidden();
}

export async function flushSession(page) {
  await page.evaluate(() => {
    if (typeof saveSession === 'function') saveSession();
  });
}

export async function reloadAndExpectData(page) {
  await flushSession(page);
  await page.reload();
  try {
    await expect(page.locator('#login-screen')).toHaveClass(/hidden/, { timeout: 15_000 });
  } catch { /* auth ya restaurado */ }
  await waitForAppReady(page);
  await expect(page.locator('#dropzone')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#table-body tr').first()).toBeVisible({ timeout: 60_000 });
}

export async function isPillsOpen(page) {
  return page.locator('#pills-view').evaluate((el) => el.classList.contains('open'));
}

async function pillsToggleButton(page) {
  const bnav = page.locator('#btn-pills-mode-bnav');
  if (await bnav.isVisible()) return bnav;
  return page.locator('#btn-pills-mode');
}

export async function enterPillsMode(page) {
  if (await isPillsOpen(page)) return;

  const btn = await pillsToggleButton(page);
  if (await btn.isVisible()) {
    await btn.locator('.seg-pills').click();
  } else {
    await page.evaluate(() => {
      if (typeof togglePillsMode === 'function') togglePillsMode();
    });
  }

  await expect(page.locator('#pills-view')).toHaveClass(/open/);
  await page.locator('#pills-grid [class*="mpill"]').first().waitFor({ timeout: 30_000 });
}

export async function exitPillsMode(page) {
  if (!(await isPillsOpen(page))) return;

  const btn = await pillsToggleButton(page);
  if (await btn.isVisible()) {
    await btn.locator('.seg-table').click();
  } else {
    await page.evaluate(() => {
      if (typeof togglePillsMode === 'function') togglePillsMode();
    });
  }

  await expect(page.locator('#pills-view')).not.toHaveClass(/open/);
}

export async function closeAllTabs(page) {
  for (let i = 0; i < 20; i++) {
    const tabCount = await page.locator('#tabs-bar .tab').count();
    if (tabCount === 0) break;

    const closed = await page.evaluate(() => {
      const tab = document.querySelector('#tabs-bar .tab');
      if (!tab) return false;
      const raw = tab.querySelector('[data-close]')?.dataset.close ?? tab.dataset.id;
      const id = raw != null ? Number(raw) : NaN;
      if (Number.isNaN(id) || typeof closeTab !== 'function') return false;
      closeTab(id);
      return true;
    });

    if (!closed) {
      const closeBtn = page.locator('[data-close]').first();
      if (await closeBtn.count()) {
        await closeBtn.click({ force: true });
      } else {
        break;
      }
    }

    await page.waitForTimeout(300);
  }

  await page.evaluate(() => {
    if (typeof showDropzone === 'function') showDropzone(true);
  });

  await expect(page.locator('#dropzone')).toBeVisible({ timeout: 20_000 });
}

export async function expectEmptyState(page) {
  await expect(page.locator('#dropzone')).toBeVisible();
  await expect(page.locator('#searchbar')).toBeHidden();
  await expect(page.locator('#chips-bar')).toBeHidden();
  await expect(page.locator('#tabs-bar')).toBeHidden();
  await expect(page.locator('#pills-view')).not.toHaveClass(/open/);
  await expect(page.locator('#pills-grid')).toBeEmpty();
  await expect(page.locator('#topbar-breadcrumb')).toBeHidden();
}

export async function getRowCount(page) {
  const text = await page.locator('#st-vis').textContent();
  return parseInt(text?.replace(/\D/g, '') || '0', 10);
}

export async function discoverSearchTerm(page) {
  return page.evaluate(() => {
    const tab = typeof T === 'function' ? T() : null;
    if (!tab?.rawData?.length || !tab.columns?.length) return 'test';
    const col = tab.columns.find((c) => !c.startsWith('__EMPTY')) || tab.columns[0];
    for (const row of tab.rawData) {
      const v = String(row[col] || '').trim();
      if (v.length >= 3) return v.slice(0, 12);
    }
    return 'Ana';
  });
}

export async function searchAndExpectReduction(page, selector, term) {
  const before = await getRowCount(page);
  await page.fill(selector, term);
  await page.waitForTimeout(500);
  const after = await getRowCount(page);
  expect(after).toBeLessThan(before);
  return { before, after };
}

export async function clearSearch(page, selector) {
  await page.fill(selector, '');
  await page.waitForTimeout(500);
}

export async function openSheetsModal(page) {
  const btn = page.locator('#btn-mobile-sheets');
  await btn.waitFor({ state: 'visible', timeout: 60_000 });
  await btn.click();
  await expect(page.locator('#mobile-sheets-overlay')).toHaveClass(/open/);
}

export async function switchToSheet(page, index) {
  await openSheetsModal(page);
  const item = page.locator('#ms-list .ms-item').nth(index);
  const name = await item.locator('.ms-item-name').innerText();
  await item.click();
  await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 120_000 }).catch(() => {});
  await expect(page.locator('#table-body tr').first()).toBeVisible({ timeout: 60_000 });
  return name;
}

export async function applyFirstChipFilter(page, { isMobile } = {}) {
  const before = await getRowCount(page);
  if (isMobile) {
    await page.locator('#mbnav-filters').click();
    await expect(page.locator('#mobile-filter-overlay')).toHaveClass(/open/);
    await page.locator('#mf-chips-host .chip').first().click();
  } else {
    await page.locator('#chips-bar .chip').first().click();
  }
  await expect(page.locator('#chip-dropdown')).toHaveClass(/open/);
  const items = page.locator('#chip-dropdown .cdp-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const label = await item.locator('.cdp-item-label').innerText().catch(() => '');
    if (label && !label.includes('(Todos)') && !label.includes('Con cédula') && !label.includes('sin cédula')) {
      await item.click();
      break;
    }
  }
  await page.waitForTimeout(500);
  const after = await getRowCount(page);
  if (isMobile) {
    await page.evaluate(() => { if (typeof closeMobileFilterSheet === 'function') closeMobileFilterSheet(); });
  } else {
    await page.evaluate(() => { if (typeof closeDropdown === 'function') closeDropdown(); });
  }
  return { before, after };
}

export async function clearAllFilters(page, { isMobile } = {}) {
  if (isMobile && await page.locator('#btn-mobile-quick-clear').isVisible()) {
    await page.locator('#btn-mobile-quick-clear').click();
  } else {
    await page.evaluate(() => {
      if (typeof clearChipFiltersOnly === 'function') clearChipFiltersOnly();
    });
  }
  await page.waitForTimeout(400);
}

export async function openSecondTab(page, filePath = FIXTURE_XLSX) {
  await page.setInputFiles('#file-input', filePath);
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 120_000 });
  await expect(page.locator('#tabs-bar .tab')).toHaveCount(2);
}

export async function clickTabByIndex(page, index) {
  await page.locator('#tabs-bar .tab').nth(index).click();
  await page.waitForTimeout(600);
}

export async function openActionsPanel(page, { isMobile } = {}) {
  if (isMobile) {
    await page.locator('#mbnav-menu').click();
  } else {
    await page.locator('#btn-actions').click();
  }
  await expect(page.locator('#actions-panel')).toHaveClass(/open/);
}

export async function openDocsPanel(page, { isMobile } = {}) {
  await openActionsPanel(page, { isMobile });
  await page.locator('#ap-docs').click();
  await expect(page.locator('#docs-panel')).toHaveClass(/open/, { timeout: 30_000 });
}

export async function saveToCloudAndConfirm(page, { isMobile } = {}) {
  const testName = `e2e-test-${Date.now()}.xlsx`;

  page.once('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept();
    else await dialog.accept();
  });

  if (isMobile) {
    await page.locator('#mbnav-menu').click();
    await page.locator('#ap-save-cloud').click();
  } else {
    await page.locator('#btn-save-cloud').click();
  }

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.waitForTimeout(3000);
  return testName;
}

export async function deleteCloudTestDocs(page) {
  await page.evaluate(async () => {
    if (typeof _fbDb === 'undefined' || typeof _fbUser === 'undefined' || !_fbDb || !_fbUser) return;
    const snap = await _fbDb.collection('documents')
      .where('userId', '==', _fbUser.uid)
      .get();
    for (const doc of snap.docs) {
      const name = doc.data().fileName || '';
      if (!name.startsWith('e2e-test-')) continue;
      try {
        const path = doc.data().storagePath;
        if (path) await _fbStorage.ref(path).delete();
      } catch (_) {}
      await doc.ref.delete();
    }
  });
}

export async function assertTableLayoutStable(page) {
  const mainBox = await page.locator('#main').boundingBox();
  const wrapBefore = await page.locator('#table-wrap').boundingBox();
  expect(mainBox).toBeTruthy();
  expect(wrapBefore).toBeTruthy();

  await page.locator('#vt-scroll').evaluate((el) => {
    el.scrollTop = 200;
    el.scrollLeft = 100;
  });
  await page.waitForTimeout(300);

  const wrapAfter = await page.locator('#table-wrap').boundingBox();
  expect(wrapAfter).toBeTruthy();
  if (wrapBefore && wrapAfter && mainBox) {
    expect(Math.abs(wrapAfter.y - wrapBefore.y)).toBeLessThan(25);
    expect(wrapAfter.x).toBeGreaterThanOrEqual(mainBox.x - 5);
  }
}

export async function installFilePickerGuard(page) {
  await page.evaluate(() => {
    window.__e2eFilePickerTriggered = false;
    const inp = document.getElementById('file-input');
    if (inp && !inp.__e2eGuard) {
      inp.__e2eGuard = true;
      inp.addEventListener('click', () => { window.__e2eFilePickerTriggered = true; }, true);
    }
  });
}

export async function expectNoFilePicker(page) {
  const triggered = await page.evaluate(() => !!window.__e2eFilePickerTriggered);
  expect(triggered).toBe(false);
}
