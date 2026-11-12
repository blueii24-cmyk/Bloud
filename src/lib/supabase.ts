/**
 * Supabase client singleton.
 *
 * Configured via Vite env vars (see .env.example):
 *   VITE_SUPABASE_URL              https://<ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY         legacy anon JWT (or publishable key)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  sb_publishable_… (preferred)
 *
 * When env vars are missing the app runs fully offline on local data —
 * `supabase` is null and every service falls back to its mock/local path.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

/**
 * Demo library owner. The app ships without a login wall, so all devices
 * share one library under `me` (cross-device sync out of the box).
 * When Supabase Auth is enabled, replace with `auth.getUser()` id.
 */
export const LIBRARY_USER_ID = "me";

/** Stable per-browser device id for room presence (survives reloads). */
export function getDeviceId(): string {
  const KEY = "bloud.deviceId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "dev-anonymous";
  }
}
