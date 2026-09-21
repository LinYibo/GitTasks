import { ListTodo } from 'lucide-react'

export function Header() {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 text-muted">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface">
          <ListTodo className="h-4 w-4 text-fg" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">Tasks</span>
      </div>

      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">
        GitTasks
      </h1>
      <p className="max-w-md text-sm text-muted sm:text-base">
        Capture what needs doing. Your list is a markdown file, and every change becomes a commit.
      </p>
    </header>
  )
}
