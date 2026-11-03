import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../../packages/project-schema';

const read=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('btrk-forge:phase0:project')!) as Project);

test('seleção simples, Ctrl no canvas, Shift na árvore e edição comum com undo/redo',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Design',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'+ Text',exact:true}).click();
  const project=await read(page);
  const [first,second,third]=project.screens[0].components.filter(c=>c.type==='Text').slice(-3);
  const tree=(id:string)=>page.locator(`.tree-select[title="${id}"]`);
  const canvas=(id:string)=>page.getByTestId('design-canvas').locator(`[data-component-id="${id}"]`);
  await tree(first.id).click();
  await expect(tree(first.id)).toHaveAttribute('aria-pressed','true');
  await canvas(third.id).click({modifiers:['Control']});
  await expect(tree(third.id)).toHaveAttribute('aria-pressed','true');
  await expect(canvas(first.id)).toHaveAttribute('aria-pressed','true');
  await tree(first.id).click();
  await tree(third.id).click({modifiers:['Shift']});
  await expect(tree(second.id)).toHaveAttribute('aria-pressed','true');
  await expect(canvas(second.id)).toHaveAttribute('aria-pressed','true');
  expect(await read(page)).toEqual(project);
  await page.screenshot({path:'artifacts/phase01g-b1/multiselect-web.png'});
  await page.getByLabel('Alinhamento do texto em lote').selectOption('right');
  const edited=await read(page);
  expect(edited.screens[0].components.filter(c=>[first.id,second.id,third.id].includes(c.id)).every(c=>c.style.textAlign==='right')).toBe(true);
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  expect(await read(page)).toEqual(project);
  await page.getByRole('button',{name:'Refazer',exact:true}).click();
  expect(await read(page)).toEqual(edited);
  await page.reload();
  expect(await read(page)).toEqual(edited);
});

test('teclado estende o intervalo e remoção de pai e filho ocorre em um passo',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  const before=await read(page);
  const parent=before.screens[0].components.find(c=>c.type==='Container')!;
  const child=before.screens[0].components.find(c=>c.parentId===parent.id)!;
  const parentButton=page.locator(`.tree-select[title="${parent.id}"]`);
  const childButton=page.locator(`.tree-select[title="${child.id}"]`);
  await parentButton.click();
  await parentButton.press('Shift+ArrowDown');
  await expect(childButton).toBeFocused();
  await expect(childButton).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Remover seleção'}).click();
  await page.getByRole('button',{name:'Confirmar remoção'}).click();
  await expect(page.locator('.screen-select')).toBeFocused();
  expect((await read(page)).screens[0].components).toHaveLength(before.screens[0].components.length-2);
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  expect(await read(page)).toEqual(before);
  await expect(childButton).toHaveAttribute('aria-pressed','false');
});
