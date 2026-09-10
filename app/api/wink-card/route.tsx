import { ImageResponse } from "next/og";

/**
 * THE WINK CARD AS A PICTURE — what Download and Share hand over.
 *
 * A wink is the loop the product is built on: somebody learns a stranger finds
 * them interesting, goes and looks, and the square gets two people in a room.
 * A card you can only see inside the app cannot start that loop anywhere else.
 * This renders the same moment as an image, so it can go into a WhatsApp
 * status or a group chat and bring somebody back with it.
 *
 * ─── WHY `next/og` AND NOT A DOM SNAPSHOT ───────────────────────────────────
 * The obvious approach is html-to-image or html2canvas over the live card.
 * Both mean a new dependency, both re-implement the browser's own layout in
 * JavaScript, and both are famously wrong about exactly the things this card
 * is made of: `backdrop-filter`, blurred radial glows, and SVG artwork with
 * its own fills. `ImageResponse` ships inside Next, renders server-side at a
 * fixed size, and produces the same PNG on every device — including the phones
 * where a canvas snapshot most often comes back blank.
 *
 * It is deliberately NOT a pixel copy of the on-screen card. That card is 441
 * wide, drawn for a modal, and full of controls that mean nothing in an image
 * ("Wink back", a close disc). What travels is the MOMENT: who winked, at
 * whom, and where it happened.
 *
 * ─── EVERY INPUT IS HOSTILE ─────────────────────────────────────────────────
 * The parameters arrive in a URL anybody can edit, and the result is an image
 * that looks like it came from us — which is exactly what somebody forging a
 * screenshot would want. So names are length-capped and the avatar must be an
 * `https:` URL, or it is dropped in favour of the initial. There is nothing
 * here worth forging (a wink is not a credential), but an unbounded string
 * would let somebody paste a paragraph into our frame and photograph it.
 */
export const runtime = "nodejs";

const W = 1080;
const H = 1080;
/** Long enough for a real display name, short enough not to be a billboard. */
const NAME_MAX = 40;

function clean(value: string | null, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Only an https image, and only as a picture — never as anything fetched. */
function safeAvatar(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = clean(params.get("name"), NAME_MAX) || "Someone";
  const handle = clean(params.get("handle"), NAME_MAX);
  const avatar = safeAvatar(params.get("avatar"));
  // `?download=1` is the only difference between the two buttons: the same
  // image, offered as a file rather than shown in a tab.
  const download = params.get("download") === "1";

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // The popup's own ground and its purple ramp, stated flat: a
          // backdrop blur has no meaning in a still image.
          background: "linear-gradient(160deg, #241A3D 0%, #1A1A1A 55%, #2A1B4A 100%)",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* The hug, drawn rather than fetched — one less thing that can fail
            at render time, and it survives the file being renamed. */}
        <div style={{ display: "flex", fontSize: 190, lineHeight: 1 }}>💜</div>

        <div
          style={{
            display: "flex",
            width: 300,
            height: 300,
            marginTop: 40,
            borderRadius: 64,
            overflow: "hidden",
            border: "10px solid white",
            alignItems: "center",
            justifyContent: "center",
            background: "#3A2E5A",
            fontSize: 140,
            fontWeight: 700,
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to a PNG; next/image has no meaning here
            <img src={avatar} alt="" width={300} height={300} style={{ objectFit: "cover" }} />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>

        <div style={{ display: "flex", marginTop: 56, fontSize: 62, fontWeight: 700 }}>
          {name} winked at you
        </div>
        {handle ? (
          <div style={{ display: "flex", marginTop: 14, fontSize: 38, color: "#C9B8F5" }}>
            @{handle}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 56,
            fontSize: 34,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          MARKET SQUARE
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // Same picture for the same person: cacheable, and cheap to re-share.
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        ...(download
          ? { "content-disposition": `attachment; filename="wink-from-${name || "square"}.png"` }
          : {}),
      },
    }
  );
}
