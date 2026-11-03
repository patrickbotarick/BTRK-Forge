import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { defaultMode, defaultWorkspace, loadWorkspace, saveWorkspace, workspacePanels,
  type ModeLayout, type WorkspaceLayout, type WorkspaceMode } from './workspace-layout';

type WorkspaceContextValue={
  layout:ModeLayout;
  update:(change:(layout:ModeLayout)=>void)=>void;
  resetMode:()=>void;
  resetAll:()=>void;
  unavailable:boolean;
};
const WorkspaceContext=createContext<WorkspaceContextValue|null>(null);

export function WorkspacePreferences({mode,children}:{mode:WorkspaceMode;children:ReactNode}){
  const [initial]=useState(()=>{
    try{return {layout:loadWorkspace(window.localStorage),unavailable:false};}
    catch{return {layout:defaultWorkspace(),unavailable:true};}
  });
  const current=useRef(initial.layout);
  const [workspace,setWorkspace]=useState(initial.layout);
  const [unavailable,setUnavailable]=useState(initial.unavailable);
  const persist=(next:WorkspaceLayout)=>{
    current.current=next;
    setWorkspace(next);
    try{saveWorkspace(window.localStorage,next);setUnavailable(false);}
    catch{setUnavailable(true);}
  };
  const update=(change:(layout:ModeLayout)=>void)=>{
    const next=structuredClone(current.current);
    change(next.modes[mode]);
    persist(next);
  };
  return <WorkspaceContext.Provider value={{
    layout:workspace.modes[mode],update,unavailable,
    resetMode:()=>persist({...current.current,modes:{...current.current.modes,[mode]:defaultMode(mode)}}),
    resetAll:()=>persist(defaultWorkspace()),
  }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(){
  const preferences=useContext(WorkspaceContext);
  if(!preferences)throw new Error('WorkspacePreferences ausente');
  return preferences;
}

export function WorkspaceViewMenu(){
  const {layout,update,resetMode,resetAll,unavailable}=useWorkspace();
  return <>
    <details className="workspace-view-menu">
      <summary>Exibir</summary>
      <div className="workspace-view-options">
        {(['left','right','bottom'] as const).filter(region=>layout.groups[region].panels.length>0).map(region=>{
          const group=layout.groups[region];
          const label=group.panels.map(id=>workspacePanels[id].label).join(' e ');
          return <label key={region}><input type="checkbox" checked={!group.collapsed}
            onChange={()=>update(next=>{next.groups[region].collapsed=!group.collapsed;})}/>{label}</label>;
        })}
        <button onClick={resetMode}>Restaurar layout deste modo</button>
        <button onClick={resetAll}>Restaurar layouts de todos os modos</button>
      </div>
    </details>
    {unavailable&&<small role="status">Preferências de layout disponíveis apenas nesta sessão.</small>}
  </>;
}
