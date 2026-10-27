import { z } from 'zod';
import type { Scalar } from '../project-schema';
import type { RuntimeState } from '../semantic-runtime/protocol';
import { runtimeReplySchema, runtimeRequestSchema } from '../semantic-runtime/protocol';

export const DEBUG_VERSION = 1;
export const TRACE_LIMIT = 200, TRACE_UNITS = 64_000, HISTORY_LIMIT = 20, HISTORY_UNITS = 512_000;
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const scalar = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
export const debugEntrySchema = z.object({
  order: z.number().int().min(0), nodeId: id.nullable(),
  kind: z.enum(['event', 'action', 'ingest', 'evaluate', 'value', 'read-variable', 'read-property', 'condition', 'branch', 'assign', 'set-text', 'binding', 'commit', 'rollback', 'error']),
  target: id.optional(), scope: z.enum(['variables', 'properties']).optional(),
  before: scalar.optional(), after: scalar.optional(), value: scalar.optional(),
  branch: z.enum(['yes', 'no']).optional(), message: z.string().max(2000).optional()
}).strict();
export type DebugEntry = z.infer<typeof debugEntrySchema>;
export const traceSchema = z.object({ entries: z.array(debugEntrySchema).max(TRACE_LIMIT), truncated: z.boolean(), dropped: z.number().int().min(0), outcome: z.enum(['commit', 'rollback', 'error']) }).strict()
  .refine(t => JSON.stringify(t).length <= TRACE_UNITS + 200 && t.entries.every((e, i) => e.order === i) && t.truncated === (t.dropped > 0));
export type DebugTrace = z.infer<typeof traceSchema>;
export const debugRequestSchema = runtimeRequestSchema.extend({ debugSession: z.string().uuid() }).strict();
export const debugReplySchema = z.object({ version: z.literal(1), session: z.string().uuid(), reply: runtimeReplySchema, debug: traceSchema }).strict().refine(v => v.debug.outcome === (v.reply.ok ? 'commit' : v.reply.runtime ? 'rollback' : 'error'));

/** Bounded observer; never calls semantic operations or changes the visit budget. */
export class TraceCollector {
  private entries: DebugEntry[] = [];
  private units = 0;
  private dropped = 0;
  add(entry: Omit<DebugEntry, 'order'>) {
    const record = { ...entry, order: this.entries.length };
    const size = JSON.stringify(record).length + 1;
    if (this.dropped || this.entries.length >= TRACE_LIMIT || this.units + size > TRACE_UNITS - 200) { this.dropped++; return; }
    this.entries.push(record); this.units += size;
  }
  mutations(before: RuntimeState, after: RuntimeState, kind: DebugEntry['kind'], nodeId: string | null) {
    for (const scope of ['variables', 'properties'] as const) for (const target of Object.keys(after[scope])) {
      const old: Scalar = before[scope][target], next: Scalar = after[scope][target];
      if (!Object.is(old, next)) this.add({ kind: scope === 'properties' && kind === 'assign' ? 'binding' : kind, nodeId, target, scope, before: old, after: next });
    }
  }
  finish(outcome: DebugTrace['outcome']): DebugTrace { return { entries: this.entries, truncated: this.dropped > 0, dropped: this.dropped, outcome }; }
}

export interface HistoryEvent {
  session: string; requestId: number; event: { type: string; componentId: string };
  status: 'success' | 'failure' | 'interrupted' | 'timeout'; nodeId: string | null; debug: DebugTrace | null; error: string | null;
}
/** Oldest eviction and a total serialized UTF-16 cap; no persistent storage. */
export function appendHistory(history: HistoryEvent[], event: HistoryEvent) {
  const next = [...history, event]; let evicted = 0;
  while (next.length > HISTORY_LIMIT || JSON.stringify(next).length > HISTORY_UNITS) { next.shift(); evicted++; }
  return { events: next, evicted };
}
