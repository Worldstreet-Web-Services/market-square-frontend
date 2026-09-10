import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { readFontMetrics, type FontMetrics } from "@/lib/font-metrics";
import { layoutText, type TextPiece } from "@/lib/kerned-text";
import { parseWinkCard, winkCardFileName, type WinkCardFace } from "@/lib/wink-card";

/**
 * THE WINK CARD, SAVED — the picture behind the popup's Download and Share.
 *
 * It is the popup's card (node 647:16628), drawn again at the popup's own
 * numbers: the 441 x 472 `#1A1A1A` frame and its `#6155F5` ring, the rays at
 * 6%, both purple glows, the stars and the hugging heart, the two tilted
 * portraits, the two lines run for run, and the button stack. Every offset
 * below is the one in `components/layout/friends-popup.tsx`; change one and
 * change both. Like the popup, the buttons follow the text by 16.9 and the card
 * grows past 472 to keep 24 beneath them when the text runs to three lines.
 *
 * It used to be a composition of its own — a heart, a square initial, one
 * line — and saved as something the reader had never seen: "it suppose to be
 * exactly like the wink card".
 *
 * WHAT IS LEFT OFF: the three corner discs (download, share, close) and the
 * "N more" count. They are controls for the popup, and in a picture they are
 * buttons that do nothing. So are the fan's peeking cards: they are other
 * people's faces, and this image is about one person.
 *
 * ─── HOW IT IS DRAWN ────────────────────────────────────────────────────────
 * `next/og`, server-side, at 3x (1323 x 1416) so it stays sharp in a gallery.
 * Not a DOM snapshot: html-to-image and friends re-implement layout in
 * JavaScript and are unreliable on exactly what this card is made of —
 * blurred glows and SVG artwork — and come back blank on the phones that
 * share the most.
 *
 * Two things `next/og` does not do the browser's way, each checked against a
 * Chrome render of the popup's markup rather than eyeballed:
 *   · `filter: blur(99px)` renders nothing. Each glow is a radial gradient with
 *     the blurred disc's own falloff, on a layer the size of the card — a
 *     gradient box at negative offsets is clipped short, which drew the glows
 *     as hard-edged rectangles.
 *   · it applies NO kerning, so its lines ran ~2% wider than the popup's and
 *     wrapped a word early. `lib/kerned-text` breaks the lines with the font's
 *     own kerned widths and sets each kerned pair as a margin.
 *
 * Every image is fetched HERE, with a timeout, and handed over as a data URI:
 * a broken avatar URL leaves that face on the card's own ground instead of
 * failing the whole picture.
 */
export const runtime = "nodejs";

const S = 3;
const px = (n: number) => n * S;
const CARD_W = 441;
const CARD_H = 472;
const WHITE_DIM = "rgba(255,255,255,0.38)";

type Font = { name: string; data: Buffer; weight: 500 | 700; style: "normal" };
type Fonts = { list: Font[]; medium: FontMetrics; bold: FontMetrics };
let fonts: Promise<Fonts> | null = null;
function loadFonts(): Promise<Fonts> {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
  ]).then(
    ([medium, bold]) => ({
      list: [
        { name: "Geist", data: medium, weight: 500, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
      medium: readFontMetrics(medium),
      bold: readFontMetrics(bold),
    }),
    (error: unknown) => {
      fonts = null; // a failed read is retried on the next request
      throw error;
    }
  );
  return fonts;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const IMAGE_MAX = 5 * 1024 * 1024;

async function loadImage(url: string): Promise<string | null> {
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
 * A #7E3BEB disc of 178 x 176 under blur(99px), centred on (cx, cy): a
 * Gaussian of peak 0.33 and σ ≈ 105 (the disc convolved with the blur), gone
 * by 330. Drawn on a layer the size of the card.
 */
function Glow({ cx, cy, height }: { cx: number; cy: number; height: number }) {
  const reach = 330;
  const stops = [0, 50, 100, 150, 200, 250, 300, reach].map((d) => {
    const alpha = d === reach ? 0 : 0.33 * Math.exp(-(d * d) / (2 * 105 * 105));
    return `rgba(126,59,235,${alpha.toFixed(4)}) ${((d / reach) * 100).toFixed(2)}%`;
  });
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: 0,
        top: 0,
        width: px(CARD_W),
        height: px(height),
        backgroundImage: `radial-gradient(circle ${px(reach)}px at ${px(cx)}px ${px(cy)}px, ${stops.join(", ")})`,
      }}
    />
  );
}

