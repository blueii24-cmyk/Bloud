import { useUI } from "../../state/UIContext";

export function Toaster() {
  const { toast } = useUI();
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="glass pointer-events-none fixed left-1/2 z-[80] max-w-[calc(100vw-32px)] animate-toast rounded-full px-4 py-2.5 text-sm font-medium shadow-xl shadow-black/60 max-lg:bottom-[calc(8.5rem+env(safe-area-inset-bottom))] lg:bottom-28"
    >
      {toast.message}
    </div>
  );
}
