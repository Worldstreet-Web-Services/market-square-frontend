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
 * Resetting `window.scrollTo(0, 0)` ONCE on `focusin` is not enough: the
 * keyboard animates in over a few hundred ms and Safari re-applies its
 * caret-into-view scroll on the layout passes that follow, so a single reset
 * loses the race — the thread's header gets pushed above the top of the glass
 * and a band of empty ground opens below the composer. That is the "page
 * scrolls out of the viewport" bug on the chat thread.
 *
 * So while a field is focused AND `lockScroll` is set — the chat route, where
 * the page must not scroll at all — the window is re-pinned to the top on
 * every `visualViewport` scroll/resize until the field blurs, defeating
 * Safari's scroll continuously rather than once. This is safe there precisely
 * because the body is scroll-locked while a thread is open: the only thing that
 * moves the window is the keyboard, so there is no legitimate scroll to fight.
 * Off the chat route (`lockScroll` false) we keep the old single reset, so a
 * search box focused half-way down a feed is not yanked to the top.
 *
 * The fix is iOS-only (Chrome/Android resizes the layout viewport natively via
 * `interactive-widget=resizes-content` and must NOT have its scroll
 * intercepted, or normal page scrolling shakes and fights).
 */

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isField(node: EventTarget | null): boolean {
  const tag = (node as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * @param lockScroll The surface has locked page scroll (a chat thread is open),
 *   so iOS may keep the window pinned to the top for the whole time a field is
 *   focused. Elsewhere the window is reset only once, on focus.
 */
export function useKeyboardInset(lockScroll = false): void {
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const ios = isIOS();
    let last = -1;
    // Whether a text field is focused right now — the window is only pinned
    // while the keyboard is actually up, never over a resting page.
    let fieldFocused = false;

    const apply = () => {
      const next = visibleHeight(vv.height);
      if (next !== last) {
        last = next;
        if (next === 0) root.style.removeProperty("--ws-vvh");
        else root.style.setProperty("--ws-vvh", `${next}px`);
      }
      // A resize/scroll while typing on the chat route is Safari sliding the
      // caret into view; put the window straight back so the header holds.
      if (ios && lockScroll && fieldFocused && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    // iOS ONLY: when an input gets focus, Safari scrolls the page body. Undo it
    // after a frame so the layout stays pinned; `apply` keeps it pinned for as
    // long as the field holds focus on a scroll-locked surface.
    const onFocusIn = (event: FocusEvent) => {
      if (!isField(event.target)) return;
      fieldFocused = true;
      requestAnimationFrame(() => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };

    const onFocusOut = (event: FocusEvent) => {
      if (isField(event.target)) fieldFocused = false;
    };

    apply();
    vv.addEventListener("resize", apply, { passive: true });
    vv.addEventListener("scroll", apply, { passive: true });

    // Only attach the scroll-fix on iOS where it's needed.
    if (ios) {
      document.addEventListener("focusin", onFocusIn, { passive: true });
      document.addEventListener("focusout", onFocusOut, { passive: true });
    }

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      if (ios) {
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
      }
      root.style.removeProperty("--ws-vvh");
    };
  }, [lockScroll]);
}
