"use client";

import { useSyncExternalStore } from "react";

/**
 * Is a chat THREAD open right now — one answer for the whole app.
 *
 * The shell mounts the bottom dock, and the dock has no business over a
 * conversation that is being typed into: on a phone it sits exactly where the
 * message composer does, and on desktop it floats over the thread's foot. But
 * which thread is open is `MessagesPage`'s own React state, not the URL, so
 * the shell cannot read it from `usePathname`. This is the doorbell — the
 * same module-level `useSyncExternalStore` shape `lib/ticker-store.ts` uses,
 * not a context and not a store library (CLAUDE.md: no global state manager).
 *
 * The page sets it when a thread opens and clears it on close AND on unmount,
 * so navigating away mid-thread never leaves the dock hidden elsewhere.
 */
let open = false;
const listeners = new Set<() => void>();

export function setChatOpen(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useChatOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
