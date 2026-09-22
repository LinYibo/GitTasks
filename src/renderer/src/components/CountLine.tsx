import { tasksOf, useStore } from '../store.ts'

export function CountLine() {
  const doc = useStore((state) => state.doc)
  const selected = useStore((state) => state.selectedProject)

  return <p className="text-sm text-muted tabular-nums">{describe(tasksOf(doc, selected))}</p>
}

function describe(tasks: { completed: boolean }[]): string {
  if (tasks.length === 0) return 'No tasks yet'

  const remaining = tasks.filter((task) => !task.completed).length
  if (remaining === 0) return 'All caught up'
  if (remaining === tasks.length) return `${remaining} to do`

  return `${remaining} of ${tasks.length} left`
}
