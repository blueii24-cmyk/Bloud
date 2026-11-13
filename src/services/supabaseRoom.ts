/** Listen Together: Auth-bound workspace rooms with private Realtime presence/broadcast. */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getDeviceId, supabase } from "../lib/supabase";
import type { PlaybackSyncType, RoomService, RoomState } from "./types";

export interface PlaybackSyncEvent {
  type: PlaybackSyncType;
  trackId: string | null;
  positionSec: number;
  isPlaying: boolean;
  queueTrackIds: string[];
  queueAdderIds: string[];
  clientId: string;
  ts: number;
}

const ROOM_CODE_PATTERN = /^TNDM-[A-F0-9]{8}$/;
const MAX_QUEUE_TRACKS = 200;

function messageFrom(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function playbackEvent(value: unknown, clientId: string): PlaybackSyncEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const validTypes: PlaybackSyncType[] = ["play", "pause", "seek", "track", "queue"];
  if (!validTypes.includes(row.type as PlaybackSyncType)) return null;
  const type = row.type as PlaybackSyncType;
  const trackId = typeof row.trackId === "string" && row.trackId.length <= 256 ? row.trackId : null;
  const rawAdderIds = Array.isArray(row.queueAdderIds) ? row.queueAdderIds : [];
  const queueEntries = Array.isArray(row.queueTrackIds)
    ? row.queueTrackIds.map((trackId, index) => ({ trackId, index }))
      .filter((entry): entry is { trackId: string; index: number } => typeof entry.trackId === "string" && entry.trackId.length <= 256)
      .slice(0, MAX_QUEUE_TRACKS)
    : [];
  const queueTrackIds = queueEntries.map((entry) => entry.trackId);
  const queueAdderIds = queueEntries.map(({ index }) => {
    const userId = rawAdderIds[index];
    return typeof userId === "string" && userId.length <= 128 ? userId : "";
  });
  const positionSec = Number(row.positionSec);
  return {
    type,
    trackId,
    positionSec: Number.isFinite(positionSec) ? Math.max(0, positionSec) : 0,
    isPlaying: row.isPlaying === true,
    queueTrackIds,
    queueAdderIds,
    clientId: typeof row.clientId === "string" && row.clientId.length <= 128 ? row.clientId : clientId,
    ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : Date.now(),
  };
}

