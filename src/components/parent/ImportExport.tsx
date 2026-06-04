import { useRef, useState } from 'react'
import { useAppData } from '../../state/useAppData'

/**
 * Move the curated library between devices without a backend: download the whole
 * AppData blob as JSON, or load one back in. This is the "sync-ready" escape
 * hatch until a cloud adapter is added.
 */
export function ImportExport() {
  const { data, exportJson, importJson } = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function download() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mutube-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      if (!confirm('Importing replaces your current collections and videos. Continue?')) return
      importJson(text)
      setMsg('Imported successfully.')
    } catch {
      setMsg('Could not read that file — is it a Mutube backup?')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const videoCount = Object.keys(data.videos).length

  return (
    <section className="panel">
      <h2>Backup &amp; move between devices</h2>
      <div className="card">
        <p className="muted">
          {data.collections.length} collection(s), {videoCount} video(s) stored on this device.
        </p>
        <div className="row">
          <button onClick={download}>⬇ Export to file</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>⬆ Import from file</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </section>
  )
}
