import { NextResponse, type NextRequest } from "next/server";
import { verifyRequest, verifyRequestDetailed } from "@/lib/server/auth";
import { handleFixture, FIXTURE_ME_ID } from "@/lib/fixtures/handler";
import { isPublicGet, isSafePath, isPublicPost } from "@/lib/api/public-routes";
import { forwardToUpstream } from "@/lib/server/proxy";
import { marketSquareBase } from "@/lib/server/upstream-base";
import { cacheControlFor } from "@/lib/server/cache-policy";
import { FALLBACK_LIMITS } from "@/lib/upload-rules";

// BFF proxy for Market Square. Verifies the Privy session server-side and
// forwards the caller's Authorization to `${WSAPI_BASE_URL}/v1/market-square/*`.
// Public GET paths pass through unauthenticated so signed-out browsing works.
//
// Fixture mode: when WSAPI_BASE_URL is unset every request is served from
// lib/fixtures instead, so `pnpm dev` demos the full app standalone. When
// Privy is also unconfigured the fixture treats every caller as the demo user.

/**
 * A ceiling on how long one invocation may live.
 *
 * Vercel bills provisioned memory until the last in-flight request finishes,
 * so an unbounded handler waiting on a dead upstream is a bill with no
 * product. The forward already times out well inside this; `maxDuration` is
 * the backstop for everything that is not that fetch — and the reason it is
 * not the default 60 is that nothing here legitimately takes a minute except
 * an upload, which sets its own longer ceiling on the fetch itself.
 */
export const maxDuration = 30;

// Shared with the share-preview reads, so the two can never disagree about
// where the service is.
const BASE = marketSquareBase();
const PRIVY_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
);


function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
    { status: 401 }
  );
}

/**
 * We could not verify the session — OUR fault, not theirs.
 *
 * 503, not 401, and a message that does not accuse the reader of being signed
 * out. The client treats it as a service failure, so the connection banner
 * speaks and the session is left alone: a 401 here would have logged out a
 * perfectly good session over a missing environment variable.
 */
function authUnavailable() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "AUTH_UNAVAILABLE", message: "Can't verify your session right now." },
    },
    { status: 503 }
  );
}

async function callerUserId(req: NextRequest): Promise<string | null> {
  if (!PRIVY_CONFIGURED) return FIXTURE_ME_ID;
  const claims = await verifyRequest(req);
  return claims?.userId ?? null;
}


async function searchMentionTargets(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!BASE) {
    const result = handleFixture("GET", ["mentions", "search"], req.nextUrl.searchParams, undefined, await callerUserId(req));
    return NextResponse.json(result.body, { status: result.status });
  }
  // A BARE "@" — nothing typed after it yet — is the moment a reader expects
  // to see people, and `/search?type=people` answers an empty query with an
  // empty list by design. So that case reads the directory instead
  // (`GET /profiles`, public, sorted by followers, the viewer already
  // excluded), reshaped to the same Mention rows. "Typing @ does nothing"
  // was this branch not existing.
  if (!query) {
    const directory = await fetch(`${BASE}/profiles?sort=followers&limit=8`, {
      headers: {
        accept: "application/json",
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      },
      cache: "no-store",
    });
    if (!directory.ok) return new NextResponse(await directory.text(), { status: directory.status, headers: { "content-type": "application/json" } });
    const page = (await directory.json()) as {
      data?: { items?: Array<{ id?: string; username?: string | null; displayName?: string | null }> };
    };
    const people = (page.data?.items ?? [])
      .filter((item) => item.username)
      .slice(0, 8)
      .map((item) => ({
        type: "profile" as const,
        id: item.id ?? "",
        label: item.displayName ?? item.username ?? "",
        handle: item.username ?? "",
      }));
    return NextResponse.json({ success: true, data: { items: people } });
  }
  // There is no mentions endpoint: this rewrites onto /search and keeps the
  // people. Results are discriminated by `kind` and carry the profile payload,
  // so the handle comes off `profile.username` — never parsed out of a href.
  const upstream = await fetch(
    `${BASE}/search?q=${encodeURIComponent(query)}&type=people&limit=8`,
    {
      headers: {
        accept: "application/json",
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      },
      cache: "no-store",
    }
  );
  if (!upstream.ok) return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  const envelope = (await upstream.json()) as {
    data?: {
      items?: Array<{
        kind?: string;
        id?: string;
        profile?: { id?: string; username?: string | null; displayName?: string | null };
      }>;
    };
  };
  const people = (envelope.data?.items ?? [])
    .filter((item) => item.kind === "profile" && item.profile?.username)
    .slice(0, 8)
    .map((item) => ({
      type: "profile" as const,
      id: item.profile?.id ?? item.id ?? "",
      // A profile with no chosen display name still needs a label to pick.
      label: item.profile?.displayName ?? item.profile?.username ?? "",
      handle: item.profile?.username ?? "",
    }));
  return NextResponse.json({ success: true, data: { items: people } });
}

// Fixture mode has no backend to ask, so it answers from the SAME fallback
// object the client falls back to — never a third hand-written copy of the
// caps, which is how the 10 MB / 100 MB numbers ended up in three places.
const FIXTURE_IMAGE_TYPES = new Set(FALLBACK_LIMITS.imageContentTypes);
const FIXTURE_VIDEO_TYPES = new Set(FALLBACK_LIMITS.videoContentTypes);

