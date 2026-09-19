import { NextResponse, type NextRequest } from "next/server";
import { getRequestWallet, verifyRequest } from "@/lib/server/auth";
import { isSafePath } from "@/lib/api/public-routes";
import { isOwnWallet } from "@/lib/wallet";

/**
 * BFF proxy for the KASH engine.
 *
 * ── WHY IT EXISTS AT ALL ───────────────────────────────────────────────────
 * Two reasons, and the second is the important one. The gateway sends no CORS
 * headers, so routing through our own origin is what makes the engine
 * reachable from a browser. And the engine has NO AUTH OF ITS OWN: it keys
 * every account read, every purchase and every balance on the wallet address
 * in the path, the query or the body. Whoever names a wallet gets that
 * wallet's money.
 *
 * ── WHY THE OWNERSHIP CHECK IS LOAD-BEARING ────────────────────────────────
 * That makes this proxy the only gate in front of somebody's balance, and a
 * verified session is only half of it. A session proves you are *a* user; it
 * says nothing about the address in the URL. Without the second check, any
 * signed-in reader could put another reader's wallet in `/accounts/0x…` and
 * read their balance and points — and, on the write paths, spend against a
 * purchase they did not pay for.
 *
 * So every non-public path answers two questions: is there a verified session,
 * and is the wallet this request names the session's OWN embedded wallet
 * (`lib/wallet.ts`, pinned by `lib/wallet.test.ts`)? The wallet comes from
 * the session's issuer server-side — never from the browser, which would make the whole thing
 * decorative — and a path outside the recognised set is refused rather than
 * blind-forwarded, because a proxy that forwards what it does not understand is
 * an open relay into a money service.
 *
 * Ported from wsws's `app/api/kash/[...path]/route.ts`, narrowed to the routes
 * Market Square actually uses. Everything absent is absent deliberately: the
 * conversion desk, the sell side, `settlements/claim` and `subscriptions`
 * belong to the portfolio product, and `POST /activities` mints rewards and
 * must never be reachable from the public internet even behind a session.
 */

/** A ceiling on one invocation, for the same billing reason the MS proxy has one. */
export const maxDuration = 30;

/**
 * The engine, off the platform gateway at `/v1/kash`.
 *
 * `KASH_API_URL` overrides it for a local engine. Unset gateway means we do not
 * know where the engine is, and every surface reads the resulting 404 as "not
 * deployed here" and goes quiet — the same convention the tip button follows.
 */
const BASE = process.env.KASH_API_URL
  ? process.env.KASH_API_URL.replace(/\/+$/u, "")
  : process.env.WSAPI_BASE_URL
    ? `${process.env.WSAPI_BASE_URL.replace(/\/+$/u, "")}/v1/kash`
    : null;

/**
 * Wallet-free reads a signed-out visitor may make.
 *
 * `status` carries the live price and the chain configuration a buy needs, and
 * the quotes price an amount before anybody signs in. None of them names a
 * wallet, so none of them can leak one.
 */
const PUBLIC_GET_PATHS = new Set([
  "status",
  "purchases/quote",
  // The on-chain desk: its addresses, price, pause state and reserve, plus the
  // buy quote. All wallet-free reads of public contract state.
  "desk",
  "desk/buy/quote",
]);

/**
 * Wallet-scoped writes.
 *
 * `purchases` credits a USDC payment the buyer already made; the desk's
 * `prepare`/`tx` build an EIP-712 payload for a named wallet to sign and the
 * transaction it then submits. Binding all three to the session's own wallet is
 * what stops one reader building payloads against another's nonces, or
 * claiming another's payment.
 *
 * The SELL side is not here. Market Square is where KASH is earned and spent,
 * not redeemed, and a redemption path nothing calls is an attack surface with
 * no user.
 */
const WALLET_POST_PATHS = new Set(["purchases", "desk/buy/prepare", "desk/buy/tx"]);

/**
 * A short cache so concurrent polls for the same public path collapse into one
 * upstream call. Bounded, and swept on write, so unauthenticated quote traffic
 * cannot grow it without limit.
 */
const CACHE_TTL_MS = 3_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { expires: number; body: string; status: number }>();

function cachePut(url: string, body: string, status: number) {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
  if (cache.size >= CACHE_MAX_ENTRIES) return;
  cache.set(url, { expires: now + CACHE_TTL_MS, body, status });
}

