import type { IncomingMessage, ServerResponse } from "node:http";

const DRIVE_COOKIE = "bloud_drive_access";
const OWNER_COOKIE = "bloud_drive_owner";
const APP_COOKIE = "bloud_app_access";
const COOKIE_PATH = "/api/drive";

export type DriveApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
export type DriveApiResponse = ServerResponse<IncomingMessage>;

export interface AppUser {
  id: string;
  accessToken: string;
}

export function sendJson(res: DriveApiResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function getQuery(req: DriveApiRequest, key: string): string | undefined {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === "string") return fromQuery;
  if (Array.isArray(fromQuery) && fromQuery.length) return fromQuery[0];
  try {
    return new URL(req.url ?? "/", "http://localhost").searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function readBody(req: DriveApiRequest): Record<string, unknown> | null {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      const value: unknown = JSON.parse(req.body);
      return value && typeof value === "object" ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return null;
}

function readCookieHeader(req: DriveApiRequest): string {
  const value = req.headers.cookie;
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

function readCookie(req: DriveApiRequest, name: string): string | null {
  for (const part of readCookieHeader(req).split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function getDriveToken(req: DriveApiRequest): string | null {
  return readCookie(req, DRIVE_COOKIE);
}

export function getDriveOwnerId(req: DriveApiRequest): string | null {
  return readCookie(req, OWNER_COOKIE);
}

function appAccessToken(req: DriveApiRequest, allowCookie: boolean): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string") {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match) return match[1];
  }
  return allowCookie ? readCookie(req, APP_COOKIE) : null;
}

function appTokenLifetime(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 3600;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    if (!claims.exp) return 3600;
    return Math.max(1, Math.min(3600, claims.exp - Math.floor(Date.now() / 1000)));
  } catch {
    return 3600;
  }
}

function isSecureRequest(req: DriveApiRequest): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return process.env.VERCEL === "1" || protocol === "https";
}

function cookieValue(name: string, value: string, req: DriveApiRequest, maxAge: number): string {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  const age = Math.max(0, Math.min(3600, Math.floor(maxAge)));
  return `${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}

function clearCookieValue(name: string, req: DriveApiRequest): string {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `${name}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function setAppAccessCookie(req: DriveApiRequest, res: DriveApiResponse, accessToken: string) {
  res.setHeader("Set-Cookie", cookieValue(APP_COOKIE, accessToken, req, appTokenLifetime(accessToken)));
}

export function setDriveSessionCookies(
  req: DriveApiRequest,
  res: DriveApiResponse,
  driveToken: string,
  ownerId: string,
  appToken: string,
  maxAge: number,
) {
  const lifetime = Math.max(1, Math.min(3600, Math.floor(maxAge), appTokenLifetime(appToken)));
  res.setHeader("Set-Cookie", [
    cookieValue(DRIVE_COOKIE, driveToken, req, lifetime),
    cookieValue(OWNER_COOKIE, ownerId, req, lifetime),
    cookieValue(APP_COOKIE, appToken, req, lifetime),
  ]);
}

export function clearDriveSessionCookies(req: DriveApiRequest, res: DriveApiResponse) {
  res.setHeader("Set-Cookie", [
    clearCookieValue(DRIVE_COOKIE, req),
    clearCookieValue(OWNER_COOKIE, req),
    clearCookieValue(APP_COOKIE, req),
  ]);
}

export async function authenticateAppUser(
  req: DriveApiRequest,
  res: DriveApiResponse,
  allowHttpOnlyCookie = false,
): Promise<AppUser | null> {
  const token = appAccessToken(req, allowHttpOnlyCookie);
  if (!token || token.length > 8192) return null;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase server environment is not configured.");

  const url = supabaseUrl.replace(/\/+$/, "");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  if (!user.id) return null;
  if (req.headers.authorization) setAppAccessCookie(req, res, token);
  return { id: user.id, accessToken: token };
}

export function sameOriginRequest(req: DriveApiRequest): boolean {
  const origin = req.headers.origin;
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (typeof origin !== "string" || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

export async function driveApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { message?: string } | string };
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error.message === "string") return body.error.message;
  } catch {
    /* The upstream may return a non-JSON error body. */
  }
  return `Google Drive returned ${response.status}.`;
}

export function setNoStore(res: DriveApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function sendMethodNotAllowed(res: DriveApiResponse, allowed: string) {
  res.setHeader("Allow", allowed);
  sendJson(res, 405, { error: "Method not allowed." });
}
