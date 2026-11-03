import { expect, test } from 'vitest';
import { exampleProject } from '../packages/forge-core/example';
import { component, deserialize, serialize } from '../packages/project-schema';
import { editProject, EditHistory } from '../packages/designer-core';

function fixture(){
  const project=exampleProject();
  project.screens[0].components.push(component('Container','panel'),component('Container','nested','panel'),
    component('Text','first','panel'),component('Text','middle','panel'),component('Text','last','panel'));
  return project;
}

test('pai e descendente são duplicados e removidos uma única vez',()=>{
  const project=fixture();
  const copied=editProject(project,{kind:'batch-duplicate',ids:['panel','first']}).project;
  expect(copied.screens[0].components).toHaveLength(project.screens[0].components.length+5);
  expect(new Set(copied.screens[0].components.map(c=>c.id)).size).toBe(copied.screens[0].components.length);
  const removed=editProject(project,{kind:'batch-remove',ids:['panel','first']}).project;
  expect(removed.screens[0].components).toHaveLength(project.screens[0].components.length-5);
});

test('ordem relativa, movimento, propriedade comum e histórico preservam o schema v3',()=>{
  const project=fixture();
  const moved=editProject(project,{kind:'batch-reorder',ids:['last','first'],direction:1}).project;
  const siblings=(p:typeof project,parentId:string)=>p.screens[0].components.filter(c=>c.parentId===parentId).map(c=>c.id);
  expect(siblings(moved,'panel')).toEqual(['nested','middle','first','last']);
  const grouped=editProject(moved,{kind:'batch-move',ids:['last','first'],parentId:'nested'}).project;
  expect(siblings(grouped,'nested')).toEqual(['first','last']);
  const styled=editProject(grouped,{kind:'batch-alignment',ids:['last','first'],value:'right'}).project;
  expect(styled.screens[0].components.find(c=>c.id==='first')?.style.textAlign).toBe('right');
  expect(deserialize(serialize(styled))).toEqual(styled);
  const history=new EditHistory();
  history.record(grouped,styled);
  expect(history.undo(styled)).toEqual(grouped);
  expect(history.redo(grouped)).toEqual(styled);
});

test('recusa referências em uso, ciclos, seleção obsoleta e pais incompatíveis sem mutação',()=>{
  const project=fixture();
  const text=component('Text','referenced');
  project.screens[0].components.push(text);
  project.graph.nodes.push({id:'ref-node',kind:'component-value',componentId:text.id,property:'text',position:{x:0,y:0}});
  const original=serialize(project);
  expect(()=>editProject(project,{kind:'batch-remove',ids:['panel','referenced']})).toThrow();
  expect(()=>editProject(project,{kind:'batch-move',ids:['panel','referenced'],parentId:'nested'})).toThrow(/Ciclo/);
  expect(()=>editProject(project,{kind:'batch-reorder',ids:['panel','first','missing'],direction:-1})).toThrow(/desatualizada/);
  expect(()=>editProject(project,{kind:'batch-move',ids:['first','referenced'],parentId:'nested'})).toThrow(/irmãos/);
  expect(serialize(project)).toBe(original);
});

test('dimensões v3 em lote validam unidades e preservam outros campos',()=>{
  const project=fixture();
  const edit={kind:'batch-dimension',ids:['first','last'],axis:'width',value:'fill'} as const;
  const next=editProject(project,edit).project;
  expect(next.screens[0].components.filter(c=>edit.ids.some(id=>id===c.id)).map(c=>c.style.width)).toEqual(['fill','fill']);
  expect(next.graph).toEqual(project.graph);
  expect(deserialize(serialize(next))).toEqual(next);
  for(const value of [-1,2001,1.5])expect(()=>editProject(project,{...edit,value})).toThrow();
  expect(project.screens[0].components.find(c=>c.id==='first')?.style.width).toBe('auto');
});

test('pai, filho e neto explícitos recebem largura, altura e alinhamento sem atingir irmãos',()=>{
  const project=fixture();
  project.screens[0].components.push(component('Text','grandchild','nested'));
  const ids=['panel','nested','grandchild','first'];
  const before=serialize(project);
  const width=editProject(project,{kind:'batch-dimension',ids:['panel','first'],axis:'width',value:300}).project;
  expect(width.screens[0].components.filter(c=>['panel','first'].includes(c.id)).map(c=>c.style.width)).toEqual([300,300]);
  let edited=width;
  const history=new EditHistory();
  for(const command of [
    {kind:'batch-dimension',ids,axis:'width',value:300},
    {kind:'batch-dimension',ids,axis:'height',value:120},
    {kind:'batch-alignment',ids,value:'center'}
  ] as const){
    const next=editProject(edited,command).project;
    history.record(edited,next);
    expect(history.undo(next)).toEqual(edited);
    expect(history.redo(edited)).toEqual(next);
    edited=next;
  }
  for(const c of edited.screens[0].components){
    if(ids.includes(c.id))expect(c.style).toMatchObject({width:300,height:120,textAlign:'center'});
    else expect(c).toEqual(project.screens[0].components.find(original=>original.id===c.id));
  }
  for(const invalid of [['panel','panel'],['panel','missing'],[]]){
    expect(()=>editProject(project,{kind:'batch-alignment',ids:invalid,value:'center'})).toThrow(/Seleção inválida/);
  }
  expect(()=>editProject(project,{kind:'batch-dimension',ids,axis:'height',value:2001})).toThrow();
  expect(serialize(project)).toBe(before);
  expect(deserialize(serialize(edited))).toEqual(edited);
});
