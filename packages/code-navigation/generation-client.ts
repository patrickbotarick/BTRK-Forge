import type { Project } from '../project-schema';
import type { GeneratedArtifact } from '../typescript-codegen';
import { generationReplySchema } from './protocol';
export interface GenerationWorker {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}
export interface CodeState {
  key: string; status: 'idle' | 'loading' | 'ready' | 'incomplete' | 'error'; artifact: GeneratedArtifact | null;
  diagnostics: { message: string; nodeId: string | null }[]; elapsedMs: number; discarded: number;
}
export function emptyCodeState(key = ''): CodeState { return { key, status: 'idle', artifact: null, diagnostics: [], elapsedMs: 0, discarded: 0 }; }

/** One revision at a time; cancel stale work, retain only the current result. */
export class GenerationClient {
  private worker: GenerationWorker | null = null;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private serial = 0;
  private pending: number | null = null;
  private project: Project | null = null;
  private enabled = false;
  private disposed = false;
  state = emptyCodeState();
  constructor(private readonly factory: () => GenerationWorker, private readonly changed: (state: CodeState) => void) {}
  private emit(state: CodeState) { this.state = state; if (!this.disposed) this.changed(state); }
  private stop() { clearTimeout(this.debounce); clearTimeout(this.watchdog); this.worker?.terminate(); this.worker = null; this.pending = null; }
  update(project: Project | null, key: string, requested: boolean) {
    if (this.disposed) return;
    const different = key !== this.state.key;
    if (!project) { this.stop(); this.project = null; this.enabled = false; this.emit(emptyCodeState(key)); return; }
    this.project = project;
    const start = requested && !this.enabled; this.enabled ||= requested;
    if (!different && !start) return;
    const discarded = this.state.discarded + Number(this.pending !== null);
    this.stop();
    this.emit({ ...emptyCodeState(key), status: this.enabled ? 'loading' : 'idle', discarded });
    if (this.enabled) this.debounce = setTimeout(() => this.generate(), 120);
  }
  retry() { if (!this.project || this.disposed) return; this.stop(); this.emit({ ...this.state, status: 'loading', artifact: null, diagnostics: [] }); this.generate(); }
  private fail(message: string) { this.stop(); this.emit({ ...this.state, status: 'error', artifact: null, diagnostics: [{ message, nodeId: null }] }); }
  private generate() {
    if (!this.project || this.disposed) return;
    const requestId = ++this.serial, key = this.state.key, nodeIds = this.project.graph.nodes.map(n => n.id);
    try {
      const worker = this.factory(); this.worker = worker; this.pending = requestId;
      worker.onmessage = event => {
        if (this.disposed || worker !== this.worker || key !== this.state.key || this.pending !== requestId) return;
        let size: number; try { size = JSON.stringify(event.data).length; } catch { this.fail('Resposta inválida do gerador. Tente novamente.'); return; }
        const result = size <= 3_000_000 ? generationReplySchema.safeParse(event.data) : null;
        if (!result?.success) { this.fail('Resposta inválida do gerador. Tente novamente.'); return; }
        if (result.data.requestId !== requestId) return;
        if (result.data.artifact && (Object.keys(result.data.artifact.nodeRanges).length !== nodeIds.length || nodeIds.some(id => !Object.hasOwn(result.data.artifact!.nodeRanges, id)))) { this.fail('Mapa incompatível com o documento atual. Gere novamente.'); return; }
        clearTimeout(this.watchdog); this.pending = null;
        this.emit({ key, status: result.data.status, artifact: result.data.artifact, diagnostics: result.data.diagnostics, elapsedMs: result.data.elapsedMs, discarded: this.state.discarded });
        worker.terminate(); this.worker = null;
      };
      worker.onerror = () => { if (worker === this.worker && !this.disposed) this.fail('O processo de geração falhou. Tente gerar novamente.'); };
      this.watchdog = setTimeout(() => this.fail('A geração demorou mais que o esperado e foi interrompida. Tente novamente.'), 10000);
      worker.postMessage({ requestId, project: this.project });
    } catch { this.fail('Não foi possível iniciar o gerador. Tente novamente.'); }
  }
  dispose() { this.disposed = true; this.stop(); }
}
