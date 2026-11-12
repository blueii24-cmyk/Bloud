import { useNavigate } from "react-router-dom";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { cn } from "../../utils/cn";

/**
 * Top-bar account control.
 *  - signed in : shows the name's initial; click to log out
 *  - guest     : "Log in" shortcut back to the login page
 *  - offline demo (no Supabase): hidden — there's no account to manage
 */
export function AccountButton({ className }: { className?: string }) {
  const auth = useAuth();
  const nav = useNavigate();
  if (!auth.walled || auth.status === "loading" || auth.status === "anon") return null;

  const base = "glass flex h-9 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition duration-150 hover:bg-surface-hover active:scale-95";

  if (auth.status === "guest") {
    return (
      <button type="button" aria-label="Log in" title="Log in" onClick={() => nav("/login", { state: { from: "/" } })} className={cn(base, "px-3.5", className)}>
        <LogIn className="size-4" />
        <span className="hidden sm:inline">Log in</span>
      </button>
    );
  }

  const label = auth.user?.name ?? "Account";
  return (
    <button
      type="button"
      aria-label={`Log out of ${label}`}
      title={`Log out (${label})`}
      onClick={async () => {
        await auth.signOut();
        nav("/login", { replace: true });
      }}
      className={cn(base, "pr-3.5 pl-1.5", className)}
    >
      <span className="grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
        {label.trim().charAt(0).toUpperCase()}
      </span>
      <LogOut className="size-4 text-fg-2" />
    </button>
  );
}
