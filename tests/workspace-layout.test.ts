import { describe, expect, it } from 'vitest';
import { clampSize, sideWidths, defaultWorkspace, parseWorkspace, loadWorkspace, saveWorkspace, workspaceStorageKey, type WorkspaceLayout } from '../apps/studio/src/workspace-layout';

describe('dimensões do workspace',()=>{
  it('limita valores acima e abaixo dos extremos',()=>{
    expect(clampSize(-10,80,360)).toBe(80);
    expect(clampSize(400,80,360)).toBe(360);
  });

  it('protege o centro em janela estreita e recupera os tamanhos pedidos em janela maior',()=>{
    const narrow=sideWidths(1000,420,460);
    expect(narrow.leftSize+narrow.rightSize+24).toBeLessThanOrEqual(680);
    expect(sideWidths(1440,420,460)).toMatchObject({leftSize:420,rightSize:460});
  });

  it('libera espaço do painel recolhido e restaura os padrões',()=>{
    expect(sideWidths(1000,0,460)).toMatchObject({leftSize:0,rightSize:460});
    expect(sideWidths(1000,220,270)).toMatchObject({leftSize:220,rightSize:270});
  });
});

describe('preferências versionadas do Studio',()=>{
  it('usa defaults para ausência, JSON corrompido e versão futura',()=>{
    for(const raw of [null,'{',JSON.stringify({...defaultWorkspace(),version:2})]){
      expect(parseWorkspace(raw)).toEqual(defaultWorkspace());
    }
  });

  it('recusa painéis duplicados, ausentes, desconhecidos ou em região incompatível',()=>{
    for(const change of [
      (x:WorkspaceLayout)=>x.modes.design.groups.left.panels.push('library'),
      (x:WorkspaceLayout)=>{x.modes.design.groups.center.panels=[];},
      (x:WorkspaceLayout)=>{x.modes.design.groups.left.panels[0]='inspector';},
      (x:WorkspaceLayout)=>Object.assign(x.modes.design.groups.left,{panels:['unknown','hierarchy']}),
      (x:WorkspaceLayout)=>{x.modes.design.groups.center.collapsed=true;},
      (x:WorkspaceLayout)=>Reflect.deleteProperty(x.modes,'preview'),
    ]){
      const layout=defaultWorkspace();
      layout.modes.design.leftWidth=300;
      change(layout);
      expect(parseWorkspace(JSON.stringify(layout))).toEqual(defaultWorkspace());
    }
  });

  it('limita dimensões positivas e recusa dimensões impossíveis',()=>{
    const layout=defaultWorkspace();
    Object.assign(layout.modes.design,{leftWidth:999,rightWidth:10,consoleHeight:800});
    expect(parseWorkspace(JSON.stringify(layout)).modes.design).toMatchObject({leftWidth:420,rightWidth:180,consoleHeight:360});
    layout.modes.design.leftWidth=0;
    expect(parseWorkspace(JSON.stringify(layout))).toEqual(defaultWorkspace());
  });

  it('persiste somente na chave do Studio e restaura todos os modos',()=>{
    const entries=new Map([['project','documento original']]);
    const storage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value);}};
    const layout=defaultWorkspace();
    layout.modes.design.groups.right.collapsed=true;
    layout.modes.graph.consoleHeight=200;
    saveWorkspace(storage,layout);
    expect(loadWorkspace(storage)).toEqual(layout);
    expect(entries.has(workspaceStorageKey)).toBe(true);
    saveWorkspace(storage,defaultWorkspace());
    expect(loadWorkspace(storage)).toEqual(defaultWorkspace());
    expect(entries.get('project')).toBe('documento original');
  });
});
