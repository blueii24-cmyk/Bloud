import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Copy, Info, LogOut, Plus, Share2, UsersRound } from "lucide-react";
import { cn } from "../utils/cn";
import { DEMO_ROOM_CODE, isSupabaseConfigured } from "../services";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useRoom } from "../state/RoomContext";
import { useUI } from "../state/UIContext";
import { useWorkspace } from "../state/WorkspaceContext";
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
  const workspace = useWorkspace();
  const player = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | "invite" | null>(null);
  const [workspaceAction, setWorkspaceAction] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const inviteAttempt = useRef<{ code: string; promise: Promise<{ ok: boolean; message: string }> } | null>(null);
  const roomAttempt = useRef<string | null>(null);
  const inviteCode = searchParams.get("invite");
  const roomCode = searchParams.get("join");

  const me = data.users.me;
  const partner = data.users.partner;
  const selfOnline = room.members.some((member) => member.userId === "me" && member.online);
  const live = room.status === "live";
  const waiting = room.status === "waiting";
  const track = player.track;
  const shared = lib.playlists.find((p) => p.collaborative);
  const canUseRooms = workspace.paired || !isSupabaseConfigured;

  useEffect(() => {
    if (!inviteCode || workspace.status === "loading") return;
    if (!isSupabaseConfigured) {
      setWorkspaceNotice("Workspace invites require a configured Bloud account and are unavailable in the offline demo.");
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("invite");
        return next;
      }, { replace: true });
      return;
    }
    let attempt = inviteAttempt.current;
    if (!attempt || attempt.code !== inviteCode) {
      const promise = workspace.acceptInvite(inviteCode)
        .then(() => ({ ok: true, message: "Your accounts are now paired in a private workspace." }))
        .catch((reason: unknown) => ({
          ok: false,
          message: reason instanceof Error ? reason.message : "Couldn't accept this workspace invite.",
        }));
      attempt = { code: inviteCode, promise };
      inviteAttempt.current = attempt;
    }

    let alive = true;
    setWorkspaceAction(true);
    setWorkspaceNotice("");
    void attempt.promise.then((result) => {
      if (!alive) return;
      setWorkspaceNotice(result.message);
      setWorkspaceAction(false);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("invite");
        return next;
      }, { replace: true });
    });
    return () => { alive = false; };
  }, [inviteCode, workspace.status, workspace.acceptInvite, setSearchParams]);

  useEffect(() => {
    if (!roomCode || workspace.status === "loading" || !canUseRooms || room.active || roomAttempt.current === roomCode) return;
    roomAttempt.current = roomCode;
    setCode(roomCode);
    void room.joinRoom(roomCode).catch(() => false).finally(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("join");
        return next;
      }, { replace: true });
    });
  }, [roomCode, room.active, room.joinRoom, workspace.status, canUseRooms, setSearchParams]);

  const copy = async (what: "code" | "link" | "invite") => {
    const text = what === "code"
      ? room.code ?? ""
      : what === "link"
        ? `${window.location.origin}${window.location.pathname}#/together?join=${room.code}`
        : inviteUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      ui.notify(`Copy this ${what}: ${text}`);
    }
  };

  const makeWorkspaceInvite = async () => {
    setWorkspaceAction(true);
    setWorkspaceNotice("");
    workspace.clearError();
    try {
      const token = await workspace.createInvite();
      setInviteUrl(`${window.location.origin}${window.location.pathname}#/together?invite=${encodeURIComponent(token)}`);
      setWorkspaceNotice("Invite link created. It can be accepted by one other Bloud account for seven days.");
    } catch (reason) {
      setWorkspaceNotice(reason instanceof Error ? reason.message : "Couldn't create a workspace invite.");
    } finally {
      setWorkspaceAction(false);
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

  const status = live
    ? { label: room.simulated ? "Live · simulated" : "Live · connected", tone: "text-accent" }
    : waiting
      ? { label: `Waiting for ${partner.name}…`, tone: "text-fg-2" }
      : { label: "Room closed", tone: "text-fg-3" };

  return (
    <div className="relative isolate pt-1 lg:pt-0">
      <PageTint color={live ? "#3b2a6b" : "#1f1f2b"} />
      <p className="t-eyebrow">Listen Together</p>
      <h1 className="t-page mt-1">{room.active ? "Your room" : "A private space for two"}</h1>

      <section aria-label="Shared workspace" className="mt-6 rounded-2xl border border-line bg-bg-2 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent"><UsersRound className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              {workspace.paired
                ? `Shared with ${workspace.partner?.displayName ?? "your partner"}`
                : !isSupabaseConfigured
                  ? "Offline demo"
                  : workspace.id ? "Invite your partner" : "Create your private workspace"}
            </h2>
            <p className="t-meta mt-1 text-sm">
              {workspace.paired
                ? "Your personal libraries stay private. Collaborative playlists and Listen Together rooms are limited to these two accounts."
                : isSupabaseConfigured
                  ? "Create a one-time invite for one other Bloud account. Personal libraries stay private; only shared playlists and authorized rooms are collaborative."
                  : "Workspace invites and cross-account sharing need a configured Supabase project. Listen Together is simulated locally in this preview."}
            </p>
          </div>
          {isSupabaseConfigured && !workspace.paired && (
            <Button variant="secondary" disabled={workspaceAction || workspace.status === "loading"} onClick={() => void makeWorkspaceInvite()}>
              {workspaceAction ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Share2 className="size-4" />}
              {workspace.id ? "Create invite" : "Create workspace invite"}
            </Button>
          )}
        </div>
        {workspace.paired && (
          <p className="t-caption mt-3 flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />{workspace.members.length} verified accounts in this workspace</p>
        )}
        {inviteUrl && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white/[0.04] p-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-all font-mono text-xs text-fg-2">{inviteUrl}</p>
            <Button size="sm" variant="secondary" onClick={() => void copy("invite")}>
              {copied === "invite" ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
              {copied === "invite" ? "Copied" : "Copy invite"}
            </Button>
          </div>
        )}
        {workspaceNotice && workspaceNotice !== workspace.error && <p className="t-meta mt-3 text-sm" role="status">{workspaceNotice}</p>}
        {workspace.error && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-danger">{workspace.error}</p>
            <Button size="sm" variant="ghost" onClick={() => void workspace.refresh()}>Retry workspace check</Button>
          </div>
        )}
      </section>

      {/* Presence */}
      <section aria-label="Room presence" className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-3 sm:gap-6">
        <Person userId="me" name={me.name} caption="You" online={selfOnline} />
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
              <p className="t-meta">Once your workspace has two verified accounts, start a room to share one queue and playback state.</p>
              <Button variant="primary" size="md" className="mt-5 w-full sm:w-auto" disabled={!canUseRooms || workspace.status === "loading"} onClick={() => void room.createRoom()}>
                {canUseRooms ? "Start a room" : "Invite your partner first"}
              </Button>

              <form
                className="mt-8 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  void room.joinRoom(code).then((joined) => joined && setCode("")).catch(() => undefined);
                }}
              >
                <label htmlFor="room-code" className="t-eyebrow">Have a code?</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="room-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TNDM-XXXXXXXX"
                    maxLength={13}
                    disabled={!canUseRooms || workspace.status === "loading"}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-5 font-mono text-[15px] tracking-widest outline-none transition placeholder:text-fg-3 focus:bg-white/15 focus:ring-2 focus:ring-accent/70"
                  />
                  <Button variant="secondary" type="submit" disabled={!canUseRooms || code.trim().length < 8 || workspace.status === "loading"}>Join</Button>
                </div>
                {room.error && <p className="mt-2 text-sm text-danger" role="alert">{room.error}</p>}
                {!canUseRooms && <p className="t-caption mt-2">Accept a workspace invite before joining a room.</p>}
                {!isSupabaseConfigured && <p className="t-caption mt-2">Offline preview — try the demo code {DEMO_ROOM_CODE}.</p>}
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
                {room.error && <p className="mt-2 text-sm text-danger" role="alert">{room.error}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                  <Row label="Room" value={live ? "Open · 2 listening" : "Open · 1 listening"} />
                  <Row label="Playback" value={track ? (player.playing ? "Playing for both" : "Paused for both") : "Nothing playing"} />
                  <Row label="Sync" value={live ? (room.simulated ? "Simulated preview" : "Connected · realtime") : "Waiting for partner"} accent={live} />
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
