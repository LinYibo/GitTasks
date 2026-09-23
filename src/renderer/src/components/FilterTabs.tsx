import { useStore } from '../store.ts'
import type { Filter } from '../store.ts'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
]

export function FilterTabs() {
  const filter = useStore((state) => state.filter)
  const setFilter = useStore((state) => state.setFilter)

  return (
    <div
      role="tablist"
      aria-label="Filter tasks"
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={filter === id}
          onClick={() => setFilter(id)}
          className={`h-9 rounded-md px-3.5 text-sm font-medium transition-colors duration-150 ${
            filter === id ? 'bg-surface-elevated text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
