import type { LibraryState, Playlist } from "../types";

function addLocalSetChanges(base: string[], local: string[], remote: string[]): string[] {
  const baseSet = new Set(base);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  for (const value of baseSet) if (!localSet.has(value)) remoteSet.delete(value);
  for (const value of localSet) if (!baseSet.has(value)) remoteSet.add(value);
  return [...remoteSet];
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameMetadata(left: Playlist, right: Playlist): boolean {
  return left.name === right.name
    && left.description === right.description
    && left.collaborative === right.collaborative
    && left.ownerUserId === right.ownerUserId
    && left.workspaceId === right.workspaceId
    && JSON.stringify(left.art) === JSON.stringify(right.art);
}

function mergePlaylist(base: Playlist, local: Playlist, remote: Playlist): Playlist {
  const baseIds = base.items.map((item) => item.trackId);
  const localIds = local.items.map((item) => item.trackId);
  const remoteItems = new Map(remote.items.map((item) => [item.trackId, item]));
  const baseSet = new Set(baseIds);
  const localSet = new Set(localIds);

  // Apply only this device's item additions/removals to the freshest remote list.
  for (const id of baseSet) if (!localSet.has(id)) remoteItems.delete(id);
  for (const [position, item] of local.items.entries()) {
    if (!baseSet.has(item.trackId) && !remoteItems.has(item.trackId)) {
      remoteItems.set(item.trackId, { ...item, position });
    }
  }

  let items = [...remoteItems.values()];
  if (!sameIds(baseIds, localIds)) {
    const localOrder = new Map(localIds.map((id, index) => [id, index]));
    items = items.sort((a, b) => {
      const aLocal = localOrder.get(a.trackId);
      const bLocal = localOrder.get(b.trackId);
      if (aLocal !== undefined && bLocal !== undefined) return aLocal - bLocal;
      if (aLocal !== undefined) return -1;
      if (bLocal !== undefined) return 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }
  items = items.map((item, position) => ({ ...item, position }));

  return {
    ...remote,
    ...(sameMetadata(base, local) ? {} : {
      name: local.name,
      description: local.description,
      collaborative: local.collaborative,
      art: local.art,
      workspaceId: local.workspaceId,
    }),
    updatedAt: Math.max(remote.updatedAt, local.updatedAt),
    items,
  };
}

/** Rebase offline edits made during initial hydration on the latest remote snapshot. */
export function mergeLibraryChanges(base: LibraryState, local: LibraryState, remote: LibraryState, userId: string): LibraryState {
  const baseById = new Map(base.playlists.map((playlist) => [playlist.id, playlist]));
  const localById = new Map(local.playlists.map((playlist) => [playlist.id, playlist]));
  const remoteById = new Map(remote.playlists.map((playlist) => [playlist.id, playlist]));

  for (const [id, basePlaylist] of baseById) {
    const localPlaylist = localById.get(id);
    const remotePlaylist = remoteById.get(id);
    if (!localPlaylist) {
      if (basePlaylist.ownerUserId === userId) remoteById.delete(id);
      continue;
    }
    if (!remotePlaylist) {
      // A remote deletion wins unless this account owns the row and made a
      // concurrent local edit against its cached copy.
      if (basePlaylist.ownerUserId === userId
        && (!sameMetadata(basePlaylist, localPlaylist)
          || !sameIds(basePlaylist.items.map((item) => item.trackId), localPlaylist.items.map((item) => item.trackId)))) {
        remoteById.set(id, localPlaylist);
      }
      continue;
    }
    remoteById.set(id, mergePlaylist(basePlaylist, localPlaylist, remotePlaylist));
  }

  for (const [id, playlist] of localById) {
    if (!baseById.has(id)) remoteById.set(id, playlist);
  }

  const playlists = [...remoteById.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const recentSearches = addLocalSetChanges(base.recentSearches, local.recentSearches, remote.recentSearches);
  const playHistory = addLocalSetChanges(base.playHistory, local.playHistory, remote.playHistory);

  return {
    likedIds: addLocalSetChanges(base.likedIds, local.likedIds, remote.likedIds),
    savedAlbumIds: addLocalSetChanges(base.savedAlbumIds, local.savedAlbumIds, remote.savedAlbumIds),
    followedArtistIds: addLocalSetChanges(base.followedArtistIds, local.followedArtistIds, remote.followedArtistIds),
    playlists,
    recentSearches: recentSearches.slice(0, 8),
    playHistory: playHistory.slice(0, 30),
  };
}
