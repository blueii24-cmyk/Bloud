import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { cn } from "../../utils/cn";
import { formatTime } from "../../utils/format";
import { usePlayer, useProgress } from "../../state/PlayerContext";
import { Slider } from "../ui/Slider";

const modeBtn = "relative inline-flex items-center justify-center rounded-full transition duration-150 active:scale-90";

export function TransportControls({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const p = usePlayer();
  const lg = size === "lg";
  const hasTrack = !!p.track;
  const dot = <span className="absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />;

  return (
    <div className={cn("flex items-center justify-between", lg ? "w-full" : "gap-2", className)}>
      <button type="button" aria-label="Shuffle" aria-pressed={p.shuffle} onClick={p.toggleShuffle} disabled={!hasTrack}
        className={cn(modeBtn, lg ? "size-11" : "size-9", p.shuffle ? "text-accent" : "text-fg-2 hover:text-fg")}>
        <Shuffle className={lg ? "size-[22px]" : "size-[18px]"} />
        {p.shuffle && dot}
      </button>
      <button type="button" aria-label="Previous" onClick={p.previous} disabled={!hasTrack}
        className={cn(modeBtn, lg ? "size-14" : "size-9", "text-fg hover:scale-105")}>
        <SkipBack className={cn("fill-current", lg ? "size-8" : "size-5")} />
      </button>
      <button type="button" aria-label={p.playing ? "Pause" : "Play"} onClick={p.togglePlay} disabled={!hasTrack}
        className={cn(modeBtn, "bg-fg text-black hover:scale-105", lg ? "size-[72px]" : "size-10")}>
        {p.playing ? <Pause className={cn("fill-current", lg ? "size-8" : "size-5")} /> : <Play className={cn("translate-x-px fill-current", lg ? "size-8" : "size-5")} />}
      </button>
      <button type="button" aria-label="Next" onClick={p.next} disabled={!hasTrack}
        className={cn(modeBtn, lg ? "size-14" : "size-9", "text-fg hover:scale-105")}>
        <SkipForward className={cn("fill-current", lg ? "size-8" : "size-5")} />
      </button>
      <button type="button" aria-label={`Repeat: ${p.repeat}`} aria-pressed={p.repeat !== "off"} onClick={p.cycleRepeat} disabled={!hasTrack}
        className={cn(modeBtn, lg ? "size-11" : "size-9", p.repeat !== "off" ? "text-accent" : "text-fg-2 hover:text-fg")}>
        {p.repeat === "one" ? <Repeat1 className={lg ? "size-[22px]" : "size-[18px]"} /> : <Repeat className={lg ? "size-[22px]" : "size-[18px]"} />}
        {p.repeat !== "off" && dot}
      </button>
    </div>
  );
}

/** Seekable progress with elapsed / remaining labels. `inline` places times beside the bar. */
export function PlaybackProgress({ inline, className }: { inline?: boolean; className?: string }) {
  const { track, seek } = usePlayer();
  const pos = useProgress();
  const duration = track?.duration ?? 0;
  const t = Math.min(pos, duration);

  const slider = (
    <Slider
      label="Seek"
      value={t}
      max={duration || 1}
      step={5}
      disabled={!track}
      valueText={`${formatTime(t)} of ${formatTime(duration)}`}
      onCommit={seek}
    />
  );
  const cur = <span className="t-caption w-10 shrink-0 tabular-nums text-fg-2">{formatTime(t)}</span>;
  const rem = <span className="t-caption w-10 shrink-0 text-right tabular-nums text-fg-2">-{formatTime(duration - t)}</span>;

  if (inline) {
    return (
      <div className={cn("flex w-full items-center gap-2", className)}>
        {cur}
        {slider}
        {rem}
      </div>
    );
  }
  return (
    <div className={cn("w-full", className)}>
      {slider}
      <div className="-mt-1 flex justify-between">
        {cur}
        {rem}
      </div>
    </div>
  );
}
