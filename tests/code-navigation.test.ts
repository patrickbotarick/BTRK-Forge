import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { generateTypeScript, type GeneratedArtifact } from '../packages/typescript-codegen';
import { lowerBlueprint } from '../packages/blueprint-ir';
import { exampleProject } from '../packages/forge-core/example';
import { readAfterWriteFixture } from './fixtures/semantic-ir/scenarios';
import { originAt, nodeOccurrences } from '../packages/code-navigation';
import { artifactSchema } from '../packages/code-navigation/protocol';
import { GenerationClient, type GenerationWorker } from '../packages/code-navigation/generation-client';

let artifact: GeneratedArtifact;
beforeAll(async () => { const lowered = lowerBlueprint(exampleProject()); if (!lowered.ok) throw Error('fixture'); const result = await generateTypeScript(lowered.ir); if (!result.ok) throw Error('generator'); artifact = result.artifact; });
afterEach(() => vi.useRealTimers());
class WorkerStub implements GenerationWorker {
  onmessage: GenerationWorker['onmessage'] = null; onerror: GenerationWorker['onerror'] = null;
  requests: { requestId: number }[] = []; terminated = false;
  postMessage(value: unknown) { this.requests.push(value as { requestId: number }); }
  terminate() { this.terminated = true; }
  reply(requestId = this.requests[0].requestId) { this.onmessage?.({ data: { requestId, status: 'ready', artifact, diagnostics: [], elapsedMs: 8 } }); }
}
function client() { const workers: WorkerStub[] = [], changed = vi.fn(); const instance = new GenerationClient(() => { const worker = new WorkerStub(); workers.push(worker); return worker; }, changed); return { instance, workers, changed }; }

describe('UTF-16 node ↔ code origins', () => {
  it('resolves definitions and nested calls using the smallest enclosing range', () => {
    for (const [id, spans] of Object.entries(artifact.nodeRanges)) for (const span of spans) expect(originAt(artifact, span.start, span.end)?.nodeId).toBe(id);
    const definition = nodeOccurrences(artifact, 'sum')[0]; expect(definition.role).toBe('definition');
    const nested = artifact.nodeRanges.counter.find(r => r.role === 'call')!; expect(originAt(artifact, nested.start)?.nodeId).toBe('counter');
  });
  it('does not assign auxiliary code or an invalid/cross-node selection', () => {
    expect(originAt(artifact, 0)).toBeNull(); expect(originAt(artifact, -1)).toBeNull(); expect(originAt(artifact, artifact.code.length)).toBeNull();
    expect(originAt(artifact, 0, artifact.code.length)).toBeNull(); expect(originAt(artifact, 4, 2)).toBeNull();
  });
  it('preserves UTF-16 offsets, half-open boundaries and deterministic ties', () => {
    const r = { start: 3, end: 6, startLine: 2, startColumn: 1, endLine: 2, endColumn: 4, role: 'definition' as const };
    const value = { ...artifact, code: '😀\nabc', nodeRanges: { z: [r], a: [{ ...r, role: 'call' as const }] }, helperRanges: [] };
    expect(originAt(value, 3)?.nodeId).toBe('a'); expect(originAt(value, 6)).toBeNull(); expect(value.code.slice(r.start, r.end)).toBe('abc');
  });
  it('lists one definition and all shared-expression calls without mutating the map', async () => {
    const lowered = lowerBlueprint(readAfterWriteFixture()); if (!lowered.ok) throw Error('fixture'); const result = await generateTypeScript(lowered.ir); if (!result.ok) throw Error('generator');
    const before = JSON.stringify(result.artifact); const spans = nodeOccurrences(result.artifact, 'sum');
    expect(spans[0].role).toBe('definition'); expect(spans.filter(r => r.role === 'call')).toHaveLength(3); expect(JSON.stringify(result.artifact)).toBe(before);
  });
  it('validates real artifact coordinates and rejects forged offsets/versions', () => {
    expect(artifactSchema.safeParse(artifact).success).toBe(true);
    const value = structuredClone(artifact); value.nodeRanges = { ...value.nodeRanges, click: [{ ...value.nodeRanges.click[0], end: 999999 }] };
    expect(artifactSchema.safeParse(value).success).toBe(false); expect(artifactSchema.safeParse({ ...artifact, generatorVersion: 2 }).success).toBe(false);
  });
});

