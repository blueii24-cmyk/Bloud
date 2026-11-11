import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ListMusic, Mic2, MonitorSpeaker, Users } from "lucide-react";
import { cn } from "../../utils/cn";
import { useCatalogue } from "../../state/CatalogueContext";
import { usePlayer } from "../../state/PlayerContext";
import { useRoom } from "../../state/RoomContext";
import { useUI, type NowPlayingView } from "../../state/UIContext";
import { TrackMoreButton } from "../media/TrackMenu";
import { Artwork } from "../ui/Artwork";
import { AvatarPair } from "../ui/Avatar";
import { LikeButton } from "../ui/Bits";
import { IconButton } from "../ui/Buttons";
import { LyricsView } from "./LyricsView";
import { QueueView } from "./QueueView";
import { PlaybackProgress, TransportControls } from "./Transport";

/** Immersive full-screen player. Slides up from the mini-player / playback bar. */
export function NowPlaying() {
  const ui = useUI();
  const player = usePlayer();
  const room = useRoom();
  const nav = useNavigate();
  const { artistById, data } = useCatalogue();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (ui.nowPlayingOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 420);
    return () => clearTimeout(t);
  }, [ui.nowPlayingOpen]);

  useEffect(() => {
    if (!ui.nowPlayingOpen) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && ui.closeNowPlaying();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ui]);

  const track = player.track;
  if (!mounted || !track) return null;

  const artist = artistById.get(track.artistId);
  const view = ui.npView;
  const toggle = (v: NowPlayingView) => ui.setNpView(view === v ? "player" : v);
  const [a, b] = track.art.palette;

  return (
    <div
      role="dialog"
      aria-label="Now playing"
      aria-modal="true"
      className={cn(
        "np-backdrop fixed inset-0 z-50 overflow-hidden transition-[transform,opacity] duration-[420ms] ease-soft",
        visible ? "translate-y-0 opacity-100" : "translate-y-[12%] opacity-0",
      )}
      style={{ "--np-a": a, "--np-b": b } as CSSProperties}
    >
      <div className="mx-auto flex h-full max-w-[1280px] flex-col pt-[env(safe-area-inset-top)]">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 lg:px-8">
          <IconButton label="Minimise player" onClick={ui.closeNowPlaying} className="text-fg">
            <ChevronDown className="size-7" />
          </IconButton>
          <div className="min-w-0 flex-1 text-center">
            <p className="t-eyebrow">Playing from</p>
            <p className="truncate text-[13px] font-semibold">{player.context?.label ?? "Queue"}</p>
          </div>
          <TrackMoreButton track={track} className="text-fg" />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] px-6 lg:grid-cols-2 lg:gap-x-20 lg:px-16">
          {/* Artwork */}
          <div className={cn("row-start-1 min-h-0 py-2 lg:col-start-1 lg:py-6", view !== "player" && "max-lg:hidden")}>
            <div className="art-stage size-full">
              <div>
                <Artwork
                  key={track.id}
                  art={track.art}
                  label={`Artwork for ${track.title}`}
                  className={cn("size-full animate-art-in rounded-xl transition-transform duration-500 ease-soft lg:rounded-2xl", player.playing ? "scale-100" : "scale-[0.9]")}
                />
              </div>
            </div>
          </div>

          {/* Lyrics / queue panel */}
          <section
            className={cn(
              "row-start-1 min-h-0 flex-col pt-1 lg:col-start-2 lg:row-span-2 lg:flex lg:py-4",
              view === "player" ? "max-lg:hidden" : "flex",
            )}
          >
            <div className="mb-3 flex gap-1 rounded-full bg-white/10 p-1 self-start" role="tablist">
              {(["lyrics", "queue"] as const).map((v) => {
                const on = view === v || (view === "player" && v === "lyrics");
                return (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={on}
                    onClick={() => ui.setNpView(v)}
                    className={cn("h-8 rounded-full px-4 text-[13px] font-semibold transition duration-150", on ? "bg-white text-black" : "text-fg-2 hover:text-fg")}
                  >
                    {v === "lyrics" ? "Lyrics" : "Up next"}
                  </button>
                );
              })}
            </div>
            {view === "queue" ? <QueueView className="flex-1" /> : <LyricsView className="flex-1" />}
          </section>

          {/* Controls */}
          <div className="row-start-2 mx-auto w-full max-w-[520px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 lg:col-start-1 lg:max-w-none lg:pb-8">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[22px] font-bold leading-7 tracking-tight lg:text-2xl">{track.title}</h1>
                <Link
                  to={`/artist/${track.artistId}`}
                  onClick={ui.closeNowPlaying}
                  className="mt-0.5 block truncate text-base text-white/70 hover:text-white hover:underline"
                >
                  {artist?.name}
                </Link>
              </div>
              <LikeButton trackId={track.id} size="lg" className="text-white/80" />
            </div>

            <PlaybackProgress className="mt-3" />
            <TransportControls size="lg" className="mt-1" />

            <div className="mt-4 flex items-center gap-1">
              <IconButton label="Devices and output" onClick={() => ui.openModal({ type: "devices" })}>
                <MonitorSpeaker className="size-[22px]" />
              </IconButton>

              <button
                type="button"
                onClick={() => (ui.closeNowPlaying(), nav("/together"))}
                className={cn(
                  "mx-auto flex h-9 min-w-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition duration-150 active:scale-95",
                  room.active ? "bg-white/10 hover:bg-white/15" : "text-fg-2 hover:text-fg",
                )}
              >
                {room.active ? (
                  <>
                    <AvatarPair size="xs" partnerOnline={room.partnerOnline} />
                    <span className="truncate">
                      {room.partnerOnline ? `Listening with ${data.users.partner.name}` : `Waiting for ${data.users.partner.name}`}
                    </span>
                    {room.partnerOnline && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                  </>
                ) : (
                  <>
                    <Users className="size-[18px]" />
                    <span>Listen together</span>
                  </>
                )}
              </button>

              <IconButton label="Lyrics" active={view === "lyrics"} onClick={() => toggle("lyrics")} className="lg:hidden">
                <Mic2 className="size-[22px]" />
              </IconButton>
              <IconButton label="Queue" active={view === "queue"} onClick={() => toggle("queue")} className="lg:hidden">
                <ListMusic className="size-[22px]" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
