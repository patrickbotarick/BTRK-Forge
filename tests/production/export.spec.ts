import { test, expect } from '@playwright/test';
test('aplicativo exportado de produção roda sem o Studio', async ({ page }) => {
  await page.goto('/export-web/');
  await page.getByRole('button', { name: 'Forjar +1' }).click();
  await expect(page.getByLabel('Contador')).toHaveText('1');
  await page.getByRole('button', { name: 'Forjar +1' }).click();
  await expect(page.getByLabel('Contador')).toHaveText('2');
  await page.screenshot({ path: 'artifacts/export-web.png' });
});
test('Studio de produção respeita CSP, preview e Monaco', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/studio/');
  await expect(page.getByTestId('node')).toHaveCount(8);
  await page.screenshot({ path: 'artifacts/studio-blueprint.png', fullPage: true });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.frameLocator('iframe').getByRole('button', { name: 'Forjar +1' }).click();
  await expect(page.frameLocator('iframe').getByLabel('Estado')).toHaveText('1');
  await context.setOffline(true);
  await page.frameLocator('iframe').getByRole('button', { name: 'Forjar +1' }).click();
  await expect(page.frameLocator('iframe').getByLabel('Estado')).toHaveText('2');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Código', exact: true }).click();
  await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click();
  await expect(page.locator('.json-view .monaco-editor').first()).toBeVisible();
  expect(errors).toEqual([]);
});
