import { ListTodo } from 'lucide-react'

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted">
        <ListTodo className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-fg">{title}</p>
      <p className="max-w-xs text-sm text-muted">{description}</p>
    </div>
  )
}
