import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const ICON_SIZES = { sm: "size-8", md: "size-10", lg: "size-12" };

/** Quiet icon button: 40px default hit target, subtle hover + press. */
export function IconButton({ label, active, size = "md", className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition duration-150 active:scale-90 disabled:opacity-40 disabled:active:scale-100",
        ICON_SIZES[size],
        active ? "text-accent" : "text-fg-2 hover:text-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface PillProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

/** Text button: primary = white, accent = reserved for the main play action. */
export function Button({ variant = "secondary", size = "md", className, ...rest }: PillProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100",
        size === "md" ? "h-10 px-5 text-sm" : "h-8 px-4 text-[13px]",
        variant === "primary" && "bg-fg text-black hover:bg-white/90",
        variant === "secondary" && "bg-white/10 text-fg hover:bg-white/15",
        variant === "ghost" && "text-fg-2 hover:text-fg",
        variant === "danger" && "bg-danger/15 text-danger hover:bg-danger/25",
        className,
      )}
      {...rest}
    />
  );
}

export function Chip({ active, className, ...rest }: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition duration-150 active:scale-95",
        active ? "bg-fg text-black" : "bg-white/10 text-fg hover:bg-white/15",
        className,
      )}
      {...rest}
    />
  );
}
