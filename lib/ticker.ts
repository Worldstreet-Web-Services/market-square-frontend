/**
 * What a `$TICKER` in a post actually resolves to.
 *
 * Tapping `$BTC` used to leave Market Square for Ark's dashboard. It now opens
 * a sheet HERE, and a sheet has to say something — which turns "is this symbol
 * tradeable?" into three separate questions the surface must answer honestly:
 * is it a ticker at all, do we know its name, and do we have a price we are
 * willing to stand behind. This module answers all three, and every one of
 * them may be "no" independently.
 *
 * Pure and renderer-free, beside `post-segments` (which decides where a ticker
 * IS) rather than inside the sheet, because the sheet's whole job is to not
 * make a claim it cannot support. Pinned by `lib/ticker.test.ts`.
 *
 * NOTE ON THE PRICE BEING A FLOAT. `priceUsd` and `change24h` arrive as JSON
 * numbers from Ark's `/api/square/symbols` catalogue, and they stay numbers.
 * That does not contradict "money is decimal strings": these are a DISPLAY
 * quote from another product, never an amount this app moves, and nothing here
 * or downstream computes with them — they are formatted and shown, full stop.
 * The moment a surface wants to buy at one of them, it needs the amount as a
 * string from whoever is taking the money.
 */

/** One priced market, as Ark's catalogue publishes it. */
export interface TickerMarket {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  logo: string | null;
}

/** What the sheet knows. Every field but `symbol` may be null. */
export interface ResolvedTicker {
  /** Canonical, upper-case. The form every downstream link and lookup uses. */
  symbol: string;
  /** The catalogue's display name — "Bitcoin". Null when it carries no entry. */
  name: string | null;
  /** Null when there is no usable price, which is NOT the same as a price of 0. */
  priceUsd: number | null;
  /** 24-hour change as a PERCENT (`0.69` is 0.69%), matching `CoinChips`. */
  change24h: number | null;
  logo: string | null;
}

/**
 * The same ticker shape `lib/post-segments.ts` extracts: a letter then one to
 * nine more letters or digits. Kept identical on purpose — a sheet that
 * accepted a symbol the parser would never produce is a branch nothing can
 * reach, and one that rejected a symbol the parser DOES produce is a chip that
 * opens an empty dialog.
 */
const TICKER = /^[A-Za-z][A-Za-z0-9]{1,9}$/u;

/** Canonical upper-case form, or null when this is not a ticker. */
export function normaliseTicker(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\$/u, "");
  return TICKER.test(trimmed) ? trimmed.toUpperCase() : null;
}

/**
 * A price we are willing to print.
 *
 * Zero and negative are treated as "no price", not as a price. A catalogue
 * that has not resolved a market yet publishes `0`, and "$0.00" beside a coin
 * is a stronger claim than saying nothing — it tells a reader the thing is
 * worthless.
 */
function usablePrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Resolve a ticker against the catalogue.
 *
 * Null only when the symbol is not a ticker at all. A ticker the catalogue has
 * never heard of still resolves — to itself, with nothing else — because the
 * sheet can honestly say "$FOO" and offer the hand-off without knowing a
 * price. Refusing to open would be a chip that does nothing when tapped.
 */
export function resolveTicker(
  raw: string,
  markets: Iterable<TickerMarket> | null | undefined
): ResolvedTicker | null {
  const symbol = normaliseTicker(raw);
  if (!symbol) return null;

  for (const market of markets ?? []) {
    if (normaliseTicker(market.symbol ?? "") !== symbol) continue;
    return {
      symbol,
      // An empty name is no name. Falling through to the symbol would print
      // "BTC / BTC" as though the catalogue had told us something.
      name: typeof market.name === "string" && market.name.trim() ? market.name.trim() : null,
      priceUsd: usablePrice(market.priceUsd),
      // A change without a price is a percentage of nothing, and reads as a
      // live quote when there is none — so the two travel together.
      change24h:
        usablePrice(market.priceUsd) !== null &&
        typeof market.change24h === "number" &&
        Number.isFinite(market.change24h)
          ? market.change24h
          : null,
      logo: typeof market.logo === "string" && market.logo ? market.logo : null,
    };
  }

  return { symbol, name: null, priceUsd: null, change24h: null, logo: null };
}

/**
 * The price, formatted for reading.
 *
 * Precision scales with magnitude because a fixed two places is wrong at both
 * ends of a coin list: `$95,204.10` needs separators to be read at a glance,
 * and a sub-cent token rendered to two places is `$0.00`, which is the same
 * lie as printing a zero price. Null in, null out — the caller renders nothing
 * rather than a dash that looks like a number that failed.
 */
export function tickerPriceLabel(priceUsd: number | null): string | null {
  if (priceUsd === null) return null;
  const decimals = priceUsd >= 1 ? 2 : priceUsd >= 0.01 ? 4 : 8;
  return `$${priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * "Roughly N tokens" — a PREVIEW, and the only place a price touches an amount.
 *
 * Every real amount in this app is a decimal string or an integer in base
 * units, and nothing computes with floats. This is the one deliberate
 * exception, and it is worth stating exactly why it is safe: the catalogue
 * publishes `priceUsd` as a JSON number, this figure is shown under the words
 * "at today's price", and the amount that is actually bought comes from a
 * quote taken at the moment of purchase. Nothing derived here is ever sent,
 * signed, or compared against a balance.
 *
 * Four significant figures, because more would imply a precision the source
 * price does not have. Null whenever either input is unusable, so the caller
 * renders no line at all rather than "NaN".
 */
export function estimateTokenAmount(usdcAmount: string, priceUsd: number | null): string | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const spend = Number(usdcAmount);
  if (!Number.isFinite(spend) || spend <= 0) return null;
  const estimate = spend / priceUsd;
  if (!Number.isFinite(estimate) || estimate <= 0) return null;
  // `toPrecision` gives exponent notation past a point; a reader should never
  // be shown "1.234e-7" as an amount of a coin.
  return estimate < 0.0001 ? estimate.toFixed(8) : Number(estimate.toPrecision(4)).toString();
}

/**
 * The 24-hour change, always SIGNED.
 *
 * `0.69%` and `+0.69%` read the same at a glance and only one of them is the
 * answer — the same rule `CoinChips` follows, with the same minus sign
 * (U+2212), so one coin does not render two ways on one screen.
 */
export function tickerChangeLabel(change24h: number | null): string | null {
  if (change24h === null) return null;
  const sign = change24h < 0 ? "−" : "+";
  return `${sign}${Math.abs(change24h).toFixed(2)}%`;
}
