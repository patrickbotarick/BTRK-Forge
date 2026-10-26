import { parseProject, type Project, type GraphNode, type Scalar, type Connection } from '../project-schema';

export type PortType = 'exec' | 'number' | 'string' | 'boolean';
export type Ports = { inputs: Record<string, PortType>; outputs: Record<string, PortType> };
export function ports(node: GraphNode, project: Project): Ports {
  const variableType = () => {
    const variable = project.variables.find(v => v.id === ('variableId' in node ? node.variableId : ''));
    if (!variable) throw new Error(`Variável ausente: ${node.id}`);
    return variable.type;
  };
  switch (node.kind) {
    case 'event': return { inputs: {}, outputs: { next: 'exec' } };
    case 'constant': return { inputs: {}, outputs: { value: typeof node.value as PortType } };
    case 'variable': return { inputs: {}, outputs: { value: variableType() } };
    case 'add': return { inputs: { a: 'number', b: 'number' }, outputs: { value: 'number' } };
    case 'greater': return { inputs: { a: 'number', b: 'number' }, outputs: { value: 'boolean' } };
    case 'condition': return { inputs: { in: 'exec', test: 'boolean' }, outputs: { yes: 'exec', no: 'exec' } };
    case 'set': return { inputs: { in: 'exec', value: variableType() }, outputs: { next: 'exec' } };
  }
}
export function validateProject(input: unknown): Project {
  const project = parseProject(input);
  const ids = new Set<string>();
  const unique = (value: string) => { if (ids.has(value)) throw new Error(`ID duplicado: ${value}`); ids.add(value); };
  unique(project.id);
  for (const screen of project.screens) { unique(screen.id); unique(screen.button.id); }
  for (const variable of project.variables) { unique(variable.id); if (typeof variable.initial !== variable.type) throw new Error(`Tipo inicial inválido: ${variable.id}`); }
  const nodes = new Map(project.graph.nodes.map(node => { unique(node.id); return [node.id, node]; }));
  if (project.graph.nodes.filter(n => n.kind === 'event').length !== 1) throw new Error('Exatamente um evento é necessário');
  const definitions = new Map(project.graph.nodes.map(n => [n.id, ports(n, project)]));
  const occupied = new Set<string>();
  const executionOutputs = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const c of project.graph.connections) {
    unique(c.id);
    if (!nodes.has(c.source) || !nodes.has(c.target)) throw new Error(`Referência ausente: ${c.id}`);
    const sourcePorts = definitions.get(c.source)!.outputs;
    const targetPorts = definitions.get(c.target)!.inputs;
    const output = Object.hasOwn(sourcePorts, c.output) ? sourcePorts[c.output] : undefined;
    const inputType = Object.hasOwn(targetPorts, c.input) ? targetPorts[c.input] : undefined;
    if (!output || !inputType || output !== inputType) throw new Error(`Sockets incompatíveis: ${c.id}`);
    const key = `${c.target}:${c.input}`;
    if (occupied.has(key)) throw new Error(`Entrada já conectada: ${key}`);
    occupied.add(key);
    if (output === 'exec') {
      const sourceKey = `${c.source}:${c.output}`;
      if (executionOutputs.has(sourceKey)) throw new Error('Fan-out de execução não suportado');
      executionOutputs.add(sourceKey);
    }
    adjacency.set(c.source, [...(adjacency.get(c.source) ?? []), c.target]);
  }
  for (const [nodeId, definition] of definitions) {
    for (const socket of Object.keys(definition.inputs)) {
      if (!occupied.has(`${nodeId}:${socket}`)) throw new Error(`Entrada obrigatória ausente: ${nodeId}:${socket}`);
    }
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  function visit(nodeId: string) {
    if (visiting.has(nodeId)) throw new Error('Ciclo não suportado');
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) visit(next);
    visiting.delete(nodeId); visited.add(nodeId);
  }
  for (const nodeId of nodes.keys()) visit(nodeId);
  return project;
}
export function canConnect(project: Project, candidate: Connection): boolean {
  try {
    const source = project.graph.nodes.find(n => n.id === candidate.source);
    const target = project.graph.nodes.find(n => n.id === candidate.target);
    if (!source || !target || source.id === target.id) return false;
    const sourcePorts = ports(source, project).outputs;
    const targetPorts = ports(target, project).inputs;
    if (!Object.hasOwn(sourcePorts, candidate.output) || !Object.hasOwn(targetPorts, candidate.input)) return false;
    const output = sourcePorts[candidate.output];
    if (!output || output !== targetPorts[candidate.input]) return false;
    if (project.graph.connections.some(c => c.target === candidate.target && c.input === candidate.input)) return false;
    if (output === 'exec' && project.graph.connections.some(c => c.source === candidate.source && c.output === candidate.output)) return false;
    const reachable = (id: string, visited = new Set<string>()): boolean => {
      if (id === candidate.source) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return project.graph.connections.filter(c => c.source === id).some(c => reachable(c.target, visited));
    };
    return !reachable(candidate.target);
  } catch { return false; }
}
export function execute(input: unknown, previous?: Record<string, Scalar>) {
  const project = validateProject(input);
  const state = Object.fromEntries(project.variables.map(v => [v.id, previous && Object.hasOwn(previous, v.id) ? previous[v.id] : v.initial]));
  for (const v of project.variables) if (typeof state[v.id] !== v.type || (typeof state[v.id] === 'number' && !Number.isFinite(state[v.id]))) throw new Error('Estado incompatível');
  const nodes = new Map(project.graph.nodes.map(n => [n.id, n]));
  const trace: string[] = [];
  let budget = 10000;
  const consume = () => { if (--budget < 0) throw new Error('Limite de execução excedido'); };
  function read(nodeId: string, socket: string): Scalar {
    const edge = project.graph.connections.find(c => c.target === nodeId && c.input === socket)!;
    return evaluate(nodes.get(edge.source)!);
  }
  function evaluate(node: GraphNode): Scalar {
    consume();
    switch (node.kind) {
      case 'constant': return node.value;
      case 'variable': return state[node.variableId];
      case 'add': {
        const value = Number(read(node.id, 'a')) + Number(read(node.id, 'b'));
        if (!Number.isFinite(value)) throw new Error('Resultado numérico não finito');
        return value;
      }
      case 'greater': return Number(read(node.id, 'a')) > Number(read(node.id, 'b'));
      default: throw new Error(`Node não fornece dados: ${node.id}`);
    }
  }
  let current: GraphNode | undefined = project.graph.nodes.find(n => n.kind === 'event');
  while (current) {
    consume(); trace.push(current.id);
    let output = 'next';
    if (current.kind === 'condition') output = read(current.id, 'test') ? 'yes' : 'no';
    else if (current.kind === 'set') state[current.variableId] = read(current.id, 'value');
    else if (current.kind !== 'event') throw new Error('Node de dados no fluxo de execução');
    const edge = project.graph.connections.find(c => c.source === current!.id && c.output === output);
    current = edge ? nodes.get(edge.target) : undefined;
  }
  return { state, trace };
}
