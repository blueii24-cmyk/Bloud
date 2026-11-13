import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useUI } from "../../state/UIContext";
import { useAuth } from "../../state/AuthContext";
import { useLibrary } from "../../state/LibraryContext";
import { useWorkspace } from "../../state/WorkspaceContext";
import { DriveOnboarding } from "../auth/DriveOnboarding";
import { ModalHost } from "../modals/ModalHost";
import { MiniPlayer } from "../player/MiniPlayer";
import { NowPlaying } from "../player/NowPlaying";
import { PlayerBar } from "../player/PlayerBar";
import { QueueView } from "../player/QueueView";
import { Button, IconButton } from "../ui/Buttons";
import { Toaster } from "../ui/Toaster";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * Responsive application frame.
 *  - lg+: sidebar · content · optional queue panel, with a persistent playback bar
 *  - below lg: top bar, content, mini-player and bottom navigation (all in flow, no overlap)
 */
export function Shell() {
  const ui = useUI();
  const auth = useAuth();
  const library = useLibrary();
  const workspace = useWorkspace();
  const cloudError = auth.status === "authed" ? workspace.error ?? library.syncError : null;
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="flex min-h-0 flex-1 lg:gap-2 lg:p-2 lg:pb-0">
        <Sidebar className="hidden lg:flex" />

        <main
          ref={main}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
          className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg lg:rounded-xl lg:ring-1 lg:ring-white/[0.04]"
        >
          {auth.configured && cloudError && (
            <div className="mx-4 mt-3 flex flex-col gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm sm:mx-6 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <p className="min-w-0 text-danger">{cloudError} Your library changes are kept in this account's local cache until cloud sync recovers.</p>
              <Button size="sm" variant="ghost" className="self-start sm:self-auto" onClick={() => void workspace.refresh()}>Retry cloud check</Button>
            </div>
          )}
          <TopBar scrolled={scrolled} />
          <div key={pathname} className="animate-page-in px-4 pb-8 lg:px-6 lg:pb-10">
            <Outlet />
          </div>
        </main>

        {ui.queuePanelOpen && (
          <aside aria-label="Queue" className="hidden w-[340px] shrink-0 animate-fade-in flex-col rounded-xl bg-bg-2 p-4 ring-1 ring-white/[0.04] lg:flex">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="t-section">Queue</h2>
              <IconButton label="Close queue" size="sm" onClick={ui.toggleQueuePanel}>
                <X className="size-5" />
              </IconButton>
            </div>
            <QueueView className="flex-1" />
          </aside>
        )}
      </div>

      <PlayerBar className="hidden h-[88px] shrink-0 lg:grid" />

      <div className="shrink-0 lg:hidden">
        <MiniPlayer />
        <BottomNav />
      </div>

      <NowPlaying />
      <DriveOnboarding />
      <ModalHost />
      <Toaster />
    </div>
  );
}