describe('Asynchronous generation lifecycle', () => {
  it('starts lazily and reuses the artifact across selection/navigation/renders', async () => {
    vi.useFakeTimers(); const { instance, workers } = client(); const p = exampleProject();
    instance.update(p, 'session:doc', false); await vi.advanceTimersByTimeAsync(500); expect(workers).toHaveLength(0);
    instance.update(p, 'session:doc', true); await vi.advanceTimersByTimeAsync(120); workers[0].reply();
    expect(instance.state.status).toBe('ready');
    for (let i = 0; i < 10; i++) instance.update(p, 'session:doc', i % 2 === 0);
    await vi.advanceTimersByTimeAsync(500); expect(workers).toHaveLength(1); instance.dispose();
  });
  it('clears old code immediately and ignores late results from a previous document', async () => {
    vi.useFakeTimers(); const { instance, workers } = client(); const p = exampleProject();
    instance.update(p, 'old', true); await vi.advanceTimersByTimeAsync(120);
    instance.update(p, 'new', true); expect(instance.state.artifact).toBeNull(); expect(workers[0].terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(120); workers[0].reply(); expect(instance.state.status).toBe('loading');
    workers[1].reply(); expect(instance.state.key).toBe('new'); expect(instance.state.status).toBe('ready'); expect(instance.state.discarded).toBe(1); instance.dispose();
  });
  it('discards identical-content results when the native project session changes or closes', async () => {
    vi.useFakeTimers(); const { instance, workers } = client(); const p = exampleProject();
    instance.update(p, 'session1:same', true); await vi.advanceTimersByTimeAsync(120);
    instance.update(p, 'session2:same', true); await vi.advanceTimersByTimeAsync(120); workers[0].reply(); expect(instance.state.artifact).toBeNull();
    instance.update(null, 'closed', true); workers[1].reply(); expect(instance.state.status).toBe('idle'); expect(instance.state.artifact).toBeNull(); instance.dispose();
  });
  it('debounces rapid edits and accepts only the current request ID', async () => {
    vi.useFakeTimers(); const { instance, workers } = client();
    for (let i = 0; i < 20; i++) instance.update(exampleProject(), String(i), true);
    await vi.advanceTimersByTimeAsync(120); expect(workers).toHaveLength(1); workers[0].reply(99); expect(instance.state.status).toBe('loading'); workers[0].reply(); expect(instance.state.status).toBe('ready'); instance.dispose();
  });
  it('represents incomplete projects without retaining a previous artifact', async () => {
    vi.useFakeTimers(); const { instance, workers } = client(); const p = exampleProject(); instance.update(p, 'complete', true); await vi.advanceTimersByTimeAsync(120); workers[0].reply();
    instance.update(p, 'incomplete', true); await vi.advanceTimersByTimeAsync(120); workers[1].onmessage?.({ data: { requestId: workers[1].requests[0].requestId, status: 'incomplete', artifact: null, diagnostics: [{ nodeId: 'sum', message: 'Entrada obrigatória ausente: a' }], elapsedMs: 1 } });
    expect(instance.state.status).toBe('incomplete'); expect(instance.state.artifact).toBeNull(); expect(instance.state.diagnostics[0].nodeId).toBe('sum'); instance.dispose();
  });
  it.each(['invalid', 'worker-error', 'timeout', 'start-error'] as const)('reports %s failures and supports retry', async mode => {
    vi.useFakeTimers(); const { instance, workers } = client(); const p = exampleProject();
    if (mode === 'start-error') { const broken = new GenerationClient(() => { throw Error('raw technical error'); }, () => {}); broken.update(p, 'broken', true); await vi.advanceTimersByTimeAsync(120); expect(broken.state.status).toBe('error'); expect(broken.state.diagnostics[0].message).not.toContain('raw'); broken.dispose(); return; }
    instance.update(p, 'doc', true); await vi.advanceTimersByTimeAsync(120);
    if (mode === 'invalid') workers[0].onmessage?.({ data: { arbitrary: 'payload' } });
    if (mode === 'worker-error') workers[0].onerror?.({});
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(10000);
    expect(instance.state.status).toBe('error'); expect(instance.state.artifact).toBeNull(); instance.retry(); workers[1].reply(); expect(instance.state.status).toBe('ready'); instance.dispose();
  });
  it('does not update React after disposal or retain a Worker', async () => {
    vi.useFakeTimers(); const { instance, workers, changed } = client(); instance.update(exampleProject(), 'doc', true); await vi.advanceTimersByTimeAsync(120); instance.dispose(); const calls = changed.mock.calls.length; workers[0].reply(); workers[0].onerror?.({}); await vi.advanceTimersByTimeAsync(20000); expect(changed).toHaveBeenCalledTimes(calls); expect(workers[0].terminated).toBe(true);
  });
});
