import { useMemo, useRef, useState } from 'react'
import { useAppData } from '../../state/useAppData'
import { useSession } from '../../state/useSession'
import { StartPage, type FeedItem } from './StartPage'
import { HomeView } from './HomeView'
import { VideoGrid } from './VideoGrid'
import { PlayerView } from './PlayerView'
import { SessionOverScreen } from './SessionOverlays'
import type { AppData, Video } from '../../types'

/** An active playback session: the playlist shown in the player's sidebar. */
type PlayContext = { videos: Video[]; index: number; title: string; blacklisted: boolean }
/** Which sub-list grid is open. subId === null means the whole collection. */
type Picked = { collectionId: string; subId: string | null }

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Build the start-page feed: one shuffled queue per (non-blacklisted) collection,
 * then greedily interleave so no two adjacent cards come from the same collection.
 * Each card carries its own list (sub-list, or the whole collection) for the
 * player sidebar.
 */
function buildFeed(data: AppData, blacklist: string[], cap = 120): FeedItem[] {
  const emb = (ids: string[]) => ids.filter((id) => data.videos[id]?.embeddable)
  const pools: { collectionId: string; queue: FeedItem[] }[] = []
  for (const c of data.collections) {
    if (blacklist.includes(c.id)) continue
    const lists = c.subCollections?.length
      ? c.subCollections.map((s) => ({ title: `${c.name} · ${s.name}`, ids: emb(s.videoIds) }))
      : [{ title: c.name, ids: emb(c.videoIds) }]
    const entries: FeedItem[] = []
    for (const l of lists) {
      if (!l.ids.length) continue
      for (const id of l.ids) {
        entries.push({ video: data.videos[id], collectionId: c.id, collectionName: c.name, listTitle: l.title, listVideoIds: l.ids })
      }
    }
    if (entries.length) pools.push({ collectionId: c.id, queue: shuffle(entries) })
  }
  const feed: FeedItem[] = []
  let prev: string | null = null
  while (feed.length < cap) {
    const nonEmpty = pools.filter((p) => p.queue.length)
    if (!nonEmpty.length) break
    const avail = nonEmpty.filter((p) => p.collectionId !== prev)
    const src = avail.length ? avail : nonEmpty
    const p = src[Math.floor(Math.random() * src.length)]
    feed.push(p.queue.pop()!)
    prev = p.collectionId
  }
  return feed
}

/**
 * Kid-facing navigation: a YouTube-style start page (suggested feed) by default,
 * a browsable Collections view, the sub-list video grid, and the player. No text
 * input that escapes to YouTube; the only escape is the PIN-gated parent area.
 */
export function KidApp({ onExitToParent }: { onExitToParent: () => void }) {
  const { data } = useAppData()
  const { blacklistUsed, markBlacklistUsed } = useSession()
  const [view, setView] = useState<'start' | 'collections'>('start')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [play, setPlay] = useState<PlayContext | null>(null)
  const homeScroll = useRef(0)
  const startScroll = useRef(0)

  const blacklist = data.blacklist ?? []
  const videoById = (id: string) => data.videos[id]
  const playable = (ids: string[]) =>
    ids.map(videoById).filter((v): v is Video => Boolean(v?.embeddable))

  // Feed rebuilt only when the library or blacklist changes (stable within a session).
  const feed = useMemo(() => buildFeed(data, blacklist), [data, blacklist])

  const goHome = () => {
    setPlay(null)
    setPicked(null)
    setView('start')
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

  const playFeedItem = (f: FeedItem) => {
    const videos = f.listVideoIds.map(videoById).filter((v): v is Video => Boolean(v))
    const index = Math.max(0, f.listVideoIds.indexOf(f.video.id))
    setPlay({ videos, index, title: f.listTitle, blacklisted: blacklist.includes(f.collectionId) })
  }

  return (
    <>
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
      ) : view === 'collections' ? (
        <HomeView
          collections={data.collections}
          videoById={videoById}
          blacklist={blacklist}
          blacklistLocked={blacklistUsed}
          scrollRef={homeScroll}
          onStart={() => setView('start')}
          onPickSub={(collectionId, subId) => setPicked({ collectionId, subId })}
          onExitToParent={onExitToParent}
        />
      ) : (
        <StartPage
          feed={feed}
          scrollRef={startScroll}
          onPickVideo={playFeedItem}
          onBrowse={() => setView('collections')}
          onExitToParent={onExitToParent}
        />
      )}

      <SessionOverScreen onExit={goHome} />
    </>
  )
}
