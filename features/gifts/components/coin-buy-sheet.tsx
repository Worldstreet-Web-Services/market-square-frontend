"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api/envelope";
import { asset } from "@/lib/square-path";
import { useBuyCoins, useCoinBalance, useGiftCapability, type CoinBuyPhase } from "@/features/gifts";

/**
 * BUY SQUARE COINS WITH KASH.
 *
 * The step that was missing, and the reason being short of coins was a dead
 * end: the tray's "Get more" opened the KASH top-up, so somebody with KASH
 * already in their wallet was sent to buy MORE KASH and came back with exactly
 * as many coins as before — zero (ogazboiz, 2026-09-24: "i have to buy kash for
 * me to get coin when i have some kash in my wallet").
 *
 * KASH and coins are different things. KASH is the money; coins are what the
 * tray spends. This is the one place they convert, and until it existed the
 * conversion simply could not be performed in the product.
 *
 * ─── THE PACKS ARE DERIVED FROM THE RATE, NEVER TYPED OUT ────────────────────
 * `coinsPerKash` comes from the service so a reprice is one deploy rather than
 * two; the packs below are whole numbers of KASH through that rate, so they
 * cannot drift from it. The shortfall pack is first when there is one, because
 * the overwhelmingly common reason to open this sheet is that a specific gift
 * was a specific number of coins out of reach.
 *
 * ─── THIS IS THE ONLY STEP WHERE REAL MONEY MOVES ────────────────────────────
 * So it is PENDING by design: the buyer signs a transfer themselves — the KASH
 * rail exposes mint and burn and no transfer, and the platform is
 * non-custodial — and the service credits nothing until it has seen the chain.
 * Buying a GIFT with coins is the opposite and settles instantly. A spinner on
 * the wrong one of those two either fakes work or promises coins nobody paid
 * for.
 */

/** What each phase is actually waiting on, in the buyer's words. */
const SAYS: Record<CoinBuyPhase, string> = {
  creating: "Opening your purchase…",
  signing: "Confirm the transfer in your wallet…",
  confirming: "Waiting for the network…",
  reporting: "Almost there…",
};

export function CoinBuySheet({
  open,
  onClose,
  /** How many coins the buyer was short, when they arrived here from a tray. */
  needed = 0,
}: {
  open: boolean;
  onClose: () => void;
  needed?: number;
}) {
  const capability = useGiftCapability();
  const balance = useCoinBalance(open);
  const buy = useBuyCoins();
  const [phase, setPhase] = useState<CoinBuyPhase | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const rate = capability.data?.coinsPerKash ?? null;
  /*
    THREE STATES, NOT TWO. `undefined` while the read is in flight must not
    render as "switched off" — a sheet that flashes a refusal on every open is
    wrong half the time.
  */
  const purchasable = capability.data?.purchasable;

  // Whole KASH through the service's own rate, plus the exact shortfall.
  const packs = rate
    ? [
        ...(needed > 0 && needed > (balance ?? 0) ? [needed - (balance ?? 0)] : []),
        rate,
        rate * 5,
        rate * 10,
        rate * 50,
      ].filter((coins, i, all) => coins > 0 && all.indexOf(coins) === i)
    : [];

  const kashFor = (coins: number) =>
    rate ? (coins / rate).toFixed(rate % coins === 0 ? 0 : 2).replace(/\.00$/u, "") : "—";

  return (
    <Sheet open={open} onClose={onClose} title="Get Square Coins">
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[13px] leading-5 text-grey-300">
          Coins are what the gift tray spends. Buy them with the KASH in your wallet.
        </p>

        <div className="flex items-center gap-2 text-[13px] text-grey-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/gifts/coin.svg")} alt="" aria-hidden className="size-5 shrink-0" />
          <span className="tnum font-semibold text-white">
            {balance === null ? "—" : balance.toLocaleString()}
          </span>
          <span>right now</span>
        </div>

        {/*
          `purchasable: false` MEANS NO TREASURY IS CONFIGURED — there is
          nowhere to send the money, so every purchase would be refused. Said
          plainly instead of offering a button that always fails, and NOT
          treated as an error: it is a fact about the deployment.
        */}
        {purchasable === false ? (
          <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-[13px] leading-5 text-grey-300">
            Coin top-ups aren&rsquo;t switched on yet. Gifts you already own still send, and
            nothing here will charge you until they are.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {packs.map((coins) => (
                <button
                  key={coins}
                  type="button"
                  onClick={() => setChosen(coins)}
                  disabled={buy.isPending}
                  className={`ws-press flex flex-col items-start gap-1 rounded-2xl px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                    chosen === coins ? "bg-white text-black" : "bg-white/[0.06] text-white"
                  }`}
                >
                  <span className="tnum text-[15px] font-bold">{coins.toLocaleString()} coins</span>
                  <span
                    className={`tnum text-[12px] ${chosen === coins ? "text-black/60" : "text-grey-300"}`}
                  >
                    {kashFor(coins)} KASH
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={chosen === null || buy.isPending || purchasable === undefined}
              onClick={() => {
                if (chosen === null) return;
                buy.mutate(
                  { coins: chosen, onPhase: setPhase },
                  {
                    onSuccess: () => {
                      setPhase(null);
                      /*
                        "on its way", not "added". The purchase is PENDING
                        until the service observes the chain, and saying it
                        landed would be claiming a balance nobody has yet.
                      */
                      toast.success(`${chosen.toLocaleString()} coins are on their way`);
                      onClose();
                    },
                    onError: (error) => {
                      setPhase(null);
                      toast.error(errorMessage(error, "That purchase didn't go through."));
                    },
                  }
                );
              }}
              className="ws-press ws-btn-lg grid w-full place-items-center rounded-full bg-spotlight font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase ? SAYS[phase] : chosen === null ? "Pick an amount" : "Buy coins"}
            </button>

            {/* The one thing a buyer must not be surprised by: this signs a
                real transfer from their own wallet. */}
            <p className="text-center text-[12px] leading-4 text-meta">
              Paid from your KASH balance. You&rsquo;ll confirm the transfer yourself.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
