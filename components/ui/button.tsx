"use client";

import { cn } from "@/lib/cn";

// Colour only — geometry comes from the size prop (the ws-btn-* size utilities).
// The brand fills reference the colour-only ws-btn-* utilities in globals.css so
// the ramp lives in one place (CLAUDE.md's purple/arena/silver rules govern it).
type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "create"
  | "silver"
  | "arena"
  | "welcome";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-ink hover:bg-white active:bg-grey-200",
  secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  ghost: "text-grey-300 hover:bg-white/5 hover:text-white",
  danger: "border border-down/40 bg-down/10 text-down hover:bg-down/20",
  create: "ws-btn-create",
  silver: "ws-btn-silver",
  arena: "ws-btn-arena",
  welcome: "ws-btn-welcome",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "ws-press inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        // Geometry (height, inline padding, font) is the one source of truth in
        // globals.css: 44px touch floor, shrinking to today's desktop sizes on a
        // fine pointer. See the BUTTON SIZE SCALE block there.
        size === "sm" && "ws-btn-sm",
        size === "md" && "ws-btn-md",
        size === "lg" && "ws-btn-lg",
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 animate-spin text-current", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
