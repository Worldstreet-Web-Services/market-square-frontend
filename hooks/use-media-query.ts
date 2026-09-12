"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Does the viewport match this media query right now?
 *
 * The same shape as `useReducedMotion`, generalised for the one case a CSS
 * breakpoint cannot cover: layout that is COMPUTED in JS — a scale factor, a
 * measured width — and has to agree with what a `md:` class is doing to the
 * same element. Reading `window.innerWidth` instead would answer a different
 * question (the window, not the media query the stylesheet is on), and drift
 * from it by the scrollbar.
 *
 * `useSyncExternalStore` so the server renders `serverValue` and the client
 * subscribes on hydration without a frame at the wrong answer.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return serverValue;
    return window.matchMedia(query).matches;
  }, [query, serverValue]);
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
