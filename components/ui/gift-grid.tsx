"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { formatKash } from "@/lib/format";
import { LIVE_GIFTS, type LiveGift } from "@/lib/gifts";

/**
 * The designed gift grid: three columns of rendered objects, each with the
 * coin glyph and its price.
 *
 * Shared presentation, because the same grid is the amount picker on a post
 * tip and the tray in a live room, and those are different slices — which
 * never import each other. Data comes from `lib/gifts`; behaviour is the
 * caller's.
 *
 * GEOMETRY is the file's, converted once. The frame is drawn at 254px against
 * a 375px phone, so every number is the design's × 1.4764: the 5.19px column
 * gap is 7.7 (`gap-x-2`), the 15.56px row gap is 23 (`gap-y-6`), tiles land at
 * ~93×90. The scale factor is written down because the alternative is a dozen
 * unexplained decimals.
 *
 * The row gap is three times the column gap because each price sits under its
 * artwork and needs the air; one value for both is what makes a gift tray read
 * as a spreadsheet.
 */
export function GiftGrid({
  selectedId,
  onSelect,
  className,
  showPrices = true,
  unavailable,
}: {
  /** Null while the reader has chosen an amount some other way. */
  selectedId: string | null;
  onSelect: (gift: LiveGift) => void;
  className?: string;
  /**
   * Off where the gift costs nothing.
   *
   * The live room sends gifts over the data channel with no settlement behind
   * them, so a price under the artwork there would be inventing a charge. The
   * post tip sheet keeps them: that one really does move KASH.
   */
  showPrices?: boolean;
  /**
   * Gifts this surface cannot actually send, by id.
   *
   * Rendered but INERT, which is the flag convention in CLAUDE.md and the
   * right one here: the tray is a designed catalogue, and quietly dropping
   * eight of fourteen tiles would look like a loading failure. Disabled with
   * the reason on the tile says what is true — this gift is below the tip
   * minimum — and cannot be tapped into a refusal.
   */
  unavailable?: ReadonlySet<string>;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-x-2 gap-y-6", className)}>
      {LIVE_GIFTS.map((gift) => {
        const active = gift.id === selectedId;
        const blocked = unavailable?.has(gift.id) === true;
        return (
          <button
            key={gift.id}
            type="button"
            onClick={() => onSelect(gift)}
            // A real `disabled`, not a dimmed control that still fires:
            // unclickable, untabbable and announced (CLAUDE.md).
            disabled={blocked}
            aria-pressed={active}
            aria-label={
              showPrices
                ? `${gift.name}, ${formatKash(gift.priceKash)}${blocked ? " — too small to send" : ""}`
                : gift.name
            }
            className={cn(
              "ws-press flex flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition-colors",
              active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              blocked && "cursor-not-allowed opacity-35 hover:bg-transparent"
            )}
          >
            <span className="relative block h-[60px] w-full">
              <Image src={gift.art} alt="" fill sizes="96px" className="object-contain" />
            </span>
            {showPrices ? (
              <span className="mt-1 flex items-center gap-1">
                <Image src="/gifts/coin.svg" alt="" width={9} height={9} aria-hidden />
                <span className="tnum text-[11px] font-bold leading-4 text-white">
                  {gift.priceKash}
                </span>
              </span>
            ) : (
              // The name replaces the price rather than leaving a gap: the row
              // rhythm is the design's, and a tile with nothing under the
              // artwork reads as a tile that failed to load.
              <span className="mt-1 max-w-full truncate text-[11px] font-semibold leading-4 text-white/70">
                {gift.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
