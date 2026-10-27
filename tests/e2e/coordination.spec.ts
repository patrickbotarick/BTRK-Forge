import { test, expect, type Page } from '@playwright/test';
import { exampleProject } from '../../packages/forge-core/example';
import { logicFixture } from '../logic-fixture';
import type { Project } from '../../packages/project-schema';
import type { RuntimeEvent, RuntimeState } from '../../packages/blueprint-core';

interface Request { requestId: number; runtime: RuntimeState; event: RuntimeEvent }
interface ControlledWorker { requests: Request[]; terminated: boolean; complete(id?: number, count?: number): void }
type TestWindow = typeof window & { forgeWorkers: ControlledWorker[] };

async function controlled(page: Page, project: Project) {
  await page.addInitScript(project => {
    localStorage.setItem('btrk-forge:phase0:project', JSON.stringify(project));
    const target = window as TestWindow; target.forgeWorkers = [];
    class FixedTestWorker {
      requests: Request[] = [];
      terminated = false;
      onmessage: ((message: { data: unknown }) => void) | null = null;
      constructor() { target.forgeWorkers.push(this); }
      postMessage(request: Request) { this.requests.push(structuredClone(request)); }
      terminate() { this.terminated = true; }
      complete(id?: number, count?: number) {
        const request = this.requests.at(-1)!;
        const runtime = structuredClone(request.runtime);
        if (request.event.type === 'input.change') {
          runtime.variables.name = request.event.value; runtime.properties['name-input'] = request.event.value; runtime.properties['result-text'] = request.event.value;
        } else runtime.variables.count = count ?? Number(runtime.variables.count) + 1;
        this.onmessage?.({ data: { ok: true, requestId: id ?? request.requestId, runtime, event: request.event, trace: [], executedNodes: [], values: {} } });
      }
    }
    target.Worker = FixedTestWorker as unknown as typeof Worker;
  }, project);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as TestWindow).forgeWorkers.length)).toBe(1);
}

test('coordenação: FIFO de 32 aguardando, estado encadeado e resposta atrasada recusada', async ({ page }) => {
  await controlled(page, exampleProject());
  await page.getByRole('button', { name: '▶ Executar evento', exact: true }).evaluate(button => { for (let i = 0; i < 34; i++) (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('status')).toContainText('fila de eventos excede 32');
  expect(await page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests.length)).toBe(1);
  await page.evaluate(() => (window as TestWindow).forgeWorkers[0].complete());
  expect(await page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests[1].runtime.variables.count)).toBe(1);
  await expect(page.getByLabel('Variáveis runtime')).toContainText('Contador: 0');
  await page.evaluate(() => (window as TestWindow).forgeWorkers[0].complete(1, 999));
  expect(await page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests.length)).toBe(2);
  await page.evaluate(() => { const worker = (window as TestWindow).forgeWorkers[0]; for (let i = 0; i < 32; i++) worker.complete(); });
  await expect(page.getByLabel('Variáveis runtime')).toContainText('Contador: 33');
  const requests = await page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests);
  expect(requests.map(r => r.requestId)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
  expect(requests.map(r => r.runtime.variables.count)).toEqual(Array.from({ length: 33 }, (_, i) => i));
});

test('coordenação: eventos Input distintos mantêm ordem e recebem o estado anterior', async ({ page }) => {
  await controlled(page, logicFixture());
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.frameLocator('iframe').locator('input').evaluate(input => {
    for (const value of ['Ana', 'Bia', 'Caio']) { (input as HTMLInputElement).value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests.length)).toBe(i + 1);
    await page.evaluate(() => (window as TestWindow).forgeWorkers[0].complete());
  }
  const requests = await page.evaluate(() => (window as TestWindow).forgeWorkers[0].requests);
  expect(requests.map(r => r.event.type === 'input.change' ? r.event.value : null)).toEqual(['Ana', 'Bia', 'Caio']);
  expect(requests.map(r => r.runtime.variables.name)).toEqual(['', 'Ana', 'Bia']);
  await expect(page.frameLocator('iframe').locator('input')).toHaveValue('Caio');
});

test('coordenação: reinício termina Worker e ignora resposta da sessão anterior', async ({ page }) => {
  await controlled(page, exampleProject());
  await page.getByRole('button', { name: '▶ Executar evento', exact: true }).click();
  await page.getByRole('button', { name: 'Reiniciar estado', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as TestWindow).forgeWorkers.length)).toBe(2);
  expect(await page.evaluate(() => (window as TestWindow).forgeWorkers[0].terminated)).toBe(true);
  await page.getByRole('button', { name: '▶ Executar evento', exact: true }).click();
  await page.evaluate(() => (window as TestWindow).forgeWorkers[0].complete(undefined, 999));
  await expect(page.getByLabel('Variáveis runtime')).toContainText('Contador: 0');
  expect(await page.evaluate(() => (window as TestWindow).forgeWorkers[1].requests[0].requestId)).toBe(2);
  await page.evaluate(() => (window as TestWindow).forgeWorkers[1].complete());
  await expect(page.getByLabel('Variáveis runtime')).toContainText('Contador: 1');
});
