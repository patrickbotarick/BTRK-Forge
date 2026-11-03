import { useMemo, useState } from 'react';
import type { Connection, Project } from '../../../packages/project-schema';
import { ports } from '../../../packages/blueprint-core';
import { editGraph, makeNode, type GraphEdit } from '../../../packages/blueprint-core/edit';
import { catalog, matchesNode } from './node-catalog';
import type { PortAnchor } from './rete';

type ConnectedEdit = Extract<GraphEdit, {kind:'add-connected'}>;
type Option = {label:string; edit:ConnectedEdit} | {label:string; reason:string};

function optionsFor(project:Project, anchor:PortAnchor, componentId?:string) {
  const origin=project.graph.nodes.find(node=>node.id===anchor.nodeId);
  if(!origin)return [];
  const definition=ports(origin,project);
  const type=(anchor.side==='input'?definition.inputs:definition.outputs)[anchor.key];
  if(!type)return [];
  return catalog.flatMap<Option>(item=>{
    try{
      const node=makeNode(project,item.kind,componentId);
      if(node.kind==='constant')node.value=item.value??1;
      if(node.kind==='variable'||node.kind==='set'){
        const variable=project.variables.find(v=>v.type===type);
        if(type!=='exec'&&variable)node.variableId=variable.id;
      }
      if(node.kind==='event'&&project.screens[0].components.some(component=>
        component.id===node.componentId&&((component.type==='Button'&&component.events.click)||
          (component.type==='Input'&&component.events.change)))){
        return [{label:item.label,reason:'O componente já tem um evento associado.'}];
      }
      const opposite=ports(node,project);
      const matching=Object.entries(anchor.side==='input'?opposite.outputs:opposite.inputs)
        .filter(([,portType])=>portType===type);
      if(!matching.length)return [{label:item.label,reason:`Sem porta ${anchor.side==='input'?'de saída':'de entrada'} do tipo ${type}.`}];
      node.position={x:origin.position.x+(anchor.side==='output'?300:-300),y:origin.position.y+120};
      return matching.map(([port]):Option=>{
        const edge:Connection=anchor.side==='output'
          ? {id:`edge-${crypto.randomUUID()}`,source:origin.id,output:anchor.key,target:node.id,input:port}
          : {id:`edge-${crypto.randomUUID()}`,source:node.id,output:port,target:origin.id,input:anchor.key};
        const edit:ConnectedEdit={kind:'add-connected',node,edge};
        const variable='variableId' in node?project.variables.find(v=>v.id===node.variableId):undefined;
        const label=`${item.label}${variable?' · '+variable.name:''} · ${port}`;
        try{editGraph(project,edit);return {label,edit};}
        catch(error){return {label,reason:error instanceof Error?error.message:String(error)};}
      });
    }catch(error){return [{label:item.label,reason:error instanceof Error?error.message:String(error)}];}
  });
}

export function ContextPalette({project,anchor,componentId,close,apply}:{
  project:Project;anchor:PortAnchor;componentId?:string;close:()=>void;apply:(edit:ConnectedEdit)=>void;
}){
  const [query,setQuery]=useState('');
  const [active,setActive]=useState(0);

  const options=useMemo(()=>optionsFor(project,anchor,componentId),[project,anchor,componentId]);
  const results=options.filter(option=>{
    const item=catalog.find(entry=>option.label===entry.label||option.label.startsWith(entry.label+' · '));
    return item&&matchesNode(option.label,item.kind,query);
  });
  const compatible=results.filter(option=>'edit' in option);
  const incompatible=results.filter(option=>'reason' in option);
  return <div className="modal-shade"><section className="project-dialog contextual-palette" role="dialog"
    aria-modal="true" aria-label="Paleta contextual de nodes" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
      if(event.key==='Tab'){
        const focusable=[...event.currentTarget.querySelectorAll<HTMLElement>('input,button,summary')];
        const first=focusable[0],last=focusable.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }}>
    <h2>Paleta contextual de nodes</h2>
    <p>{anchor.side==='input'?'Entrada':'Saída'} {anchor.key} · {anchor.nodeId}</p>
    <label>Pesquisar na paleta<input autoFocus value={query} role="combobox"
      aria-controls="context-node-results" aria-expanded="true"
      aria-activedescendant={compatible[active]?`context-node-${active}`:undefined}
      onChange={event=>{setQuery(event.target.value);setActive(0);}}
      onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();
          if(compatible.length){
            const next=(active+(event.key==='ArrowDown'?1:-1)+compatible.length)%compatible.length;
            setActive(next);
            document.getElementById(`context-node-${next}`)?.scrollIntoView({block:'nearest'});
          }
        }
        if(event.key==='Enter'){event.preventDefault();const choice=compatible[active];if(choice)apply(choice.edit);}
      }}/></label>
    <p role="status">{compatible.length} opções compatíveis</p>
    <div className="palette-results" role="listbox" aria-label="Nodes compatíveis" id="context-node-results">
      {compatible.map((option,index)=><div key={option.label} id={`context-node-${index}`}
        role="option" aria-selected={index===active} onMouseDown={event=>event.preventDefault()}
        onClick={()=>apply(option.edit)}>{option.label}</div>)}
    </div>
    {incompatible.length>0&&<details><summary>Opções incompatíveis ({incompatible.length})</summary>
      <ul>{incompatible.map(option=><li key={option.label}>{option.label} — {option.reason}</li>)}</ul>
    </details>}
    <button onClick={close}>Cancelar</button>
  </section></div>;
}
