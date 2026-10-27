import type { GeneratedArtifact, SourceRange } from '../typescript-codegen';
export interface OriginHit { nodeId: string; range: SourceRange }

/** UTF-16 [start,end); prefer the smallest enclosing origin, then call, then stable ID. */
export function originAt(artifact: GeneratedArtifact, start: number, end = start): OriginHit | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > artifact.code.length) return null;
  const candidates = Object.entries(artifact.nodeRanges).flatMap(([nodeId, ranges]) => ranges
    .filter(r => r.start <= start && start < r.end && end <= r.end)
    .map(range => ({ nodeId, range })));
  candidates.sort((a, b) => (a.range.end - a.range.start) - (b.range.end - b.range.start)
    || Number(b.range.role === 'call') - Number(a.range.role === 'call')
    || (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
  return candidates[0] ?? null;
}
export function nodeOccurrences(artifact: GeneratedArtifact, nodeId: string): readonly SourceRange[] {
  return [...(artifact.nodeRanges[nodeId] ?? [])].sort((a, b) => Number(b.role === 'definition') - Number(a.role === 'definition') || a.start - b.start);
}
