import type { Filter } from '../store.ts'
import type { Task } from '../../../shared/types.ts'
import { tasksOf, useStore } from '../store.ts'
import { EmptyState } from './EmptyState.tsx'
import { TaskRow } from './TaskRow.tsx'

const EMPTY_COPY: Record<Filter, { title: string; description: string }> = {
  all: {
    title: 'No tasks in this project',
    description: 'Add one above. Each task is a checkbox line under the project heading.',
  },
  active: {
    title: 'Nothing left to do',
    description: 'Every task in this project is checked off.',
  },
  done: {
    title: 'Nothing completed yet',
    description: 'Tasks you check off will show up here.',
  },
}

function byStatus(tasks: Task[], filter: Filter): Task[] {
  return tasks.filter((task) =>
    filter === 'active' ? !task.completed : filter === 'done' ? task.completed : true,
  )
}

export function TaskList() {
  const doc = useStore((state) => state.doc)
  const filter = useStore((state) => state.filter)
  const selected = useStore((state) => state.selectedProject)

  const visible = byStatus(tasksOf(doc, selected), filter)

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
