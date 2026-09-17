/**
 * A TAPPED PUSH, FOLLOWED WITHOUT A RELOAD.
 *
 * The service worker used to answer a tap with `WindowClient.navigate`, which
 * is a full page load: `pagehide` fired, the tab's gist room was torn down,
 * and a host went silent because somebody winked back. It now asks the open
 * Square tab to navigate itself (`public/sw.js` posts `{ type, url }`), and
 * the shell follows it with the client router. A worker cannot import this
 * module, so the message type is spelled in both places and pinned.
 *
 * Only a page of the Square on this origin is followed in-app; anything else
 * answers null, and the worker's own fallback (a real navigation) applies.
 * Pure — `lib/room-session.test.ts` pins it.
 */
export const PUSH_NAVIGATE = "ms:navigate";

/**
 * How close to the worker's deadline an answer is no longer trusted to arrive
 * in time. Past it the worker may already be reloading the tab, and a
 * router.push on top of that is the double navigation.
 */
export const PUSH_ACK_MARGIN_MS = 250;

/*
  THE DEADLINE. The worker waits a bounded time for the tab's "ok" and then
  navigates the hard way. A tab whose JS was busy used to follow the message
  late as well — two navigations. The worker now sends the time its fallback
  fires (`deadline`, epoch ms on the same machine); a message read at or near
  it is ignored and left to the fallback. A message with no deadline (an
  older worker) is followed as before.
*/
export function pushNavigatePath(
  data: unknown,
  { origin, base, now }: { origin: string; base: "" | "/square"; now?: number }
): string | null {
  if (!data || typeof data !== "object") return null;
  const { type, url, deadline } = data as Record<string, unknown>;
  if (type !== PUSH_NAVIGATE || typeof url !== "string") return null;
  if (typeof deadline === "number" && now !== undefined && now >= deadline - PUSH_ACK_MARGIN_MS) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  if (base !== "" && parsed.pathname !== base && !parsed.pathname.startsWith(`${base}/`)) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
