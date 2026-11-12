/**
 * Generate supabase/seed.sql from the in-repo catalogue (no network needed).
 * Run: npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from "node:fs";
import { catalogueData } from "../src/data/catalogue";
import { seedLibrary } from "../src/data/seed";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const arr = (xs: string[]) => `ARRAY[${xs.map(q).join(",")}]`;

const c = catalogueData;
const lines: string[] = [
  "-- Bloud seed — generated from src/data/catalogue.ts + src/data/seed.ts",
  "-- Re-runnable: every statement is an upsert on the natural key.",
  "",
];

lines.push("insert into public.app_users (id, display_name, initials, color_a, color_b) values");
lines.push(
  Object.values(c.users)
    .map((u) => `  (${q(u.id)}, ${q(u.name)}, ${q(u.initials)}, ${q(u.colors[0])}, ${q(u.colors[1])})`)
    .join(",\n") + "\non conflict (id) do update set display_name = excluded.display_name, initials = excluded.initials, color_a = excluded.color_a, color_b = excluded.color_b;\n",
);

lines.push("insert into public.artists (id, name, genre, bio, monthly_listeners, art) values");
lines.push(
  c.artists
    .map((a) => `  (${q(a.id)}, ${q(a.name)}, ${q(a.genre)}, ${q(a.bio)}, ${a.monthlyListeners}, ${j(a.art)})`)
    .join(",\n") + "\non conflict (id) do update set name = excluded.name, genre = excluded.genre, bio = excluded.bio, monthly_listeners = excluded.monthly_listeners, art = excluded.art;\n",
);

lines.push("insert into public.albums (id, title, artist_id, year, genre, art, added_at, track_ids) values");
lines.push(
  c.albums
    .map((a) => `  (${q(a.id)}, ${q(a.title)}, ${q(a.artistId)}, ${a.year}, ${q(a.genre)}, ${j(a.art)}, ${q(a.addedAt)}, ${arr(a.trackIds)})`)
    .join(",\n") + "\non conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, year = excluded.year, genre = excluded.genre, art = excluded.art, added_at = excluded.added_at, track_ids = excluded.track_ids;\n",
);

lines.push("insert into public.tracks (id, title, artist_id, album_id, duration, genre, art, added_at, lyric_set, explicit, position) values");
lines.push(
  c.tracks
    .map((t) => {
      const album = c.albums.find((a) => a.id === t.albumId);
      const position = album ? album.trackIds.indexOf(t.id) + 1 : 0;
      const lyric = t.lyricSet === null ? "null" : String(t.lyricSet);
      return `  (${q(t.id)}, ${q(t.title)}, ${q(t.artistId)}, ${q(t.albumId)}, ${t.duration}, ${q(t.genre)}, ${j(t.art)}, ${q(t.addedAt)}, ${lyric}, ${t.explicit ? "true" : "false"}, ${position})`;
    })
    .join(",\n") + "\non conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, album_id = excluded.album_id, duration = excluded.duration, genre = excluded.genre, art = excluded.art, added_at = excluded.added_at, lyric_set = excluded.lyric_set, explicit = excluded.explicit, position = excluded.position;\n",
);

lines.push("insert into public.videos (id, title, artist_id, track_id, duration, year, views, art) values");
lines.push(
  c.videos
    .map((v) => `  (${q(v.id)}, ${q(v.title)}, ${q(v.artistId)}, ${q(v.trackId)}, ${v.duration}, ${v.year}, ${q(v.views)}, ${j(v.art)})`)
    .join(",\n") + "\non conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, track_id = excluded.track_id, duration = excluded.duration, year = excluded.year, views = excluded.views, art = excluded.art;\n",
);

lines.push("insert into public.categories (id, name, query, color, pattern) values");
lines.push(
  c.categories
    .map((cat) => `  (${q(cat.id)}, ${q(cat.name)}, ${q(cat.query)}, ${q(cat.color)}, ${q(cat.pattern)})`)
    .join(",\n") + "\non conflict (id) do update set name = excluded.name, query = excluded.query, color = excluded.color, pattern = excluded.pattern;\n",
);

lines.push("insert into public.lyrics_sets (id, lines) values");
lines.push(
  c.lyrics.map((ls, i) => `  (${i}, ${arr(ls)})`).join(",\n") +
    "\non conflict (id) do update set lines = excluded.lines;\n",
);

const allPlaylists = [...c.mixes, ...seedLibrary.playlists];
lines.push("insert into public.playlists (id, name, description, owner_id, collaborative, kind, art, created_at, updated_at) values");
lines.push(
  allPlaylists
    .map((p) => `  (${q(p.id)}, ${q(p.name)}, ${q(p.description)}, ${q(p.ownerId)}, ${p.collaborative ? "true" : "false"}, ${q(p.kind)}, ${j(p.art)}, ${p.createdAt}, ${p.updatedAt})`)
    .join(",\n") + "\non conflict (id) do update set name = excluded.name, description = excluded.description, owner_id = excluded.owner_id, collaborative = excluded.collaborative, kind = excluded.kind, art = excluded.art, created_at = excluded.created_at, updated_at = excluded.updated_at;\n",
);

lines.push("insert into public.playlist_items (playlist_id, track_id, added_by, added_at, position) values");
lines.push(
  allPlaylists
    .flatMap((p) => p.items.map((item, i) => `  (${q(p.id)}, ${q(item.trackId)}, ${q(item.addedBy)}, ${item.addedAt}, ${i})`))
    .join(",\n") + "\non conflict (playlist_id, track_id) do update set added_by = excluded.added_by, added_at = excluded.added_at, position = excluded.position;\n",
);

lines.push("insert into public.liked_tracks (user_id, track_id) values");
lines.push(
  seedLibrary.likedIds.map((id) => `  ('me', ${q(id)})`).join(",\n") +
    "\non conflict (user_id, track_id) do nothing;\n",
);

lines.push("insert into public.saved_albums (user_id, album_id) values");
lines.push(
  seedLibrary.savedAlbumIds.map((id) => `  ('me', ${q(id)})`).join(",\n") +
    "\non conflict (user_id, album_id) do nothing;\n",
);

lines.push("insert into public.followed_artists (user_id, artist_id) values");
lines.push(
  seedLibrary.followedArtistIds.map((id) => `  ('me', ${q(id)})`).join(",\n") +
    "\non conflict (user_id, artist_id) do nothing;\n",
);

lines.push("insert into public.recent_searches (user_id, query, searched_at) values");
lines.push(
  seedLibrary.recentSearches
    .map((query, i) => `  ('me', ${q(query)}, now() - interval '${i * 60} seconds')`)
    .join(",\n") + "\non conflict (user_id, query) do update set searched_at = excluded.searched_at;\n",
);

lines.push("insert into public.play_history (user_id, track_id, played_at) values");
lines.push(
  seedLibrary.playHistory
    .map((id, i) => `  ('me', ${q(id)}, now() - interval '${i * 60} seconds')`)
    .join(",\n") + "\non conflict (user_id, track_id) do update set played_at = excluded.played_at;\n",
);

lines.push("delete from public.continue_listening where user_id = 'me';");
lines.push("insert into public.continue_listening (user_id, type, item_id, position) values");
lines.push(
  c.continueListening.map((item) => `  ('me', ${q(item.type)}, ${q(item.id)}, ${item.position})`).join(",\n") + ";\n",
);

writeFileSync("supabase/seed.sql", lines.join("\n"));
console.log(`Wrote supabase/seed.sql (${lines.join("\n").length} chars)`);
