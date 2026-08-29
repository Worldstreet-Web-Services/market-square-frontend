/**
 * Which wallet is the reader's OWN — the one decision the KASH proxy rests on.
 *
 * The kash engine has no auth of its own: it keys every account read and every
 * balance on the wallet address in the path, query or body. Our BFF is
 * therefore the only gate in front of it, and the gate is two questions, not
 * one — "is there a verified session?" and "is the wallet this request names
 * the session's own wallet?". Without the second, any signed-in reader could
 * put somebody else's address in the URL and read their balance and points.
 *
 * That check is a comparison between two addresses, which makes it a pure
 * decision — so it lives here, beside `follow-resolve` and `tip-errors`, and
 * is pinned by `lib/wallet.test.ts`. A rule that decides who may read whose
 * money is worth being able to read on its own.
 *
 * Dependency-free and alias-free on purpose: the route handler imports it, the
 * client hook imports it, and `node --test` runs it with native type stripping,
 * which resolves neither `@/` nor `server-only`.
 */

/**
 * One linked account, as either Privy SDK hands it to us.
 *
 * `@privy-io/node` (server) spells these `chain_type` and
 * `wallet_client_type`; `@privy-io/react-auth` (client) spells the same two
 * fields `chainType` and `walletClientType`. Both SDKs describe the same
 * account on the same Privy app, so the RULE is one rule — and reading both
 * spellings here is what keeps it one rule rather than two implementations
 * that agree until one of them is edited.
 *
 * Deliberately structural rather than either SDK's `User` type: this module is
 * the shared bottom layer, and importing a client SDK's types into something
 * the server also uses is how a browser bundle ends up in a route handler.
 */
export interface LinkedAccountLike {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
  walletClientType?: string;
  wallet_client_type?: string;
}

/**
 * A 20-byte EVM address, checked by SHAPE and never by value.
 *
 * Every comparison below requires both sides to match this. That is what stops
 * an empty string, an `undefined` that stringified, or a `null` matching a
 * missing wallet and admitting a request — a gate that answers "yes" when both
 * sides are nothing is not a gate.
 */
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/u;

export function isEvmAddress(value: unknown): value is string {
  return typeof value === "string" && EVM_ADDRESS.test(value);
}

function chainTypeOf(account: LinkedAccountLike): string | undefined {
  return account.chainType ?? account.chain_type;
}

function clientTypeOf(account: LinkedAccountLike): string | undefined {
  return account.walletClientType ?? account.wallet_client_type;
}

/**
 * The caller's EMBEDDED EVM wallet, or null when they do not have one.
 *
 * Embedded ONLY — `wallet_client_type === "privy"`. wsws's equivalent
 * (`lib/server/chess-identity.ts`) falls back to the first linked EVM wallet
 * when there is no embedded one; this deliberately does not, and the
 * difference matters here. That fallback makes the server's answer and the
 * client's answer diverge for anyone who has linked an external wallet: the
 * browser asks about its embedded address, the server proves a different one,
 * and the ownership check below then fails on a request that was perfectly
 * legitimate — or, worse, passes on one that names an address the reader
 * merely connected once.
 *
 * "The wallet Market Square knows you by" is the embedded wallet, full stop.
 * No embedded wallet means no KASH identity, every wallet-scoped call is
 * refused, and the surfaces go quiet — which is the honest answer, not a
 * degraded one.
 */
export function embeddedEvmWallet(
  accounts: readonly LinkedAccountLike[] | null | undefined
): string | null {
  for (const account of accounts ?? []) {
    if (account.type !== "wallet") continue;
    if (chainTypeOf(account) !== "ethereum") continue;
    if (clientTypeOf(account) !== "privy") continue;
    if (isEvmAddress(account.address)) return account.address;
  }
  return null;
}

/**
 * May a session that owns `owned` act on `claimed`?
 *
 * Case-insensitive, because an EVM address is the same address in any casing
 * and a checksummed one typed by a client must not be refused against a
 * lower-cased one stored by the engine. (The engine itself lower-cases every
 * wallet it is given — see `apps/kash`'s controller — so both spellings of one
 * address really do reach the same account.)
 *
 * Everything else is a NO: an absent claim, an absent wallet, or anything that
 * is not address-shaped on either side. There is no shape of missing data that
 * grants access.
 */
export function isOwnWallet(
  claimed: string | null | undefined,
  owned: string | null | undefined
): boolean {
  if (!isEvmAddress(claimed) || !isEvmAddress(owned)) return false;
  return claimed.toLowerCase() === owned.toLowerCase();
}
