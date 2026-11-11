import { useMemo } from "react";
import { greeting, formatTime } from "../utils/format";
import type { Track } from "../types";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useUI } from "../state/UIContext";
import { ArtistCard, MediaCard, VideoCard } from "../components/media/Cards";
import { TrackRow } from "../components/media/TrackRow";
import { Artwork } from "../components/ui/Artwork";
import { PageTint } from "../components/ui/Bits";
import { Shelf } from "../components/ui/Shelf";
import { ShelfSkeleton, Skeleton } from "../components/ui/Skeleton";

export default function Home() {
  const { ready, data, trackById, albumById, artistById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();

  const tracksOf = (ids: string[]) => ids.map((id) => trackById.get(id)).filter((t): t is Track => !!t);
  const recent = useMemo(() => tracksOf(lib.playHistory).slice(0, 10), [lib.playHistory, trackById]); // eslint-disable-line react-hooks/exhaustive-deps
  const liked = useMemo(() => tracksOf(lib.likedIds).slice(0, 12), [lib.likedIds, trackById]); // eslint-disable-line react-hooks/exhaustive-deps
  const newest = useMemo(() => [...data.albums].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 8), [data.albums]);
  const shared = lib.playlists.filter((p) => p.collaborative);
  const artists = data.artists.filter((a) => lib.followedArtistIds.includes(a.id));
  const tint = player.track?.art.palette[0] ?? "#1d2a3a";

  const playPlaylist = (id: string) => {
    const p = lib.getPlaylist(id);
    if (p) player.playTracks(p.items.map((i) => i.trackId), 0, { label: p.name });
  };

  if (!ready) {
    return (
      <div className="space-y-8 pt-2">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
        <ShelfSkeleton />
        <ShelfSkeleton />
        <ShelfSkeleton circle />
      </div>
    );
  }

  return (
    <div className="relative isolate space-y-9 pt-1 lg:pt-0">
      <PageTint color={tint} />

      <h1 className="t-page">{greeting()}, {data.users.me.name}</h1>

      {/* Continue listening */}
      <section aria-label="Continue listening" className="-mt-3">
        <h2 className="t-eyebrow mb-3">Continue listening</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.continueListening.map((c) => {
            if (c.type === "track") {
              const t = trackById.get(c.id);
              if (!t) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => player.playTracks([t.id], 0, { label: "Continue listening", startAt: c.position })}
                  className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-lg bg-white/[0.07] pr-3 text-left transition duration-150 hover:bg-white/[0.12] active:scale-[0.985]"
                >
                  <Artwork art={t.art} className="size-14 rounded-none" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="t-caption block truncate">{formatTime(t.duration - c.position)} left · {artistById.get(t.artistId)?.name}</span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                    <span className="block h-full bg-accent" style={{ width: `${(c.position / t.duration) * 100}%` }} />
                  </span>
                </button>
              );
            }
            const al = albumById.get(c.id);
            if (!al) return null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => player.playTracks(al.trackIds, Math.min(c.position, al.trackIds.length - 1), { label: al.title })}
                className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-lg bg-white/[0.07] pr-3 text-left transition duration-150 hover:bg-white/[0.12] active:scale-[0.985]"
              >
                <Artwork art={al.art} className="size-14 rounded-none" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{al.title}</span>
                  <span className="t-caption block truncate">Track {c.position + 1} of {al.trackIds.length} · {artistById.get(al.artistId)?.name}</span>
                </span>
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                  <span className="block h-full bg-accent" style={{ width: `${(c.position / al.trackIds.length) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Shelf title="Recently played" subtitle="Pick up where you left off">
        {recent.map((t, i) => (
          <MediaCard
            key={t.id}
            art={t.art}
            title={t.title}
            subtitle={artistById.get(t.artistId)?.name}
            onClick={() => player.playTracks(recent.map((r) => r.id), i, { label: "Recently played" })}
          />
        ))}
      </Shelf>

      <Shelf title="Made for us" subtitle={`Mixes for ${data.users.me.name} & ${data.users.partner.name}`}>
        {data.mixes.map((m) => (
          <MediaCard
            key={m.id}
            to={`/playlist/${m.id}`}
            art={m.art}
            title={m.name}
            subtitle={m.description}
            onPlay={() => playPlaylist(m.id)}
            playing={player.playing && player.context?.label === m.name}
          />
        ))}
      </Shelf>

      <Shelf
        title="Favourite songs"
        to="/liked"
        trackClassName="grid grid-flow-col grid-rows-3 auto-cols-[88%] sm:auto-cols-[360px] gap-x-4 gap-y-0.5 [&>*]:snap-start"
      >
        {liked.map((t, i) => (
          <TrackRow key={t.id} track={t} onPlay={() => player.playTracks(liked.map((l) => l.id), i, { label: "Liked Songs" })} />
        ))}
      </Shelf>

      <Shelf title="Recently added" subtitle="New in your library">
        {newest.map((a) => (
          <MediaCard
            key={a.id}
            to={`/album/${a.id}`}
            art={a.art}
            title={a.title}
            subtitle={`${a.year} · ${artistById.get(a.artistId)?.name}`}
            onPlay={() => player.playTracks(a.trackIds, 0, { label: a.title })}
            playing={player.playing && player.context?.label === a.title}
          />
        ))}
      </Shelf>

      {shared.length > 0 && (
        <Shelf title="Shared playlists" subtitle="Built by both of you">
          {shared.map((p) => (
            <MediaCard
              key={p.id}
              to={`/playlist/${p.id}`}
              art={p.art}
              title={p.name}
              subtitle={`${p.items.length} songs · ${data.users.me.name} & ${data.users.partner.name}`}
              onPlay={() => playPlaylist(p.id)}
              playing={player.playing && player.context?.label === p.name}
            />
          ))}
        </Shelf>
      )}

      <Shelf title="Favourite artists">
        {artists.map((a) => (
          <ArtistCard
            key={a.id}
            to={`/artist/${a.id}`}
            art={a.art}
            title={a.name}
            subtitle={a.genre}
            onPlay={() => player.playTracks(data.tracks.filter((t) => t.artistId === a.id).map((t) => t.id), 0, { label: a.name })}
          />
        ))}
      </Shelf>

      <Shelf title="Music videos">
        {data.videos.map((v) => (
          <VideoCard
            key={v.id}
            art={v.art}
            title={v.title}
            subtitle={`${artistById.get(v.artistId)?.name} · ${v.views} views`}
            duration={v.duration}
            onClick={() => {
              player.playTracks([v.trackId], 0, { label: v.title });
              ui.notify("Video streaming isn't connected yet — playing audio");
            }}
          />
        ))}
      </Shelf>
    </div>
  );
}
