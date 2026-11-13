import { isSupabaseConfigured, supabase } from "../lib/supabase";

export interface WorkspaceMember {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface WorkspaceSnapshot {
  id: string;
  members: WorkspaceMember[];
}

async function requireVerifiedUser(expectedUserId?: string) {
  if (!isSupabaseConfigured || !supabase) throw new Error("A signed-in Bloud account is required.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Your Bloud session expired. Sign in again.");
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error("Your Bloud account changed. Reload the page before managing this workspace.");
  }
  return data.user.id;
}

/** The RPC resolves the workspace exclusively from auth.uid(); no user id is supplied. */
export async function loadMyWorkspace(expectedUserId: string): Promise<WorkspaceSnapshot | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  await requireVerifiedUser(expectedUserId);
  const { data, error } = await supabase.rpc("get_my_workspace");
  if (error) throw new Error(error.message || "Couldn't load your shared workspace.");
  await requireVerifiedUser(expectedUserId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return null;
  return {
    id: String(rows[0].workspace_id),
    members: rows.map((row) => ({
      userId: String(row.user_id),
      displayName: String(row.display_name ?? "Listener"),
      joinedAt: String(row.joined_at ?? ""),
    })),
  };
}

/** Creates the caller's one/two-person workspace if needed and returns a one-time invite secret. */
export async function createWorkspaceInvite(expectedUserId: string): Promise<string> {
  await requireVerifiedUser(expectedUserId);
  const { data, error } = await supabase!.rpc("create_workspace_invite");
  if (error) throw new Error(error.message || "Couldn't create an invite. Please try again.");
  await requireVerifiedUser(expectedUserId);
  if (typeof data !== "string" || !/^[a-f0-9]{64}$/.test(data)) {
    throw new Error("Bloud returned an invalid workspace invite.");
  }
  return data;
}

/** The database binds acceptance to auth.uid() and enforces one account per seat. */
export async function acceptWorkspaceInvite(code: string, expectedUserId: string): Promise<void> {
  await requireVerifiedUser(expectedUserId);
  const normalized = code.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("This workspace invite is invalid or has expired.");
  const { error } = await supabase!.rpc("accept_workspace_invite", { p_invite_code: normalized });
  if (error) throw new Error(error.message || "Couldn't accept this workspace invite.");
  await requireVerifiedUser(expectedUserId);
}
