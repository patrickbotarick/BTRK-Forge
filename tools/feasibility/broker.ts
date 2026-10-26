import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export async function validateInHelper(project: unknown): Promise<unknown> {
  const text = JSON.stringify(project);
  if (text.length > 2_000_000) throw new Error('Mensagem excessiva');
  return new Promise((resolve, reject) => {
    let received = false;
    const child = fork(fileURLToPath(new URL('./helper.ts', import.meta.url)), [], {
      execArgv: ['--import', 'tsx'], windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH }
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Helper excedeu prazo')); }, 5000);
    child.once('message', result => { received = true; clearTimeout(timeout); child.kill(); resolve(result); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); if (!received) reject(new Error(`Helper encerrou sem resposta: ${code}`)); });
    child.send(JSON.parse(text));
  });
}
