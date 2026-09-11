"use client";

import { useSyncExternalStore } from "react";
import { carriesMediaList } from "@/lib/post-media";

/**
 * Does this server take MORE THAN ONE picture per post? One answer for the app.
 *
 * Learned from the posts themselves: the moment any fetched post carries the
 * `media` list, the service is the one that accepts `media` on create. Until
 * then the composer picks one file, exactly as before — a server that does not
 * know the field would otherwise publish a post with none of the photos the
 * writer chose. It only ever turns ON; a page that has seen the list keeps it.
 *
 * A module value behind `useSyncExternalStore`, the shape `lib/ticker-store.ts`
 * uses — no context, no store library.
 */
let supported = false;
const listeners = new Set<() => void>();

export function noteMediaContract(posts: ReadonlyArray<{ media?: unknown } | null | undefined>) {
  if (supported || !carriesMediaList(posts)) return;
  supported = true;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMultiMediaSupported(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => supported,
    () => false
  );
}
