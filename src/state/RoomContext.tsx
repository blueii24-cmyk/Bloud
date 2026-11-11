import { useSyncExternalStore } from "react";
import { roomService } from "../services";
import type { RoomState } from "../services";

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
