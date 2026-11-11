import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useUI } from "../../state/UIContext";
import { ModalHost } from "../modals/ModalHost";
import { MiniPlayer } from "../player/MiniPlayer";
import { NowPlaying } from "../player/NowPlaying";
import { PlayerBar } from "../player/PlayerBar";
import { QueueView } from "../player/QueueView";
import { IconButton } from "../ui/Buttons";
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
      <ModalHost />
      <Toaster />
    </div>
  );
}
