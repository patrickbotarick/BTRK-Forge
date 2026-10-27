import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lowerBlueprint, SEMANTIC_CONTRACT, type IRNode } from '../packages/blueprint-ir';
import { executeEvent, handleRuntimeRequest, initialRuntime, ports } from '../packages/blueprint-core';
import { component, type Project } from '../packages/project-schema';
import { exampleProject } from '../packages/forge-core/example';
import { logicFixture } from './logic-fixture';
import { ingestionRollbackFixture, readAfterWriteFixture } from './fixtures/semantic-ir/scenarios';
import expected from './fixtures/semantic-ir/expected.json';

function ir(p: unknown, mode: 'editable' | 'executable' = 'executable') {
  const result = lowerBlueprint(p, { mode });
  if (!result.ok) throw Error(JSON.stringify(result.diagnostics));
  return result.ir;
}
function node(p: Project, id: string) { return ir(p).nodes.find(n => n.origin.nodeId === id)!; }

describe('Blueprint → semantic IR v1 (not TypeScript equivalence)', () => {
  it('represents all 11 kinds with authoritative typed ports and exact origins', () => {
    const projects = [exampleProject(), logicFixture()];
    const kinds = new Set<string>();
    for (const p of projects) {
      const result = ir(p);
      expect(result.irVersion).toBe(1); expect(result.source.schemaVersion).toBe(3);
      expect(result.nodes.map(n => n.origin.nodeId)).toEqual(p.graph.nodes.map(n => n.id));
      expect(result.connections).toEqual(p.graph.connections);
      for (const n of result.nodes) {
        kinds.add(n.kind);
        const original = p.graph.nodes.find(o => o.id === n.origin.nodeId)!;
        expect(Object.fromEntries(n.ports.inputs.map(i => [i.name, i.type]))).toEqual(ports(original, p).inputs);
        expect(Object.fromEntries(n.ports.outputs.map(i => [i.name, i.type]))).toEqual(ports(original, p).outputs);
      }
    }
    expect([...kinds].sort()).toEqual(['event', 'constant', 'variable', 'set', 'component-value', 'set-text', 'add', 'greater', 'empty', 'concat', 'condition'].sort());
  });
  it('preserves scoped entries, unassociated events, disabled controls and legacy global entry', () => {
    const p = logicFixture();
    p.graph.nodes.push({ id: 'unbound', kind: 'event', event: 'button.click', position: { x: 0, y: 0 } });
    const button = p.screens[0].components[0]; if (button.type === 'Button') button.props.disabled = true;
    expect(ir(p).entrypoints).toEqual([
      { componentId: 'button-count', eventType: 'button.click', eventNodeId: 'click', enabled: false, legacy: false },
      { componentId: 'name-input', eventType: 'input.change', eventNodeId: 'change', enabled: true, legacy: false }
    ]);
    expect(ir(p).nodes.some(n => n.origin.nodeId === 'unbound')).toBe(true);
    expect(ir(exampleProject()).entrypoints[0].legacy).toBe(true);
    const input = p.screens[0].components.find(c => c.type === 'Input')!;
    if (input.type === 'Input') input.events.change = null;
    expect(ir(p).entrypoints[1].eventNodeId).toBeNull();
  });
  it('preserves number/string/boolean variables, literals and assignments', () => {
    const p = exampleProject(); let previous = 'assign';
    for (const [id, value] of [['text', 'hello'], ['flag', true]] as const) {
      p.variables.push({ id, name: id, type: typeof value as 'string' | 'boolean', initial: value });
      p.graph.nodes.push({ id: `literal-${id}`, kind: 'constant', value, position: { x: 0, y: 0 } }, { id: `read-${id}`, kind: 'variable', variableId: id, position: { x: 0, y: 0 } }, { id: `assign-${id}`, kind: 'set', variableId: id, position: { x: 0, y: 0 } });
      p.graph.connections.push({ id: `flow-${id}`, source: previous, output: 'next', target: `assign-${id}`, input: 'in' }, { id: `value-${id}`, source: `literal-${id}`, output: 'value', target: `assign-${id}`, input: 'value' });
      previous = `assign-${id}`;
    }
    expect(ir(p).variables.map(v => v.type)).toEqual(['number', 'string', 'boolean']);
    expect(node(p, 'literal-flag')).toMatchObject({ type: 'boolean', value: true });
    expect(node(p, 'read-text')).toMatchObject({ type: 'string', variableId: 'text' });
    expect(node(p, 'assign')).toMatchObject({ valueType: 'number', value: { nodeId: 'sum', type: 'number' } });
    expect(node(p, 'assign-text')).toMatchObject({ valueType: 'string', value: { nodeId: 'literal-text', type: 'string' } });
    expect(node(p, 'assign-flag')).toMatchObject({ valueType: 'boolean', value: { nodeId: 'literal-flag', type: 'boolean' } });
  });
  it('records binding and uses variable initial over Input initialValue', () => {
    const p = logicFixture(); const input = p.screens[0].components.find(c => c.type === 'Input')!;
    if (input.type === 'Input') input.props.initialValue = 'ignored';
    const other = component('Input', 'other'); if (other.type === 'Input') other.props.binding = 'name'; p.screens[0].components.push(other);
    expect(ir(p).bindings).toEqual([{ variableId: 'name', componentId: 'name-input', property: 'value' }, { variableId: 'name', componentId: 'other', property: 'value' }]);
    expect(ir(p).components.find(c => c.id === input.id)?.initialProperty).toEqual({ property: 'value', value: '' });
    expect(ir(p).components.find(c => c.id === 'other')?.initialProperty?.value).toBe('');
  });
  it('preserves branches and shared references without hoisting or expanding expressions', () => {
    const p = readAfterWriteFixture(); const result = ir(p);
    expect(result.nodes.filter(n => n.origin.nodeId === 'sum')).toHaveLength(1);
    expect(node(p, 'branch')).toMatchObject({ test: { nodeId: 'positive' }, yes: { nodeId: 'second' }, no: null });
    expect(node(p, 'sum')).toMatchObject({ a: { nodeId: 'counter', connectionId: 'edge-2' }, b: { nodeId: 'one', connectionId: 'edge-3' } });
    expect(node(p, 'assign')).toMatchObject({ next: { nodeId: 'branch' }, value: { nodeId: 'sum' } });
    expect(node(p, 'second')).toMatchObject({ value: { nodeId: 'sum' } });
  });
  it('is deterministic, detached and deeply frozen without mutating successful input', () => {
    const p = logicFixture(), before = JSON.stringify(p), first = ir(p);
    expect(ir(p)).toEqual(first); expect(JSON.stringify(p)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.nodes[0].ports.inputs)).toBe(true);
    p.variables[0].initial = 99; expect(first.variables[0].initial).toBe(0);
    expect(() => { (first.nodes as IRNode[]).push(first.nodes[0] as IRNode); }).toThrow();
  });
  it('distinguishes editable incomplete graph from executable and diagnoses every missing socket', () => {
    const p = logicFixture(); p.graph.connections = p.graph.connections.filter(c => c.target !== 'concat');
    const before = JSON.stringify(p), editable = lowerBlueprint(p, { mode: 'editable' }), executable = lowerBlueprint(p);
    expect(editable.ok).toBe(true); if (editable.ok) expect(editable.ir.executable).toBe(false);
    expect(editable.diagnostics).toEqual(executable.diagnostics);
    expect(editable.diagnostics).toEqual([
      { code: 'INCOMPLETE_INPUT', severity: 'error', nodeId: 'concat', socket: 'a', message: 'Entrada obrigatória ausente: a' },
      { code: 'INCOMPLETE_INPUT', severity: 'error', nodeId: 'concat', socket: 'b', message: 'Entrada obrigatória ausente: b' }
    ]);
    expect(executable.ok).toBe(false); expect(executable.ir).toBeNull(); expect(JSON.stringify(p)).toBe(before);
  });
  it.each(['variable', 'component', 'connection', 'type', 'cycle', 'binding', 'event'] as const)('rejects invalid %s without modifying input', kind => {
    const p = logicFixture();
    if (kind === 'variable') p.graph.nodes.push({ id: 'bad', kind: 'variable', variableId: 'missing', position: { x: 0, y: 0 } });
    if (kind === 'component') p.screens[0].components = p.screens[0].components.filter(c => c.id !== 'result-text');
    if (kind === 'connection') p.graph.connections[0].source = 'missing';
    if (kind === 'type') p.graph.connections.find(c => c.target === 'branch' && c.input === 'test')!.source = 'prefix';
    if (kind === 'cycle') p.graph.connections.find(c => c.target === 'concat' && c.input === 'a')!.source = 'greeting';
    const input = p.screens[0].components.find(c => c.type === 'Input');
    if (kind === 'binding' && input?.type === 'Input') input.props.binding = 'count';
    if (kind === 'event' && input?.type === 'Input') input.events.change = 'click';
    const before = JSON.stringify(p), result = lowerBlueprint(p);
    expect(result.ok).toBe(false); expect(result.diagnostics[0].code).toBe('GRAPH_INVALID');
    if (kind !== 'binding') expect(result.diagnostics[0].nodeId).not.toBeNull();
    expect(JSON.stringify(p)).toBe(before);
  });
  it('attributes schema errors to node paths and rejects future schema / executable payload', () => {
    const p = logicFixture();
    const invalid = { ...p, graph: { ...p.graph, nodes: [{ ...p.graph.nodes[0], kind: 'unknown' }] } };
    expect(lowerBlueprint(invalid).diagnostics[0]).toMatchObject({ code: 'SCHEMA_INVALID', nodeId: 'click', path: ['graph', 'nodes', 0, 'kind'] });
    expect(lowerBlueprint({ ...p, schemaVersion: 4 }).ok).toBe(false);
    expect(lowerBlueprint({ ...p, code: 'arbitrary payload' }).ok).toBe(false);
  });
  it('migrates v0/v1/v2 without writing or changing source identities', () => {
    for (const version of [0, 1, 2]) {
      const p = JSON.parse(readFileSync(version === 2 ? 'tests/fixtures/projects/visual-v2.json' : `tests/fixtures/projects/phase0-v${version}.json`, 'utf8'));
      p.schemaVersion = version; const before = JSON.stringify(p);
      expect(ir(p).source.schemaVersion).toBe(3); expect(ir(p).nodes.map(n => n.origin.nodeId)).toEqual(p.graph.nodes.map((n: { id: string }) => n.id));
      expect(JSON.stringify(p)).toBe(before);
    }
  });
  it('checks graph size boundaries without expanding shared-expression complexity', () => {
    const p = exampleProject();
    while (p.graph.nodes.length < 200) p.graph.nodes.push({ id: `extra-${p.graph.nodes.length}`, kind: 'constant', value: 1, position: { x: 0, y: 0 } });
    expect(ir(p).nodes).toHaveLength(200);
    p.graph.nodes.push({ id: 'too-many', kind: 'constant', value: 1, position: { x: 0, y: 0 } }); expect(lowerBlueprint(p).ok).toBe(false);
    const document = { ...exampleProject(), extra: 'x'.repeat(2_000_001) };
    expect(lowerBlueprint(document).diagnostics[0].code).toBe('SIZE_LIMIT');
    const q = exampleProject(); while (q.variables.length < 100) q.variables.push({ id: `v-${q.variables.length}`, name: 'v', type: 'number', initial: 0 });
    expect(ir(q).variables).toHaveLength(100); q.variables.push({ id: 'overflow', name: 'v', type: 'number', initial: 0 }); expect(lowerBlueprint(q).ok).toBe(false);
  });
  it('checks connection, event and string limits and attributes duplicate origins', () => {
    const p = exampleProject();
    const duplicate = structuredClone(p); duplicate.graph.nodes.push({ ...duplicate.graph.nodes[0] });
    expect(lowerBlueprint(duplicate).diagnostics[0]).toMatchObject({ code: 'GRAPH_INVALID', nodeId: 'click' });
    const edges = { ...p, graph: { ...p.graph, connections: Array.from({ length: 501 }, (_, i) => ({ ...p.graph.connections[0], id: `limit-${i}` })) } };
    expect(lowerBlueprint(edges).diagnostics[0].code).toBe('SCHEMA_INVALID');
    while (p.graph.nodes.filter(n => n.kind === 'event').length < 32) p.graph.nodes.push({ id: `event-${p.graph.nodes.length}`, kind: 'event', event: 'button.click', position: { x: 0, y: 0 } });
    expect(ir(p).nodes.filter(n => n.kind === 'event')).toHaveLength(32);
    p.graph.nodes.push({ id: 'extra-event', kind: 'event', event: 'button.click', position: { x: 0, y: 0 } }); expect(lowerBlueprint(p).ok).toBe(false);
    const q = logicFixture(); const prefix = q.graph.nodes.find(n => n.id === 'prefix');
    if (prefix?.kind === 'constant') prefix.value = 'x'.repeat(1000);
    expect(ir(q).executable).toBe(true);
    if (prefix?.kind === 'constant') prefix.value += 'x';
    expect(lowerBlueprint(q).diagnostics[0]).toMatchObject({ code: 'SCHEMA_INVALID', nodeId: 'prefix' });
  });
});

