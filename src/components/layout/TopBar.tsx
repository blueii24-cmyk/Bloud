import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { cn } from "../../utils/cn";
import { useRoom } from "../../state/RoomContext";
import { AvatarPair } from "../ui/Avatar";
import { Wordmark } from "../ui/Bits";
import { AccountButton } from "../auth/AccountButton";

const ROOTS = ["/", "/search", "/library", "/together"];

/** Sticky top bar. Mobile: brand or back + room status. Desktop: history arrows only. */
export function TopBar({ scrolled }: { scrolled: boolean }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const room = useRoom();
  const isRoot = ROOTS.includes(pathname);

  const circle = "glass flex size-9 items-center justify-center rounded-full transition duration-150 hover:bg-surface-hover active:scale-90";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)] transition-[background-color,backdrop-filter] duration-300 lg:px-6",
        "h-[calc(3.5rem+env(safe-area-inset-top))] lg:h-16",
        scrolled ? "bg-black/80 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="flex items-center gap-2">
        {!isRoot && (
          <button type="button" aria-label="Go back" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))} className={cn(circle, "lg:hidden")}>
            <ChevronLeft className="size-5" />
          </button>
        )}
        {isRoot && <Wordmark className="lg:hidden" />}
        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" aria-label="Go back" onClick={() => nav(-1)} className={circle}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Go forward" onClick={() => nav(1)} className={circle}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/together"
          aria-label={room.active ? "Listen Together room" : "Listen Together"}
          className={cn("flex h-9 items-center gap-2 rounded-full transition duration-150 active:scale-95 lg:hidden", room.active ? "glass px-2.5" : circle)}
        >
          {room.active ? (
            <>
              <AvatarPair size="xs" partnerOnline={room.partnerOnline} />
              {room.partnerOnline && <span className="size-1.5 rounded-full bg-accent" />}
            </>
          ) : (
            <Users className="mx-auto size-[18px]" />
          )}
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
