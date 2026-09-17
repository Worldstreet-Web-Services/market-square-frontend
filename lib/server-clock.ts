/**
 * THE SERVER'S CLOCK, as seen from this device.
 *
 * A deadline the service writes (`inviteExpiresAt`) is on the SERVER's clock,
 * and the device's may be minutes off either way. Read against `Date.now()`
 * raw, a phone running 45 s fast hid an invitation the server still held open
 * for another 45 s. Every response carries a `Date` header; the difference
 * between it and the moment the response arrived is the offset to add to the
 * device's clock to get the server's.
 *
 * The header is whole seconds and is written before the trip back, so a
 * reading can only put the server EARLY — never late. The largest recent
 * reading is therefore the closest, and a deadline built from it can run a
 * second long but never short. A sample far below the held one means the
 * device's own clock was changed, and replaces it.
 *
 * Pure halves here for `lib/server-clock.test.ts`; the one store below is fed
 * by `apiFetch` (lib/api/client.ts).
 */

/** A sample this far below the held reading is the device's clock moving, not noise. */
export const CLOCK_JUMP_MS = 5_000;

/** `serverNow - deviceNow` from one response, or null when the header is unreadable. */
export function offsetFromDateHeader(header: string | null | undefined, receivedAt: number): number | null {
  if (!header) return null;
  const server = Date.parse(header);
  if (!Number.isFinite(server)) return null;
  return server - receivedAt;
}

/** Fold one sample into the held offset. */
export function nextClockOffset(held: number | null, sample: number): number {
  if (held === null) return sample;
  if (sample < held - CLOCK_JUMP_MS) return sample;
  return Math.max(held, sample);
}

let held: number | null = null;

/** Record a response's `Date` header. Called by the transport for every response. */
export function recordServerDate(header: string | null | undefined, receivedAt: number = Date.now()): void {
  const sample = offsetFromDateHeader(header, receivedAt);
  if (sample !== null) held = nextClockOffset(held, sample);
}

/** The offset to add to `Date.now()` for the server's time, or null before any response. */
export function serverClockOffset(): number | null {
  return held;
}
