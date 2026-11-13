/**
 * Account-scoped library persistence. Every user_id/owner_user_id used here
 * comes from Supabase Auth getUser(); RLS independently compares rows with
 * auth.uid(), so frontend-supplied IDs are never an authorization boundary.
 */
import { supabase } from "../lib/supabase";
import type { LibraryState, Playlist, UserId } from "../types";

type Row = Record<string, unknown>;
type DbError = { message: string } | null;

function assertNoError(table: string, error: DbError) {
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function verifiedUserId(expectedUserId?: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Your Bloud session expired. Sign in again to sync your library.");
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error("Your Bloud account changed. Reload the page before syncing this library.");
  }
  return data.user.id;
}

function userMarker(rawId: unknown, currentUserId: string): UserId {
  const id = String(rawId ?? "");
  if (id === currentUserId || id === "me") return "me";
  return "partner";
}

export async function loadLibraryFromSupabase(expectedUserId: string): Promise<LibraryState | null> {
  if (!supabase) return null;
  const userId = await verifiedUserId(expectedUserId);
  const [likedRes, savedRes, followedRes, playlistsRes, itemsRes, searchesRes, historyRes] = await Promise.all([
    supabase.from("liked_tracks").select("track_id").eq("user_id", userId),
    supabase.from("saved_albums").select("album_id").eq("user_id", userId),
    supabase.from("followed_artists").select("artist_id").eq("user_id", userId),
    // RLS returns only this account's private playlists and its workspace's shared playlists.
    supabase.from("playlists").select("*").eq("kind", "user").order("updated_at", { ascending: false }),
    supabase.from("playlist_items").select("*").order("position").order("added_at"),
    supabase.from("recent_searches").select("query").eq("user_id", userId).order("searched_at", { ascending: false }).limit(8),
    supabase.from("play_history").select("track_id").eq("user_id", userId).order("played_at", { ascending: false }).limit(30),
  ]);

  const firstError = [
    likedRes.error, savedRes.error, followedRes.error, playlistsRes.error,
    itemsRes.error, searchesRes.error, historyRes.error,
  ].find(Boolean);
  if (firstError) throw new Error(`Library load failed: ${firstError.message}`);
  // Playlist queries are filtered by RLS rather than a user_id predicate; a
  // second check prevents a concurrent account switch from caching the next
  // account's visible playlists under this account's local scope.
  await verifiedUserId(expectedUserId);

  const playlistRows = (playlistsRes.data ?? []) as Row[];
  const visiblePlaylistIds = new Set(playlistRows.map((row) => String(row.id)));
  const itemsByPlaylist = new Map<string, Row[]>();
  for (const row of (itemsRes.data ?? []) as Row[]) {
    const playlistId = String(row.playlist_id);
    if (!visiblePlaylistIds.has(playlistId)) continue;
    const list = itemsByPlaylist.get(playlistId) ?? [];
    list.push(row);
    itemsByPlaylist.set(playlistId, list);
  }

  const playlists: Playlist[] = playlistRows.map((row) => {
    const ownerUserId = typeof row.owner_user_id === "string" ? row.owner_user_id : null;
    const workspaceId = typeof row.workspace_id === "string" ? row.workspace_id : null;
    return {
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ""),
      ownerId: ownerUserId ? userMarker(ownerUserId, userId) : "tandem",
      ownerUserId,
      workspaceId,
      collaborative: Boolean(row.collaborative ?? false),
      kind: "user",
      art: row.art as Playlist["art"],
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
      items: (itemsByPlaylist.get(String(row.id)) ?? []).map((item) => ({
        trackId: String(item.track_id),
        addedBy: userMarker(item.added_by, userId),
        addedAt: Number(item.added_at ?? 0),
        position: Number(item.position ?? 0),
      })),
    };
  });

  return {
    likedIds: ((likedRes.data ?? []) as Row[]).map((row) => String(row.track_id)),
    savedAlbumIds: ((savedRes.data ?? []) as Row[]).map((row) => String(row.album_id)),
    followedArtistIds: ((followedRes.data ?? []) as Row[]).map((row) => String(row.artist_id)),
    playlists,
    recentSearches: ((searchesRes.data ?? []) as Row[]).map((row) => String(row.query)),
    playHistory: ((historyRes.data ?? []) as Row[]).map((row) => String(row.track_id)),
  };
}

