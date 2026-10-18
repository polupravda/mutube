import { useLayoutEffect, type MutableRefObject } from 'react'
import { type Video, videoName } from '../../types'
import { FloatingControls } from './FloatingControls'
import { HeaderLogo } from './HeaderLogo'
import { SessionControls } from './SessionControls'
import { ViewToggle } from './ViewToggle'

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

      <ViewToggle target="collections" onClick={onBrowse} />

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
