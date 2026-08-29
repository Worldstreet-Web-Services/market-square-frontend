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
}: {
  /** Null while the reader has chosen an amount some other way. */
  selectedId: string | null;
  onSelect: (gift: LiveGift) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-x-2 gap-y-6", className)}>
      {LIVE_GIFTS.map((gift) => {
        const active = gift.id === selectedId;
        return (
          <button
            key={gift.id}
            type="button"
            onClick={() => onSelect(gift)}
            aria-pressed={active}
            aria-label={`${gift.name}, ${formatKash(gift.priceKash)}`}
            className={cn(
              "ws-press flex flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition-colors",
              active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            )}
          >
            <span className="relative block h-[60px] w-full">
              <Image src={gift.art} alt="" fill sizes="96px" className="object-contain" />
            </span>
            <span className="mt-1 flex items-center gap-1">
              <Image src="/gifts/coin.svg" alt="" width={9} height={9} aria-hidden />
              <span className="tnum text-[11px] font-bold leading-4 text-white">
                {gift.priceKash}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
