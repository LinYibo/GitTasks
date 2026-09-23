import { Plus } from 'lucide-react'

import { useStore } from '../store.ts'

export function Composer({ project }: { project: string }) {
  const text = useStore((state) => state.composerText)
  const setComposerText = useStore((state) => state.setComposerText)
  const addTask = useStore((state) => state.addTask)

  return (
    <form
      className="flex gap-2 rounded-xl border border-border bg-surface p-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void addTask()
      }}
    >
      <input
        className="h-11 w-full min-w-0 border-0 bg-transparent px-3 text-sm text-fg outline-none placeholder:text-subtle"
        placeholder={`Add a task to ${project}…`}
        aria-label="New task"
        autoComplete="off"
        maxLength={200}
        value={text}
        onChange={(event) => setComposerText(event.target.value)}
      />

      <button
        type="submit"
        aria-label="Add task"
        disabled={text.trim() === ''}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Add</span>
        <Plus className="hidden h-4 w-4 sm:block" aria-hidden="true" />
      </button>
    </form>
  )
}
