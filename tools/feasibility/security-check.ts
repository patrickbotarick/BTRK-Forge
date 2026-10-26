import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { previewDocument } from '../../packages/preview-runtime/document';
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean))];
const findings: string[] = [];
const patterns = [/gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-[A-Za-z0-9]{24,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
for (const path of files) {
  if (/(^|\/)\.env($|\.)/.test(path) && !path.endsWith('.example')) findings.push(`Arquivo privado: ${path}`);
  if (!/\.(ts|tsx|js|json|md|toml|lock|rs|ps1|html)$/.test(path)) continue;
  const text = await readFile(path, 'utf8');
  if (patterns.some(pattern => pattern.test(text))) findings.push(`Possível segredo: ${path}`);
}
const studio = JSON.parse(await readFile('apps/studio/src-tauri/tauri.conf.json', 'utf8'));
const counter = JSON.parse(await readFile('tools/feasibility/windows/tauri.conf.json', 'utf8'));
if (JSON.stringify(studio.app.security.capabilities) !== JSON.stringify(['project-workspace']) || studio.app.withGlobalTauri) findings.push('Permissões inesperadas: Studio');
if (counter.app.security.capabilities.length || counter.app.withGlobalTauri) findings.push('Permissões inesperadas: aplicativo exportado');
const capability = JSON.parse(await readFile('apps/studio/src-tauri/capabilities/project.json', 'utf8'));
const expectedPermissions = ['allow-project-create','allow-project-open','allow-project-save','allow-project-save-as','allow-project-reload','allow-project-restore','allow-project-close','allow-project-exit','core:event:allow-listen','core:event:allow-unlisten'].sort();
if (capability.remote || capability.webviews || !capability.local || JSON.stringify(capability.windows) !== '["main"]' || JSON.stringify([...capability.permissions].sort()) !== JSON.stringify(expectedPermissions)) findings.push('Escopo de projetos ampliado além da janela local main');
const buildScript = await readFile('apps/studio/src-tauri/build.rs', 'utf8');
if (!buildScript.includes('AppManifest::new().commands')) findings.push('Comandos de projeto não inscritos na ACL Tauri');
const script = previewDocument.match(/<script>([\s\S]+)<\/script>/)![1];
const hash = createHash('sha256').update(script).digest('base64');
if (!studio.app.security.csp.includes(`'sha256-${hash}'`)) findings.push('Hash CSP do preview desatualizado');
const report = { checkedFiles: files.length, findings, scope: 'Padrões conhecidos de segredos e configuração estática de permissões; não é auditoria exaustiva.' };
await writeFile('artifacts/security-check.json', JSON.stringify(report, null, 2));
console.log(report); if (findings.length) process.exitCode = 1;
