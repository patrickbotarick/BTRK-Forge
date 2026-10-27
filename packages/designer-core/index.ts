import { component, type Component, type Project } from '../project-schema';
import { validateProject } from '../blueprint-core';
export type Edit =
  | {kind:'add';type:Component['type'];parentId:string|null}
  | {kind:'update';id:string;component:Component}
  | {kind:'move';id:string;parentId:string|null;index:number}
  | {kind:'duplicate'|'remove';id:string};
export function editProject(project:Project, edit:Edit):{project:Project;selectedId:string|null} {
  const next=structuredClone(project);const list=next.screens[0].components;
  const find=(id:string)=>{const c=list.find(c=>c.id===id);if(!c)throw new Error('Componente não encontrado');return c;};
  const ids=new Set([next.id,...next.screens.map(s=>s.id),...next.variables.map(v=>v.id),...next.graph.nodes.map(n=>n.id),...next.graph.connections.map(e=>e.id),...list.map(c=>c.id)]);
  const fresh=()=>{let id;do{id=`component-${crypto.randomUUID()}`;}while(ids.has(id));ids.add(id);return id;};
  let selectedId:string|null=null;
  if(edit.kind==='add'){const c=component(edit.type,fresh(),edit.parentId);list.push(c);selectedId=c.id;}
  else {
    const target=find(edit.id);selectedId=target.id;
    if(edit.kind==='update'){if(edit.component.id!==target.id || edit.component.type!==target.type)throw new Error('Identidade e tipo não podem ser alterados');list[list.indexOf(target)]=structuredClone(edit.component);}
    if(edit.kind==='move'){
      if(!Number.isInteger(edit.index)||edit.index<0)throw new Error('Posição inválida');
      list.splice(list.indexOf(target),1);target.parentId=edit.parentId;
      const siblings=list.filter(c=>c.parentId===edit.parentId);
      const anchor=siblings[edit.index];const position=anchor?list.indexOf(anchor):siblings.length?list.indexOf(siblings.at(-1)!)+1:list.length;
      list.splice(position,0,target);
    }
    if(edit.kind==='duplicate'||edit.kind==='remove'){
      const group=new Set([target.id]);let changed=true;while(changed){changed=false;for(const c of list)if(c.parentId&&group.has(c.parentId)&&!group.has(c.id)){group.add(c.id);changed=true;}}
      if(edit.kind==='remove'){next.screens[0].components=list.filter(c=>!group.has(c.id));selectedId=null;}
      else {const mapping=new Map([...group].map(id=>[id,fresh()]));const copies=list.filter(c=>group.has(c.id)).map(c=>({...structuredClone(c),id:mapping.get(c.id)!,parentId:c.parentId&&mapping.has(c.parentId)?mapping.get(c.parentId)!:c.parentId}));list.splice(list.indexOf(target)+1,0,...copies);selectedId=mapping.get(target.id)!;}
    }
  }
  validateProject(next,{allowIncomplete:true});return {project:next,selectedId};
}
export class EditHistory {
  private past:Project[]=[];private future:Project[]=[];
  get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  record(before:Project,after:Project){if(JSON.stringify(before)===JSON.stringify(after))return;this.past.push(structuredClone(before));this.past=this.past.slice(-100);this.future=[];}
  undo(current:Project){const p=this.past.pop();if(!p)return current;this.future.push(structuredClone(current));if(current.metadata)p.metadata=structuredClone(current.metadata);return p;}
  redo(current:Project){const p=this.future.pop();if(!p)return current;this.past.push(structuredClone(current));if(current.metadata)p.metadata=structuredClone(current.metadata);return p;}
}
