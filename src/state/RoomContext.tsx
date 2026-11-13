import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { roomService } from "../services";
import type { PlaybackSyncEvent, RoomState } from "../services";
import { useAuth } from "./AuthContext";
import { useCatalogue } from "./CatalogueContext";
import { usePlayer, useProgress } from "./PlayerContext";
import { useWorkspace } from "./WorkspaceContext";

type SharedPlayback = Pick<PlaybackSyncEvent, "trackId" | "queueTrackIds" | "queueAdderIds" | "positionSec" | "isPlaying">;

/** Live room state from the RoomService. */
export function useRoom(): RoomState & {
  active: boolean;
  partnerOnline: boolean;
  createRoom(): Promise<void>;
  joinRoom(code: string): Promise<boolean>;
  leaveRoom(): void;
} {
  const state = useSyncExternalStore(roomService.subscribe, roomService.getState);
  return {
    ...state,
    active: state.status !== "idle",
    partnerOnline: state.members.some((member) => member.userId === "partner" && member.online),
    createRoom: () => roomService.createRoom(),
    joinRoom: (code) => roomService.joinRoom(code),
    leaveRoom: () => roomService.leaveRoom(),
  };
}

/**
 * Bridges the local player and the shared room. Remote playback replaces the
 * current track and ordered queue; local queue and seek changes are broadcast
 * while connected. The apply guard prevents an event from echoing back.
 */
