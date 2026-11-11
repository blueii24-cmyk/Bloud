import {
  createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { IconButton } from "./Buttons";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [open, onClose]);
}

/* ------------------------------------------------------------------ Modal */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered dialog on desktop, bottom sheet on mobile. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[88dvh] w-full animate-sheet-up flex-col rounded-t-2xl bg-surface shadow-2xl shadow-black/60 sm:max-w-md sm:animate-pop-in sm:rounded-2xl",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/20 sm:hidden" />
        <header className="flex items-center justify-between px-5 pb-1 pt-3 sm:pt-4">
          <h2 className="t-section">{title}</h2>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">{footer}</footer>}
        {!footer && <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------- Menu */

const MenuCtx = createContext<() => void>(() => {});

interface MenuProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
}

/** Anchored popover on desktop, bottom sheet on touch-sized screens. */
export function Menu({ open, anchor, onClose, header, children }: MenuProps) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEscape(open, onClose);

  useLayoutEffect(() => {
    if (!open || !desktop || !anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    const margin = 8;
    let top = a.bottom + 4;
    if (top + m.height > window.innerHeight - margin) top = Math.max(margin, a.top - m.height - 4);
    let left = a.right - m.width;
    left = Math.min(Math.max(margin, left), window.innerWidth - m.width - margin);
    setPos({ top, left });
  }, [open, desktop, anchor]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <MenuCtx.Provider value={onClose}>
      <div className="fixed inset-0 z-[70]" onClick={(e) => e.stopPropagation()}>
        <div className={cn("absolute inset-0", desktop ? "" : "animate-fade-in bg-black/60 backdrop-blur-[2px]")} onClick={onClose} />
        <div
          ref={ref}
          role="menu"
          className={cn(
            "absolute bg-surface-hover shadow-2xl shadow-black/70",
            desktop
              ? "w-60 animate-pop-in rounded-xl p-1"
              : "inset-x-0 bottom-0 animate-sheet-up rounded-t-2xl px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
          )}
          style={desktop ? { top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" } : undefined}
        >
          {!desktop && <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/20" />}
          {header && !desktop && <div className="mb-1 border-b border-line px-2 pb-3">{header}</div>}
          <div className="max-h-[60dvh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </MenuCtx.Provider>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
  checked?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
}

export function MenuItem({ icon, label, onSelect, checked, danger, keepOpen }: MenuItemProps) {
  const close = useContext(MenuCtx);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        if (!keepOpen) close();
      }}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-100 hover:bg-white/10 active:bg-white/15 sm:h-10",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon && <span className={cn("flex size-5 shrink-0 items-center justify-center", danger ? "" : "text-fg-2")}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked && <Check className="size-4 text-accent" />}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="mx-2 my-1 h-px bg-line" />;
}
