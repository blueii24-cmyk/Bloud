import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { cn } from "../../utils/cn";
import type { Track, UserId } from "../../types";
import { formatTime } from "../../utils/format";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer } from "../../state/PlayerContext";
import { Artwork } from "../ui/Artwork";
import { Avatar } from "../ui/Avatar";
import { Equalizer, LikeButton } from "../ui/Bits";
import { TrackMoreButton, type ExtraAction } from "./TrackMenu";

interface TrackRowProps {
  track: Track;
  index?: number;
  showIndex?: boolean;
  showAlbum?: boolean;
  addedBy?: UserId;
  onPlay: () => void;
  extra?: ExtraAction[];
  className?: string;
}

/** The standard 56px track row used by playlists, library, search and home. */
export function TrackRow({ track, index, showIndex, showAlbum, addedBy, onPlay, extra, className }: TrackRowProps) {
  const { artistById, albumById } = useCatalogue();
  const player = usePlayer();
  const active = player.track?.id === track.id;
  const artist = artistById.get(track.artistId);
  const album = albumById.get(track.albumId);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.title}`}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPlay();
        }
      }}
      className={cn(
        "group flex h-14 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10",
        active && "bg-white/[0.04]",
        className,
      )}
    >
      {showIndex && (
        <span className="t-meta hidden w-6 shrink-0 text-center tabular-nums md:block">
          {active ? <Equalizer paused={!player.playing} className="mx-auto" /> : <span className="group-hover:hidden">{index}</span>}
          {!active && <Play className="mx-auto hidden size-3.5 fill-white text-white group-hover:block" />}
        </span>
      )}

      <div className="relative shrink-0">
        <Artwork art={track.art} className="size-10" />
        {active ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-art bg-black/55">
            <Equalizer paused={!player.playing} />
          </span>
        ) : (
          !showIndex && (
            <span className="absolute inset-0 hidden items-center justify-center rounded-art bg-black/50 md:group-hover:flex">
              <Play className="size-4 fill-white" />
            </span>
          )
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-medium leading-5", active && "text-accent")}>{track.title}</p>
        <p className="t-meta mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-[18px]">
          {track.explicit && <span className="grid size-3.5 shrink-0 place-items-center rounded-[3px] bg-white/25 text-[9px] font-bold text-black">E</span>}
          {artist ? (
            <Link to={`/artist/${artist.id}`} onClick={(e) => e.stopPropagation()} className="truncate hover:text-fg hover:underline">
              {artist.name}
            </Link>
          ) : null}
        </p>
      </div>

      {showAlbum && album && (
        <Link
          to={`/album/${album.id}`}
          onClick={(e) => e.stopPropagation()}
          className="t-meta hidden w-[28%] shrink-0 truncate hover:text-fg hover:underline md:block"
        >
          {album.title}
        </Link>
      )}

      {addedBy && <Avatar userId={addedBy} size="xs" className="shrink-0" />}

      <LikeButton trackId={track.id} size="sm" className="max-md:hidden" />
      <span className="t-meta hidden w-10 shrink-0 text-right tabular-nums sm:block">{formatTime(track.duration)}</span>
      <TrackMoreButton track={track} extra={extra} />
    </div>
  );
}

interface TrackListProps {
  tracks: { track: Track; addedBy?: UserId }[];
  onPlay: (index: number) => void;
  showIndex?: boolean;
  showAlbum?: boolean;
  extraFor?: (track: Track) => ExtraAction[] | undefined;
  header?: boolean;
}

export function TrackList({ tracks, onPlay, showIndex = true, showAlbum = true, extraFor, header = true }: TrackListProps) {
  return (
    <div>
      {header && (
        <div className="t-eyebrow mb-1 hidden h-8 items-center gap-3 border-b border-line px-2 md:flex">
          {showIndex && <span className="w-6 text-center">#</span>}
          <span className="w-10" />
          <span className="flex-1">Title</span>
          {showAlbum && <span className="w-[28%]">Album</span>}
          <span className="w-8" />
          <span className="w-8" />
          <span className="w-10 text-right">Time</span>
          <span className="w-8" />
        </div>
      )}
      <div className="space-y-0.5">
        {tracks.map(({ track, addedBy }, i) => (
          <TrackRow
            key={`${track.id}-${i}`}
            track={track}
            index={i + 1}
            showIndex={showIndex}
            showAlbum={showAlbum}
            addedBy={addedBy}
            onPlay={() => onPlay(i)}
            extra={extraFor?.(track)}
          />
        ))}
      </div>
    </div>
  );
}
