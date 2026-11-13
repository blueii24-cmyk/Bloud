import { useContext, createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { catalogueData } from "../data/catalogue";
import { catalogueService } from "../services";
import { isSupabaseConfigured } from "../lib/supabase";
import type { Album, Artist, Catalogue, Track, Video } from "../types";
import { useAuth } from "./AuthContext";
import { useWorkspace } from "./WorkspaceContext";

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

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "P";
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const workspace = useWorkspace();
  const scopeKey = auth.status === "authed" && auth.user
    ? `account:${auth.user.id}`
    : auth.walled ? "signed-out" : "offline-demo";
  const [slot, setSlot] = useState<{ scopeKey: string; data: Catalogue | null }>(() => ({ scopeKey, data: null }));
  const data = slot.scopeKey === scopeKey ? slot.data : null;

  useEffect(() => {
    if (auth.status === "loading") return;
    let alive = true;
    setSlot({ scopeKey, data: null });

    // The offline/demo catalogue remains available only when Supabase is not
    // configured. A signed-out cloud session never receives demo library state.
    if (isSupabaseConfigured && auth.status !== "authed") {
      setSlot({ scopeKey, data: { ...catalogueData, continueListening: [] } });
      return () => { alive = false; };
    }

    catalogueService
      .load()
      .then((catalogue) => alive && setSlot({ scopeKey, data: catalogue }))
      .catch(() => alive && setSlot({ scopeKey, data: isSupabaseConfigured ? { ...catalogueData, continueListening: [] } : catalogueData }));
    return () => {
      alive = false;
    };
  }, [auth.status, auth.user?.id, scopeKey]);

  const value = useMemo<CatalogueValue>(() => {
    const base = data ?? empty;
    let users = base.users;
    if (auth.status === "authed" && auth.user) {
      const partnerName = workspace.partner?.displayName || "Partner";
      users = {
        ...base.users,
        me: { ...base.users.me, name: auth.user.name, initials: initials(auth.user.name) },
        partner: { ...base.users.partner, name: partnerName, initials: initials(partnerName) },
      };
    }
    const d = users === base.users ? base : { ...base, users };
    return {
      ready: !!data,
      data: d,
      trackById: new Map(d.tracks.map((t) => [t.id, t])),
      albumById: new Map(d.albums.map((a) => [a.id, a])),
      artistById: new Map(d.artists.map((a) => [a.id, a])),
      videoById: new Map(d.videos.map((v) => [v.id, v])),
    };
  }, [data, auth.status, auth.user?.name, workspace.partner?.displayName]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalogue = () => useContext(Ctx);
