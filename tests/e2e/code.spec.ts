import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { readAfterWriteFixture } from '../fixtures/semantic-ir/scenarios';
import { exampleProject } from '../../packages/forge-core/example';

const state = (page: Page) => page.getByLabel('Estado da geração', { exact: true });
const generated = (page: Page) => page.locator('.generated-editor');
async function open(page: Page, fixture = exampleProject()) {
  await page.addInitScript(p => localStorage.setItem('btrk-forge:phase0:project', JSON.stringify(p)), fixture);
  await page.goto('/');
}
async function ready(page: Page) { await expect(state(page)).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); }

test('Code Demo: node, definição, chamadas, seleção inversa, auxiliar e navegação sem alteração', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); let workerLoads = 0; page.on('request', r => { if (r.url().includes('generation.worker')) workerLoads++; });
  await open(page, readAfterWriteFixture()); const before = await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'));
  await page.getByLabel('Node selecionado', { exact: true }).selectOption('sum');
  await page.getByRole('button', { name: 'Ver código do node', exact: true }).click(); await ready(page);
  await expect(generated(page)).toHaveAttribute('data-node-id', 'sum');
  await expect(page.getByLabel('Ocorrência no TypeScript').locator('option')).toHaveCount(4);
  await expect(page.locator('.forge-code-definition').first()).toBeVisible();
  const readonly = page.getByRole('textbox', { name: 'TypeScript gerado somente leitura', exact: true });
  await expect(readonly).toHaveAttribute('aria-readonly', 'true'); const revision = await generated(page).getAttribute('data-revision');
  await readonly.focus(); await page.keyboard.press('Control+Home'); await page.keyboard.insertText('UNAUTHORIZED_EDIT');
  await expect(page.getByRole('button', { name: 'Localizar no Blueprint', exact: true })).toHaveCount(0);
  await expect(page.locator('.generated-editor .view-lines')).not.toContainText('UNAUTHORIZED_EDIT');
  await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Find', exact: true }).fill('n3_sum(ctx, state)'); await page.keyboard.press('Escape');
  await expect(generated(page)).toHaveAttribute('data-node-id', 'sum');
  await expect(page.getByLabel('Ocorrência no TypeScript')).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Localizar no Blueprint', exact: true }).click();
  await expect(page.getByLabel('Node selecionado', { exact: true })).toHaveValue('sum'); await expect(page.getByTestId('graph')).toHaveAttribute('data-revealed-node-id', 'sum');
  await expect(page.getByRole('button', { name: 'Desfazer lógica', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ver código do node', exact: true }).click(); await ready(page);
  expect(await generated(page).getAttribute('data-revision')).toBe(revision); expect(workerLoads).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('btrk-forge:phase0:project'))).toBe(before); expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.screenshot({ path: 'artifacts/phase01d-c-20261027/code-navigation.png', fullPage: true });
});

test('código acompanha parâmetro, undo e redo sem aplicar mapas anteriores', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page); const first = await generated(page).getAttribute('data-revision');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click(); await page.getByLabel('Node selecionado', { exact: true }).selectOption('one'); await page.getByLabel('Valor constante', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Ver código do node', exact: true }).click(); await ready(page); const second = await generated(page).getAttribute('data-revision'); expect(second).not.toBe(first);
  await page.getByRole('button', { name: 'Desfazer código', exact: true }).click(); await ready(page); await expect(generated(page)).toHaveAttribute('data-revision', first!);
  await page.getByRole('button', { name: 'Refazer código', exact: true }).click(); await ready(page); await expect(generated(page)).toHaveAttribute('data-revision', second!);
});

