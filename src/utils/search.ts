import type { Album, Artist, Catalogue, Playlist, Track, Video } from "../types";

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  videos: Video[];
  playlists: Playlist[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** 3 = prefix match, 2 = word prefix, 1 = substring, 0 = none. All tokens must match. */
function score(haystacks: string[], tokens: string[]): number {
  let total = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const h of haystacks) {
      const n = norm(h);
      if (n.startsWith(tok)) best = Math.max(best, 3);
      else if (n.split(/[\s\-&]+/).some((w) => w.startsWith(tok))) best = Math.max(best, 2);
      else if (n.includes(tok)) best = Math.max(best, 1);
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

function rank<T>(items: T[], haystack: (i: T) => string[], tokens: string[], limit = 50): T[] {
  return items
    .map((item) => ({ item, s: score(haystack(item), tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.item);
}

export function searchCatalogue(cat: Catalogue, playlists: Playlist[], query: string): SearchResults {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { tracks: [], artists: [], albums: [], videos: [], playlists: [] };
  const artistName = (id: string) => cat.artists.find((a) => a.id === id)?.name ?? "";
  const albumTitle = (id: string) => cat.albums.find((a) => a.id === id)?.title ?? "";

  return {
    tracks: rank(cat.tracks, (t) => [t.title, artistName(t.artistId), albumTitle(t.albumId), t.genre], tokens),
    artists: rank(cat.artists, (a) => [a.name, a.genre], tokens),
    albums: rank(cat.albums, (a) => [a.title, artistName(a.artistId), a.genre], tokens),
    videos: rank(cat.videos, (v) => [v.title, artistName(v.artistId)], tokens),
    playlists: rank(playlists, (p) => [p.name, p.description], tokens),
  };
}

/** Short list of completion strings for the suggestion row. */
export function suggest(cat: Catalogue, query: string, limit = 4): string[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const pool = [
    ...cat.artists.map((a) => a.name),
    ...cat.albums.map((a) => a.title),
    ...cat.tracks.map((t) => t.title),
  ];
  const seen = new Set<string>();
  return rank(pool, (s) => [s], tokens, 20)
    .filter((s) => norm(s) !== norm(query) && !seen.has(s) && !!seen.add(s))
    .slice(0, limit);
}
