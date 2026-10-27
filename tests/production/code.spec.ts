import { test, expect } from '@playwright/test';

test('TypeScript gerado funciona sob CSP de produção, somente leitura e sem execução', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const compilerUrls: string[] = []; let compilerClosed = 0;
  page.on('worker', worker => { if (worker.url().includes('generation.worker')) { compilerUrls.push(worker.url()); worker.on('close', () => compilerClosed++); } });
  await page.goto('/studio/'); await page.getByRole('button', { name: 'Código', exact: true }).click();
  await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.getByRole('textbox', { name: 'TypeScript gerado somente leitura', exact: true })).toHaveAttribute('aria-readonly', 'true');
  expect(await page.locator('.generated-editor .line-numbers').count()).toBeGreaterThan(0);
  expect((await page.locator('.generated-editor .view-line span').evaluateAll(elements => [...new Set(elements.map(e => e.className))])).length).toBeGreaterThan(1);
  // The generator deliberately terminates after its reply; inspect lifecycle, not a closed context.
  await expect.poll(() => compilerClosed).toBe(1); expect(compilerUrls.map(url => new URL(url).origin)).toEqual([new URL(page.url()).origin]);
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await expect(page.frameLocator('iframe').getByLabel('Estado')).toHaveText('0'); await page.frameLocator('iframe').getByRole('button', { name: 'Forjar +1', exact: true }).click(); await expect(page.frameLocator('iframe').getByLabel('Estado')).toHaveText('1');
  await page.getByRole('button', { name: 'Código', exact: true }).click(); await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready'); expect(compilerUrls).toHaveLength(1); expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/phase01d-c-20261027/code-production.png', fullPage: true });
});
