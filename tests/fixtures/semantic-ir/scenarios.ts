import { exampleProject } from '../../../packages/forge-core/example';
import { logicFixture } from '../../logic-fixture';

/** Shared expression is read before AND after the first write. No generated executor. */
export function readAfterWriteFixture() {
  const p = exampleProject();
  p.graph.nodes.push({ id: 'second', kind: 'set', variableId: 'count', position: { x: 1400, y: 0 } });
  p.graph.connections = p.graph.connections.filter(c => c.id !== 'edge-1' && c.id !== 'edge-7');
  p.graph.connections.push(
    { id: 'start', source: 'click', output: 'next', target: 'assign', input: 'in' },
    { id: 'after-write', source: 'assign', output: 'next', target: 'branch', input: 'in' },
    { id: 'chosen', source: 'branch', output: 'yes', target: 'second', input: 'in' },
    { id: 'shared-again', source: 'sum', output: 'value', target: 'second', input: 'value' }
  );
  return p;
}

/** Input ingestion survives; both Text writes belong to the failed transaction. */
export function ingestionRollbackFixture() {
  const p = logicFixture();
  const prefix = p.graph.nodes.find(n => n.id === 'prefix');
  if (prefix?.kind === 'constant') prefix.value = 'x'.repeat(1000);
  p.graph.nodes.push({ id: 'explode', kind: 'set-text', componentId: 'result-text', position: { x: 0, y: 0 } });
  p.graph.connections.push(
    { id: 'after-typing', source: 'typing', output: 'next', target: 'explode', input: 'in' },
    { id: 'overflow-value', source: 'greeting', output: 'value', target: 'explode', input: 'value' }
  );
  return p;
}
