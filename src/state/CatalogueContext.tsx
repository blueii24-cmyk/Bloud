import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { catalogueData } from "../data/catalogue";
import { catalogueService } from "../services";
import type { Album, Artist, Catalogue, Track, Video } from "../types";

interface CatalogueValue {
  ready: boolean;
  data: Catalogue;
  trackById: Map<string, Track>;
  albumById: Map<string, Album>;
  artistById: Map<string, Artist>;
  videoById: Map<string, Video>;
}

const empty: Catalogue = {
  users: catalogueData.users,
  tracks: [], albums: [], artists: [], videos: [], mixes: [], categories: [], continueListening: [], lyrics: [],
};

const Ctx = createContext<CatalogueValue>(null!);

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Catalogue | null>(null);

  useEffect(() => {
    let alive = true;
    catalogueService
      .load()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(catalogueData));
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<CatalogueValue>(() => {
    const d = data ?? empty;
    return {
      ready: !!data,
      data: d,
      trackById: new Map(d.tracks.map((t) => [t.id, t])),
      albumById: new Map(d.albums.map((a) => [a.id, a])),
      artistById: new Map(d.artists.map((a) => [a.id, a])),
      videoById: new Map(d.videos.map((v) => [v.id, v])),
    };
  }, [data]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalogue = () => useContext(Ctx);
