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
    }
    return new Promise<Catalogue>((resolve) => setTimeout(() => resolve(catalogueData), 650));
  },
};

const STORAGE_KEY = "tandem.library.v1";

/**
 * Library: localStorage is the instant cache; Supabase is the source of
 * truth for cross-device sync when configured.
 */
export const libraryService: LibraryService = {
  load(): LibraryState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...seedLibrary, ...JSON.parse(raw) } as LibraryState;
    } catch {
      /* ignore corrupt storage */
    }
    return seedLibrary;
  },
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  },
  loadRemote: isSupabaseConfigured ? loadLibraryFromSupabase : undefined,
  saveRemote: isSupabaseConfigured ? syncLibraryToSupabase : undefined,
  subscribeRemote: isSupabaseConfigured ? subscribeToLibraryChanges : undefined,
};

export const roomService = isSupabaseConfigured ? createSupabaseRoomService() : createMockRoomService();
