"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MARKET_FLAGS } from "@/lib/market-config";
import { roomChatSignalOf, roomChatTopic } from "@/lib/ws-gateway";
import { sharedGateway } from "@/lib/ws-gateway-shared";

/**
 * THE ROOM CHAT SIGNAL, layered over the poll — ADR-0009's shape, applied to
 * the one surface that never got it.
 *
 * A `roomChatChanged` frame for THIS room re-asks the chat exactly as the
 * interval tick does, by invalidating `useChat`'s key. Nothing is read off the
 * socket but the stream id: the messages come from
 * `GET /streams/:id/chat` either way, so a forged or stale frame costs one
 * extra read and can never put words on the screen.
 *
 * ─── WHY THIS IS WORTH A SOCKET AT ALL ──────────────────────────────────────
 * The chat was the most expensive thing in a live room — a fixed 5s poll, 12
 * requests a minute per reader, whether anybody said anything or not. A signal
 * inverts that: a silent room costs nothing and a busy one costs exactly one
 * read per message. The poll is no longer the mechanism, it is the FLOOR.
 *
 * THE POLL DOES NOT MOVE YET, and that is deliberate. Relaxing it is only safe
 * once the service actually publishes this frame; until then a slower interval
 * would be a straight downgrade for every reader, paid now for a benefit that
 * does not exist. Ship the subscriber, confirm the publisher, then relax — the
 * same order every other realtime piece here was switched on in.
 *
 * Detached when the tab is hidden, like the feed's: a backgrounded room does
 * not need to be told about messages nobody is reading, and the interval is
 * already suspended there too.
 */
export function useRoomChatSignal(streamId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const topic = roomChatTopic(streamId);

  useEffect(() => {
    if (!enabled || !topic || !MARKET_FLAGS.wsGatewayUrl) return;
    let off: (() => void) | null = null;
    const attach = () => {
      if (off || document.visibilityState !== "visible") return;
      off = sharedGateway().subscribe(topic, (frame) => {
        if (roomChatSignalOf(frame) !== streamId) return;
        // `useChat`'s own key — the same refetch the interval performs.
        void queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
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
  }, [enabled, topic, streamId, queryClient]);
}
