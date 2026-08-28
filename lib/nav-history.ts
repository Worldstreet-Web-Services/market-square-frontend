"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * How many in-app navigations this document has made since it loaded.
 *
 * `router.back()` walks the BROWSER's history, which on a directly loaded page
 * — a shared link, a new tab, a refresh — either does nothing or leaves the
 * app entirely. Counting our own pushes tells a back arrow whether there is
 * anything of ours to go back to.
 */
let pushes = 0;

/** True when a `router.back()` would land on another page of this app. */
export function canGoBack() {
  return pushes > 0;
}

/** Mount once, app-wide: counts every client-side route change. */
export function useTrackNavHistory() {
  const pathname = usePathname();
  const entry = useRef(pathname);
  useEffect(() => {
    // The first run is the page the document loaded on, not a navigation.
    if (pathname === entry.current) return;
    pushes += 1;
  }, [pathname]);
}
