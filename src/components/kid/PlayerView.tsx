import { useEffect, useRef, useState } from 'react'
import YouTube, { type YouTubeProps, type YouTubePlayer } from 'react-youtube'
import { useAppData } from '../../state/useAppData'
import { useSession } from '../../state/useSession'
import { type Video, videoName } from '../../types'
import { HeaderLogo } from './HeaderLogo'
import { FloatingControls } from './FloatingControls'

/**
 * Embedded player in a YouTube-style layout: the video on the left, the current
 * sub-list as a column on the right. Uses the official YouTube IFrame player
 * with its native controls.
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
  const playerRef = useRef<YouTubePlayer | null>(null)

  const video = playlist[index]
  const hasPrev = index > 0
  const hasNext = index < playlist.length - 1

  // Clear a prior error when the selection changes.
  useEffect(() => setErrored(false), [video.id])

  // The session timer counts only while a video is actually playing — so freeze
  // it whenever the player view goes away (back to browsing).
  useEffect(() => () => setWatching(false), [setWatching])

  // Pause during the session warning popup / when the session is over; resume after.
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (sessionPause) player.pauseVideo()
    else player.playVideo()
  }, [sessionPause])

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      rel: 0, // limit "related" to the same channel
      modestbranding: 1,
      playsinline: 1,
      iv_load_policy: 3, // hide annotations
    },
  }

  const onReady: YouTubeProps['onReady'] = (e) => {
    playerRef.current = e.target
  }

  // 1 = playing -> timer runs; anything else (paused/buffering/ended) -> frozen.
  const onStateChange: YouTubeProps['onStateChange'] = (e) => {
    setWatching(e.data === 1)
  }

  // Error codes 101 & 150 = embedding disabled by owner; 100 = removed/private; 2 = bad id.
  const onError: YouTubeProps['onError'] = (e) => {
    if ([101, 150, 100, 2].includes(Number(e.data))) {
      dispatch({ type: 'setVideoEmbeddable', videoId: video.id, embeddable: false })
    }
    setErrored(true)
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
            ) : (
              <YouTube
                key={video.id}
                videoId={video.id}
                opts={opts}
                className="yt"
                iframeClassName="yt-iframe"
                onReady={onReady}
                onStateChange={onStateChange}
                onError={onError}
                onEnd={() => {
                  // Blacklisted: this used the session's one allowed video.
                  if (blacklisted) onBlacklistFinished()
                  else if (hasNext) onSelect(index + 1)
                }}
              />
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
