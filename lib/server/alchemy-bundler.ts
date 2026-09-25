import { NextResponse, type NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import { getSponsoredEvmChainByNetwork } from "@/lib/trade/sponsored-evm";
import {
  alchemyPairs,
  markAlchemyKeyBlocked,
  MONTHLY_CAPACITY_COOLDOWN_MS,
  pairCannotServe,
  RATE_LIMIT_COOLDOWN_MS,
  type AlchemyPair,
} from "@/lib/server/alchemy-keys";

/**
 * THE BUNDLER, OVER A POOL OF KEYS RATHER THAN ONE.
 *
 * ─── WHY THIS CHANGED ────────────────────────────────────────────────────────
 * This route used to hold ONE key and ONE policy, both read at module load:
 *
 *     const API_KEY = process.env.ALCHEMY_API_KEY;
 *
 * When that single Alchemy app hit its rate limit, every sponsored send in the
 * app failed at once — buying coins included (ogazboiz: "icant purchase coin
 * why", with `429 Too Many Requests` on the proxy). Reads survive a throttled
 * key because they fall back to a public node; SPONSORSHIP CANNOT. Nothing
 * else pays our gas, so a 429 here is the end of the flow.
 *
 * wsws hit exactly this on 2026-09-07 and answered it with an ordered pool of
 * key/policy pairs (ADR-2026-09-07-alchemy-key-pool). This is that answer,
 * ported to the one sponsorship mode Market Square uses.
 *
 * ─── PAIRING BY INDEX IS THE INVARIANT ───────────────────────────────────────
 * A Gas Manager policy belongs to the Alchemy app that created it, so a key
 * from one app can never sponsor under another app's policy — Alchemy answers
 * "Policy not found". The key at index N is therefore only ever sent with the
 * policy at index N, and a key with no policy at its index reads but never
 * sponsors. That is why this walks PAIRS and not keys.
 *
 * ─── A CALL THAT SPONSORS AND A CALL THAT DOES NOT ───────────────────────────
 * Only `eth_sendUserOperation` spends the policy. An estimate or a receipt
 * lookup can go to any key in the pool, so those are not narrowed to pairs
 * that hold a policy — otherwise a deployment with one unpolicied key could
 * not even estimate.
 *
 * ─── EXHAUSTED IS NOT THE SAME AS REFUSED ────────────────────────────────────
 * A pair that answers capacity, a rate limit or an auth error is marked and
 * skipped for a cooldown, so the next request starts past it rather than
 * paying for the same refusal. If every pair that COULD have sponsored is out
 * of capacity, that is an operations alarm and is logged as one — no amount of
 * retrying fixes it. Any other refusal passes the provider's own answer
 * through, because the client interpreting a real error beats us rewriting it.
 *
 * A network failure is NOT evidence that a key is unusable, so it keeps
 * walking the pool and only then reports a retryable outage — otherwise one
 * unreachable edge would be reported to the reader as "everything is
 * exhausted".
 */

// Every JSON-RPC method this flow's viem bundler/public client can call. Kept
// tight so this route cannot become a generic paid RPC proxy.
const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_call",
  "eth_getTransactionReceipt",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_estimateUserOperationGas",
  "eth_sendUserOperation",
  "eth_getUserOperationReceipt",
  "eth_getUserOperationByHash",
  "eth_supportedEntryPoints",
]);

const SPONSORED_SEND_METHOD = "eth_sendUserOperation";

const UPSTREAM_TIMEOUT_MS = 30_000;

interface RpcCall {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: unknown[];
}


export async function forwardAlchemyBundlerRequest(req: NextRequest, network: string) {
  const claims = await verifyRequest(req);
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = getSponsoredEvmChainByNetwork(network);
  if (!target) {
    return NextResponse.json({ error: "Unsupported sponsored network" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const calls = (Array.isArray(body) ? body : [body]) as Array<RpcCall | null>;
  for (const call of calls) {
    if (!call || typeof call.method !== "string" || !ALLOWED_METHODS.has(call.method)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 403 });
    }
  }

  const needsPolicy = calls.some((call) => call?.method === SPONSORED_SEND_METHOD);
  // A sponsoring call needs a pair that HOLDS a policy; anything else may use
  // any key in the pool.
  const pairs: AlchemyPair[] = needsPolicy
    ? alchemyPairs().filter((pair) => Boolean(pair.policyId))
    : alchemyPairs();

  if (pairs.length === 0) {
    // Told apart on purpose: no key at all is a deployment that was never
    // configured; keys without a policy can read but were never able to
    // sponsor, which is a different thing to fix.
    const configured = alchemyPairs().length > 0;
    return NextResponse.json(
      {
        error: configured
          ? `Gas sponsorship policy for ${network} is missing`
          : "Alchemy API key is missing",
      },
      { status: configured ? 503 : 500 }
    );
  }

  let last: { status: number; text: string; retryAfter: string | null } | null = null;
  let lastNetworkError: unknown = null;
  let anyExhausted = false;

  try {
    for (const pair of pairs) {
      let response: Response;
      let text: string;
      try {
        response = await fetch(`https://${target.alchemyHost}/v2/${pair.key}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(needsPolicy && pair.policyId ? { "x-alchemy-policy-id": pair.policyId } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          cache: "no-store",
        });
        text = await response.text();
      } catch (error) {
        // Unreachable says nothing about this key's capacity. Keep walking,
        // and only report an outage if nothing later succeeds.
        lastNetworkError = error;
        markAlchemyKeyBlocked(pair.key, RATE_LIMIT_COOLDOWN_MS);
        console.warn(
          `Alchemy bundler for ${network}: pair ${pair.index} could not be reached, trying the next`,
          error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : "Unknown error"
        );
        continue;
      }

      const verdict = pairCannotServe(response.status, text);
      if (verdict === null) {
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...(response.headers.get("retry-after")
              ? { "Retry-After": response.headers.get("retry-after") as string }
              : {}),
          },
        });
      }

      markAlchemyKeyBlocked(
        pair.key,
        verdict === "capacity" ? MONTHLY_CAPACITY_COOLDOWN_MS : RATE_LIMIT_COOLDOWN_MS
      );
      if (verdict === "capacity") anyExhausted = true;
      console.warn(
        `Alchemy bundler for ${network}: pair ${pair.index} ${verdict}, trying the next`,
        text.slice(0, 200)
      );
      last = {
        status: response.status,
        text,
        retryAfter: response.headers.get("retry-after"),
      };
    }

    if (lastNetworkError) throw lastNetworkError;
    if (!last) throw new Error("No Alchemy pair could be tried");

    if (anyExhausted) {
      // Weather versus an alarm. Nothing sponsored will succeed until an
      // Alchemy app behind the pool has capacity again, so this is logged at
      // error and answered in a form the client shows rather than retries.
      console.error(
        `Alchemy bundler for ${network}: sponsorship capacity exhausted on every account that could serve`,
        last.text.slice(0, 300)
      );
    }

    return new NextResponse(last.text, {
      status: last.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...(last.retryAfter ? { "Retry-After": last.retryAfter } : {}),
      },
    });
  } catch (error) {
    console.error(`Alchemy bundler proxy failed for ${network}:`, error);
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      {
        error: timedOut ? "Alchemy bundler timed out" : "Alchemy bundler is unavailable",
        provider: "alchemy",
        retryable: true,
      },
      { status: timedOut ? 504 : 502, headers: { "Retry-After": "5" } }
    );
  }
}
