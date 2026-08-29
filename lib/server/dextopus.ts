import "server-only";

/**
 * The cross-chain routing provider behind a `$TICKER` buy.
 *
 * A buy is one route: the reader's USDC on Base in, the chosen token on its
 * chain out, delivered to their own embedded wallet. Dextopus quotes that
 * route, mints a deposit address for it, and reports the order's progress.
 *
 * ── WHY IT IS PROXIED ──────────────────────────────────────────────────────
 * The integration key. Despite its `pk_` prefix it is a secret: it identifies
 * the platform to the provider and it must never reach a browser bundle. So
 * the browser talks to `/api/dextopus/*` and the key is added here, on the
 * server, behind a verified session. That is also what keeps the provider's
 * rate limits attached to a signed-in reader rather than to the open internet.
 *
 * Ported from wsws's `lib/server/dextopus.ts`, narrowed to the ONE purpose
 * Market Square has. wsws runs three separate integrations (deposits into the
 * platform, withdrawals out of it, and trades) under three keys, and a request
 * created under one key cannot be polled under another — which is exactly why
 * this file does not offer a choice. Market Square only ever trades, so the
 * purpose is fixed rather than taken from the path: a client-selectable
 * purpose would be a client-selectable key.
 */

const DEXTOPUS_BASE = "https://swap-api.dextopus.com/api";
const DEXTOPUS_TIMEOUT_MS = 20_000;

/**
 * Only the deposit-scoped routes, and only the three a buy uses.
 *
 * An allowlist rather than a prefix, because this proxy signs every request it
 * forwards with the platform's key: a path it does not recognise is a path
 * somebody else chose for us to spend the integration on.
 *
 *  - `deposit/destinations` — which tokens and chains can be delivered
 *  - `deposit/quote`        — price the route and mint the deposit address
 *  - `deposit/status`       — how far along one order is
 */
const ALLOWED_PATHS = new Set(["deposit/destinations", "deposit/quote", "deposit/status"]);

export function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.has(path);
}

/**
 * Is the provider configured at all?
 *
 * Exported so the route can answer 404 — "not deployed here" — instead of 500
 * when no key is set. The whole buy surface then goes quiet rather than
 * offering a button that fails, which is the convention every unconfigured
 * capability in this app follows.
 */
export function dextopusConfigured(): boolean {
  return Boolean(process.env.DEXTOPUS_TRADE_API_KEY ?? process.env.DEXTOPUS_API_KEY);
}

function apiKey(): string {
  // The trade-specific key when there is one; the shared key otherwise, which
  // is what older environments have.
  const key = process.env.DEXTOPUS_TRADE_API_KEY ?? process.env.DEXTOPUS_API_KEY;
  if (!key) throw new Error("DEXTOPUS_TRADE_API_KEY or DEXTOPUS_API_KEY is not set");
  return key;
}

/**
 * Server-side caching for the catalogue only.
 *
 * The destinations list barely changes and every open buy sheet would
 * otherwise ask for it, spending the shared key on an answer that was already
 * known. A quote is never cached — it mints an address for one order — and
 * status is cached for seconds only, which coalesces two tabs watching the
 * same order without making a settlement look stale.
 */
export function cacheSecondsFor(path: string): number | undefined {
  if (path === "deposit/destinations") return 600;
  if (path === "deposit/status") return 5;
  return undefined;
}

export async function dextopusRequest(
  path: string,
  init: {
    method: "GET" | "POST";
    query?: URLSearchParams;
    body?: unknown;
    revalidate?: number;
  }
): Promise<Response> {
  const key = apiKey();
  const url = new URL(`${DEXTOPUS_BASE}/${path}`);
  if (init.query) url.search = init.query.toString();

  const request = () =>
    fetch(url, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "x-api-key": key,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(DEXTOPUS_TIMEOUT_MS),
      ...(init.revalidate != null
        ? { next: { revalidate: init.revalidate } }
        : { cache: "no-store" }),
    });

  /**
   * What may be retried, and what may not.
   *
   * A quote has no funds attached: the worst a retry leaves behind is an
   * unused deposit address. A status read is a pure observation. Nothing else
   * is retried here — once USDC has been sent to a deposit address the order
   * is reconciled by transaction hash, and a retried command is how one
   * payment becomes two orders.
   */
  const delays = path === "deposit/status" ? [200, 600, 1_200] : path === "deposit/quote" ? [300] : [];

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await request();
    } catch (error) {
      if (attempt >= delays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      continue;
    }
    if (response.status < 500 || attempt >= delays.length) return response;
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  }
}
