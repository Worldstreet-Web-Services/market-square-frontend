"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pushNavigatePath } from "@/lib/push-navigate";
import { SQUARE_BASE } from "@/lib/square-path";

/**
 * A TAPPED PUSH NAVIGATES THIS TAB IN-APP.
 *
 * The service worker asks an open Square tab to follow the notification
 * itself instead of reloading it (`public/sw.js`), because a reload ends the
 * tab's gist room. This answers: a Square page on this origin is pushed onto
 * the client router and acknowledged; anything else is left unanswered, and
 * the worker falls back to a real navigation.
 */
export function PushNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const path = pushNavigatePath(event.data, { origin: window.location.origin, base: SQUARE_BASE });
      if (!path) return;
      router.push(path);
      event.ports[0]?.postMessage("ok");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
