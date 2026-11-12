import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, Check, ChevronRight, Cloud, FileAudio, Folder,
  FolderOpen, HardDrive, LoaderCircle, Pause, Play, RefreshCw, Search,
  ShieldCheck, Unplug,
} from "lucide-react";
import { Button } from "../components/ui/Buttons";
import { LocalMusicPicker } from "../components/media/LocalMusicPicker";
import { useAuth } from "../state/AuthContext";
import { useGoogleDrive } from "../state/GoogleDriveContext";
import {
  getGoogleDriveMediaUrl,
  listGoogleDriveFolders,
  revokeGoogleDriveMediaUrl,
  scanGoogleDriveFolder,
  type DriveScanProgress,
  type GoogleDriveFolder,
  type GoogleDriveSong,
} from "../services/googleDrive";
import { cn } from "../utils/cn";

const ROOT_FOLDER: GoogleDriveFolder = { id: "root", name: "My Drive" };
type MusicSource = "device" | "google";

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extension(song: GoogleDriveSong) {
  const fileName = song.path.split("/").pop() ?? song.path;
  return fileName.includes(".") ? fileName.split(".").pop()!.toUpperCase() : song.mimeType.replace(/^.*\//, "").toUpperCase();
}

function needsReconnect(message: string) {
  return /reconnect|access expired|sign in to bloud/i.test(message);
}

export default function DriveMusic() {
  const auth = useAuth();
  const drive = useGoogleDrive();
  const audioRef = useRef<HTMLAudioElement>(null);
  const folderAbort = useRef<AbortController | null>(null);
  const scanAbort = useRef<AbortController | null>(null);
  const playRequest = useRef(0);
  const objectUrl = useRef<string | null>(null);

  const [source, setSource] = useState<MusicSource>("device");
  const [folderPath, setFolderPath] = useState<GoogleDriveFolder[]>([ROOT_FOLDER]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderRefresh, setFolderRefresh] = useState(0);
  const [folderError, setFolderError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanProgress, setScanProgress] = useState<DriveScanProgress>({ foldersScanned: 0, songsFound: 0 });
  const [songs, setSongs] = useState<GoogleDriveSong[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedSong, setSelectedSong] = useState<GoogleDriveSong | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  const currentFolder = folderPath[folderPath.length - 1] ?? ROOT_FOLDER;
  const visibleSongs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return songs.filter((song) => !query || song.name.toLowerCase().includes(query) || song.path.toLowerCase().includes(query));
  }, [songs, filter]);

  const clearAudio = () => {
    playRequest.current += 1;
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    revokeGoogleDriveMediaUrl(objectUrl.current);
    objectUrl.current = null;
    setSelectedSong(null);
    setAudioUrl(null);
    setAudioLoading(false);
    setAudioPlaying(false);
    setPlaybackError("");
  };

  const changeSource = (nextSource: MusicSource) => {
    if (nextSource === source) return;
    folderAbort.current?.abort();
    scanAbort.current?.abort();
    setFolderLoading(false);
    setScanning(false);
    setFolderError("");
    setFilter("");
    clearAudio();
    setSource(nextSource);
  };

  useEffect(() => {
    if (source !== "google" || drive.status !== "connected") {
      folderAbort.current?.abort();
      setFolders([]);
      setFolderLoading(false);
      return;
    }

    const controller = new AbortController();
    folderAbort.current?.abort();
    folderAbort.current = controller;
    setFolderLoading(true);
    setFolderError("");
    void listGoogleDriveFolders(drive.accessToken, currentFolder.id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setFolders(result);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const message = reason instanceof Error ? reason.message : "Couldn't load Google Drive folders.";
        setFolders([]);
        setFolderError(message);
        if (needsReconnect(message)) void drive.disconnect();
      })
      .finally(() => {
        if (!controller.signal.aborted) setFolderLoading(false);
      });
    return () => controller.abort();
  }, [source, drive.status, drive.accessToken, currentFolder.id, drive.disconnect, folderRefresh]);

  useEffect(() => {
    if (source !== "google" || drive.status !== "disconnected") return;
    scanAbort.current?.abort();
    setScanning(false);
    setHasScanned(false);
    setSongs([]);
    clearAudio();
  }, [source, drive.status]);

  useEffect(() => {
    return () => {
      folderAbort.current?.abort();
      scanAbort.current?.abort();
      audioRef.current?.pause();
      revokeGoogleDriveMediaUrl(objectUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    void audio.play().catch(() => {
      setPlaybackError("Press play in the audio player to start this song.");
    });
  }, [audioUrl]);

  const connectDrive = async () => {
    setFolderError("");
    drive.clearError();
    const error = await drive.connect();
    if (error) setFolderError(error);
  };

  const disconnectDrive = async () => {
    scanAbort.current?.abort();
    setScanning(false);
    setHasScanned(false);
    setSongs([]);
    setFolderPath([ROOT_FOLDER]);
    setFilter("");
    setFolderError("");
    clearAudio();
    await drive.disconnect();
  };

  const enterFolder = (folder: GoogleDriveFolder) => {
    scanAbort.current?.abort();
    setScanning(false);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setFolderPath((path) => [...path, folder]);
    setFolderError("");
    clearAudio();
  };

  const goToBreadcrumb = (index: number) => {
    scanAbort.current?.abort();
    setScanning(false);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setFolderPath((path) => path.slice(0, index + 1));
    setFolderError("");
    clearAudio();
  };

  const scanCurrentFolder = async () => {
    if (drive.status !== "connected") return;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setFolderError("");
    setScanning(true);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setScanProgress({ foldersScanned: 0, songsFound: 0 });
    clearAudio();
    try {
      const found = await scanGoogleDriveFolder(
        drive.accessToken,
        currentFolder,
        controller.signal,
        setScanProgress,
      );
      if (controller.signal.aborted) return;
      setSongs(found);
      setHasScanned(true);
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : "Couldn't scan this Google Drive folder.";
      setFolderError(message);
      if (needsReconnect(message)) void drive.disconnect();
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  };

  const playSong = async (song: GoogleDriveSong) => {
    if (selectedSong?.id === song.id && audioUrl && audioRef.current) {
      if (audioRef.current.paused) {
        void audioRef.current.play().catch(() => setPlaybackError("Press play in the audio player to start this song."));
      } else {
        audioRef.current.pause();
      }
      return;
    }

    const requestId = ++playRequest.current;
    setSelectedSong(song);
    setAudioUrl(null);
    setAudioLoading(true);
    setAudioPlaying(false);
    setPlaybackError("");
    audioRef.current?.pause();
    revokeGoogleDriveMediaUrl(objectUrl.current);
    objectUrl.current = null;

    try {
      const url = await getGoogleDriveMediaUrl(song.id, drive.accessToken);
      if (playRequest.current !== requestId) {
        revokeGoogleDriveMediaUrl(url);
        return;
      }
      if (url.startsWith("blob:")) objectUrl.current = url;
      setAudioUrl(url);
    } catch (reason) {
      if (playRequest.current !== requestId) return;
      const message = reason instanceof Error ? reason.message : "Google Drive couldn't open this audio file.";
      setPlaybackError(message);
      if (needsReconnect(message)) void drive.disconnect();
    } finally {
      if (playRequest.current === requestId) setAudioLoading(false);
    }
  };

  const playNextSong = () => {
    if (!selectedSong) return;
    const index = songs.findIndex((song) => song.id === selectedSong.id);
    if (index >= 0 && index + 1 < songs.length) void playSong(songs[index + 1]);
    else setAudioPlaying(false);
  };

  const resetFolder = () => {
    scanAbort.current?.abort();
    setScanning(false);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setFolderPath([ROOT_FOLDER]);
    setFolderError("");
    clearAudio();
  };

  const authenticated = auth.status === "authed";
  const identityLoading = drive.configured && !drive.identityReady && !drive.error;
  const identityFailed = drive.configured && !drive.identityReady && Boolean(drive.error);

  return (
    <div className="mx-auto max-w-6xl pb-8 pt-1 lg:pt-0">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-eyebrow">Personal library</p>
          <h1 className="t-page mt-1">Drive Music</h1>
          <p className="t-meta mt-2 max-w-xl">Play music from a folder on this device or browse your connected Google Drive.</p>
        </div>
        {source === "google" && drive.status === "connected" && (
          <Button variant="secondary" onClick={disconnectDrive}>
            <Unplug className="size-4" /> Disconnect Drive
          </Button>
        )}
      </header>

      <div className="mt-6 flex w-fit max-w-full gap-1 rounded-full bg-white/[0.06] p-1" role="group" aria-label="Music source">
        <button
          type="button"
          aria-pressed={source === "device"}
          onClick={() => changeSource("device")}
          className={cn("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", source === "device" ? "bg-white text-black" : "text-fg-2 hover:text-fg")}
        >
          <HardDrive className="size-4" /> This device
        </button>
        <button
          type="button"
          aria-pressed={source === "google"}
          onClick={() => changeSource("google")}
          className={cn("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", source === "google" ? "bg-white text-black" : "text-fg-2 hover:text-fg")}
        >
          <Cloud className="size-4" /> Google Drive
        </button>
      </div>

      <div hidden={source !== "device"}>
        <LocalMusicPicker active={source === "device"} />
      </div>

      {source === "google" ? (
        !authenticated ? (
        <section className="mt-6 rounded-2xl border border-line bg-bg-2 p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Cloud className="size-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">Sign in to connect your Drive</h2>
          <p className="t-meta mt-2 max-w-xl text-sm leading-6">
            Google Drive is an optional, read-only connection for Bloud accounts. Guest access and the rest of your music experience remain available.
          </p>
          {auth.walled && <Link to="/login" className="mt-5 inline-flex h-10 items-center rounded-full bg-fg px-5 text-sm font-semibold text-black hover:bg-white/90">Log in or create an account</Link>}
        </section>
      ) : drive.status === "loading" ? (
        <section className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-line bg-bg-2" role="status">
          <LoaderCircle className="size-6 animate-spin text-accent" />
          <span className="ml-3 text-sm text-fg-2">Checking your Drive connection…</span>
        </section>
      ) : drive.status === "disconnected" || drive.status === "connecting" ? (
        <section className="mt-6 rounded-2xl border border-line bg-bg-2 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent"><HardDrive className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Connect Google Drive</h2>
              <p className="t-meta mt-1 max-w-2xl text-sm leading-6">
                Bloud will ask Google for read-only access to find folders and stream your audio. You choose whether to grant access, and you can disconnect at any time.
              </p>
            </div>
            <Button variant="primary" onClick={connectDrive} disabled={drive.status === "connecting" || identityLoading || identityFailed} className="w-full shrink-0 sm:w-auto">
              {drive.status === "connecting" || identityLoading
                ? <LoaderCircle className="size-4 animate-spin" />
                : <Cloud className="size-4" />}
              {drive.status === "connecting" ? "Connecting…" : identityLoading ? "Loading Google…" : identityFailed ? "Google unavailable" : "Connect Google Drive"}
            </Button>
          </div>
          {(folderError || drive.error) && <p className="mt-4 flex items-start gap-2 text-sm text-danger" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0" />{folderError || drive.error}</p>}
          {!drive.configured && <p className="t-meta mt-3 text-xs">Drive connection needs a Google OAuth Web client ID in the Bloud deployment configuration.</p>}
          <p className="mt-5 flex items-center gap-2 text-xs text-fg-3"><ShieldCheck className="size-4 shrink-0 text-accent" /> Your Drive token is kept out of URLs and browser storage.</p>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Check className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Google Drive connected</h2>
                <p className="t-meta mt-0.5 truncate text-[13px]">{drive.email}</p>
              </div>
              <p className="t-caption flex items-center gap-1.5"><ShieldCheck className="size-4 text-accent" /> Read-only access</p>
            </div>
          </section>

          <section aria-labelledby="folder-picker-title" className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg-2">
            <div className="border-b border-line p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-accent"><Folder className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <h2 id="folder-picker-title" className="text-lg font-semibold">Choose a music folder</h2>
                  <p className="t-meta mt-1 text-[13px] leading-5">Browse your Drive, then scan the selected folder and its subfolders for audio.</p>
                </div>
                <Button variant="primary" onClick={scanCurrentFolder} disabled={folderLoading || scanning} className="w-full shrink-0 sm:w-auto">
                  {scanning ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                  {scanning ? "Scanning…" : `Scan “${currentFolder.name}”`}
                </Button>
              </div>
              <nav aria-label="Google Drive folder path" className="mt-5 flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
                {folderPath.map((folder, index) => (
                  <span key={`${folder.id}-${index}`} className="flex shrink-0 items-center gap-1">
                    {index > 0 && <ChevronRight className="size-4 text-fg-3" />}
                    <button
                      type="button"
                      onClick={() => goToBreadcrumb(index)}
                      disabled={index === folderPath.length - 1}
                      aria-current={index === folderPath.length - 1 ? "page" : undefined}
                      className={cn("max-w-40 truncate rounded px-1 py-1 transition hover:text-fg disabled:font-semibold disabled:text-fg", index === folderPath.length - 1 ? "text-fg" : "text-fg-3")}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>

            {folderError && (
              <div className="m-4 flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 sm:flex-row sm:items-center">
                <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-danger" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0" />{folderError}</p>
                {needsReconnect(folderError) && <Button size="sm" variant="secondary" onClick={connectDrive}>Reconnect Google</Button>}
                {!needsReconnect(folderError) && <Button size="sm" variant="secondary" onClick={() => setFolderRefresh((value) => value + 1)}>Retry</Button>}
              </div>
            )}

            <div className="p-2 sm:p-3">
              {folderLoading ? (
                <div className="flex min-h-36 items-center justify-center" role="status">
                  <LoaderCircle className="size-5 animate-spin text-accent" />
                  <span className="ml-3 text-sm text-fg-2">Loading folders…</span>
                </div>
              ) : folders.length > 0 ? (
                <ul className="space-y-1">
                  {folders.map((folder) => (
                    <li key={folder.id}>
                      <button
                        type="button"
                        onClick={() => enterFolder(folder)}
                        className="group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[0.06]"
                      >
                        <Folder className="size-5 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                        <span className="hidden text-xs text-fg-3 group-hover:block">Open folder</span>
                        <ChevronRight className="size-4 shrink-0 text-fg-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !folderError ? (
                <div className="flex min-h-28 flex-col items-center justify-center text-center">
                  <Folder className="size-6 text-fg-3" />
                  <p className="mt-2 text-sm font-medium">No subfolders here</p>
                  <p className="t-meta mt-1 text-xs">You can scan this folder now.</p>
                </div>
              ) : null}
            </div>
          </section>

          {scanning && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4" role="status">
              <LoaderCircle className="size-5 animate-spin text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Scanning {currentFolder.name} and its subfolders…</p>
                <p className="t-meta mt-0.5 text-xs">{scanProgress.foldersScanned.toLocaleString()} folders checked · {scanProgress.songsFound.toLocaleString()} songs found</p>
              </div>
            </div>
          )}

          {hasScanned && !scanning && (
            <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg-2" aria-labelledby="songs-title">
              <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-2">
                  <FileAudio className="size-4 text-accent" />
                  <h2 id="songs-title" className="font-semibold">Songs in {currentFolder.name}</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-fg-2">{visibleSongs.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.07] px-3 focus-within:ring-2 focus-within:ring-accent/60 sm:w-56 sm:flex-none">
                    <Search className="size-4 shrink-0 text-fg-3" />
                    <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter songs" aria-label="Filter Drive songs" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
                  </label>
                  <Button size="sm" variant="secondary" onClick={resetFolder}><RefreshCw className="size-3.5" /> Change folder</Button>
                </div>
              </div>

              {selectedSong && (
                <div className="border-b border-line bg-white/[0.025] p-4 sm:p-5">
                  <div className="mb-3 flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><FileAudio className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{selectedSong.name}</p>
                      <p className="t-meta truncate text-xs">{selectedSong.path}</p>
                    </div>
                    {audioLoading && <LoaderCircle className="size-4 shrink-0 animate-spin text-accent" />}
                    {audioPlaying && <span className="flex shrink-0 items-center gap-1.5 text-xs text-accent"><Pause className="size-3.5" /> Playing</span>}
                  </div>
                  {audioUrl && <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="h-10 w-full" onPlay={() => setAudioPlaying(true)} onPause={() => setAudioPlaying(false)} onEnded={playNextSong} onError={() => { setAudioPlaying(false); setPlaybackError("This audio file couldn't be played. Check the file format and your Google Drive access."); }} />}
                  {playbackError && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <p className="flex min-w-0 flex-1 items-start gap-2 text-xs text-danger" role="alert"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{playbackError}</p>
                      {drive.status === "connected" && <Button size="sm" variant="secondary" onClick={connectDrive}>Reconnect Drive</Button>}
                    </div>
                  )}
                </div>
              )}

              {visibleSongs.length > 0 ? (
                <div className="px-2 pb-3 sm:px-3">
                  <div className="t-eyebrow hidden h-8 items-center gap-3 border-b border-line px-2 md:flex">
                    <span className="w-7 text-center">#</span><span className="w-10" /><span className="flex-1">Title</span><span className="w-20">Format</span><span className="w-20 text-right">Size</span>
                  </div>
                  <ul className="mt-1 space-y-0.5" aria-live="polite">
                    {visibleSongs.map((song, index) => {
                      const selected = selectedSong?.id === song.id;
                      return (
                        <li key={song.id}>
                          <button
                            type="button"
                            onClick={() => void playSong(song)}
                            className={cn("group flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.06]", selected && "bg-white/[0.06]")}
                            aria-label={`${selected && audioPlaying ? "Pause" : "Play"} ${song.name}`}
                          >
                            <span className="t-meta hidden w-7 shrink-0 text-center tabular-nums md:block">{index + 1}</span>
                            <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-art bg-white/[0.07]", selected ? "text-accent" : "text-fg-2")}>
                              <FileAudio className="size-5" />
                              <span className="absolute inset-0 grid place-items-center rounded-art bg-black/35 opacity-0 transition group-hover:opacity-100">
                                {selected && audioPlaying ? <Pause className="size-4 fill-white text-white" /> : <Play className="size-4 fill-white text-white" />}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-[15px] font-medium", selected && "text-accent")}>{song.name}</span>
                              <span className="t-caption mt-0.5 block truncate">{song.path}</span>
                            </span>
                            <span className="t-caption hidden w-20 shrink-0 md:block">{extension(song)}</span>
                            <span className="t-meta w-20 shrink-0 text-right text-xs tabular-nums">{readableSize(song.size)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <FileAudio className="size-8 text-fg-3" />
                  <h3 className="mt-4 font-semibold">{songs.length ? "No matching songs" : "No audio files found"}</h3>
                  <p className="t-meta mt-2 max-w-md text-[13px]">{songs.length ? "Try a different search." : "Try another folder. Supported formats include MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, and WebM."}</p>
                </div>
              )}
            </section>
          )}
        </>
        )
      ) : null}

      <div className="mt-4 flex flex-col gap-2 text-xs text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-accent" /> {source === "device" ? "Your selected music stays on this device. Nothing is uploaded." : "Drive audio is streamed through Bloud and isn't uploaded to your library."}</p>
        <p className="flex items-center gap-2">{source === "device" ? <HardDrive className="size-4 shrink-0" /> : <Cloud className="size-4 shrink-0" />} {source === "device" ? "Choose the folder again after refreshing; access is temporary." : "Drive access stays optional and read-only."}</p>
      </div>
    </div>
  );
}
