import type { Project } from '../project-schema';

// Contracts only: no remote execution, credential access or updater is enabled.
export interface AIProvider {
  id: string;
  propose(request: { prompt: string; project: Project; credentialHandle: string; signal: AbortSignal }): Promise<{ candidate: unknown; explanation: string }>;
}
export interface ProjectProposal {
  baseDigest: string;
  candidate: Project;
  diff: { path: string; before: unknown; after: unknown }[];
  approved: boolean;
}
export interface UpdateManifest {
  productId: string;
  version: string;
  channel: 'stable' | 'beta';
  platform: 'windows-x86_64';
  url: string;
  sha256: string;
  signature: string;
  minimumSchema: number;
}
export interface NodeExtensionContract {
  sdkVersion: '1.0.0';
  namespacedType: `${string}/${string}`;
  platforms: ('web' | 'windows')[];
  capabilities: string[];
  // Native/plugin code requires a broker and is deliberately unavailable in Phase 0.
  enabled: false;
}