describe('Independent semantic expectations for future 1D-B (current interpreter only)', () => {
  it('specifies both branches across a sequence of component events', () => {
    const p = logicFixture(); let state = initialRuntime(p);
    for (const step of expected.greetingBranches) {
      const result = executeEvent(p, state, step.event); state = result.runtime;
      expect(result.trace).toEqual(step.trace);
      expect(state).toEqual({ variables: { count: 0, name: step.name }, properties: { 'name-input': step.name, 'result-text': step.text } });
    }
  });
  it('specifies operand visit order, repeated demand and read-after-write', () => {
    const { event, ...result } = expected.readAfterWrite;
    expect(executeEvent(readAfterWriteFixture(), undefined, event)).toEqual({ ...result, event });
  });
  it('specifies input ingestion with rollback of multiple actions and partial trace', () => {
    const { event, ...result } = expected.ingestionRollback;
    expect(handleRuntimeRequest({ requestId: 7, project: ingestionRollbackFixture(), event })).toEqual({ ok: false, requestId: 7, ...result });
  });
  it('rejects globally incomplete graph before ingestion, including unused data', () => {
    const p = logicFixture(); p.graph.nodes.push({ id: 'unused', kind: 'concat', position: { x: 0, y: 0 } });
    const state = initialRuntime(p), before = structuredClone(state);
    expect(handleRuntimeRequest({ requestId: 1, project: p, runtime: state, event: expected.ingestionRollback.event })).toMatchObject({ ok: false, nodeId: 'unused', runtime: null, trace: [] });
    expect(state).toEqual(before);
  });
  it('defines demand cost separately from unique nodes and keeps a bounded IR', () => {
    const p = exampleProject(); let source = 'one';
    for (let i = 0; i < 14; i++) {
      const id = `double-${i}`; p.graph.nodes.push({ id, kind: 'add', position: { x: 0, y: 0 } });
      for (const socket of ['a', 'b']) p.graph.connections.push({ id: `double-edge-${i}-${socket}`, source, output: 'value', target: id, input: socket });
      source = id;
    }
    p.graph.connections.find(c => c.target === 'assign' && c.input === 'value')!.source = source;
    expect(ir(p).nodes).toHaveLength(22);
    expect(handleRuntimeRequest({ requestId: 1, project: p, event: expected.readAfterWrite.event })).toMatchObject({ ok: false, error: 'Limite de execução excedido', runtime: { variables: { count: 0 } } });
    expect(SEMANTIC_CONTRACT.visitsPerEvent).toBe(10000);
  });
});
