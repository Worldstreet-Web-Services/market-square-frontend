/**
 * THE ADDRESS OF A PERSON, BY WHAT CANNOT CHANGE.
 *
 * QA: "Make sure that the user id is an actual Id and not the @username
 * because users can change their username." A link built from a username
 * points at whoever holds that name, and a name can be released and claimed by
 * somebody else — so a link in a chat, a notification or a comment from
 * before a rename would open a stranger's profile. The profile id never
 * changes and is never reassigned, and the service accepts it on every route
 * that takes a handle.
 *
 * So every link the app DRAWS to a person goes by id. The profile page then
 * swaps the address bar to that person's CURRENT username
 * (`useCanonicalProfileAddress`), so what a reader sees and copies from the bar
 * is still `/u/ogazboiz`.
 *
 * Links shared OUT of the app are the one deliberate exception: they keep the
 * username, because an id is a long `did:privy:…` string and a share link has
 * to be short. The service holds a released username for its owner for 30
 * days, during which those links keep resolving.
 *
 * Pure, so `node --test` pins it.
 */

import { sq } from "./square-path.ts";

/** The ids the service mints are safe path segments; this refuses anything that is not. */
const SAFE_ID = /^[A-Za-z0-9:_-]{1,128}$/;

export function profileHref(
  profile: { id: string; username?: string | null },
  subpage?: string
): string {
  // An id that could not be a path segment falls back to the handle rather
  // than producing a link that breaks, or one that escapes /u/.
  const key = SAFE_ID.test(profile.id) ? profile.id : (profile.username ?? profile.id);
  // Under /square: the Square is served at www.tsionark.com/square (lib/square-path).
  return sq(`/u/${key}${subpage ? `/${subpage}` : ""}`);
}
