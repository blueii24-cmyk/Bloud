import type { ReactNode } from "react";
import { Shuffle } from "lucide-react";
import { cn } from "../../utils/cn";
import { IconButton } from "../ui/Buttons";
import { PlayFab } from "../ui/Bits";

interface HeaderProps {
  art: ReactNode;
  kind: string;
  title: string;
  description?: string;
  meta: ReactNode;
  circleArt?: boolean;
}

/** Shared header for playlist, album, artist and liked-songs pages. */
export function CollectionHeader({ art, kind, title, description, meta, circleArt }: HeaderProps) {
  return (
    <header className="flex flex-col items-center gap-5 pt-1 md:flex-row md:items-end md:gap-6 md:pt-6">
      <div className={cn("shrink-0 shadow-2xl shadow-black/60 [&>*]:size-full", "size-[min(62vw,232px)] md:size-[232px]", circleArt ? "rounded-full" : "rounded-lg")}>{art}</div>
      <div className="w-full min-w-0 text-center md:text-left">
        <p className="text-sm font-semibold">{kind}</p>
        <h1 className="t-page mt-1 line-clamp-3 break-words md:mt-2 md:text-[3.25rem] md:leading-[3.5rem] md:font-extrabold md:tracking-[-0.035em]">{title}</h1>
        {description && <p className="t-meta mx-auto mt-3 line-clamp-2 max-w-xl md:mx-0">{description}</p>}
        <div className="t-meta mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 md:justify-start">{meta}</div>
      </div>
    </header>
  );
}

interface ActionsProps {
  playing: boolean;
  onPlay: () => void;
  onShuffle?: () => void;
  children?: ReactNode;
  disabled?: boolean;
}

export function CollectionActions({ playing, onPlay, onShuffle, children }: ActionsProps) {
  return (
    <div className="flex items-center gap-2 py-5 md:py-6">
      <PlayFab playing={playing} onClick={onPlay} />
      {onShuffle && (
        <IconButton label="Shuffle play" size="lg" onClick={onShuffle}>
          <Shuffle className="size-6" />
        </IconButton>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-14 text-center">
      <p className="t-section">{title}</p>
      <p className="t-meta mt-1.5">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
