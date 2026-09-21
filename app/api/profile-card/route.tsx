import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { parseProfileCard } from "@/lib/profile-card";
import { AVATAR_ARTWORK, initialsOf, resolveSeed, seedIndex } from "@/lib/avatar-seed";

/**
 * THE PROFILE SHARE CARD, SAVED — the picture behind the "Share Profile"
 * modal's preview, Download and Share (node 1624:21811).
 *
 * Drawn with `next/og` server-side, at 2x for a sharp gallery image, and NOT a
 * DOM snapshot: html-to-image is unreliable on exactly what this card is made
 * of (a full-bleed photo, a QR, gradients) and comes back blank on the phones
 * that share the most. The modal renders THIS url into an <img>, so the preview
 * and the saved file are the same bytes.
 *
 * The photo is fetched HERE (an SSRF target — see `safePhoto`), with a timeout,
 * and a broken URL leaves the card on its accent ground rather than failing the
 * whole picture. The QR is generated from the profile URL the query carries.
 */
export const runtime = "nodejs";

const S = 2;
const px = (n: number) => n * S;
const CARD_W = 529;
const CARD_H = 610;
const DIM = "rgba(255,255,255,0.5)";

type Font = { name: string; data: Buffer; weight: 500 | 700; style: "normal" };
let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
  ]).then(
    ([medium, bold]): Font[] => [
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: bold, weight: 700, style: "normal" },
    ],
    (error: unknown) => {
      fonts = null;
      throw error;
    }
  );
  return fonts;
}

// SVG included: some avatars (generated / brand marks) are SVG, and the design
// asks for whatever the user actually has.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const IMAGE_MAX = 6 * 1024 * 1024;
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
 * The SEEDED mascot the app's Avatar shows when there is no upload — the same
 * `public/avatar/avatar-0X.jpg` picked by the same seed, so the card shows the
 * face the user actually has rather than a blank panel. Read from disk (a
 * local, trusted file), never fetched.
 */
