/**
 * Listen Together rooms backed by Supabase Realtime.
 *
 * - `rooms` / `room_members` / `room_playback` / `room_events` tables are the
 *   durable source of truth (postgres_changes).
 * - Realtime presence tracks who is actually online right now (per device).
 * - Broadcast carries instant playback events (play / pause / seek / track);
 *   `room_playback` is the fallback for late joiners.
 *
 * The frontend's two-person model maps to devices: 1 device online →
 * "waiting", 2+ devices online → "live" (partner shown online).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getDeviceId, supabase } from "../lib/supabase";
import type { RoomService, RoomState } from "./types";

export interface PlaybackSyncEvent {
  type: "play" | "pause" | "seek" | "track" | "queue";
  trackId: string | null;
  positionSec: number;
  isPlaying: boolean;
  queueTrackIds: string[];
  clientId: string;
  ts: number;
}

function generateCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `TNDM-${n}`;
}

export function createSupabaseRoomService(): RoomService & {
  broadcastPlayback(event: Omit<PlaybackSyncEvent, "clientId" | "ts">): void;
  onPlaybackEvent(cb: (event: PlaybackSyncEvent) => void): () => void;
  getPlayback(): Promise<PlaybackSyncEvent | null>;
} {
  const deviceId = getDeviceId();
  let state: RoomState = {
    status: "idle",
    code: null,
    simulated: false,
    syncOffsetMs: 0,
    error: null,
    members: [
      { userId: "me", online: true },
      { userId: "partner", online: false },
    ],
  };
  const listeners = new Set<() => void>();
  const playbackListeners = new Set<(e: PlaybackSyncEvent) => void>();
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const set = (patch: Partial<RoomState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  const emitPlayback = (e: PlaybackSyncEvent) => {
    playbackListeners.forEach((cb) => cb(e));
  };

  const updatePresenceState = (deviceCount: number) => {
    const live = deviceCount >= 2;
    set({
      status: live ? "live" : "waiting",
      members: [
        { userId: "me", online: deviceCount >= 1 },
        { userId: "partner", online: live },
      ],
      syncOffsetMs: live ? Math.floor(20 + Math.random() * 40) : 0,
    });
    if (state.code && supabase) {
      void supabase
        .from("rooms")
        .update({ status: live ? "live" : "waiting" })
        .eq("code", state.code);
    }
  };

  const teardownChannel = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (channel && supabase) {
      void supabase.removeChannel(channel);
    }
    channel = null;
  };

  const subscribeToRoom = (code: string) => {
    if (!supabase) return;
    teardownChannel();
    channel = supabase
      .channel(`room:${code}`, { config: { presence: { key: deviceId } } })
      .on("presence", { event: "sync" }, () => {
        const presence = channel?.presenceState() ?? {};
        const devices = new Set<string>();
        for (const key of Object.keys(presence)) devices.add(key);
        updatePresenceState(Math.max(devices.size, 1));
      })
      .on("broadcast", { event: "playback" }, ({ payload }) => {
        const e = payload as PlaybackSyncEvent;
        if (e.clientId === deviceId) return;
        emitPlayback(e);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_playback", filter: `room_code=eq.${code}` },
        ({ new: row }) => {
          const r = row as Record<string, unknown>;
          if (String(r.updated_by ?? "") === deviceId) return;
          emitPlayback({
            type: r.is_playing ? "play" : "pause",
            trackId: (r.track_id as string | null) ?? null,
            positionSec: Number(r.position_sec ?? 0),
            isPlaying: Boolean(r.is_playing ?? false),
            queueTrackIds: [],
            clientId: String(r.updated_by ?? ""),
            ts: Date.now(),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_code=eq.${code}` },
        () => {
          // Presence is authoritative for online state; this just nudges a refresh.
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && channel) {
          await channel.track({ user_id: "me", device_id: deviceId, online: true });
          if (supabase) {
            await supabase.from("room_members").upsert(
              { room_code: code, user_id: "me", device_id: deviceId, online: true, last_seen: new Date().toISOString() },
              { onConflict: "room_code,user_id,device_id" },
            );
          }
        }
      });

    // Heartbeat keeps last_seen fresh so stale members can be pruned.
    heartbeat = setInterval(() => {
      if (supabase && state.code) {
        void supabase
          .from("room_members")
          .update({ last_seen: new Date().toISOString(), online: true })
          .eq("room_code", state.code)
          .eq("device_id", deviceId);
      }
    }, 30_000);
  };

  const service = {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    createRoom() {
      if (!supabase) {
        set({ error: "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." });
        return;
      }
      const code = generateCode();
      void (async () => {
        const { error } = await supabase.from("rooms").insert({ code, status: "waiting", host_id: "me" });
        if (error) {
          set({ error: "Couldn't create a room. Try again." });
          return;
        }
        await supabase.from("room_playback").upsert({ room_code: code, updated_by: deviceId }, { onConflict: "room_code" });
        set({ status: "waiting", code, error: null });
        subscribeToRoom(code);
      })();
    },

    joinRoom(codeInput: string): boolean {
      const clean = codeInput.trim().toUpperCase();
      if (!clean) return false;
      if (!supabase) {
        set({ error: "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." });
        return false;
      }
      // Optimistic: enter waiting state, validate async.
      set({ status: "waiting", code: clean, error: null });
      void (async () => {
        const { data, error } = await supabase.from("rooms").select("code").eq("code", clean).maybeSingle();
        if (error || !data) {
          // Demo-code compat: TNDM-4821 creates the room on first join.
          if (clean === "TNDM-4821") {
            const { error: createErr } = await supabase.from("rooms").insert({ code: clean, status: "waiting", host_id: "me" });
            if (!createErr) {
              await supabase.from("room_playback").upsert({ room_code: clean, updated_by: deviceId }, { onConflict: "room_code" });
              subscribeToRoom(clean);
              return;
            }
          }
          set({ status: "idle", code: null, error: "We couldn't find that room. Check the code and try again." });
          return;
        }
        subscribeToRoom(clean);
      })();
      return true;
    },

    leaveRoom() {
      const code = state.code;
      teardownChannel();
      if (code && supabase) {
        void (async () => {
          await supabase.from("room_members").delete().eq("room_code", code).eq("device_id", deviceId);
          const { data } = await supabase.from("room_members").select("device_id").eq("room_code", code);
          if (!data || data.length === 0) {
            await supabase.from("rooms").delete().eq("code", code);
          }
        })();
      }
      set({
        status: "idle",
        code: null,
        error: null,
        syncOffsetMs: 0,
        members: [
          { userId: "me", online: true },
          { userId: "partner", online: false },
        ],
      });
    },

    broadcastPlayback(event: Omit<PlaybackSyncEvent, "clientId" | "ts">) {
      const code = state.code;
      if (!code || !supabase) return;
      const full: PlaybackSyncEvent = { ...event, clientId: deviceId, ts: Date.now() };
      void channel?.send({ type: "broadcast", event: "playback", payload: full });
      void supabase.from("room_playback").upsert(
        {
          room_code: code,
          track_id: event.trackId,
          position_sec: event.positionSec,
          is_playing: event.isPlaying,
          updated_by: deviceId,
        },
        { onConflict: "room_code" },
      );
      void supabase.from("room_events").insert({
        room_code: code,
        type: event.type,
        payload: { trackId: event.trackId, positionSec: event.positionSec, isPlaying: event.isPlaying, queueTrackIds: event.queueTrackIds },
        created_by: "me",
      });
    },

    onPlaybackEvent(cb: (event: PlaybackSyncEvent) => void) {
      playbackListeners.add(cb);
      return () => playbackListeners.delete(cb);
    },

    async getPlayback(): Promise<PlaybackSyncEvent | null> {
      const code = state.code;
      if (!code || !supabase) return null;
      const { data } = await supabase.from("room_playback").select("*").eq("room_code", code).maybeSingle();
      if (!data) return null;
      const r = data as Record<string, unknown>;
      return {
        type: r.is_playing ? "play" : "pause",
        trackId: (r.track_id as string | null) ?? null,
        positionSec: Number(r.position_sec ?? 0),
        isPlaying: Boolean(r.is_playing ?? false),
        queueTrackIds: [],
        clientId: String(r.updated_by ?? ""),
        ts: Date.now(),
      };
    },
  };

  return service;
}
