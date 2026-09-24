"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { LIVE_GIFTS, type LiveGift } from "@/lib/gifts";
import { multiplyKash } from "@/lib/kash-amount";
import { asset } from "@/lib/square-path";

/**
 * BUY A GIFT — node 1285:83137, 372 x 600 at a 22 radius.
 *
 * The same glass as every dialog in this file (`#101012` at 62% behind a
 * background blur, ringed by a 1px INSIDE stroke at white/18), a title that
 * names the gift, the artwork large enough to be the point, a quantity
 * stepper beside the total, and one purple action.
 *
 * Built on `Sheet` in its `bare` mode rather than as its own dialog: the
 * portal, backdrop, Escape, scroll lock and reduced-motion entrance are the
 * parts worth sharing, and a second implementation is how one modal ends up
 * without an Escape handler.
 *
 * ─── WHAT THE FILE DRAWS THAT THIS DOES NOT ─────────────────────────────────
 * The Pay button's node carries a `User` instance and an `ArrowRight`
 * instance either side of its label. NEITHER IS IN THE RENDER — they are
 * invisible in the file, so the button is the label alone. The PNG wins over
 * the node tree, which is the whole reason step 3 of the protocol exists.
 *
 * ─── THE TWO CHEVRONS ARE NOT A PAIR ────────────────────────────────────────
 * Prev is ringed white/40 with a white glyph; NEXT is ringed `#9F65FD` with a
 * `#7E3BEB` glyph. That asymmetry is deliberate in the file and it is doing
 * work — the accented one is the direction the design wants you to travel, so
 * browsing the tray forward is the lit path and going back is the quiet one.
 * Drawing them identically would have flattened a decision into a symmetry.
 */
export function BuyGiftSheet({
  open,
  giftId,
  onClose,
  onConfirm,
  /**
   * WHY BUYING CANNOT HAPPEN YET, when it cannot.
   *
   * Not a boolean. A disabled button with no sentence is a dead end a reader
   * has to guess at, and this one is disabled for a reason they could never
   * infer — see `ProfileGiftGallery`, which holds the reason so there is one
   * source for it rather than two that drift.
   */
  disabledReason,
}: {
  open: boolean;
  /** Which gift the tray opened on. Prev/next walk the catalogue from here. */
  giftId: string | null;
  onClose: () => void;
  onConfirm?: (gift: LiveGift, quantity: number) => void;
  disabledReason?: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      bare
      panelClassName="w-[372px] max-w-[calc(100vw-32px)] rounded-[22px] bg-[rgba(16,16,18,0.62)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur-[14px]"
    >
      {/*
        STATE IS RESET BY A KEY, NOT BY AN EFFECT.

        Reopening on a different tile must land on THAT gift rather than on
        wherever the last visit wandered to. Doing that by setting state inside
        an effect costs a second render every time the dialog opens and is the
        cascading-render pattern React warns about; remounting on the gift id
        is the same intent expressed as identity, so the body simply begins
        life on the right gift.
      */}
      <BuyGiftBody
        key={giftId ?? "none"}
        giftId={giftId}
        onClose={onClose}
        onConfirm={onConfirm}
        disabledReason={disabledReason}
      />
    </Sheet>
  );
}