async function loadSeededAvatar(seed: string, name: string, username: string): Promise<string | null> {
  const resolved = resolveSeed({ id: seed, username, name });
  if (!resolved) return null;
  // AVATAR_ARTWORK entries are `/avatar/avatar-0X.jpg` (possibly /square-prefixed);
  // read the file by its basename to stay prefix-agnostic.
  const chosen = AVATAR_ARTWORK[seedIndex(resolved, AVATAR_ARTWORK.length)];
  const base = chosen?.split("/").pop();
  if (!base) return null;
  try {
    const buf = await readFile(join(process.cwd(), "public/avatar", base));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function VerifiedSeal({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 1.5l2.6 1.9 3.2-.1 1 3.05 2.6 1.9-1 3.05 1 3.05-2.6 1.9-1 3.05-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3.05-2.6-1.9 1-3.05-1-3.05 2.6-1.9 1-3.05 3.2.1L12 1.5z"
        fill="#D4D4D8"
      />
      <path d="M8.2 12.2l2.5 2.5 5-5" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Node 1583:18396 — the "Follow on Square" logo mark, the file's own export (43×32). */
function SquareMark({ height }: { height: number }) {
  const width = (height * 43) / 32;
  return (
    <svg width={width} height={height} viewBox="0 0 43 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sqlogo_a" x1="20.5" y1="24" x2="-3.5" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7E3BEB" />
          <stop offset="0.171352" stopColor="#472185" />
        </linearGradient>
        <linearGradient id="sqlogo_b" x1="9.5" y1="17" x2="19" y2="17.25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#999999" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
      </defs>
      <path
        d="M18.7023 0.0247741L41.7412 2.84587C42.4599 2.93387 43 3.54413 43 4.26816V30.5671C43 31.3585 42.3585 32 41.5671 32H18H1.43291C0.641537 32 0 31.3585 0 30.5671V4.21927C0 3.51643 0.509766 2.91734 1.20354 2.80483L18.2988 0.0326278C18.4323 0.0109849 18.5681 0.0083408 18.7023 0.0247741Z"
        fill="url(#sqlogo_a)"
      />
      <path
        d="M40.5 25.0216V7.77595C40.5 7.0486 39.9551 6.43664 39.2326 6.35263L20.5984 4.18586C19.7472 4.08688 19 4.75223 19 5.60919V27.4762C19 28.685 20.4047 29.3507 21.3403 28.5852L24.0845 26.34C24.3524 26.1208 24.6906 26.006 25.0366 26.0168L39.0223 26.4538C39.8308 26.4791 40.5 25.8305 40.5 25.0216Z"
        fill="url(#sqlogo_b)"
      />
      <path
        d="M35.5808 14.663C36.4071 14.7208 37.0302 15.4377 36.9725 16.264C36.9147 17.0904 36.198 17.7135 35.3716 17.6557C34.5451 17.5979 33.9221 16.8811 33.9798 16.0547C34.0377 15.2284 34.7545 14.6052 35.5808 14.663ZM27.6004 14.103C28.4267 14.1608 29.0498 14.8778 28.9922 15.704C28.9344 16.5304 28.2175 17.1534 27.3912 17.0957C26.5648 17.0379 25.9417 16.3211 25.9995 15.4947C26.0574 14.6685 26.7741 14.0452 27.6004 14.103ZM31.5897 14.382C32.4161 14.4398 33.0392 15.1565 32.9814 15.9829C32.9237 16.8094 32.2069 17.4324 31.3805 17.3747C30.5541 17.3168 29.931 16.6 29.9887 15.7737C30.0465 14.9473 30.7634 14.3243 31.5897 14.382Z"
        fill="#7E3BEB"
      />
    </svg>
  );
}

/** The identity + "Follow on Square" row, shared by every variant. */
function Footer({ card }: { card: { name: string; username: string; verified: boolean } }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: px(24),
        top: px(532),
        width: px(481),
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: px(4), width: px(184) }}>
        <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
          <span style={{ fontSize: px(16), fontWeight: 700, color: "#FFFFFF" }}>{card.name}</span>
          {card.verified ? <VerifiedSeal size={px(16)} /> : null}
        </div>
        {card.username ? (
          <span style={{ fontSize: px(16), fontWeight: 500, color: DIM }}>@{card.username}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
        <span style={{ fontSize: px(14), fontWeight: 500, color: DIM }}>Follow on</span>
        <div style={{ display: "flex", alignItems: "center", gap: px(5.333) }}>
          <SquareMark height={px(32)} />
          <span style={{ fontSize: px(21.333), fontWeight: 700, color: "#FFFFFF" }}>Square</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The QR drawn with ROUNDED modules and rounded finder eyes (node 1621:20437's
 * style), with a clear disc in the centre for the avatar. Built from the QR
 * matrix at error-correction H, so clearing the middle still scans.
 */
function StyledQR({ url, dim }: { url: string; dim: number }) {
  let size = 0;
  let data: Uint8Array | number[] = [];
  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
    size = qr.modules.size;
    data = qr.modules.data;
  } catch {
    return null;
  }
  const dark = (r: number, c: number) => Boolean(data[r * size + c]);
  const finders: Array<[number, number]> = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  const mid = (size - 1) / 2;
  const clearR = size * 0.16; // the centre disc under the avatar
  const inClear = (r: number, c: number) => Math.hypot(r - mid, c - mid) <= clearR;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (inFinder(r, c) || inClear(r, c) || !dark(r, c)) continue;
      cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} rx={0.36} fill="#0B0B0C" />);
    }
  }
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      {cells}
      {finders.map(([fr, fc], i) => (
        <g key={`eye-${i}`}>
          <rect x={fc} y={fr} width={7} height={7} rx={2.4} fill="#0B0B0C" />
          <rect x={fc + 1} y={fr + 1} width={5} height={5} rx={1.6} fill="#FFFFFF" />
          <rect x={fc + 2} y={fr + 2} width={3} height={3} rx={1} fill="#0B0B0C" />
        </g>
      ))}
    </svg>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const card = parseProfileCard(url.searchParams);
  if (!card) return new Response("This card link does not say who it is for.", { status: 400 });

  const [list, upload, smallQr] = await Promise.all([
    loadFonts(),
    card.photo ? loadImage(card.photo) : Promise.resolve(null),
    // The small corner QR the photo variant uses.
    card.variant !== 1 && card.url
      ? QRCode.toDataURL(card.url, {
          margin: 0,
          width: px(72),
          errorCorrectionLevel: "M",
          color: { dark: "#0B0B0Cff", light: "#FFFFFFff" },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  // The user's own upload wins; else the seeded mascot the app shows; else the
  // name's initials on the seeded ground.
  const photo = upload ?? (await loadSeededAvatar(card.seed, card.name, card.username));
  const initials = photo ? null : initialsOf(card.name);

  const shell = {
    position: "relative" as const,
    display: "flex" as const,
    width: px(CARD_W),
    height: px(CARD_H),
    background: "#1A1A1A",
    borderRadius: px(40),
    fontFamily: "Geist",
    overflow: "hidden" as const,
  };
  const options = {
    width: px(CARD_W),
    height: px(CARD_H),
    fonts: list,
    headers: { "cache-control": "public, max-age=300" },
  };

  // ─── VARIANT 2 (1621:20437): the big rounded QR with the avatar centred. ───
  if (card.variant === 1) {
    const qrBox = 389;
    const qrDim = 337;
    const avatarD = 84;
    return new ImageResponse(
      (
        <div style={shell}>
          {/* A soft purple glow at the foot, as the file draws. */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              left: px(-60),
              bottom: px(-40),
              width: px(300),
              height: px(300),
              backgroundImage: "radial-gradient(circle at 50% 50%, rgba(126,59,235,0.35) 0%, rgba(126,59,235,0) 70%)",
            }}
          />
          {/* The white QR tile, centred. */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              left: px((CARD_W - qrBox) / 2),
              top: px(74),
              width: px(qrBox),
              height: px(qrBox),
              borderRadius: px(40),
              background: "#FFFFFF",
            }}
          >
            {card.url ? <StyledQR url={card.url} dim={px(qrDim)} /> : null}
            {/* The avatar in the QR's centre, on a white ring. */}
            <div
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: px(avatarD),
                height: px(avatarD),
                borderRadius: px(avatarD),
                background: "#FFFFFF",
              }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to PNG
                <img
                  src={photo}
                  alt=""
                  width={px(avatarD - 8)}
                  height={px(avatarD - 8)}
                  style={{ borderRadius: px(avatarD), objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: px(avatarD - 8),
                    height: px(avatarD - 8),
                    borderRadius: px(avatarD),
                    background: "#EDEDED",
                    color: "#1A1A1A",
                    fontSize: px(26),
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
              )}
            </div>
          </div>
          <Footer card={card} />
        </div>
      ),
      options
    );
  }

  // ─── VARIANT 1 (1583:18266): the full-bleed photo with the corner QR. ───
  return new ImageResponse(
    (
      <div style={shell}>
        <div
          style={{
            position: "absolute",
            display: "flex",
            left: px(16),
            top: px(16),
            width: px(497),
            height: px(500),
            borderRadius: px(21),
            overflow: "hidden",
            background: "#141414",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to PNG
            <img
              src={photo}
              alt=""
              width={px(497)}
              height={px(500)}
              style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#EDEDED",
                color: "#1A1A1A",
                fontSize: px(140),
                fontWeight: 700,
              }}
            >
              {initials}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              display: "flex",
              left: 0,
              bottom: 0,
              width: px(497),
              height: px(160),
              backgroundImage: "linear-gradient(to top, #000000 12%, rgba(0,0,0,0) 92%)",
            }}
          />
          {smallQr ? (
            <div
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                right: px(14.79),
                bottom: px(15),
                width: px(80),
                height: px(80),
                borderRadius: px(10),
                background: "#FFFFFF",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to PNG */}
              <img src={smallQr} alt="" width={px(72)} height={px(72)} />
            </div>
          ) : null}
        </div>
        <Footer card={card} />
      </div>
    ),
    options
  );
}
