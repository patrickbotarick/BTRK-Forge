import { parseProject, type Project, type GraphNode, type Connection } from '../project-schema';
import { validateComponents } from '../designer-core/tree';

export type PortType = 'exec' | 'number' | 'string' | 'boolean';
export type Ports = { inputs: Record<string, PortType>; outputs: Record<string, PortType> };
export const nodeLabels:Record<GraphNode['kind'],string>={event:'Evento',constant:'Constante',variable:'Ler variável',set:'Definir variável',add:'Somar',greater:'Maior que',condition:'Condição',empty:'Texto vazio',concat:'Concatenar', 'component-value':'Ler componente','set-text':'Definir texto'};
export function ports(node: GraphNode, project: Project): Ports {
  const componentRef=()=>{const c=project.screens[0].components.find(c=>'componentId' in node&&c.id===node.componentId);if(!c)throw new Error(`Componente ausente: ${node.id}`);return c;};
  const variableType = () => {
    const variable = project.variables.find(v => v.id === ('variableId' in node ? node.variableId : ''));
    if (!variable) throw new Error(`Variável ausente: ${node.id}`);
    return variable.type;
  };
  switch (node.kind) {
    case 'event': {if(node.componentId){const c=componentRef();if(c.type!==(node.event==='button.click'?'Button':'Input'))throw new Error(`Tipo de evento incompatível: ${node.id}`);}else if(node.event==='input.change')throw new Error(`Input ausente no evento: ${node.id}`);return { inputs: {}, outputs: { next: 'exec' } };}
    case 'constant': return { inputs: {}, outputs: { value: typeof node.value as PortType } };
    case 'variable': return { inputs: {}, outputs: { value: variableType() } };
    case 'add': return { inputs: { a: 'number', b: 'number' }, outputs: { value: 'number' } };
    case 'greater': return { inputs: { a: 'number', b: 'number' }, outputs: { value: 'boolean' } };
    case 'condition': return { inputs: { in: 'exec', test: 'boolean' }, outputs: { yes: 'exec', no: 'exec' } };
    case 'set': return { inputs: { in: 'exec', value: variableType() }, outputs: { next: 'exec' } };
    case 'empty':return {inputs:{value:'string'},outputs:{value:'boolean'}};
    case 'concat':return {inputs:{a:'string',b:'string'},outputs:{value:'string'}};
    case 'component-value':{const c=componentRef();if(c.type!==(node.property==='value'?'Input':'Text'))throw new Error(`Propriedade de componente incompatível: ${node.id}`);return {inputs:{},outputs:{value:'string'}};}
    case 'set-text':{if(componentRef().type!=='Text')throw new Error(`Ação exige Text: ${node.id}`);return {inputs:{in:'exec',value:'string'},outputs:{next:'exec'}};}
  }
}
export function validateProject(input: unknown, options: { allowIncomplete?: boolean } = {}): Project {
  const project = parseProject(input);
  const ids = new Set<string>();
  const unique = (value: string) => { if (ids.has(value)) throw new Error(`ID duplicado: ${value}`); ids.add(value); };
  unique(project.id);
  for (const screen of project.screens) { unique(screen.id); validateComponents(screen.components, project.graph.nodes, unique,project.variables); }
  for (const variable of project.variables) { unique(variable.id); if (typeof variable.initial !== variable.type) throw new Error(`Tipo inicial inválido: ${variable.id}`); }
  const nodes = new Map(project.graph.nodes.map(node => { unique(node.id); return [node.id, node]; }));
  const eventCount=project.graph.nodes.filter(n=>n.kind==='event').length;
  if(eventCount<1||eventCount>32)throw new Error('O projeto exige de 1 a 32 eventos');
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
      if (!options.allowIncomplete && !occupied.has(`${nodeId}:${socket}`)) throw new Error(`Entrada obrigatória ausente: ${nodeId}:${socket}`);
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
export { executeLegacy as execute, executeEvent, initialRuntime, handleRuntimeRequest, runtimeEventSchema, runtimeReplySchema, RuntimeFault } from './runtime';
export type { RuntimeState, RuntimeEvent } from './runtime';
