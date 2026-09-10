import { NextResponse } from "next/server";

/**
 * WHICH POST IS PINNED ABOVE THE TIMELINE, if any.
 *
 * Answers `{ postId: string | null }` and nothing else. The client then reads
 * that post through the ordinary `/posts/:id` proxy, so the announcement gets
 * the same schema, the same cache entry and the same error handling as every
 * other post rather than a second path that has to be kept in step.
 *
 * ─── SERVER-SIDE ON PURPOSE ─────────────────────────────────────────────────
 * `MS_ANNOUNCEMENT_POST_ID` carries no `NEXT_PUBLIC_` prefix, so it is read
 * here at request time instead of being inlined into the bundle at build time.
 * That is the whole reason this route exists rather than a flag in
 * `market-config.ts`: taking an announcement DOWN has to be an env change and
 * a restart, not a rebuild. The moment you most need to pull one is the moment
 * you least want to wait for a build.
 *
 * ─── IT IS PUBLIC, AND THAT IS DELIBERATE ───────────────────────────────────
 * No session check. Signed-out visitors read the feed too, and the first thing
 * this is being used for is a notice about which accounts are official — which
 * matters most to people who have not committed to anything yet. It leaks
 * nothing: the id it returns is a public post's, and the post itself is
 * already readable by anybody.
 *
 * Unset is the normal state and answers `null` — no upstream call, nothing
 * rendered, nothing to go wrong.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const postId = process.env.MS_ANNOUNCEMENT_POST_ID?.trim() || null;
  return NextResponse.json(
    { postId },
    {
      // Briefly cacheable at the edge: every reader asks for this on every
      // page load and the answer changes about once a month. `s-maxage` keeps
      // a burst off the origin; `stale-while-revalidate` means taking an
      // announcement down still propagates within the minute.
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" },
    }
  );
}
