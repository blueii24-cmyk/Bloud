# Bloud — private music for two

A shared music app for two people: a curated catalogue, collaborative
playlists, and **Listen Together** rooms with real-time presence and
playback sync. Built with React + Vite + Tailwind, backed by
**Supabase** (Postgres + Realtime), deployed on **Vercel**.

## Live

- **App:** https://bloud-eta.vercel.app (Vercel production)
- **Database:** Supabase project `Bloud` (`gaewxsaaaraafyeltiiv`, ap-south-1)

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 19, Vite 7, Tailwind CSS 4, React Router 7 (HashRouter) |
| Database  | Supabase Postgres 17 (RLS on every table) |
| Realtime  | Supabase Realtime (presence + postgres_changes + broadcast) |
| Hosting   | Vercel (root base `/`, SPA rewrites in `vercel.json`) |

## How it works

```
services/ (Supabase when configured, else local mocks)
  → state/ (contexts) → pages/ + components/
```

- **Catalogue** (`src/services/supabaseCatalogue.ts`): artists, albums,
  tracks, videos, categories, lyrics and curated mixes load from Postgres.
  Any failure falls back to the bundled sample data in `src/data/`.
- **Library** (`src/services/supabaseLibrary.ts`): likes, saved albums,
  follows, playlists + items, recent searches and play history sync to
  Postgres with diff-based writes. `localStorage` is the offline cache;
  Realtime `postgres_changes` keeps other devices in sync.
- **Listen Together** (`src/services/supabaseRoom.ts`): rooms live in the
  `rooms` table; presence tracks online devices; broadcast + `room_playback`
  sync track changes and play/pause across devices. `RoomSyncBridge`
  (in `src/state/RoomContext.tsx`) connects the player to the room.
- **Drive Music** (`src/pages/DriveMusic.tsx`): local folder scanning via
  the File System Access API — files never leave the device.

### Login (Supabase Auth)

`/#/login` is a minimal sign-in / sign-up page based on the **Bloud — Minimal login preview** HTML, wired to Supabase Auth (email + password):

* **Log in / Sign up** - `src/pages/Login.tsx` and its scoped `Login.css`, with session state in `src/state/AuthContext.tsx`. Sign-up derives the display name from the email address because the supplied design has no name field.
* **Continue as guest** - the original demo mode (all devices share one library under user `me`). Stored as `bloud.guest` in `localStorage`.
* **Google button** - preview-only notice; Google OAuth is not configured.
* **Route guard** - `src/components/auth/RequireAuth.tsx` wraps the app shell; anonymous visitors are redirected to `/login` and returned to where they were headed.
* **Offline** - without `VITE_SUPABASE_*` env vars there is nothing to log in to, so the wall is skipped and the app runs on bundled data exactly as before.

Supabase dashboard: enable the *Email* provider (Authentication -> Providers). If email confirmation is enabled, sign-up displays a notice to check the inbox; enable auto-confirm for instant sign-in. Add your site URL under Authentication -> URL Configuration.

RLS stays permissive for now (demo mode). To make libraries per-user, tighten policies to `auth.uid() = user_id` and link `app_users.auth_user_id`.

## Local development

```bash
npm ci
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:5173
npm run build                # production build → dist/
npm run typecheck            # tsc --noEmit
```

Without env vars the app still runs fully offline on bundled data.

## Database

Schema: `supabase/migrations/001_bloud_schema.sql` (tables, indexes,
RLS, Realtime publication). Seed: `supabase/seed.sql` (generated).

```bash
npm run db:seed:sql   # regenerate seed.sql from src/data/
npm run db:seed       # upsert seed via service-role key (needs SUPABASE_* env)
```

Tables: `app_users`, `artists`, `albums`, `tracks`, `videos`,
`categories`, `lyrics_sets`, `playlists`, `playlist_items`,
`liked_tracks`, `saved_albums`, `followed_artists`, `recent_searches`,
`play_history`, `continue_listening`, `rooms`, `room_members`,
`room_playback`, `room_events`.

## Deployment (Vercel)

1. Create the Vercel project from this repo (framework: Vite,
   build `npm run build`, output `dist`).
2. Set environment variables (Production + Preview):
   - `VITE_SUPABASE_URL` — `https://gaewxsaaaraafyeltiiv.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_…`
     (or `VITE_SUPABASE_ANON_KEY` with the legacy anon JWT)
3. Deploy. `vercel.json` handles SPA rewrites and asset caching.
   `vite.config.ts` uses base `/` on Vercel and `/Bloud/` elsewhere
   (GitHub Pages).

Every push to the production branch redeploys automatically.
