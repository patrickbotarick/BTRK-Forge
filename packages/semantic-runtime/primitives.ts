import type { Scalar } from '../project-schema';
import type { SemanticState } from '../blueprint-ir/runtime-contract';

export const RUNTIME_VERSION = 1 as const;
export class RuntimeFault extends Error {
  runtime: SemanticState | null = null;
  trace: string[] = [];
  get controlTrace() { return this.trace; }
  constructor(message: string, public nodeId: string | null = null) { super(message); this.name = 'RuntimeFault'; }
}
export class VisitBudget {
  private remaining = 10000;
  constructor(private readonly executed: Set<string>) {}
  visit(nodeId: string) {
    this.executed.add(nodeId);
    if (--this.remaining < 0) throw new RuntimeFault('Limite de execução excedido', nodeId);
  }
}
export function checkScalar(value: Scalar, nodeId: string): Scalar {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RuntimeFault('Resultado numérico não finito', nodeId);
  if (typeof value === 'string' && value.length > 1000) throw new RuntimeFault('Texto runtime excede 1000 caracteres', nodeId);
  return value;
}