test('rascunho incompleto e conexão removida limpam código antigo e localizam diagnóstico', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page);
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click(); await page.getByRole('button', { name: 'Desconectar edge-8', exact: true }).click();
  await page.getByRole('button', { name: 'Código', exact: true }).click(); await expect(state(page)).toHaveAttribute('data-state', 'incomplete'); await expect(generated(page)).toHaveAttribute('data-revision', '');
  await expect(page.locator('.generated-editor .view-lines')).not.toContainText('function'); await page.getByRole('button', { name: 'Localizar node assign', exact: true }).click();
  await expect(page.getByLabel('Node selecionado', { exact: true })).toHaveValue('assign'); await expect(page.getByTestId('graph')).toHaveAttribute('data-revealed-node-id', 'assign');
  await page.getByRole('button', { name: 'Desfazer lógica', exact: true }).click(); await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page);
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click(); await page.getByRole('button', { name: 'Adicionar Concatenar', exact: true }).click(); const id = await page.getByLabel('Node selecionado', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Ver código do node', exact: true }).click(); await expect(state(page)).toHaveAttribute('data-state', 'incomplete');
  await page.getByRole('button', { name: 'Localizar node ' + id, exact: true }).first().click(); await page.getByRole('button', { name: 'Desfazer lógica', exact: true }).click();
  await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page); await expect(generated(page)).toHaveAttribute('data-node-id', '');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click(); await page.getByRole('button', { name: 'Refazer lógica', exact: true }).click(); await page.getByLabel('Node selecionado', { exact: true }).selectOption(id);
  await page.getByRole('button', { name: 'Remover node', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar remoção do node', exact: true }).click();
  await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page); await expect(generated(page)).toHaveAttribute('data-node-id', '');
});

test('Modelo JSON mantém buffer na alternância e aplica validação existente', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page);
  await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click(); const json = page.getByRole('textbox', { name: 'Modelo JSON editável', exact: true });
  const next = exampleProject(); next.name = 'Forge JSON preservado'; await page.context().grantPermissions(['clipboard-read', 'clipboard-write']); await page.evaluate(text => navigator.clipboard.writeText(text), JSON.stringify(next, null, 2)); await json.focus(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+v');
  await page.getByRole('tab', { name: 'TypeScript gerado', exact: true }).click(); await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click();
  await json.focus(); await page.keyboard.press('Control+Home'); await expect(page.locator('.json-view .view-lines')).toContainText('Forge JSON preservado');
  await page.getByRole('button', { name: 'Aplicar JSON', exact: true }).click(); await ready(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('btrk-forge:phase0:project')!).name)).toBe('Forge JSON preservado');
  await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click(); await json.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('{invalid'); await page.getByRole('button', { name: 'Aplicar JSON', exact: true }).click();
  await expect(page.locator('.console [role=status]')).toContainText('Erro'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('btrk-forge:phase0:project')!).name)).toBe('Forge JSON preservado');
});

test('falha no Worker apresenta mensagem local e permite nova geração', async ({ page }) => {
  await page.route(/generation\.worker/, route => route.fulfill({ contentType: 'application/javascript', body: 'self.onmessage=()=>{throw new Error("raw internal failure")}' }));
  await open(page); await page.getByRole('button', { name: 'Código', exact: true }).click(); await expect(state(page)).toHaveAttribute('data-state', 'error'); await expect(state(page)).not.toContainText('raw internal failure');
  await page.unroute(/generation\.worker/); await page.getByRole('button', { name: 'Gerar novamente', exact: true }).click(); await ready(page);
});

test('geração de 200 nodes mantém interface responsiva e registra custo no navegador', async ({ page }) => {
  const p = exampleProject(); while (p.graph.nodes.length < 200) p.graph.nodes.push({ id: `large-${p.graph.nodes.length}`, kind: 'constant', value: '😀'.repeat(100), position: { x: 0, y: 0 } });
  await page.setViewportSize({ width: 1366, height: 768 }); await open(page, p);
  await page.evaluate(() => { const target = window as typeof window & { codePerf: { ticks: number; maxGap: number; started: number }; codeTimer: number }; target.codePerf = { ticks: 0, maxGap: 0, started: performance.now() }; let previous = performance.now(); target.codeTimer = window.setInterval(() => { const now = performance.now(); target.codePerf.ticks++; target.codePerf.maxGap = Math.max(target.codePerf.maxGap, now - previous); previous = now; }, 16); });
  await page.getByRole('button', { name: 'Código', exact: true }).click(); await ready(page);
  const metrics = await page.evaluate(() => { const target = window as typeof window & { codePerf: { ticks: number; maxGap: number; started: number }; codeTimer: number }; clearInterval(target.codeTimer); return { ...target.codePerf, totalMs: performance.now() - target.codePerf.started }; });
  expect(metrics.ticks).toBeGreaterThan(0); expect(metrics.maxGap).toBeLessThan(1500); await writeFile('artifacts/phase01d-c-20261027/browser-performance.json', JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: 'artifacts/phase01d-c-20261027/code-1366.png', fullPage: true });
});
