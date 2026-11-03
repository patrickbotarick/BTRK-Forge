import { useWorkspace, WorkspaceViewMenu } from './WorkspacePreferences';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { clampSize, sideWidths } from './workspace-layout';

function useExtent(axis:'width'|'height'){
  const ref=useRef<HTMLDivElement>(null);
  const [extent,setExtent]=useState(0);
  useLayoutEffect(()=>{
    const element=axis==='height'?ref.current!.parentElement!:ref.current!;
    const measure=()=>setExtent(axis==='width'?element.clientWidth:element.clientHeight);
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    return ()=>observer.disconnect();
  },[axis]);
  return {ref,extent};
}

function Divider({label,controls,axis,value,min,max,direction,onResize,onPreview}:{
  label:string;controls:string;axis:'x'|'y';value:number;min:number;max:number;direction:1|-1;onResize:(value:number)=>void;onPreview:(value:number|null)=>void;
}){
  const drag=useRef<{pointer:number;start:number;value:number}|null>(null);
  const [active,setActive]=useState(false);
  const coordinate=(e:{clientX:number;clientY:number})=>axis==='x'?e.clientX:e.clientY;
  const resize=(next:number)=>onResize(clampSize(next,min,max));
  return <div className="workspace-divider" role="separator" tabIndex={0}
    aria-label={label} aria-controls={controls} aria-orientation={axis==='x'?'vertical':'horizontal'}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    onPointerDown={e=>{
      if(e.button!==0||drag.current)return;
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current={pointer:e.pointerId,start:coordinate(e),value};
      setActive(true);
    }}
    onPointerMove={e=>{
      const current=drag.current;
      if(current?.pointer===e.pointerId)onPreview(clampSize(current.value+(coordinate(e)-current.start)*direction,min,max));
    }}
    onPointerUp={e=>{
      const current=drag.current;
      if(current?.pointer===e.pointerId&&coordinate(e)!==current.start)resize(current.value+(coordinate(e)-current.start)*direction);
    }}
    onLostPointerCapture={()=>{
      onPreview(null);
      drag.current=null;
      setActive(false);
    }}
    onPointerCancel={e=>{
      if(drag.current?.pointer===e.pointerId)onPreview(null);
    }}
    onKeyDown={e=>{
      if(e.key==='Escape'&&drag.current){
        e.preventDefault();
        e.stopPropagation();
        onPreview(null);
        e.currentTarget.releasePointerCapture(drag.current.pointer);
        return;
      }
      const negative=axis==='x'?'ArrowLeft':'ArrowUp', positive=axis==='x'?'ArrowRight':'ArrowDown';
      if(![negative,positive,'Home','End'].includes(e.key))return;
      e.preventDefault();
      e.stopPropagation();
      resize(e.key==='Home'?min:e.key==='End'?max:value+(e.key===negative?-1:1)*direction*(e.shiftKey?32:8));
    }}>
    {active&&<span className="workspace-resize-overlay" aria-hidden="true"/>}
  </div>;
}

export function WorkspaceShell({left,right,children}:{left:ReactNode;right:ReactNode;children:ReactNode}){
  const {ref,extent}=useExtent('width');
  const leftId=useId(), rightId=useId();
  const {layout,update}=useWorkspace();
  const [leftDraft,setLeftDraft]=useState<number|null>(null), [rightDraft,setRightDraft]=useState<number|null>(null);
  const leftWidth=leftDraft??layout.leftWidth, rightWidth=rightDraft??layout.rightWidth;
  const leftOpen=!layout.groups.left.collapsed, rightOpen=!layout.groups.right.collapsed;
  const setLeftOpen=(open:boolean)=>update(next=>{next.groups.left.collapsed=!open;});
  const setRightOpen=(open:boolean)=>update(next=>{next.groups.right.collapsed=!open;});
  const {leftSize,rightSize,leftMax,rightMax}=sideWidths(extent||1000,leftOpen?leftWidth:0,rightOpen?rightWidth:0);
  return <div ref={ref} className="workspace-shell" role="region" aria-label="Editor visual">
    <div className="workspace-layout-controls">
      <button aria-controls={leftId} aria-expanded={leftOpen} onClick={()=>setLeftOpen(!leftOpen)}>{leftOpen?'Recolher':'Reabrir'} Biblioteca e hierarquia</button>
      <button aria-controls={rightId} aria-expanded={rightOpen} onClick={()=>setRightOpen(!rightOpen)}>{rightOpen?'Recolher':'Reabrir'} Inspector</button>
      <button onClick={()=>update(next=>{next.leftWidth=220;next.rightWidth=270;next.groups.left.collapsed=false;next.groups.right.collapsed=false;})}>Restaurar layout do Designer</button>
    </div>
    <div className="workspace-regions" style={{gridTemplateColumns:`${leftSize}px ${leftOpen?12:0}px minmax(0,1fr) ${rightOpen?12:0}px ${rightSize}px`}}>
      <div id={leftId} className="workspace-side" hidden={!leftOpen}>{left}</div>
      <div className="workspace-divider-slot">{leftOpen&&<Divider label="Largura da biblioteca e hierarquia" controls={leftId} axis="x" min={160} max={leftMax} value={leftSize} direction={1} onPreview={setLeftDraft} onResize={value=>update(next=>{next.leftWidth=value;})}/>}</div>
      {children}
      <div className="workspace-divider-slot">{rightOpen&&<Divider label="Largura do Inspector" controls={rightId} axis="x" min={180} max={rightMax} value={rightSize} direction={-1} onPreview={setRightDraft} onResize={value=>update(next=>{next.rightWidth=value;})}/>}</div>
      <div id={rightId} className="workspace-side" hidden={!rightOpen}>{right}</div>
    </div>
  </div>;
}

export function WorkspaceConsole({status,children}:{status:string;children:ReactNode}){
  const id=useId();
  const {layout,update}=useWorkspace();
  const [draft,setDraft]=useState<number|null>(null);
  const open=!layout.groups.bottom.collapsed;
  const height=draft??layout.consoleHeight;
  const {ref,extent}=useExtent('height');
  const max=Math.max(80,Math.min(360,Math.floor(extent*.45)));
  const size=clampSize(height,80,max);
  return <div className="workspace-console" ref={ref}>
    {open&&<Divider label="Altura do console" controls={id} axis="y" min={80} max={max} value={size} direction={-1} onPreview={setDraft} onResize={value=>update(next=>{next.consoleHeight=value;})}/>}
    <div className="workspace-layout-controls">
      <button aria-controls={id} aria-expanded={open} onClick={()=>update(next=>{next.groups.bottom.collapsed=open;})}>{open?'Recolher console':'Reabrir console'}</button>
      <button onClick={()=>update(next=>{next.consoleHeight=158;next.groups.bottom.collapsed=false;})}>Restaurar console</button>
      <WorkspaceViewMenu/>
      {!open&&<span role="status">{status}</span>}
    </div>
    <section id={id} className="console" hidden={!open} style={{height:size}}>{children}</section>
  </div>;
}
