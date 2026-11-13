import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { createSimulatedEngine } from "../services";
import type { QueueItem, RepeatMode, Track, UserId } from "../types";
import { shuffleArray } from "../utils/format";
import { useAuth } from "./AuthContext";
import { useCatalogue } from "./CatalogueContext";
import { useLibrary } from "./LibraryContext";
import { useUI } from "./UIContext";

interface PlayContext {
  label: string;
  trackIds: string[];
}

interface PlayerState {
  current: QueueItem | null;
  upNext: QueueItem[];
  history: QueueItem[];
  playing: boolean;
  seekRevision: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  context: PlayContext | null;
  /** uid order before shuffling, used to restore order */
  unshuffled: string[] | null;
}

interface PlayOptions {
  label?: string;
  /** force shuffle on/off; true also picks a random starting track */
  shuffle?: boolean;
  startAt?: number;
  addedBy?: UserId;
}

interface PlayerActions {
  playTracks(trackIds: string[], index?: number, opts?: PlayOptions): void;
  togglePlay(): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  skipTo(uid: string): void;
  addToQueue(trackIds: string[], opts?: { next?: boolean; addedBy?: UserId }): void;
  removeFromQueue(uid: string): void;
  clearQueue(): void;
  moveInQueue(from: number, to: number): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  setVolume(v: number): void;
  toggleMute(): void;
  applyRemotePlayback(event: { trackId: string | null; queueTrackIds: string[]; queueAddedBy: UserId[]; positionSec: number; isPlaying: boolean }): void;
}

interface PlayerValue extends PlayerState, PlayerActions {
  track: Track | null;
}

const initialState: PlayerState = {
  current: null, upNext: [], history: [], playing: false, shuffle: false, repeat: "off",
  volume: 0.8, muted: false, context: null, unshuffled: null, seekRevision: 0,
};

const Ctx = createContext<PlayerValue>(null!);
interface ProgressStore {
  subscribe(l: () => void): () => void;
  get(): number;
}
const ProgressCtx = createContext<ProgressStore>(null!);

let uidCounter = 0;
const makeItem = (trackId: string, addedBy: UserId = "me"): QueueItem => ({ uid: `q${++uidCounter}`, trackId, addedBy });

