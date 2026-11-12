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
const FOLDER_MIME = "application/vnd.google-apps.folder";

export default async function handler(req: DriveApiRequest, res: DriveApiResponse) {
  setNoStore(res);
  if (req.method !== "GET") {
    sendMethodNotAllowed(res, "GET");
    return;
  }

  let user;
  try {
    user = await authenticateAppUser(req, res);
  } catch {
    sendJson(res, 503, { error: "Bloud couldn't verify your account. Please try again later." });
    return;
  }
  if (!user) {
    sendJson(res, 401, { error: "Sign in to Bloud before browsing Google Drive." });
    return;
  }

  const token = getDriveToken(req);
  if (!token || getDriveOwnerId(req) !== user.id) {
    clearDriveSessionCookies(req, res);
    sendJson(res, 401, { error: "Reconnect Google Drive before browsing this folder." });
    return;
  }

  const parentId = getQuery(req, "parentId");
  const kind = getQuery(req, "kind");
  const pageToken = getQuery(req, "pageToken");
  if (!parentId || parentId.length > 512 || !TOKEN_PATTERN.test(parentId)) {
    sendJson(res, 400, { error: "Invalid Google Drive folder." });
    return;
  }
  if (kind !== "all" && kind !== "folders") {
    sendJson(res, 400, { error: "Invalid Drive listing type." });
    return;
  }
  if (pageToken && (pageToken.length > 8192 || /[\r\n]/.test(pageToken))) {
    sendJson(res, 400, { error: "Invalid Google Drive page token." });
    return;
  }

  const query = [`'${parentId}' in parents`, "trashed = false"];
  if (kind === "folders") query.push(`mimeType = '${FOLDER_MIME}'`);
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query.join(" and "));
  url.searchParams.set("pageSize", "1000");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!upstream.ok) {
    if (upstream.status === 401) {
      clearDriveSessionCookies(req, res);
      sendJson(res, 401, { error: "Google Drive access expired. Reconnect your Drive to continue." });
      return;
    }
    sendJson(res, upstream.status, { error: await driveApiError(upstream) });
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.end(await upstream.text());
}
