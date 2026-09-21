import type { Filter } from '../store.ts'
import { useStore } from '../store.ts'
import { EmptyState } from './EmptyState.tsx'
import { TaskRow } from './TaskRow.tsx'

const EMPTY_COPY: Record<Filter, { title: string; description: string }> = {
  all: {
    title: 'Nothing here yet',
    description: 'Add your first task above to get started.',
  },
  active: {
    title: 'Nothing left to do',
    description: 'Every task is checked off.',
  },
  done: {
    title: 'Nothing completed yet',
    description: 'Tasks you check off will show up here.',
  },
}

export function TaskList() {
  const tasks = useStore((state) => state.doc.tasks)
  const filter = useStore((state) => state.filter)

  const visible = tasks.filter((task) =>
    filter === 'active' ? !task.completed : filter === 'done' ? task.completed : true,
  )

  if (visible.length === 0) return <EmptyState {...EMPTY_COPY[filter]} />

  return (
    <ul className="flex flex-col">
      {/* A line number is a task's identity, so it is the natural key. */}
      {visible.map((task) => (
        <TaskRow key={task.line} task={task} />
      ))}
    </ul>
  )
}
