import type { StorageAdapter } from './StorageAdapter'
import { type AppData, coerceAppData, emptyAppData } from '../types'

/**
 * Loads the library from, in order:
 *   1. the dev/preview endpoint (mutube.data.json working copy — see vite.config.ts), then
 *   2. the bundled `mutube-library.json` shipped into the build (static hosts / GitHub Pages).
 *
 * save() writes back to the dev endpoint; on a static host there is no endpoint,
 * so save() is a no-op (the deployed library is read-only — update it by
 * committing a new mutube-library.json and redeploying).
 */
const ENDPOINT = '/__data'
const BUNDLED = `${import.meta.env.BASE_URL}mutube-library.json`

async function fetchLibrary(url: string, allow204: boolean): Promise<AppData | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok || (!allow204 && res.status === 204)) return null
    const text = await res.text()
    if (!text.trim()) return null
    // Defensive coerce so a partial/old file never crashes the app.
    return coerceAppData(JSON.parse(text) as Partial<AppData>)
  } catch {
    return null
  }
}

export class FileStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData> {
    return (await fetchLibrary(ENDPOINT, false)) ?? (await fetchLibrary(BUNDLED, false)) ?? emptyAppData()
  }

  async save(data: AppData): Promise<void> {
    try {
      await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
      })
    } catch {
      // No local data endpoint (e.g. static prod build) — nothing to persist to.
    }
  }
}
