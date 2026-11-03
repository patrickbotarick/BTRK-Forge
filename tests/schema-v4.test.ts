import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { validateProject } from '../packages/blueprint-core';
import { lowerBlueprint } from '../packages/blueprint-ir';
import { projectSchemaV4, serialize } from '../packages/project-schema';
import { generateTypeScript } from '../packages/typescript-codegen';
import cases from './fixtures/projects/schema-v4-cases.json';

test.each(cases.map(c=>[c.name,c.valid,c.document] as const))('fixture compartilhada v4: %s',(_,valid,document)=>{
  if(valid){
    const parsed=validateProject(document,{allowIncomplete:true});
    expect(parsed).toEqual(document);
    expect(validateProject(JSON.parse(serialize(parsed)),{allowIncomplete:true})).toEqual(parsed);
  }else expect(()=>validateProject(document,{allowIncomplete:true})).toThrow();
});

test('JSON Schema v4 é gerado do contrato TypeScript e o v3 permanece congelado',()=>{
  expect(JSON.parse(readFileSync('packages/project-schema/project-v4.schema.json','utf8'))).toEqual(z.toJSONSchema(projectSchemaV4));
});

test.each(['phase0-v0','phase0-v1','visual-v2','greeting-v3'])('migra %s em cópia e preserva o Blueprint',name=>{
  const old=JSON.parse(readFileSync('tests/fixtures/projects/'+name+'.json','utf8'));
  const original=JSON.stringify(old);
  const project=validateProject(old);
  expect(project.schemaVersion).toBe(4);
  expect(project.resources).toEqual([]);
  expect(project.graph).toEqual(old.graph);
  expect(project.variables).toEqual(old.variables);
  expect(JSON.stringify(old)).toBe(original);
  if(old.schemaVersion===3)expect(project).toEqual({...old,schemaVersion:4});
  expect(validateProject(project)).toEqual(project);
});

test('recursos visuais inertes preservam IR v1, código, revisão e intervalos',async()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/projects/greeting-v3.json','utf8'));
  const base=lowerBlueprint(old);
  const visuals=lowerBlueprint(cases.find(c=>c.name==='visuals')!.document);
  expect(base.ok).toBe(true);
  expect(visuals).toEqual(base);
  const result=await generateTypeScript(base.ir);
  expect(result.ok).toBe(true);
  expect(await generateTypeScript(visuals.ir)).toEqual(result);
  expect(lowerBlueprint(cases.find(c=>c.name==='missing-asset')!.document).ok).toBe(false);
});
