"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MARKET_FLAGS } from "@/lib/market-config";
import { createGateway, laneOfFrame, laneTopic, type Gateway } from "@/lib/ws-gateway";
import type { Lane } from "@/features/feed/lib/types";

/**
 * THE REALTIME LANE SIGNAL, layered on the 30-second head check.
 *
 * While the timeline is loaded and the tab is visible, this subscribes to
 * the lane's public topic on the ws-gateway. A `feedHeadChanged` frame for
 * THIS lane re-asks the head exactly as the 30-second tick does — by
 * invalidating `useFeedHead`'s key — so the "N new posts" hold sees it the
 * same way and nothing else changes. The frame is a refetch signal and
 * nothing more: no post data is ever read off the socket.
 *
 * `following` has no topic (it is per-reader) and `platform` is not
 * broadcast, so both keep the poll alone. An unconfigured gateway, a refused
 * socket or a dropped one are all invisible: the poll never stopped.
 */
let gateway: Gateway | null = null;
function sharedGateway(): Gateway {
  if (!gateway) {
    const url = MARKET_FLAGS.wsGatewayUrl;
    gateway = createGateway(
      typeof WebSocket === "undefined" ? "" : url,
      (address) => new WebSocket(address)
    );
  }
  return gateway;
}

export function useLaneSignal(lane: Lane, topics: readonly string[], enabled: boolean) {
  const queryClient = useQueryClient();
  const key = topics.join(",");
  const topic = laneTopic(lane);

  useEffect(() => {
    if (!enabled || !topic || !MARKET_FLAGS.wsGatewayUrl) return;
    let off: (() => void) | null = null;
    const attach = () => {
      if (off || document.visibilityState !== "visible") return;
      off = sharedGateway().subscribe(topic, (frame) => {
        if (laneOfFrame(frame) !== lane) return;
        // The head check's own key — the same refetch the 30s tick performs.
        void queryClient.invalidateQueries({ queryKey: ["ms", "feed", lane, key, "head"] });
      });
    };
    const detach = () => {
      off?.();
      off = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? attach() : detach());
    attach();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      detach();
    };
  }, [enabled, topic, lane, key, queryClient]);
}
