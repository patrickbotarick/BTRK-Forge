import { expect,type Page } from '@playwright/test';
export async function buildLogicDemo(page:Page){
 const button=(name:string)=>page.getByRole('button',{name,exact:true});
 const label=(name:string)=>page.getByLabel(name,{exact:true});
 await button('Design').click();await page.locator('.tree-select[title="button-count"]').click();await button('Remover').click();await button('Confirmar remoção').click();
 await button('+ Container').click();const root=(await page.locator('.component-id').innerText()).trim();
 await button('+ Text').click();await label('Conteúdo textual').fill('Forge Logic Demo');const title=(await page.locator('.component-id').innerText()).trim();
 await button('+ Input').click();await label('Placeholder').fill('Seu nome');const input=(await page.locator('.component-id').innerText()).trim();
 await button('+ Button').click();await label('Texto do componente').fill('Confirmar');const confirm=(await page.locator('.component-id').innerText()).trim();
 await button('+ Text').click();await label('Conteúdo textual').fill('Resultado');const result=(await page.locator('.component-id').innerText()).trim();
 await page.locator(`.tree-select[title="${confirm}"]`).click();await button('Abrir comportamento no Blueprint').click();const click=await label('Node selecionado').inputValue();
 await label('Nome da variável').fill('Nome');await label('Valor inicial da variável').fill('');await button('Criar variável').click();
 await button('Design').click();await page.locator(`.tree-select[title="${input}"]`).click();await label('Binding do Input').selectOption({label:await label('Binding do Input').locator('option').last().innerText()});await button('Abrir comportamento no Blueprint').click();const change=await label('Node selecionado').inputValue();
 async function add(name:string,value?:string,component?:string){await button('Adicionar '+name).click();const id=await label('Node selecionado').inputValue();if(value!==undefined)await label('Valor constante').fill(value);if(component)await label('Componente do node').selectOption(component);return id;}
 const read=await add('Ler componente',undefined,input),empty=await add('Texto vazio'),branch=await add('Condição');
 const prompt=await add('Constante de texto','Digite seu nome'),prefix=await add('Constante de texto','Olá, '),suffix=await add('Constante de texto','!');
 const concat=await add('Concatenar'),greeting=await add('Concatenar'),yes=await add('Definir texto',undefined,result),no=await add('Definir texto',undefined,result),typing=await add('Definir texto',undefined,result);
 async function connect(source:string,output:string,target:string,input:string){await label('Node de saída').selectOption(source);await label('Porta de saída').selectOption(output);await label('Node de entrada').selectOption(target);await label('Porta de entrada').selectOption(input);await button('Conectar').click();await expect(page.getByRole('status')).not.toContainText('Erro');}
 await connect(click,'next',branch,'in');await connect(read,'value',empty,'value');await connect(empty,'value',branch,'test');await connect(branch,'yes',yes,'in');await connect(branch,'no',no,'in');await connect(prompt,'value',yes,'value');await connect(prefix,'value',concat,'a');await connect(read,'value',concat,'b');await connect(concat,'value',greeting,'a');await connect(suffix,'value',greeting,'b');await connect(greeting,'value',no,'value');await connect(change,'next',typing,'in');await connect(read,'value',typing,'value');
 await expect(page.locator('.graph-diagnostics')).toContainText('Grafo pronto');return {root,title,input,confirm,result,click,change,read,empty,branch,prompt,prefix,suffix,concat,greeting,yes,no,typing};
}
export async function verifyLogicDemo(page:Page){await page.getByRole('button',{name:'Preview',exact:true}).click();const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(frame.getByText('Digite seu nome',{exact:true})).toBeVisible();await frame.getByPlaceholder('Seu nome').fill('Ana');await expect(frame.getByText('Ana',{exact:true})).toBeVisible();await frame.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(frame.getByText('Olá, Ana!',{exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('Evento executado');}
