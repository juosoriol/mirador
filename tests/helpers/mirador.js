import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURE_XLSX = path.resolve(__dirname, '../fixtures/cuadro-concurso-2024.xlsx');

export function requireCredentials() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan TEST_EMAIL y TEST_PASSWORD en .env.test');
  }
  return { email, password };
}

export async function login(page) {
  const { email, password } = requireCredentials();
  await page.goto('/');
  const loginScreen = page.locator('#login-screen');
  await loginScreen.waitFor({ state: 'visible', timeout: 20_000 });

  if (await loginScreen.evaluate((el) => el.classList.contains('hidden'))) {
    return;
  }

  // Firebase puede restaurar la sesión de forma asíncrona tras cargar storageState
  try {
    await expect(loginScreen).toHaveClass(/hidden/, { timeout: 10_000 });
    return;
  } catch {
    // continuar con login manual
  }

  await page.fill('#login-email', email);
  await page.fill('#login-pass', password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(loginScreen).toHaveClass(/hidden/, { timeout: 30_000 });
  await expect(page.locator('#login-error')).not.toHaveClass(/show/);
}

export async function loadFixture(page, filePath = FIXTURE_XLSX) {
  await page.setInputFiles('#file-input', filePath);
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(page.locator('#dropzone')).toBeHidden();
  await page.locator('#table-body tr').first().waitFor({ timeout: 30_000 });
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
  await page.locator('#pills-grid [class*="mpill"]').first().waitFor({ timeout: 20_000 });
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
  await expect(page.locator('#pills-view')).not.toHaveClass(/open/);
  await expect(page.locator('#pills-grid')).toBeEmpty();
  await expect(page.locator('#topbar-breadcrumb')).toBeHidden();
}

export async function getRowCount(page) {
  const text = await page.locator('#st-vis').textContent();
  return parseInt(text?.replace(/\D/g, '') || '0', 10);
}
