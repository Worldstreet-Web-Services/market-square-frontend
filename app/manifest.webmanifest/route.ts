import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/og-metadata";
import { SQUARE_BASE, asset, sq } from "@/lib/square-path";

/**
 * THE WEB APP MANIFEST, AND WHY IT IS THE WHOLE IPHONE STORY.
 *
 * Web push has been fully built on both sides for a while — the service
 * worker, the subscription, the Settings row, the service's fifteen kinds. On
 * Android and on a desktop that is enough: Chrome will put a Square card on
 * the lock screen with nothing installed.
 *
 * Safari will not. On iOS a website may show a notification ONLY once it has
 * been added to the Home Screen, and a site with no manifest cannot be added
 * to the Home Screen as an app — `PushManager` is not even defined in the
 * tab. So the absence of this file was not a missing nicety; it was the reason
 * push on an iPhone was impossible no matter what the service did.
 *
 * ─── TWO BUILDS, TWO INSTALLABLE APPS ────────────────────────────────────────
 * Standalone (`square.tsionark.com`) the Square owns the origin. Inside Ark
 * (`www.tsionark.com/square`) it is a zone beside WSWS, and `scope` MUST be
 * `/square` there: a manifest claiming `/` would let an installed Square
 * swallow WSWS's own pages into its window. `id` is pinned to the same value
 * so a browser treats the two as two apps rather than re-identifying one when
 * a URL changes.
 *
 * `/square/manifest.webmanifest` resolves because next.config rewrites
 * `/square/:path*` before the filesystem is checked — the same reason
 * `/square/sw.js` resolves — so one file serves both builds and every path it
 * contains goes through the same helpers the rest of the app uses.
 *
 * ─── WHY THIS IS A ROUTE HANDLER AND NOT `app/manifest.ts` ───────────────────
 * It was `app/manifest.ts` first. That convention serves the same URL, but it
 * ALSO writes the link tag itself — `<link rel="manifest"
 * href="/manifest.webmanifest">`, with no prefix and no way to change it, and
 * it wins over `metadata.manifest`. Inside Ark that href resolves to
 * `www.tsionark.com/manifest.webmanifest`: WSWS's origin root, not ours. The
 * body was correctly prefixed and the link pointed somewhere else, which is
 * the sort of thing that reads fine in a diff and is only visible in the built
 * HTML — where it was caught.
 *
 * A route handler serves the identical URL and emits no tag, so the one link
 * in the document is the prefixed one `app/layout.tsx` declares. Both halves
 * are pinned in shell-invariants.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(manifest()), {
    headers: { "content-type": "application/manifest+json" },
  });
}

function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity for the installed app, per build.
    id: sq("/"),
    name: `${SITE_NAME} — meet people`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: sq("/"),
    // Everything this app owns, and nothing that belongs to WSWS.
    scope: SQUARE_BASE === "" ? "/" : `${SQUARE_BASE}/`,
    /*
      `standalone` is what makes iOS treat the Home Screen tile as an app and
      hand it a notification permission at all. It also removes Safari's
      chrome, which is why every screen in this app already pads for the
      safe-area insets.
    */
    display: "standalone",
    orientation: "portrait",
    // The wash the app actually paints (`ws-wash` is a bloom on #000), so the
    // launch screen does not flash white before the first paint.
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["social"],
    icons: [
      /*
        THE MARK AT 70% OF THE TILE, on the same #121214 the shipped
        `apple-icon.png` uses — that ratio and that colour were measured off it
        rather than chosen, so the Home Screen tile and the Android launcher
        icon are the same object.

        `maskable` is a SEPARATE, smaller drawing on purpose: Android crops a
        maskable icon to whatever shape the launcher likes, and a mark sized
        for a square tile loses its corners in a circle. `any` and `maskable`
        are never set on one entry for that reason.
      */
      { src: asset("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: asset("/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
