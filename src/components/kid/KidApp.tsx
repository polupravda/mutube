import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { HomeView } from './HomeView'
import { VideoGrid } from './VideoGrid'
import { PlayerView } from './PlayerView'
import type { Video } from '../../types'

/** An active playback session: the playlist shown in the player's sidebar. */
type PlayContext = { videos: Video[]; index: number; title: string }
/** Which sub-list grid is open. subId === null means the whole collection. */
type Picked = { collectionId: string; subId: string | null }

/**
 * Kid-facing navigation: home (collections, with their sub-lists shown inline)
 * -> sub-list video grid -> player. No text input that escapes to YouTube. The
 * only escape is a small parent button that drops into the PIN-gated area.
 */
export function KidApp({ onExitToParent }: { onExitToParent: () => void }) {
  const { data } = useAppData()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [play, setPlay] = useState<PlayContext | null>(null)

  const videoById = (id: string) => data.videos[id]
  const playable = (ids: string[]) =>
    ids.map(videoById).filter((v): v is Video => Boolean(v?.embeddable))

  // Resolve the picked sub-list to its videos + a display title.
  let pickedView: { title: string; videos: Video[] } | null = null
  if (picked) {
    const collection = data.collections.find((c) => c.id === picked.collectionId)
    if (collection) {
      const sub = picked.subId
        ? collection.subCollections?.find((s) => s.id === picked.subId)
        : undefined
      const ids = sub ? sub.videoIds : collection.videoIds
      const title = sub ? `${collection.name} · ${sub.name}` : collection.name
      pickedView = { title, videos: playable(ids) }
    }
  }

  // Player view.
  if (play && play.videos[play.index]) {
    return (
      <PlayerView
        playlist={play.videos}
        index={play.index}
        title={play.title}
        onSelect={(i) => setPlay((p) => (p ? { ...p, index: i } : p))}
        onBack={() => setPlay(null)}
      />
    )
  }

  // Video grid for a chosen sub-list.
  if (pickedView) {
    return (
      <VideoGrid
        title={pickedView.title}
        videos={pickedView.videos}
        onPick={(i) => setPlay({ videos: pickedView!.videos, index: i, title: pickedView!.title })}
        onBack={() => setPicked(null)}
      />
    )
  }

  // Home: collections with their sub-lists inline.
  return (
    <HomeView
      collections={data.collections}
      videoById={videoById}
      onPickSub={(collectionId, subId) => setPicked({ collectionId, subId })}
      onExitToParent={onExitToParent}
    />
  )
}
