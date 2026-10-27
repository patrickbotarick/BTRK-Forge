import ts from 'typescript';
import { z } from 'zod';
import type { DeepReadonly, DataRef, ControlRef } from '../blueprint-ir';
import { RUNTIME_VERSION } from '../semantic-runtime/primitives';
import { canonical, validateIR, InvalidIR } from './validate';
export const GENERATOR_VERSION = 1 as const;
export interface SourceRange { start: number; end: number; startLine: number; startColumn: number; endLine: number; endColumn: number; role: 'definition' | 'call' | 'helper' }
export interface GenerationDiagnostic { code: 'INVALID_IR' | 'GENERATION_FAILED'; message: string; nodeId: string | null }
export interface GeneratedArtifact {
  code: string;
  irVersion: 1;
  generatorVersion: typeof GENERATOR_VERSION;
  runtimeVersion: typeof RUNTIME_VERSION;
  revision: string;
  nodeRanges: Readonly<Record<string, readonly SourceRange[]>>;
  helperRanges: readonly SourceRange[];
}
export type GenerationResult = { ok: true; artifact: GeneratedArtifact; diagnostics: [] } | { ok: false; artifact: null; diagnostics: GenerationDiagnostic[] };

const f = ts.factory;
const ident = (name: string) => f.createIdentifier(name);
const str = (value: string) => f.createStringLiteral(value);
const call = (name: string, args: ts.Expression[] = []) => f.createCallExpression(ident(name), undefined, args);
const method = (name: string, args: ts.Expression[]) => f.createCallExpression(f.createPropertyAccessExpression(ident('ctx'), name), undefined, args);
const statement = (value: ts.Expression) => f.createExpressionStatement(value);
const declare = (name: string, value: ts.Expression, type?: ts.TypeNode) => f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration(name, undefined, type, value)], ts.NodeFlags.Const));
const typed = (name: string) => f.createTypeReferenceNode(name);

/** Only validated data becomes AST literals; identifiers/imports/operators are allowlisted. */
function literal(value: unknown): ts.Expression {
  if (value === null) return f.createNull();
  if (typeof value === 'string') return str(value);
  if (typeof value === 'boolean') return value ? f.createTrue() : f.createFalse();
  if (typeof value === 'number') return value < 0 || Object.is(value, -0) ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, f.createNumericLiteral(Math.abs(value))) : f.createNumericLiteral(value);
  if (Array.isArray(value)) return f.createArrayLiteralExpression(value.map(literal), true);
  if (typeof value === 'object') return f.createObjectLiteralExpression(Object.entries(value!).map(([key, item]) => f.createPropertyAssignment(str(key), literal(item))), true);
  throw Error('Literal não suportado');
}
function ranges(code: string, names: Map<string, string>) {
  const source = ts.createSourceFile('program.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const byNode = new Map<string, SourceRange[]>(); const helpers: SourceRange[] = [];
  function range(node: ts.Node, role: SourceRange['role']): SourceRange {
    const start = node.getStart(source), end = node.getEnd(), a = source.getLineAndCharacterOfPosition(start), b = source.getLineAndCharacterOfPosition(end);
    return { start, end, startLine: a.line + 1, startColumn: a.character + 1, endLine: b.line + 1, endColumn: b.character + 1, role };
  }
  function visit(node: ts.Node) {
    let name: string | undefined; let role: 'definition' | 'call' = 'definition';
    if (ts.isFunctionDeclaration(node)) name = node.name?.text;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) { name = node.expression.text; role = 'call'; }
    const nodeId = name ? names.get(name) : undefined;
    if (nodeId) byNode.set(nodeId, [...(byNode.get(nodeId) ?? []), range(node, role)]);
    ts.forEachChild(node, visit);
  }
  for (const item of source.statements) {
    if (!ts.isFunctionDeclaration(item) || !item.name || !names.has(item.name.text)) helpers.push(range(item, 'helper'));
    visit(item);
  }
  return { nodeRanges: Object.fromEntries([...byNode].map(([id, spans]) => [id, spans.sort((a, b) => a.start - b.start || a.end - b.end)])), helperRanges: helpers };
}

