import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createDriveSession,
  deleteDriveSession,
  preloadGoogleIdentity,
  requestGoogleDriveToken,
  restoreDriveSession,
  revokeGoogleDriveToken,
} from "../services/googleDrive";
import { useAuth } from "./AuthContext";

export type GoogleDriveStatus = "loading" | "disconnected" | "connecting" | "connected";

interface GoogleDriveValue {
  status: GoogleDriveStatus;
  email: string | null;
  /** Only used on non-Vercel dev/static hosts; production keeps this in an HttpOnly cookie. */
  accessToken: string | null;
  configured: boolean;
  identityReady: boolean;
  error: string | null;
  connect(): Promise<string | null>;
  disconnect(): Promise<void>;
  clearError(): void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
const Ctx = createContext<GoogleDriveValue | null>(null);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [status, setStatus] = useState<GoogleDriveStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const connectedToken = useRef<string | null>(null);
  const connecting = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let alive = true;
    void preloadGoogleIdentity(GOOGLE_CLIENT_ID).then(
      () => alive && setIdentityReady(true),
      (reason: unknown) => {
        if (alive) setIdentityError(reason instanceof Error ? reason.message : "Couldn't load Google's sign-in service.");
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (auth.status === "loading") return;
    const userId = auth.status === "authed" ? auth.user?.id ?? null : null;
    const previousUserId = activeUserId.current;
    activeUserId.current = userId;

    if (!userId) {
      setStatus("disconnected");
      setEmail(null);
      setAccessToken(null);
      connectedToken.current = null;
      setError(null);
      if (previousUserId) void deleteDriveSession().catch(() => undefined);
      return;
    }

    setStatus("loading");
    setEmail(null);
    setAccessToken(null);
    connectedToken.current = null;
    setError(null);

    let alive = true;
    const restore = async () => {
      if (previousUserId && previousUserId !== userId) {
        await deleteDriveSession().catch(() => undefined);
      }
      try {
        const session = await restoreDriveSession();
        if (!alive || activeUserId.current !== userId) return;
        if (session) {
          setEmail(session.email);
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      } catch (reason) {
        if (!alive || activeUserId.current !== userId) return;
        setError(reason instanceof Error ? reason.message : "Couldn't restore your Google Drive connection.");
        setStatus("disconnected");
      }
    };
    void restore();
    return () => {
      alive = false;
    };
  }, [auth.status, auth.user?.id]);

  const connect = useCallback(async (): Promise<string | null> => {
    if (connecting.current) return "Google Drive is already connecting.";
    if (auth.status !== "authed" || !auth.user?.id) return "Sign in to your Bloud account before connecting Google Drive.";
    if (!GOOGLE_CLIENT_ID) {
      const message = "Google Drive isn't configured yet. Ask the Bloud administrator to add the Google OAuth client ID.";
      setError(message);
      return message;
    }
    if (!identityReady) {
      const message = identityError || "Google's sign-in service is still loading. Please try again in a moment.";
      setError(message);
      return message;
    }

    connecting.current = true;
    setError(null);
    setStatus("connecting");
    const connectingUserId = auth.user.id;
    let issuedAccessToken: string | null = null;
    try {
      const token = await requestGoogleDriveToken(GOOGLE_CLIENT_ID);
      issuedAccessToken = token.accessToken;
      if (activeUserId.current !== connectingUserId) {
        await revokeGoogleDriveToken(token.accessToken);
        return "Your Bloud account changed. Sign in again before connecting Google Drive.";
      }
      const session = await createDriveSession(token.accessToken, token.expiresIn);
      if (activeUserId.current !== connectingUserId) {
        if (__VERCEL__) await deleteDriveSession().catch(() => undefined);
        await revokeGoogleDriveToken(token.accessToken);
        return "Your Bloud account changed. Sign in again before connecting Google Drive.";
      }
      connectedToken.current = token.accessToken;
      setAccessToken(__VERCEL__ ? null : token.accessToken);
      setEmail(session.email);
      setStatus("connected");
      return null;
    } catch (reason) {
      if (issuedAccessToken) await revokeGoogleDriveToken(issuedAccessToken);
      if (__VERCEL__ && activeUserId.current === connectingUserId) await deleteDriveSession().catch(() => undefined);
      const message = reason instanceof Error ? reason.message : "Couldn't connect Google Drive. Please try again.";
      if (activeUserId.current === connectingUserId) {
        setError(message);
        setStatus("disconnected");
      }
      return message;
    } finally {
      connecting.current = false;
    }
  }, [auth.status, auth.user?.id, identityReady, identityError]);

  const disconnect = useCallback(async () => {
    const token = connectedToken.current;
    setStatus("disconnected");
    setEmail(null);
    setAccessToken(null);
    connectedToken.current = null;
    setError(null);
    if (__VERCEL__) await deleteDriveSession().catch(() => undefined);
    else if (token) await revokeGoogleDriveToken(token);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<GoogleDriveValue>(() => ({
    status,
    email,
    accessToken,
    configured: Boolean(GOOGLE_CLIENT_ID),
    identityReady,
    error: error ?? identityError,
    connect,
    disconnect,
    clearError,
  }), [status, email, accessToken, identityReady, error, identityError, connect, disconnect, clearError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGoogleDrive(): GoogleDriveValue {
  const context = useContext(Ctx);
  if (!context) throw new Error("useGoogleDrive must be used inside <GoogleDriveProvider>");
  return context;
}
