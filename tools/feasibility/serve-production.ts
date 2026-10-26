import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const studioCsp = JSON.parse(await readFile('apps/studio/src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
const root = resolve('dist');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const name = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const path = resolve(root, `.${decodeURIComponent(name)}`);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', ...(url.pathname.startsWith('/studio/') ? { 'Content-Security-Policy': studioCsp } : {}) }).end(content);
  } catch { res.writeHead(404).end(); }
}).listen(1421, '127.0.0.1', () => console.log('Produção em http://127.0.0.1:1421 (sem Vite)'));
