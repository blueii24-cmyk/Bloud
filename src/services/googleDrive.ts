import { supabase } from "../lib/supabase";

export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export interface GoogleDriveSong {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime?: string;
  path: string;
}

export interface DriveScanProgress {
  foldersScanned: number;
  songsFound: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

interface DriveListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }): GoogleTokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac", "webm", "mp4"]);
const MAX_FOLDERS_TO_SCAN = 2000;
const MAX_SCAN_DEPTH = 24;
const PAGE_SIZE = 1000;

let identityScriptPromise: Promise<void> | null = null;

/** Load Google's Identity Services SDK before a user gesture requests a popup. */
export function preloadGoogleIdentity(clientId: string): Promise<void> {
  if (!clientId) return Promise.reject(new Error("Google OAuth client ID is not configured."));
  if (typeof window === "undefined") return Promise.reject(new Error("Google Drive is only available in a browser."));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (identityScriptPromise) return identityScriptPromise;

  identityScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else reject(new Error("Google Identity Services did not initialize."));
    };
    script.onerror = () => {
      identityScriptPromise = null;
      reject(new Error("Couldn't load Google's sign-in service. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });

  return identityScriptPromise;
}

/** Requests Drive read-only access only after the user chooses to connect Drive. */
export function requestGoogleDriveToken(clientId: string): Promise<{ accessToken: string; expiresIn: number }> {
  if (!clientId) return Promise.reject(new Error("Google Drive isn't configured yet. Ask the Bloud administrator to finish Google OAuth setup."));
  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google's sign-in service is still loading. Please try again in a moment."));
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: `openid email profile ${DRIVE_READONLY_SCOPE}`,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google didn't return a Drive access token. Please try again."));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: Number(response.expires_in) || 3600,
        });
      },
      error_callback: (error) => {
        reject(new Error(error.message || "Google sign-in was closed before Drive access was granted."));
      },
    });

    // The consent popup is opened directly from the user's button click.
    client.requestAccessToken({ prompt: "consent select_account" });
  });
}

async function appAuthorization(): Promise<Record<string, string>> {
  if (!supabase) throw new Error("Sign in to Bloud before connecting Google Drive.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your Bloud session expired. Sign in again to connect Google Drive.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) {
    if (response.status === 401) throw new Error(typeof data.error === "string" ? data.error : "Google Drive access expired. Reconnect your Drive to continue.");
    throw new Error(typeof data.error === "string" ? data.error : data.message || `Google Drive request failed (${response.status}).`);
  }
  return data as T;
}

async function getGoogleProfile(accessToken: string): Promise<{ email: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = await readJson<{ email?: string }>(response);
  return { email: user.email || "Google account" };
}

export interface DriveSessionInfo {
  email: string;
  expiresAt: number;
}

export async function createDriveSession(accessToken: string, expiresIn: number): Promise<DriveSessionInfo> {
  if (__VERCEL__) {
    const response = await fetch("/api/drive/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await appAuthorization()) },
      body: JSON.stringify({ accessToken, expiresIn }),
    });
    return readJson<DriveSessionInfo>(response);
  }

  // Local development and non-Vercel static hosts keep the short-lived access
  // token in memory and call Drive directly. It is never written to storage.
  const profile = await getGoogleProfile(accessToken);
  return { email: profile.email, expiresAt: Date.now() + expiresIn * 1000 };
}

export async function restoreDriveSession(): Promise<DriveSessionInfo | null> {
  if (!__VERCEL__) return null;
  const response = await fetch("/api/drive/session", {
    credentials: "same-origin",
    headers: await appAuthorization(),
  });
  if (response.status === 401) return null;
  return readJson<DriveSessionInfo>(response);
}

export async function deleteDriveSession(): Promise<void> {
  if (!__VERCEL__) return;
  await fetch("/api/drive/session", { method: "DELETE", credentials: "same-origin" });
}

export async function revokeGoogleDriveToken(accessToken: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  }).catch(() => undefined);
}

