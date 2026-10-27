import { z } from 'zod';
import type { GeneratedArtifact } from '../typescript-codegen';
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const position = z.number().int().min(0).max(2_000_000);
const range = z.object({ start: position, end: position, startLine: position.min(1), startColumn: position.min(1), endLine: position.min(1), endColumn: position.min(1), role: z.enum(['definition', 'call', 'helper']) }).strict();
export const artifactSchema = z.object({ code: z.string().min(1).max(2_000_000), irVersion: z.literal(1), generatorVersion: z.literal(1), runtimeVersion: z.literal(1), revision: z.string().regex(/^[a-f0-9]{64}$/), nodeRanges: z.record(id, z.array(range).min(1).max(501)), helperRanges: z.array(range).max(10) }).strict().superRefine((artifact, ctx) => {
  const entries = Object.entries(artifact.nodeRanges), spans = [...entries.flatMap(([, ranges]) => ranges), ...artifact.helperRanges];
  if (entries.length > 200 || spans.length > 1200) { ctx.addIssue({ code: 'custom', message: 'Mapa excessivo' }); return; }
  const lines = [0]; for (let i = 0; i < artifact.code.length; i++) if (artifact.code[i] === '\n') lines.push(i + 1);
  const validPosition = (line: number, column: number, offset: number) => lines[line - 1] !== undefined && column <= (lines[line] ?? artifact.code.length + 1) - lines[line - 1] && lines[line - 1] + column - 1 === offset;
  for (const r of spans) if (r.start >= r.end || r.end > artifact.code.length || !validPosition(r.startLine, r.startColumn, r.start) || !validPosition(r.endLine, r.endColumn, r.end)) ctx.addIssue({ code: 'custom', message: 'Intervalo inválido' });
  for (const [, ranges] of entries) if (ranges.filter(r => r.role === 'definition').length !== 1 || ranges.some(r => r.role === 'helper')) ctx.addIssue({ code: 'custom', message: 'Origem inválida' });
  if (artifact.helperRanges.some(r => r.role !== 'helper')) ctx.addIssue({ code: 'custom', message: 'Auxiliar inválido' });
});
export const generationRequestSchema = z.object({ requestId: z.number().int().min(1), project: z.unknown() }).strict();
export const generationDiagnosticSchema = z.object({ message: z.string().max(2000), nodeId: id.nullable() }).strict();
export const generationReplySchema = z.object({ requestId: z.number().int().min(1), status: z.enum(['ready', 'incomplete', 'error']), artifact: artifactSchema.nullable(), diagnostics: z.array(generationDiagnosticSchema).max(500), elapsedMs: z.number().finite().min(0).max(60000) }).strict().refine(v => v.status === 'ready' ? v.artifact !== null && !v.diagnostics.length : v.artifact === null && v.diagnostics.length > 0);
export type GenerationReply = Omit<z.infer<typeof generationReplySchema>, 'artifact'> & { artifact: GeneratedArtifact | null };
