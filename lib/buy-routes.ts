/**
 * Where a `$TICKER` can actually be delivered, and what it costs to try.
 *
 * A buy in Market Square is one cross-chain route: the origin is always the
 * reader's USDC on Base, the destination is the chosen token on its chain, and
 * it settles into the reader's own embedded wallet. This module answers only
 * "which routes exist for this symbol and may we offer them" — the amount, the
 * quote and the transaction live with the execution.
 *
 * Ported from wsws's `lib/buy.ts`, with ONE deliberate narrowing: **Solana
 * destinations are not offerable here.** Delivering to Solana needs a Solana
 * embedded wallet, an SPL transfer, an associated-token-account creation and a
 * Solana RPC — none of which Market Square has, and half-porting them would
 * produce a route that quotes, takes the money on Base and then has nowhere to
 * put the token. A chain we cannot receive on is not a chain we may sell.
 *
 * Pure and dependency-free apart from its sibling `erc20`, so `node --test`
 * pins it: which chain a stranger's `$FOO` resolves to is a decision that ends
 * in a transaction.
 */

import { isPayableAmount, usdcToBaseUnits } from "./erc20.ts";

/** Base. Every buy is funded from USDC here, so it is also the origin chain. */
export const BASE_CHAIN_ID = 8453;

/**
 * Dextopus's synthetic id for Solana. Present so it can be EXCLUDED by name
 * rather than by falling off the supported-chain list by accident — a silent
 * exclusion is one someone re-adds without knowing what it costs.
 */
export const SOLANA_CHAIN_ID = 792703809;

/** Circle's native USDC on Base. The one asset a buy ever spends. */
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export const BUY_ORIGIN = {
  chainId: BASE_CHAIN_ID,
  asset: BASE_USDC,
  decimals: 6,
} as const;

/** One place a symbol can be delivered, as the destinations catalogue lists it. */
export interface BuyRoute {
  destinationChainId: number;
  /** The catalogue's own blockchain label — "base", "arbitrum", … */
  chainName: string;
  /** The destination token's contract address. */
  asset: string;
  /** The catalogue's ticker, which is not always the one a reader typed. */
  symbol: string;
  decimals: number;
  logoUrl: string | null;
}

/**
 * The chains a bought token may land on.
 *
 * Every one of these is EVM and shares the reader's single embedded EVM
 * wallet, which is the whole criterion: the token has to arrive somewhere the
 * reader controls. Kept to the chains wsws also settles on, minus Solana.
 */
const SUPPORTED_CHAINS = new Set([
  "base",
  "ethereum",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
  "avalanche",
  "linea",
  "scroll",
  "zksync",
  "blast",
  "unichain",
  "world-chain",
  "gnosis",
  "celo",
  "ink",
  "soneium",
  "berachain",
  "zora",
]);

/**
 * Tickers whose market symbol is not the symbol the catalogue delivers.
 *
 * Bitcoin has no EVM wallet to arrive in, so a `$BTC` buy is delivered as
 * Coinbase Wrapped BTC on Base. That is not a fudge and it must not be hidden:
 * the sheet says which token settles, because "you bought BTC" and "you hold
 * cbBTC on Base" have to be the same sentence for the reader.
 */
const SYMBOL_ALIAS: Record<string, string> = {
  BTC: "CBBTC",
  DOGE: "CBDOGE",
};

/** Derived, so the alias has exactly one definition. */
const DISPLAY_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_ALIAS).map(([display, catalog]) => [catalog, display])
);

/** The catalogue ticker a reader's symbol resolves to, upper-cased. */
export function catalogSymbol(symbol: string): string {
  const up = symbol.trim().toUpperCase();
  return SYMBOL_ALIAS[up] ?? up;
}

/** The reader-facing ticker for a catalogue symbol — `CBBTC` reads as `BTC`. */
export function displaySymbol(symbol: string): string {
  const up = symbol.trim().toUpperCase();
  return DISPLAY_ALIAS[up] ?? symbol.trim();
}

/**
 * Which network to NAME for a settled buy.
 *
 * cbBTC really does settle on Base, and every functional use — the explorer
 * link, the balance read — keys off that. But "BTC, on Base" beside a coin the
 * reader asked for as Bitcoin reads as a mistake, so the label says Bitcoin
 * while the chain id stays Base.
 */
export function displayNetwork(symbol: string, chainName: string): string {
  return displaySymbol(symbol).toUpperCase() === "BTC" ? "Bitcoin" : chainName;
}

