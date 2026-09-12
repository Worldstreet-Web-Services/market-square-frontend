"use client";

import { useSyncExternalStore } from "react";

/**
 * Does this reader ask for less motion?
 *
 * Extracted at the THIRD call site, not the second: `inline-video` and
 * `discover-screen` each grew their own `matchMedia` listener, and the swipe
 * deck would have been a third copy of the same eight lines — each with its own
 * chance of forgetting the cleanup or the SSR case.
 *
 * `useSyncExternalStore` rather than an effect, for the reason it exists: the
 * server has no media queries, so the snapshot there is `false` and the client
 * subscribes on hydration. An effect-based version renders one frame of full
 * motion before correcting itself, which is precisely the frame this setting
 * exists to prevent.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** The server cannot know, and guessing "reduce" would flatten it for everyone. */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
