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
  /** A local cache scope is either `offline-demo` or a verified Auth UUID. */
  load(scopeKey: string): LibraryState;
  save(state: LibraryState, scopeKey: string): void;
  loadRemote?(expectedUserId: string): Promise<LibraryState | null>;
  saveRemote?(prev: LibraryState, next: LibraryState, expectedUserId: string, workspaceId: string | null): Promise<void>;
  subscribeRemote?(onChange: () => void, expectedUserId: string, workspaceId: string | null): () => void;
}

/** Catalogue playback controls; explicit media URLs use HTMLAudioElement, source-less preview tracks use a silent clock. */
export interface PlaybackEngine {
  load(trackId: string, durationSec: number, startAt?: number, source?: string): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  onTick(cb: (positionSec: number) => void): () => void;
  onEnded(cb: () => void): () => void;
  onError(cb: (message: string) => void): () => void;
  destroy(): void;
}

export type RoomStatus = "idle" | "waiting" | "live";

export interface RoomState {
  status: RoomStatus;
  code: string | null;
  /** Only the account that created the room bootstraps an empty playback snapshot. */
  isHost: boolean;
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
  /** Auth UUID of the account that added each queue item, parallel to queueTrackIds. */
  queueAdderIds: string[];
  clientId: string;
  ts: number;
}

/** Shared listening session. Supabase Realtime when configured, else local simulation. */
export interface RoomService {
  getState(): RoomState;
  subscribe(listener: () => void): () => void;
  createRoom(): Promise<void>;
  joinRoom(code: string): Promise<boolean>;
  leaveRoom(): void;
  broadcastPlayback?(event: Omit<PlaybackSyncEvent, "clientId" | "ts">): void;
  onPlaybackEvent?(cb: (event: PlaybackSyncEvent) => void): () => void;
  getPlayback?(): Promise<PlaybackSyncEvent | null>;
}