/** May we offer this route at all? */
export function isOfferable(route: BuyRoute): boolean {
  // Named explicitly, not merely absent from the set above, because the cost
  // of re-adding it without the wallet plumbing is a buy that takes the money
  // and has nowhere to deliver.
  if (route.destinationChainId === SOLANA_CHAIN_ID) return false;
  if (!SUPPORTED_CHAINS.has(route.chainName.trim().toLowerCase())) return false;
  return Number.isFinite(route.destinationChainId) && route.asset.trim().length > 0;
}

/**
 * Base first, then alphabetically by chain.
 *
 * Two behaviours fall out of this one ordering rather than needing their own
 * rules: the first route is the one to select by default, and a list of length
 * one means there is no chain choice to put in front of the reader.
 */
export function sortRoutes(routes: BuyRoute[]): BuyRoute[] {
  const rank = (route: BuyRoute) => (route.destinationChainId === BASE_CHAIN_ID ? 0 : 1);
  return [...routes].sort(
    (a, b) => rank(a) - rank(b) || a.chainName.localeCompare(b.chainName)
  );
}

/** Every offerable route for a reader's symbol, best first. */
export function routesForSymbol(
  destinations: readonly BuyRoute[] | null | undefined,
  symbol: string
): BuyRoute[] {
  const want = catalogSymbol(symbol);
  return sortRoutes(
    (destinations ?? []).filter(
      (route) => route.symbol.trim().toUpperCase() === want && isOfferable(route)
    )
  );
}

/** The route to pre-select, or null when the symbol cannot be delivered here. */
export function defaultRouteForSymbol(
  destinations: readonly BuyRoute[] | null | undefined,
  symbol: string
): BuyRoute | null {
  return routesForSymbol(destinations, symbol)[0] ?? null;
}

/**
 * The smallest buy worth attempting, in dollars.
 *
 * Below this the routing fee and the destination-side costs can eat the whole
 * order, so it comes out the far side worth less than it went in. Solana's
 * higher floor is not here because Solana is not offerable.
 */
export const MIN_BUY_USD = "1";

/**
 * Is an entered amount under the floor?
 *
 * Compared in base units, not as floats — the same discipline as everything
 * else that touches an amount. An amount that is not payable at all is not
 * "below the minimum"; it is invalid, and the caller says so separately rather
 * than showing somebody a minimum when what they typed was "abc".
 */
export function belowMinimumBuy(amount: string): boolean {
  if (!isPayableAmount(amount)) return false;
  return usdcToBaseUnits(amount) < usdcToBaseUnits(MIN_BUY_USD);
}

/** One row of the destinations catalogue, before we have trusted anything. */
interface RawDestination {
  destinationChainId?: unknown;
  blockchain?: unknown;
  currency?: unknown;
  symbol?: unknown;
  decimals?: unknown;
  logoUrl?: unknown;
}

/**
 * The catalogue, parsed.
 *
 * Every field is checked because this payload decides a chain id and a
 * contract address for a transaction. A row missing either is dropped rather
 * than defaulted — there is no sensible default for "which token".
 *
 * `decimals` alone has a fallback of 18, matching wsws: it is used only to
 * render the estimated output, never to size the payment, so a wrong guess
 * mis-renders a preview rather than mis-spending money.
 */
export function parseDestinations(payload: unknown): BuyRoute[] {
  const rows: unknown = Array.isArray(payload)
    ? payload
    : (payload as { destinations?: unknown })?.destinations;
  if (!Array.isArray(rows)) return [];
  const routes: BuyRoute[] = [];
  for (const row of rows as RawDestination[]) {
    const chainId = row?.destinationChainId;
    const asset = row?.currency;
    const symbol = row?.symbol;
    if (typeof chainId !== "number" || !Number.isFinite(chainId)) continue;
    if (typeof asset !== "string" || !asset.trim()) continue;
    if (typeof symbol !== "string" || !symbol.trim()) continue;
    routes.push({
      destinationChainId: chainId,
      chainName: typeof row.blockchain === "string" ? row.blockchain : "",
      asset: asset.trim(),
      symbol: symbol.trim(),
      decimals: typeof row.decimals === "number" && Number.isFinite(row.decimals)
        ? row.decimals
        : 18,
      logoUrl: typeof row.logoUrl === "string" && row.logoUrl ? row.logoUrl : null,
    });
  }
  return routes;
}
