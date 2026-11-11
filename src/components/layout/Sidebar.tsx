import { NavLink, useNavigate } from "react-router-dom";
import { HardDrive, Heart, House, Library, PanelLeftClose, PanelLeftOpen, Plus, Search, Users } from "lucide-react";
import { cn } from "../../utils/cn";
import { useCatalogue } from "../../state/CatalogueContext";
import { useLibrary } from "../../state/LibraryContext";
import { useRoom } from "../../state/RoomContext";
import { useUI } from "../../state/UIContext";
import { Artwork } from "../ui/Artwork";
import { LogoMark } from "../ui/Bits";
import { IconButton } from "../ui/Buttons";

const NAV = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Your Library", icon: Library },
  { to: "/drive", label: "Drive Music", icon: HardDrive },
  { to: "/together", label: "Listen Together", icon: Users },
] as const;

export function Sidebar({ className }: { className?: string }) {
  const { sidebarCollapsed: collapsed, toggleSidebar, openModal } = useUI();
  const lib = useLibrary();
  const room = useRoom();
  const { data } = useCatalogue();
  const nav = useNavigate();

  const itemBase = "group flex h-10 items-center rounded-lg text-sm font-semibold transition-colors duration-150 active:scale-[0.98]";
  const link = ({ isActive }: { isActive: boolean }) =>
    cn(itemBase, collapsed ? "w-10 justify-center" : "gap-3.5 px-3", isActive ? "bg-white/[0.07] text-fg" : "text-fg-2 hover:text-fg");

  const create = () => {
    const id = lib.createPlaylist();
    nav(`/playlist/${id}`);
    openModal({ type: "edit", playlistId: id });
  };

  return (
    <aside
      className={cn(
        "flex-col overflow-hidden rounded-xl bg-bg-2 p-2 ring-1 ring-white/[0.04] transition-[width] duration-300 ease-soft",
        collapsed ? "w-[72px] items-center" : "w-[280px]",
        className,
      )}
    >
      <div className={cn("flex h-12 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-3 pr-1")}>
        {collapsed ? (
          <IconButton label="Expand sidebar" onClick={toggleSidebar}>
            <PanelLeftOpen className="size-5" />
          </IconButton>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <LogoMark />
              <span className="text-[17px] font-bold tracking-tight">Tandem</span>
            </span>
            <IconButton label="Collapse sidebar" size="sm" onClick={toggleSidebar}>
              <PanelLeftClose className="size-5" />
            </IconButton>
          </>
        )}
      </div>

      <nav aria-label="Primary" className={cn("mt-1 flex flex-col gap-0.5", collapsed && "items-center")}>
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink key={to} to={to} end={"end" in rest} className={link} title={collapsed ? label : undefined} aria-label={label}>
            <span className="relative">
              <Icon className="size-[22px]" />
              {to === "/together" && room.partnerOnline && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-bg-2" />}
            </span>
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && to === "/together" && room.active && (
              <span className="t-caption ml-auto font-medium text-accent">{room.partnerOnline ? "Live" : "Waiting"}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn("mx-2 my-3 h-px shrink-0 bg-line", collapsed && "w-8")} />

      <div className={cn("mb-1 flex shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-3")}>
        {!collapsed && <h2 className="t-eyebrow">Playlists</h2>}
        <IconButton label="Create playlist" size="sm" onClick={create}>
          <Plus className="size-5" />
        </IconButton>
      </div>

      <div className={cn("min-h-0 flex-1 space-y-0.5 overflow-y-auto", collapsed && "flex flex-col items-center")}>
        <NavLink
          to="/liked"
          title="Liked Songs"
          className={({ isActive }) => cn("flex items-center rounded-lg transition-colors duration-150 active:scale-[0.98]", collapsed ? "p-1" : "gap-3 p-1.5 pr-3", isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-art bg-gradient-to-br from-[#4fe3a1] to-[#3a2b8f]">
            <Heart className="size-[18px] fill-white text-white" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">Liked Songs</span>
              <span className="t-caption block truncate">{lib.likedIds.length} songs</span>
            </span>
          )}
        </NavLink>
        {lib.playlists.map((p) => (
          <NavLink
            key={p.id}
            to={`/playlist/${p.id}`}
            title={p.name}
            className={({ isActive }) => cn("flex items-center rounded-lg transition-colors duration-150 active:scale-[0.98]", collapsed ? "p-1" : "gap-3 p-1.5 pr-3", isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}
          >
            <Artwork art={p.art} className="size-10" />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="t-caption block truncate">
                  {p.collaborative ? `${data.users.me.name} & ${data.users.partner.name}` : `Playlist · ${data.users[p.ownerId as "me" | "partner"]?.name ?? "Tandem"}`}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
