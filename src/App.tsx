import { useState } from 'react'
import { AppDataProvider, useAppData } from './state/useAppData'
import { SessionProvider } from './state/useSession'
import { KidApp } from './components/kid/KidApp'
import { ParentApp } from './components/parent/ParentApp'
import { SessionWarningPopup } from './components/kid/SessionOverlays'

type Mode = 'kid' | 'parent'

function Shell() {
  const { ready } = useAppData()
  const [mode, setMode] = useState<Mode>('kid')

  if (!ready) {
    return <div className="loading">Loading…</div>
  }

  return (
    <>
      {mode === 'kid' ? (
        <KidApp onExitToParent={() => setMode('parent')} />
      ) : (
        <ParentApp onDone={() => setMode('kid')} />
      )}
      <SessionWarningPopup />
    </>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </AppDataProvider>
  )
}
