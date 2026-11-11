import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";

interface ShelfProps {
  title: string;
  subtitle?: string;
  to?: string;
  children: ReactNode;
  /** override the scroller's inner layout (default: flex row, 16px gap) */
  trackClassName?: string;
  className?: string;
}

/** Horizontally scrolling section with edge bleed on mobile and arrows on hover (desktop). */
export function Shelf({ title, subtitle, to, children, trackClassName, className }: ShelfProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure, children]);

  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className={cn("group/shelf relative", className)}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="t-section truncate">{title}</h2>
          {subtitle && <p className="t-meta mt-0.5 truncate">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="t-meta shrink-0 font-semibold hover:text-fg hover:underline">
            Show all
          </Link>
        )}
      </div>
      <div className="relative">
        <div
          ref={ref}
          onScroll={measure}
          className={cn(
            "hide-scrollbar -mx-4 flex snap-x snap-proximity scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 md:mx-0 md:px-0",
            "[&>*]:snap-start",
            trackClassName,
          )}
        >
          {children}
        </div>
        {(["left", "right"] as const).map((side) => {
          const show = side === "left" ? edge.left : edge.right;
          return (
            <button
              key={side}
              type="button"
              aria-label={side === "left" ? "Scroll left" : "Scroll right"}
              onClick={() => scrollBy(side === "left" ? -1 : 1)}
              className={cn(
                "glass absolute top-[calc(50%-2rem)] z-10 hidden size-10 items-center justify-center rounded-full text-fg opacity-0 shadow-lg transition duration-200 hover:scale-105 active:scale-95 md:flex",
                show && "group-hover/shelf:opacity-100",
                !show && "pointer-events-none",
                side === "left" ? "-left-3" : "-right-3",
              )}
            >
              {side === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
