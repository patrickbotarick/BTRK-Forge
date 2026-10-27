import { expect, type Page } from '@playwright/test';
export async function buildVisualDemo(page:Page) {
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByLabel('Padding (px)',{exact:true}).fill('28');
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  await page.getByLabel('Conteúdo textual',{exact:true}).fill('Forge Visual Demo');
  await page.getByLabel('Tamanho da fonte',{exact:true}).fill('32');
  await page.getByRole('button',{name:'+ Input',exact:true}).click();
  await page.getByLabel('Placeholder',{exact:true}).fill('Seu nome');
  await page.getByLabel('Valor inicial',{exact:true}).fill('BTRK Studio');
  await page.getByRole('button',{name:'+ Button',exact:true}).click();
  await page.getByLabel('Texto do componente',{exact:true}).fill('Enviar demonstração');
  await page.getByLabel('Evento de clique',{exact:true}).selectOption('click');
  await page.getByRole('button',{name:'+ Container',exact:true}).click();
  await page.getByLabel('Direção',{exact:true}).selectOption('row');
  await page.getByRole('button',{name:'+ Text',exact:true}).click();
  await page.getByLabel('Conteúdo textual',{exact:true}).fill('Construído visualmente');
  await page.getByRole('button',{name:'Subir',exact:true}).isDisabled();
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  await expect(page.getByLabel('Conteúdo textual',{exact:true})).toHaveValue('Texto');
  await page.getByRole('button',{name:'Refazer',exact:true}).click();
  await expect(page.getByLabel('Conteúdo textual',{exact:true})).toHaveValue('Construído visualmente');
}
