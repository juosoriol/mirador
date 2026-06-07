import { test, expect } from '@playwright/test';
import { login } from '../../helpers/mirador.js';

test('login Firebase con usuario de prueba', async ({ page }) => {
  await login(page);
  await expect(page.locator('#login-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#dropzone')).toBeVisible();
});
