import type { Scalar } from '../project-schema';
import type { DeepReadonly, Origin, ScalarType } from './types';

// Contracts only. No new executor and no change to the current interpreter.
export interface SemanticState {
  variables: Record<string, Scalar>;
  properties: Record<string, string>;
}
export interface SemanticFault {
  message: string;
  nodeId: string | null;
  runtime: DeepReadonly<SemanticState> | null;
  controlTrace: readonly string[];
}
export interface ActionTransaction {
  /** Base AFTER input ingestion. Rollback retains that ingestion. */
  readonly base: DeepReadonly<SemanticState>;
  readonly working: SemanticState;
}
/** Future instance scoped to one event; binding writes never dispatch events.
 * visit counts before child evaluation, validateValue after it. Control is recorded
 * after visit succeeds. Commit/rollback return detached state, not manifest data.
 */
export interface SharedRuntimeContract {
  initialState(): SemanticState;
  validateState(state: unknown): SemanticState;
  readVariable(state: SemanticState, variableId: string, origin: Origin): Scalar;
  readProperty(state: SemanticState, componentId: string, origin: Origin): string;
  writeVariable(state: SemanticState, variableId: string, value: Scalar, origin: Origin): void;
  writeText(state: SemanticState, componentId: string, value: string, origin: Origin): void;
  syncBindings(state: SemanticState): void;
  ingestInput(state: SemanticState, componentId: string, value: string): void;
  beginActions(base: SemanticState): ActionTransaction;
  commit(transaction: ActionTransaction): SemanticState;
  rollback(transaction: ActionTransaction): SemanticState;
  validateValue(value: Scalar, type: ScalarType, origin: Origin): Scalar;
  /** Called BEFORE operands; includes every repeated data visit, not just unique nodes. */
  visit(origin: Origin): void;
  recordControl(origin: Origin): void;
  recordValue(origin: Origin, value: Scalar): void;
  fail(message: string, origin: Origin | null): never;
}

// These describe current behavior, not a configurable policy or a second authority.
export const SEMANTIC_CONTRACT = Object.freeze({
  version: 1,
  evaluation: 'demand-left-to-right-no-cache',
  inputTransaction: 'ingest-before-actions',
  actionFailure: 'rollback-to-post-ingestion',
  bindingEvents: 'no-recursive-dispatch',
  visitsPerEvent: 10000,
  stringLength: 1000,
  maxNodes: 200,
  maxConnections: 500,
  maxVariables: 100,
  maxEvents: 32,
  documentCharacters: 2_000_000,
  workerMessageCharacters: 3_000_000,
  waitingEvents: 32,
  watchdogMilliseconds: 2000
} as const);
