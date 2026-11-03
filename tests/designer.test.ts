import { lowerBlueprint } from '../packages/blueprint-ir';
import { generateTypeScript } from '../packages/typescript-codegen';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { exampleProject } from '../packages/forge-core/example';
import { readDocument, writeDocument } from '../packages/forge-core/project-document';
import { editProject, EditHistory } from '../packages/designer-core';
import { component } from '../packages/project-schema';
import { rendererSource } from '../packages/preview-runtime/visual-renderer-source';
import { validateProject } from '../packages/blueprint-core';
describe('Designer declarativo v2',()=>{
  it('cria os quatro tipos com identidades distintas e sem mudar o Blueprint',()=>{
    let p=exampleProject();const graph=structuredClone(p.graph);let parentId:string|null=null;
    for(const type of ['Container','Text','Input','Button'] as const){const r=editProject(p,{kind:'add',type,parentId});p=r.project;if(type==='Container')parentId=r.selectedId;}
    expect(new Set(p.screens[0].components.map(c=>c.id)).size).toBe(5);expect(p.graph).toEqual(graph);expect(readDocument(writeDocument(p))).toEqual(p);
  });
  it('reordena e move sem perder identidade; duplicação remapeia pais internos',()=>{
    let p=exampleProject();const a=component('Container','panel');const b=component('Text','title','panel');p.screens[0].components.push(a,b);
    p=editProject(p,{kind:'move',id:'panel',parentId:null,index:0}).project;expect(p.screens[0].components[0].id).toBe('panel');
    const copy=editProject(p,{kind:'duplicate',id:'panel'});const copiedChildren=copy.project.screens[0].components.filter(c=>c.parentId===copy.selectedId);expect(copiedChildren).toHaveLength(1);expect(copiedChildren[0].id).not.toBe('title');
    p=editProject(p,{kind:'move',id:'button-count',parentId:'panel',index:0}).project;expect(p.screens[0].components.filter(c=>c.parentId==='panel')[0].id).toBe('button-count');
    const graph=structuredClone(p.graph);p=editProject(p,{kind:'remove',id:'panel'}).project;expect(p.screens[0].components).toHaveLength(0);expect(p.graph).toEqual(graph);
  });
  it('não aceita ciclos, pais folha/ausentes ou edição parcial inválida',()=>{
    const p=exampleProject();p.screens[0].components.push(component('Container','panel'),component('Container','child','panel'));
    for(const parentId of ['child','missing','button-count'])expect(()=>editProject(p,{kind:'move',id:'panel',parentId,index:0})).toThrow();
    expect(p.screens[0].components.find(c=>c.id==='panel')?.parentId).toBeNull();
    const bad=component('Text','bad');bad.style.fontSize=999;expect(()=>editProject(p,{kind:'update',id:'button-count',component:bad})).toThrow();
  });
  it('valida tipos, propriedades desconhecidas, IDs globais e eventos',()=>{
    const p=exampleProject();const text=component('Text','title');p.screens[0].components.push(text);
    for(const mutate of [(q:typeof p)=>q.screens[0].components.push({...text,id:'click'}),(q:typeof p)=>Object.assign(q.screens[0].components[1].style,{background:'url(javascript:x)'}),(q:typeof p)=>Object.assign(q.screens[0].components[1],{html:'<script>'}),(q:typeof p)=>Object.assign(q.screens[0].components[0].events,{click:'sum'})]){const q=structuredClone(p);mutate(q);expect(()=>validateProject(q)).toThrow();}
  });
  it('limita 200 componentes e 12 níveis inclusive ciclos desconectados',()=>{
    const p=exampleProject();p.screens[0].components=Array.from({length:200},(_,i)=>component('Text',`text-${i}`));expect(()=>writeDocument(p)).not.toThrow();expect(()=>editProject(p,{kind:'add',type:'Text',parentId:null})).toThrow();
    p.screens[0].components=Array.from({length:12},(_,i)=>component('Container',`panel-${i}`,i?`panel-${i-1}`:null));expect(()=>writeDocument(p)).not.toThrow();p.screens[0].components.push(component('Text','too-deep','panel-11'));expect(()=>writeDocument(p)).toThrow(/Profundidade/);
  });
  it('undo/redo restaura documentos completos e nova operação limpa o futuro',()=>{
    const history=new EditHistory();const p=exampleProject();const next=editProject(p,{kind:'add',type:'Input',parentId:null}).project;history.record(p,next);expect(history.undo(next)).toEqual(p);expect(history.redo(p)).toEqual(next);history.undo(next);history.record(p,editProject(p,{kind:'add',type:'Text',parentId:null}).project);expect(history.canRedo).toBe(false);
  });
  it('histórico descarta operações além de 100 sem tocar no documento',()=>{
    const history=new EditHistory();let p=exampleProject();for(let i=0;i<105;i++){const next=structuredClone(p);next.screens[0].title=String(i);history.record(p,next);p=next;}let count=0;while(history.canUndo){p=history.undo(p);count++;}expect(count).toBe(100);expect(p.screens[0].title).toBe('4');
  });
  it('migra v1 em memória preservando IDs/grafo e recusa legado adulterado',()=>{
    const bytes=readFileSync('tests/fixtures/projects/phase0-v1.json','utf8');const old=JSON.parse(bytes);const p=readDocument(bytes);expect(p.schemaVersion).toBe(4);expect(p.graph).toEqual(old.graph);expect(p.screens[0].components[0].id).toBe(old.screens[0].button.id);expect(p.variables).toEqual(old.variables);expect(readFileSync('tests/fixtures/projects/phase0-v1.json','utf8')).toBe(bytes);old.screens[0].button.script='x';expect(()=>readDocument(JSON.stringify(old))).toThrow();
  });
  it('mantém renderizador do iframe gerado da mesma implementação do canvas',()=>{
    const source=ts.transpileModule(readFileSync('packages/preview-runtime/visual-renderer.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText.replace('export function renderVisual','function renderVisual');expect(rendererSource).toBe(source);
  });
});

it('persiste Panel de uma fixture legada como Container sem alterar IR ou código',async()=>{
  const original=readDocument(readFileSync('tests/fixtures/projects/phase0-v1.json','utf8'));
  const root=editProject(original,{kind:'add',type:'Panel',parentId:null});
  const child=editProject(root.project,{kind:'add',type:'Panel',parentId:root.selectedId});
  const reopened=readDocument(writeDocument(child.project));
  expect(reopened).toEqual(child.project);
  expect(reopened.schemaVersion).toBe(4);
  const panel=reopened.screens[0].components.at(-1)!;
  expect(panel).toMatchObject({type:'Container',parentId:root.selectedId,
    props:{padding:16,gap:12,direction:'column'},
    style:{background:'#F1F5F9',color:'#1E293B',borderColor:'#64748B',borderWidth:1,width:'fill',height:'auto'}});
  const copy=editProject(reopened,{kind:'duplicate',id:panel.id});
  expect(copy.selectedId).not.toBe(panel.id);
  expect(copy.project.screens[0].components.find(c=>c.id===copy.selectedId)).toEqual({...panel,id:copy.selectedId});
  const moved=editProject(copy.project,{kind:'move',id:copy.selectedId!,parentId:null,index:0});
  expect(moved.project.screens[0].components[0]).toMatchObject({id:copy.selectedId,parentId:null});
  const reordered=editProject(moved.project,{kind:'batch-reorder',ids:[copy.selectedId!],direction:1});
  expect(reordered.project.screens[0].components.filter(c=>c.parentId===null)[1].id).toBe(copy.selectedId);
  const removed=editProject(reordered.project,{kind:'remove',id:copy.selectedId!});
  expect(removed.project.screens[0].components.some(c=>c.id===copy.selectedId)).toBe(false);
  const equivalent=structuredClone(original);
  for(const {id,parentId} of reopened.screens[0].components.slice(-2)){
    equivalent.screens[0].components.push(component('Container',id,parentId));
  }
  const before=lowerBlueprint(equivalent), after=lowerBlueprint(reopened);
  if(!before.ok||!after.ok)throw new Error('Blueprint inválido');
  expect(after.ir).toEqual(before.ir);
  const generated=await generateTypeScript(before.ir);
  expect(generated.ok).toBe(true);
  expect(await generateTypeScript(after.ir)).toEqual(generated);
});
