import { useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { useSession } from '../../state/useSession'
import { HomeView } from './HomeView'
import { VideoGrid } from './VideoGrid'
import { PlayerView } from './PlayerView'
import { SessionOverScreen } from './SessionOverlays'
import type { Video } from '../../types'

/** An active playback session: the playlist shown in the player's sidebar. */
type PlayContext = { videos: Video[]; index: number; title: string; blacklisted: boolean }
/** Which sub-list grid is open. subId === null means the whole collection. */
type Picked = { collectionId: string; subId: string | null }

/**
 * Kid-facing navigation: home (collections, with their sub-lists shown inline)
 * -> sub-list video grid -> player. No text input that escapes to YouTube. The
 * only escape is a small parent button that drops into the PIN-gated area.
 */
export function KidApp({ onExitToParent }: { onExitToParent: () => void }) {
  const { data } = useAppData()
  const { blacklistUsed, markBlacklistUsed } = useSession()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [play, setPlay] = useState<PlayContext | null>(null)

  const blacklist = data.blacklist ?? []
  const videoById = (id: string) => data.videos[id]
  const playable = (ids: string[]) =>
    ids.map(videoById).filter((v): v is Video => Boolean(v?.embeddable))

  const goHome = () => {
    setPlay(null)
    setPicked(null)
  }

  // Resolve the picked sub-list to its videos + a display title.
  let pickedView: { title: string; videos: Video[]; blacklisted: boolean } | null = null
  if (picked) {
    const collection = data.collections.find((c) => c.id === picked.collectionId)
    if (collection) {
      const sub = picked.subId
        ? collection.subCollections?.find((s) => s.id === picked.subId)
        : undefined
      const ids = sub ? sub.videoIds : collection.videoIds
      const title = sub ? `${collection.name} · ${sub.name}` : collection.name
      pickedView = { title, videos: playable(ids), blacklisted: blacklist.includes(collection.id) }
    }
  }

  return (
    <>
      {/* Player view. */}
      {play && play.videos[play.index] ? (
        <PlayerView
          playlist={play.videos}
          index={play.index}
          title={play.title}
          blacklisted={play.blacklisted}
          onSelect={(i) => setPlay((p) => (p ? { ...p, index: i } : p))}
          onBlacklistFinished={() => { markBlacklistUsed(); goHome() }}
          onBack={() => setPlay(null)}
          onHome={goHome}
        />
      ) : pickedView ? (
        // Video grid for a chosen sub-list.
        <VideoGrid
          title={pickedView.title}
          videos={pickedView.videos}
          onPick={(i) =>
            setPlay({
              videos: pickedView!.videos,
              index: i,
              title: pickedView!.title,
              blacklisted: pickedView!.blacklisted,
            })
          }
          onBack={() => setPicked(null)}
          onHome={goHome}
        />
      ) : (
        // Home: collections with their sub-lists inline.
        <HomeView
          collections={data.collections}
          videoById={videoById}
          blacklist={blacklist}
          blacklistLocked={blacklistUsed}
          onPickSub={(collectionId, subId) => setPicked({ collectionId, subId })}
          onExitToParent={onExitToParent}
        />
      )}

      <SessionOverScreen onExit={goHome} />
    </>
  )
}
