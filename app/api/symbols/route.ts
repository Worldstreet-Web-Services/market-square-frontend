import { NextResponse } from "next/server";

/**
 * Which tickers a post may make tappable.
 *
 * Fetched from Ark, which owns the trade domain and therefore owns the answer.
 * Market Square has no business deciding what is tradeable, and the upstream
 * source sits behind a third-party key that belongs to Ark's deployment — so
 * this asks for the answer rather than duplicating the credential.
 *
 * Server-side rather than from the browser: no CORS to negotiate, one cached
 * response shared by every reader instead of one request per visitor, and the
 * origin stays a server concern rather than something baked into the bundle.
 */
// The Ark APP, not the marketing site: NEXT_PUBLIC_WORLDSTREET_URL points at
// worldstreetgold.com, which serves the landing page and 404s every product
// route. This is the same origin the deep links use.
const ARK = (process.env.NEXT_PUBLIC_ARK_APP_URL ?? "https://www.tsionark.com").replace(
  /\/+$/,
  "",
);

export const revalidate = 300;

export async function GET() {
  // Unset means we do not know where Ark is, and guessing an origin produces
  // links that look fine and land on somebody else's 404.
  if (!ARK) {
    return NextResponse.json(
      { symbols: [] },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  }
  try {
    const upstream = await fetch(`${ARK}/api/square/symbols`, {
      next: { revalidate },
      // A catalogue is not worth stalling a page render for.
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) throw new Error(String(upstream.status));
    const body = (await upstream.json()) as { symbols?: unknown };
    const symbols = Array.isArray(body.symbols)
      ? body.symbols.filter((value): value is string => typeof value === "string")
      : [];
    return NextResponse.json(
      { symbols },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch {
    // An empty list means "mark nothing up", which is the honest degradation:
    // a ticker renders as plain text rather than as a chip that leads nowhere.
    // Never an error — a catalogue being unreachable must not break a feed.
    return NextResponse.json(
      { symbols: [] },
      { headers: { "Cache-Control": "public, s-maxage=30" } },
    );
  }
}
