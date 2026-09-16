import { stripSquare } from "./square-path.ts";
/**
 * WHERE THE WELCOME SEQUENCE IS ALLOWED TO APPEAR.
 *
 * Pure and in `lib/` so it can be pinned by tests rather than by clicking
 * through the app signed out — which is exactly how the bug this encodes got
 * shipped in the first place.
 *
 * `/` is the obvious front door. `/auth` is the other one, and it is NOT
 * optional: `SessionGuard` bounces any caller whose session is missing to
 * `/auth`, and a brand-new visitor to `/` becomes one the moment the first
 * gated request comes back 401. Gating on `/` alone meant the sequence either
 * never appeared at all or vanished mid-read as that redirect landed.
 *
 * `returnTo` says WHERE THEY WERE, and that — not its mere presence — is what
 * separates the two people who arrive at `/auth`. The guard attaches it
 * unconditionally, including when it bounces somebody off the front door
 * itself, so `returnTo=/` is the newcomer and reading "has a returnTo" as
 * "has an account" hid the sequence from exactly the person it is for.
 *
 * A `returnTo` pointing at real content is the other person: they were reading
 * something, their session lapsed, and they want it back — not four screens of
 * introduction to an app they already use.
 *
 * Anything else — a shared link to a post, a profile, a stream — is left alone.
 * Signed-out browsing is a real, supported thing in this app, and gating every
 * route behind an intro would break every link anybody has ever sent.
 */
export function isWelcomeSurface(rawPathname: string, rawReturnTo: string | null): boolean {
  // Both are LOGICAL here. usePathname() answers /square/… since the move, and
  // returnTo is a URL built from that same pathname, so both carry the prefix.
  const pathname = stripSquare(rawPathname);
  const returnTo = rawReturnTo === null ? null : stripSquare(rawReturnTo);
  if (pathname === "/") return true;
  if (pathname !== "/auth") return false;
  // Nothing to go back to, or the front door — either way, a newcomer.
  return !returnTo || returnTo === "/";
}
