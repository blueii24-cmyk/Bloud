import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { libraryService } from "../services";
import type { ArtSpec, LibraryState, Playlist, UserId } from "../types";
import { mergeLibraryChanges } from "../services/libraryMerge";
import { useAuth } from "./AuthContext";
import { useCatalogue } from "./CatalogueContext";
import { useWorkspace } from "./WorkspaceContext";

type SyncStatus = "local" | "loading" | "synced" | "pending" | "syncing" | "offline";

interface LibraryApi extends LibraryState {
  syncStatus: SyncStatus;
  syncError: string | null;
  isLiked(trackId: string): boolean;
  toggleLike(trackId: string): boolean;
  toggleAlbum(albumId: string): void;
  toggleFollow(artistId: string): void;
  createPlaylist(opts?: { trackIds?: string[]; name?: string }): string;
  updatePlaylist(id: string, patch: Partial<Pick<Playlist, "name" | "description" | "collaborative">>): boolean;
  deletePlaylist(id: string): void;
  addToPlaylist(id: string, trackIds: string[], by?: UserId): number;
  removeFromPlaylist(id: string, trackId: string): void;
  getPlaylist(id: string): Playlist | undefined;
  addRecentSearch(q: string): void;
  removeRecentSearch(q: string): void;
  clearRecentSearches(): void;
  pushHistory(trackId: string): void;
}

