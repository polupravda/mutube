#!/usr/bin/env node
// Extract video IDs (+titles) from run-regex.html and merge them into the Mutube
// library JSON — adding video records and the named collection (and, optionally,
// a sub-list within it). Dedupes so re-running is safe.
//
// With --replace, only the TARGET is cleared first (the sub-list if given, else
// the whole collection); the rest of the library is untouched and orphaned
// videos are pruned. Collection/sub ids/names and `settings` are preserved.
//
// Usage:
//   node scripts/merge-ids-into-backup.mjs "<collection>" ["<sub-list>"] [--replace]
//   (optionally override the file: --file "<library.json>")

import { readFile, writeFile } from 'node:fs/promises'
import { extractEntries } from './lib-extract.mjs'

const DEFAULT_BACKUP = 'mutube-library.json'

const args = process.argv.slice(2)
const replace = args.includes('--replace')
const fileIdx = args.indexOf('--file')
const backupPath = fileIdx !== -1 ? args[fileIdx + 1] : DEFAULT_BACKUP
const positional = args.filter((a, i) => !a.startsWith('--') && (fileIdx === -1 || i !== fileIdx + 1))
const collectionName = positional[0]
const subName = positional[1]
if (!collectionName) {
  console.error('Usage: node scripts/merge-ids-into-backup.mjs "<collection>" ["<sub-list>"] [--replace]')
  process.exit(1)
}

const html = await readFile('run-regex.html', 'utf8')

// IDs in playlist order (deduped) and the aligned video-title titles.
const { ids, titleOf } = extractEntries(html)

const data = JSON.parse(await readFile(backupPath, 'utf8'))
data.videos ??= {}
data.videoOrder ??= []
data.collections ??= []

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Find or create the target collection.
let collection = data.collections.find((c) => c.name === collectionName)
if (!collection) {
  collection = { id: crypto.randomUUID(), name: collectionName, videoIds: [] }
  data.collections.push(collection)
}

// Find or create the target sub-collection, if one was named.
let sub = null
if (subName) {
  collection.subCollections ??= []
  sub = collection.subCollections.find((s) => s.name === subName)
  if (!sub) {
    sub = { id: `${collection.id}:${slug(subName)}`, name: subName, videoIds: [] }
    collection.subCollections.push(sub)
  }
}

// --replace clears just the target: the sub-list if given, else the whole
// collection (its videoIds and sub-lists). It does NOT wipe the rest of the
// library; orphaned videos are pruned at the end.
if (replace) {
  if (sub) sub.videoIds = []
  else {
    collection.videoIds = []
    collection.subCollections = sub ? collection.subCollections : []
  }
}

// Ensure a video record exists for every extracted ID.
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

const addUnique = (arr, list) => {
  const set = new Set(arr)
  let added = 0
  for (const id of list) if (!set.has(id)) { arr.push(id); set.add(id); added++ }
  return added
}

// Add to the collection (always the superset) and the sub-list (if targeted).
const colAdded = addUnique(collection.videoIds, ids)
const subAdded = sub ? addUnique(sub.videoIds, ids) : 0

// Rebuild videoOrder + prune orphans so the file stays fully consistent:
// keep only IDs referenced by some collection or sub-list.
const referenced = new Set()
for (const c of data.collections) {
  for (const id of c.videoIds) referenced.add(id)
  for (const s of c.subCollections ?? []) for (const id of s.videoIds) referenced.add(id)
}
addUnique(data.videoOrder, ids)
data.videoOrder = data.videoOrder.filter((id) => referenced.has(id))
for (const id of Object.keys(data.videos)) if (!referenced.has(id)) delete data.videos[id]

// Integrity guard: every referenced id must have a video record.
const known = new Set(Object.keys(data.videos))
const dangling = [...referenced].filter((id) => !known.has(id))
if (dangling.length) {
  console.error(`\n⚠ ${dangling.length} id(s) referenced without a video record:`, dangling.join(', '))
  process.exitCode = 1
}

await writeFile(backupPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
const target = sub ? `${collectionName} › ${subName}` : collectionName
console.log(
  `Extracted ${ids.length} unique IDs into ${backupPath}\n` +
    `+${videosAdded} new video records (${Object.keys(data.videos).length} total)\n` +
    `"${collectionName}": +${colAdded} (${collection.videoIds.length} total)` +
    (sub ? `\n"${target}": +${subAdded} (${sub.videoIds.length} total)` : ''),
)
