// Shared extraction for the saved-YouTube-page layouts we've seen:
//  - "lockup" list   : <a class="ytLockupMetadataViewModelTitle" href="/watch?v=ID"
//                        aria-label="<title> <duration>"> (newer playlist/related)
//  - side-panel list : per-video `/watch?v=ID&...` links + `id="video-title"` spans
//  - anonymous list  : a single `watch_videos?video_ids=ID%2CID%2C...`
// Returns ids in document order, deduped, plus an id->title map (falls back to
// the id when a title isn't available).

function stripDuration(s) {
  // Trailing "… 32 minutes" / "… 1 hour, 10 minutes" / "… 45 seconds".
  return s.replace(/\s+\d+\s+(hours?|minutes?|seconds?)(,\s*\d+\s+(minutes?|seconds?))?\s*$/i, '').trim()
}

export function extractEntries(html) {
  const ids = []
  const seen = new Set()
  const titleOf = new Map()
  const add = (id, title) => {
    if (!/^[\w-]{11}$/.test(id) || seen.has(id)) return
    seen.add(id)
    ids.push(id)
    if (title) titleOf.set(id, title)
  }

  // 1) Lockup layout: each title anchor carries the id (href) and the title
  //    (aria-label, with a trailing duration to strip).
  const lockup = [...html.matchAll(/<a\b[^>]*ytLockupMetadataViewModelTitle[^>]*>/g)]
  if (lockup.length) {
    for (const m of lockup) {
      const id = m[0].match(/\/watch\?v=([\w-]{11})/)?.[1]
      const label = m[0].match(/aria-label="([^"]*)"/)?.[1]
      if (id) add(id, label ? stripDuration(label) : undefined)
    }
  } else if (/video_ids=/.test(html)) {
    // 2) Anonymous-playlist layout: ids live in %2C-separated lists.
    for (const m of html.matchAll(/video_ids=([^"&]+)/g)) {
      for (const id of decodeURIComponent(m[1]).split(',')) add(id)
    }
  } else {
    // 3) Side-panel layout: value between "/watch?v=" and the next "&".
    for (const m of html.matchAll(/\/watch\?v=([^&]+)&/g)) add(m[1])
  }

  // Layouts 2 & 3 carry titles in separate `id="video-title"` spans, paired by order.
  if (titleOf.size === 0) {
    const titles = []
    const tseen = new Set()
    for (const m of html.matchAll(/id="video-title"[\s\S]*?title="([^"]*)"/g)) {
      if (!tseen.has(m[1])) {
        tseen.add(m[1])
        titles.push(m[1])
      }
    }
    ids.forEach((id, i) => titleOf.set(id, titles[i] ?? id))
  }

  return { ids, titleOf: new Map(ids.map((id) => [id, titleOf.get(id) ?? id])) }
}
