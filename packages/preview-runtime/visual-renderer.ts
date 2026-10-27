import type { Project } from '../project-schema';
// Self-contained: the same function is embedded in the isolated iframe and used by Design.
// Only validated declarative values reach this function. No HTML, URL, class or code from a project.
export function renderVisual(host:HTMLElement, screen:Project['screens'][number], options:{design?:boolean;controlledInputs?:boolean;selected?:string|null;onSelect?:(id:string)=>void;onEvent?:(event:{type:'button.click';componentId:string}|{type:'input.change';componentId:string;value:string})=>void}={}) {
  const active=document.activeElement instanceof HTMLInputElement&&host.contains(document.activeElement)?document.activeElement:null;
  const focusId=active?.dataset.componentId;const selection=active?.selectionStart;
  const values=new Map<string,string>();
  for(const input of host.querySelectorAll<HTMLInputElement>('input[data-component-id]')) values.set(input.dataset.componentId!,input.value);
  host.replaceChildren();
  const elements=new Map<string,HTMLElement>();
  for(const c of screen.components) {
    const element=document.createElement(c.type==='Text'?'p':c.type==='Button'?'button':c.type==='Input'?'input':'div');
    element.dataset.componentId=c.id;
    const s=c.style;
    Object.assign(element.style,{boxSizing:'border-box',width:typeof s.width==='number'?s.width+'px':s.width==='fill'?'100%':'auto',height:typeof s.height==='number'?s.height+'px':s.height==='fill'?'100%':'auto',maxWidth:'100%',minWidth:'0',background:s.background,color:s.color,border:s.borderWidth+'px solid '+s.borderColor,borderRadius:s.borderRadius+'px',fontSize:s.fontSize+'px',fontWeight:s.fontWeight,textAlign:s.textAlign,margin:'0',overflowWrap:'anywhere',fontFamily:'inherit'});
    if(c.type==='Container')Object.assign(element.style,{display:'flex',flexDirection:c.props.direction,flexWrap:'wrap',gap:c.props.gap+'px',padding:c.props.padding+'px',alignItems:c.props.align,justifyContent:c.props.justify,minHeight:options.design?'54px':'0'});
    if(c.type==='Text'||c.type==='Button')element.textContent=c.props.text;
    if(c.type==='Button') {
      const button=element as HTMLButtonElement;button.type='button';button.disabled=!options.design&&c.props.disabled;button.style.padding='12px 18px';
      if(!options.design&&c.events.click)button.addEventListener('click',function(){options.onEvent?.({type:'button.click',componentId:c.id});});
    }
    if(c.type==='Input') {
      const input=element as HTMLInputElement;input.type=c.props.inputType;input.placeholder=c.props.placeholder;input.maxLength=1000;input.value=!options.design&&!options.controlledInputs&&values.has(c.id)?values.get(c.id)!:c.props.initialValue;input.disabled=!options.design&&c.props.disabled;input.readOnly=!!options.design;input.style.padding='12px';
      if(!options.design)input.addEventListener('input',function(){options.onEvent?.({type:'input.change',componentId:c.id,value:input.value});});
    }
    if(options.design){element.tabIndex=0;element.setAttribute('aria-label','Selecionar '+c.type+' '+c.id);element.setAttribute('aria-pressed',String(c.id===options.selected));element.style.cursor='pointer';element.style.outline=c.id===options.selected?'2px solid #FF934F':'1px dashed #536879';element.style.outlineOffset='2px';element.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();options.onSelect?.(c.id);});element.addEventListener('keydown',function(event){if((event as KeyboardEvent).key==='Enter'||(event as KeyboardEvent).key===' '){event.preventDefault();event.stopPropagation();options.onSelect?.(c.id);}});}
    elements.set(c.id,element);
  }
  for(const c of screen.components)(c.parentId?elements.get(c.parentId)!:host).append(elements.get(c.id)!);
  if(focusId){const target=elements.get(focusId);if(target instanceof HTMLInputElement){target.focus({preventScroll:true});if(selection!==null&&selection!==undefined&&target.type==='text')target.setSelectionRange(Math.min(selection,target.value.length),Math.min(selection,target.value.length));}}
}
