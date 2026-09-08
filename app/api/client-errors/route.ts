import { NextResponse } from "next/server";

/**
 * Where a client crash is written down.
 *
 * `console.error` on purpose: it lands in the platform's log drain, which is
 * the one place an operator is already looking. This route exists so there IS
 * a place — swapping the body for an APM call is a one-line change and every
 * caller stays the same.
 *
 * ─── IT TRUSTS NOTHING IT IS SENT ───────────────────────────────────────────
 * The body is attacker-controlled: anybody can POST here. So it is size-capped
 * before parsing, every field is coerced and truncated, and nothing is echoed
 * back. It answers 204 whatever happens — an error reporter that returns
 * errors is a loop, and telling a caller their report was rejected invites
 * probing.
 *
 * No session check, deliberately. The crashes worth hearing about include the
 * ones that happen to signed-out visitors, and a boundary that only reports
 * for authenticated users misses every failure in the sign-in path itself.
 */
const MAX_BODY = 8 * 1024;

function clip(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value ? value.slice(0, max) : undefined;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return new NextResponse(null, { status: 204 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new NextResponse(null, { status: 204 });
    const body = parsed as Record<string, unknown>;

    const message = clip(body.message, 500);
    if (!message) return new NextResponse(null, { status: 204 });

    console.error("[client-error]", {
      message,
      digest: clip(body.digest, 64),
      url: clip(body.url, 256),
      stack: clip(body.stack, 4000),
      userAgent: request.headers.get("user-agent")?.slice(0, 256),
      at: new Date().toISOString(),
    });
  } catch {
    /* a malformed report is not worth a 500 */
  }
  return new NextResponse(null, { status: 204 });
}
