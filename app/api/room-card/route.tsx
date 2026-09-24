import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { parseRoomCard, type RoomCardFace } from "@/lib/room-card";

/**
 * THE SHARE CARD FOR A SCHEDULED GIST ROOM — nodes 2225:20203 (with a cover)
 * and 2225:20207 (without).
 *
 * A picture to send in WhatsApp. The room's cover under a ticket silhouette,
 * a glass strip carrying the name and when it starts, a QR that opens the
 * room, and the host's name at the foot.
 *
 * ─── THE SHAPE IS THE WHOLE DESIGN, AND IT IS ONE SVG ───────────────────────
 * The card is a PENTAGON — a flat-bottomed ticket with a pitched roof — drawn
 * twice: the outer silhouette at 400x356 on `#9F65FD -> #7E3BEB`, and an inner
 * one at 382x190, inset 9, holding the cover.
 *
 * Both are `<svg>` rather than CSS. `next/og` renders through Satori, which
 * does not implement `clip-path`, so a div cannot be a pentagon; but Satori
 * does draw SVG, and an SVG `<clipPath>` around an `<image>` is the one way to
 * put a photograph inside a shape it understands. Learnt the same way the wink
 * card's notes were: by rendering it and looking, not by assuming.
 *
 * ─── WHAT THE TWO STATES ACTUALLY DIFFER BY ─────────────────────────────────
 * ONE FILL. With a cover the inner pentagon is the photograph; without one it
 * is `#7E3BEB -> #C27AFF` with the Square mark centred (2225:20207). Not two
 * layouts, and deliberately not a grey "no image" panel: a room whose host did
 * not upload anything still gets a card that looks made on purpose.
 *
 * A cover that fails to load falls back to the same mark, because a half-drawn
 * card is worse than one that never claimed to have a picture.
 *
 * ─── WHAT IS NOT IN THE PICTURE ─────────────────────────────────────────────
 * THE ROOM CODE — see `lib/room-card.ts`. A picture travels further than the
 * person who sent it, and a code in it is a key anybody can read off a
 * screenshot. The QR carries the LINK, which still honours the room's own
 * visibility on arrival.
 */
export const runtime = "nodejs";

/** 3x, as the wink card does: these end up in a gallery and get pinch-zoomed. */
const S = 3;
const px = (n: number) => n * S;

/** The file's own frame. Everything below is measured inside it. */
const CARD_W = 400;
const CARD_H = 356;
/** The roof's apex, measured off the render: the pitch starts at y=56. */
const ROOF = 56;
const INSET = 9;

type Font = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };
let fonts: Promise<Font[]> | null = null;
/**
 * TWO FACES, FOUR WEIGHTS — and the collapse is deliberate rather than lazy.
 *
 * `assets/fonts` carries Geist Medium and Geist Bold and nothing else. The
 * file asks for 400 on the date and 600 on the title, so 400 is served by
 * Medium and 600 by Bold: the date sits a touch heavier than drawn and the
 * title a touch heavier still. Both are one step, both keep the file's
 * RELATIVE order — quiet date, loud clock, title between them — which is what
 * the hierarchy is actually made of.
 *
 * Shipping two more .ttf files to gain one step of weight on a shared image is
 * a worse trade than the step; if the card ever needs true 400 it is two files
 * and four lines, and this note is the reason it has not been done.
 */
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
  ]).then(
    ([medium, bold]): Font[] => [
      { name: "Geist", data: medium, weight: 400, style: "normal" },
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: bold, weight: 600, style: "normal" },
      { name: "Geist", data: bold, weight: 700, style: "normal" },
    ],
    (error: unknown) => {
      fonts = null;
      throw error;
    }
  );
  return fonts;
}

/**
 * Fetched HERE, which makes this an SSRF surface — hence the protocol check in
 * `parseRoomCard`, a short timeout, a type allow-list and a size cap. A broken
 * cover leaves the card on its purple ramp rather than failing the picture.
 */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX = 6 * 1024 * 1024;
