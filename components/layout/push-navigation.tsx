"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { inAppLeaveGuard } from "@/lib/in-app-leave";
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
      const path = pushNavigatePath(event.data, { origin: window.location.origin, base: SQUARE_BASE, now: Date.now() });
      if (!path) return;
      // Answered FIRST: the question below can block for as long as the
      // reader takes, and a worker left waiting reloads the tab under it.
      event.ports[0]?.postMessage("ok");
      /*
        A broadcast living in this page (the Studio, a guest on a stream's
        stage) ends when the route changes. A link click asks; a push used to
        skip that and end it silently. Declining keeps the reader where they
        are — the answer already sent tells the worker not to reload either.
      */
      const guard = inAppLeaveGuard();
      if (guard && !window.confirm(guard)) return;
      router.push(path);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
