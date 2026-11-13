import { catalogueData } from "../data/catalogue";
import { seedLibrary } from "../data/seed";
import { isSupabaseConfigured } from "../lib/supabase";
import type { Catalogue, LibraryState } from "../types";
import { createSimulatedEngine } from "./playbackEngine";
import { createMockRoomService } from "./room";
import { loadCatalogueFromSupabase } from "./supabaseCatalogue";
import { loadLibraryFromSupabase, subscribeToLibraryChanges, syncLibraryToSupabase } from "./supabaseLibrary";
import { createSupabaseRoomService } from "./supabaseRoom";
import type { CatalogueService, LibraryService } from "./types";

export * from "./types";
export { DEMO_ROOM_CODE } from "./room";
export { createSimulatedEngine };
export { isSupabaseConfigured };

/**
 * Catalogue: Supabase Postgres when configured (falls back to bundled data
 * on any error), otherwise the bundled sample catalogue with a small
 * artificial latency so loading states stay real.
 */
export const catalogueService: CatalogueService = {
  load: async (): Promise<Catalogue> => {
    if (isSupabaseConfigured) {
      const remote = await loadCatalogueFromSupabase();
      if (remote) return remote;
      // Never fall back to the bundled demo's personal listening history for an account.
      return new Promise<Catalogue>((resolve) => setTimeout(() => resolve({ ...catalogueData, continueListening: [] }), 650));
    }
    return new Promise<Catalogue>((resolve) => setTimeout(() => resolve(catalogueData), 650));
  },
};

const LIBRARY_CACHE_PREFIX = "bloud.library.v2:";
const LEGACY_DEMO_CACHE_KEY = "tandem.library.v1";
const emptyLibrary: LibraryState = {
  likedIds: [], savedAlbumIds: [], followedArtistIds: [], playlists: [],
  recentSearches: [], playHistory: [],
};

function validLibrary(value: unknown, fallback: LibraryState): LibraryState {
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<LibraryState>;
  return {
    likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds.filter((id): id is string => typeof id === "string") : fallback.likedIds,
    savedAlbumIds: Array.isArray(parsed.savedAlbumIds) ? parsed.savedAlbumIds.filter((id): id is string => typeof id === "string") : fallback.savedAlbumIds,
    followedArtistIds: Array.isArray(parsed.followedArtistIds) ? parsed.followedArtistIds.filter((id): id is string => typeof id === "string") : fallback.followedArtistIds,
    playlists: Array.isArray(parsed.playlists) ? parsed.playlists as LibraryState["playlists"] : fallback.playlists,
    recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches.filter((q): q is string => typeof q === "string") : fallback.recentSearches,
    playHistory: Array.isArray(parsed.playHistory) ? parsed.playHistory.filter((id): id is string => typeof id === "string") : fallback.playHistory,
  };
}

/**
 * Cloud caches are strictly account-scoped. The legacy shared cache is read
 * only in offline demo mode and is never copied into a signed-in account.
 */
export const libraryService: LibraryService = {
  load(scopeKey) {
    const fallback = scopeKey === "offline-demo" ? seedLibrary : emptyLibrary;
    try {
      const raw = localStorage.getItem(`${LIBRARY_CACHE_PREFIX}${scopeKey}`);
      if (raw) return validLibrary(JSON.parse(raw), fallback);
      if (scopeKey === "offline-demo") {
        const legacy = localStorage.getItem(LEGACY_DEMO_CACHE_KEY);
        if (legacy) return validLibrary(JSON.parse(legacy), seedLibrary);
      }
    } catch {
      /* Corrupt or unavailable storage only removes the local cache. */
    }
    return fallback;
  },
  save(state, scopeKey) {
    try {
      localStorage.setItem(`${LIBRARY_CACHE_PREFIX}${scopeKey}`, JSON.stringify(state));
    } catch {
      /* Storage quota/private mode: remote sync can still succeed. */
    }
  },
  loadRemote: isSupabaseConfigured ? loadLibraryFromSupabase : undefined,
  saveRemote: isSupabaseConfigured ? syncLibraryToSupabase : undefined,
  subscribeRemote: isSupabaseConfigured ? subscribeToLibraryChanges : undefined,
};

export const roomService = isSupabaseConfigured ? createSupabaseRoomService() : createMockRoomService();
