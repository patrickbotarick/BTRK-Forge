import { validateProject } from '../../packages/blueprint-core';
// Fixed operation and bounded JSON only. No eval, shell or user-supplied executable.
process.once('message', (message: unknown) => {
  try {
    const text = JSON.stringify(message);
    if (text.length > 2_000_000) throw new Error('Mensagem excessiva');
    const project = validateProject(message);
    process.send?.({ ok: true, projectId: project.id }, () => process.disconnect());
  } catch (error) { process.send?.({ ok: false, error: String(error) }, () => process.disconnect()); }
});
setTimeout(() => process.exit(2), 3000).unref();
