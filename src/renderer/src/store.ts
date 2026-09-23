/**
 * Renderer state.
 *
 * `doc` is a projection of tasks.md, which is the single source of truth. The
 * transient input buffers are kept as separate slices so that an incoming
 * document change cannot overwrite what the user is in the middle of typing.
 */

import { create } from 'zustand'

import type { Doc, ErrorInfo, FolderState, Mutation, Result, Task } from '../../shared/types.ts'
import { api } from './api.ts'

export type Filter = 'all' | 'active' | 'done'

/**
 * The tasks of one project. A title that no longer names a project — because an
 * external edit removed its heading a moment ago — yields nothing rather than
 * whatever now happens to sit at the old line.
 */
export function tasksOf(doc: Doc, title: string | null): Task[] {
  const project = doc.projects.find((candidate) => candidate.title === title)
  return project ? doc.tasks.filter((task) => task.projectLine === project.line) : []
}

const EMPTY_DOC: Doc = { hash: '', lines: [''], projects: [], tasks: [] }

type State = {
  ready: boolean
  folderPath: string | null
  doc: Doc
  filter: Filter
  /** The project whose tasks fill the main pane, by title. See `syncProject`. */
  selectedProject: string | null
  composerText: string
  editingLine: number | null
  editDraft: string
  error: ErrorInfo | null
}

type Actions = {
  init(): Promise<void>
  chooseFolder(): Promise<void>
  setFilter(filter: Filter): void
  selectProject(title: string): void
  addProject(title: string): Promise<void>
  renameProject(line: number, title: string): Promise<void>
  deleteProject(line: number): Promise<void>
  setComposerText(text: string): void
  addTask(): Promise<void>
  toggleTask(line: number): Promise<void>
  removeTask(line: number): Promise<void>
  beginEdit(line: number): void
  setEditDraft(text: string): void
  commitEdit(): Promise<void>
  cancelEdit(): void
  open(target: 'folder' | 'tasks'): Promise<void>
  dismissError(): void
  receiveDoc(doc: Doc): void
}

export const useStore = create<State & Actions>()((set, get) => {
  /** Unwrap a Result. This is the renderer's entire error strategy. */
  async function call<T>(promise: Promise<Result<T>>, apply: (data: T) => void): Promise<void> {
    set({ error: null })

    const result = await promise
    if (result.ok) apply(result.data)
    else set({ error: result.error })
  }

  function adopt(state: FolderState, extra: Partial<State> = {}): void {
    set({
      ready: true,
      folderPath: state.folderPath,
      doc: state.doc,
      ...extra,
    })
    syncProject()
  }

  async function mutate(mutation: Mutation, extra: Partial<State> = {}): Promise<void> {
    const { doc } = get()
    await call(api.apply({ expectedHash: doc.hash, mutation }), (state) => adopt(state, extra))
  }

  /**
   * A project is named by its title rather than its line, because adding or
   * deleting one elsewhere renumbers every line below it. So the line has to be
   * looked up fresh each time, and may legitimately not be there.
   */
  function selectedLine(): number | null {
    const { selectedProject, doc } = get()
    if (selectedProject === null) return null
    return doc.projects.find((project) => project.title === selectedProject)?.line ?? null
  }

  /** Land on the first project whenever the named one has gone, including on open. */
  function syncProject(): void {
    const { selectedProject, doc } = get()
    if (selectedProject !== null && doc.projects.some((project) => project.title === selectedProject))
      return

    const first = doc.projects[0]
    if (first) set({ selectedProject: first.title })
    else if (selectedProject !== null) set({ selectedProject: null })
  }

  return {
    ready: false,
    folderPath: null,
    doc: EMPTY_DOC,
    filter: 'active',
    selectedProject: null,
    composerText: '',
    editingLine: null,
    editDraft: '',
    error: null,

    async init() {
      await call(api.state(), adopt)
      set({ ready: true })
    },

    async chooseFolder() {
      await call(api.choose(), (state) => {
        // A cancelled picker resolves to null; leave everything as it was.
        // The new folder's own first project is chosen by `adopt`.
        if (state) adopt(state, { filter: 'active', selectedProject: null })
      })
    },

    setFilter: (filter) => set({ filter }),
    selectProject: (selectedProject) => set({ selectedProject }),
    setComposerText: (composerText) => set({ composerText }),

    async addProject(title) {
      const name = title.trim()
      if (!name) return

      // Selected only once it exists, so a rejected name — a duplicate, say —
      // leaves the view where it was rather than stranding it on a ghost.
      await mutate({ kind: 'add-project', title: name })
      if (get().doc.projects.some((project) => project.title === name)) set({ selectedProject: name })
    },

    async renameProject(line, title) {
      const { selectedProject } = get()
      const from = get().doc.projects.find((project) => project.line === line)?.title
      const name = title.trim()
      if (!name || name === from) return

      await mutate({ kind: 'rename-project', line, title: name })

      // The selection names projects by title, so a rename has to carry it over.
      if (selectedProject !== null && selectedProject === from) set({ selectedProject: name })
    },

    async deleteProject(line) {
      await mutate({ kind: 'delete-project', line })

      // Deleting takes the project's tasks with it and renumbers everything
      // below, so an open edit can no longer be trusted.
      set({ editingLine: null, editDraft: '' })
    },

    async addTask() {
      const { composerText } = get()
      const text = composerText.trim()
      if (!text) return

      const projectLine = selectedLine()
      if (projectLine === null) return

      // Cleared only on success, so a rejected task — an empty title, say —
      // doesn't discard what the user typed.
      await mutate({ kind: 'add', text, projectLine }, { composerText: '' })
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

      set({ editingLine: line, editDraft: task.title })
    },

    setEditDraft: (editDraft) => set({ editDraft }),

    async commitEdit() {
      const { editingLine, editDraft } = get()
      if (editingLine === null) return

      // An emptied box means the user changed their mind, not that they want an
      // error.
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

    async open(target) {
      await call(api.open(target), () => {})
    },

    dismissError: () => set({ error: null }),

    receiveDoc(doc) {
      const { editingLine } = get()

      // Unsaved text is the user's intent, so an open edit survives an
      // external change — unless the line it was anchored to is gone.
      const anchored = editingLine !== null && doc.tasks.some((task) => task.line === editingLine)
      set(anchored ? { doc } : { doc, editingLine: null, editDraft: '' })

      // A project deleted in the editor is no longer something to look at.
      syncProject()
    },
  }
})