function BuyGiftBody({
  giftId,
  onClose,
  onConfirm,
  disabledReason,
}: {
  giftId: string | null;
  onClose: () => void;
  onConfirm?: (gift: LiveGift, quantity: number) => void;
  disabledReason?: string;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(0, LIVE_GIFTS.findIndex((gift) => gift.id === giftId))
  );
  const [quantity, setQuantity] = useState(1);

  const gift = LIVE_GIFTS[index] ?? LIVE_GIFTS[0];
  /*
    EXACT, never `Number(price) * quantity`. Three Roses at 0.01 is 0.03, and
    the float answer is 0.030000000000000002 — which the engine rejects for
    exceeding six places, and which is not the number the buyer was shown.
    Null falls back to the unit price rather than printing a total this sheet
    cannot stand behind.
  */
  const total = multiplyKash(gift.priceKash, quantity) ?? gift.priceKash;
  const step = (delta: number) =>
    setQuantity((current) => Math.min(99, Math.max(1, current + delta)));

  return (
    <>
      {/* `Heading 4` — 43 tall, the title against a round close at the end. */}
      <div className="flex h-[43px] items-center justify-between">
        <h2 className="text-[16px] font-bold leading-6 text-white">
          Buy Gift - {gift.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ws-press grid size-[43px] shrink-0 place-items-center rounded-full bg-white/[0.04]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
          <img src={asset("/gifts/gift-modal-close.svg")} alt="" aria-hidden className="size-[22px]" />
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-6">
        {/* `Frame 2147230529` — 338 tall at a 32 radius on `#1C1C1C`, with the
            chevrons laid OVER it rather than under: the file floats them on the
            artwork at its vertical centre. */}
        <div className="relative grid h-[338px] place-items-center overflow-hidden rounded-[32px] bg-[#1C1C1C]">
          {/* eslint-disable-next-line @next/next/no-img-element -- catalogue artwork */}
          <img src={gift.art} alt={gift.name} className="h-[320px] w-auto max-w-full object-contain" />

          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + LIVE_GIFTS.length) % LIVE_GIFTS.length)}
            aria-label="Previous gift"
            className="ws-press absolute left-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/[0.02] ring-[0.39px] ring-white/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gifts/gift-modal-prev.svg")} alt="" aria-hidden className="size-8" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % LIVE_GIFTS.length)}
            aria-label="Next gift"
            className="ws-press absolute right-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/[0.02] ring-[0.39px] ring-[#9F65FD]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gifts/gift-modal-next.svg")} alt="" aria-hidden className="size-8" />
          </button>
        </div>

        {/* `field-caption` — the label 8 above a 40-tall row of two pills 16
            apart: the stepper, then the total. */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold leading-[16.9px] text-white">Select quantity</p>
          <div className="flex items-center gap-4">
            {/* `Button` 162x40 — SPACE_BETWEEN, so the two controls hold the
                ends and the number sits in the middle however wide it gets. */}
            <div className="flex h-10 flex-1 items-center justify-between rounded-full bg-white/[0.05] px-2 py-1 ring-1 ring-white/20">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={quantity <= 1}
                aria-label="One fewer"
                className="ws-press grid size-8 place-items-center rounded-full text-white disabled:opacity-30"
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <span className="tnum text-[15px] font-semibold text-white">{quantity}</span>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={quantity >= 99}
                aria-label="One more"
                className="ws-press grid size-8 place-items-center rounded-full text-white disabled:opacity-30"
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* The total, beside the file's own coin. It is the PRODUCT, not
                the unit price: the file shows 60 against a quantity of 3, so
                the number moves with the stepper. */}
            <div className="flex h-10 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1 ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element -- the file's coin */}
              <img src={asset("/gifts/coin.svg")} alt="" aria-hidden className="size-6 shrink-0" />
              <span className="tnum truncate text-[15px] font-semibold text-white">{total}</span>
            </div>
          </div>
        </div>

        {/* `post-button` — 48 tall, full radius, `#7E3BEB`, the label alone. */}
        <button
          type="button"
          onClick={() => onConfirm?.(gift, quantity)}
          disabled={Boolean(disabledReason) || !onConfirm}
          title={disabledReason}
          /* `ws-btn-lg` IS the file's number here — 48 tall at 16px — so the
             scale is used rather than the height hand-written again. Only the
             700 weight is added: the utility sets size and padding, not
             weight, and the node's label is bold. */
          className="ws-press ws-btn-lg grid w-full place-items-center rounded-full bg-spotlight font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proceed to Pay
        </button>
        {/* Said, not merely implied by a dimmed button: a reader cannot infer
            why this is closed, and a disabled control with no sentence is a
            dead end they have to guess at. */}
        {disabledReason && (
          <p className="-mt-3 text-center text-[12px] leading-5 text-white/50">{disabledReason}</p>
        )}
      </div>
    </>
  );
}
