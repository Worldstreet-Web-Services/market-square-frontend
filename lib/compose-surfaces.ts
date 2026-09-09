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
 *
 * The two INDEX routes deliberately keep it: `/studio` is a list of streams
 * and `/live` is a directory, neither of which is a broadcast surface. That
 * distinction is the whole reason these are prefix rules with a trailing
 * slash rather than plain `startsWith` on the section name.
 */
const NO_COMPOSE_EXACT = ["/auth", "/operations"];
const NO_COMPOSE_PREFIX = ["/live/", "/studio/", "/admin", "/operations/"];

export function allowsCompose(pathname: string): boolean {
  if (NO_COMPOSE_EXACT.includes(pathname)) return false;
  return !NO_COMPOSE_PREFIX.some((prefix) => pathname.startsWith(prefix));
}