function googleDriveFilesUrl(parentId: string, kind: "folders" | "all", pageToken?: string): string {
  const query = [`'${parentId}' in parents`, "trashed = false"];
  if (kind === "folders") query.push("mimeType = 'application/vnd.google-apps.folder'");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query.join(" and "));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url.toString();
}

async function fetchDrivePage(
  accessToken: string | null,
  parentId: string,
  kind: "folders" | "all",
  pageToken?: string,
  signal?: AbortSignal,
): Promise<DriveListResponse> {
  if (__VERCEL__) {
    const params = new URLSearchParams({ parentId, kind });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`/api/drive/files?${params}`, {
      credentials: "same-origin",
      headers: await appAuthorization(),
      signal,
    });
    return readJson<DriveListResponse>(response);
  }

  if (!accessToken) throw new Error("Reconnect Google Drive before browsing this folder.");
  const response = await fetch(googleDriveFilesUrl(parentId, kind, pageToken), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  return readJson<DriveListResponse>(response);
}

async function listChildren(
  accessToken: string | null,
  parentId: string,
  kind: "folders" | "all",
  signal?: AbortSignal,
): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = await fetchDrivePage(accessToken, parentId, kind, pageToken, signal);
    all.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

export async function listGoogleDriveFolders(
  accessToken: string | null,
  parentId: string,
  signal?: AbortSignal,
): Promise<GoogleDriveFolder[]> {
  const folders = await listChildren(accessToken, parentId, "folders", signal);
  return folders.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function isAudioFile(file: DriveFile): boolean {
  if (file.mimeType?.startsWith("audio/")) return true;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(extension);
}

/** Scans the selected folder and nested folders, keeping each file's path for display. */
export async function scanGoogleDriveFolder(
  accessToken: string | null,
  folder: GoogleDriveFolder,
  signal?: AbortSignal,
  onProgress?: (progress: DriveScanProgress) => void,
): Promise<GoogleDriveSong[]> {
  const pending: Array<{ id: string; name: string; path: string; depth: number }> = [
    { ...folder, path: folder.name, depth: 0 },
  ];
  const songs: GoogleDriveSong[] = [];
  let foldersScanned = 0;

  while (pending.length) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    if (foldersScanned >= MAX_FOLDERS_TO_SCAN) {
      throw new Error(`Stopped after ${MAX_FOLDERS_TO_SCAN} folders. Choose a smaller music folder.`);
    }

    const batch = pending.splice(0, Math.min(4, MAX_FOLDERS_TO_SCAN - foldersScanned));
    const results = await Promise.all(
      batch.map(async (current) => ({
        current,
        files: await listChildren(accessToken, current.id, "all", signal),
      })),
    );

    for (const { current, files } of results) {
      foldersScanned += 1;
      for (const file of files) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          if (current.depth < MAX_SCAN_DEPTH) {
            pending.push({ id: file.id, name: file.name, path: `${current.path}/${file.name}`, depth: current.depth + 1 });
          }
          continue;
        }
        if (!isAudioFile(file)) continue;
        songs.push({
          id: file.id,
          name: file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim() || file.name,
          mimeType: file.mimeType,
          size: Number(file.size) || 0,
          modifiedTime: file.modifiedTime,
          path: `${current.path}/${file.name}`,
        });
      }
      onProgress?.({ foldersScanned, songsFound: songs.length });
    }
  }

  return songs.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/** Returns a range-capable same-origin stream proxy URL on Vercel. */
export async function getGoogleDriveMediaUrl(fileId: string, accessToken: string | null): Promise<string> {
  if (__VERCEL__) return `/api/drive/media?fileId=${encodeURIComponent(fileId)}`;
  if (!accessToken) throw new Error("Reconnect Google Drive before playing this song.");

  // Local/static-host fallback buffers to a Blob so the OAuth token never appears
  // in a media URL. Production uses a range-aware server-side streaming proxy.
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Google Drive access expired. Reconnect your Drive to continue.");
    throw new Error("Google Drive couldn't open that audio file.");
  }
  return URL.createObjectURL(await response.blob());
}

export function revokeGoogleDriveMediaUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
