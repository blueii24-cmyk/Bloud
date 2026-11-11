import { Link } from "react-router-dom";
import { ListMusic, Maximize2, Mic2, MonitorSpeaker, Users, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "../../utils/cn";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer } from "../../state/PlayerContext";
import { useRoom } from "../../state/RoomContext";
import { useUI } from "../../state/UIContext";
import { Artwork } from "../ui/Artwork";
import { AvatarPair } from "../ui/Avatar";
import { LikeButton } from "../ui/Bits";
import { IconButton } from "../ui/Buttons";
import { Skeleton } from "../ui/Skeleton";
import { Slider } from "../ui/Slider";
import { PlaybackProgress, TransportControls } from "./Transport";

/** Persistent desktop playback bar. */
export function PlayerBar({ className }: { className?: string }) {
  const p = usePlayer();
  const ui = useUI();
  const room = useRoom();
  const { artistById, ready } = useCatalogue();
  const track = p.track;
  const artist = track ? artistById.get(track.artistId) : null;
  const VolIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;

  return (
    <footer className={cn("grid-cols-[minmax(0,1fr)_minmax(320px,600px)_minmax(0,1fr)] items-center gap-4 px-4", className)}>
      {/* Track */}
      <div className="flex min-w-0 items-center gap-3">
        {track ? (
          <>
            <button
              type="button"
              aria-label="Open Now Playing"
              onClick={() => ui.openNowPlaying()}
              className="group relative shrink-0 overflow-hidden rounded-art transition active:scale-95"
            >
              <Artwork key={track.id} art={track.art} className="size-14 animate-art-in" />
              <span className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex">
                <Maximize2 className="size-4" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{track.title}</p>
              <Link to={`/artist/${track.artistId}`} className="t-meta block truncate text-[13px] hover:text-fg hover:underline">
                {artist?.name}
              </Link>
            </div>
            <LikeButton trackId={track.id} size="sm" className="ml-1" />
          </>
        ) : (
          ready ? <p className="t-meta">Nothing playing</p> : (
            <>
              <Skeleton className="size-14" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </>
          )
        )}
      </div>

      {/* Transport */}
      <div className="flex flex-col items-center gap-0.5">
        <TransportControls />
        <PlaybackProgress inline />
      </div>

      {/* Tools */}
      <div className="flex items-center justify-end gap-0.5">
        <Link
          to="/together"
          aria-label="Listen Together"
          title="Listen Together"
          className={cn(
            "mr-1 flex h-8 items-center gap-2 rounded-full px-2 transition active:scale-95",
            room.active ? "bg-white/10 hover:bg-white/15" : "text-fg-2 hover:text-fg",
          )}
        >
          {room.active ? <AvatarPair size="xs" partnerOnline={room.partnerOnline} /> : <Users className="size-[18px]" />}
          {room.active && room.partnerOnline && <span className="size-1.5 rounded-full bg-accent" />}
        </Link>
        <IconButton label="Lyrics" size="sm" disabled={!track} onClick={() => ui.openNowPlaying("lyrics")}>
          <Mic2 className="size-[18px]" />
        </IconButton>
        <IconButton label="Queue" size="sm" active={ui.queuePanelOpen} onClick={ui.toggleQueuePanel}>
          <ListMusic className="size-[18px]" />
        </IconButton>
        <IconButton label="Devices and output" size="sm" onClick={() => ui.openModal({ type: "devices" })}>
          <MonitorSpeaker className="size-[18px]" />
        </IconButton>
        <IconButton label={p.muted ? "Unmute" : "Mute"} size="sm" onClick={p.toggleMute}>
          <VolIcon className="size-[18px]" />
        </IconButton>
        <Slider
          label="Volume"
          className="w-24"
          max={100}
          step={5}
          value={p.muted ? 0 : p.volume * 100}
          valueText={`${Math.round((p.muted ? 0 : p.volume) * 100)}%`}
          onChange={(v) => p.setVolume(v / 100)}
        />
        <IconButton label="Open Now Playing" size="sm" disabled={!track} onClick={() => ui.openNowPlaying()}>
          <Maximize2 className="size-[18px]" />
        </IconButton>
      </div>
    </footer>
  );
}
