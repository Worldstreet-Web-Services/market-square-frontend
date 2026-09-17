"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconBadgeInfo, IconBadgeLock } from "@/components/ui/profile-icons";
import type { Badge } from "@/features/profile/lib/types";
import { asset } from "@/lib/square-path";

/**
 * BADGES — two surfaces, one tile.
 *
 *   · 545:47637  a stranger's profile: "Badges (N)" over a row of what they
 *                have EARNED, each a 104 tile with its name centred under it.
 *   · 543:40148  your own Badges tab: the whole catalogue, 24 apart, the
 *                earned ones bright with an info glyph that opens the badge's
 *                description, the locked ones dimmed behind a lock.
 *
 * ─── THE TILE, 543:40163 ────────────────────────────────────────────────────
 * 104x104 at a 20 radius. Earned: `#CFADFF` behind the artwork. Locked
 * (543:40179): the same `#CFADFF` at 20%, the artwork at 40%. The artwork is
 * the file's own — the "Rising Star" star plaque and the "King & more" crown
 * plaque are the exported vector groups, the "Rookie" square mascot is the
 * exported image fill (64x96, 20 from the left and 4 down) — served from
 * `public/badges/`, keyed by the badge's `key`. A key the client has no art
 * for gets the bare tile: recolouring another badge's plaque would be drawing
 * an award the service did not give.
 *
 * ─── THE ROUTE ──────────────────────────────────────────────────────────────
 * `GET /profiles/:username/badges` — asked; the backend is NOT shipping it
 * until the earning rules are decided, so it 404s today and both surfaces
 * stay absent (`unavailable`). Neither ever renders "Badges (0)".
 */

/** Which file the artwork lives in, by the service's key. Unknown → none. */
const ARTWORK: Record<string, { src: string; kind: "plaque" | "mascot" }> = {
  "rising-star": { src: asset("/badges/rising-star.svg"), kind: "plaque" },
  rookie: { src: asset("/badges/rookie.png"), kind: "mascot" },
  king: { src: asset("/badges/king.svg"), kind: "plaque" },
};

export function BadgeTile({ badge }: { badge: Badge }) {
  const earned = badge.earnedAt !== null;
  const art = ARTWORK[badge.key];
  return (
    <div
      className={cn(
        "relative h-[104px] w-[104px] overflow-hidden rounded-[20px]",
        earned ? "bg-[#CFADFF]" : "bg-[#CFADFF]/20"
      )}
    >
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- the file's own artwork, served locally
        <img
          src={art.src}
          alt=""
          aria-hidden
          className={cn("absolute", !earned && "opacity-40")}
          style={
            art.kind === "mascot"
              ? { left: 20, top: 4, width: 64, height: 96 }
              : { left: 13, top: 12, width: 78.53, height: 80 }
          }
        />
      )}
    </div>
  );
}

/**
 * The stranger's section — 545:47637. The heading is "Badges" at Roboto Bold
 * 12/16 in `#F4F4F4` with the "(N)" in Geist Medium at 50% white (the file's
 * own character override), set in Geist 700 like every heading here. Tiles
 * are 104-wide columns on a 12 gap with the name at Geist 500 12/16 under.
 */
export function BadgesSection({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((badge) => badge.earnedAt !== null);
  if (earned.length === 0) return null;
  return (
    <section aria-label="Badges" className="flex flex-col gap-4">
      <h2 className="text-[12px] font-bold leading-4 text-grey-100">
        Badges <span className="font-medium text-white/50">({earned.length})</span>
      </h2>
      <div className="flex flex-wrap items-start gap-4">
        {earned.map((badge) => (
          <div key={badge.key} className="flex w-[104px] flex-col items-center gap-3">
            <BadgeTile badge={badge} />
            <p className="text-center text-[12px] font-medium leading-4 text-white">{badge.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The tooltip — 543:40201. A 280-wide panel 4 under the label row: a two-dot
 * tail (a 4px and a 12px disc) rising from its top-left, then the content at
 * `rgba(186,186,186,0.2)` with a 12 radius and 12 of padding, the text at
 * Geist 400 12/18 in white, under the file's `0 4px 6px -3px` shadow. The
 * tail's tip sits under the glyph that opened it.
 */
function BadgeTooltip({ text }: { text: string }) {
  return (
    <div
      role="tooltip"
      className="absolute left-1/2 top-full z-20 w-[280px] -translate-x-[26px] pt-1 shadow-[0_4px_6px_-3px_rgba(10,10,10,0.06)]"
    >
      <div aria-hidden className="relative h-[10px] w-full">
        <span className="absolute left-[17px] top-0 h-1 w-1 rounded-full bg-[rgba(186,186,186,0.2)] backdrop-blur-[7px]" />
        <span className="absolute left-[13px] top-1 h-3 w-3 rounded-full bg-[rgba(186,186,186,0.2)] backdrop-blur-[7px]" />
      </div>
      <div className="rounded-xl bg-[rgba(186,186,186,0.2)] p-3 backdrop-blur-[7px]">
        <p className="text-[12px] leading-[18px] text-white">{text}</p>
      </div>
    </div>
  );
}

/**
 * Your own Badges tab — 543:40161: the tiles 32 in from the column's edge and
 * 24 apart, each a 104-wide column with the tile, 12, then the label row —
 * the name at Roboto Bold 12/16 in white (Geist 700 here) and, spread to the
 * far edge, the 16px glyph: `info-circle` on an earned badge, `lock` on a
 * locked one. The glyphs are `#7E3BEB` in the file — `--color-spotlight`.
 */
export function BadgesPanel({ badges }: { badges: Badge[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  if (badges.length === 0) return null;
  return (
    <div
      ref={panel}
      className="flex flex-wrap items-start gap-6 px-4 pt-8 md:px-8"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenKey(null);
      }}
    >
      {badges.map((badge) => {
        const earned = badge.earnedAt !== null;
        const open = openKey === badge.key;
        return (
          <div key={badge.key} className="flex w-[104px] flex-col gap-3">
            <BadgeTile badge={badge} />
            <div className="flex items-center justify-between gap-6">
              <p className="min-w-0 truncate text-[12px] font-bold leading-4 text-white">
                {badge.name}
              </p>
              {earned ? (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label={`About ${badge.name}`}
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : badge.key)}
                    onBlur={() => setOpenKey((key) => (key === badge.key ? null : key))}
                    className="ws-press flex h-4 w-4 items-center justify-center text-spotlight"
                  >
                    <IconBadgeInfo className="h-4 w-4" />
                  </button>
                  {open && badge.description && <BadgeTooltip text={badge.description} />}
                </div>
              ) : (
                <span title="Not earned yet" className="flex h-4 w-4 shrink-0 items-center justify-center text-spotlight">
                  <IconBadgeLock className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
