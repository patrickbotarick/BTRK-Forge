import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { projectSchema } from '../packages/project-schema';
import { newProject, readDocument, writeDocument } from '../packages/forge-core/project-document';
describe('contrato persistente compartilhado com Rust', () => {
  const fixture = (name: string) => readFileSync(`tests/fixtures/projects/${name}.json`, 'utf8');
  it('mantém o JSON Schema nativo sincronizado com Zod', () => {
    expect(JSON.parse(readFileSync('packages/project-schema/project.schema.json', 'utf8'))).toEqual(z.toJSONSchema(projectSchema));
  });
  it('preserva amostras históricas e IDs, migrando somente v0 conhecida', () => {
    expect(readDocument(fixture('phase0-v0'))).toEqual(readDocument(fixture('phase0-v1')));
    expect(readDocument(writeDocument(readDocument(fixture('phase0-v1'))))).toEqual(readDocument(fixture('phase0-v1')));
  });
  it('recusa referência inválida, versão futura, JSON e campos desconhecidos', () => {
    for (const name of ['invalid-reference', 'future']) expect(() => readDocument(fixture(name))).toThrow();
    expect(() => readDocument('{')).toThrow();
    expect(() => readDocument(JSON.stringify({ ...newProject('Teste'), shell: 'whoami' }))).toThrow();
  });
  it('cria identidades únicas e mantém metadados e grafo estáveis no round trip', () => {
    const p = newProject('Fundição São José');
    expect(newProject('Fundição São José').id).not.toBe(p.id);
    expect(readDocument(writeDocument(p))).toEqual(p);
    expect(p.compatibility?.format).toBe('btrk-project');
  });
  it('permite rascunho incompleto, sem aceitar ciclos ou conexões inválidas', () => {
    const p = newProject('Rascunho'); p.graph.connections.pop();
    expect(readDocument(writeDocument(p))).toEqual(p);
    p.graph.connections[1].source = 'sum'; expect(() => writeDocument(p)).toThrow(/Ciclo/);
  });
});
