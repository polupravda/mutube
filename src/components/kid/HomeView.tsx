import { type Collection, type SubCollection, type Video } from '../../types'
import { FloatingControls } from './FloatingControls'
import { HeaderLogo } from './HeaderLogo'
import { SessionControls } from './SessionControls'

/**
 * Kid home screen: collections only. Each collection is shown as a section with
 * its sub-lists (seasons/topics) displayed inline as tiles — no nested subpages.
 * Picking a sub-list opens its video grid. Blacklisted collections show a
 * "1 video only" lock once the session's one allowed video has been watched.
 */
export function HomeView({
  collections,
  videoById,
  blacklist,
  blacklistLocked,
  onPickSub,
  onExitToParent,
}: {
  collections: Collection[]
  videoById: (id: string) => Video | undefined
  blacklist: string[]
  blacklistLocked: boolean
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
        <span className="header-side">
          <SessionControls />
        </span>
        <HeaderLogo />
        <span className="header-side header-right">
          {/* Subtle parent door, top corner, away from the fun stuff. */}
          <button className="parent-door" onClick={onExitToParent} aria-label="Parent area" title="Parent area">
            ⚙
          </button>
        </span>
      </header>

      {sections.length === 0 ? (
        <div className="kid-empty">
          <p className="big">No videos yet! 🎬</p>
          <p>Ask a grown-up to add some in the parent area.</p>
        </div>
      ) : (
        sections.map(({ collection: c, subs }) => {
          const hasRealSubs = Boolean(c.subCollections?.length)
          const locked = blacklist.includes(c.id) && blacklistLocked
          return (
            <section className={`home-section${locked ? ' locked' : ''}`} key={c.id}>
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
              {locked && <div className="blacklist-banner">1 video only</div>}
            </section>
          )
        })
      )}
    </div>
  )
}
