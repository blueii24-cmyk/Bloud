import type { DriveApiRequest, DriveApiResponse } from "../../server/driveApi";
import {
  authenticateAppUser,
  clearDriveSessionCookies,
  driveApiError,
  getDriveOwnerId,
  getDriveToken,
  getQuery,
  sendJson,
  sendMethodNotAllowed,
  setNoStore,
} from "../../server/driveApi";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export default async function handler(req: DriveApiRequest, res: DriveApiResponse) {
  setNoStore(res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendMethodNotAllowed(res, "GET, HEAD");
    return;
  }

  let user;
  try {
    user = await authenticateAppUser(req, res, true);
  } catch {
    sendJson(res, 503, { error: "Bloud couldn't verify your account. Please try again later." });
    return;
  }
  if (!user) {
    sendJson(res, 401, { error: "Sign in to Bloud before streaming Google Drive audio." });
    return;
  }

  const token = getDriveToken(req);
  if (!token || getDriveOwnerId(req) !== user.id) {
    clearDriveSessionCookies(req, res);
    sendJson(res, 401, { error: "Reconnect Google Drive before playing this song." });
    return;
  }

  const fileId = getQuery(req, "fileId");
  if (!fileId || fileId.length > 512 || !TOKEN_PATTERN.test(fileId)) {
    sendJson(res, 400, { error: "Invalid Google Drive file." });
    return;
  }

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = req.headers.range;
  if (typeof range === "string" && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) headers.Range = range;
  const upstream = await fetch(url, {
    headers,
    method: req.method,
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) {
    if (upstream.status === 401) {
      clearDriveSessionCookies(req, res);
      sendJson(res, 401, { error: "Google Drive access expired. Reconnect your Drive to continue." });
      return;
    }
    sendJson(res, upstream.status, { error: await driveApiError(upstream) });
    return;
  }

  res.statusCode = upstream.status;
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  if (!res.getHeader("content-type")) res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }
  try {
    for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
      if (res.destroyed) break;
      if (!res.write(chunk)) await new Promise<void>((resolve) => res.once("drain", resolve));
    }
    if (!res.destroyed) res.end();
  } catch {
    if (!res.destroyed) res.destroy();
  }
}
