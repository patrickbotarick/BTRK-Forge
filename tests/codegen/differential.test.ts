import { beforeAll, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exampleProject } from '../../packages/forge-core/example';
import { handleRuntimeRequest, initialRuntime, type RuntimeState } from '../../packages/blueprint-core';
import { lowerBlueprint } from '../../packages/blueprint-ir';
import { generateTypeScript } from '../../packages/typescript-codegen';
import { logicFixture } from '../logic-fixture';
import { readAfterWriteFixture, ingestionRollbackFixture } from '../fixtures/semantic-ir/scenarios';
import expected from '../fixtures/semantic-ir/expected.json';
import { compileCases } from './harness';
import { budgetFixture, change, click, literalText, overflowFixture, scalarsFixture, seededFixture, sharedBindingFixture } from './scenarios';

const unassociated = logicFixture(); const unboundInput = unassociated.screens[0].components.find(c => c.type === 'Input'); if (unboundInput?.type === 'Input') unboundInput.events.change = null;
unassociated.graph.nodes.push({ id: 'unbound-event', kind: 'event', event: 'button.click', position: { x: 0, y: 0 } });
const disabled = logicFixture(); for (const c of disabled.screens[0].components) if ('disabled' in c.props) c.props.disabled = true;
const nullClick = exampleProject(); const noClick = nullClick.screens[0].components[0]; if (noClick.type === 'Button') noClick.events.click = null;
const negativeZero = exampleProject(); negativeZero.variables[0].initial = -0; const one = negativeZero.graph.nodes.find(n => n.id === 'one'); if (one?.kind === 'constant') one.value = -0;
const projects = [exampleProject(), logicFixture(), readAfterWriteFixture(), ingestionRollbackFixture(), scalarsFixture(), sharedBindingFixture(), budgetFixture(), overflowFixture(), unassociated, disabled, nullClick, negativeZero];
const seeds = [1, 2, 42, 4096, 65535, 1793047, 0xdeadbeef, 0xffffffff];
projects.push(...seeds.map(seededFixture));
const mutationStart = projects.length;
projects.push(readAfterWriteFixture(), readAfterWriteFixture(), readAfterWriteFixture(), budgetFixture());
let compiled: Awaited<ReturnType<typeof compileCases>>;

beforeAll(async () => {
  compiled = await compileCases(projects, { [mutationStart]: 'subtract', [mutationStart + 1]: 'skip-write', [mutationStart + 2]: 'choose-no', [mutationStart + 3]: 'skip-visit' });
}, 120000);

async function compare(index: number, events: unknown[], starting?: RuntimeState) {
  let state = starting;
  const replies = await compiled.runSequence(index, events, starting);
  for (let i = 0; i < events.length; i++) {
    const input = { requestId: i + 1, ...(state ? { runtime: state } : {}), event: events[i] };
    const reference = handleRuntimeRequest({ ...input, project: projects[index] });
    const actual = replies[i];
    try { expect(actual).toEqual(reference); }
    catch (error) { await writeFile(path.join(compiled.directory, 'failure.json'), JSON.stringify({ index, seed: index >= 12 && index < mutationStart ? seeds[index - 12] : null, eventIndex: i, input, actual, reference }, null, 2)); throw error; }
    if (reference.runtime) state = reference.runtime;
  }
  return replies;
}

