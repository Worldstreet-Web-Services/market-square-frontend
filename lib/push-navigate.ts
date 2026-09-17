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

export function pushNavigatePath(
  data: unknown,
  { origin, base }: { origin: string; base: "" | "/square" }
): string | null {
  if (!data || typeof data !== "object") return null;
  const { type, url } = data as Record<string, unknown>;
  if (type !== PUSH_NAVIGATE || typeof url !== "string") return null;
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
