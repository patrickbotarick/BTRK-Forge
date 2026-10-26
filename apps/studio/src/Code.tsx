import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import type { Project } from '../../../packages/project-schema';
const environment = globalThis as typeof globalThis & { MonacoEnvironment?: { getWorker: () => Worker } };
environment.MonacoEnvironment = { getWorker: () => new EditorWorker() };
export function Code({ project, apply, draft, onDraft }: { project: Project; apply: (text: string) => void; draft?: string | null; onDraft?: (text: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null); const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const draftCallback = useRef(onDraft); draftCallback.current = onDraft;
  useEffect(() => {
    editor.current = monaco.editor.create(ref.current!, { value: draft ?? JSON.stringify(project, null, 2), language: 'json', theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13 });
    const subscription = editor.current.onDidChangeModelContent(() => draftCallback.current?.(editor.current?.getValue() ?? ''));
    return () => { subscription.dispose(); const model = editor.current?.getModel(); editor.current?.dispose(); model?.dispose(); };
    // Editing is staged locally until Apply; rebuilding this tab loads the current model.
  }, []);
  return <section className="code-panel"><div className="graph-tools"><span>Modelo próprio · alterações validadas antes de aplicar</span>{onDraft && <button onClick={() => { editor.current?.setValue(JSON.stringify(project, null, 2)); draftCallback.current?.(null); }}>Reverter edição JSON</button>}<button onClick={() => apply(editor.current?.getValue() ?? '')}>Aplicar JSON</button></div><div ref={ref} className="monaco" /></section>;
}