describe('Generated TypeScript: real typecheck, compile and child-process execution', () => {
  it('compares legacy events, all scalar types and sequential events', async () => {
    await compare(0, [click, click, click]);
    expect((await compare(4, [click, click]))[0].runtime?.variables).toEqual({ count: 1, text: literalText, flag: true });
  });
  it('compares all string nodes, both branches, Unicode, spaces and 1000/1001 boundaries', async () => {
    await compare(1, [click, change(''), change(' \t\n'), click, change('Ana 😀漢字\u2028'), click, change('x'.repeat(1000)), click, change('x'.repeat(1001)), click]);
  });
  it('uses independent expected states for both branches and chained events', async () => {
    const replies = await compare(1, expected.greetingBranches.map(step => step.event));
    for (const [index, step] of expected.greetingBranches.entries()) expect(replies[index]).toMatchObject({ ok: true, runtime: { variables: { count: 0, name: step.name }, properties: { 'name-input': step.name, 'result-text': step.text } }, trace: step.trace });
  });
  it('uses independent full state, values and first-visit order after repeated demand/write', async () => {
    const reply = (await compare(2, [click]))[0]; expect(reply).toEqual({ ok: true, requestId: 1, ...expected.readAfterWrite });
  });
  it('uses independent rollback, error origin and post-ingestion expectations', async () => {
    const { event, ...result } = expected.ingestionRollback;
    expect((await compare(3, [event]))[0]).toEqual({ ok: false, requestId: 1, ...result });
  });
  it('compares Text reads and multiple bound Inputs with set and null change event', async () => {
    const replies = await compare(5, [change('Ana'), { type: 'input.change', componentId: 'other', value: 'X' }, click, change('Bia'), click]);
    expect(replies[0].runtime).toEqual({ variables: { count: 0, name: 'BTRK' }, properties: { 'name-input': 'BTRK', other: 'BTRK', 'result-text': 'Resultado' } });
    expect(replies[1].runtime?.variables.name).toBe('X');
    expect(replies[4].runtime?.properties['result-text']).toBe('Olá, Olá, Resultado!!');
  });
  it('compares exhausted budget and finite-number faults with independent error expectations', async () => {
    expect((await compare(6, [click]))[0]).toMatchObject({ ok: false, error: 'Limite de execução excedido', runtime: { variables: { count: 0 } } });
    expect((await compare(7, [click]))[0]).toMatchObject({ ok: false, error: 'Resultado numérico não finito', nodeId: 'sum', trace: ['click', 'branch'], runtime: { variables: { count: Number.MAX_VALUE }, properties: {} } });
  });
  it('compares disabled, unassociated and wrong component/type events', async () => {
    await compare(8, [change('Ana'), click]); await compare(9, [click, change('Ana')]);
    expect((await compare(10, [click]))[0]).toMatchObject({ ok: true, trace: [], executedNodes: [], values: {}, runtime: { variables: { count: 0 } } });
    await compare(1, [{ ...click, componentId: 'missing' }, { ...click, componentId: 'name-input' }, { ...click, code: 'payload' }, { type: 'system.exec' }, change('ok')]);
  });
  it('compares invalid states without coercing or normalizing errors', async () => {
    for (const runtime of [{ variables: { count: 'bad' }, properties: {} }, { variables: { count: NaN }, properties: {} }, { variables: { count: 0 }, properties: { extra: 'x' } }]) {
      const input = { requestId: 1, runtime, event: click };
      expect(await compiled.run(0, input)).toEqual(handleRuntimeRequest({ ...input, project: projects[0] }));
    }
    const state = initialRuntime(projects[1]); state.variables.name = 'divergent'; await compare(1, [click], state);
  });
  it('preserves negative zero through AST, compiler, process serialization and runtime', async () => {
    const reply = (await compare(11, [click]))[0]; expect(Object.is(reply.runtime?.variables.count, -0)).toBe(true);
    if (reply.ok) expect(Object.is(reply.values.sum, -0)).toBe(true);
  });
  it('starts fresh on a new execution session instead of reusing old runtime', async () => {
    const old = await compare(0, [click, click]); expect(old[1].runtime?.variables.count).toBe(2);
    expect((await compare(0, [click]))[0].runtime?.variables.count).toBe(1);
  });
  it.each(seeds)('compares reproducible DAG seed=%i over successive events', async seed => {
    await compare(12 + seeds.indexOf(seed), [click, click, click]);
  });
  it.each(['subtract', 'skip-write', 'choose-no', 'skip-visit'])('detects controlled semantic mutation %s', async mutation => {
    const index = mutationStart + ['subtract', 'skip-write', 'choose-no', 'skip-visit'].indexOf(mutation);
    const input = { requestId: 1, event: click };
    const actual = await compiled.run(index, input), reference = handleRuntimeRequest({ ...input, project: projects[index] });
    expect(actual).not.toEqual(reference);
  });
  it('rejects a real generated TypeScript type error before any execution', async () => {
    await expect(compileCases([exampleProject()], { 0: 'type-error' })).rejects.toThrow(/not assignable/);
  }, 30000);
  it('refuses incomplete documents before compiling/ingesting', async () => {
    const p = logicFixture(); p.graph.connections = p.graph.connections.filter(c => c.target !== 'empty');
    expect(lowerBlueprint(p).ok).toBe(false);
    const result = lowerBlueprint(p, { mode: 'editable' }); if (!result.ok) throw Error('editable IR failed');
    expect((await generateTypeScript(result.ir)).ok).toBe(false);
    expect(handleRuntimeRequest({ requestId: 1, project: p, event: change('Ana') })).toMatchObject({ ok: false, nodeId: 'empty', runtime: null, trace: [] });
  });
});
