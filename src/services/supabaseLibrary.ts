/**
 * Per-user library backed by Supabase Postgres.
 *
 * - loadLibraryFromSupabase(): full LibraryState or null (→ local fallback)
 * - syncLibraryToSupabase(prev, next): diff-based writes so concurrent
 *   devices don't clobber each other; only changed rows are touched.
 * - subscribeToLibraryChanges(cb): Realtime postgres_changes on playlists /
 *   playlist_items / liked_tracks / saved_albums / followed_artists /
 *   recent_searches / play_history. Fires cb → caller reloads.
 */
import { LIBRARY_USER_ID, supabase } from "../lib/supabase";
import type { LibraryState, Playlist, UserId } from "../types";

type Row = Record<string, unknown>;

export async function loadLibraryFromSupabase(): Promise<LibraryState | null> {
  if (!supabase) return null;
  try {
    const [likedRes, savedRes, followedRes, playlistsRes, itemsRes, searchesRes, historyRes] =
      await Promise.all([
        supabase.from("liked_tracks").select("track_id").eq("user_id", LIBRARY_USER_ID),
        supabase.from("saved_albums").select("album_id").eq("user_id", LIBRARY_USER_ID),
        supabase.from("followed_artists").select("artist_id").eq("user_id", LIBRARY_USER_ID),
        supabase.from("playlists").select("*").eq("kind", "user").order("updated_at", { ascending: false }),
        supabase.from("playlist_items").select("*").order("position"),
        supabase
          .from("recent_searches")
          .select("query")
          .eq("user_id", LIBRARY_USER_ID)
          .order("searched_at", { ascending: false })
          .limit(8),
        supabase
          .from("play_history")
          .select("track_id")
          .eq("user_id", LIBRARY_USER_ID)
          .order("played_at", { ascending: false })
          .limit(30),
      ]);

    const err = [likedRes.error, savedRes.error, followedRes.error, playlistsRes.error, itemsRes.error, searchesRes.error, historyRes.error].find(Boolean);
    if (err) {
      console.warn("[bloud] library query failed, using local data:", err.message);
      return null;
    }

    const itemsByPlaylist = new Map<string, Row[]>();
    for (const r of (itemsRes.data ?? []) as Row[]) {
      const pid = String(r.playlist_id);
      const list = itemsByPlaylist.get(pid) ?? [];
      list.push(r);
      itemsByPlaylist.set(pid, list);
    }

    const playlists: Playlist[] = ((playlistsRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description ?? ""),
      ownerId: String(r.owner_id ?? "me") as Playlist["ownerId"],
      collaborative: Boolean(r.collaborative ?? false),
      kind: "user",
      art: r.art as Playlist["art"],
      createdAt: Number(r.created_at ?? 0),
      updatedAt: Number(r.updated_at ?? 0),
      items: (itemsByPlaylist.get(String(r.id)) ?? []).map((i) => ({
        trackId: String(i.track_id),
        addedBy: String(i.added_by ?? "me") as UserId,
        addedAt: Number(i.added_at ?? 0),
      })),
    }));

    return {
      likedIds: ((likedRes.data ?? []) as Row[]).map((r) => String(r.track_id)),
      savedAlbumIds: ((savedRes.data ?? []) as Row[]).map((r) => String(r.album_id)),
      followedArtistIds: ((followedRes.data ?? []) as Row[]).map((r) => String(r.artist_id)),
      playlists,
      recentSearches: ((searchesRes.data ?? []) as Row[]).map((r) => String(r.query)),
      playHistory: ((historyRes.data ?? []) as Row[]).map((r) => String(r.track_id)),
    };
  } catch (e) {
    console.warn("[bloud] library load failed, using local data:", e);
    return null;
  }
}

function diffIds(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  const p = new Set(prev);
  const n = new Set(next);
  return {
    added: next.filter((x) => !p.has(x)),
    removed: prev.filter((x) => !n.has(x)),
  };
}

