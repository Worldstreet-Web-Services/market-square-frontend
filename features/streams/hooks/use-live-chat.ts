"use client";

import { useCallback, useEffect, useRef } from "react";
import { RoomEvent, type Room } from "livekit-client";
import type { ChatMessage } from "@/features/streams/lib/types";

/**
 * ROOM CHAT OVER THE CHANNEL EVERYBODY IS ALREADY ON.
 *
 * ─── WHY THIS IS THE BIGGEST SCALING CHANGE AVAILABLE ────────────────────────
 * A viewer in a live room made about 22 requests a MINUTE, and 12 of them were
 * the 5-second chat poll — 55% of all room traffic, spent mostly on being told
 * nothing had changed. At 1,000 viewers that poll alone is 200 requests a
 * second, continuously, against one API and one Postgres.
 *
 * The room already holds a LiveKit connection for audio, and already sends
 * reactions and gift bursts across its data channel (`use-live-reactions`).
 * Chat can ride the same one. LiveKit fans a packet out to every participant —
 * that is what it is for — so a message costs ONE publish regardless of how
 * many people are in the room, and nobody touches the API to receive it.
 *
 *   before   12 req/min per viewer, forever, whether or not anyone speaks
 *   after     2 req/min per viewer (the slow floor), plus nothing per message
 *
 * ─── WHY THE MESSAGE TRAVELS, RATHER THAN A "SOMETHING CHANGED" SIGNAL ───────
 * The house pattern for gateway frames is "a frame is a refetch signal, the
 * poll stays the floor" (ADR-0009), and it is right for a feed. It is WRONG
 * here, and the arithmetic is why: a refetch signal makes every viewer fetch
 * on every message, so N viewers and M messages is N x M requests. At 1,000
 * viewers and ten messages a minute that is 10,000 requests a minute — worse
 * than the poll it replaced.
 *
 * Carrying the message makes it O(1) in viewers. The poll stays as a slow
 * floor so anything dropped heals within 30 seconds, which is the part of the
 * ADR that does carry over.
 *
 * ─── A PEER IS NOT OUR SERVER ────────────────────────────────────────────────
 * Anything arriving here was sent by another browser. Two rules, and the
 * second is the one that matters:
 *
 *  1. CLAMP EVERYTHING. Length, shape, type. A malformed packet draws nothing.
 *  2. THE AUTHOR IS LIVEKIT'S, NEVER THE PAYLOAD'S. `DataReceived` hands us
 *     the sending participant, whose identity was signed into their token by
 *     our own service. Taking the author from the packet would let anyone in
 *     the room publish a message as somebody else — and a chat where any
 *     participant can put words in another person's mouth is worse than one
 *     that is merely slow. The existing reaction handler ignores that argument
 *     because a heart carries no identity to forge; a message does.
 *
 * The consequence is that this only ever DELIVERS EARLY what the poll would
 * have delivered anyway: the service still stores every message, still decides
 * who may post, and still answers the floor. A forged packet can at worst
 * show a line that vanishes on the next refetch — it cannot create one.
 */

/** The data-channel topic. Distinct from reactions and gifts on the same room. */
export const CHAT_TOPIC = "ms-chat";

/** Caps, applied to every field a peer can set. */
const MAX_TEXT = 2000;
const MAX_ID = 64;

/**
 * Publish a message this reader just sent, so the room sees it without asking.
 *
 * Called AFTER the service accepted it, never instead: the packet is an early
 * copy of a message that already exists, so a failed post publishes nothing
 * and a dropped packet costs only latency.
 *
 * `reliable` because a lost chat line is a hole in a conversation, unlike a
 * reaction where the next heart is along in a moment.
 */
export function useLiveChatPublish(room: Room | null) {
  return useCallback(
    (message: ChatMessage) => {
      const local = room?.localParticipant;
      if (!local) return;
      void local
        .publishData(
          new TextEncoder().encode(
            JSON.stringify({ id: message.id, text: message.text, createdAt: message.createdAt })
          ),
          { reliable: true, topic: CHAT_TOPIC }
        )
        .catch(() => {
          // The message is already stored; the poll will carry it. Nothing to say.
        });
    },
    [room]
  );
}

/** What a peer's packet can tell us, once the author has been replaced. */
export interface LiveChatPacket {
  id: string;
  text: string;
  createdAt: string;
  /** LiveKit's identity for the sender — signed by our service, not claimed. */
  fromIdentity: string;
}

/**
 * Listen for messages other people send.
 *
 * @param onMessage Called once per valid packet, with the author replaced by
 *                  the authenticated sender. Never called for our own packets:
 *                  the sender already has the message the service returned.
 */
export function useLiveChat(room: Room | null, onMessage: (packet: LiveChatPacket) => void) {
  // Held in a ref so re-rendering the room does not re-subscribe — a new
  // listener per render would append one copy of every message per render.
  const receive = useRef(onMessage);
  useEffect(() => {
    receive.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!room) return;
    const onData = (
      payload: Uint8Array,
      participant?: { identity?: string; isLocal?: boolean },
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== CHAT_TOPIC) return;
      // Our own echo carries nothing new — we already hold the stored message.
      if (participant?.isLocal) return;
      const identity = participant?.identity;
      // No authenticated sender, no message. See rule 2 above: without this the
      // packet's own claim would be the only author we had.
      if (typeof identity !== "string" || identity.length === 0) return;
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
        if (typeof parsed !== "object" || parsed === null) return;
        const { id, text, createdAt } = parsed as Record<string, unknown>;
        if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID) return;
        if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT) return;
        if (typeof createdAt !== "string" || createdAt.length > 40) return;
        receive.current({ id, text, createdAt, fromIdentity: identity });
      } catch {
        // A malformed packet is not worth surfacing to anyone.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);
}
