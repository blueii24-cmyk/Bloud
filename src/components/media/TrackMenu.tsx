import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Disc3, Heart, ListEnd, ListPlus, ListStart, MoreHorizontal, Mic2 } from "lucide-react";
import type { Track } from "../../types";
import { useCatalogue } from "../../state/CatalogueContext";
import { useLibrary } from "../../state/LibraryContext";
import { usePlayer } from "../../state/PlayerContext";
import { useUI } from "../../state/UIContext";
import { Artwork } from "../ui/Artwork";
import { IconButton } from "../ui/Buttons";
import { Menu, MenuDivider, MenuItem } from "../ui/Overlay";

export interface ExtraAction {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

export function TrackMoreButton({ track, extra, className }: { track: Track; extra?: ExtraAction[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const { artistById, albumById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const nav = useNavigate();
  const artist = artistById.get(track.artistId);
  const album = albumById.get(track.albumId);
  const liked = lib.isLiked(track.id);

  return (
    <>
      <IconButton
        ref={ref}
        label="More options"
        size="sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <MoreHorizontal className="size-5" />
      </IconButton>
      <Menu
        open={open}
        anchor={ref.current}
        onClose={() => setOpen(false)}
        header={
          <div className="flex items-center gap-3">
            <Artwork art={track.art} className="size-12" />
            <div className="min-w-0">
              <p className="truncate font-medium">{track.title}</p>
              <p className="t-meta truncate">{artist?.name}</p>
            </div>
          </div>
        }
      >
        <MenuItem icon={<ListStart className="size-5" />} label="Play next" onSelect={() => (player.addToQueue([track.id], { next: true }), ui.notify("Playing next"))} />
        <MenuItem icon={<ListEnd className="size-5" />} label="Add to queue" onSelect={() => (player.addToQueue([track.id]), ui.notify("Added to queue"))} />
        <MenuItem
          icon={<Heart className={liked ? "size-5 fill-accent text-accent" : "size-5"} />}
          label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          onSelect={() => ui.notify(lib.toggleLike(track.id) ? "Added to Liked Songs" : "Removed from Liked Songs")}
        />
        <MenuItem icon={<ListPlus className="size-5" />} label="Add to playlist" onSelect={() => ui.openModal({ type: "picker", trackIds: [track.id] })} />
        <MenuDivider />
        {artist && <MenuItem icon={<Mic2 className="size-5" />} label="Go to artist" onSelect={() => (ui.closeNowPlaying(), nav(`/artist/${artist.id}`))} />}
        {album && <MenuItem icon={<Disc3 className="size-5" />} label="Go to album" onSelect={() => (ui.closeNowPlaying(), nav(`/album/${album.id}`))} />}
        {extra?.length ? <MenuDivider /> : null}
        {extra?.map((a) => (
          <MenuItem key={a.label} icon={a.icon} label={a.label} danger={a.danger} onSelect={a.onSelect} />
        ))}
      </Menu>
    </>
  );
}
