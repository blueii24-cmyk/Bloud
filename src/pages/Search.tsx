import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, Search as SearchIcon, X } from "lucide-react";
import { cn } from "../utils/cn";
import type { Album, Artist, Playlist, Track, Video } from "../types";
import { searchCatalogue, suggest } from "../utils/search";
import { useCatalogue } from "../state/CatalogueContext";
import { useLibrary } from "../state/LibraryContext";
import { usePlayer } from "../state/PlayerContext";
import { useUI } from "../state/UIContext";
import { ArtistCard, MediaCard, VideoCard } from "../components/media/Cards";
import { EmptyState } from "../components/media/Collection";
import { TrackRow } from "../components/media/TrackRow";
import { Artwork } from "../components/ui/Artwork";
import { PlayFab } from "../components/ui/Bits";
import { Chip } from "../components/ui/Buttons";
import { Shelf } from "../components/ui/Shelf";
import { ListSkeleton, Skeleton } from "../components/ui/Skeleton";

type Filter = "all" | "songs" | "artists" | "albums" | "videos" | "playlists";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" }, { id: "songs", label: "Songs" }, { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" }, { id: "videos", label: "Videos" }, { id: "playlists", label: "Playlists" },
];

export default function Search() {
  const { ready, data, artistById } = useCatalogue();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const q = params.get("q") ?? "";
  const [focused, setFocused] = useState(false);

  const setQ = (value: string, commit = false) => {
    setParams(value ? { q: value } : {}, { replace: true });
    if (commit) lib.addRecentSearch(value);
  };

  const allPlaylists = useMemo(() => [...lib.playlists, ...data.mixes], [lib.playlists, data.mixes]);
  const results = useMemo(() => searchCatalogue(data, allPlaylists, q), [data, allPlaylists, q]);
  const suggestions = useMemo(() => suggest(data, q), [data, q]);
  const hasQuery = q.trim().length > 0;
  const total = results.tracks.length + results.artists.length + results.albums.length + results.videos.length + results.playlists.length;

  const playTrack = (list: Track[], i: number) => {
    lib.addRecentSearch(q);
    player.playTracks(list.map((t) => t.id), i, { label: `Search: ${q}` });
  };

  return (
    <div className="space-y-6 pt-1 lg:pt-0">
      <h1 className="t-page">Search</h1>

      <div>
        <div className="relative max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === "Enter" && (lib.addRecentSearch(q), e.currentTarget.blur())}
            placeholder="Songs, artists, albums, videos"
            aria-label="Search"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full appearance-none rounded-full bg-surface-hover pl-12 pr-12 text-base outline-none transition duration-150 placeholder:text-fg-3 focus:bg-surface-3 focus:ring-2 focus:ring-white/80 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 transition hover:text-fg active:scale-90">
              <X className="size-5" />
            </button>
          )}
        </div>

        {hasQuery && suggestions.length > 0 && (
          <div className="hide-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQ(s, true)}
                className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-fg-2 transition duration-150 hover:border-white/25 hover:text-fg active:scale-95", focused && "animate-fade-in")}
              >
                <SearchIcon className="size-3.5" /> {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!ready ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <ListSkeleton rows={3} />
        </div>
      ) : !hasQuery ? (
        <>
          {lib.recentSearches.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="t-section">Recent searches</h2>
                <button type="button" onClick={lib.clearRecentSearches} className="t-meta font-semibold hover:text-fg">Clear all</button>
              </div>
              <ul className="max-w-xl">
                {lib.recentSearches.map((r) => (
                  <li key={r} className="group flex h-12 items-center rounded-lg transition hover:bg-white/[0.06]">
                    <button type="button" onClick={() => setQ(r)} className="flex h-full min-w-0 flex-1 items-center gap-3 px-2 text-left">
                      <Clock className="size-[18px] shrink-0 text-fg-3" />
                      <span className="truncate text-[15px]">{r}</span>
                    </button>
                    <button type="button" aria-label={`Remove ${r}`} onClick={() => lib.removeRecentSearch(r)} className="flex size-10 items-center justify-center rounded-full text-fg-3 transition hover:text-fg active:scale-90">
                      <X className="size-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="t-section mb-3">Browse all</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setQ(c.query, true)}
                  className="group relative h-24 overflow-hidden rounded-xl p-3.5 text-left transition duration-200 active:scale-[0.97] md:h-28"
                  style={{ background: `linear-gradient(135deg, ${c.color}, color-mix(in srgb, ${c.color} 55%, #000))` }}
                >
                  <span className="text-[17px] font-bold tracking-tight">{c.name}</span>
                  <Artwork
                    art={{ palette: ["#ffffff", c.color, "#000000"], pattern: c.pattern, seed: 3 }}
                    className="absolute -bottom-2 -right-3 size-16 rotate-[22deg] opacity-90 shadow-lg shadow-black/40 transition duration-300 group-hover:rotate-[16deg] group-hover:scale-105 md:size-20"
                  />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : total === 0 ? (
        <EmptyState title={`No results for “${q}”`} body="Check the spelling, or try a different artist, song or genre." />
      ) : (
        <div className="space-y-8">
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Result type">
            {FILTERS.map((f) => (
              <Chip key={f.id} role="tab" aria-selected={filter === f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>

          <Results filter={filter} results={results} onPlayTrack={playTrack} onNavigateAdd={() => lib.addRecentSearch(q)} artistName={(id) => artistById.get(id)?.name ?? ""} notify={ui.notify} />
        </div>
      )}
    </div>
  );
}

interface ResultsProps {
  filter: Filter;
  results: { tracks: Track[]; artists: Artist[]; albums: Album[]; videos: Video[]; playlists: Playlist[] };
  onPlayTrack: (list: Track[], i: number) => void;
  onNavigateAdd: () => void;
  artistName: (id: string) => string;
  notify: (m: string) => void;
}

function Results({ filter, results, onPlayTrack, onNavigateAdd, artistName, notify }: ResultsProps) {
  const player = usePlayer();
  const { data } = useCatalogue();
  const show = (f: Filter) => filter === "all" || filter === f;
  const playArtist = (a: Artist) => player.playTracks(data.tracks.filter((t) => t.artistId === a.id).map((t) => t.id), 0, { label: a.name });
  const playPlaylist = (p: Playlist) => player.playTracks(p.items.map((i) => i.trackId), 0, { label: p.name });

  // Top result: prefer an artist, otherwise the first song / album.
  type Top = { kind: "artist"; item: Artist } | { kind: "track"; item: Track } | { kind: "album"; item: Album };
  const top: Top | null =
    filter !== "all" ? null
    : results.artists[0] ? { kind: "artist", item: results.artists[0] }
    : results.tracks[0] ? { kind: "track", item: results.tracks[0] }
    : results.albums[0] ? { kind: "album", item: results.albums[0] }
    : null;
  const topTitle = top ? (top.kind === "artist" ? top.item.name : top.item.title) : "";
  const topLabel = !top ? "" : top.kind === "artist" ? "Artist" : `${top.kind === "track" ? "Song" : "Album"} · ${artistName(top.item.artistId)}`;
  const playTop = () => {
    if (!top) return;
    onNavigateAdd();
    if (top.kind === "artist") playArtist(top.item);
    else if (top.kind === "track") onPlayTrack([top.item], 0);
    else player.playTracks(top.item.trackIds, 0, { label: top.item.title });
  };

  return (
    <>
      {filter === "all" && (top || results.tracks.length > 0) && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {top && (
            <section>
              <h2 className="t-section mb-3">Top result</h2>
              <div className="group relative rounded-xl bg-surface p-5 transition duration-200 hover:bg-surface-hover">
                <Artwork art={top.item.art} circle={top.kind === "artist"} className="size-24 shadow-xl shadow-black/50" />
                <p className="mt-5 truncate text-[28px] font-bold leading-8 tracking-tight">{topTitle}</p>
                <p className="t-meta mt-1">{topLabel}</p>
                <div className="absolute bottom-5 right-5 opacity-100 transition duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  <PlayFab size="md" onClick={playTop} />
                </div>
              </div>
            </section>
          )}
          {results.tracks.length > 0 && (
            <section className="min-w-0">
              <h2 className="t-section mb-2">Songs</h2>
              {results.tracks.slice(0, 4).map((t, i) => (
                <TrackRow key={t.id} track={t} onPlay={() => onPlayTrack(results.tracks, i)} />
              ))}
            </section>
          )}
        </div>
      )}

      {filter === "songs" && (
        <section>
          {results.tracks.length === 0 && <p className="t-meta">No songs found.</p>}
          {results.tracks.map((t, i) => <TrackRow key={t.id} track={t} showAlbum onPlay={() => onPlayTrack(results.tracks, i)} />)}
        </section>
      )}

      {show("artists") && results.artists.length > 0 && (
        <Shelf title="Artists">
          {results.artists.map((a) => (
            <ArtistCard key={a.id} to={`/artist/${a.id}`} art={a.art} title={a.name} subtitle={a.genre} onPlay={() => playArtist(a)} />
          ))}
        </Shelf>
      )}
      {show("albums") && results.albums.length > 0 && (
        <Shelf title="Albums">
          {results.albums.map((a) => (
            <MediaCard key={a.id} to={`/album/${a.id}`} art={a.art} title={a.title} subtitle={`${a.year} · ${artistName(a.artistId)}`} onPlay={() => player.playTracks(a.trackIds, 0, { label: a.title })} />
          ))}
        </Shelf>
      )}
      {show("videos") && results.videos.length > 0 && (
        <Shelf title="Videos">
          {results.videos.map((v) => (
            <VideoCard key={v.id} art={v.art} title={v.title} subtitle={artistName(v.artistId)} duration={v.duration}
              onClick={() => (player.playTracks([v.trackId], 0, { label: v.title }), notify("Video streaming isn't connected yet — playing audio"))} />
          ))}
        </Shelf>
      )}
      {show("playlists") && results.playlists.length > 0 && (
        <Shelf title="Playlists">
          {results.playlists.map((p) => (
            <MediaCard key={p.id} to={`/playlist/${p.id}`} art={p.art} title={p.name} subtitle={p.description || `${p.items.length} songs`} onPlay={() => playPlaylist(p)} />
          ))}
        </Shelf>
      )}
      {filter !== "all" && filter !== "songs" && results[filter].length === 0 && <p className="t-meta">Nothing in this category.</p>}
    </>
  );
}
