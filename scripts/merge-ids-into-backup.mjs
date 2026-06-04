#!/usr/bin/env node
// One-off: extract video IDs (+titles) from run-regex.html and merge them into a
// Mutube backup JSON — adding video records, the home order, and the named
// collection. Dedupes so re-running is safe.
//
// With --replace, the library content (videos, videoOrder, and the named
// collection's videoIds) is cleared first and rebuilt from the extracted IDs.
// The collection itself (name/id/emoji/cover) and `settings` are preserved.
//
// Usage: node scripts/merge-ids-into-backup.mjs <backup.json> [collectionName] [--replace]

import { readFile, writeFile } from 'node:fs/promises'
import { extractEntries } from './lib-extract.mjs'

const args = process.argv.slice(2)
const replace = args.includes('--replace')
const positional = args.filter((a) => !a.startsWith('--'))
const backupPath = positional[0]
const collectionName = positional[1] ?? 'Super Why'
if (!backupPath) {
  console.error('Usage: node scripts/merge-ids-into-backup.mjs <backup.json> [collectionName] [--replace]')
  process.exit(1)
}

const html = await readFile('run-regex.html', 'utf8')

// IDs in playlist order (deduped) and the aligned video-title titles.
const { ids, titleOf } = extractEntries(html)

const data = JSON.parse(await readFile(backupPath, 'utf8'))
data.videos ??= {}
data.videoOrder ??= []
data.collections ??= []

if (replace) {
  // Clear library content; keep the collection shell (name/id/...) and settings.
  data.videos = {}
  data.videoOrder = []
  const keep = data.collections.find((c) => c.name === collectionName)
  if (keep) keep.videoIds = []
}

const now = new Date().toISOString()
let videosAdded = 0

for (const id of ids) {
  if (!data.videos[id]) {
    const title = titleOf.get(id)
    data.videos[id] = {
      id,
      title,
      channelTitle: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      durationSeconds: 0, // unknown from the HTML; left 0 rather than guessed
      embeddable: true,
      addedAt: now,
      alias: title,
    }
    videosAdded++
  }
}

// Append any new IDs to the home order (existing order preserved).
const orderSet = new Set(data.videoOrder)
let orderAdded = 0
for (const id of ids) {
  if (!orderSet.has(id)) {
    data.videoOrder.push(id)
    orderSet.add(id)
    orderAdded++
  }
}

// Add all IDs to the named collection (create it if missing).
let collection = data.collections.find((c) => c.name === collectionName)
if (!collection) {
  collection = { id: crypto.randomUUID(), name: collectionName, videoIds: [] }
  data.collections.push(collection)
}
const colSet = new Set(collection.videoIds)
let colAdded = 0
for (const id of ids) {
  if (!colSet.has(id)) {
    collection.videoIds.push(id)
    colSet.add(id)
    colAdded++
  }
}

// Integrity guard: every order/collection id must have a video record.
const known = new Set(Object.keys(data.videos))
const dangling = new Set()
for (const id of data.videoOrder) if (!known.has(id)) dangling.add(id)
for (const c of data.collections) for (const id of c.videoIds) if (!known.has(id)) dangling.add(id)
if (dangling.size) {
  console.error(`\n⚠ ${dangling.size} id(s) referenced without a video record:`, [...dangling].join(', '))
  process.exitCode = 1
}

await writeFile(backupPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log(
  `Extracted ${ids.length} unique IDs.\n` +
    `+${videosAdded} new video records (${Object.keys(data.videos).length} total)\n` +
    `+${orderAdded} to videoOrder (${data.videoOrder.length} total)\n` +
    `+${colAdded} to "${collectionName}" (${collection.videoIds.length} total)`,
)
