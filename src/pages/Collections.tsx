import { Link, useParams } from "react-router-dom";
import { Heart, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Track, UserId } from "../types";
import { formatTotal, plural } from "../utils/format";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useUI } from "../state/UIContext";
import { CollectionActions, CollectionHeader, EmptyState } from "../components/media/Collection";
import { ArtistCard, MediaCard, VideoCard } from "../components/media/Cards";
import { TrackList } from "../components/media/TrackRow";
import { Artwork } from "../components/ui/Artwork";
import { Avatar } from "../components/ui/Avatar";
import { PageTint } from "../components/ui/Bits";
import { Button, IconButton } from "../components/ui/Buttons";
import { Shelf } from "../components/ui/Shelf";
import { ListSkeleton, Skeleton } from "../components/ui/Skeleton";

function PageSkeleton() {
  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-col items-center gap-5 md:flex-row md:items-end md:pt-6">
        <Skeleton className="size-[min(62vw,232px)] md:size-[232px]" />
        <div className="w-full space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

function NotFound({ what }: { what: string }) {
  return <EmptyState title={`${what} not found`} body="It may have been deleted or moved." action={<Link to="/" className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-black">Back to Home</Link>} />;
}

/** Hook: play/pause behaviour shared by collection headers */
function useCollectionPlayback(label: string, ids: string[]) {
  const player = usePlayer();
  const isCurrent = player.context?.label === label;
  return {
    playing: isCurrent && player.playing,
    toggle: () => (isCurrent ? player.togglePlay() : player.playTracks(ids, 0, { label })),
    shuffle: () => player.playTracks(ids, 0, { label, shuffle: true }),
    playAt: (i: number) => player.playTracks(ids, i, { label }),
  };
}

/* ---------------------------------------------------------------- Playlist */

export function PlaylistPage() {
  const { id = "" } = useParams();
  const { ready, data, trackById } = useCatalogue();
  const lib = useLibrary();
  const ui = useUI();
  const playlist = lib.getPlaylist(id);
  const items = (playlist?.items ?? []).map((i) => ({ ...i, track: trackById.get(i.trackId) })).filter((i): i is typeof i & { track: Track } => !!i.track);
  const ids = items.map((i) => i.track.id);
  const pb = useCollectionPlayback(playlist?.name ?? "", ids);

  if (!ready && !playlist) return <PageSkeleton />;
  if (!playlist) return <NotFound what="Playlist" />;
  if (!ready) return <PageSkeleton />;

  const editable = playlist.kind === "user";
  const total = items.reduce((s, i) => s + i.track.duration, 0);
  const owner = playlist.ownerId === "tandem" ? null : data.users[playlist.ownerId];

  return (
    <div className="relative isolate pt-1 lg:pt-0">
      <PageTint color={playlist.art.palette[0]} />
      <CollectionHeader
        art={<Artwork art={playlist.art} label={`${playlist.name} artwork`} className="size-full rounded-[inherit]" />}
        kind={playlist.kind === "mix" ? "Made for you" : playlist.collaborative ? "Collaborative playlist" : "Playlist"}
        title={playlist.name}
        description={playlist.description}
        meta={
          <>
            {playlist.collaborative ? (
              <span className="flex items-center gap-1.5 font-semibold text-fg">
                <span className="flex"><Avatar userId="me" size="xs" ring /><Avatar userId="partner" size="xs" ring className="-ml-1.5" /></span>
                {data.users.me.name} & {data.users.partner.name}
              </span>
            ) : owner ? (
              <span className="flex items-center gap-1.5 font-semibold text-fg"><Avatar userId={owner.id} size="xs" />{owner.name}</span>
            ) : (
              <span className="font-semibold text-fg">Tandem</span>
            )}
            <span>· {plural(items.length, "song")}{items.length ? `, ${formatTotal(total)}` : ""}</span>
          </>
        }
      />

      <CollectionActions playing={pb.playing} onPlay={items.length ? pb.toggle : () => ui.openModal({ type: "addSongs", target: { kind: "playlist", id: playlist.id } })} onShuffle={items.length ? pb.shuffle : undefined}>
        {editable && (
          <>
            <IconButton label="Add songs" size="lg" onClick={() => ui.openModal({ type: "addSongs", target: { kind: "playlist", id: playlist.id } })}>
              <Plus className="size-6" />
            </IconButton>
            <IconButton label="Edit playlist" size="lg" onClick={() => ui.openModal({ type: "edit", playlistId: playlist.id })}>
              <Pencil className="size-[22px]" />
            </IconButton>
          </>
        )}
        {playlist.collaborative && (
          <span className="t-meta ml-auto hidden items-center gap-1.5 sm:flex"><Users className="size-4" /> Both can add songs</span>
        )}
      </CollectionActions>

      {items.length === 0 ? (
        <EmptyState
          title="Let's find something for this playlist"
          body="Search for songs and add them here."
          action={<Button variant="primary" onClick={() => ui.openModal({ type: "addSongs", target: { kind: "playlist", id: playlist.id } })}><Plus className="size-4" /> Add songs</Button>}
        />
      ) : (
        <TrackList
          tracks={items.map((i) => ({ track: i.track, addedBy: playlist.collaborative ? (i.addedBy as UserId) : undefined }))}
          onPlay={pb.playAt}
          extraFor={editable ? (t) => [{ label: "Remove from this playlist", icon: <Trash2 className="size-5" />, danger: true, onSelect: () => (lib.removeFromPlaylist(playlist.id, t.id), ui.notify("Removed from playlist")) }] : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Album */

export function AlbumPage() {
  const { id = "" } = useParams();
  const { ready, albumById, artistById, trackById } = useCatalogue();
  const lib = useLibrary();
  const ui = useUI();
  const album = albumById.get(id);
  const tracks = (album?.trackIds ?? []).map((t) => trackById.get(t)).filter((t): t is Track => !!t);
  const pb = useCollectionPlayback(album?.title ?? "", tracks.map((t) => t.id));

  if (!ready) return <PageSkeleton />;
  if (!album) return <NotFound what="Album" />;
  const artist = artistById.get(album.artistId);
  const saved = lib.savedAlbumIds.includes(album.id);

  return (
    <div className="relative isolate pt-1 lg:pt-0">
      <PageTint color={album.art.palette[0]} />
      <CollectionHeader
        art={<Artwork art={album.art} label={`${album.title} cover`} className="size-full rounded-[inherit]" />}
        kind="Album"
        title={album.title}
        meta={
          <>
            <Link to={`/artist/${album.artistId}`} className="font-semibold text-fg hover:underline">{artist?.name}</Link>
            <span>· {album.year} · {plural(tracks.length, "song")}, {formatTotal(tracks.reduce((s, t) => s + t.duration, 0))}</span>
          </>
        }
      />
      <CollectionActions playing={pb.playing} onPlay={pb.toggle} onShuffle={pb.shuffle}>
        <IconButton label={saved ? "Remove album from library" : "Save album to library"} size="lg" active={saved} onClick={() => (lib.toggleAlbum(album.id), ui.notify(saved ? "Removed from Your Library" : "Saved to Your Library"))}>
          <Heart className={saved ? "size-6 fill-accent" : "size-6"} />
        </IconButton>
      </CollectionActions>
      <TrackList tracks={tracks.map((track) => ({ track }))} showAlbum={false} onPlay={pb.playAt} />
    </div>
  );
}

/* ------------------------------------------------------------------- Liked */

export function LikedPage() {
  const { ready, trackById, data } = useCatalogue();
  const lib = useLibrary();
  const tracks = lib.likedIds.map((t) => trackById.get(t)).filter((t): t is Track => !!t);
  const pb = useCollectionPlayback("Liked Songs", tracks.map((t) => t.id));

  if (!ready) return <PageSkeleton />;
  return (
    <div className="relative isolate pt-1 lg:pt-0">
      <PageTint color="#4a3fc4" />
      <CollectionHeader
        art={
          <span className="flex size-full items-center justify-center rounded-[inherit] bg-gradient-to-br from-[#4fe3a1] via-[#3d6fd9] to-[#3a1d8f]">
            <Heart className="size-1/3 fill-white text-white" />
          </span>
        }
        kind="Playlist"
        title="Liked Songs"
        meta={
          <>
            <span className="flex items-center gap-1.5 font-semibold text-fg"><Avatar userId="me" size="xs" />{data.users.me.name}</span>
            <span>· {plural(tracks.length, "song")}{tracks.length ? `, ${formatTotal(tracks.reduce((s, t) => s + t.duration, 0))}` : ""}</span>
          </>
        }
      />
      <CollectionActions playing={pb.playing} onPlay={tracks.length ? pb.toggle : () => undefined} onShuffle={tracks.length ? pb.shuffle : undefined} />
      {tracks.length === 0 ? (
        <EmptyState title="Songs you like will appear here" body="Tap the heart on any song to save it." />
      ) : (
        <TrackList tracks={tracks.map((track) => ({ track }))} onPlay={pb.playAt} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Artist */

export function ArtistPage() {
  const { id = "" } = useParams();
  const { ready, data, artistById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const artist = artistById.get(id);
  const tracks = data.tracks.filter((t) => t.artistId === id);
  const pb = useCollectionPlayback(artist?.name ?? "", tracks.map((t) => t.id));

  if (!ready) return <PageSkeleton />;
  if (!artist) return <NotFound what="Artist" />;
  const following = lib.followedArtistIds.includes(artist.id);
  const albums = data.albums.filter((a) => a.artistId === id);
  const videos = data.videos.filter((v) => v.artistId === id);
  const related = data.artists.filter((a) => a.id !== id).slice(0, 6);

  return (
    <div className="relative isolate space-y-8 pt-1 lg:pt-0">
      <PageTint color={artist.art.palette[0]} />
      <div>
        <CollectionHeader
          circleArt
          art={<Artwork art={artist.art} circle label={artist.name} className="size-full" />}
          kind={artist.genre}
          title={artist.name}
          description={artist.bio}
          meta={<span>{artist.monthlyListeners.toLocaleString()} monthly listeners</span>}
        />
        <CollectionActions playing={pb.playing} onPlay={pb.toggle} onShuffle={pb.shuffle}>
          <Button variant="secondary" className="ml-1 border border-white/20 bg-transparent hover:border-white/50 hover:bg-transparent" onClick={() => (lib.toggleFollow(artist.id), ui.notify(following ? `Unfollowed ${artist.name}` : `Following ${artist.name}`))}>
            {following ? "Following" : "Follow"}
          </Button>
        </CollectionActions>
      </div>

      <section>
        <h2 className="t-section mb-2">Popular</h2>
        <TrackList header={false} showIndex tracks={tracks.slice(0, 5).map((track) => ({ track }))} onPlay={(i) => player.playTracks(tracks.map((t) => t.id), i, { label: artist.name })} />
      </section>

      <Shelf title="Albums">
        {albums.map((a) => (
          <MediaCard key={a.id} to={`/album/${a.id}`} art={a.art} title={a.title} subtitle={`${a.year} · Album`} onPlay={() => player.playTracks(a.trackIds, 0, { label: a.title })} />
        ))}
      </Shelf>

      {videos.length > 0 && (
        <Shelf title="Music videos">
          {videos.map((v) => (
            <VideoCard key={v.id} art={v.art} title={v.title} subtitle={`${v.views} views`} duration={v.duration}
              onClick={() => (player.playTracks([v.trackId], 0, { label: v.title }), ui.notify("Video streaming isn't connected yet — playing audio"))} />
          ))}
        </Shelf>
      )}

      <Shelf title="Fans also like">
        {related.map((a) => (
          <ArtistCard key={a.id} to={`/artist/${a.id}`} art={a.art} title={a.name} subtitle={a.genre} />
        ))}
      </Shelf>
    </div>
  );
}
