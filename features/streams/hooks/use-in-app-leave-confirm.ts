"use client";

import { useEffect } from "react";
import { setInAppLeaveGuard } from "@/lib/in-app-leave";

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
const LIVE_LEAVE_MESSAGE = "You're live — leaving stops your broadcast.";

export function useInAppLeaveConfirm(active: boolean) {
  // A tapped push navigates without a link click (lib/in-app-leave.ts).
  useInAppLeaveGuard(active, LIVE_LEAVE_MESSAGE);
  useEffect(() => {
    if (!active) return;
    const onClickCapture = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (anchor.getAttribute("target") === "_blank" || !href.startsWith("/")) return;
      if (!window.confirm(LIVE_LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [active]);
}

/**
 * Raise the shell's in-app leave guard while a broadcast lives in this page,
 * so a navigation that is not a link (a tapped push) asks before ending it.
 */
export function useInAppLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    return setInAppLeaveGuard(message);
  }, [active, message]);
}
