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
 *
 * ─── iOS SAFARI SCROLL FIX ──────────────────────────────────────────────────
 * iOS Safari does not implement `interactive-widget`, so when a textarea gets
 * focus it scrolls the page body upward to show the input — but `--ws-vvh`
 * already resizes the container, making the scroll redundant and destructive.
 *
 * The fix is iOS-only (detected via `-webkit-touch-callout`): on `focusin`,
 * scroll the window back to (0,0) once. Chrome/Android handles this natively
 * via `interactive-widget=resizes-content` and must NOT have its scroll
 * intercepted, or normal page scrolling shakes and fights.
 */

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const ios = isIOS();
    let last = -1;

    const apply = () => {
      const next = visibleHeight(vv.height);
      if (next === last) return;
      last = next;

      if (next === 0) root.style.removeProperty("--ws-vvh");
      else root.style.setProperty("--ws-vvh", `${next}px`);
    };

    // iOS ONLY: when an input gets focus, Safari scrolls the page body.
    // Undo it once after a frame so the layout stays pinned.
    const onFocusIn = (event: FocusEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        requestAnimationFrame(() => {
          if (window.scrollY !== 0) window.scrollTo(0, 0);
        });
      }
    };

    apply();
    vv.addEventListener("resize", apply, { passive: true });
    vv.addEventListener("scroll", apply, { passive: true });

    // Only attach the scroll-fix on iOS where it's needed.
    if (ios) {
      document.addEventListener("focusin", onFocusIn, { passive: true });
    }

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      if (ios) {
        document.removeEventListener("focusin", onFocusIn);
      }
      root.style.removeProperty("--ws-vvh");
    };
  }, []);
}
