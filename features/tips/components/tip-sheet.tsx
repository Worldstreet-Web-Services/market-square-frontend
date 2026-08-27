"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { IconMsHandDeposit } from "@/components/ui/design-icons";
import { KashCoin } from "@/components/ui/kash-coin";
import { cn } from "@/lib/cn";
import { formatKash } from "@/lib/format";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import {
  DEFAULT_TIP_KASH,
  TIP_PRESETS_KASH,
  acceptsTipKeystroke,
  isSameTipAmount,
  parseTipAmount,
  tipAmountMessage,
} from "@/lib/tips";
import { TIP_ERROR_COPY } from "@/lib/tip-errors";
import { useSendTip } from "@/features/tips/hooks/use-tips";
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
}: {
  open: boolean;
  onClose: () => void;
  target: TipTarget;
}) {
  const [stage, setStage] = useState<Stage>("amount");
  const [amount, setAmount] = useState<string>(DEFAULT_TIP_KASH);
  const [custom, setCustom] = useState("");
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

  const chosen = custom.trim() ? custom : amount;
  const parsed = parseTipAmount(chosen);

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
      }
    );
  };

  return (
    <Sheet
      open={open}
      // On the confirm step the chrome shows a back ARROW, so it has to go
      // back — a back arrow that dismisses the dialog is a different control
      // wearing the same glyph.
      onClose={stage === "confirm" ? () => setStage("amount") : onClose}
      title={stage === "sent" ? "Tip sent" : "Give a tip"}
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
            <p className="truncate text-[15px] font-bold text-white">{recipient.displayName}</p>
            <p className="truncate text-[13px] text-white/50">@{recipient.username}</p>
          </div>
        </div>
      )}

      {stage === "amount" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {TIP_PRESETS_KASH.map((preset) => {
              const active = isSameTipAmount(preset, chosen);
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setAmount(preset);
                    setCustom("");
                  }}
                  className={cn(
                    "ws-press flex h-12 items-center justify-center gap-1.5 rounded-2xl border text-[15px] font-bold tnum transition-colors",
                    active
                      ? "border-spotlight-chip-ink bg-spotlight/35 text-white"
                      : "border-white/15 bg-white/5 text-body hover:bg-white/10"
                  )}
                >
                  <KashCoin size={16} />
                  {preset}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[13px] text-white/50">Or another amount</p>
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
                  // Filtered per keystroke so an amount that could never be
                  // sent cannot be typed — and half-typed ones still can.
                  if (acceptsTipKeystroke(e.target.value)) setCustom(e.target.value);
                }}
                className="min-w-0 flex-1 bg-transparent tnum text-[15px] text-white outline-none placeholder:text-white/30"
                aria-label="Tip amount in KASH"
              />
              <span className="shrink-0 text-[13px] text-white/40">KASH</span>
            </label>
          </div>

          {/* Silent until there is something to correct: an error under an
              untouched field reads as the form being broken. */}
          {!parsed.ok && parsed.reason !== "empty" && custom.trim() !== "" && (
            <p className="mt-2 text-[13px] text-down">{tipAmountMessage(parsed.reason)}</p>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={!parsed.ok}
            onClick={() => setStage("confirm")}
          >
            Continue
          </Button>
        </>
      )}

      {stage === "confirm" && parsed.ok && (
        <>
          <div className="ws-inset flex flex-col items-center gap-2 px-5 py-7">
            <IconMsHandDeposit className="h-7 w-7 text-spotlight-chip-ink" />
            <p className="ws-display tnum text-3xl text-white">{formatKash(parsed.amountKash)}</p>
            <p className="text-center text-[13px] text-white/50">
              {recipient ? `Goes to @${recipient.username}.` : "Goes to the author of this post."}{" "}
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
          <p className="ws-display tnum text-3xl text-white">{formatKash(receipt.amountKash)}</p>
          <p className="text-[14px] text-body">
            {receipt.status === "settled" ? "Sent to " : "On its way to "}
            <span className="font-bold text-white">@{receipt.recipient.username}</span>
          </p>
          {receipt.status === "pending" && (
            <p className="text-[12px] text-white/40">
              Still settling — it will show in their balance shortly.
            </p>
          )}
          <p className="tnum text-[11px] text-white/30">{receipt.tipId}</p>
          <Button className="mt-3 w-full" size="lg" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Sheet>
  );
}
