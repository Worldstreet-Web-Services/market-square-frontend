"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api/envelope";
import { asset } from "@/lib/square-path";
import { useBuyCoins, useCoinBalance, useGiftCapability, type CoinBuyPhase } from "@/features/gifts";
import { useKashAccount } from "@/features/kash";
import { exceedsBalance } from "@/lib/kash-amount";
import { formatKash } from "@/lib/format";

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
  /*
    THE KASH BALANCE, BECAUSE KASH IS WHAT THIS SHEET SPENDS.

    It said "Paid from your KASH balance" and then never said what that balance
    WAS — so somebody holding 0.14 KASH was offered a 50 KASH pack with nothing
    to tell them it was out of reach until the wallet refused it
    (ogazboiz: "it suppose to show my balance of kash but it did not").

    The same `useKashAccount` the earnings card reads, so the two cannot
    disagree about one number. Only while the sheet is open.
  */
  const kash = useKashAccount(open);
  const kashBalance = kash.data?.balance ?? null;
  const buy = useBuyCoins();
  const [phase, setPhase] = useState<CoinBuyPhase | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  /*
    A PURCHASE THAT HAS BEEN PAID FOR AND IS WAITING ON THE CHAIN.

    ogazboiz paid THREE TIMES for one pack of coins, roughly two minutes
    apart, and every payment was real: 0.01 KASH each, all three on Base,
    all three to the treasury. The settlement bug took his money once. The
    SILENCE took it the other two times — the sheet toasted "on their way"
    and closed, he landed back on a tray still reading 0 coins, and the
    only control in front of him was Buy again.

    So the sheet now STAYS OPEN and says it is waiting. Any step where
    money leaves before the thing arrives needs a visible in-between, or
    people pay again — which is a rule about payments, not about coins.
  */
  const [awaiting, setAwaiting] = useState<{ coins: number; from: number } | null>(null);

  /*
    THE NOTICE CLEARS WHEN THE THING IT PROMISED ARRIVES, and not on a
    timer. `from` is the balance at the moment of paying, so this waits for it
    to actually RISE rather than for it to be non-zero — a buyer who already
    held coins would otherwise never see the notice at all.

    DERIVED, not stored and cleared in an effect. Clearing it from an effect
    sets state during render and cascades, and the answer is a pure function
    of two things already on screen: what they paid for, and what the balance
    has done since. Nothing to synchronise, so nothing to synchronise it with.
  */
  const waiting = awaiting !== null && !(balance !== null && balance > awaiting.from);

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

  /*
    WHAT A PACK COSTS, IN EXACT KASH.

    This read `(coins / rate).toFixed(rate % coins === 0 ? 0 : 2)` — the modulo
    the wrong way round, so at a rate of 1000 the 10-coin pack asked
    `1000 % 10 === 0`, rounded to zero places, and RENDERED AS "0 KASH". The
    cheapest pack in the sheet advertised itself as free. Every other rung
    happened to survive by luck, which is why it looked fine until the tray
    sent somebody here for a single Rose.

    Integer arithmetic, never a float and never `toFixed`: both the coin count
    and the rate are whole numbers, so the whole part and the remainder are
    exact by construction. 0.01 KASH is a real price and has to print as 0.01,
    not as nothing.
  */
  const kashFor = (coins: number): string => {
    if (!rate) return "—";
    const whole = Math.floor(coins / rate);
    const rest = coins % rate;
    if (rest === 0) return String(whole);
    // Padded to the rate's width, then trimmed — 10/1000 is ".010" is "0.01".
    const frac = String(rest).padStart(String(rate).length - 1, "0").replace(/0+$/u, "");
    return `${whole}.${frac}`;
  };

  return (
    <Sheet open={open} onClose={onClose} title="Get Square Coins">
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[13px] leading-5 text-grey-300">
          Coins are what the gift tray spends. Buy them with the KASH in your wallet.
        </p>

        <div className="flex items-center justify-between gap-3 text-[13px] text-grey-300">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/gifts/coin.svg")} alt="" aria-hidden className="size-5 shrink-0" />
            <span className="tnum font-semibold text-white">
              {balance === null ? "—" : balance.toLocaleString()}
            </span>
            <span>coins</span>
          </span>
          {/* What is being SPENT, beside what is being bought. */}
          <span className="tnum">
            {kashBalance === null ? "" : `${formatKash(kashBalance)} KASH`}
          </span>
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
              {packs.map((coins) => {
                /*
                  A PACK BEYOND THE WALLET IS MARKED, NOT HIDDEN.

                  Everywhere else in this app being short is a DETOUR — the
                  gift tray sends you here rather than refusing. Here there is
                  no onward door: this IS the top-up, and the next step would be
                  buying KASH somewhere else entirely. So an unaffordable pack
                  says so instead of taking a tap that the wallet will refuse a
                  screen later.

                  An UNKNOWN balance marks nothing. `kashBalance` is null while
                  the read is in flight or after it failed, and greying the
                  whole sheet out over a slow lookup would be inventing a
                  shortfall we cannot see — the same rule the tray follows.
                */
                const tooDear =
                  kashBalance !== null && exceedsBalance(kashFor(coins), kashBalance);
                return (
                <button
                  key={coins}
                  type="button"
                  onClick={() => setChosen(coins)}
                  disabled={buy.isPending || tooDear}
                  title={tooDear ? "More than your KASH balance" : undefined}
                  className={`ws-press flex flex-col items-start gap-1 rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                    tooDear
                      ? "bg-white/[0.03] text-white/40"
                      : chosen === coins
                        ? "bg-white text-black"
                        : "bg-white/[0.06] text-white"
                  }`}
                >
                  <span className="tnum text-[15px] font-bold">{coins.toLocaleString()} coins</span>
                  <span
                    className={`tnum text-[12px] ${chosen === coins && !tooDear ? "text-black/60" : "text-grey-300"}`}
                  >
                    {kashFor(coins)} KASH
                  </span>
                </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={chosen === null || buy.isPending || purchasable === undefined || waiting}
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
                      // NOT `onClose()`. Closing is what sent him back to a tray
                      // reading 0 coins with Buy as the only thing to press.
                      setAwaiting({ coins: chosen, from: balance ?? 0 });
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
              {waiting
                ? "Waiting for your coins"
                : phase
                  ? SAYS[phase]
                  : chosen === null
                    ? "Pick an amount"
                    : "Buy coins"}
            </button>

            {waiting && awaiting !== null ? (
              /*
                THE IN-BETWEEN THAT WAS MISSING, and the reason it is worded
                this firmly. The balance above still reads 0 at this point and
                will until the service observes the transfer — so the one thing
                this has to do is answer "did it work?" before the buyer
                answers it themselves by paying again.

                It names the amount, because "your coins are coming" with a
                balance of 0 on the same screen reads as a failure.
              */
              <p className="text-center text-[12px] leading-4 text-meta">
                <span className="font-semibold text-white">
                  You paid for {awaiting.coins.toLocaleString()} coins.
                </span>{" "}
                They appear once the transfer confirms, which can take a moment.
                Your balance still shows 0 until then &mdash; don&rsquo;t buy again.
              </p>
            ) : (
              /* The one thing a buyer must not be surprised by: this signs a
                 real transfer from their own wallet. */
              <p className="text-center text-[12px] leading-4 text-meta">
                Paid from your KASH balance. You&rsquo;ll confirm the transfer yourself.
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
