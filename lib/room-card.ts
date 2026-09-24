/**
 * THE SHARE CARD FOR A SCHEDULED GIST ROOM — nodes 2225:20203 and 2225:20207.
 *
 * A picture somebody can send in WhatsApp: the room's cover under a ticket
 * silhouette, its name, when it starts, who is hosting, and a QR code that
 * opens the room. ogazboiz, 2026-09-24: "if they create a schedule gist room
 * and i want to share it ... maybe by whatsapp ... so share by card so they
 * can invite people".
 *
 * ─── WHY THE CARD CARRIES ITS DATA IN THE URL ───────────────────────────────
 * The same shape `wink-card` and `profile-card` use: the CLIENT encodes what
 * it already has and the route renders it. The alternative — the route
 * fetching the room itself — would make an image request into an API request,
 * would need a token for a private room it has no business reading, and would
 * fail differently from the page that linked to it.
 *
 * It also means the card cannot leak: everything in the picture is something
 * the sharer could already see, because it came from their screen.
 *
 * ─── WHAT IS DELIBERATELY NOT IN IT ─────────────────────────────────────────
 * THE ROOM CODE. A code lets anybody who sees the picture walk in, and a
 * picture travels further than the person who sent it — into a group, a
 * screenshot, a forward. The QR encodes the room's LINK, which honours the
 * room's own visibility and invite rules on arrival; the picture is an
 * invitation, not a key.
 */

/** Everything the picture draws. Parsed from a query string, never trusted. */
export interface RoomCardFace {
  /** The room's own page — what the QR encodes and where a tap lands. */
  url: string;
  title: string;
  /** ISO start time; the card prints the date and the clock separately. */
  startsAt: string | null;
  hostName: string | null;
  hostAvatarUrl: string | null;
  /** The room's cover. Absent draws the Square mark on the purple ramp. */
  coverUrl: string | null;
}

/** Cap every string, so a crafted link cannot make the renderer do work. */
const MAX = { url: 512, title: 140, hostName: 60, imageUrl: 512 } as const;

function clamp(raw: string | null, limit: number): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

/**
 * ONLY http(s), and only what a browser would fetch.
 *
 * These strings become an `<img src>` inside the renderer. A `file:` or
 * `data:` URL there is the renderer reading the disk or decoding whatever it
 * is handed, on a route anybody can call with any query string.
 */
function safeImageUrl(raw: string | null): string | null {
  const value = clamp(raw, MAX.imageUrl);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

export function parseRoomCard(params: URLSearchParams): RoomCardFace | null {
  const url = safeImageUrl(params.get("url"));
  const title = clamp(params.get("title"), MAX.title);
  // Without a destination the QR points nowhere and the card is decoration;
  // without a name there is nothing to invite anybody to.
  if (!url || !title) return null;
  return {
    url,
    title,
    startsAt: clamp(params.get("at"), 40),
    hostName: clamp(params.get("host"), MAX.hostName),
    hostAvatarUrl: safeImageUrl(params.get("avatar")),
    coverUrl: safeImageUrl(params.get("cover")),
  };
}

/** The query the client builds. Mirrors `parseRoomCard` key for key. */
export function roomCardQuery(face: RoomCardFace): string {
  const params = new URLSearchParams({ url: face.url, title: face.title });
  if (face.startsAt) params.set("at", face.startsAt);
  if (face.hostName) params.set("host", face.hostName);
  if (face.hostAvatarUrl) params.set("avatar", face.hostAvatarUrl);
  if (face.coverUrl) params.set("cover", face.coverUrl);
  return params.toString();
}

/**
 * What the saved file is called.
 *
 * Named after the ROOM rather than the sender, because the picture is about
 * the room — a gallery full of `square-card.png` helps nobody find the one
 * they meant to forward.
 */
export function roomCardFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  return `${slug || "gist-room"}-square.png`;
}
