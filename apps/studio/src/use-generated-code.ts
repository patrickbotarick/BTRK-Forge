import { useEffect, useMemo, useRef, useState } from 'react';
import { serialize, type Project } from '../../../packages/project-schema';
import { GenerationClient, emptyCodeState, type GenerationWorker } from '../../../packages/code-navigation/generation-client';

export function useGeneratedCode(project: Project, session: string, active: boolean, requested: boolean) {
  const key = useMemo(() => active ? session + '\n' + serialize({ ...project, metadata: undefined }) : 'closed:' + session, [project, session, active]);
  const [state, setState] = useState(emptyCodeState);
  const client = useRef<GenerationClient | null>(null);
  useEffect(() => { const instance = new GenerationClient(() => new Worker(new URL('../../../packages/typescript-codegen/generation.worker.ts', import.meta.url), { type: 'module' }) as unknown as GenerationWorker, setState); client.current = instance; return () => { instance.dispose(); client.current = null; }; }, []);
  useEffect(() => { client.current?.update(active ? project : null, key, requested); }, [project, key, active, requested]);
  // Mask old code synchronously, before effects invalidate a previous native session/revision.
  const current = state.key === key ? state : { ...emptyCodeState(key), status: active && requested ? 'loading' as const : 'idle' as const };
  return { ...current, retry: () => client.current?.retry() };
}
