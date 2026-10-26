import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { exampleProject } from '../../../packages/forge-core/example';
import { validateProject } from '../../../packages/blueprint-core';
import { deserialize, serialize, type Project, type Scalar } from '../../../packages/project-schema';
import { Graph } from './Graph';
import { Preview } from './Preview';
import { t } from './i18n';
import './style.css';
const Code = lazy(() => import('./Code').then(m => ({ default: m.Code })));
const storageKey = 'btrk-forge:phase0:project';
function loadInitial() {
  try { const text = localStorage.getItem(storageKey); return text ? deserialize(text) : exampleProject(); }
  catch { return exampleProject(); }
}
function App() {
  const [project, setProject] = useState(loadInitial);
  const [tab, setTab] = useState<'graph' | 'preview' | 'code'>('graph');
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<Record<string, Scalar>>({});
  const [status, setStatus] = useState(t('ready') as string);
  const [trace, setTrace] = useState<string[]>([]);
  const worker = useRef<Worker | null>(null); const pending = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const instance = new Worker(new URL('../../../packages/preview-runtime/execution.worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = event => {
      if (timer.current) clearTimeout(timer.current); pending.current = false;
      if (event.data.ok) { setState(event.data.state); setTrace(event.data.trace); setStatus('Evento executado · estado atualizado'); }
      else setStatus(`Erro: ${event.data.error}`);
    };
    instance.onerror = () => { pending.current = false; setStatus('Erro no processo de execução'); };
    return () => { instance.terminate(); if (timer.current) clearTimeout(timer.current); };
  }, [generation]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, serialize(project)); } catch { setStatus('Não foi possível salvar rascunho local'); }
  }, [project]);
  function replace(next: Project) { setProject(next); setState({}); setTrace([]); pending.current = false; setGeneration(v => v + 1); }
  function apply(text: string) {
    try { replace(validateProject(deserialize(text))); setStatus('Projeto validado e carregado'); } catch (e) { setStatus(`Erro: ${String(e)}`); }
  }
  function run() {
    if (pending.current) return;
    try { validateProject(project); pending.current = true; worker.current?.postMessage({ project, state });
      timer.current = setTimeout(() => { worker.current?.terminate(); pending.current = false; setStatus('Execução interrompida após 2 segundos'); setGeneration(v => v + 1); }, 2000);
    } catch (e) { pending.current = false; setStatus(`Erro: ${String(e)}`); }
  }
  function save() {
    const blob = new Blob([serialize(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'projeto.btrk.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('JSON preparado para salvamento');
  }
  const screen = project.screens[0];
  function property(key: 'title' | 'text' | 'color', value: string) {
    const next = structuredClone(project); if (key === 'title') next.screens[0].title = value; else next.screens[0].button[key] = value;
    setProject(next);
  }
  return <div className="studio"><header><div className="brand-mark">F</div><div><h1>{t('brand')} <span>STUDIO</span></h1><small>BTRK STUDIO / {t('tagline')}</small></div><div className="phase">{t('phase')}</div><button onClick={save}>{t('save')}</button><button onClick={() => file.current?.click()}>{t('load')}</button><button className="primary" onClick={run}>▶ {t('run')}</button><input hidden ref={file} type="file" accept=".json" onChange={async e => { const chosen = e.target.files?.[0]; if (chosen) { if (chosen.size > 2_000_000) setStatus('Erro: arquivo excede 2 MB'); else apply(await chosen.text()); } e.target.value = ''; }} /></header>
    <aside className="navigation"><p className="eyebrow">EXPLORADOR</p><h2>{project.name}</h2><p className="schema">PROJETO LOCAL / ESQUEMA {project.schemaVersion}</p><div className="tree"><strong>▾ Telas</strong><span>▧ Tela principal</span><strong>▾ Blueprints</strong><span>◇ Clique do botão</span><strong>▾ Estado</strong>{project.variables.map(v => <span key={v.id}># {v.name} <b>{String(state[v.id] ?? v.initial)}</b></span>)}</div><div className="scope"><p>LABORATÓRIO TÉCNICO</p><small>Editor de nodes, modelo e runtime em validação. IA, plugins e atualizações desabilitados.</small></div><button onClick={() => { replace(exampleProject()); setStatus('Exemplo restaurado'); }}>{t('reset')}</button></aside>
    <main className="workspace"><nav>{(['graph', 'preview', 'code'] as const).map(value => <button key={value} aria-selected={tab === value} onClick={() => setTab(value)}>{t(value)}</button>)}<span>{project.graph.nodes.length} nodes / {project.graph.connections.length} conexões</span></nav><div className="canvas">{tab === 'graph' && <Graph generation={generation} project={project} onChange={setProject} onError={setStatus} />}{tab === 'preview' && <Preview project={project} state={state} run={run} />}{tab === 'code' && <Suspense fallback={<p>Carregando editor local…</p>}><Code project={project} apply={apply} /></Suspense>}</div><section className="console"><div className="eyebrow">SAÍDA DE EXECUÇÃO <span>RUNTIME ISOLADO / WORKER</span></div><p role="status">{status}</p><code>{trace.length ? trace.join(' → ') : 'Aguardando evento button.click'}</code></section></main>
    <aside className="properties"><p className="eyebrow">{t('properties').toUpperCase()}</p><h2>Tela principal</h2><label>Título<input maxLength={100} value={screen.title} onChange={e => property('title', e.target.value)} /></label><label>Texto do botão<input maxLength={100} value={screen.button.text} onChange={e => property('text', e.target.value)} /></label><label>Cor do botão<input type="color" value={screen.button.color} onChange={e => property('color', e.target.value)} /></label><hr/><p className="eyebrow">CONTRATO DO EVENTO</p><code>button.click</code><p className="hint">Evento → condição → ação. Dados tipados e execução independentes do Rete.js.</p><dl><dt>Plataformas alvo</dt><dd>Web / Windows</dd><dt>Capacidades nativas</dt><dd>Nenhuma</dd><dt>Persistência</dt><dd>JSON + rascunho local</dd></dl></aside>
    <footer><span className="dot" /> {t('offline')}<span>BTRK Forge 0.0.1 · Fase 0 · {project.distribution.channel}</span></footer></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
