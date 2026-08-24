import { NextResponse, type NextRequest } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
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

async function storeMedia(req: NextRequest) {
  if (!(await callerUserId(req))) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Choose a file to upload." } }, { status: 422 });
  }
  if ((!file.type.startsWith("image/") && !file.type.startsWith("video/")) || file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Upload an image or video up to 50 MB." } }, { status: 422 });
  }
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || (file.type.startsWith("video/") ? "mp4" : "jpg");
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDirectory = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(join(uploadDirectory, fileName), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ success: true, data: { url: `${req.nextUrl.origin}/uploads/${fileName}`, mediaType: file.type, size: file.size } });
}

async function searchMentionTargets(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!BASE) {
    const result = handleFixture("GET", ["mentions", "search"], req.nextUrl.searchParams, undefined, await callerUserId(req));
    return NextResponse.json(result.body, { status: result.status });
  }
  const upstream = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&type=all`, {
    headers: { accept: "application/json", ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}) },
    cache: "no-store",
  });
  if (!upstream.ok) return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  const envelope = await upstream.json() as { data?: { items?: Array<{ id: string; type: string; title: string; href?: string }> } };
  const people = (envelope.data?.items ?? [])
    .filter((item) => item.type === "profile" || item.type === "group")
    .slice(0, 8)
    .map((item) => ({ type: item.type, id: item.id, label: item.title, handle: item.href?.split("/").pop() ?? item.id }));
  return NextResponse.json({ success: true, data: { items: people } });
}

async function serveFixture(req: NextRequest, path: string[], method: string) {
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

  let body: BodyInit | undefined;
  if (method !== "GET") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      body = await req.arrayBuffer();
      headers["content-type"] = contentType;
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
      signal: AbortSignal.timeout(15_000),
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
  if (path.length === 1 && path[0] === "media" && method === "POST") return storeMedia(req);
  if (path[0] === "mentions" && path[1] === "search" && method === "GET") return searchMentionTargets(req);
  if (!BASE) return serveFixture(req, path, method);
  return forward(req, path, method);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
