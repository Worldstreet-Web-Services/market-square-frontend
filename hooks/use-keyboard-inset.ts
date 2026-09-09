"use client";

import { useEffect } from "react";
import { visibleHeight } from "@/lib/keyboard-inset";

/**
 * PUBLISHES `--ws-vvh`: the height actually visible to the reader, so a pinned
 * pane is exactly as tall as the glass — keyboard and URL bar both already
 * accounted for.
 *
 * See `lib/keyboard-inset.ts` for why this is needed at all when the viewport
 * meta already says `interactive-widget=resizes-content` — short version, that
 * is Chromium-only and iOS Safari does not implement it.
 *
 * ─── ON `:root`, DELIBERATELY ───────────────────────────────────────────────
 * The thread's height is a `calc()` in a class name, and a custom property is
 * resolved where it is USED. Publishing on the pane itself would work only for
 * that pane; on `:root` any surface with a pinned footer can subtract it.
 * Nothing else in the app declares the name, so there is no shadowing — and it
 * is REMOVED on unmount rather than left at its last value, or a keyboard
 * dismissed while navigating away would leave every other page short.
 *
 * ─── WHY BOTH EVENTS ────────────────────────────────────────────────────────
 * `resize` fires as the keyboard opens and closes. `scroll` fires when Safari
 * slides the visual viewport inside the layout one — which changes `offsetTop`
 * without changing `height`, and is exactly the case the naive "height only"
 * version gets wrong. Both are passive: this must never delay a scroll.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    // No visualViewport means an old browser, and an old browser is one where
    // there is nothing better to do than leave the layout alone.
    if (!vv) return;

    const root = document.documentElement;
    let last = -1;

    const apply = () => {
      const next = visibleHeight(vv.height);
      // Writing an unchanged value still invalidates layout, and these events
      // fire on every frame of the keyboard's animation.
      if (next === last) return;
      last = next;
      if (next === 0) root.style.removeProperty("--ws-vvh");
      else root.style.setProperty("--ws-vvh", `${next}px`);
    };

    apply();
    vv.addEventListener("resize", apply, { passive: true });
    vv.addEventListener("scroll", apply, { passive: true });
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--ws-vvh");
    };
  }, []);
}
