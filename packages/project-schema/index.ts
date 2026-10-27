import { z } from 'zod';
import { component, componentSchema, MAX_COMPONENTS } from './components';
export { component, componentSchema, MAX_COMPONENTS, MAX_DEPTH } from './components';
export type { Component, ComponentStyle } from './components';

export const CURRENT_SCHEMA = 2;
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const scalar = z.union([z.number().finite(), z.string().max(1000), z.boolean()]);
export const variableSchema = z.object({ id, name: z.string().min(1).max(80), type: z.enum(['number', 'string', 'boolean']), initial: scalar }).strict();
const base = { id, position: z.object({ x: z.number().finite().min(-100000).max(100000), y: z.number().finite().min(-100000).max(100000) }).strict() };
export const nodeSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('event'), event: z.literal('button.click') }).strict(),
  z.object({ ...base, kind: z.literal('constant'), value: scalar }).strict(),
  z.object({ ...base, kind: z.literal('variable'), variableId: id }).strict(),
  z.object({ ...base, kind: z.literal('add') }).strict(),
  z.object({ ...base, kind: z.literal('greater') }).strict(),
  z.object({ ...base, kind: z.literal('condition') }).strict(),
  z.object({ ...base, kind: z.literal('set'), variableId: id }).strict()
]);
export const legacyProjectSchema = z.object({
  id, name: z.string().min(1).max(100), version: z.string().regex(/^\d+\.\d+\.\d+$/), schemaVersion: z.literal(1),
  screens: z.array(z.object({ id, title: z.string().max(100), button: z.object({ id, text: z.string().max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), event: z.literal('button.click') }).strict() }).strict()).length(1),
  variables: z.array(variableSchema).max(100),
  graph: z.object({ nodes: z.array(nodeSchema).max(200), connections: z.array(z.object({ id, source: id, output: z.string().max(40), target: id, input: z.string().max(40) }).strict()).max(500) }).strict(),
  functions: z.array(z.never()).max(0), resources: z.array(z.never()).max(0), dependencies: z.array(z.never()).max(0),
  permissions: z.object({ web: z.array(z.never()).max(0), windows: z.array(z.never()).max(0) }).strict(),
  distribution: z.object({ appId: z.string().regex(/^[a-z][a-z0-9.]+$/), version: z.string().regex(/^\d+\.\d+\.\d+$/), channel: z.enum(['stable', 'beta']) }).strict(),
  metadata: z.object({ documentVersion: z.literal(1), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), savedBy: z.literal('BTRK Forge') }).strict().optional(),
  compatibility: z.object({ format: z.literal('btrk-project'), minimumStudio: z.literal('0.0.1'), requiredFeatures: z.tuple([z.literal('project-persistence-v1')]), platforms: z.tuple([z.literal('web'), z.literal('windows')]) }).strict().optional()
}).strict();
export const projectSchema = legacyProjectSchema.extend({
  schemaVersion: z.literal(2),
  screens: z.array(z.object({ id, title: z.string().max(100), components: z.array(componentSchema).max(MAX_COMPONENTS) }).strict()).length(1)
});
export type Project = z.infer<typeof projectSchema>;
export type GraphNode = Project['graph']['nodes'][number];
export type Connection = Project['graph']['connections'][number];
export type Scalar = z.infer<typeof scalar>;

// Version 0 is the only legacy format supported by the feasibility prototype.
// A migration operates on a copy, preserves IDs and never downgrades newer projects.
export function parseProject(input: unknown): Project {
  if (typeof input !== 'object' || input === null) throw new Error('Projeto deve ser um objeto');
  const copy = structuredClone(input) as Record<string, unknown>;
  if (copy.schemaVersion === 0) { copy.schemaVersion = 1; copy.functions ??= []; }
  if (copy.schemaVersion === 1) {
    const legacy = legacyProjectSchema.parse(copy);
    return projectSchema.parse({ ...legacy, schemaVersion: 2, screens: legacy.screens.map(screen => {
      const button = component('Button', screen.button.id);
      if (button.type === 'Button') { button.props.text = screen.button.text; button.style.background = screen.button.color; button.events.click = legacy.graph.nodes.find(n => n.kind === 'event')?.id ?? null; }
      return { id: screen.id, title: screen.title, components: [button] };
    }) });
  }
  return projectSchema.parse(copy);
}
export function deserialize(text: string): Project {
  if (text.length > 2_000_000) throw new Error('Projeto excede 2 MB');
  return parseProject(JSON.parse(text));
}
export function serialize(project: Project): string { return JSON.stringify(parseProject(project), null, 2); }