export function PlayerProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { ready, trackById } = useCatalogue();
  const library = useLibrary();
  const ui = useUI();
  const [engine] = useState(createSimulatedEngine);
  const [state, setState] = useState<PlayerState>(initialState);

  const playbackScope = auth.status === "authed" && auth.user
    ? `account:${auth.user.id}`
    : auth.walled ? "signed-out" : "offline-demo";
  const previousPlaybackScopeRef = useRef(playbackScope);
  // Hide the previous account's queue synchronously on account changes; the
  // effect below then resets the engine and state for the new scope.
  const scopedState = previousPlaybackScopeRef.current === playbackScope ? state : initialState;
  const stateRef = useRef(scopedState);
  stateRef.current = scopedState;
  const tracksRef = useRef(trackById);
  tracksRef.current = trackById;
  const libRef = useRef(library);
  libRef.current = library;

  // ----- progress store (kept out of React state so only progress UI re-renders)
  const progress = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const store = useMemo<ProgressStore>(
    () => ({
      subscribe: (l) => {
        listeners.current.add(l);
        return () => listeners.current.delete(l);
      },
      get: () => progress.current,
    }),
    [],
  );

  useEffect(
    () =>
      engine.onTick((p) => {
        progress.current = p;
        listeners.current.forEach((l) => l());
      }),
    [engine],
  );

  useEffect(() => engine.onError((message) => {
    const next = { ...stateRef.current, playing: false };
    stateRef.current = next;
    setState(next);
    ui.notify(message);
  }), [engine, ui.notify]);

  const actions = useMemo<PlayerActions>(() => {
    const commit = (next: PlayerState) => {
      stateRef.current = next;
      setState(next);
    };
    const start = (item: QueueItem, startAt: number, play: boolean) => {
      const t = tracksRef.current.get(item.trackId);
      if (!t) return;
      engine.load(t.id, t.duration, startAt, t.audioUrl);
      if (play) {
        engine.play();
        libRef.current.pushHistory(t.id);
      } else {
        engine.pause();
      }
    };
    const setPosition = (seconds: number) => {
      const current = stateRef.current;
      engine.seek(seconds);
      commit({ ...current, seekRevision: current.seekRevision + 1 });
    };

    const advance = (auto: boolean) => {
      const s = stateRef.current;
      if (!s.current) return;
      if (auto && s.repeat === "one") {
        setPosition(0);
        engine.play();
        commit({ ...stateRef.current, playing: true });
        return;
      }
      if (s.upNext.length) {
        const [n, ...rest] = s.upNext;
        commit({ ...s, current: n, upNext: rest, history: [...s.history, s.current], playing: true });
        start(n, 0, true);
        return;
      }
      if (s.repeat === "all" && s.context) {
        let items = s.context.trackIds.map((id) => makeItem(id));
        if (s.shuffle) items = shuffleArray(items);
        const [n, ...rest] = items;
        commit({ ...s, current: n, upNext: rest, history: [], playing: true, unshuffled: items.map((i) => i.uid) });
        start(n, 0, true);
        return;
      }
      // End of queue: stop on the last track, rewound.
      commit({ ...s, playing: false });
      start(s.current, 0, false);
    };

    return {
      playTracks(ids, index = 0, opts = {}) {
        if (!ids.length) return;
        const s = stateRef.current;
        const items = ids.map((id) => makeItem(id, opts.addedBy ?? "me"));
        const shuffle = opts.shuffle ?? s.shuffle;
        let current: QueueItem;
        let upNext: QueueItem[];
        let history: QueueItem[] = [];
        let unshuffled: string[] | null = null;
        if (shuffle) {
          const startIdx = opts.shuffle ? Math.floor(Math.random() * items.length) : index;
          current = items[startIdx];
          upNext = shuffleArray(items.filter((_, i) => i !== startIdx));
          unshuffled = items.map((i) => i.uid);
        } else {
          current = items[index];
          history = items.slice(0, index);
          upNext = items.slice(index + 1);
        }
        commit({ ...s, current, upNext, history, shuffle, playing: true, unshuffled, context: { label: opts.label ?? "Queue", trackIds: ids } });
        start(current, opts.startAt ?? 0, true);
      },

      togglePlay() {
        const s = stateRef.current;
        if (!s.current) return;
        if (s.playing) {
          engine.pause();
        } else {
          const t = tracksRef.current.get(s.current.trackId);
          if (t && progress.current >= t.duration - 0.25) engine.seek(0);
          engine.play();
        }
        commit({ ...s, playing: !s.playing });
      },

      next: () => advance(false),

      previous() {
        const s = stateRef.current;
        if (!s.current) return;
        if (progress.current > 3 || !s.history.length) {
          setPosition(0);
          return;
        }
        const prev = s.history[s.history.length - 1];
        commit({ ...s, current: prev, upNext: [s.current, ...s.upNext], history: s.history.slice(0, -1), playing: true });
        start(prev, 0, true);
      },

      seek: setPosition,

      skipTo(uid) {
        const s = stateRef.current;
        const i = s.upNext.findIndex((q) => q.uid === uid);
        if (i < 0 || !s.current) return;
        const target = s.upNext[i];
        commit({
          ...s, current: target, upNext: s.upNext.slice(i + 1),
          history: [...s.history, s.current, ...s.upNext.slice(0, i)], playing: true,
        });
        start(target, 0, true);
      },

      addToQueue(ids, opts = {}) {
        const s = stateRef.current;
        const items = ids.map((id) => makeItem(id, opts.addedBy ?? "me"));
        if (!s.current) {
          const [first, ...rest] = items;
          commit({ ...s, current: first, upNext: rest, playing: true, context: { label: "Queue", trackIds: ids } });
          start(first, 0, true);
          return;
        }
        commit({ ...s, upNext: opts.next ? [...items, ...s.upNext] : [...s.upNext, ...items], unshuffled: s.unshuffled ? [...s.unshuffled, ...items.map((i) => i.uid)] : null });
      },

      removeFromQueue(uid) {
        const s = stateRef.current;
        commit({ ...s, upNext: s.upNext.filter((q) => q.uid !== uid) });
      },

      clearQueue() {
        const s = stateRef.current;
        commit({ ...s, upNext: [], unshuffled: null });
      },

      moveInQueue(from, to) {
        const s = stateRef.current;
        if (from === to || from < 0 || to < 0 || from >= s.upNext.length || to >= s.upNext.length) return;
        const list = [...s.upNext];
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        commit({ ...s, upNext: list });
      },

      toggleShuffle() {
        const s = stateRef.current;
        if (!s.shuffle) {
          commit({ ...s, shuffle: true, upNext: shuffleArray(s.upNext), unshuffled: [...(s.current ? [s.current.uid] : []), ...s.upNext.map((q) => q.uid)] });
        } else {
          const order = s.unshuffled ?? [];
          const rank = (q: QueueItem) => {
            const i = order.indexOf(q.uid);
            return i < 0 ? Number.MAX_SAFE_INTEGER : i;
          };
          commit({ ...s, shuffle: false, upNext: [...s.upNext].sort((a, b) => rank(a) - rank(b)), unshuffled: null });
        }
      },

      cycleRepeat() {
        const s = stateRef.current;
        const next: RepeatMode = s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off";
        commit({ ...s, repeat: next });
      },

      setVolume(v) {
        const s = stateRef.current;
        engine.setVolume(v);
        commit({ ...s, volume: v, muted: v === 0 });
      },

      toggleMute() {
        const s = stateRef.current;
        const muted = !s.muted;
        engine.setVolume(muted ? 0 : s.volume || 0.5);
        commit({ ...s, muted, volume: !muted && s.volume === 0 ? 0.5 : s.volume });
      },

      applyRemotePlayback(event) {
        const s = stateRef.current;
        const requestedTrackId = typeof event.trackId === "string" ? event.trackId : null;
        const remoteEntries = event.queueTrackIds
          .slice(0, 200)
          .map((trackId, index) => ({ trackId, addedBy: event.queueAddedBy[index] ?? "partner" }))
          .filter((entry) => typeof entry.trackId === "string" && tracksRef.current.has(entry.trackId));
        const safePosition = Number.isFinite(event.positionSec) ? Math.max(0, event.positionSec) : 0;

        if (!requestedTrackId) {
          const nextItems = remoteEntries.map((entry) => makeItem(entry.trackId, entry.addedBy));
          const remoteIds = remoteEntries.map((entry) => entry.trackId);
          engine.pause();
          engine.load("", 0, 0);
          progress.current = 0;
          listeners.current.forEach((listener) => listener());
          commit({
            ...s,
            current: null,
            upNext: nextItems,
            history: s.current ? [...s.history, s.current].slice(-50) : s.history,
            playing: false,
            context: nextItems.length ? { label: "Listen Together", trackIds: remoteIds } : null,
            unshuffled: null,
            seekRevision: s.seekRevision + 1,
          });
          return;
        }

        const track = tracksRef.current.get(requestedTrackId);
        if (!track) return;
        const currentIndex = remoteEntries.findIndex((entry) => entry.trackId === requestedTrackId);
        let orderedEntries = remoteEntries;
        if (currentIndex < 0) orderedEntries = [{ trackId: requestedTrackId, addedBy: "partner" }, ...remoteEntries];
        else if (currentIndex > 0) orderedEntries = [...remoteEntries.slice(currentIndex), ...remoteEntries.slice(0, currentIndex)];
        const orderedIds = orderedEntries.map((entry) => entry.trackId);

        const previousQueue = [s.current, ...s.upNext].filter((item): item is QueueItem => item !== null);
        const items = orderedEntries.map((entry, index) => {
          const previous = previousQueue[index];
          return previous?.trackId === entry.trackId
            ? { ...previous, addedBy: entry.addedBy }
            : makeItem(entry.trackId, entry.addedBy);
        });
        const current = items[0] ?? makeItem(requestedTrackId, "partner");
        const sameTrack = s.current?.trackId === requestedTrackId;
        const position = Math.min(safePosition, track.duration || safePosition);
        const needsSeek = sameTrack && Math.abs(progress.current - position) > 2;
        const next: PlayerState = {
          ...s,
          current,
          upNext: items.slice(1),
          history: sameTrack || !s.current ? s.history : [...s.history, s.current].slice(-50),
          playing: event.isPlaying,
          shuffle: false,
          context: { label: "Listen Together", trackIds: orderedIds },
          unshuffled: null,
          seekRevision: s.seekRevision + (needsSeek || !sameTrack ? 1 : 0),
        };
        commit(next);

        if (sameTrack) {
          if (needsSeek) engine.seek(position);
          if (event.isPlaying && !s.playing) engine.play();
          else if (!event.isPlaying && s.playing) engine.pause();
          return;
        }

        engine.load(track.id, track.duration, position, track.audioUrl);
        if (event.isPlaying) {
          engine.play();
          libRef.current.pushHistory(track.id);
        } else {
          engine.pause();
        }
      },
    };
  }, [engine]);

  // Auto-advance when the engine reports the end of a track.
  const advanceRef = useRef(actions);
  advanceRef.current = actions;
  useEffect(() => {
    return engine.onEnded(() => {
      const s = stateRef.current;
      if (!s.current) return;
      // `next` semantics, but repeat-one loops the same track
      if (s.repeat === "one") {
        advanceRef.current.seek(0);
        engine.play();
        return;
      }
      advanceRef.current.next();
    });
  }, [engine]);

  // Playback queues are session-scoped; never carry one account's queue into another.
  const primed = useRef(false);
  useEffect(() => {
    if (previousPlaybackScopeRef.current === playbackScope) return;
    previousPlaybackScopeRef.current = playbackScope;
    engine.pause();
    engine.load("", 0, 0);
    progress.current = 0;
    listeners.current.forEach((listener) => listener());
    stateRef.current = initialState;
    setState(initialState);
    primed.current = false;
  }, [playbackScope, engine]);

  // Prime the player once the catalogue is available so the app never feels empty.
  useEffect(() => {
    if (!ready || primed.current) return;
    primed.current = true;
    const pl = libRef.current.getPlaylist("pl-our-songs");
    if (!pl) return;
    const items = pl.items.map((i) => makeItem(i.trackId, i.addedBy));
    const [current, ...upNext] = items;
    const next: PlayerState = {
      ...stateRef.current, current, upNext, playing: false,
      context: { label: pl.name, trackIds: pl.items.map((i) => i.trackId) },
    };
    stateRef.current = next;
    setState(next);
    const t = tracksRef.current.get(current.trackId);
    if (t) engine.load(t.id, t.duration, 47, t.audioUrl);
  }, [ready, engine]);

  useEffect(() => () => engine.pause(), [engine]);

  const value = useMemo<PlayerValue>(
    () => ({ ...scopedState, ...actions, track: scopedState.current ? trackById.get(scopedState.current.trackId) ?? null : null }),
    [scopedState, actions, trackById],
  );

  return (
    <ProgressCtx.Provider value={store}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </ProgressCtx.Provider>
  );
}

export const usePlayer = () => useContext(Ctx);

/** Current playback position in seconds. Re-renders only the caller, ~4×/s while playing. */
export function useProgress(): number {
  const store = useContext(ProgressCtx);
  return useSyncExternalStore(store.subscribe, store.get);
}
