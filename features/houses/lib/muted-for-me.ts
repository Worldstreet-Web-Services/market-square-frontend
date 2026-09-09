/**
 * "Mute for me": who this viewer has silenced, in this house.
 *
 * The most important safety control in a voice room, and the least dramatic.
 * In a room of twelve people blocking is a PUBLIC act with a social cost — the
 * blocked person can tell — so people do not do it and eat the harassment
 * instead. A silence that notifies nobody is the control that actually gets
 * used, and it is one line of DOM: RemoteAudio takes `mutedForMe` and sets the
 * element's volume to zero. Nothing is sent, and the muted person keeps their
 * seat, their name and their level arc.
 *
 * sessionStorage rather than localStorage, deliberately: muting somebody is
 * almost always about THIS conversation, and a silence that follows you into
 * next week's house is a block nobody chose.
 *
 * Held outside React, in the shape lib/sidebar-rail-store.ts already
 * established: the stored set is not state arriving late, it is state that
 * existed before this render. Reading it in an effect means a first paint
 * where somebody is audible and a second where they are not — which for a mute
 * is not a layout jump, it is a person you asked to silence talking.
 *
 * The parse is pure and exported for its own test.
 */

const listeners = new Set<() => void>();
const cache = new Map<string, ReadonlySet<string>>();

export const EMPTY_MUTES: ReadonlySet<string> = new Set();

export function storageKey(houseId: string): string {
  return `ms:house:${houseId}:muted`;
}

/**
 * Read a stored set. Anything unusable is NOBODY muted.
 *
 * The safe direction on a malformed payload is "you can hear everyone": a
 * parse failure must never silently silence somebody, because the person it
 * silenced would simply seem to have stopped talking.
 */
export function parseMutes(raw: string | null): ReadonlySet<string> {
  if (!raw) return EMPTY_MUTES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_MUTES;
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return EMPTY_MUTES;
  }
}

export function toggleMute(current: ReadonlySet<string>, identity: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(identity)) next.delete(identity);
  else next.add(identity);
  return next;
}

function read(houseId: string): ReadonlySet<string> {
  try {
    return parseMutes(window.sessionStorage.getItem(storageKey(houseId)));
  } catch {
    // Private mode, a disabled store, a cross-origin frame — none of which is
    // a reason to fail. It just means the mute lasts as long as the tab does.
    return EMPTY_MUTES;
  }
}

export function getMutes(houseId: string): ReadonlySet<string> {
  let set = cache.get(houseId);
  if (!set) {
    set = read(houseId);
    cache.set(houseId, set);
  }
  return set;
}

/** The server has no storage, and the same object every time keeps React still. */
export function getServerMutes(): ReadonlySet<string> {
  return EMPTY_MUTES;
}

export function setMutes(houseId: string, next: ReadonlySet<string>): void {
  cache.set(houseId, next);
  try {
    window.sessionStorage.setItem(storageKey(houseId), JSON.stringify([...next]));
  } catch {
    // Persisting is a convenience; the mute already applies in this tab.
  }
  for (const listener of listeners) listener();
}

export function subscribeMutes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only — module state would otherwise leak between cases. */
export function __resetMutes(): void {
  cache.clear();
  listeners.clear();
}
