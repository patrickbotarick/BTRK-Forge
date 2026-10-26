import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Project } from '../../../packages/project-schema';
export interface ProjectReceipt {
  sessionId: string; location: string; document: Project; revision: string | null;
  recoveryRequired: boolean; recoveryAvailable: boolean; recoveryLabel: string | null;
}
export interface ProjectClient {
  create(folderName: string, documentJson: string): Promise<ProjectReceipt | null>;
  open(): Promise<ProjectReceipt | null>;
  save(sessionId: string, documentJson: string): Promise<ProjectReceipt>;
  saveAs(folderName: string, documentJson: string): Promise<ProjectReceipt | null>;
  reload(sessionId: string): Promise<ProjectReceipt>;
  restore(sessionId: string): Promise<ProjectReceipt>;
  close(sessionId: string): Promise<void>;
  exit(): Promise<void>;
  onCloseRequested(handler: () => void): Promise<() => void>;
}
declare global { interface Window { __FORGE_TEST_PROJECTS__?: ProjectClient } }
export function getProjectClient(): ProjectClient | null {
  if (isTauri()) return {
    create: (folderName, documentJson) => invoke('project_create', { folderName, documentJson }),
    open: () => invoke('project_open'),
    save: (sessionId, documentJson) => invoke('project_save', { sessionId, documentJson }),
    saveAs: (folderName, documentJson) => invoke('project_save_as', { folderName, documentJson }),
    reload: sessionId => invoke('project_reload', { sessionId }),
    restore: sessionId => invoke('project_restore', { sessionId }),
    close: sessionId => invoke('project_close', { sessionId }),
    exit: () => invoke('project_exit'),
    onCloseRequested: handler => listen('forge-close-requested', handler),
  };
  // This branch is removed from production builds. Test dialogs are replaced, storage is real Rust.
  if (import.meta.env.MODE === 'test') return window.__FORGE_TEST_PROJECTS__ ?? null;
  return null;
}
