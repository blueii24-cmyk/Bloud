/**
 * Auth state for the login page.
 *
 * Three ways to be "in":
 *   - authed : a Supabase Auth session (email + password)
 *   - guest  : demo mode, the app's original behaviour (shared library under user `me`)
 *   - anon   : neither → RequireAuth sends you to /login
 *
 * When Supabase isn't configured (no env vars) the app keeps running fully offline,
 * so the login wall is skipped entirely (see `walled`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const GUEST_KEY = "bloud.guest";
// "Remember me" off → the session should end when the browser is closed. localStorage carries the
// intent, sessionStorage marks the live tab (it survives reloads but not a closed browser).
const EPHEMERAL_KEY = "bloud.ephemeral";
const TAB_KEY = "bloud.tab";

export type AuthStatus = "loading" | "authed" | "guest" | "anon";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
}

export interface AuthResult {
  error?: string;
  /** Sign-up succeeded but the project requires the user to confirm their email first. */
  needsConfirmation?: boolean;
}

interface AuthApi {
  status: AuthStatus;
  user: AuthUser | null;
  /** False when Supabase isn't configured: accounts are unavailable, the app runs in demo mode. */
  configured: boolean;
  /** True when anonymous visitors must pass through /login. */
  walled: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string, remember: boolean) => Promise<AuthResult>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

function readGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function writeGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, "1");
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    /* private mode: guest simply won't persist across reloads */
  }
}

function setRemember(remember: boolean) {
  try {
    if (remember) {
      localStorage.removeItem(EPHEMERAL_KEY);
    } else {
      localStorage.setItem(EPHEMERAL_KEY, "1");
      sessionStorage.setItem(TAB_KEY, "1");
    }
  } catch {
    /* storage unavailable: fall back to the default persistent session */
  }
}

/** True when the last login opted out of persistence and this is a fresh browser session. */
function ephemeralSessionExpired(): boolean {
  try {
    return localStorage.getItem(EPHEMERAL_KEY) === "1" && sessionStorage.getItem(TAB_KEY) !== "1";
  } catch {
    return false;
  }
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try logging in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password") && m.includes("least")) return "Use at least 8 characters for your password.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach Bloud right now. Check your connection and try again.";
  return message;
}

function toUser(s: Session): AuthUser {
  const meta = s.user.user_metadata as { display_name?: string } | undefined;
  const email = s.user.email ?? null;
  return { id: s.user.id, email, name: meta?.display_name?.trim() || email?.split("@")[0] || "You" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = still resolving the persisted session
  const [session, setSession] = useState<Session | null | undefined>(isSupabaseConfigured ? undefined : null);
  const [guest, setGuest] = useState<boolean>(readGuest);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const client = supabase;
    (async () => {
      if (ephemeralSessionExpired()) {
        await client.auth.signOut();
        try {
          localStorage.removeItem(EPHEMERAL_KEY);
        } catch {
          /* ignore */
        }
      }
      const { data } = await client.auth.getSession();
      if (alive) setSession(data.session);
    })();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthApi["signIn"]>(async (email, password, remember) => {
    if (!supabase) return { error: "Accounts aren't available in offline demo mode." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: friendly(error.message) };
    setRemember(remember);
    writeGuest(false);
    setGuest(false);
    return {};
  }, []);

  const signUp = useCallback<AuthApi["signUp"]>(async (name, email, password, remember) => {
    if (!supabase) return { error: "Accounts aren't available in offline demo mode." };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) return { error: friendly(error.message) };
    // Supabase returns an obfuscated user with no identities for an already-registered email.
    if (data.user && data.user.identities?.length === 0) {
      return { error: "An account with this email already exists. Try logging in." };
    }
    if (!data.session) return { needsConfirmation: true };
    setRemember(remember);
    writeGuest(false);
    setGuest(false);
    return {};
  }, []);

  const continueAsGuest = useCallback(() => {
    writeGuest(true);
    setGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    writeGuest(false);
    setGuest(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthApi>(() => {
    const status: AuthStatus = session === undefined ? "loading" : session ? "authed" : guest ? "guest" : "anon";
    return {
      status,
      user: session ? toUser(session) : null,
      configured: isSupabaseConfigured,
      walled: isSupabaseConfigured,
      signIn,
      signUp,
      continueAsGuest,
      signOut,
    };
  }, [session, guest, signIn, signUp, continueAsGuest, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