interface LibrarySlot {
  scopeKey: string;
  state: LibraryState;
}
interface SyncSlot {
  scopeKey: string;
  status: SyncStatus;
  error: string | null;
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

function makePlaylistId(): string {
  return `pl-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { data } = useCatalogue();
  const auth = useAuth();
  const workspace = useWorkspace();
  const userId = auth.status === "authed" ? auth.user?.id ?? null : null;
  const cloudAccount = Boolean(
    userId && auth.configured && libraryService.loadRemote && libraryService.saveRemote,
  );
  // Workspace resolution is the migration/security readiness gate: do not use
  // the cloud until its Auth-bound RPC confirms the private RLS migration.
  const cloudEnabled = Boolean(cloudAccount && workspace.status === "ready" && !workspace.error);
  const scopeKey = userId ? `account:${userId}` : auth.walled ? "signed-out" : "offline-demo";

  const [slot, setSlot] = useState<LibrarySlot>(() => ({ scopeKey, state: libraryService.load(scopeKey) }));
  const state = slot.scopeKey === scopeKey ? slot.state : libraryService.load(scopeKey);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;

  const [syncSlot, setSyncSlot] = useState<SyncSlot>({ scopeKey, status: cloudEnabled ? "loading" : "local", error: null });
  const sync = syncSlot.scopeKey === scopeKey
    ? syncSlot
    : { scopeKey, status: cloudEnabled ? "loading" as const : "local" as const, error: null };

  const syncedRef = useRef<LibraryState>(state);
  const pendingBaseRef = useRef<LibraryState>(state);
  const pendingRef = useRef(false);
  const hydratedScopeRef = useRef<string | null>(null);
  const baselineScopeRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);
  const stateVersionRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const refreshRemoteRef = useRef<(() => Promise<void>) | null>(null);
  const [syncPulse, setSyncPulse] = useState(0);

  const setSync = useCallback((key: string, status: SyncStatus, error: string | null = null) => {
    if (scopeKeyRef.current === key) setSyncSlot({ scopeKey: key, status, error });
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const scheduleRetry = useCallback((key: string) => {
    if (retryTimerRef.current || scopeKeyRef.current !== key) return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryCountRef.current, 5));
    retryCountRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (scopeKeyRef.current !== key) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSync(key, "offline", "You're offline. Changes are saved on this device and will sync when you're back online.");
        return;
      }
      if (hydratedScopeRef.current === key) setSyncPulse((pulse) => pulse + 1);
      else void refreshRemoteRef.current?.();
    }, delay);
  }, [setSync]);

  // Keep a synchronous local cache for each verified account. The old shared
  // demo cache is read only by the offline-demo scope.
  useEffect(() => {
    libraryService.save(state, scopeKey);
  }, [state, scopeKey]);

  // Hydrate from the authenticated account; if an offline edit races the fetch,
  // rebase just those edits on top of the server snapshot before syncing.
  useEffect(() => {
    const key = scopeKey;
    clearRetry();
    const newScope = baselineScopeRef.current !== key;
    const cached = libraryService.load(key);
    if (newScope) {
      baselineScopeRef.current = key;
      retryCountRef.current = 0;
      hydratedScopeRef.current = null;
      pendingRef.current = false;
      stateVersionRef.current = 0;
      syncedRef.current = cached;
      pendingBaseRef.current = cached;
    }
    setSync(key, cloudEnabled ? "loading" : "local");

    if (!cloudEnabled || !userId || !libraryService.loadRemote) {
      hydratedScopeRef.current = key;
      if (newScope) setSlot({ scopeKey: key, state: cached });
      return () => clearRetry();
    }

    // Hold writes until the account-scoped server snapshot has been merged.
    hydratedScopeRef.current = null;

    let alive = true;
    let request = 0;
    const refresh = async () => {
      const currentRequest = ++request;
      try {
        const remote = await libraryService.loadRemote!(userId);
        if (!alive || scopeKeyRef.current !== key || currentRequest !== request || !remote) return;
        const current = stateRef.current;
        if (pendingRef.current) {
          const base = pendingBaseRef.current;
          const rebased = mergeLibraryChanges(base, current, remote, userId);
          syncedRef.current = remote;
          pendingBaseRef.current = remote;
          hydratedScopeRef.current = key;
          pendingRef.current = JSON.stringify(rebased) !== JSON.stringify(remote);
          stateVersionRef.current += 1;
          setSlot({ scopeKey: key, state: rebased });
          setSync(key, pendingRef.current ? "pending" : "synced");
        } else {
          syncedRef.current = remote;
          pendingBaseRef.current = remote;
          hydratedScopeRef.current = key;
          applyingRemoteRef.current = true;
          setSlot({ scopeKey: key, state: remote });
          setSync(key, "synced");
        }
        retryCountRef.current = 0;
        clearRetry();
      } catch (reason) {
        if (!alive || scopeKeyRef.current !== key) return;
        // Use this account's cache as the diff baseline; do not seed cloud rows
        // or erase server records merely because the network is unavailable.
        if (newScope) {
          syncedRef.current = cached;
          pendingBaseRef.current = cached;
        }
        hydratedScopeRef.current = key;
        const message = reason instanceof Error ? reason.message : "Couldn't sync your library right now.";
        setSync(key, "offline", message);
        scheduleRetry(key);
      }
    };
    refreshRemoteRef.current = refresh;
    void refresh();
    return () => {
      alive = false;
      request += 1;
      if (refreshRemoteRef.current === refresh) refreshRemoteRef.current = null;
      clearRetry();
    };
  }, [scopeKey, userId, cloudEnabled, clearRetry, scheduleRetry, setSync]);

  // Debounced, serialised writes. The last acknowledged snapshot advances only
  // after every Supabase request succeeds; failures retain the local delta.
  useEffect(() => {
    if (!cloudEnabled || !userId || !libraryService.saveRemote || hydratedScopeRef.current !== scopeKey) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    if (!pendingRef.current) return;

    const key = scopeKey;
    const timer = setTimeout(() => {
      syncChainRef.current = syncChainRef.current.catch(() => undefined).then(async () => {
        if (scopeKeyRef.current !== key || !pendingRef.current) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSync(key, "offline", "You're offline. Changes are saved on this device and will sync when you're back online.");
          scheduleRetry(key);
          return;
        }
        const version = stateVersionRef.current;
        const next = stateRef.current;
        const previous = syncedRef.current;
        syncInFlightRef.current = true;
        setSync(key, "syncing");
        try {
          await libraryService.saveRemote!(previous, next, userId, workspace.id);
          if (scopeKeyRef.current !== key) return;
          syncedRef.current = next;
          pendingBaseRef.current = next;
          retryCountRef.current = 0;
          clearRetry();
          if (version === stateVersionRef.current) {
            pendingRef.current = false;
            setSync(key, "synced");
            // Pull once after a write so concurrent changes from the other
            // member are merged even when Realtime replication is unavailable.
            try {
              const latest = await libraryService.loadRemote?.(userId);
              if (latest && scopeKeyRef.current === key && version === stateVersionRef.current && !pendingRef.current) {
                syncedRef.current = latest;
                pendingBaseRef.current = latest;
                applyingRemoteRef.current = true;
                setSlot({ scopeKey: key, state: latest });
              }
            } catch {
              /* The acknowledged write stays synced; the next refresh retries. */
            }
          } else {
            setSync(key, "pending");
          }
        } catch (reason) {
          if (scopeKeyRef.current !== key) return;
          const message = reason instanceof Error ? reason.message : "Couldn't sync your library right now.";
          setSync(key, "offline", message);
          scheduleRetry(key);
        } finally {
          syncInFlightRef.current = false;
        }
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [state, scopeKey, userId, cloudEnabled, workspace.id, syncPulse, clearRetry, scheduleRetry, setSync]);

  // Cross-device updates reload through RLS. Polling/visibility refresh is a
  // fallback for projects whose Postgres Changes replication is disconnected.
  useEffect(() => {
    if (!cloudEnabled || !userId || !libraryService.subscribeRemote) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!syncInFlightRef.current) void refreshRemoteRef.current?.();
      }, 350);
    };
    const unsubscribe = libraryService.subscribeRemote(refresh, userId, workspace.id);
    const poll = window.setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const onOnline = () => {
      retryCountRef.current = 0;
      if (hydratedScopeRef.current === scopeKey) setSyncPulse((pulse) => pulse + 1);
      else void refreshRemoteRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      unsubscribe();
    };
  }, [cloudEnabled, userId, workspace.id, scopeKey]);

  const patch = useCallback((fn: (current: LibraryState) => Partial<LibraryState>) => {
    if (cloudAccount) {
      if (!pendingRef.current) pendingBaseRef.current = syncedRef.current;
      pendingRef.current = true;
      stateVersionRef.current += 1;
      setSync(scopeKey, cloudEnabled ? "pending" : "local");
    }
    setSlot((current) => {
      const base = current.scopeKey === scopeKey ? current.state : libraryService.load(scopeKey);
      return { scopeKey, state: { ...base, ...fn(base) } };
    });
  }, [cloudAccount, cloudEnabled, scopeKey, setSync]);

  const api = useMemo<LibraryApi>(() => {
    const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((value) => value !== id) : [id, ...list];
    const touch = (current: LibraryState, id: string, fn: (playlist: Playlist) => Playlist) =>
      current.playlists.map((playlist) => playlist.id === id ? { ...fn(playlist), updatedAt: Date.now() } : playlist);

    return {
      ...state,
      syncStatus: sync.status,
      syncError: sync.error,
      isLiked: (id) => state.likedIds.includes(id),
      toggleLike(id) {
        const liked = !stateRef.current.likedIds.includes(id);
        patch((current) => ({ likedIds: toggle(current.likedIds, id) }));
        return liked;
      },
      toggleAlbum: (id) => patch((current) => ({ savedAlbumIds: toggle(current.savedAlbumIds, id) })),
      toggleFollow: (id) => patch((current) => ({ followedArtistIds: toggle(current.followedArtistIds, id) })),
      createPlaylist(opts) {
        const current = stateRef.current;
        const count = current.playlists.filter((playlist) => playlist.kind === "user").length + 1;
        const now = Date.now();
        const id = makePlaylistId();
        const playlist: Playlist = {
          id,
          name: opts?.name ?? `My playlist #${count}`,
          description: "",
          ownerId: "me",
          ownerUserId: userId,
          workspaceId: null,
          collaborative: false,
          kind: "user",
          createdAt: now,
          updatedAt: now,
          art: { palette: PALETTES[count % PALETTES.length], pattern: PATTERNS[count % PATTERNS.length], seed: count + 2 },
          items: (opts?.trackIds ?? []).map((trackId, index) => ({ trackId, addedBy: "me", addedAt: now + index, position: index })),
        };
        patch((currentState) => ({ playlists: [playlist, ...currentState.playlists] }));
        return id;
      },
      updatePlaylist(id, changes) {
        const playlist = stateRef.current.playlists.find((item) => item.id === id);
        if (!playlist) return false;
        if (cloudAccount && playlist.ownerUserId !== userId) return false;
        if (cloudAccount && changes.collaborative && (!workspace.paired || workspace.error)) return false;
        patch((current) => ({
          playlists: touch(current, id, (item) => ({
            ...item,
            ...changes,
            workspaceId: changes.collaborative === undefined
              ? item.workspaceId
              : changes.collaborative ? (item.workspaceId ?? workspace.id) : null,
          })),
        }));
        return true;
      },
      deletePlaylist(id) {
        const playlist = stateRef.current.playlists.find((item) => item.id === id);
        if (!playlist || (cloudAccount && playlist.ownerUserId !== userId)) return;
        patch((current) => ({ playlists: current.playlists.filter((item) => item.id !== id) }));
      },
      addToPlaylist(id, trackIds, by = "me") {
        const playlist = stateRef.current.playlists.find((item) => item.id === id);
        if (!playlist) return 0;
        if (cloudAccount && playlist.ownerUserId !== userId && (!workspace.paired || !playlist.collaborative || playlist.workspaceId !== workspace.id)) return 0;
        const existing = new Set(playlist.items.map((item) => item.trackId));
        const fresh = trackIds.filter((trackId, index) => !existing.has(trackId) && trackIds.indexOf(trackId) === index);
        if (!fresh.length) return 0;
        const now = Date.now();
        const adder: UserId = cloudAccount ? "me" : by;
        patch((current) => ({
          playlists: touch(current, id, (item) => ({
            ...item,
            items: [...item.items, ...fresh.map((trackId, index) => ({
              trackId, addedBy: adder, addedAt: now + index, position: item.items.length + index,
            }))],
          })),
        }));
        return fresh.length;
      },
      removeFromPlaylist(id, trackId) {
        const playlist = stateRef.current.playlists.find((item) => item.id === id);
        if (cloudAccount && playlist && playlist.ownerUserId !== userId && (!workspace.paired || !playlist.collaborative || playlist.workspaceId !== workspace.id)) return;
        patch((current) => ({
          playlists: touch(current, id, (item) => ({ ...item, items: item.items.filter((entry) => entry.trackId !== trackId) })),
        }));
      },
      getPlaylist: (id) => state.playlists.find((playlist) => playlist.id === id) ?? data.mixes.find((playlist) => playlist.id === id),
      addRecentSearch(query) {
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        patch((current) => ({ recentSearches: [trimmed, ...current.recentSearches.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8) }));
      },
      removeRecentSearch: (query) => patch((current) => ({ recentSearches: current.recentSearches.filter((entry) => entry !== query) })),
      clearRecentSearches: () => patch(() => ({ recentSearches: [] })),
      pushHistory: (trackId) => patch((current) => ({ playHistory: [trackId, ...current.playHistory.filter((id) => id !== trackId)].slice(0, 30) })),
    };
  }, [state, sync.status, sync.error, patch, data.mixes, userId, workspace.id, workspace.paired, workspace.error, cloudEnabled, cloudAccount]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useLibrary = () => useContext(Ctx);
