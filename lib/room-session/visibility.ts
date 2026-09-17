/**
 * WHERE THE MINI-PLAYER SHOWS, and WHICH LINKS LEAVE THE SQUARE.
 *
 * Two pure decisions the shell makes on every navigation, kept out of the
 * components so `node --test` can pin them.
 */
import { SQUARE_BASE, squarePaths } from "../square-path.ts";
import type { SessionState, SessionStatus } from "./reducer.ts";

/** Both spellings of a route — the standalone `/x` and Ark's `/square/x` — compared as one. */
const logical = squarePaths("/square").stripSquare;

export interface MiniPlayerInput {
  pathname: string;
  session: { status: SessionStatus; streamId: string | null } | null;
  /** A chat thread is open (lib/chat-open-store.ts). */
  chatOpen: boolean;
  isPhone: boolean;
  /** Another room's own bottom bar is up (lib/room-bar-store.ts) — it owns a phone's foot. */
  roomBarUp?: boolean;
}

/**
 * Is the minimised room on screen?
 *
 *  · Only while a session exists — `idle` draws nothing.
 *  · NOT on the active room's own page: the room IS the player there, and on a
 *    phone its own bottom bar owns that edge.
 *  · NOT on `/live/:id`, which renders bare and owns the whole viewport.
 *  · NOT on a phone while a chat thread is open (the bar would sit on the
 *    message composer) or while another room's own bottom bar is up. Audio
 *    carries on; only the chrome steps aside.
 */
export function miniPlayerVisible({ pathname, session, chatOpen, isPhone, roomBarUp = false }: MiniPlayerInput): boolean {
  if (!session || !session.streamId || session.status === "idle") return false;
  const path = logical(pathname);
  if (path === `/gist-rooms/${session.streamId}`) return false;
  if (/^\/live\/[^/]+$/.test(path)) return false;
  if (isPhone && (chatOpen || roomBarUp)) return false;
  return true;
}

/**
 * THE ROOM CHIP, while the bar itself has stepped aside on a phone.
 *
 * The bar hides for an open chat thread (it would sit on the composer) and
 * for another room's own bar. The room does not: winked back into a DM, it is
 * still playing, and a reader who cannot see it cannot hang it up, retry it,
 * dismiss "Room ended" or reach a mic they left open. So in EVERY connection
 * state a compact chip takes the bar's place, up top where the keyboard and
 * the composer cannot reach it — not only for a publisher with an open mic.
 */
export function roomChipVisible(input: MiniPlayerInput): boolean {
  const { pathname, session, chatOpen, isPhone, roomBarUp = false } = input;
  if (!isPhone || !(chatOpen || roomBarUp)) return false;
  if (!session || !session.streamId || session.status === "idle") return false;
  if (miniPlayerVisible(input)) return false;
  const path = logical(pathname);
  if (/^\/live\/[^/]+$/.test(path)) return false;
  return path !== `/gist-rooms/${session.streamId}`;
}

export interface MiniPlayerChromeInput {
  state: SessionState;
  presence: "host" | "speaker" | "listener" | null;
  micOn: boolean;
  canPlayAudio: boolean;
}

export interface MiniPlayerChrome {
  /** The state line under the title, or null for the "N in the room" row. */
  line: string | null;
  /** The reader holds a publishing seat: the mic control is drawn. */
  publishing: boolean;
  /** Publishing AND the mic is open — the "You're live" badge. */
  hotMic: boolean;
  /** Ended or evicted: Dismiss instead of Leave. */
  finished: boolean;
  /** The pulsing dot. */
  live: boolean;
  retry: boolean;
  listen: boolean;
  /** What the always-mounted live region says. */
  announcement: string;
}

/**
 * WHAT THE MINI-PLAYER DRAWS, from the CONNECTION rather than `status`.
 *
 * `status` reads `conflict` for as long as a "join another room?" question is
 * open — and an unanswered one used to hide the mic toggle, the "You're live"
 * badge and Retry, all while the mic stayed open or the room had dropped.
 * The question is its own line only when nothing more urgent is true.
 */
export function miniPlayerChrome({ state, presence, micOn, canPlayAudio }: MiniPlayerChromeInput): MiniPlayerChrome {
  const connection = state.connection;
  const asking = state.status === "conflict";
  const publishing =
    (presence === "host" || presence === "speaker") && (connection === "live" || connection === "reconnecting");
  const finished = connection === "ended" || connection === "duplicate";
  const line =
    connection === "connecting"
      ? "Connecting…"
      : connection === "reconnecting"
        ? "Reconnecting…"
        : connection === "failed"
          ? "Lost connection"
          : connection === "ended"
            ? state.endReason === "removed"
              ? "You were removed"
              : "Room ended"
            : connection === "duplicate"
              ? "Playing in another tab"
              : asking
                ? "Still playing"
                : !canPlayAudio
                  ? "Tap to listen"
                  : null;
  const hotMic = publishing && micOn;
  const mic = publishing ? (micOn ? "Your mic is live" : "Mic off") : null;
  return {
    line,
    publishing,
    hotMic,
    finished,
    live: connection === "live",
    retry: connection === "failed",
    listen: connection === "live" && !canPlayAudio,
    announcement: [line, mic].filter(Boolean).join(". ") || (connection === "live" ? "Live" : ""),
  };
}

/**
 * Does following this link leave the Square zone — a FULL page load that ends
 * the tab's room?
 *
 * Inside Ark (`base` = `/square`) every same-origin path outside `/square` is
 * another Next.js zone (Ark's Market, Portfolio, …), and so is any other
 * origin. The standalone build owns every root path, so only another origin
 * leaves it.
 */
export function isZoneExit(
  href: string,
  { base = SQUARE_BASE, origin }: { base?: "" | "/square"; origin?: string } = {}
): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("?")) return false;
  if (/^(mailto|tel|sms|javascript):/i.test(trimmed)) return false;

  let url: URL;
  const here = origin ?? "https://square.invalid";
  try {
    url = new URL(trimmed, here);
  } catch {
    return false;
  }
  if (url.origin !== new URL(here).origin) return true;
  if (base === "") return false;
  return !(url.pathname === base || url.pathname.startsWith(`${base}/`));
}
