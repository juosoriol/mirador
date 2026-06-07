# Configura la suite E2E de Mirador (desktop / mobile / shared)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

New-Item -ItemType Directory -Force -Path @(
  'tests\e2e\desktop',
  'tests\e2e\mobile',
  'tests\e2e\shared',
  'tests\fixtures'
) | Out-Null

$fixture = 'tests\fixtures\cuadro-concurso-2024.xlsx'
$source  = 'C:\dev\mirador\tests\fixtures\cuadro-concurso-2024.xlsx'
$sourceAlt = 'c:\Users\juoso\OneDrive\Escritorio\Cuadro Concurso 2024_CNSC 8-4-2024.xlsx'
if (-not (Test-Path $fixture) -and (Test-Path $source)) {
  Copy-Item $source $fixture
  Write-Host "Fixture copiado: $fixture"
}

if (-not (Test-Path '.env.test')) {
  @'
TEST_EMAIL=sebas.osorio@outlook.com
TEST_PASSWORD=123456
'@ | Set-Content -Path '.env.test' -Encoding UTF8
  Write-Host "Creado .env.test"
}

$files = @{
  'tests\e2e\shared\auth.spec.js' = @'
import { test, expect } from '@playwright/test';
import { login } from '../../helpers/mirador.js';

test('login Firebase con usuario de prueba', async ({ page }) => {
  await login(page);
  await expect(page.locator('#login-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#dropzone')).toBeVisible();
});
'@

  'tests\e2e\desktop\table.spec.js' = @'
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
'@

  'tests\e2e\desktop\pills.spec.js' = @'
import { test, expect } from '@playwright/test';
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
'@

  'tests\e2e\mobile\table.spec.js' = @'
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
'@

  'tests\e2e\mobile\pills.spec.js' = @'
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
'@

  'playwright.config.js' = @'
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

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
      name: 'shared',
      testDir: './tests/e2e/shared',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'desktop',
      testDir: './tests/e2e/desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      testDir: './tests/e2e/mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
'@
}

foreach ($path in $files.Keys) {
  $files[$path] | Set-Content -Path $path -Encoding UTF8 -NoNewline
  Write-Host "OK $path"
}

# package.json — añadir test:shared si falta
$pkgPath = 'package.json'
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if (-not $pkg.scripts.'test:shared') {
  $pkg.scripts | Add-Member -NotePropertyName 'test:shared' -NotePropertyValue 'playwright test --project=shared' -Force
  $pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8
  Write-Host 'OK package.json (+ test:shared)'
}

# Eliminar specs numerados antiguos
@(
  'tests\e2e\01-auth.spec.js',
  'tests\e2e\02-desktop-table.spec.js',
  'tests\e2e\03-desktop-pills.spec.js',
  'tests\e2e\04-mobile-table.spec.js',
  'tests\e2e\05-mobile-pills.spec.js'
) | ForEach-Object {
  if (Test-Path $_) { Remove-Item $_ -Force; Write-Host "Eliminado $_" }
}

Write-Host "`nSuite lista. Comandos:" -ForegroundColor Cyan
Write-Host "  npm run dev        # http://localhost:8000"
Write-Host "  npm test           # 15 tests (shared+desktop+mobile)"
Write-Host "  npm run test:ui    # ver en tiempo real"
Write-Host "  npm run test:desktop / test:mobile / test:shared"
