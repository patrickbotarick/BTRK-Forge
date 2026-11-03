import { DimensionField } from './DimensionField';
import { viewportWidths, type Viewport } from './viewport';
import { useEffect, useRef, useState } from 'react';
import type { Component, ComponentStyle, Project } from '../../../packages/project-schema';
import { selectionRoots, type BatchEdit, type Edit, type LibraryComponent } from '../../../packages/designer-core';
import { renderVisual } from '../../../packages/preview-runtime/visual-renderer';
const library = ['Text','Button','Input','Container','Panel'] as const satisfies readonly LibraryComponent[];
export function Designer({project,edit,selectedId,select,undo,redo,canUndo,canRedo,openBlueprint,viewport,setViewport}:{project:Project;edit:(e:Edit)=>string|void;selectedId:string|null;select:(id:string|null)=>void;undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;openBlueprint?:(id:string)=>void;viewport:Viewport;setViewport:(value:Viewport)=>void}) {
  const components=project.screens[0].components;
  const selected=components.find(c=>c.id===selectedId);
  const canvas=useRef<HTMLDivElement>(null);
  const [confirmRemove,setConfirmRemove]=useState(false);
  const [selection,setSelection]=useState<string[]>([]);
  const anchor=useRef<string|null>(null);
  const treeRoot=useRef<HTMLButtonElement>(null);
  const treeButtons=useRef(new Map<string,HTMLButtonElement>());
  const [batchError,setBatchError]=useState('');
  const [destination,setDestination]=useState('');
  const activeIds=selectedId&&components.some(c=>c.id===selectedId)
    ? selection.includes(selectedId)?selection.filter(id=>components.some(c=>c.id===id)):[selectedId]
    : [];
  const multi=activeIds.length>1;
  const selectedSet=new Set(activeIds);
  const roots=multi?selectionRoots(components,activeIds):[];
  const sharedParent=roots.every(c=>c.parentId===roots[0]?.parentId);
  const destinations=components.filter(c=>c.type==='Container').map(c=>{
    let ancestor:Component|undefined=c;
    while(ancestor&&!selectedSet.has(ancestor.id))ancestor=components.find(parent=>parent.id===ancestor?.parentId);
    return {id:c.id,blocked:!!ancestor};
  });
  const destinationBlocked=destinations.some(c=>c.id===destination&&c.blocked);
  const commonAlignment=selected?.style.textAlign;
  const mixedAlignment=components.some(c=>selectedSet.has(c.id)&&c.style.textAlign!==commonAlignment);
  const orderedIds:string[]=[];
  function flatten(parentId:string|null){
    for(const c of components.filter(c=>c.parentId===parentId)){
      orderedIds.push(c.id);
      if(c.type==='Container')flatten(c.id);
    }
  }
  flatten(null);

  function choose(id:string|null, modifiers?:{ctrlKey:boolean;metaKey:boolean;shiftKey:boolean}){
    setBatchError('');
    setDestination('');
    let ids=id?[id]:[];
    if(id&&modifiers?.shiftKey){
      const from=orderedIds.indexOf(anchor.current??selectedId??id);
      const to=orderedIds.indexOf(id);
      if(from>=0&&to>=0)ids=orderedIds.slice(Math.min(from,to),Math.max(from,to)+1);
    }else{
      if(id&&(modifiers?.ctrlKey||modifiers?.metaKey)){
        ids=selectedSet.has(id)?activeIds.filter(value=>value!==id):[...activeIds,id];
      }
      anchor.current=id;
    }
    setSelection(ids);
    select(id&&ids.includes(id)?id:ids.at(-1)??null);
  }
  function dimensions(){
    const members=components.filter(c=>selectedSet.has(c.id));
    return (['width','height'] as const).map(axis=>{
      const first=members[0]?.style[axis];
      const value=members.every(c=>c.style[axis]===first)?first:undefined;
      return <DimensionField key={JSON.stringify([axis,members.map(c=>[c.id,c.style[axis]])])}
        label={axis==='width'?'Largura':'Altura'} value={value}
        apply={dimension=>{
          if(multi)runBatch({kind:'batch-dimension',ids:activeIds,axis,value:dimension});
          else style(axis,dimension);
        }}/>;
    });
  }
  function runBatch(command:BatchEdit){
    const message=edit(command);
    setBatchError(message??'');
    if(!message&&command.kind==='batch-remove'){
      choose(null);
      treeRoot.current?.focus();
    }
  }
  const [fieldError,setFieldError]=useState<{project:Project;id:string;field:string;message:string}|null>(null);
  const errorFor=(field:string)=>fieldError?.project===project&&fieldError.id===selectedId&&fieldError.field===field?fieldError.message:undefined;
  function report(field:string,message?:string|void){
    setFieldError(message&&selectedId?{project,id:selectedId,field,message}:null);
  }
  function errorMessage(field:string){
    const message=errorFor(field);
    return message&&<span id={`design-error-${field}`} className="logic-error" role="alert">{message}</span>;
  }
  useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(confirmRemove){if(e.key==='Escape')setConfirmRemove(false);if(e.key==='Tab'){const buttons=[...document.querySelectorAll<HTMLButtonElement>('[aria-label="Remover componente"] button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}}return;}if(e.key==='Delete'&&selected&&!target.closest('input,textarea,select,[contenteditable=true]')){e.preventDefault();setConfirmRemove(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[selected,confirmRemove]);
  const canvasSelect=useRef(choose);
  canvasSelect.current=choose;
  useEffect(()=>{
    renderVisual(canvas.current!,project.screens[0],{design:true,onSelect:id=>canvasSelect.current(id)});
  },[project]);
  useEffect(()=>{
    const valid=new Set(activeIds);
    for(const element of canvas.current?.querySelectorAll<HTMLElement>('[data-component-id]')??[]){
      const pressed=valid.has(element.dataset.componentId??'');
      element.setAttribute('aria-pressed',String(pressed));
      element.style.outline=pressed?'2px solid #FF934F':'1px dashed #536879';
    }
  });
  useEffect(()=>{
    setSelection(ids=>ids.filter(id=>components.some(c=>c.id===id)));
    if(anchor.current&&!components.some(c=>c.id===anchor.current))anchor.current=null;
  },[components]);
  function canvasModifiers(event:React.MouseEvent|React.KeyboardEvent){
    if(!(event.ctrlKey||event.metaKey||event.shiftKey))return;
    if('key' in event&&event.key!=='Enter'&&event.key!==' ')return;
    const element=(event.target as Element).closest<HTMLElement>('[data-component-id]');
    if(!element?.dataset.componentId)return;
    event.preventDefault();
    event.stopPropagation();
    choose(element.dataset.componentId,event);
  }
  const parent=selected?.type==='Container'?selected.id:selected?.parentId??null;
  const add=(type:LibraryComponent)=>edit({kind:'add',type,parentId:parent});
  const change=(mutate:(c:Component)=>void)=>{if(!selected)return;const c=structuredClone(selected);mutate(c);edit({kind:'update',id:c.id,component:c});};
  const style=(key:keyof ComponentStyle,value:ComponentStyle[keyof ComponentStyle])=>change(c=>{Object.assign(c.style,{[key]:value});});
  const number=(label:string,value:number,update:(n:number)=>void,min=0,max=2000)=>{
    const field=label.replace(/[^\p{L}\p{N}]+/gu,'-');
    return <label>{label}<input type="number" min={min} max={max} value={value}
      aria-invalid={!!errorFor(field)} aria-describedby={errorFor(field)?`design-error-${field}`:undefined}
      onChange={event=>{
        const input=event.currentTarget;
        if(input.value===''){report(field,'Informe um número.');return;}
        if(!input.validity.valid){report(field,`Use um inteiro entre ${min} e ${max}.`);return;}
        report(field);
        if(input.valueAsNumber!==value)update(input.valueAsNumber);
      }}/>{errorMessage(field)}</label>;
  };
  function tree(parentId:string|null,depth=0):React.ReactNode {
    return components.filter(c=>c.parentId===parentId).map(c=><li key={c.id}>
      <button className="tree-select" aria-pressed={selectedSet.has(c.id)}
        ref={element=>{if(element)treeButtons.current.set(c.id,element);else treeButtons.current.delete(c.id);}}
        onClick={event=>choose(c.id,event)} onKeyDown={event=>{
          const index=orderedIds.indexOf(c.id);
          const target=event.key==='ArrowDown'?orderedIds[index+1]:event.key==='ArrowUp'?orderedIds[index-1]
            :event.key==='Home'?orderedIds[0]:event.key==='End'?orderedIds.at(-1):undefined;
          if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
            event.preventDefault();
            if(target){
              treeButtons.current.get(target)?.focus();
              if(event.shiftKey)choose(target,event);
            }
          }
          if((event.key==='Enter'||event.key===' ')&&(event.ctrlKey||event.metaKey||event.shiftKey)){
            event.preventDefault();
            choose(c.id,event);
          }
        }} style={{paddingLeft:12+depth*14}} title={c.id}>
        {c.type==='Container'?'▾':'◇'} {c.type} {'text' in c.props?c.props.text.slice(0,20):c.type==='Input'?c.props.placeholder:''}
      </button>
      {c.type==='Container'&&<ul>{tree(c.id,depth+1)}</ul>}
    </li>);
  }
  const siblings=components.filter(c=>c.parentId===selected?.parentId);const position=siblings.findIndex(c=>c.id===selectedId);
  function drop(event:React.DragEvent) {event.preventDefault();const value=event.dataTransfer.getData('application/btrk-component');const type=library.find(entry=>entry===value);if(type)add(type);}
  return <section className="designer" aria-label="Editor visual">
    <aside className="design-library"><p className="eyebrow">COMPONENTES</p><div className="catalog">{library.map(type=><button key={type} draggable onDragStart={e=>e.dataTransfer.setData('application/btrk-component',type)} onClick={()=>add(type)}>+ {type}</button>)}</div><p className="hint">Insere no container selecionado ou ao lado do elemento. Arraste ao canvas ou use os botões.</p><p className="eyebrow">HIERARQUIA</p><button className="screen-select" ref={treeRoot} aria-pressed={!selected} onClick={()=>choose(null)}>▧ Tela · {project.screens[0].title||'Principal'}</button><ul className="component-tree" aria-label="Hierarquia de componentes">{tree(null)}</ul>{!components.length&&<p className="hint">Adicione o primeiro componente.</p>}</aside>
    <div className="design-center"><div className="design-toolbar"><button disabled={!canUndo} onClick={undo}>Desfazer</button><button disabled={!canRedo} onClick={redo}>Refazer</button><label>Viewport Design<select aria-label="Viewport Design" value={viewport} onChange={e=>setViewport(e.target.value as Viewport)}><option value="desktop">Desktop · fluido</option><option value="web">Web · 768 px</option><option value="mobile">Celular · 375 px</option></select></label></div><p className="design-caption">DESIGN CANVAS · {components.length}/200 componentes · seleção por clique ou Enter · viewport responsivo</p><div className="design-scroll" onDragOver={e=>e.preventDefault()} onDrop={drop}><div className="design-artboard" style={{width:viewportWidths[viewport]}}><h1>{project.screens[0].title}</h1><div ref={canvas} data-testid="design-canvas" className="design-render" onClickCapture={canvasModifiers} onKeyDownCapture={canvasModifiers} /></div></div></div>
    <aside className="design-inspector" aria-label="Inspector"><p className="eyebrow">INSPECTOR</p>{multi?<div>
      <h2>{activeIds.length} componentes selecionados</h2>
      <fieldset><legend>Geral</legend>
        <button onClick={()=>runBatch({kind:'batch-duplicate',ids:activeIds})}>Duplicar seleção</button>
        <button onClick={()=>setConfirmRemove(true)}>Remover seleção</button>
      </fieldset>
      <fieldset><legend>Aparência</legend>
        <label>Alinhamento do texto em lote<select value={mixedAlignment?'':commonAlignment} onChange={event=>
          runBatch({kind:'batch-alignment',ids:activeIds,value:event.target.value as ComponentStyle['textAlign']})}>
          {mixedAlignment&&<option value="" disabled>Valores mistos</option>}
          <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
        </select></label>
      </fieldset>
      <fieldset><legend>Layout</legend>
        {dimensions()}
        {!sharedParent&&<p className="hint">Mover e reordenar exigem componentes irmãos.</p>}
        <button disabled={!sharedParent} onClick={()=>runBatch({kind:'batch-reorder',ids:activeIds,direction:-1})}>Subir seleção</button>
        <button disabled={!sharedParent} onClick={()=>runBatch({kind:'batch-reorder',ids:activeIds,direction:1})}>Descer seleção</button>
        <label>Destino da seleção<select disabled={!sharedParent} value={destination} onChange={event=>setDestination(event.target.value)}>
          <option value="">Escolher destino</option><option value=":root">Tela (raiz)</option>
          {destinations.map(c=><option key={c.id} value={c.id} disabled={c.blocked}>{c.id}{c.blocked?' · dentro da seleção':''}</option>)}
        </select></label>
        <button disabled={!sharedParent||!destination||destinationBlocked} onClick={()=>runBatch({kind:'batch-move',ids:activeIds,parentId:destination===':root'?null:destination})}>Mover seleção</button>
      </fieldset>
      {batchError&&<p className="logic-error" role="alert">{batchError}</p>}
    </div>:selected?<><h2>{selected.type}</h2><code className="component-id">{selected.id}</code>
      <fieldset><legend>Geral</legend>
      <div className="design-actions"><button disabled={position<=0} onClick={()=>edit({kind:'move',id:selected.id,parentId:selected.parentId,index:position-1})}>Subir</button><button disabled={position>=siblings.length-1} onClick={()=>edit({kind:'move',id:selected.id,parentId:selected.parentId,index:position+1})}>Descer</button><button onClick={()=>edit({kind:'duplicate',id:selected.id})}>Duplicar</button><button onClick={()=>setConfirmRemove(true)}>Remover</button></div>
      {selected.type==='Text'&&<label>Conteúdo textual<textarea aria-label="Conteúdo textual" maxLength={1000} value={selected.props.text} onChange={e=>change(c=>{if(c.type==='Text')c.props.text=e.target.value;})}/></label>}
        {selected.type==='Button'&&<label>Texto do componente<input maxLength={100} value={selected.props.text} onChange={e=>change(c=>{if(c.type==='Button')c.props.text=e.target.value;})}/></label>}
      </fieldset>
      <fieldset><legend>Aparência</legend>
      {(['background','color','borderColor'] as const).map((key,i)=><label key={key}>{['Fundo','Cor do texto','Cor da borda'][i]}<input aria-label={['Fundo','Cor do texto','Cor da borda'][i]} value={selected.style[key]} onChange={e=>{if(/^(#[0-9a-fA-F]{6}|transparent)$/.test(e.target.value))style(key,e.target.value);}} type="color" disabled={selected.style[key]==='transparent'}/><button onClick={()=>style(key,selected.style[key]==='transparent'?'#1E2933':'transparent')}>{selected.style[key]==='transparent'?'Definir cor':'Tornar transparente'}</button></label>)}
      {number('Espessura da borda',selected.style.borderWidth,n=>style('borderWidth',n),0,12)}{number('Raio da borda',selected.style.borderRadius,n=>style('borderRadius',n),0,64)}{number('Tamanho da fonte',selected.style.fontSize,n=>style('fontSize',n),10,96)}<label>Peso da fonte<select aria-label="Peso da fonte" value={selected.style.fontWeight} onChange={e=>style('fontWeight',e.target.value as ComponentStyle['fontWeight'])}>{['400','500','600','700'].map(v=><option key={v}>{v}</option>)}</select></label><label>Alinhamento do texto<select aria-label="Alinhamento do texto" value={selected.style.textAlign} onChange={e=>style('textAlign',e.target.value as ComponentStyle['textAlign'])}>{['left','center','right'].map(v=><option key={v}>{v}</option>)}</select></label>
      </fieldset>
      <fieldset><legend>Layout</legend>
      <label>Mover para<select aria-label="Mover para" aria-invalid={!!errorFor('parent')} aria-describedby={errorFor('parent')?'design-error-parent':undefined} value={selected.parentId??''} onChange={e=>report('parent',edit({kind:'move',id:selected.id,parentId:e.target.value||null,index:components.length}))}><option value="">Tela (raiz)</option>{components.filter(c=>c.type==='Container'&&c.id!==selected.id).map(c=><option value={c.id} key={c.id}>{c.id}</option>)}</select>{errorMessage('parent')}</label>
      {dimensions()}
      {selected.type==='Container'&&<><label>Direção<select aria-label="Direção" value={selected.props.direction} onChange={e=>change(c=>{if(c.type==='Container')c.props.direction=e.target.value as 'row'|'column';})}><option value="column">Vertical</option><option value="row">Horizontal</option></select></label>{number('Gap (px)',selected.props.gap,n=>change(c=>{if(c.type==='Container')c.props.gap=n;}),0,128)}{number('Padding (px)',selected.props.padding,n=>change(c=>{if(c.type==='Container')c.props.padding=n;}),0,128)}<label>Alinhamento dos filhos<select aria-label="Alinhamento dos filhos" value={selected.props.align} onChange={e=>change(c=>{if(c.type==='Container')c.props.align=e.target.value as typeof c.props.align;})}>{['stretch','flex-start','center','flex-end'].map(v=><option key={v}>{v}</option>)}</select></label><label>Justificação<select aria-label="Justificação" value={selected.props.justify} onChange={e=>change(c=>{if(c.type==='Container')c.props.justify=e.target.value as typeof c.props.justify;})}>{['flex-start','center','flex-end','space-between'].map(v=><option key={v}>{v}</option>)}</select></label></>}
      </fieldset>
      {selected.type!=='Container'&&<fieldset><legend>Comportamento</legend>
      {selected.type==='Text'&&<button onClick={()=>openBlueprint?.(selected.id)}>Abrir comportamento no Blueprint</button>}
{selected.type==='Input'&&<><label>Binding do Input<select aria-label="Binding do Input" value={selected.props.binding??''} onChange={e=>change(c=>{if(c.type==='Input')c.props.binding=e.target.value||null;})}><option value="">Sem binding (valor inicial)</option>{project.variables.filter(v=>v.type==='string').map(v=><option key={v.id} value={v.id}>{v.name} · {v.id}</option>)}</select></label><label>Placeholder<input maxLength={100} value={selected.props.placeholder} onChange={e=>change(c=>{if(c.type==='Input')c.props.placeholder=e.target.value;})}/></label><label>Valor inicial<input maxLength={1000} value={selected.props.initialValue} onChange={e=>change(c=>{if(c.type==='Input')c.props.initialValue=e.target.value;})}/></label><label>Tipo de entrada<select aria-label="Tipo de entrada" value={selected.props.inputType} onChange={e=>change(c=>{if(c.type==='Input')c.props.inputType=e.target.value as 'text'|'email'|'number';})}>{['text','email','number'].map(v=><option key={v}>{v}</option>)}</select></label><p className="hint">O valor digitado é transitório. Binding string usa a variável como fonte de estado.</p></>}
      {(selected.type==='Button'||selected.type==='Input')&&<label className="check-label"><input type="checkbox" checked={selected.props.disabled} onChange={e=>change(c=>{if(c.type==='Button'||c.type==='Input')c.props.disabled=e.target.checked;})}/>Desabilitado</label>}
      </fieldset>}
      {(selected.type==='Button'||selected.type==='Input')&&<fieldset><legend>Eventos</legend>
      <button onClick={()=>openBlueprint?.(selected.id)}>Abrir comportamento no Blueprint</button>
        {selected.type==='Button'&&<><label>Evento de clique<select aria-label="Evento de clique" value={selected.events.click??''} onChange={e=>change(c=>{if(c.type==='Button')c.events.click=e.target.value||null;})}><option value="">Sem ação</option>{project.graph.nodes.filter(n=>n.kind==='event'&&n.event==='button.click'&&(!n.componentId||n.componentId===selected.id)).map(n=><option value={n.id} key={n.id}>button.click · {n.id}</option>)}</select></label><p className="hint">Evento legado compartilhado ou onClick por ID. Abra o comportamento para criar um fluxo.</p></>}
        {selected.type==='Input'&&<label>Evento de alteração<select aria-label="Evento de alteração" value={selected.events.change??''} onChange={e=>change(c=>{if(c.type==='Input')c.events.change=e.target.value||null;})}><option value="">Sem ação onChange</option>{project.graph.nodes.filter(n=>n.kind==='event'&&n.event==='input.change'&&n.componentId===selected.id).map(n=><option key={n.id} value={n.id}>{n.id}</option>)}</select></label>}
      </fieldset>}
    </>:<p className="hint">Selecione um componente na árvore ou no canvas. Para inserir na raiz, selecione a tela.</p>}</aside>
    {confirmRemove&&selected&&<div className="modal-shade"><section role="dialog" aria-modal="true" aria-label="Remover componente" className="project-dialog"><h2>Remover componente e seus descendentes?</h2><p>A operação será recusada se nodes ainda referenciarem estes componentes. Remova ou redirecione essas referências no Blueprint primeiro. Nenhum node será apagado automaticamente. Você poderá desfazer.</p><div className="dialog-actions"><button autoFocus onClick={()=>setConfirmRemove(false)}>Cancelar</button><button onClick={()=>{if(multi)runBatch({kind:'batch-remove',ids:activeIds});else if(!edit({kind:'remove',id:selected.id}))treeRoot.current?.focus();setConfirmRemove(false);}}>Confirmar remoção</button></div></section></div>}
  </section>;
}
