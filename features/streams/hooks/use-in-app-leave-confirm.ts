"use client";

import { useEffect } from "react";

/**
 * THE STUDIO'S IN-APP LEAVE CONFIRM.
 *
 * A browser broadcast from `/studio/:id` still lives in its page: following an
 * in-app link unmounts `usePublisher` and ends the stream. So while it is on
 * air, an in-app link click (never a new-tab one) asks first.
 *
 * It used to live inside `usePublisher` itself, which put the same question in
 * front of a gist-room host on every link — and a gist room no longer ends when
 * its page unmounts (components/layout/room-session.tsx). Only the Studio
 * mounts this now.
 */
export function useInAppLeaveConfirm(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const message = "You're live — leaving stops your broadcast.";
    const onClickCapture = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (anchor.getAttribute("target") === "_blank" || !href.startsWith("/")) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [active]);
}
