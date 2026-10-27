import type { GraphNode, Project, Connection } from '../project-schema';
import { ports, validateProject } from './index';
export type GraphEdit={kind:'add';node:GraphNode}|{kind:'update';id:string;node:GraphNode}|{kind:'remove';id:string}|{kind:'connect';edge:Connection}|{kind:'disconnect';id:string};
export function makeNode(project:Project,kind:GraphNode['kind'],componentId?:string):GraphNode {
  const base={id:`node-${crypto.randomUUID()}`,position:{x:(project.graph.nodes.length%4)*300,y:Math.floor(project.graph.nodes.length/4)*240}};const components=project.screens[0].components;
  const selected=components.find(c=>c.id===componentId);
  switch(kind){
    case 'event':{const c=selected&&(selected.type==='Button'||selected.type==='Input')?selected:components.find(c=>c.type==='Button'||c.type==='Input');if(!c)throw new Error('Crie Button ou Input no Design antes de adicionar evento');return {...base,kind,event:c.type==='Input'?'input.change':'button.click',componentId:c.id};}
    case 'constant':return {...base,kind,value:1};
    case 'variable':case 'set':{const v=project.variables[0];if(!v)throw new Error('Crie uma variável primeiro');return {...base,kind,variableId:v.id};}
    case 'component-value':{const c=selected&&(selected.type==='Input'||selected.type==='Text')?selected:components.find(c=>c.type==='Input'||c.type==='Text');if(!c)throw new Error('Crie Input ou Text no Design');return {...base,kind,componentId:c.id,property:c.type==='Input'?'value':'text'};}
    case 'set-text':{const c=selected?.type==='Text'?selected:components.find(c=>c.type==='Text');if(!c)throw new Error('Crie Text no Design');return {...base,kind,componentId:c.id};}
    default:return {...base,kind};
  }
}
function bindEvent(project:Project,node:GraphNode){if(node.kind!=='event')return;
  for(const c of project.screens[0].components){if(c.type==='Button'&&c.events.click===node.id&&(node.componentId&&node.componentId!==c.id||node.event!=='button.click'))c.events.click=null;if(c.type==='Input'&&c.events.change===node.id&&(node.componentId!==c.id||node.event!=='input.change'))c.events.change=null;}
  const c=project.screens[0].components.find(c=>c.id===node.componentId);if(c?.type==='Button'&&node.event==='button.click')c.events.click=node.id;if(c?.type==='Input'&&node.event==='input.change')c.events.change=node.id;
}
export function editGraph(project:Project,edit:GraphEdit):Project {
  const next=structuredClone(project);
  if(edit.kind==='add'){next.graph.nodes.push(structuredClone(edit.node));bindEvent(next,edit.node);}
  if(edit.kind==='update'){const index=next.graph.nodes.findIndex(n=>n.id===edit.id);if(index<0||edit.node.id!==edit.id||next.graph.nodes[index].kind!==edit.node.kind)throw new Error('Node ou identidade inválida');next.graph.nodes[index]=structuredClone(edit.node);bindEvent(next,edit.node);}
  if(edit.kind==='remove'){if(!next.graph.nodes.some(n=>n.id===edit.id))throw new Error('Node ausente');next.graph.nodes=next.graph.nodes.filter(n=>n.id!==edit.id);next.graph.connections=next.graph.connections.filter(c=>c.source!==edit.id&&c.target!==edit.id);for(const c of next.screens[0].components){if(c.type==='Button'&&c.events.click===edit.id)c.events.click=null;if(c.type==='Input'&&c.events.change===edit.id)c.events.change=null;}}
  if(edit.kind==='connect')next.graph.connections.push(structuredClone(edit.edge));
  if(edit.kind==='disconnect'){if(!next.graph.connections.some(c=>c.id===edit.id))throw new Error('Conexão ausente');next.graph.connections=next.graph.connections.filter(c=>c.id!==edit.id);}
  return validateProject(next,{allowIncomplete:true});
}
export function graphDiagnostics(project:Project):{nodeId:string;message:string}[]{
  return project.graph.nodes.flatMap(n=>{try{const p=ports(n,project);return Object.keys(p.inputs).filter(input=>!project.graph.connections.some(c=>c.target===n.id&&c.input===input)).map(input=>({nodeId:n.id,message:`Entrada obrigatória ausente: ${input}`}));}catch(error){return [{nodeId:n.id,message:error instanceof Error?error.message:String(error)}];}});
}
