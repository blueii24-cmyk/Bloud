import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { cn } from "../../utils/cn";
import type { ArtSpec } from "../../types";
import { formatTime } from "../../utils/format";
import { Artwork } from "../ui/Artwork";

interface CardBase {
  to?: string;
  /** when set the card acts as a button (e.g. play a track) instead of a link */
  onClick?: () => void;
  art: ArtSpec;
  title: string;
  subtitle?: string;
  onPlay?: () => void;
  playing?: boolean;
  className?: string;
}

function HoverPlay({ onPlay, playing, className }: { onPlay?: () => void; playing?: boolean; className?: string }) {
  if (!onPlay) return null;
  return (
    <button
      type="button"
      aria-label={playing ? "Pause" : "Play"}
      onClick={onPlay}
      className={cn(
        "absolute flex size-11 items-center justify-center rounded-full bg-accent text-on-accent shadow-xl shadow-black/50 transition duration-200 hover:scale-105 hover:bg-accent-hover active:scale-95",
        "max-md:hidden md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:translate-y-0 md:focus-visible:opacity-100",
        className,
      )}
    >
      {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
    </button>
  );
}

/** Link or button wrapper so cards can navigate or act. */
function Target({ to, onClick, className, children, hidden }: { to?: string; onClick?: () => void; className?: string; children: ReactNode; hidden?: boolean }) {
  const a11y = hidden ? { tabIndex: -1, "aria-hidden": true as const } : {};
  if (onClick || !to) {
    return (
      <button type="button" onClick={onClick} className={cn("block w-full text-left", className)} {...a11y}>
        {children}
      </button>
    );
  }
  return (
    <Link to={to} className={className} {...a11y}>
      {children}
    </Link>
  );
}

/** Square card for albums, playlists, mixes and tracks. */
export function MediaCard({ to, onClick, art, title, subtitle, onPlay, playing, className }: CardBase) {
  return (
    <div className={cn("group w-36 shrink-0 md:w-44", className)}>
      <div className="relative">
        <Target to={to} onClick={onClick} hidden className="block">
          <Artwork art={art} className="w-full shadow-lg shadow-black/40 transition duration-300 group-hover:brightness-110" />
        </Target>
        <HoverPlay onPlay={onPlay} playing={playing} className="bottom-2 right-2" />
      </div>
      <Target to={to} onClick={onClick} className="mt-2.5 block">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="t-meta mt-0.5 line-clamp-2 text-[13px] leading-[18px]">{subtitle}</p>}
      </Target>
    </div>
  );
}

export function ArtistCard({ to, art, title, subtitle, onPlay, playing, className }: CardBase) {
  return (
    <div className={cn("group w-32 shrink-0 md:w-40", className)}>
      <div className="relative">
        <Link to={to ?? "/"} tabIndex={-1} aria-hidden className="block">
          <Artwork art={art} circle className="w-full shadow-lg shadow-black/40 transition duration-300 group-hover:brightness-110" />
        </Link>
        <HoverPlay onPlay={onPlay} playing={playing} className="bottom-1 right-1" />
      </div>
      <Link to={to ?? "/"} className="mt-2.5 block text-center md:text-left">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="t-meta mt-0.5 truncate text-[13px]">{subtitle}</p>}
      </Link>
    </div>
  );
}

interface VideoCardProps extends Omit<CardBase, "to" | "onClick"> {
  duration: number;
  onClick: () => void;
}

export function VideoCard({ art, title, subtitle, duration, onClick, className }: VideoCardProps) {
  return (
    <button type="button" onClick={onClick} className={cn("group w-60 shrink-0 text-left md:w-72", className)}>
      <div className="relative">
        <Artwork art={art} ratio="video" className="w-full shadow-lg shadow-black/40 transition duration-300 group-hover:brightness-110" />
        <span className="absolute inset-0 flex items-center justify-center rounded-art bg-black/0 transition group-hover:bg-black/25">
          <span className="glass flex size-11 items-center justify-center rounded-full opacity-90 transition group-hover:scale-105">
            <Play className="size-5 translate-x-px fill-white" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">{formatTime(duration)}</span>
      </div>
      <p className="mt-2.5 truncate text-sm font-medium">{title}</p>
      {subtitle && <p className="t-meta mt-0.5 truncate text-[13px]">{subtitle}</p>}
    </button>
  );
}
