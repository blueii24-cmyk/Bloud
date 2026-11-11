import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownUp, Filter, Grid2x2, Heart, List, Plus } from "lucide-react";
import type { ArtSpec, Track } from "../types";
import { plural } from "../utils/format";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useUI } from "../state/UIContext";
import { MediaCard, VideoCard, ArtistCard } from "../components/media/Cards";
import { EmptyState } from "../components/media/Collection";
import { TrackList } from "../components/media/TrackRow";
import { Artwork } from "../components/ui/Artwork";
import { Chip, IconButton } from "../components/ui/Buttons";
import { Menu, MenuItem } from "../components/ui/Overlay";
import { ListSkeleton } from "../components/ui/Skeleton";

type Tab = "all" | "playlists" | "albums" | "artists" | "songs" | "videos";
type Sort = "recents" | "added" | "alpha" | "creator";

const TABS: { id: Tab; label: string }[] = [
  { id: "playlists", label: "Playlists" }, { id: "albums", label: "Albums" }, { id: "artists", label: "Artists" },
  { id: "songs", label: "Songs" }, { id: "videos", label: "Videos" },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: "recents", label: "Recents" }, { id: "added", label: "Recently added" }, { id: "alpha", label: "Alphabetical" }, { id: "creator", label: "Creator" },
];

interface Item {
  key: string;
  kind: "liked" | "playlist" | "album" | "artist";
  title: string;
  subtitle: string;
  creator: string;
  to: string;
  art?: ArtSpec;
  added: number;
  recent: number;
}

