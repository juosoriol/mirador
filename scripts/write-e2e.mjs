import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r?\n/g, '\n'), 'utf8');
  console.log('OK', rel);
}

const fixture = path.join(root, 'tests/fixtures/cuadro-concurso-2024.xlsx');
const fixtureSources = [
  path.join(root, 'tests/fixtures/cuadro-concurso-2024.xlsx'),
  'C:/dev/mirador/tests/fixtures/cuadro-concurso-2024.xlsx',
  'c:/Users/juoso/OneDrive/Escritorio/Cuadro Concurso 2024_CNSC 8-4-2024.xlsx',
  path.join(process.env.USERPROFILE || '', 'OneDrive/Escritorio/Cuadro Concurso 2024_CNSC 8-4-2024.xlsx'),
];
if (!fs.existsSync(fixture)) {
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  const source = fixtureSources.find((p, i) => i > 0 && fs.existsSync(p));
  if (source) {
    fs.copyFileSync(source, fixture);
    console.log('OK fixture copied from', source);
  } else {
    console.warn('AVISO: coloca cuadro-concurso-2024.xlsx en tests/fixtures/');
  }
}

write('tests/e2e/shared/auth.spec.js', `import { test, expect } from '@playwright/test';
import { login } from '../../helpers/mirador.js';

test('login Firebase con usuario de prueba', async ({ page }) => {
  await login(page);
  await expect(page.locator('#login-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#dropzone')).toBeVisible();
});
`);

write('tests/e2e/desktop/table.spec.js', `import { test, expect } from '@playwright/test';
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
`);

write('tests/e2e/desktop/pills.spec.js', `import { test, expect } from '@playwright/test';
import {
  login, loadFixture, enterPillsMode, exitPillsMode,
  closeAllTabs, expectEmptyState, getRowCount,
} from '../../helpers/mirador.js';

test.describe('Escritorio — modo Pills', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await loadFixture(page);
    await enterPillsMode(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllTabs(page);
  });

  test('muestra pills con registros', async ({ page }) => {
    await expect(page.locator('#pills-view')).toHaveClass(/open/);
    await expect(page.locator('#pills-grid [class*="mpill"]').first()).toBeVisible();
    expect(await page.locator('#pills-toolbar-count').textContent()).toMatch(/registro/i);
    expect(await getRowCount(page)).toBeGreaterThan(0);
  });

  test('búsqueda en pills reduce resultados', async ({ page }) => {
    const total = await getRowCount(page);
    await page.fill('#pills-search-input', 'zzz_inexistente_xyz');
    await page.waitForTimeout(400);
    expect(await getRowCount(page)).toBeLessThanOrEqual(total);
  });

  test('volver a tabla oculta pills', async ({ page }) => {
    await exitPillsMode(page);
    await expect(page.locator('#table-wrap')).toBeVisible();
    await expect(page.locator('#pills-view')).not.toHaveClass(/open/);
  });

  test('cerrar última pestaña limpia pills y deja dropzone', async ({ page }) => {
    await closeAllTabs(page);
    await expectEmptyState(page);
  });
});
`);

write('tests/e2e/mobile/table.spec.js', `import { test, expect } from '@playwright/test';
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
    await expect(page.locator('#btn-pills-mode')).toBeHidden();
    expect(await getRowCount(page)).toBeGreaterThan(0);
  });

  test('botones móvil visibles', async ({ page }) => {
    await expect(page.locator('#btn-open-file')).toBeVisible();
    await expect(page.locator('#btn-mobile-sheets')).toBeVisible();
    await expect(page.locator('#btn-actions')).toBeVisible();
  });

  test('modal Hojas abre en móvil', async ({ page }) => {
    await page.locator('#btn-mobile-sheets').click();
    await expect(page.locator('#mobile-sheets-overlay')).toHaveClass(/open/);
    await page.evaluate(() => closeMobileSheets());
    await expect(page.locator('#mobile-sheets-overlay')).not.toHaveClass(/open/);
  });
});
`);

write('tests/e2e/mobile/pills.spec.js', `import { test, expect } from '@playwright/test';
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
`);

write('tests/e2e/setup/auth.setup.js', `import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.resolve(__dirname, '../../.auth/user.json');

setup('guardar sesión Firebase', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan TEST_EMAIL y TEST_PASSWORD en .env.test');
  }

  await page.goto('/');
  const loginScreen = page.locator('#login-screen');
  await loginScreen.waitFor({ state: 'visible', timeout: 20_000 });

  if (!(await loginScreen.evaluate((el) => el.classList.contains('hidden')))) {
    await page.fill('#login-email', email);
    await page.fill('#login-pass', password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(loginScreen).toHaveClass(/hidden/, { timeout: 30_000 });
  }

  await page.context().storageState({ path: authFile });
});
`);

write('playwright.config.js', `import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'tests/.auth/user.json');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/e2e/setup',
      testMatch: /.*\\.setup\\.js/,
    },
    {
      name: 'shared',
      testDir: './tests/e2e/shared',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: authFile,
      },
    },
    {
      name: 'desktop',
      testDir: './tests/e2e/desktop',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: authFile,
      },
    },
    {
      name: 'mobile',
      testDir: './tests/e2e/mobile',
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: authFile,
      },
    },
  ],
});
`);

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts['test:shared'] = 'playwright test --project=shared';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('OK package.json');

for (const old of [
  'tests/e2e/01-auth.spec.js',
  'tests/e2e/02-desktop-table.spec.js',
  'tests/e2e/03-desktop-pills.spec.js',
  'tests/e2e/04-mobile-table.spec.js',
  'tests/e2e/05-mobile-pills.spec.js',
]) {
  const p = path.join(root, old);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('DEL', old); }
}

console.log('\nListo. Ejecuta: npm test');
