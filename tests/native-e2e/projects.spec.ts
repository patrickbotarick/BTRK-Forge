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
  await page.goto('/');await create(page);await page.getByRole('button',{name:'Fechar projeto',exact:true}).click();const legacy=await readFile('tests/fixtures/projects/phase0-v1.json','utf8');await writeFile(disk.path(),legacy);await page.getByRole('button',{name:'Abrir projeto',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await readFile(disk.path(),'utf8')).toBe(legacy);await page.getByRole('button',{name:'Código',exact:true}).click();await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state','ready',{timeout:20000});expect(await readFile(disk.path(),'utf8')).toBe(legacy);await page.getByRole('button',{name:'Design',exact:true}).click();await expect(page.locator('.tree-select')).toHaveCount(1);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect((await disk.read()).schemaVersion).toBe(3);expect(await readFile(disk.path().replace('project.btrk.json','project.btrk.backup.json'),'utf8')).toBe(legacy);
});
test('salvar mantém histórico apesar da ordenação JSON do recibo Rust',async({page,disk})=>{
  await page.goto('/');await create(page);await buildVisualDemo(page);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');const saved=await disk.read();await expect(page.getByRole('button',{name:'Desfazer',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Desfazer',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toContainText('Alterações não salvas');await page.getByRole('button',{name:'Refazer',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect(await disk.read()).toEqual(saved);
});
import {buildLogicDemo,verifyLogicDemo} from '../logic-flow';
test('lógica visual v3 salva e reabre pelo serviço Rust mantendo eventos e IDs',async({page,disk})=>{test.setTimeout(120000);await page.goto('/');await create(page,'Forge Logic Demo');await buildLogicDemo(page);await verifyLogicDemo(page);await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');const before=await disk.read();expect(before.schemaVersion).toBe(3);expect(before.graph.nodes).toHaveLength(21);expect(before.graph.connections).toHaveLength(21);expect(before.variables.find(v=>v.name==='Nome')?.initial).toBe('');await page.getByRole('button',{name:'Fechar projeto',exact:true}).click();await page.getByRole('button',{name:'Abrir projeto',exact:true}).click();await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');expect((await disk.read()).graph).toEqual(before.graph);await verifyLogicDemo(page);});

test('Code Demo nativo: navegação não suja projeto, JSON pendente é protegido e sessão reabre', async ({ page, disk }) => {
  test.setTimeout(120000);
  let loads = 0; page.on('request', r => { if (r.url().includes('generation.worker')) loads++; });
  await page.goto('/'); await create(page, 'Forge Code Demo'); await buildLogicDemo(page); await verifyLogicDemo(page);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); const before = await disk.read();
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Node selecionado', { exact: true }).selectOption('sum'); await page.getByRole('button', { name: 'Ver código do node', exact: true }).click();
  await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); const revision = await page.locator('.generated-editor').getAttribute('data-revision');
  await page.getByLabel('Ocorrência no TypeScript').selectOption('1'); await page.getByRole('button', { name: 'Localizar no Blueprint', exact: true }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('data-revealed-node-id', 'sum'); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
  await page.getByRole('button', { name: 'Ver código do node', exact: true }).click(); await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready'); expect(loads).toBe(1);
  await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click(); const json = page.getByRole('textbox', { name: 'Modelo JSON editável', exact: true });
  const edited = structuredClone(before); edited.name = 'Não aplicado'; await page.context().grantPermissions(['clipboard-read', 'clipboard-write']); await page.evaluate(text => navigator.clipboard.writeText(text), JSON.stringify(edited, null, 2)); await json.focus(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+v');
  await expect(page.getByLabel('Estado do projeto')).toContainText('Alterações não salvas'); await page.getByRole('tab', { name: 'TypeScript gerado', exact: true }).click();
  await page.getByRole('button', { name: 'Localizar no Blueprint', exact: true }).click(); await expect(page.locator('.console [role=status]')).toContainText('Aplique ou reverta');
  await page.getByRole('tab', { name: 'Modelo JSON', exact: true }).click(); await page.getByRole('button', { name: 'Reverter edição JSON', exact: true }).click(); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco');
  await page.getByRole('tab', { name: 'TypeScript gerado', exact: true }).click(); await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); expect(loads).toBe(1);
  const saved = await disk.read(); expect(saved.graph).toEqual(before.graph); expect(saved).not.toHaveProperty('generated'); expect(saved).not.toHaveProperty('code');
  await page.getByRole('button', { name: 'Fechar projeto', exact: true }).click(); await expect(page.getByText('Nenhum projeto aberto', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Código', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir projeto', exact: true }).click(); await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.locator('.generated-editor')).toHaveAttribute('data-revision', revision!); expect(loads).toBe(2); expect(await disk.read()).toEqual(saved);
  await page.screenshot({ path: 'artifacts/phase01d-c-20261027/code-native-driver.png', fullPage: true });
  const previousPath = disk.path(); await page.getByRole('button', { name: 'Fechar projeto', exact: true }).click(); await create(page, 'Forge Code Demo 2');
  await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.locator('.generated-editor')).not.toHaveAttribute('data-revision', revision!);
  expect((await disk.read()).id).not.toBe(before.id); expect(JSON.parse(await readFile(previousPath, 'utf8'))).toEqual(saved); expect(loads).toBe(3);
});
import { mkdir, copyFile } from 'node:fs/promises';
test('Forge Debug Demo pela UI/Rust: histórico, navegação, rollback e manifesto sem diagnóstico', async ({ page, disk }) => {
  test.setTimeout(120000); await page.goto('/'); await create(page, 'Forge Debug Demo'); const ids = await buildLogicDemo(page); await verifyLogicDemo(page);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); const saved = await disk.read();
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(3); await expect(page.getByLabel('Inspeção de variáveis')).toContainText('Ana');
  await page.locator('li[data-kind="set-text"]').getByRole('button', { name: 'Blueprint ' + ids.no, exact: true }).click(); await expect(page.getByTestId('graph')).toHaveAttribute('data-revealed-node-id', ids.no);
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await page.locator('li[data-kind="set-text"]').getByRole('button', { name: 'Código ' + ids.no, exact: true }).click(); await expect(page.getByLabel('Estado da geração')).toHaveAttribute('data-state', 'ready', { timeout: 20000 }); await expect(page.locator('.generated-editor')).toHaveAttribute('data-node-id', ids.no); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); expect(await disk.read()).toEqual(saved);
  await mkdir('artifacts/phase01d-d-20261027/native-demo/Forge Debug Demo', { recursive: true }); await copyFile(disk.path(), 'artifacts/phase01d-d-20261027/native-demo/Forge Debug Demo/project.btrk.json');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click(); await page.getByLabel('Node selecionado', { exact: true }).selectOption(ids.prefix); await page.getByLabel('Valor constante', { exact: true }).fill('x'.repeat(1000));
  await page.getByRole('button', { name: 'Adicionar Definir texto', exact: true }).click(); const explode = await page.getByLabel('Node selecionado', { exact: true }).inputValue(); await page.getByLabel('Componente do node', { exact: true }).selectOption(ids.result);
  for (const [source, output, target, input] of [[ids.typing, 'next', explode, 'in'], [ids.greeting, 'value', explode, 'value']]) { await page.getByLabel('Node de saída', { exact: true }).selectOption(source); await page.getByLabel('Porta de saída', { exact: true }).selectOption(output); await page.getByLabel('Node de entrada', { exact: true }).selectOption(target); await page.getByLabel('Porta de entrada', { exact: true }).selectOption(input); await page.getByRole('button', { name: 'Conectar', exact: true }).click(); }
  await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); const faultSaved = await disk.read();
  await mkdir('artifacts/phase01d-d-20261027/native-demo/Forge Debug Rollback', { recursive: true }); await copyFile(disk.path(), 'artifacts/phase01d-d-20261027/native-demo/Forge Debug Rollback/project.btrk.json');
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.frameLocator('iframe').getByPlaceholder('Seu nome').fill('Bia'); await expect(page.locator('.console [role=status]')).toContainText('1000 caracteres');
  await page.getByRole('button', { name: 'Depuração', exact: true }).click(); await expect(page.getByLabel('Depuração runtime')).toContainText('Rollback · ações revertidas; ingestão preservada'); await expect(page.locator('li[data-kind="rollback"]').first()).toContainText('"Bia" → string: "Resultado"');
  await expect(page.getByLabel('Estado do projeto')).toHaveText('✓ Salvo no disco'); expect(await disk.read()).toEqual(faultSaved); expect(faultSaved).not.toHaveProperty('debug'); expect(faultSaved).not.toHaveProperty('runtime');
  await page.locator('li[data-kind="rollback"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/phase01d-d-20261027/debug-native-driver.png', fullPage: true });
  await page.getByRole('button', { name: 'Reiniciar estado', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(0); await expect(page.getByLabel('Inspeção de variáveis')).not.toContainText('Bia');
  await page.getByRole('button', { name: 'Fechar projeto', exact: true }).click(); await page.getByRole('button', { name: 'Abrir projeto', exact: true }).click(); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(0); expect((await disk.read()).graph).toEqual(faultSaved.graph);
  await page.getByRole('button', { name: 'Fechar projeto', exact: true }).click(); await create(page, 'Outro projeto'); await expect(page.getByLabel('Histórico de eventos').getByRole('button')).toHaveCount(0); expect((await disk.read()).id).not.toBe(saved.id);
});
