import { component, type Component, type ComponentV3, type Project } from '../project-schema';
import { validateProject } from '../blueprint-core';
export type BatchEdit =
  | {kind:'batch-remove'|'batch-duplicate';ids:readonly string[]}
  | {kind:'batch-move';ids:readonly string[];parentId:string|null}
  | {kind:'batch-reorder';ids:readonly string[];direction:-1|1}
  | {kind:'batch-dimension';ids:readonly string[];axis:'width'|'height';value:Component['style']['width']}
  | {kind:'batch-alignment';ids:readonly string[];value:Component['style']['textAlign']};
export type Edit =
  | {kind:'add';type:ComponentV3['type'];parentId:string|null}
  | {kind:'update';id:string;component:Component}
  | {kind:'move';id:string;parentId:string|null;index:number}
  | {kind:'duplicate'|'remove';id:string}
  | BatchEdit;
type EditResult={project:Project;selectedId:string|null};

function validatedSelection(parents:ReadonlyMap<string,string|null>,ids:readonly string[]) {
  const selected=new Set(ids);
  if(!ids.length||selected.size!==ids.length||ids.some(id=>!parents.has(id)))throw new Error('Seleção inválida ou desatualizada.');
  return selected;
}

export function selectionRoots(components:readonly Component[], ids:readonly string[]) {
  const parents=new Map(components.map(c=>[c.id,c.parentId]));
  const selected=validatedSelection(parents,ids);
  return components.filter(c=>{
    if(!selected.has(c.id))return false;
    for(let parent=c.parentId;parent;parent=parents.get(parent)??null)if(selected.has(parent))return false;
    return true;
  });
}

function editBatch(project:Project, edit:BatchEdit):EditResult {
  const components=project.screens[0].components;
  if(edit.kind==='batch-alignment'||edit.kind==='batch-dimension'){
    const selected=validatedSelection(new Map(components.map(c=>[c.id,c.parentId])),edit.ids);
    const next=structuredClone(project);
    for(const c of next.screens[0].components)if(selected.has(c.id)){
      if(edit.kind==='batch-dimension')c.style[edit.axis]=edit.value;
      else c.style.textAlign=edit.value;
    }
    validateProject(next,{allowIncomplete:true});
    return {project:next,selectedId:edit.ids.at(-1)!};
  }
  const roots=selectionRoots(components,edit.ids);
  let next=project;
  if(edit.kind==='batch-remove'||edit.kind==='batch-duplicate'){
    for(const root of roots)next=editProject(next,{kind:edit.kind==='batch-remove'?'remove':'duplicate',id:root.id}).project;
  }
  if(edit.kind==='batch-move'||edit.kind==='batch-reorder'){
    const parent=roots[0].parentId;
    if(roots.some(c=>c.parentId!==parent))throw new Error('Selecione componentes irmãos para mover ou reordenar.');
    if(edit.kind==='batch-move'){
      if(edit.parentId!==parent){
        for(const root of roots)next=editProject(next,{kind:'move',id:root.id,parentId:edit.parentId,index:components.length}).project;
      }
    }else{
      next=structuredClone(project);
      const list=next.screens[0].components;
      const siblings=list.filter(c=>c.parentId===parent);
      const selected=new Set(roots.map(c=>c.id));
      const order=siblings.map((_,i)=>i);
      if(edit.direction===1)order.reverse();
      for(const i of order){
        const j=i+edit.direction;
        if(siblings[j]&&selected.has(siblings[i].id)&&!selected.has(siblings[j].id)){
          [siblings[i],siblings[j]]=[siblings[j],siblings[i]];
        }
      }
      let index=0;
      next.screens[0].components=list.map(c=>c.parentId===parent?siblings[index++]:c);
    }
  }
  validateProject(next,{allowIncomplete:true});
  return {project:next,selectedId:edit.kind==='batch-remove'?null:edit.ids.at(-1)!};
}

export function editProject(project:Project, edit:Edit):EditResult {
  if(!('id' in edit)&&edit.kind!=='add')return editBatch(project,edit);
  const next=structuredClone(project);const list=next.screens[0].components;
  const find=(id:string)=>{const c=list.find(c=>c.id===id);if(!c)throw new Error('Componente não encontrado');return c;};
  const ids=new Set([next.id,...next.screens.map(s=>s.id),...next.variables.map(v=>v.id),...next.graph.nodes.map(n=>n.id),...next.graph.connections.map(e=>e.id),...next.resources.map(r=>r.id),...list.map(c=>c.id)]);
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
      else {const mapping=new Map([...group].map(id=>[id,fresh()]));const copies=list.filter(c=>group.has(c.id)).map(c=>{const copy={...structuredClone(c),id:mapping.get(c.id)!,parentId:c.parentId&&mapping.has(c.parentId)?mapping.get(c.parentId)!:c.parentId};if(copy.type==='Button'&&next.graph.nodes.some(n=>n.id===copy.events.click&&n.kind==='event'&&n.componentId))copy.events.click=null;if(copy.type==='Input')copy.events.change=null;return copy;});list.splice(list.indexOf(target)+1,0,...copies);selectedId=mapping.get(target.id)!;}
    }
  }
  validateProject(next,{allowIncomplete:true});return {project:next,selectedId};
}
export class EditHistory {
  private past:Project[]=[];private future:Project[]=[];
  get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  record(before:Project,after:Project){validateProject(before,{allowIncomplete:true});validateProject(after,{allowIncomplete:true});if(JSON.stringify(before)===JSON.stringify(after))return;this.past.push(structuredClone(before));this.past=this.past.slice(-100);this.future=[];}
  undo(current:Project){const p=this.past.pop();if(!p)return current;this.future.push(structuredClone(current));if(current.metadata)p.metadata=structuredClone(current.metadata);return p;}
  redo(current:Project){const p=this.future.pop();if(!p)return current;this.past.push(structuredClone(current));if(current.metadata)p.metadata=structuredClone(current.metadata);return p;}
}
