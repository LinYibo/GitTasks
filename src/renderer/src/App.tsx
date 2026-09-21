import { useEffect } from 'react'

import { api } from './api.ts'
import { Backdrop } from './components/Backdrop.tsx'
import { Composer } from './components/Composer.tsx'
import { CountLine } from './components/CountLine.tsx'
import { ErrorBanner } from './components/ErrorBanner.tsx'
import { FilterTabs } from './components/FilterTabs.tsx'
import { GitMissing } from './components/GitMissing.tsx'
import { Header } from './components/Header.tsx'
import { NoRepo } from './components/NoRepo.tsx'
import { SyncStatus } from './components/SyncStatus.tsx'
import { TaskList } from './components/TaskList.tsx'
import { useStore } from './store.ts'

export function App() {
  const ready = useStore((state) => state.ready)
  const gitAvailable = useStore((state) => state.gitAvailable)
  const repoPath = useStore((state) => state.repoPath)

  const init = useStore((state) => state.init)
  const receiveDoc = useStore((state) => state.receiveDoc)
  const receiveStatus = useStore((state) => state.receiveStatus)

  useEffect(() => {
    void init()
  }, [init])

  // Main pushes a document whenever the file changes underneath us — an edit in
  // another editor, or a pull.
  useEffect(() => {
    const offDoc = api.onDocChanged(receiveDoc)
    const offStatus = api.onStatusChanged(receiveStatus)

    return () => {
      offDoc()
      offStatus()
    }
  }, [receiveDoc, receiveStatus])

  return (
    <main className="min-h-dvh bg-bg">
      <Backdrop />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:py-14">
        <Header />

        {ready && <ErrorBanner />}

        {ready && (gitAvailable ? (repoPath ? <Tasks /> : <NoRepo />) : <GitMissing />)}
      </div>
    </main>
  )
}

function Tasks() {
  return (
    <>
      <Composer />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs />
          <CountLine />
        </div>

        <TaskList />
      </div>

      <SyncStatus />
    </>
  )
}
