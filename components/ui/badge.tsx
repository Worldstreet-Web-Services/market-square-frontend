import { useId } from "react";
import { cn } from "@/lib/cn";
import { BadgeArkGlyph } from "@/components/ui/org-badge-glyphs";
import type { OrgBadge, VerificationState } from "@/lib/api/schemas";

/**
 * The verified seal — ogazboiz's own artwork (a 132x131 scalloped seal on the
 * `#A361FF -> #623A99 -> #9F5AFF` ramp, ringed `#9E58FF`, with the check cut
 * out of it), drawn at whatever size the caller's class gives the box.
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
  // One gradient per badge: a feed renders dozens, and a shared id would let
  // the first definition on the page paint every other seal.
  const gradient = `verified-${useId().replace(/:/g, "")}`;
  if (verification !== "verified") return null;
  return (
    <span title="Verified" className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center", className)}>
      <span className="sr-only">Verified</span>
      <svg viewBox="0 0 132 131" fill="none" aria-hidden className="h-full w-full">
        <path
          d="M61.6855 3.67676C64.0942 1.65336 67.608 1.65336 70.0166 3.67676L77.835 10.2441C80.1441 12.1839 83.1601 13.0701 86.1514 12.6865L96.2783 11.3877C99.3984 10.9877 102.355 12.8874 103.287 15.8916L106.313 25.6445C107.207 28.5247 109.266 30.8998 111.989 32.1943L121.211 36.5771C123.963 37.8853 125.42 40.9261 124.744 43.8711L124.673 44.1562L121.945 53.9951C121.14 56.9014 121.587 60.0125 123.179 62.5742L128.567 71.2471V71.248C130.227 73.92 129.727 77.398 127.382 79.4941L119.769 86.2979C117.52 88.3074 116.214 91.1662 116.168 94.1816L116.012 104.392C115.964 107.537 113.662 110.193 110.556 110.688L100.473 112.296C97.4946 112.771 94.8507 114.47 93.1816 116.981L87.5312 125.485C85.7904 128.105 82.4181 129.096 79.5371 127.833L70.1846 123.733C67.4226 122.523 64.2796 122.523 61.5176 123.733L52.166 127.833C49.2849 129.096 45.9129 128.105 44.1719 125.485L38.5205 116.981C36.8515 114.47 34.2076 112.771 31.2295 112.296L21.1465 110.688C18.04 110.193 15.7386 107.537 15.6904 104.392L15.5342 94.1816C15.4881 91.1662 14.1823 88.3074 11.9336 86.2979L4.32031 79.4941C1.97483 77.3979 1.47467 73.9191 3.13477 71.2471L8.52344 62.5742C10.1149 60.0125 10.5623 56.9014 9.75684 53.9951L7.03027 44.1562C6.1901 41.1246 7.64988 37.9276 10.4912 36.5771L19.7129 32.1943C22.4368 30.8997 24.4949 28.524 25.3887 25.6436L28.4141 15.8926C29.3463 12.888 32.3035 10.9876 35.4238 11.3877L45.5508 12.6865C48.542 13.07 51.5581 12.1839 53.8672 10.2441L61.6855 3.67676ZM97.0977 44.5439C93.6268 41.8062 88.6326 42.1414 85.5576 45.3164L85.2568 45.6426L60.7627 73.6299L47.8379 62.1436C44.3846 59.0753 39.1563 59.2826 35.9531 62.5381L35.6494 62.8633C32.58 66.3171 32.7881 71.545 36.0439 74.748L36.3682 75.0518L52.542 89.4297C57.8332 94.1333 65.9039 93.7098 70.6738 88.5312L70.8984 88.2803L98.2549 57.0117C101.394 53.4224 101.028 47.9688 97.4404 44.8291L97.4395 44.8281L97.0977 44.5439Z"
          fill={`url(#${gradient})`}
          stroke="#9E58FF"
          strokeWidth="4.3176"
        />
        <defs>
          <linearGradient id={gradient} x1="92.4598" y1="14.6278" x2="62.2366" y2="135.521" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A361FF" />
            <stop offset="0.429415" stopColor="#623A99" />
            <stop offset="0.961538" stopColor="#9F5AFF" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

/**
 * The organisation badge — the design's ARK lockup.
 *
 * Assigned admin-only and deliberately NOT derived from `role`: product
 * decides who carries one, so this and `RoleChip` are independent signals that
 * can sit side by side. When `orgBadge` is null nothing renders — there is no
 * fallback to invent one from role or verification.
 *
 * THERE IS NO MARKET BADGE ANY MORE (2026-09-16, ogazboiz: "there is no market
 * badge anymore again so we need to remove that"). The blue-ringed MARKET
 * lockup is gone from the design, so `"market"` renders NOTHING — here, once,
 * rather than at each of the call sites, so no surface can keep drawing it.
 * The schema still parses `"market"` (the backend enum and existing profiles
 * carry it), it simply has no presentation, exactly as `creator` has no
 * `RoleChip`.
 *
 * Chip geometry is the design's: a 21px-radius capsule at 4% white with a 19%
 * white hairline, wrapping the brand glyph at 7px tall.
 *
 * `bare` — the lockup drawn alone at its own size, for the post card's header,
 * without the capsule the rows and sheets wrap it in.
 */
