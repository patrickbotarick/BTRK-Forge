import { test, expect, type Locator } from '@playwright/test';

test('ajusta o workspace sem editar o projeto nem perder o Preview',async({page},testInfo)=>{
  await page.goto('/');
  const mode=(name:string)=>page.getByRole('button',{name,exact:true});
  await mode('Design').click();
  await mode('+ Panel').click();
  const project=()=>page.evaluate(()=>localStorage.getItem('btrk-forge:phase0:project'));
  const original=await project();
  const selected=page.locator('.tree-select[aria-pressed=true]');
  const id=await selected.getAttribute('title');
  const left=page.getByRole('separator',{name:'Largura da biblioteca e hierarquia'});
  const right=page.getByRole('separator',{name:'Largura do Inspector'});
  const consoleBar=page.getByRole('separator',{name:'Altura do console'});
  const drag=async(locator:Locator,dx:number,dy:number)=>{
    const box=(await locator.boundingBox())!;
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+dx,y+dy,{steps:5});
    await page.mouse.up();
  };
  await drag(left,40,0);
  await expect(left).toHaveAttribute('aria-valuenow','260');
  await drag(right,-40,0);
  await expect(right).toHaveAttribute('aria-valuenow','310');
  await right.press('ArrowRight');
  await expect(right).toHaveAttribute('aria-valuenow','302');
  await left.press('Home');
  await expect(left).toHaveAttribute('aria-valuenow','160');
  await mode('Recolher Biblioteca e hierarquia').click();
  await expect(left).toHaveCount(0);
  expect((await page.locator('.design-center').boundingBox())!.width).toBeGreaterThan(500);
  await mode('Reabrir Biblioteca e hierarquia').click();
  await expect(selected).toHaveAttribute('title',id!);
  await mode('Recolher Inspector').click();
  expect((await page.locator('.design-center').boundingBox())!.width).toBeGreaterThan(500);
  await mode('Reabrir Inspector').click();
  await expect(page.getByLabel('Padding (px)')).toHaveValue('16');
  await mode('Restaurar layout do Designer').click();
  await expect(right).toHaveAttribute('aria-valuenow','270');

  for(const [width,height] of [[1440,920],[1000,700],[1920,1080]]){
    await page.setViewportSize({width,height});
    await page.getByLabel('Viewport Design').selectOption('web');
    const artboard=await page.locator('.design-artboard').boundingBox();
    const center=await page.locator('.design-center').boundingBox();
    expect(artboard!.width).toBe(768);
    expect(center!.width).toBeGreaterThanOrEqual(320);
    await testInfo.attach(`layout-${width}x${height}`,{body:JSON.stringify({viewport:{width,height},center,artboard}),contentType:'application/json'});
  }

  await mode('Preview').click();
  const iframe=page.locator('iframe[title="Preview isolado"]');
  await expect(iframe).toBeVisible();
  await iframe.evaluate(element=>{element.dataset.resizeProbe='mounted';});
  const before=Number(await consoleBar.getAttribute('aria-valuenow'));
  await drag(consoleBar,0,-50);
  await expect(consoleBar).toHaveAttribute('aria-valuenow',String(before+50));
  await mode('Recolher console').click();
  await mode('Reabrir console').click();
  await expect(iframe).toHaveAttribute('data-resize-probe','mounted');
  await mode('Restaurar console').click();
  await expect(consoleBar).toHaveAttribute('aria-valuenow','158');
  await mode('Blueprint').click();
  await mode('Código').click();
  await mode('Design').click();
  expect(await project()).toBe(original);
  await expect(selected).toHaveAttribute('title',id!);
  await page.getByLabel('Padding (px)').fill('20');
  await page.getByLabel('Padding (px)').press('Enter');
  await expect.poll(project).not.toBe(original);
});
