import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { exampleProject } from '../packages/forge-core/example';
import { canConnect, execute, validateProject } from '../packages/blueprint-core';
import { deserialize, parseProject, serialize } from '../packages/project-schema';

describe('Modelo independente e runtime', () => {
  it('executa evento, condição, operação e ação com transferência de dados', () => {
    const result = execute(exampleProject());
    expect(result).toEqual({ state: { count: 1 }, trace: ['click', 'branch', 'assign'] });
    expect(execute(exampleProject(), result.state).state.count).toBe(2);
  });
  it('segue o ramo falso sem executar a ação', () => {
    const p = exampleProject(); const zero = p.graph.nodes.find(n => n.id === 'zero')!;
    if (zero.kind === 'constant') zero.value = 100;
    expect(execute(p)).toEqual({ state: { count: 0 }, trace: ['click', 'branch'] });
  });
  it('preserva IDs, posições e comportamento no round trip', () => {
    const p = exampleProject(); p.graph.nodes[0].position.x = 512;
    expect(deserialize(serialize(p))).toEqual(p);
    expect(execute(deserialize(serialize(p))).state.count).toBe(1);
  });
  it('migra v0 sem modificar a entrada', () => {
    const legacy = JSON.parse(readFileSync('tests/fixtures/projects/phase0-v0.json','utf8'));
    expect(parseProject(legacy).schemaVersion).toBe(2); expect(legacy.schemaVersion).toBe(0);
  });
  it('recusa esquema futuro, JSON inválido e arquivos excessivos', () => {
    expect(() => parseProject({ ...exampleProject(), schemaVersion: 99 })).toThrow();
    expect(() => deserialize('{')).toThrow();
    expect(() => deserialize(' '.repeat(2_000_001))).toThrow(/2 MB/);
  });
  it('recusa referências de nodes e variáveis ausentes', () => {
    const p = exampleProject(); p.graph.connections[0].target = 'missing'; expect(() => execute(p)).toThrow(/Referência/);
    const v = exampleProject(); v.variables = []; expect(() => execute(v)).toThrow(/Variável/);
  });
  it('recusa conexões com tipos incompatíveis e sockets inexistentes', () => {
    const p = exampleProject(); p.graph.connections[1].source = 'positive'; expect(() => execute(p)).toThrow(/Sockets/);
    const q = exampleProject(); q.graph.connections[0].output = 'missing'; expect(() => execute(q)).toThrow(/Sockets/);
  });
  it('recusa ciclos de dados, inclusive desconectados do evento', () => {
    const p = exampleProject(); p.graph.connections[1].source = 'sum'; expect(() => execute(p)).toThrow(/Ciclo/);
  });
  it('recusa ciclos de controle', () => {
    const p = exampleProject(); p.graph.connections[0].source = 'assign'; p.graph.connections[0].output = 'next'; expect(() => execute(p)).toThrow(/Ciclo/);
  });
  it('recusa IDs duplicados, entradas vazias e múltiplas conexões por entrada', () => {
    const p = exampleProject(); p.graph.nodes[1].id = 'click'; expect(() => execute(p)).toThrow(/duplicado/);
    const q = exampleProject(); q.graph.connections.pop(); expect(() => execute(q)).toThrow(/obrigatória/);
    const r = exampleProject(); r.graph.connections.push({ ...r.graph.connections[0], id: 'duplicate-edge' }); expect(() => execute(r)).toThrow(/conectada/);
  });
  it('recusa estado inicial incompatível, estado externo incompatível e overflow', () => {
    const p = exampleProject(); p.variables[0].initial = 'bad'; expect(() => execute(p)).toThrow(/Tipo inicial/);
    expect(() => execute(exampleProject(), { count: true })).toThrow(/Estado/);
    expect(() => execute(exampleProject(), { count: Infinity })).toThrow(/Estado/);
    const q = exampleProject(); const one = q.graph.nodes.find(n => n.id === 'one')!;
    if (one.kind === 'constant') one.value = Number.MAX_VALUE;
    expect(() => execute(q, { count: Number.MAX_VALUE })).toThrow(/finito/);
  });
  it('editor valida conexão incremental sem exigir grafo completo', () => {
    const p = exampleProject(); const edge = p.graph.connections.pop()!;
    expect(canConnect(p, edge)).toBe(true);
    expect(canConnect(p, { ...edge, source: 'positive' })).toBe(false);
    p.graph.connections.push(edge); expect(canConnect(p, { ...edge, id: 'other' })).toBe(false);
  });
  it('recusa permissão nativa, propriedade desconhecida e código arbitrário', () => {
    const p = exampleProject(); expect(() => validateProject({ ...p, script: 'process.exit()' })).toThrow();
    expect(() => validateProject({ ...p, permissions: { web: [], windows: ['shell'] } })).toThrow();
  });
  it('limita tamanho do grafo e exige um único evento', () => {
    const p = exampleProject(); p.graph.nodes = p.graph.nodes.filter(n => n.kind !== 'event'); expect(() => validateProject(p)).toThrow(/evento/);
    const q = exampleProject(); q.graph.nodes = Array(201).fill(q.graph.nodes[0]); expect(() => validateProject(q)).toThrow();
  });
  it('não aceita propriedades herdadas como sockets ou valores de estado', () => {
    const p = exampleProject();
    const edge = { id: 'prototype-edge', source: 'click', output: 'constructor', target: 'branch', input: 'constructor' };
    expect(canConnect(p, edge)).toBe(false); p.graph.connections.push(edge);
    expect(() => execute(p)).toThrow(/Sockets/);
    const q = exampleProject(); q.variables[0].id = 'constructor';
    for (const n of q.graph.nodes) if ('variableId' in n) n.variableId = 'constructor';
    expect(execute(q, {}).state.constructor).toBe(1);
  });
  it.each([{ type: 'string' as const, initial: '', value: 'Forge' }, { type: 'boolean' as const, initial: false, value: true }])('transfere e atribui valores $type sem coerção', ({ type, initial, value }) => {
    const p = exampleProject(); p.variables = [{ id: 'result', name: 'Resultado', type, initial }];
    p.graph.nodes = [
      { id: 'event', kind: 'event', event: 'button.click', position: { x: 0, y: 0 } },
      { id: 'literal', kind: 'constant', value, position: { x: 0, y: 100 } },
      { id: 'write', kind: 'set', variableId: 'result', position: { x: 200, y: 0 } }
    ];
    p.graph.connections = [
      { id: 'flow', source: 'event', output: 'next', target: 'write', input: 'in' },
      { id: 'data', source: 'literal', output: 'value', target: 'write', input: 'value' }
    ];
    const button=p.screens[0].components.find(c=>c.type==='Button')!; if(button.type==='Button')button.events.click='event';
    expect(execute(p).state.result).toBe(value);
  });
  it('interrompe DAG válido com custo excessivo de avaliação', () => {
    const p = exampleProject(); let source = 'sum';
    for (let i = 0; i < 15; i++) {
      const nodeId = `double-${i}`; p.graph.nodes.push({ id: nodeId, kind: 'add', position: { x: i * 20, y: 100 } });
      p.graph.connections.push({ id: `double-a-${i}`, source, output: 'value', target: nodeId, input: 'a' }, { id: `double-b-${i}`, source, output: 'value', target: nodeId, input: 'b' });
      source = nodeId;
    }
    p.graph.connections.find(c => c.target === 'positive' && c.input === 'a')!.source = source;
    expect(() => execute(p)).toThrow(/Limite de execução/);
  });
});
