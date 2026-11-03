import { test, expect } from '@playwright/test';
import type { Project } from '../../packages/project-schema';

test('dimensões em lote, undo e viewport compartilhada com Preview isolado',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  await page.getByLabel('Largura',{exact:true}).selectOption('px');
  await page.getByLabel('Largura em pixels').fill('160');
  await page.getByLabel('Largura em pixels').press('Enter');
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('btrk-forge:phase0:project')!) as Project);
  const before=await read();
  const texts=before.screens[0].components.filter(c=>c.type==='Text');
  const first=texts.at(-2)!;
  await page.locator(`.tree-select[title="${first.id}"]`).click({modifiers:['Control']});
  await expect(page.getByLabel('Largura',{exact:true})).toHaveValue('');
  await page.getByLabel('Largura',{exact:true}).selectOption('px');
  await page.getByLabel('Largura em pixels').fill('2001');
  await page.getByRole('button',{name:'Aplicar largura'}).click();
  await expect(page.getByRole('alert')).toContainText('0 e 2000');
  expect(await read()).toEqual(before);
  await page.getByLabel('Largura',{exact:true}).selectOption('fill');
  await page.getByRole('button',{name:'Aplicar largura'}).click();
  const after=await read();
  expect(after.screens[0].components.filter(c=>c.type==='Text').slice(-2).map(c=>c.style.width)).toEqual(['fill','fill']);
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  expect(await read()).toEqual(before);
  await page.getByRole('button',{name:'Refazer',exact:true}).click();
  expect(await read()).toEqual(after);
  const selector=`[data-component-id="${first.id}"]`;
  for(const viewport of ['mobile','web','desktop']){
    await page.getByLabel('Viewport Design').selectOption(viewport);
    await expect(page.getByTestId('design-canvas').locator(selector)).toHaveCSS('max-width','100%');
    const design=await page.getByTestId('design-canvas').locator(selector).evaluate(e=>e.style.width);
    if(viewport==='mobile')await page.screenshot({path:'artifacts/phase01g-b2/design-mobile.png'});
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    await expect(page.getByLabel('Viewport',{exact:true})).toHaveValue(viewport);
    const rendered=page.frameLocator('iframe').locator(selector);
    await expect(rendered).toBeVisible();
    expect(await rendered.evaluate(e=>(e as HTMLElement).style.width)).toBe(design);
    if(viewport==='mobile')await page.screenshot({path:'artifacts/phase01g-b2/preview-mobile.png'});
    await page.getByRole('button',{name:'Design',exact:true}).click();
  }
  await page.reload();
  expect(await read()).toEqual(after);
});

test('largura, altura e alinhamento atingem pai, filho e neto selecionados',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('btrk-forge:phase0:project')!) as Project);
  const before=await read();
  const [parent,child,grandchild]=before.screens[0].components.slice(-3);
  const row=(id:string)=>page.locator(`.tree-select[title="${id}"]`);
  await row(parent.id).click();
  await row(grandchild.id).click({modifiers:['Shift']});
  await expect(row(child.id)).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Largura',{exact:true})).toHaveValue('');
  for(const [label,value] of [['Largura','300'],['Altura','120']]){
    await page.getByLabel(label,{exact:true}).selectOption('px');
    await page.getByLabel(label+' em pixels').fill(value);
    await page.getByRole('button',{name:'Aplicar '+label.toLowerCase()}).click();
  }
  await page.getByLabel('Alinhamento do texto em lote').selectOption('center');
  const applied=await read();
  expect(applied.screens[0].components.slice(-3).map(c=>[c.style.width,c.style.height,c.style.textAlign]))
    .toEqual([[300,120,'center'],[300,120,'center'],[300,120,'center']]);
  const undo=page.getByRole('button',{name:'Desfazer',exact:true});
  for(let i=0;i<3;i++)await undo.click();
  expect(await read()).toEqual(before);
  const redo=page.getByRole('button',{name:'Refazer',exact:true});
  for(let i=0;i<3;i++)await redo.click();
  expect(await read()).toEqual(applied);
  await page.reload();
  expect(await read()).toEqual(applied);
});
