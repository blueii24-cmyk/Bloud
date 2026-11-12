import { useEffect, useRef, useSyncExternalStore } from "react";
import { roomService } from "../services";
import type { RoomState } from "../services";
import { usePlayer, useProgress } from "./PlayerContext";

/** Live room state from the RoomService. */
export function useRoom(): RoomState & {
  active: boolean;
  partnerOnline: boolean;
  createRoom(): void;
  joinRoom(code: string): boolean;
  leaveRoom(): void;
} {
  const state = useSyncExternalStore(roomService.subscribe, roomService.getState);
  return {
    ...state,
    active: state.status !== "idle",
    partnerOnline: state.members.some((m) => m.userId === "partner" && m.online),
    createRoom: () => roomService.createRoom(),
    joinRoom: (code) => roomService.joinRoom(code),
    leaveRoom: () => roomService.leaveRoom(),
  };
}

/**
 * Bridges the local player and the shared room.
 * Must be rendered inside PlayerProvider. When the room is live:
 * - local track / play-pause changes are broadcast to the partner,
 * - remote playback events are applied to the local player,
 * - late joiners pull the current `room_playback` row on becoming live.
 * Loop-guarded via `applyingRemoteRef` + event timestamps.
 */
export function RoomSyncBridge() {
  const room = useRoom();
  const player = usePlayer();
  const progress = useProgress();
  const applyingRemoteRef = useRef(false);
  const lastBroadcastRef = useRef<{ trackId: string | null; playing: boolean }>({ trackId: null, playing: false });
  const wasLiveRef = useRef(false);
  const playerRef = useRef(player);
  playerRef.current = player;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Apply remote playback events.
  useEffect(() => {
    if (!roomService.onPlaybackEvent) return;
    return roomService.onPlaybackEvent((event) => {
      const p = playerRef.current;
      applyingRemoteRef.current = true;
      try {
        if (event.trackId && event.trackId !== p.track?.id) {
          p.playTracks([event.trackId], 0, { startAt: event.positionSec });
          if (!event.isPlaying) p.togglePlay();
        } else if (event.isPlaying !== p.playing) {
          p.togglePlay();
        } else if (Math.abs(event.positionSec - progressRef.current) > 2) {
          p.seek(event.positionSec);
        }
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 300);
      }
    });
  }, []);

  // Broadcast local track / play-pause changes while live.
  useEffect(() => {
    if (room.status !== "live" || !roomService.broadcastPlayback) return;
    const trackId = player.track?.id ?? null;
    const playing = player.playing;
    const last = lastBroadcastRef.current;
    if (applyingRemoteRef.current) {
      lastBroadcastRef.current = { trackId, playing };
      return;
    }
    if (trackId === last.trackId && playing === last.playing) return;
    lastBroadcastRef.current = { trackId, playing };
    roomService.broadcastPlayback({
      type: trackId !== last.trackId ? "track" : playing ? "play" : "pause",
      trackId,
      positionSec: progressRef.current,
      isPlaying: playing,
      queueTrackIds: [player.current, ...player.upNext].filter(Boolean).map((q) => q!.trackId),
    });
  }, [room.status, player.track?.id, player.playing, player.current, player.upNext]);

  // Late joiner: pull current playback when the room goes live.
  useEffect(() => {
    const live = room.status === "live";
    if (live && !wasLiveRef.current && roomService.getPlayback) {
      void roomService.getPlayback().then((event) => {
        if (!event?.trackId) return;
        const p = playerRef.current;
        if (event.trackId === p.track?.id) return;
        applyingRemoteRef.current = true;
        try {
          p.playTracks([event.trackId], 0, { startAt: event.positionSec });
          if (!event.isPlaying) p.togglePlay();
        } finally {
          setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 300);
        }
      });
    }
    wasLiveRef.current = live;
  }, [room.status]);

  return null;
}
