import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import type { Project } from '../../../packages/project-schema';
const environment = globalThis as typeof globalThis & { MonacoEnvironment?: { getWorker: () => Worker } };
environment.MonacoEnvironment = { getWorker: () => new EditorWorker() };
export function Code({ project, apply }: { project: Project; apply: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  useEffect(() => {
    editor.current = monaco.editor.create(ref.current!, { value: JSON.stringify(project, null, 2), language: 'json', theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13 });
    return () => { const model = editor.current?.getModel(); editor.current?.dispose(); model?.dispose(); };
    // Editing is staged locally until Apply; rebuilding this tab loads the current model.
  }, []);
  return <section className="code-panel"><div className="graph-tools"><span>Modelo próprio · alterações validadas antes de aplicar</span><button onClick={() => apply(editor.current?.getValue() ?? '')}>Aplicar JSON</button></div><div ref={ref} className="monaco" /></section>;
}