export default function Library() {
  const { ready, data, trackById, albumById, artistById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "all";
  const [sort, setSort] = useState<Sort>("recents");
  const [view, setView] = useState<"list" | "grid">("list");
  const [filter, setFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const setTab = (t: Tab) => setParams(t === "all" ? {} : { tab: t }, { replace: true });
  const day = 86_400_000;
  const now = Date.now();

  const songs = useMemo(() => {
    const ids = new Set(lib.likedIds);
    lib.savedAlbumIds.forEach((a) => albumById.get(a)?.trackIds.forEach((t) => ids.add(t)));
    return [...ids].map((id) => trackById.get(id)).filter((t): t is Track => !!t);
  }, [lib.likedIds, lib.savedAlbumIds, trackById, albumById]);

  const items = useMemo<Item[]>(() => {
    const you = data.users.me.name;
    const out: Item[] = [
      { key: "liked", kind: "liked", title: "Liked Songs", subtitle: `Playlist · ${plural(lib.likedIds.length, "song")}`, creator: you, to: "/liked", added: now, recent: now },
    ];
    lib.playlists.forEach((p) =>
      out.push({
        key: p.id, kind: "playlist", title: p.name, art: p.art, to: `/playlist/${p.id}`,
        subtitle: `Playlist · ${p.collaborative ? `${you} & ${data.users.partner.name}` : data.users[p.ownerId as "me" | "partner"]?.name}`,
        creator: data.users[p.ownerId as "me" | "partner"]?.name ?? "Tandem", added: p.createdAt, recent: p.updatedAt,
      }),
    );
    lib.savedAlbumIds.forEach((id, i) => {
      const a = albumById.get(id);
      if (a) out.push({ key: id, kind: "album", title: a.title, art: a.art, to: `/album/${id}`, subtitle: `Album · ${artistById.get(a.artistId)?.name}`, creator: artistById.get(a.artistId)?.name ?? "", added: Date.parse(a.addedAt), recent: now - (i + 3) * 2 * day });
    });
    lib.followedArtistIds.forEach((id, i) => {
      const a = artistById.get(id);
      if (a) out.push({ key: id, kind: "artist", title: a.name, art: a.art, to: `/artist/${id}`, subtitle: "Artist", creator: a.name, added: now - (i + 30) * day, recent: now - (i + 2) * 3 * day });
    });
    return out;
  }, [data.users, lib.likedIds.length, lib.playlists, lib.savedAlbumIds, lib.followedArtistIds, albumById, artistById, now]);

  const q = filter.trim().toLowerCase();
  const compare = (a: { title: string; creator: string; added: number; recent: number }, b: typeof a) =>
    sort === "alpha" ? a.title.localeCompare(b.title) : sort === "creator" ? a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title) : sort === "added" ? b.added - a.added : b.recent - a.recent;

  const visible = items
    .filter((i) => (tab === "all" ? true : tab === "playlists" ? i.kind === "playlist" || i.kind === "liked" : tab === "albums" ? i.kind === "album" : tab === "artists" ? i.kind === "artist" : false))
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.creator.toLowerCase().includes(q))
    .sort((a, b) => (a.kind === "liked" ? -1 : b.kind === "liked" ? 1 : compare(a, b)));

  const songList = useMemo(() => {
    const hist = (t: Track) => { const i = lib.playHistory.indexOf(t.id); return i < 0 ? 999 : i; };
    return songs
      .filter((t) => !q || t.title.toLowerCase().includes(q) || (artistById.get(t.artistId)?.name ?? "").toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "alpha" ? a.title.localeCompare(b.title)
        : sort === "creator" ? (artistById.get(a.artistId)?.name ?? "").localeCompare(artistById.get(b.artistId)?.name ?? "")
        : sort === "added" ? b.addedAt.localeCompare(a.addedAt)
        : hist(a) - hist(b));
  }, [songs, q, sort, lib.playHistory, artistById]);

  const videos = data.videos.filter((v) => {
    const inLib = lib.followedArtistIds.includes(v.artistId) || lib.isLiked(v.trackId);
    return inLib && (!q || v.title.toLowerCase().includes(q));
  });

  const createPlaylist = () => {
    const id = lib.createPlaylist();
    nav(`/playlist/${id}`);
    ui.openModal({ type: "edit", playlistId: id });
  };

  const playItem = (it: Item) => {
    if (it.kind === "liked") player.playTracks(lib.likedIds, 0, { label: "Liked Songs" });
    else if (it.kind === "playlist") { const p = lib.getPlaylist(it.key); if (p) player.playTracks(p.items.map((x) => x.trackId), 0, { label: p.name }); }
    else if (it.kind === "album") { const a = albumById.get(it.key); if (a) player.playTracks(a.trackIds, 0, { label: a.title }); }
    else player.playTracks(data.tracks.filter((t) => t.artistId === it.key).map((t) => t.id), 0, { label: it.title });
  };

  return (
    <div className="space-y-4 pt-1 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="t-page">Your Library</h1>
        <IconButton label="Create playlist" onClick={createPlaylist} className="bg-white/10 text-fg hover:bg-white/15">
          <Plus className="size-5" />
        </IconButton>
      </div>

      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Library sections">
        {TABS.map((t) => (
          <Chip key={t.id} role="tab" aria-selected={tab === t.id} active={tab === t.id} onClick={() => setTab(tab === t.id ? "all" : t.id)}>{t.label}</Chip>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Filter library" size="sm" active={showFilter || !!filter} onClick={() => setShowFilter((s) => !s)}>
          <Filter className="size-[18px]" />
        </IconButton>
        {showFilter && (
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find in your library"
            aria-label="Find in your library"
            className="h-8 min-w-0 flex-1 animate-fade-in rounded-md bg-white/10 px-3 text-[13px] outline-none placeholder:text-fg-3 focus:bg-white/15 focus:ring-2 focus:ring-white/60 sm:max-w-xs"
          />
        )}
        <button
          type="button"
          onClick={(e) => { setSortAnchor(e.currentTarget); setSortOpen(true); }}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-fg-2 transition hover:text-fg active:scale-95"
        >
          <ArrowDownUp className="size-4" />
          {SORTS.find((s) => s.id === sort)?.label}
        </button>
        {tab !== "songs" && tab !== "videos" && (
          <IconButton label={view === "list" ? "Switch to grid" : "Switch to list"} size="sm" onClick={() => setView(view === "list" ? "grid" : "list")}>
            {view === "list" ? <Grid2x2 className="size-[18px]" /> : <List className="size-[18px]" />}
          </IconButton>
        )}
        <Menu open={sortOpen} anchor={sortAnchor} onClose={() => setSortOpen(false)} header={<p className="font-semibold">Sort by</p>}>
          {SORTS.map((s) => <MenuItem key={s.id} label={s.label} checked={sort === s.id} onSelect={() => setSort(s.id)} />)}
        </Menu>
      </div>

      {!ready ? (
        <ListSkeleton rows={8} />
      ) : tab === "songs" ? (
        songList.length ? (
          <TrackList tracks={songList.map((track) => ({ track }))} showIndex={false} onPlay={(i) => player.playTracks(songList.map((t) => t.id), i, { label: "Your songs" })} />
        ) : <EmptyState title="No songs yet" body="Like a song or save an album and it will show up here." />
      ) : tab === "videos" ? (
        videos.length ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} className="w-full md:w-full" art={v.art} title={v.title} subtitle={artistById.get(v.artistId)?.name} duration={v.duration}
                onClick={() => (player.playTracks([v.trackId], 0, { label: v.title }), ui.notify("Video streaming isn't connected yet — playing audio"))} />
            ))}
          </div>
        ) : <EmptyState title="No videos yet" body="Follow artists to collect their music videos." />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing found" body={q ? `No library items match “${filter}”.` : "Your library is empty."} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visible.map((it) =>
            it.kind === "artist" ? (
              <ArtistCard key={it.key} className="w-full md:w-full" to={it.to} art={it.art!} title={it.title} subtitle={it.subtitle} onPlay={() => playItem(it)} />
            ) : (
              <MediaCard key={it.key} className="w-full md:w-full" to={it.to} art={it.art ?? likedArt} title={it.title} subtitle={it.subtitle} onPlay={() => playItem(it)} />
            ),
          )}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((it) => (
            <li key={it.key}>
              <Link to={it.to} className="group flex h-16 items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10">
                {it.kind === "liked" ? (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-art bg-gradient-to-br from-[#4fe3a1] to-[#3a2b8f]">
                    <Heart className="size-5 fill-white" />
                  </span>
                ) : (
                  <Artwork art={it.art!} circle={it.kind === "artist"} className="size-12" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{it.title}</span>
                  <span className="t-meta block truncate text-[13px]">{it.subtitle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const likedArt: ArtSpec = { palette: ["#4fe3a1", "#241a5c", "#ffffff"], pattern: "orbit", seed: 1 };
