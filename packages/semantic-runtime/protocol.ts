import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const scalar = z.union([z.number().finite(), z.string().max(1000), z.boolean()]);
export const runtimeStateSchema = z.object({ variables: z.record(id, scalar), properties: z.record(id, z.string().max(1000)) }).strict();
export type RuntimeState = z.infer<typeof runtimeStateSchema>;
export const runtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('button.click'), componentId: id }).strict(),
  z.object({ type: z.literal('input.change'), componentId: id, value: z.string().max(1000) }).strict()
]);
export type RuntimeEvent = z.infer<typeof runtimeEventSchema>;
export const runtimeRequestSchema = z.object({ requestId: z.number().int().min(0), project: z.unknown(), runtime: runtimeStateSchema.optional(), event: runtimeEventSchema }).strict();
export const compiledRequestSchema = runtimeRequestSchema.omit({ project: true });
export const runtimeReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), requestId: z.number().int().min(0), runtime: runtimeStateSchema, event: runtimeEventSchema, trace: z.array(id).max(200), executedNodes: z.array(id).max(200), values: z.record(id, scalar) }).strict(),
  z.object({ ok: z.literal(false), requestId: z.number().int().min(0), error: z.string().max(2000), nodeId: id.nullable(), runtime: runtimeStateSchema.nullable(), trace: z.array(id).max(200) }).strict()
]);
export type RuntimeReply = z.infer<typeof runtimeReplySchema>;
