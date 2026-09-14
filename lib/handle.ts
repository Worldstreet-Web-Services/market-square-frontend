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
 * already identifies the person — `memberName` in lib/api/schemas.ts derives
 * "Member ·GT4T" from the same id — and a name without a handle reads as
 * somebody who has not chosen one yet, which is exactly what is true.
 *
 * A short handle is NOT invented here. Anything this function made up would
 * be untypeable and unroutable: `/u/user_7fk2p9` would 404, because only the
 * service can mint a handle it will answer to. That request is with the
 * backend; when real usernames are assigned at signup this returns them and
 * nothing else changes.
 */
export function atHandle(username: string | null | undefined): string | null {
  if (!username) return null;
  // Every Privy id is `did:privy:…`; the `did:` prefix is the whole method
  // family, so this holds if the issuer ever changes.
  if (username.startsWith("did:")) return null;
  return `@${username}`;
}
