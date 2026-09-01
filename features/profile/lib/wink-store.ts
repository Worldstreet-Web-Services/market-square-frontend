"use client";

import { useSyncExternalStore } from "react";
import { recordWink, WINK_COOLDOWN_MS, type WinkRecord } from "@/lib/winks";

/**
 * Winks this device has sent, so the rules in `lib/winks.ts` have something to
 * decide against.
 *
 * PERSISTED, unlike the follow intents next door, and for the opposite reason:
 * a follow intent is a bridge over a missing response field and must not
 * outlive the session, while a wink budget that resets on reload is not a
 * budget. A reader who has spent their winks and pressed F5 must still have
 * spent them.
 *
 * It is still only a COURTESY — see the header of `lib/winks.ts`. localStorage
 * is clearable, and this is one device. The service has to carry the same
 * limits; this exists so the button can refuse instantly and say something
 * true, not so the limit is enforced here.
 *
 * KEYED PER VIEWER. Two people signing into one browser must not inherit each
 * other's budget or, worse, each other's "you already winked them".
 *
 * Every storage access is try/caught: Safari in private mode throws on
 * localStorage, and a browser setting must never take a control down. A failed
 * read degrades to "no winks recorded", which fails OPEN — the service's own
 * rate limit is what stops the spam in that case, which is where the guarantee
 * belonged anyway.
 */

const EMPTY: WinkRecord[] = [];

const cache = new Map<string, WinkRecord[]>();
const listeners = new Set<() => void>();

function storageKey(viewerId: string): string {
  return `ms.winks.${viewerId}`;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function parse(raw: string | null): WinkRecord[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const rows = parsed.filter(
      (entry): entry is WinkRecord =>
        typeof (entry as WinkRecord)?.targetId === "string" &&
        typeof (entry as WinkRecord)?.at === "number"
    );
    // A row older than the cooldown can no longer affect any decision, so it
    // is dropped on the way in rather than growing forever.
    const now = Date.now();
    return rows.filter((row) => now - row.at < WINK_COOLDOWN_MS);
  } catch {
    return EMPTY;
  }
}

/**
 * The list for a viewer, memoised.
 *
 * `useSyncExternalStore` compares snapshots by reference and re-renders in a
 * loop if a fresh array comes back every call, so the parsed list is cached
 * and only replaced when something actually writes.
 */
export function sentWinks(viewerId: string | null | undefined): WinkRecord[] {
  if (!viewerId) return EMPTY;
  const cached = cache.get(viewerId);
  if (cached) return cached;
  let rows = EMPTY;
  try {
    rows = parse(window.localStorage.getItem(storageKey(viewerId)));
  } catch {
    rows = EMPTY;
  }
  cache.set(viewerId, rows);
  return rows;
}

/** Record a sent wink. Called only after the service has accepted it. */
export function rememberWink(viewerId: string | null | undefined, targetId: string) {
  if (!viewerId) return;
  const next = recordWink(sentWinks(viewerId), targetId, Date.now());
  cache.set(viewerId, next);
  try {
    window.localStorage.setItem(storageKey(viewerId), JSON.stringify(next));
  } catch {
    // Unwritable storage still gets the in-memory update, so the button
    // settles correctly for the rest of this page view.
  }
  emit();
}

// Server render has nothing stored and no viewer resolved yet, so the first
// client render matches the HTML we served. A real record can only exist after
// a wink anyway.
function serverSnapshot(): WinkRecord[] {
  return EMPTY;
}

/** The winks this viewer has sent, re-rendering every wink control on a change. */
export function useSentWinks(viewerId: string | null | undefined): WinkRecord[] {
  return useSyncExternalStore(subscribe, () => sentWinks(viewerId), serverSnapshot);
}
