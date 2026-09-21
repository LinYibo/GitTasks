/**
 * Renderer state.
 *
 * `doc` is a projection of tasks.md, which is the single source of truth. The
 * transient input buffers are kept as separate slices so that an incoming
 * document change cannot overwrite what the user is in the middle of typing.
 */

import { create } from 'zustand'

import { taskToText } from '../../shared/tasks/format.ts'
import type { Doc, ErrorInfo, Mutation, RepoState, RepoStatus, Result } from '../../shared/types.ts'
import { api } from './api.ts'

export type Filter = 'all' | 'active' | 'done'

const EMPTY_DOC: Doc = { hash: '', lines: [''], tasks: [] }

const IDLE_STATUS: RepoStatus = {
  phase: 'idle',
  dirty: false,
  ahead: 0,
  behind: 0,
  hasRemote: false,
}

type State = {
  ready: boolean
  gitAvailable: boolean
  repoPath: string | null
  doc: Doc
  status: RepoStatus
  filter: Filter
  composerText: string
  editingLine: number | null
  editDraft: string
  error: ErrorInfo | null
}

type Actions = {
  init(): Promise<void>
  chooseRepo(): Promise<void>
  setFilter(filter: Filter): void
  setComposerText(text: string): void
  addTask(): Promise<void>
  toggleTask(line: number): Promise<void>
  removeTask(line: number): Promise<void>
  beginEdit(line: number): void
  setEditDraft(text: string): void
  commitEdit(): Promise<void>
  cancelEdit(): void
  sync(mode: 'push' | 'pull'): Promise<void>
  open(target: 'folder' | 'tasks'): Promise<void>
  dismissError(): void
  receiveDoc(doc: Doc): void
  receiveStatus(status: RepoStatus): void
}

export const useStore = create<State & Actions>()((set, get) => {
  /** Unwrap a Result. This is the renderer's entire error strategy. */
  async function call<T>(promise: Promise<Result<T>>, apply: (data: T) => void): Promise<void> {
    const result = await promise
    if (result.ok) apply(result.data)
    else set({ error: result.error })
  }

  function adopt(state: RepoState, extra: Partial<State> = {}): void {
    set({
      ready: true,
      repoPath: state.repoPath,
      doc: state.doc,
      status: state.status,
      gitAvailable: state.gitAvailable,
      ...extra,
    })
  }

  async function mutate(mutation: Mutation, extra: Partial<State> = {}): Promise<void> {
    const { doc } = get()
    await call(api.apply({ expectedHash: doc.hash, mutation }), (state) => adopt(state, extra))
  }

  return {
    ready: false,
    gitAvailable: true,
    repoPath: null,
    doc: EMPTY_DOC,
    status: IDLE_STATUS,
    filter: 'all',
    composerText: '',
    editingLine: null,
    editDraft: '',
    error: null,

    async init() {
      await call(api.state(), adopt)
      set({ ready: true })
    },

    async chooseRepo() {
      await call(api.choose(), (state) => {
        // A cancelled picker resolves to null; leave everything as it was.
        if (state) adopt(state, { filter: 'all' })
      })
    },

    setFilter: (filter) => set({ filter }),
    setComposerText: (composerText) => set({ composerText }),

    async addTask() {
      const text = get().composerText.trim()
      if (!text) return

      // Cleared only on success, so a rejected task — metadata with no title,
      // say — doesn't discard what the user typed.
      await mutate({ kind: 'add', text }, { composerText: '' })
    },

    async toggleTask(line) {
      await mutate({ kind: 'toggle', line })
    },

    async removeTask(line) {
      const { editingLine } = get()

      // Deleting renumbers every line below it, so an edit anchored to a later
      // line can no longer be trusted. Deleting below it is harmless.
      const extra =
        editingLine !== null && line < editingLine ? { editingLine: null, editDraft: '' } : {}

      await mutate({ kind: 'delete', line }, extra)
    },

    beginEdit(line) {
      const task = get().doc.tasks.find((candidate) => candidate.line === line)
      if (!task) return

      // Pre-filled with the same inline syntax the file uses, so the editor
      // needs no separate widgets for tags, priority or dates.
      set({ editingLine: line, editDraft: taskToText(task) })
    },

    setEditDraft: (editDraft) => set({ editDraft }),

    async commitEdit() {
      const { editingLine, editDraft } = get()
      if (editingLine === null) return

      // An emptied box means the user changed their mind, not that they want an
      // error. A draft of metadata with no title still reports one.
      if (!editDraft.trim()) {
        set({ editingLine: null, editDraft: '' })
        return
      }

      // On failure the draft is deliberately left open so the text survives.
      await mutate(
        { kind: 'edit', line: editingLine, text: editDraft.trim() },
        { editingLine: null, editDraft: '' },
      )
    },

    cancelEdit: () => set({ editingLine: null, editDraft: '' }),

    async sync(mode) {
      await call(api.sync(mode), adopt)
    },

    async open(target) {
      await call(api.open(target), () => {})
    },

    dismissError: () => set({ error: null }),

    receiveDoc(doc) {
      const { editingLine } = get()

      // Unsaved text is the user's intent, so an open edit survives an
      // external change — unless the line it was anchored to is gone.
      const anchored = editingLine !== null && doc.tasks.some((task) => task.line === editingLine)
      if (anchored) set({ doc })
      else set({ doc, editingLine: null, editDraft: '' })
    },

    receiveStatus(status) {
      const previous = get().status.error
      set({ status })

      // A background commit or sync can fail with nobody waiting on the result,
      // so surface it in the banner. Comparing messages keeps a dismissed error
      // from reappearing on every later status event.
      if (status.error && status.error.message !== previous?.message) set({ error: status.error })
    },
  }
})
