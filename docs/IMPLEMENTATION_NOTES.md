# Mutube — Implementation Notes & Decisions

A running log of non-obvious implementation decisions, their rationale, and the
trade-offs we accepted. Append new entries as features land; keep each entry
focused on *why*, not just *what* (the code shows the what).

---

## 1. Locked-down YouTube player — disabling the "More videos" overlay

> **REVERTED (see §9).** The click-shield and `controls: 0`/`disablekb`/`fs: 0`
> masking described here were later removed at the user's request; the player now
> uses native YouTube controls. Kept for history.


**Goal:** Keep kids inside the curated collection. Prevent them from reaching
YouTube's "More videos" / end-screen grid, which links out to arbitrary videos.

**Constraint (YouTube limitation):** There is **no embed parameter** that
removes the "More videos" overlay. Since 2018, `rel=0` no longer disables
related videos — it only restricts them to the same channel. The overlay
appears whenever the video is **paused or ended**, and that is not configurable.

**Decision: click-shield + custom controls** (Option 1 of the options weighed).

Implementation in [`src/components/kid/PlayerView.tsx`](../src/components/kid/PlayerView.tsx):
- Hide the native control bar entirely via player vars: `controls: 0`,
  `disablekb: 1` (no keyboard), `fs: 0` (no fullscreen). Kept `rel: 0`,
  `modestbranding: 1`, `iv_load_policy: 3`.
- Render a transparent `<button className="player-shield">` absolutely
  positioned over the iframe (`.player-stage` is `position: relative`). It
  **intercepts every click**, so taps never reach the native controls or the
  "More videos" links underneath.
- Tapping the shield toggles play/pause; a ▶ icon shows when paused.
- Capture the player instance via `onReady` into a ref; track play state via
  `onStateChange` (1 = playing, 2 = paused, 0 = ended).
- Footer controls: **◀ Previous | ⏸ Pause / ▶ Play | Next ▶**.
- `onEnd` auto-advances to the next video (so the end-screen barely flashes).

**Accepted trade-offs:**
- We lose native UI (seek bar, fullscreen) — intentional for kid mode.
- On pause, the "More videos" grid still *renders behind* the shield, but all
  clicks are swallowed, so the kid cannot navigate away. It is not fully
  removable — only made unreachable.
- Ads can still appear in the embedded player and cannot be removed (existing
  documented limitation; see the component header comment).

---

## 2. Kid-friendly color scheme

**Goal:** Brighter, more playful look aimed at young children.

**Palette (provided by product):**
- White `#ffffff`
- Blue `#4D48EB` (primary / structural)
- Green `#69B126` (positive "go" actions)
- Yellow `#E6D224` (highlights / accents)
- Gradients throughout.

**Decisions** (in [`src/styles.css`](../src/styles.css), CSS variables under `:root`):
- **Color roles:** blue = primary/structure (headers, default buttons, active
  tabs), green = positive actions (big Play/Prev/Next, "Back to videos"),
  yellow = highlights (hover borders, count badges, banners, focus).
- **Gradient tokens:** `--grad-blue`, `--grad-green`, `--grad-yellow` so
  gradients stay consistent and themeable.
- **Kid background:** blue linear gradient (`#4D48EB → #6f6bf2 → #8e8af5`) with
  soft yellow + green radial glows in opposite corners.
- **Buttons:** chunky, tactile — gradient fill, drop-shadow, press-down
  (`:active { transform: translateY(2px) }`) for a kid-satisfying feel.
- **Cards:** white, rounded, lift on hover with a yellow border.
- **Parent mode:** light blue-white (`#f3f4ff`), blue headings, gradient active
  tabs — calmer than kid mode but on the same palette.

**Note:** Removed the old purple/pink variables (`--bg`, `--bg-2`, `--accent`,
`--accent-2`). Verified no remaining references before deleting.

---

## 3. Collection covers — use a video thumbnail as the collection image

**Goal:** Let parents give collections a real thumbnail instead of only an emoji.

**Decision: cover references a video by ID, not a stored image/URL.**

Model change in [`src/types.ts`](../src/types.ts): added optional
`coverVideoId?: string` to `Collection`.

**Why a video ID (not a frozen URL or uploaded file):**
- Matches the request ("use a *video* thumbnail") with zero new storage.
- Tracks the source video; if YouTube's thumbnail URL changes, we still resolve
  the current one.
- No file-upload UI / blob storage needed (would be a much larger change).

**Reducer** ([`src/state/useAppData.tsx`](../src/state/useAppData.tsx)):
- New action `setCollectionCover { collectionId, coverVideoId? }` (passing
  `undefined` clears it).
