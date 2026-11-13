/** Domain types. Shapes intentionally mirror what a Supabase schema would return. */

export type UserId = "me" | "partner";

export interface User {
  id: UserId;
  name: string;
  initials: string;
  /** gradient pair used for the avatar */
  colors: [string, string];
}

export type ArtPattern = "sun" | "rings" | "stripes" | "waves" | "grid" | "split" | "orbit" | "dunes";

/** Original generative artwork description. Replace with `imageUrl` once real covers exist. */
export interface ArtSpec {
  palette: [string, string, string];
  pattern: ArtPattern;
  seed: number;
  imageUrl?: string;
}

export interface Artist {
  id: string;
  name: string;
  genre: string;
  bio: string;
  monthlyListeners: number;
  art: ArtSpec;
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  year: number;
  genre: string;
  art: ArtSpec;
  addedAt: string;
  trackIds: string[];
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  duration: number; // seconds
  genre: string;
  art: ArtSpec;
  addedAt: string;
  lyricSet: number | null;
  explicit?: boolean;
  /** Optional playable media source supplied by the catalogue backend. */
  audioUrl?: string;
}

export interface Video {
  id: string;
  title: string;
  artistId: string;
  trackId: string;
  duration: number;
  year: number;
  views: string;
  art: ArtSpec;
}

export interface PlaylistItem {
  trackId: string;
  addedBy: UserId;
  addedAt: number;
  position?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  ownerId: UserId | "tandem";
  /** Verified Auth UUID, present on account-owned playlists (never from legacy `me` rows). */
  ownerUserId?: string | null;
  /** Workspace that grants collaborative access; RLS remains the authority. */
  workspaceId?: string | null;
  collaborative: boolean;
  kind: "user" | "mix";
  items: PlaylistItem[];
  art: ArtSpec;
  createdAt: number;
  updatedAt: number;
}

export interface QueueItem {
  uid: string;
  trackId: string;
  addedBy: UserId;
}

export interface Category {
  id: string;
  name: string;
  query: string;
  color: string;
  pattern: ArtPattern;
}

export interface ContinueItem {
  type: "track" | "album";
  id: string;
  /** seconds already listened (tracks) or number of tracks finished (albums) */
  position: number;
}

export interface Catalogue {
  users: Record<UserId, User>;
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  videos: Video[];
  mixes: Playlist[];
  categories: Category[];
  continueListening: ContinueItem[];
  lyrics: string[][];
}

export interface LibraryState {
  likedIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  playlists: Playlist[];
  recentSearches: string[];
  /** track ids, most recent first */
  playHistory: string[];
}

export type RepeatMode = "off" | "all" | "one";