export function RoomSyncBridge() {
  const room = useRoom();
  const player = usePlayer();
  const { trackById } = useCatalogue();
  const auth = useAuth();
  const workspace = useWorkspace();
  const progress = useProgress();
  const applyingRemoteRef = useRef(false);
  const applyingRemoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef({
    roomCode: null as string | null,
    trackId: null as string | null,
    playing: false,
    queueSignature: "[]",
    queueAdderSignature: "[]",
    seekRevision: 0,
  });
  const playerRef = useRef(player);
  playerRef.current = player;
  const trackByIdRef = useRef(trackById);
  trackByIdRef.current = trackById;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const identityRef = useRef({ userId: auth.user?.id ?? null, partnerId: workspace.partner?.userId ?? null });
  identityRef.current = { userId: auth.user?.id ?? null, partnerId: workspace.partner?.userId ?? null };
  const [snapshotReadyCode, setSnapshotReadyCode] = useState<string | null>(null);
  const latestPlaybackEventRef = useRef<{ roomCode: string; event: SharedPlayback } | null>(null);

  const seedBroadcastBaseline = (roomCode: string) => {
    const currentPlayer = playerRef.current;
    const items = [currentPlayer.current, ...currentPlayer.upNext]
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const trackIds = items.map((item) => item.trackId);
    const adderIds = items.map((item) => item.addedBy === "me"
      ? identityRef.current.userId ?? ""
      : identityRef.current.partnerId ?? "");
    const snapshot = {
      type: currentPlayer.current ? "track" as const : "queue" as const,
      trackId: currentPlayer.current?.trackId ?? null,
      positionSec: progressRef.current,
      isPlaying: currentPlayer.playing,
      queueTrackIds: trackIds,
      queueAdderIds: adderIds,
    };
    lastBroadcastRef.current = {
      roomCode,
      trackId: snapshot.trackId,
      playing: snapshot.isPlaying,
      queueSignature: JSON.stringify(snapshot.queueTrackIds),
      queueAdderSignature: JSON.stringify(snapshot.queueAdderIds),
      seekRevision: currentPlayer.seekRevision,
    };
    return snapshot;
  };

  const seedRemoteBaseline = (roomCode: string, event: SharedPlayback) => {
    const currentPlayer = playerRef.current;
    const normalizedAdderIds = event.queueTrackIds.map((_, index) => {
      const adderId = event.queueAdderIds[index];
      return adderId === identityRef.current.userId || adderId === identityRef.current.partnerId
        ? adderId
        : identityRef.current.partnerId ?? "";
    });
    const sameTrack = currentPlayer.current?.trackId === event.trackId;
    const duration = event.trackId ? trackByIdRef.current.get(event.trackId)?.duration ?? 0 : 0;
    const position = Math.min(Math.max(0, event.positionSec), duration || Math.max(0, event.positionSec));
    const needsSeek = event.trackId === null || !sameTrack || Math.abs(progressRef.current - position) > 2;
    lastBroadcastRef.current = {
      roomCode,
      trackId: event.trackId,
      playing: event.isPlaying,
      queueSignature: JSON.stringify(event.queueTrackIds),
      queueAdderSignature: JSON.stringify(normalizedAdderIds),
      seekRevision: currentPlayer.seekRevision + (needsSeek ? 1 : 0),
    };
  };

  const applyRemote = (event: SharedPlayback) => {
    if (applyingRemoteTimerRef.current) clearTimeout(applyingRemoteTimerRef.current);
    applyingRemoteRef.current = true;
    const queueAddedBy = event.queueAdderIds.map((adderId) => {
      if (adderId && adderId === identityRef.current.userId) return "me" as const;
      if (adderId && adderId === identityRef.current.partnerId) return "partner" as const;
      return "partner" as const;
    });
    playerRef.current.applyRemotePlayback({ ...event, queueAddedBy });
    applyingRemoteTimerRef.current = setTimeout(() => {
      applyingRemoteRef.current = false;
      applyingRemoteTimerRef.current = null;
    }, 350);
  };

  // Apply playback events from the paired account.
  useEffect(() => {
    if (!roomService.onPlaybackEvent) return;
    return roomService.onPlaybackEvent((event) => {
      const code = roomService.getState().code;
      if (code) {
        latestPlaybackEventRef.current = { roomCode: code, event };
        seedRemoteBaseline(code, event);
      }
      applyRemote(event);
    });
  }, []);

  // Broadcast track, play/pause, queue, and explicit seek changes while live.
  const queueItems = [player.current, ...player.upNext]
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const queueTrackIds = queueItems.map((item) => item.trackId);
  const queueAdderIds = queueItems.map((item) => item.addedBy === "me"
    ? identityRef.current.userId ?? ""
    : identityRef.current.partnerId ?? "");
  const queueSignature = JSON.stringify(queueTrackIds);
  const queueAdderSignature = JSON.stringify(queueAdderIds);
  useEffect(() => {
    if (room.status !== "live" || !room.code || snapshotReadyCode !== room.code || !roomService.broadcastPlayback) return;

    const trackId = player.current?.trackId ?? null;
    const playing = player.playing;
    let last = lastBroadcastRef.current;
    if (last.roomCode !== room.code) {
      last = {
        roomCode: room.code,
        trackId: null,
        playing: false,
        queueSignature: "[]",
        queueAdderSignature: "[]",
        seekRevision: player.seekRevision,
      };
    }
    if (applyingRemoteRef.current) {
      lastBroadcastRef.current = { roomCode: room.code, trackId, playing, queueSignature, queueAdderSignature, seekRevision: player.seekRevision };
      return;
    }

    const trackChanged = trackId !== last.trackId;
    const queueChanged = queueSignature !== last.queueSignature || queueAdderSignature !== last.queueAdderSignature;
    const seekChanged = player.seekRevision !== last.seekRevision;
    const playChanged = playing !== last.playing;
    if (!trackChanged && !queueChanged && !seekChanged && !playChanged) return;

    const type = trackChanged ? "track"
      : queueChanged ? "queue"
        : seekChanged ? "seek"
          : playing ? "play" : "pause";
    lastBroadcastRef.current = { roomCode: room.code, trackId, playing, queueSignature, queueAdderSignature, seekRevision: player.seekRevision };
    roomService.broadcastPlayback({
      type,
      trackId,
      positionSec: progressRef.current,
      isPlaying: playing,
      queueTrackIds,
      queueAdderIds,
    });
  }, [room.status, room.code, snapshotReadyCode, player.current?.trackId, player.playing, player.upNext, player.seekRevision, queueSignature, queueAdderSignature]);

  // Load the room snapshot before allowing any outbound playback. The host
  // bootstraps an empty room from its current player; guests never publish
  // stale local state while the snapshot is still in flight.
  useEffect(() => {
    const code = room.code;
    if (room.status !== "live" || !code) {
      if (room.status !== "live") {
        if (snapshotReadyCode !== null) setSnapshotReadyCode(null);
        latestPlaybackEventRef.current = null;
      }
      return;
    }
    if (!roomService.getPlayback) {
      // The offline room is an explicitly local simulation with no cloud
      // snapshot. Mark it ready without blocking its local player lifecycle.
      if (room.simulated && snapshotReadyCode !== code) {
        seedBroadcastBaseline(code);
        setSnapshotReadyCode(code);
      }
      return;
    }
    if (snapshotReadyCode === code) return;

    let alive = true;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const readSnapshot = () => {
      attempts += 1;
      void roomService.getPlayback!().then((event) => {
        if (!alive) return;
        const currentRoom = roomService.getState();
        if (currentRoom.status !== "live" || currentRoom.code !== code) return;

        // A live event received during the fetch is newer than the point-in-time
        // snapshot and has already been applied by the event listener.
        const latestEvent = latestPlaybackEventRef.current;
        const gotLiveEvent = latestEvent?.roomCode === code;
        const snapshot = event && event.isPlaying
          ? {
            ...event,
            // room_playback.updated_at marks the persisted position. Advance it
            // by the time spent playing since that write for late joiners.
            positionSec: event.positionSec + Math.max(0, (Date.now() - event.ts) / 1000),
          }
          : event;
        if (gotLiveEvent) {
          seedRemoteBaseline(code, latestEvent.event);
        } else if (snapshot && (snapshot.trackId || snapshot.queueTrackIds.length)) {
          seedRemoteBaseline(code, snapshot);
          applyRemote(snapshot);
        } else if (!room.isHost) {
          // An empty persisted row is still authoritative: clear the guest's
          // pre-room player rather than showing it as shared playback.
          const emptySnapshot: SharedPlayback = event ?? {
            trackId: null,
            queueTrackIds: [],
            queueAdderIds: [],
            positionSec: 0,
            isPlaying: false,
          };
          seedRemoteBaseline(code, emptySnapshot);
          applyRemote(emptySnapshot);
        } else {
          // Publish even an empty state so the guest's pre-room local player
          // cannot remain visible as if it were shared playback.
          const initialState = seedBroadcastBaseline(code);
          roomService.broadcastPlayback?.(initialState);
        }
        setSnapshotReadyCode(code);
      }).catch(() => {
        if (!alive) return;
        retryTimer = setTimeout(readSnapshot, Math.min(30_000, attempts * 2_000));
      });
    };
    readSnapshot();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [room.status, room.code, room.isHost, room.simulated, snapshotReadyCode]);

  useEffect(() => () => {
    if (applyingRemoteTimerRef.current) clearTimeout(applyingRemoteTimerRef.current);
  }, []);

  return null;
}
