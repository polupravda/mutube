// Core domain model for Mutube. Kept dependency-free so the storage adapters,
// state layer, and UI all share one source of truth.

export type Video = {
  /** YouTube video ID. Also the dedup key across collections. */
  id: string
  /** Original YouTube title. */
  title: string
  /**
   * Parent-assigned display name. Defaults to the original title when not set.
   * This is the name shown to kids and the only field the home search matches.
   */
  alias?: string
  channelTitle: string
  thumbnailUrl: string
  durationSeconds: number
  /** Whether the video may be played in an embedded player. */
  embeddable: boolean
  /** ISO timestamp of when the parent added it. */
  addedAt: string
}

/** A named group of videos within a collection (e.g. a season or a topic). */
export type SubCollection = {
  id: string
  name: string
  /** Ordered list of video IDs in this sub-list. */
  videoIds: string[]
}

export type Collection = {
  id: string
  name: string
  /** Optional kid-friendly icon shown on the collection card. */
  emoji?: string
  /**
   * Optional video (by ID) whose thumbnail is used as the collection cover.
   * Falls back to the emoji when unset or the video is gone.
   */
  coverVideoId?: string
  /** Ordered list of all video IDs in this collection (the union of its sub-lists). */
  videoIds: string[]
  /**
   * Optional sub-lists (seasons/topics). When present, the home page shows
   * these grouped under the collection instead of the collection's flat list.
   */
  subCollections?: SubCollection[]
}

export type Settings = {
  /** Soft lock for parent mode. Undefined => no PIN set yet. */
  parentPinHash?: string
  /**
   * URL of an external JSON document (e.g. a GitHub raw or Google Drive link)
   * used as the library "database". When set, the app loads it on startup.
   * Writes are manual: the parent copies the document back to the source.
   */
  sourceUrl?: string
}

export type AppData = {
  version: 1
  collections: Collection[]
  /** All known videos, keyed by ID. Shared by reference from collections. */
  videos: Record<string, Video>
  /**
   * Display order of the home "All videos" grid. Newly added videos are
   * prepended (latest on top); drag-and-drop rewrites this list. Kept
   * reconciled with `videos` by {@link normalizeAppData}.
   */
  videoOrder: string[]
  /**
   * Collection IDs whose videos are limited to one per session (kid mode).
   * Such collections also hide the player's recommendations panel.
   */
  blacklist: string[]
  settings: Settings
}

export function emptyAppData(): AppData {
  return { version: 1, collections: [], videos: {}, videoOrder: [], blacklist: [], settings: {} }
}

/**
 * Coerce a parsed/partial document (from storage, import, or a remote source)
 * into a well-formed AppData. Shape only — call {@link normalizeAppData} too if
 * you need `videoOrder` reconciled with `videos`.
 */
export function coerceAppData(parsed: Partial<AppData>): AppData {
  return {
    version: 1,
    collections: parsed.collections ?? [],
    videos: parsed.videos ?? {},
    videoOrder: parsed.videoOrder ?? [],
    blacklist: parsed.blacklist ?? [],
    settings: parsed.settings ?? {},
  }
}

/** The name shown to kids and matched by search — alias if set, else the title. */
export function videoName(v: Video): string {
  return v.alias?.trim() || v.title
}

/**
 * Reconcile `videoOrder` with `videos`: drop stale IDs and append any videos
 * missing from the order (newest first), so old/imported blobs are well-formed.
 */
export function normalizeAppData(data: AppData): AppData {
  const known = new Set(Object.keys(data.videos))
  const ordered = data.videoOrder.filter((id) => known.has(id))
  const seen = new Set(ordered)
  const missing = Object.values(data.videos)
    .filter((v) => !seen.has(v.id))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .map((v) => v.id)
  return { ...data, videoOrder: [...ordered, ...missing] }
}