export async function syncLibraryToSupabase(prev: LibraryState, next: LibraryState): Promise<void> {
  if (!supabase) return;
  const uid = LIBRARY_USER_ID;
  try {
    // --- liked / saved / followed (set diffs) ---
    const liked = diffIds(prev.likedIds, next.likedIds);
    if (liked.added.length) {
      await supabase.from("liked_tracks").insert(liked.added.map((track_id) => ({ user_id: uid, track_id })));
    }
    if (liked.removed.length) {
      await supabase.from("liked_tracks").delete().eq("user_id", uid).in("track_id", liked.removed);
    }

    const saved = diffIds(prev.savedAlbumIds, next.savedAlbumIds);
    if (saved.added.length) {
      await supabase.from("saved_albums").insert(saved.added.map((album_id) => ({ user_id: uid, album_id })));
    }
    if (saved.removed.length) {
      await supabase.from("saved_albums").delete().eq("user_id", uid).in("album_id", saved.removed);
    }

    const followed = diffIds(prev.followedArtistIds, next.followedArtistIds);
    if (followed.added.length) {
      await supabase.from("followed_artists").insert(followed.added.map((artist_id) => ({ user_id: uid, artist_id })));
    }
    if (followed.removed.length) {
      await supabase.from("followed_artists").delete().eq("user_id", uid).in("artist_id", followed.removed);
    }

    // --- playlists: upsert changed, delete removed, sync items ---
    const prevById = new Map(prev.playlists.map((p) => [p.id, p]));
    const nextById = new Map(next.playlists.map((p) => [p.id, p]));

    const removedPlaylists = prev.playlists.filter((p) => !nextById.has(p.id)).map((p) => p.id);
    if (removedPlaylists.length) {
      await supabase.from("playlists").delete().in("id", removedPlaylists);
    }

    for (const p of next.playlists) {
      const old = prevById.get(p.id);
      const metaChanged =
        !old ||
        old.name !== p.name ||
        old.description !== p.description ||
        old.collaborative !== p.collaborative ||
        old.updatedAt !== p.updatedAt;
      if (metaChanged) {
        await supabase.from("playlists").upsert(
          {
            id: p.id,
            name: p.name,
            description: p.description,
            owner_id: p.ownerId,
            collaborative: p.collaborative,
            kind: p.kind,
            art: p.art,
            created_at: p.createdAt,
            updated_at: p.updatedAt,
          },
          { onConflict: "id" },
        );
      }
      const oldItems = old?.items ?? [];
      const oldIds = new Set(oldItems.map((i) => i.trackId));
      const newIds = new Set(p.items.map((i) => i.trackId));
      const removedItems = oldItems.filter((i) => !newIds.has(i.trackId)).map((i) => i.trackId);
      if (removedItems.length) {
        await supabase.from("playlist_items").delete().eq("playlist_id", p.id).in("track_id", removedItems);
      }
      const addedItems = p.items.filter((i) => !oldIds.has(i.trackId));
      if (addedItems.length) {
        await supabase.from("playlist_items").insert(
          addedItems.map((item) => ({
            playlist_id: p.id,
            track_id: item.trackId,
            added_by: item.addedBy,
            added_at: item.addedAt,
            position: p.items.indexOf(item),
          })),
        );
      }
      // Re-order existing items if positions changed.
      const orderChanged = oldItems.some((i) => p.items.findIndex((x) => x.trackId === i.trackId) !== oldItems.indexOf(i));
      if (orderChanged && !addedItems.length && !removedItems.length) {
        for (const [idx, item] of p.items.entries()) {
          await supabase.from("playlist_items").update({ position: idx }).eq("playlist_id", p.id).eq("track_id", item.trackId);
        }
      }
    }

    // --- recent searches ---
    const searches = diffIds(prev.recentSearches, next.recentSearches);
    if (searches.added.length) {
      await supabase
        .from("recent_searches")
        .upsert(
          searches.added.map((query) => ({ user_id: uid, query, searched_at: new Date().toISOString() })),
          { onConflict: "user_id,query" },
        );
    }
    if (searches.removed.length) {
      await supabase.from("recent_searches").delete().eq("user_id", uid).in("query", searches.removed);
    }

    // --- play history (most-recent-first; stamp new head entries) ---
    const historyAdded = next.playHistory.filter((id) => !prev.playHistory.includes(id));
    if (historyAdded.length) {
      const now = Date.now();
      await supabase.from("play_history").upsert(
        historyAdded.map((track_id) => ({
          user_id: uid,
          track_id,
          played_at: new Date(now - next.playHistory.indexOf(track_id) * 1000).toISOString(),
        })),
        { onConflict: "user_id,track_id" },
      );
    }
  } catch (e) {
    console.warn("[bloud] library sync failed (local state kept):", e);
  }
}

/** Subscribe to remote library changes. Returns an unsubscribe function. */
export function subscribeToLibraryChanges(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("bloud-library")
    .on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "liked_tracks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "saved_albums" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "followed_artists" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "recent_searches" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "play_history" }, onChange)
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}
