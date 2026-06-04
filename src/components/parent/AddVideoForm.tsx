import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { fetchVideoMetadata, formatDuration, hasApiKey, parseVideoId } from '../../api/youtube'
import type { Video } from '../../types'

/**
 * Paste a YouTube URL/ID -> fetch metadata (1 quota unit) -> preview -> add,
 * optionally straight into a collection.
 */
export function AddVideoForm() {
  const { data, dispatch } = useAppData()
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Video | null>(null)
  const [collectionId, setCollectionId] = useState('')
  const [alias, setAlias] = useState('')

  const alreadyHave = preview ? Boolean(data.videos[preview.id]) : false

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPreview(null)
    const id = parseVideoId(input)
    if (!id) {
      setStatus('error')
      setError('That does not look like a YouTube link or video ID.')
      return
    }
    setStatus('loading')
    try {
      const video = await fetchVideoMetadata(id)
      setPreview(video)
      // Pre-fill the alias with the original title; parent can override it.
      setAlias(data.videos[video.id]?.alias ?? video.title)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Lookup failed.')
    }
  }

  function add() {
    if (!preview) return
    // Alias defaults to the original title when left blank.
    const video: Video = { ...preview, alias: alias.trim() || preview.title }
    dispatch({ type: 'addVideo', video, collectionId: collectionId || undefined })
    setPreview(null)
    setInput('')
    setAlias('')
    setStatus('idle')
  }

  return (
    <section className="panel">
      <h2>Add a video</h2>
      {!hasApiKey() && (
        <p className="banner error">
          No YouTube API key found. Add <code>VITE_YOUTUBE_API_KEY</code> to a <code>.env</code>{' '}
          file and restart the dev server.
        </p>
      )}

      <form className="row" onSubmit={lookup}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a YouTube link or video ID"
          autoFocus
        />
        <button type="submit" disabled={status === 'loading' || !input.trim()}>
          {status === 'loading' ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {preview && (
        <div className="card preview">
          <img src={preview.thumbnailUrl} alt="" className="thumb" />
          <div className="preview-meta">
            <h3>{preview.title}</h3>
            <p className="muted">
              {preview.channelTitle} · {formatDuration(preview.durationSeconds)}
            </p>
            {!preview.embeddable && (
              <p className="error">⚠ This video can’t be embedded — it won’t play in Mutube.</p>
            )}
            {alreadyHave && <p className="muted">Already in your library — adding will update it.</p>}

            <label className="field">
              Display name (alias)
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={preview.title}
              />
              <span className="muted">Shown to kids and used by search. Leave blank to keep the original title.</span>
            </label>

            <label className="field">
              Add to collection
              <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                <option value="">Library only (assign later)</option>
                {data.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <button onClick={add}>Add video</button>
          </div>
        </div>
      )}
    </section>
  )
}
