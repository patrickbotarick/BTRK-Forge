import { lowerBlueprint } from '../blueprint-ir';
import { generateTypeScript } from './index';
import { generationRequestSchema, generationReplySchema, type GenerationReply } from '../code-navigation/protocol';

self.onmessage = async (message: MessageEvent<unknown>) => {
  const started = performance.now();
  const request = generationRequestSchema.safeParse(message.data);
  if (!request.success) return;
  const { requestId, project } = request.data;
  let reply: GenerationReply;
  try {
    if (JSON.stringify(message.data).length > 3_000_000) throw Error('Mensagem excessiva');
    const lowered = lowerBlueprint(project);
    if (!lowered.ok) {
      const incomplete = lowered.diagnostics.every(d => d.code === 'INCOMPLETE_INPUT');
      reply = { requestId, status: incomplete ? 'incomplete' : 'error', artifact: null, diagnostics: lowered.diagnostics.map(d => ({ nodeId: d.nodeId, message: d.code === 'SCHEMA_INVALID' ? 'Não foi possível validar o documento. Confira o Modelo JSON.' : d.message.slice(0, 2000) })), elapsedMs: 0 };
    } else {
      const generated = await generateTypeScript(lowered.ir);
      reply = generated.ok ? { requestId, status: 'ready', artifact: generated.artifact, diagnostics: [], elapsedMs: 0 }
        : { requestId, status: 'error', artifact: null, diagnostics: generated.diagnostics.map(d => ({ nodeId: d.nodeId, message: 'Não foi possível gerar o TypeScript deste documento. Confira o Blueprint ou tente novamente.' })), elapsedMs: 0 };
    }
  } catch { reply = { requestId, status: 'error', artifact: null, diagnostics: [{ nodeId: null, message: 'Não foi possível gerar o código. Confira os limites do projeto e tente novamente.' }], elapsedMs: 0 }; }
  reply.elapsedMs = Math.min(60000, performance.now() - started);
  if (JSON.stringify(reply).length <= 3_000_000 && generationReplySchema.safeParse(reply).success) self.postMessage(reply);
  else self.postMessage({ requestId, status: 'error', artifact: null, diagnostics: [{ nodeId: null, message: 'Código ou mapa de origens excede os limites de visualização.' }], elapsedMs: 0 });
};
