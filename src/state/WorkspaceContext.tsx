import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  loadMyWorkspace,
  type WorkspaceMember,
  type WorkspaceSnapshot,
} from "../services/workspace";
import { useAuth } from "./AuthContext";

export interface WorkspaceValue {
  status: "loading" | "ready";
  id: string | null;
  members: WorkspaceMember[];
  partner: WorkspaceMember | null;
  paired: boolean;
  error: string | null;
  refresh(): Promise<WorkspaceSnapshot | null>;
  createInvite(): Promise<string>;
  acceptInvite(code: string): Promise<void>;
  clearError(): void;
}

interface WorkspaceSlot {
  userId: string | null;
  status: "loading" | "ready";
  snapshot: WorkspaceSnapshot | null;
  error: string | null;
}

const EMPTY: WorkspaceSnapshot | null = null;
const Ctx = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.status === "authed" ? auth.user?.id ?? null : null;
  const requestId = useRef(0);
  const [slot, setSlot] = useState<WorkspaceSlot>({
    userId: null,
    status: "ready",
    snapshot: EMPTY,
    error: null,
  });

  const refresh = useCallback(async (): Promise<WorkspaceSnapshot | null> => {
    if (!userId || !isSupabaseConfigured) {
      setSlot({ userId, status: "ready", snapshot: null, error: null });
      return null;
    }
    const request = ++requestId.current;
    setSlot((current) => ({
      userId,
      status: "loading",
      snapshot: current.userId === userId ? current.snapshot : null,
      error: null,
    }));
    try {
      const snapshot = await loadMyWorkspace(userId);
      if (request !== requestId.current) return null;
      setSlot({ userId, status: "ready", snapshot, error: null });
      return snapshot;
    } catch (reason) {
      if (request !== requestId.current) return null;
      setSlot({
        userId,
        status: "ready",
        snapshot: null,
        error: reason instanceof Error ? reason.message : "Couldn't load your shared workspace.",
      });
      return null;
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!userId || !isSupabaseConfigured) {
      return () => {
        requestId.current += 1;
      };
    }

    // Refresh after an invite is accepted on another device, plus a modest
    // polling fallback for deployments without workspace-member Realtime.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = window.setInterval(() => void refresh(), 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      requestId.current += 1;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh, userId]);

  const createInvite = useCallback(async () => {
    if (!userId) throw new Error("Sign in to invite someone to your workspace.");
    try {
      const code = await createWorkspaceInvite(userId);
      await refresh();
      return code;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Couldn't create an invite. Please try again.";
      setSlot((current) => current.userId === userId ? { ...current, error: message } : current);
      throw new Error(message);
    }
  }, [userId, refresh]);

  const acceptInvite = useCallback(async (code: string) => {
    if (!userId) throw new Error("Sign in to accept a workspace invite.");
    try {
      await acceptWorkspaceInvite(code, userId);
      const snapshot = await refresh();
      if (!snapshot || !snapshot.members.some((member) => member.userId !== userId)) {
        throw new Error("The invite was accepted, but Bloud couldn't verify the shared workspace. Reload to try again.");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Couldn't accept this workspace invite.";
      setSlot((current) => current.userId === userId ? { ...current, error: message } : current);
      throw new Error(message);
    }
  }, [userId, refresh]);

  const clearError = useCallback(() => {
    setSlot((current) => ({ ...current, error: null }));
  }, []);

  const current = slot.userId === userId
    ? slot
    : { userId, status: userId && isSupabaseConfigured ? "loading" as const : "ready" as const, snapshot: null, error: null };
  const members = current.snapshot?.members ?? [];
  const partner = members.find((member) => member.userId !== userId) ?? null;

  const value = useMemo<WorkspaceValue>(() => ({
    status: current.status,
    id: current.snapshot?.id ?? null,
    members,
    partner,
    paired: members.length === 2 && Boolean(partner),
    error: current.error,
    refresh,
    createInvite,
    acceptInvite,
    clearError,
  }), [current.status, current.snapshot?.id, members, partner, current.error, refresh, createInvite, acceptInvite, clearError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}
