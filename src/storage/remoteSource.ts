import { type AppData, coerceAppData } from '../types'

/**
 * Fetch the external JSON "database" (a GitHub raw link, Google Drive direct
 * link, or any public JSON URL) and shape it into AppData. `no-store` avoids a
 * stale CDN copy so a freshly-edited source is picked up.
 *
 * Throws a human-readable Error on network / parse failure so the UI can show it.
 */
export async function fetchRemoteData(url: string): Promise<AppData> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch {
    throw new Error('Could not reach the source URL (network or CORS error).')
  }
  if (!res.ok) {
    throw new Error(`Source returned HTTP ${res.status}.`)
  }

  let parsed: Partial<AppData>
  try {
    parsed = (await res.json()) as Partial<AppData>
  } catch {
    throw new Error('The source did not return valid JSON.')
  }

  // Defensive coerce so a partial/old document never crashes the app.
  return coerceAppData(parsed)
}
