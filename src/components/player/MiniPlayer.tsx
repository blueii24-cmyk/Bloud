import { Pause, Play } from "lucide-react";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer, useProgress } from "../../state/PlayerContext";
import { useUI } from "../../state/UIContext";
import { Artwork } from "../ui/Artwork";
import { LikeButton } from "../ui/Bits";
import { Skeleton } from "../ui/Skeleton";

/** Mobile mini-player. Tints itself from the artwork palette; tap to expand. */
export function MiniPlayer() {
  const p = usePlayer();
  const ui = useUI();
  const pos = useProgress();
  const { artistById, ready } = useCatalogue();
  const track = p.track;

  if (!track) {
    if (ready) return null;
    return (
      <div className="mx-2 mb-1 flex h-14 items-center gap-3 rounded-xl bg-surface px-2">
        <Skeleton className="size-10" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  const pct = Math.min(100, (pos / track.duration) * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Now playing ${track.title}. Open player`}
      onClick={() => ui.openNowPlaying()}
      onKeyDown={(e) => e.key === "Enter" && ui.openNowPlaying()}
      className="relative mx-2 mb-1 flex h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-xl pl-2 pr-1 shadow-lg shadow-black/50 transition-[transform,background-color] duration-500 active:scale-[0.985]"
      style={{ backgroundColor: `color-mix(in srgb, ${track.art.palette[0]} 30%, #101010)` }}
    >
      <Artwork key={track.id} art={track.art} className="size-10 animate-art-in" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-5">{track.title}</p>
        <p className="truncate text-xs leading-4 text-white/70">{artistById.get(track.artistId)?.name}</p>
      </div>
      <LikeButton trackId={track.id} className="text-white/80" />
      <button
        type="button"
        aria-label={p.playing ? "Pause" : "Play"}
        onClick={(e) => {
          e.stopPropagation();
          p.togglePlay();
        }}
        className="flex size-11 items-center justify-center rounded-full transition active:scale-90"
      >
        {p.playing ? <Pause className="size-6 fill-white" /> : <Play className="size-6 translate-x-px fill-white" />}
      </button>
      <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white/15">
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
