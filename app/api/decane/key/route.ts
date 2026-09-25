import { NextResponse } from "next/server";

/**
 * Hands the browser the Decane publishable key at runtime instead of baking it
 * into the bundle — the same route wsws serves.
 *
 * What this buys: the key is not in the static JS or its source maps, and it
 * rotates with a restart rather than a rebuild. What it does NOT buy is
 * secrecy — the SDK runs in the browser and must send the key. The control
 * that stops anyone else USING it is the key's allowed_origins list in Decane,
 * which must name both of Square's addresses (square.tsionark.com and the
 * www.tsionark.com/square zone).
 *
 * Read from DECANE_API_KEY, server-only. A NEXT_PUBLIC_ copy anywhere would be
 * inlined into the bundle and defeat the point.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.DECANE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_DECANE_APP_ID;

  if (!apiKey || !appId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_CONFIGURED", message: "Decane credentials are not configured on the server." },
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { apiKey, appId },
    // Never cached: a cache in front of this would serve a rotated-out key.
    { headers: { "cache-control": "no-store, no-cache, must-revalidate, private" } }
  );
}
