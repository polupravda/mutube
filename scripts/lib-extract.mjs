// Shared extraction for both saved-YouTube-page layouts:
//  - side-panel playlist: per-video `/watch?v=ID&...` links
//  - anonymous playlist  : a single `watch_videos?video_ids=ID%2CID%2C...` list
// Returns ids in playlist (document) order, deduped, plus an id->title map
// (titles come from `id="video-title" ... title="..."` spans, paired by order).

export function extractEntries(html) {
  const ids = []
  const seen = new Set()
  const add = (id) => {
    if (/^[\w-]{11}$/.test(id) && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  const lists = [...html.matchAll(/video_ids=([^"&]+)/g)]
  if (lists.length) {
    // Anonymous-playlist layout: ids live in %2C-separated lists.
    for (const m of lists) {
      for (const id of decodeURIComponent(m[1]).split(',')) add(id)
    }
  } else {
    // Side-panel layout: value between "/watch?v=" and the next "&".
    for (const m of html.matchAll(/\/watch\?v=([^&]+)&/g)) add(m[1])
  }

  const titles = []
  const tseen = new Set()
  for (const m of html.matchAll(/id="video-title"[\s\S]*?title="([^"]*)"/g)) {
    if (!tseen.has(m[1])) {
      tseen.add(m[1])
      titles.push(m[1])
    }
  }
  const titleOf = new Map(ids.map((id, i) => [id, titles[i] ?? id]))

  return { ids, titleOf }
}
