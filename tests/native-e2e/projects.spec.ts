import { test as base, expect } from '@playwright/test';
import { buildVisualDemo } from '../designer-flow';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import type { Project } from '../../packages/project-schema';
import type { ProjectReceipt } from '../../apps/studio/src/project-client';

type Request = { op: string; folderName?: string; documentJson?: string; sessionId?: string };
type Response = { ok: boolean; data?: ProjectReceipt; error?: { code: string; message: string } };
const test = base.extend<{ disk: { path: () => string; read: () => Promise<Project>; corrupt: () => Promise<void>; external: () => Promise<void> } }>({
  disk: async ({ page }, use) => {
    const root = await mkdtemp(resolve('artifacts/native-e2e-'));
    const driver = spawn(resolve('packages/native-persistence/target/debug/examples/persistence_driver.exe'), [root], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let selected = ''; const pending: ((r: Response) => void)[] = [];
    const lines = createInterface({ input: driver.stdout });
    lines.on('line', line => pending.shift()?.(JSON.parse(line)));
    const request = (message: Request) => new Promise<Response>(resolveResult => { pending.push(resolveResult); driver.stdin.write(JSON.stringify(message) + '\n'); });
    await page.exposeFunction('nativeProjectRequest', async (message: Request) => {
      if (message.op === 'open') message.folderName = selected;
      const result = await request(message);
      if (result.ok && ['create', 'saveAs'].includes(message.op)) selected = message.folderName!;
      return result;
    });
    await page.addInitScript(() => {
      const request = async (value: Request) => {
        const response = await (window as unknown as { nativeProjectRequest: (r: Request) => Promise<Response> }).nativeProjectRequest(value);
        if (!response.ok) throw response.error;
        return response.data!;
      };
      window.__FORGE_TEST_PROJECTS__ = {
        create: (folderName, documentJson) => request({ op: 'create', folderName, documentJson }),
        open: () => request({ op: 'open' }),
        save: (sessionId, documentJson) => request({ op: 'save', sessionId, documentJson }),
        saveAs: (folderName, documentJson) => request({ op: 'saveAs', folderName, documentJson }),
        reload: sessionId => request({ op: 'reload', sessionId }),
        restore: sessionId => request({ op: 'restore', sessionId }),
        close: async sessionId => { await request({ op: 'close', sessionId }); },
        exit: async () => { document.documentElement.dataset.closed = 'true'; },
        onCloseRequested: async handler => { window.addEventListener('forge-test-close', handler); return () => window.removeEventListener('forge-test-close', handler); }
      };
    });
    const path = () => join(root, selected, 'project.btrk.json');
    await use({ path, read: async () => JSON.parse(await readFile(path(), 'utf8')), corrupt: () => writeFile(path(), '{corrompido'), external: async () => { const data = JSON.parse(await readFile(path(), 'utf8')); data.name = 'Alterado externamente'; await writeFile(path(), JSON.stringify(data)); } });
    lines.close();driver.stdin.end();driver.kill();
  }
});
async function create(page: import('@playwright/test').Page, name = 'Fundição São José') {
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo projeto' });
  await dialog.getByLabel('Nome da pasta do projeto').fill(name);
  await dialog.getByRole('button', { name: 'Escolher localização' }).click();
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
}
test('criar, editar Blueprint, salvar, fechar e reabrir com IDs e dados preservados', async ({ page, disk }) => {
  await page.goto('/');await create(page);
  const original = await disk.read();
  await expect(page.getByTestId('node')).toHaveCount(8);
  await page.getByRole('button', { name: '+ Constante' }).click();
  await page.getByLabel('Texto do botão').fill('Persistido no Windows');
  await expect(page.getByLabel('Estado do projeto')).toContainText('Alterações não salvas');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
  const saved = await disk.read();expect(saved.id).toBe(original.id);expect(saved.graph.nodes).toHaveLength(9);expect(saved.graph.connections).toEqual(original.graph.connections);
  await page.getByRole('button', { name: 'Fechar projeto' }).click();await expect(page.getByText('Nenhum projeto aberto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir projeto', exact: true }).click();
  await expect(page.getByTestId('node')).toHaveCount(9);await expect(page.getByLabel('Texto do botão')).toHaveValue('Persistido no Windows');
  expect(await disk.read()).toEqual(saved);
  await page.screenshot({ path: 'artifacts/phase01a-project.png', fullPage: true });
});
test('alterações pendentes bloqueiam fechamento e salvamento pode continuar a ação', async ({ page, disk }) => {
  await page.goto('/');await create(page);
  await page.getByLabel('Título', { exact: true }).fill('Não descartar');
  await page.getByRole('button', { name: 'Fechar projeto' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Não descartar');
  await page.evaluate(() => window.dispatchEvent(new Event('forge-test-close')));
  await expect(page.getByRole('dialog', { name: 'Alterações não salvas' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar e continuar' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-closed', 'true');
  expect((await disk.read()).screens[0].title).toBe('Não descartar');
});
test('conflito externo mantém disco e memória e permite salvar cópia', async ({ page, disk }) => {
  await page.goto('/');await create(page);const source = disk.path();
  await page.getByLabel('Título', { exact: true }).fill('Minha alteração');await disk.external();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('memória foi preservado');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Minha alteração');expect((await disk.read()).name).toBe('Alterado externamente');
  await page.getByRole('button', { name: 'Salvar uma cópia', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Salvar como' });await dialog.getByLabel('Nome da pasta do projeto').fill('Cópia segura');await dialog.getByRole('button', { name: 'Escolher localização' }).click();
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
  expect((await disk.read()).screens[0].title).toBe('Minha alteração');expect(JSON.parse(await readFile(source, 'utf8')).name).toBe('Alterado externamente');
});
test('corrupção oferece backup e somente restaura após confirmação', async ({ page, disk }) => {
  await page.goto('/');await create(page);const original = await disk.read();
  await page.getByLabel('Título', { exact: true }).fill('Segunda versão');await page.getByRole('button', { name: 'Salvar', exact: true }).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
  await page.getByRole('button', { name: 'Fechar projeto' }).click();await disk.corrupt();
  await page.getByRole('button', { name: 'Abrir projeto', exact: true }).click();await expect(page.getByRole('status')).toContainText('Cópia válida carregada');
  expect(await readFile(disk.path(), 'utf8')).toBe('{corrompido');
  await page.getByRole('button', { name: 'Restaurar backup' }).click();await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(await readFile(disk.path(), 'utf8')).toBe('{corrompido');
  await page.getByRole('button', { name: 'Restaurar backup' }).click();await page.getByRole('button', { name: 'Confirmar restauração' }).click();
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await disk.read()).toEqual(original);
});
test('erro de nome é localizado e o runtime não altera definição persistente', async ({ page, disk }) => {
  await page.goto('/');await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  await page.getByLabel('Nome da pasta do projeto').fill('CON');await page.getByRole('button', { name: 'Escolher localização' }).click();await expect(page.getByRole('status')).toContainText('nomes reservados');
  await create(page);const saved = await disk.read();
  await page.getByRole('button', { name: 'Executar evento' }).click();await expect(page.getByRole('status')).toContainText('Evento executado');
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await disk.read()).toEqual(saved);expect(basename(disk.path())).toBe('project.btrk.json');
});
test('Design v2 preserva árvore, IDs e propriedades no filesystem Rust real',async({page,disk})=>{
  await page.goto('/');await create(page,'Forge Visual Demo');const initial=await disk.read();await buildVisualDemo(page);await page.keyboard.press('Control+s');await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');const saved=await disk.read();expect(saved.schemaVersion).toBe(3);expect(saved.id).toBe(initial.id);expect(saved.screens[0].components).toHaveLength(7);expect(saved.graph).toEqual(initial.graph);await page.getByRole('button',{name:'Fechar projeto',exact:true}).click();await page.getByRole('button',{name:'Abrir projeto',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await disk.read()).toEqual(saved);await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.frameLocator('iframe').getByText('Forge Visual Demo',{exact:true})).toBeVisible();await page.screenshot({path:'artifacts/phase01b/designer-rust.png',fullPage:true});
});
test('abrir v1 migra apenas em memória e Salvar mantém backup dos bytes antigos',async({page,disk})=>{
  await page.goto('/');await create(page);await page.getByRole('button',{name:'Fechar projeto',exact:true}).click();const legacy=await readFile('tests/fixtures/projects/phase0-v1.json','utf8');await writeFile(disk.path(),legacy);await page.getByRole('button',{name:'Abrir projeto',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await readFile(disk.path(),'utf8')).toBe(legacy);await page.getByRole('button',{name:'Design',exact:true}).click();await expect(page.locator('.tree-select')).toHaveCount(1);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect((await disk.read()).schemaVersion).toBe(3);expect(await readFile(disk.path().replace('project.btrk.json','project.btrk.backup.json'),'utf8')).toBe(legacy);
});
test('salvar mantém histórico apesar da ordenação JSON do recibo Rust',async({page,disk})=>{
  await page.goto('/');await create(page);await buildVisualDemo(page);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');const saved=await disk.read();await expect(page.getByRole('button',{name:'Desfazer',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Desfazer',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toContainText('Alterações não salvas');await page.getByRole('button',{name:'Refazer',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await disk.read()).toEqual(saved);
});
import {buildLogicDemo,verifyLogicDemo} from '../logic-flow';
test('lógica visual v3 salva e reabre pelo serviço Rust mantendo eventos e IDs',async({page,disk})=>{test.setTimeout(120000);await page.goto('/');await create(page,'Forge Logic Demo');await buildLogicDemo(page);await verifyLogicDemo(page);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');const before=await disk.read();expect(before.schemaVersion).toBe(3);expect(before.graph.nodes).toHaveLength(21);expect(before.graph.connections).toHaveLength(21);expect(before.variables.find(v=>v.name==='Nome')?.initial).toBe('');await page.getByRole('button',{name:'Fechar projeto',exact:true}).click();await page.getByRole('button',{name:'Abrir projeto',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect((await disk.read()).graph).toEqual(before.graph);await verifyLogicDemo(page);});
