"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { IconMsHandDeposit } from "@/components/ui/design-icons";
import { KashCoin } from "@/components/ui/kash-coin";
import { GiftGrid } from "@/components/ui/gift-grid";
import { LIVE_GIFTS } from "@/lib/gifts";
import { formatKash } from "@/lib/format";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import {
  DEFAULT_TIP_KASH,
  acceptsTipKeystroke,
  parseTipAmount,
  tipAmountMessage,
} from "@/lib/tips";
import { TIP_ERROR_COPY } from "@/lib/tip-errors";
import { useSendTip, useTipCapability } from "@/features/tips/hooks/use-tips";
import {
  tipAmountOutOfBounds,
  tipBoundsMessage,
} from "@/lib/tip-capability";
import type { Tip, TipTarget } from "@/features/tips/lib/types";

/**
 * Pick an amount → confirm → receipt.
 *
 * Three states in one sheet rather than three sheets, because the whole point
 * of a tip is that it is a two-second gesture; a flow that navigates is a flow
 * people abandon. The confirm step exists anyway, and is not optional: it is
 * the last moment before money moves, and it is the only screen that states the
 * amount and the recipient together.
 */
type Stage = "amount" | "confirm" | "sent";

export function TipSheet({
  open,
  onClose,
  target,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  target: TipTarget;
  /**
   * The reader's own KASH balance, rendered beside the amount they are
   * choosing.
   *
   * A SLOT, not a hook call, because the balance belongs to the kash slice and
   * slices never import each other (CLAUDE.md) — it is composed in at
   * `components/layout/home-screen.tsx`, the same way `FollowPill` reaches the
   * feed. It takes the chosen amount so the kash slice can say "that is more
   * than you have" without this sheet ever holding a balance to compare
   * against; `null` while the amount is half-typed and not yet a number.
   *
   * Optional so the sheet still renders where nothing supplies it — the tip
   * flow does not depend on the balance existing.
   */
  balance?: (amountKash: string | null) => React.ReactNode;
}) {
  const capability = useTipCapability().data ?? null;

  /**
   * Gifts the SERVICE would refuse, by id.
   *
   * Production sets `minKash: 1` while the tray's eight cheapest tiles sit
   * under a whole KASH, so those tiles were tappable, confirmable, and then
   * rejected. They are inert now, and the sheet opens on a gift that can
   * actually be sent.
   */
  const unsendableGifts = useMemo(
    () =>
      new Set(
        LIVE_GIFTS.filter(
          (gift) => tipAmountOutOfBounds(gift.priceKash, capability) !== null
        ).map((gift) => gift.id)
      ),
    [capability]
  );

  /** The cheapest gift the service accepts — what the sheet should open on. */
  const openingGift = useMemo(
    () => LIVE_GIFTS.find((gift) => !unsendableGifts.has(gift.id)) ?? null,
    [unsendableGifts]
  );

  const [stage, setStage] = useState<Stage>("amount");
  const [amount, setAmount] = useState<string>(DEFAULT_TIP_KASH);
  const [custom, setCustom] = useState("");
  /**
   * Which gift is lit, kept apart from the amount itself.
   *
   * Two gifts could share a price one day, and a typed amount that happens to
   * equal a gift's price is still a typed amount — deriving the selection from
   * the number would light a tile the reader never chose.
   */
  const [selectedGift, setSelectedGift] = useState<string | null>(
    LIVE_GIFTS.find((gift) => gift.priceKash === DEFAULT_TIP_KASH)?.id ?? null,
  );
  const [receipt, setReceipt] = useState<Tip | null>(null);
  // A 200 whose `status` is "failed": the request succeeded, the payment did
  // not. Tracked separately from `send.isError` because TanStack has no reason
  // to consider it a failure, and this screen must.
  const [settlementFailed, setSettlementFailed] = useState(false);
  const send = useSendTip();
  const recipient = target.recipient;

  /**
   * There is no reset effect here, and that is deliberate: the sheet is
   * remounted on every opening (`TipButton` keys it on an open counter), so
   * every field, the stage, the receipt and the mutation all start fresh
   * because they are new. Resetting in an effect would be the same behaviour
   * with a cascading render and a lint suppression attached.
   *
   * What matters is that it is reset SOMEHOW: a sheet that reopened on the
   * confirm step of an abandoned tip is one tap from sending money the person
   * had already walked away from.
   */

  /**
   * The amount and the lit tile, DERIVED rather than stored.
   *
   * The capability arrives after this sheet mounts, so a stored default of
   * 0.05 would sit there disabled until the reader touched something. Deriving
   * means the sheet self-corrects the moment the service's rules land, with no
   * effect and no second render pass: a preset the service would refuse falls
   * back to the cheapest one it accepts.
   */
  const presetUnsendable = tipAmountOutOfBounds(amount, capability) !== null;
  const effectiveAmount = presetUnsendable && openingGift ? openingGift.priceKash : amount;
  const effectiveGiftId =
    selectedGift && !unsendableGifts.has(selectedGift)
      ? selectedGift
      : presetUnsendable
        ? (openingGift?.id ?? null)
        : selectedGift;

  const chosen = custom.trim() ? custom : effectiveAmount;
  const parsed = parseTipAmount(chosen);
  /**
   * The server's own bounds, checked BEFORE the confirm step rather than at
   * the end of it. `parseTipAmount` says whether the text is an amount; this
   * says whether the service will take it.
   */
  const outOfBounds = parsed.ok ? tipAmountOutOfBounds(parsed.amountKash, capability) : null;

  const failureCopy = (() => {
    // Discovered mid-flow: the route 404'd, so tipping is not deployed on this
    // build. `errorMessage`'s generic NOT_FOUND copy ("that wasn't found") would
    // read as though the POST had vanished, which tells the person nothing
    // about their money.
    if (send.unavailable)
      return "Tipping isn't switched on yet. Nothing was sent.";
    if (settlementFailed)
      return "The payment did not complete. No KASH left your balance.";
    if (!send.isError) return null;
    const code = errorCode(send.error);
    return (
      (code && TIP_ERROR_COPY[code]) ??
      errorMessage(send.error, "The tip didn't go through. Nothing was sent.")
    );
  })();

  const confirm = () => {
    if (!parsed.ok) return;
    setSettlementFailed(false);
    send.mutate(
      { target, amountKash: parsed.amountKash },
      {
        onSuccess: (tip) => {
          // "failed" is a completed request that did NOT move money. It is a
          // 200, so it would sail straight into a success screen if the only
          // thing checked were the HTTP result — which is exactly how an
          // interface ends up telling someone they tipped when they did not.
          if (tip.status === "failed") {
            setSettlementFailed(true);
            return;
          }
          setReceipt(tip);
          setStage("sent");
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      // On the confirm step the chrome shows a back ARROW, so it has to go
      // back — a back arrow that dismisses the dialog is a different control
      // wearing the same glyph.
      onClose={stage === "confirm" ? () => setStage("amount") : onClose}
      title={stage === "sent" ? "Tip sent" : "Tip your creator"}
      back={stage === "confirm"}
    >
      {/* Who is being tipped — on every step, because "confirm" with no name
          on screen is not a confirmation of anything. */}
      {recipient && stage !== "sent" && (
        <div className="mb-5 flex items-center gap-3">
          <Avatar
            name={recipient.displayName}
            seed={recipient.id}
            src={recipient.avatarUrl}
            size={40}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-white">
              {recipient.displayName}
            </p>
            <p className="truncate text-[13px] text-white/50">
              @{recipient.username}
            </p>
          </div>
        </div>
      )}

      {stage === "amount" && (
        <>
          {/*
            The amount is chosen by choosing a GIFT.
            
            It used to be six numbered chips — 1, 5, 10, 25, 50, 100 — which is
            a form asking someone to price their own gratitude. The design
            answers that with objects: a rose says something a "1" cannot, and
            the number under it is the same information without the arithmetic.
            The ladder is the same one either way, so nothing about what
            arrives in the recipient's balance changed.

            `selectedId` is null the moment a custom amount is typed, because
            two things cannot both be the chosen amount and a grid still
            showing a highlighted rose while the field reads 250 is a lie about
            what pressing Continue will send.
          */}
          {/*
            The grid scrolls; the amount field and Continue do not.

            Fourteen gifts is five rows, and at the design's row rhythm that is
            a sheet taller than a phone — so the commit button sat below the
            fold and the sheet read as a page. A picker whose primary action
            has to be scrolled to is a picker people abandon.

            The cap is in `dvh` so it answers to the visible viewport rather
            than a guess about the device, and it deliberately cuts a row in
            half: a grid that ends flush at the fold looks finished, and nobody
            scrolls a thing that looks finished.
          */}
          {/* Bounded, so the SHEET stays a sheet. Pinning the commit row
              fixed the reach problem but not the size one: a 790px dialog is
              a page with a shadow. Three rows visible, the fourth cut, is
              enough to say "there are more" without turning the picker into
              the screen. */}
          <div className="max-h-[min(38dvh,300px)] overflow-y-auto overscroll-contain pr-0.5">
            <GiftGrid
              selectedId={effectiveGiftId}
              unavailable={unsendableGifts}
              onSelect={(gift) => {
                setSelectedGift(gift.id);
                setAmount(gift.priceKash);
                setCustom("");
              }}
            />
          </div>

          {/*
            The amount and the commit stick to the bottom; the gifts scroll
            behind them.

            Fourteen gifts is five rows, and at the design's rhythm that is
            taller than a phone — so Continue sat below the fold and the sheet
            read as a page. A picker whose primary action has to be scrolled to
            is a picker people abandon. Pinning it also means the amount is
            visible while the reader is still choosing, which is the one number
            they are deciding about.

            `-mx-5 px-5` because the sheet's own padding is on the scroll
            container: without it the pinned block would be a floating island
            with the grid visible down both sides of it.
          */}
          <div className="sticky bottom-0 -mx-5 mt-4 bg-sheet px-5 pb-1 pt-3">
            {/* What they HAVE, above what they are about to spend. The sheet
                used to ask people to price their gratitude without ever
                telling them their balance, so the only way to find out you
                could not afford a tip was to send it and read the failure. */}
            {balance?.(parsed.ok ? parsed.amountKash : null)}
            <div className="mt-2">
              <p className="mb-1.5 text-[13px] text-white/50">
                Or another amount
              </p>
              {/* `ws-field` is the WRAPPER, per its definition — it owns the pill
                and the focus-within treatment, and the input inside it is
                bare. */}
              <label className="ws-field flex h-11 items-center gap-2 px-4">
                <KashCoin size={16} className="shrink-0" />
                <input
                  inputMode="decimal"
                  value={custom}
                  placeholder="0"
                  onChange={(e) => {
                    setSelectedGift(null);
                    // Filtered per keystroke so an amount that could never be
                    // sent cannot be typed — and half-typed ones still can.
                    if (acceptsTipKeystroke(e.target.value))
                      setCustom(e.target.value);
                  }}
                  className="min-w-0 flex-1 bg-transparent tnum text-[15px] text-white outline-none placeholder:text-white/30"
                  aria-label="Tip amount in KASH"
                />
                <span className="shrink-0 text-[13px] text-white/40">KASH</span>
              </label>
            </div>

            {/* Silent until there is something to correct: an error under an
              untouched field reads as the form being broken. */}
            {!parsed.ok &&
              parsed.reason !== "empty" &&
              custom.trim() !== "" && (
                <p className="mt-2 text-[13px] text-down">
                  {tipAmountMessage(parsed.reason)}
                </p>
              )}

            {/* The service's bound, named. This used to be discovered only
                after the confirm step, as a generic failure. */}
            {parsed.ok && outOfBounds && capability && (
              <p className="mt-2 text-[13px] text-down">
                {tipBoundsMessage(outOfBounds, capability)}
              </p>
            )}

            <Button
              className="mt-3 w-full"
              size="lg"
              disabled={!parsed.ok || outOfBounds !== null}
              onClick={() => setStage("confirm")}
            >
              Continue
            </Button>
          </div>
        </>
      )}

      {stage === "confirm" && parsed.ok && (
        <>
          <div className="ws-inset flex flex-col items-center gap-2 px-5 py-7">
            <IconMsHandDeposit className="h-7 w-7 text-spotlight-chip-ink" />
            <p className="ws-display tnum text-3xl text-white">
              {formatKash(parsed.amountKash)}
            </p>
            <p className="text-center text-[13px] text-white/50">
              {recipient
                ? `Goes to @${recipient.username}.`
                : "Goes to the author of this post."}{" "}
              Tips cannot be reversed.
            </p>
          </div>

          {failureCopy && (
            <p role="alert" className="mt-4 text-center text-[13px] text-down">
              {failureCopy}
            </p>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            loading={send.isPending}
            // Nothing to retry once the route is known to be absent.
            disabled={send.isPending || send.unavailable}
            onClick={confirm}
          >
            {send.isError || settlementFailed
              ? "Try again"
              : `Send ${formatKash(parsed.amountKash)}`}
          </Button>
          <button
            type="button"
            onClick={() => setStage("amount")}
            disabled={send.isPending}
            className="mt-3 w-full text-[13px] text-white/50 transition-colors hover:text-white disabled:opacity-40"
          >
            Change amount
          </button>
        </>
      )}

      {/* The receipt renders the SERVER's numbers — its amount, its id — not
          the ones we sent. If the two ever disagree, the person reads what
          actually happened. */}
      {stage === "sent" && receipt && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <IconMsHandDeposit className="h-9 w-9 text-spotlight-chip-ink" />
          <p className="ws-display tnum text-3xl text-white">
            {formatKash(receipt.amountKash)}
          </p>
          <p className="text-[14px] text-body">
            {receipt.status === "settled" ? "Sent to " : "On its way to "}
            <span className="font-bold text-white">
              @{receipt.recipient.username}
            </span>
          </p>
          {receipt.status === "pending" && (
            <p className="text-[12px] text-white/40">
              Still settling — it will show in their balance shortly.
            </p>
          )}
          <p className="tnum text-[11px] text-white/30">{receipt.tipId}</p>
          <Button
            className="mt-3 w-full"
            size="lg"
            variant="secondary"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      )}
    </Sheet>
  );
}
