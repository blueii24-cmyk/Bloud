import { useMemo, useRef, useState } from "react";
import {
  Check, FileAudio, Folder, FolderOpen, HardDrive, Info, LoaderCircle, Play,
  RefreshCw, Search, ShieldCheck, Smartphone, Usb,
} from "lucide-react";
import { Button } from "../components/ui/Buttons";
import { cn } from "../utils/cn";

interface DriveSong {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  lastModified: number;
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

const STEPS = [
  { icon: Usb, title: "Connect your drive", text: "Plug a USB drive into your computer. On Android, connect it with a compatible USB OTG adapter." },
  { icon: Smartphone, title: "Allow access", text: "Wait for the drive to appear in File Explorer, Finder, or your phone's Files app. Keep it connected." },
  { icon: FolderOpen, title: "Choose a music folder", text: "Select the folder on the drive that contains your songs. Subfolders are included automatically." },
];

export default function DriveMusic() {
  const inputRef = useRef<HTMLInputElement>(null);
  const scanId = useRef(0);
  const [folderName, setFolderName] = useState("");
  const [songs, setSongs] = useState<DriveSong[]>([]);
  const [scannedFiles, setScannedFiles] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleSongs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return songs.filter((song) => !query || song.name.toLowerCase().includes(query) || song.path.toLowerCase().includes(query));
  }, [songs, filter]);

  const selectFolder = () => {
    setError("");
    inputRef.current?.click();
  };

  const scanFolder = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const currentScan = ++scanId.current;
    const firstPath = files[0].webkitRelativePath || files[0].name;
    setFolderName(firstPath.split("/")[0] || "Selected folder");
    setScanning(true);
    setHasScanned(false);
    setSongs([]);
    setFilter("");
    setSelectedId(null);
    setScannedFiles(0);

    // Yield once so the scanning status is visible before processing large folders.
    window.setTimeout(() => {
      if (currentScan !== scanId.current) return;
      const found = files
        .filter(isAudio)
        .map((file, index): DriveSong => ({
          id: `${file.webkitRelativePath || file.name}-${file.lastModified}-${index}`,
          name: songName(file.name),
          path: file.webkitRelativePath || file.name,
          extension: fileExtension(file).toUpperCase() || "AUDIO",
          size: file.size,
          lastModified: file.lastModified,
        }))
        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

      setScannedFiles(files.length);
      setSongs(found);
      setScanning(false);
      setHasScanned(true);
    }, 250);
  };

  return (
    <div className="mx-auto max-w-6xl pb-8 pt-1 lg:pt-0">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm"
        multiple
        // @ts-expect-error Non-standard directory selection is supported by Chromium, Firefox and Safari.
        webkitdirectory=""
        className="hidden"
        aria-label="Choose a folder of music"
        onChange={scanFolder}
      />

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-eyebrow">Local music</p>
          <h1 className="t-page mt-1">Drive Music</h1>
          <p className="t-meta mt-2 max-w-xl">Connect a drive, choose a folder, and see all the music inside.</p>
        </div>
        {hasScanned && !scanning && (
          <Button variant="secondary" onClick={selectFolder}><RefreshCw className="size-4" /> Change folder</Button>
        )}
      </header>

      <section aria-labelledby="connect-title" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><HardDrive className="size-5" /></span>
          <div>
            <h2 id="connect-title" className="t-section">Connect your drive</h2>
            <p className="t-meta text-[13px]">Three quick steps before scanning</p>
          </div>
        </div>
        <ol className="mt-6 grid gap-6 md:grid-cols-3 md:gap-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-3 md:block">
              <div className="flex shrink-0 items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm font-semibold">{index + 1}</span>
                <step.icon className="size-5 text-fg-2 md:mt-5" />
              </div>
              <div className="md:mt-3">
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="t-meta mt-1 text-[13px] leading-5">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="folder-title" className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg-2">
        <div className={cn("p-5 sm:p-6", (hasScanned || scanning) && "border-b border-line")}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent"><Folder className="size-7" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="folder-title" className="text-lg font-semibold">{folderName || "Select a folder to scan"}</h2>
              <p className="t-meta mt-1 text-[13px]">
                {scanning ? "Looking for audio files in this folder and its subfolders…"
                  : hasScanned ? `${scannedFiles.toLocaleString()} files scanned · ${songs.length.toLocaleString()} audio files found`
                  : "Choose any folder on your connected drive. You don't need to select individual songs."}
              </p>
            </div>
            {!hasScanned && (
              <Button variant="primary" size="md" disabled={scanning} onClick={selectFolder} className="w-full shrink-0 sm:w-auto">
                {scanning ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                {scanning ? "Scanning folder…" : "Choose music folder"}
              </Button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
        </div>

        {scanning && (
          <div className="flex flex-col items-center px-5 py-16 text-center" role="status">
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
                <h3 className="font-semibold">Songs on this drive</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-fg-2">{visibleSongs.length}</span>
              </div>
              <label className="flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-3 focus-within:ring-2 focus-within:ring-accent/60 sm:w-64">
                <Search className="size-4 shrink-0 text-fg-3" />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter songs" aria-label="Filter scanned songs" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
              </label>
            </div>
            {visibleSongs.length ? (
              <div className="px-2 pb-3 sm:px-4">
                <div className="t-eyebrow hidden h-8 items-center gap-3 border-b border-line px-2 md:flex">
                  <span className="w-6 text-center">#</span><span className="w-10" /><span className="flex-1">Title</span><span className="w-20">Format</span><span className="w-20 text-right">Size</span>
                </div>
                <ul className="mt-1 space-y-0.5" aria-live="polite">
                  {visibleSongs.map((song, index) => (
                    <li key={song.id}>
                      <button type="button" onClick={() => setSelectedId(song.id)} className={cn("group flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.06]", selectedId === song.id && "bg-white/[0.06]")}>
                        <span className="t-meta hidden w-6 shrink-0 text-center tabular-nums md:block">{index + 1}</span>
                        <span className="relative grid size-10 shrink-0 place-items-center rounded-art bg-white/[0.07] text-fg-2">
                          <FileAudio className="size-5" />
                          <span className="absolute inset-0 hidden place-items-center rounded-art bg-black/50 group-hover:grid"><Play className="size-4 fill-white text-white" /></span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[15px] font-medium", selectedId === song.id && "text-accent")}>{song.name}</span>
                          <span className="t-caption mt-0.5 block truncate">{song.path}</span>
                        </span>
                        <span className="t-caption hidden w-20 shrink-0 md:block">{song.extension}</span>
                        <span className="t-meta w-20 shrink-0 text-right text-xs tabular-nums">{readableSize(song.size)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="t-meta px-6 pb-8 pt-2 text-center">No scanned songs match “{filter}”.</p>}
          </div>
        )}

        {hasScanned && !scanning && songs.length === 0 && (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <FileAudio className="size-8 text-fg-3" />
            <h3 className="mt-4 font-semibold">No audio files found</h3>
            <p className="t-meta mt-2 max-w-md text-[13px]">Try another folder. Supported files include MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, and WebM.</p>
            <Button variant="secondary" className="mt-5" onClick={selectFolder}>Choose another folder</Button>
          </div>
        )}
      </section>

      <div className="mt-4 flex flex-col gap-2 text-xs text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-accent" /> Your music stays on this device. Nothing is uploaded.</p>
        <p className="flex items-center gap-2"><Info className="size-4 shrink-0" /> Reconnect the drive before choosing the folder again.</p>
      </div>
    </div>
  );
}
