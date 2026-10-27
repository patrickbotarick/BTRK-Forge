import ts from 'typescript';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lowerBlueprint } from '../../packages/blueprint-ir';
import { generateTypeScript, type GeneratedArtifact } from '../../packages/typescript-codegen';
import type { Project } from '../../packages/project-schema';
import type { RuntimeReply } from '../../packages/semantic-runtime/protocol';

export type Mutation = 'subtract' | 'skip-write' | 'skip-visit' | 'choose-no' | 'type-error';
export interface CompiledCase { project: Project; artifact: GeneratedArtifact; file: string }
const workspace = process.cwd();

/** Test-only allowlisted mutations; there is deliberately no arbitrary-source API. */
function mutate(code: string, mutation?: Mutation): string {
  if (!mutation) return code;
  const source = ts.createSourceFile('program.ts', code, ts.ScriptTarget.ES2022, true);
  const result = ts.transform(source, [context => root => {
    const visit: ts.Visitor = node => {
      if (mutation === 'subtract' && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return ts.factory.updateBinaryExpression(node, node.left, ts.factory.createToken(ts.SyntaxKind.MinusToken), node.right);
      if (mutation === 'choose-no' && ts.isIfStatement(node)) return ts.factory.updateIfStatement(node, ts.factory.createFalse(), node.thenStatement, node.elseStatement);
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression)) {
        const method = node.expression.expression.name.text;
        if ((mutation === 'skip-write' && method === 'writeVariable') || (mutation === 'skip-visit' && method === 'visit')) return ts.factory.createEmptyStatement();
      }
      if (mutation === 'type-error' && ts.isVariableDeclaration(node) && node.name.getText(source) === 'value' && node.type?.getText(source) === 'number') return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, ts.factory.createStringLiteral('not a number'));
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(root, visit) as ts.SourceFile;
  }]);
  const output = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0]); result.dispose(); return output;
}

export async function compileCases(projects: readonly Project[], mutations: Readonly<Record<number, Mutation>> = {}) {
  const base = path.join(workspace, 'artifacts', 'phase01d-b-20261027', 'harness');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'run-'));
  const generated: CompiledCase[] = [];
  const roots: string[] = [];
  await writeFile(path.join(directory, 'runtime.ts'), `export * from ${JSON.stringify(path.relative(directory, path.join(workspace, 'packages/semantic-runtime/index.js')).replaceAll('\\', '/'))};\n`);
  for (let i = 0; i < projects.length; i++) {
    const lowered = lowerBlueprint(projects[i]); if (!lowered.ok) throw Error(JSON.stringify(lowered.diagnostics));
    const emitted = await generateTypeScript(lowered.ir); if (!emitted.ok) throw Error(JSON.stringify(emitted.diagnostics));
    const file = path.join(directory, `program-${i}.ts`);
    await writeFile(file, mutate(emitted.artifact.code, mutations[i]));
    await writeFile(path.join(directory, `map-${i}.json`), JSON.stringify(emitted.artifact, null, 2));
    roots.push(file); generated.push({ project: projects[i], artifact: emitted.artifact, file });
  }
  const outDir = path.join(directory, 'compiled');
  // The existing sources use extensionless imports. This test-only CJS build uses
  // TS 6's supported legacy resolver; this flag suppresses only its deprecation.
  const program = ts.createProgram(roots, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, ignoreDeprecations: '6.0', strict: true, skipLibCheck: true, esModuleInterop: true, types: ['node'], rootDir: workspace, outDir, noEmitOnError: true });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  await writeFile(path.join(directory, 'typecheck.json'), JSON.stringify(diagnostics.map(d => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n'), file: d.file?.fileName, start: d.start })), null, 2));
  if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: p => p, getCurrentDirectory: () => workspace, getNewLine: () => '\n' }));
  if (program.getSourceFiles().some(f => f.fileName.replaceAll('\\', '/').includes('/blueprint-core/'))) throw Error('Compiled program depends on the interpreter');
  if (program.emit().emitSkipped) throw Error('TypeScript emit was skipped');
  await writeFile(path.join(outDir, 'package.json'), '{"type":"commonjs"}');
  // Fixed runner, fixed module registry, no shell, eval, arbitrary imports or TS at runtime.
  const files = generated.map(c => path.join(outDir, path.relative(workspace, c.file)).replace(/\.ts$/, '.js'));
  const runner = path.join(directory, 'runner.cjs');
  await writeFile(runner, `"use strict";\nconst programs = ${JSON.stringify(files)}.map(file => require(file));\nprocess.on('message', message => {\n  if (!Number.isInteger(message.index) || !programs[message.index]) throw Error('Invalid test program');\n  const execute = programs[message.index].execute;\n  if (message.events) {\n    if (!Array.isArray(message.events) || message.events.length > 64) throw Error('Invalid test sequence');\n    let runtime = message.starting;\n    const replies = message.events.map((event, i) => {\n      const reply = execute({requestId: i + 1, ...(runtime ? {runtime} : {}), event});\n      if (reply.runtime) runtime = reply.runtime;\n      return reply;\n    });\n    process.send(replies);\n  } else process.send(execute(message.input));\n});\n`);
  return { generated, directory,
    run: (index: number, input: unknown) => runChild<RuntimeReply>(runner, { index, input }),
    runSequence: (index: number, events: readonly unknown[], starting?: unknown) => runChild<RuntimeReply[]>(runner, { index, events, starting }) };
}

function runChild<T>(runner: string, message: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = fork(runner, [], { cwd: workspace, execArgv: ['--max-old-space-size=128'], serialization: 'advanced', stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    let settled = false, outputLength = 0, output = '';
    const timer = setTimeout(() => finish(Error('Harness process exceeded 5 seconds')), 5000);
    function finish(error?: Error, reply?: T) {
      if (settled) return; settled = true; clearTimeout(timer); child.kill();
      if (error) reject(error); else resolve(reply!);
    }
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', chunk => { outputLength += chunk.length; output += String(chunk).slice(0, 4000 - output.length); if (outputLength > 64000) finish(Error('Harness output limit exceeded')); });
    child.on('error', error => finish(error));
    child.on('exit', code => { if (!settled) finish(Error(`Harness exit ${code}: ${output}`)); });
    child.once('message', reply => finish(undefined, reply as T));
    child.send(message);
  });
}