async function loadImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!IMAGE_TYPES.has(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > IMAGE_MAX) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The pentagon, as a path in the given box — the outline and the clip share it.
 *
 * THE APEX IS ROUNDED ALONG ITS OWN SLOPES, not by stepping a fixed distance
 * sideways. The first attempt did the latter — back off `r/2` in x on each
 * side and curve through the peak — and it drew a small NIPPLE at the top,
 * because the roof rises steeply and a horizontal step lands far below where
 * the curve wants to begin. Backing off `r` ALONG each edge instead puts both
 * ends of the curve the same distance from the point, which is what a rounded
 * corner is.
 */
function pentagon(w: number, h: number, roof: number, radius = 12): string {
  const apexR = Math.min(radius * 1.6, roof * 0.9);
  // Unit vector from the apex down each roof edge, so the curve starts the
  // same distance along both regardless of how steep the pitch is.
  const run = w / 2;
  const len = Math.hypot(run, roof);
  const dx = (run / len) * apexR;
  const dy = (roof / len) * apexR;
  return [
    `M 0 ${h - radius}`,
    `Q 0 ${h} ${radius} ${h}`,
    `L ${w - radius} ${h}`,
    `Q ${w} ${h} ${w} ${h - radius}`,
    `L ${w} ${roof}`,
    // up the right slope, stopping `apexR` short of the peak
    `L ${w / 2 + dx} ${dy}`,
    // through the peak itself, which is the control point
    `Q ${w / 2} 0 ${w / 2 - dx} ${dy}`,
    `L 0 ${roof}`,
    "Z",
  ].join(" ");
}

