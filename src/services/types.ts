/**
 * Service contracts. The UI only ever talks to these interfaces, so each
 * mock implementation can be replaced by Supabase / Google Drive / Realtime
 * without touching a component.
 */
import type { Catalogue, LibraryState, UserId } from "../types";

/** Read-only music catalogue. Future: Supabase Postgres + Google Drive file index. */
export interface CatalogueService {
  load(): Promise<Catalogue>;
}

/** Per-user library persistence. Future: Supabase tables guarded by Row Level Security. */
export interface LibraryService {
  load(): LibraryState;
  save(state: LibraryState): void;
}

/** Audio/video output. Future: HTMLAudioElement / MediaSource streaming from Drive. */
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

/** Shared listening session. Future: Supabase Realtime channel + presence. */
export interface RoomService {
  getState(): RoomState;
  subscribe(listener: () => void): () => void;
  createRoom(): void;
  joinRoom(code: string): boolean;
  leaveRoom(): void;
}
