import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../../utils/cn";

interface SliderProps {
  value: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  /** fired once on release / keyboard step – use for seeking */
  onCommit?: (v: number) => void;
  label: string;
  valueText?: string;
  className?: string;
  /** accent fill instead of white */
  accent?: boolean;
  disabled?: boolean;
}

/** Touch-friendly slider with a 24px hit area around a 4px track. */
export function Slider({ value, max = 100, step = 1, onChange, onCommit, label, valueText, className, accent, disabled }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;

  const fromEvent = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(max, Math.max(0, ((e.clientX - r.left) / r.width) * max));
  };

  const down = (e: PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = fromEvent(e);
    setDrag(v);
    onChange?.(v);
  };
  const move = (e: PointerEvent) => {
    if (drag === null) return;
    const v = fromEvent(e);
    setDrag(v);
    onChange?.(v);
  };
  const up = (e: PointerEvent) => {
    if (drag === null) return;
    const v = fromEvent(e);
    setDrag(null);
    onChange?.(v);
    onCommit?.(v);
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const big = max / 10;
    const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "PageUp" ? big : e.key === "PageDown" ? -big : 0;
    if (!delta) return;
    e.preventDefault();
    const v = Math.min(max, Math.max(0, value + delta));
    onChange?.(v);
    onCommit?.(v);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={valueText}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={key}
      className={cn("group/slider relative flex h-6 w-full touch-none items-center", disabled ? "opacity-40" : "cursor-pointer", className)}
    >
      <div className="relative h-1 w-full rounded-full bg-white/20">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", accent || drag !== null ? "bg-accent" : "bg-white group-hover/slider:bg-accent group-focus-visible/slider:bg-accent")}
          style={{ width: `${pct}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity",
            drag !== null ? "opacity-100" : "opacity-0 group-hover/slider:opacity-100 group-focus-visible/slider:opacity-100 max-lg:opacity-100",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