function envelope(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

const unauthorized = () => envelope(401, "UNAUTHORIZED", "Sign in to continue.");
const notFound = () => envelope(404, "NOT_FOUND", "That wasn't found.");
const forbidden = () =>
  envelope(403, "FORBIDDEN", "That wallet isn't the one you're signed in with.");

/**
 * The wallet a GET names, or null for a path that names none.
 *
 * A path this does not recognise is refused by the caller rather than
 * forwarded: "I could not find a wallet in it" must never mean "so let it
 * through".
 */
function walletOfGet(path: string[]): string | null {
  if (path[0] === "accounts" && path.length >= 2) return path[1];
  return null;
}

/**
 * Null when the caller may proceed; a response when they may not.
 *
 * The wallet is resolved from the session's ISSUER, server-side, and compared to the one the
 * request named. Both halves matter: a missing session is a 401 the client can
 * act on by signing in, and a wallet mismatch is a 403 that never explains
 * whose wallet it was.
 */
async function walletGate(req: NextRequest, claimed: string | null): Promise<NextResponse | null> {
  const claims = await verifyRequest(req);
  if (!claims) return unauthorized();
  if (!claimed) return forbidden();
  const owned = await getRequestWallet(req, claims);
  return isOwnWallet(claimed, owned) ? null : forbidden();
}

async function forward(req: NextRequest, joined: string, method: "GET" | "POST", body?: string) {
  const url = `${BASE}/${joined}${req.nextUrl.search}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["content-type"] = "application/json";
  /**
   * The buyer's own idempotency key, forwarded verbatim.
   *
   * It is minted where their intent begins (`lib/payment-hold.ts`) and is the
   * same on every retry of one attempt, which is the entire point: the engine
   * answers a replay with the ORIGINAL outcome instead of charging again.
   * Rewriting or generating it here would mint a new key per request and
   * protect nothing.
   */
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey && method === "POST") headers["idempotency-key"] = idempotencyKey;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (method === "GET" && PUBLIC_GET_PATHS.has(joined)) cachePut(url, text, res.status);
    return new NextResponse(text || "{}", {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error(`[ms-kash] ${method} ${joined} failed:`, error);
    /**
     * A TIMEOUT on a write is not a failure — it is an unknown.
     *
     * The engine may have credited the purchase and simply answered too
     * slowly, so the code is distinct from the unreachable one: the client
     * must retry with the same idempotency key rather than treat the payment
     * as lost, and it can only tell the two apart if we do.
     */
    return timedOut
      ? envelope(504, "UPSTREAM_TIMEOUT", "KASH took too long to answer. Try again.")
      : envelope(502, "SERVICE_UNAVAILABLE", "KASH is unreachable.");
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  /**
   * Traversal, checked before anything dispatches on the head or joins it into
   * an upstream URL.
   *
   * Verified against a running server: the runtime NORMALISES a path before
   * the handler sees it, so `/accounts/%2e%2e/status` arrives here as
   * `["status"]` and `/accounts/../purchases` as `["purchases"]`. The real
   * defence is therefore the allowlist below — whatever a path normalises to
   * must still be a route this proxy knows, and `purchases` is not a GET, so
   * that second one 404s. This check is the backstop for anything the runtime
   * hands through intact.
   */
  if (!isSafePath(path)) return notFound();
  if (!BASE) return notFound();

  const joined = path.join("/");

  if (PUBLIC_GET_PATHS.has(joined)) {
    const url = `${BASE}/${joined}${req.nextUrl.search}`;
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) {
      return new NextResponse(hit.body, {
        status: hit.status,
        headers: { "content-type": "application/json" },
      });
    }
    return forward(req, joined, "GET");
  }

  const claimed = walletOfGet(path);
  if (!claimed) return notFound();
  const denied = await walletGate(req, claimed);
  if (denied) return denied;
  return forward(req, joined, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!isSafePath(path)) return notFound();
  if (!BASE) return notFound();

  const joined = path.join("/");
  if (!WALLET_POST_PATHS.has(joined)) return notFound();

  const body = await req.text();
  let claimed: string | null = null;
  try {
    const parsed = JSON.parse(body) as { wallet?: unknown };
    if (typeof parsed.wallet === "string") claimed = parsed.wallet;
  } catch {
    // A body we cannot read names no wallet, and the gate below refuses null.
  }

  const denied = await walletGate(req, claimed);
  if (denied) return denied;

  return forward(req, joined, "POST", body || undefined);
}
