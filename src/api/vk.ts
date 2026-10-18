// VK Video support (embed-only). VK has no keyless oEmbed, so titles/thumbnails
// are supplied manually; playback uses VK's iframe + JS player API.

/** Extract a VK id "<oid>_<id>" (e.g. "-224594873_456239622") from a URL or raw id. */
export function parseVkId(input: string): string | null {
  const t = input.trim()
  const m = t.match(/video(-?\d+_\d+)/) || t.match(/^(-?\d+_\d+)$/)
  return m ? m[1] : null
}

/** Build the VK iframe embed URL. js_api=1 enables the JS player API. */
export function vkEmbedUrl(vkId: string, autoplay = true): string {
  const [oid, id] = vkId.split('_')
  const p = new URLSearchParams({ oid, id, hd: '2', js_api: '1' })
  if (autoplay) p.set('autoplay', '1')
  return `https://vkvideo.ru/video_ext.php?${p.toString()}`
}

/** Neutral placeholder thumbnail for VK videos (no keyless thumbnail available). */
export const VK_THUMB =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">' +
      '<rect width="320" height="180" fill="#4D48EB"/>' +
      '<text x="160" y="104" font-family="sans-serif" font-size="30" font-weight="bold" fill="#fff" text-anchor="middle">VK &#9654;</text>' +
      '</svg>',
  )

let vkScript: Promise<void> | null = null
/** Load VK's video player JS API once. */
export function loadVkApi(): Promise<void> {
  const w = window as unknown as { VK?: { VideoPlayer?: unknown } }
  if (w.VK?.VideoPlayer) return Promise.resolve()
  if (vkScript) return vkScript
  vkScript = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://vk.com/js/api/videoplayer.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('VK player API failed to load'))
    document.head.appendChild(s)
  })
  return vkScript
}
