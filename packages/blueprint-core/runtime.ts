import { z } from 'zod';
import { validateProject,ports } from './index';
import type { Project, GraphNode, Scalar } from '../project-schema';
import { RuntimeFault, VisitBudget, checkScalar } from '../semantic-runtime/primitives';
export { RuntimeFault } from '../semantic-runtime/primitives';
import { runtimeStateSchema, runtimeEventSchema, runtimeReplySchema, runtimeRequestSchema as requestSchema, type RuntimeState } from '../semantic-runtime/protocol';
export { runtimeStateSchema, runtimeEventSchema, runtimeReplySchema } from '../semantic-runtime/protocol';
export type { RuntimeState, RuntimeEvent } from '../semantic-runtime/protocol';
export function initialRuntime(project:Project):RuntimeState {
  const variables=Object.fromEntries(project.variables.map(v=>[v.id,v.initial]));
  const properties=Object.fromEntries(project.screens[0].components.flatMap(c=>c.type==='Input'?[[c.id,c.props.binding?String(variables[c.props.binding]):c.props.initialValue]]:c.type==='Text'?[[c.id,c.props.text]]:[]));
  return {variables,properties};
}
function checkedRuntime(project:Project,previous?:RuntimeState):RuntimeState {
  const initial=initialRuntime(project);if(!previous)return initial;
  const parsed=runtimeStateSchema.safeParse(previous);if(!parsed.success)throw new RuntimeFault('Estado incompatível');
  const state=parsed.data;
  if(Object.keys(state.variables).length!==project.variables.length||Object.keys(state.properties).length!==Object.keys(initial.properties).length)throw new RuntimeFault('Estado incompatível com o projeto; reinicie a execução');
  for(const v of project.variables)if(!Object.hasOwn(state.variables,v.id)||typeof state.variables[v.id]!==v.type)throw new RuntimeFault('Estado incompatível');
  for(const key of Object.keys(initial.properties))if(!Object.hasOwn(state.properties,key))throw new RuntimeFault('Propriedade runtime ausente');
  for(const c of project.screens[0].components)if(c.type==='Input'&&c.props.binding&&state.properties[c.id]!==state.variables[c.props.binding])throw new RuntimeFault('Binding de Input inconsistente');
  return state;
}
function syncBindings(project:Project,runtime:RuntimeState){for(const c of project.screens[0].components)if(c.type==='Input'&&c.props.binding)runtime.properties[c.id]=String(runtime.variables[c.props.binding]);}
function runGraph(project:Project,base:RuntimeState,eventId:string){
  const runtime=structuredClone(base);const trace:string[]=[];const executed=new Set<string>();const values:Record<string,Scalar>={};
  const nodes=new Map(project.graph.nodes.map(n=>[n.id,n]));const budget=new VisitBudget(executed);
  const fail=(message:string,nodeId:string):never=>{throw new RuntimeFault(message,nodeId);};
  const consume=(node:GraphNode)=>{budget.visit(node.id);};
  function read(node:GraphNode,socket:string):Scalar{const edge=project.graph.connections.find(c=>c.target===node.id&&c.input===socket);if(!edge)return fail(`Entrada obrigatória ausente: ${socket}`,node.id);return evaluate(nodes.get(edge.source)!);}
  function evaluate(node:GraphNode):Scalar {
    consume(node);let value:Scalar;
    switch(node.kind){
      case 'constant':value=node.value;break;
      case 'variable':value=runtime.variables[node.variableId];break;
      case 'component-value':value=runtime.properties[node.componentId];break;
      case 'add':value=Number(read(node,'a'))+Number(read(node,'b'));break;
      case 'greater':value=Number(read(node,'a'))>Number(read(node,'b'));break;
      case 'empty':value=String(read(node,'value')).trim().length===0;break;
      case 'concat':value=String(read(node,'a'))+String(read(node,'b'));break;
      default:return fail('Node não fornece dados',node.id);
    }
    checkScalar(value,node.id);
    values[node.id]=value;return value;
  }
  try{
    let current=nodes.get(eventId);
    while(current){consume(current);trace.push(current.id);let output='next';
      if(current.kind==='condition')output=read(current,'test')?'yes':'no';
      else if(current.kind==='set'){runtime.variables[current.variableId]=read(current,'value');syncBindings(project,runtime);}
      else if(current.kind==='set-text')runtime.properties[current.componentId]=String(read(current,'value'));
      else if(current.kind!=='event')fail('Node de dados no fluxo de execução',current.id);
      const edge=project.graph.connections.find(c=>c.source===current!.id&&c.output===output);current=edge?nodes.get(edge.target):undefined;
    }
  }catch(error){const fault=error instanceof RuntimeFault?error:new RuntimeFault(String(error));fault.runtime=base;fault.trace=trace;throw fault;}
  return {runtime,trace,executedNodes:[...executed],values};
}
export function executeEvent(input:unknown,previous:RuntimeState|undefined,eventInput:unknown){
  const project=validateProject(input,{allowIncomplete:true});
  for(const n of project.graph.nodes)for(const socket of Object.keys(ports(n,project).inputs))if(!project.graph.connections.some(c=>c.target===n.id&&c.input===socket))throw new RuntimeFault('Entrada obrigatória ausente: '+socket,n.id);
  const runtime=checkedRuntime(project,previous);const event=runtimeEventSchema.parse(eventInput);
  const c=project.screens[0].components.find(c=>c.id===event.componentId);
  if(!c||(event.type==='button.click'?c.type!=='Button':c.type!=='Input')||!('disabled' in c.props)||c.props.disabled)throw new RuntimeFault('Evento de componente inexistente, incompatível ou desabilitado');
  let eventId:string|null=null;
  if(c.type==='Button')eventId=c.events.click;
  if(c.type==='Input'&&event.type==='input.change'){runtime.properties[c.id]=event.value;if(c.props.binding)runtime.variables[c.props.binding]=event.value;syncBindings(project,runtime);eventId=c.events.change;}
  const result=eventId?runGraph(project,runtime,eventId):{runtime,trace:[],executedNodes:[],values:{}};
  return {...result,event};
}
export function executeLegacy(input:unknown,previous?:Record<string,Scalar>){
  const project=validateProject(input);const runtime=initialRuntime(project);
  for(const v of project.variables)if(previous&&Object.hasOwn(previous,v.id))runtime.variables[v.id]=previous[v.id];
  syncBindings(project,runtime);checkedRuntime(project,runtime);
  const result=runGraph(project,runtime,project.graph.nodes.find(n=>n.kind==='event')!.id);return {state:result.runtime.variables,trace:result.trace};
}
export function handleRuntimeRequest(input:unknown):z.infer<typeof runtimeReplySchema>{
  const rawId=typeof input==='object'&&input!==null&&'requestId'in input?input.requestId:0;const requestId=typeof rawId==='number'&&Number.isInteger(rawId)&&rawId>=0?rawId:0;
  try{if(JSON.stringify(input).length>3_000_000)throw new RuntimeFault('Mensagem runtime excessiva');const request=requestSchema.parse(input);return {ok:true,requestId:request.requestId,...executeEvent(request.project,request.runtime,request.event)};}
  catch(error){const fault=error instanceof RuntimeFault?error:null;return {ok:false,requestId,error:(error instanceof z.ZodError?'Mensagem ou estado runtime inválido':error instanceof Error?error.message:String(error)).slice(0,2000),nodeId:fault?.nodeId??null,runtime:fault?.runtime??null,trace:fault?.trace??[]};}
}
