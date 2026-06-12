import { type Video, videoName } from '../../types'
import { FloatingControls } from './FloatingControls'
import { HeaderLogo } from './HeaderLogo'

/** Grid of the videos in one sub-list (season/topic). */
export function VideoGrid({
  title,
  videos,
  onPick,
  onBack,
  onHome,
}: {
  title: string
  videos: Video[]
  onPick: (index: number) => void
  onBack: () => void
  onHome: () => void
}) {
  return (
    <div className="kid kid-videos">
      <FloatingControls onBack={onBack} />
      <header className="kid-header">
        <span className="header-side" />
        <HeaderLogo onHome={onHome} />
        <span className="header-side" />
      </header>

      <h2 className="section-title">{title}</h2>
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
