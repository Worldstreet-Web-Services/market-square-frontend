"use client";

import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { KashCoin } from "@/components/ui/kash-coin";
import { errorMessage } from "@/lib/api/envelope";
import { isPayableAmount, usdcToBaseUnits } from "@/lib/erc20";
import { holdKey, newIntentId } from "@/lib/payment-hold";
import { heldPayment } from "@/lib/payment-store";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import {
  useKashBuy,
  useKashDeskBuyQuote,
  useKashDeskInfo,
  useKashPurchaseQuote,
  useKashStatus,
  type BuyPhase,
} from "@/features/kash/hooks/use-kash";

/**
 * Buying KASH, inside Market Square.
 *
 * The reader pays USDC from their own embedded wallet — the same wallet the
 * rest of the platform knows them by — and KASH arrives in it. Nothing here
 * hands off to another product, and nothing here is custodial: every
 * transaction is signed by the reader (ADR-0005, `docs/PAYING_WITH_KASH.md`).
 *
 * ── THE QUOTE COMES FIRST, ALWAYS ──────────────────────────────────────────
 * How much KASH the amount buys, at what price, with the fee named, before
 * anything moves. The fee is taken off the top by the engine whether or not it
 * is displayed, so showing it is what stops "you receive" reading as a bad
 * rate.
 *
 * ── WHY THE BUTTON IS NEVER OPTIMISTIC ─────────────────────────────────────
 * It is disabled for the whole of signing, confirming and crediting, and the
 * label says which of the three is happening. A buy button that stays live
 * while a transaction is in flight is a second payment waiting for an impatient
 * tap, and the two-step flow below is precisely the case where that second
 * payment is real money with nothing to show for it.
 */

/** Presets, filtered against the engine's own bounds before they are offered. */
const PRESETS = ["1", "10", "25", "50", "100"];

const PHASE_LABEL: Record<Exclude<BuyPhase, "idle">, string> = {
  signing: "Confirm in your wallet…",
  confirming: "Confirming on-chain…",
  crediting: "Almost done…",
};

