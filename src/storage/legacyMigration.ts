import { type AppData, type Collection, type Video, coerceAppData } from '../types'

/**
 * One-shot migration from the retired localStorage adapter to the current
 * file-backed storage. Run on demand (a button in Settings).
 *
 * It MERGES rather than replaces, and dedupes so running it more than once is
 * safe (idempotent): videos dedupe by ID, collections by ID or case-insensitive
 * name, and a collection's videoIds become a union. Nothing in the current
 * library is overwritten — incoming data only fills gaps.
 */

/** Storage key written by the old LocalStorageAdapter. */
const LEGACY_KEY = 'mutube.appData.v1'

export type MigrationSummary = {
  videosAdded: number
  videosAlreadyPresent: number
  collectionsAdded: number
  collectionsMerged: number
}

/** True if there is anything in the old localStorage slot. */
export function hasLegacyData(): boolean {
  try {
    return localStorage.getItem(LEGACY_KEY) != null
  } catch {
    return false
  }
}

/** Read + shape the legacy blob, or null if missing/invalid. */
function readLegacyData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    return coerceAppData(JSON.parse(raw) as Partial<AppData>)
  } catch {
    return null
  }
}

const norm = (s: string) => s.trim().toLowerCase()

/** Merge `incoming` into `current` without creating duplicate records. */
export function mergeLibraries(
  current: AppData,
  incoming: AppData,
): { data: AppData; summary: MigrationSummary } {
  // --- Videos: dedupe by ID; keep the current copy on conflict. ---
  const videos: Record<string, Video> = { ...current.videos }
  let videosAdded = 0
  let videosAlreadyPresent = 0
  for (const [id, v] of Object.entries(incoming.videos)) {
    if (videos[id]) {
      videosAlreadyPresent++
    } else {
      videos[id] = v
      videosAdded++
    }
  }

  // --- Collections: match by ID, else by case-insensitive name. ---
  const collections: Collection[] = current.collections.map((c) => ({ ...c, videoIds: [...c.videoIds] }))
  const byId = new Map(collections.map((c) => [c.id, c]))
  const byName = new Map(collections.map((c) => [norm(c.name), c]))
  let collectionsAdded = 0
  let collectionsMerged = 0

  for (const inc of incoming.collections) {
    const match = byId.get(inc.id) ?? byName.get(norm(inc.name))
    if (match) {
      // Union videoIds (existing order first), only for videos we actually have.
      const seen = new Set(match.videoIds)
      for (const vid of inc.videoIds) {
        if (!seen.has(vid) && videos[vid]) {
          match.videoIds.push(vid)
          seen.add(vid)
        }
      }
      // Fill missing metadata only — never overwrite current choices.
      if (!match.emoji && inc.emoji) match.emoji = inc.emoji
      if (!match.coverVideoId && inc.coverVideoId && videos[inc.coverVideoId]) {
        match.coverVideoId = inc.coverVideoId
      }
      collectionsMerged++
    } else {
      const fresh: Collection = {
        id: inc.id,
        name: inc.name,
        emoji: inc.emoji,
        coverVideoId: inc.coverVideoId && videos[inc.coverVideoId] ? inc.coverVideoId : undefined,
        videoIds: inc.videoIds.filter((vid) => videos[vid]),
      }
      collections.push(fresh)
      byId.set(fresh.id, fresh)
      byName.set(norm(fresh.name), fresh)
      collectionsAdded++
    }
  }

  // --- Home order: keep current order, append new incoming IDs (normalize fills the rest). ---
  const orderSeen = new Set(current.videoOrder)
  const videoOrder = [...current.videoOrder]
  for (const id of incoming.videoOrder) {
    if (!orderSeen.has(id) && videos[id]) {
      videoOrder.push(id)
      orderSeen.add(id)
    }
  }

  // --- Settings: adopt a legacy PIN only if none is set now. ---
  const settings = { ...current.settings }
  if (!settings.parentPinHash && incoming.settings.parentPinHash) {
    settings.parentPinHash = incoming.settings.parentPinHash
  }

  // --- Blacklist: union of current + incoming, deduped. ---
  const blacklist = [...new Set([...current.blacklist, ...incoming.blacklist])]

  return {
    data: { version: 1, collections, videos, videoOrder, blacklist, settings },
    summary: { videosAdded, videosAlreadyPresent, collectionsAdded, collectionsMerged },
  }
}

/**
 * Read the legacy library and merge it into `current`. Returns null when there
 * is nothing to migrate. Does not mutate localStorage — re-running is safe
 * because the merge dedupes.
 */
export function migrateFromLocalStorage(
  current: AppData,
): { data: AppData; summary: MigrationSummary } | null {
  const legacy = readLegacyData()
  if (!legacy) return null
  return mergeLibraries(current, legacy)
}
