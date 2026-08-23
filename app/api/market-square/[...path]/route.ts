import { NextResponse, type NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import { handleFixture, FIXTURE_ME_ID } from "@/lib/fixtures/handler";

// BFF proxy for Market Square. Verifies the Privy session server-side and
// forwards the caller's Authorization to `${WSAPI_BASE_URL}/v1/market-square/*`.
// Public GET paths pass through unauthenticated so signed-out browsing works.
//
// Fixture mode: when WSAPI_BASE_URL is unset every request is served from
// lib/fixtures instead, so `pnpm dev` demos the full app standalone. When
// Privy is also unconfigured the fixture treats every caller as the demo user.

const BASE = process.env.WSAPI_BASE_URL ? `${process.env.WSAPI_BASE_URL}/v1/market-square` : null;
const PRIVY_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
);

// GET paths a signed-out visitor may read. Everything else requires a
// verified session.
function isPublicGet(path: string[]): boolean {
  const head = path[0];
  if (head === "feed" || head === "stories" || head === "spotlight") return true;
  if (head === "streams") return true; // list, detail, chat reads
  if (head === "store") return true;
  if (head === "profiles") return true;
  if (head === "activities") return true;
  if (head === "verification" && path[1] === "rule") return true;
  return false;
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
    { status: 401 }
  );
}

async function callerUserId(req: NextRequest): Promise<string | null> {
  if (!PRIVY_CONFIGURED) return FIXTURE_ME_ID;
  const claims = await verifyRequest(req);
  return claims?.userId ?? null;
}

const FIXTURE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const FIXTURE_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

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
  if ((isImage && file.size > 10 * 1024 * 1024) || (isVideo && file.size > 100 * 1024 * 1024)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "File is too large." } },
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
  if (path[0] === "uploads" && method === "POST") {
    const userId = await callerUserId(req);
    if (!userId) return unauthorized();
    return serveFixtureUpload(req);
  }
  let body: unknown;
  if (method !== "GET" && method !== "DELETE") {
    body = await req.json().catch(() => undefined);
  }
  // The fixture identifies every verified (or demo) caller as the demo user.
  const userId = (await callerUserId(req)) ? FIXTURE_ME_ID : null;
  const result = handleFixture(method, path, req.nextUrl.searchParams, body, userId);
  return NextResponse.json(result.body, { status: result.status });
}

async function forward(req: NextRequest, path: string[], method: string) {
  const joined = path.join("/");

  // Authed paths need a verified Privy session before anything is forwarded.
  const needsAuth = method !== "GET" || !isPublicGet(path);
  if (needsAuth) {
    const claims = await verifyRequest(req);
    if (!claims) return unauthorized();
  }

  const url = `${BASE}/${joined}${req.nextUrl.search}`;
  const headers: Record<string, string> = { accept: "application/json" };
  const auth = req.headers.get("authorization");
  if (auth) headers.authorization = auth;

  // Multipart bodies (uploads) stream straight through — buffering them as
  // text would corrupt binary payloads and blow memory on big videos. JSON
  // bodies keep the simple text path.
  const contentType = req.headers.get("content-type") ?? "";
  let body: BodyInit | undefined;
  let duplex: { duplex?: "half" } = {};
  if (method !== "GET") {
    if (contentType.startsWith("multipart/")) {
      body = req.body ?? undefined;
      headers["content-type"] = contentType;
      duplex = { duplex: "half" };
    } else {
      const text = await req.text();
      if (text) {
        body = text;
        headers["content-type"] = "application/json";
      }
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(contentType.startsWith("multipart/") ? 120_000 : 15_000),
      ...duplex,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Market Square proxy failed:", joined, error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Market Square is unreachable." },
      },
      { status: 502 }
    );
  }
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const method = req.method;
  if (!BASE) return serveFixture(req, path, method);
  return forward(req, path, method);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
