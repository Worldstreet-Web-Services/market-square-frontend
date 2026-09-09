"use client";

import { useSyncExternalStore } from "react";

/**
 * SIDEBAR OR DOCK — the reader's own call, on this device.
 *
 * Desktop draws the labelled rail; the dock is the phone's navigation and
 * the rail's replacement when it is off. Some people want the room the rail
 * takes (a 1280 laptop with the feed, the rail and the right rail is a tight
 * fit) and some want its labels. A breakpoint cannot know which, so the
 * choice is theirs: a switch on the rail tucks it away and the dock takes
 * over; a switch on the dock brings the rail back. Two switches, because a
 * preference you cannot find your way back from is a trap, not a setting.
 *
 * Per DEVICE, in `localStorage`, exactly like the rail's own width — it is a
 * screen-fit decision, not an account fact, and the same person may want the
 * rail on the monitor and the dock on the laptop. Every storage access is
 * guarded; a browser refusing it simply shows the rail. Default is the rail:
 * the switch is an opt-out, never something a newcomer has to find.
 *
 * The same module-level `useSyncExternalStore` shape `lib/ticker-store.ts`
 * and `lib/chat-open-store.ts` use — not a context, not a store library.
 */
const KEY = "ms:sidebar:hidden";
const listeners = new Set<() => void>();
let cache: boolean | null = null;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSidebarHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {
    /* Unavailable: the choice lasts the session. */
  }
  cache = hidden;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => (cache ??= read());
// The server draws the rail; a preference lives in the browser and is read
// there after hydration.
const getServerSnapshot = () => false;

export function useSidebarHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
