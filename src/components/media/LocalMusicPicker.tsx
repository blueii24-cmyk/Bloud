import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle, Check, FileAudio, Folder, FolderOpen, HardDrive, LoaderCircle,
  Pause, Play, RefreshCw, Search,
} from "lucide-react";
import { Button } from "../ui/Buttons";
import { cn } from "../../utils/cn";

interface LocalSong {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  file: File;
}

const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "webm"];

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function songName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim() || fileName;
}

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isAudio(file: File) {
  return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.includes(fileExtension(file));
}

interface LocalMusicPickerProps {
  active: boolean;
}

/** Browser-only folder selection; selected files are never uploaded or persisted. */
export function LocalMusicPicker({ active }: LocalMusicPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scanId = useRef(0);
  const objectUrl = useRef<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [scannedFiles, setScannedFiles] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  const visibleSongs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return songs.filter((song) => !query || song.name.toLowerCase().includes(query) || song.path.toLowerCase().includes(query));
  }, [songs, filter]);

  const clearPlayback = () => {
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSelectedSong(null);
    setAudioUrl(null);
    setAudioPlaying(false);
    setPlaybackError("");
  };

  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    void audio.play().catch(() => {
      setPlaybackError("Press play in the audio player to start this song.");
    });
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      scanId.current += 1;
      audioRef.current?.pause();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  const selectFolder = () => inputRef.current?.click();

  const scanFolder = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const currentScan = ++scanId.current;
    const firstPath = files[0].webkitRelativePath || files[0].name;
    setFolderName(firstPath.split("/")[0] || "Selected folder");
    setScanning(true);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setScannedFiles(0);
    clearPlayback();

    // Yield once so the scanning status is visible before processing large folders.
    window.setTimeout(() => {
      if (currentScan !== scanId.current) return;
      const found = files
        .filter(isAudio)
        .map((file, index): LocalSong => ({
          id: `${file.webkitRelativePath || file.name}-${file.lastModified}-${index}`,
          name: songName(file.name),
          path: file.webkitRelativePath || file.name,
          extension: fileExtension(file).toUpperCase() || "AUDIO",
          size: file.size,
          file,
        }))
        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

      setScannedFiles(files.length);
      setSongs(found);
      setScanning(false);
      setHasScanned(true);
    }, 250);
  };

  const playSong = (song: LocalSong) => {
    if (selectedSong?.id === song.id && audioUrl && audioRef.current) {
      if (audioRef.current.paused) {
        void audioRef.current.play().catch(() => setPlaybackError("Press play in the audio player to start this song."));
      } else {
        audioRef.current.pause();
      }
      return;
    }

    audioRef.current?.pause();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(song.file);
    objectUrl.current = url;
    setSelectedSong(song);
    setAudioUrl(url);
    setAudioPlaying(false);
    setPlaybackError("");
  };

  const playNextSong = () => {
    if (!selectedSong) return;
    const index = songs.findIndex((song) => song.id === selectedSong.id);
    if (index >= 0 && index + 1 < songs.length) playSong(songs[index + 1]);
    else setAudioPlaying(false);
  };

  return (
    <section aria-labelledby="local-folder-title" className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg-2">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm"
        multiple
        // @ts-expect-error Non-standard directory selection is supported by Chromium, Firefox and Safari.
        webkitdirectory=""
        className="hidden"
        aria-label="Choose a folder of music on this device"
        onChange={scanFolder}
      />

      <div className={cn("p-5 sm:p-6", (hasScanned || scanning) && "border-b border-line")}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent"><HardDrive className="size-7" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="local-folder-title" className="text-lg font-semibold">{folderName || "Choose music from this device"}</h2>
            <p className="t-meta mt-1 text-[13px]">
              {scanning ? "Looking for audio files in this folder and its subfolders…"
                : hasScanned ? `${scannedFiles.toLocaleString()} files scanned · ${songs.length.toLocaleString()} audio files found`
                : "Select a folder on this device or a connected USB drive. Subfolders are included automatically."}
            </p>
          </div>
          <Button variant="primary" onClick={selectFolder} disabled={scanning} className="w-full shrink-0 sm:w-auto">
            {scanning ? <LoaderCircle className="size-4 animate-spin" /> : hasScanned ? <RefreshCw className="size-4" /> : <FolderOpen className="size-4" />}
            {scanning ? "Scanning folder…" : hasScanned ? "Change folder" : "Choose music folder"}
          </Button>
        </div>
      </div>

      {scanning && (
        <div className="flex flex-col items-center px-5 py-12 text-center" role="status">
          <LoaderCircle className="size-8 animate-spin text-accent" />
          <h3 className="mt-4 font-semibold">Scanning {folderName}</h3>
          <p className="t-meta mt-1 text-[13px]">This may take a moment for large folders.</p>
        </div>
      )}

      {hasScanned && !scanning && songs.length > 0 && (
        <div>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-accent" />
              <h3 className="font-semibold">Songs in this folder</h3>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-fg-2">{visibleSongs.length}</span>
            </div>
            <label className="flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-3 focus-within:ring-2 focus-within:ring-accent/60 sm:w-64">
              <Search className="size-4 shrink-0 text-fg-3" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter songs" aria-label="Filter local songs" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
            </label>
          </div>

          {selectedSong && (
            <div className="border-y border-line bg-white/[0.025] p-4 sm:p-5">
              <div className="mb-3 flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><FileAudio className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedSong.name}</p>
                  <p className="t-meta truncate text-xs">{selectedSong.path}</p>
                </div>
                {audioPlaying && <span className="flex shrink-0 items-center gap-1.5 text-xs text-accent"><Pause className="size-3.5" /> Playing</span>}
              </div>
              {audioUrl && <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="h-10 w-full" onPlay={() => setAudioPlaying(true)} onPause={() => setAudioPlaying(false)} onEnded={playNextSong} onError={() => { setAudioPlaying(false); setPlaybackError("This audio file couldn't be played. Check the format or choose another file."); }} />}
              {playbackError && <p className="mt-2 flex items-start gap-2 text-xs text-danger" role="alert"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{playbackError}</p>}
            </div>
          )}

          {visibleSongs.length > 0 ? (
            <div className="px-2 pb-3 sm:px-4">
              <div className="t-eyebrow hidden h-8 items-center gap-3 border-b border-line px-2 md:flex">
                <span className="w-6 text-center">#</span><span className="w-10" /><span className="flex-1">Title</span><span className="w-20">Format</span><span className="w-20 text-right">Size</span>
              </div>
              <ul className="mt-1 space-y-0.5" aria-live="polite">
                {visibleSongs.map((song, index) => {
                  const selected = selectedSong?.id === song.id;
                  return (
                    <li key={song.id}>
                      <button
                        type="button"
                        onClick={() => playSong(song)}
                        className={cn("group flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.06]", selected && "bg-white/[0.06]")}
                        aria-label={`${selected && audioPlaying ? "Pause" : "Play"} ${song.name}`}
                      >
                        <span className="t-meta hidden w-6 shrink-0 text-center tabular-nums md:block">{index + 1}</span>
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
                        <span className="t-caption hidden w-20 shrink-0 md:block">{song.extension}</span>
                        <span className="t-meta w-20 shrink-0 text-right text-xs tabular-nums">{readableSize(song.size)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="t-meta px-6 pb-8 pt-2 text-center">No scanned songs match “{filter}”.</p>}
        </div>
      )}

      {hasScanned && !scanning && songs.length === 0 && (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <Folder className="size-8 text-fg-3" />
          <h3 className="mt-4 font-semibold">No audio files found</h3>
          <p className="t-meta mt-2 max-w-md text-[13px]">Try another folder. Supported files include MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, and WebM.</p>
          <Button variant="secondary" className="mt-5" onClick={selectFolder}>Choose another folder</Button>
        </div>
      )}
    </section>
  );
}

