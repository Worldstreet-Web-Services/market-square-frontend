import { NextResponse, type NextRequest } from "next/server";

/**
 * BFF proxy for the Privy → Decane MIGRATION CONTRACT, and nothing else.
 *
 * ── WHY A SEPARATE PROXY ───────────────────────────────────────────────────
 * These two routes live in **user-management**, not market-square, so they are
 * off `/v1/user-management/*` on the gateway rather than the
 * `/v1/market-square/*` prefix `app/api/market-square/[...path]` owns. The
 * gateway sends no CORS headers, so a browser cannot reach them directly; this
 * is what makes them reachable from our origin at all.
 *
 * Note the path: the service's own documentation describes these as
 * `/v1/migration/link` and `/v1/migration/status`, and that is NOT where the
 * gateway serves them — probing `/v1/migration/*` returns 404. The gateway
 * exposes `POST /v1/user-management/link` and `GET /v1/user-management/status`,
 * confirmed from its published `openapi.json`. Build against the gateway, not
 * the prose.
 *
 * ── WHY OUR USUAL SESSION GATE IS DELIBERATELY ABSENT ──────────────────────
 * Every other proxy here verifies the caller's Privy session from
 * `Authorization`. On THIS contract `Authorization` carries the **Decane**
 * access token, which our Privy verifier would reject — so running the usual
 * gate would refuse every legitimate call. The Privy token travels beside it in
 * `x-legacy-authorization`, exactly as the contract specifies.
 *
 * That is safe because this proxy grants NO authority of its own. Both tokens
 * are verified upstream by their own provider, wallets are resolved
 * server-side, and every header here is one the caller already holds. Somebody
 * could make the identical request straight to the gateway if CORS allowed it;
 * nothing is escalated by passing through us. Contrast the KASH proxy, which is
 * load-bearing precisely because that engine has no auth of its own.
 *
 * ── THE ALLOWLIST IS THE SECURITY PROPERTY ─────────────────────────────────
 * `user-management` also serves `admin/identity/backfill`,
 * `admin/identity/seed-from-privy`, `admin/users/*` and the campaign mailer. A
 * proxy that forwarded whatever path it was handed would put every one of those
 * behind our origin. So exactly two paths pass, each bound to one method, and
 * everything else is refused before any request leaves — a rule this repo
 * already applies to the KASH engine for the same reason.
 */

/** A ceiling on one invocation, matching the other proxies. */
export const maxDuration = 30;

/**
 * user-management, off the platform gateway.
 *
 * `USER_MANAGEMENT_API_URL` overrides it for a service running on its own port
 * (locally it is :8095, while the gateway is :8080). With no gateway configured
 * we do not know where the service is, and the surface reads the resulting 404
 * as "not deployed here" and goes quiet — the convention every optional
 * capability in this app follows.
 */
const BASE = process.env.USER_MANAGEMENT_API_URL
  ? process.env.USER_MANAGEMENT_API_URL.replace(/\/+$/u, "")
  : process.env.WSAPI_BASE_URL
    ? `${process.env.WSAPI_BASE_URL.replace(/\/+$/u, "")}/v1/user-management`
    : null;

/** Path → the one method it may be called with. Nothing else is forwarded. */
const ALLOWED: Record<string, "GET" | "POST"> = {
  // What the platform knows about the caller's old wallet:
  // { linked, legacy: { evm, solana } | null, hasLegacyFunds, legacyFundsUsd,
  //   pendingOnramps, rekey }. `legacy` is null and `linked` false for an
  //   account that never linked.
  status: "GET",
  // Link the caller's Decane account to their Privy account and re-key the
  // ledgers. Idempotent: a repeated call returns the stored link and re-runs
  // any ledger re-key still outstanding.
  link: "POST",
};

/**
 * The headers the contract defines, and only those.
 *
 * `Authorization` is the Decane access token; `x-legacy-authorization` the
 * Privy access token (required on `link`); `privy-id-token` the Privy identity
 * token, optional and only needed for wallet custody. Copied verbatim rather
 * than rebuilt, because a token this proxy reassembled is a token it could
 * corrupt.
 */
const FORWARD_HEADERS = ["authorization", "x-legacy-authorization", "privy-id-token"] as const;

function upstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message: "That wasn't found." } },
    { status: 404 }
  );
}

async function proxy(req: NextRequest, path: string[], method: "GET" | "POST") {
  if (!BASE) return notFound();

  const route = path.join("/");
  // Exact match on both the path AND the method: `status` is a read and `link`
  // is a write, and letting either be called the other way is the kind of
  // looseness that turns an allowlist into a suggestion.
  if (ALLOWED[route] !== method) return notFound();

  const headers = upstreamHeaders(req);
  let body: string | undefined;
  if (method === "POST") {
    // The contract's body is an empty object; we send one rather than nothing
    // so the service always parses a JSON document.
    body = "{}";
    headers.set("content-type", "application/json");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE}/${route}`, { method, headers, body, cache: "no-store" });
  } catch {
    // The service being unreachable is not the same as the caller having no
    // account — see the identity package's own history of that exact
    // confusion. Say the service is unavailable and let the surface retry.
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Can't reach the migration service." },
      },
      { status: 503 }
    );
  }

  // The envelope is passed through untouched, including `error.details`: the
  // caller has to tell LEGACY_ALREADY_LINKED and SAME_WALLET (both 409) apart,
  // and anything this proxy reshaped it could lose.
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "POST");
}
