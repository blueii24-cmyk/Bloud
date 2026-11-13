import type { RoomService, RoomState } from "./types";

/** The code that the simulated room accepts. */
export const DEMO_ROOM_CODE = "TNDM-4821";

/**
 * Local simulation of a two-person room. Presence and sync are NOT real —
 * `simulated: true` is surfaced in the UI. Replace with a Supabase Realtime
 * channel (presence for members, broadcast for playback events).
 */
export function createMockRoomService(): RoomService {
  let state: RoomState = {
    status: "idle", code: null, isHost: false, simulated: true, syncOffsetMs: 0, error: null,
    members: [{ userId: "me", online: true }, { userId: "partner", online: false }],
  };
  const listeners = new Set<() => void>();
  let timers: ReturnType<typeof setTimeout>[] = [];

  const set = (patch: Partial<RoomState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const partnerJoins = (delay: number) => {
    timers.push(
      setTimeout(() => {
        set({
          status: "live",
          members: [{ userId: "me", online: true }, { userId: "partner", online: true }],
          syncOffsetMs: 38,
        });
      }, delay),
    );
  };

  return {
    getState: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async createRoom() {
      clear();
      set({ status: "waiting", code: DEMO_ROOM_CODE, isHost: true, error: null, members: [{ userId: "me", online: true }, { userId: "partner", online: false }] });
      partnerJoins(1800);
    },
    async joinRoom(code) {
      const clean = code.trim().toUpperCase();
      if (clean !== DEMO_ROOM_CODE) {
        set({ error: "We couldn't find that room. Check the code and try again." });
        return false;
      }
      clear();
      set({ status: "waiting", code: clean, isHost: false, error: null });
      partnerJoins(600);
      return true;
    },
    leaveRoom() {
      clear();
      set({ status: "idle", code: null, isHost: false, error: null, syncOffsetMs: 0, members: [{ userId: "me", online: true }, { userId: "partner", online: false }] });
    },
  };
}
