import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { libraryService } from "../services";
import type { ArtSpec, LibraryState, Playlist, UserId } from "../types";
import { useCatalogue } from "./CatalogueContext";

interface LibraryApi extends LibraryState {
  isLiked(trackId: string): boolean;
  toggleLike(trackId: string): boolean;
  toggleAlbum(albumId: string): void;
  toggleFollow(artistId: string): void;
  createPlaylist(opts?: { trackIds?: string[]; name?: string }): string;
  updatePlaylist(id: string, patch: Partial<Pick<Playlist, "name" | "description" | "collaborative">>): void;
  deletePlaylist(id: string): void;
  addToPlaylist(id: string, trackIds: string[], by?: UserId): number;
  removeFromPlaylist(id: string, trackId: string): void;
  getPlaylist(id: string): Playlist | undefined;
  addRecentSearch(q: string): void;
  removeRecentSearch(q: string): void;
  clearRecentSearches(): void;
  pushHistory(trackId: string): void;
}

const Ctx = createContext<LibraryApi>(null!);

const PALETTES: ArtSpec["palette"][] = [
  ["#4fe3a1", "#06241a", "#b6ffdf"],
  ["#7b61ff", "#150b3d", "#d0c7ff"],
  ["#ff7a59", "#35120a", "#ffd0c2"],
  ["#37b6ff", "#08213a", "#c6ebff"],
  ["#ffcf4a", "#3a2a05", "#fff1c2"],
  ["#ff5fa2", "#3a0a24", "#ffc6df"],
];
const PATTERNS: ArtSpec["pattern"][] = ["rings", "waves", "orbit", "sun", "dunes", "split"];

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { data } = useCatalogue();
  const [state, setState] = useState<LibraryState>(() => libraryService.load());
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncedRef = useRef<LibraryState>(state);
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);

  // localStorage cache (instant, offline-first)
  useEffect(() => {
    libraryService.save(state);
  }, [state]);

  // Supabase is the source of truth when configured: hydrate once on mount,
  // then keep local state and the database in sync (debounced diff writes).
  useEffect(() => {
    if (!libraryService.loadRemote) return;
    let alive = true;
    libraryService
      .loadRemote()
      .then((remote) => {
        if (!alive || !remote) return;
        applyingRemoteRef.current = true;
        syncedRef.current = remote;
        setState(remote);
        hydratedRef.current = true;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!libraryService.saveRemote || !hydratedRef.current) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    const prev = syncedRef.current;
    const next = state;
    const timer = setTimeout(() => {
      void libraryService.saveRemote?.(prev, next).then(() => {
        syncedRef.current = next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // Cross-device updates: another device's write reloads our library.
  useEffect(() => {
    if (!libraryService.subscribeRemote || !libraryService.loadRemote) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = libraryService.subscribeRemote(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void libraryService.loadRemote?.().then((remote) => {
          if (!remote) return;
          applyingRemoteRef.current = true;
          syncedRef.current = remote;
          setState(remote);
        });
      }, 400);
    });
    return () => {
      clearTimeout(debounce);
      unsubscribe();
    };
  }, []);

  const patch = useCallback((fn: (s: LibraryState) => Partial<LibraryState>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);

  const api = useMemo<LibraryApi>(() => {
    const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]);
    const touch = (s: LibraryState, id: string, fn: (p: Playlist) => Playlist) =>
      s.playlists.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p));

    return {
      ...state,
      isLiked: (id) => state.likedIds.includes(id),
      toggleLike(id) {
        const liked = !stateRef.current.likedIds.includes(id);
        patch((s) => ({ likedIds: toggle(s.likedIds, id) }));
        return liked;
      },
      toggleAlbum: (id) => patch((s) => ({ savedAlbumIds: toggle(s.savedAlbumIds, id) })),
      toggleFollow: (id) => patch((s) => ({ followedArtistIds: toggle(s.followedArtistIds, id) })),
      createPlaylist(opts) {
        const n = stateRef.current.playlists.filter((p) => p.kind === "user").length + 1;
        const id = `pl-${Date.now().toString(36)}`;
        const now = Date.now();
        const playlist: Playlist = {
          id, name: opts?.name ?? `My playlist #${n}`, description: "", ownerId: "me", collaborative: false, kind: "user",
          createdAt: now, updatedAt: now,
          art: { palette: PALETTES[n % PALETTES.length], pattern: PATTERNS[n % PATTERNS.length], seed: n + 2 },
          items: (opts?.trackIds ?? []).map((trackId, i) => ({ trackId, addedBy: "me" as const, addedAt: now + i })),
        };
        patch((s) => ({ playlists: [playlist, ...s.playlists] }));
        return id;
      },
      updatePlaylist: (id, p) => patch((s) => ({ playlists: touch(s, id, (pl) => ({ ...pl, ...p })) })),
      deletePlaylist: (id) => patch((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      addToPlaylist(id, trackIds, by = "me") {
        const pl = stateRef.current.playlists.find((p) => p.id === id);
        if (!pl) return 0;
        const existing = new Set(pl.items.map((i) => i.trackId));
        const fresh = trackIds.filter((t, i) => !existing.has(t) && trackIds.indexOf(t) === i);
        if (!fresh.length) return 0;
        const now = Date.now();
        patch((s) => ({
          playlists: touch(s, id, (p) => ({
            ...p,
            items: [...p.items, ...fresh.map((trackId, i) => ({ trackId, addedBy: by, addedAt: now + i }))],
          })),
        }));
        return fresh.length;
      },
      removeFromPlaylist: (id, trackId) =>
        patch((s) => ({ playlists: touch(s, id, (p) => ({ ...p, items: p.items.filter((i) => i.trackId !== trackId) })) })),
      getPlaylist: (id) => state.playlists.find((p) => p.id === id) ?? data.mixes.find((p) => p.id === id),
      addRecentSearch(q) {
        const t = q.trim();
        if (t.length < 2) return;
        patch((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) }));
      },
      removeRecentSearch: (q) => patch((s) => ({ recentSearches: s.recentSearches.filter((x) => x !== q) })),
      clearRecentSearches: () => patch(() => ({ recentSearches: [] })),
      pushHistory: (id) => patch((s) => ({ playHistory: [id, ...s.playHistory.filter((x) => x !== id)].slice(0, 30) })),
    };
  }, [state, patch, data.mixes]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useLibrary = () => useContext(Ctx);