export function KashBuySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address: wallet } = useEmbeddedWallet();
  const status = useKashStatus();
  const [amount, setAmount] = useState("10");
  const [phase, setPhase] = useState<BuyPhase>("idle");
  const [done, setDone] = useState<{ kash: string | null; alreadyCredited: boolean } | null>(null);
  /**
   * A payment that settled and has not been credited yet.
   *
   * The single worst outcome of this flow is somebody not knowing whether they
   * paid, and "the purchase didn't complete" says exactly the wrong thing when
   * the USDC has already left their wallet. So when a failure leaves a receipt
   * held, the sheet says so — and says that trying again credits THAT payment
   * rather than making another, which is the fact that stops them reaching for
   * a second one.
   */
  const [paymentHeld, setPaymentHeld] = useState(false);
  const buy = useKashBuy();

  /**
   * The on-chain sale desk, asked only when the engine is in a real-money mode.
   *
   * Its ANSWERING is what selects the one-signature flow. A 502 — which is what
   * production returns today, with "on-chain desk endpoints are not configured"
   * — means no desk exists, and the two-step flow applies untouched. That is a
   * different thing from a desk that exists and is PAUSED: a pause is a
   * deliberate halt and must stop buying, because falling back to the engine
   * flow would sidestep somebody's decision to stop it.
   */
  const desk = useKashDeskInfo(status.data?.chainMode === "ethers");
  const deskConfigured = Boolean(desk.data);
  const deskPaused = deskConfigured && desk.data?.paused?.sale === true;
  const deskLive = deskConfigured && !deskPaused;

  const deskQuote = useKashDeskBuyQuote(amount, deskLive);
  const engineQuote = useKashPurchaseQuote(amount, !deskConfigured);

  /**
   * One idempotency key per ATTEMPT, minted the first time an amount is
   * submitted and kept for every retry of that same amount.
   *
   * Not minted inside the request, which would produce a new key on each retry
   * and protect nothing; not minted once per sheet either, which would let a
   * changed amount inherit the previous purchase's identity.
   */
  const intentKeys = useRef(new Map<string, string>());
  const intentKeyFor = (key: string): string => {
    const existing = intentKeys.current.get(key);
    if (existing) return existing;
    const minted = newIntentId("kash-purchase");
    intentKeys.current.set(key, minted);
    return minted;
  };

  const min = status.data?.desk?.purchaseMinUsdc ?? 1;
  const max = status.data?.desk?.purchaseMaxUsdc ?? 10_000;
  const valid =
    isPayableAmount(amount) &&
    usdcToBaseUnits(amount) >= usdcToBaseUnits(String(min)) &&
    usdcToBaseUnits(amount) <= usdcToBaseUnits(String(max));

  const busy = phase !== "idle" || buy.isPending;
  // Unreachable engine, no wallet, or a deliberate halt: there is nothing a
  // press could achieve.
  const unavailable = status.isError || !wallet || deskPaused;
  const canSubmit = Boolean(wallet) && valid && !busy && !unavailable;

  const shownKash = deskLive ? deskQuote.data?.kashOut : engineQuote.data?.kashReceived;
  const shownPrice = deskLive ? desk.data?.priceUsd : engineQuote.data?.kashPriceUsd;
  const quoting = deskLive ? deskQuote.isFetching : engineQuote.isFetching;

  const submit = () => {
    const key = holdKey("kash-purchase", amount);
    if (!wallet || !key || !status.data) return;
    buy.mutate(
      {
        wallet,
        usdcAmount: amount,
        intentKey: intentKeyFor(key),
        holdKey: key,
        status: status.data,
        useDesk: deskLive,
        onPhase: setPhase,
      },
      {
        onSuccess: (result) => {
          setPhase("idle");
          setDone({ kash: result.kashReceived, alreadyCredited: result.alreadyCredited });
        },
        onError: () => {
          setPhase("idle");
          // Read in the handler, never during render: it is session storage,
          // and it is only meaningful once an attempt has failed.
          setPaymentHeld(Boolean(heldPayment("kash", wallet, key)));
        },
      }
    );
  };

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title="Get KASH">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <KashCoin size={36} />
          {/* The engine's number, not ours. Where the two could ever disagree,
              the person reads what actually happened. */}
          <p className="ws-display tnum text-3xl text-white">
            {done.kash ? `${done.kash} KASH` : "KASH added"}
          </p>
          <p className="text-[14px] text-body">
            {done.alreadyCredited
              ? // Reached through the engine refusing to settle one payment
                // twice. It is a success: the money moved and the KASH exists;
                // an earlier attempt's answer was simply lost.
                "This payment had already gone through — your KASH is in your wallet."
              : "It's in your wallet."}
          </p>
          <Button className="mt-3 w-full" size="lg" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <>
          {/* Engine absent. Say so plainly rather than showing a form that
              cannot submit — "not deployed here" is a fact about the
              environment, not a failure the reader can retry into working. */}
          {status.isError ? (
            <p className="py-6 text-center text-[14px] text-white/50">
              Buying KASH isn&apos;t available here yet.
            </p>
          ) : (
            <>
              <div>
                <label
                  htmlFor="kash-buy-amount"
                  className="text-[13px] text-white/50"
                >
                  Amount in USDC
                </label>
                <div className="ws-field mt-1.5 flex h-12 items-center gap-2 px-4">
                  <span className="shrink-0 text-[15px] text-white/40">$</span>
                  <input
                    id="kash-buy-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={busy}
                    className="min-w-0 flex-1 bg-transparent tnum text-[17px] text-white outline-none placeholder:text-white/30"
                    placeholder="10"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  {/* Only presets the engine would actually accept. Offering
                      $100 while the cap is $25 means a tap that the form then
                      refuses, with the reason buried in a bounds message. */}
                  {PRESETS.filter(
                    (preset) => Number(preset) >= min && Number(preset) <= max
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={busy}
                      onClick={() => setAmount(preset)}
                      className={`ws-press flex-1 rounded-xl border px-2 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${
                        amount === preset
                          ? "border-spotlight-chip-ink bg-spotlight/30 text-spotlight-chip-ink"
                          : "border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ws-inset mt-4 px-4 py-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-white/55">You receive</span>
                  <span className="tnum font-semibold text-white">
                    {shownKash ? `${shownKash} KASH` : quoting ? "…" : "–"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-white/45">Price per KASH</span>
                  <span className="tnum text-white/60">
                    {shownPrice ? `$${shownPrice}` : quoting ? "…" : "–"}
                  </span>
                </div>
                {/* The fee is charged whether or not it is shown. Showing it is
                    what keeps "you receive" from reading as a bad rate. */}
                {!deskLive && engineQuote.data?.feeUsd && (
                  <div className="mt-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-white/45">
                      Fee{engineQuote.data.feePct != null ? ` (${engineQuote.data.feePct}%)` : ""}
                    </span>
                    <span className="tnum text-white/60">${engineQuote.data.feeUsd}</span>
                  </div>
                )}
              </div>

              {!wallet && (
                <p className="mt-3 text-[12.5px] text-white/50">
                  Sign in to buy KASH.
                </p>
              )}
              {deskPaused && (
                <p className="mt-3 text-[12.5px] text-down">
                  KASH sales are paused right now.
                </p>
              )}
              {!valid && amount.trim() !== "" && (
                <p className="mt-3 text-[12.5px] text-white/50">
                  Between ${min} and ${max.toLocaleString("en-US")}.
                </p>
              )}
              {buy.isError && (
                <p role="alert" className="mt-3 text-[13px] text-down">
                  {errorMessage(buy.error, "The purchase didn't complete.")}
                </p>
              )}
              {paymentHeld && (
                <p className="mt-2 text-[13px] text-white/60">
                  Your payment went through and hasn&apos;t been credited yet. Trying
                  again completes that payment — you won&apos;t be charged twice.
                </p>
              )}

              <Button
                className="mt-5 w-full"
                size="lg"
                loading={busy}
                disabled={!canSubmit}
                onClick={submit}
              >
                {phase === "idle"
                  ? buy.isError
                    ? paymentHeld
                      ? "Finish this purchase"
                      : "Try again"
                    : `Buy KASH for $${amount || "0"}`
                  : PHASE_LABEL[phase]}
              </Button>

              {/* Two sentences the reader is owed BEFORE they press it: that
                  they will be asked to sign, and that this cannot be undone.
                  Selling back is halted at the treasury today, so "sell it
                  back later" would be a promise nothing can keep. */}
              <p className="mt-3 text-center text-[12px] leading-[1.5] text-white/40">
                You&apos;ll approve the payment in your wallet. USDC on Base leaves your
                wallet and KASH arrives in it. Purchases can&apos;t be reversed.
              </p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