- **Dangling-ref safety:** `removeVideo` and `removeVideoFromCollection` clear
  `coverVideoId` when it points to the removed video, so we never render a
  broken image. Falls back to emoji/auto-thumbnail.

**Parent UI** ([`src/components/parent/CollectionManager.tsx`](../src/components/parent/CollectionManager.tsx)):
- Each video row has a **Cover** toggle. Active cover shows **★ Cover** (filled
  blue); clicking again clears it.

**Kid UI cover priority** ([`src/components/kid/CollectionGrid.tsx`](../src/components/kid/CollectionGrid.tsx)):
1. **Explicit cover** — the video chosen via the ★ Cover button.
2. **Emoji** — if the parent set one, respect it (deliberate choice).
3. **First video's thumbnail** — auto-fallback so a non-empty collection always
   shows a real image.
4. **📺** — only when the collection is empty.

**Why the auto-fallback (#3):** A collection showing the generic `📺` emoji
looked unfinished. Defaulting to the first video's thumbnail means thumbnails
"just work" without a manual step, while still honoring an explicitly chosen
cover or emoji. The `📺` placeholder now only appears for empty collections.

---

## 4. Home redesign: all-videos grid, aliases, search, two-column player

Four related changes landed together.

### 4a. Home = Collections section + "All videos" grid (drag-reorderable)

[`src/components/kid/HomeView.tsx`](../src/components/kid/HomeView.tsx) replaces
the old `CollectionGrid.tsx`. The kid home now shows a **Collections** section
above an **All videos** grid.

- **Ordering model:** added `AppData.videoOrder: string[]` — the display order of
  the all-videos grid. New videos are **prepended** on add (so "newest on top"
  falls out naturally), and drag-and-drop rewrites the list.
  - *Why an explicit order array rather than sorting by `addedAt` each render:*
    the requirement asked for both "sorted by add date" **and** manual reorder.
    Prepend-on-add gives the date behavior for free while letting drag persist a
    custom order. `normalizeAppData` reconciles the array with `videos` on load/
    import (drops stale IDs, appends any missing newest-first) so old blobs are
    safe.
- **Drag-and-drop:** native HTML5 DnD (`draggable` + `onDragStart/Over/Drop`),
  **no library added** — keeps deps minimal. The reducer action
  `reorderVideos { fromId, toId }` moves by **ID, not index**, so it stays
  correct even though the grid hides non-embeddable videos.
  - *Accepted trade-off:* native DnD does not work via touch, so reordering is
    mouse/trackpad only. Acceptable since reordering is an organizing action; a
    pointer/touch DnD lib can be added later if needed.
- **Embeddable-only:** the kid grid shows only embeddable videos (kids can't play
  the rest). `videoOrder` still tracks all IDs; only display is filtered.

### 4b. Per-video alias

- Added optional `Video.alias`. Helper `videoName(v) = alias?.trim() || title`
  is the single source of truth for the kid-facing name and is used everywhere
  videos are displayed (home, collection grid, player, parent lists).
- Set at add time in [`AddVideoForm`](../src/components/parent/AddVideoForm.tsx):
  the field pre-fills with the original title; blank ⇒ falls back to the title
  (so "no alias" still yields a usable name, per the requirement).
- Reducer also has `setVideoAlias` for future edit UIs (not surfaced yet).

### 4c. Search by alias

- Search box in the home header filters the all-videos grid by `videoName`
  (case-insensitive substring). Because alias defaults to the title, this also
  covers "search by name when the name is the alias" — no separate title match.
- **Decisions:** while a query is active we (1) hide the Collections section to
  keep results focused, and (2) disable drag reorder (reordering a filtered list
  is ambiguous).

### 4d. YouTube-style two-column player

[`PlayerView`](../src/components/kid/PlayerView.tsx) now takes a `playlist`,
`index`, `title`, `onSelect`, `onBack` (replacing the old single-video +
prev/next props). Video on the left, playlist column on the right.

- **Playlist source** is decided by where playback started, owned by
  [`KidApp`](../src/components/kid/KidApp.tsx) as a `PlayContext`:
  - From a **collection** → the sidebar is that collection's embeddable videos,
    titled with the collection name.
  - From **All videos** → a **random mix** of embeddable videos drawn from across
    all collections, the picked video first, titled "More videos".
- **Why KidApp owns the playlist (a snapshot):** playback is an ephemeral session;
  snapshotting the `Video[]` keeps the player simple (it just indexes a list) and
  makes the random mix stable for the session.
- Per-video transient state (`errored`, `isPlaying`) resets via `useEffect` keyed
  on `video.id`, since the same player instance is reused across selections.
- **Responsive:** side-by-side above 900px; below that the playlist drops under
  the video as a horizontal scroller.

---

## 5. Storage: portable JSON file instead of localStorage

**Goal:** localStorage is browser-bound and not portable. Move to a portable
file-based format, and for testing persist it to a real local file.

**Decisions:**
- **Portable format = a versioned JSON document**, written to
  `mutube.data.json` and formally described in
  [`schema/mutube.schema.json`](../schema/mutube.schema.json) (JSON Schema
  draft-07). It is the same shape as `AppData` and what Export/Import produce.
  `version` mirrors `AppData['version']`.
- **Test persistence = a Vite dev/preview endpoint** ([`vite.config.ts`](../vite.config.ts),
  `localDataFile` plugin): `GET /__data` returns the file (204 when absent),
  `PUT /__data` overwrites it. This writes a real file at the project root that
  survives refreshes and can be opened, committed, or moved.
- **[`FileStorageAdapter`](../src/storage/FileStorageAdapter.ts)** talks to that
  endpoint behind the existing `StorageAdapter` seam — no state/UI changes.
- **Deleted `LocalStorageAdapter`** entirely (localStorage was ruled out).
- **Export/Import** added to the parent Settings panel for true portability:
  Export downloads `mutube.data.json`; Import replaces the library from a file.

**Accepted trade-offs:**
- The dev endpoint is **test-only**. A static production build has no server, so
  `FileStorageAdapter` degrades to in-memory (load → empty, save → no-op).
  Production persistence should come from a real backend adapter behind the same
  seam (the `SupabaseAdapter`-style extension point the seam was built for).
- `mutube.data.json` is **git-ignored** — it's local test data, not source.
- Save fires on every state change (one `PUT` per change). Fine at this scale;
  could be debounced later if needed.

---

## 6. On-demand migration from localStorage → file storage

**Goal:** Recover libraries saved under the retired `LocalStorageAdapter`
(§5) into the new file storage, triggered by a button, without duplicates.

**Implementation:** [`src/storage/legacyMigration.ts`](../src/storage/legacyMigration.ts),
invoked from a "Migrate from browser storage" button in the Settings "Backup &
data" card. It reads the old `localStorage["mutube.appData.v1"]` blob and
**merges** it into the current library via `mergeLibraries`, then dispatches
`replace` (which normalizes `videoOrder`).

**Dedup rules (so it never creates duplicate records, and is idempotent):**
- **Videos** dedupe by ID; on conflict the **current** copy is kept (preserves
  edits like alias). Skipped count is reported.
- **Collections** match by **ID, else case-insensitive name** — covers the case
  where a collection was recreated with a new UUID. A match merges `videoIds` as
  a **union** (current order first) and only *fills* missing `emoji`/`coverVideoId`,
  never overwriting.
- **videoOrder** keeps the current order and appends new incoming IDs.
- **Settings** adopt a legacy PIN only if none is set now.

**Decisions / trade-offs:**
- **Non-destructive:** localStorage is left intact. Because the merge dedupes,
  re-running is a safe no-op — simpler and less surprising than clearing it.
- **Merge, not replace:** incoming data only fills gaps, so running it against a
  non-empty current library can't clobber current work.
- Outcome is surfaced as a summary (added / merged / skipped counts).

---

## 7. External JSON document as a read-only "database" (manual sync-out)

**Goal:** A very simple storage model — keep the library in an external JSON
document (GitHub/Google Drive/any public URL). The app loads it automatically;
writing back is **manual** (copy the document and paste it over the source).

**Decisions (confirmed with the user):**
- **Any URL** — a single `settings.sourceUrl` field accepts a GitHub raw link, a
  Google Drive direct link, or any public JSON URL. No host-specific code.
- **Auto-load on startup** — when `sourceUrl` is set, the app fetches it on boot
  and uses it as state; a "Load from this URL" button reloads on demand.
- **Sync-out = copy the full document** — one "Copy full document" button puts the
  entire library JSON on the clipboard to paste over the source file (replace-all).
  Simpler and less error-prone than hand-merging a diff.

**How it fits together:**
- [`remoteSource.ts`](../src/storage/remoteSource.ts) fetches (`cache: 'no-store'`)
  and shape-validates the document into `AppData`.
- The provider ([`useAppData.tsx`](../src/state/useAppData.tsx)) loads the local
  working copy first (for config like `sourceUrl`/PIN), then — if a URL is set —
  replaces state with the fetched document via `applySource`.
- `FileStorageAdapter` (§5) stays as the **local working copy**: it persists the
  configured URL and in-session edits to `mutube.data.json`, so a refresh doesn't
  lose the URL. The external document is the cross-device source of truth.
- Settings UI: URL field, Load, Copy full document, Disable source, plus a load
  status line and a **dirty banner**.

**Key design points / trade-offs:**
- **Source is authoritative for the library, local for device settings.**
  `applySource` merges `{ ...localSettings, ...remote.settings, sourceUrl }` — so
  a document that omits `settings` won't wipe the parent PIN, and the locally
  configured URL is always preserved (avoids a chicken-and-egg on the URL).
- **Unsynced-changes guard.** The provider keeps a serialized `baseline` of the
  last state loaded-from / synced-to source; `dirtyVsSource` is true when current
  state differs. Settings shows a warning so the parent copies out **before** a
  reload overwrites local adds (the inherent risk of a manual-sync model). "Copy
  full document" calls `markSyncedToSource()` to clear the flag.
- **Write-back is intentionally manual** — no API tokens, no OAuth, no backend.
  Matches the "very simple" requirement; the cost is the manual copy step.
- Clipboard copy falls back to a file download in insecure contexts.

---

## 8. Sub-collections (seasons/topics) + collections-only home

**Goal:** Declutter the home (collections only, no flat all-videos grid) and split
each collection into sub-lists shown **inline on the home page** — no nested
subpage to reach a collection's groups.

**Data model** ([`types.ts`](../src/types.ts), [`schema`](../schema/mutube.schema.json)):
- Added `SubCollection { id, name, videoIds }` and an optional
  `Collection.subCollections`. `Collection.videoIds` stays as the **union** of the
  sub-lists (kept for covers/back-compat); sub-lists are a partition of it.
- Survives load/import/remote because collections are copied wholesale.

**Categorization** ([`scripts/split-collections.mjs`](../scripts/split-collections.mjs)):
- **Numberblocks & Wild Kratts → by season**, parsed from titles (`S1 E1`,
  `S01EP1`); unmatched → "Specials".
- **Super Why & Dr. Binocs → by topic** (ordered keyword buckets; first hit wins,
  "Other" fallback). Super Why has no season markers (0/189), so topic is the only
  option; Dr. Binocs was specified topic-only.
- Idempotent: recomputed from `videoIds` + titles each run; sub-list ids are
  derived from the name (`<colId>:<slug>`) so they're stable.
- Distribution after tuning — "Other": Super Why 34/189, Dr. Binocs 112/712 (~16%,
  the genuinely miscellaneous "what is X" tail). Verified each video lands in
  exactly one sub-list and the union equals the collection.

**Navigation / UI:**
- [`HomeView`](../src/components/kid/HomeView.tsx): collections only; each renders a
  section (emoji + name) with its sub-lists as tiles (cover = first video's
  thumbnail, + count). **Removed the all-videos grid and the search box.**
- [`KidApp`](../src/components/kid/KidApp.tsx): home → sub-list grid → player. The
  player playlist is the chosen sub-list (title `Collection · Sub`). Dropped the
  old "random from all collections" path (no all-videos entry point now).
- [`VideoGrid`](../src/components/kid/VideoGrid.tsx) is now title-based (a sub-list),
  not collection-bound.

**Trade-offs / notes:**
- **Topic buckets are heuristic** (keyword rules) — tune the lists in the script
  and re-run; the parent can't edit groupings in-app.
- **Sub-lists are script-generated, not auto-maintained.** Adding/removing a video
  via the parent CollectionManager updates `videoIds` but not `subCollections`, so
  a newly added video won't appear on the home until `split-collections.mjs` is
  re-run. (It also won't 404 — HomeView just won't place it in a group.)
- Collections without `subCollections` gracefully fall back to a single tile for
  the whole collection.

---

## 9. Reverted the control masking (native controls restored)

**Goal:** Undo the click-shield from §1 — the user wants normal YouTube controls.

**Changes** ([`PlayerView.tsx`](../src/components/kid/PlayerView.tsx)):
- Removed the transparent `player-shield` overlay and its CSS.
- Dropped the `controls: 0`, `disablekb: 1`, `fs: 0` player vars — native control
  bar, keyboard shortcuts, and fullscreen all work again. Kept `rel: 0`,
  `modestbranding`, `playsinline`, `iv_load_policy: 3`.
- Removed the custom play/pause button + its `isPlaying`/`playerRef` plumbing;
  the footer keeps **Previous / Next** for sub-list navigation, and `onEnd` still
  auto-advances. Two-column layout + playlist sidebar unchanged.

**Consequence:** the "More videos" overlay can again appear on pause/end (it's not
removable via embed params). That's the accepted trade-off of using native controls.

---

## Conventions for this doc

- One section per feature/decision; newest at the bottom.
- Capture **constraints**, the **decision**, and **accepted trade-offs** — the
  reasoning future-you will want, not a code restatement.
- Link to the touched files with relative paths.
