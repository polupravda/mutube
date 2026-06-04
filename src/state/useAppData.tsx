import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type AppData, type Collection, type Video, coerceAppData, emptyAppData, normalizeAppData } from '../types'
import type { StorageAdapter } from '../storage/StorageAdapter'
import { FileStorageAdapter } from '../storage/FileStorageAdapter'
import { fetchRemoteData } from '../storage/remoteSource'

// ---- Actions -------------------------------------------------------------

type Action =
  | { type: 'replace'; data: AppData }
  | { type: 'addVideo'; video: Video; collectionId?: string }
  | { type: 'removeVideo'; videoId: string }
  | { type: 'setVideoEmbeddable'; videoId: string; embeddable: boolean }
  | { type: 'setVideoAlias'; videoId: string; alias?: string }
  | { type: 'reorderVideos'; fromId: string; toId: string }
  | { type: 'createCollection'; name: string; emoji?: string }
  | { type: 'renameCollection'; id: string; name: string; emoji?: string }
  | { type: 'deleteCollection'; id: string }
  | { type: 'reorderCollections'; from: number; to: number }
  | { type: 'addVideoToCollection'; collectionId: string; videoId: string }
  | { type: 'removeVideoFromCollection'; collectionId: string; videoId: string }
  | { type: 'setCollectionCover'; collectionId: string; coverVideoId?: string }
  | { type: 'reorderVideoInCollection'; collectionId: string; from: number; to: number }
  | { type: 'setPinHash'; hash: string }
  | { type: 'setSourceUrl'; url?: string }

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'replace':
      // Normalize so an old/imported blob without videoOrder is well-formed.
      return normalizeAppData(action.data)

    case 'addVideo': {
      const isNew = !state.videos[action.video.id]
      const videos = { ...state.videos, [action.video.id]: action.video }
      // Newly added videos go to the top of the home grid; updates keep their spot.
      const videoOrder = isNew ? [action.video.id, ...state.videoOrder] : state.videoOrder
      let collections = state.collections
      if (action.collectionId) {
        collections = collections.map((c) =>
          c.id === action.collectionId && !c.videoIds.includes(action.video.id)
            ? { ...c, videoIds: [...c.videoIds, action.video.id] }
            : c,
        )
      }
      return { ...state, videos, videoOrder, collections }
    }

    case 'removeVideo': {
      const videos = { ...state.videos }
      delete videos[action.videoId]
      const videoOrder = state.videoOrder.filter((id) => id !== action.videoId)
      const collections = state.collections.map((c) => ({
        ...c,
        videoIds: c.videoIds.filter((id) => id !== action.videoId),
        coverVideoId: c.coverVideoId === action.videoId ? undefined : c.coverVideoId,
      }))
      return { ...state, videos, videoOrder, collections }
    }

    case 'setVideoEmbeddable': {
      const existing = state.videos[action.videoId]
      if (!existing) return state
      return {
        ...state,
        videos: { ...state.videos, [action.videoId]: { ...existing, embeddable: action.embeddable } },
      }
    }

    case 'setVideoAlias': {
      const existing = state.videos[action.videoId]
      if (!existing) return state
      const alias = action.alias?.trim() || undefined
      return {
        ...state,
        videos: { ...state.videos, [action.videoId]: { ...existing, alias } },
      }
    }

    case 'reorderVideos': {
      if (action.fromId === action.toId) return state
      const from = state.videoOrder.indexOf(action.fromId)
      const to = state.videoOrder.indexOf(action.toId)
      if (from < 0 || to < 0) return state
      return { ...state, videoOrder: move(state.videoOrder, from, to) }
    }

    case 'createCollection':
      return {
        ...state,
        collections: [
          ...state.collections,
          { id: crypto.randomUUID(), name: action.name, emoji: action.emoji, videoIds: [] },
        ],
      }

    case 'renameCollection':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.id ? { ...c, name: action.name, emoji: action.emoji } : c,
        ),
      }

    case 'deleteCollection':
      return { ...state, collections: state.collections.filter((c) => c.id !== action.id) }

    case 'reorderCollections':
      return { ...state, collections: move(state.collections, action.from, action.to) }

    case 'addVideoToCollection':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId && !c.videoIds.includes(action.videoId)
            ? { ...c, videoIds: [...c.videoIds, action.videoId] }
            : c,
        ),
      }

    case 'removeVideoFromCollection':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId
            ? {
                ...c,
                videoIds: c.videoIds.filter((id) => id !== action.videoId),
                coverVideoId: c.coverVideoId === action.videoId ? undefined : c.coverVideoId,
              }
            : c,
        ),
      }

    case 'setCollectionCover':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId ? { ...c, coverVideoId: action.coverVideoId } : c,
        ),
      }

    case 'reorderVideoInCollection':
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId
            ? { ...c, videoIds: move(c.videoIds, action.from, action.to) }
            : c,
        ),
      }

    case 'setPinHash':
      return { ...state, settings: { ...state.settings, parentPinHash: action.hash } }

    case 'setSourceUrl':
      return { ...state, settings: { ...state.settings, sourceUrl: action.url?.trim() || undefined } }

    default:
      return state
  }
}

