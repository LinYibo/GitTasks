/**
 * The project axis of the app: one row per `## heading`, and the main pane
 * always shows exactly one of them.
 *
 * The selection is a title rather than a line because adding or deleting a
 * project renumbers every line below it, whereas a name keeps pointing at the
 * same thing.
 */

import { useState } from 'react'
import { FolderPlus, Pencil, Trash } from 'lucide-react'

import type { Project, Task } from '../../../shared/types.ts'
import logo from '../assets/logo.png'
import { useStore } from '../store.ts'
import { IconButton } from './IconButton.tsx'

export function Sidebar() {
  const projects = useStore((state) => state.doc.projects)
  const tasks = useStore((state) => state.doc.tasks)
  const selected = useStore((state) => state.selectedProject)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface/40">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <img src={logo} alt="" className="h-8 w-8" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-tight text-fg">GitTasks</span>
      </div>

      <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {projects.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-subtle">No projects yet</p>
        )}

        {projects.map((project) => (
          <ProjectRow
            key={project.line}
            project={project}
            tasks={tasksFor(tasks, project)}
            selected={selected === project.title}
          />
        ))}
      </nav>

      <div className="px-2 py-3">
        <AddProject />
      </div>
    </aside>
  )
}

function tasksFor(tasks: Task[], project: Project): Task[] {
  return tasks.filter((task) => task.projectLine === project.line)
}

function ProjectRow({
  project,
  tasks,
  selected,
}: {
  project: Project
  tasks: Task[]
  selected: boolean
}) {
  const selectProject = useStore((state) => state.selectProject)
  const renameProject = useStore((state) => state.renameProject)
  const deleteProject = useStore((state) => state.deleteProject)

  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (renaming) {
    return (
      <InlineName
        label={`Rename ${project.title}`}
        initial={project.title}
        onCancel={() => setRenaming(false)}
        onSubmit={(title) => {
          setRenaming(false)
          void renameProject(project.line, title)
        }}
      />
    )
  }

  // Deleting takes the project's tasks with it, so the cost belongs on the
  // button that asks for it.
  if (confirming) {
    return (
      <Confirm
        label={deleteLabel(project.title, tasks.length)}
        onCancel={() => setConfirming(false)}
        onSubmit={() => {
          setConfirming(false)
          void deleteProject(project.line)
        }}
      />
    )
  }

  const open = tasks.filter((task) => !task.completed).length

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => selectProject(project.title)}
        aria-current={selected ? 'true' : undefined}
        className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm transition-colors duration-150 ${
          selected ? 'bg-surface-elevated font-medium text-fg' : 'text-muted hover:bg-surface hover:text-fg'
        }`}
      >
        {selected && (
          <span
            className="absolute left-0 top-1.5 h-6 w-0.5 rounded-r-full bg-accent"
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-left">{project.title}</span>

        {/* The count gives way to the row's actions on hover. */}
        {tasks.length > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-subtle transition-opacity duration-150 group-hover/row:opacity-0">
            {open}
          </span>
        )}
      </button>

      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 focus-within:opacity-100">
        <IconButton label={`Rename ${project.title}`} onClick={() => setRenaming(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton label={`Delete ${project.title}`} onClick={() => setConfirming(true)}>
          <Trash className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  )
}

function deleteLabel(title: string, tasks: number): string {
  if (tasks === 0) return `Delete ${title}?`
  return `Delete ${title} and ${tasks === 1 ? '1 task' : `${tasks} tasks`}?`
}

function AddProject() {
  const addProject = useStore((state) => state.addProject)
  const [adding, setAdding] = useState(false)

  if (adding) {
    return (
      <InlineName
        label="New project"
        initial=""
        placeholder="Project name"
        onCancel={() => setAdding(false)}
        onSubmit={(title) => {
          setAdding(false)
          void addProject(title)
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-dashed border-border px-2.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
    >
      <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
      New project
    </button>
  )
}

/** A two-choice row in place of the project, so nothing has to be dismissed. */
function Confirm({
  label,
  onSubmit,
  onCancel,
}: {
  label: string
  onSubmit(): void
  onCancel(): void
}) {
  return (
    <div
      role="group"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="flex h-9 items-center gap-1 rounded-lg bg-danger-soft px-2"
    >
      <span className="min-w-0 flex-1 truncate text-xs text-fg">{label}</span>
      <button
        type="button"
        onClick={onSubmit}
        className="h-6 rounded px-1.5 text-xs font-medium text-danger hover:bg-danger/15"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-6 rounded px-1.5 text-xs text-muted hover:text-fg"
      >
        Cancel
      </button>
    </div>
  )
}

/** The same commit-on-Enter / cancel-on-Escape shape as the task editor. */
function InlineName({
  label,
  initial,
  placeholder = initial,
  onSubmit,
  onCancel,
}: {
  label: string
  initial: string
  placeholder?: string
  onSubmit(title: string): void
  onCancel(): void
}) {
  const [value, setValue] = useState(initial)

  const commit = (): void => {
    if (value.trim()) onSubmit(value)
    else onCancel()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
        className="h-9 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        onBlur={commit}
      />
    </form>
  )
}
