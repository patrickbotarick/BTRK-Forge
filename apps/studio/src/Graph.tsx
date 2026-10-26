import { useEffect, useRef } from 'react';
import { createEditor } from './rete';
import type { Project } from '../../../packages/project-schema';
export function Graph({ project, generation, onChange, onError }: { project: Project; generation: number; onChange: (p: Project) => void; onError: (e: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const api = useRef<Awaited<ReturnType<typeof createEditor>> | null>(null);
  const current = useRef({ project, onChange, onError }); current.current = { project, onChange, onError };
  useEffect(() => {
    let disposed = false;
    void createEditor(container.current!, current.current.project, p => current.current.onChange(p), e => current.current.onError(e)).then(editor => {
      if (disposed) editor.destroy(); else api.current = editor;
    }).catch(e => current.current.onError(String(e)));
    return () => { disposed = true; api.current?.destroy(); api.current = null; };
  }, [generation]);
  useEffect(() => { api.current?.syncProperties(project); }, [project]);
  return <section className="graph-panel"><div className="graph-tools"><span>Arraste os nodes · conecte sockets · role para zoom</span><button onClick={() => void api.current?.addConstant()}>+ Constante</button><button onClick={() => void api.current?.fit()}>Enquadrar</button></div><div className="rete" ref={container} data-testid="graph" /></section>;
}
