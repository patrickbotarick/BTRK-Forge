export function clampSize(value:number,min:number,max:number){
  return Math.min(Math.max(value,min),Math.max(min,max));
}

export function sideWidths(available:number,left:number,right:number){
  const budget=Math.max(0,available-320-2*12);
  const leftMin=left?160:0, rightMin=right?180:0;
  const leftSize=left?clampSize(left,leftMin,Math.min(420,budget-rightMin)):0;
  const rightSize=right?clampSize(right,rightMin,Math.min(460,budget-leftSize)):0;
  return {leftSize,rightSize,leftMax:Math.max(leftMin,Math.min(420,budget-rightSize)),
    rightMax:Math.max(rightMin,Math.min(460,budget-leftSize))};
}

export const workspaceModes=['design','graph','preview','code','debug'] as const;
export type WorkspaceMode=typeof workspaceModes[number];
type Region='left'|'center'|'right'|'bottom';

function panel(label:string,region:Region,modes:readonly WorkspaceMode[],collapsible:boolean,movable:boolean,lifecycle:'mode'|'session'){
  return {label,region,modes,collapsible,movable,lifecycle,central:region==='center'};
}

export const workspacePanels={
  library:panel('Biblioteca','left',['design'],true,true,'mode'),
  hierarchy:panel('Hierarquia','left',['design'],true,true,'mode'),
  inspector:panel('Inspector','right',['design'],true,true,'mode'),
  designer:panel('Designer','center',['design'],false,false,'mode'),
  blueprint:panel('Blueprint','center',['graph'],false,false,'mode'),
  code:panel('Código','center',['code'],false,false,'mode'),
  preview:panel('Preview','center',['preview'],false,false,'mode'),
  debugger:panel('Depuração','center',['debug'],false,false,'mode'),
  console:panel('Console','bottom',workspaceModes,true,true,'session'),
};

type PanelId=keyof typeof workspacePanels;
const regions=['left','center','right','bottom'] as const;
type Group={panels:PanelId[];active:PanelId|null;collapsed:boolean};
export type ModeLayout={groups:Record<Region,Group>;leftWidth:number;rightWidth:number;consoleHeight:number};
export type WorkspaceLayout={version:1;modes:Record<WorkspaceMode,ModeLayout>};
export const workspaceStorageKey='btrk-forge:studio:workspace';

export function defaultMode(mode:WorkspaceMode):ModeLayout{
  const group=(region:Region):Group=>{
    const panels=(Object.keys(workspacePanels) as PanelId[]).filter(id=>{
      const entry=workspacePanels[id];
      return entry.region===region&&entry.modes.includes(mode);
    });
    return {panels,active:region==='center'?panels[0]:null,collapsed:false};
  };
  return {
    groups:{left:group('left'),center:group('center'),right:group('right'),bottom:group('bottom')},
    leftWidth:220,rightWidth:270,consoleHeight:158,
  };
}

export function defaultWorkspace():WorkspaceLayout{
  return {version:1,modes:{design:defaultMode('design'),graph:defaultMode('graph'),
    code:defaultMode('code'),preview:defaultMode('preview'),debug:defaultMode('debug')}};
}

function record(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value)
    &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}

function dimension(value:unknown,min:number,max:number){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)throw new Error('Dimensão inválida');
  return clampSize(value,min,max);
}

export function parseWorkspace(raw:string|null):WorkspaceLayout{
  const result=defaultWorkspace();
  if(raw===null)return result;
  try{
    const value:unknown=JSON.parse(raw);
    if(!record(value,['version','modes'])||value.version!==1||!record(value.modes,workspaceModes))return defaultWorkspace();
    for(const mode of workspaceModes){
      const input=value.modes[mode], defaults=result.modes[mode];
      if(!record(input,['groups','leftWidth','rightWidth','consoleHeight'])||!record(input.groups,regions))return defaultWorkspace();
      for(const region of regions){
        const group=input.groups[region], expected=defaults.groups[region];
        if(!record(group,['panels','active','collapsed'])||!Array.isArray(group.panels)
          ||group.panels.length!==expected.panels.length||!expected.panels.every((id,index)=>group.panels instanceof Array&&group.panels[index]===id)
          ||group.active!==expected.active||typeof group.collapsed!=='boolean'
          ||(group.collapsed&&(region==='center'||expected.panels.length===0)))return defaultWorkspace();
        expected.collapsed=group.collapsed;
      }
      defaults.leftWidth=dimension(input.leftWidth,160,420);
      defaults.rightWidth=dimension(input.rightWidth,180,460);
      defaults.consoleHeight=dimension(input.consoleHeight,80,360);
    }
    return result;
  }catch{
    return defaultWorkspace();
  }
}

export function loadWorkspace(storage:Pick<Storage,'getItem'>){
  return parseWorkspace(storage.getItem(workspaceStorageKey));
}

export function saveWorkspace(storage:Pick<Storage,'setItem'>,layout:WorkspaceLayout){
  storage.setItem(workspaceStorageKey,JSON.stringify(layout));
}
