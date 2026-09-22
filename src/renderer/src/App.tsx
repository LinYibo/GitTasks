import { useEffect } from 'react'

import { api } from './api.ts'
import { Backdrop } from './components/Backdrop.tsx'
import { Composer } from './components/Composer.tsx'
import { CountLine } from './components/CountLine.tsx'
import { ErrorBanner } from './components/ErrorBanner.tsx'
import { EmptyState } from './components/EmptyState.tsx'
import { FilterTabs } from './components/FilterTabs.tsx'
import { NoFolder } from './components/NoFolder.tsx'
import { RepoBar } from './components/RepoBar.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { TaskList } from './components/TaskList.tsx'
import { useStore } from './store.ts'

export function App() {
  const ready = useStore((state) => state.ready)
  const folderPath = useStore((state) => state.folderPath)

  const init = useStore((state) => state.init)
  const receiveDoc = useStore((state) => state.receiveDoc)

  useEffect(() => {
    void init()
  }, [init])

  // Main pushes a document whenever the file changes underneath us, for
  // instance from an edit in another editor.
  useEffect(() => api.onDocChanged(receiveDoc), [receiveDoc])

  return (
    <div className="flex h-dvh">
      <Backdrop />

      {ready && (
        <>
          {folderPath && <Sidebar />}

          <main className="flex min-w-0 flex-1 flex-col">
            {folderPath ? <Tasks /> : <NoFolder />}
          </main>
        </>
      )}
    </div>
  )
}

/** The main pane: always exactly one project, never a merged view of them. */
function Tasks() {
  const project = useStore((state) => state.selectedProject)

  return (
    <>
      <div className="flex flex-col gap-4 px-6 pb-5 pt-6">
        {project && <ProjectHeading project={project} />}
        {project && <Composer project={project} />}

        {/* Outside the branch above: a rejected project name is an error the
            user can only hit while there is nothing selected. */}
        <ErrorBanner />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
        {project ? (
          <TaskList />
        ) : (
          <EmptyState
            title="No projects yet"
            description="A project is one ## heading in tasks.md. Create one in the sidebar to start adding tasks."
          />
        )}
      </div>

      <div className="px-6 pb-5">
        <RepoBar />
      </div>
    </>
  )
}

function ProjectHeading({ project }: { project: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{project}</h1>
        <CountLine />
      </div>

      <FilterTabs />
    </header>
  )
}
