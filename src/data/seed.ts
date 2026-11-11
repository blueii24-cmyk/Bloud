/** SAMPLE USER LIBRARY — first-run state for the demo. Persisted locally after that. */
import type { ArtSpec, LibraryState, Playlist, PlaylistItem, UserId } from "../types";
import { trackIdOf } from "./catalogue";

const day = 86_400_000;
const base = Date.parse("2025-05-01");

const items = (refs: string[], adders: UserId[] = ["me"]): PlaylistItem[] =>
  refs.map((r, i) => {
    const [albumId, n] = r.split(":");
    return { trackId: trackIdOf(albumId, Number(n)), addedBy: adders[i % adders.length], addedAt: base - i * day };
  });

const spec = (palette: ArtSpec["palette"], pattern: ArtSpec["pattern"], seed: number): ArtSpec => ({ palette, pattern, seed });

const playlists: Playlist[] = [
  {
    id: "pl-our-songs", name: "Our Songs", description: "Everything that's ours. Add anything that reminds you of the other.",
    ownerId: "me", collaborative: true, kind: "user", createdAt: base - 90 * day, updatedAt: base - 1 * day,
    art: spec(["#ff8fb1", "#3a0f2e", "#4fe3a1"], "orbit", 8),
    items: items(["midnight-parade:1", "velvet-static:2", "salt-and-cedar:1", "afterglow-theory:3", "fleur-de-minuit:3", "satellite-hearts:1", "blue-hour:1", "northern-lines:2", "chrome-horizon:2"], ["me", "partner"]),
  },
  {
    id: "pl-sunday-kitchen", name: "Sunday Kitchen", description: "Slow mornings, coffee and something in the oven.",
    ownerId: "partner", collaborative: true, kind: "user", createdAt: base - 60 * day, updatedAt: base - 4 * day,
    art: spec(["#e8b86b", "#3a2412", "#f4efe1"], "sun", 4),
    items: items(["salt-and-cedar:2", "salt-and-cedar:5", "fleur-de-minuit:2", "quiet-rooms:3", "blue-hour:2", "northern-lines:3", "fleur-de-minuit:4"], ["partner", "me", "partner"]),
  },
  {
    id: "pl-late-night", name: "Late Night Drive", description: "Headlights, empty roads, volume up.",
    ownerId: "me", collaborative: false, kind: "user", createdAt: base - 120 * day, updatedAt: base - 9 * day,
    art: spec(["#ff2e93", "#14062e", "#00e5ff"], "grid", 6),
    items: items(["chrome-horizon:1", "chrome-horizon:2", "low-tide-signals:1", "velvet-static:1", "afterglow-theory:4", "lowlight-tapes:4", "chrome-horizon:4", "low-tide-signals:3"]),
  },
  {
    id: "pl-deep-focus", name: "Deep Focus", description: "Nothing to sing along to. Just room to think.",
    ownerId: "me", collaborative: false, kind: "user", createdAt: base - 200 * day, updatedAt: base - 20 * day,
    art: spec(["#9fb7c9", "#0f1820", "#e9e2d0"], "rings", 2),
    items: items(["quiet-rooms:1", "quiet-rooms:2", "quiet-rooms:3", "quiet-rooms:4", "low-tide-signals:3", "low-tide-signals:4"]),
  },
];

export const seedLibrary: LibraryState = {
  likedIds: [
    ["midnight-parade", 1], ["velvet-static", 2], ["satellite-hearts", 1], ["chrome-horizon", 2],
    ["salt-and-cedar", 1], ["afterglow-theory", 3], ["low-tide-signals", 1], ["fleur-de-minuit", 3],
    ["northern-lines", 1], ["lowlight-tapes", 2], ["blue-hour", 2], ["quiet-rooms", 1],
  ].map(([a, n]) => trackIdOf(a as string, n as number)),
  savedAlbumIds: ["midnight-parade", "velvet-static", "salt-and-cedar", "chrome-horizon", "satellite-hearts", "quiet-rooms"],
  followedArtistIds: ["mira-calder", "vesper-lane", "juno-and-the-tides", "hollow-atlas", "noor-valen", "static-orchard", "koji-aurel"],
  playlists,
  recentSearches: ["Mira Calder", "late night", "folk"],
  playHistory: [
    ["afterglow-theory", 2], ["midnight-parade", 3], ["velvet-static", 1], ["salt-and-cedar", 3],
    ["chrome-horizon", 1], ["satellite-hearts", 2], ["fleur-de-minuit", 1], ["low-tide-signals", 2],
  ].map(([a, n]) => trackIdOf(a as string, n as number)),
};
