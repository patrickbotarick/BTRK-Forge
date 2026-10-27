import { z } from 'zod';
import { TraceCollector, debugRequestSchema, type DebugTrace } from '../runtime-debug';
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
function syncBindings(project:Project,runtime:RuntimeState,debug?:TraceCollector,nodeId:string|null=null){for(const c of project.screens[0].components)if(c.type==='Input'&&c.props.binding){const before=runtime.properties[c.id];runtime.properties[c.id]=String(runtime.variables[c.props.binding]);debug?.add({kind:'binding',nodeId,target:c.id,scope:'properties',before,after:runtime.properties[c.id]});}}
function runGraph(project:Project,base:RuntimeState,eventId:string,debug?:TraceCollector){
  const runtime=structuredClone(base);const trace:string[]=[];const executed=new Set<string>();const values:Record<string,Scalar>={};
  const nodes=new Map(project.graph.nodes.map(n=>[n.id,n]));const budget=new VisitBudget(executed);
  const fail=(message:string,nodeId:string):never=>{throw new RuntimeFault(message,nodeId);};
  const consume=(node:GraphNode)=>{budget.visit(node.id);};
  function read(node:GraphNode,socket:string):Scalar{const edge=project.graph.connections.find(c=>c.target===node.id&&c.input===socket);if(!edge)return fail(`Entrada obrigatória ausente: ${socket}`,node.id);return evaluate(nodes.get(edge.source)!);}
  function evaluate(node:GraphNode):Scalar {
    consume(node);debug?.add({kind:'evaluate',nodeId:node.id});let value:Scalar;
    switch(node.kind){
      case 'constant':value=node.value;break;
      case 'variable':value=runtime.variables[node.variableId];debug?.add({kind:'read-variable',nodeId:node.id,target:node.variableId,value});break;
      case 'component-value':value=runtime.properties[node.componentId];debug?.add({kind:'read-property',nodeId:node.id,target:node.componentId,value});break;
      case 'add':value=Number(read(node,'a'))+Number(read(node,'b'));break;
      case 'greater':value=Number(read(node,'a'))>Number(read(node,'b'));break;
      case 'empty':value=String(read(node,'value')).trim().length===0;break;
      case 'concat':value=String(read(node,'a'))+String(read(node,'b'));break;
      default:return fail('Node não fornece dados',node.id);
    }
    checkScalar(value,node.id);
    values[node.id]=value;debug?.add({kind:'value',nodeId:node.id,value});return value;
  }
  try{
    let current=nodes.get(eventId);
    while(current){consume(current);trace.push(current.id);if(current.kind==='set'||current.kind==='set-text')debug?.add({kind:'action',nodeId:current.id});let output='next';
      if(current.kind==='condition'){debug?.add({kind:'condition',nodeId:current.id});output=read(current,'test')?'yes':'no';debug?.add({kind:'branch',nodeId:current.id,branch:output as 'yes'|'no'});}
      else if(current.kind==='set'){const value=read(current,'value'),before=runtime.variables[current.variableId];runtime.variables[current.variableId]=value;debug?.add({kind:'assign',nodeId:current.id,target:current.variableId,scope:'variables',before,after:value});syncBindings(project,runtime,debug,current.id);}
      else if(current.kind==='set-text'){const value=String(read(current,'value')),before=runtime.properties[current.componentId];runtime.properties[current.componentId]=value;debug?.add({kind:'set-text',nodeId:current.id,target:current.componentId,scope:'properties',before,after:value});}
      else if(current.kind!=='event')fail('Node de dados no fluxo de execução',current.id);
      const edge=project.graph.connections.find(c=>c.source===current!.id&&c.output===output);current=edge?nodes.get(edge.target):undefined;
    }
  }catch(error){const fault=error instanceof RuntimeFault?error:new RuntimeFault(String(error));debug?.add({kind:'error',nodeId:fault.nodeId,message:fault.message.slice(0,2000)});debug?.mutations(runtime,base,'rollback',fault.nodeId);debug?.add({kind:'rollback',nodeId:fault.nodeId});fault.runtime=base;fault.trace=trace;throw fault;}
  return {runtime,trace,executedNodes:[...executed],values};
}
export function executeEvent(input:unknown,previous:RuntimeState|undefined,eventInput:unknown,debug?:TraceCollector){
  const project=validateProject(input,{allowIncomplete:true});
  for(const n of project.graph.nodes)for(const socket of Object.keys(ports(n,project).inputs))if(!project.graph.connections.some(c=>c.target===n.id&&c.input===socket))throw new RuntimeFault('Entrada obrigatória ausente: '+socket,n.id);
  const runtime=checkedRuntime(project,previous);const event=runtimeEventSchema.parse(eventInput);
  const c=project.screens[0].components.find(c=>c.id===event.componentId);
  if(!c||(event.type==='button.click'?c.type!=='Button':c.type!=='Input')||!('disabled' in c.props)||c.props.disabled)throw new RuntimeFault('Evento de componente inexistente, incompatível ou desabilitado');
  let eventId:string|null=null;
  if(c.type==='Button')eventId=c.events.click;
  debug?.add({kind:'event',nodeId:c.type==='Button'?c.events.click:c.type==='Input'?c.events.change:null});
  if(c.type==='Input'&&event.type==='input.change'){eventId=c.events.change;const before=runtime.properties[c.id];runtime.properties[c.id]=event.value;debug?.add({kind:'ingest',nodeId:eventId,target:c.id,scope:'properties',before,after:event.value});if(c.props.binding){const previous=runtime.variables[c.props.binding];runtime.variables[c.props.binding]=event.value;debug?.add({kind:'ingest',nodeId:eventId,target:c.props.binding,scope:'variables',before:previous,after:event.value});}syncBindings(project,runtime,debug,eventId);}
  const result=eventId?runGraph(project,runtime,eventId,debug):{runtime,trace:[],executedNodes:[],values:{}};
  debug?.add({kind:'commit',nodeId:eventId});return {...result,event};
}
export function executeLegacy(input:unknown,previous?:Record<string,Scalar>){
  const project=validateProject(input);const runtime=initialRuntime(project);
  for(const v of project.variables)if(previous&&Object.hasOwn(previous,v.id))runtime.variables[v.id]=previous[v.id];
  syncBindings(project,runtime);checkedRuntime(project,runtime);
  const result=runGraph(project,runtime,project.graph.nodes.find(n=>n.kind==='event')!.id);return {state:result.runtime.variables,trace:result.trace};
}
export function handleRuntimeRequest(input:unknown,debug?:TraceCollector):z.infer<typeof runtimeReplySchema>{
  const rawId=typeof input==='object'&&input!==null&&'requestId'in input?input.requestId:0;const requestId=typeof rawId==='number'&&Number.isInteger(rawId)&&rawId>=0?rawId:0;
  try{if(JSON.stringify(input).length>3_000_000)throw new RuntimeFault('Mensagem runtime excessiva');const request=requestSchema.parse(input);return {ok:true,requestId:request.requestId,...executeEvent(request.project,request.runtime,request.event,debug)};}
  catch(error){const fault=error instanceof RuntimeFault?error:null;return {ok:false,requestId,error:(error instanceof z.ZodError?'Mensagem ou estado runtime inválido':error instanceof Error?error.message:String(error)).slice(0,2000),nodeId:fault?.nodeId??null,runtime:fault?.runtime??null,trace:fault?.trace??[]};}
}

/** Separate diagnostic envelope; legacy request/reply contracts remain unchanged. */
export function handleDebugRequest(input:unknown){
  const parsed=debugRequestSchema.safeParse(input);
  if(!parsed.success)return null;
  const {debugSession,...request}=parsed.data;const collector=new TraceCollector();
  const reply=handleRuntimeRequest(request,collector);
  const outcome:DebugTrace['outcome']=reply.ok?'commit':reply.runtime?'rollback':'error';
  if(!reply.ok&&outcome==='error')collector.add({kind:'error',nodeId:reply.nodeId,message:reply.error});
  return {version:1 as const,session:debugSession,reply,debug:collector.finish(outcome)};
}
