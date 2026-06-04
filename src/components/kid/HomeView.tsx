import { type Collection, type SubCollection, type Video } from '../../types'
import { FloatingControls } from './FloatingControls'

/**
 * Kid home screen: collections only. Each collection is shown as a section with
 * its sub-lists (seasons/topics) displayed inline as tiles — no nested subpages.
 * Picking a sub-list opens its video grid.
 */
export function HomeView({
  collections,
  videoById,
  onPickSub,
  onExitToParent,
}: {
  collections: Collection[]
  videoById: (id: string) => Video | undefined
  onPickSub: (collectionId: string, subId: string | null) => void
  onExitToParent: () => void
}) {
  const playable = (ids: string[]) => ids.map(videoById).filter((v): v is Video => Boolean(v?.embeddable))

  // For a collection without explicit sub-lists, treat the whole thing as one.
  const subsOf = (c: Collection): SubCollection[] =>
    c.subCollections?.length ? c.subCollections : [{ id: c.id, name: c.name, videoIds: c.videoIds }]

  const sections = collections
    .map((c) => ({
      collection: c,
      subs: subsOf(c)
        .map((s) => ({ sub: s, vids: playable(s.videoIds) }))
        .filter((s) => s.vids.length > 0),
    }))
    .filter((sec) => sec.subs.length > 0)

  return (
    <div className="kid kid-home">
      <FloatingControls />
      <header className="kid-header">
        <h1 className="logo">Mutube</h1>
        {/* Subtle parent door, top corner, away from the fun stuff. */}
        <button className="parent-door" onClick={onExitToParent} aria-label="Parent area" title="Parent area">
          ⚙
        </button>
      </header>

      {sections.length === 0 ? (
        <div className="kid-empty">
          <p className="big">No videos yet! 🎬</p>
          <p>Ask a grown-up to add some in the parent area.</p>
        </div>
      ) : (
        sections.map(({ collection: c, subs }) => {
          const hasRealSubs = Boolean(c.subCollections?.length)
          return (
            <section className="home-section" key={c.id}>
              <h2 className="section-title">
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </h2>
              <div className="card-grid">
                {subs.map(({ sub, vids }) => (
                  <button
                    key={sub.id}
                    className="big-card sublist-tile"
                    onClick={() => onPickSub(c.id, hasRealSubs ? sub.id : null)}
                  >
                    <span className="tile-cover">
                      <img src={vids[0].thumbnailUrl} alt="" />
                    </span>
                    <span className="tile-name">{sub.name}</span>
                    <span className="tile-count">{vids.length} video{vids.length === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
