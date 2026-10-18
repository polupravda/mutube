import { useEffect, useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { useSession } from '../../state/useSession'
import { type Video, videoName } from '../../types'
import { HeaderLogo } from './HeaderLogo'
import { FloatingControls } from './FloatingControls'
import { VKPlayer } from './VKPlayer'
import { YouTubePlayer } from './YouTubePlayer'

/**
 * Embedded player in a YouTube-style layout: the video on the left, the current
 * sub-list as a column on the right. YouTube plays in a plain
 * youtube-nocookie.com iframe (no youtube.com requests) with its native controls.
 * When a video ends, mutube's own overlay covers the stage so the embed's
 * suggestion grid can't be clicked.
 *
 * Blacklisted collections hide the recommendations panel and consume the
 * session's one-video allowance when the video finishes. The session timer can
 * force-pause the player (5-min warning) or stop it (session over).
 *
 * NOTE: ads can still appear and cannot be removed from the embedded player.
 */
export function PlayerView({
  playlist,
  index,
  title,
  blacklisted,
  onSelect,
  onBlacklistFinished,
  onBack,
  onHome,
}: {
  playlist: Video[]
  index: number
  title: string
  blacklisted: boolean
  onSelect: (index: number) => void
  onBlacklistFinished: () => void
  onBack: () => void
  onHome: () => void
}) {
  const { dispatch } = useAppData()
  const { sessionPause, setWatching } = useSession()
  const [errored, setErrored] = useState(false)
  const [ended, setEnded] = useState(false)
  // Bumped by "Watch again" to remount the player.
  const [replay, setReplay] = useState(0)

  const video = playlist[index]
  const hasPrev = index > 0
  const hasNext = index < playlist.length - 1

  // Clear a prior error / end overlay when the selection changes.
  useEffect(() => {
    setErrored(false)
    setEnded(false)
  }, [video.id])

  // The session timer counts only while a video is actually playing — so freeze
  // it whenever the player view goes away (back to browsing).
  useEffect(() => () => setWatching(false), [setWatching])

  // Error codes 101 & 150 = embedding disabled by owner; 100 = removed/private; 2 = bad id.
  const onYouTubeError = (code: number) => {
    if ([101, 150, 100, 2].includes(code)) {
      dispatch({ type: 'setVideoEmbeddable', videoId: video.id, embeddable: false })
    }
    setErrored(true)
  }

  // When a video ends: blacklisted collections use their one-per-session allowance;
  // otherwise auto-advance to the next video.
  const handleEnded = () => {
    setEnded(true)
    if (blacklisted) onBlacklistFinished()
    else if (hasNext) onSelect(index + 1)
  }

  return (
    <div className="kid kid-player">
      <FloatingControls onBack={onBack} />
      <header className="kid-header player-header">
        <span className="header-side" />
        <HeaderLogo onHome={onHome} />
        <span className="header-side" />
      </header>

      <div className="player-main">
        <div className="player-left">
          <div className="player-stage">
            {errored ? (
              <div className="kid-empty">
                <p className="big">Oops — this video can’t play here. 😕</p>
                <p>Pick another one from the list!</p>
              </div>
            ) : video.source === 'vk' ? (
              <VKPlayer
                key={`${video.id}-${replay}`}
                vkId={video.id}
                sessionPause={sessionPause}
                onWatchingChange={setWatching}
                onEnded={handleEnded}
                onError={() => setErrored(true)}
              />
            ) : (
              <YouTubePlayer
                key={`${video.id}-${replay}`}
                videoId={video.id}
                sessionPause={sessionPause}
                onWatchingChange={setWatching}
                onEnded={handleEnded}
                onError={onYouTubeError}
                onForeignVideo={onBack}
              />
            )}
            {/* Covers the embed's end-screen suggestions so they can't be clicked. */}
            {ended && !errored && (
              <div className="player-overlay">
                <p className="big">All done! 🎉</p>
                <div className="player-overlay-actions">
                  <button className="big-btn" onClick={() => { setEnded(false); setReplay((n) => n + 1) }}>↻ Watch again</button>
                  {hasNext && <button className="big-btn" onClick={() => onSelect(index + 1)}>Next ▶</button>}
                  <button className="big-btn" onClick={onBack}>Pick another</button>
                </div>
              </div>
            )}
          </div>

          <footer className="player-nav">
            <button className="big-btn" disabled={!hasPrev} onClick={() => onSelect(index - 1)}>◀ Previous</button>
            <button className="big-btn" disabled={!hasNext} onClick={() => onSelect(index + 1)}>Next ▶</button>
          </footer>
        </div>

        {/* Recommendations are hidden for blacklisted collections. */}
        {!blacklisted && (
          <aside className="player-playlist">
            <h2 className="playlist-title">{title}</h2>
            <ul className="playlist-list">
              {playlist.map((v, i) => (
                <li key={v.id}>
                  <button
                    className={`playlist-item${i === index ? ' current' : ''}`}
                    onClick={() => onSelect(i)}
                    aria-current={i === index}
                  >
                    <span className="thumb-wrap">
                      <img src={v.thumbnailUrl} alt="" className="playlist-thumb" />
                    </span>
                    <span className="playlist-name">{videoName(v)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}
