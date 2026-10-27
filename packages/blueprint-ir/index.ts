import { ports, validateProject } from '../blueprint-core';
import { parseProject, type Project } from '../project-schema';
import { graphDiagnostic, schemaDiagnostics } from './diagnostics';
import { IR_VERSION, type BlueprintIR, type DataRef, type DeepReadonly, type IRDiagnostic, type IRNode, type IRResult, type ScalarType } from './types';
export * from './types';
export * from './runtime-contract';

function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Pure lowering, no execution, optimization, UI dependencies or persistence. */
export function lowerBlueprint(input: unknown, options: { mode?: 'editable' | 'executable' } = {}): IRResult {
  let project: Project;
  try {
    const text = JSON.stringify(input);
    if (text && text.length > 2_000_000) return { ok: false, ir: null, diagnostics: [{ code: 'SIZE_LIMIT', severity: 'error', message: 'Projeto excede 2 MB', nodeId: null }] };
    project = parseProject(input);
  } catch (error) { return { ok: false, ir: null, diagnostics: schemaDiagnostics(error, input) }; }
  try { project = validateProject(project, { allowIncomplete: true }); }
  catch (error) { return { ok: false, ir: null, diagnostics: [graphDiagnostic(project, error)] }; }

  const incoming = new Map(project.graph.connections.map(c => [`${c.target}:${c.input}`, c]));
  const outgoing = new Map(project.graph.connections.map(c => [`${c.source}:${c.output}`, c]));
  const diagnostics: IRDiagnostic[] = [];
  for (const node of project.graph.nodes) {
    for (const socket of Object.keys(ports(node, project).inputs)) {
      if (!incoming.has(`${node.id}:${socket}`)) diagnostics.push({ code: 'INCOMPLETE_INPUT', severity: 'error', message: `Entrada obrigatória ausente: ${socket}`, nodeId: node.id, socket });
    }
  }
  if (diagnostics.length && options.mode !== 'editable') return { ok: false, ir: null, diagnostics };

  function data<T extends ScalarType>(nodeId: string, socket: string, type: T): DataRef<T> | null {
    const edge = incoming.get(`${nodeId}:${socket}`);
    return edge ? { nodeId: edge.source, connectionId: edge.id, output: 'value', type } : null;
  }
  function next(nodeId: string, socket: string) {
    const edge = outgoing.get(`${nodeId}:${socket}`);
    return edge ? { nodeId: edge.target, connectionId: edge.id } : null;
  }
  const nodes: IRNode[] = project.graph.nodes.map(node => {
    const definition = ports(node, project);
    const base = { origin: { nodeId: node.id }, ports: {
      inputs: Object.entries(definition.inputs).map(([name, type]) => ({ name, type })),
      outputs: Object.entries(definition.outputs).map(([name, type]) => ({ name, type }))
    } };
    const edge = incoming.get(`${node.id}:in`);
    const control = { incoming: edge ? { nodeId: edge.source, connectionId: edge.id } : null };
    switch (node.kind) {
      case 'event': return { ...base, kind: node.kind, eventType: node.event, componentId: node.componentId ?? null, next: next(node.id, 'next') };
      case 'constant': {
        const value = node.value;
        if (typeof value === 'number') return { ...base, kind: node.kind, type: 'number', value };
        if (typeof value === 'boolean') return { ...base, kind: node.kind, type: 'boolean', value };
        return { ...base, kind: node.kind, type: 'string', value };
      }
      case 'variable': return { ...base, kind: node.kind, type: definition.outputs.value as ScalarType, variableId: node.variableId };
      case 'component-value': return { ...base, kind: node.kind, type: 'string', componentId: node.componentId, property: node.property };
      case 'add': return { ...base, kind: node.kind, type: 'number', a: data(node.id, 'a', 'number'), b: data(node.id, 'b', 'number') };
      case 'greater': return { ...base, kind: node.kind, type: 'boolean', a: data(node.id, 'a', 'number'), b: data(node.id, 'b', 'number') };
      case 'empty': return { ...base, kind: node.kind, type: 'boolean', value: data(node.id, 'value', 'string') };
      case 'concat': return { ...base, kind: node.kind, type: 'string', a: data(node.id, 'a', 'string'), b: data(node.id, 'b', 'string') };
      case 'condition': return { ...base, ...control, kind: node.kind, test: data(node.id, 'test', 'boolean'), yes: next(node.id, 'yes'), no: next(node.id, 'no') };
      case 'set': {
        const valueType = definition.inputs.value as ScalarType;
        return { ...base, ...control, kind: node.kind, variableId: node.variableId, valueType, value: data(node.id, 'value', valueType), next: next(node.id, 'next') };
      }
      case 'set-text': return { ...base, ...control, kind: node.kind, componentId: node.componentId, value: data(node.id, 'value', 'string'), next: next(node.id, 'next') };
    }
  });
  const ir: BlueprintIR = {
    irVersion: IR_VERSION, source: { projectId: project.id, schemaVersion: 3 }, executable: diagnostics.length === 0,
    variables: project.variables.map(v => ({ ...v })), nodes,
    connections: project.graph.connections.map(c => ({ ...c })),
    components: project.screens[0].components.map(c => ({ id: c.id, type: c.type, disabled: 'disabled' in c.props ? c.props.disabled : null,
      initialProperty: c.type === 'Text' ? { property: 'text', value: c.props.text } : c.type === 'Input' ? { property: 'value', value: c.props.binding ? String(project.variables.find(v => v.id === c.props.binding)!.initial) : c.props.initialValue } : null })),
    bindings: project.screens[0].components.flatMap(c => c.type === 'Input' && c.props.binding ? [{ variableId: c.props.binding, componentId: c.id, property: 'value' as const }] : []),
    entrypoints: project.screens[0].components.flatMap(c => {
      if (c.type !== 'Button' && c.type !== 'Input') return [];
      const eventNodeId = c.type === 'Button' ? c.events.click : c.events.change;
      const event = project.graph.nodes.find(n => n.id === eventNodeId);
      return [{ componentId: c.id, eventType: c.type === 'Button' ? 'button.click' as const : 'input.change' as const, eventNodeId, enabled: !c.props.disabled, legacy: !!event && event.kind === 'event' && !event.componentId }];
    })
  };
  return { ok: true, ir: freeze(ir), diagnostics };
}
