/**
 * SAMPLE CATALOGUE — fictional artists, albums and tracks with generative artwork.
 * This file is the only place sample music lives. Swap `services/catalogue.ts`
 * to a Supabase / Google Drive implementation and nothing in the UI changes.
 */
import type { Album, ArtPattern, Artist, ArtSpec, Catalogue, Category, Playlist, Track, Video } from "../types";
import { LYRICS } from "./lyrics";

type P = [string, string, string];
const art = (palette: P, pattern: ArtPattern, seed: number): ArtSpec => ({ palette, pattern, seed });

const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface AlbumDef {
  id: string;
  title: string;
  artistId: string;
  year: number;
  genre: string;
  palette: P;
  pattern: ArtPattern;
  addedAt: string;
  lyricSet: number | null;
  tracks: [string, number][];
}

const ARTISTS: Artist[] = [
  { id: "mira-calder", name: "Mira Calder", genre: "Dream pop", monthlyListeners: 2_418_903, bio: "Hushed vocals and hazy synths from a bedroom studio above a bakery.", art: art(["#ff5f8d", "#3b1a6b", "#ffb36b"], "orbit", 3) },
  { id: "hollow-atlas", name: "Hollow Atlas", genre: "Electronic", monthlyListeners: 1_204_551, bio: "Two producers mapping coastlines in pulses and long reverb tails.", art: art(["#2de2e6", "#0a2a5e", "#8a5bff"], "rings", 5) },
  { id: "juno-and-the-tides", name: "Juno & the Tides", genre: "Folk", monthlyListeners: 893_240, bio: "Fingerpicked guitars, harbour towns and four-part harmonies.", art: art(["#e8b86b", "#2e4a3a", "#d9693f"], "sun", 2) },
  { id: "vesper-lane", name: "Vesper Lane", genre: "R&B", monthlyListeners: 3_102_776, bio: "Late-night R&B built from voicemails, vinyl crackle and slow bass.", art: art(["#a855f7", "#1b1030", "#f472b6"], "waves", 4) },
  { id: "koji-aurel", name: "Kōji Aurel", genre: "Ambient", monthlyListeners: 540_118, bio: "Patient, room-sized ambient pieces for reading and rain.", art: art(["#9fb7c9", "#1d2a35", "#e9e2d0"], "dunes", 1) },
  { id: "paper-satellites", name: "The Paper Satellites", genre: "Indie rock", monthlyListeners: 1_776_340, bio: "Four friends, one van, and choruses made for open windows.", art: art(["#ffd23f", "#c0392b", "#1a1a1a"], "split", 6) },
  { id: "noor-valen", name: "Noor Valen", genre: "Alt pop", monthlyListeners: 4_020_912, bio: "Glossy hooks with a restless heart.", art: art(["#ff7a45", "#7a1f5c", "#ffd1a1"], "sun", 5) },
  { id: "static-orchard", name: "Static Orchard", genre: "Synthwave", monthlyListeners: 962_004, bio: "Analogue arpeggios and chrome-plated nostalgia.", art: art(["#ff2e93", "#2b0f5c", "#00e5ff"], "grid", 2) },
  { id: "lune-ardent", name: "Lune Ardent", genre: "Pop", monthlyListeners: 1_330_421, bio: "Soft-focus chanson-pop, sung at the edge of sleep.", art: art(["#f7c6d9", "#5b2a4a", "#fff0c2"], "orbit", 1) },
  { id: "dax-meridian", name: "Dax Meridian", genre: "Hip-hop", monthlyListeners: 2_240_876, bio: "Lo-fi boom-bap diary entries from the night bus.", art: art(["#ff9f1c", "#1b1b1b", "#2ec4b6"], "stripes", 3) },
];

