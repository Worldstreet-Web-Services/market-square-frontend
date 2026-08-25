import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/ui/icons";
import { BadgeArkGlyph, BadgeMarketGlyph } from "@/components/ui/org-badge-glyphs";
import type { OrgBadge, VerificationState } from "@/lib/api/schemas";

/**
 * The silver check.
 *
 * Renders on `verified` and nothing else. `pending` has not been granted yet;
 * `lapsed` was granted but the subscription ran out, and a lapsed account must
 * not keep the check anywhere on the square — that is the whole point of the
 * state. This is the single gate for every surface, so widening it here
 * silently re-badges lapsed users across the app.
 */
export function VerifiedBadge({
  verification,
  className,
}: {
  verification: VerificationState;
  className?: string;
}) {
  if (verification !== "verified") return null;
  return (
    <span
      title="Verified"
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-ink",
        className
      )}
    >
      <IconCheck className="h-2.5 w-2.5 [&]:stroke-[3]" />
    </span>
  );
}

/**
 * The organisation badge — the design's MARKET / ARK lockup.
 *
 * Assigned admin-only and deliberately NOT derived from `role`: product
 * decides who carries one, so this and `RoleChip` are independent signals that
 * can sit side by side. When `orgBadge` is null nothing renders — there is no
 * fallback to invent one from role or verification.
 *
 * Chip geometry is the design's: a 21px-radius capsule at 4% white, wrapping
 * the brand glyph at 7px tall.
 *
 * The border is where the two badges now part company. The 2026-08-25 design
 * revision gave the MARKET chip a solid #008CFF 1px border; ARK was checked
 * separately against the file and kept its 19% white hairline, so this is a
 * per-badge value and not a shared token. The fill stays 4% white on both —
 * the blue is the ring, not a filled background.
 */
export function OrgBadgeChip({
  orgBadge,
  className,
}: {
  orgBadge: OrgBadge;
  className?: string;
}) {
  if (!orgBadge) return null;
  const Glyph = orgBadge === "market" ? BadgeMarketGlyph : BadgeArkGlyph;
  return (
    <span
      title={orgBadge === "market" ? "Market" : "Ark"}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[21px] border bg-white/[0.04] px-1 py-[2.5px]",
        orgBadge === "market" ? "border-[#008CFF]" : "border-white/[0.19]",
        className
      )}
    >
      <span className="sr-only">{orgBadge === "market" ? "Market" : "Ark"}</span>
      {/* Width tracks the glyph's own aspect ratio, height is fixed. */}
      <Glyph className={orgBadge === "market" ? "h-[7px] w-[35px]" : "h-[7px] w-[34px]"} />
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
      // Shares the org badge's capsule geometry so the two sit together
      // cleanly. Role and org badge are independent signals — see OrgBadgeChip.
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

// "featured" is the amber tone: promoted, premium or top-ranked. "spotlight" is
// the Citizen Spotlight purple, which the design split off the amber ramp — it
// belongs to the Spotlight surface alone. Both are semantic like up/down —
// never reach for either as decoration.
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "featured" | "spotlight";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "accent" && "bg-accent text-ink",
        tone === "featured" && "border border-featured/40 bg-featured/15 text-featured",
        tone === "spotlight" &&
          "border border-spotlight/50 bg-spotlight-chip/30 text-spotlight-chip-ink",
        tone === "neutral" && "border border-white/15 bg-black/40 text-grey-200",
        className
      )}
    >
      {children}
    </span>
  );
}