export function createSupabaseRoomService(): RoomService & {
  broadcastPlayback(event: Omit<PlaybackSyncEvent, "clientId" | "ts">): void;
  onPlaybackEvent(cb: (event: PlaybackSyncEvent) => void): () => void;
  getPlayback(): Promise<PlaybackSyncEvent | null>;
} {
  const deviceId = getDeviceId();
  let state: RoomState = {
    status: "idle", code: null, isHost: false, simulated: false, syncOffsetMs: 0, error: null,
    members: [{ userId: "me", online: true }, { userId: "partner", online: false }],
  };
  const listeners = new Set<() => void>();
  const playbackListeners = new Set<(event: PlaybackSyncEvent) => void>();
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let authenticatedUserId: string | null = null;
  let observedAuthUserId: string | null = null;
  let authStateObserved = false;
  let roomRequestInFlight = false;
  let activeCode: string | null = null;
  let roomSession = 0;
  let playbackWriteChain: Promise<void> = Promise.resolve();
  let authSubscription: { unsubscribe(): void } | null = null;

  const set = (patch: Partial<RoomState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const emitPlayback = (event: PlaybackSyncEvent) => playbackListeners.forEach((listener) => listener(event));
  const idleState = (): Partial<RoomState> => ({
    status: "idle", code: null, isHost: false, error: null, syncOffsetMs: 0,
    members: [{ userId: "me", online: true }, { userId: "partner", online: false }],
  });

  const verifiedUserId = async (): Promise<string> => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Sign in to Bloud before using Listen Together.");
    return data.user.id;
  };

  const assertSameAuthenticatedUser = async (expectedUserId: string) => {
    const currentUserId = await verifiedUserId();
    if (currentUserId !== expectedUserId || (authStateObserved && observedAuthUserId !== expectedUserId)) {
      throw new Error("Your Bloud account changed. Reopen Listen Together to continue.");
    }
  };

  const findWorkspacePartner = async (userId: string): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("get_my_workspace");
    if (error) throw new Error(error.message || "Couldn't verify your shared workspace.");
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => String(row.user_id)).find((memberId) => memberId !== userId) ?? null;
  };

  const refreshRoomMembers = async (code: string, userId: string, peerId: string | null, client: NonNullable<typeof supabase>) => {
    const { data, error } = await client.from("room_members")
      .select("user_id,online,last_seen")
      .eq("room_code", code);
    if ((authStateObserved && observedAuthUserId !== userId)
        || channel === null || activeCode !== code || authenticatedUserId !== userId) return;
    if (error) {
      set({ error: "Couldn't refresh verified room presence." });
      return;
    }

    // Presence metadata is client-supplied and must not be treated as identity.
    // Room-member rows are inserted by Auth-bound RPCs and kept fresh by the
    // heartbeat RPC, so only those verified UUIDs drive the online indicators.
    const cutoff = Date.now() - 90_000;
    const onlineUserIds = new Set((data ?? [])
      .filter((row) => {
        const seenAt = Date.parse(String(row.last_seen ?? ""));
        return row.online === true && Number.isFinite(seenAt) && seenAt >= cutoff && seenAt <= Date.now() + 30_000;
      })
      .map((row) => String(row.user_id)));
    const selfOnline = onlineUserIds.has(userId);
    const peerOnline = peerId ? onlineUserIds.has(peerId) : false;
    set({
      status: peerOnline ? "live" : "waiting",
      members: [{ userId: "me", online: selfOnline }, { userId: "partner", online: peerOnline }],
      syncOffsetMs: 0,
    });
  };

  const teardownChannel = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    const oldChannel = channel;
    roomSession += 1;
    channel = null;
    activeCode = null;
    if (oldChannel && supabase) void supabase.removeChannel(oldChannel);
  };

  const subscribeToRoom = (code: string, userId: string, peerId: string | null) => {
    if (!supabase) return;
    if (authStateObserved && observedAuthUserId !== userId) {
      set({ ...idleState(), error: "Your Bloud account changed. Reopen Listen Together to continue." });
      return;
    }
    const client = supabase;
    teardownChannel();
    authenticatedUserId = userId;
    activeCode = code;
    const roomChannel = client.channel(`room:${code}`, {
      config: { private: true, presence: { key: deviceId } },
    });
    channel = roomChannel;
    const isCurrentRoom = () => channel === roomChannel
      && activeCode === code
      && authenticatedUserId === userId
      && (!authStateObserved || observedAuthUserId === userId);

    roomChannel
      // Presence callbacks are only a refresh signal; their metadata is not an
      // identity source. The query below reads Auth-bound room_members rows.
      .on("presence", { event: "sync" }, () => { void refreshRoomMembers(code, userId, peerId, client); })
      .on("broadcast", { event: "playback" }, ({ payload }) => {
        if (!isCurrentRoom()) return;
        const event = playbackEvent(payload, "");
        if (!event || event.clientId === deviceId) return;
        emitPlayback(event);
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "room_members", filter: `room_code=eq.${code}`,
      }, () => { void refreshRoomMembers(code, userId, peerId, client); })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "room_playback", filter: `room_code=eq.${code}`,
      }, ({ new: row }) => {
        if (!isCurrentRoom()) return;
        const playback = row as Record<string, unknown>;
        if (String(playback.updated_by_device_id ?? "") === deviceId) return;
        const trackId = typeof playback.track_id === "string" ? playback.track_id : null;
        const rawAdderIds = Array.isArray(playback.queue_adder_ids) ? playback.queue_adder_ids : [];
        const queueEntries = Array.isArray(playback.queue_track_ids)
          ? playback.queue_track_ids.map((queueTrackId, index) => ({ queueTrackId, index }))
            .filter((entry): entry is { queueTrackId: string; index: number } => typeof entry.queueTrackId === "string" && entry.queueTrackId.length <= 256)
            .slice(0, MAX_QUEUE_TRACKS)
          : [];
        const queueTrackIds = queueEntries.map((entry) => entry.queueTrackId);
        const queueAdderIds = queueEntries.map(({ index }) => {
          const adderId = rawAdderIds[index];
          return typeof adderId === "string" && adderId.length <= 128 ? adderId : "";
        });
        emitPlayback({
          type: "queue", trackId,
          positionSec: Math.max(0, Number(playback.position_sec ?? 0)),
          isPlaying: Boolean(playback.is_playing), queueTrackIds, queueAdderIds,
          clientId: String(playback.updated_by ?? ""),
          ts: Date.parse(String(playback.updated_at ?? "")) || Date.now(),
        });
      })
      .subscribe(async (status) => {
        if (!isCurrentRoom()) return;
        if (status === "SUBSCRIBED") {
          try {
            const presenceStatus = await roomChannel.track({ device_id: deviceId, online: true });
            if (!isCurrentRoom()) return;
            if (presenceStatus !== "ok") {
              set({ error: "Couldn't announce your presence. Check your connection and rejoin the room." });
              return;
            }
            const { error } = await client.rpc("heartbeat_room", { p_code: code, p_device_id: deviceId });
            if (!isCurrentRoom()) return;
            if (error) {
              set({ error: "The room is open, but its presence heartbeat could not be saved." });
              return;
            }
            await refreshRoomMembers(code, userId, peerId, client);
          } catch {
            if (!isCurrentRoom()) return;
            set({ error: "Couldn't announce your presence. Check your connection and rejoin the room." });
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          set({ error: "Couldn't connect to this private room. Check your workspace membership and try again." });
        }
      });

    heartbeat = setInterval(() => {
      if (!isCurrentRoom()) return;
      const heartbeatUserId = userId;
      void client.rpc("heartbeat_room", { p_code: code, p_device_id: deviceId })
        .then(({ error }) => {
          if (!isCurrentRoom()) return;
          if (error) set({ error: "Room presence is temporarily unavailable." });
          else void refreshRoomMembers(code, heartbeatUserId, peerId, client);
        }, () => {
          if (isCurrentRoom()) set({ error: "Room presence is temporarily unavailable." });
        });
    }, 30_000);
  };

  const service: RoomService & {
    broadcastPlayback(event: Omit<PlaybackSyncEvent, "clientId" | "ts">): void;
    onPlaybackEvent(cb: (event: PlaybackSyncEvent) => void): () => void;
    getPlayback(): Promise<PlaybackSyncEvent | null>;
  } = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async createRoom() {
      if (!supabase) {
        set({ error: "Supabase is not configured. Add the required VITE_SUPABASE_* settings." });
        return;
      }
      if (roomRequestInFlight) return;
      if (activeCode) {
        set({ error: "Leave your current room before starting another one." });
        return;
      }
      roomRequestInFlight = true;
      try {
        const userId = await verifiedUserId();
        const peerId = await findWorkspacePartner(userId);
        if (!peerId) throw new Error("Create a two-person workspace before starting a room.");
        await assertSameAuthenticatedUser(userId);
        const { data, error } = await supabase.rpc("create_room", { p_device_id: deviceId });
        if (error) throw error;
        const code = String(data ?? "").toUpperCase();
        if (!ROOM_CODE_PATTERN.test(code)) throw new Error("Bloud returned an invalid room code.");
        await assertSameAuthenticatedUser(userId);
        set({ status: "waiting", code, isHost: true, error: null, syncOffsetMs: 0 });
        subscribeToRoom(code, userId, peerId);
      } catch (error) {
        set({ ...idleState(), error: messageFrom(error, "Couldn't start a private listening room.") });
      } finally {
        roomRequestInFlight = false;
      }
    },

    async joinRoom(codeInput) {
      const code = codeInput.trim().toUpperCase();
      if (!supabase) {
        set({ error: "Supabase is not configured. Add the required VITE_SUPABASE_* settings." });
        return false;
      }
      if (!ROOM_CODE_PATTERN.test(code)) {
        set({ error: "Enter a valid room code." });
        return false;
      }
      if (roomRequestInFlight) return false;
      if (activeCode) {
        if (activeCode === code) return true;
        set({ error: "Leave your current room before joining another one." });
        return false;
      }
      roomRequestInFlight = true;
      try {
        const userId = await verifiedUserId();
        const peerId = await findWorkspacePartner(userId);
        if (!peerId) throw new Error("Accept a workspace invite before joining a room.");
        await assertSameAuthenticatedUser(userId);
        const { data, error } = await supabase.rpc("join_room", { p_code: code, p_device_id: deviceId });
        if (error) throw error;
        if (String(data ?? "").toUpperCase() !== code) throw new Error("We couldn't find a room you are allowed to join.");
        await assertSameAuthenticatedUser(userId);
        set({ status: "waiting", code, isHost: false, error: null, syncOffsetMs: 0 });
        subscribeToRoom(code, userId, peerId);
        return true;
      } catch (error) {
        set({ ...idleState(), error: messageFrom(error, "We couldn't find a room you are allowed to join.") });
        return false;
      } finally {
        roomRequestInFlight = false;
      }
    },

    leaveRoom() {
      const code = activeCode;
      const userId = authenticatedUserId;
      teardownChannel();
      if (code && userId && supabase) {
        void supabase.rpc("leave_room", { p_code: code, p_device_id: deviceId }).then(() => undefined, () => undefined);
      }
      authenticatedUserId = null;
      set(idleState());
    },

    broadcastPlayback(event) {
      const code = activeCode;
      const client = supabase;
      if (!code || !client) return;
      const session = roomSession;
      const rawAdderIds = event.queueAdderIds;
      const queueEntries = event.queueTrackIds
        .map((trackId, index) => ({ trackId, index }))
        .filter((entry): entry is { trackId: string; index: number } => typeof entry.trackId === "string" && entry.trackId.length <= 256)
        .slice(0, MAX_QUEUE_TRACKS);
      const clean: PlaybackSyncEvent = {
        type: event.type,
        trackId: typeof event.trackId === "string" && event.trackId.length <= 256 ? event.trackId : null,
        positionSec: Math.max(0, Number.isFinite(event.positionSec) ? event.positionSec : 0),
        isPlaying: Boolean(event.isPlaying),
        queueTrackIds: queueEntries.map((entry) => entry.trackId),
        queueAdderIds: queueEntries.map(({ index }) => {
          const adderId = rawAdderIds[index];
          return typeof adderId === "string" && adderId.length <= 128 ? adderId : "";
        }),
        clientId: deviceId,
        ts: Date.now(),
      };
      const currentChannel = channel;
      if (currentChannel && roomSession === session && activeCode === code) {
        void currentChannel.send({ type: "broadcast", event: "playback", payload: clean }).then((result) => {
          if (result !== "ok" && activeCode === code && roomSession === session) {
            set({ error: "Realtime playback could not be sent; retry in a moment." });
          }
        }).catch(() => {
          if (activeCode === code && roomSession === session) {
            set({ error: "Realtime playback could not be sent; retry in a moment." });
          }
        });
      }

      // Serialize snapshot writes so a slow earlier request cannot overwrite a
      // newer queue/playback state; abandon queued writes after room teardown.
      playbackWriteChain = playbackWriteChain.catch(() => undefined).then(async () => {
        if (activeCode !== code || roomSession !== session) return;
        const { error } = await client.from("room_playback").upsert({
          room_code: code,
          track_id: clean.trackId,
          position_sec: clean.positionSec,
          is_playing: clean.isPlaying,
          queue_track_ids: clean.queueTrackIds,
          queue_adder_ids: clean.queueAdderIds,
          updated_by_device_id: deviceId,
        }, { onConflict: "room_code" });
        if (error && activeCode === code && roomSession === session) {
          set({ error: "Playback updated locally but could not be saved for a late joiner." });
        }
      }).catch(() => {
        if (activeCode === code && roomSession === session) {
          set({ error: "Playback updated locally but could not be saved for a late joiner." });
        }
      });
    },

    onPlaybackEvent(callback) {
      playbackListeners.add(callback);
      return () => playbackListeners.delete(callback);
    },

    async getPlayback() {
      const code = activeCode;
      const userId = authenticatedUserId;
      if (!code || !supabase || !userId) return null;
      await assertSameAuthenticatedUser(userId);
      const { data, error } = await supabase.from("room_playback")
        .select("track_id,position_sec,is_playing,queue_track_ids,queue_adder_ids,updated_by,updated_by_device_id,updated_at")
        .eq("room_code", code).maybeSingle();
      if (error) {
        const message = "Couldn't load the shared playback state.";
        set({ error: message });
        throw new Error(message);
      }
      await assertSameAuthenticatedUser(userId);
      if (activeCode !== code || authenticatedUserId !== userId || !data) return null;
      const rawAdderIds = Array.isArray(data.queue_adder_ids) ? data.queue_adder_ids : [];
      const queueEntries = Array.isArray(data.queue_track_ids)
        ? data.queue_track_ids.map((queueTrackId, index) => ({ queueTrackId, index }))
          .filter((entry): entry is { queueTrackId: string; index: number } => typeof entry.queueTrackId === "string" && entry.queueTrackId.length <= 256)
          .slice(0, MAX_QUEUE_TRACKS)
        : [];
      return {
        type: "queue",
        trackId: typeof data.track_id === "string" ? data.track_id : null,
        positionSec: Math.max(0, Number(data.position_sec ?? 0)),
        isPlaying: Boolean(data.is_playing),
        queueTrackIds: queueEntries.map((entry) => entry.queueTrackId),
        queueAdderIds: queueEntries.map(({ index }) => {
          const adderId = rawAdderIds[index];
          return typeof adderId === "string" && adderId.length <= 128 ? adderId : "";
        }),
        clientId: String(data.updated_by_device_id ?? data.updated_by ?? ""),
        ts: Date.parse(String(data.updated_at ?? "")) || Date.now(),
      } satisfies PlaybackSyncEvent;
    },
  };

  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      authStateObserved = true;
      observedAuthUserId = nextUserId;
      if (authenticatedUserId && nextUserId !== authenticatedUserId) {
        teardownChannel();
        authenticatedUserId = null;
        set(idleState());
      }
    });
    authSubscription = data.subscription;
  }

  // Keep the listener reachable for development teardown / hot reload cleanup.
  void authSubscription;
  return service;
}
