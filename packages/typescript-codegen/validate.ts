import { z } from 'zod';
import { component, type GraphNode } from '../project-schema';
import { lowerBlueprint, type BlueprintIR, type DeepReadonly } from '../blueprint-ir';

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const type = z.enum(['number', 'string', 'boolean']);
const scalar = z.union([z.number().finite(), z.string().max(1000), z.boolean()]);
const ref = z.object({ nodeId: id, connectionId: id, output: z.literal('value'), type }).strict().nullable();
const control = z.object({ nodeId: id, connectionId: id }).strict().nullable();
const port = z.object({ name: z.string().max(40), type: z.enum(['number', 'string', 'boolean', 'exec']) }).strict();
const base = { origin: z.object({ nodeId: id }).strict(), ports: z.object({ inputs: z.array(port).max(2), outputs: z.array(port).max(2) }).strict() };
const nodes = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('event'), eventType: z.enum(['button.click', 'input.change']), componentId: id.nullable(), next: control }).strict(),
  z.object({ ...base, kind: z.literal('constant'), type, value: scalar }).strict(),
  z.object({ ...base, kind: z.literal('variable'), type, variableId: id }).strict(),
  z.object({ ...base, kind: z.literal('component-value'), type: z.literal('string'), componentId: id, property: z.enum(['text', 'value']) }).strict(),
  z.object({ ...base, kind: z.literal('add'), type: z.literal('number'), a: ref, b: ref }).strict(),
  z.object({ ...base, kind: z.literal('greater'), type: z.literal('boolean'), a: ref, b: ref }).strict(),
  z.object({ ...base, kind: z.literal('empty'), type: z.literal('boolean'), value: ref }).strict(),
  z.object({ ...base, kind: z.literal('concat'), type: z.literal('string'), a: ref, b: ref }).strict(),
  z.object({ ...base, kind: z.literal('set'), variableId: id, valueType: type, value: ref, incoming: control, next: control }).strict(),
  z.object({ ...base, kind: z.literal('set-text'), componentId: id, value: ref, incoming: control, next: control }).strict(),
  z.object({ ...base, kind: z.literal('condition'), test: ref, incoming: control, yes: control, no: control }).strict()
]);
const irSchema = z.object({
  irVersion: z.literal(1), source: z.object({ projectId: id, schemaVersion: z.literal(3) }).strict(), executable: z.literal(true),
  variables: z.array(z.object({ id, name: z.string().min(1).max(80), type, initial: scalar }).strict()).max(100),
  components: z.array(z.object({ id, type: z.enum(['Text', 'Button', 'Input', 'Container']), disabled: z.boolean().nullable(), initialProperty: z.object({ property: z.enum(['value', 'text']), value: z.string().max(1000) }).strict().nullable() }).strict()).max(200),
  bindings: z.array(z.object({ variableId: id, componentId: id, property: z.literal('value') }).strict()).max(200),
  entrypoints: z.array(z.object({ componentId: id, eventType: z.enum(['button.click', 'input.change']), eventNodeId: id.nullable(), enabled: z.boolean(), legacy: z.boolean() }).strict()).max(200),
  nodes: z.array(nodes).min(1).max(200),
  connections: z.array(z.object({ id, source: id, output: z.string().max(40), target: id, input: z.string().max(40) }).strict()).max(500)
}).strict();

export class InvalidIR extends Error {
  constructor(message: string, public readonly nodeId: string | null = null) { super(message); }
}

/** Canonical order of object keys; array order and negative zero remain significant. */
export function canonical(value: unknown): string {
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Revalidate against the official lowering; redundant ports/refs cannot be forged. */
export function validateIR(input: unknown): DeepReadonly<BlueprintIR> {
  if (JSON.stringify(input).length > 2_000_000) throw Error('IR excede o limite de tamanho');
  const raw = irSchema.parse(input);
  const components = raw.components.map(c => {
    const result = component(c.type, c.id);
    if (result.type === 'Text') result.props.text = c.initialProperty?.value ?? '';
    if (result.type === 'Button' || result.type === 'Input') {
      result.props.disabled = c.disabled ?? false;
      const entry = raw.entrypoints.find(e => e.componentId === c.id);
      if (result.type === 'Button') result.events.click = entry?.eventNodeId ?? null;
      else { result.props.initialValue = c.initialProperty?.value ?? ''; result.props.binding = raw.bindings.find(b => b.componentId === c.id)?.variableId ?? null; result.events.change = entry?.eventNodeId ?? null; }
    }
    return result;
  });
  const graphNodes: GraphNode[] = raw.nodes.map(n => {
    const common = { id: n.origin.nodeId, position: { x: 0, y: 0 } };
    switch (n.kind) {
      case 'event': return { ...common, kind: n.kind, event: n.eventType, ...(n.componentId ? { componentId: n.componentId } : {}) };
      case 'constant': return { ...common, kind: n.kind, value: n.value };
      case 'variable': case 'set': return { ...common, kind: n.kind, variableId: n.variableId };
      case 'component-value': return { ...common, kind: n.kind, componentId: n.componentId, property: n.property };
      case 'set-text': return { ...common, kind: n.kind, componentId: n.componentId };
      default: return { ...common, kind: n.kind };
    }
  });
  // A synthetic screen needs a globally unique ID; it is not retained in the IR.
  const used = new Set([raw.source.projectId, ...raw.components.map(c => c.id), ...raw.variables.map(v => v.id), ...raw.nodes.map(n => n.origin.nodeId), ...raw.connections.map(c => c.id)]);
  let screenIndex = 0; let screenId = `codegen-screen-${screenIndex}`;
  while (used.has(screenId)) screenId = `codegen-screen-${++screenIndex}`;
  const result = lowerBlueprint({ id: raw.source.projectId, name: 'Codegen validation', version: '0.0.1', schemaVersion: 3,
    screens: [{ id: screenId, title: '', components }], variables: raw.variables, graph: { nodes: graphNodes, connections: raw.connections },
    functions: [], resources: [], dependencies: [], permissions: { web: [], windows: [] }, distribution: { appId: 'studio.btrk.codegen', version: '0.0.1', channel: 'beta' } });
  if (!result.ok) throw new InvalidIR(result.diagnostics.map(d => d.message).join('; '), result.diagnostics[0]?.nodeId ?? null);
  if (canonical(result.ir) !== canonical(raw)) {
    const inconsistent = result.ir.nodes.find((node, index) => canonical(node) !== canonical(raw.nodes[index]));
    throw new InvalidIR('IR inconsistente com portas, referências, entradas ou bindings oficiais', inconsistent?.origin.nodeId ?? null);
  }
  return result.ir;
}
