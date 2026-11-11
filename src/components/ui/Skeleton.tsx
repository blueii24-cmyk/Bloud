import { cn } from "../../utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-surface-hover", className)} />;
}

export function ShelfSkeleton({ circle, wide }: { circle?: boolean; wide?: boolean }) {
  return (
    <section className="space-y-3" aria-busy>
      <Skeleton className="h-6 w-40" />
      <div className="-mx-4 flex gap-4 overflow-hidden px-4 md:mx-0 md:px-0">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn("shrink-0 space-y-2", wide ? "w-56" : "w-36 md:w-44")}>
            <Skeleton className={cn(wide ? "aspect-video" : "aspect-square", circle && "rounded-full")} />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-2">
          <Skeleton className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
