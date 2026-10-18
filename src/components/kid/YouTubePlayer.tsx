import { useEffect, useRef } from 'react'
import { connectYtEmbed, type YtEmbed, YtState, ytEmbedUrl } from '../../api/ytEmbed'

/**
 * YouTube player: a plain youtube-nocookie.com iframe driven over postMessage
 * (see api/ytEmbed.ts) — no IFrame API script from youtube.com, so it keeps
 * working when youtube.com is blocked at the router.
 *
 * Whitelist enforcement inside the iframe: the embed can play other videos
 * (end-screen / pause-screen suggestions) without ever touching youtube.com, so
 * if it reports any video other than the one requested, we stop it and call
 * `onForeignVideo`. On end we stop it too; PlayerView covers the stage with its
 * own end overlay so YouTube's suggestion grid is never clickable.
 */
export function YouTubePlayer({
  videoId,
  sessionPause,
  onWatchingChange,
  onEnded,
  onError,
  onForeignVideo,
}: {
  videoId: string
  sessionPause: boolean
  onWatchingChange: (on: boolean) => void
  onEnded: () => void
  onError: (code: number) => void
  onForeignVideo: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YtEmbed | null>(null)
  // Keep latest callbacks/props in refs so the init effect needn't re-run on each render.
  const cb = useRef({ onWatchingChange, onEnded, onError, onForeignVideo, sessionPause })
  cb.current = { onWatchingChange, onEnded, onError, onForeignVideo, sessionPause }

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    let currentId: string | undefined
    let done = false

    const foreign = () => {
      if (done) return
      done = true
      p.command('stopVideo')
      cb.current.onWatchingChange(false)
      cb.current.onForeignVideo()
    }

    const p = connectYtEmbed(iframe, {
      onReady: () => {
        if (cb.current.sessionPause) p.command('pauseVideo')
      },
      onVideoId: (id) => {
        currentId = id
        if (id !== videoId) foreign()
      },
      onStateChange: (state) => {
        if (done) return
        // 1 = playing -> timer runs; anything else (paused/buffering/ended) -> frozen.
        cb.current.onWatchingChange(state === YtState.Playing)
        if (state === YtState.Playing && currentId && currentId !== videoId) foreign()
        if (state === YtState.Ended) {
          p.command('stopVideo')
          cb.current.onEnded()
        }
      },
      onError: (code) => cb.current.onError(code),
    })
    playerRef.current = p
    return () => {
      p.destroy()
      playerRef.current = null
      cb.current.onWatchingChange(false)
    }
  }, [videoId])

  // Mirror the session's force-pause (5-min warning / session over); resume after.
  useEffect(() => {
    const p = playerRef.current
    if (!p?.isReady()) return
    p.command(sessionPause ? 'pauseVideo' : 'playVideo')
  }, [sessionPause])

  return (
    <iframe
      ref={iframeRef}
      key={videoId}
      className="yt-iframe"
      src={ytEmbedUrl(videoId)}
      title="Video player"
      frameBorder={0}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}
