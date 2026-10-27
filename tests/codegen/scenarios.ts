import { exampleProject } from '../../packages/forge-core/example';
import { component, type Project } from '../../packages/project-schema';
import { logicFixture } from '../logic-fixture';

export const click = { type: 'button.click', componentId: 'button-count' };
export const change = (value: string) => ({ type: 'input.change', componentId: 'name-input', value });
export const literalText = 'Olá 😀\n" \\ \u2028\u2029 "; throw new Error("not code"); // ${7 * 7} </script>';

export function scalarsFixture() {
  const p = exampleProject(); let previous = 'assign';
  for (const [id, value] of [['text', literalText], ['flag', true]] as const) {
    p.variables.push({ id, name: id, type: typeof value as 'string' | 'boolean', initial: typeof value === 'string' ? '' : false });
    p.graph.nodes.push({ id: `literal-${id}`, kind: 'constant', value, position: { x: 0, y: 0 } }, { id: `set-${id}`, kind: 'set', variableId: id, position: { x: 0, y: 0 } }, { id: `read-${id}`, kind: 'variable', variableId: id, position: { x: 0, y: 0 } });
    p.graph.connections.push({ id: `flow-${id}`, source: previous, output: 'next', target: `set-${id}`, input: 'in' }, { id: `data-${id}`, source: `literal-${id}`, output: 'value', target: `set-${id}`, input: 'value' });
    previous = `set-${id}`;
  }
  return p;
}
export function sharedBindingFixture() {
  const p = logicFixture(), other = component('Input', 'other');
  if (other.type === 'Input') { other.props.binding = 'name'; other.events.change = null; }
  p.screens[0].components.push(other);
  const read = p.graph.nodes.find(n => n.id === 'read'); if (read?.kind === 'component-value') { read.componentId = 'result-text'; read.property = 'text'; }
  p.graph.nodes.push({ id: 'write-name', kind: 'set', variableId: 'name', position: { x: 0, y: 0 } }, { id: 'fixed-name', kind: 'constant', value: 'BTRK', position: { x: 0, y: 0 } });
  p.graph.connections.push({ id: 'write-name-next', source: 'typing', output: 'next', target: 'write-name', input: 'in' }, { id: 'write-name-value', source: 'fixed-name', output: 'value', target: 'write-name', input: 'value' });
  return p;
}
export function budgetFixture() {
  const p = exampleProject(); let source = 'one';
  for (let i = 0; i < 14; i++) {
    const id = `double-${i}`; p.graph.nodes.push({ id, kind: 'add', position: { x: 0, y: 0 } });
    for (const input of ['a', 'b']) p.graph.connections.push({ id: `double-${i}-${input}`, source, output: 'value', target: id, input });
    source = id;
  }
  p.graph.connections.find(c => c.target === 'assign' && c.input === 'value')!.source = source;
  return p;
}
export function overflowFixture() {
  const p = exampleProject(); for (const id of ['one', 'zero']) { const n = p.graph.nodes.find(n => n.id === id); if (n?.kind === 'constant') n.value = Number.MAX_VALUE; }
  p.variables[0].initial = Number.MAX_VALUE;
  return p;
}
/** Small deterministic PRNG corpus; seed is part of each test name and failure artifact. */
export function seededFixture(seed: number): Project {
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const p = exampleProject(); p.variables[0].initial = next() % 21 - 10;
  const one = p.graph.nodes.find(n => n.id === 'one'); if (one?.kind === 'constant') one.value = next() % 11 - 5;
  const zero = p.graph.nodes.find(n => n.id === 'zero'); if (zero?.kind === 'constant') zero.value = next() % 21 - 10;
  let previous = 'sum';
  for (let i = 0; i < 4; i++) {
    const id = `seed-${i}`; p.graph.nodes.push({ id, kind: 'add', position: { x: 0, y: 0 } });
    const b = next() % 2 === 0 ? 'one' : 'counter';
    p.graph.connections.push({ id: `${id}-a`, source: previous, output: 'value', target: id, input: 'a' }, { id: `${id}-b`, source: b, output: 'value', target: id, input: 'b' }); previous = id;
  }
  p.graph.connections.find(c => c.target === 'assign' && c.input === 'value')!.source = previous;
  return p;
}
