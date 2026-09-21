import { Check, Pencil, Trash } from 'lucide-react'

import type { Priority, Task } from '../../../shared/types.ts'
import { useStore } from '../store.ts'
import { IconButton } from './IconButton.tsx'

export function TaskRow({ task }: { task: Task }) {
  const editing = useStore((state) => state.editingLine) === task.line

  return <li className={ROW}>{editing ? <Editor task={task} /> : <Summary task={task} />}</li>
}

const ROW =
  'group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors duration-150 hover:border-border hover:bg-surface'

function Summary({ task }: { task: Task }) {
  const toggleTask = useStore((state) => state.toggleTask)
  const removeTask = useStore((state) => state.removeTask)
  const beginEdit = useStore((state) => state.beginEdit)

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        onClick={() => void toggleTask(task.line)}
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ${
          task.completed
            ? 'border-primary bg-primary text-primary-fg'
            : 'border-border-strong text-transparent group-hover:text-subtle hover:border-muted'
        }`}
      >
        <Check className="h-3 w-3" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={`text-sm ${task.completed ? 'text-subtle line-through' : 'text-fg'}`}>
          {task.title}
        </span>
        <Metadata task={task} />
      </div>

      {/* Hidden until hover or focus, so the list stays quiet at rest. */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <IconButton label={`Edit ${task.title}`} onClick={() => beginEdit(task.line)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton label={`Delete ${task.title}`} onClick={() => void removeTask(task.line)}>
          <Trash className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    </>
  )
}

/**
 * The task is edited with the same inline syntax the file uses, so there are no
 * separate controls for tags, projects, priorities or dates.
 */
function Editor({ task }: { task: Task }) {
  const draft = useStore((state) => state.editDraft)
  const setEditDraft = useStore((state) => state.setEditDraft)
  const commitEdit = useStore((state) => state.commitEdit)
  const cancelEdit = useStore((state) => state.cancelEdit)

  return (
    <form
      className="flex-1"
      onSubmit={(event) => {
        event.preventDefault()
        void commitEdit()
      }}
    >
      <input
        autoFocus
        className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Edit ${task.title}`}
        value={draft}
        onChange={(event) => setEditDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancelEdit()
        }}
        onBlur={() => void commitEdit()}
      />
    </form>
  )
}

const PRIORITY_CLASS: Record<Priority, string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-surface-elevated text-muted',
  3: 'bg-surface text-subtle',
}

function Metadata({ task }: { task: Task }) {
  const { tags, project, priority, due } = task
  if (!tags.length && !project && !priority && !due) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {priority && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_CLASS[priority]}`}>
          p{priority}
        </span>
      )}

      {due && (
        <span className={`rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${dueClass(due)}`}>
          {due}
        </span>
      )}

      {project && <span className="text-[11px] text-muted">+{project}</span>}

      {tags.map((tag) => (
        <span key={tag} className="text-[11px] text-subtle">
          #{tag}
        </span>
      ))}
    </div>
  )
}

/** ISO dates compare correctly as strings, so no parsing is needed. */
function dueClass(due: string): string {
  const today = localToday()
  if (due < today) return 'border-danger/40 text-danger'
  if (due === today) return 'border-accent/40 text-accent'
  return 'border-border text-subtle'
}

/** Local, not UTC: a due date is about the user's calendar day. */
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