function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function clockLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toUpperCase();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const card: RoomCardFace | null = parseRoomCard(url.searchParams);
  if (!card) return new Response("This card link does not say which room it is for.", { status: 400 });

  const [list, cover, avatar, qr] = await Promise.all([
    loadFonts(),
    loadImage(card.coverUrl),
    loadImage(card.hostAvatarUrl),
    QRCode.toDataURL(card.url, {
      margin: 0,
      width: px(72),
      errorCorrectionLevel: "M",
      // White on transparent-ish purple: the card's ground is the quiet half,
      // and a white module block reads at arm's length on a phone screen.
      color: { dark: "#FFFFFFff", light: "#00000000" },
    }).catch(() => null),
  ]);

  const date = dateLabel(card.startsAt);
  const time = clockLabel(card.startsAt);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: px(CARD_W),
          height: px(CARD_H),
          fontFamily: "Geist",
        }}
      >
        {/* THE SILHOUETTE. One SVG holding the outer pentagon, the inner one,
            and the clip that puts the cover inside it — Satori draws SVG but
            not `clip-path`, so the shape and its contents must share a tree. */}
        <svg
          width={px(CARD_W)}
          height={px(CARD_H)}
          viewBox={`0 0 ${CARD_W} ${CARD_H}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9F65FD" />
              <stop offset="1" stopColor="#7E3BEB" />
            </linearGradient>
            <linearGradient id="empty" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7E3BEB" />
              <stop offset="1" stopColor="#C27AFF" />
            </linearGradient>
            <clipPath id="inner">
              <path d={pentagon(CARD_W - INSET * 2, 190, ROOF - INSET, 10)} />
            </clipPath>
          </defs>

          <path d={pentagon(CARD_W, CARD_H, ROOF)} fill="url(#shell)" />

          <g transform={`translate(${INSET} ${INSET})`}>
            {cover ? (
              <g clipPath="url(#inner)">
                {/* `slice` is object-cover: a portrait cover fills the pitch
                    rather than letterboxing inside it. */}
                <image
                  href={cover}
                  width={CARD_W - INSET * 2}
                  height={190}
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
            ) : (
              <path d={pentagon(CARD_W - INSET * 2, 190, ROOF - INSET, 10)} fill="url(#empty)" />
            )}
          </g>
        </svg>

        {/* THE SQUARE MARK, only where there is no cover (2225:20207). Drawn as
            the app's own speech-bubble block rather than fetched, so a card
            with no picture never depends on the network for its centrepiece. */}
        {!cover && (
          <div
            style={{
              position: "absolute",
              left: px(CARD_W / 2 - 39),
              top: px(INSET + 55),
              display: "flex",
              width: px(78),
              height: px(57),
            }}
          >
            <svg width={px(78)} height={px(57)} viewBox="0 0 78 57">
              <path d="M6 4h52a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H26L14 53V42H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="#FFFFFF" />
              <path d="M62 4h6a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4h-6Z" fill="#4A1E8F" />
              <circle cx="24" cy="23" r="4" fill="#7E3BEB" />
              <circle cx="36" cy="23" r="4" fill="#7E3BEB" />
              <circle cx="48" cy="23" r="4" fill="#7E3BEB" />
            </svg>
          </div>
        )}

        {/* `Frame 2147230828` — 380x54 at radius 10 on white/14, the strip that
            carries what the room IS. */}
        <div
          style={{
            position: "absolute",
            left: px(10),
            top: px(211),
            display: "flex",
            alignItems: "center",
            width: px(380),
            height: px(54),
            borderRadius: px(10),
            background: "rgba(255,255,255,0.14)",
            paddingLeft: px(10),
            paddingRight: px(12),
          }}
        >
          {/* The bell — 32 round, white at 18%, the file's glass disc. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: px(32),
              height: px(32),
              borderRadius: px(16),
              background: "rgba(255,255,255,0.18)",
            }}
          >
            <svg width={px(16)} height={px(16)} viewBox="0 0 16 16">
              <path
                d="M8 1.6a4.2 4.2 0 0 0-4.2 4.2v2.3L2.6 10a.7.7 0 0 0 .6 1.1h9.6a.7.7 0 0 0 .6-1.1l-1.2-1.9V5.8A4.2 4.2 0 0 0 8 1.6Z"
                fill="#FFFFFF"
              />
              <path d="M6.3 12.2a1.8 1.8 0 0 0 3.4 0Z" fill="#FFFFFF" />
            </svg>
          </div>

          {/* The name, at the file's 12.625/13.8875. Two lines, clipped — a
              third would push the strip off its own 54. */}
          <div
            style={{
              display: "flex",
              flex: 1,
              minWidth: 0,
              marginLeft: px(10),
              marginRight: px(8),
              fontSize: px(12.625),
              lineHeight: px(13.8875) / px(12.625),
              fontWeight: 600,
              color: "#FFFFFF",
              // Upper-case is the file's, on the string rather than in CSS:
              // Satori does not implement `text-transform`.
            }}
          >
            {card.title.toUpperCase()}
          </div>

          {/* When it starts, right-aligned: the date quiet, the clock loud. */}
          {(date || time) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {date && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: px(8),
                    fontWeight: 400,
                    color: "#FFFFFF",
                  }}
                >
                  <svg width={px(9)} height={px(9)} viewBox="0 0 12 12" style={{ marginRight: px(3) }}>
                    <rect x="1" y="2.2" width="10" height="8.6" rx="1.6" stroke="#FFFFFF" strokeWidth="1" fill="none" />
                    <path d="M1 4.8h10M3.6 1.2v2M8.4 1.2v2" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  {date}
                </div>
              )}
              {time && (
                <div style={{ display: "flex", fontSize: px(16), fontWeight: 700, color: "#FFFFFF" }}>
                  {time}
                </div>
              )}
            </div>
          )}
        </div>

        {/* The QR, bottom-left — what actually gets somebody into the room. */}
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URI inside the renderer
          <img
            src={qr}
            alt=""
            width={px(72)}
            height={px(72)}
            style={{ position: "absolute", left: px(16), top: px(CARD_H - 88) }}
          />
        )}

        {/* WHO IS HOSTING, bottom-right. Absent rather than "Someone" when the
            sharer's own screen did not know — a card that names nobody is
            better than one that names a placeholder. */}
        {card.hostName && (
          <div
            style={{
              position: "absolute",
              right: px(16),
              top: px(CARD_H - 30),
              display: "flex",
              alignItems: "center",
            }}
          >
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URI inside the renderer
              <img
                src={avatar}
                alt=""
                width={px(13.3)}
                height={px(13.3)}
                style={{ borderRadius: px(7), marginRight: px(4), objectFit: "cover" }}
              />
            )}
            <div style={{ display: "flex", fontSize: px(6.656), fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
              Hosted by&nbsp;
            </div>
            <div style={{ display: "flex", fontSize: px(6.656), fontWeight: 700, color: "#FFFFFF" }}>
              {card.hostName}
            </div>
          </div>
        )}
      </div>
    ),
    {
      width: px(CARD_W),
      height: px(CARD_H),
      fonts: list,
      headers: { "cache-control": "public, max-age=300" },
    }
  );
}
