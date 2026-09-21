import { useStore } from '../store.ts'

export function CountLine() {
  const tasks = useStore((state) => state.doc.tasks)

  return <p className="text-sm text-muted tabular-nums">{describe(tasks)}</p>
}

function describe(tasks: { completed: boolean }[]): string {
  if (tasks.length === 0) return 'No tasks yet'

  const remaining = tasks.filter((task) => !task.completed).length
  if (remaining === 0) return 'All caught up'
  if (remaining === tasks.length) return `${remaining} to do`

  return `${remaining} of ${tasks.length} left`
}
