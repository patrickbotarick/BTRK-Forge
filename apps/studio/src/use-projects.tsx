import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../../packages/project-schema';
import { serialize } from '../../../packages/project-schema';
import { newProject, readDocument, writeDocument } from '../../../packages/forge-core/project-document';
import type { ProjectClient, ProjectReceipt } from './project-client';

type Choice = 'cancel' | 'discard' | 'save' | 'confirm';
type Question = { title: string; message: string; unsaved: boolean; answer: (c: Choice) => void };
type NameQuestion = { action: 'new' | 'copy'; value: string; answer: (name: string | null) => void };
export function useProjects(client: ProjectClient | null, project: Project, replace: (p: Project) => void, status: (message: string) => void) {
  const [active, setActive] = useState(!client);
  const [receipt, setReceipt] = useState<ProjectReceipt | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [nameQuestion, setNameQuestion] = useState<NameQuestion | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const modalPending = useRef(false);
  const draftRef = useRef(draft); draftRef.current = draft;
  const model = serialize(project);
  const dirty = !!client && active && (baseline === null || baseline !== model || (draft !== null && draft !== model));
  const latest = useRef({ project, receipt, active, dirty }); latest.current = { project, receipt, active, dirty };
  const replaceRef = useRef(replace); replaceRef.current = replace;
  const statusRef = useRef(status); statusRef.current = status;
  const ask = (title: string, message: string, unsaved = false) => new Promise<Choice>(resolve => {
    if (modalPending.current) { resolve('cancel'); return; }
    modalPending.current=true;
    setQuestion({ title, message, unsaved, answer: choice => { modalPending.current=false; setQuestion(null); resolve(choice); } });
  });
  const name = (action: 'new' | 'copy') => new Promise<string | null>(resolve => {
    if (modalPending.current) { resolve(null); return; }
    modalPending.current=true;
    setNameQuestion({ action, value: action === 'new' ? '' : latest.current.project.name.slice(0, 70) + '-cópia', answer: value => { modalPending.current=false; setNameQuestion(null); resolve(value); } });
  });
  useEffect(() => {
    if (!question && !nameQuestion) return;
    const dialog=document.querySelector<HTMLElement>('.project-dialog');
    dialog?.querySelector<HTMLElement>('input,button')?.focus();
    const keydown=(event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (question) question.answer('cancel'); else nameQuestion?.answer(null); }
      if (event.key !== 'Tab' || !dialog) return;
      const elements=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];
      const first=elements[0],last=elements.at(-1);
      if (event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))) { event.preventDefault();last?.focus(); }
      else if (!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))) { event.preventDefault();first?.focus(); }
    };
    document.addEventListener('keydown',keydown);return () => document.removeEventListener('keydown',keydown);
  }, [question,nameQuestion]);
  function failure(error: unknown) {
    const e = error as { code?: string; message?: string; committed?: boolean };
    setConflict(e?.code === 'conflict' || e?.code === 'commit_uncertain' || !!e?.committed);
    statusRef.current(`Erro: ${e?.message ?? (error instanceof Error ? error.message : 'Não foi possível concluir a operação de projeto.')}`);
  }
  async function operation<T>(message: string, action: () => Promise<T>): Promise<T | null> {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true); statusRef.current(message);
    try { return await action(); } catch (error) { failure(error); return null; }
    finally { busyRef.current = false; setBusy(false); }
  }
  function input() {
    const doc = draftRef.current !== null ? readDocument(draftRef.current) : structuredClone(latest.current.project);
    if (doc.metadata) doc.metadata.updatedAt = new Date().toISOString();
    return writeDocument(doc);
  }
  async function adopt(next: ProjectReceipt) {
    const document = readDocument(JSON.stringify(next.document));
    const previous = latest.current.receipt;
    if (previous && previous.sessionId !== next.sessionId) await client!.close(previous.sessionId);
    latest.current = { project: document, receipt: next, active: true, dirty: next.recoveryRequired };
    setReceipt(next); setBaseline(next.recoveryRequired ? null : serialize(document));
    setDraft(null); draftRef.current = null; setActive(true); setConflict(false); replaceRef.current(document);
    statusRef.current(next.recoveryRequired ? 'Manifesto inválido ou ausente. Cópia válida carregada em memória; confirme Restaurar backup ou salve uma cópia.' : 'Projeto salvo e carregado · persistência nativa');
  }
  async function saveAs(): Promise<boolean> {
    if (!client || busyRef.current) return false;
    const folder = await name('copy'); if (folder === null) return false;
    return !!await operation('Salvando cópia…', async () => {
      const next = await client.saveAs(folder, input());
      if (!next) { statusRef.current('Salvar como cancelado.'); return false; }
      await adopt(next); return true;
    });
  }
  async function save(): Promise<boolean> {
    if (!client || !latest.current.active || busyRef.current) return false;
    if (!latest.current.receipt) return saveAs();
    return !!await operation('Salvando projeto…', async () => { await adopt(await client.save(latest.current.receipt!.sessionId, input())); return true; });
  }
  async function leave(): Promise<boolean> {
    if (busyRef.current) return false;
    if (!latest.current.dirty) return true;
    const result = await ask('Alterações não salvas', 'Salve o projeto antes de continuar ou descarte explicitamente as alterações em memória.', true);
    if (result === 'save') return save();
    return result === 'discard';
  }
  async function create() {
    if (!client || !await leave()) return;
    const folder = await name('new'); if (folder === null) return;
    await operation('Criando projeto…', async () => {
      const document = newProject(folder);
      const next = await client.create(folder, writeDocument(document));
      if (next) await adopt(next); else statusRef.current('Criação cancelada; projeto anterior preservado.');
    });
  }
  async function open() {
    if (!client || !await leave()) return;
    await operation('Abrindo projeto…', async () => { const next = await client.open(); if (next) await adopt(next); else statusRef.current('Abertura cancelada; projeto anterior preservado.'); });
  }
  async function close() {
    if (!client || !await leave()) return;
    await operation('Fechando projeto…', async () => {
      if (latest.current.receipt) await client.close(latest.current.receipt.sessionId);
      setReceipt(null); setBaseline(null); setActive(false); setDraft(null); draftRef.current = null; setConflict(false);
      latest.current = { ...latest.current, receipt: null, active: false, dirty: false };
      statusRef.current('Projeto fechado.');
    });
  }
  async function reload() {
    if (!client || !latest.current.receipt || !await leave()) return;
    await operation('Recarregando do disco…', async () => adopt(await client.reload(latest.current.receipt!.sessionId)));
  }
  async function restore() {
    if (!client || !latest.current.receipt || busyRef.current) return;
    if (await ask('Restaurar cópia de recuperação?', 'Isso substitui o manifesto e descarta alterações em memória. Os bytes substituídos serão preservados na pasta do projeto.') !== 'confirm') return;
    await operation('Restaurando cópia validada…', async () => adopt(await client.restore(latest.current.receipt!.sessionId)));
  }
  function imported(document: Project) {
    // JSON import is staged in memory; Save As creates the one native source of truth.
    void (async () => { if (!client || await leave()) { if (client && latest.current.receipt) await client.close(latest.current.receipt.sessionId); setReceipt(null); setBaseline(null); setDraft(null); draftRef.current=null; setActive(true); replaceRef.current(document); statusRef.current('JSON importado em memória. Use Salvar como para criar o projeto nativo.'); } })().catch(failure);
  }
  function applied(document: Project) { setDraft(null); draftRef.current = null; replaceRef.current(document); }
  const exitRef = useRef<() => Promise<void>>(async () => {});
  exitRef.current = async () => { if (client && await leave()) await client.exit().catch(failure); };
  useEffect(() => {
    if (!client) return;
    let disposed=false; let unlisten:(() => void) | undefined;
    void client.onCloseRequested(() => { if (!disposed) void exitRef.current(); }).then(fn => { if (disposed) fn(); else unlisten=fn; }).catch(failure);
    return () => { disposed=true; unlisten?.(); };
    // Client is fixed for the lifetime of this Studio instance.
  }, [client]);
  return {
    enabled: !!client, active, receipt, dirty, busy, conflict,
    create, open, save, saveAs, close, reload, restore, imported, applied,
    cancelConflict: () => setConflict(false),
    setDraft: (value: string | null) => { draftRef.current=value;setDraft(value); }, draft,
    dialogs: <>
      {question && <div className="modal-shade"><section role="dialog" aria-modal="true" aria-label={question.title} className="project-dialog"><h2>{question.title}</h2><p>{question.message}</p><div className="dialog-actions"><button onClick={() => question.answer('cancel')} autoFocus>Cancelar</button>{question.unsaved ? <><button onClick={() => question.answer('discard')}>Descartar alterações</button><button className="primary" onClick={() => question.answer('save')}>Salvar e continuar</button></> : <button className="primary" onClick={() => question.answer('confirm')}>Confirmar restauração</button>}</div></section></div>}
      {nameQuestion && <div className="modal-shade"><form role="dialog" aria-modal="true" aria-label={nameQuestion.action === 'new' ? 'Novo projeto' : 'Salvar como'} className="project-dialog" onSubmit={e => {e.preventDefault();nameQuestion.answer(nameQuestion.value.trim());}}><h2>{nameQuestion.action === 'new' ? 'Novo projeto' : 'Salvar como'}</h2><label>Nome da pasta do projeto<input required maxLength={80} autoFocus value={nameQuestion.value} onChange={e => setNameQuestion({...nameQuestion,value:e.target.value})} /></label><p>Na próxima etapa, escolha a pasta de destino no diálogo do Windows. Uma nova pasta será criada; destinos existentes não serão sobrescritos.</p><div className="dialog-actions"><button type="button" onClick={() => nameQuestion.answer(null)}>Cancelar</button><button className="primary" type="submit">Escolher localização</button></div></form></div>}
    </>
  };
}
