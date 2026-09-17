/**
 * WHERE THE MINI-PLAYER SHOWS, and WHICH LINKS LEAVE THE SQUARE.
 *
 * Two pure decisions the shell makes on every navigation, kept out of the
 * components so `node --test` can pin them.
 */
import { SQUARE_BASE, squarePaths } from "../square-path.ts";
import type { SessionStatus } from "./reducer.ts";

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
