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
