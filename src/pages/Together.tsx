import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Info, LogOut, Plus } from "lucide-react";
import { cn } from "../utils/cn";
import { DEMO_ROOM_CODE, isSupabaseConfigured } from "../services";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useRoom } from "../state/RoomContext";
import { useUI } from "../state/UIContext";
import { Artwork } from "../components/ui/Artwork";
import { Avatar } from "../components/ui/Avatar";
import { PageTint, PlayFab } from "../components/ui/Bits";
import { Button } from "../components/ui/Buttons";
import { PlaybackProgress } from "../components/player/Transport";
import { Skeleton } from "../components/ui/Skeleton";
import type { UserId } from "../types";

export default function Together() {
  const { ready, data, trackById, artistById } = useCatalogue();
  const room = useRoom();
  const player = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const me = data.users.me;
  const partner = data.users.partner;
  const live = room.status === "live";
  const waiting = room.status === "waiting";
  const track = player.track;
  const shared = lib.playlists.find((p) => p.collaborative);

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? room.code ?? "" : `${window.location.origin}${window.location.pathname}#/together?join=${room.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      ui.notify(`Copy this ${what}: ${text}`);
    }
  };

  if (!ready) {
    return (
      <div className="space-y-6 pt-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mx-auto h-28 w-full max-w-md" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const status = live ? { label: "Live · in sync", tone: "text-accent" } : waiting ? { label: `Waiting for ${partner.name}…`, tone: "text-fg-2" } : { label: "Room closed", tone: "text-fg-3" };

  return (
    <div className="relative isolate pt-1 lg:pt-0">
      <PageTint color={live ? "#3b2a6b" : "#1f1f2b"} />
      <p className="t-eyebrow">Listen Together</p>
      <h1 className="t-page mt-1">{room.active ? "Your room" : "A private space for two"}</h1>

      {/* Presence */}
      <section aria-label="Room presence" className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-3 sm:gap-6">
        <Person userId="me" name={me.name} caption="You" online />
        <div className="relative flex h-px max-w-[140px] flex-1 items-center" aria-hidden>
          <div className={cn("h-px w-full transition-colors duration-700", live ? "bg-gradient-to-r from-accent/60 via-accent to-accent/60" : "bg-white/15")} />
          {live && (
            <>
              <span className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent" />
              <span className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent" style={{ animation: "pulse-ring 2.4s ease-out infinite" }} />
            </>
          )}
        </div>
        <Person userId="partner" name={partner.name} caption={live ? "Listening" : waiting ? "Joining…" : "Offline"} online={live} />
      </section>
      <p className={cn("mt-5 flex items-center justify-center gap-2 text-sm font-medium", status.tone)} role="status">
        <span className={cn("size-1.5 rounded-full", live ? "bg-accent" : waiting ? "animate-shimmer bg-fg-2" : "bg-fg-3")} />
        {status.label}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-10">
          {!room.active ? (
            <section className="mx-auto w-full max-w-md text-center lg:mx-0 lg:text-left">
              <p className="t-meta">Start a room and invite {partner.name}. You'll share one queue and one playback state — either of you can pause, skip or add songs.</p>
              <Button variant="primary" size="md" className="mt-5 w-full sm:w-auto" onClick={room.createRoom}>Start a room</Button>

              <form
                className="mt-8 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (room.joinRoom(code)) setCode("");
                }}
              >
                <label htmlFor="room-code" className="t-eyebrow">Have a code?</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="room-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TNDM-0000"
                    maxLength={9}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-5 font-mono text-[15px] tracking-widest outline-none transition placeholder:text-fg-3 focus:bg-white/15 focus:ring-2 focus:ring-accent/70"
                  />
                  <Button variant="secondary" type="submit" disabled={code.trim().length < 4}>Join</Button>
                </div>
                {room.error && <p className="mt-2 text-sm text-danger" role="alert">{room.error}</p>}
                {!isSupabaseConfigured && <p className="t-caption mt-2">Preview build — try the demo code {DEMO_ROOM_CODE}.</p>}
              </form>
            </section>
          ) : (
            <>
              <section aria-label="Invite">
                <h2 className="t-section mb-3">Invite</h2>
                <div className="flex items-center gap-3 rounded-xl bg-surface p-3 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="t-eyebrow">Room code</p>
                    <p className="mt-0.5 font-mono text-xl font-semibold tracking-[0.18em]">{room.code}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => copy("code")}>{copied === "code" ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />} {copied === "code" ? "Copied" : "Code"}</Button>
                  <Button size="sm" variant="secondary" onClick={() => copy("link")}>{copied === "link" ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />} {copied === "link" ? "Copied" : "Link"}</Button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                  <Row label="Room" value={live ? "Open · 2 listening" : "Open · 1 listening"} />
                  <Row label="Playback" value={track ? (player.playing ? "Playing for both" : "Paused for both") : "Nothing playing"} />
                  <Row label="Sync" value={live ? `In sync · ±${room.syncOffsetMs} ms` : "Waiting"} accent={live} />
                  <Row label="Queue" value={`Shared · ${player.upNext.length + (track ? 1 : 0)} songs`} />
                </dl>
                <p className="t-caption mt-3 flex items-start gap-2"><Info className="mt-px size-3.5 shrink-0" /> {isSupabaseConfigured ? `Live via Supabase Realtime — ${partner.name}'s presence and playback sync in real time.` : `Simulated preview: ${partner.name}'s presence and sync are local. Supabase Realtime will make this real.`}</p>
                <Button variant="ghost" size="sm" className="-ml-3 mt-3 hover:text-danger" onClick={room.leaveRoom}><LogOut className="size-4" /> Leave room</Button>
              </section>

              {track && (
                <section aria-label="Now sharing">
                  <h2 className="t-section mb-3">Now sharing</h2>
                  <div className="rounded-xl bg-surface p-4">
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => ui.openNowPlaying()} aria-label="Open Now Playing" className="shrink-0 transition active:scale-95">
                        <Artwork key={track.id} art={track.art} className="size-16 animate-art-in" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{track.title}</p>
                        <p className="t-meta truncate">{artistById.get(track.artistId)?.name}</p>
                        <p className="t-caption mt-1 flex items-center gap-1.5">Added by <Avatar userId={player.current?.addedBy ?? "me"} size="xs" className="size-4 text-[9px]" /> {data.users[player.current?.addedBy ?? "me"].name}</p>
                      </div>
                      <PlayFab size="md" playing={player.playing} onClick={player.togglePlay} />
                    </div>
                    <PlaybackProgress className="mt-3" />
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="space-y-10">
          <section aria-label="Shared queue">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="t-section">Shared queue</h2>
                <p className="t-meta">{room.active ? "Both of you can add and reorder" : "Visible to Sam once you start a room"}</p>
              </div>
              <button type="button" onClick={() => ui.openModal({ type: "addSongs", target: { kind: "queue" } })} className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-semibold transition hover:bg-white/15 active:scale-95">
                <Plus className="size-4" /> Add
              </button>
            </div>
            {player.upNext.length === 0 ? (
              <p className="t-meta rounded-xl bg-white/[0.04] px-4 py-6 text-center">The queue is empty.</p>
            ) : (
              <ul>
                {player.upNext.slice(0, 5).map((q) => {
                  const t = trackById.get(q.trackId);
                  if (!t) return null;
                  return (
                    <li key={q.uid} className="animate-row-in">
                      <button type="button" onClick={() => player.skipTo(q.uid)} className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.06] active:bg-white/10">
                        <Artwork art={t.art} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium leading-5">{t.title}</span>
                          <span className="t-meta block truncate text-[13px]">{artistById.get(t.artistId)?.name}</span>
                        </span>
                        <AddedBy userId={q.addedBy} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {player.upNext.length > 5 && (
              <button type="button" onClick={() => ui.openNowPlaying("queue")} className="t-meta mt-2 px-2 font-semibold hover:text-fg">
                See all {player.upNext.length} in queue
              </button>
            )}
          </section>

          {shared && (
            <section aria-label="Shared playlist">
              <div className="mb-3 flex items-center gap-3">
                <Artwork art={shared.art} className="size-12" />
                <div className="min-w-0 flex-1">
                  <h2 className="t-section truncate">{shared.name}</h2>
                  <p className="t-meta">Shared playlist · {shared.items.length} songs</p>
                </div>
                <Link to={`/playlist/${shared.id}`} className="t-meta shrink-0 font-semibold hover:text-fg hover:underline">Open</Link>
              </div>
              <ul>
                {shared.items.slice(-4).reverse().map((it) => {
                  const t = trackById.get(it.trackId);
                  if (!t) return null;
                  return (
                    <li key={it.trackId} className="flex h-14 items-center gap-3 rounded-lg px-2 transition hover:bg-white/[0.06]">
                      <Artwork art={t.art} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium leading-5">{t.title}</span>
                        <span className="t-meta block truncate text-[13px]">{artistById.get(t.artistId)?.name}</span>
                      </span>
                      <AddedBy userId={it.addedBy as UserId} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Person({ userId, name, caption, online }: { userId: UserId; name: string; caption: string; online: boolean }) {
  return (
    <div className="flex w-24 flex-col items-center text-center">
      <div className="relative">
        <Avatar userId={userId} size="xl" className={cn("transition-opacity duration-700", !online && "opacity-40")} />
        {online && <span className="absolute bottom-1 right-1 size-3.5 rounded-full bg-accent ring-4 ring-black" />}
      </div>
      <p className="mt-3 text-[15px] font-semibold">{name}</p>
      <p className="t-caption">{caption}</p>
    </div>
  );
}

function AddedBy({ userId }: { userId: UserId }) {
  const { data } = useCatalogue();
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Avatar userId={userId} size="xs" />
      <span className="t-caption hidden sm:inline">{userId === "me" ? "You" : data.users[userId].name}</span>
    </span>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="t-eyebrow">{label}</dt>
      <dd className={cn("mt-0.5 font-medium", accent && "text-accent")}>{value}</dd>
    </div>
  );
}