const ALBUM_DEFS: AlbumDef[] = [
  { id: "afterglow-theory", title: "Afterglow Theory", artistId: "noor-valen", year: 2025, genre: "Alt pop", palette: ["#ff7a45", "#7a1f5c", "#ffd1a1"], pattern: "split", addedAt: "2025-05-02", lyricSet: 0, tracks: [["Afterglow Theory", 199], ["Second Skin", 214], ["Gold Hour", 227], ["Flicker", 184]] },
  { id: "midnight-parade", title: "Midnight Parade", artistId: "mira-calder", year: 2024, genre: "Dream pop", palette: ["#ff5f8d", "#3b1a6b", "#ffb36b"], pattern: "sun", addedAt: "2025-04-18", lyricSet: 0, tracks: [["Neon Orchard", 212], ["Midnight Parade", 198], ["Slow Fireworks", 241], ["Glass Hour", 187], ["Paper Moons", 226]] },
  { id: "velvet-static", title: "Velvet Static", artistId: "vesper-lane", year: 2024, genre: "R&B", palette: ["#a855f7", "#1b1030", "#f472b6"], pattern: "orbit", addedAt: "2025-04-02", lyricSet: 1, tracks: [["Velvet Static", 208], ["Stay Till Morning", 236], ["Honey Weather", 192], ["2 AM Voicemail", 215]] },
  { id: "low-tide-signals", title: "Low Tide Signals", artistId: "hollow-atlas", year: 2023, genre: "Electronic", palette: ["#2de2e6", "#0a2a5e", "#8a5bff"], pattern: "waves", addedAt: "2025-03-21", lyricSet: 2, tracks: [["Low Tide", 263], ["Signal Fade", 221], ["Cartographer", 284], ["Afterimage", 207]] },
  { id: "lowlight-tapes", title: "Lowlight Tapes", artistId: "dax-meridian", year: 2024, genre: "Hip-hop", palette: ["#ff9f1c", "#1b1b1b", "#2ec4b6"], pattern: "stripes", addedAt: "2025-03-09", lyricSet: 3, tracks: [["Lowlight", 171], ["Corner Store Poetry", 198], ["Metro Hum", 186], ["Late Bus Home", 209]] },
  { id: "northern-lines", title: "Northern Lines", artistId: "juno-and-the-tides", year: 2024, genre: "Folk", palette: ["#7fb5ff", "#0e2038", "#e6f0ff"], pattern: "waves", addedAt: "2025-02-24", lyricSet: 4, tracks: [["Northern Lines", 221], ["Frostbite Letters", 199], ["Cabin Radio", 208]] },
  { id: "chrome-horizon", title: "Chrome Horizon", artistId: "static-orchard", year: 2022, genre: "Synthwave", palette: ["#ff2e93", "#2b0f5c", "#00e5ff"], pattern: "grid", addedAt: "2025-02-11", lyricSet: 2, tracks: [["Chrome Horizon", 245], ["Night Drive 84", 232], ["Laser Garden", 218], ["Rewind City", 256]] },
  { id: "satellite-hearts", title: "Satellite Hearts", artistId: "paper-satellites", year: 2023, genre: "Indie rock", palette: ["#ffd23f", "#c0392b", "#1a1a1a"], pattern: "split", addedAt: "2025-01-30", lyricSet: 3, tracks: [["Satellite Hearts", 203], ["Backseat Constellations", 189], ["Run It Back", 217], ["Sundial", 196], ["Loose Change", 181]] },
  { id: "salt-and-cedar", title: "Salt & Cedar", artistId: "juno-and-the-tides", year: 2022, genre: "Folk", palette: ["#e8b86b", "#2e4a3a", "#d9693f"], pattern: "dunes", addedAt: "2025-01-12", lyricSet: 4, tracks: [["Salt & Cedar", 195], ["Harbor Lights", 218], ["The Long Way Round", 232], ["Kindling", 176], ["Tidewater", 204]] },
  { id: "fleur-de-minuit", title: "Fleur de Minuit", artistId: "lune-ardent", year: 2023, genre: "Pop", palette: ["#f7c6d9", "#5b2a4a", "#fff0c2"], pattern: "rings", addedAt: "2024-12-20", lyricSet: 0, tracks: [["Fleur de Minuit", 190], ["Soleil Bleu", 205], ["Danse Lente", 222], ["Petit Matin", 178]] },
  { id: "blue-hour", title: "Blue Hour", artistId: "mira-calder", year: 2022, genre: "Dream pop", palette: ["#4f7cff", "#0d1440", "#9ee7ff"], pattern: "rings", addedAt: "2024-11-30", lyricSet: 1, tracks: [["Blue Hour", 213], ["Window Seat", 231], ["Paper Moons (Acoustic)", 205]] },
  { id: "quiet-rooms", title: "Quiet Rooms", artistId: "koji-aurel", year: 2021, genre: "Ambient", palette: ["#9fb7c9", "#1d2a35", "#e9e2d0"], pattern: "dunes", addedAt: "2024-11-02", lyricSet: null, tracks: [["Quiet Rooms I", 312], ["Quiet Rooms II", 287], ["Paper Lanterns", 344], ["Snowfall in August", 301]] },
];

const albums: Album[] = [];
const tracks: Track[] = [];

for (const def of ALBUM_DEFS) {
  const spec = art(def.palette, def.pattern, def.title.length);
  const trackIds: string[] = [];
  def.tracks.forEach(([title, duration], i) => {
    const id = `${def.id}-${i + 1}-${slug(title).slice(0, 18)}`;
    trackIds.push(id);
    tracks.push({
      id, title, duration, albumId: def.id, artistId: def.artistId, genre: def.genre,
      art: spec, addedAt: def.addedAt, lyricSet: def.lyricSet, explicit: def.id === "lowlight-tapes" && i % 2 === 1,
    });
  });
  albums.push({ id: def.id, title: def.title, artistId: def.artistId, year: def.year, genre: def.genre, art: spec, addedAt: def.addedAt, trackIds });
}

