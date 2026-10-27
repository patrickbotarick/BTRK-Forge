import { NodeEditor, ClassicPreset, type GetSchemes } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets, type ReactArea2D } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { canConnect, ports, nodeLabels, type PortType } from '../../../packages/blueprint-core';
import type { Project, GraphNode, Connection } from '../../../packages/project-schema';

type Node = ClassicPreset.Node;
type Edge = ClassicPreset.Connection<Node, Node>;
type Schemes = GetSchemes<Node, Edge>;
type Extra = ReactArea2D<Schemes>;
const labels: Record<GraphNode['kind'], string> = { ...nodeLabels,event: 'Evento · clique', variable: 'Variável',set: 'Ação · definir' };
export async function createEditor(container: HTMLElement, initial: Project, onChange: (project: Project) => void, onError: (error: string) => void,onSelect:(id:string)=>void=()=>{}) {
  const project = structuredClone(initial); let ready = false;
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, Extra>(container);
  const connection = new ConnectionPlugin<Schemes, Extra>();
  const render = new ReactPlugin<Schemes, Extra>({ createRoot });
  const sockets = Object.fromEntries(['exec', 'number', 'boolean', 'string'].map(type => [type, new ClassicPreset.Socket(type)])) as Record<PortType, ClassicPreset.Socket>;
  connection.addPreset(ConnectionPresets.classic.setup());
  render.addPreset(Presets.classic.setup());
  editor.use(area); area.use(connection); area.use(render);
  AreaExtensions.simpleNodesOrder(area);
  function visual(node: GraphNode) {
    const label = node.kind === 'constant' ? `${labels[node.kind]} · ${String(node.value)}` : labels[node.kind];
    const view = new ClassicPreset.Node(label); view.id = node.id;
    const definition = ports(node, project);
    for (const [key, type] of Object.entries(definition.inputs)) view.addInput(key, new ClassicPreset.Input(sockets[type], `${key} : ${type}`, false));
    for (const [key, type] of Object.entries(definition.outputs)) view.addOutput(key, new ClassicPreset.Output(sockets[type], `${key} : ${type}`));
    return view;
  }
  const publish = () => onChange(structuredClone(project));
  editor.addPipe(context => {
    if (!ready) return context;
    if (context.type === 'connectioncreate') {
      const data = context.data;
      const candidate: Connection = { id: data.id, source: data.source, output: String(data.sourceOutput), target: data.target, input: String(data.targetInput) };
      // Rete generates IDs without the schema's leading letter; use an explicit domain ID.
      candidate.id = `edge-${data.id}`;
      if (!canConnect(project, candidate)) { onError('Conexão recusada: tipos, ocupação ou ciclo inválido.'); return; }
    }
    if (context.type === 'connectioncreated') {
      const d = context.data;
      project.graph.connections.push({ id: `edge-${d.id}`, source: d.source, output: String(d.sourceOutput), target: d.target, input: String(d.targetInput) }); publish();
    }
    if (context.type === 'connectionremoved') {
      project.graph.connections = project.graph.connections.filter(c => c.id !== context.data.id && c.id !== `edge-${context.data.id}`); publish();
    }
    return context;
  });
  area.addPipe(context => {
    if(context.type==='nodepicked')onSelect(context.data.id);
    if (ready && context.type === 'nodetranslated') {
      const node = project.graph.nodes.find(n => n.id === context.data.id);
      if (node) { node.position = context.data.position; publish(); }
    }
    return context;
  });
  for (const node of project.graph.nodes) { await editor.addNode(visual(node)); await area.translate(node.id, node.position); }
  for (const c of project.graph.connections) {
    const edge = new ClassicPreset.Connection(editor.getNode(c.source)!, c.output, editor.getNode(c.target)!, c.input); edge.id = c.id; await editor.addConnection(edge);
  }
  ready = true;
  await AreaExtensions.zoomAt(area, editor.getNodes());
  return {
    mark(selected:string|null,executed:string[],invalid:string[]){for(const [id,view] of area.nodeViews){view.element.dataset.graphNodeId=id;view.element.dataset.executionState=invalid.includes(id)?'ERRO / INVÁLIDO':executed.includes(id)?'EXECUTADO':'';view.element.dataset.selected=String(selected===id);view.element.style.outline=invalid.includes(id)?'2px solid #FF6868':selected===id?'2px solid #FF934F':executed.includes(id)?'2px solid #49C9B5':'';}},
    async addConstant() {
      const node: GraphNode = { id: `node-${crypto.randomUUID()}`, kind: 'constant', value: 1, position: { x: 500, y: 650 } };
      project.graph.nodes.push(node); await editor.addNode(visual(node)); await area.translate(node.id, node.position); publish();
    },
    syncProperties(next: Project) { project.screens = structuredClone(next.screens); },
    fit: () => AreaExtensions.zoomAt(area, editor.getNodes()),
    reveal: async (id: string) => { const node = editor.getNodes().find(n => n.id === id); if (node) { await AreaExtensions.zoomAt(area, [node], { scale: 0.8 }); container.dataset.revealedNodeId = id; } },
    destroy: () => area.destroy()
  };
}
