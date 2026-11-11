import { catalogueData } from "../data/catalogue";
import { seedLibrary } from "../data/seed";
import type { Catalogue, LibraryState } from "../types";
import { createSimulatedEngine } from "./playbackEngine";
import { createMockRoomService } from "./room";
import type { CatalogueService, LibraryService } from "./types";

export * from "./types";
export { DEMO_ROOM_CODE } from "./room";
export { createSimulatedEngine };

/** Mock catalogue with a small artificial latency so loading states are real. */
export const catalogueService: CatalogueService = {
  load: () => new Promise<Catalogue>((resolve) => setTimeout(() => resolve(catalogueData), 650)),
};

const STORAGE_KEY = "tandem.library.v1";

/** localStorage-backed library. Swap for Supabase queries keyed by the signed-in user. */
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
};

export const roomService = createMockRoomService();
