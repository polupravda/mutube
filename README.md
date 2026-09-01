# Mutube

A tiny web app to **curate your kids' YouTube experience**. You (the parent)
hand-pick videos and organize them into collections. Your kids only ever see the
videos you added — no search, no recommendations, no wandering off into open
YouTube.

- **Parent mode** (PIN-protected): add videos by pasting a YouTube link, organize
  them into collections, reorder, back up/restore.
- **Kid mode** (default): a big, tappable grid of collections → videos → a
  locked-down player with only Back / Previous / Next.

Built with React + TypeScript + Vite. The library is a **portable JSON document**
(schema in [`schema/mutube.schema.json`](schema/mutube.schema.json)): for testing
it's read/written via a small Vite dev endpoint, and it can be backed by an
external JSON file (GitHub/Google Drive) as a simple read-only "database", with
Export/Import in Settings. Bulk-add whole playlists with the scripts in
[`scripts/`](scripts/) (see §5).

---

## 1. Get a YouTube Data API key

The app uses the YouTube Data API only when *you* add a video (to fetch its
title, thumbnail, and duration — 1 quota unit per add; free quota is 10,000/day).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project → **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. **Restrict the key** → Application restrictions → *HTTP referrers*, and add your
   dev URL (`http://localhost:5173/*`) and your deploy URL. (Vite exposes the key
   in the built JS, so restricting it is what keeps it from being abused.)

## 2. Configure & run

```bash
cp .env.example .env       # then paste your key into VITE_YOUTUBE_API_KEY=
npm install
npm run dev                # open the printed http://localhost:5173
```

Build for deployment:

```bash
npm run build              # outputs static files to dist/
npm run preview            # preview the production build locally
```

The `dist/` folder is plain static files — drop it on **Netlify**, **GitHub
Pages**, **Cloudflare Pages**, etc. (all free). `vite.config.ts` uses a relative
`base` so it works from any subpath.

## 3. First-time setup in the app

1. Open the app → tap the **⚙ gear** (top-right) to enter the parent area.
2. **Settings** → set a **PIN** (so kids can't get back in here).
3. **Collections** → create a collection (e.g. "🦕 Dinosaurs").
4. **Add video** → paste a YouTube link → **Look up** → pick a collection → **Add**.
5. Tap **◀ Back to kids** — your kids now see only what you added.

## 4. Moving your library to another device

There's no backend. To copy your library to the kids' tablet: parent area →
**Settings → Backup & data → Export**, transfer the JSON, then **Import** on the
other device. Or set an **External source** URL (a GitHub raw / Google Drive link
to the JSON) so the app loads it on startup.

## 5. Bulk-importing a whole playlist (scripts)

Adding videos one-by-one in the app is fine for a few; to import an entire
YouTube playlist at once, use the scripts in [`scripts/`](scripts/). They read a
saved playlist page, extract the video IDs (+ titles), and merge them into the
library JSON ([`mutube-library.json`](mutube-library.json), the same format as
Export/Import).

**Step 1 — save the playlist page** into `run-regex.html` (repo root). Open the
playlist on YouTube, then save the page (⌘S / "Save page as") or copy its HTML
over `run-regex.html`. Both YouTube layouts are supported — the side-panel
`watch?v=…` view and the `watch_videos?video_ids=…` list view — auto-detected.

**Step 2 — add the videos to a collection:**

```bash
# append into a collection (created if it doesn't exist)
node scripts/merge-ids-into-backup.mjs "Numberblocks"

# add into a specific sub-list within a collection
node scripts/merge-ids-into-backup.mjs "Numberblocks" "Season 3"

# replace the target instead of appending (the sub-list if given, else the
# whole collection); the rest of the library is left intact
node scripts/merge-ids-into-backup.mjs "Numberblocks" "Season 3" --replace

# operate on a different file
node scripts/merge-ids-into-backup.mjs "Numberblocks" --file "other.json"
```

It de-dupes (safe to re-run), creates video records with titles/thumbnails from
the page (duration is left `0` — not reliably available), keeps the library
consistent (prunes orphans, errors on any dangling reference), and prints a
summary.

**Step 3 (optional) — auto-split into sub-lists** (seasons/topics shown grouped
on the home page):

```bash
node scripts/split-collections.mjs            # defaults to mutube-library.json
```

Splitting rules live in the `STRATEGY` map in
[`scripts/split-collections.mjs`](scripts/split-collections.mjs) (by season from
title patterns, or by topic keyword buckets). A collection with no rule shows as
a single tile. Note: re-running split **regenerates** sub-lists for collections
that have a rule, overwriting any manual sub-list placement done in step 2 for
those collections.

**Step 4 — load it into the app:** parent area → **Settings → Import** the
`mutube-library.json`, or point your **External source** URL at it.

**Preview only** (writes a numbered ID list, changes nothing):

```bash
node scripts/extract-watch-ids.mjs            # run-regex.html -> regex-output.md
```

## 6. Deploy to GitHub Pages

The repo ships a workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
that builds the app and publishes `dist/` to Pages on every push to `main`.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** (done).
2. Push to `main` (or run the workflow from the **Actions** tab). It builds and
   deploys; the live URL is `https://<user>.github.io/<repo>/`.
3. *(Optional)* to enable the parent "Add video" lookup on the live site, add a
   repo secret **`VITE_YOUTUBE_API_KEY`** (Settings → Secrets and variables →
   Actions) and restrict that key to your Pages URL (see §1). Kids watching
   don't need it.

**Where the data comes from:** a static host has no backend, so the committed
[`mutube-library.json`](mutube-library.json) is bundled into the build and loaded
on startup. To **update the published library**, edit it (usually via the scripts
in §5), commit, and push — the workflow rebuilds and republishes. The live site
is read-only for the library (Import/Export and the timer/limits still work
per-browser via local storage).

---

## Locking it down for real

The PIN and hidden parent button are a **deterrent**, not hard security — the
data is still in the browser. For a real lock so kids can't leave the app, use
your device's kiosk feature:

- **iPad/iPhone:** Settings → Accessibility → **Guided Access**.
- **Android:** Settings → Security → **Screen Pinning**.

## Honest limitations

- **Ads can still appear.** YouTube's embedded player may show ads and there is
  no compliant way to remove them.
- **Some videos can't be embedded** (the owner disabled it). Mutube detects this
  and flags/greys those videos so they never break the kid view.
- Mutube uses the **official YouTube IFrame player** — it never downloads or
  re-hosts videos, which keeps it within YouTube's Terms of Service for personal
  use.

## Project layout

```
src/
  api/youtube.ts            # parse video IDs, fetch metadata, format durations
  storage/                  # StorageAdapter + FileStorageAdapter, remoteSource, legacyMigration
  state/useAppData.tsx      # context + reducer + persistence + external source
  state/pin.ts              # PIN hashing (soft lock)
  components/kid/           # HomeView, VideoGrid, PlayerView, HeaderLogo, FloatingControls
  components/parent/        # AddVideoForm, CollectionManager, SettingsPanel
scripts/                    # bulk import: extract IDs + merge into mutube-library.json
schema/mutube.schema.json   # the portable library file format
```

### Adding cloud sync later

Storage goes through `StorageAdapter` (`load()` / `save()`). To sync across
devices, implement a `SupabaseAdapter` with those two methods and pass it to
`<AppDataProvider adapter={…}>` — no other code changes needed.
