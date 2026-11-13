/**
 * Catalogue backed by Supabase Postgres.
 * Returns null when Supabase is unconfigured / unreachable / empty so the
 * caller can fall back to the bundled sample catalogue.
 */
import { catalogueData } from "../data/catalogue";
import { supabase } from "../lib/supabase";
import type {
  Album,
  Artist,
  ArtSpec,
  Catalogue,
  Category,
  Playlist,
  Track,
  UserId,
  Video,
} from "../types";

type Row = Record<string, unknown>;

const art = (row: Row): ArtSpec => row.art as ArtSpec;

export async function loadCatalogueFromSupabase(): Promise<Catalogue | null> {
  if (!supabase) return null;
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    const userId = authData.user.id;

    // The forward security migration is a hard cloud-readiness gate. Without
    // its Auth-bound RPC, do not touch tables that may still have legacy demo RLS.
    const { error: securityMigrationError } = await supabase.rpc("get_my_workspace");
    if (securityMigrationError) {
      console.warn("[bloud] private cloud migration is not ready; using local catalogue:", securityMigrationError.message);
      return null;
    }

    const [
      artistsRes,
      albumsRes,
      tracksRes,
      videosRes,
      categoriesRes,
      lyricsRes,
      mixesRes,
      itemsRes,
      continueRes,
    ] = await Promise.all([
      supabase.from("artists").select("*").order("name"),
      supabase.from("albums").select("*").order("added_at", { ascending: false }),
      supabase.from("tracks").select("*").order("album_id").order("position"),
      supabase.from("videos").select("*"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("lyrics_sets").select("*").order("id"),
      supabase.from("playlists").select("*").eq("kind", "mix"),
      supabase.from("playlist_items").select("*").order("position"),
      supabase.from("continue_listening").select("*").eq("user_id", userId),
    ]);

    const firstError = [
      artistsRes.error,
      albumsRes.error,
      tracksRes.error,
      videosRes.error,
      categoriesRes.error,
      lyricsRes.error,
      mixesRes.error,
      itemsRes.error,
      continueRes.error,
    ].find(Boolean);
    if (firstError) {
      console.warn("[bloud] catalogue query failed, using local data:", firstError.message);
      return null;
    }

    const { data: currentAuth, error: currentAuthError } = await supabase.auth.getUser();
    if (currentAuthError || currentAuth.user?.id !== userId) return null;
    if (!(tracksRes.data ?? []).length) return null;

    const artists: Artist[] = ((artistsRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      genre: String(r.genre ?? ""),
      bio: String(r.bio ?? ""),
      monthlyListeners: Number(r.monthly_listeners ?? 0),
      art: art(r),
    }));

    const albums: Album[] = ((albumsRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      artistId: String(r.artist_id),
      year: Number(r.year ?? 2025),
      genre: String(r.genre ?? ""),
      art: art(r),
      addedAt: String(r.added_at),
      trackIds: (r.track_ids as string[] | null) ?? [],
    }));

    const tracks: Track[] = ((tracksRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      artistId: String(r.artist_id),
      albumId: String(r.album_id),
      duration: Number(r.duration ?? 0),
      genre: String(r.genre ?? ""),
      art: art(r),
      addedAt: String(r.added_at),
      lyricSet: (r.lyric_set as number | null) ?? null,
      explicit: Boolean(r.explicit ?? false),
      audioUrl: typeof r.audio_url === "string" ? r.audio_url : undefined,
    }));

    const videos: Video[] = ((videosRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      artistId: String(r.artist_id),
      trackId: String(r.track_id),
      duration: Number(r.duration ?? 0),
      year: Number(r.year ?? 2025),
      views: String(r.views ?? "0"),
      art: art(r),
    }));

    const categories: Category[] = ((categoriesRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      query: String(r.query ?? ""),
      color: String(r.color ?? "#333333"),
      pattern: String(r.pattern ?? "rings") as Category["pattern"],
    }));

    const lyrics: string[][] = ((lyricsRes.data ?? []) as Row[]).map(
      (r) => (r.lines as string[] | null) ?? [],
    );

    const itemsByPlaylist = new Map<string, Row[]>();
    for (const r of (itemsRes.data ?? []) as Row[]) {
      const pid = String(r.playlist_id);
      const list = itemsByPlaylist.get(pid) ?? [];
      list.push(r);
      itemsByPlaylist.set(pid, list);
    }

    const mixes: Playlist[] = ((mixesRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description ?? ""),
      ownerId: String(r.owner_id ?? "tandem") as Playlist["ownerId"],
      collaborative: Boolean(r.collaborative ?? false),
      kind: "mix",
      art: art(r),
      createdAt: Number(r.created_at ?? 0),
      updatedAt: Number(r.updated_at ?? 0),
      items: (itemsByPlaylist.get(String(r.id)) ?? []).map((i) => ({
        trackId: String(i.track_id),
        addedBy: String(i.added_by ?? "me") as UserId,
        addedAt: Number(i.added_at ?? 0),
      })),
    }));

    const continueListening = ((continueRes.data ?? []) as Row[]).map((r) => ({
      type: String(r.type) as "track" | "album",
      id: String(r.item_id),
      position: Number(r.position ?? 0),
    }));

    return {
      users: catalogueData.users,
      tracks,
      albums,
      artists,
      videos,
      mixes,
      categories,
      continueListening,
      lyrics,
    };
  } catch (e) {
    console.warn("[bloud] catalogue load failed, using local data:", e);
    return null;
  }
}
