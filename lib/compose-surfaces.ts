/**
 * Which surfaces carry a compose control.
 *
 * Posting is a global act — a reader on `/store` should not have to navigate
 * home to write something — so the default is "everywhere" and the list below
 * is the argued set of exceptions:
 *
 *   - `/live/:id` — the immersive stage owns the whole viewport and already
 *     has its own overlay rail (heart, gift, chat, share). AppShell renders
 *     that route bare, so nothing would draw there anyway; it is listed so the
 *     rule is stated rather than left as a side effect of the early return.
 *   - `/studio/:id` — the broadcast cockpit. A floating button sitting over
 *     the live preview and device controls is a mis-click risk while on air.
 *   - `/admin/**`, `/operations/**` — dense operator tables where a floating
 *     control overlaps row actions, and where posting is not the task.
 *   - `/auth` — there is no one to post as yet.
 *   - `/messages` — the chat surface has its own `+`, INSIDE the conversation
 *     column, where node 15:1302 draws it and where a `+` means "start a new
 *     conversation". The shell's button holds the right edge of the VIEWPORT,
 *     which on this two-pane route lands it over the thread beside a message
 *     composer — so both would be on screen at once, in the wrong order of
 *     prominence, and the one under the reader's hand would be the one that
 *     writes a public post. Suppressed here so exactly one purple circle is
 *     visible and it does what its position implies.
 *
 * The INDEX routes deliberately keep it: `/studio` is a list of streams,
 * `/live` is a directory and `/gist-rooms` is a list of rooms — none of them a
 * broadcast or two-pane surface. That distinction is the whole reason these are
 * prefix rules with a trailing slash rather than plain `startsWith` on the
 * section name.
 *
 * ─── `/gist-rooms` WAS AN EXCEPTION AND SHOULD NOT HAVE BEEN ─────────────────
 * It was suppressed here on the argument that node 407:17286 draws a `+` in
 * that same corner which opens a ROOM, so the shell's circle would be a second
 * identical button doing a different thing — "the page mounts its own".
 *
 * THE PAGE MOUNTS NOTHING. `GistRoomsScreen` renders the search row and
 * `HousesStreet`, and that design (the header of houses-street says so in its
 * own words) dropped 407:17074's "Happening Now!", its topic row AND its
 * floating create button. So the collision this exception avoided never
 * existed, and the only effect was that the dock's `+` — the one control on
 * every other list in the app — vanished on the rooms list. ogazboiz, on
 * 2026-09-23, looking at the route: "in the gist room there is no that plus
 * button ... why only in the home page".
 *
 * A suppression is a promise that something else is there. When nothing is,
 * the reader is left with a missing control and no way to name what is gone.
 * The dock's `+` asks "a post, or a gist room?" (`CreateChoiceSheet`), so on
 * this page it reaches the room composer in one more tap rather than being the
 * wrong button — which is the opposite of the risk that was argued.
 *
 * `/gist-rooms/:id` stays excluded by the prefix rule: that IS an immersive
 * room, and the floating circle lands over the stage there.
 */
import { stripSquare } from "./square-path.ts";

const NO_COMPOSE_EXACT = ["/auth", "/operations", "/messages"];
const NO_COMPOSE_PREFIX = ["/live/", "/studio/", "/admin", "/operations/", "/gist-rooms/"];

export function allowsCompose(pathname: string): boolean {
  // The rules name LOGICAL routes. `usePathname()` answers /square/… since the
  // move, so it is normalised here, once, rather than at every caller — a caller
  // that forgot would silently put a compose button on the wrong screen.
  const path = stripSquare(pathname);
  if (NO_COMPOSE_EXACT.includes(path)) return false;
  return !NO_COMPOSE_PREFIX.some((prefix) => path.startsWith(prefix));
}

/**
 * Whether the SIDEBAR carries its Post gist button — which is a different
 * question, and was wrongly answered by `allowsCompose` above.
 *
 * Every exception in that list is an argument about a FLOATING control: it
 * holds the right edge of the viewport, so it lands over a live preview, over
 * operator rows, or beside a message composer where the button under your hand
 * would be the one that writes a public post. The rail's button is none of
 * that. It sits on the far left, in chrome that is already there, overlapping
 * nothing — and node 496:13107 draws it on the rail unconditionally.
 *
 * The symptom: on `/messages` the sidebar simply had no Post gist. Two thirds
 * of the rail's own furniture vanished on one route for a reason that belonged
 * to a control at the other side of the screen.
 *
 * `/auth` is the one real exception and it survives, for the reason it always
 * had: there is nobody to post as yet. Everything else that hides the rail —
 * `/live/:id` and `/studio/:id` render bare — hides this with it, so those need
 * no entry here.
 */
export function allowsRailCompose(pathname: string): boolean {
  return stripSquare(pathname) !== "/auth";
}
