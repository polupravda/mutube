import type { StorageAdapter } from './StorageAdapter'
import { type AppData, coerceAppData, emptyAppData } from '../types'

/**
 * Persists the library to a portable JSON file (mutube.data.json) via the
 * dev/preview endpoint defined in vite.config.ts. The file format is documented
 * in schema/mutube.schema.json and is the same shape Export/Import produce.
 *
 * In a static production build there is no endpoint, so load() returns an empty
 * library and save() is a no-op — persistence there should come from a real
 * backend adapter behind the same StorageAdapter seam.
 */
const ENDPOINT = '/__data'

export class FileStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData> {
    try {
      const res = await fetch(ENDPOINT)
      if (res.status === 204 || !res.ok) return emptyAppData()
      const text = await res.text()
      if (!text.trim()) return emptyAppData()
      // Defensive coerce so a partial/old file never crashes the app.
      return coerceAppData(JSON.parse(text) as Partial<AppData>)
    } catch {
      return emptyAppData()
    }
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
