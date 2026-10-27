import { test, expect } from '@playwright/test';
import { logicFixture } from '../logic-fixture';
import { ingestionRollbackFixture } from '../fixtures/semantic-ir/scenarios';
import type { Project } from '../../packages/project-schema';
async function open(page: import('@playwright/test').Page, project: Project = logicFixture()) {
  await page.addInitScript(p => { if (window === window.top) localStorage.setItem('btrk-forge:phase0:project', JSON.stringify(p)); }, project); await page.goto('/');
}
test('histórico real, estado tipado e navegação sem dirty/histórico de edição', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  const before = await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'));
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Confirmar', exact: true }).click(); await expect(frame.getByText('Digite seu nome', { exact: true })).toBeVisible();
  await frame.locator('input').fill('Ana 🧪'); await expect(frame.getByText('Ana 🧪', { exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'Confirmar', exact: true }).click(); await expect(frame.getByText('Olá, Ana 🧪!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Depuração', exact: true }).click();
  await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(3);
  await expect(page.getByLabel('Inspeção de variáveis')).toContainText('Nome · string'); await expect(page.getByLabel('Inspeção de variáveis')).toContainText('Ana 🧪');
  await expect(page.getByLabel('Sequência de execução')).toContainText('Ramo escolhido'); await expect(page.getByLabel('Sequência de execução')).toContainText('Não');
  const action = page.locator('li[data-kind="set-text"]'); await expect(action).toContainText('Olá, Ana 🧪!');
  await action.getByRole('button', { name: 'Blueprint no', exact: true }).click(); await expect(page.getByTestId('graph')).toHaveAttribute('data-revealed-node-id', 'no'); await expect(page.getByRole('button', { name: 'Desfazer lógica', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await page.locator('li[data-kind="set-text"]').getByRole('button', { name: 'Código no', exact: true }).click();
  await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.locator('.generated-editor')).toHaveAttribute('data-node-id', 'no');
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await page.setViewportSize({ width: 1920, height: 1080 }); await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-fullhd.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 }); await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-1366.png', fullPage: true });
  await page.locator('li[data-kind="set-text"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-trace.png', fullPage: true });
  expect(await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'))).toBe(before); expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Limpar histórico', exact: true }).click(); await expect(page.getByText('Nenhum evento nesta sessão.', { exact: true })).toBeVisible(); await expect(page.getByLabel('Inspeção de variáveis')).toContainText('Ana 🧪');
  await page.getByRole('button', { name: 'Reiniciar estado', exact: true }).click(); await expect(page.getByLabel('Inspeção de variáveis')).not.toContainText('Ana 🧪');
});
test('falha e rollback exibem valores revertidos e ingestão preservada', async ({ page }) => {
  await open(page, ingestionRollbackFixture()); await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.frameLocator('iframe').locator('input').fill('Ana');
  await expect(page.locator('.console [role=status]')).toContainText('concat'); await page.getByRole('button', { name: 'Depuração', exact: true }).click();
  await expect(page.getByLabel('Depuração runtime')).toContainText('Rollback · ações revertidas; ingestão preservada'); await expect(page.locator('li[data-kind="rollback"]').first()).toContainText('"Ana" → string: "Resultado"');
  await expect(page.getByLabel('Inspeção de variáveis')).toContainText('Ana'); await expect(page.getByLabel('Propriedades transitórias')).toContainText('Resultado');
  await page.locator('li[data-kind="rollback"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-rollback.png', fullPage: true });
});
test('cancelamento e timeout são explícitos sem inventar trace; reset limpa histórico', async ({ page }) => {
  await page.route(/execution\.worker/, route => route.fulfill({ contentType: 'application/javascript', body: 'self.onmessage=()=>{};' })); await open(page);
  await page.getByRole('button', { name: '▶ Executar evento', exact: true }).click(); await page.getByRole('button', { name: 'Interromper execução', exact: true }).click(); await page.getByRole('button', { name: 'Depuração', exact: true }).click();
  await expect(page.getByLabel('Histórico de eventos')).toContainText('Interrompido'); await expect(page.getByLabel('Depuração runtime')).toContainText('Trace parcial indisponível');
  await page.getByRole('button', { name: '▶ Executar evento', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos')).toContainText('Tempo excedido'); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reiniciar estado', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(0);
});
test('histórico limitado e troca de documento descartam sessão anterior', async ({ page }) => {
  await open(page); const run = page.getByRole('button', { name: '▶ Executar evento', exact: true });
  for (let i = 0; i < 23; i++) { await run.click(); await expect(page.getByRole('button', { name: 'Interromper execução', exact: true })).toBeDisabled(); }
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(20); await expect(page.getByLabel('Depuração runtime')).toContainText('3 evento(s) antigo(s)');
  await page.getByRole('button', { name: 'Restaurar exemplo', exact: true }).click(); await expect(page.getByText('Nenhum evento nesta sessão.', { exact: true })).toBeVisible();
});
