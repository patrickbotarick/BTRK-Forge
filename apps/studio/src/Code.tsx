import { useLayoutEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/languages/definitions/typescript/register.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import { ModelJson } from './ModelJson';
import type { Project } from '../../../packages/project-schema';
import type { GeneratedArtifact, SourceRange } from '../../../packages/typescript-codegen';
import type { CodeState } from '../../../packages/code-navigation/generation-client';
import { nodeOccurrences, originAt } from '../../../packages/code-navigation';

type Props = { project: Project; apply: (text: string) => void; draft?: string | null; onDraft?: (text: string | null) => void;
  generated: CodeState & { retry(): void }; selectedNode: string | null; selectNode(id: string | null): void; openNode(id: string): void;
  undo(): void; redo(): void; canUndo: boolean; canRedo: boolean };

function GeneratedEditor({ artifact, selectedNode, selectNode, openNode }: { artifact: GeneratedArtifact | null; selectedNode: string | null; selectNode(id: string | null): void; openNode(id: string): void }) {
  const host = useRef<HTMLDivElement>(null), editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null), suppress = useRef(false);
  const latest = useRef({ artifact, selectNode, openNode }); latest.current = { artifact, selectNode, openNode };
  const [occurrence, setOccurrence] = useState(0);
  const fromCode = useRef<{ nodeId: string; range: SourceRange } | null>(null);
  function reveal(span: SourceRange) {
    const instance = editor.current, model = instance?.getModel(); if (!instance || !model) return;
    const start = model.getPositionAt(span.start), end = model.getPositionAt(span.end), range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
    suppress.current = true; try { instance.setSelection(range); instance.revealRangeInCenter(range); } finally { suppress.current = false; }
  }
  useLayoutEffect(() => {
    const model = monaco.editor.createModel('', 'typescript', monaco.Uri.parse(`inmemory://forge/${crypto.randomUUID()}/generated.ts`));
    const instance = monaco.editor.create(host.current!, { model, theme: 'vs-dark', readOnly: true, domReadOnly: true, readOnlyMessage: { value: 'O TypeScript é derivado do Blueprint e está em modo somente leitura.' }, ariaLabel: 'TypeScript gerado somente leitura', lineNumbers: 'on', automaticLayout: true, minimap: { enabled: false }, fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13, scrollBeyondLastLine: false });
    editor.current = instance; decorations.current = instance.createDecorationsCollection();
    // Native EditContext uses a div rather than a readonly textarea in recent Chromium.
    instance.getDomNode()?.querySelector('[role="textbox"]')?.setAttribute('aria-readonly', 'true');
    const select = instance.onDidChangeCursorSelection(e => {
      if (suppress.current || !latest.current.artifact) return;
      const hit = originAt(latest.current.artifact, model.getOffsetAt(e.selection.getStartPosition()), model.getOffsetAt(e.selection.getEndPosition()));
      fromCode.current = hit; if (hit) setOccurrence(nodeOccurrences(latest.current.artifact, hit.nodeId).findIndex(r => r.start === hit.range.start && r.end === hit.range.end)); latest.current.selectNode(hit?.nodeId ?? null);
    });
    const action = instance.addAction({ id: 'forge.blueprint', label: 'Localizar no Blueprint', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => {
      const selection = instance.getSelection(); if (!selection || !latest.current.artifact) return;
      const hit = originAt(latest.current.artifact, model.getOffsetAt(selection.getStartPosition()), model.getOffsetAt(selection.getEndPosition())); if (hit) latest.current.openNode(hit.nodeId);
    } });
    const doubleClick = instance.onMouseDown(e => { if (e.event.detail !== 2 || !e.target.position || !latest.current.artifact) return; const hit = originAt(latest.current.artifact, model.getOffsetAt(e.target.position)); if (hit) latest.current.openNode(hit.nodeId); });
    return () => { select.dispose(); action.dispose(); doubleClick.dispose(); decorations.current?.clear(); instance.dispose(); model.dispose(); editor.current = null; };
  }, []);
  useLayoutEffect(() => { fromCode.current = null; suppress.current = true; try { editor.current?.setValue(artifact?.code ?? ''); decorations.current?.clear(); } finally { suppress.current = false; } }, [artifact]);
  useLayoutEffect(() => {
    const source = fromCode.current;
    const spans = artifact && selectedNode ? nodeOccurrences(artifact, selectedNode) : [];
    decorations.current?.set(spans.map(span => ({ range: new monaco.Range(span.startLine, span.startColumn, span.endLine, span.endColumn), options: { className: span.role === 'definition' ? 'forge-code-definition' : 'forge-code-call', overviewRuler: { color: span.role === 'definition' ? '#FF934F' : '#49C9B5', position: monaco.editor.OverviewRulerLane.Right } } })));
    if (source?.nodeId === selectedNode) setOccurrence(spans.findIndex(r => r.start === source.range.start && r.end === source.range.end));
    else { setOccurrence(0); const definition = spans.find(r => r.role === 'definition'); if (definition) reveal(definition); }
    fromCode.current = null;
  }, [artifact, selectedNode]);
  const spans = artifact && selectedNode ? nodeOccurrences(artifact, selectedNode) : [];
  return <section className="generated-editor" aria-label="TypeScript gerado" data-revision={artifact?.revision ?? ''} data-node-id={selectedNode ?? ''}>
    <div className="code-origins"><span>{selectedNode ? `Node: ${selectedNode}` : 'Selecione um node ou um trecho do código'}</span>
      {spans.length > 0 && <><label>Ocorrência<select aria-label="Ocorrência no TypeScript" value={occurrence} onChange={e => { const index = Number(e.target.value); setOccurrence(index); reveal(spans[index]); }}>{spans.map((r, i) => <option key={i} value={i}>{r.role === 'definition' ? 'Definição' : 'Chamada'} · linha {r.startLine}</option>)}</select></label><button onClick={() => selectedNode && openNode(selectedNode)}>Localizar no Blueprint</button></>}
    </div><div className="monaco" ref={host} />
  </section>;
}

