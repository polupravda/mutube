import type { AppData } from '../types'

// The single seam that keeps Mutube "sync-ready". For testing we ship
// FileStorageAdapter (a portable JSON file via the Vite dev endpoint); a future
// SupabaseAdapter implements the same two methods and nothing in the state/UI
// layers has to change.
export interface StorageAdapter {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
