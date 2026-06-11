import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitForAppReady, resetToIdleState } from '../../helpers/mirador.js';

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

  await waitForAppReady(page);
  await resetToIdleState(page);
  await page.context().storageState({ path: authFile });
});
