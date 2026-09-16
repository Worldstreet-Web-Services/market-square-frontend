import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FALLBACK_OG_IMAGE } from "@/lib/og-metadata";

/**
 * THE BRANDED SHARE CARD — what a link unfurls into when it has no picture of
 * its own: a text-only post, a profile without an avatar, a story, and every
 * route that must not publish data-driven previews (rooms, houses, invites).
 *
 * It is the real lockup (`public/square/logo.svg`, the same file `Wordmark` renders)
 * centred on the page ground, and nothing else — no redrawn mark and no copy
 * set in a stand-in typeface.
 *
 * A ROUTE HANDLER, NOT THE `opengraph-image` FILE CONVENTION. File-based
 * metadata "has the higher priority and will override the `metadata` object and
 * `generateMetadata` function" (Next's generate-metadata docs), so a root
 * `opengraph-image` risks replacing every post's own photo with this card —
 * the exact failure previews exist to fix. Served here, it is only ever the
 * image a page's metadata explicitly names.
 *
 * Static: prerendered at build and served from cache, so a crawler hit costs
 * nothing. Its size and type are `FALLBACK_OG_IMAGE`'s, so the tags describing
 * it can never disagree with the bytes.
 */
export const dynamic = "force-static";

// The lockup's own 148×45 box, scaled by a whole number so its edges stay crisp.
const LOCKUP_SCALE = 4;

export async function GET() {
  const svg = await readFile(join(process.cwd(), "public/square/logo.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f0f",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={src} width={148 * LOCKUP_SCALE} height={45 * LOCKUP_SCALE} alt="" />
      </div>
    ),
    { width: FALLBACK_OG_IMAGE.width, height: FALLBACK_OG_IMAGE.height }
  );
}
