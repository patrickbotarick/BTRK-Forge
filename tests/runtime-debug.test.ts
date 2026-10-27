import { describe, expect, it } from 'vitest';
import { handleDebugRequest, handleRuntimeRequest } from '../packages/blueprint-core/runtime';
import { exampleProject } from '../packages/forge-core/example';
import { logicFixture } from './logic-fixture';
import { ingestionRollbackFixture, readAfterWriteFixture } from './fixtures/semantic-ir/scenarios';
import { appendHistory, debugReplySchema, TraceCollector, TRACE_LIMIT, TRACE_UNITS, HISTORY_LIMIT, HISTORY_UNITS, type HistoryEvent } from '../packages/runtime-debug';
const session = '00000000-0000-4000-8000-000000000001';
const click = { type: 'button.click', componentId: 'button-count' };
function run(project = exampleProject(), event: unknown = click) {
  const request = { requestId: 7, project, event };
  const result = handleDebugRequest({ ...request, debugSession: session })!;
  expect(debugReplySchema.safeParse(result).success).toBe(true);
  expect(result.reply).toEqual(handleRuntimeRequest(request));
  return result;
}
describe('diagnóstico transitório v1', () => {
  it('preserva resposta e ordem exata de avaliação, inclusive repetição', () => {
    const { debug, reply } = run();
    expect(debug.entries.map(e => `${e.kind}:${e.nodeId}`)).toEqual([
      'event:click', 'condition:branch', 'evaluate:positive', 'evaluate:sum', 'evaluate:counter', 'read-variable:counter', 'value:counter', 'evaluate:one', 'value:one', 'value:sum', 'evaluate:zero', 'value:zero', 'value:positive', 'branch:branch', 'action:assign', 'evaluate:sum', 'evaluate:counter', 'read-variable:counter', 'value:counter', 'evaluate:one', 'value:one', 'value:sum', 'assign:assign', 'commit:click'
    ]);
    expect(debug.entries.find(e => e.kind === 'assign')).toMatchObject({ before: 0, after: 1, target: 'count' });
    expect(reply.ok && reply.executedNodes).toEqual(['click', 'branch', 'positive', 'sum', 'counter', 'one', 'zero', 'assign']);
  });
  it('observa leitura após escrita e expressões reavaliadas sem memoização', () => {
    const { debug, reply } = run(readAfterWriteFixture());
    expect(debug.entries.filter(e => e.kind === 'read-variable').map(e => e.value)).toEqual([0, 1, 1]);
    expect(reply.ok && reply.runtime.variables.count).toBe(2);
    expect(debug.entries.filter(e => e.kind === 'assign').map(e => [e.before, e.after])).toEqual([[0, 1], [1, 2]]);
  });
  it('identifica ambos os ramos sem inventar ação do ramo não executado', () => {
    const empty = run(logicFixture());
    expect(empty.debug.entries.find(e => e.kind === 'branch')?.branch).toBe('yes');
    expect(empty.debug.entries.some(e => e.kind === 'action' && e.nodeId === 'no')).toBe(false);
    const p = exampleProject(); const one = p.graph.nodes.find(n => n.id === 'one'); if (one?.kind === 'constant') one.value = -1;
    expect(run(p).debug.entries.find(e => e.kind === 'branch')?.branch).toBe('no');
  });
  it('distingue ingestão, leitura de propriedade e confirmação', () => {
    const { debug, reply } = run(logicFixture(), { type: 'input.change', componentId: 'name-input', value: 'Ana 🧪' });
    const ingest = debug.entries.filter(e => e.kind === 'ingest');
    expect(ingest.map(e => e.target)).toEqual(['name-input', 'name']);
    expect(ingest.every(e => e.before === '' && e.after === 'Ana 🧪')).toBe(true);
    expect(debug.entries.findIndex(e => e.kind === 'ingest')).toBeLessThan(debug.entries.findIndex(e => e.kind === 'action'));
    expect(debug.entries.find(e => e.kind === 'read-property')).toMatchObject({ value: 'Ana 🧪', nodeId: 'read' });
    expect(reply.ok && reply.runtime.properties['result-text']).toBe('Ana 🧪');
  });
  it('rollback restaura ações mas mantém a ingestão anterior à transação', () => {
    const { debug, reply } = run(ingestionRollbackFixture(), { type: 'input.change', componentId: 'name-input', value: 'Ana' });
    expect(reply).toMatchObject({ ok: false, nodeId: 'concat', runtime: { variables: { name: 'Ana' }, properties: { 'name-input': 'Ana', 'result-text': 'Resultado' } } });
    expect(debug.outcome).toBe('rollback');
    expect(debug.entries.filter(e => e.kind === 'rollback' && e.target)).toEqual([expect.objectContaining({ target: 'result-text', before: 'Ana', after: 'Resultado' })]);
    expect(debug.entries.at(-1)?.kind).toBe('rollback');
    expect(debug.entries.some(e => e.kind === 'commit')).toBe(false);
  });
  it('falha global não recebe origem fictícia nem transação inventada', () => {
    const { debug, reply } = run(exampleProject(), { type: 'button.click', componentId: 'absent' });
    expect(reply).toMatchObject({ ok: false, nodeId: null, runtime: null });
    expect(debug).toMatchObject({ outcome: 'error', entries: [expect.objectContaining({ kind: 'error', nodeId: null })] });
  });
  it('documento incompleto identifica node antes de executar', () => {
    const p = exampleProject(); p.graph.connections = p.graph.connections.filter(e => e.id !== 'edge-3');
    expect(run(p).reply).toMatchObject({ ok: false, nodeId: 'sum' });
  });
  it('strings de 1000 unidades, Unicode, boolean e -0 permanecem dados', () => {
    const trace = new TraceCollector(); for (const value of ['🧪'.repeat(500), true, -0]) trace.add({ kind: 'value', nodeId: 'value', value });
    const result = trace.finish('commit'); expect(result.entries[0].value).toHaveLength(1000); expect(result.entries[1].value).toBe(true); expect(Object.is(result.entries[2].value, -0)).toBe(true);
  });
  it('limita entradas preservando ordem e informa omissões e resultado', () => {
    const trace = new TraceCollector(); for (let i = 0; i < 1000; i++) trace.add({ kind: 'evaluate', nodeId: 'node' });
    const result = trace.finish('rollback'); expect(result.entries).toHaveLength(TRACE_LIMIT); expect(result.dropped).toBe(800); expect(result.truncated).toBe(true); expect(result.outcome).toBe('rollback');
  });
  it('limita tamanho de dados antes do limite de entradas', () => {
    const trace = new TraceCollector(); for (let i = 0; i < TRACE_LIMIT; i++) trace.add({ kind: 'assign', nodeId: 'node', before: 'x'.repeat(1000), after: 'y'.repeat(1000) });
    const result = trace.finish('commit'); expect(result.entries.length).toBeLessThan(TRACE_LIMIT); expect(JSON.stringify(result).length).toBeLessThan(TRACE_UNITS); expect(result.truncated).toBe(true);
  });
  it('valida versão, sessão, ordem, finitude e campos não permitidos', () => {
    const valid = run();
    for (const bad of [{ ...valid, version: 2 }, { ...valid, session: 'bad' }, { ...valid, secret: 'token' }, { ...valid, debug: { ...valid.debug, entries: [{ kind: 'value', nodeId: 'node', order: 3, value: Infinity }] } }]) expect(debugReplySchema.safeParse(bad).success).toBe(false);
    expect(handleDebugRequest({ debugSession: session })).toBeNull();
  });
  it('histórico remove o mais antigo por quantidade e tamanho total', () => {
    const item: HistoryEvent = { session, requestId: 0, event: click, status: 'success', nodeId:null, debug: run().debug, error: null };
    let history: HistoryEvent[] = [];
    for (let i = 0; i < 25; i++) history = appendHistory(history, { ...item, requestId: i }).events;
    expect(history).toHaveLength(HISTORY_LIMIT); expect(history[0].requestId).toBe(5);
    const trace = new TraceCollector(); for (let i = 0; i < 100; i++) trace.add({ kind: 'assign', nodeId: 'node', before: 'x'.repeat(1000), after: 'y'.repeat(1000) });
    for (let i = 0; i < 25; i++) history = appendHistory(history, { ...item, requestId: i, debug: trace.finish('commit') }).events;
    expect(history.length).toBeLessThan(HISTORY_LIMIT); expect(JSON.stringify(history).length).toBeLessThanOrEqual(HISTORY_UNITS);
  });
  it('não escreve trace ou estado mutado no documento', () => {
    const p = logicFixture(), before = structuredClone(p); run(p, { type: 'input.change', componentId: 'name-input', value: 'Ana' }); expect(p).toEqual(before);
  });
  it('truncamento real não modifica orçamento, node da falha ou rollback', () => {
    const p = exampleProject();
    p.graph.nodes = p.graph.nodes.filter(n => ['click', 'assign', 'one'].includes(n.id)); p.graph.connections = [{ id: 'start', source: 'click', output: 'next', target: 'assign', input: 'in' }];
    let previous = 'one';
    for (let i = 0; i < 15; i++) {
      const id = `double-${i}`; p.graph.nodes.push({ id, kind: 'add', position: { x: 0, y: 0 } });
      for (const socket of ['a', 'b']) p.graph.connections.push({ id: `edge-${i}-${socket}`, source: previous, output: 'value', target: id, input: socket });
      previous = id;
    }
    p.graph.connections.push({ id: 'result', source: previous, output: 'value', target: 'assign', input: 'value' });
    const { debug, reply } = run(p); expect(reply).toMatchObject({ ok: false, error: 'Limite de execução excedido', runtime: { variables: { count: 0 } } });
    expect(debug.truncated).toBe(true); expect(debug.outcome).toBe('rollback'); expect(debug.entries).toHaveLength(TRACE_LIMIT);
  });
});
