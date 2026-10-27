import { exampleProject } from '../packages/forge-core/example';
import { component,type GraphNode,type Project } from '../packages/project-schema';
import { validateProject } from '../packages/blueprint-core';
export function logicFixture():Project {
 const p=exampleProject();p.name='Forge Logic Demo';
 const input=component('Input','name-input'),text=component('Text','result-text'),button=p.screens[0].components[0];
 if(input.type!=='Input'||text.type!=='Text'||button.type!=='Button')throw Error();
 input.props.binding='name';input.events.change='change';text.props.text='Resultado';button.props.text='Confirmar';button.events.click='click';
 p.variables.push({id:'name',name:'Nome',type:'string',initial:''});p.screens[0].components.push(input,text);
 const nodes:Omit<GraphNode,'position'>[]=[];void nodes;
 p.graph.nodes=[{id:'click',kind:'event',event:'button.click',componentId:button.id,position:{x:0,y:0}},
 {id:'change',kind:'event',event:'input.change',componentId:input.id,position:{x:0,y:250}},
 {id:'read',kind:'component-value',componentId:input.id,property:'value',position:{x:0,y:500}},
 {id:'empty',kind:'empty',position:{x:300,y:400}},
 {id:'branch',kind:'condition',position:{x:600,y:0}},
 {id:'prompt',kind:'constant',value:'Digite seu nome',position:{x:600,y:300}},
 {id:'prefix',kind:'constant',value:'Olá, ',position:{x:300,y:600}},
 {id:'suffix',kind:'constant',value:'!',position:{x:600,y:600}},
 {id:'concat',kind:'concat',position:{x:600,y:850}},
 {id:'greeting',kind:'concat',position:{x:900,y:600}},
 {id:'yes',kind:'set-text',componentId:text.id,position:{x:900,y:0}},
 {id:'no',kind:'set-text',componentId:text.id,position:{x:1200,y:0}},
 {id:'typing',kind:'set-text',componentId:text.id,position:{x:300,y:200}}];
 const edges=[['click','next','branch','in'],['read','value','empty','value'],['empty','value','branch','test'],['branch','yes','yes','in'],['branch','no','no','in'],['prompt','value','yes','value'],['prefix','value','concat','a'],['read','value','concat','b'],['concat','value','greeting','a'],['suffix','value','greeting','b'],['greeting','value','no','value'],['change','next','typing','in'],['read','value','typing','value']];
 p.graph.connections=edges.map(([source,output,target,input],i)=>({id:`logic-edge-${i}`,source,output,target,input}));return validateProject(p);
}
