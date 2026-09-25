/**
 * IS THIS STRING AN ACCOUNT ID — and never something to print?
 *
 * Profiles fall back to their id wherever a username is missing, so LINKS keep
 * resolving; every surface that prints text has to refuse that fallback. Two
 * shapes of id exist since the move from Privy to Decane:
 *
 *   · `did:privy:cmtzq9iox006g0clc4n96gt4t` — accounts from before the move
 *     (any `did:` method counts; the prefix is the whole family);
 *   · `3f0c9a1e-6b2d-4c1a-9e7f-0a1b2c3d4e5f` — a Decane user id, a UUID.
 *
 * A real handle can be neither: handles carry no colon, and none is a 36-char
 * hyphenated hex UUID.
 *
 * Dependency-free and alias-free so `node --test` runs it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isAccountId(value: string): boolean {
  return value.startsWith("did:") || UUID.test(value);
}

/** Four characters that tell two unnamed accounts apart without publishing either id. */
export function accountIdTail(id: string): string {
  return id.replace(/^did:[^:]+:/u, "").replace(/-/gu, "").slice(-4).toUpperCase();
}
