/**
 * Service contracts. The UI only ever talks to these interfaces, so each
 * mock implementation can be replaced by Supabase / Google Drive / Realtime
 * without touching a component.
 */
import type { Catalogue, LibraryState, UserId } from "../types";

/** Read-only music catalogue. Supabase Postgres when configured, else local data. */
export interface CatalogueService {
  load(): Promise<Catalogue>;
}

/**
 * Per-user library persistence.
 * `load`/`save` are the local (synchronous) cache; when Supabase is
 * configured the context additionally syncs via `loadRemote`/`saveRemote`
 * and subscribes to `subscribeRemote` for cross-device updates.
 */
export interface LibraryService {
  load(): LibraryState;
  save(state: LibraryState): void;
  loadRemote?(): Promise<LibraryState | null>;
  saveRemote?(prev: LibraryState, next: LibraryState): Promise<void>;
  subscribeRemote?(onChange: () => void): () => void;
}

/** Playback controls for the bundled catalogue engine; Drive tracks use a real HTMLAudioElement in DriveMusic. */
export interface PlaybackEngine {
  load(trackId: string, durationSec: number, startAt?: number): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  onTick(cb: (positionSec: number) => void): () => void;
  onEnded(cb: () => void): () => void;
  destroy(): void;
}

export type RoomStatus = "idle" | "waiting" | "live";

export interface RoomState {
  status: RoomStatus;
  code: string | null;
  members: { userId: UserId; online: boolean }[];
  /** true while running on local simulation rather than a real backend */
  simulated: boolean;
  syncOffsetMs: number;
  error: string | null;
}

export type PlaybackSyncType = "play" | "pause" | "seek" | "track" | "queue";

export interface PlaybackSyncEvent {
  type: PlaybackSyncType;
  trackId: string | null;
  positionSec: number;
  isPlaying: boolean;
  queueTrackIds: string[];
  clientId: string;
  ts: number;
}

/** Shared listening session. Supabase Realtime when configured, else local simulation. */
export interface RoomService {
  getState(): RoomState;
  subscribe(listener: () => void): () => void;
  createRoom(): void;
  joinRoom(code: string): boolean;
  leaveRoom(): void;
  broadcastPlayback?(event: Omit<PlaybackSyncEvent, "clientId" | "ts">): void;
  onPlaybackEvent?(cb: (event: PlaybackSyncEvent) => void): () => void;
  getPlayback?(): Promise<PlaybackSyncEvent | null>;
}
