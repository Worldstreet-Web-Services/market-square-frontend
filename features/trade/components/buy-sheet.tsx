"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/envelope";
import { canAfford, isPayableAmount } from "@/lib/erc20";
import { holdKey } from "@/lib/payment-hold";
import {
  MIN_BUY_USD,
  belowMinimumBuy,
  displayNetwork,
  displaySymbol,
  routesForSymbol,
} from "@/lib/buy-routes";
import { isSettled, orderProgress } from "@/lib/order-status";
import {
  estimateTokenAmount,
  resolveTicker,
  tickerChangeLabel,
  tickerPriceLabel,
} from "@/lib/ticker";
import { useTradeableMarkets } from "@/hooks/use-tradeable-symbols";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import {
  useBuyDestinations,
  useBuyToken,
  useClearTokenHold,
  useOrderStatus,
  type TokenBuyPhase,
} from "@/features/trade/hooks/use-trade";

/**
 * Tapping `$BTC` in a post, and buying it without leaving.
 *
 * This used to be a link into another product. The reader was reading a post,
 * and the app's answer to "what is this coin" was to close the app. Now the
 * ticker opens here: what the symbol is, what it costs, and — for a signed-in
 * reader whose wallet can fund it — the purchase itself, paid from their own
 * embedded wallet and delivered to the same one.
 *
 * ── WHAT IT WILL AND WILL NOT CLAIM ────────────────────────────────────────
 * Three things can be true independently and the sheet says exactly which:
 * the catalogue may not price this symbol, the provider may not be able to
 * deliver it to a chain we can receive on, and the reader may have no wallet.
 * None of those is an error state; each one is a different sentence. What the
 * sheet never does is show a number it does not have or a button that cannot
 * work.
 *
 * ── THE ORDER IS TRACKED, NOT ASSUMED ──────────────────────────────────────
 * Paying is not receiving. The USDC transfer is one step and the provider's
 * delivery to the destination chain is another, so the sheet stays on the
 * order until it settles, refunds or fails — and it reports what actually
 * happened rather than closing on the transaction hash.
 */

const PRESETS = ["10", "25", "50", "100"];

const PHASE_LABEL: Record<Exclude<TokenBuyPhase, "idle">, string> = {
  quoting: "Getting a price…",
  signing: "Confirm in your wallet…",
  confirming: "Confirming payment…",
};