function diffIds(previous: string[], next: string[]): { added: string[]; removed: string[] } {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    added: next.filter((value, index) => !previousSet.has(value) && next.indexOf(value) === index),
    removed: previous.filter((value) => !nextSet.has(value)),
  };
}

/**
 * Diff-based writes are idempotent so a partial network failure can retry from
 * the last acknowledged snapshot without duplicating library rows.
 */
export async function syncLibraryToSupabase(
  previous: LibraryState,
  next: LibraryState,
  expectedUserId: string,
  workspaceId: string | null,
): Promise<void> {
  if (!supabase) return;
  const userId = await verifiedUserId(expectedUserId);

  const liked = diffIds(previous.likedIds, next.likedIds);
  if (liked.added.length) {
    const { error } = await supabase.from("liked_tracks").upsert(
      liked.added.map((track_id) => ({ user_id: userId, track_id })),
      { onConflict: "user_id,track_id", ignoreDuplicates: true },
    );
    assertNoError("liked_tracks", error);
  }
  if (liked.removed.length) {
    const { error } = await supabase.from("liked_tracks").delete().eq("user_id", userId).in("track_id", liked.removed);
    assertNoError("liked_tracks", error);
  }

  const saved = diffIds(previous.savedAlbumIds, next.savedAlbumIds);
  if (saved.added.length) {
    const { error } = await supabase.from("saved_albums").upsert(
      saved.added.map((album_id) => ({ user_id: userId, album_id })),
      { onConflict: "user_id,album_id", ignoreDuplicates: true },
    );
    assertNoError("saved_albums", error);
  }
  if (saved.removed.length) {
    const { error } = await supabase.from("saved_albums").delete().eq("user_id", userId).in("album_id", saved.removed);
    assertNoError("saved_albums", error);
  }

  const followed = diffIds(previous.followedArtistIds, next.followedArtistIds);
  if (followed.added.length) {
    const { error } = await supabase.from("followed_artists").upsert(
      followed.added.map((artist_id) => ({ user_id: userId, artist_id })),
      { onConflict: "user_id,artist_id", ignoreDuplicates: true },
    );
    assertNoError("followed_artists", error);
  }
  if (followed.removed.length) {
    const { error } = await supabase.from("followed_artists").delete().eq("user_id", userId).in("artist_id", followed.removed);
    assertNoError("followed_artists", error);
  }

  const previousById = new Map(previous.playlists.map((playlist) => [playlist.id, playlist]));
  const nextById = new Map(next.playlists.map((playlist) => [playlist.id, playlist]));
  const removedOwned = previous.playlists
    .filter((playlist) => !nextById.has(playlist.id) && playlist.ownerUserId === userId)
    .map((playlist) => playlist.id);
  if (removedOwned.length) {
    const { error } = await supabase.from("playlists").delete().eq("owner_user_id", userId).in("id", removedOwned);
    assertNoError("playlists", error);
  }

  for (const playlist of next.playlists) {
    const previousPlaylist = previousById.get(playlist.id);
    const isOwner = playlist.ownerUserId === userId;
    const effectiveWorkspaceId = playlist.workspaceId ?? (playlist.collaborative ? workspaceId : null);

    if (isOwner) {
      if (playlist.collaborative && !effectiveWorkspaceId) {
        throw new Error("Create a shared workspace before making this playlist collaborative.");
      }
      const metadataChanged = !previousPlaylist
        || previousPlaylist.name !== playlist.name
        || previousPlaylist.description !== playlist.description
        || previousPlaylist.collaborative !== playlist.collaborative
        || previousPlaylist.workspaceId !== effectiveWorkspaceId
        || previousPlaylist.updatedAt !== playlist.updatedAt
        || previousPlaylist.art !== playlist.art;
      if (metadataChanged) {
        const { error } = await supabase.from("playlists").upsert({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          owner_id: userId,
          owner_user_id: userId,
          workspace_id: playlist.collaborative ? effectiveWorkspaceId : null,
          collaborative: playlist.collaborative,
          kind: "user",
          art: playlist.art,
          created_at: playlist.createdAt,
          updated_at: playlist.updatedAt,
        }, { onConflict: "id" });
        assertNoError("playlists", error);
      }
    }

    // Collaborators may change playlist items, but only the owner may change
    // playlist metadata or delete the playlist (enforced again by RLS).
    const previousItems = previousPlaylist?.items ?? [];
    const previousIds = new Set(previousItems.map((item) => item.trackId));
    const nextIds = new Set(playlist.items.map((item) => item.trackId));
    const removedItems = previousItems.filter((item) => !nextIds.has(item.trackId)).map((item) => item.trackId);
    if (removedItems.length) {
      const { error } = await supabase.from("playlist_items").delete()
        .eq("playlist_id", playlist.id).in("track_id", removedItems);
      assertNoError("playlist_items", error);
    }

    const addedItems = playlist.items.filter((item) => !previousIds.has(item.trackId));
    if (addedItems.length) {
      const { error } = await supabase.from("playlist_items").upsert(
        addedItems.map((item) => ({
          playlist_id: playlist.id,
          track_id: item.trackId,
          // The database trigger replaces this with auth.uid() for authenticated writes.
          added_by: userId,
          added_at: item.addedAt,
          position: playlist.items.findIndex((candidate) => candidate.trackId === item.trackId),
        })),
        { onConflict: "playlist_id,track_id", ignoreDuplicates: true },
      );
      assertNoError("playlist_items", error);
    }

    const oldOrder = previousItems.map((item) => item.trackId);
    const newOrder = playlist.items.map((item) => item.trackId);
    const orderChanged = oldOrder.length !== newOrder.length || oldOrder.some((id, index) => id !== newOrder[index]);
    if (orderChanged) {
      for (const [position, item] of playlist.items.entries()) {
        if (!previousIds.has(item.trackId)) continue;
        const { error } = await supabase.from("playlist_items").update({ position })
          .eq("playlist_id", playlist.id).eq("track_id", item.trackId);
        assertNoError("playlist_items", error);
      }
    }
  }

  const searches = diffIds(previous.recentSearches, next.recentSearches);
  if (searches.added.length) {
    const { error } = await supabase.from("recent_searches").upsert(
      searches.added.map((query) => ({ user_id: userId, query, searched_at: new Date().toISOString() })),
      { onConflict: "user_id,query" },
    );
    assertNoError("recent_searches", error);
  }
  if (searches.removed.length) {
    const { error } = await supabase.from("recent_searches").delete().eq("user_id", userId).in("query", searches.removed);
    assertNoError("recent_searches", error);
  }

  const historyAdded = next.playHistory.filter((trackId) => !previous.playHistory.includes(trackId));
  if (historyAdded.length) {
    const now = Date.now();
    const { error } = await supabase.from("play_history").upsert(
      historyAdded.map((track_id) => ({
        user_id: userId,
        track_id,
        played_at: new Date(now - next.playHistory.indexOf(track_id) * 1000).toISOString(),
      })),
      { onConflict: "user_id,track_id" },
    );
    assertNoError("play_history", error);
  }

  await verifiedUserId(expectedUserId);
}

/** RLS filters every event; explicit filters keep a large installation quiet. */
export function subscribeToLibraryChanges(
  onChange: () => void,
  expectedUserId: string,
  workspaceId: string | null,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase.channel(`bloud-library:${expectedUserId}`);
  for (const table of ["liked_tracks", "saved_albums", "followed_artists", "recent_searches", "play_history"]) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table, filter: `user_id=eq.${expectedUserId}`,
    }, onChange);
  }
  channel.on("postgres_changes", {
    event: "*", schema: "public", table: "playlists", filter: `owner_user_id=eq.${expectedUserId}`,
  }, onChange);
  if (workspaceId) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "playlists", filter: `workspace_id=eq.${workspaceId}`,
    }, onChange);
  }
  // Row-level policies restrict this subscription to playlist items the caller
  // can actually see; Postgres Changes does not support an array of playlist IDs.
  channel.on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, onChange);
  channel.subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}
