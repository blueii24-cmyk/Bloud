import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../utils/cn";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer, useProgress } from "../../state/PlayerContext";

/** Lyrics with approximate line timing derived from track length (sample data has no timestamps). */
export function LyricsView({ className }: { className?: string }) {
  const { data } = useCatalogue();
  const { track, seek } = usePlayer();
  const pos = useProgress();
  const box = useRef<HTMLDivElement>(null);
  const lines = track && track.lyricSet !== null ? data.lyrics[track.lyricSet] : null;

  const timed = useMemo(() => {
    if (!lines || !track) return [];
    const spoken = lines.filter((l) => l.trim()).length;
    let k = -1;
    return lines.map((text) => {
      if (!text.trim()) return { text, time: null as number | null };
      k++;
      return { text, time: track.duration * (0.04 + 0.9 * (k / spoken)) };
    });
  }, [lines, track]);

  const activeIdx = timed.reduce((acc, l, i) => (l.time !== null && l.time <= pos ? i : acc), -1);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${activeIdx}"]`);
    if (el && box.current) {
      box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
    }
  }, [activeIdx, track?.id]);

  if (!track) return null;
  if (!lines) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center", className)}>
        <p className="t-section">No lyrics</p>
        <p className="t-meta mt-1">This track is instrumental.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={box}
        className="hide-scrollbar relative min-h-0 flex-1 overflow-y-auto px-1 py-[30%] [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)]"
      >
        {timed.map((l, i) =>
          l.time === null ? (
            <div key={i} className="h-6" />
          ) : (
            <button
              key={i}
              type="button"
              data-line={i}
              onClick={() => seek(l.time!)}
              className={cn(
                "block w-full py-1.5 text-left text-[26px] font-bold leading-[1.2] tracking-tight transition-colors duration-500 md:text-3xl",
                i === activeIdx ? "text-white" : i < activeIdx ? "text-white/50" : "text-white/30 hover:text-white/60",
              )}
            >
              {l.text}
            </button>
          ),
        )}
      </div>
      <p className="t-caption pt-2 text-center">Sample lyrics · timing is approximate</p>
    </div>
  );
}