export function OrgBadgeChip({
  orgBadge,
  className,
  bare = false,
}: {
  orgBadge: OrgBadge;
  className?: string;
  /** Draw the exported lockup alone at its native size — see above. */
  bare?: boolean;
}) {
  if (orgBadge !== "ark") return null;
  return (
    <span
      title="Ark"
      className={cn(
        "inline-flex shrink-0 items-center",
        !bare && "rounded-[21px] border border-white/[0.19] bg-white/[0.04] px-1 py-[2.5px]",
        className
      )}
    >
      <span className="sr-only">Ark</span>
      {/* Width tracks the glyph's own aspect ratio, height is fixed. */}
      <BadgeArkGlyph className={bare ? "h-[9px] w-[44px]" : "h-[7px] w-[34px]"} />
    </span>
  );
}

const ROLE_LABEL: Record<string, string | null> = {
  citizen: null,
  // NOT DRAWN. Nearly everybody who posts is a creator, so the chip sat on
  // almost every author line and distinguished nobody from anybody — a badge
  // that everyone wears is decoration, not a signal (ogazboiz: "it is not
  // needed again"). The role still exists on the profile and still arrives in
  // the payload; it simply has no chip, exactly as `citizen` has none.
  creator: null,
  ambassador: "Ambassador",
  worldstreet: "WorldStreet",
};

/**
 * The capsule itself, with no opinion about what is in it.
 *
 * Extracted at the THIRD caller, not the second: `RoleChip`, a house's HOST
 * chip and its MUTED FOR YOU chip are the same object — the org badge's
 * geometry with a text label instead of a lockup — and three hand-copied
 * class strings is how one of them quietly stops matching the others.
 *
 * It deliberately does not take a tone. There is one capsule; anything that
 * needs a different colour is a different component, not a variant of this.
 */
export function ChipShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      // Shares the org badge's capsule geometry so the two sit together
      // cleanly. See OrgBadgeChip.
      className={cn(
        "inline-flex shrink-0 items-center rounded-[21px] border border-white/[0.19] bg-white/[0.04] px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-grey-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export function RoleChip({ role, className }: { role: string; className?: string }) {
  const label = ROLE_LABEL[role] ?? null;
  if (!label) return null;
  // Role and org badge are independent signals — see OrgBadgeChip.
  return <ChipShell className={className}>{label}</ChipShell>;
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

// "premium" marks promoted / paid / top-ranked (VIP tiers, the paused
// verification badge); "spotlight" belongs to the Citizen Spotlight surface
// alone. Both now sit on the purple ramp — "premium" was the amber tone until
// the gold sweep, and its ink is the ramp's LIGHT stop because the label is
// small text on a dark ground. Semantic like up/down — never decoration.
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "premium" | "spotlight";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "accent" && "bg-accent text-ink",
        tone === "premium" && "border border-create/40 bg-create/15 text-create",
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
