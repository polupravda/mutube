import { type Video, videoName } from '../../types'
import { FloatingControls } from './FloatingControls'

/** Grid of the videos in one sub-list (season/topic). */
export function VideoGrid({
  title,
  videos,
  onPick,
  onBack,
}: {
  title: string
  videos: Video[]
  onPick: (index: number) => void
  onBack: () => void
}) {
  return (
    <div className="kid kid-videos">
      <FloatingControls onBack={onBack} />
      <header className="kid-header">
        <span />
        <h1 className="logo">{title}</h1>
        <span />
      </header>

      <div className="card-grid">
        {videos.map((v, i) => (
          <button key={v.id} className="big-card video-tile" onClick={() => onPick(i)}>
            <span className="thumb-wrap">
              <img src={v.thumbnailUrl} alt="" className="thumb" />
            </span>
            <span className="tile-name">{videoName(v)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
