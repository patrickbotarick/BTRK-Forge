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
