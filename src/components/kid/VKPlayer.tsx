import { useEffect, useRef } from 'react'
import { loadVkApi, vkEmbedUrl } from '../../api/vk'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * VK Video player. Uses VK's iframe embed plus its JS player API so the session
 * timer (counts only while playing), auto-advance, and blacklist-on-finish work
 * the same as for YouTube. If the VK API can't load, the video still plays — the
 * timer just can't track it (graceful degradation).
 */
export function VKPlayer({
  vkId,
  sessionPause,
  onWatchingChange,
  onEnded,
  onError,
}: {
  vkId: string
  sessionPause: boolean
  onWatchingChange: (on: boolean) => void
  onEnded: () => void
  onError: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<any>(null)
  // Keep latest callbacks in refs so the init effect needn't re-run on each render.
  const cb = useRef({ onWatchingChange, onEnded, onError })
  cb.current = { onWatchingChange, onEnded, onError }

  useEffect(() => {
    let cancelled = false
    playerRef.current = null
    loadVkApi()
      .then(() => {
        if (cancelled || !iframeRef.current) return
        const VK = (window as any).VK
        try {
          const p = VK.VideoPlayer(iframeRef.current)
          playerRef.current = p
          const E = VK.VideoPlayer.Events
          // VK autoplays muted; unmute once it's ready / playing (a recent user
          // click opened this view, so the autoplay policy should allow it).
          const unmute = () => { try { p.unmute(); p.setVolume(100) } catch { /* ignore */ } }
          const playing = () => { cb.current.onWatchingChange(true); unmute() }
          p.on(E.INITED, unmute)
          p.on(E.STARTED, playing)
          p.on(E.RESUMED, playing)
          p.on(E.PLAYING, playing)
          p.on(E.PAUSED, () => cb.current.onWatchingChange(false))
          p.on(E.ENDED, () => { cb.current.onWatchingChange(false); cb.current.onEnded() })
          p.on(E.ERROR, () => cb.current.onError())
        } catch {
          cb.current.onError()
        }
      })
      .catch(() => cb.current.onError())
    return () => {
      cancelled = true
      cb.current.onWatchingChange(false)
      playerRef.current = null
    }
  }, [vkId])

  // Mirror the session's force-pause (5-min warning / session over).
  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    try {
      if (sessionPause) p.pause()
      else p.play()
    } catch {
      /* ignore */
    }
  }, [sessionPause])

  return (
    <iframe
      ref={iframeRef}
      key={vkId}
      className="yt-iframe"
      src={vkEmbedUrl(vkId)}
      title="VK video"
      frameBorder={0}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
      allowFullScreen
    />
  )
}
