import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { exampleProject } from '../../../packages/forge-core/example';
import { validateProject } from '../../../packages/blueprint-core';
import { deserialize, serialize, type Project } from '../../../packages/project-schema';
import { Graph } from './Graph';
import { Preview } from './Preview';
import { t } from './i18n';
import { getProjectClient } from './project-client';
import { useProjects } from './use-projects';
import { readDocument } from '../../../packages/forge-core/project-document';
import { Designer } from './Designer';
import { EditHistory, editProject, type Edit } from '../../../packages/designer-core';
import { useRuntime } from './use-runtime';
import { editGraph,makeNode } from '../../../packages/blueprint-core/edit';
import './style.css';
const Code = lazy(() => import('./Code').then(m => ({ default: m.Code })));
const storageKey = 'btrk-forge:phase0:project';
const nativeClient = getProjectClient();
function loadInitial() {
  if (nativeClient) return { project: exampleProject(), recoveryError: null };
  try { const text = localStorage.getItem(storageKey); return { project: text ? deserialize(text) : exampleProject(), recoveryError: null as string | null }; }
  catch { return { project: exampleProject(), recoveryError: 'Rascunho ilegível: original preservado. Abra um JSON válido ou restaure o exemplo para continuar.' }; }
}
function App() {
  const [initial] = useState(loadInitial);
  const [project, setProject] = useState(initial.project);
  const storageBlocked = useRef(initial.recoveryError !== null);
  const [tab, setTab] = useState<'design' | 'graph' | 'preview' | 'code'>('graph');
  const history = useRef(new EditHistory());
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [selectedNode,setSelectedNode]=useState<string|null>(null);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState(initial.recoveryError ?? t('ready') as string);
  const file = useRef<HTMLInputElement>(null);
  const projects = useProjects(nativeClient, project, replace, setStatus);
  const execution=useRuntime(project,setStatus,projects.receipt?.sessionId??String(projects.active));const state=execution.runtime.variables;const trace=execution.trace;
  useEffect(() => {
    if (nativeClient || storageBlocked.current) return;
    try { localStorage.setItem(storageKey, serialize(project)); } catch { setStatus('Não foi possível salvar rascunho local'); }
  }, [project]);
  function replace(next: Project) { if(serialize({...project,metadata:undefined})!==serialize({...next,metadata:undefined})){history.current=new EditHistory();setSelectedId(null);} storageBlocked.current = false; setProject(next); setGeneration(v => v + 1); }
  function changeProject(next:Project){try{validateProject(next,{allowIncomplete:true});history.current.record(project,next);setProject(next);}catch(error){setStatus(`Erro: ${error instanceof Error?error.message:String(error)}`);}}
  function designEdit(edit:Edit){try{const result=editProject(project,edit);changeProject(result.project);setSelectedId(result.selectedId);setStatus('Interface atualizada · alteração no modelo do projeto');}catch(error){setStatus(`Erro: ${error instanceof Error?error.message:String(error)}`);}}
  function undo(){setProject(history.current.undo(project));setGeneration(v=>v+1);setStatus('Operação desfeita');}
  function redo(){setProject(history.current.redo(project));setGeneration(v=>v+1);setStatus('Operação refeita');}
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(document.querySelector('[role=dialog]')||projects.busy)return;const editable=e.target instanceof HTMLElement&&!!e.target.closest('input,textarea,select,[contenteditable=true],.monaco-editor');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(nativeClient)void projects.save();else save();}if(!editable&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}if(!editable&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);});
  function apply(text: string) {
    try { const next = nativeClient ? readDocument(text) : validateProject(deserialize(text)); if (nativeClient) projects.applied(next); else replace(next); setStatus('Projeto validado e carregado'); } catch (e) { setStatus(`Erro: ${String(e)}`); }
  }
  function importJson(text: string) {
    if (!nativeClient) { apply(text); return; }
    try { projects.imported(readDocument(text)); } catch (e) { setStatus(`Erro: ${String(e)}`); }
  }
  function run(){const candidates=project.screens[0].components.filter(c=>c.type==='Button'&&!c.props.disabled&&c.events.click);const c=candidates.find(c=>c.id===selectedId)??candidates[0];if(!c){setStatus('Selecione um Button com evento no Design');return;}execution.dispatch({type:'button.click',componentId:c.id});}
  function openBlueprint(id:string){setSelectedId(id);let node=project.graph.nodes.find(n=>'componentId'in n&&n.componentId===id);const c=project.screens[0].components.find(c=>c.id===id);if(!node&&(c?.type==='Button'||c?.type==='Input')){try{node=makeNode(project,'event',id);changeProject(editGraph(project,{kind:'add',node}));setGeneration(v=>v+1);}catch(error){setStatus(String(error));return;}}setSelectedNode(node?.id??null);setTab('graph');}
  function save() {
    const blob = new Blob([serialize(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'projeto.btrk.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('JSON preparado para salvamento');
  }
  const screen = project.screens[0];
  function property(key: 'title' | 'text' | 'color', value: string) {
    const next = structuredClone(project); if (key === 'title') next.screens[0].title = value; else { const button=next.screens[0].components.find(c=>c.type==='Button'); if(button?.type==='Button'){if(key==='text')button.props.text=value;else button.style.background=value;} }
    changeProject(next);
  }
  return <div className={`studio ${nativeClient ? 'native-projects' : ''} ${tab === 'design' ? 'design-mode' : tab==='graph'?'logic-mode':''}`}><header><div className="brand-mark">F</div><div><h1>{t('brand')} <span>STUDIO</span></h1><small>BTRK STUDIO / {t('tagline')}</small></div><div className="phase">{nativeClient ? 'FASE 1C / BLUEPRINT ENGINE' : t('phase')}</div><button disabled={!projects.active || projects.busy} onClick={save}>{nativeClient ? 'Exportar JSON' : t('save')}</button><button disabled={projects.busy} onClick={() => file.current?.click()}>{nativeClient ? 'Importar JSON' : t('load')}</button>{!nativeClient && <button onClick={() => { replace(exampleProject()); setStatus('Exemplo restaurado'); }}>{t('reset')}</button>}<button disabled={!projects.active || projects.busy} className="primary" onClick={run}>▶ {t('run')}</button><input hidden ref={file} type="file" accept=".json" onChange={async e => { const chosen = e.target.files?.[0]; if (chosen) { if (chosen.size > 2_000_000) setStatus('Erro: arquivo excede 2 MB'); else importJson(await chosen.text()); } e.target.value = ''; }} /></header>
    {nativeClient && <div className="projectbar"><button disabled={projects.busy} onClick={() => void projects.create()}>Novo projeto</button><button disabled={projects.busy} onClick={() => void projects.open()}>Abrir projeto</button><button disabled={!projects.active || projects.busy || !!projects.receipt?.recoveryRequired} onClick={() => void projects.save()}>Salvar</button><button disabled={!projects.active || projects.busy} onClick={() => void projects.saveAs()}>Salvar como</button><button disabled={!projects.active || projects.busy} onClick={() => void projects.close()}>Fechar projeto</button>{projects.receipt?.recoveryAvailable && <button disabled={projects.busy} onClick={() => void projects.restore()}>Restaurar backup</button>}<span role="note" aria-label="Estado do projeto" className={projects.dirty ? 'unsaved' : ''}>{projects.busy ? 'Processando…' : !projects.active ? 'Nenhum projeto aberto' : projects.dirty ? '● Alterações não salvas' : '✓ Salvo no disco'}</span></div>}
    <aside className="navigation"><p className="eyebrow">EXPLORADOR</p><h2>{projects.active ? project.name : 'Projetos locais'}</h2><p className="schema">{projects.active ? `PROJETO LOCAL / ESQUEMA ${project.schemaVersion}` : 'NENHUM PROJETO ABERTO'}</p>{projects.receipt && <p className="project-location" title={projects.receipt.location}>{projects.receipt.location}</p>}{projects.active && <div className="tree"><strong>▾ Telas</strong><span>▧ Tela principal</span><strong>▾ Blueprints</strong><span>◇ Clique do botão</span><strong>▾ Estado</strong>{project.variables.map(v => <span key={v.id}># {v.name} <b>{String(state[v.id] ?? v.initial)}</b></span>)}</div>}<div className="scope"><p>{nativeClient ? 'PERSISTÊNCIA NATIVA' : 'LABORATÓRIO TÉCNICO'}</p><small>{nativeClient ? 'Um manifesto por pasta. Salvamento explícito, detecção de conflitos e recuperação por cópia válida. IA e plugins desabilitados.' : 'Editor de nodes, modelo e runtime em validação. IA, plugins e atualizações desabilitados.'}</small></div></aside>
    <main className="workspace">{projects.active ? <><nav>{(['design', 'graph', 'preview', 'code'] as const).map(value => <button key={value} aria-selected={tab === value} disabled={projects.busy} onClick={() => { if (nativeClient && projects.draft !== null && projects.draft !== serialize(project) && value !== 'code') { setStatus('Aplique ou reverta a edição JSON antes de mudar de aba.'); return; } setTab(value); }}>{t(value)}</button>)}<span>{project.graph.nodes.length} nodes / {project.graph.connections.length} conexões</span></nav>{projects.conflict && <div className="conflict-banner" role="alert"><span>Conflito no disco. Seu conteúdo em memória foi preservado.</span><button disabled={projects.busy} onClick={() => void projects.reload()}>Recarregar do disco</button><button disabled={projects.busy} onClick={() => void projects.saveAs()}>Salvar uma cópia</button><button onClick={projects.cancelConflict}>Cancelar conflito</button></div>}<div className="canvas" inert={projects.busy}>{tab === 'design' && <Designer project={project} edit={designEdit} selectedId={selectedId} select={setSelectedId} undo={undo} redo={redo} canUndo={history.current.canUndo} canRedo={history.current.canRedo} openBlueprint={openBlueprint} /> }{tab === 'graph' && <Graph generation={generation} project={project} onChange={changeProject} onError={setStatus} selectedId={selectedNode} onSelect={setSelectedNode} componentId={selectedId} onComponent={id=>{setSelectedId(id);setTab('design');}} undo={undo} redo={redo} canUndo={history.current.canUndo} canRedo={history.current.canRedo} executed={execution.executed} errorNode={execution.errorNode} />}{tab === 'preview' && <Preview project={project} runtime={execution.runtime} run={execution.dispatch} />}{tab === 'code' && <Suspense fallback={<p>Carregando editor local…</p>}><Code key={generation} project={project} apply={apply} draft={projects.draft} onDraft={nativeClient ? projects.setDraft : undefined} /></Suspense>}</div></> : <section className="empty-project"><p className="eyebrow">BTRK FORGE / PROJETOS LOCAIS</p><h2>Seu projeto começa em uma pasta.</h2><p>Crie um projeto ou abra seu manifesto para continuar. Seus arquivos permanecem no computador, sem conta ou nuvem.</p><div><button className="primary" onClick={() => void projects.create()}>Criar primeiro projeto</button><button onClick={() => void projects.open()}>Selecionar manifesto</button></div></section>}<section className="console"><div className="eyebrow">SAÍDA DE EXECUÇÃO <span>RUNTIME ISOLADO / WORKER</span></div><div className="debug-controls"><button disabled={!projects.active} onClick={execution.reset}>Reiniciar estado</button><button disabled={!execution.busy} onClick={execution.interrupt}>Interromper execução</button><span>Evento: {execution.event?execution.event.type+' · '+execution.event.componentId:'nenhum'}</span>{execution.errorNode&&<button onClick={()=>{setSelectedNode(execution.errorNode);setTab('graph');}}>Localizar erro {execution.errorNode}</button>}</div><p role="status">{status}</p><code>{trace.length ? trace.join(' → ') : 'Aguardando evento button.click'}</code><div aria-label="Variáveis runtime" className="runtime-values">{project.variables.map(v=><span key={v.id}>{v.name}: {String(state[v.id]??v.initial)}</span>)}</div></section></main>
    <aside className="properties"><p className="eyebrow">{t('properties').toUpperCase()}</p><h2>{projects.active ? 'Tela principal' : 'Sem seleção'}</h2><fieldset disabled={!projects.active || projects.busy || (nativeClient !== null && projects.draft !== null)}><label>Título<input maxLength={100} value={screen.title} onChange={e => property('title', e.target.value)} /></label><label>Texto do botão<input maxLength={100} value={screen.components.find(c=>c.type==='Button')?.props.text ?? ''} onChange={e => property('text', e.target.value)} /></label><label>Cor do botão<input type="color" value={screen.components.find(c=>c.type==='Button')?.style.background ?? '#FF934F'} onChange={e => property('color', e.target.value)} /></label></fieldset><hr/><p className="eyebrow">CONTRATO DO EVENTO</p><code>button.click</code><p className="hint">Evento → condição → ação. Dados tipados e execução independentes do Rete.js.</p><dl><dt>Plataformas alvo</dt><dd>Web / Windows</dd><dt>Capacidades nativas</dt><dd>{nativeClient ? 'Projetos · workspace autorizado' : 'Nenhuma'}</dd><dt>Persistência</dt><dd>{nativeClient ? 'Manifesto nativo + backup' : 'JSON + rascunho local'}</dd></dl></aside>
    <footer><span className="dot" /> {t('offline')}<span>BTRK Forge 0.0.1 · {nativeClient ? 'Fase 1C' : 'Laboratório web'} · {project.distribution.channel}</span></footer>{projects.dialogs}</div>;
}
createRoot(document.getElementById('root')!).render(<App />);
