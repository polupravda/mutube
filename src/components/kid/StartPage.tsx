import { useLayoutEffect, type MutableRefObject } from 'react'
import { type Video, videoName } from '../../types'
import { FloatingControls } from './FloatingControls'
import { HeaderLogo } from './HeaderLogo'
import { SessionControls } from './SessionControls'

/** One suggested-feed card: a video plus the list it belongs to. */
export type FeedItem = {
  video: Video
  collectionId: string
  collectionName: string
  listTitle: string
  listVideoIds: string[]
}

/**
 * YouTube-style start page: a suggested feed mixed across collections (no two
 * neighbours from the same list). Clicking a video opens the player with that
 * video's own list as the sidebar.
 */
export function StartPage({
  feed,
  scrollRef,
  onPickVideo,
  onBrowse,
  onExitToParent,
}: {
  feed: FeedItem[]
  scrollRef: MutableRefObject<number>
  onPickVideo: (item: FeedItem) => void
  onBrowse: () => void
  onExitToParent: () => void
}) {
  useLayoutEffect(() => {
    window.scrollTo(0, scrollRef.current)
    return () => {
      scrollRef.current = window.scrollY
    }
  }, [scrollRef])

  return (
    <div className="kid kid-home">
      <FloatingControls />
      <header className="kid-header">
        <span className="header-side">
          <SessionControls />
        </span>
        {/* Already home: the logo just scrolls back to the top. */}
        <HeaderLogo onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        <span className="header-side header-right">
          <button className="parent-door" onClick={onExitToParent} aria-label="Parent area" title="Parent area">⚙</button>
        </span>
      </header>

      {/* Fixed so it's always one tap away while scrolling the feed. */}
      <button className="fab-collections" onClick={onBrowse}>
        <CollectionsIcon />
        Collections
      </button>

      {feed.length === 0 ? (
        <div className="kid-empty">
          <p className="big">No videos yet! 🎬</p>
          <p>Ask a grown-up to add some in the parent area.</p>
        </div>
      ) : (
        <>
          <h2 className="section-title">Suggested for you</h2>
          <div className="card-grid">
            {feed.map((f, i) => (
              <button key={`${f.video.id}-${i}`} className="big-card video-tile feed-tile" onClick={() => onPickVideo(f)}>
                <span className="thumb-wrap">
                  <img src={f.video.thumbnailUrl} alt="" className="thumb" />
                </span>
                <span className="tile-name">{videoName(f.video)}</span>
                <span className="tile-channel">{f.collectionName}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Stacked cards: a "browse collections" glyph. */
function CollectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="2.5" fill="currentColor" fillOpacity="0.25" />
      <path d="M5.5 6h13M8 3h8" />
      <path d="M10.5 12.5v5l4-2.5z" fill="currentColor" />
    </svg>
  )
}
