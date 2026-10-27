import { z } from 'zod';
import type { BlueprintIR, DeepReadonly, Origin, ScalarType } from '../blueprint-ir/types';
import type { SharedRuntimeContract, SemanticState, ActionTransaction } from '../blueprint-ir/runtime-contract';
import type { Scalar } from '../project-schema';
import { RuntimeFault, VisitBudget, checkScalar } from './primitives';
import { compiledRequestSchema, runtimeStateSchema, type RuntimeReply } from './protocol';
export { RUNTIME_VERSION } from './primitives';
export type { SemanticState } from '../blueprint-ir/runtime-contract';
export type { RuntimeReply } from './protocol';
export type ProgramModel = DeepReadonly<Pick<BlueprintIR, 'variables' | 'components' | 'bindings' | 'entrypoints'>>;

/** Per-event basic operations. No graph, IR traversal, code loading or dispatch loop. */
export class SemanticRuntime implements SharedRuntimeContract {
  readonly trace: string[] = [];
  readonly executed = new Set<string>();
  readonly values: Record<string, Scalar> = {};
  private readonly budget = new VisitBudget(this.executed);
  constructor(private readonly model: ProgramModel) {}
  initialState(): SemanticState {
    return { variables: Object.fromEntries(this.model.variables.map(v => [v.id, v.initial])),
      properties: Object.fromEntries(this.model.components.flatMap(c => c.initialProperty ? [[c.id, c.initialProperty.value]] : [])) };
  }
  validateState(input: unknown): SemanticState {
    const parsed = runtimeStateSchema.safeParse(input);
    if (!parsed.success) this.fail('Estado incompatível', null);
    const state = parsed.data, initial = this.initialState();
    if (Object.keys(state.variables).length !== this.model.variables.length || Object.keys(state.properties).length !== Object.keys(initial.properties).length) this.fail('Estado incompatível com o projeto; reinicie a execução', null);
    for (const v of this.model.variables) if (!Object.hasOwn(state.variables, v.id) || typeof state.variables[v.id] !== v.type) this.fail('Estado incompatível', null);
    for (const key of Object.keys(initial.properties)) if (!Object.hasOwn(state.properties, key)) this.fail('Propriedade runtime ausente', null);
    for (const b of this.model.bindings) if (state.properties[b.componentId] !== state.variables[b.variableId]) this.fail('Binding de Input inconsistente', null);
    return state;
  }
  readVariable(state: SemanticState, variableId: string): Scalar { return state.variables[variableId]; }
  readProperty(state: SemanticState, componentId: string): string { return state.properties[componentId]; }
  writeVariable(state: SemanticState, variableId: string, value: Scalar): void { state.variables[variableId] = value; this.syncBindings(state); }
  writeText(state: SemanticState, componentId: string, value: string): void { state.properties[componentId] = value; }
  syncBindings(state: SemanticState): void { for (const b of this.model.bindings) state.properties[b.componentId] = String(state.variables[b.variableId]); }
  ingestInput(state: SemanticState, componentId: string, value: string): void {
    state.properties[componentId] = value;
    const binding = this.model.bindings.find(b => b.componentId === componentId);
    if (binding) state.variables[binding.variableId] = value;
    this.syncBindings(state);
  }
  beginActions(base: SemanticState): ActionTransaction { return { base: structuredClone(base), working: structuredClone(base) }; }
  commit(transaction: ActionTransaction): SemanticState { return structuredClone(transaction.working); }
  rollback(transaction: ActionTransaction): SemanticState { return structuredClone(transaction.base); }
  validateValue(value: Scalar, type: ScalarType, origin: Origin): Scalar {
    checkScalar(value, origin.nodeId);
    if (typeof value !== type) this.fail('Tipo de valor runtime incompatível', origin);
    return value;
  }
  visit(origin: Origin): void { this.budget.visit(origin.nodeId); }
  recordControl(origin: Origin): void { this.trace.push(origin.nodeId); }
  recordValue(origin: Origin, value: Scalar): void { this.values[origin.nodeId] = value; }
  fail(message: string, origin: Origin | null): never { throw new RuntimeFault(message, origin?.nodeId ?? null); }
}
export type EventHandler = (ctx: SemanticRuntime, state: SemanticState) => void;

/** Validates the fixed compiled program's envelope; handlers contain generated control flow. */
export function runProgram(model: ProgramModel, input: unknown, handlers: Readonly<Record<string, EventHandler>>): RuntimeReply {
  const rawId = typeof input === 'object' && input !== null && 'requestId' in input ? input.requestId : 0;
  const requestId = typeof rawId === 'number' && Number.isInteger(rawId) && rawId >= 0 ? rawId : 0;
  const ctx = new SemanticRuntime(model);
  let transaction: ActionTransaction | null = null;
  try {
    if (JSON.stringify(input).length > 3_000_000) ctx.fail('Mensagem runtime excessiva', null);
    const request = compiledRequestSchema.parse(input);
    const state = request.runtime ? ctx.validateState(request.runtime) : ctx.initialState();
    const entry = model.entrypoints.find(e => e.componentId === request.event.componentId && e.eventType === request.event.type);
    if (!entry?.enabled) return ctx.fail('Evento de componente inexistente, incompatível ou desabilitado', null);
    if (request.event.type === 'input.change') ctx.ingestInput(state, request.event.componentId, request.event.value);
    transaction = ctx.beginActions(state);
    if (entry.eventNodeId) handlers[entry.eventNodeId](ctx, transaction.working);
    return { ok: true, requestId, runtime: ctx.commit(transaction), event: request.event, trace: ctx.trace, executedNodes: [...ctx.executed], values: ctx.values };
  } catch (error) {
    const fault = error instanceof RuntimeFault ? error : null;
    return { ok: false, requestId, error: (error instanceof z.ZodError ? 'Mensagem ou estado runtime inválido' : error instanceof Error ? error.message : String(error)).slice(0, 2000), nodeId: fault?.nodeId ?? null, runtime: transaction ? ctx.rollback(transaction) : null, trace: transaction ? ctx.trace : [] };
  }
}
