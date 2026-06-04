// Soft lock for parent mode. This is a deterrent for kids, NOT real security —
// the data still lives in the browser. We hash with SHA-256 so the raw PIN is
// not stored in plaintext, and salt it lightly to avoid trivial rainbow lookups.
const SALT = 'mutube.v1'

export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(SALT + pin)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash
}