// Fixture upload: validates like the real endpoint and answers with an
// offline-renderable placeholder (SVG data URI for images; a small public
// sample for video, since a data-URI video is impractical).
async function serveFixtureUpload(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "A `file` field is required." } },
      { status: 422 }
    );
  }
  const isImage = FIXTURE_IMAGE_TYPES.has(file.type);
  const isVideo = FIXTURE_VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Unsupported file type." } },
      { status: 422 }
    );
  }
  const cap = isImage ? FALLBACK_LIMITS.maxImageBytes : FALLBACK_LIMITS.maxVideoBytes;
  if (file.size > cap) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `File is too large — the cap is ${cap} bytes and this one is ${file.size}.`,
        },
      },
      { status: 422 }
    );
  }
  const url = isImage
    ? `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#18181b"/><circle cx="320" cy="180" r="120" fill="#3c3c3c"/><text x="320" y="190" font-family="sans-serif" font-size="24" fill="#d4d4d8" text-anchor="middle">${file.name.slice(0, 24).replace(/[<>&"]/g, "")}</text></svg>`
      )}`
    : "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  return NextResponse.json({
    success: true,
    data: {
      url,
      kind: isImage ? "image" : "video",
      contentType: file.type,
      bytes: file.size,
    },
  });
}

async function serveFixture(req: NextRequest, path: string[], method: string) {
  // Only the multipart upload itself. `/uploads/presign` and
  // `/uploads/complete` must fall through to a real 404 here: fixture mode has
  // no storage to sign for, and the client reads that 404 as "presign is not
  // available, use the proxy" — answering 422 instead would strand it.
  // The upload contract. Fixture mode still has to answer it, or the client
  // spends every offline session on its fallback path with no way to tell
  // whether the wiring works.
  if (path[0] === "uploads" && path[1] === "limits" && path.length === 2 && method === "GET") {
    return NextResponse.json({ success: true, data: FALLBACK_LIMITS });
  }
  if (path[0] === "uploads" && path.length === 1 && method === "POST") {
    const userId = await callerUserId(req);
    if (!userId) return unauthorized();
    return serveFixtureUpload(req);
  }
  let body: unknown;
  if (method !== "GET" && method !== "DELETE") {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file instanceof File) {
        const bytes = Buffer.from(await file.arrayBuffer());
        body = { fileName: file.name, mediaType: file.type, size: file.size, dataUrl: `data:${file.type};base64,${bytes.toString("base64")}` };
      }
    } else {
      body = await req.json().catch(() => undefined);
    }
  }
  // The fixture identifies every verified (or demo) caller as the demo user.
  const userId = (await callerUserId(req)) ? FIXTURE_ME_ID : null;
  const result = handleFixture(method, path, req.nextUrl.searchParams, body, userId);
  return NextResponse.json(result.body, { status: result.status });
}

/** Statuses the Fetch spec forbids a body on. Constructing one throws. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

async function forward(req: NextRequest, path: string[], method: string) {
  const joined = path.join("/");

  // Authed paths need a verified Privy session before anything is forwarded.
  // Reads: public per `isPublicGet`. Writes: a session, except the one public
  // POST (`isPublicPost` — the email unsubscribe link).
  const needsAuth = method === "GET" ? !isPublicGet(path) : !(method === "POST" && isPublicPost(path));
  if (needsAuth) {
    const auth = await verifyRequestDetailed(req);
    if (!auth.ok) return auth.reason === "unavailable" ? authUnavailable() : unauthorized();
  }

  // The forward itself lives in lib/server/proxy.ts so it can be tested
  // against a stub upstream; route files own no logic.
  const result = await forwardToUpstream({
    req,
    url: `${BASE}/${joined}${req.nextUrl.search}`,
    method,
  });
  /*
    A 204 MUST BE CONSTRUCTED WITH A NULL BODY.

    204, 205 and 304 are "null body statuses" in the Fetch spec: passing ANY
    body init — including the empty string this proxy carries for them —
    throws `TypeError: Response constructor: Invalid response status code 204`.
    The throw happens HERE, after the upstream call has already succeeded, so
    Next answers 5xx for a request the service completed. The client then sees
    a server error, trips the shared circuit breaker, and tells the reader
    "Can't reach Market Square right now" about an action that worked.

    That is what leaving a group looked like: the member really was removed,
    the app reported the square unreachable, the confirm sheet stayed open, and
    the next press hit a membership that was already gone. Two of our routes
    answer 204 — leaving a group and declining a chat request — so both were
    unusable through the proxy while both were succeeding upstream.
  */
  /*
    SAY WHAT MAY BE CACHED, ALWAYS — see lib/server/cache-policy.ts.

    Nothing said `Cache-Control` before, which let an intermediary guess a
    freshness lifetime for bodies that include somebody's inbox. Anonymous
    public GETs become shared-cacheable so identical polls collapse; every
    other response is explicitly `private, no-store`.
  */
  const cacheControl = cacheControlFor({
    method,
    status: result.status,
    isPublic: method === "GET" && isPublicGet(path),
    hasAuthorization: Boolean(req.headers.get("authorization")),
  });

  return new NextResponse(NULL_BODY_STATUSES.has(result.status) ? null : result.body, {
    status: result.status,
    // A bodyless response must not claim a content type either.
    headers: NULL_BODY_STATUSES.has(result.status)
      ? { "cache-control": cacheControl }
      : { "content-type": result.contentType, "cache-control": cacheControl },
  });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const method = req.method;

  // Reject traversal BEFORE anything looks at the head, dispatches on it, or
  // joins it into an upstream URL. Next decodes segments for us, so `%2e%2e`
  // arrives here as `..` and is caught the same way.
  if (!isSafePath(path)) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "That wasn't found." } },
      { status: 404 }
    );
  }

  if (path[0] === "mentions" && path[1] === "search" && method === "GET") return searchMentionTargets(req);
  if (!BASE) return serveFixture(req, path, method);
  return forward(req, path, method);
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