export function Code(props: Props) {
  const [mode, setMode] = useState<'typescript' | 'json'>('typescript'), [jsonVisited, setJsonVisited] = useState(false);
  const { generated } = props;
  const pendingDraft = !!props.onDraft && props.draft !== null && props.draft !== undefined;
  return <section className="code-workbench"><div className="code-tabs" role="tablist" aria-label="Visualizações de código">
    <button role="tab" aria-selected={mode === 'typescript'} onClick={() => setMode('typescript')}>TypeScript gerado</button>
    <button role="tab" aria-selected={mode === 'json'} onClick={() => { setJsonVisited(true); setMode('json'); }}>Modelo JSON</button>
    <span>{mode === 'typescript' ? 'DERIVADO DO BLUEPRINT · SOMENTE LEITURA' : 'MODELO JSON · EDIÇÃO VALIDADA'}</span>
    <button disabled={!props.canUndo || pendingDraft} onClick={props.undo}>Desfazer código</button><button disabled={!props.canRedo || pendingDraft} onClick={props.redo}>Refazer código</button>
  </div>
    <div hidden={mode !== 'typescript'} className="code-view"><div className="code-generation" role="status" aria-label="Estado da geração" data-state={generated.status}>
      <strong>{({ idle: 'Selecione TypeScript gerado para visualizar o código.', loading: 'Gerando código…', ready: 'Código atualizado', incomplete: 'Projeto editável incompleto', error: 'Falha de geração' })[generated.status]}</strong>
      {generated.artifact && <code title={generated.artifact.revision}>SHA-256 {generated.artifact.revision}</code>}
      {generated.status === 'ready' && <small>{Math.round(generated.elapsedMs)} ms no gerador · código exibido, não executado</small>}
      {generated.discarded > 0 && <small>Geração anterior descartada: {generated.discarded}</small>}
      {generated.status === 'error' && <button onClick={generated.retry}>Gerar novamente</button>}
    </div>
      {pendingDraft && <p className="code-notice">O Modelo JSON possui edição pendente. O TypeScript representa o documento aplicado; aplique ou reverta o JSON antes de navegar ao Blueprint.</p>}
      {generated.diagnostics.length > 0 && <ul className="code-diagnostics">{generated.diagnostics.map((d, i) => <li key={i}><span>{d.message}</span>{d.nodeId && <button onClick={() => props.openNode(d.nodeId!)}>Localizar node {d.nodeId}</button>}</li>)}</ul>}
      <GeneratedEditor artifact={generated.artifact} selectedNode={props.selectedNode} selectNode={props.selectNode} openNode={props.openNode} />
    </div>
    {jsonVisited && <div hidden={mode !== 'json'} className="code-view json-view"><ModelJson project={props.project} apply={props.apply} draft={props.draft} onDraft={props.onDraft} /></div>}
  </section>;
}
