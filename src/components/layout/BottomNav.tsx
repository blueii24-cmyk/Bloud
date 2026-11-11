import { NavLink } from "react-router-dom";
import { HardDrive, House, Library, Search, Users } from "lucide-react";
import { cn } from "../../utils/cn";
import { useRoom } from "../../state/RoomContext";

const ITEMS = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/drive", label: "Drive", icon: HardDrive },
  { to: "/together", label: "Together", icon: Users },
] as const;

export function BottomNav({ className }: { className?: string }) {
  const room = useRoom();
  return (
    <nav aria-label="Primary" className={cn("grid grid-cols-5 bg-black pb-[env(safe-area-inset-bottom)] pt-1", className)}>
      {ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={"end" in rest}
          className={({ isActive }) =>
            cn("group flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition duration-150 active:scale-90", isActive ? "text-fg" : "text-fg-3")
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon className={cn("size-6 transition-[stroke-width]", isActive && "stroke-[2.5]")} />
                {to === "/together" && room.partnerOnline && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-black" />}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
