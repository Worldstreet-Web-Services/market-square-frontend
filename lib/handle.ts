import { isAccountId } from "./account-id.ts";

/**
 * THE @HANDLE TO SHOW, OR NOTHING.
 *
 * `username` is a ROUTING KEY: it is in `/u/{username}` and in the service's
 * own paths (`/profiles/{username}/posts`, `/streams`, `/houses`, …). Because
 * a profile that has never claimed one has `username: null`, the schema falls
 * back to the profile id so those links keep resolving — the service accepts
 * an id wherever it accepts a username.
 *
 * That fallback is right for LINKS and wrong for TEXT. It printed the raw
 * Privy DID as a handle, so a comment row read
 * `@did:privy:cmtzq9iox006g0clc4n96gt4t` — forty characters of internal id
 * presented as if somebody could type it (ogazboiz: "can you see how long it
 * is").
 *
 * So: an id is not a handle, and nothing is printed for one. The display NAME
 * already identifies the person — `placeholderName` in lib/api/schemas.ts derives
 * "Member ·GT4T" from the same id — and a name without a handle reads as
 * somebody who has not chosen one yet, which is exactly what is true.
 *
 * A short handle is NOT invented here. Anything this function made up would
 * be untypeable and unroutable: `/u/user_7fk2p9` would 404, because only the
 * service can mint a handle it will answer to.
 *
 * THE SERVICE NOW MINTS ONE — `user_` + eight characters, a real address —
 * and it arrives as `generatedUsername`. So nothing changed here: the schema
 * prefers the chosen handle, then the minted one, then the id, and this still
 * prints whatever it is given unless that is an id. The guard below is what
 * covers the gap until the mint is deployed everywhere, and the case the
 * backend calls impossible (both columns null) if it ever stops being.
 */
export function atHandle(username: string | null | undefined): string | null {
  if (!username) return null;
  // A Privy DID or a Decane UUID — see `lib/account-id.ts`.
  if (isAccountId(username)) return null;
  return `@${username}`;
}
