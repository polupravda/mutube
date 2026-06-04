import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { hashPin } from '../../state/pin'
import { hasApiKey } from '../../api/youtube'
import { hasLegacyData, migrateFromLocalStorage } from '../../storage/legacyMigration'

export function SettingsPanel() {
  const {
    data,
    dispatch,
    exportJson,
    importJson,
    sourceStatus,
    dirtyVsSource,
    reloadFromSource,
    markSyncedToSource,
  } = useAppData()
  const hasPin = Boolean(data.settings.parentPinHash)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [dataMsg, setDataMsg] = useState('')
  const [migrateMsg, setMigrateMsg] = useState('')
  const [sourceUrl, setSourceUrl] = useState(data.settings.sourceUrl ?? '')
  const [copyMsg, setCopyMsg] = useState('')
  const legacyPresent = hasLegacyData()

  async function savePin(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) return setMsg('Use at least 4 digits.')
    if (pin !== confirm) return setMsg('PINs do not match.')
    dispatch({ type: 'setPinHash', hash: await hashPin(pin) })
    setPin('')
    setConfirm('')
    setMsg('PIN saved.')
  }

  function exportData() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mutube.data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    try {
      importJson(await file.text())
      setDataMsg(`Imported “${file.name}”.`)
    } catch {
      setDataMsg('That file is not a valid Mutube data file.')
    }
  }

  async function loadSource() {
    const result = await reloadFromSource(sourceUrl.trim())
    if (result.ok) setCopyMsg('')
  }

  function disableSource() {
    dispatch({ type: 'setSourceUrl', url: undefined })
    setSourceUrl('')
  }

  async function copyDocument() {
    const json = exportJson()
    try {
      await navigator.clipboard.writeText(json)
      markSyncedToSource()
      setCopyMsg('Copied the full document to the clipboard — paste it over your source file.')
    } catch {
      // Clipboard blocked (e.g. insecure context): fall back to a download.
      exportData()
      setCopyMsg('Clipboard unavailable — downloaded the document instead; upload it to your source.')
    }
  }

  function migrate() {
    const result = migrateFromLocalStorage(data)
    if (!result) {
      setMigrateMsg('No old browser-storage data found to migrate.')
      return
    }
    const { data: merged, summary } = result
    dispatch({ type: 'replace', data: merged })
    const parts = [
      `${summary.videosAdded} video${summary.videosAdded === 1 ? '' : 's'} added`,
      summary.collectionsAdded ? `${summary.collectionsAdded} new collection${summary.collectionsAdded === 1 ? '' : 's'}` : '',
      summary.collectionsMerged ? `${summary.collectionsMerged} collection${summary.collectionsMerged === 1 ? '' : 's'} merged` : '',
      summary.videosAlreadyPresent ? `${summary.videosAlreadyPresent} already present (skipped)` : '',
    ].filter(Boolean)
    setMigrateMsg(`Migration complete — ${parts.join(', ')}.`)
  }

  return (
    <section className="panel">
      <h2>Settings</h2>

      <div className="card">
        <h3>Parent PIN {hasPin ? '✅' : '— not set'}</h3>
        <p className="muted">
          A soft lock so kids can’t open the parent area. Not bank-grade security — for a hard lock,
          use your device’s kiosk mode (iOS Guided Access / Android Screen Pinning).
        </p>
        <form className="form-col" onSubmit={savePin}>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={hasPin ? 'New PIN' : 'Choose a PIN'} />
          <input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm PIN" />
          <button type="submit" disabled={!pin || !confirm}>{hasPin ? 'Change PIN' : 'Set PIN'}</button>
          {msg && <p className="muted">{msg}</p>}
        </form>
      </div>

      <div className="card">
        <h3>External source (database)</h3>
        <p className="muted">
          Point the app at a public JSON document (a GitHub <em>raw</em> link, a Google Drive
          direct-download link, or any public URL matching <code>schema/mutube.schema.json</code>).
          It’s loaded automatically on startup. Writing back is manual: add videos here, then{' '}
          <strong>Copy full document</strong> and paste it over your source file.
        </p>
        <div className="field">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/you/repo/main/mutube.data.json"
          />
        </div>
        <div className="row">
          <button onClick={loadSource} disabled={!sourceUrl.trim() || sourceStatus.state === 'loading'}>
            {sourceStatus.state === 'loading' ? 'Loading…' : 'Load from this URL'}
          </button>
          <button className="ghost" onClick={copyDocument}>Copy full document</button>
          {data.settings.sourceUrl && (
            <button className="ghost danger" onClick={disableSource}>Disable source</button>
          )}
        </div>

        {sourceStatus.state === 'ok' && (
          <p className="muted">
            Loaded from source ✓{sourceStatus.loadedAt ? ` at ${new Date(sourceStatus.loadedAt).toLocaleTimeString()}` : ''}.
          </p>
        )}
        {sourceStatus.state === 'error' && <p className="error">Source error: {sourceStatus.error}</p>}
        {data.settings.sourceUrl && dirtyVsSource && (
          <p className="banner">⚠ Unsynced changes — copy the document into your source so they aren’t lost on reload.</p>
        )}
        {copyMsg && <p className="muted">{copyMsg}</p>}
      </div>

      <div className="card">
        <h3>Backup &amp; data</h3>
        <p className="muted">
          Your library lives in a portable <code>mutube.data.json</code> file (see{' '}
          <code>schema/mutube.schema.json</code>). Export to back it up or move it to another
          machine; Import replaces the current library with a file.
        </p>
        <div className="row">
          <button className="ghost" onClick={exportData}>Export data…</button>
          <label className="ghost button-like">
            Import data…
            <input type="file" accept="application/json,.json" onChange={importData} hidden />
          </label>
        </div>
        {dataMsg && <p className="muted">{dataMsg}</p>}

        <div className="row">
          <button className="ghost" onClick={migrate}>Migrate from browser storage</button>
          {legacyPresent
            ? <span className="muted">Old localStorage data detected.</span>
            : <span className="muted">No old data detected.</span>}
        </div>
        <p className="muted">
          Imports your library from the retired browser storage. Safe to run more than once —
          duplicates are skipped.
        </p>
        {migrateMsg && <p className="muted">{migrateMsg}</p>}
      </div>

      <div className="card">
        <h3>YouTube API key {hasApiKey() ? '✅' : '— missing'}</h3>
        <p className="muted">
          The key is read from <code>VITE_YOUTUBE_API_KEY</code> in your <code>.env</code> file at
          build time (not stored in the app). Each video you add costs 1 quota unit; the free quota
          is 10,000/day.
        </p>
      </div>
    </section>
  )
}
