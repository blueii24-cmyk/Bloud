import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type NowPlayingView = "player" | "lyrics" | "queue";

export type ModalState =
  | { type: "picker"; trackIds: string[] }
  | { type: "edit"; playlistId: string }
  | { type: "addSongs"; target: { kind: "playlist"; id: string } | { kind: "queue" } }
  | { type: "devices" }
  | null;

interface UIApi {
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  nowPlayingOpen: boolean;
  openNowPlaying(view?: NowPlayingView): void;
  closeNowPlaying(): void;
  npView: NowPlayingView;
  setNpView(v: NowPlayingView): void;
  queuePanelOpen: boolean;
  toggleQueuePanel(): void;
  modal: ModalState;
  openModal(m: Exclude<ModalState, null>): void;
  closeModal(): void;
  toast: { id: number; message: string } | null;
  notify(message: string): void;
}

const Ctx = createContext<UIApi>(null!);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tandem.sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [nowPlayingOpen, setNpOpen] = useState(false);
  const [npView, setNpView] = useState<NowPlayingView>("player");
  const [queuePanelOpen, setQueuePanel] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem("tandem.sidebar", sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const notify = useCallback((message: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const value = useMemo<UIApi>(
    () => ({
      sidebarCollapsed,
      toggleSidebar: () => setCollapsed((c) => !c),
      nowPlayingOpen,
      openNowPlaying: (view = "player") => {
        setNpView(view);
        setNpOpen(true);
      },
      closeNowPlaying: () => setNpOpen(false),
      npView,
      setNpView,
      queuePanelOpen,
      toggleQueuePanel: () => setQueuePanel((o) => !o),
      modal,
      openModal: setModal,
      closeModal: () => setModal(null),
      toast,
      notify,
    }),
    [sidebarCollapsed, nowPlayingOpen, npView, queuePanelOpen, modal, toast, notify],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUI = () => useContext(Ctx);
