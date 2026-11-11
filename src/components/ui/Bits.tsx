import { Heart, Pause, Play } from "lucide-react";
import { cn } from "../../utils/cn";
import { useLibrary } from "../../state/LibraryContext";
import { useUI } from "../../state/UIContext";
import { IconButton } from "./Buttons";

/** Animated playing indicator. */
export function Equalizer({ className, paused }: { className?: string; paused?: boolean }) {
  return (
    <span aria-hidden className={cn("flex h-3.5 items-end gap-[2px]", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-[1px] bg-accent"
          style={{ height: "100%", transform: paused ? "scaleY(0.35)" : undefined, animation: paused ? undefined : `eq ${0.9 + i * 0.17}s ease-in-out ${i * -0.3}s infinite` }}
        />
      ))}
    </span>
  );
}

/** Brand mark: two interlocking rings. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <circle cx="12.5" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="19.5" cy="16" r="7" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight">Tandem</span>
    </span>
  );
}

export function LikeButton({ trackId, size = "md", className }: { trackId: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const lib = useLibrary();
  const { notify } = useUI();
  const liked = lib.isLiked(trackId);
  return (
    <IconButton
      label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
      active={liked}
      size={size}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        notify(lib.toggleLike(trackId) ? "Added to Liked Songs" : "Removed from Liked Songs");
      }}
    >
      <Heart key={String(liked)} className={cn("size-5", liked && "animate-like fill-accent")} />
    </IconButton>
  );
}

/** Accent play button – the single place the accent is used as a fill. */
export function PlayFab({ playing, onClick, size = "lg", label }: { playing?: boolean; onClick: () => void; size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label ?? (playing ? "Pause" : "Play")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-black/40 transition duration-150 hover:scale-105 hover:bg-accent-hover active:scale-95",
        size === "lg" && "size-14",
        size === "md" && "size-12",
        size === "sm" && "size-10",
      )}
    >
      {playing ? <Pause className="size-1/2 fill-current" /> : <Play className="size-1/2 translate-x-px fill-current" />}
    </button>
  );
}

/** Soft artwork-coloured wash behind page headers. */
export function PageTint({ color, className }: { color: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -inset-x-4 -top-[calc(3.5rem+env(safe-area-inset-top))] -z-10 h-[420px] lg:-inset-x-6 lg:-top-16", className)}
      style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 42%, #000) 0%, color-mix(in srgb, ${color} 12%, #000) 55%, #000 100%)` }}
    />
  );
}
