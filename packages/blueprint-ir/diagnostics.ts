import { z } from 'zod';
import { ports } from '../blueprint-core';
import type { Project } from '../project-schema';
import type { IRDiagnostic } from './types';

/** Attribution only: acceptance always belongs to validateProject, never this locator. */
export function graphDiagnostic(project: Project, error: unknown): IRDiagnostic {
  const diagnostic: IRDiagnostic = { code: 'GRAPH_INVALID', severity: 'error', message: error instanceof Error ? error.message : String(error), nodeId: null };
  if (diagnostic.message.startsWith('ID duplicado:')) {
    const seen = new Set<string>([project.id]);
    for (const screen of project.screens) {
      if (seen.has(screen.id)) return diagnostic;
      seen.add(screen.id);
      for (const c of screen.components) { if (seen.has(c.id)) return { ...diagnostic, componentId: c.id }; seen.add(c.id); }
    }
    for (const v of project.variables) { if (seen.has(v.id)) return diagnostic; seen.add(v.id); }
    for (const n of project.graph.nodes) { if (seen.has(n.id)) return { ...diagnostic, nodeId: n.id }; seen.add(n.id); }
    for (const c of project.graph.connections) { if (seen.has(c.id)) return { ...diagnostic, connectionId: c.id, nodeId: c.target }; seen.add(c.id); }
  }
  for (const node of project.graph.nodes) {
    try { ports(node, project); } catch { return { ...diagnostic, nodeId: node.id }; }
  }
  const nodes = new Map(project.graph.nodes.map(n => [n.id, n]));
  const inputs = new Set<string>(), outputs = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const edge of project.graph.connections) {
    const source = nodes.get(edge.source), target = nodes.get(edge.target);
    const location = { connectionId: edge.id, nodeId: target?.id ?? source?.id ?? null };
    if (!source || !target) return { ...diagnostic, ...location };
    const from = ports(source, project).outputs[edge.output], to = ports(target, project).inputs[edge.input];
    const input = `${target.id}:${edge.input}`, output = `${source.id}:${edge.output}`;
    if (!from || from !== to || inputs.has(input) || (from === 'exec' && outputs.has(output))) return { ...diagnostic, ...location };
    inputs.add(input); if (from === 'exec') outputs.add(output);
    adjacency.set(source.id, [...(adjacency.get(source.id) ?? []), target.id]);
  }
  const active = new Set<string>(), visited = new Set<string>();
  function cycle(id: string): string | null {
    if (active.has(id)) return id;
    if (visited.has(id)) return null;
    active.add(id);
    for (const next of adjacency.get(id) ?? []) { const found = cycle(next); if (found) return found; }
    active.delete(id); visited.add(id); return null;
  }
  for (const node of project.graph.nodes) { const found = cycle(node.id); if (found) return { ...diagnostic, nodeId: found }; }
  for (const c of project.screens[0].components) {
    if (c.type === 'Input' && c.props.binding && !project.variables.some(v => v.id === c.props.binding && v.type === 'string')) return { ...diagnostic, componentId: c.id };
    const eventId = c.type === 'Button' ? c.events.click : c.type === 'Input' ? c.events.change : null;
    if (eventId) {
      const node = nodes.get(eventId);
      if (!node || node.kind !== 'event' || node.event !== (c.type === 'Button' ? 'button.click' : 'input.change') || (node.componentId && node.componentId !== c.id)) return { ...diagnostic, componentId: c.id, nodeId: node?.id ?? null };
    }
  }
  return diagnostic;
}

export function schemaDiagnostics(error: unknown, input: unknown): IRDiagnostic[] {
  if (!(error instanceof z.ZodError)) return [{ code: 'SCHEMA_INVALID', severity: 'error', message: error instanceof Error ? error.message : String(error), nodeId: null }];
  return error.issues.map(issue => {
    const path = issue.path.map(p => typeof p === 'number' ? p : String(p));
    let nodeId: string | null = null;
    if (path[0] === 'graph' && path[1] === 'nodes' && typeof path[2] === 'number' && typeof input === 'object' && input !== null && 'graph' in input) {
      const graph = input.graph;
      if (typeof graph === 'object' && graph !== null && 'nodes' in graph && Array.isArray(graph.nodes)) {
        const node = graph.nodes[path[2]];
        if (typeof node?.id === 'string') nodeId = node.id;
      }
    }
    return { code: 'SCHEMA_INVALID', severity: 'error', message: issue.message, nodeId, path };
  });
}
