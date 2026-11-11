import { cn } from "../../utils/cn";
import { useCatalogue } from "../../state/CatalogueContext";
import type { UserId } from "../../types";

const SIZES = { xs: "size-5 text-[10px]", sm: "size-6 text-[11px]", md: "size-8 text-xs", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

export function Avatar({ userId, size = "md", className, ring }: { userId: UserId; size?: keyof typeof SIZES; className?: string; ring?: boolean }) {
  const { data } = useCatalogue();
  const u = data.users[userId];
  return (
    <span
      title={u.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-black",
        ring && "ring-2 ring-black",
        SIZES[size],
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${u.colors[0]}, ${u.colors[1]})` }}
    >
      {u.initials}
    </span>
  );
}

/** Two overlapping avatars; the partner is dimmed while offline. */
export function AvatarPair({ size = "sm", partnerOnline = true, className }: { size?: keyof typeof SIZES; partnerOnline?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Avatar userId="me" size={size} ring />
      <Avatar userId="partner" size={size} ring className={cn("-ml-2 transition-opacity", !partnerOnline && "opacity-40")} />
    </span>
  );
}
