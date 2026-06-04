# Mutube

A tiny web app to **curate your kids' YouTube experience**. You (the parent)
hand-pick videos and organize them into collections. Your kids only ever see the
videos you added — no search, no recommendations, no wandering off into open
YouTube.

- **Parent mode** (PIN-protected): add videos by pasting a YouTube link, organize
  them into collections, reorder, back up/restore.
- **Kid mode** (default): a big, tappable grid of collections → videos → a
  locked-down player with only Back / Previous / Next.

Built with React + TypeScript + Vite. Data is stored **locally in the browser**
(no backend, no cost), with JSON export/import to move your library between
devices.

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

There's no backend, so the library lives in one browser. To copy it to the
kids' tablet: parent area → **Backup → Export to file**, transfer the JSON, then
**Import from file** on the other device.

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
  storage/                  # StorageAdapter interface + LocalStorageAdapter
  state/useAppData.tsx      # context + reducer + persistence
  state/pin.ts              # PIN hashing (soft lock)
  components/kid/           # CollectionGrid, VideoGrid, PlayerView
  components/parent/        # AddVideoForm, CollectionManager, Settings, ImportExport
```

### Adding cloud sync later

Storage goes through `StorageAdapter` (`load()` / `save()`). To sync across
devices, implement a `SupabaseAdapter` with those two methods and pass it to
`<AppDataProvider adapter={…}>` — no other code changes needed.
