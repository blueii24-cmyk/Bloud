import type { DriveApiRequest, DriveApiResponse } from "../../server/driveApi";
import {
  authenticateAppUser,
  clearDriveSessionCookies,
  driveApiError,
  getDriveOwnerId,
  getDriveToken,
  readBody,
  sameOriginRequest,
  sendJson,
  sendMethodNotAllowed,
  setDriveSessionCookies,
  setNoStore,
} from "../../server/driveApi";

function invalidOrigin(req: DriveApiRequest, res: DriveApiResponse): boolean {
  if (sameOriginRequest(req)) return false;
  sendJson(res, 403, { error: "This request must come from Bloud." });
  return true;
}

export default async function handler(req: DriveApiRequest, res: DriveApiResponse) {
  setNoStore(res);

  if (req.method === "POST") {
    if (invalidOrigin(req, res)) return;
    let user;
    try {
      user = await authenticateAppUser(req, res);
    } catch {
      sendJson(res, 503, { error: "Bloud couldn't verify your account. Please try again later." });
      return;
    }
    if (!user) {
      sendJson(res, 401, { error: "Sign in to Bloud before connecting Google Drive." });
      return;
    }

    const body = readBody(req);
    const token = body?.accessToken;
    const expiresIn = Number(body?.expiresIn);
    if (typeof token !== "string" || token.length < 20 || token.length > 8192 || !Number.isFinite(expiresIn)) {
      sendJson(res, 400, { error: "Invalid Google Drive session." });
      return;
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      sendJson(res, 401, { error: await driveApiError(profileResponse) });
      return;
    }
    const profile = await profileResponse.json() as { email?: string };
    const lifetime = Math.max(60, Math.min(3600, Math.floor(expiresIn || 3600)));
    setDriveSessionCookies(req, res, token, user.id, user.accessToken, lifetime);
    sendJson(res, 200, { email: profile.email || "Google account", expiresAt: Date.now() + lifetime * 1000 });
    return;
  }

  if (req.method === "GET") {
    let user;
    try {
      user = await authenticateAppUser(req, res);
    } catch {
      sendJson(res, 503, { error: "Bloud couldn't verify your account. Please try again later." });
      return;
    }
    if (!user) {
      sendJson(res, 401, { error: "Sign in to Bloud before using Google Drive." });
      return;
    }

    const token = getDriveToken(req);
    if (!token || getDriveOwnerId(req) !== user.id) {
      clearDriveSessionCookies(req, res);
      sendJson(res, 401, { error: "Google Drive isn't connected to this Bloud account." });
      return;
    }
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      clearDriveSessionCookies(req, res);
      sendJson(res, 401, { error: "Google Drive access expired. Reconnect your Drive to continue." });
      return;
    }
    const profile = await profileResponse.json() as { email?: string };
    sendJson(res, 200, { email: profile.email || "Google account", expiresAt: 0 });
    return;
  }

  if (req.method === "DELETE") {
    if (req.headers.origin && invalidOrigin(req, res)) return;
    const token = getDriveToken(req);
    if (token) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        cache: "no-store",
      }).catch(() => undefined);
    }
    clearDriveSessionCookies(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  sendMethodNotAllowed(res, "GET, POST, DELETE");
}
