import { execute } from '../blueprint-core';
import { z } from 'zod';
const messageSchema = z.object({ project: z.unknown(), state: z.record(z.string(), z.union([z.number().finite(), z.boolean(), z.string()])).optional() }).strict();
self.onmessage = (event: MessageEvent<unknown>) => {
  try { const message = messageSchema.parse(event.data); self.postMessage({ ok: true, ...execute(message.project, message.state) }); }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Erro de execução' }); }
};
