import { expect, test } from 'vitest';
import { exampleProject } from '../packages/forge-core/example';
import { editGraph, makeNode } from '../packages/blueprint-core/edit';
import { deserialize, serialize } from '../packages/project-schema';

test('adiciona node e conexão juntos e recusa ocupação ou tipo sem alterar a entrada',()=>{
  const project=exampleProject();
  const original=serialize(project);
  const node=makeNode(project,'add');
  const edge={id:'edge-context',source:'sum',output:'value',target:node.id,input:'a'};
  const next=editGraph(project,{kind:'add-connected',node,edge});
  expect(deserialize(serialize(next)).graph.connections.at(-1)).toEqual(edge);
  const invalid={...edge,source:'branch',output:'yes'};
  expect(()=>editGraph(project,{kind:'add-connected',node,edge:invalid})).toThrow(/incompatíveis/);
  const constant=makeNode(project,'constant');
  expect(()=>editGraph(project,{kind:'add-connected',node:constant,
    edge:{...edge,source:constant.id,target:'sum',input:'a'}})).toThrow(/Entrada já conectada/);
  expect(serialize(project)).toBe(original);
});
