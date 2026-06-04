import { useEffect, useState } from 'react'
import YouTube, { type YouTubeProps } from 'react-youtube'
import { useAppData } from '../../state/useAppData'
import { type Video, videoName } from '../../types'

/**
 * Embedded player in a YouTube-style layout: the video on the left, the current
 * sub-list as a column on the right. Uses the official YouTube IFrame player
 * with its native controls.
 *
 * NOTE: ads can still appear and cannot be removed from the embedded player.
 */
export function PlayerView({
  playlist,
  index,
  title,
  onSelect,
  onBack,
}: {
  playlist: Video[]
  index: number
  title: string
  onSelect: (index: number) => void
  onBack: () => void
}) {
  const { dispatch } = useAppData()
  const [errored, setErrored] = useState(false)

  const video = playlist[index]
  const hasPrev = index > 0
  const hasNext = index < playlist.length - 1

  // Clear a prior error when the selection changes.
  useEffect(() => setErrored(false), [video.id])

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

  // Error codes 101 & 150 = embedding disabled by owner; 100 = removed/private; 2 = bad id.
  const onError: YouTubeProps['onError'] = (e) => {
    if ([101, 150, 100, 2].includes(Number(e.data))) {
      dispatch({ type: 'setVideoEmbeddable', videoId: video.id, embeddable: false })
    }
    setErrored(true)
  }

  return (
    <div className="kid kid-player">
      <header className="kid-header player-header">
        <button className="back-btn" onClick={onBack} aria-label="Back to list">◀ Back</button>
        <h1 className="player-title">{videoName(video)}</h1>
        <span />
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
                onError={onError}
                onEnd={() => {
                  if (hasNext) onSelect(index + 1)
                }}
              />
            )}
          </div>

          <footer className="player-nav">
            <button className="big-btn" disabled={!hasPrev} onClick={() => onSelect(index - 1)}>◀ Previous</button>
            <button className="big-btn" disabled={!hasNext} onClick={() => onSelect(index + 1)}>Next ▶</button>
          </footer>
        </div>

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
      </div>
    </div>
  )
}
