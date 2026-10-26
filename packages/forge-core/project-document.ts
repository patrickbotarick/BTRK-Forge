import { exampleProject } from './example';
import { validateProject } from '../blueprint-core';
import { deserialize, serialize, type Project } from '../project-schema';
import { z } from 'zod';
export const MANIFEST_NAME = 'project.btrk.json';
export function newProject(name: string): Project {
  const project = exampleProject();
  const now = new Date().toISOString();
  project.id = `project-${crypto.randomUUID()}`;
  project.name = name.trim();
  project.metadata = { documentVersion: 1, createdAt: now, updatedAt: now, savedBy: 'BTRK Forge' };
  project.compatibility = { format: 'btrk-project', minimumStudio: '0.0.1', requiredFeatures: ['project-persistence-v1'], platforms: ['web', 'windows'] };
  project.distribution.appId = `studio.btrk.app${project.id.replaceAll('-', '').slice(7).toLowerCase()}`;
  return validateProject(project, { allowIncomplete: true });
}
export function readDocument(text: string): Project {
  try { return validateProject(deserialize(text), { allowIncomplete: true }); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('O arquivo JSON está corrompido ou malformado.');
    if (error instanceof z.ZodError) throw new Error('Projeto inválido: confira a versão do schema, os campos, os tipos e os limites do formato BTRK.');
    throw error;
  }
}
export function writeDocument(project: Project): string {
  validateProject(project, { allowIncomplete: true });
  const text = serialize(project);
  if (new TextEncoder().encode(text).length > 2_000_000) throw new Error('Projeto excede o limite de 2 MB.');
  return text;
}
