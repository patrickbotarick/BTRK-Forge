import { test, expect } from '@playwright/test';
test('depuração real em produção preserva CSP, sem bridge e sem persistir estado', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/studio/'); const before = await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'));
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.frameLocator('iframe').getByRole('button', { name: 'Forjar +1', exact: true }).click(); await expect(page.frameLocator('iframe').getByLabel('Estado')).toHaveText('1');
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos')).toContainText('Concluído'); await expect(page.getByLabel('Inspeção de variáveis')).toContainText('1'); await expect(page.locator('li[data-kind="assign"]')).toContainText('number: 0 → number: 1');
  await page.locator('li[data-kind="assign"]').getByRole('button', { name: 'Código assign', exact: true }).click(); await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.locator('.generated-editor')).toHaveAttribute('data-node-id', 'assign');
  expect(await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'))).toBe(before); expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-production.png', fullPage: true });
});