function Portrait({
  src,
  left,
  top,
  width,
  height,
  rotate,
}: {
  src: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
}) {
  const border = 4.645;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: px(left),
        top: px(top),
        width: px(width),
        height: px(height),
        overflow: "hidden",
        borderRadius: px(37.16),
        border: `${px(border)}px solid #FFFFFF`,
        background: "#EDEDED",
        boxShadow: `0 ${px(6.6)}px ${px(6.5)}px rgba(0,0,0,0.25)`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to a PNG; next/image has no meaning here
        <img
          src={src}
          alt=""
          width={px(width - border * 2)}
          height={px(height - border * 2)}
          style={{ objectFit: "cover" }}
        />
      ) : null}
    </div>
  );
}

/** One laid-out line: unkerned pieces, each pulled by the pair before it. */
function Pieces({ pieces }: { pieces: TextPiece[] }) {
  return (
    <div style={{ display: "flex" }}>
      {pieces.map((piece, i) => (
        <span
          key={i}
          style={{
            flexShrink: 0,
            whiteSpace: "pre",
            marginLeft: px(piece.kern),
            color: piece.dim ? WHITE_DIM : "#FFFFFF",
          }}
        >
          {piece.text}
        </span>
      ))}
    </div>
  );
}

function WinkGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M5.94921 5.89326C5.8956 5.27895 5.35402 4.82449 4.73973 4.87836C4.12579 4.93219 3.67166 5.47339 3.72524 6.08735C3.77882 6.7013 4.31983 7.15566 4.93381 7.10233C5.54815 7.04897 6.00282 6.50757 5.94921 5.89326ZM4.81534 5.61972C5.0189 5.60762 5.19412 5.76194 5.20784 5.96539C5.22156 6.16885 5.06864 6.3453 4.86531 6.36064C4.65966 6.37615 4.48077 6.22112 4.4669 6.01536C4.45302 5.80961 4.60948 5.63196 4.81534 5.61972Z" fill="#FFFFFF" />
      <path d="M11.8655 4.83691C12.0282 4.83849 12.1537 4.90127 12.2327 5.04917C12.2823 5.14156 12.2927 5.25011 12.2612 5.3502C12.2383 5.42143 12.1955 5.48464 12.1378 5.53237C12.0607 5.5971 11.8593 5.68843 11.7605 5.7375C11.5667 5.83344 11.3734 5.9305 11.1807 6.02865C11.1934 6.03469 11.206 6.04082 11.2186 6.04704L11.7584 6.3169C11.9422 6.40886 12.1924 6.49069 12.2594 6.70111C12.2912 6.80106 12.2823 6.90949 12.2349 7.00304C12.1878 7.09673 12.1051 7.16762 12.0053 7.19982C11.8221 7.25837 11.6912 7.17505 11.5332 7.09399L10.5711 6.61371C10.3988 6.52774 10.1886 6.43558 10.0334 6.32699C9.87202 6.21416 9.85332 5.9223 9.98409 5.77812C10.0847 5.66715 10.2732 5.59088 10.4121 5.52183L10.924 5.26633L11.4226 5.01646C11.5552 4.95009 11.7193 4.85057 11.8655 4.83691Z" fill="#FFFFFF" />
      <path d="M4.58765 8.78171C4.64006 8.77893 4.70461 8.78901 4.75337 8.80705C5.00405 8.89967 5.02612 9.10747 5.09721 9.32798C5.13127 9.43206 5.17163 9.53403 5.21807 9.63322C5.56519 10.3787 6.197 10.9538 6.97184 11.2294C7.73852 11.5007 8.58136 11.4578 9.31659 11.11C9.96015 10.8038 10.4776 10.284 10.7809 9.63906C10.8672 9.45105 10.916 9.28802 10.9772 9.09242C11.0142 8.97439 11.097 8.87352 11.2119 8.82122C11.3209 8.77192 11.4452 8.76841 11.5568 8.81173C11.664 8.85343 11.7502 8.93619 11.7963 9.04166C11.8216 9.09914 11.8339 9.16152 11.8325 9.22433C11.8287 9.37472 11.696 9.71436 11.6391 9.86227C11.5008 10.1899 11.3198 10.4979 11.1008 10.7781C10.4515 11.6022 9.50102 12.1341 8.45901 12.2563C7.4258 12.3767 6.38679 12.0848 5.56744 11.4439C4.99702 10.9976 4.56114 10.4022 4.30806 9.72357C4.2632 9.60656 4.18169 9.37743 4.16979 9.25625C4.14361 8.98951 4.34351 8.80603 4.58765 8.78171Z" fill="#FFFFFF" />
      <path d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM0.86179 8C0.86179 11.9423 4.05768 15.1382 8 15.1382C11.9423 15.1382 15.1382 11.9423 15.1382 8C15.1382 4.05768 11.9423 0.86179 8 0.86179C4.05768 0.86179 0.86179 4.05768 0.86179 8Z" fill="#FFFFFF" />
    </svg>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const card = parseWinkCard(url.searchParams);
  if (!card) {
    return new Response("This card link does not say who it is for.", { status: 400 });
  }
  const both = card.copy.faces === "both";

  const asset = (path: string) => loadImage(new URL(path, url.origin).toString());
  const faceSrc = async (face: WinkCardFace) =>
    (face.photo ? await loadImage(face.photo) : null) ?? (face.artwork ? await asset(face.artwork) : null);

  const [font, rays, stars, hug, otherSrc, viewerSrc] = await Promise.all([
    loadFonts(),
    asset("/friends/rays.svg"),
    asset("/friends/stars.svg"),
    asset("/friends/hug.svg"),
    faceSrc(card.other),
    both ? faceSrc(card.viewer) : Promise.resolve(null),
  ]);

  // The popup's paragraph: 238 wide, 14.71 bold; the headline and the subline
  // are separated by a <br>, so each wraps on its own.
  const lines = [
    ...layoutText(card.copy.headline, font.bold, 14.71, 238),
    ...layoutText(card.copy.subline, font.bold, 14.71, 238),
  ];
  const label = (text: string) => layoutText([{ text, dim: false }], font.medium, 11.77)[0]?.pieces ?? [];
  // The popup's flow, as a sum: buttons 16.9 under the last line, 24 under them.
  const buttonsTop = 311.8 + lines.length * 17.65 + 16.9;
  const cardH = Math.max(CARD_H, buttonsTop + (card.labels.secondary ? 36 + 12 + 36 : 36) + 24);

  const button = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: px(36),
    borderRadius: px(18),
    fontSize: px(11.77),
    fontWeight: 500,
    lineHeight: `${px(20.45)}px`,
  } as const;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: px(CARD_W),
          height: px(cardH),
          overflow: "hidden",
          borderRadius: px(25),
          border: `${px(0.735)}px solid #6155F5`,
          background: "#1A1A1A",
          fontFamily: "Geist",
        }}
      >
        {rays ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG
          <img src={rays} alt="" width={px(601)} height={px(602)} style={{ position: "absolute", left: px(-72), top: px(-121) }} />
        ) : null}
        {/* 647:16661 / 647:16662 — the discs at (-119, 438) and (390, -85), 178 x 176. */}
        <Glow cx={-119 + 89} cy={438 + 88} height={cardH} />
        <Glow cx={390 + 89} cy={-85 + 88} height={cardH} />
        {stars ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG
          <img src={stars} alt="" width={px(181)} height={px(110)} style={{ position: "absolute", left: px(127), top: px(37) }} />
        ) : null}
        {hug ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG
          <img src={hug} alt="" width={px(124)} height={px(107)} style={{ position: "absolute", left: px(159), top: px(43) }} />
        ) : null}

        {both ? <Portrait src={viewerSrc} left={93.8} top={155.2} width={136.6} height={145.6} rotate={-7.35} /> : null}
        <Portrait src={otherSrc} left={both ? 207.6 : 150.6} top={155.2} width={139.9} height={148.5} rotate={9.02} />

        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            left: px(104.4),
            top: px(311.8),
            width: px(238),
            fontSize: px(14.71),
            fontWeight: 700,
            lineHeight: `${px(17.65)}px`,
          }}
        >
          {lines.map((line, i) => (
            <Pieces key={i} pieces={line.pieces} />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            left: px(111.4),
            top: px(buttonsTop),
            width: px(219),
            gap: px(12),
          }}
        >
          <div style={{ ...button, width: px(214), backgroundImage: "linear-gradient(90deg, #9F65FD 0%, #5B05E6 100%)" }}>
            <Pieces pieces={label(card.labels.primary)} />
          </div>
          {card.labels.secondary ? (
            <div style={{ ...button, width: px(219), background: "#323232", gap: px(9.4) }}>
              {card.copy.secondary === "wink" ? <WinkGlyph size={px(16.3)} /> : null}
              <Pieces pieces={label(card.labels.secondary)} />
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: px(CARD_W),
      height: px(cardH),
      fonts: font.list,
      headers: {
        // The query carries everything the card says: same URL, same picture.
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        ...(url.searchParams.get("download") === "1"
          ? {
              "content-disposition": `attachment; filename="${winkCardFileName(card.username)}"`,
            }
          : {}),
      },
    }
  );
}
