/**
 * Minimal controller for a plain youtube-nocookie.com embed iframe, speaking the
 * (undocumented) postMessage protocol the official IFrame API uses — so nothing
 * is ever loaded from youtube.com. Message shapes are parsed defensively.
 */

export const YT_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

/** Player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export const YtState = { Unstarted: -1, Ended: 0, Playing: 1, Paused: 2, Buffering: 3, Cued: 5 } as const

export function ytEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    autoplay: '1',
    rel: '0', // limit "related" to the same channel
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3', // hide annotations
    origin: window.location.origin,
  })
  return `${YT_EMBED_ORIGIN}/embed/${encodeURIComponent(videoId)}?${params}`
}

export type YtEmbedHandlers = {
  onReady?: () => void
  onStateChange?: (state: number) => void
  /** The video the iframe reports it's showing (may differ from the requested one). */
  onVideoId?: (videoId: string) => void
  onError?: (code: number) => void
}

export type YtCommand = 'playVideo' | 'pauseVideo' | 'stopVideo' | 'loadVideoById'

let nextId = 1

export function connectYtEmbed(iframe: HTMLIFrameElement, h: YtEmbedHandlers) {
  const id = nextId++
  let ready = false
  let lastState: number | undefined
  let lastVideoId: string | undefined

  const post = (msg: object) =>
    iframe.contentWindow?.postMessage(JSON.stringify({ ...msg, id, channel: 'widget' }), YT_EMBED_ORIGIN)
  const command = (func: YtCommand | 'addEventListener', args: unknown[] = []) =>
    post({ event: 'command', func, args })

  const setState = (s: unknown) => {
    if (typeof s !== 'number' || s === lastState) return
    lastState = s
    h.onStateChange?.(s)
  }
  const setVideoId = (v: unknown) => {
    if (typeof v !== 'string' || !v || v === lastVideoId) return
    lastVideoId = v
    h.onVideoId?.(v)
  }

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== YT_EMBED_ORIGIN || e.source !== iframe.contentWindow) return
    let data: any // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    } catch {
      return
    }
    if (!data || typeof data !== 'object') return
    const info = data.info
    switch (data.event) {
      case 'onReady':
        if (ready) break
        ready = true
        clearInterval(handshake)
        // Event subscriptions, as the official API sends them after onReady.
        command('addEventListener', ['onStateChange'])
        command('addEventListener', ['onError'])
        h.onReady?.()
        break
      case 'onStateChange':
        setState(typeof info === 'number' ? info : info?.playerState)
        break
      case 'onError':
        h.onError?.(Number(typeof info === 'object' ? info?.errorCode : info))
        break
      case 'initialDelivery':
      case 'infoDelivery':
        if (info && typeof info === 'object') {
          setVideoId(info.videoData?.video_id)
          setState(info.playerState)
        }
        break
    }
  }

  // Handshake: "listening" tells the player to start sending events. Messages
  // posted before the embed has loaded are dropped (origin mismatch), so retry
  // until onReady arrives, and also fire on each load.
  const listen = () => post({ event: 'listening' })
  const handshake = setInterval(listen, 250)
  iframe.addEventListener('load', listen)
  window.addEventListener('message', onMessage)

  return {
    command,
    isReady: () => ready,
    destroy() {
      clearInterval(handshake)
      iframe.removeEventListener('load', listen)
      window.removeEventListener('message', onMessage)
    },
  }
}

export type YtEmbed = ReturnType<typeof connectYtEmbed>
