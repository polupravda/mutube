import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { formatDuration } from '../../api/youtube'
import { type Collection, videoName } from '../../types'

function CollectionCard({ collection }: { collection: Collection }) {
  const { data, dispatch, videosOf } = useAppData()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(collection.name)
  const [emoji, setEmoji] = useState(collection.emoji ?? '')
  const [addId, setAddId] = useState('')

  const videos = videosOf(collection)
  const inCollection = new Set(collection.videoIds)
  const available = Object.values(data.videos).filter((v) => !inCollection.has(v.id))

  function saveEdit() {
    dispatch({ type: 'renameCollection', id: collection.id, name: name.trim() || collection.name, emoji: emoji.trim() || undefined })
    setEditing(false)
  }

  return (
    <div className="card collection-card">
      <div className="collection-head">
        {editing ? (
          <div className="row">
            <input className="emoji-input" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🙂" maxLength={4} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <button onClick={saveEdit}>Save</button>
            <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <h3>
              {collection.emoji ? `${collection.emoji} ` : ''}
              {collection.name} <span className="muted">({videos.length})</span>
            </h3>
            <div className="row">
              <button className="ghost" onClick={() => setEditing(true)}>Rename</button>
              <button
                className="ghost danger"
                onClick={() => {
                  if (confirm(`Delete collection "${collection.name}"? Videos stay in your library.`))
                    dispatch({ type: 'deleteCollection', id: collection.id })
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <ul className="video-list">
        {videos.map((v, i) => (
          <li key={v.id} className={v.embeddable ? '' : 'unplayable'}>
            <img src={v.thumbnailUrl} alt="" className="thumb-sm" />
            <span className="vtitle">
              {videoName(v)}
              {!v.embeddable && <span className="tag">not embeddable</span>}
            </span>
            <span className="muted">{formatDuration(v.durationSeconds)}</span>
            <span className="row">
              <button
                className={collection.coverVideoId === v.id ? '' : 'ghost'}
                title="Use this thumbnail as the collection cover"
                onClick={() =>
                  dispatch({
                    type: 'setCollectionCover',
                    collectionId: collection.id,
                    coverVideoId: collection.coverVideoId === v.id ? undefined : v.id,
                  })
                }
              >
                {collection.coverVideoId === v.id ? '★ Cover' : 'Cover'}
              </button>
              <button className="ghost" disabled={i === 0} onClick={() => dispatch({ type: 'reorderVideoInCollection', collectionId: collection.id, from: i, to: i - 1 })}>↑</button>
              <button className="ghost" disabled={i === videos.length - 1} onClick={() => dispatch({ type: 'reorderVideoInCollection', collectionId: collection.id, from: i, to: i + 1 })}>↓</button>
              <button className="ghost danger" onClick={() => dispatch({ type: 'removeVideoFromCollection', collectionId: collection.id, videoId: v.id })}>Remove</button>
            </span>
          </li>
        ))}
        {videos.length === 0 && <li className="muted">No videos yet — add some below.</li>}
      </ul>

      {available.length > 0 && (
        <div className="row">
          <select value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Add a video from your library…</option>
            {available.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
          <button
            disabled={!addId}
            onClick={() => {
              dispatch({ type: 'addVideoToCollection', collectionId: collection.id, videoId: addId })
              setAddId('')
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

export function CollectionManager() {
  const { data, dispatch } = useAppData()
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')

  // Videos that exist in the library but aren't in any collection.
  const assigned = new Set(data.collections.flatMap((c) => c.videoIds))
  const orphans = Object.values(data.videos).filter((v) => !assigned.has(v.id))

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    dispatch({ type: 'createCollection', name: newName.trim(), emoji: newEmoji.trim() || undefined })
    setNewName('')
    setNewEmoji('')
  }

  return (
    <section className="panel">
      <h2>Collections</h2>

      <form className="row" onSubmit={create}>
        <input className="emoji-input" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="🙂" maxLength={4} />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New collection name" />
        <button type="submit" disabled={!newName.trim()}>Create</button>
      </form>

      {data.collections.length === 0 && <p className="muted">No collections yet. Create one above.</p>}

      <div className="collections">
        {data.collections.map((c, i) => (
          <div key={c.id} className="collection-wrap">
            <div className="reorder-col">
              <button className="ghost" disabled={i === 0} onClick={() => dispatch({ type: 'reorderCollections', from: i, to: i - 1 })}>↑</button>
              <button className="ghost" disabled={i === data.collections.length - 1} onClick={() => dispatch({ type: 'reorderCollections', from: i, to: i + 1 })}>↓</button>
            </div>
            <CollectionCard collection={c} />
          </div>
        ))}
      </div>

      {orphans.length > 0 && (
        <div className="card">
          <h3>Unfiled videos ({orphans.length})</h3>
          <p className="muted">In your library but not in any collection — kids can’t see these yet.</p>
          <ul className="video-list">
            {orphans.map((v) => (
              <li key={v.id}>
                <img src={v.thumbnailUrl} alt="" className="thumb-sm" />
                <span className="vtitle">{videoName(v)}</span>
                <button className="ghost danger" onClick={() => dispatch({ type: 'removeVideo', videoId: v.id })}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