export function BuySheet({
  symbol,
  open,
  onClose,
}: {
  symbol: string;
  open: boolean;
  onClose: () => void;
}) {
  const markets = useTradeableMarkets();
  const { address: wallet } = useEmbeddedWallet();
  // Only while the sheet is open: a balance read per ticker on screen would be
  // an RPC call for every coin nobody tapped.
  const balance = useUsdcBalance(open);
  const [amount, setAmount] = useState("25");
  const [phase, setPhase] = useState<TokenBuyPhase>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const buy = useBuyToken();
  const clearHold = useClearTokenHold();

  const ticker = useMemo(
    () => resolveTicker(symbol, [...markets.values()]),
    [symbol, markets]
  );

  /**
   * The catalogue is only fetched once the sheet is open.
   *
   * It is an authed call against a shared integration key, and every post on
   * screen carries tickers — asking on render would spend the key on readers
   * who never tapped one.
   */
  const destinations = useBuyDestinations(open);
  const routes = useMemo(
    () => routesForSymbol(destinations.data, ticker?.symbol ?? ""),
    [destinations.data, ticker?.symbol]
  );
  /**
   * Which chain the token is delivered on.
   *
   * Null means "whatever the list leads with", which is Base wherever Base is
   * offered — so the common case needs no decision. The picker below only
   * appears when there is a real choice to make: $ETH is deliverable to
   * eighteen chains and $BTC to exactly one, and offering a one-item chooser
   * is a question with a single answer.
   */
  const [chainId, setChainId] = useState<number | null>(null);
  const route = routes.find((r) => r.destinationChainId === chainId) ?? routes[0] ?? null;

  const order = useOrderStatus(requestId);
  const progress = order.data
    ? orderProgress(order.data.status, order.data.executionStatus)
    : requestId
      ? orderProgress("PENDING")
      : null;

  const done = progress?.terminal === true;
  /**
   * The order is over, so the receipt must not survive to be matched against a
   * future purchase of the same amount. In an effect rather than in render:
   * clearing storage while React is deciding what to draw runs on every
   * re-render and on a render React may throw away.
   */
  useEffect(() => {
    if (done && requestId) clearHold();
    // `clearHold` is a fresh closure each render; the guard above is what makes
    // this fire once per finished order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, requestId]);

  // Every hook above this line runs unconditionally — an early return placed
  // among them would change the hook order between a known and an unknown
  // ticker, which React treats as a different component.
  if (!ticker) return null;

  const priceLabel = tickerPriceLabel(ticker.priceUsd);
  const changeLabel = tickerChangeLabel(ticker.change24h);
  const up = (ticker.change24h ?? 0) >= 0;

  const estimate = estimateTokenAmount(amount, ticker.priceUsd);
  const busy = phase !== "idle" || buy.isPending;
  const tooSmall = belowMinimumBuy(amount);
  const affordable = canAfford(amount, balance.units);
  // Known-empty is different from short: it is worth saying before they pick
  // an amount at all, because no amount would work.
  const noFunds = balance.units === 0n;
  const canSubmit =
    Boolean(wallet && route) && isPayableAmount(amount) && !tooSmall && affordable && !busy;

  // The provider is not configured here, or the symbol has no route we can
  // deliver. Different sentences, because they are different facts.
  const providerAbsent = destinations.isError;
  const noRoute = !providerAbsent && destinations.isSuccess && routes.length === 0;

  const submit = () => {
    const key = holdKey(`token-buy:${ticker.symbol}:${route?.destinationChainId}`, amount);
    if (!route || !key) return;
    buy.mutate(
      { route, usdcAmount: amount, holdKey: key, onPhase: setPhase },
      {
        onSuccess: (result) => {
          setPhase("idle");
          setRequestId(result.requestId);
        },
        onError: () => setPhase("idle"),
      }
    );
  };

  return (
    <Sheet
      open={open}
      // Closing mid-transaction would leave somebody with a payment in flight
      // and no screen following it.
      onClose={busy ? () => {} : onClose}
      title={displaySymbol(ticker.symbol)}
    >
      <div className="flex items-center gap-3">
        {ticker.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a remote catalogue icon, not app media
          <img
            src={ticker.logo}
            alt=""
            aria-hidden
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full bg-white/5"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spotlight/25 text-[13px] font-bold text-spotlight-chip-ink">
            {displaySymbol(ticker.symbol).slice(0, 3)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-white">
            {ticker.name ?? displaySymbol(ticker.symbol)}
          </p>
          {/* No price, no line. A dash where a number belongs reads as a
              number that failed rather than one we never had. */}
          {priceLabel ? (
            <p className="tnum text-[13px] text-white/50">
              {priceLabel}
              {changeLabel ? (
                <span className={cn("ml-2 font-semibold", up ? "text-up" : "text-down")}>
                  {changeLabel}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-[13px] text-white/40">No price right now</p>
          )}
        </div>
      </div>

      {requestId ? (
        <div className="mt-6">
          {/* The order, followed to its end. A transaction hash is not a
              purchase: the payment is one step and the delivery is another. */}
          <p className="text-[15px] font-semibold text-white">{progress?.label}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                progress?.stage === "failed" || progress?.stage === "refunded"
                  ? "bg-down"
                  : "bg-spotlight-chip-ink"
              )}
              style={{ width: `${progress?.pct ?? 10}%` }}
            />
          </div>
          <p className="mt-3 text-[12.5px] leading-[1.5] text-white/45">
            {progress && isSettled(progress.stage)
              ? `${displaySymbol(ticker.symbol)} is in your wallet on ${displayNetwork(
                  ticker.symbol,
                  route?.chainName ?? ""
                )}.`
              : progress?.stage === "refunded"
                ? "Your USDC has been returned to your wallet."
                : progress?.stage === "failed"
                  ? "Nothing further will happen to this order. If your USDC was taken, it is refunded to the same wallet."
                  : "You can close this — the order carries on without the page open."}
          </p>
          <Button className="mt-5 w-full" size="lg" variant="secondary" onClick={onClose}>
            {done ? "Done" : "Close"}
          </Button>
        </div>
      ) : (
        <>
          {providerAbsent ? (
            <p className="mt-6 text-center text-[14px] text-white/50">
              Buying isn&apos;t available here yet.
            </p>
          ) : noRoute ? (
            <p className="mt-6 text-center text-[14px] text-white/50">
              {displaySymbol(ticker.symbol)} can&apos;t be delivered to a wallet we hold.
            </p>
          ) : (
            <>
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="token-buy-amount" className="text-[13px] text-white/50">
                    Spend
                  </label>
                  {/* What they can actually spend, before they choose — and
                      tappable, as wsws's does, so "spend what I have" is one
                      press rather than a number to copy by hand. An unknown
                      balance prints NOTHING rather than a zero: "we could not
                      read it" and "you have none" look identical on screen and
                      call for opposite reactions.

                      `formatted` is floored to cents, so filling the field
                      from it can never ask for more than the wallet holds. */}
                  {wallet && balance.formatted !== null && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAmount(balance.formatted as string)}
                      className="tnum text-[12.5px] text-white/45 transition-colors hover:text-white disabled:opacity-40"
                    >
                      ${balance.formatted} available
                    </button>
                  )}
                </div>
                <div className="ws-field mt-1.5 flex h-12 items-center gap-2 px-4">
                  <span className="shrink-0 text-[15px] text-white/40">$</span>
                  <input
                    id="token-buy-amount"
                    inputMode="decimal"
                    value={amount}
                    disabled={busy}
                    onChange={(event) => setAmount(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent tnum text-[17px] text-white outline-none placeholder:text-white/30"
                    placeholder="25"
                  />
                  <span className="shrink-0 text-[13px] text-white/40">USDC</span>
                </div>
                <div className="mt-2 flex gap-2">
                  {PRESETS.map((preset) => (
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

              {/* An ESTIMATE, and labelled as one. It is derived from the
                  catalogue's price, not from a quote — the real quote is taken
                  at the moment of purchase, and presenting this as the amount
                  that will arrive would be a promise the route does not make. */}
              {estimate && (
                <p className="mt-3 text-[12.5px] text-white/45">
                  Roughly{" "}
                  <span className="tnum text-white/70">
                    {estimate} {displaySymbol(ticker.symbol)}
                  </span>{" "}
                  at today&apos;s price. The exact amount is quoted when you buy.
                </p>
              )}

              {routes.length > 1 && (
                <div className="mt-4">
                  <p className="text-[13px] text-white/50">Deliver on</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {routes.map((option) => {
                      const active = option.destinationChainId === route?.destinationChainId;
                      return (
                        <button
                          key={option.destinationChainId}
                          type="button"
                          disabled={busy}
                          onClick={() => setChainId(option.destinationChainId)}
                          aria-pressed={active}
                          className={`ws-press rounded-lg border px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors disabled:opacity-40 ${
                            active
                              ? "border-spotlight-chip-ink bg-spotlight/30 text-spotlight-chip-ink"
                              : "border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {displayNetwork(option.symbol, option.chainName)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {route && (
                <p className="mt-3 text-[12.5px] text-white/40">
                  Delivered to your wallet on{" "}
                  {displayNetwork(ticker.symbol, route.chainName)}
                  {/* cbBTC really does settle on Base, and the reader is owed
                      the name of the token they will actually hold. */}
                  {displaySymbol(route.symbol) !== route.symbol
                    ? ` as ${route.symbol}`
                    : ""}
                  .
                </p>
              )}

              {!wallet && (
                <p className="mt-3 text-[12.5px] text-white/50">Sign in to buy.</p>
              )}
              {tooSmall && (
                <p className="mt-3 text-[12.5px] text-white/50">
                  The smallest order is ${MIN_BUY_USD}.
                </p>
              )}
              {/* Nothing to spend at all — said plainly, and said before they
                  pick an amount, because no amount would have worked. */}
              {wallet && noFunds && (
                <p className="mt-3 text-[12.5px] text-white/60">
                  You&apos;ll need USDC on Base to buy. Add some to your wallet, then
                  come back.
                </p>
              )}
              {buy.isError && (
                <p role="alert" className="mt-3 text-[13px] text-down">
                  {errorMessage(buy.error, "That order didn't go through.")}
                </p>
              )}

              <Button
                className="mt-5 w-full"
                size="lg"
                loading={busy}
                disabled={!canSubmit}
                onClick={submit}
              >
                {/* The BUTTON says why it will not work, the way wsws's
                    does. A disabled control beside a small grey line makes the
                    reader hunt for the reason; carrying it in the label means
                    the thing they are reaching for is the thing that explains
                    itself. */}
                {phase !== "idle"
                  ? PHASE_LABEL[phase]
                  : !isPayableAmount(amount)
                    ? "Enter an amount"
                    : tooSmall
                      ? `Minimum $${MIN_BUY_USD}`
                      : !affordable
                        ? "Not enough USDC"
                        : buy.isError
                          ? "Try again"
                          : `Buy ${displaySymbol(ticker.symbol)}`}
              </Button>

              {/* Wallet prompts are off (`showWalletUIs: false`), so this
                  button is the confirmation and there is no second screen to
                  stop on. Saying "you'll approve it in your wallet" would
                  describe a prompt that never appears. */}
              <p className="mt-3 text-center text-[12px] leading-[1.5] text-white/40">
                Buying charges your wallet straight away — there&apos;s no second
                confirmation. USDC on Base leaves your wallet and{" "}
                {displaySymbol(ticker.symbol)} arrives in it. Orders can&apos;t be
                cancelled once sent.
              </p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
