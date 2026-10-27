import type { Scalar } from '../project-schema';

export const IR_VERSION = 1 as const;
export type ScalarType = 'number' | 'string' | 'boolean';
export type PortType = ScalarType | 'exec';
export type EventType = 'button.click' | 'input.change';
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export interface Origin { nodeId: string }
export interface DataRef<T extends ScalarType = ScalarType> {
  nodeId: string;
  connectionId: string;
  output: 'value';
  type: T;
}
export interface ControlRef { nodeId: string; connectionId: string }
interface NodeBase {
  origin: Origin;
  ports: { inputs: { name: string; type: PortType }[]; outputs: { name: string; type: PortType }[] };
}
type Literal = { type: 'number'; value: number } | { type: 'string'; value: string } | { type: 'boolean'; value: boolean };
export type IRExpression = NodeBase & (
  | ({ kind: 'constant' } & Literal)
  | { kind: 'variable'; type: ScalarType; variableId: string }
  | { kind: 'component-value'; type: 'string'; componentId: string; property: 'value' | 'text' }
  | { kind: 'add'; type: 'number'; a: DataRef<'number'> | null; b: DataRef<'number'> | null }
  | { kind: 'greater'; type: 'boolean'; a: DataRef<'number'> | null; b: DataRef<'number'> | null }
  | { kind: 'empty'; type: 'boolean'; value: DataRef<'string'> | null }
  | { kind: 'concat'; type: 'string'; a: DataRef<'string'> | null; b: DataRef<'string'> | null }
);
export type IRControl = NodeBase & (
  | { kind: 'event'; eventType: EventType; componentId: string | null; next: ControlRef | null }
  | { kind: 'set'; variableId: string; valueType: ScalarType; value: DataRef | null; incoming: ControlRef | null; next: ControlRef | null }
  | { kind: 'set-text'; componentId: string; value: DataRef<'string'> | null; incoming: ControlRef | null; next: ControlRef | null }
  | { kind: 'condition'; test: DataRef<'boolean'> | null; incoming: ControlRef | null; yes: ControlRef | null; no: ControlRef | null }
);
export type IRNode = IRExpression | IRControl;
export interface IRDiagnostic {
  code: 'SIZE_LIMIT' | 'SCHEMA_INVALID' | 'GRAPH_INVALID' | 'INCOMPLETE_INPUT';
  severity: 'error';
  message: string;
  nodeId: string | null;
  componentId?: string;
  connectionId?: string;
  socket?: string;
  path?: (string | number)[];
}
export interface BlueprintIR {
  irVersion: typeof IR_VERSION;
  source: { projectId: string; schemaVersion: 3 };
  executable: boolean;
  variables: { id: string; name: string; type: ScalarType; initial: Scalar }[];
  components: {
    id: string;
    type: 'Text' | 'Button' | 'Input' | 'Container';
    disabled: boolean | null;
    initialProperty: { property: 'value' | 'text'; value: string } | null;
  }[];
  bindings: { variableId: string; componentId: string; property: 'value' }[];
  entrypoints: { componentId: string; eventType: EventType; eventNodeId: string | null; enabled: boolean; legacy: boolean }[];
  nodes: IRNode[];
  connections: { id: string; source: string; output: string; target: string; input: string }[];
}
export type IRResult =
  | { ok: true; ir: DeepReadonly<BlueprintIR>; diagnostics: readonly IRDiagnostic[] }
  | { ok: false; ir: null; diagnostics: readonly IRDiagnostic[] };