export async function generateTypeScript(input: unknown): Promise<GenerationResult> {
  let ir;
  try { ir = validateIR(input); }
  catch (error) {
    let nodeId: string | null = error instanceof InvalidIR ? error.nodeId : null;
    if (error instanceof z.ZodError) {
      const path = error.issues[0]?.path;
      if (path?.[0] === 'nodes' && typeof path[1] === 'number' && typeof input === 'object' && input !== null && 'nodes' in input && Array.isArray(input.nodes)) nodeId = input.nodes[path[1]]?.origin?.nodeId ?? null;
    }
    return { ok: false, artifact: null, diagnostics: [{ code: 'INVALID_IR', nodeId, message: error instanceof z.ZodError ? 'IR inválida, incompleta ou não suportada' : error instanceof Error ? error.message : String(error) }] };
  }
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(ir)));
    const revision = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
    const names = new Map(ir.nodes.map((n, index) => [n.origin.nodeId, `n${index}_${n.origin.nodeId.replace(/-/g, '_')}`]));
    const invoke = (id: string) => call(names.get(id)!, [ident('ctx'), ident('state')]);
    const data = (ref: DeepReadonly<DataRef> | null) => { if (!ref) throw Error('Entrada incompleta'); return invoke(ref.nodeId); };
    const follow = (ref: DeepReadonly<ControlRef> | null): ts.Statement[] => ref ? [statement(invoke(ref.nodeId))] : [];
    const statements: ts.Statement[] = [f.createImportDeclaration(undefined, f.createImportClause(false, undefined,
      f.createNamedImports(['runProgram', 'RUNTIME_VERSION', 'SemanticRuntime', 'SemanticState', 'RuntimeReply', 'ProgramModel'].map(name => f.createImportSpecifier(!['runProgram', 'RUNTIME_VERSION', 'SemanticRuntime'].includes(name), undefined, ident(name))))), str('./runtime.js'))];
    statements.push(f.createIfStatement(f.createBinaryExpression(ident('RUNTIME_VERSION'), ts.SyntaxKind.ExclamationEqualsEqualsToken, f.createNumericLiteral(RUNTIME_VERSION)), f.createBlock([f.createThrowStatement(f.createNewExpression(ident('Error'), undefined, [str('Versão do runtime incompatível com o código gerado')]))], true)));
    statements.push(declare('programModel', literal({ variables: ir.variables, components: ir.components, bindings: ir.bindings, entrypoints: ir.entrypoints }), typed('ProgramModel')));
    statements.push(f.createVariableStatement([f.createModifier(ts.SyntaxKind.ExportKeyword)], f.createVariableDeclarationList([f.createVariableDeclaration('metadata', undefined, undefined, literal({ irVersion: 1, generatorVersion: GENERATOR_VERSION, runtimeVersion: RUNTIME_VERSION, revision }))], ts.NodeFlags.Const)));
    for (const node of ir.nodes) {
      const origin = literal(node.origin);
      const body: ts.Statement[] = [statement(method('visit', [origin]))];
      const isData = 'type' in node;
      if (isData) {
        let expression: ts.Expression;
        switch (node.kind) {
          case 'constant': expression = literal(node.value); break;
          case 'variable': expression = f.createAsExpression(method('readVariable', [ident('state'), str(node.variableId)]), typed(node.type)); break;
          case 'component-value': expression = method('readProperty', [ident('state'), str(node.componentId)]); break;
          case 'add': case 'greater': case 'concat': expression = f.createBinaryExpression(call(node.kind === 'concat' ? 'String' : 'Number', [data(node.a)]), node.kind === 'greater' ? ts.SyntaxKind.GreaterThanToken : ts.SyntaxKind.PlusToken, call(node.kind === 'concat' ? 'String' : 'Number', [data(node.b)])); break;
          case 'empty': expression = f.createBinaryExpression(f.createPropertyAccessExpression(f.createCallExpression(f.createPropertyAccessExpression(call('String', [data(node.value)]), 'trim'), undefined, []), 'length'), ts.SyntaxKind.EqualsEqualsEqualsToken, f.createNumericLiteral(0)); break;
        }
        body.push(declare('value', expression, typed(node.type)), statement(method('validateValue', [ident('value'), str(node.type), origin])), statement(method('recordValue', [origin, ident('value')])), f.createReturnStatement(ident('value')));
      } else {
        body.push(statement(method('recordControl', [origin])));
        switch (node.kind) {
          case 'event': body.push(...follow(node.next)); break;
          case 'set': body.push(statement(method('writeVariable', [ident('state'), str(node.variableId), data(node.value)])), ...follow(node.next)); break;
          case 'set-text': body.push(statement(method('writeText', [ident('state'), str(node.componentId), call('String', [data(node.value)])])), ...follow(node.next)); break;
          case 'condition': body.push(f.createIfStatement(data(node.test), f.createBlock(follow(node.yes), true), f.createBlock(follow(node.no), true))); break;
        }
      }
      statements.push(f.createFunctionDeclaration(undefined, undefined, names.get(node.origin.nodeId)!, undefined,
        [f.createParameterDeclaration(undefined, undefined, 'ctx', undefined, typed('SemanticRuntime')), f.createParameterDeclaration(undefined, undefined, 'state', undefined, typed('SemanticState'))], isData ? typed(node.type) : f.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword), f.createBlock(body, true)));
    }
    const handlers = f.createObjectLiteralExpression(ir.nodes.filter(n => n.kind === 'event').map(n => f.createPropertyAssignment(str(n.origin.nodeId), ident(names.get(n.origin.nodeId)!))), true);
    statements.push(f.createFunctionDeclaration([f.createModifier(ts.SyntaxKind.ExportKeyword)], undefined, 'execute', undefined, [f.createParameterDeclaration(undefined, undefined, 'input', undefined, f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword))], typed('RuntimeReply'), f.createBlock([f.createReturnStatement(call('runProgram', [ident('programModel'), ident('input'), handlers]))], true)));
    const source = f.createSourceFile(statements, f.createToken(ts.SyntaxKind.EndOfFileToken), ts.NodeFlags.None);
    const code = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false }).printFile(source);
    return { ok: true, artifact: { code, irVersion: 1, generatorVersion: GENERATOR_VERSION, runtimeVersion: RUNTIME_VERSION, revision, ...ranges(code, new Map([...names].map(([id, name]) => [name, id]))) }, diagnostics: [] };
  } catch (error) { return { ok: false, artifact: null, diagnostics: [{ code: 'GENERATION_FAILED', nodeId: null, message: error instanceof Error ? error.message : String(error) }] }; }
}
