import type { Video } from '../types'

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

export class YouTubeApiError extends Error {}

/**
 * Extract an 11-char YouTube video ID from a pasted URL or a raw ID.
 * Handles watch?v=, youtu.be/, /shorts/, /embed/, /live/ and bare IDs.
 */
export function parseVideoId(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  // Bare 11-char ID.
  if (/^[\w-]{11}$/.test(text)) return text

  try {
    const url = new URL(text)
    // youtu.be/<id>
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1, 12)
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    // youtube.com/watch?v=<id>
    const v = url.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
    // /shorts/<id>, /embed/<id>, /live/<id>
    const m = url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)
    if (m) return m[1]
  } catch {
    // Not a URL — fall through.
  }
  return null
}

/** Convert an ISO 8601 duration ("PT1H2M3S") to total seconds. */
export function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const [, h, min, s] = m
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0)
}

type YtListResponse = {
  items?: Array<{
    id: string
    snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url: string }> }
    contentDetails?: { duration?: string }
    status?: { embeddable?: boolean }
  }>
}

function pickThumbnail(thumbnails: Record<string, { url: string }> = {}): string {
  return (
    thumbnails.medium?.url ??
    thumbnails.high?.url ??
    thumbnails.standard?.url ??
    thumbnails.default?.url ??
    ''
  )
}

/** Look up a single video's metadata. Costs 1 YouTube Data API quota unit. */
export async function fetchVideoMetadata(id: string): Promise<Video> {
  if (!API_KEY) {
    throw new YouTubeApiError(
      'No YouTube API key configured. Add VITE_YOUTUBE_API_KEY to your .env file.',
    )
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,contentDetails,status')
  url.searchParams.set('id', id)
  url.searchParams.set('key', API_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const reason = body?.error?.message ?? `HTTP ${res.status}`
    throw new YouTubeApiError(`YouTube API request failed: ${reason}`)
  }

  const data = (await res.json()) as YtListResponse
  const item = data.items?.[0]
  if (!item) {
    throw new YouTubeApiError('Video not found, or it is private/deleted.')
  }

  return {
    id: item.id,
    title: item.snippet?.title ?? '(untitled)',
    channelTitle: item.snippet?.channelTitle ?? '',
    thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
    durationSeconds: parseISODuration(item.contentDetails?.duration ?? ''),
    embeddable: item.status?.embeddable ?? true,
    addedAt: new Date().toISOString(),
  }
}

export function hasApiKey(): boolean {
  return Boolean(API_KEY)
}

/** Pretty-print seconds as M:SS or H:MM:SS for the UI. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}
