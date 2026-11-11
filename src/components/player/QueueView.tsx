import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "../../utils/cn";
import type { QueueItem } from "../../types";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer } from "../../state/PlayerContext";
import { useRoom } from "../../state/RoomContext";
import { useUI } from "../../state/UIContext";
import { Artwork } from "../ui/Artwork";
import { Avatar, AvatarPair } from "../ui/Avatar";
import { Button, IconButton } from "../ui/Buttons";
import { Equalizer } from "../ui/Bits";

const ROW = 56;

/** Queue with pointer / keyboard reordering. Used in the desktop side panel and Now Playing. */
export function QueueView({ className }: { className?: string }) {
  const player = usePlayer();
  const room = useRoom();
  const ui = useUI();
  const { trackById, artistById, data } = useCatalogue();
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const startY = useRef(0);

  const { upNext, current } = player;
  const currentTrack = player.track;
  const showAdders = room.active || upNext.some((q) => q.addedBy !== "me");
  const target = drag ? Math.max(0, Math.min(upNext.length - 1, drag.index + Math.round(drag.dy / ROW))) : -1;

  const down = (e: PointerEvent<HTMLButtonElement>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setDrag({ index, dy: 0 });
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => drag && setDrag({ ...drag, dy: e.clientY - startY.current });
  const up = () => {
    if (drag) player.moveInQueue(drag.index, target);
    setDrag(null);
  };
  const key = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowUp") (e.preventDefault(), player.moveInQueue(i, i - 1));
    if (e.key === "ArrowDown") (e.preventDefault(), player.moveInQueue(i, i + 1));
  };
  const remove = (uid: string) => {
    setLeaving(uid);
    setTimeout(() => {
      player.removeFromQueue(uid);
      setLeaving(null);
    }, 200);
  };

  const shift = (i: number) => {
    if (!drag) return 0;
    if (i === drag.index) return drag.dy;
    if (drag.index < i && i <= target) return -ROW;
    if (target <= i && i < drag.index) return ROW;
    return 0;
  };

  const rowInfo = (q: QueueItem) => {
    const t = trackById.get(q.trackId);
    return { t, artist: t ? artistById.get(t.artistId) : undefined };
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Shared status */}
      <div className="mb-4 flex items-center gap-3">
        {room.active ? (
          <>
            <AvatarPair size="sm" partnerOnline={room.partnerOnline} />
            <p className="t-meta min-w-0 flex-1 truncate">
              {room.partnerOnline ? <>Shared with <span className="font-medium text-fg">{data.users.partner.name}</span></> : "Waiting for Sam to join…"}
            </p>
          </>
        ) : (
          <p className="t-meta min-w-0 flex-1 truncate">
            Private queue ·{" "}
            <Link to="/together" onClick={ui.closeNowPlaying} className="font-medium text-fg hover:underline">
              Share it
            </Link>
          </p>
        )}
        <Button size="sm" variant="secondary" onClick={() => ui.openModal({ type: "addSongs", target: { kind: "queue" } })}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {current && currentTrack && (
          <section className="mb-5">
            <h3 className="t-eyebrow mb-2">Now playing</h3>
            <div className="flex h-14 items-center gap-3 rounded-lg bg-white/[0.06] px-2">
              <div className="relative">
                <Artwork art={currentTrack.art} className="size-10" />
                <span className="absolute inset-0 flex items-center justify-center rounded-art bg-black/55">
                  <Equalizer paused={!player.playing} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-5 text-accent">{currentTrack.title}</p>
                <p className="t-meta truncate text-[13px] leading-[18px]">{artistById.get(currentTrack.artistId)?.name}</p>
              </div>
              {showAdders && <Avatar userId={current.addedBy} size="xs" />}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex h-6 items-center justify-between">
            <h3 className="t-eyebrow">Next up{upNext.length ? ` · ${upNext.length}` : ""}</h3>
            {upNext.length > 0 && (
              <button
                type="button"
                onClick={() => (player.clearQueue(), ui.notify("Queue cleared"))}
                className="t-caption flex items-center gap-1 rounded px-1.5 py-1 font-medium text-fg-2 transition hover:text-fg active:scale-95"
              >
                <Trash2 className="size-3.5" /> Clear queue
              </button>
            )}
          </div>

          {upNext.length === 0 ? (
            <div className="animate-fade-in rounded-xl bg-white/[0.04] px-4 py-8 text-center">
              <p className="font-medium">Nothing up next</p>
              <p className="t-meta mt-1">Add songs and they'll play after this one.</p>
            </div>
          ) : (
            <ul className="relative">
              {upNext.map((q, i) => {
                const { t, artist } = rowInfo(q);
                if (!t) return null;
                const dragging = drag?.index === i;
                return (
                  <li
                    key={q.uid}
                    className={cn(
                      "relative transition-[height,opacity] duration-200",
                      leaving === q.uid ? "h-0 overflow-hidden opacity-0" : "h-14",
                      dragging && "z-10",
                    )}
                  >
                    <div
                      onClick={() => player.skipTo(q.uid)}
                      className={cn(
                        "group flex h-14 animate-row-in cursor-pointer items-center gap-2 rounded-lg px-1 hover:bg-white/[0.06]",
                        dragging ? "bg-surface-3 shadow-xl shadow-black/60" : drag ? "transition-transform duration-200" : "",
                      )}
                      style={{ transform: `translateY(${shift(i)}px)` }}
                    >
                      <button
                        type="button"
                        aria-label={`Reorder ${t.title}. Use arrow keys to move.`}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => down(e, i)}
                        onPointerMove={move}
                        onPointerUp={up}
                        onPointerCancel={() => setDrag(null)}
                        onKeyDown={(e) => key(e, i)}
                        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-fg-3 hover:text-fg active:cursor-grabbing"
                      >
                        <GripVertical className="size-5" />
                      </button>
                      <Artwork art={t.art} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium leading-5">{t.title}</p>
                        <p className="t-meta truncate text-[13px] leading-[18px]">{artist?.name}</p>
                      </div>
                      {showAdders && <Avatar userId={q.addedBy} size="xs" />}
                      <IconButton
                        label={`Remove ${t.title} from queue`}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(q.uid);
                        }}
                      >
                        <X className="size-[18px]" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