// ---- Context -------------------------------------------------------------

export type SourceStatus = {
  state: 'idle' | 'loading' | 'ok' | 'error'
  error?: string
  /** ISO timestamp of the last successful load from source. */
  loadedAt?: string
}

type AppDataContextValue = {
  data: AppData
  ready: boolean
  dispatch: React.Dispatch<Action>
  /** Selectors / helpers. */
  videosOf: (collection: Collection) => Video[]
  exportJson: () => string
  importJson: (json: string) => void
  /** External-source ("database") integration. */
  sourceStatus: SourceStatus
  /** True when local state differs from what was last loaded/synced to source. */
  dirtyVsSource: boolean
  /**
   * Fetch the source and replace local state with it. Pass a URL to load (and
   * persist) a new source; omit it to reload the currently-configured one.
   */
  reloadFromSource: (overrideUrl?: string) => Promise<{ ok: boolean; error?: string }>
  /** Mark the current state as matching the source (after copying it out). */
  markSyncedToSource: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

const defaultAdapter = new FileStorageAdapter()

export function AppDataProvider({
  children,
  adapter = defaultAdapter,
}: {
  children: ReactNode
  adapter?: StorageAdapter
}) {
  const [data, dispatch] = useReducer(reducer, undefined, emptyAppData)
  const [ready, setReady] = useState(false)
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>({ state: 'idle' })
  // Serialized snapshot of the last state known to match the source; null until
  // a source load/sync happens. Used to flag unsynced local changes.
  const [baseline, setBaseline] = useState<string | null>(null)
  const loadedRef = useRef(false)

  // Apply a freshly-fetched source document as the new state. The document is
  // authoritative for the library (collections/videos/order), but local-only
  // settings (PIN, source URL) are preserved when the document omits them.
  function applySource(remote: AppData, url: string, localSettings: AppData['settings']) {
    const merged: AppData = {
      ...remote,
      settings: { ...localSettings, ...remote.settings, sourceUrl: url },
    }
    dispatch({ type: 'replace', data: merged })
    setBaseline(JSON.stringify(normalizeAppData(merged)))
    setSourceStatus({ state: 'ok', loadedAt: new Date().toISOString() })
  }

  // Load once on mount: local working copy first (for config), then — if a
  // source URL is configured — replace state with the external document.
  useEffect(() => {
    let cancelled = false
    adapter.load().then(async (local) => {
      if (cancelled) return
      const url = local.settings.sourceUrl
      if (!url) {
        dispatch({ type: 'replace', data: local })
      } else {
        setSourceStatus({ state: 'loading' })
        try {
          const remote = await fetchRemoteData(url)
          if (cancelled) return
          applySource(remote, url, local.settings)
        } catch (e) {
          if (cancelled) return
          dispatch({ type: 'replace', data: local }) // fall back to local copy
          setSourceStatus({ state: 'error', error: e instanceof Error ? e.message : 'Load failed.' })
        }
      }
      if (!cancelled) {
        loadedRef.current = true
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [adapter])

  // Persist on every change after the initial load.
  useEffect(() => {
    if (!loadedRef.current) return
    void adapter.save(data)
  }, [data, adapter])

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      ready,
      dispatch,
      videosOf: (collection) =>
        collection.videoIds.map((id) => data.videos[id]).filter((v): v is Video => Boolean(v)),
      exportJson: () => JSON.stringify(data, null, 2),
      importJson: (json: string) => {
        dispatch({ type: 'replace', data: coerceAppData(JSON.parse(json) as Partial<AppData>) })
      },
      sourceStatus,
      dirtyVsSource: baseline != null && JSON.stringify(data) !== baseline,
      reloadFromSource: async (overrideUrl?: string) => {
        const url = (overrideUrl ?? data.settings.sourceUrl)?.trim()
        if (!url) return { ok: false, error: 'No source URL is set.' }
        setSourceStatus({ state: 'loading' })
        try {
          const remote = await fetchRemoteData(url)
          applySource(remote, url, data.settings) // keeps local PIN; persists the URL
          return { ok: true }
        } catch (e) {
          const error = e instanceof Error ? e.message : 'Load failed.'
          setSourceStatus({ state: 'error', error })
          return { ok: false, error }
        }
      },
      markSyncedToSource: () => setBaseline(JSON.stringify(data)),
    }),
    [data, ready, sourceStatus, baseline],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
