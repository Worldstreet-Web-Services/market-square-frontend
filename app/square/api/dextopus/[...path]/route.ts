import { NextResponse, type NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import { isSafePath } from "@/lib/api/public-routes";
import {
  cacheSecondsFor,
  dextopusConfigured,
  dextopusRequest,
  isAllowedPath,
} from "@/lib/server/dextopus";

/**
 * BFF proxy for the routing provider that fills a `$TICKER` buy.
 *
 * Every request is signed with the platform's integration key, so every
 * request needs a verified session in front of it — otherwise the key is spent
 * by whoever finds the URL. The path allowlist and the key live in
 * `lib/server/dextopus.ts`; this file is dispatch and nothing else.
 *
 * Not `msApi`: this is a different upstream with a different envelope. It
 * answers the provider's own JSON verbatim, which is what `features/trade`
 * parses — wrapping it in Market Square's `{ success, data }` shape would mean
 * inventing an envelope on the way in and unwrapping it on the way out to
 * arrive back where we started.
 */

export const maxDuration = 30;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * A status read that could not reach the provider is PENDING, not failed.
 *
 * The order exists; we merely could not observe it. Answering 5xx would make
 * the client's state machine treat a live order as broken, and a buyer whose
 * money is mid-route reading "the order didn't complete" is the worst thing
 * this surface can say. So the shape stays a status payload and carries the
 * unknown honestly, and the poll keeps going.
 */
function unobservable(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      depositRequestId: req.nextUrl.searchParams.get("depositRequestId") ?? "",
      depositAddress: "",
      status: "PENDING",
      executionStatus: "PROVIDER_UNAVAILABLE",
      originTransactionHashes: [],
      destinationTransactionHashes: [],
      providerUnavailable: true,
      retryAfterMs: 30_000,
    },
    { status: 202, headers: { "Cache-Control": "no-store", "Retry-After": "30" } }
  );
}

async function proxy(req: NextRequest, path: string[], method: "GET" | "POST", body?: unknown) {
  if (!isSafePath(path)) return fail(404, "NOT_FOUND", "That wasn't found.");

  // Unconfigured is "not deployed here", not "broken". The buy surface reads
  // the 404 and goes quiet rather than offering a control that cannot work.
  if (!dextopusConfigured()) return fail(404, "NOT_FOUND", "Buying isn't available here.");

  const claims = await verifyRequest(req);
  if (!claims) return fail(401, "UNAUTHORIZED", "Sign in to continue.");

  const joined = path.join("/");
  if (!isAllowedPath(joined)) return fail(404, "NOT_FOUND", "That wasn't found.");

  try {
    const res = await dextopusRequest(joined, {
      method,
      query: method === "GET" ? req.nextUrl.searchParams : undefined,
      body,
      revalidate: method === "GET" ? cacheSecondsFor(joined) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (joined === "deposit/status" && res.status >= 500) return unobservable(req);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[ms-dextopus] ${method} ${joined} failed:`, error);
    if (joined === "deposit/status") return unobservable(req);
    return fail(502, "SERVICE_UNAVAILABLE", "The trading service is unreachable.");
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return proxy(req, path, "POST", body);
}
