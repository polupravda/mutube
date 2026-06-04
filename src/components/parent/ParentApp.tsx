import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { verifyPin } from '../../state/pin'
import { AddVideoForm } from './AddVideoForm'
import { CollectionManager } from './CollectionManager'
import { SettingsPanel } from './SettingsPanel'
import { ImportExport } from './ImportExport'

type Tab = 'add' | 'collections' | 'data' | 'settings'

/** PIN gate. If no PIN is set yet (first run), access is granted directly. */
function Gate({ onUnlock }: { onUnlock: () => void }) {
  const { data } = useAppData()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (await verifyPin(pin, data.settings.parentPinHash!)) {
      onUnlock()
    } else {
      setError('Wrong PIN')
      setPin('')
    }
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <h1>Parent area</h1>
        <p className="muted">Enter your PIN to manage videos.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setError('')
          }}
          placeholder="PIN"
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={!pin}>
          Unlock
        </button>
      </form>
    </div>
  )
}

export function ParentApp({ onDone }: { onDone: () => void }) {
  const { data } = useAppData()
  const hasPin = Boolean(data.settings.parentPinHash)
  const [unlocked, setUnlocked] = useState(!hasPin)
  const [tab, setTab] = useState<Tab>('add')

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="parent">
      <header className="parent-header">
        <h1>Mutube — Parent</h1>
        <button className="ghost" onClick={onDone}>
          ◀ Back to kids
        </button>
      </header>

      {!hasPin && (
        <p className="banner">
          No PIN set yet — anyone can open this area. Set one under <strong>Settings</strong>.
        </p>
      )}

      <nav className="tabs">
        <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>
          Add video
        </button>
        <button className={tab === 'collections' ? 'active' : ''} onClick={() => setTab('collections')}>
          Collections
        </button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
          Backup
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>

      <main className="parent-main">
        {tab === 'add' && <AddVideoForm />}
        {tab === 'collections' && <CollectionManager />}
        {tab === 'data' && <ImportExport />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
