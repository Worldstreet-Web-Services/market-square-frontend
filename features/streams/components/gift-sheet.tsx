"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { GiftGrid } from "@/components/ui/gift-grid";
import { LIVE_GIFTS, type LiveGift } from "@/lib/gifts";
import { formatKash } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";

/**
 * The live room's gift tray — the designed grid, plus what a room needs.
 *
 * GEOMETRY is the file's, converted once. The frame is drawn at 254px wide
 * against a 375px phone, so every measurement here is the design's × 1.4764:
 * the 15.56px close button is 23, the 10.13px title is 15/20, the 5.19px
 * column gap is 7.7, the 15.56px row gap is 23, and the tiles land at ~93×90.
 * The scale factor is written down because the alternative is fourteen
 * unexplained decimals.
 *
 * ARTWORK is the file's too — fourteen rendered objects, exported and cropped
 * from the source rather than redrawn or swapped for emoji. The tray they
 * replace used 🌹✨🔥, which is a placeholder wearing a product's clothes.
 *
 * TYPE: the file names Roboto; the app is Geist throughout, so this renders at
 * the file's weights and sizes in the house face — the same call the topic
 * picker and person row already make.
 *
 * WHAT THE FILE COULD NOT SAY, and is therefore ours:
 *
 *  · Every tile in the file is priced "20", which is a placeholder, not a
 *    price list. The ladder below is ours and is ordered by what the object
 *    means — a rose is the smallest thing you can say, the KASH coin itself is
 *    the largest.
 *  · The file draws no confirm step. Sending money on a single tap, with no
 *    total and no undo, is not a design decision a picker can make for you —
 *    so selection stays a selection, and the amount is committed by a button
 *    that names it.
 */
const QUANTITIES = [1, 5, 10] as const;

export function GiftSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (gift: LiveGift, quantity: number) => void;
}) {
  const [selectedId, setSelectedId] = useState(LIVE_GIFTS[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  const selected = LIVE_GIFTS.find((gift) => gift.id === selectedId) ?? LIVE_GIFTS[0];
  const total = String(Number(selected.priceKash) * quantity);

  return (
    <Sheet open={open} onClose={onClose} bare>
      <div className="bg-[#1C1C1E] px-4 pb-4 pt-3.5">
        {/* The file's grab handle: 43×2.5, centred, at 6D6D6D. Decorative —
            the sheet already closes on backdrop, Escape and the button. */}
        <div className="flex justify-center" aria-hidden>
          <span className="h-[2.5px] w-[43px] rounded-full bg-[#6D6D6D]" />
        </div>

        <div className="relative mt-3 flex items-center justify-center">
          <h2 className="text-[15px] font-bold leading-5 text-white">Tip your creator</h2>
          {/* 23px circle, 4% white, blurred — the file's, pinned right. */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ws-press absolute right-0 flex h-[23px] w-[23px] items-center justify-center rounded-full bg-white/[0.04] backdrop-blur-[2px] transition-colors hover:bg-white/10"
          >
            <IconX className="h-[9px] w-[9px] text-white" />
          </button>
        </div>

        {/* Scrolls, so the quantity row and Send stay put — see the note in
            the post tip sheet. */}
        <div className="mt-6 max-h-[min(46dvh,360px)] overflow-y-auto overscroll-contain">
          <GiftGrid
            selectedId={selectedId}
            onSelect={(gift) => setSelectedId(gift.id)}
          />
        </div>

        {/* The commit step the file does not draw — see the note at the top. */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-[13px] text-grey-400">Quantity</span>
          <div className="ws-inset flex gap-1 p-1">
            {QUANTITIES.map((value) => (
              <button
                key={value}
                onClick={() => setQuantity(value)}
                aria-pressed={quantity === value}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  quantity === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
                )}
              >
                ×{value}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="mt-3 w-full"
          onClick={() => {
            onSend(selected, quantity);
            onClose();
          }}
        >
          Send {selected.name} · {formatKash(total)}
        </Button>
        <p className="mt-2 text-center text-[11px] text-grey-600">
          KASH settlement activates when live gifting is connected to the platform gateway.
        </p>
      </div>
    </Sheet>
  );
}
