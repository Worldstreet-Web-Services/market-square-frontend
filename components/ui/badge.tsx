import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/ui/icons";

// Earned and paid verification both render the same silver check — the tier
// is a backend economics detail, not a visual hierarchy. "pending" shows
// nothing: the badge appears only once verification lands.
export function VerifiedBadge({
  verification,
  className,
}: {
  verification: "none" | "pending" | "earned" | "paid";
  className?: string;
}) {
  if (verification === "none" || verification === "pending") return null;
  return (
    <span
      title={verification === "paid" ? "Verified (supporter)" : "Verified"}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-ink",
        className
      )}
    >
      <IconCheck className="h-2.5 w-2.5 [&]:stroke-[3]" />
    </span>
  );
}

const ROLE_LABEL: Record<string, string | null> = {
  citizen: null,
  creator: "Creator",
  ambassador: "Ambassador",
  worldstreet: "WorldStreet",
};

export function RoleChip({ role, className }: { role: string; className?: string }) {
  const label = ROLE_LABEL[role] ?? null;
  if (!label) return null;
  return (
    <span
      // Chip geometry is the design's: a flat 21px-radius capsule at 4% white
      // with a 19% hairline. The design fills it with a MARKET / ARK brand
      // glyph; until a field distinguishes those, it carries the real role.
      className={cn(
        "rounded-[21px] border border-white/[0.19] bg-white/[0.04] px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-grey-200",
        className
      )}
    >
      {label}
    </span>
  );
}

// Silver IS the live color: black pill, pulsing silver dot, uppercase.
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent",
        className
      )}
    >
      <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-accent" />
      Live
    </span>
  );
}

// "featured" is the amber tone: promoted, premium or top-ranked. It is
// semantic like up/down — never reach for it as decoration.
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "featured";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "accent" && "bg-accent text-ink",
        tone === "featured" && "border border-featured/40 bg-featured/15 text-featured",
        tone === "neutral" && "border border-white/15 bg-black/40 text-grey-200",
        className
      )}
    >
      {children}
    </span>
  );
}
