/**
 * Seed the Bloud Supabase project from the in-repo catalogue.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
 *   npx tsx scripts/seed.ts
 *
 * Safe to re-run: every insert is an upsert on the natural primary key.
 */
import { createClient } from "@supabase/supabase-js";
import { catalogueData } from "../src/data/catalogue";
import { seedLibrary } from "../src/data/seed";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsert(table: string, rows: unknown[], onConflict: string) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows as never[], { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  const c = catalogueData;
  console.log("Seeding Bloud…");

  await upsert(
    "app_users",
    Object.values(c.users).map((u) => ({
      id: u.id,
      display_name: u.name,
      initials: u.initials,
      color_a: u.colors[0],
      color_b: u.colors[1],
    })),
    "id",
  );

  await upsert(
    "artists",
    c.artists.map((a) => ({
      id: a.id,
      name: a.name,
      genre: a.genre,
      bio: a.bio,
      monthly_listeners: a.monthlyListeners,
      art: a.art,
    })),
    "id",
  );

  await upsert(
    "albums",
    c.albums.map((a) => ({
      id: a.id,
      title: a.title,
      artist_id: a.artistId,
      year: a.year,
      genre: a.genre,
      art: a.art,
      added_at: a.addedAt,
      track_ids: a.trackIds,
    })),
    "id",
  );

  await upsert(
    "tracks",
    c.tracks.map((t) => {
      const album = c.albums.find((a) => a.id === t.albumId);
      const position = album ? album.trackIds.indexOf(t.id) + 1 : 0;
      return {
        id: t.id,
        title: t.title,
        artist_id: t.artistId,
        album_id: t.albumId,
        duration: t.duration,
        genre: t.genre,
        art: t.art,
        added_at: t.addedAt,
        lyric_set: t.lyricSet,
        explicit: t.explicit ?? false,
        position,
      };
    }),
    "id",
  );

  await upsert(
    "videos",
    c.videos.map((v) => ({
      id: v.id,
      title: v.title,
      artist_id: v.artistId,
      track_id: v.trackId,
      duration: v.duration,
      year: v.year,
      views: v.views,
      art: v.art,
    })),
    "id",
  );

  await upsert(
    "categories",
    c.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      query: cat.query,
      color: cat.color,
      pattern: cat.pattern,
    })),
    "id",
  );

  await upsert(
    "lyrics_sets",
    c.lyrics.map((lines, i) => ({ id: i, lines })),
    "id",
  );

  const allPlaylists = [...c.mixes, ...seedLibrary.playlists];
  await upsert(
    "playlists",
    allPlaylists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      owner_id: p.ownerId,
      collaborative: p.collaborative,
      kind: p.kind,
      art: p.art,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
    "id",
  );

  await upsert(
    "playlist_items",
    allPlaylists.flatMap((p) =>
      p.items.map((item, i) => ({
        playlist_id: p.id,
        track_id: item.trackId,
        added_by: item.addedBy,
        added_at: item.addedAt,
        position: i,
      })),
    ),
    "playlist_id,track_id",
  );

  await upsert(
    "liked_tracks",
    seedLibrary.likedIds.map((track_id) => ({ user_id: "me", track_id })),
    "user_id,track_id",
  );
  await upsert(
    "saved_albums",
    seedLibrary.savedAlbumIds.map((album_id) => ({ user_id: "me", album_id })),
    "user_id,album_id",
  );
  await upsert(
    "followed_artists",
    seedLibrary.followedArtistIds.map((artist_id) => ({ user_id: "me", artist_id })),
    "user_id,artist_id",
  );
  await upsert(
    "recent_searches",
    seedLibrary.recentSearches.map((query, i) => ({
      user_id: "me",
      query,
      searched_at: new Date(Date.now() - i * 1000).toISOString(),
    })),
    "user_id,query",
  );
  await upsert(
    "play_history",
    seedLibrary.playHistory.map((track_id, i) => ({
      user_id: "me",
      track_id,
      played_at: new Date(Date.now() - i * 60_000).toISOString(),
    })),
    "user_id,track_id",
  );

  // Continue listening (clear first so re-seeds don't duplicate)
  await supabase.from("continue_listening").delete().eq("user_id", "me");
  await upsert(
    "continue_listening",
    c.continueListening.map((item) => ({
      user_id: "me",
      type: item.type,
      item_id: item.id,
      position: item.position,
    })),
    "id",
  );

  console.log("Done. Bloud is seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
