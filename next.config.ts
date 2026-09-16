import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import { parseBase } from "./lib/square-path";

/**
 * SECURITY HEADERS.
 *
 * The app sent none of these until 2026-09-12, which a review caught: with no
 * `X-Frame-Options` and no `frame-ancestors`, any site could load Square in an
 * invisible frame and sit a fake "Claim reward" button over a real one. On a
 * page whose controls send tips, buy KASH and confirm gifts, one borrowed click
 * moves somebody's money. Nothing here renders an `<iframe>` and no route is
 * meant to be framed, so refusing outright costs nothing.
 *
 * ─── WHAT IS ENFORCED ────────────────────────────────────────────────────────
 *  · `frame-ancestors 'none'` and `X-Frame-Options: DENY` — the clickjacking
 *    fix, and the reason this change exists. Modern browsers read the first;
 *    the second is kept for the ones that do not.
 *  · `X-Content-Type-Options: nosniff` — a media upload cannot be re-read as a
 *    script because a browser guessed at its type.
 *  · `Referrer-Policy: strict-origin-when-cross-origin` — a room code or a
 *    post id does not leak in the Referer of every outbound link.
 *  · `Permissions-Policy` — the camera and microphone stay available to this
 *    origin (a gist room needs them) and are denied to anything embedded.
 *  · HSTS — https only, once, for a year. It is inert on http://localhost.
 *
 * ─── WHAT IS REPORT-ONLY, AND WHY ────────────────────────────────────────────
 * The full Content-Security-Policy is REPORT-ONLY for now. Enforcing
 * `script-src`/`connect-src` blind would have to cover Privy, LiveKit's room
 * and its websocket, the ws-gateway, the media host and the RPC proxy — and a
 * missed origin does not degrade, it breaks sign-in or the live room outright,
 * in production, for everyone. Report-Only lets the violations show up first.
 * Promote it to `Content-Security-Policy` once the reports are quiet, and keep
 * `frame-ancestors` in both so the framing defence never depends on that work
 * being finished.
 */
const REPORT_ONLY_CSP = [
  "default-src 'self'",
  // Next ships inline bootstrap script; 'unsafe-inline' is why this is not yet
  // enforced. Tightening it needs nonces, which is its own change.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Privy, the gateway socket, LiveKit and the API all live here.
  "connect-src 'self' https: wss: ws:",
  // Privy's auth flow uses its own frames; this is not `frame-ancestors`.
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: REPORT_ONLY_CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/**
 * LINK-PREVIEW CRAWLERS THAT MUST GET METADATA IN <head>.
 *
 * A page with `generateMetadata` streams its tags into <body> after the first
 * bytes — fine for a browser, invisible to a crawler that reads <head> and
 * stops. Next renders them blocking only for user agents matching
 * `htmlLimitedBots`, and SETTING IT REPLACES Next's own list rather than adding
 * to it.
 *
 * So the default is IMPORTED, not copied: every bot Next adds in an upgrade is
 * kept automatically, and if Next ever moves the file the build fails loudly
 * instead of our previews silently losing WhatsApp. Its list already covers
 * WhatsApp, Facebook, X, Telegram (whose "TelegramBot (like TwitterBot)" the
 * case-insensitive Twitterbot matches), Slack, Discord, LinkedIn and iMessage.
 * These are the preview crawlers it misses.
 */
const EXTRA_PREVIEW_BOTS = ["Pinterestbot", "Mastodon", "Snap URL Preview", "Viber"];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|${EXTRA_PREVIEW_BOTS.join("|")}`, "i"),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  /*
    THE BUILD ARK MOUNTS answers under /square (see lib/square-path). The routes
    and public files stay where they are; `/square/…` is rewritten onto them
    BEFORE the filesystem is checked, so pages, route handlers and public files
    all resolve. The standalone build (no base) gets no rewrites at all and is
    exactly what it was.
  */
  async rewrites() {
    const base = parseBase(process.env.NEXT_PUBLIC_SQUARE_BASE_PATH);
    if (base === "") return [];
    return {
      beforeFiles: [
        { source: base, destination: "/" },
        { source: `${base}/:path*`, destination: "/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

/*
  THE BUILD ARK MOUNTS runs as a Vercel microfrontend at www.tsionark.com/square,
  beside WSWS (microfrontends.json lives in wsws-frontend). `withMicrofrontends`
  adds the asset prefix and reads the group's routing config, and it THROWS
  when that config is absent ("Missing MFE_CONFIG"). So it is on only where
  SQUARE_MICROFRONTENDS=1 — the Vercel project in the group — and never on the
  standalone square.tsionark.com build.
*/
export default process.env.SQUARE_MICROFRONTENDS === "1" ? withMicrofrontends(nextConfig) : nextConfig;
