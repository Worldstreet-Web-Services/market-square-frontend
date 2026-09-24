"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { GiftGrid } from "@/components/ui/gift-grid";
import { LIVE_GIFTS, type LiveGift } from "@/lib/gifts";
import { multiplyKash } from "@/lib/kash-amount";
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

/** Somebody a gift can be sent to — the room's own roster, resolved already. */
export interface GiftRecipient {
  id: string;
  name: string;
  /** Marked in the list, and the default, so a gift with no thought lands right. */
  isHost?: boolean;
}

export function GiftSheet({
  open,
  onClose,
  onSend,
  priced = false,
  recipients,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (gift: LiveGift, quantity: number, recipient: GiftRecipient | null) => void;
  /**
   * WHO CAN BE GIFTED. Absent on a broadcast, where the gift goes to the host
   * and there is nobody else to choose — the picker is then not drawn at all
   * rather than drawn with one disabled row.
   *
   * Present in a gist room, where the whole point is that you can gift ANYBODY
   * on the stage or in the audience (ogazboiz, 2026-09-24). The host is first
   * and is the default, so a sender who ignores the row still pays the person
   * today's route would have paid anyway.
   */
  recipients?: readonly GiftRecipient[];
  /**
   * Whether sending this actually costs KASH.
   *
   * False today, and the copy follows it exactly. There is no
   * `POST /streams/{id}/tips` — the KASH tip rail exists but is scoped to
   * posts — so a live gift is a free on-stream moment, and the sheet must not
   * print a price, a total, or the word "tip" for something nobody is charged
   * for. Flip it with `MARKET_FLAGS.liveGifts` once the route ships.
   */
  priced?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(LIVE_GIFTS[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  // The host leads the roster, so index 0 is the sane default without this
  // sheet needing to know what a host is.
  const [toId, setToId] = useState<string | null>(null);
  const people = recipients ?? [];
  const recipient = people.find((person) => person.id === toId) ?? people[0] ?? null;
  const selected = LIVE_GIFTS.find((gift) => gift.id === selectedId) ?? LIVE_GIFTS[0];
  // Exact, never `Number(price) * quantity` — three Roses at 0.01 is 0.03, and
  // the float answer is 0.030000000000000002, which the engine rejects for
  // exceeding six places. The button must show the number that will be
  // charged. Null falls back to the single price rather than printing a total
  // this sheet cannot stand behind.
  const total = multiplyKash(selected.priceKash, quantity) ?? selected.priceKash;

  return (
    <Sheet open={open} onClose={onClose} bare>
      <div className="bg-[#1C1C1E] px-4 pb-4 pt-3.5">
        {/* The file's grab handle: 43×2.5, centred, at 6D6D6D. Decorative —
            the sheet already closes on backdrop, Escape and the button. */}
        <div className="flex justify-center" aria-hidden>
          <span className="h-[2.5px] w-[43px] rounded-full bg-[#6D6D6D]" />
        </div>

        <div className="relative mt-3 flex items-center justify-center">
          <h2 className="text-[15px] font-bold leading-5 text-white">
            {priced ? "Tip your creator" : "Send a gift"}
          </h2>
          {/* 23px circle, 4% white, blurred — the file's, pinned right. */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ws-press absolute right-0 flex h-[23px] w-[23px] items-center justify-center rounded-full bg-white/[0.04] backdrop-blur-[2px] transition-colors hover:bg-white/10"
          >
            <IconX className="h-[9px] w-[9px] text-white" />
          </button>
        </div>

        {/*
          WHO IT IS FOR — a horizontal row of everyone in the room, above the
          tray, because you choose the person before the object.

          Only drawn when there is a choice to make. On a broadcast the gift
          goes to the host and there is nobody else, so no row appears rather
          than a row with one selected name in it; a control with a single
          option is a label wearing a control's clothes.

          The host is first and is the default. A sender who never looks at
          this row still gifts the person today's route would have paid, which
          is what makes this safe to ship before the route can name anybody.
        */}
        {people.length > 1 && (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-grey-600">
              Send to
            </p>
            <div
              role="radiogroup"
              aria-label="Who to send this gift to"
              className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {people.map((person) => {
                const chosen = person.id === recipient?.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => setToId(person.id)}
                    className={cn(
                      "ws-press flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      chosen ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"
                    )}
                  >
                    {person.name}
                    {person.isHost && (
                      <span className={cn("text-[10px]", chosen ? "text-black/55" : "text-white/55")}>
                        host
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrolls, so the quantity row and Send stay put — see the note in
            the post tip sheet. */}
        <div className="mt-6 max-h-[min(46dvh,360px)] overflow-y-auto overscroll-contain">
          <GiftGrid
            selectedId={selectedId}
            onSelect={(gift) => setSelectedId(gift.id)}
            showPrices={priced}
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
            onSend(selected, quantity, recipient);
            onClose();
          }}
        >
          {priced
            ? `Send ${selected.name} · ${formatKash(total)}`
            : recipient
              ? `Send ${selected.name} to ${recipient.name}`
              : `Send ${selected.name}`}
        </Button>
        <p className="mt-2 text-center text-[11px] text-grey-600">
          {priced
            ? "Sent from your KASH balance."
            : "Free — everyone watching sees it. KASH gifting turns on when live settlement ships."}
        </p>
      </div>
    </Sheet>
  );
}
