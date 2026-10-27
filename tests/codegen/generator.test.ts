import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { lowerBlueprint, type BlueprintIR } from '../../packages/blueprint-ir';
import { generateTypeScript } from '../../packages/typescript-codegen';
import { exampleProject } from '../../packages/forge-core/example';
import { logicFixture } from '../logic-fixture';
import { readAfterWriteFixture } from '../fixtures/semantic-ir/scenarios';
import { scalarsFixture } from './scenarios';

function lower(p = exampleProject()) { const result = lowerBlueprint(p); if (!result.ok) throw Error('Invalid fixture'); return result.ir; }
describe('AST TypeScript generator and origins', () => {
  it('emits deterministic typed operations and versions without interpreter/graph delegation', async () => {
    const ir = lower(), before = JSON.stringify(ir), a = await generateTypeScript(ir), b = await generateTypeScript(ir);
    expect(a).toEqual(b); expect(a.ok).toBe(true); expect(JSON.stringify(ir)).toBe(before);
    if (!a.ok) return;
    expect(a.artifact).toMatchObject({ irVersion: 1, generatorVersion: 1, runtimeVersion: 1 });
    expect(a.artifact.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(a.artifact.code).toContain('if ('); expect(a.artifact.code).toContain('Number(');
    expect(a.artifact.code).not.toMatch(/blueprint-core|executeEvent|runGraph|connections|eval\(/);
    const source = ts.createSourceFile('generated.ts', a.artifact.code, ts.ScriptTarget.ES2022, true);
    expect(source.statements.filter(ts.isImportDeclaration).map(i => (i.moduleSpecifier as ts.StringLiteral).text)).toEqual(['./runtime.js']);
  });
  it('maps every node, shared callsites and helper regions with UTF-16 half-open positions', async () => {
    const p = scalarsFixture(); const output = await generateTypeScript(lower(p)); expect(output.ok).toBe(true); if (!output.ok) return;
    const { code, nodeRanges, helperRanges } = output.artifact;
    expect(Object.keys(nodeRanges).sort()).toEqual(p.graph.nodes.map(n => n.id).sort());
    for (const [id, spans] of Object.entries(nodeRanges)) {
      expect(spans.filter(s => s.role === 'definition')).toHaveLength(1);
      for (const span of spans) {
        expect(span.end).toBeGreaterThan(span.start); expect(code.slice(span.start, span.end)).toContain(id.replaceAll('-', '_'));
        const start = code.slice(0, span.start).split('\n'), end = code.slice(0, span.end).split('\n');
        expect([span.startLine, span.startColumn]).toEqual([start.length, start.at(-1)!.length + 1]);
        expect([span.endLine, span.endColumn]).toEqual([end.length, end.at(-1)!.length + 1]);
      }
    }
    expect(helperRanges.length).toBeGreaterThan(0); expect(code).not.toContain('\r');
    const shared = await generateTypeScript(lower(readAfterWriteFixture())); if (!shared.ok) throw Error('generation failed');
    expect(shared.artifact.nodeRanges.sum.filter(r => r.role === 'call')).toHaveLength(3);
    expect(shared.artifact.code).toBe(readFileSync('docs/qa/evidencias/fase01d-b/read-after-write.generated.ts.txt', 'utf8'));
    const { code: sampleCode, ...sampleMap } = shared.artifact; void sampleCode;
    expect(sampleMap).toEqual(JSON.parse(readFileSync('docs/qa/evidencias/fase01d-b/read-after-write.origins.json', 'utf8').replace(/^\uFEFF/, '')));
  });
  it('covers all 11 kinds and keeps names distinct after sanitizing IDs', async () => {
    for (const p of [exampleProject(), logicFixture()]) {
      const output = await generateTypeScript(lower(p)); expect(output.ok).toBe(true);
      if (output.ok) expect(Object.keys(output.artifact.nodeRanges)).toHaveLength(p.graph.nodes.length);
    }
    const p = exampleProject(); p.graph.nodes.push({ id: 'a-b', kind: 'constant', value: 'x', position: { x: 0, y: 0 } }, { id: 'a_b', kind: 'constant', value: 'y', position: { x: 0, y: 0 } });
    const output = await generateTypeScript(lower(p)); if (!output.ok) throw Error('generation failed');
    expect(output.artifact.nodeRanges['a-b']).toHaveLength(1); expect(output.artifact.nodeRanges.a_b).toHaveLength(1);
  });
  it('hashes semantic input including negative zero and ignores object key insertion order', async () => {
    const p = exampleProject(), a = lower(p);
    const reordered = Object.fromEntries(Object.entries(a).reverse());
    expect(await generateTypeScript(a)).toEqual(await generateTypeScript(reordered));
    p.variables[0].initial = -0; const negative = await generateTypeScript(lower(p));
    const positive = await generateTypeScript(a); if (!negative.ok || !positive.ok) throw Error('generation failed');
    expect(negative.artifact.revision).not.toBe(positive.artifact.revision);
    expect(negative.artifact.code).toContain('-0');
  });
  it.each(['version', 'incomplete', 'port', 'ref', 'extra', 'cycle', 'unknown'] as const)('rejects %s IR instead of trusting TypeScript annotations', async kind => {
    const value = structuredClone(lower()) as BlueprintIR; const before = JSON.stringify(value);
    let invalid: unknown = value;
    if (kind === 'version') invalid = { ...value, irVersion: 2 };
    if (kind === 'incomplete') invalid = { ...value, executable: false };
    if (kind === 'extra') invalid = { ...value, code: 'untrusted source' };
    if (kind === 'unknown') invalid = { ...value, nodes: [{ ...value.nodes[0], kind: 'external-code' }] };
    if (kind === 'port') value.nodes[0].ports.outputs[0].type = 'number';
    if (kind === 'ref') { const n = value.nodes.find(n => n.kind === 'add'); if (n?.kind === 'add' && n.a) n.a.nodeId = 'missing'; }
    if (kind === 'cycle') { value.connections.push({ id: 'cycle', source: 'assign', output: 'next', target: 'branch', input: 'in' }); }
    const ready = JSON.stringify(invalid), result = await generateTypeScript(invalid);
    expect(result.ok).toBe(false); expect(result.artifact).toBeNull(); expect(result.diagnostics[0].code).toBe('INVALID_IR');
    if (kind === 'ref') expect(result.diagnostics[0].nodeId).toBe('sum');
    if (kind === 'port') expect(result.diagnostics[0].nodeId).toBe('click');
    expect(JSON.stringify(invalid)).toBe(ready); expect(before.length).toBeGreaterThan(0);
  });
});