const trackOf = (albumId: string, n: number) => albums.find((a) => a.id === albumId)!.trackIds[n - 1];

const VIDEOS: [string, string, string, number, string][] = [
  ["Neon Orchard (Official Video)", "midnight-parade", "1", 2024, "4.2M"],
  ["Low Tide — Live at the Boathouse", "low-tide-signals", "1", 2023, "1.1M"],
  ["Satellite Hearts (Official Video)", "satellite-hearts", "1", 2023, "2.8M"],
  ["Velvet Static (Visualiser)", "velvet-static", "1", 2024, "6.5M"],
  ["Chrome Horizon (Official Video)", "chrome-horizon", "1", 2022, "980K"],
  ["Gold Hour — Studio Session", "afterglow-theory", "3", 2025, "3.4M"],
];

const videos: Video[] = VIDEOS.map(([title, albumId, n, year, views]) => {
  const album = albums.find((a) => a.id === albumId)!;
  const trackId = trackOf(albumId, Number(n));
  const track = tracks.find((t) => t.id === trackId)!;
  return {
    id: `v-${slug(title).slice(0, 24)}`, title, artistId: album.artistId, trackId,
    duration: track.duration + 14, year, views, art: { ...album.art, seed: album.art.seed + 3 },
  };
});

const categories: Category[] = [
  { id: "pop", name: "Pop", query: "pop", color: "#c2185b", pattern: "sun" },
  { id: "electronic", name: "Electronic", query: "electronic", color: "#0e7490", pattern: "waves" },
  { id: "folk", name: "Folk", query: "folk", color: "#9a6b2f", pattern: "dunes" },
  { id: "rnb", name: "R&B", query: "r&b", color: "#6d28d9", pattern: "orbit" },
  { id: "ambient", name: "Ambient", query: "ambient", color: "#47657a", pattern: "rings" },
  { id: "rock", name: "Rock", query: "rock", color: "#b4361f", pattern: "stripes" },
  { id: "hiphop", name: "Hip-hop", query: "hip-hop", color: "#a15c00", pattern: "split" },
  { id: "synthwave", name: "Synthwave", query: "synthwave", color: "#a21caf", pattern: "grid" },
];

/** Build a Tandem-curated mix from "albumId:trackNumber" references. */
function mix(id: string, name: string, description: string, refs: string[], spec: ArtSpec): Playlist {
  const stamp = Date.parse("2025-05-01");
  return {
    id, name, description, ownerId: "tandem", collaborative: false, kind: "mix", art: spec,
    createdAt: stamp, updatedAt: stamp,
    items: refs.map((r, i) => {
      const [albumId, n] = r.split(":");
      return { trackId: trackOf(albumId, Number(n)), addedBy: "me" as const, addedAt: stamp + i };
    }),
  };
}

export const catalogueData: Catalogue = {
  users: {
    me: { id: "me", name: "Alex", initials: "A", colors: ["#4fe3a1", "#1a8f68"] },
    partner: { id: "partner", name: "Sam", initials: "S", colors: ["#ff8fb1", "#b43d78"] },
  },
  tracks,
  albums,
  artists: ARTISTS,
  videos,
  categories,
  mixes: [
    mix("mix-evening", "Evening Mix", "Mellow picks for the last light of the day, tuned to what you both replay.", ["midnight-parade:1", "blue-hour:2", "fleur-de-minuit:3", "velvet-static:3", "salt-and-cedar:2", "quiet-rooms:1", "northern-lines:1", "afterglow-theory:3"], art(["#ff8a5c", "#2a1250", "#ffd29a"], "sun", 11)),
    mix("mix-weekend", "Weekend Mix", "Open windows, louder choruses.", ["satellite-hearts:1", "afterglow-theory:1", "satellite-hearts:3", "lowlight-tapes:2", "midnight-parade:2", "chrome-horizon:2"], art(["#ffd23f", "#8a1c1c", "#ff7a45"], "stripes", 7)),
    mix("mix-duet", "Duet Discovery", "New for both of you — songs one of you loves that the other hasn't heard yet.", ["low-tide-signals:3", "chrome-horizon:3", "fleur-de-minuit:1", "velvet-static:2", "lowlight-tapes:3", "northern-lines:3", "salt-and-cedar:4"], art(["#2de2e6", "#1b0f4a", "#f472b6"], "orbit", 5)),
  ],
  continueListening: [
    { type: "track", id: albums[3].trackIds[2], position: 96 },
    { type: "album", id: "salt-and-cedar", position: 2 },
    { type: "track", id: albums[1].trackIds[2], position: 143 },
    { type: "album", id: "quiet-rooms", position: 1 },
  ],
  lyrics: LYRICS,
};

export const trackIdOf = (albumId: string, n: number) => trackOf(albumId, n);
