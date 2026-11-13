import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Search, Smartphone, Speaker, Users, Volume2 } from "lucide-react";
import { cn } from "../../utils/cn";
import type { Playlist, Track } from "../../types";
import { useCatalogue } from "../../state/CatalogueContext";
import { useLibrary } from "../../state/LibraryContext";
import { useAuth } from "../../state/AuthContext";
import { useWorkspace } from "../../state/WorkspaceContext";
import { usePlayer } from "../../state/PlayerContext";
import { useRoom } from "../../state/RoomContext";
import { isSupabaseConfigured } from "../../services";
import { useUI } from "../../state/UIContext";
import { searchCatalogue } from "../../utils/search";
import { Artwork } from "../ui/Artwork";
import { Equalizer } from "../ui/Bits";
import { Button, IconButton } from "../ui/Buttons";
import { Modal } from "../ui/Overlay";
import { Slider } from "../ui/Slider";

export function ModalHost() {
  const { modal, closeModal } = useUI();
  if (!modal) return null;
  switch (modal.type) {
    case "picker":
      return <PlaylistPicker trackIds={modal.trackIds} onClose={closeModal} />;
    case "edit":
      return <PlaylistEditor playlistId={modal.playlistId} onClose={closeModal} />;
    case "addSongs":
      return <AddSongs target={modal.target} onClose={closeModal} />;
    case "devices":
      return <Devices onClose={closeModal} />;
  }
}

/* ----------------------------------------------------------- Add to playlist */

