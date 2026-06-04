import { useState } from 'react'
import { AppDataProvider, useAppData } from './state/useAppData'
import { KidApp } from './components/kid/KidApp'
import { ParentApp } from './components/parent/ParentApp'

type Mode = 'kid' | 'parent'

function Shell() {
  const { ready } = useAppData()
  const [mode, setMode] = useState<Mode>('kid')

  if (!ready) {
    return <div className="loading">Loading…</div>
  }

  return mode === 'kid' ? (
    <KidApp onExitToParent={() => setMode('parent')} />
  ) : (
    <ParentApp onDone={() => setMode('kid')} />
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  )
}
