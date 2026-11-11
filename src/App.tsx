import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { CatalogueProvider } from "./state/CatalogueContext";
import { LibraryProvider } from "./state/LibraryContext";
import { PlayerProvider } from "./state/PlayerContext";
import { UIProvider } from "./state/UIContext";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Search from "./pages/Search";
import Together from "./pages/Together";
import DriveMusic from "./pages/DriveMusic";
import { AlbumPage, ArtistPage, LikedPage, PlaylistPage } from "./pages/Collections";

/**
 * Tandem — private music for two.
 * Data flows: services/ (swappable backends) → state/ (contexts) → pages/ + components/.
 * HashRouter keeps the single-file production build working from any static host.
 */
export default function App() {
  return (
    <UIProvider>
      <CatalogueProvider>
        <LibraryProvider>
          <PlayerProvider>
            <HashRouter>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Home />} />
                  <Route path="search" element={<Search />} />
                  <Route path="library" element={<Library />} />
                  <Route path="liked" element={<LikedPage />} />
                  <Route path="playlist/:id" element={<PlaylistPage />} />
                  <Route path="album/:id" element={<AlbumPage />} />
                  <Route path="artist/:id" element={<ArtistPage />} />
                  <Route path="together" element={<Together />} />
                  <Route path="drive" element={<DriveMusic />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </PlayerProvider>
        </LibraryProvider>
      </CatalogueProvider>
    </UIProvider>
  );
}