function PlaylistPicker({ trackIds, onClose }: { trackIds: string[]; onClose: () => void }) {
  const lib = useLibrary();
  const ui = useUI();
  const mine = lib.playlists.filter((p) => p.kind === "user");

  const add = (p: Playlist) => {
    const n = lib.addToPlaylist(p.id, trackIds);
    ui.notify(n ? `Added to ${p.name}` : `Already in ${p.name}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add to playlist">
      <button
        type="button"
        onClick={() => {
          const id = lib.createPlaylist({ trackIds });
          ui.notify("Created playlist");
          ui.openModal({ type: "edit", playlistId: id });
        }}
        className="mb-2 flex h-14 w-full items-center gap-3 rounded-lg px-1.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]"
      >
        <span className="flex size-11 items-center justify-center rounded-art bg-white/10">
          <Plus className="size-5" />
        </span>
        <span className="font-medium">New playlist</span>
      </button>
      {mine.map((p) => {
        const has = trackIds.every((id) => p.items.some((i) => i.trackId === id));
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => add(p)}
            className="flex h-14 w-full items-center gap-3 rounded-lg px-1.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]"
          >
            <Artwork art={p.art} className="size-11" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="t-caption block">{p.items.length} songs{p.collaborative ? " · Collaborative" : ""}</span>
            </span>
            {has && <Check className="size-5 text-accent" />}
          </button>
        );
      })}
    </Modal>
  );
}

/* ------------------------------------------------------------ Playlist editor */

function PlaylistEditor({ playlistId, onClose }: { playlistId: string; onClose: () => void }) {
  const lib = useLibrary();
  const ui = useUI();
  const nav = useNavigate();
  const { data } = useCatalogue();
  const auth = useAuth();
  const workspace = useWorkspace();
  const playlist = lib.playlists.find((p) => p.id === playlistId);
  const [name, setName] = useState(playlist?.name ?? "");
  const [description, setDescription] = useState(playlist?.description ?? "");
  const [collab, setCollab] = useState(playlist?.collaborative ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!playlist) return null;
  const canManage = !auth.walled || playlist.ownerUserId === auth.user?.id;
  if (!canManage) return null;
  const canEnableCollaboration = !auth.walled || workspace.paired;
  const save = () => {
    const updated = lib.updatePlaylist(playlist.id, { name: name.trim() || playlist.name, description: description.trim(), collaborative: collab });
    ui.notify(updated ? "Playlist updated" : "Pair a second account before enabling collaboration");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit playlist"
      footer={
        <>
          <Button
            variant={confirmDelete ? "danger" : "ghost"}
            className="mr-auto"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              lib.deletePlaylist(playlist.id);
              ui.notify("Playlist deleted");
              onClose();
              nav("/library");
            }}
          >
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex items-center gap-4">
          <Artwork art={playlist.art} className="size-24 shrink-0" />
          <label className="block min-w-0 flex-1">
            <span className="t-eyebrow">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="mt-1 h-11 w-full rounded-lg bg-white/10 px-3 text-[15px] outline-none transition focus:bg-white/15 focus:ring-2 focus:ring-accent/70"
            />
          </label>
        </div>
        <label className="block">
          <span className="t-eyebrow">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={160}
            placeholder="Add an optional description"
            className="mt-1 w-full resize-none rounded-lg bg-white/10 px-3 py-2.5 text-[15px] outline-none transition placeholder:text-fg-3 focus:bg-white/15 focus:ring-2 focus:ring-accent/70"
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={collab}
          disabled={!canEnableCollaboration && !collab}
          onClick={() => setCollab(!collab)}
          className={cn("flex w-full items-center gap-3 rounded-lg bg-white/[0.06] p-3 text-left transition", canEnableCollaboration || collab ? "hover:bg-white/10" : "cursor-not-allowed opacity-60")}
        >
          <Users className="size-5 shrink-0 text-fg-2" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Collaborative with {data.users.partner.name}</span>
            <span className="t-caption block">
              {workspace.paired
                ? "Both workspace members can add songs; each addition shows who added it."
                : auth.walled && workspace.id
                  ? "Invite one other account to this workspace before enabling sharing."
                  : auth.walled
                    ? "Create a two-person workspace in Listen Together to enable sharing."
                    : "Offline demo: collaboration is saved locally on this device."}
            </span>
          </span>
          <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", collab ? "bg-accent" : "bg-white/25")}>
            <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-[left] duration-200", collab ? "left-5 bg-black" : "left-1")} />
          </span>
        </button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Add songs */

function AddSongs({ target, onClose }: { target: { kind: "playlist"; id: string } | { kind: "queue" }; onClose: () => void }) {
  const { data, artistById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const [q, setQ] = useState("");
  const playlist = target.kind === "playlist" ? lib.playlists.find((p) => p.id === target.id) : undefined;
  const [added, setAdded] = useState<Set<string>>(new Set());

  const inPlaylist = (t: Track) => !!playlist?.items.some((i) => i.trackId === t.id);
  const results = useMemo<Track[]>(() => {
    if (q.trim()) return searchCatalogue(data, [], q).tracks.slice(0, 30);
    return data.tracks.filter((t) => lib.likedIds.includes(t.id) || lib.playHistory.includes(t.id)).slice(0, 14);
  }, [q, data, lib.likedIds, lib.playHistory]);

  const add = (t: Track) => {
    if (target.kind === "playlist") {
      if (!lib.addToPlaylist(target.id, [t.id])) {
        ui.notify("Couldn't add this song to the playlist.");
        return;
      }
    } else {
      player.addToQueue([t.id]);
    }
    setAdded((s) => new Set(s).add(t.id));
    ui.notify(target.kind === "queue" ? "Added to queue" : `Added to ${playlist?.name ?? "playlist"}`);
  };

  return (
    <Modal open onClose={onClose} title={target.kind === "queue" ? "Add to queue" : "Add songs"} className="sm:max-w-lg" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-fg-3" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs or artists"
          aria-label="Search songs"
          className="h-11 w-full rounded-full bg-white/10 pl-10 pr-4 text-[15px] outline-none transition placeholder:text-fg-3 focus:bg-white/15 focus:ring-2 focus:ring-accent/70"
        />
      </div>
      <p className="t-eyebrow mb-1">{q.trim() ? "Songs" : "Suggested"}</p>
      <div className="h-[44dvh] overflow-y-auto">
        {results.length === 0 && <p className="t-meta py-8 text-center">No songs match “{q}”.</p>}
        {results.map((t) => {
          const done = inPlaylist(t) || (target.kind === "playlist" && added.has(t.id));
          return (
            <div key={t.id} className="flex h-14 items-center gap-3 rounded-lg px-1.5 hover:bg-white/[0.06]">
              <Artwork art={t.art} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-5">{t.title}</p>
                <p className="t-meta truncate text-[13px]">{artistById.get(t.artistId)?.name}</p>
              </div>
              <IconButton label={done ? "Added" : `Add ${t.title}`} disabled={done} onClick={() => add(t)} active={done} className={done ? "" : "bg-white/10 text-fg hover:bg-white/15"} size="sm">
                {done ? <Check className="size-[18px]" /> : <Plus className="size-[18px]" />}
              </IconButton>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- Devices */

function Devices({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const room = useRoom();
  const { data } = useCatalogue();
  const row = "flex min-h-14 items-center gap-3 rounded-lg px-2";
  return (
    <Modal open onClose={onClose} title="Devices and output">
      <div className={cn(row, "bg-white/[0.06]")}>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Speaker className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-accent">This device</p>
          <p className="t-caption">Web browser · system output</p>
        </div>
        <Equalizer paused={!p.playing} />
      </div>

      {room.active && (
        <div className={cn(row, "mt-1")}>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-fg-2">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{data.users.partner.name}'s device</p>
            <p className="t-caption">{room.partnerOnline ? (isSupabaseConfigured ? "Following your playback in real time" : "Following your playback (simulated)") : "Not connected yet"}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 px-2">
        <Volume2 className="size-5 shrink-0 text-fg-2" />
        <Slider label="Volume" max={100} step={5} value={p.muted ? 0 : p.volume * 100} onChange={(v) => p.setVolume(v / 100)} valueText={`${Math.round((p.muted ? 0 : p.volume) * 100)}%`} />
        <span className="t-meta w-9 shrink-0 text-right tabular-nums">{Math.round((p.muted ? 0 : p.volume) * 100)}</span>
      </div>

      <p className="t-caption mt-5 px-2">Cast and Bluetooth targets appear here once audio streaming is connected.</p>
    </Modal>
  );
}
