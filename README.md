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
  tracks, videos, categories, lyrics and curated mixes load from Postgres;
  tracks can include an `audio_url`. A failed cloud load falls back to the
  bundled sample catalogue, never to the sample account's listening history.
- **Personal library** (`src/services/supabaseLibrary.ts`): likes, saved
  albums, follows, private playlists, recent searches and play history are
  scoped to the verified Supabase Auth user. `localStorage` uses a separate
  cache key per account; Realtime plus periodic refresh keeps other devices in
  sync. Cloud sync waits for the authenticated workspace RPC as a fail-closed
  migration check, while local edits stay in that account's cache. Collaborative
  playlist items are shared only with the paired workspace.
- **Workspaces** (`src/services/workspace.ts`): a signed-in account creates a
  one-time, seven-day invite for one other account. Invite tokens are hashed in
  Postgres, and a workspace can contain at most two authenticated users.
- **Listen Together** (`src/services/supabaseRoom.ts`): authenticated rooms
  belong to a paired workspace. Private Realtime channels carry playback
  broadcasts; online indicators come from Auth-bound `room_members` rows and
  server-timestamped heartbeat RPCs, not client-supplied presence identities.
  `room_playback` persists the current track, ordered queue, playback state and
  explicit seeks. `RoomSyncBridge` loads the saved snapshot before sending
  player state, preventing a late joiner's stale local queue from overwriting it.
- **Drive Music** (`src/pages/DriveMusic.tsx`): choose between a local device folder and an optional per-user Google Drive connection. The device picker scans nested folders and plays selected audio locally; files are never uploaded and the folder must be selected again after a refresh. Google Drive uses read-only consent, folder browsing, nested audio discovery, and real HTML audio playback. Vercel streams media through a same-origin, range-aware API; Google tokens are kept in HttpOnly cookies there and are never placed in media URLs. Non-Vercel development/static builds keep the short-lived Drive token in memory only and use a Blob fallback.

### Login (Supabase Auth)

`/#/login` retains the minimal Bloud login design and supports:

* **Email/password login and signup** through Supabase Auth. Sign-up derives the display name from the email because the supplied design has no name field.
* **Google sign-in** through Supabase OAuth. The original Google button now starts the provider redirect and returns users to the protected route they requested.
* **Cloud mode requires an authenticated account.** The guest/demo identity is never accepted by the cloud auth wall. When Supabase is not configured, the app runs as an offline local demo instead.
* **Optional Google Drive connection after login.** A one-time prompt offers a separate Google consent step; users can skip it and connect later from Drive Music. The requested Drive scope is read-only (`drive.readonly`), and the user can disconnect at any time. Drive access is bound to the signed-in Supabase user; guests do not get access to another user's Drive session.
* **Drive Music** offers a **This device** picker that scans a selected folder and its subfolders and plays audio through a temporary browser object URL. Selected files are not uploaded or saved by Bloud, so the folder must be chosen again after a refresh. The optional Google Drive source still lets users browse folders and stream audio: Vercel's `/api/drive/*` functions proxy folder listing and range-based playback. On Vercel, the Google access token is stored in a short-lived `HttpOnly` cookie, scoped to the Drive API, and is never added to URLs or browser storage. For Google Drive playback on non-Vercel builds, Bloud uses an in-memory token and a temporary Blob URL instead.
* **Route protection** is enforced by `src/components/auth/RequireAuth.tsx`; configured cloud deployments admit only authenticated users and return anonymous visitors to their requested route after sign-in.
* **Offline mode** remains available without Supabase environment variables; the auth wall is skipped, the bundled demo runs locally, and account/workspace sharing is clearly simulated rather than sent to a cloud identity.

### Google OAuth setup (required before Google sign-in/Drive can work)

1. In Google Cloud, create an OAuth **Web application** client and enable the Google Drive API. Add every app origin used for sign-in/Drive (for example `https://bloud-eta.vercel.app` and `http://localhost:5173`) to the client's authorized JavaScript origins. For Vercel preview domains, add the concrete preview origins you use.
2. Add the Supabase callback URL `https://gaewxsaaaraafyeltiiv.supabase.co/auth/v1/callback` to the client's authorized redirect URIs.
3. In Supabase **Authentication → Providers → Google**, enable Google and enter the Web client ID and client secret. The secret belongs only in Supabase's provider settings; do not put it in this repository, Vercel `VITE_*` variables, or chat. Keep the Supabase site URL and redirect allowlist configured for the production app and previews.
4. Set `VITE_GOOGLE_CLIENT_ID` to the same **public client ID** in Vercel (Production and Preview). Set server-function environment variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` so the Drive API can verify the current Bloud user. The existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are still needed by the browser app.
5. Add the `drive.readonly` scope to the Google OAuth consent screen and publish/allow test users as appropriate for your project. Drive consent is requested separately, after Bloud sign-in.

Email auth and signup remain configured through Supabase. If email confirmation is enabled, signup displays a notice to check the inbox; auto-confirm can be enabled for instant sign-in. Cloud data isolation depends on applying `20261112030000_private_workspace_security.sql`: it replaces the legacy permissive demo policies with authenticated per-user library rules, owner/workspace playlist rules, private room policies, and invite/room RPCs. The migration leaves old demo rows untouched and inaccessible to authenticated accounts; it does not convert demo identities into real users.

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

Base schema: `supabase/migrations/001_bloud_schema.sql` (historical demo schema). Before using a configured cloud deployment, apply the forward migration `supabase/migrations/20261112030000_private_workspace_security.sql` to the target Supabase project. It creates private two-person workspaces and hashed invitations, adds ownership/workspace columns, removes the permissive `demo_all` policies, and installs Auth-bound RLS for libraries, playlists, rooms, and private Realtime topics. Review and apply it through the normal Supabase migration workflow; do not expose a service-role key in the browser.

Seed data: `supabase/seed.sql` (generated). It remains demo data and is not migrated into authenticated users' personal libraries.

```bash
npm run db:seed:sql   # regenerate seed.sql from src/data/
npm run db:seed       # upsert catalogue/demo seed via a server-only service-role key
```

Tables: `app_users`, `artists`, `albums`, `tracks`, `videos`,
`categories`, `lyrics_sets`, `playlists`, `playlist_items`,
`liked_tracks`, `saved_albums`, `followed_artists`, `recent_searches`,
`play_history`, `continue_listening`, `workspaces`, `workspace_members`,
`workspace_invites`, `rooms`, `room_members`, `room_playback`, `room_events`.

## Deployment (Vercel)

1. Create the Vercel project from this repo (framework: Vite,
   build `npm run build`, output `dist`).
2. Set environment variables (Production + Preview):
   - `VITE_SUPABASE_URL` — `https://gaewxsaaaraafyeltiiv.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_…`
     (or `VITE_SUPABASE_ANON_KEY` with the legacy anon JWT)
   - `VITE_GOOGLE_CLIENT_ID` — the public OAuth Web client ID from the setup above
   - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` — for Drive API user verification
3. Deploy. `vercel.json` handles SPA rewrites and asset caching; `/api/drive/*` runs as Vercel Functions.
   `vite.config.ts` uses base `/` on Vercel and `/Bloud/` elsewhere
   (GitHub Pages).

Every push to the production branch redeploys automatically.
